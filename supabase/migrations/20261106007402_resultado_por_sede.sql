-- VD-46P · Resultado por sede: dónde se cobró y dónde se usó (casos 86 y 87, docs/v2/14).
--
-- Para repartir lo que entra entre sedes cuando un socio entrena en las dos:
--   cobrado   lo que se cobró en cada sede (la sede de la venta), pagos aprobados del mes
--             (mismo criterio que el cobrado del Resultado: sin cuenta corriente);
--   usado     las entradas que tuvo cada sede en el mes (sin anuladas ni rechazadas) y los socios distintos;
--   repartido la parte de servicio (cuotas, pases y packs) de lo cobrado a cada socio, repartida entre las
--             sedes en proporción a sus entradas del mes; lo que no es servicio (productos, matrículas, recargos),
--             los socios que no entraron en el mes y las ventas sin socio quedan en la sede donde se cobró.
-- El total repartido es siempre igual al total cobrado: nada se pierde ni se inventa.
-- Solo lectura, función nueva; no se toca resultado_mes. Mismos permisos que el Resultado (EQU-1).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.exigir_resultado(uuid)') is null then raise exception 'Guarda: falta privado.exigir_resultado (EQU-1)'; end if;
  if to_regprocedure('privado.medianoche(date, text)') is null then raise exception 'Guarda: falta privado.medianoche'; end if;
  if to_regclass('public.ingresos') is null then raise exception 'Guarda: falta ingresos'; end if;
end $$;

create or replace function public.resultado_por_sede(p_gimnasio_id uuid, p_mes date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; mes date; fin date; d0 timestamptz; d1 timestamptz; r jsonb;
begin
  perform privado.exigir_resultado(p_gimnasio_id);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  mes := date_trunc('month', coalesce(p_mes, hoy))::date;
  if mes > hoy then raise exception 'Ese mes todavía no empezó' using errcode = '22023'; end if;
  fin := (mes + interval '1 month')::date;
  d0 := privado.medianoche(mes, zona);
  d1 := privado.medianoche(fin, zona);

  with pg as (
    select v.sede_id as sede_cobro, v.socio_id, p.monto,
           coalesce((select case when sum(i.cantidad * i.precio_unitario - i.descuento) > 0
                                 then sum(case when i.tipo in ('cuota', 'pase', 'pack') then i.cantidad * i.precio_unitario - i.descuento else 0 end)
                                      / sum(i.cantidad * i.precio_unitario - i.descuento) end
                       from public.venta_items i where i.gimnasio_id = p_gimnasio_id and i.venta_id = v.id), 0) as servicio
      from public.pagos p join public.ventas v on v.gimnasio_id = p.gimnasio_id and v.id = p.venta_id
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.medio <> 'cuenta_corriente'
       and p.aprobado_en >= d0 and p.aprobado_en < d1
  ),
  ent as (
    select i.socio_id, i.sede_id, count(*)::int as n
      from public.ingresos i
     where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado' and i.momento >= d0 and i.momento < d1 and i.socio_id is not null
     group by i.socio_id, i.sede_id
  ),
  tot as (select socio_id, sum(n)::int as n from ent group by socio_id),
  cobrado as (select sede_cobro as sede_id, sum(monto) as v from pg group by sede_cobro),
  -- Lo que se reparte por uso: la parte de servicio de quien entró en el mes.
  por_uso as (
    select e.sede_id, sum(pg.monto * pg.servicio * e.n / t.n) as v
      from pg join ent e on e.socio_id = pg.socio_id join tot t on t.socio_id = e.socio_id group by e.sede_id
  ),
  -- Lo que se queda donde se cobró: todo lo que no se repartió por uso.
  se_queda as (
    select sede_cobro as sede_id,
           sum(case when socio_id is not null and exists (select 1 from tot t where t.socio_id = pg.socio_id) then pg.monto * (1 - pg.servicio) else pg.monto end) as v
      from pg group by sede_cobro
  ),
  uso as (select sede_id, sum(n)::int as entradas, count(distinct socio_id)::int as socios from ent group by sede_id),
  filas as (
    select s.id as sede_id, s.nombre,
           coalesce(c.v, 0) as cobrado,
           coalesce(u.entradas, 0) as entradas, coalesce(u.socios, 0) as socios,
           coalesce(q.v, 0) + coalesce(pu.v, 0) as repartido
      from public.sedes s
      left join cobrado c on c.sede_id = s.id left join uso u on u.sede_id = s.id
      left join se_queda q on q.sede_id = s.id left join por_uso pu on pu.sede_id = s.id
     where s.gimnasio_id = p_gimnasio_id
  )
  select jsonb_build_object(
    'mes', mes, 'en_curso', hoy < fin,
    'cobrado', coalesce((select sum(cobrado) from filas), 0),
    'repartido', coalesce((select sum(repartido) from filas), 0),
    'compartidos', (select count(*)::int from (select socio_id from ent group by socio_id having count(*) > 1) z),
    'sedes', coalesce((select jsonb_agg(jsonb_build_object('sede_id', f.sede_id, 'nombre', f.nombre, 'cobrado', round(f.cobrado, 2),
                       'entradas', f.entradas, 'socios', f.socios, 'repartido', round(f.repartido, 2)) order by f.nombre) from filas f), '[]'::jsonb)
  ) into r;
  return r;
end $$;

revoke all on function public.resultado_por_sede(uuid, date) from public, anon, authenticated;
grant execute on function public.resultado_por_sede(uuid, date) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text := 'public.resultado_por_sede(uuid, date)';
begin
  if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
  if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  if not has_function_privilege('authenticated', f, 'execute') then raise exception 'Verificación: authenticated no puede ejecutar %', f; end if;
end $$;
