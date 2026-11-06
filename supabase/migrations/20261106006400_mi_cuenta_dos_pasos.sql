-- VD-42 · Mi cuenta y seguridad: verificación en dos pasos (aal2) en lo sensible,
-- "Dar de baja" a alguien del equipo en un botón y alertas de seguridad al dueño.
--
--   privado.exigir_aal2(gimnasio)   exige aal2 SOLO a quien tiene un factor TOTP verificado
--                                    (quien no activó la verificación sigue como siempre)
--   Lo sensible la llama: exportar_gimnasio, exportar_socios, guardar_equipo, guardar_permisos_equipo,
--   guardar_mercadopago, quitar_mercadopago, cuenta_para_nueva_clave, persona_para_dar_acceso
--   (copias de la definición más nueva, con la llamada agregada).
--   dar_de_baja_equipo               cuenta desactivada, PIN borrado, turno de caja cerrado y sesiones cortadas;
--                                    el historial queda. guardar_equipo(activo = false) hace lo mismo.
--   registrar_sesion_equipo          anota desde qué dispositivo entra cada persona del equipo; uno nuevo avisa al dueño
--   seguridad_dueno / marcar_alertas_vistas
--   public.alertas_seguridad, public.huellas_equipo (cerradas: solo por las funciones de arriba)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('auth.sessions') is null then raise exception 'VD-42: falta auth.sessions'; end if;
  if to_regclass('auth.mfa_factors') is null then raise exception 'VD-42: falta auth.mfa_factors (en la base local la crea simular-supabase.sql)'; end if;
  if to_regclass('privado.pines_equipo') is null then raise exception 'VD-42: falta privado.pines_equipo (0071)'; end if;
  if to_regprocedure('privado.resumen_turno(uuid)') is null then raise exception 'VD-42: falta privado.resumen_turno'; end if;
  if to_regprocedure('public.mi_seguridad()') is null then raise exception 'VD-42: falta mi_seguridad (VD-33b)'; end if;
end $$;

-- ── Verificación en dos pasos ───────────────────────────────────────
-- Un token con aal2 es el que salió de verificar el código de la app autenticadora. Sin factor TOTP
-- verificado no hay nada que exigir (el dueño que no la activó sigue entrando como siempre; la pantalla se lo recomienda).
create or replace function privado.tiene_dos_pasos(p_usuario_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.mfa_factors f
                  where f.user_id = p_usuario_id and f.factor_type::text = 'totp' and f.status::text = 'verified')
$$;
revoke all on function privado.tiene_dos_pasos(uuid) from public;

create or replace function privado.exigir_aal2(p_gimnasio_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;                       -- clave de servicio: lo decide quien llama
  if coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' then return; end if;
  if privado.tiene_dos_pasos(auth.uid()) then
    raise exception 'Esto pide tu código de verificación en dos pasos: confirmalo en Mi cuenta, en Seguridad' using errcode = '42501';
  end if;
end $$;
revoke all on function privado.exigir_aal2(uuid) from public;

-- ── Tablas cerradas ─────────────────────────────────────────────────
create table if not exists public.huellas_equipo (
  gimnasio_id  uuid not null references public.gimnasios(id),
  equipo_id    uuid not null,
  huella       text not null check (length(huella) = 32),
  user_agent   text check (length(user_agent) <= 400),
  primera_vez  timestamptz not null default now(),
  ultima_vez   timestamptz not null default now(),
  primary key (gimnasio_id, equipo_id, huella),
  foreign key (gimnasio_id, equipo_id) references public.equipo (gimnasio_id, id)
);
alter table public.huellas_equipo enable row level security;
revoke all on table public.huellas_equipo from anon, authenticated;

create table if not exists public.alertas_seguridad (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  tipo         text not null check (tipo in ('dispositivo_nuevo', 'baja_equipo')),
  equipo_id    uuid,
  datos        jsonb not null default '{}'::jsonb,
  creado_en    timestamptz not null default now(),
  vista_en     timestamptz,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, equipo_id) references public.equipo (gimnasio_id, id)
);
create index if not exists alertas_seguridad_recientes on public.alertas_seguridad (gimnasio_id, creado_en desc);
alter table public.alertas_seguridad enable row level security;
revoke all on table public.alertas_seguridad from anon, authenticated;

