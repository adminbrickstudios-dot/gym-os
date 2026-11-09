-- ═══════════════════════════════════════════════════════════════════
-- FA-14 · App del socio: recomendación con regla clara, insignias simples y resumen del año.
-- Todo se CALCULA de lo que ya existe (ingresos, asistencias, rutina hecha): no se guarda ningún estado y no hay cron.
-- Solo informa: no decide nada sobre el acceso ni sobre la plata. Sin datos de salud.
--   resumen_app_socio(socio, momento)  — el momento se puede fijar (pruebas); por defecto, ahora.
--
-- La regla de la recomendación (una sola, escrita acá y en docs/base/PROGRESO.md):
--   si el socio vino alguna vez y hace 7 días o más que no entra, se lo dice con los días
--   ("Hace 10 días que no venís.") y, si el gimnasio tiene clases, le suma la próxima de hoy
--   ("Hoy hay Funcional a las 19:00."). Si vino hace menos de 7 días o nunca vino: no recomienda nada.
-- Las insignias son solo contar hechos: visitas (1, 10, 50, 100), racha de 4 semanas seguidas, primera clase y 10 días de rutina.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('privado.mis_socios()') is null then raise exception 'Guarda: falta privado.mis_socios'; end if;
  if to_regclass('public.horarios_clase') is null or to_regclass('public.asistencias') is null or to_regclass('public.rutina_dias_hechos') is null then
    raise exception 'Guarda: faltan clases, asistencias o rutina_dias_hechos';
  end if;
end $$;

