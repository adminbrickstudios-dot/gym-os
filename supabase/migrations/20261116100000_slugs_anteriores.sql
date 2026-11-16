-- ═══════════════════════════════════════════════════════════════════
-- Mateo 16/11 · Cambiar el slug de un gimnasio no rompe un QR impreso.
--
-- Cada slug que un gimnasio dejó queda guardado: /g/<slug viejo>/… redirige para siempre a la dirección actual.
-- Aditiva: una tabla nueva y una función nueva; nada de lo que existe cambia (el código anterior no la conoce y sigue andando).
-- El historial lo mantiene un trigger sobre gimnasios.slug, así que cualquier camino que cambie el slug (admin_cambiar_slug incluido) lo respeta.
-- Un slug viejo no puede tomarlo otro gimnasio (un QR impreso nunca cae en un gimnasio ajeno).
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.gimnasios') is null then raise exception 'Guarda: falta la tabla gimnasios'; end if;
end $$;

create table if not exists public.slugs_anteriores (
  id          uuid primary key default gen_random_uuid(),
  gimnasio_id uuid not null references public.gimnasios(id),
  slug        text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  creado_en   timestamptz not null default now()
);
alter table public.slugs_anteriores enable row level security;
-- Sin políticas: nadie del lado del cliente la lee ni la escribe; solo la función de abajo (security definer) y el trigger.
revoke all on table public.slugs_anteriores from anon, authenticated;
create index if not exists slugs_anteriores_gimnasio_idx on public.slugs_anteriores (gimnasio_id);

create or replace function privado.guardar_slug_anterior() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.slug is not distinct from old.slug then return new; end if;
  -- Un slug que quedó de otro gimnasio no se puede tomar; el propio, al volver, deja de ser "anterior".
  if exists (select 1 from public.slugs_anteriores s where s.slug = new.slug and s.gimnasio_id <> new.id) then
    raise exception 'Ese slug lo usó antes otro gimnasio y su QR impreso sigue andando' using errcode = '23505';
  end if;
  delete from public.slugs_anteriores where slug = new.slug and gimnasio_id = new.id;
  if tg_op = 'UPDATE' and old.slug is not null and new.slug !~ '^borrado-' then
    insert into public.slugs_anteriores (gimnasio_id, slug) values (new.id, old.slug) on conflict (slug) do nothing;
  end if;
  return new;
end $$;
revoke execute on function privado.guardar_slug_anterior() from public, anon, authenticated;

drop trigger if exists guardar_slug_anterior on public.gimnasios;
create trigger guardar_slug_anterior before insert or update of slug on public.gimnasios
  for each row execute function privado.guardar_slug_anterior();

-- El slug actual de un gimnasio a partir de uno que dejó (o null). Solo devuelve un slug: nada de datos del gimnasio.
create or replace function public.slug_actual_de(p_slug text) returns text
language sql stable security definer set search_path = '' as $$
  select g.slug from public.slugs_anteriores s join public.gimnasios g on g.id = s.gimnasio_id
   where s.slug = lower(btrim(coalesce(p_slug, ''))) and g.borrado_en is null
$$;
revoke all on function public.slug_actual_de(text) from public, anon, authenticated;
grant execute on function public.slug_actual_de(text) to anon, authenticated, service_role;

-- Temple Gym pasó de templegym1 a templegymsalta: el QR impreso con la dirección vieja sigue andando (un dato de dirección, nada de socios ni de plata).
-- Solo si Temple Gym existe con el slug nuevo y el viejo no lo usa nadie; en cualquier otra base (local, pruebas) no hace nada.
insert into public.slugs_anteriores (gimnasio_id, slug)
select g.id, 'templegym1' from public.gimnasios g
 where g.slug = 'templegymsalta'
   and not exists (select 1 from public.gimnasios x where x.slug = 'templegym1')
on conflict (slug) do nothing;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'guardar_slug_anterior') then raise exception 'Verificación: falta el trigger del historial de slugs'; end if;
  if not has_function_privilege('anon', 'public.slug_actual_de(text)', 'execute') then raise exception 'Verificación: el middleware (anon) no puede resolver un slug anterior'; end if;
  if has_table_privilege('anon', 'public.slugs_anteriores', 'select') or has_table_privilege('authenticated', 'public.slugs_anteriores', 'select') then raise exception 'Verificación: el historial de slugs no debe leerse directo'; end if;
end $$;
