-- 0041 · Grupo familiar (SOC-5): socios de la misma familia vinculados (se
-- ven entre sí en la ficha). Sin descuento automático: eso es D14.
-- Lo vinculan dueño, encargado y recepción.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.gimnasio_del_socio(uuid, text[])') is null then raise exception 'Guarda: falta la migración 0036'; end if;
end $$;

create table if not exists public.grupos_familiares (
  id          uuid primary key default gen_random_uuid(),
  gimnasio_id uuid not null references public.gimnasios(id),
  creado_en   timestamptz not null default now(),
  unique (gimnasio_id, id)
);
select privado.politicas_estandar('public.grupos_familiares', array['dueno', 'encargado', 'recepcion'], null);
revoke all on table public.grupos_familiares from anon;

alter table public.socios add column if not exists grupo_familiar_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'socios_grupo_familiar_fk') then
    alter table public.socios add constraint socios_grupo_familiar_fk foreign key (gimnasio_id, grupo_familiar_id) references public.grupos_familiares (gimnasio_id, id);
  end if;
end $$;
create index if not exists socios_por_grupo on public.socios (gimnasio_id, grupo_familiar_id) where grupo_familiar_id is not null;

create or replace function public.familia_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; grupo uuid;
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  select s.grupo_familiar_id into grupo from public.socios s where s.id = p_socio_id;
  if grupo is null then return '[]'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('socio_id', s.id, 'numero', s.numero, 'nombre', trim(s.nombre || ' ' || s.apellido),
            'color', v.color, 'texto', v.texto) order by s.nombre), '[]')
    from public.socios s cross join lateral privado.calcular_acceso(s.id, now(), null) v
   where s.gimnasio_id = g and s.grupo_familiar_id = grupo and s.id <> p_socio_id);
end $$;

-- Vincula dos socios: si alguno ya tiene familia, el otro se suma (y si los dos tienen, se juntan).
create or replace function public.vincular_familia(p_socio_id uuid, p_otro_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; a uuid; b uuid; grupo uuid;
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  if p_socio_id = p_otro_id then raise exception 'Elegí a otra persona.'; end if;
  select s.grupo_familiar_id into a from public.socios s where s.id = p_socio_id;
  select s.grupo_familiar_id into b from public.socios s where s.id = p_otro_id and s.gimnasio_id = g;
  if not found then raise exception 'Ese socio no es de este gimnasio.'; end if;
  grupo := coalesce(a, b);
  if grupo is null then insert into public.grupos_familiares (gimnasio_id) values (g) returning id into grupo; end if;
  update public.socios set grupo_familiar_id = grupo
   where gimnasio_id = g and (id in (p_socio_id, p_otro_id) or (b is not null and grupo_familiar_id = b) or (a is not null and grupo_familiar_id = a));
  if (select count(*) from public.socios where grupo_familiar_id = grupo) > 12 then raise exception 'Una familia de hasta 12 personas.'; end if;
end $$;

create or replace function public.sacar_de_familia(p_socio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; grupo uuid;
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  select s.grupo_familiar_id into grupo from public.socios s where s.id = p_socio_id;
  if grupo is null then raise exception 'No está en ninguna familia.'; end if;
  update public.socios set grupo_familiar_id = null where id = p_socio_id;
  -- Una familia de uno ya no es familia.
  if (select count(*) from public.socios where grupo_familiar_id = grupo) = 1 then
    update public.socios set grupo_familiar_id = null where grupo_familiar_id = grupo;
  end if;
end $$;

revoke all on function public.familia_socio(uuid), public.vincular_familia(uuid, uuid), public.sacar_de_familia(uuid) from public, anon, authenticated;
grant execute on function public.familia_socio(uuid), public.vincular_familia(uuid, uuid), public.sacar_de_familia(uuid) to authenticated, service_role;

do $$
declare r record;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.grupos_familiares'::regclass) then raise exception 'Verificación: grupos_familiares sin RLS'; end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p where p.pronamespace = 'public'::regnamespace
            and p.proname in ('familia_socio', 'vincular_familia', 'sacar_de_familia') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
end $$;
