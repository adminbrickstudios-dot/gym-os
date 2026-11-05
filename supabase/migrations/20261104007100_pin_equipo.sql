-- 0071 · PIN del equipo en la recepción (CAJ-3, decisión D15).
-- La PC de la recepción queda con una sesión del gimnasio y cada uno pone su
-- PIN de 4 números para que quede registrado quién cobró, quién abrió la caja
-- o quién dejó pasar. El PIN no reemplaza la contraseña: no abre sesión desde
-- otra compu y NUNCA da más permisos que la sesión. Lo que se puede hacer es
-- lo que pueden los dos a la vez (la sesión y quien puso el PIN); lo que queda
-- anotado es quien puso el PIN.
--
-- Cómo viaja: entrar_con_pin devuelve un token firmado por la base (válido 12
-- horas); el panel lo guarda en una cookie solo-servidor y lo manda en cada
-- llamada como encabezado "x-gymos-operador". exigir_rol y exigir_equipo lo
-- leen: sin encabezado, todo igual que antes; con uno vencido o de otro
-- gimnasio, error (nunca se anota a otro en silencio).
--   privado.pines_equipo (el hash del PIN, fuera de las tablas que se leen)
--   privado.secretos_operador, privado.intentos_pin (5 errores → 10 minutos)
--   guardar_mi_pin, entrar_con_pin, operador_actual
--   privado.exigir_rol (0006) y privado.exigir_equipo (0013): copias con el operador

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.cajas_olvidadas(uuid)') is null then raise exception 'Guarda: falta la migración 0070'; end if;
  if to_regprocedure('extensions.hmac(bytea, bytea, text)') is null then raise exception 'Guarda: falta pgcrypto (0048)'; end if;
end $$;

create table if not exists privado.pines_equipo (
  equipo_id    uuid primary key references public.equipo(id) on delete cascade,
  gimnasio_id  uuid not null references public.gimnasios(id),
  pin_hash     text not null,
  cambiado_en  timestamptz not null default now()
);
create table if not exists privado.secretos_operador (
  gimnasio_id  uuid primary key references public.gimnasios(id),
  secreto      bytea not null default extensions.gen_random_bytes(32)
);
create table if not exists privado.intentos_pin (
  id           bigint generated always as identity primary key,
  gimnasio_id  uuid not null references public.gimnasios(id),
  usuario_id   uuid not null,
  ok           boolean not null,
  en           timestamptz not null default now()
);
create index if not exists intentos_pin_reciente on privado.intentos_pin (gimnasio_id, usuario_id, en desc);
revoke all on privado.pines_equipo, privado.secretos_operador, privado.intentos_pin from public, anon, authenticated;

create or replace function privado.firma_operador(p_gimnasio_id uuid, p_texto text) returns text
language sql stable set search_path = '' as $$
  select encode(extensions.hmac(convert_to(p_texto, 'UTF8'), s.secreto, 'sha256'), 'hex')
    from privado.secretos_operador s where s.gimnasio_id = p_gimnasio_id
$$;
revoke all on function privado.firma_operador(uuid, text) from public;

-- Quién opera (el del PIN) en este gimnasio, o null si no hay encabezado.
create or replace function privado.operador(p_gimnasio_id uuid) returns public.equipo
language plpgsql stable set search_path = '' as $$
declare token text; partes text[]; e public.equipo;
begin
  begin
    token := nullif(current_setting('request.headers', true), '')::json ->> 'x-gymos-operador';
  exception when others then token := null;
  end;
  if token is null or token = '' then return null; end if;
  partes := string_to_array(token, '.');
  if cardinality(partes) <> 3 or partes[1] !~ '^[0-9a-f-]{36}$' or partes[2] !~ '^[0-9]{1,12}$' then
    raise exception 'El PIN de la recepción no es válido: volvé a ponerlo' using errcode = '42501';
  end if;
  select * into e from public.equipo where id = partes[1]::uuid;
  if not found or e.gimnasio_id <> p_gimnasio_id then
    raise exception 'El PIN puesto es de otro gimnasio: volvé a ponerlo' using errcode = '42501';
  end if;
  if privado.firma_operador(p_gimnasio_id, partes[1] || '.' || partes[2]) is distinct from partes[3] then
    raise exception 'El PIN de la recepción no es válido: volvé a ponerlo' using errcode = '42501';
  end if;
  if partes[2]::bigint < extract(epoch from now()) then
    raise exception 'Pasaron 12 horas desde que pusiste el PIN: volvé a ponerlo' using errcode = '42501';
  end if;
  if not e.activo then raise exception '% ya no está en el equipo: que ponga su PIN otra persona', e.nombre using errcode = '42501'; end if;
  return e;
