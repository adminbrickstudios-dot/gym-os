-- ═══════════════════════════════════════════════════════════════════
-- SOLO PARA LA BASE LOCAL DE PRUEBAS. NUNCA se aplica en Supabase.
-- Reproduce lo que Supabase ya trae: roles, esquema auth, auth.uid(),
-- auth.role(), esquema extensions y los permisos por defecto.
-- ═══════════════════════════════════════════════════════════════════

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create schema if not exists extensions;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  created_at timestamptz not null default now()
);
-- Columnas que usa supabase-local (scripts/local): mismos nombres que en Supabase.
alter table auth.users add column if not exists encrypted_password text;
alter table auth.users add column if not exists email_confirmed_at timestamptz;
alter table auth.users add column if not exists phone_confirmed_at timestamptz;
alter table auth.users add column if not exists last_sign_in_at timestamptz;
alter table auth.users add column if not exists raw_app_meta_data jsonb not null default '{}'::jsonb;
alter table auth.users add column if not exists raw_user_meta_data jsonb not null default '{}'::jsonb;
alter table auth.users add column if not exists updated_at timestamptz not null default now();
create unique index if not exists users_email_unico on auth.users (lower(email)) where email is not null;
create unique index if not exists users_phone_unico on auth.users (phone) where phone is not null;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', 'anon')
$$;

grant execute on function auth.jwt(), auth.uid(), auth.role() to anon, authenticated, service_role;

-- Supabase da por defecto todos los privilegios de tablas y funciones del
-- esquema public a estos roles; RLS y los REVOKE son los que protegen.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Vault (credenciales de pagos online, PAY-1). En Supabase lo trae la
-- extensión supabase_vault y el secreto se guarda CIFRADO. Acá, la misma
-- forma (create_secret, update_secret, decrypted_secrets) sin cifrar: SOLO pruebas.
create schema if not exists vault;
create table if not exists vault.secrets (
  id uuid primary key default gen_random_uuid(), name text unique, description text not null default '',
  secret text not null, key_id uuid, nonce bytea, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create or replace function vault.create_secret(new_secret text, new_name text default null, new_description text default '', new_key_id uuid default null)
returns uuid language sql as $$
  insert into vault.secrets (secret, name, description) values (new_secret, new_name, coalesce(new_description, '')) returning id
$$;
create or replace function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null, new_description text default null, new_key_id uuid default null)
returns void language sql as $$
  update vault.secrets set secret = coalesce(new_secret, secret), name = coalesce(new_name, name),
         description = coalesce(new_description, description), updated_at = now() where id = secret_id
$$;
create or replace view vault.decrypted_secrets as
  select id, name, description, secret, secret as decrypted_secret, key_id, nonce, created_at, updated_at from vault.secrets;
revoke all on schema vault from anon, authenticated;
revoke all on all tables in schema vault from anon, authenticated;

-- VD-33b: sesiones de auth (en Supabase las lleva GoTrue; acá las anota supabase-local).
create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  not_after timestamptz,
  user_agent text,
  ip inet
);

-- VD-42: factores de verificación en dos pasos (en Supabase los lleva GoTrue; acá solo la forma que lee la base).
create table if not exists auth.mfa_factors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  friendly_name text,
  factor_type text not null default 'totp',
  status text not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
