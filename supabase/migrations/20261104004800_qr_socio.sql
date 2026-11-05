-- 0048 · QR del socio, rotativo y firmado (ENT-2).
-- La app del socio muestra un código que cambia cada 30 segundos:
--   GYMOS1.<socio_id>.<ventana>.<firma>
-- ventana = segundos desde 1970 / 30; firma = HMAC-SHA256 con un secreto por
-- socio que nunca sale de la base. La recepción (cámara o lector) lo pasa a
-- leer_qr: vale la ventana actual y la anterior (un minuto como mucho), una
-- sola vez, y solo en su gimnasio. leer_qr solo dice quién es: si puede
-- entrar lo sigue diciendo estado_acceso (nada se calcula afuera).
-- Solo si el gimnasio prendió la forma de entrada "qr_socio".

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.celular_aviso(text, text, date, date)') is null then raise exception 'Guarda: falta la migración 0047'; end if;
end $$;

create extension if not exists pgcrypto with schema extensions;

-- El secreto de cada socio. Vive en privado (no se expone ni se mueve al unir
-- socios: si se va un duplicado, su secreto se borra con él). RLS sin políticas.
create table if not exists privado.credenciales_qr (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  socio_id     uuid not null,
  secreto      bytea not null default extensions.gen_random_bytes(32),
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, socio_id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id) on delete cascade
);
alter table privado.credenciales_qr enable row level security;
revoke all on table privado.credenciales_qr from public, anon, authenticated;

-- Cada código se usa una vez.
create table if not exists privado.usos_qr (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  socio_id     uuid not null,
  ventana      bigint not null,
  usado_en     timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, socio_id, ventana),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id) on delete cascade
);
alter table privado.usos_qr enable row level security;
revoke all on table privado.usos_qr from public, anon, authenticated;

create or replace function privado.firma_qr(p_secreto bytea, p_socio_id uuid, p_ventana bigint) returns text
language sql immutable set search_path = '' as $$
  select substr(encode(extensions.hmac(convert_to(p_socio_id::text || ':' || p_ventana::text, 'UTF8'), p_secreto, 'sha256'), 'hex'), 1, 24)
$$;
revoke all on function privado.firma_qr(bytea, uuid, bigint) from public, anon, authenticated;

create or replace function privado.ventana_qr(p_momento timestamptz) returns bigint
language sql immutable set search_path = '' as $$
  select floor(extract(epoch from p_momento) / 30)::bigint
$$;
revoke all on function privado.ventana_qr(timestamptz) from public, anon, authenticated;

-- ── Las formas de entrada prendidas (para mostrar o no la cámara) ────
create or replace function public.formas_de_entrada(p_gimnasio_id uuid) returns text[]
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return (select c.accesos_activos from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id);
end $$;

-- ── El código, para la app del socio ────────────────────────────────
create or replace function public.mi_qr(p_gimnasio_id uuid, p_socio_id uuid, p_momento timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.socios; sec bytea; v bigint;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  select * into s from public.socios where id = p_socio_id and gimnasio_id = p_gimnasio_id and usuario_id = auth.uid();
  if s.id is null then raise exception 'Sin permiso para ver ese socio' using errcode = '42501'; end if;
  if s.dado_de_baja_en is not null then raise exception 'Estás dado de baja en este gimnasio.'; end if;
  if not exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id and 'qr_socio' = any (c.accesos_activos)) then
    raise exception 'Este gimnasio no usa QR para entrar.' using errcode = '22023';
  end if;
  insert into privado.credenciales_qr (gimnasio_id, socio_id) values (p_gimnasio_id, s.id) on conflict (gimnasio_id, socio_id) do nothing;
  select c.secreto into sec from privado.credenciales_qr c where c.gimnasio_id = p_gimnasio_id and c.socio_id = s.id;
  v := privado.ventana_qr(p_momento);
  return jsonb_build_object('codigo', 'GYMOS1.' || s.id || '.' || v || '.' || privado.firma_qr(sec, s.id, v),
                            'vence_en', to_timestamp((v + 1) * 30));
end $$;

-- ── Leerlo en la recepción ──────────────────────────────────────────
create or replace function public.leer_qr(p_gimnasio_id uuid, p_codigo text, p_momento timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m text[]; sid uuid; v bigint; actual bigint; s public.socios; sec bytea; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if not exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id and 'qr_socio' = any (c.accesos_activos)) then
    raise exception 'Este gimnasio no tiene prendida la entrada con QR (Configuración → Reglas).' using errcode = '22023';
  end if;
  m := regexp_match(trim(coalesce(p_codigo, '')), '^GYMOS1\.([0-9a-f-]{36})\.([0-9]{1,12})\.([0-9a-f]{24})$');
  if m is null then raise exception 'Ese código no es un QR de socio.' using errcode = '22023'; end if;
  sid := m[1]::uuid; v := m[2]::bigint;
  select * into s from public.socios where id = sid and gimnasio_id = p_gimnasio_id;
  if s.id is null then raise exception 'Ese QR es de otro gimnasio.' using errcode = '22023'; end if;
  if s.dado_de_baja_en is not null then raise exception '% está dado de baja.', trim(s.nombre || ' ' || s.apellido) using errcode = '22023'; end if;
  actual := privado.ventana_qr(p_momento);
  if v not in (actual, actual - 1) then
    raise exception 'El QR venció: que lo abra de nuevo en la app (cambia cada 30 segundos).' using errcode = '22023';
  end if;
  select c.secreto into sec from privado.credenciales_qr c where c.gimnasio_id = p_gimnasio_id and c.socio_id = sid;
  if sec is null or privado.firma_qr(sec, sid, v) <> m[3] then raise exception 'El QR no es válido.' using errcode = '22023'; end if;
  insert into privado.usos_qr (gimnasio_id, socio_id, ventana) values (p_gimnasio_id, sid, v) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Ese QR ya se usó: que lo actualice en la app.' using errcode = '22023'; end if;
  return jsonb_build_object('socio_id', s.id, 'nombre', trim(s.nombre || ' ' || s.apellido), 'numero', s.numero);
end $$;

revoke all on function public.formas_de_entrada(uuid), public.mi_qr(uuid, uuid, timestamptz), public.leer_qr(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.formas_de_entrada(uuid), public.mi_qr(uuid, uuid, timestamptz), public.leer_qr(uuid, text, timestamptz)
  to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  if not (select relrowsecurity from pg_class where oid = 'privado.credenciales_qr'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'privado.usos_qr'::regclass) then
    raise exception 'Verificación: tablas del QR sin RLS';
  end if;
  if has_table_privilege('authenticated', 'privado.credenciales_qr', 'select') or has_table_privilege('anon', 'privado.credenciales_qr', 'select') then raise exception 'Verificación: el secreto del QR se puede leer'; end if;
  if privado.firma_qr('\x00'::bytea, '00000000-0000-0000-0000-000000000000', 1) !~ '^[0-9a-f]{24}$' then raise exception 'Verificación: la firma no tiene 24 letras'; end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'public' and p.proname in ('formas_de_entrada', 'mi_qr', 'leer_qr'))
               or (s.nspname = 'privado' and p.proname in ('firma_qr', 'ventana_qr')) loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
end $$;
