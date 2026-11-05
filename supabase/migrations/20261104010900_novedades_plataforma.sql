-- 0109 · Novedades de Gym OS para todos los dueños (ADM-6).
-- BRIK escribe una novedad ("Ya podés cobrar con MercadoPago") y aparece en
-- el Inicio de todos los dueños hasta que cada uno la cierra o BRIK la retira.
-- novedades_plataforma no tiene gimnasio_id (es de la plataforma: va a la
-- lista de excepciones); lo que cierra cada dueño sí lo tiene.
--   admin_novedades() · admin_publicar_novedad(titulo, texto, link) · admin_retirar_novedad(id)
--   novedades_dueno(gimnasio) · cerrar_novedad_plataforma(gimnasio, id)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.admin_salud_gimnasios()') is null then raise exception 'Guarda: falta la migración 0108'; end if;
end $$;

create table if not exists public.novedades_plataforma (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null check (length(trim(titulo)) between 3 and 80),
  texto        text not null check (length(trim(texto)) between 3 and 400),
  link         text check (link is null or (link ~ '^https://\S+$' and length(link) <= 300)),
  creado_por   uuid not null references auth.users(id),
  creado_en    timestamptz not null default now(),
  retirada_en  timestamptz
);
alter table public.novedades_plataforma enable row level security;
revoke all on table public.novedades_plataforma from anon, authenticated;

create table if not exists public.novedades_plataforma_cerradas (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  equipo_id    uuid not null,
  novedad_id   uuid not null references public.novedades_plataforma(id),
  cerrada_en   timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, equipo_id, novedad_id),
  foreign key (gimnasio_id, equipo_id) references public.equipo (gimnasio_id, id)
);
select privado.politicas_estandar('public.novedades_plataforma_cerradas', array['dueno'], null, false);
revoke all on table public.novedades_plataforma_cerradas from anon;
revoke truncate, references, trigger on public.novedades_plataforma_cerradas from authenticated;

create or replace function public.admin_novedades() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'titulo', n.titulo, 'texto', n.texto, 'link', n.link, 'creado_en', n.creado_en,
            'cerraron', (select count(*) from public.novedades_plataforma_cerradas c where c.novedad_id = n.id)) order by n.creado_en desc)
    from public.novedades_plataforma n where n.retirada_en is null), '[]'::jsonb);
end $$;

create or replace function public.admin_publicar_novedad(p_titulo text, p_texto text, p_link text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare t text := trim(coalesce(p_titulo, '')); x text := trim(coalesce(p_texto, '')); l text := nullif(trim(coalesce(p_link, '')), ''); nid uuid;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if length(t) not between 3 and 80 then raise exception 'El título: de 3 a 80 letras' using errcode = '22023'; end if;
  if length(x) not between 3 and 400 then raise exception 'El texto: de 3 a 400 letras' using errcode = '22023'; end if;
  if l is not null and (l !~ '^https://\S+$' or length(l) > 300) then raise exception 'El link tiene que empezar con https://' using errcode = '22023'; end if;
  insert into public.novedades_plataforma (titulo, texto, link, creado_por) values (t, x, l, auth.uid()) returning id into nid;
  return nid;
end $$;

create or replace function public.admin_retirar_novedad(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  update public.novedades_plataforma set retirada_en = now() where id = p_id and retirada_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Esa novedad ya estaba retirada' using errcode = '22023'; end if;
end $$;

create or replace function public.novedades_dueno(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'titulo', n.titulo, 'texto', n.texto, 'link', n.link) order by n.creado_en desc)
    from public.novedades_plataforma n
   where n.retirada_en is null
     and not exists (select 1 from public.novedades_plataforma_cerradas c where c.novedad_id = n.id and c.gimnasio_id = p_gimnasio_id and c.equipo_id = e.id)), '[]'::jsonb);
end $$;

create or replace function public.cerrar_novedad_plataforma(p_gimnasio_id uuid, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if not exists (select 1 from public.novedades_plataforma where id = p_id) then raise exception 'Novedad inexistente' using errcode = 'P0002'; end if;
  insert into public.novedades_plataforma_cerradas (gimnasio_id, equipo_id, novedad_id) values (p_gimnasio_id, e.id, p_id)
  on conflict (gimnasio_id, equipo_id, novedad_id) do nothing;
end $$;

revoke all on function public.admin_novedades(), public.admin_publicar_novedad(text, text, text), public.admin_retirar_novedad(uuid),
  public.novedades_dueno(uuid), public.cerrar_novedad_plataforma(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_novedades(), public.admin_publicar_novedad(text, text, text), public.admin_retirar_novedad(uuid),
  public.novedades_dueno(uuid), public.cerrar_novedad_plataforma(uuid, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.novedades_plataforma'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.novedades_plataforma_cerradas'::regclass) then
    raise exception 'Verificación: novedades de la plataforma sin RLS';
  end if;
  foreach f in array array['public.admin_novedades()', 'public.admin_publicar_novedad(text, text, text)', 'public.admin_retirar_novedad(uuid)',
                           'public.novedades_dueno(uuid)', 'public.cerrar_novedad_plataforma(uuid, uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