-- ── Cortar el acceso de alguien del equipo ──────────────────────────
-- Lo usan dar_de_baja_equipo y guardar_equipo (al desactivar). No borra nada del historial.
create or replace function privado.cortar_acceso_equipo(p_gimnasio_id uuid, p_equipo_id uuid, p_por uuid, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; t record; pines int := 0; turnos int := 0; sesiones int := 0;
begin
  select * into e from public.equipo where id = p_equipo_id and gimnasio_id = p_gimnasio_id;
  if not found then raise exception 'Sin permiso o persona inexistente' using errcode = '42501'; end if;
  delete from privado.pines_equipo where equipo_id = e.id;
  get diagnostics pines = row_count;
  -- Su turno de caja queda cerrado "sin contar": lo cuenta el dueño o el encargado en Caja → Para revisar.
  for t in select x.id from public.turnos_caja x where x.gimnasio_id = p_gimnasio_id and x.abierto_por = e.id and x.cerrado_en is null for update loop
    update public.turnos_caja
       set cerrado_en = now(), sin_contar = true, sin_contar_en = now(), monto_esperado = (privado.resumen_turno(t.id) ->> 'esperado')::numeric
     where id = t.id and cerrado_en is null;
    turnos := turnos + 1;
  end loop;
  -- Sus sesiones, salvo que la misma cuenta siga siendo parte de otro equipo o sea socio (esas las necesita).
  -- Aun con una sesión viva, la base le niega todo en este gimnasio: exigir_equipo mira que siga activo.
  if e.usuario_id is not null
     and not exists (select 1 from public.equipo o where o.usuario_id = e.usuario_id and o.id <> e.id and o.activo)
     and not exists (select 1 from public.socios s where s.usuario_id = e.usuario_id and s.dado_de_baja_en is null) then
    begin
      delete from auth.sessions where user_id = e.usuario_id;
      get diagnostics sesiones = row_count;
    exception when insufficient_privilege then
      sesiones := -1;     -- no se pudo borrar desde acá; la baja igual vale (la base ya no lo deja hacer nada)
    end;
  end if;
  insert into public.alertas_seguridad (gimnasio_id, tipo, equipo_id, datos)
  values (p_gimnasio_id, 'baja_equipo', e.id, jsonb_build_object('motivo', nullif(trim(coalesce(p_motivo, '')), ''),
          'por', (select q.nombre from public.equipo q where q.id = p_por), 'sesiones', sesiones, 'turnos', turnos, 'pin', pines > 0));
  return jsonb_build_object('nombre', e.nombre, 'sesiones_cerradas', sesiones, 'turnos_cerrados', turnos, 'pin_borrado', pines > 0);
end $$;
revoke all on function privado.cortar_acceso_equipo(uuid, uuid, uuid, text) from public;

create or replace function public.dar_de_baja_equipo(p_gimnasio_id uuid, p_equipo_id uuid, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare yo public.equipo; e public.equipo; n int;
begin
  yo := privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  perform privado.exigir_aal2(p_gimnasio_id);
  select * into e from public.equipo where id = p_equipo_id and gimnasio_id = p_gimnasio_id for update;
  if not found then raise exception 'Sin permiso o persona inexistente' using errcode = '42501'; end if;
  if e.id = yo.id then raise exception 'No podés darte de baja a vos mismo' using errcode = '22023'; end if;
  if e.es_soporte then raise exception 'Esa cuenta es de BRIK: no se da de baja desde acá' using errcode = '22023'; end if;
  update public.equipo set activo = false where id = e.id and gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo dar de baja'; end if;
  if not exists (select 1 from public.equipo where gimnasio_id = p_gimnasio_id and rol = 'dueno' and activo) then
    raise exception 'El gimnasio tiene que tener al menos un dueño activo' using errcode = '22023';
  end if;
  return privado.cortar_acceso_equipo(p_gimnasio_id, e.id, yo.id, p_motivo);
end $$;

-- ── Alta y edición del equipo: guardar_equipo con aal2 y el corte al desactivar ──
create or replace function public.guardar_equipo(p_gimnasio_id uuid, p_equipo_id uuid, p_nombre text, p_rol text,
                                                 p_sede_id uuid default null, p_activo boolean default true)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare yo public.equipo; previo public.equipo; eid uuid; n int; corta boolean := false;
begin
  yo := privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  perform privado.exigir_aal2(p_gimnasio_id);
  if length(trim(coalesce(p_nombre, ''))) = 0 then raise exception 'El nombre es obligatorio'; end if;
  if p_rol not in ('dueno', 'encargado', 'recepcion', 'profe') then raise exception 'Rol no válido'; end if;
  if p_sede_id is not null and not exists (select 1 from public.sedes where id = p_sede_id and gimnasio_id = p_gimnasio_id) then
    raise exception 'Sede inexistente';
  end if;
  if p_equipo_id is null then
    insert into public.equipo (gimnasio_id, nombre, rol, sede_id) values (p_gimnasio_id, trim(p_nombre), p_rol, p_sede_id)
    returning id into eid;
  else
    select * into previo from public.equipo where id = p_equipo_id and gimnasio_id = p_gimnasio_id for update;
    if not found then raise exception 'Sin permiso o persona inexistente' using errcode = '42501'; end if;
    if previo.id = yo.id and (p_rol <> 'dueno' or not coalesce(p_activo, true)) then
      raise exception 'No podés sacarte a vos mismo el rol de dueño';
    end if;
    corta := previo.activo and not coalesce(p_activo, true);
    update public.equipo set nombre = trim(p_nombre), rol = p_rol, sede_id = p_sede_id, activo = coalesce(p_activo, true)
     where id = p_equipo_id returning id into eid;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo guardar'; end if;
  end if;
  if not exists (select 1 from public.equipo where gimnasio_id = p_gimnasio_id and rol = 'dueno' and activo) then
    raise exception 'El gimnasio tiene que tener al menos un dueño activo';
  end if;
  if corta then perform privado.cortar_acceso_equipo(p_gimnasio_id, eid, yo.id, null); end if;
  return eid;
end $$;

create or replace function public.guardar_permisos_equipo(p_gimnasio_id uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare k text; n int;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno']);
  perform privado.exigir_aal2(p_gimnasio_id);
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then raise exception 'Nada para guardar' using errcode = '22023'; end if;
  for k in select jsonb_object_keys(p_datos) loop
    if k not in ('recepcion_ve_cobrado', 'recepcion_vende_productos', 'profe_ve_telefono', 'encargado_ve_resultado') then
      raise exception 'Permiso desconocido: %', k using errcode = '22023';
    end if;
    if jsonb_typeof(p_datos -> k) <> 'boolean' then raise exception 'El permiso % va prendido o apagado', k using errcode = '22023'; end if;
  end loop;
  update public.configuracion_gimnasio c set
    recepcion_ve_cobrado = coalesce((p_datos ->> 'recepcion_ve_cobrado')::boolean, c.recepcion_ve_cobrado),
    recepcion_vende_productos = coalesce((p_datos ->> 'recepcion_vende_productos')::boolean, c.recepcion_vende_productos),
    profe_ve_telefono = coalesce((p_datos ->> 'profe_ve_telefono')::boolean, c.profe_ve_telefono),
    encargado_ve_resultado = coalesce((p_datos ->> 'encargado_ve_resultado')::boolean, c.encargado_ve_resultado)
   where c.gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudieron guardar los permisos'; end if;
end $$;

-- Dar acceso y cambiar la contraseña de alguien del equipo (las usa el servidor antes de tocar la cuenta).
create or replace function public.cuenta_para_nueva_clave(p_equipo_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; v_email text;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  select * into e from public.equipo where id = p_equipo_id;
  if not found then raise exception 'Esa persona no existe' using errcode = 'P0002'; end if;
  if not privado.puedo_administrar_persona(e) then
    raise exception 'Sin permiso para cambiarle la contraseña a esta persona' using errcode = '42501';
  end if;
  perform privado.exigir_aal2(e.gimnasio_id);
  if e.usuario_id is null then raise exception '% todavía no tiene acceso: dale acceso con su mail', e.nombre; end if;
  if exists (select 1 from public.administradores_plataforma a where a.usuario_id = e.usuario_id) then
    raise exception 'Es una cuenta de BRIK: su contraseña se cambia desde su propia cuenta' using errcode = '42501';
  end if;
  select u.email into v_email from auth.users u where u.id = e.usuario_id;
  return jsonb_build_object('usuario_id', e.usuario_id, 'email', v_email, 'nombre', e.nombre);
end $$;

create or replace function public.persona_para_dar_acceso(p_equipo_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  select * into e from public.equipo where id = p_equipo_id;
  if not found then raise exception 'Esa persona no existe' using errcode = 'P0002'; end if;
  if not (privado.soy_admin_plataforma() or exists (
            select 1 from public.equipo yo where yo.gimnasio_id = e.gimnasio_id and yo.usuario_id = auth.uid() and yo.activo and yo.rol = 'dueno')) then
    raise exception 'Sin permiso para dar acceso en este gimnasio' using errcode = '42501';
  end if;
  perform privado.exigir_aal2(e.gimnasio_id);
  if e.usuario_id is not null then raise exception '% ya tiene acceso', e.nombre; end if;
  if not e.activo then raise exception '% está desactivado: activalo primero', e.nombre; end if;
  return jsonb_build_object('equipo_id', e.id, 'nombre', e.nombre, 'rol', e.rol);
end $$;

-- ── Exportar datos ──────────────────────────────────────────────────
create or replace function public.exportar_gimnasio(p_gimnasio_id uuid, p_tabla text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno']);
  perform privado.exigir_aal2(p_gimnasio_id);
  if p_tabla is null or not (p_tabla = any (privado.tablas_exportables())) then raise exception 'Tabla que no se exporta: %', p_tabla using errcode = '22023'; end if;
  execute format('select coalesce(jsonb_agg(to_jsonb(x) - ''gimnasio_id'' - ''foto_path'' - ''comprobante_path'' - ''ticket_path'' - ''preferencias'' order by x.id), ''[]''::jsonb)
                    from public.%I x where x.gimnasio_id = $1', p_tabla)
    into r using p_gimnasio_id;
  return r;
end $$;

create or replace function public.exportar_socios(p_gimnasio_id uuid, p_texto text default null, p_etiqueta uuid default null)
returns table (numero int, nombre text, apellido text, dni text, telefono text, email text, nacimiento date, plan text,
               estado text, cubierto_hasta date, alta date, dado_de_baja date, etiquetas text)
language plpgsql stable security definer set search_path = '' as $$
declare t text := privado.sin_acentos(lower(trim(coalesce(p_texto, '')))); d text; zona text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  perform privado.exigir_aal2(p_gimnasio_id);
  d := regexp_replace(t, '\D', '', 'g');
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  return query
  select s.numero, s.nombre, s.apellido, s.dni, s.telefono, s.email, s.fecha_nacimiento,
         (select pl.nombre from public.suscripciones su join public.planes pl on pl.id = su.plan_id
           where su.socio_id = s.id and su.baja_en is null order by su.inicio desc limit 1),
         v.texto,
         case when v.vence_en is not null then ((v.vence_en - interval '1 second') at time zone zona)::date end,
         (s.creado_en at time zone zona)::date,
         (s.dado_de_baja_en at time zone zona)::date,
         (select string_agg(e.nombre, ', ' order by lower(e.nombre)) from public.socio_etiquetas se join public.etiquetas e on e.id = se.etiqueta_id
           where se.socio_id = s.id)
    from public.socios s
    cross join lateral privado.calcular_acceso(s.id, now(), null) v
   where s.gimnasio_id = p_gimnasio_id
     and (p_etiqueta is null or exists (select 1 from public.socio_etiquetas se where se.gimnasio_id = p_gimnasio_id and se.socio_id = s.id and se.etiqueta_id = p_etiqueta))
     and (t = '' or privado.sin_acentos(lower(s.nombre || ' ' || s.apellido)) like '%' || t || '%'
          or (length(d) >= 3 and (s.dni like d || '%' or regexp_replace(coalesce(s.telefono, ''), '\D', '', 'g') like '%' || d || '%')))
   order by s.apellido, s.nombre;
end $$;

-- ── Configuración de cobros: las credenciales de MercadoPago ────────
create or replace function public.guardar_mercadopago(p_gimnasio_id uuid, p_token text, p_secreto text, p_modo text) returns void
language plpgsql security definer set search_path = '' as $$
declare eid uuid; pp public.proveedores_pago; tok text := trim(coalesce(p_token, '')); sec text := trim(coalesce(p_secreto, ''));
begin
  eid := privado.exigir_rol(p_gimnasio_id, array['dueno']);
  perform privado.exigir_aal2(p_gimnasio_id);
  if p_modo is null or p_modo not in ('prueba', 'produccion') then raise exception 'Elegí si es de prueba o de producción' using errcode = '22023'; end if;
  if tok !~ '^(APP_USR|TEST)-[A-Za-z0-9_-]{20,}$' or length(tok) > 300 then
    raise exception 'El Access Token empieza con APP_USR- (o TEST- el de prueba): copialo entero de MercadoPago → Tus integraciones → Credenciales' using errcode = '22023';
  end if;
  if length(sec) < 16 or length(sec) > 200 then raise exception 'La clave secreta del webhook está en MercadoPago → Tus integraciones → Webhooks: copiala entera' using errcode = '22023'; end if;
  select * into pp from public.proveedores_pago where gimnasio_id = p_gimnasio_id and proveedor = 'mercadopago' for update;
  if found then
    perform vault.update_secret(pp.token_secreto_id, tok);
    perform vault.update_secret(pp.webhook_secreto_id, sec);
    update public.proveedores_pago set modo = p_modo, activo = true, conectado_en = now(), conectado_por = eid where id = pp.id and gimnasio_id = p_gimnasio_id;
  else
    insert into public.proveedores_pago (gimnasio_id, modo, token_secreto_id, webhook_secreto_id, conectado_por)
    values (p_gimnasio_id, p_modo,
            vault.create_secret(tok, 'mp_token_' || p_gimnasio_id, 'MercadoPago: Access Token del gimnasio'),
            vault.create_secret(sec, 'mp_webhook_' || p_gimnasio_id, 'MercadoPago: clave del webhook del gimnasio'), eid);
  end if;
end $$;

create or replace function public.quitar_mercadopago(p_gimnasio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare pp public.proveedores_pago;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno']);
  perform privado.exigir_aal2(p_gimnasio_id);
  select * into pp from public.proveedores_pago where gimnasio_id = p_gimnasio_id and proveedor = 'mercadopago' for update;
  if not found then raise exception 'MercadoPago no estaba conectado' using errcode = '22023'; end if;
  -- Los secretos se pisan: desconectado no queda ningún token usable.
  perform vault.update_secret(pp.token_secreto_id, 'desconectado');
  perform vault.update_secret(pp.webhook_secreto_id, 'desconectado');
  update public.proveedores_pago set activo = false where id = pp.id and gimnasio_id = p_gimnasio_id;
end $$;

-- ── Alertas de seguridad ────────────────────────────────────────────
-- Cada persona del equipo anota el dispositivo desde el que entra (el panel lo llama una vez por pestaña).
-- El primero no avisa (no hay con qué comparar); uno nuevo de alguien que no es el dueño, sí.
create or replace function public.registrar_sesion_equipo(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; sid uuid; ua text; h text; conocida boolean; primera boolean;
begin
  select * into e from public.equipo
   where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and activo and not es_soporte;
  if not found then return jsonb_build_object('nuevo', false); end if;
  sid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  if sid is null then return jsonb_build_object('nuevo', false); end if;
  select s.user_agent into ua from auth.sessions s where s.id = sid and s.user_id = auth.uid();
  if ua is null or length(trim(ua)) = 0 then return jsonb_build_object('nuevo', false); end if;
  h := md5(ua);
  conocida := exists (select 1 from public.huellas_equipo x where x.gimnasio_id = p_gimnasio_id and x.equipo_id = e.id and x.huella = h);
  primera := not exists (select 1 from public.huellas_equipo x where x.gimnasio_id = p_gimnasio_id and x.equipo_id = e.id);
  insert into public.huellas_equipo (gimnasio_id, equipo_id, huella, user_agent) values (p_gimnasio_id, e.id, h, left(ua, 400))
  on conflict (gimnasio_id, equipo_id, huella) do update set ultima_vez = now();
  if not conocida and not primera and e.rol <> 'dueno' then
    insert into public.alertas_seguridad (gimnasio_id, tipo, equipo_id, datos)
    values (p_gimnasio_id, 'dispositivo_nuevo', e.id, jsonb_build_object('user_agent', left(ua, 400)));
    return jsonb_build_object('nuevo', true);
  end if;
  return jsonb_build_object('nuevo', false);
end $$;

-- Para Inicio del dueño: si tiene la verificación en dos pasos y las últimas alertas.
create or replace function public.seguridad_dueno(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  return jsonb_build_object(
    'dos_pasos', privado.tiene_dos_pasos(auth.uid()),
    'confirmada', coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2',
    'obligatoria', privado.soy_admin_plataforma(),
    'sin_ver', (select count(*) from public.alertas_seguridad a where a.gimnasio_id = p_gimnasio_id and a.vista_en is null),
    'alertas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'tipo', x.tipo, 'quien', x.nombre, 'datos', x.datos,
                                                             'creado_en', x.creado_en, 'vista', x.vista_en is not null) order by x.creado_en desc)
                           from (select a.*, q.nombre from public.alertas_seguridad a left join public.equipo q on q.id = a.equipo_id
                                  where a.gimnasio_id = p_gimnasio_id and a.creado_en > now() - interval '30 days'
                                  order by a.creado_en desc limit 10) x), '[]'::jsonb));
end $$;

create or replace function public.marcar_alertas_vistas(p_gimnasio_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  update public.alertas_seguridad set vista_en = now() where gimnasio_id = p_gimnasio_id and vista_en is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.dar_de_baja_equipo(uuid, uuid, text), public.registrar_sesion_equipo(uuid), public.seguridad_dueno(uuid),
  public.marcar_alertas_vistas(uuid) from public, anon, authenticated;
grant execute on function public.dar_de_baja_equipo(uuid, uuid, text), public.registrar_sesion_equipo(uuid), public.seguridad_dueno(uuid),
  public.marcar_alertas_vistas(uuid) to authenticated, service_role;
revoke all on function public.guardar_equipo(uuid, uuid, text, text, uuid, boolean), public.guardar_permisos_equipo(uuid, jsonb),
  public.exportar_gimnasio(uuid, text), public.exportar_socios(uuid, text, uuid), public.guardar_mercadopago(uuid, text, text, text),
  public.quitar_mercadopago(uuid), public.cuenta_para_nueva_clave(uuid), public.persona_para_dar_acceso(uuid) from public, anon, authenticated;
grant execute on function public.guardar_equipo(uuid, uuid, text, text, uuid, boolean), public.guardar_permisos_equipo(uuid, jsonb),
  public.exportar_gimnasio(uuid, text), public.exportar_socios(uuid, text, uuid), public.guardar_mercadopago(uuid, text, text, text),
  public.quitar_mercadopago(uuid), public.cuenta_para_nueva_clave(uuid), public.persona_para_dar_acceso(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['privado.exigir_aal2(uuid)', 'privado.tiene_dos_pasos(uuid)', 'privado.cortar_acceso_equipo(uuid, uuid, uuid, text)',
      'public.dar_de_baja_equipo(uuid, uuid, text)', 'public.registrar_sesion_equipo(uuid)', 'public.seguridad_dueno(uuid)', 'public.marcar_alertas_vistas(uuid)',
      'public.guardar_equipo(uuid, uuid, text, text, uuid, boolean)', 'public.guardar_permisos_equipo(uuid, jsonb)', 'public.exportar_gimnasio(uuid, text)',
      'public.exportar_socios(uuid, text, uuid)', 'public.guardar_mercadopago(uuid, text, text, text)', 'public.quitar_mercadopago(uuid)',
      'public.cuenta_para_nueva_clave(uuid)', 'public.persona_para_dar_acceso(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  foreach f in array array['public.guardar_equipo(uuid, uuid, text, text, uuid, boolean)', 'public.guardar_permisos_equipo(uuid, jsonb)',
      'public.exportar_gimnasio(uuid, text)', 'public.exportar_socios(uuid, text, uuid)', 'public.guardar_mercadopago(uuid, text, text, text)',
      'public.quitar_mercadopago(uuid)', 'public.cuenta_para_nueva_clave(uuid)', 'public.persona_para_dar_acceso(uuid)',
      'public.dar_de_baja_equipo(uuid, uuid, text)'] loop
    if position('exigir_aal2' in pg_get_functiondef(f::regprocedure)) = 0 then raise exception 'Verificación: % no exige aal2', f; end if;
  end loop;
  if has_function_privilege('authenticated', 'privado.exigir_aal2(uuid)', 'execute') then raise exception 'Verificación: exigir_aal2 no es para el navegador'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.alertas_seguridad'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.huellas_equipo'::regclass) then
    raise exception 'Verificación: las tablas de seguridad sin RLS';
  end if;
  if has_table_privilege('authenticated', 'public.alertas_seguridad', 'select') or has_table_privilege('authenticated', 'public.huellas_equipo', 'select') then
    raise exception 'Verificación: las tablas de seguridad se pueden leer directo';
  end if;
end $$;
