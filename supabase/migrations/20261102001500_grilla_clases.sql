-- ═══════════════════════════════════════════════════════════════════
-- 0015 · Armar las clases desde el panel.
--
-- Hasta acá las actividades y la grilla semanal solo se cargaban por SQL.
--   actividades_gimnasio / guardar_actividad
--   horarios_gimnasio / agregar_horario / cerrar_horario
--     Un horario no se edita (0011: cambiaría clases ya reservadas): se
--     cierra desde una fecha y se agrega uno nuevo. cerrar_horario
--     cancela las clases futuras ya creadas (trigger de 0011).
--   clase_detalle: una clase por id, para la pantalla de la lista.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.horarios_clase') is null then raise exception 'Guarda: falta la migración 0011'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid,text[])') is null then raise exception 'Guarda: falta la migración 0013'; end if;
end $$;

create or replace function public.actividades_gimnasio(p_gimnasio_id uuid)
returns table (actividad_id uuid, nombre text, emoji text, color text, descripcion text, activa boolean, horarios int)
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id);
  return query
  select a.id, a.nombre, a.emoji, a.color, a.descripcion, a.activa,
         (select count(*)::int from public.horarios_clase h where h.actividad_id = a.id
             and (h.vigente_hasta is null or h.vigente_hasta >= current_date))
    from public.actividades a where a.gimnasio_id = p_gimnasio_id
   order by a.activa desc, a.nombre;
end $$;

create or replace function public.guardar_actividad(p_gimnasio_id uuid, p_actividad_id uuid, p_nombre text, p_emoji text,
                                                    p_descripcion text default null, p_activa boolean default true)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare aid uuid; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if length(trim(coalesce(p_nombre, ''))) = 0 then raise exception 'El nombre es obligatorio'; end if;
  if p_actividad_id is null then
    insert into public.actividades (gimnasio_id, nombre, emoji, descripcion)
    values (p_gimnasio_id, trim(p_nombre), nullif(trim(coalesce(p_emoji, '')), ''), nullif(trim(coalesce(p_descripcion, '')), ''))
    returning id into aid;
  else
    update public.actividades set nombre = trim(p_nombre), emoji = nullif(trim(coalesce(p_emoji, '')), ''),
           descripcion = nullif(trim(coalesce(p_descripcion, '')), ''), activa = coalesce(p_activa, true)
     where id = p_actividad_id and gimnasio_id = p_gimnasio_id returning id into aid;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Sin permiso o actividad inexistente' using errcode = '42501'; end if;
  end if;
  return aid;
end $$;

create or replace function public.horarios_gimnasio(p_gimnasio_id uuid)
returns table (horario_id uuid, sede_id uuid, sede text, actividad_id uuid, actividad text, emoji text, dia_semana int,
               hora_inicio time, duracion_min int, cupo int, profe_id uuid, profe text, vigente_desde date, vigente_hasta date)
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id);
  return query
  select h.id, h.sede_id, s.nombre, a.id, a.nombre, a.emoji, h.dia_semana, h.hora_inicio, h.duracion_min, h.cupo,
         h.profe_id, p.nombre, h.vigente_desde, h.vigente_hasta
    from public.horarios_clase h
    join public.actividades a on a.id = h.actividad_id
    join public.sedes s on s.id = h.sede_id
    left join public.equipo p on p.id = h.profe_id
   where h.gimnasio_id = p_gimnasio_id and (h.vigente_hasta is null or h.vigente_hasta >= current_date)
   order by h.dia_semana, h.hora_inicio, a.nombre;
end $$;

