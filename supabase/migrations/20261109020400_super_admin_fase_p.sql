-- Carril B · Fase P (P4 a P7): crear un gimnasio en un minuto y probar que se puede entrar; gestionar a cada persona.
--   * admin_probar_acceso(equipo): checklist de una persona (cuenta, mail confirmado, activa, gimnasio, rol, último ingreso).
--   * admin_probar_acceso_gimnasio(gimnasio): lo que tiene que existir para que un gimnasio recién creado ande, con la prueba de cada dueño.
--   * admin_confirmar_cuenta, admin_estado_persona, admin_cambiar_rol_persona, admin_mover_persona: los "Arreglar" y la gestión.
--   * estado_soporte devuelve también el rol con el que entró BRIK (la barra "Estás viendo como…").
-- Parte de estado_soporte de la 0063 (v2): ninguna otra migración la vuelve a definir.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.exigir_brik(text[])') is null then raise exception 'Guarda: falta privado.exigir_brik'; end if;
  if to_regprocedure('privado.registrar_brik(text,uuid,jsonb)') is null then raise exception 'Guarda: falta privado.registrar_brik'; end if;
  if to_regprocedure('public.estado_soporte(uuid)') is null then raise exception 'Guarda: falta estado_soporte'; end if;
  if to_regclass('public.landing_gimnasio') is null then raise exception 'Guarda: falta landing_gimnasio'; end if;
end $$;

