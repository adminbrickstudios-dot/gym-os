-- VD-14 · Vencen y cobrar con pestañas y totales (docs/v2/03 §4).
-- Una sola llamada trae lo que la pantalla necesita, calculado por la base con el mismo cálculo de la
-- retención (privado.retencion): nada se reimplementa en la pantalla ni se guarda.
--   * hoy        los que vencen hoy (el último día cubierto es hoy)
--   * vencidos   los que les venció y no pagaron (con lo que deben)
--   * por_vencer los que vencen en los próximos días (dentro de la ventana de aviso del gimnasio)
--   * modo       cómo vencen las cuotas del gimnasio; con día fijo: "Período de pago, día 4 de 10"
-- Totales por pestaña: cantidad y plata. La plata de la cuota mensual la ven dueño y encargado; la recepción
-- ve cantidades y lo que debe cada vencido (el mismo dato que ya lee en la puerta), nunca lo que paga cada uno.
-- Los "prometieron pagar" siguen en public.prometieron_pagar (REV-1a / VD-8).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.retencion(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.retencion'; end if;
  if to_regprocedure('privado.dia_local(timestamptz, text)') is null then raise exception 'Guarda: falta privado.dia_local'; end if;
  if to_regclass('public.configuracion_vencimiento') is null then raise exception 'Guarda: falta configuracion_vencimiento (VD-7)'; end if;
end $$;

-- La cuenta pura del período de pago: en qué día del mes estamos respecto del día fijo.
create or replace function privado.periodo_pago(p_renovacion text, p_dia_fijo int, p_hoy date) returns jsonb
language sql immutable set search_path = '' as $$
  select case
    when p_renovacion = 'dia_fijo' and p_dia_fijo is not null then jsonb_build_object(
      'renovacion', p_renovacion, 'dia_fijo', p_dia_fijo, 'dia_hoy', extract(day from p_hoy)::int,
      'pasado', extract(day from p_hoy)::int > p_dia_fijo,
      'texto', case when extract(day from p_hoy)::int <= p_dia_fijo
                    then 'Período de pago, día ' || extract(day from p_hoy)::int || ' de ' || p_dia_fijo
                    else 'Período de pago: el día ' || p_dia_fijo || ' ya pasó (hoy es el ' || extract(day from p_hoy)::int || ')' end)
    when p_renovacion = 'desde_pago' then jsonb_build_object('renovacion', p_renovacion, 'texto', 'Cada cuota dura desde el día que se paga')
    else jsonb_build_object('renovacion', coalesce(p_renovacion, 'continua'), 'texto', 'Cada cuota empieza donde termina la anterior')
  end
$$;
revoke all on function privado.periodo_pago(text, int, date) from public, anon, authenticated;

create or replace function public.vencen_pestanas(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; zona text; gestion boolean; c public.configuracion_vencimiento; hay boolean; r jsonb;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  gestion := e.rol in ('dueno', 'encargado');
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  select * into c from public.configuracion_vencimiento where gimnasio_id = p_gimnasio_id;
  hay := found;
  with x as materialized (
    select t.socio_id, t.nombre, t.telefono, t.texto, t.dias, t.vence_en,
           case when gestion then t.monto_mensual end as monto_mensual, t.debe, t.ultimo_ingreso,
           t.ultimo_contacto_en, t.ultimo_contacto_por, t.mensaje,
           case when t.lista = 'vencido' then 'vencidos' when t.dias = 0 then 'hoy' else 'por_vencer' end as pestana
      from privado.retencion(p_gimnasio_id, now()) t
     where t.lista in ('vencido', 'por_vencer')
  )
  select jsonb_build_object(
    'modo', privado.periodo_pago(case when hay then c.renovacion end, case when hay then c.dia_fijo end, privado.dia_local(now(), zona)),
    'hoy', jsonb_build_object(
      'cantidad', (select count(*) from x where pestana = 'hoy'),
      'plata', case when gestion then (select coalesce(sum(monto_mensual), 0) from x where pestana = 'hoy') end,
      'filas', coalesce((select jsonb_agg(to_jsonb(x) - 'pestana' order by x.nombre) from x where pestana = 'hoy'), '[]')),
    'vencidos', jsonb_build_object(
      'cantidad', (select count(*) from x where pestana = 'vencidos'),
      'plata', (select coalesce(sum(debe), 0) from x where pestana = 'vencidos'),
      'filas', coalesce((select jsonb_agg(to_jsonb(x) - 'pestana' order by x.dias desc, x.nombre) from x where pestana = 'vencidos'), '[]')),
    'por_vencer', jsonb_build_object(
      'cantidad', (select count(*) from x where pestana = 'por_vencer'),
      'plata', case when gestion then (select coalesce(sum(monto_mensual), 0) from x where pestana = 'por_vencer') end,
      'filas', coalesce((select jsonb_agg(to_jsonb(x) - 'pestana' order by x.dias, x.nombre) from x where pestana = 'por_vencer'), '[]')))
    into r;
  return r;
end $$;
revoke all on function public.vencen_pestanas(uuid) from public, anon, authenticated;
grant execute on function public.vencen_pestanas(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.vencen_pestanas(uuid)') is null then raise exception 'Verificación: falta vencen_pestanas'; end if;
  if has_function_privilege('anon', 'public.vencen_pestanas(uuid)', 'execute') then raise exception 'Verificación: vencen_pestanas quedó para anon'; end if;
  if privado.periodo_pago('dia_fijo', 10, date '2026-11-04') ->> 'texto' <> 'Período de pago, día 4 de 10' then raise exception 'Verificación: periodo_pago'; end if;
end $$;
