-- ═══════════════════════════════════════════════════════════════════
-- 0001 · Base: extensiones, esquema privado, gimnasios, sedes,
-- dominios, configuración, equipo y helpers de RLS.
-- Sin begin/commit: el aplicador abre la transacción.
-- ═══════════════════════════════════════════════════════════════════

-- ── Guarda de entrada ──────────────────────────────────────────────
do $$
begin
  if to_regprocedure('auth.uid()') is null then
    raise exception 'Guarda: falta auth.uid(). ¿Es una base de Supabase (o la simulación local)?';
  end if;
  if not exists (select 1 from pg_roles where rolname in ('anon','authenticated','service_role') having count(*) = 3) then
    raise exception 'Guarda: faltan los roles anon / authenticated / service_role';
  end if;
end $$;

create schema if not exists extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Esquema privado: helpers que no se exponen por la API.
create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated, service_role;

-- ── Helpers puros ──────────────────────────────────────────────────
create or replace function privado.sin_acentos(p text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, '')))
$$;

create or replace function privado.dia_local(p_momento timestamptz, p_zona text) returns date
language sql stable parallel safe set search_path = '' as $$
  select (p_momento at time zone p_zona)::date
$$;

create or replace function privado.medianoche(p_dia date, p_zona text) returns timestamptz
language sql stable parallel safe set search_path = '' as $$
  select (p_dia::timestamp) at time zone p_zona
$$;

-- 14/11 para un "hasta" exclusivo del 15/11 00:00
create or replace function privado.fecha_corta(p_momento timestamptz, p_zona text) returns text
language sql stable parallel safe set search_path = '' as $$
  select to_char(p_momento at time zone p_zona, 'DD/MM')
$$;

create or replace function privado.ultimo_dia(p_hasta timestamptz, p_zona text) returns text
language sql stable parallel safe set search_path = '' as $$
  select to_char((p_hasta - interval '1 microsecond') at time zone p_zona, 'DD/MM')
$$;

-- $84.500 · $84.500,50 (independiente del locale del servidor)
create or replace function privado.formato_pesos(p numeric) returns text
language sql immutable parallel safe set search_path = '' as $$
  select case when p < 0 then '-' else '' end || '$'
      || replace(to_char(trunc(abs(p)), 'FM999,999,999,990'), ',', '.')
      || case when abs(p) <> trunc(abs(p))
              then ',' || lpad(((abs(p) - trunc(abs(p))) * 100)::int::text, 2, '0')
              else '' end
$$;

revoke all on function privado.sin_acentos(text), privado.dia_local(timestamptz, text),
  privado.medianoche(date, text), privado.fecha_corta(timestamptz, text),
  privado.ultimo_dia(timestamptz, text), privado.formato_pesos(numeric) from public;
grant execute on function privado.sin_acentos(text) to authenticated, service_role;

-- ── Gimnasios ──────────────────────────────────────────────────────
create table if not exists public.gimnasios (
  id                        uuid primary key default gen_random_uuid(),
  slug                      text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,40}[a-z0-9])?$'),
  nombre                    text not null check (length(trim(nombre)) > 0),
  zona_horaria              text not null default 'America/Argentina/Buenos_Aires',
  moneda                    char(3) not null default 'ARS',
  es_demo                   boolean not null default false,
  suspension_manual_motivo  text,
  suspension_manual_en      timestamptz,
  creado_en                 timestamptz not null default now(),
  check ((suspension_manual_en is null) = (suspension_manual_motivo is null))
);
alter table public.gimnasios enable row level security;

create or replace function privado.validar_zona_horaria() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.zona_horaria) then
    raise exception 'Zona horaria desconocida: %', new.zona_horaria;
  end if;
  return new;
end $$;
revoke all on function privado.validar_zona_horaria() from public;

drop trigger if exists gimnasios_validar_zona on public.gimnasios;
create trigger gimnasios_validar_zona before insert or update of zona_horaria on public.gimnasios
  for each row execute function privado.validar_zona_horaria();

-- ── Sedes ──────────────────────────────────────────────────────────
-- Todo gimnasio tiene al menos una. Con una sola, la palabra "sede" no
-- aparece en ninguna pantalla.
create table if not exists public.sedes (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  nombre        text not null check (length(trim(nombre)) > 0),
  direccion     text,
  es_principal  boolean not null default false,
  activa        boolean not null default true,
  creado_en     timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, nombre)
);
create unique index if not exists sedes_una_principal on public.sedes (gimnasio_id) where es_principal;
alter table public.sedes enable row level security;

