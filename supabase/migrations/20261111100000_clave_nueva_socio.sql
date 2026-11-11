-- C1 · "Nueva clave" a un toque, sin mails (Mateo no quiere mandar mails).
-- La recepción o el dueño le dan al socio una clave provisoria desde su ficha; el dueño, al equipo.
-- La base decide quién puede (rol y gimnasio_id); el servidor recién después toca la cuenta con la clave de servicio.
--   cuenta_para_clave_socio(socio)   valida y devuelve la cuenta (o dice que hay que crearla). Permiso denegado = error.
--   registrar_clave_entregada(...)   deja en claves_entregadas quién la generó. Nunca guarda la clave.
-- Nunca se aplica una clave a la cuenta de otro gimnasio, del equipo o de BRIK (se dice por qué).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null or to_regprocedure('privado.exigir_aal2(uuid)') is null
     or to_regprocedure('public.cuenta_para_nueva_clave(uuid)') is null then
    raise exception 'Guarda: faltan las migraciones de equipo y dos pasos';
  end if;
end $$;

-- ── Registro de quién entregó cada clave (sin la clave) ─────────────
create table if not exists public.claves_entregadas (
  id             uuid primary key default gen_random_uuid(),
  gimnasio_id    uuid not null references public.gimnasios(id),
  socio_id       uuid,
  equipo_id      uuid,
  por_equipo_id  uuid not null,
  por_usuario_id uuid,
  cuenta_creada  boolean not null default false,
  creado_en      timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, equipo_id) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, por_equipo_id) references public.equipo (gimnasio_id, id),
  check ((socio_id is not null) <> (equipo_id is not null))
);
create index if not exists claves_entregadas_recientes on public.claves_entregadas (gimnasio_id, creado_en desc);
alter table public.claves_entregadas enable row level security;
revoke all on table public.claves_entregadas from anon, authenticated;

-- ── Socio: validar antes de tocar la cuenta ─────────────────────────
create or replace function public.cuenta_para_clave_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios; yo public.equipo; v_email text; v_usuario uuid; v_hoy date; v_gim text; v_zona text;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  select * into s from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  yo := privado.exigir_equipo(s.gimnasio_id, array['dueno', 'recepcion']);
  perform privado.exigir_aal2(s.gimnasio_id);
  if s.dado_de_baja_en is not null then raise exception 'Está dado de baja: dalo de alta de nuevo primero'; end if;
  select g.nombre, g.zona_horaria into v_gim, v_zona from public.gimnasios g where g.id = s.gimnasio_id;
  v_hoy := privado.dia_local(now(), v_zona);
  if privado.es_menor(s.fecha_nacimiento, v_hoy) then
    raise exception 'Es menor de edad: entra su responsable con su propia cuenta';
  end if;
  v_usuario := s.usuario_id;
  if v_usuario is not null then
    if exists (select 1 from public.equipo q where q.usuario_id = v_usuario)
       or exists (select 1 from public.administradores_plataforma a where a.usuario_id = v_usuario) then
      raise exception 'Esa cuenta es del equipo del gimnasio: su clave se cambia desde Equipo' using errcode = '42501';
    end if;
    if exists (select 1 from public.socios x where x.usuario_id = v_usuario and x.gimnasio_id <> s.gimnasio_id) then
      raise exception 'Esa cuenta también es de otro gimnasio: su clave no se cambia desde acá' using errcode = '42501';
    end if;
    select u.email into v_email from auth.users u where u.id = v_usuario;
    if v_email is null then raise exception 'La cuenta de este socio no tiene mail: cargale uno en Editar'; end if;
  else
    v_email := lower(trim(coalesce(s.email, '')));
    if v_email = '' then raise exception 'No tiene mail cargado: cargalo en Editar y volvé a probar'; end if;
    if exists (select 1 from auth.users u where lower(u.email) = v_email) then
      raise exception 'Ese mail ya tiene una cuenta que no está vinculada a este socio (puede ser de otro gimnasio o del equipo). Que entre con su celular o con otro mail' using errcode = '42501';
    end if;
  end if;
  return jsonb_build_object('socio_id', s.id, 'gimnasio_id', s.gimnasio_id, 'gimnasio', v_gim, 'nombre', s.nombre,
                            'email', v_email, 'usuario_id', v_usuario, 'crear', v_usuario is null);
end $$;

-- ── Registrar quién la entregó (se llama después de aplicarla) ──────
create or replace function public.registrar_clave_entregada(p_socio_id uuid default null, p_equipo_id uuid default null, p_cuenta_creada boolean default false)
returns void
language plpgsql security definer set search_path = '' as $$
declare s public.socios; e public.equipo; yo public.equipo; n int;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  if (p_socio_id is null) = (p_equipo_id is null) then raise exception 'Indicá un socio o una persona del equipo' using errcode = '22023'; end if;
  if p_socio_id is not null then
    select * into s from public.socios where id = p_socio_id;
    if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
    yo := privado.exigir_equipo(s.gimnasio_id, array['dueno', 'recepcion']);
    insert into public.claves_entregadas (gimnasio_id, socio_id, por_equipo_id, por_usuario_id, cuenta_creada)
    values (s.gimnasio_id, s.id, yo.id, auth.uid(), coalesce(p_cuenta_creada, false));
  else
    select * into e from public.equipo where id = p_equipo_id;
    if not found then raise exception 'Sin permiso o persona inexistente' using errcode = '42501'; end if;
    yo := privado.exigir_equipo(e.gimnasio_id, array['dueno']);
    if not privado.puedo_administrar_persona(e) then raise exception 'Sin permiso para cambiarle la contraseña a esta persona' using errcode = '42501'; end if;
    insert into public.claves_entregadas (gimnasio_id, equipo_id, por_equipo_id, por_usuario_id, cuenta_creada)
    values (e.gimnasio_id, e.id, yo.id, auth.uid(), false);
  end if;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo registrar la clave entregada'; end if;
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.cuenta_para_clave_socio(uuid), public.registrar_clave_entregada(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.cuenta_para_clave_socio(uuid), public.registrar_clave_entregada(uuid, uuid, boolean) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.claves_entregadas'::regclass) then
    raise exception 'Verificación: claves_entregadas sin RLS';
  end if;
  if has_table_privilege('authenticated', 'public.claves_entregadas', 'select') then
    raise exception 'Verificación: claves_entregadas se lee directo';
  end if;
  foreach f in array array['public.cuenta_para_clave_socio(uuid)', 'public.registrar_clave_entregada(uuid, uuid, boolean)'] loop
    if has_function_privilege('anon', f::regprocedure, 'execute') then raise exception 'Verificación: % abierta a anon', f; end if;
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
  end loop;
end $$;