create or replace function public.resumen_app_socio(p_socio_id uuid, p_momento timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  g uuid; zona text; ahora timestamp; hoy date; anio int;
  v_total int; v_ultima date; v_dias int; v_semanas_seguidas int; v_clases_total int; v_rutina_total int;
  v_con_clases boolean; v_cl_nombre text := null; v_cl_hora time := null; v_reco jsonb := null;
  vd date[]; v_anio_visitas int; v_mes_top int; v_dia_top int; v_anio_clases int; v_anio_rutina int; v_mejor_racha int;
begin
  if not exists (select 1 from public.socios s where s.id = p_socio_id and s.id in (select privado.mis_socios())) then
    raise exception 'Sin permiso o socio inexistente' using errcode = '42501';
  end if;
  select s.gimnasio_id, gi.zona_horaria into g, zona from public.socios s join public.gimnasios gi on gi.id = s.gimnasio_id where s.id = p_socio_id;
  ahora := p_momento at time zone zona; hoy := ahora::date; anio := extract(year from ahora)::int;

  -- Los días (locales) en que entró: de acá salen todas las cuentas (una función "stable" no puede crear tablas temporales).
  select coalesce(array_agg((i.momento at time zone zona)::date), '{}') into vd
    from public.ingresos i
   where i.socio_id = p_socio_id and i.anulado_en is null and i.resultado in ('entro', 'entro_modo_aviso', 'forzado') and i.momento <= p_momento;

  select count(*), max(dia) into v_total, v_ultima from (select u.dia, date_trunc('week', u.dia)::date as semana from unnest(vd) u(dia)) vs;

  -- Semanas seguidas con al menos una visita, terminando esta semana o la anterior (la semana en curso todavía puede sumar).
  select coalesce(max(n), 0) into v_semanas_seguidas from (
    select count(*) n, max(sem) fin from (
      select sem, sem - ((row_number() over (order by sem))::int * 7) grupo from (select distinct semana sem from (select u.dia, date_trunc('week', u.dia)::date as semana from unnest(vd) u(dia)) vs) d) x
    group by grupo) y where fin >= date_trunc('week', ahora)::date - 7;

  select count(*) into v_clases_total from public.asistencias a where a.socio_id = p_socio_id and a.anulada_en is null;
  select count(*) into v_rutina_total from public.rutina_dias_hechos h where h.socio_id = p_socio_id and h.fecha <= hoy;

  -- Recomendación (la regla de arriba).
  if v_ultima is not null then
    v_dias := hoy - v_ultima;
    if v_dias >= 7 then
      select c.modo_clases <> 'ninguno' and not ('clases' = any (c.secciones_apagadas)) into v_con_clases from public.configuracion_gimnasio c where c.gimnasio_id = g;
      if coalesce(v_con_clases, false) then
        select a.nombre, h.hora_inicio into v_cl_nombre, v_cl_hora
          from public.horarios_clase h join public.actividades a on a.id = h.actividad_id
         where h.gimnasio_id = g and h.dia_semana = extract(isodow from ahora)::int and h.vigente_desde <= hoy and (h.vigente_hasta is null or h.vigente_hasta >= hoy)
           and h.hora_inicio > ahora::time
         order by h.hora_inicio limit 1;
      end if;
      v_reco := jsonb_build_object('regla', 'sin_venir_7_dias', 'dias', v_dias,
        'clase', case when v_cl_nombre is not null then jsonb_build_object('nombre', v_cl_nombre, 'hora', to_char(v_cl_hora, 'HH24:MI')) end,
        'texto', format('Hace %s días que no venís.', v_dias)
                 || case when v_cl_nombre is not null then format(' Hoy hay %s a las %s.', v_cl_nombre, to_char(v_cl_hora, 'HH24:MI')) else ' ¡Te esperamos!' end);
    end if;
  end if;

  -- Resumen del año (el año local del gimnasio en el momento pedido).
  select count(*) into v_anio_visitas from (select u.dia, date_trunc('week', u.dia)::date as semana from unnest(vd) u(dia)) vs where extract(year from dia) = anio;
  select m into v_mes_top from (select extract(month from dia)::int m, count(*) n from (select u.dia, date_trunc('week', u.dia)::date as semana from unnest(vd) u(dia)) vs where extract(year from dia) = anio group by 1 order by n desc, m limit 1) q;
  select d into v_dia_top from (select extract(isodow from dia)::int d, count(*) n from (select u.dia, date_trunc('week', u.dia)::date as semana from unnest(vd) u(dia)) vs where extract(year from dia) = anio group by 1 order by n desc, d limit 1) q;
  select count(*) into v_anio_clases from public.asistencias a join public.clases c on c.id = a.clase_id
   where a.socio_id = p_socio_id and a.anulada_en is null and extract(year from c.inicio at time zone zona) = anio and c.inicio <= p_momento;
  select count(*) into v_anio_rutina from public.rutina_dias_hechos h where h.socio_id = p_socio_id and extract(year from h.fecha) = anio and h.fecha <= hoy;
  select coalesce(max(n), 0) into v_mejor_racha from (
    select count(*) n from (select sem, sem - ((row_number() over (order by sem))::int * 7) grupo from (select distinct semana sem from (select u.dia, date_trunc('week', u.dia)::date as semana from unnest(vd) u(dia)) vs where extract(year from dia) = anio) d) x group by grupo) y;

  return jsonb_build_object(
    'recomendacion', v_reco,
    'insignias', jsonb_build_array(
      jsonb_build_object('clave', 'primera_visita', 'titulo', 'Primera visita', 'emoji', '👟', 'meta', 1, 'avance', least(v_total, 1), 'lograda', v_total >= 1),
      jsonb_build_object('clave', 'diez_visitas', 'titulo', '10 visitas', 'emoji', '🔟', 'meta', 10, 'avance', least(v_total, 10), 'lograda', v_total >= 10),
      jsonb_build_object('clave', 'cincuenta_visitas', 'titulo', '50 visitas', 'emoji', '🥈', 'meta', 50, 'avance', least(v_total, 50), 'lograda', v_total >= 50),
      jsonb_build_object('clave', 'cien_visitas', 'titulo', '100 visitas', 'emoji', '🏆', 'meta', 100, 'avance', least(v_total, 100), 'lograda', v_total >= 100),
      jsonb_build_object('clave', 'racha_4_semanas', 'titulo', '4 semanas seguidas', 'emoji', '🔥', 'meta', 4, 'avance', least(v_semanas_seguidas, 4), 'lograda', v_semanas_seguidas >= 4),
      jsonb_build_object('clave', 'primera_clase', 'titulo', 'Primera clase', 'emoji', '🗓️', 'meta', 1, 'avance', least(v_clases_total, 1), 'lograda', v_clases_total >= 1),
      jsonb_build_object('clave', 'rutina_10', 'titulo', '10 días de rutina', 'emoji', '💪', 'meta', 10, 'avance', least(v_rutina_total, 10), 'lograda', v_rutina_total >= 10)),
    'anio', jsonb_build_object('anio', anio, 'visitas', v_anio_visitas, 'mes_top', v_mes_top, 'dia_top', v_dia_top,
                               'clases', v_anio_clases, 'rutina_dias', v_anio_rutina, 'mejor_racha_semanas', v_mejor_racha));
end $$;

revoke all on function public.resumen_app_socio(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.resumen_app_socio(uuid, timestamptz) to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.resumen_app_socio(uuid, timestamptz)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: resumen_app_socio sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.resumen_app_socio(uuid, timestamptz)', 'execute') then raise exception 'Verificación: anon puede pedir el resumen'; end if;
end $$;
