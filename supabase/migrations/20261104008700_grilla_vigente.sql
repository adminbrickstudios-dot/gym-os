-- 0087 · La grilla muestra lo que viene (arreglo encontrado en AUD-9/CLA-8).
-- "Sacar" un horario lo cierra desde mañana (las clases de hoy siguen), pero
-- la grilla lo seguía mostrando hasta el día siguiente: parecía que no se
-- había sacado. Ahora horarios_gimnasio lista los horarios que siguen
-- después de hoy (en la hora del gimnasio, no la del servidor).
-- Copia de horarios_gimnasio (0015), misma firma.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.editar_horario(uuid, time, int, int, uuid)') is null then raise exception 'Guarda: falta la migración 0086'; end if;
end $$;

create or replace function public.horarios_gimnasio(p_gimnasio_id uuid)
returns table (horario_id uuid, sede_id uuid, sede text, actividad_id uuid, actividad text, emoji text, dia_semana int,
               hora_inicio time, duracion_min int, cupo int, profe_id uuid, profe text, vigente_desde date, vigente_hasta date)
language plpgsql security definer set search_path = '' as $$
declare hoy date;
begin
  perform privado.exigir_equipo(p_gimnasio_id);
  select privado.dia_local(now(), g.zona_horaria) into hoy from public.gimnasios g where g.id = p_gimnasio_id;
  return query
  select h.id, h.sede_id, s.nombre, a.id, a.nombre, a.emoji, h.dia_semana, h.hora_inicio, h.duracion_min, h.cupo,
         h.profe_id, p.nombre, h.vigente_desde, h.vigente_hasta
    from public.horarios_clase h
    join public.actividades a on a.id = h.actividad_id
    join public.sedes s on s.id = h.sede_id
    left join public.equipo p on p.id = h.profe_id
   where h.gimnasio_id = p_gimnasio_id and (h.vigente_hasta is null or h.vigente_hasta > hoy)
   order by h.dia_semana, h.hora_inicio, a.nombre;
end $$;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.horarios_gimnasio(uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: horarios_gimnasio sin search_path vacío';
  end if;
end $$;