end $$;
revoke all on function privado.operador(uuid) from public;

-- ── Permisos: copias con el operador ────────────────────────────────
create or replace function privado.exigir_rol(p_gimnasio_id uuid, p_roles text[], p_sede_id uuid default null) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare eid uuid; op public.equipo;
begin
  select e.id into eid from public.equipo e
   where e.gimnasio_id = p_gimnasio_id and e.usuario_id = auth.uid() and e.activo and e.rol = any (p_roles)
     and (e.sede_id is null or p_sede_id is null or e.sede_id = p_sede_id);
  if eid is null then
    raise exception 'Sin permiso para esta acción en este gimnasio' using errcode = '42501';
  end if;
  -- CAJ-3: con PIN puesto, tiene que poder también quien opera, y queda anotado él.
  op := privado.operador(p_gimnasio_id);
  if op.id is not null then
    if not (op.rol = any (p_roles)) or (op.sede_id is not null and p_sede_id is not null and op.sede_id <> p_sede_id) then
      raise exception 'Sin permiso: % (puso su PIN) no puede hacer esto', op.nombre using errcode = '42501';
    end if;
    return op.id;
  end if;
  return eid;
end $$;
revoke all on function privado.exigir_rol(uuid, text[], uuid) from public;

create or replace function privado.exigir_equipo(p_gimnasio_id uuid, p_roles text[] default array['dueno', 'encargado', 'recepcion', 'profe'])
returns public.equipo
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; op public.equipo;
begin
  select * into e from public.equipo
   where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and activo and rol = any (p_roles);
  if not found then
    raise exception 'Sin permiso para esta acción en este gimnasio' using errcode = '42501';
  end if;
  -- CAJ-3: con PIN puesto, tiene que poder también quien opera, y queda anotado él.
  op := privado.operador(p_gimnasio_id);
  if op.id is not null then
    if not (op.rol = any (p_roles)) then raise exception 'Sin permiso: % (puso su PIN) no puede hacer esto', op.nombre using errcode = '42501'; end if;
    return op;
  end if;
  return e;
end $$;
revoke all on function privado.exigir_equipo(uuid, text[]) from public;

-- ── PIN ─────────────────────────────────────────────────────────────
-- Cada uno pone el suyo (con su sesión, no con un PIN puesto). Distinto al de los demás del gimnasio.
create or replace function public.guardar_mi_pin(p_gimnasio_id uuid, p_pin text) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.equipo;
begin
  select * into e from public.equipo where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and activo;
  if not found then raise exception 'Sin permiso para esta acción en este gimnasio' using errcode = '42501'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then raise exception 'El PIN son 4 números' using errcode = '22023'; end if;
  if p_pin in ('0000', '1111', '1234', '4321', '2222', '9999') then raise exception 'Ese PIN es muy fácil de adivinar: elegí otro' using errcode = '22023'; end if;
  if exists (select 1 from privado.pines_equipo pe join public.equipo q on q.id = pe.equipo_id
              where pe.gimnasio_id = p_gimnasio_id and pe.equipo_id <> e.id and q.activo and pe.pin_hash = extensions.crypt(p_pin, pe.pin_hash)) then
    raise exception 'Ese PIN ya lo usa otra persona del equipo: elegí otro' using errcode = '22023';
  end if;
  insert into privado.secretos_operador (gimnasio_id) values (p_gimnasio_id) on conflict do nothing;
  insert into privado.pines_equipo (equipo_id, gimnasio_id, pin_hash) values (e.id, p_gimnasio_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)))
  on conflict (equipo_id) do update set pin_hash = excluded.pin_hash, cambiado_en = now();