-- ── Dominios ───────────────────────────────────────────────────────
create table if not exists public.dominios_gimnasio (
  id                 uuid primary key default gen_random_uuid(),
  gimnasio_id        uuid not null references public.gimnasios(id),
  host               text not null unique check (host = lower(host) and host !~ '[/:\s]'),
  tipo               text not null check (tipo in ('subdominio', 'propio')),
  verificado_en      timestamptz,
  vercel_dominio_id  text,
  creado_en          timestamptz not null default now(),
  unique (gimnasio_id, id)
);
alter table public.dominios_gimnasio enable row level security;

-- ── Configuración (1:1) ────────────────────────────────────────────
create table if not exists public.configuracion_gimnasio (
  gimnasio_id                    uuid primary key references public.gimnasios(id),
  cobra_membresia                boolean not null default true,
  cobra_pase                     boolean not null default true,
  cobra_pack                     boolean not null default false,
  modo_clases                    text not null default 'ninguno' check (modo_clases in ('reserva', 'sin_reserva', 'ninguno')),
  accesos_activos                text[] not null default array['recepcion']
                                   check (accesos_activos <@ array['recepcion','qr_socio','qr_pared','kiosco','nfc','molinete']),
  tolerancia_dias                int not null default 5 check (tolerancia_dias between 0 and 60),
  dias_aviso                     int not null default 3 check (dias_aviso between 0 and 30),
  reingreso_mismo_dia_consume    boolean not null default false,
  avisar_sin_bloquear_hasta      timestamptz,
  logo_path                      text,
  favicon_path                   text,
  color_acento                   text not null default '#16a34a' check (color_acento ~ '^#[0-9a-fA-F]{6}$'),
  color_fondo                    text not null default '#faf7f0' check (color_fondo ~ '^#[0-9a-fA-F]{6}$'),
  secciones_apagadas             text[] not null default '{}',
  alias_transferencia            text,
  cbu                            text check (cbu is null or cbu ~ '^[0-9]{22}$'),
  titular_cuenta                 text,
  onboarding_salteado_en         timestamptz,
  ultimo_numero_socio            int not null default 0,
  actualizado_en                 timestamptz not null default now()
);
alter table public.configuracion_gimnasio enable row level security;

-- Al dar de alta un gimnasio nacen su configuración y su sede principal.
create or replace function privado.al_crear_gimnasio() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.configuracion_gimnasio (gimnasio_id) values (new.id) on conflict do nothing;
  insert into public.sedes (gimnasio_id, nombre, es_principal) values (new.id, 'Sede principal', true)
    on conflict do nothing;
  return new;
end $$;
revoke all on function privado.al_crear_gimnasio() from public;

drop trigger if exists gimnasios_al_crear on public.gimnasios;
create trigger gimnasios_al_crear after insert on public.gimnasios
  for each row execute function privado.al_crear_gimnasio();

-- ── Administradores de plataforma (BRIK) ───────────────────────────
create table if not exists public.administradores_plataforma (
  usuario_id  uuid primary key references auth.users(id),
  creado_en   timestamptz not null default now()
);
alter table public.administradores_plataforma enable row level security;

-- ── Equipo ─────────────────────────────────────────────────────────
-- usuario_id null = el profe figura en la grilla pero no usa el sistema.
create table if not exists public.equipo (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  usuario_id   uuid references auth.users(id),
  sede_id      uuid,                       -- null = todas las sedes
  nombre       text not null check (length(trim(nombre)) > 0),
  rol          text not null check (rol in ('dueno', 'encargado', 'recepcion', 'profe')),
  pin_hash     text,                       -- PIN de 4 a 6 dígitos para la PC compartida
  activo       boolean not null default true,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id)
);
create unique index if not exists equipo_usuario_por_gimnasio on public.equipo (gimnasio_id, usuario_id) where usuario_id is not null;
create index if not exists equipo_usuario on public.equipo (usuario_id) where usuario_id is not null;
alter table public.equipo enable row level security;

-- ── Helpers de RLS ─────────────────────────────────────────────────
create or replace function privado.mis_gimnasios(p_roles text[] default null) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select e.gimnasio_id from public.equipo e
   where e.usuario_id = auth.uid() and e.activo
     and (p_roles is null or e.rol = any (p_roles))
$$;

create or replace function privado.mi_equipo_id(p_gimnasio_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select e.id from public.equipo e
   where e.usuario_id = auth.uid() and e.activo and e.gimnasio_id = p_gimnasio_id
$$;

create or replace function privado.soy_admin_plataforma() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.administradores_plataforma a where a.usuario_id = auth.uid())
$$;

create or replace function privado.es_servicio() returns boolean
language sql stable set search_path = '' as $$
  select auth.role() = 'service_role'
$$;

revoke all on function privado.mis_gimnasios(text[]), privado.mi_equipo_id(uuid),
  privado.soy_admin_plataforma(), privado.es_servicio() from public;
grant execute on function privado.mis_gimnasios(text[]), privado.mi_equipo_id(uuid),
  privado.soy_admin_plataforma(), privado.es_servicio() to authenticated, service_role;

