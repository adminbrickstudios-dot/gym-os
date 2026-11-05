-- 0097 · Sacar o editar un horario que todavía no arrancó (CLA-8).
-- Un horario no podía quedar vacío (vigente_hasta >= vigente_desde), así que
-- sacar uno que arranca mañana lo dejaba un día en la grilla (y, si ese día
-- era el suyo, daba esa clase), y editar uno de hoy dejaba el viejo un día.
-- Ahora vigente_hasta puede ser vigente_desde - 1: el horario queda vacío,
-- no da ninguna clase y no aparece en la grilla.
-- Copias: cerrar_horario (0015) y editar_horario (0094).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.novedades_socio(uuid)') is null then raise exception 'Guarda: falta la migración 0096'; end if;
end $$;

alter table public.horarios_clase drop constraint if exists horarios_clase_check;
alter table public.horarios_clase drop constraint if exists horarios_clase_vigencia;
alter table public.horarios_clase add constraint horarios_clase_vigencia check (vigente_hasta is null or vigente_hasta >= vigente_desde - 1);

create or replace function public.cerrar_horario(p_horario_id uuid, p_desde date default null) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.horarios_clase; zona text; desde date; n int;
begin
  select * into h from public.horarios_clase where id = p_horario_id;
  if not found then raise exception 'Sin permiso o horario inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(h.gimnasio_id, array['dueno', 'encargado']);
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = h.gimnasio_id;
  -- Desde hoy (o la fecha pedida); un horario que todavía no arrancó queda vacío (no da ninguna clase).
  desde := greatest(coalesce(p_desde, privado.dia_local(now(), zona)), h.vigente_desde);
  if h.vigente_hasta is not null and h.vigente_hasta < desde then raise exception 'El horario ya estaba cerrado'; end if;
  update public.horarios_clase set vigente_hasta = desde - 1 where id = h.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo cerrar el horario'; end if;
end $$;