end $$;

-- Desde una sesión del gimnasio: quién es por su PIN y el token para las próximas 12 horas.
-- Equivocado: { error, quedan } (sin error de la base, para que el intento quede anotado).
create or replace function public.entrar_con_pin(p_gimnasio_id uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare sesion public.equipo; e public.equipo; fallos int; vence bigint;
begin
  select * into sesion from public.equipo where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and activo;
  if not found then raise exception 'Sin permiso para esta acción en este gimnasio' using errcode = '42501'; end if;
  select count(*) into fallos from privado.intentos_pin
   where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and not ok and en > now() - interval '10 minutes';
  if fallos >= 5 then raise exception 'Demasiados PIN equivocados: esperá 10 minutos' using errcode = '42501'; end if;
  select q.* into e from privado.pines_equipo pe join public.equipo q on q.id = pe.equipo_id
   where pe.gimnasio_id = p_gimnasio_id and q.activo and pe.pin_hash = extensions.crypt(coalesce(p_pin, ''), pe.pin_hash) limit 1;
  insert into privado.intentos_pin (gimnasio_id, usuario_id, ok) values (p_gimnasio_id, auth.uid(), e.id is not null);
  -- Un PIN equivocado no es un error de la base: si lo fuera, se desharía el intento anotado y nunca se bloquearía.
  if e.id is null then return jsonb_build_object('error', 'PIN equivocado', 'quedan', greatest(4 - fallos, 0)); end if;
  vence := extract(epoch from now() + interval '12 hours')::bigint;
  return jsonb_build_object('token', e.id::text || '.' || vence || '.' || privado.firma_operador(p_gimnasio_id, e.id::text || '.' || vence),
                            'nombre', e.nombre, 'rol', e.rol, 'vence', to_timestamp(vence));
end $$;

-- Para la pantalla: quién opera ahora (o null), y si tengo PIN cargado.
create or replace function public.operador_actual(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare sesion public.equipo; op public.equipo;
begin
  select * into sesion from public.equipo where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and activo;
  if not found then raise exception 'Sin permiso para esta acción en este gimnasio' using errcode = '42501'; end if;
  op := privado.operador(p_gimnasio_id);
  return jsonb_build_object('nombre', op.nombre, 'rol', op.rol,
    'tengo_pin', exists (select 1 from privado.pines_equipo pe where pe.equipo_id = sesion.id),
    'hay_pines', exists (select 1 from privado.pines_equipo pe join public.equipo q on q.id = pe.equipo_id where pe.gimnasio_id = p_gimnasio_id and q.activo));
end $$;

revoke all on function public.guardar_mi_pin(uuid, text), public.entrar_con_pin(uuid, text), public.operador_actual(uuid) from public, anon, authenticated;
grant execute on function public.guardar_mi_pin(uuid, text), public.entrar_con_pin(uuid, text), public.operador_actual(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.guardar_mi_pin(uuid, text)', 'public.entrar_con_pin(uuid, text)', 'public.operador_actual(uuid)',
                           'privado.exigir_rol(uuid, text[], uuid)', 'privado.exigir_equipo(uuid, text[])', 'privado.operador(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if has_table_privilege('authenticated', 'privado.pines_equipo', 'select') then raise exception 'Verificación: los PIN se pueden leer'; end if;
  if position('privado.operador' in pg_get_functiondef('privado.exigir_rol(uuid, text[], uuid)'::regprocedure)) = 0 then
    raise exception 'Verificación: exigir_rol no mira el PIN';
  end if;
end $$;
