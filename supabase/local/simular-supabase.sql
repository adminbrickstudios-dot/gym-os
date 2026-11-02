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
