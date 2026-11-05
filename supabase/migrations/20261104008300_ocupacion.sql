-- 0083 · Ocupación por horario (CLA-5).
-- Para decidir horarios: por cada horario de la grilla, cuánto se llenó en
-- las últimas semanas (anotados y los que vinieron, contra el cupo). Se
-- calcula de las clases que ya pasaron; no se guarda nada.
--   ocupacion_horarios(gimnasio, semanas)   dueño y encargado

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.anular_presente(uuid, uuid, text)') is null then raise exception 'Guarda: falta la migración 0082'; end if;
end $$;

create or replace function public.ocupacion_horarios(p_gimnasio_id uuid, p_semanas int default 4) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare desde timestamptz;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if p_semanas is null or p_semanas < 1 or p_semanas > 26 then raise exception 'De 1 a 26 semanas' using errcode = '22023'; end if;
  desde := now() - make_interval(weeks => p_semanas);
  return coalesce((select jsonb_agg(x order by (x ->> 'dia_semana')::int, x ->> 'hora') from (
    select jsonb_build_object('horario_id', h.id, 'actividad', a.nombre, 'emoji', a.emoji, 'dia_semana', h.dia_semana,
             'hora', to_char(h.hora_inicio, 'HH24:MI'), 'cupo', h.cupo, 'clases', count(c.id),
             'anotados', round(avg((select count(*) from public.reservas r where r.clase_id = c.id and r.estado = 'confirmada')), 1),
             'vinieron', round(avg((select count(*) from public.asistencias s where s.clase_id = c.id and s.anulada_en is null)), 1),
             'porcentaje', case when h.cupo is null or h.cupo = 0 or count(c.id) = 0 then null
                                else round(100.0 * avg((select count(*) from public.asistencias s where s.clase_id = c.id and s.anulada_en is null)) / h.cupo) end) x
      from public.horarios_clase h
      join public.actividades a on a.id = h.actividad_id
      left join public.clases c on c.horario_id = h.id and c.cancelada_en is null and c.fin <= now() and c.inicio >= desde
     where h.gimnasio_id = p_gimnasio_id and (h.vigente_hasta is null or h.vigente_hasta >= current_date)
     group by h.id, a.nombre, a.emoji) y), '[]'::jsonb);
end $$;

revoke all on function public.ocupacion_horarios(uuid, int) from public, anon, authenticated;
grant execute on function public.ocupacion_horarios(uuid, int) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.ocupacion_horarios(uuid, int)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: ocupacion_horarios sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.ocupacion_horarios(uuid, int)', 'execute') then raise exception 'Verificación: anon puede leer la ocupación'; end if;
end $$;
