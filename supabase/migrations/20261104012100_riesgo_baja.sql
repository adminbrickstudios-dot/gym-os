-- 0121 · Riesgo de baja (COM-1).
-- De los socios que todavía pagan (tienen la cuota cubierta hoy), los que
-- muestran señales de irse, con el porqué en una línea y un nivel:
--   · viene la mitad o menos que su promedio de las 8 semanas anteriores
--   · reservaba seguido y hace 2 semanas que no reserva
--   · pidió una pausa en el último mes, o pidió la baja (pendiente)
--   · y, si ya hay otra señal, que vence en una semana sin haber renovado
-- Alto: pidió la baja, o dos señales o más. Medio: una. Reglas en SQL, sin
-- IA; se calcula al mirar, no se guarda. "No abre la app" no entra: la app
-- no registra cuándo se abre (no hay un hecho del que calcularlo).
--   riesgo_baja(gimnasio, socio = null) → [{ socio_id, nombre, telefono, nivel, porque[], mensaje }]
-- Lo ven los mismos que Retención (dueño, encargado y recepción, D2).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.retencion(uuid)') is null then raise exception 'Guarda: falta Retención'; end if;
  if to_regclass('public.pedidos_baja') is null or to_regclass('public.pedidos_pausa') is null then raise exception 'Guarda: faltan los pedidos de pausa y de baja'; end if;
end $$;

create or replace function public.riesgo_baja(p_gimnasio_id uuid, p_socio_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; gim text; ahora timestamptz := now(); plantilla text;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.zona_horaria, g.nombre into zona, gim from public.gimnasios g where g.id = p_gimnasio_id;
  select coalesce(p.texto, (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = 'no_viene'))
    into plantilla from (select 1) x left join public.plantillas_mensaje p on p.gimnasio_id = p_gimnasio_id and p.clave = 'no_viene';
  return coalesce((
    with activos as (
      -- Pagan hoy: una cobertura vigente (los vencidos ya están en sus listas de Retención).
      select s.id, s.nombre, s.apellido, s.telefono, s.responsable_telefono, s.fecha_nacimiento,
             (select max(c.hasta) from public.coberturas c where c.socio_id = s.id and c.anulada_en is null and c.desde <= ahora and c.hasta > ahora) as fin,
             exists (select 1 from public.coberturas c where c.socio_id = s.id and c.anulada_en is null and c.desde > ahora) as renovo,
             (select max(i.momento) from public.ingresos i where i.socio_id = s.id and i.anulado_en is null and i.resultado <> 'rechazado' and i.momento <= ahora) as ultimo
        from public.socios s
       where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null and (p_socio_id is null or s.id = p_socio_id)
         and exists (select 1 from public.coberturas c where c.socio_id = s.id and c.anulada_en is null and c.desde <= ahora and c.hasta > ahora)
    ),
    visitas as (
      select a.id,
             count(distinct (i.momento at time zone zona)::date) filter (where i.momento < ahora - interval '14 days')::numeric / 8 as antes,
             count(distinct (i.momento at time zone zona)::date) filter (where i.momento >= ahora - interval '14 days')::numeric / 2 as ahora_sem
        from activos a
        join public.ingresos i on i.socio_id = a.id and i.anulado_en is null and i.resultado <> 'rechazado'
                              and i.momento >= ahora - interval '70 days' and i.momento <= ahora
       group by a.id
    ),
    reservas as (
      select a.id,
             count(*) filter (where c.inicio < ahora - interval '14 days') as antes,
             count(*) filter (where c.inicio >= ahora - interval '14 days') as ahora_n
        from activos a
        join public.reservas r on r.socio_id = a.id and r.estado <> 'cancelada'
        join public.clases c on c.id = r.clase_id and c.inicio >= ahora - interval '42 days' and c.inicio <= ahora + interval '14 days'
       group by a.id
    ),
    senales as (
      select a.*, array_remove(array[
          case when v.antes >= 1.5 and v.ahora_sem <= v.antes / 2 then
            'Venía ' || round(v.antes) || ' veces por semana' ||
            case when v.ahora_sem = 0 then ' y hace ' || ((ahora at time zone zona)::date - (a.ultimo at time zone zona)::date) || ' días que no viene'
                 else '; las últimas 2 semanas, ' || round(v.ahora_sem, 1) || ' por semana' end end,
          case when coalesce(r.antes, 0) >= 3 and coalesce(r.ahora_n, 0) = 0 then 'Reservaba seguido y hace 2 semanas que no reserva' end,
          (select 'Pidió una pausa el ' || privado.fecha_corta(max(pp.pedido_en), zona) from public.pedidos_pausa pp
            where pp.socio_id = a.id and pp.estado <> 'rechazado' and pp.pedido_en >= ahora - interval '30 days' having count(*) > 0),
          (select 'Pidió la baja el ' || privado.fecha_corta(max(pb.pedido_en), zona) from public.pedidos_baja pb
            where pb.socio_id = a.id and pb.estado = 'pendiente' having count(*) > 0)
        ], null) as base,
        exists (select 1 from public.pedidos_baja pb where pb.socio_id = a.id and pb.estado = 'pendiente') as pidio_baja,
        coalesce(v.ahora_sem, 0) as viene
        from activos a left join visitas v on v.id = a.id left join reservas r on r.id = a.id
    ),
    con_vence as (
      select x.*,
             case when cardinality(x.base) > 0 and not x.renovo and x.fin <= ahora + interval '7 days'
                  then x.base || ('Vence el ' || privado.ultimo_dia(x.fin, zona) || ' y no renovó') else x.base end as porque
        from senales x
       where cardinality(x.base) > 0
    )
    select jsonb_agg(jsonb_build_object(
             'socio_id', c.id, 'nombre', trim(c.nombre || ' ' || c.apellido),
             'telefono', privado.celular_aviso(c.telefono, c.responsable_telefono, c.fecha_nacimiento, (ahora at time zone zona)::date),
             'nivel', case when c.pidio_baja or cardinality(c.porque) >= 2 then 'alto' else 'medio' end,
             'porque', to_jsonb(c.porque),
             -- El mensaje es el de "No viene" (CFG-5), con los días desde su última visita.
             'mensaje', privado.armar_mensaje(plantilla, jsonb_build_object('nombre', c.nombre, 'gimnasio', gim,
                        'dias', coalesce(((ahora at time zone zona)::date - (c.ultimo at time zone zona)::date)::text, 'varios'))))
           order by (c.pidio_baja or cardinality(c.porque) >= 2) desc, cardinality(c.porque) desc, c.viene, c.nombre)
      from con_vence c), '[]');
end $$;
revoke all on function public.riesgo_baja(uuid, uuid) from public, anon, authenticated;
grant execute on function public.riesgo_baja(uuid, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.riesgo_baja(uuid, uuid)') is null then raise exception 'Verificación: falta riesgo_baja'; end if;
  if has_function_privilege('anon', 'public.riesgo_baja(uuid, uuid)', 'execute') then raise exception 'Verificación: quedó para anon'; end if;
end $$;
