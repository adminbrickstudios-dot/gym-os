-- F5.1 (carril D) · Tres cosas de pantallas del panel que faltaban:
--   FA-10  tasa_de_cobro(gimnasio, mes): de los socios a los que se les vencía la cuota este mes, cuántos ya renovaron. Con su lista.
--   FA-11  fotos_de_clase(clase): la foto (su versión) de cada anotado, para mostrarla en la lista de la clase.
--   FA-21  diferencia_caja_por_cajero(gimnasio, dias): lo que faltó o sobró en los cierres de cada cajero, acumulado.
-- Todo se calcula al consultar a partir de los hechos (coberturas, reservas, turnos de caja): no se guarda nada nuevo.
-- Aditiva e idempotente.

do $g$ begin
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'F5.1: falta privado.exigir_equipo'; end if;
  if to_regclass('public.coberturas') is null or to_regclass('public.turnos_caja') is null or to_regclass('public.reservas') is null then raise exception 'F5.1: faltan tablas'; end if;
end $g$;

-- ── FA-10 · Tasa de cobro del mes ──────────────────────────────────
-- "Les tocaba": socios sin baja cuya cobertura vencía dentro del mes y ya pasó (hasta < ahora). "Renovaron": su cubierto_hasta
-- llegó después de ese vencimiento. Un socio cuenta una vez por mes (su vencimiento más tardío dentro del mes).
create or replace function public.tasa_de_cobro(p_gimnasio_id uuid, p_mes date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; ini timestamptz; fin timestamptz; res jsonb;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  ini := privado.medianoche(date_trunc('month', coalesce(p_mes, (now() at time zone zona)::date))::date, zona);
  fin := privado.medianoche((date_trunc('month', coalesce(p_mes, (now() at time zone zona)::date)) + interval '1 month')::date, zona);
  with vencidos as (
    select c.socio_id, max(c.hasta) as vencio
      from public.coberturas c
     where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null and c.hasta >= ini and c.hasta < least(fin, now())
     group by c.socio_id),
  estado as (
    select v.socio_id, v.vencio, s.nombre || ' ' || s.apellido as nombre, s.telefono,
           (s.cubierto_hasta is not null and s.cubierto_hasta > v.vencio) as renovo
      from vencidos v join public.socios s on s.id = v.socio_id and s.gimnasio_id = p_gimnasio_id
     where s.dado_de_baja_en is null)
  select jsonb_build_object(
           'mes', to_char(ini at time zone zona, 'YYYY-MM'),
           'tocaba', count(*), 'renovaron', count(*) filter (where renovo),
           'tasa', case when count(*) = 0 then null else round(100.0 * count(*) filter (where renovo) / count(*), 1) end,
           'pendientes', coalesce(jsonb_agg(jsonb_build_object('socio_id', socio_id, 'nombre', nombre, 'telefono', telefono, 'vencio', vencio) order by vencio) filter (where not renovo), '[]'::jsonb))
    into res from estado;
  return res;
end $$;

-- ── FA-11 · Fotos de los anotados de una clase ─────────────────────
create or replace function public.fotos_de_clase(p_clase_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select c.gimnasio_id into g from public.clases c where c.id = p_clase_id;
  if g is null then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion', 'profe']);
  return coalesce((select jsonb_agg(jsonb_build_object('socio_id', s.id, 'version', right(left(s.foto_path, length(s.foto_path) - 4), 32)))
                     from public.reservas r join public.socios s on s.id = r.socio_id and s.gimnasio_id = r.gimnasio_id
                    where r.clase_id = p_clase_id and r.estado = 'confirmada' and s.foto_path is not null), '[]'::jsonb);
end $$;

-- ── FA-21 · Diferencia de caja acumulada por cajero ────────────────
-- Cajero = quien cerró el turno (quien cuenta responde por el cajón). Solo turnos cerrados y contados.
create or replace function public.diferencia_caja_por_cajero(p_gimnasio_id uuid, p_dias int default 90) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if p_dias is null or p_dias < 1 or p_dias > 366 then raise exception 'Los días van de 1 a 366' using errcode = '22023'; end if;
  return coalesce((
    select jsonb_agg(x order by x.diferencia)
      from (select e.id as equipo_id, e.nombre as cajero, count(*)::int as turnos,
                   sum(t.monto_contado - t.monto_esperado) as diferencia,
                   sum(greatest(t.monto_contado - t.monto_esperado, 0)) as sobrante,
                   sum(greatest(t.monto_esperado - t.monto_contado, 0)) as faltante,
                   count(*) filter (where t.monto_contado <> t.monto_esperado)::int as con_diferencia
              from public.turnos_caja t join public.equipo e on e.id = t.cerrado_por and e.gimnasio_id = t.gimnasio_id
             where t.gimnasio_id = p_gimnasio_id and t.cerrado_en is not null and t.monto_contado is not null and not coalesce(t.sin_contar, false)
               and t.cerrado_en > now() - make_interval(days => p_dias)
             group by e.id, e.nombre) x), '[]'::jsonb);
end $$;

revoke all on function public.tasa_de_cobro(uuid, date), public.fotos_de_clase(uuid), public.diferencia_caja_por_cajero(uuid, int) from public, anon, authenticated;
grant execute on function public.tasa_de_cobro(uuid, date), public.fotos_de_clase(uuid), public.diferencia_caja_por_cajero(uuid, int) to authenticated, service_role;

do $v$ begin
  if has_function_privilege('anon', 'public.tasa_de_cobro(uuid, date)', 'execute') or has_function_privilege('anon', 'public.diferencia_caja_por_cajero(uuid, int)', 'execute')
     or has_function_privilege('anon', 'public.fotos_de_clase(uuid)', 'execute') then raise exception 'F5.1: no son para anónimos'; end if;
end $v$;
