-- 0094 · Editar un horario recién agregado, sin duplicar clases (CLA-8).
-- Copia de editar_horario (0086) con dos cambios:
--   · un horario que arranca hoy ya no da "sacalo y agregalo de nuevo": se
--     queda con su primer día y el nuevo arranca al siguiente (como cerrar_horario);
--   · las clases de los días en que el viejo sigue vigente (antes de que arranque
--     el nuevo) se quedan en el viejo con su hora y toman cupo y profe. Antes se
--     movían al nuevo y, al volver a mirar ese día, el viejo creaba otra.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.pedir_baja_socio(uuid, text, text)') is null then raise exception 'Guarda: falta la migración 0093'; end if;
  if to_regprocedure('public.editar_horario(uuid, time, int, int, uuid)') is null then raise exception 'Guarda: falta editar_horario (0086)'; end if;
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
  -- Un horario que arranca hoy (o más adelante) se queda con su primer día y el nuevo
  -- arranca al día siguiente: así se puede corregir un horario recién agregado.
  desde := greatest(hoy, h.vigente_desde + 1, case when cambia_hora and ultimo is not null then ultimo + 1 else hoy end);
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

revoke all on function public.editar_horario(uuid, time, int, int, uuid) from public, anon, authenticated;
grant execute on function public.editar_horario(uuid, time, int, int, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare d text := pg_get_functiondef('public.editar_horario(uuid, time, int, int, uuid)'::regprocedure);
begin
  if position('h.vigente_desde + 1' in d) = 0 or position('sacalo y agregalo' in d) > 0 then raise exception 'Verificación: editar_horario sigue sin poder editar un horario de hoy'; end if;
  if not exists (select 1 from pg_proc where oid = 'public.editar_horario(uuid, time, int, int, uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: editar_horario sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.editar_horario(uuid, time, int, int, uuid)', 'execute') then raise exception 'Verificación: anon puede editar horarios'; end if;
end $$;
