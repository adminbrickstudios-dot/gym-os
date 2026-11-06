-- VD-46L · Resultado: "lo que le debés a los socios" (caso 24, docs/v2/14).
--
-- Plata cobrada por servicio que todavía no se dio:
--   - packs: los usos que le quedan al socio (pack vigente, no anulado), a lo que se pagó por uso;
--   - cuotas: la parte de la cobertura pagada que todavía no pasó (las que ni empezaron
--     se cuentan aparte como "por adelantado").
-- Solo lectura: no guarda nada y no toca ninguna otra función. Se calcula siempre desde los
-- hechos (ventas, coberturas, packs y consumos), con un momento que se puede fijar para probar.
-- Se valúa al neto pagado (precio por cantidad menos descuento) de la venta confirmada; un pack o una
-- cobertura sin venta detrás (cortesía, importación) no tiene plata para devolver: se cuenta
-- aparte, sin sumarlo al total. Mismos permisos que el Resultado (dueño y quien tenga el permiso).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.exigir_resultado(uuid)') is null then raise exception 'Guarda: falta privado.exigir_resultado (EQU-1)'; end if;
  if to_regclass('public.packs') is null or to_regclass('public.consumos_pack') is null or to_regclass('public.coberturas') is null then
    raise exception 'Guarda: faltan packs / consumos_pack / coberturas';
  end if;
end $$;

create or replace function public.deuda_con_socios(p_gimnasio_id uuid, p_momento timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform privado.exigir_resultado(p_gimnasio_id);
  with item as (
    select i.id, (i.cantidad * i.precio_unitario - i.descuento) as neto
      from public.venta_items i join public.ventas v on v.gimnasio_id = i.gimnasio_id and v.id = i.venta_id
     where i.gimnasio_id = p_gimnasio_id and v.estado = 'confirmada'
  ),
  pk as (
    select p.id, p.socio_id, p.plan_id, p.cantidad, p.vence_en,
           p.cantidad - (select count(*)::int from public.consumos_pack c where c.pack_id = p.id and c.anulado_en is null) as restan,
           it.neto / nullif((select count(*) from public.packs z where z.venta_item_id = p.venta_item_id and z.anulado_en is null), 0) as pagado,
           it.id is not null as con_venta
      from public.packs p left join item it on it.id = p.venta_item_id
     where p.gimnasio_id = p_gimnasio_id and p.anulado_en is null and p.desde <= p_momento and (p.vence_en is null or p.vence_en > p_momento)
  ),
  pk2 as (
    select socio_id, plan_id, restan, con_venta,
           case when con_venta then round(coalesce(pagado, 0) * restan / cantidad, 2) else 0 end as valor
      from pk where restan > 0
  ),
  cb as (
    select c.socio_id, s.plan_id, c.desde, c.hasta, it.id is not null as con_venta,
           it.neto / nullif((select count(*) from public.coberturas z where z.venta_item_id = c.venta_item_id and z.anulada_en is null), 0) as pagado
      from public.coberturas c
      join public.suscripciones s on s.gimnasio_id = c.gimnasio_id and s.id = c.suscripcion_id
      left join item it on it.id = c.venta_item_id
     where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null and c.origen = 'pago' and c.hasta > p_momento
  ),
  cb2 as (
    select socio_id, plan_id, desde > p_momento as adelantada, con_venta,
           case when con_venta then round(coalesce(pagado, 0) * extract(epoch from (hasta - greatest(desde, p_momento))) / extract(epoch from (hasta - desde)), 2) else 0 end as valor
      from cb
  ),
  por_socio as (
    select socio_id, sum(valor) as valor, sum(usos) as usos, sum(cuota) as cuota, sum(pack) as pack from (
      select socio_id, valor, restan as usos, 0::numeric as cuota, valor as pack from pk2
      union all
      select socio_id, valor, 0, valor, 0 from cb2
    ) x group by socio_id
  )
  select jsonb_build_object(
    'momento', p_momento,
    'total', coalesce((select sum(valor) from pk2), 0) + coalesce((select sum(valor) from cb2), 0),
    'packs', jsonb_build_object(
      'valor', coalesce((select sum(valor) from pk2), 0),
      'usos', coalesce((select sum(restan) from pk2), 0),
      'socios', (select count(distinct socio_id) from pk2),
      'usos_sin_venta', coalesce((select sum(restan) from pk2 where not con_venta), 0),
      'por_plan', coalesce((select jsonb_agg(jsonb_build_object('plan', pl.nombre, 'usos', y.usos, 'valor', y.valor, 'socios', y.socios) order by y.valor desc, pl.nombre)
                              from (select plan_id, sum(restan)::int as usos, sum(valor) as valor, count(distinct socio_id)::int as socios from pk2 group by plan_id) y
                              join public.planes pl on pl.gimnasio_id = p_gimnasio_id and pl.id = y.plan_id), '[]'::jsonb)),
    'cuotas', jsonb_build_object(
      'valor', coalesce((select sum(valor) from cb2), 0),
      'adelantadas', coalesce((select sum(valor) from cb2 where adelantada), 0),
      'en_curso', coalesce((select sum(valor) from cb2 where not adelantada), 0),
      'socios', (select count(distinct socio_id) from cb2 where con_venta),
      'sin_venta', (select count(*) from cb2 where not con_venta),
      'por_plan', coalesce((select jsonb_agg(jsonb_build_object('plan', pl.nombre, 'valor', y.valor, 'socios', y.socios) order by y.valor desc, pl.nombre)
                              from (select plan_id, sum(valor) as valor, count(distinct socio_id)::int as socios from cb2 where con_venta group by plan_id) y
                              join public.planes pl on pl.gimnasio_id = p_gimnasio_id and pl.id = y.plan_id), '[]'::jsonb)),
    'mayores', coalesce((select jsonb_agg(jsonb_build_object('socio_id', m.socio_id, 'nombre', trim(so.nombre || ' ' || so.apellido), 'valor', m.valor, 'usos', m.usos, 'cuotas', m.cuota, 'packs', m.pack)
                                         order by m.valor desc, so.nombre)
                           from (select * from por_socio where valor > 0 order by valor desc limit 10) m
                           join public.socios so on so.gimnasio_id = p_gimnasio_id and so.id = m.socio_id), '[]'::jsonb)
  ) into r;
  return r;
end $$;

revoke all on function public.deuda_con_socios(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.deuda_con_socios(uuid, timestamptz) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text := 'public.deuda_con_socios(uuid, timestamptz)';
begin
  if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
  if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  if not has_function_privilege('authenticated', f, 'execute') then raise exception 'Verificación: authenticated no puede ejecutar %', f; end if;
end $$;