create or replace function public.editar_horario(p_horario_id uuid, p_hora_inicio time, p_duracion_min int, p_cupo int, p_profe_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare h public.horarios_clase; zona text; hoy date; nuevo uuid; desde date; cambia_hora boolean; k record; ocupadas int; ultimo date;
begin
  select * into h from public.horarios_clase where id = p_horario_id for update;
  if not found then raise exception 'Sin permiso o horario inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(h.gimnasio_id, array['dueno', 'encargado']);
  select zona_horaria into zona from public.gimnasios where id = h.gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  if h.vigente_hasta is not null and h.vigente_hasta < hoy then raise exception 'Ese horario ya no está en la grilla' using errcode = '22023'; end if;
  if p_hora_inicio is null then raise exception 'Elegí la hora' using errcode = '22023'; end if;
  if p_duracion_min is null or p_duracion_min not between 10 and 300 then raise exception 'La duración va de 10 a 300 minutos' using errcode = '22023'; end if;
  if p_cupo is not null and (p_cupo < 1 or p_cupo > 500) then raise exception 'El cupo va de 1 a 500 (vacío = sin cupo)' using errcode = '22023'; end if;
  if p_profe_id is not null and not exists (select 1 from public.equipo where id = p_profe_id and gimnasio_id = h.gimnasio_id and activo) then
    raise exception 'Profe inexistente' using errcode = '22023';
  end if;
  if p_hora_inicio = h.hora_inicio and p_duracion_min = h.duracion_min and p_cupo is not distinct from h.cupo and p_profe_id is not distinct from h.profe_id then
    return h.id;   -- nada cambió
  end if;
  cambia_hora := p_hora_inicio <> h.hora_inicio or p_duracion_min <> h.duracion_min;
  -- El cupo no baja de lo ya reservado.
  if p_cupo is not null then
    select max(n), (array_agg(dia order by n desc))[1] into ocupadas, ultimo from (
      select (select count(*) from public.reservas r where r.clase_id = c.id and r.estado = 'confirmada') n, privado.dia_local(c.inicio, zona) dia
        from public.clases c where c.horario_id = h.id and c.cancelada_en is null and c.inicio > now()) x;
    if ocupadas > p_cupo then
      raise exception 'La clase del % ya tiene % reservas: el cupo no puede bajar de % hasta que pase', to_char(ultimo, 'DD/MM'), ocupadas, ocupadas using errcode = '22023';
    end if;
  end if;
  -- Si cambia la hora, el horario nuevo arranca después de la última clase futura con reservas.
  select max(privado.dia_local(c.inicio, zona)) into ultimo from public.clases c
   where c.horario_id = h.id and c.cancelada_en is null and c.inicio > now()
     and exists (select 1 from public.reservas r where r.clase_id = c.id and r.estado <> 'cancelada');
  -- Un horario que arranca hoy (o más adelante) se reemplaza entero: el viejo queda vacío.
  desde := greatest(hoy, h.vigente_desde, case when cambia_hora and ultimo is not null then ultimo + 1 else hoy end);
  insert into public.horarios_clase (gimnasio_id, sede_id, actividad_id, dia_semana, hora_inicio, duracion_min, cupo, profe_id, vigente_desde, vigente_hasta)
  values (h.gimnasio_id, h.sede_id, h.actividad_id, h.dia_semana, p_hora_inicio, p_duracion_min, p_cupo, p_profe_id, desde, h.vigente_hasta)
  returning id into nuevo;
  -- Las clases futuras pasan al horario nuevo (o, si tienen reservas y cambió la hora, quedan en el viejo con cupo y profe nuevos).
  -- Las de antes de que arranque el nuevo se quedan en el viejo (que sigue vigente esos días), con su hora:
  -- si se movieran, mirar ese día volvería a crear la del viejo y quedarían dos.
  for k in select c.* from public.clases c where c.horario_id = h.id and c.cancelada_en is null and c.inicio > now() for update loop
    if privado.dia_local(k.inicio, zona) < desde then
      update public.clases set cupo = p_cupo, profe_id = p_profe_id where id = k.id;
    elsif cambia_hora and exists (select 1 from public.reservas r where r.clase_id = k.id and r.estado <> 'cancelada') then
      update public.clases set cupo = p_cupo, profe_id = p_profe_id where id = k.id;
    else
      update public.clases set horario_id = nuevo, cupo = p_cupo, profe_id = p_profe_id,
             inicio = (privado.dia_local(k.inicio, zona) + p_hora_inicio) at time zone zona,
             fin = (privado.dia_local(k.inicio, zona) + p_hora_inicio) at time zone zona + make_interval(mins => p_duracion_min)
       where id = k.id;
    end if;
    if p_cupo is null or p_cupo > coalesce(k.cupo, 0) then perform privado.promover_espera(k.id, now()); end if;
  end loop;
  -- El viejo se cierra el día antes de que arranque el nuevo (sus clases futuras ya se movieron o se quedan antes de esa fecha).
  update public.horarios_clase set vigente_hasta = desde - 1 where id = h.id;
  return nuevo;
end $$;

revoke all on function public.cerrar_horario(uuid, date), public.editar_horario(uuid, time, int, int, uuid) from public, anon, authenticated;
grant execute on function public.cerrar_horario(uuid, date), public.editar_horario(uuid, time, int, int, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if position('vigente_desde + 1' in pg_get_functiondef('public.cerrar_horario(uuid, date)'::regprocedure)) > 0
     or position('vigente_desde + 1' in pg_get_functiondef('public.editar_horario(uuid, time, int, int, uuid)'::regprocedure)) > 0 then
    raise exception 'Verificación: un horario que no arrancó todavía queda un día';
  end if;
  foreach f in array array['public.cerrar_horario(uuid, date)', 'public.editar_horario(uuid, time, int, int, uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
