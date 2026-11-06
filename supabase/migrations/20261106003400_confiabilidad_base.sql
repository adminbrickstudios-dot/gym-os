-- 3400 · VD-34 · Confiabilidad base: nada dos veces y nada se pisa en silencio.
-- 1) Clave de operación en las ventas: la pantalla genera un uuid al abrir
--    Cobrar; si la misma operación llega dos veces (doble clic, red lenta,
--    reintento) la base devuelve la venta ya hecha y no cobra de nuevo.
-- 2) Versión en socios, planes y configuración: quién tocó el registro y
--    cuándo, y una función que dice si cambió desde que se abrió el formulario.
-- Aditiva: la firma vieja de vender se reemplaza por una con un parámetro más
-- con valor por defecto, así que las llamadas de antes siguen andando.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.vender(uuid, jsonb, jsonb, uuid, uuid)') is null
     and to_regprocedure('public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid)') is null then
    raise exception 'Guarda: falta public.vender';
  end if;
  if to_regprocedure('privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)') is null then raise exception 'Guarda: falta privado.vender'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
end $$;

-- ── 1 · Clave de operación en ventas ────────────────────────────────
alter table public.ventas add column if not exists clave_operacion uuid;
create unique index if not exists ventas_clave_operacion_uq
  on public.ventas (gimnasio_id, clave_operacion) where clave_operacion is not null;

drop function if exists public.vender(uuid, jsonb, jsonb, uuid, uuid);
create or replace function public.vender(
  p_sede_id uuid, p_items jsonb, p_pagos jsonb, p_socio_id uuid default null, p_turno_id uuid default null,
  p_clave_operacion uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid; rol text; tope numeric; c public.configuracion_gimnasio; no_acepta text; previa public.ventas; r jsonb;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], p_sede_id);
  select e.rol into rol from public.equipo e where e.id = eid;

  -- Misma operación otra vez: se devuelve lo ya hecho. El lock hace que dos
  -- envíos simultáneos se turnen: el segundo ve la venta del primero.
  if p_clave_operacion is not null then
    perform pg_advisory_xact_lock(hashtextextended(g::text || p_clave_operacion::text, 0));
    select * into previa from public.ventas where gimnasio_id = g and clave_operacion = p_clave_operacion;
    if found then
      return jsonb_build_object('venta_id', previa.id,
        'total', (select coalesce(sum(p.monto), 0) from public.pagos p where p.venta_id = previa.id),
        'generados', 0, 'repetida', true,
        'veredicto', case when previa.socio_id is not null then to_jsonb(privado.calcular_acceso(previa.socio_id, now(), previa.sede_id)) end);
    end if;
  end if;

  select * into c from public.configuracion_gimnasio where gimnasio_id = g;
  select string_agg(distinct case x ->> 'medio' when 'credito' then 'tarjeta de crédito' when 'debito' then 'tarjeta de débito' when 'cuenta_corriente' then 'a cuenta (fiado)'
                                              else x ->> 'medio' end, ', ') into no_acepta
    from jsonb_array_elements(case when jsonb_typeof(p_pagos) = 'array' then p_pagos else '[]'::jsonb end) x
   where coalesce(x ->> 'medio', '') <> all (array(select m from unnest(c.medios_aceptados) m
                                                      where not (m = 'efectivo' and 'caja' = any (c.secciones_apagadas)))
                                                || case when c.fiado_activo then array['cuenta_corriente'] else '{}'::text[] end);
  if no_acepta is not null then
    raise exception 'Este gimnasio no cobra con %. Se cambia en Configuración → Cobros.', no_acepta using errcode = '22023';
  end if;
  -- EQU-1: si el dueño lo apagó, la recepción no vende productos.
  if rol = 'recepcion' and not c.recepcion_vende_productos
     and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) x where x ->> 'tipo' = 'producto') then
    raise exception 'En este gimnasio la recepción no vende productos: lo cambia el dueño en Equipo → Permisos.' using errcode = '42501';
  end if;
  if rol = 'recepcion' then
    select descuento_max_recepcion into tope from public.configuracion_gimnasio where gimnasio_id = g;
  end if;
  r := privado.vender(g, p_sede_id, p_socio_id, p_items, p_pagos, p_turno_id, eid, tope, now());
  if p_clave_operacion is not null then
    update public.ventas set clave_operacion = p_clave_operacion where gimnasio_id = g and id = (r ->> 'venta_id')::uuid;
    if not found then raise exception 'No se pudo registrar la clave de la operación'; end if;
  end if;
  return r;
end $$;

revoke all on function public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid) from public, anon;
grant execute on function public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid) to authenticated, service_role;

-- ── 2 · Versión de lo que se edita ──────────────────────────────────
alter table public.socios add column if not exists actualizado_en timestamptz not null default now();
alter table public.socios add column if not exists actualizado_por uuid;
alter table public.planes add column if not exists actualizado_en timestamptz not null default now();
alter table public.planes add column if not exists actualizado_por uuid;
alter table public.configuracion_gimnasio add column if not exists actualizado_en timestamptz not null default now();
alter table public.configuracion_gimnasio add column if not exists actualizado_por uuid;

create or replace function privado.sellar_actualizacion() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := clock_timestamp();   -- no now(): dos ediciones en la misma transacción también se distinguen
  new.actualizado_por := (select e.id from public.equipo e where e.usuario_id = auth.uid() and e.gimnasio_id = new.gimnasio_id limit 1);
  return new;
end $$;
revoke all on function privado.sellar_actualizacion() from public;

