-- 0055 · Editar un plan sin perder lo que no se tocó (AUD-5).
-- guardar_plan, al actualizar, pisaba con null todo lo que no venía en los
-- datos: "Dejar de vender" (que manda solo nombre y activo) borraba la
-- descripción, el horario y las veces por semana. Un plan de 2 veces por
-- semana quedaba libre y estado_acceso dejaba entrar de más.
-- Ahora la actualización cambia solo las claves que vienen. Crear no cambia.
-- De paso: horario y veces por semana mal puestos dicen qué poner (PLA-2), no
-- el error crudo de la tabla.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.guardar_plan(uuid, uuid, jsonb)') is null then raise exception 'Guarda: falta guardar_plan (0013)'; end if;
  if to_regprocedure('public.control_entrada(uuid, date, int)') is null then raise exception 'Guarda: falta la migración 0054'; end if;
end $$;

create or replace function public.guardar_plan(p_gimnasio_id uuid, p_plan_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; pid uuid; n int; tipo text := p_datos ->> 'tipo';
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  if (p_plan_id is null or p_datos ? 'nombre') and length(trim(coalesce(p_datos ->> 'nombre', ''))) = 0 then
    raise exception 'Poné el nombre del plan' using errcode = '22023';
  end if;
  -- Horario del plan (PLA-2): los dos o ninguno, y que termine después de empezar.
  if (p_datos ? 'hora_desde' or p_datos ? 'hora_hasta')
     and ((nullif(p_datos ->> 'hora_desde', '') is null) <> (nullif(p_datos ->> 'hora_hasta', '') is null)) then
    raise exception 'El horario lleva desde y hasta (o ninguno, si es todo el día)' using errcode = '22023';
  end if;
  if nullif(p_datos ->> 'hora_desde', '') is not null and (p_datos ->> 'hora_desde')::time >= (p_datos ->> 'hora_hasta')::time then
    raise exception 'El horario termina después de empezar (ej: de 07:00 a 16:00)' using errcode = '22023';
  end if;
  if nullif(p_datos ->> 'max_ingresos_semana', '') is not null and (p_datos ->> 'max_ingresos_semana')::int not between 1 and 7 then
    raise exception 'Las veces por semana van de 1 a 7 (vacío = libre)' using errcode = '22023';
  end if;
  if p_plan_id is null then
    if tipo is null or tipo not in ('membresia', 'pase_diario', 'pack') then raise exception 'Elegí qué tipo de plan es'; end if;
    insert into public.planes (gimnasio_id, tipo, nombre, descripcion, duracion_meses, renovacion, cantidad_clases, validez_dias,
                               consume_en, max_ingresos_semana, hora_desde, hora_hasta, visible_en_landing, orden)
    values (p_gimnasio_id, tipo, trim(p_datos ->> 'nombre'), nullif(trim(coalesce(p_datos ->> 'descripcion', '')), ''),
            case when tipo = 'membresia' then coalesce((p_datos ->> 'duracion_meses')::int, 1) end,
            case when tipo = 'membresia' then coalesce(p_datos ->> 'renovacion', 'continua') end,
            case when tipo = 'pack' then (p_datos ->> 'cantidad_clases')::int end,
            case when tipo = 'pack' then nullif(p_datos ->> 'validez_dias', '')::int end,
            case when tipo = 'pack' then coalesce(p_datos ->> 'consume_en', 'ingreso') end,
            nullif(p_datos ->> 'max_ingresos_semana', '')::int,
            nullif(p_datos ->> 'hora_desde', '')::time, nullif(p_datos ->> 'hora_hasta', '')::time,
            coalesce((p_datos ->> 'visible_en_landing')::boolean, true),
            coalesce((select max(orden) + 1 from public.planes where gimnasio_id = p_gimnasio_id), 0))
    returning id into pid;
  else
    -- El tipo y la duración no cambian: cambiarían qué significan las coberturas ya vendidas.
    -- Solo se tocan las claves que vienen; lo que no viene queda como estaba.
    update public.planes pl set
      nombre = case when p_datos ? 'nombre' then trim(p_datos ->> 'nombre') else pl.nombre end,
      descripcion = case when p_datos ? 'descripcion' then nullif(trim(coalesce(p_datos ->> 'descripcion', '')), '') else pl.descripcion end,
      max_ingresos_semana = case when p_datos ? 'max_ingresos_semana' then nullif(p_datos ->> 'max_ingresos_semana', '')::int else pl.max_ingresos_semana end,
      hora_desde = case when p_datos ? 'hora_desde' then nullif(p_datos ->> 'hora_desde', '')::time else pl.hora_desde end,
      hora_hasta = case when p_datos ? 'hora_hasta' then nullif(p_datos ->> 'hora_hasta', '')::time else pl.hora_hasta end,
      activo = coalesce((p_datos ->> 'activo')::boolean, pl.activo),
      visible_en_landing = coalesce((p_datos ->> 'visible_en_landing')::boolean, pl.visible_en_landing)
     where pl.id = p_plan_id and pl.gimnasio_id = p_gimnasio_id
    returning pl.id into pid;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Sin permiso o plan inexistente' using errcode = '42501'; end if;
  end if;
  return pid;
end $$;

revoke all on function public.guardar_plan(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.guardar_plan(uuid, uuid, jsonb) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.guardar_plan(uuid, uuid, jsonb)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: guardar_plan sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.guardar_plan(uuid, uuid, jsonb)', 'execute') then raise exception 'Verificación: anon puede ejecutar guardar_plan'; end if;
  if position('p_datos ? ''max_ingresos_semana''' in pg_get_functiondef('public.guardar_plan(uuid, uuid, jsonb)'::regprocedure)) = 0 then
    raise exception 'Verificación: guardar_plan sigue pisando lo que no viene';
  end if;
end $$;