-- ── La barra "Estás viendo como <rol> de <gimnasio>" ────────────────
create or replace function public.estado_soporte(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.soportes_gimnasio;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  perform privado.cerrar_soportes_vencidos(p_gimnasio_id);
  select * into s from public.soportes_gimnasio
   where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and salio_en is null
   order by entro_en desc limit 1;
  if not found then return jsonb_build_object('activo', false); end if;
  return jsonb_build_object('activo', true, 'motivo', s.motivo, 'rol', s.rol, 'entro_en', s.entro_en, 'vence_en', s.vence_en,
    'minutos', greatest(0, ceil(extract(epoch from (s.vence_en - now())) / 60)::int));
end $$;
revoke execute on function public.estado_soporte(uuid) from public, anon;
grant execute on function public.estado_soporte(uuid) to authenticated;

-- ── P6 · Probar acceso de una persona ───────────────────────────────
-- Cada paso: estado 'ok' (verde), 'falta' (rojo: no puede entrar) o 'aviso' (amarillo: no impide). 'arreglo' dice qué botón ofrece la pantalla.
create or replace function privado.chequeo_persona(p_equipo_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; g public.gimnasios; u auth.users; pasos jsonb := '[]'::jsonb; hay_duenos int;
        ult timestamptz; rol_nombre text;
begin
  select * into e from public.equipo where id = p_equipo_id;
  if not found then raise exception 'Esa persona no existe' using errcode = 'P0002'; end if;
  select * into g from public.gimnasios where id = e.gimnasio_id;
  if e.usuario_id is not null then select * into u from auth.users where id = e.usuario_id; end if;
  rol_nombre := case e.rol when 'dueno' then 'dueño' when 'encargado' then 'encargado' when 'recepcion' then 'recepción' else 'profe' end;

  pasos := pasos || jsonb_build_array(jsonb_build_object('clave', 'cuenta', 'titulo', 'Tiene una cuenta',
    'estado', case when u.id is not null then 'ok' else 'falta' end,
    'detalle', case when u.id is not null then coalesce(u.email, u.phone, 'cuenta sin mail') else 'Todavía no tiene mail ni contraseña.' end,
    'arreglo', case when u.id is null then 'dar_acceso' end));
  pasos := pasos || jsonb_build_array(jsonb_build_object('clave', 'confirmado', 'titulo', 'El mail está confirmado',
    'estado', case when u.id is null then 'falta' when u.email_confirmed_at is not null or u.phone_confirmed_at is not null then 'ok' else 'falta' end,
    'detalle', case when u.id is null then 'Sin cuenta no hay nada que confirmar.' when u.email_confirmed_at is not null or u.phone_confirmed_at is not null then 'Confirmado.' else 'La cuenta existe pero pide confirmar el mail.' end,
    'arreglo', case when u.id is not null and u.email_confirmed_at is null and u.phone_confirmed_at is null then 'confirmar' end));
  pasos := pasos || jsonb_build_array(jsonb_build_object('clave', 'activo', 'titulo', 'Está activa en el equipo',
    'estado', case when e.activo then 'ok' else 'falta' end,
    'detalle', case when e.activo then 'Activa.' else 'Está desactivada: no puede entrar.' end,
    'arreglo', case when not e.activo then 'activar' end));
  pasos := pasos || jsonb_build_array(jsonb_build_object('clave', 'gimnasio', 'titulo', 'Su gimnasio está disponible',
    'estado', case when g.baja_en is not null then 'falta' when g.suspension_manual_en is not null then 'aviso' else 'ok' end,
    'detalle', case when g.baja_en is not null then g.nombre || ' está dado de baja.' when g.suspension_manual_en is not null then g.nombre || ' está pausado: el panel está en solo lectura.' else g.nombre end,
    'arreglo', case when g.baja_en is not null or g.suspension_manual_en is not null then 'reanudar' end));
  select count(*)::int into hay_duenos from public.equipo x where x.gimnasio_id = e.gimnasio_id and x.rol = 'dueno' and x.activo and not x.es_soporte;
  pasos := pasos || jsonb_build_array(jsonb_build_object('clave', 'rol', 'titulo', 'Rol: ' || rol_nombre,
    'estado', case when hay_duenos = 0 then 'falta' else 'ok' end,
    'detalle', case when hay_duenos = 0 then 'El gimnasio no tiene ningún dueño activo.' else 'Entra al panel como ' || rol_nombre || '.' end,
    'arreglo', null));
  ult := u.last_sign_in_at;
  pasos := pasos || jsonb_build_array(jsonb_build_object('clave', 'ingreso', 'titulo', 'Último ingreso',
    'estado', case when ult is null then 'aviso' else 'ok' end,
    'detalle', case when ult is null then 'Todavía no entró.' else to_char(ult at time zone coalesce(g.zona_horaria, 'UTC'), 'DD/MM/YYYY HH24:MI') end,
    'arreglo', null));
  return jsonb_build_object('equipo_id', e.id, 'nombre', e.nombre, 'rol', e.rol, 'email', u.email, 'gimnasio_id', e.gimnasio_id, 'gimnasio', g.nombre,
    'ok', not exists (select 1 from jsonb_array_elements(pasos) p where p ->> 'estado' = 'falta'), 'pasos', pasos);
end $$;
revoke all on function privado.chequeo_persona(uuid) from public, anon, authenticated;

create or replace function public.admin_probar_acceso(p_equipo_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  return privado.chequeo_persona(p_equipo_id);
end $$;

-- Lo que tiene que existir para que un gimnasio nuevo ande, más la prueba de cada dueño. Se corre solo al terminar el alta.
create or replace function public.admin_probar_acceso_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g public.gimnasios; pasos jsonb := '[]'::jsonb; d record; duenos jsonb := '[]'::jsonb; n int;
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  select * into g from public.gimnasios where id = p_gimnasio_id;
  if not found then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  select count(*)::int into n from public.dominios_gimnasio where gimnasio_id = p_gimnasio_id;
  pasos := pasos || jsonb_build_array(jsonb_build_object('clave', 'direccion', 'titulo', 'Tiene su dirección', 'estado', case when n > 0 then 'ok' else 'falta' end,
    'detalle', case when n > 0 then (select min(host) from public.dominios_gimnasio where gimnasio_id = p_gimnasio_id) else 'No tiene ninguna dirección: nadie lo puede abrir.' end));
  pasos := pasos || jsonb_build_array(jsonb_build_object('clave', 'configuracion', 'titulo', 'Tiene su configuración',
    'estado', case when exists (select 1 from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id) then 'ok' else 'falta' end, 'detalle', ''));
  pasos := pasos || jsonb_build_array(jsonb_build_object('clave', 'sede', 'titulo', 'Tiene su primera sede',
    'estado', case when exists (select 1 from public.sedes where gimnasio_id = p_gimnasio_id) then 'ok' else 'falta' end, 'detalle', ''));
  pasos := pasos || jsonb_build_array(jsonb_build_object('clave', 'landing', 'titulo', 'La web está publicada',
    'estado', case when exists (select 1 from public.landing_gimnasio where gimnasio_id = p_gimnasio_id and publicada) then 'ok' else 'falta' end, 'detalle', ''));
  pasos := pasos || jsonb_build_array(jsonb_build_object('clave', 'planes', 'titulo', 'Tiene planes', 'estado',
    case when exists (select 1 from public.planes where gimnasio_id = p_gimnasio_id and activo) then 'ok' else 'aviso' end, 'detalle', 'Sin planes la web y la alta de socios quedan vacías.'));
  pasos := pasos || jsonb_build_array(jsonb_build_object('clave', 'dueno', 'titulo', 'Tiene un dueño activo', 'estado',
    case when exists (select 1 from public.equipo where gimnasio_id = p_gimnasio_id and rol = 'dueno' and activo and not es_soporte) then 'ok' else 'falta' end, 'detalle', ''));
  for d in select id from public.equipo where gimnasio_id = p_gimnasio_id and rol = 'dueno' and activo and not es_soporte order by creado_en loop
    duenos := duenos || jsonb_build_array(privado.chequeo_persona(d.id));
  end loop;
  return jsonb_build_object('gimnasio_id', p_gimnasio_id, 'nombre', g.nombre,
    'ok', not exists (select 1 from jsonb_array_elements(pasos) p where p ->> 'estado' = 'falta')
          and not exists (select 1 from jsonb_array_elements(duenos) x where not (x ->> 'ok')::boolean),
    'pasos', pasos, 'duenos', duenos);
end $$;

-- ── Los "Arreglar" y la gestión de cada persona (P6 y P7) ───────────
create or replace function public.admin_confirmar_cuenta(p_equipo_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; n int;
begin
  perform privado.exigir_brik(array['principal', 'soporte']);
  select * into e from public.equipo where id = p_equipo_id;
  if not found then raise exception 'Esa persona no existe' using errcode = 'P0002'; end if;
  if e.usuario_id is null then raise exception 'Todavía no tiene cuenta: primero dale acceso' using errcode = '22023'; end if;
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = e.usuario_id and email is not null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo confirmar la cuenta (no tiene mail)' using errcode = '22023'; end if;
  perform privado.registrar_brik('confirmar_cuenta', e.gimnasio_id, jsonb_build_object('equipo_id', e.id, 'nombre', e.nombre));
end $$;

-- Un gimnasio nunca se queda sin dueño activo: ni al desactivar ni al cambiar de rol ni al mover al último.
create or replace function privado.no_dejar_sin_dueno(p_equipo public.equipo) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_equipo.rol = 'dueno' and p_equipo.activo and not exists (
       select 1 from public.equipo x where x.gimnasio_id = p_equipo.gimnasio_id and x.rol = 'dueno' and x.activo and not x.es_soporte and x.id <> p_equipo.id) then
    raise exception 'Es el único dueño activo de este gimnasio: primero nombrá a otro dueño' using errcode = '22023';
  end if;
end $$;
revoke all on function privado.no_dejar_sin_dueno(public.equipo) from public, anon, authenticated;

create or replace function public.admin_estado_persona(p_equipo_id uuid, p_activo boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; n int;
begin
  perform privado.exigir_brik(array['principal', 'soporte']);
  select * into e from public.equipo where id = p_equipo_id;
  if not found then raise exception 'Esa persona no existe' using errcode = 'P0002'; end if;
  if e.es_soporte then raise exception 'Esa cuenta es de BRIK: no se gestiona desde acá' using errcode = '22023'; end if;
  if not coalesce(p_activo, true) then perform privado.no_dejar_sin_dueno(e); end if;
  update public.equipo set activo = coalesce(p_activo, true) where id = p_equipo_id and activo is distinct from coalesce(p_activo, true);
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ya estaba %', case when coalesce(p_activo, true) then 'activa' else 'desactivada' end using errcode = '22023'; end if;
  perform privado.registrar_brik(case when coalesce(p_activo, true) then 'activar_persona' else 'desactivar_persona' end, e.gimnasio_id, jsonb_build_object('equipo_id', e.id, 'nombre', e.nombre));
end $$;

create or replace function public.admin_cambiar_rol_persona(p_equipo_id uuid, p_rol text) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; n int;
begin
  perform privado.exigir_brik(array['principal', 'soporte']);
  if p_rol not in ('dueno', 'encargado', 'recepcion', 'profe') then raise exception 'Rol: dueño, encargado, recepción o profe' using errcode = '22023'; end if;
  select * into e from public.equipo where id = p_equipo_id;
  if not found then raise exception 'Esa persona no existe' using errcode = 'P0002'; end if;
  if e.es_soporte then raise exception 'Esa cuenta es de BRIK: no se gestiona desde acá' using errcode = '22023'; end if;
  if e.rol = p_rol then raise exception 'Ya tiene ese rol' using errcode = '22023'; end if;
  if p_rol <> 'dueno' then perform privado.no_dejar_sin_dueno(e); end if;
  update public.equipo set rol = p_rol where id = p_equipo_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo cambiar el rol'; end if;
  perform privado.registrar_brik('cambiar_rol_persona', e.gimnasio_id, jsonb_build_object('equipo_id', e.id, 'nombre', e.nombre, 'de', e.rol, 'a', p_rol));
end $$;

-- Mover = la misma cuenta pasa a otro gimnasio: se desactiva en el origen (su historial queda ahí) y se la suma en el destino.
create or replace function public.admin_mover_persona(p_equipo_id uuid, p_gimnasio_destino uuid, p_rol text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; nuevo uuid; v_rol text; existente public.equipo;
begin
  perform privado.exigir_brik(array['principal']);
  select * into e from public.equipo where id = p_equipo_id;
  if not found then raise exception 'Esa persona no existe' using errcode = 'P0002'; end if;
  if e.es_soporte then raise exception 'Esa cuenta es de BRIK: no se gestiona desde acá' using errcode = '22023'; end if;
  if e.gimnasio_id = p_gimnasio_destino then raise exception 'Ya está en ese gimnasio' using errcode = '22023'; end if;
  if not exists (select 1 from public.gimnasios where id = p_gimnasio_destino and baja_en is null) then raise exception 'El gimnasio de destino no existe o está dado de baja' using errcode = 'P0002'; end if;
  v_rol := coalesce(nullif(btrim(p_rol), ''), e.rol);
  if v_rol not in ('dueno', 'encargado', 'recepcion', 'profe') then raise exception 'Rol: dueño, encargado, recepción o profe' using errcode = '22023'; end if;
  perform privado.no_dejar_sin_dueno(e);
  if e.usuario_id is not null then
    select * into existente from public.equipo where gimnasio_id = p_gimnasio_destino and usuario_id = e.usuario_id;
    if found then
      update public.equipo set activo = true, rol = v_rol where id = existente.id;
      nuevo := existente.id;
    end if;
  end if;
  if nuevo is null then
    insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values (p_gimnasio_destino, e.usuario_id, e.nombre, v_rol) returning id into nuevo;
  end if;
  update public.equipo set activo = false where id = e.id;
  perform privado.registrar_brik('mover_persona', e.gimnasio_id, jsonb_build_object('equipo_id', e.id, 'nombre', e.nombre, 'destino', p_gimnasio_destino, 'rol', v_rol));
  perform privado.registrar_brik('recibir_persona', p_gimnasio_destino, jsonb_build_object('equipo_id', nuevo, 'nombre', e.nombre, 'origen', e.gimnasio_id, 'rol', v_rol));
  return nuevo;
end $$;

revoke execute on function public.admin_probar_acceso(uuid), public.admin_probar_acceso_gimnasio(uuid), public.admin_confirmar_cuenta(uuid),
  public.admin_estado_persona(uuid, boolean), public.admin_cambiar_rol_persona(uuid, text), public.admin_mover_persona(uuid, uuid, text) from public, anon;
grant execute on function public.admin_probar_acceso(uuid), public.admin_probar_acceso_gimnasio(uuid), public.admin_confirmar_cuenta(uuid),
  public.admin_estado_persona(uuid, boolean), public.admin_cambiar_rol_persona(uuid, text), public.admin_mover_persona(uuid, uuid, text) to authenticated;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['admin_probar_acceso(uuid)', 'admin_probar_acceso_gimnasio(uuid)', 'admin_confirmar_cuenta(uuid)', 'admin_estado_persona(uuid,boolean)',
                           'admin_cambiar_rol_persona(uuid,text)', 'admin_mover_persona(uuid,uuid,text)'] loop
    if to_regprocedure('public.' || f) is null then raise exception 'Falta public.%', f; end if;
    if has_function_privilege('anon', 'public.' || f, 'execute') then raise exception 'anon puede ejecutar %', f; end if;
  end loop;
end $$;
