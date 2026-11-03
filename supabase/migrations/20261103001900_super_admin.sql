-- ═══════════════════════════════════════════════════════════════════
-- 0019 · Super admin completo y gimnasios sin subdominio.
--
-- 1. El super admin entra a cualquier gimnasio como "Soporte BRIK": queda
--    en el equipo del gimnasio (con rol dueño y marcado es_soporte), así
--    cada pantalla sigue validando permisos igual que para cualquiera y el
--    dueño lo ve en su lista de equipo. Sale cuando quiere.
-- 2. El super admin ve el detalle de cada gimnasio (equipo con mail y
--    último ingreso, direcciones) y da de alta personas y direcciones.
-- 3. Claves: la base decide quién puede darle una contraseña nueva (o el
--    primer acceso) a quién; el servidor recién después usa la clave de
--    servicio. El super admin, a cualquiera menos cuentas de BRIK. El dueño,
--    a su equipo menos a otros dueños.
-- 4. gimnasio_por_slug devuelve también una dirección del gimnasio, para
--    abrir su página y la app del socio desde la dirección de la
--    plataforma (sin subdominio propio todavía).
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.gimnasio_por_slug(text)') is null then raise exception 'Guarda: falta la migración 0018'; end if;
  if to_regprocedure('public.admin_gimnasios()') is null then raise exception 'Guarda: falta la migración 0013'; end if;
  if to_regprocedure('public.vincular_usuario_equipo(uuid,uuid)') is null then raise exception 'Guarda: falta la migración 0013'; end if;
end $$;

-- ── Acceso de soporte ───────────────────────────────────────────────
alter table public.equipo add column if not exists es_soporte boolean not null default false;

-- ── El gimnasio por slug, con una dirección suya ────────────────────
-- Cambia lo que devuelve: la versión de 0018 se borra acá mismo.
drop function if exists public.gimnasio_por_slug(text);
create function public.gimnasio_por_slug(p_slug text)
returns table (gimnasio_id uuid, slug text, nombre text, zona_horaria text,
               logo_path text, favicon_path text, color_acento text, color_fondo text, host text)
language sql stable security definer set search_path = '' as $$
  select g.id, g.slug, g.nombre, g.zona_horaria, c.logo_path, c.favicon_path, c.color_acento, c.color_fondo,
         (select d.host from public.dominios_gimnasio d where d.gimnasio_id = g.id
           order by (d.tipo = 'propio') desc, d.creado_en limit 1)
    from public.gimnasios g
    join public.configuracion_gimnasio c on c.gimnasio_id = g.id
   where g.slug = lower(p_slug)
$$;
revoke all on function public.gimnasio_por_slug(text) from public, anon, authenticated;
grant execute on function public.gimnasio_por_slug(text) to anon, authenticated, service_role;

