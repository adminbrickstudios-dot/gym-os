-- 0134 · TV de la sala (COM-14).
-- Una pantalla grande en la sala, sin sesión de nadie: la clase de ahora (o
-- la que empieza en los próximos 15 minutos) con los anotados en grande, su
-- WOD y la clase que sigue. Se autoriza como la tablet: el dueño o el
-- encargado crean la TV y abren el link una vez en ella; la base guarda solo
-- el hash del token. Un token de TV solo sirve para mirar: no da entrada.
-- Los nombres se muestran con la inicial del apellido.
--   crear_tv(gimnasio, sede, nombre) → {id, token}   dueño y encargado
--   revocar_tv(id)                                   dueño y encargado
--   tvs_panel(gimnasio)                              dueño y encargado
--   tv_estado(token)                                 la TV (sin sesión)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.clases') is null then raise exception 'Guarda: falta clases'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'clases' and column_name = 'wod') then
    raise exception 'Guarda: falta el WOD (0085)';
  end if;
end $$;

create table if not exists public.pantallas_tv (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  sede_id      uuid not null,
  nombre       text not null check (length(trim(nombre)) between 1 and 40),
  token_hash   text not null,
  creado_por   uuid not null,
  revocada_en  timestamptz,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, token_hash),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id)
);
create index if not exists pantallas_tv_por_token on public.pantallas_tv (token_hash);
-- Nadie la lee directo (el hash no sale de la base): todo por funciones.
alter table public.pantallas_tv enable row level security;
revoke all on table public.pantallas_tv from anon, authenticated;

create or replace function public.crear_tv(p_gimnasio_id uuid, p_sede_id uuid, p_nombre text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; nom text := nullif(trim(coalesce(p_nombre, '')), ''); tok text; v_id uuid;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if nom is null then raise exception 'Ponele un nombre a la TV (por ejemplo "Sala de spinning").' using errcode = '22023'; end if;
  if length(nom) > 40 then raise exception 'El nombre: hasta 40 letras.' using errcode = '22023'; end if;
  if not exists (select 1 from public.sedes s where s.id = p_sede_id and s.gimnasio_id = p_gimnasio_id) then
    raise exception 'Esa sede no es de este gimnasio.' using errcode = '22023';
  end if;
  if (select count(*) from public.pantallas_tv t where t.gimnasio_id = p_gimnasio_id and t.revocada_en is null) >= 10 then
    raise exception 'Hay 10 TVs: sacá alguna que no se use.' using errcode = '22023';
  end if;
  tok := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.pantallas_tv (gimnasio_id, sede_id, nombre, token_hash, creado_por)
  values (p_gimnasio_id, p_sede_id, nom, encode(extensions.digest(tok, 'sha256'), 'hex'), e.id)
  returning id into v_id;
  -- El token se ve una sola vez.
  return jsonb_build_object('id', v_id, 'token', tok);
end $$;

create or replace function public.revocar_tv(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.pantallas_tv; n int;
begin
  select * into t from public.pantallas_tv where id = p_id;
  if not found then raise exception 'Sin permiso o TV inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(t.gimnasio_id, array['dueno', 'encargado']);
  update public.pantallas_tv set revocada_en = now() where id = t.id and revocada_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Esa TV ya estaba sacada' using errcode = '22023'; end if;
end $$;

create or replace function public.tvs_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nombre', t.nombre, 'sede', s.nombre, 'creado_en', t.creado_en) order by t.creado_en)
    from public.pantallas_tv t join public.sedes s on s.id = t.sede_id where t.gimnasio_id = p_gimnasio_id and t.revocada_en is null), '[]');
end $$;

-- Una clase para la TV: anotados (reservas confirmadas y los que vinieron sin reservar), con la inicial del apellido.
create or replace function privado.clase_tv(p_clase public.clases) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('clase_id', p_clase.id, 'actividad', a.nombre, 'emoji', a.emoji, 'inicio', p_clase.inicio, 'fin', p_clase.fin,
    'profe', (select e.nombre from public.equipo e where e.id = p_clase.profe_id), 'cupo', p_clase.cupo, 'wod', p_clase.wod,
    'anotados', coalesce((select jsonb_agg(jsonb_build_object('nombre', trim(s.nombre || ' ' || coalesce(left(nullif(s.apellido, ''), 1) || '.', '')),
                                                              'presente', q.presente) order by q.desde)
       from (select x.socio_id, min(x.desde) as desde, bool_or(x.presente) as presente from (
               select r.socio_id, r.creado_en as desde, false as presente from public.reservas r where r.clase_id = p_clase.id and r.estado = 'confirmada'
               union all
               select w.socio_id, w.creado_en, true from public.asistencias w where w.clase_id = p_clase.id and w.anulada_en is null) x
             group by x.socio_id) q
       join public.socios s on s.id = q.socio_id), '[]'))
    from public.actividades a where a.id = p_clase.actividad_id
$$;
revoke all on function privado.clase_tv(public.clases) from public, anon, authenticated;

create or replace function public.tv_estado(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t public.pantallas_tv; ahora public.clases; prox public.clases;
begin
  select * into t from public.pantallas_tv where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if t.id is null or t.revocada_en is not null then
    raise exception 'Esta TV no está autorizada. El dueño la autoriza desde Clases → TV de la sala.' using errcode = '42501';
  end if;
  -- La de ahora: la que está en curso, o la que empieza en los próximos 15 minutos.
  select * into ahora from public.clases c
   where c.sede_id = t.sede_id and c.cancelada_en is null and c.fin > now() and c.inicio <= now() + interval '15 minutes'
   order by c.inicio limit 1;
  select * into prox from public.clases c
   where c.sede_id = t.sede_id and c.cancelada_en is null and c.inicio > coalesce(ahora.inicio, now()) and c.inicio < now() + interval '18 hours'
     and c.id is distinct from ahora.id
   order by c.inicio limit 1;
  return jsonb_build_object('tv', t.nombre,
    'gimnasio', (select g.nombre from public.gimnasios g where g.id = t.gimnasio_id),
    'sede', (select s.nombre from public.sedes s where s.id = t.sede_id),
    'zona', (select g.zona_horaria from public.gimnasios g where g.id = t.gimnasio_id),
    'ahora', case when ahora.id is null then null else privado.clase_tv(ahora) end,
    'proxima', case when prox.id is null then null else privado.clase_tv(prox) - 'wod' end);
end $$;

revoke all on function public.crear_tv(uuid, uuid, text), public.revocar_tv(uuid), public.tvs_panel(uuid), public.tv_estado(text) from public, anon, authenticated;
grant execute on function public.crear_tv(uuid, uuid, text), public.revocar_tv(uuid), public.tvs_panel(uuid) to authenticated, service_role;
grant execute on function public.tv_estado(text) to anon, authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.pantallas_tv'::regclass) then raise exception 'Verificación: pantallas_tv sin RLS'; end if;
  if has_table_privilege('anon', 'public.pantallas_tv', 'select') or has_table_privilege('authenticated', 'public.pantallas_tv', 'select') then
    raise exception 'Verificación: pantallas_tv se puede leer directo';
  end if;
  if has_function_privilege('anon', 'public.crear_tv(uuid, uuid, text)', 'execute') then raise exception 'Verificación: crear_tv quedó para anon'; end if;
end $$;
