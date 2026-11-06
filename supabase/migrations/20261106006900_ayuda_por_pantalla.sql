-- VD-31 · Ayuda y onboarding por pantalla.
--
-- Un globo corto la primera vez que cada persona abre cada pantalla importante. El "ya lo vio" vive en la
-- base, por usuario (sigue entre dispositivos); la persona también puede apagar todas las ayudas.
--
--   public.ayudas_usuario     (usuario_id, clave, visto_en). La clave '_apagadas' guarda la preferencia
--                             "no mostrarme ayudas". Es del usuario, no de un gimnasio: la persona que
--                             trabaja en dos gimnasios no vuelve a ver el mismo globo (excepción a gimnasio_id).
--   ayudas_vistas()           {vistas: [claves], apagadas: boolean} de quien pregunta
--   marcar_ayuda(clave)       idempotente; devuelve true si era la primera vez
--   apagar_ayudas(apagar)     prende o apaga la preferencia
--   reiniciar_ayudas()        borra lo visto (vuelve a mostrar todo) y devuelve cuántas

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('auth.users') is null then raise exception 'VD-31: falta auth.users'; end if;
end $$;

create table if not exists public.ayudas_usuario (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  clave      text not null check (clave ~ '^_?[a-z0-9_.-]{1,60}$'),
  visto_en   timestamptz not null default now(),
  primary key (usuario_id, clave)
);
alter table public.ayudas_usuario enable row level security;
revoke all on table public.ayudas_usuario from anon, authenticated;
grant select on table public.ayudas_usuario to authenticated;

drop policy if exists ayudas_propias on public.ayudas_usuario;
create policy ayudas_propias on public.ayudas_usuario for select to authenticated
  using (usuario_id = (select auth.uid()));

-- ── Funciones ───────────────────────────────────────────────────────
create or replace function public.ayudas_vistas() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare yo uuid := auth.uid();
begin
  if yo is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  return jsonb_build_object(
    'vistas', coalesce((select jsonb_agg(a.clave order by a.clave) from public.ayudas_usuario a
                         where a.usuario_id = yo and a.clave not like '\_%'), '[]'::jsonb),
    'apagadas', exists (select 1 from public.ayudas_usuario a where a.usuario_id = yo and a.clave = '_apagadas'));
end $$;

create or replace function public.marcar_ayuda(p_clave text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare yo uuid := auth.uid(); filas int;
begin
  if yo is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  if p_clave is null or p_clave !~ '^[a-z0-9][a-z0-9_.-]{0,59}$' then
    raise exception 'La clave de la ayuda no es válida' using errcode = '22023';
  end if;
  insert into public.ayudas_usuario (usuario_id, clave) values (yo, p_clave) on conflict do nothing;
  get diagnostics filas = row_count;
  return filas > 0;
end $$;

create or replace function public.apagar_ayudas(p_apagar boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare yo uuid := auth.uid();
begin
  if yo is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  if p_apagar is null then raise exception 'Falta decir si se apagan o no' using errcode = '22023'; end if;
  if p_apagar then
    insert into public.ayudas_usuario (usuario_id, clave) values (yo, '_apagadas') on conflict do nothing;
  else
    delete from public.ayudas_usuario where usuario_id = yo and clave = '_apagadas';
  end if;
end $$;

create or replace function public.reiniciar_ayudas() returns int
language plpgsql security definer set search_path = '' as $$
declare yo uuid := auth.uid(); filas int;
begin
  if yo is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  delete from public.ayudas_usuario where usuario_id = yo and clave not like '\_%';
  get diagnostics filas = row_count;
  return filas;
end $$;

revoke execute on function public.ayudas_vistas() from public, anon;
revoke execute on function public.marcar_ayuda(text) from public, anon;
revoke execute on function public.apagar_ayudas(boolean) from public, anon;
revoke execute on function public.reiniciar_ayudas() from public, anon;
grant execute on function public.ayudas_vistas() to authenticated;
grant execute on function public.marcar_ayuda(text) to authenticated;
grant execute on function public.apagar_ayudas(boolean) to authenticated;
grant execute on function public.reiniciar_ayudas() to authenticated;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.ayudas_usuario'::regclass) then
    raise exception 'VD-31: ayudas_usuario sin RLS';
  end if;
  if has_table_privilege('authenticated', 'public.ayudas_usuario', 'insert')
     or has_table_privilege('authenticated', 'public.ayudas_usuario', 'update')
     or has_table_privilege('authenticated', 'public.ayudas_usuario', 'delete') then
    raise exception 'VD-31: authenticated escribe directo en ayudas_usuario';
  end if;
  if not has_function_privilege('authenticated', 'public.marcar_ayuda(text)', 'execute')
     or has_function_privilege('anon', 'public.marcar_ayuda(text)', 'execute')
     or has_function_privilege('anon', 'public.ayudas_vistas()', 'execute')
     or has_function_privilege('anon', 'public.apagar_ayudas(boolean)', 'execute')
     or has_function_privilege('anon', 'public.reiniciar_ayudas()', 'execute') then
    raise exception 'VD-31: permisos de las funciones de ayuda mal';
  end if;
end $$;