-- Políticas estándar de una tabla con gimnasio_id. Idempotente.
--   p_lectura   roles del equipo que leen      (null = cualquier rol)
--   p_escritura roles que insertan y actualizan (vacío = nadie: solo por RPC)
--   p_socio     si el socio lee sus propias filas por socio_id
-- Sin política de DELETE: los hechos no se borran, se anulan.
create or replace function privado.politicas_estandar(
  p_tabla regclass, p_lectura text[], p_escritura text[], p_socio boolean default false
) returns void
language plpgsql set search_path = '' as $$
declare
  t text := p_tabla::text;
  lect text := case when p_lectura is null then 'null' else quote_literal(p_lectura::text) || '::text[]' end;
  escr text := quote_literal(coalesce(p_escritura, '{}')::text) || '::text[]';
begin
  execute format('alter table %s enable row level security', t);
  execute format('drop policy if exists equipo_lee on %s', t);
  execute format('create policy equipo_lee on %s for select to authenticated using (gimnasio_id in (select privado.mis_gimnasios(%s)) or privado.soy_admin_plataforma())', t, lect);
  execute format('drop policy if exists equipo_inserta on %s', t);
  execute format('drop policy if exists equipo_actualiza on %s', t);
  if cardinality(coalesce(p_escritura, '{}')) > 0 then
    execute format('create policy equipo_inserta on %s for insert to authenticated with check (gimnasio_id in (select privado.mis_gimnasios(%s)))', t, escr);
    execute format('create policy equipo_actualiza on %s for update to authenticated using (gimnasio_id in (select privado.mis_gimnasios(%s))) with check (gimnasio_id in (select privado.mis_gimnasios(%s)))', t, escr, escr);
  end if;
  execute format('drop policy if exists socio_lee on %s', t);
  if p_socio then
    execute format('create policy socio_lee on %s for select to authenticated using (socio_id in (select privado.mis_socios()))', t);
  end if;
end $$;
revoke all on function privado.politicas_estandar(regclass, text[], text[], boolean) from public;

-- mis_socios se define en 0002 (necesita la tabla socios); acá una
-- versión vacía para que las políticas de esta migración compilen.
create or replace function privado.mis_socios() returns setof uuid
language sql stable security definer set search_path = '' as $$ select null::uuid where false $$;
revoke all on function privado.mis_socios() from public;
grant execute on function privado.mis_socios() to authenticated, service_role;

-- ── Políticas de esta migración ────────────────────────────────────
drop policy if exists equipo_lee on public.gimnasios;
create policy equipo_lee on public.gimnasios for select to authenticated
  using (id in (select privado.mis_gimnasios()) or privado.soy_admin_plataforma());
drop policy if exists admin_escribe on public.gimnasios;
create policy admin_escribe on public.gimnasios for all to authenticated
  using (privado.soy_admin_plataforma()) with check (privado.soy_admin_plataforma());

select privado.politicas_estandar('public.sedes', null, array['dueno']);
select privado.politicas_estandar('public.dominios_gimnasio', array['dueno','encargado'], '{}');
select privado.politicas_estandar('public.configuracion_gimnasio', null, array['dueno','encargado']);
select privado.politicas_estandar('public.equipo', null, array['dueno']);

drop policy if exists se_lee_a_si_mismo on public.administradores_plataforma;
create policy se_lee_a_si_mismo on public.administradores_plataforma for select to authenticated
  using (usuario_id = auth.uid());

-- ── Marca pública por host (la usa el servidor antes del login) ────
create or replace function public.gimnasio_por_host(p_host text)
returns table (gimnasio_id uuid, slug text, nombre text, zona_horaria text,
               logo_path text, favicon_path text, color_acento text, color_fondo text)
language sql stable security definer set search_path = '' as $$
  select g.id, g.slug, g.nombre, g.zona_horaria, c.logo_path, c.favicon_path, c.color_acento, c.color_fondo
    from public.dominios_gimnasio d
    join public.gimnasios g on g.id = d.gimnasio_id
    join public.configuracion_gimnasio c on c.gimnasio_id = g.id
   where d.host = lower(p_host)
$$;
revoke all on function public.gimnasio_por_host(text) from public, anon, authenticated;
grant execute on function public.gimnasio_por_host(text) to anon, authenticated, service_role;

-- ── Verificación final ─────────────────────────────────────────────
do $$
declare faltan text;
begin
  select string_agg(c.relname, ', ') into faltan
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname in ('gimnasios','sedes','dominios_gimnasio','configuracion_gimnasio','administradores_plataforma','equipo')
     and not c.relrowsecurity;
  if faltan is not null then raise exception 'Verificación: tablas sin RLS: %', faltan; end if;
end $$;