drop trigger if exists sellar_actualizacion on public.socios;
create trigger sellar_actualizacion before update on public.socios for each row execute function privado.sellar_actualizacion();
drop trigger if exists sellar_actualizacion on public.planes;
create trigger sellar_actualizacion before update on public.planes for each row execute function privado.sellar_actualizacion();
drop trigger if exists sellar_actualizacion on public.configuracion_gimnasio;
create trigger sellar_actualizacion before update on public.configuracion_gimnasio for each row execute function privado.sellar_actualizacion();

-- El historial de configuración no cuenta la marca de versión como un cambio de configuración.
create or replace function privado.historial_tg() returns trigger
language plpgsql security definer set search_path = '' as $$
declare comunes text[] := array['gimnasio_id', 'id', 'actualizado_en', 'actualizado_por', 'creado_en', 'creado_por'];
begin
  if tg_table_name = 'configuracion_gimnasio' then
    perform privado.registrar_cambios(new.gimnasio_id, '', to_jsonb(old), to_jsonb(new),
      comunes || array['ultimo_numero_socio', 'onboarding_salteado_en', 'avisar_sin_bloquear_hasta']);
  elsif tg_table_name = 'gimnasios' then
    perform privado.registrar_cambios(new.id, '', jsonb_build_object('nombre', old.nombre), jsonb_build_object('nombre', new.nombre), comunes);
  elsif tg_table_name = 'landing_gimnasio' then
    perform privado.registrar_cambios(new.gimnasio_id, 'pagina.',
      jsonb_build_object('publicada', old.publicada, 'whatsapp', old.whatsapp, 'instagram', old.instagram, 'email_contacto', old.email_contacto),
      jsonb_build_object('publicada', new.publicada, 'whatsapp', new.whatsapp, 'instagram', new.instagram, 'email_contacto', new.email_contacto), comunes);
  elsif tg_table_name = 'sedes' then
    perform privado.registrar_cambios(new.gimnasio_id, 'sede.' || old.nombre || '.',
      jsonb_build_object('nombre', old.nombre, 'direccion', old.direccion, 'telefono', old.telefono, 'mapa_url', old.mapa_url),
      jsonb_build_object('nombre', new.nombre, 'direccion', new.direccion, 'telefono', new.telefono, 'mapa_url', new.mapa_url), comunes);
  elsif tg_table_name = 'plantillas_mensaje' then
    perform privado.registrar_cambios(new.gimnasio_id, 'mensaje.', jsonb_build_object(new.clave, old.texto),
      jsonb_build_object(new.clave, new.texto), comunes);
  end if;
  return null;
end $$;

-- Versión actual de un registro: la pantalla la guarda al abrir el formulario.
create or replace function public.version_registro(p_gimnasio_id uuid, p_tabla text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v timestamptz; por uuid; quien text;
begin
  if p_tabla not in ('socios', 'planes', 'configuracion') then raise exception 'Tabla desconocida' using errcode = '22023'; end if;
  perform privado.exigir_equipo(p_gimnasio_id, case when p_tabla = 'socios' then array['dueno', 'encargado', 'recepcion'] else array['dueno', 'encargado'] end);
  if p_tabla = 'socios' then
    select actualizado_en, actualizado_por into v, por from public.socios where gimnasio_id = p_gimnasio_id and id = p_id;
  elsif p_tabla = 'planes' then
    select actualizado_en, actualizado_por into v, por from public.planes where gimnasio_id = p_gimnasio_id and id = p_id;
  else
    select actualizado_en, actualizado_por into v, por from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  end if;
  if v is null then raise exception 'Sin permiso o registro inexistente' using errcode = '42501'; end if;
  select nombre into quien from public.equipo where gimnasio_id = p_gimnasio_id and id = por;
  return jsonb_build_object('version', v, 'por', quien);
end $$;

-- ¿Cambió desde que se abrió el formulario? Si la versión que trae la pantalla
-- ya no es la actual, dice quién y cuándo, para no pisarlo en silencio.
create or replace function public.verificar_version(p_gimnasio_id uuid, p_tabla text, p_id uuid, p_version timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actual jsonb; v timestamptz;
begin
  actual := public.version_registro(p_gimnasio_id, p_tabla, p_id);
  v := (actual ->> 'version')::timestamptz;
  if p_version is null or v <= p_version then
    return jsonb_build_object('cambio', false, 'version', v);
  end if;
  return jsonb_build_object('cambio', true, 'version', v, 'por', coalesce(actual ->> 'por', 'el sistema'),
                            'hace_segundos', greatest(0, extract(epoch from now() - v)::int));
end $$;

revoke all on function public.version_registro(uuid, text, uuid) from public, anon;
grant execute on function public.version_registro(uuid, text, uuid) to authenticated, service_role;
revoke all on function public.verificar_version(uuid, text, uuid, timestamptz) from public, anon;
grant execute on function public.verificar_version(uuid, text, uuid, timestamptz) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.vender(uuid, jsonb, jsonb, uuid, uuid)') is not null then
    raise exception 'Verificación: quedó la firma vieja de vender (llamada ambigua)';
  end if;
  if not exists (select 1 from pg_proc where oid = 'public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: vender sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid)', 'execute') then raise exception 'Verificación: anon puede vender'; end if;
  if has_function_privilege('anon', 'public.verificar_version(uuid, text, uuid, timestamptz)', 'execute') then raise exception 'Verificación: anon puede verificar versiones'; end if;
  if not exists (select 1 from pg_indexes where indexname = 'ventas_clave_operacion_uq') then raise exception 'Verificación: falta el unique de la clave de operación'; end if;
  if position('actualizado_por' in pg_get_functiondef('privado.historial_tg()'::regprocedure)) = 0 then raise exception 'Verificación: el historial cuenta la versión como cambio'; end if;
  if (select count(*) from pg_trigger where tgname = 'sellar_actualizacion' and not tgisinternal) <> 3 then raise exception 'Verificación: faltan triggers de versión'; end if;
end $$;