-- ── Lista de gimnasios del super admin (suma: si yo estoy adentro) ──
drop function if exists public.admin_gimnasios();
create function public.admin_gimnasios()
returns table (gimnasio_id uuid, slug text, nombre text, es_demo boolean, creado_en timestamptz, suspendido boolean,
               hosts text[], socios int, socios_al_dia int, ingresos_7_dias int, duenos text[],
               duenos_sin_cuenta int, estoy_dentro boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  return query
  select g.id, g.slug, g.nombre, g.es_demo, g.creado_en, g.suspension_manual_en is not null,
         array(select d.host from public.dominios_gimnasio d where d.gimnasio_id = g.id order by d.tipo desc, d.host),
         (select count(*)::int from public.socios s where s.gimnasio_id = g.id and s.dado_de_baja_en is null),
         (select count(distinct cb.socio_id)::int from public.coberturas cb
           where cb.gimnasio_id = g.id and cb.anulada_en is null and cb.desde <= now() and cb.hasta > now()),
         (select count(*)::int from public.ingresos i where i.gimnasio_id = g.id and i.anulado_en is null
             and i.resultado <> 'rechazado' and i.momento > now() - interval '7 days'),
         array(select e.nombre from public.equipo e
                where e.gimnasio_id = g.id and e.rol = 'dueno' and e.activo and not e.es_soporte order by e.nombre),
         (select count(*)::int from public.equipo e
           where e.gimnasio_id = g.id and e.rol = 'dueno' and e.activo and not e.es_soporte and e.usuario_id is null),
         exists (select 1 from public.equipo e where e.gimnasio_id = g.id and e.usuario_id = auth.uid() and e.activo)
    from public.gimnasios g
   order by g.es_demo, g.nombre;
end $$;

-- ── Entrar y salir como soporte ─────────────────────────────────────
create or replace function public.admin_entrar_gimnasio(p_gimnasio_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_slug text; e public.equipo; n int;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  select g.slug into v_slug from public.gimnasios g where g.id = p_gimnasio_id;
  if not found then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  select * into e from public.equipo where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid();
  if found then
    if not e.activo then
      if not e.es_soporte then
        raise exception 'Tu cuenta está en el equipo de este gimnasio pero desactivada por el dueño';
      end if;
      update public.equipo set activo = true where id = e.id;
      get diagnostics n = row_count;
      if n <> 1 then raise exception 'No se pudo reactivar el acceso de soporte'; end if;
    end if;
  else
    insert into public.equipo (gimnasio_id, usuario_id, nombre, rol, es_soporte)
    values (p_gimnasio_id, auth.uid(), 'Soporte BRIK', 'dueno', true);
  end if;
  return v_slug;
end $$;

create or replace function public.admin_salir_gimnasio(p_gimnasio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  update public.equipo set activo = false
   where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and es_soporte and activo;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No tenías acceso de soporte activo en este gimnasio'; end if;
end $$;

-- ── Detalle de un gimnasio para el super admin ──────────────────────
create or replace function public.admin_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g public.gimnasios;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  select * into g from public.gimnasios where id = p_gimnasio_id;
  if not found then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'gimnasio_id', g.id, 'slug', g.slug, 'nombre', g.nombre, 'es_demo', g.es_demo, 'creado_en', g.creado_en,
    'dominios', (select coalesce(jsonb_agg(jsonb_build_object('dominio_id', d.id, 'host', d.host, 'tipo', d.tipo)
                                           order by d.tipo desc, d.host), '[]'::jsonb)
                   from public.dominios_gimnasio d where d.gimnasio_id = g.id),
    'equipo', (select coalesce(jsonb_agg(jsonb_build_object(
                   'equipo_id', e.id, 'nombre', e.nombre, 'rol', e.rol, 'activo', e.activo, 'es_soporte', e.es_soporte,
                   'tiene_cuenta', e.usuario_id is not null, 'email', u.email, 'ultimo_ingreso', u.last_sign_in_at,
                   'soy_yo', e.usuario_id = auth.uid())
                 order by e.activo desc, e.es_soporte, array_position(array['dueno', 'encargado', 'recepcion', 'profe'], e.rol), e.nombre), '[]'::jsonb)
                 from public.equipo e left join auth.users u on u.id = e.usuario_id
                where e.gimnasio_id = g.id)
  );
end $$;

-- Alta de una persona en el equipo de cualquier gimnasio (el acceso lo da el servidor).
create or replace function public.admin_agregar_persona(p_gimnasio_id uuid, p_nombre text, p_rol text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare eid uuid;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if not exists (select 1 from public.gimnasios where id = p_gimnasio_id) then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  if length(trim(coalesce(p_nombre, ''))) = 0 then raise exception 'El nombre es obligatorio'; end if;
  if coalesce(p_rol, '') <> all (array['dueno', 'encargado', 'recepcion', 'profe']) then raise exception 'Rol no válido: %', p_rol; end if;
  insert into public.equipo (gimnasio_id, nombre, rol) values (p_gimnasio_id, trim(p_nombre), p_rol) returning id into eid;
  return eid;
end $$;

-- ── Direcciones ─────────────────────────────────────────────────────
create or replace function public.admin_agregar_dominio(p_gimnasio_id uuid, p_host text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_host text := lower(trim(coalesce(p_host, ''))); did uuid;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if not exists (select 1 from public.gimnasios where id = p_gimnasio_id) then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  v_host := regexp_replace(regexp_replace(v_host, '^[a-z]+://', ''), '[/:].*$', '');
  if v_host !~ '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$' then
    raise exception 'La dirección no es válida (ej: olympo-gym.vercel.app o www.olympogym.com)';
  end if;
  if exists (select 1 from public.dominios_gimnasio d where d.host = v_host) then
    raise exception 'La dirección % ya es de un gimnasio', v_host;
  end if;
  insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values (p_gimnasio_id, v_host, 'propio') returning id into did;
  return did;
end $$;

create or replace function public.admin_quitar_dominio(p_dominio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  delete from public.dominios_gimnasio where id = p_dominio_id and tipo = 'propio';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Solo se quitan direcciones propias (el subdominio del gimnasio queda siempre)'; end if;
end $$;

-- ── Claves: quién puede tocar la cuenta de quién ────────────────────
-- Devuelven la cuenta solo si quien llama puede; si no, error. El servidor
-- usa la clave de servicio recién con esa respuesta.
create or replace function privado.puedo_administrar_persona(e public.equipo) returns boolean
language sql stable security definer set search_path = '' as $$
  select (privado.soy_admin_plataforma() and not e.es_soporte)
      or (e.rol <> 'dueno' and not e.es_soporte and e.usuario_id is distinct from auth.uid()
          and exists (select 1 from public.equipo yo where yo.gimnasio_id = e.gimnasio_id and yo.usuario_id = auth.uid()
                        and yo.activo and yo.rol = 'dueno'))
$$;
revoke all on function privado.puedo_administrar_persona(public.equipo) from public;

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
  if e.usuario_id is not null then raise exception '% ya tiene acceso', e.nombre; end if;
  if not e.activo then raise exception '% está desactivado: activalo primero', e.nombre; end if;
  return jsonb_build_object('equipo_id', e.id, 'nombre', e.nombre, 'rol', e.rol);
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function
  public.admin_gimnasios(), public.admin_entrar_gimnasio(uuid), public.admin_salir_gimnasio(uuid),
  public.admin_gimnasio(uuid), public.admin_agregar_persona(uuid, text, text),
  public.admin_agregar_dominio(uuid, text), public.admin_quitar_dominio(uuid),
  public.cuenta_para_nueva_clave(uuid), public.persona_para_dar_acceso(uuid)
from public, anon;
grant execute on function
  public.admin_gimnasios(), public.admin_entrar_gimnasio(uuid), public.admin_salir_gimnasio(uuid),
  public.admin_gimnasio(uuid), public.admin_agregar_persona(uuid, text, text),
  public.admin_agregar_dominio(uuid, text), public.admin_quitar_dominio(uuid),
  public.cuenta_para_nueva_clave(uuid), public.persona_para_dar_acceso(uuid)
to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not has_function_privilege('anon', 'public.gimnasio_por_slug(text)', 'execute') then
    raise exception 'Verificación: el middleware (anon) no puede resolver el gimnasio por slug';
  end if;
  if has_function_privilege('anon', 'public.admin_entrar_gimnasio(uuid)', 'execute') then
    raise exception 'Verificación: anon no debería poder entrar como soporte';
  end if;
  if has_function_privilege('anon', 'public.cuenta_para_nueva_clave(uuid)', 'execute') then
    raise exception 'Verificación: anon no debería poder pedir cuentas';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'equipo' and column_name = 'es_soporte') then
    raise exception 'Verificación: falta equipo.es_soporte';
  end if;
end $$;