create or replace function public.agregar_horario(p_sede_id uuid, p_actividad_id uuid, p_dia_semana int, p_hora_inicio time,
                                                  p_duracion_min int, p_cupo int default null, p_profe_id uuid default null,
                                                  p_desde date default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare g uuid; zona text; hid uuid;
begin
  select s.gimnasio_id, gi.zona_horaria into g, zona from public.sedes s join public.gimnasios gi on gi.id = s.gimnasio_id where s.id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(g, array['dueno', 'encargado']);
  if not exists (select 1 from public.actividades where id = p_actividad_id and gimnasio_id = g and activa) then
    raise exception 'Actividad inexistente o desactivada';
  end if;
  if p_dia_semana is null or p_dia_semana not between 1 and 7 then raise exception 'Elegí el día (lunes a domingo)'; end if;
  if p_hora_inicio is null then raise exception 'Elegí la hora'; end if;
  if p_duracion_min is null or p_duracion_min not between 10 and 300 then raise exception 'La duración va de 10 a 300 minutos'; end if;
  if p_cupo is not null and p_cupo < 1 then raise exception 'El cupo tiene que ser al menos 1 (vacío = sin cupo)'; end if;
  if p_profe_id is not null and not exists (select 1 from public.equipo where id = p_profe_id and gimnasio_id = g and activo) then
    raise exception 'Profe inexistente';
  end if;
  insert into public.horarios_clase (gimnasio_id, sede_id, actividad_id, dia_semana, hora_inicio, duracion_min, cupo, profe_id, vigente_desde)
  values (g, p_sede_id, p_actividad_id, p_dia_semana, p_hora_inicio, p_duracion_min, p_cupo, p_profe_id,
          coalesce(p_desde, privado.dia_local(now(), zona)))
  returning id into hid;
  return hid;
end $$;

-- Desde p_desde (inclusive) el horario ya no existe: las clases de ese día en adelante se cancelan.
create or replace function public.cerrar_horario(p_horario_id uuid, p_desde date default null) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.horarios_clase; zona text; desde date; n int;
begin
  select * into h from public.horarios_clase where id = p_horario_id;
  if not found then raise exception 'Sin permiso o horario inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(h.gimnasio_id, array['dueno', 'encargado']);
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = h.gimnasio_id;
  desde := greatest(coalesce(p_desde, privado.dia_local(now(), zona)), h.vigente_desde + 1);
  if h.vigente_hasta is not null and h.vigente_hasta < desde then raise exception 'El horario ya estaba cerrado'; end if;
  update public.horarios_clase set vigente_hasta = desde - 1 where id = h.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo cerrar el horario'; end if;
end $$;

create or replace function public.clase_detalle(p_clase_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.clases;
begin
  select * into c from public.clases where id = p_clase_id;
  if not found then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(c.gimnasio_id);
  return (select jsonb_build_object('clase_id', c.id, 'actividad', a.nombre, 'emoji', a.emoji, 'inicio', c.inicio, 'fin', c.fin,
            'profe', p.nombre, 'profe_id', c.profe_id, 'cupo', c.cupo,
            'confirmadas', (select count(*) from public.reservas r where r.clase_id = c.id and r.estado = 'confirmada'),
            'cancelada', c.cancelada_en is not null, 'cancelada_motivo', c.cancelada_motivo)
            from public.actividades a left join public.equipo p on p.id = c.profe_id where a.id = c.actividad_id);
end $$;

revoke all on function public.actividades_gimnasio(uuid), public.guardar_actividad(uuid, uuid, text, text, text, boolean),
  public.horarios_gimnasio(uuid), public.agregar_horario(uuid, uuid, int, time, int, int, uuid, date),
  public.cerrar_horario(uuid, date), public.clase_detalle(uuid)
  from public, anon, authenticated;
grant execute on function public.actividades_gimnasio(uuid), public.guardar_actividad(uuid, uuid, text, text, text, boolean),
  public.horarios_gimnasio(uuid), public.agregar_horario(uuid, uuid, int, time, int, int, uuid, date),
  public.cerrar_horario(uuid, date), public.clase_detalle(uuid)
  to authenticated, service_role;

do $$
begin
  if has_function_privilege('anon', 'public.agregar_horario(uuid, uuid, int, time, int, int, uuid, date)', 'execute') then
    raise exception 'Verificación: anon puede tocar la grilla';
  end if;
end $$;
