-- 0036 · Notas con autor y fecha, y etiquetas para filtrar (SOC-3).
-- Notas: cada una con quién y cuándo; se agregan y se borran (borrado lógico:
-- la borra quien la escribió, o el dueño o el encargado). Etiquetas: libres
-- por gimnasio ("turno mañana", "estudiante"), se crean al ponerlas; la
-- lista de socios filtra por etiqueta (buscar_socios con p_etiqueta).
-- Nunca datos de salud: lo recuerda la pantalla.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  -- Idempotente: la primera vez está la firma vieja; si se vuelve a correr, la nueva.
  if to_regprocedure('public.buscar_socios(uuid, text, integer)') is null and to_regprocedure('public.buscar_socios(uuid, text, integer, uuid)') is null then
    raise exception 'Guarda: falta buscar_socios (0013)';
  end if;
  if to_regprocedure('privado.mi_equipo_id(uuid)') is null then raise exception 'Guarda: falta privado.mi_equipo_id'; end if;
end $$;

-- ── Tablas ──────────────────────────────────────────────────────────
create table if not exists public.notas_socio (
  id          uuid primary key default gen_random_uuid(),
  gimnasio_id uuid not null references public.gimnasios(id),
  socio_id    uuid not null,
  texto       text not null check (length(trim(texto)) between 1 and 1000),
  equipo_id   uuid,
  creado_en   timestamptz not null default now(),
  borrada_en  timestamptz,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, equipo_id) references public.equipo (gimnasio_id, id)
);
create index if not exists notas_por_socio on public.notas_socio (gimnasio_id, socio_id, creado_en desc) where borrada_en is null;
select privado.politicas_estandar('public.notas_socio', array['dueno', 'encargado', 'recepcion'], null);
revoke all on table public.notas_socio from anon;

create table if not exists public.etiquetas (
  id          uuid primary key default gen_random_uuid(),
  gimnasio_id uuid not null references public.gimnasios(id),
  nombre      text not null check (length(trim(nombre)) between 1 and 30),
  creado_en   timestamptz not null default now(),
  unique (gimnasio_id, id)
);
create unique index if not exists etiquetas_nombre_por_gimnasio on public.etiquetas (gimnasio_id, lower(nombre));
select privado.politicas_estandar('public.etiquetas', array['dueno', 'encargado', 'recepcion'], null);
revoke all on table public.etiquetas from anon;

create table if not exists public.socio_etiquetas (
  gimnasio_id uuid not null references public.gimnasios(id),
  socio_id    uuid not null,
  etiqueta_id uuid not null,
  puesta_en   timestamptz not null default now(),
  primary key (gimnasio_id, socio_id, etiqueta_id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, etiqueta_id) references public.etiquetas (gimnasio_id, id) on delete cascade
);
create index if not exists socio_etiquetas_por_etiqueta on public.socio_etiquetas (gimnasio_id, etiqueta_id);
select privado.politicas_estandar('public.socio_etiquetas', array['dueno', 'encargado', 'recepcion'], null);
revoke all on table public.socio_etiquetas from anon;

-- ── Funciones ───────────────────────────────────────────────────────
create or replace function privado.gimnasio_del_socio(p_socio_id uuid, p_roles text[]) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select s.gimnasio_id into g from public.socios s where s.id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(g, p_roles);
  return g;
end $$;

create or replace function public.notas_y_etiquetas(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; yo uuid;
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  yo := privado.mi_equipo_id(g);
  return jsonb_build_object(
    'notas', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'texto', n.texto, 'creado_en', n.creado_en,
                'autor', coalesce(e.nombre, 'Alguien que ya no está en el equipo'),
                'puedo_borrar', n.equipo_id = yo or exists (select 1 from public.equipo x where x.id = yo and x.rol in ('dueno', 'encargado')))
                order by n.creado_en desc), '[]')
              from public.notas_socio n left join public.equipo e on e.id = n.equipo_id
             where n.gimnasio_id = g and n.socio_id = p_socio_id and n.borrada_en is null),
    'etiquetas', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'nombre', t.nombre) order by lower(t.nombre)), '[]')
                    from public.socio_etiquetas se join public.etiquetas t on t.id = se.etiqueta_id
                   where se.gimnasio_id = g and se.socio_id = p_socio_id),
    'todas', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'nombre', t.nombre) order by lower(t.nombre)), '[]')
                from public.etiquetas t where t.gimnasio_id = g));
end $$;

create or replace function public.agregar_nota(p_socio_id uuid, p_texto text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare g uuid; id uuid; t text := trim(coalesce(p_texto, ''));
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  if t = '' then raise exception 'Escribí la nota.'; end if;
  if length(t) > 1000 then raise exception 'La nota: hasta 1.000 letras (tiene %).', length(t); end if;
  insert into public.notas_socio (gimnasio_id, socio_id, texto, equipo_id) values (g, p_socio_id, t, privado.mi_equipo_id(g))
  returning notas_socio.id into id;
  return id;
end $$;

create or replace function public.borrar_nota(p_nota_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n public.notas_socio; yo uuid; k int;
begin
  select * into n from public.notas_socio where id = p_nota_id and borrada_en is null;
  if n.id is null then raise exception 'Esa nota no existe o ya se borró.'; end if;
  perform privado.exigir_equipo(n.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  yo := privado.mi_equipo_id(n.gimnasio_id);
  if n.equipo_id is distinct from yo and not exists (select 1 from public.equipo x where x.id = yo and x.rol in ('dueno', 'encargado')) then
    raise exception 'Sin permiso: solo quien la escribió (o el dueño o el encargado) la borra.' using errcode = '42501';
  end if;
  update public.notas_socio set borrada_en = now() where id = n.id and borrada_en is null;
  get diagnostics k = row_count;
  if k <> 1 then raise exception 'No se pudo borrar la nota.'; end if;
end $$;

create or replace function public.poner_etiqueta(p_socio_id uuid, p_nombre text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare g uuid; et uuid; t text := regexp_replace(trim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  if t = '' then raise exception 'Escribí la etiqueta.'; end if;
  if length(t) > 30 then raise exception 'La etiqueta: hasta 30 letras.'; end if;
  select e.id into et from public.etiquetas e where e.gimnasio_id = g and lower(e.nombre) = lower(t);
  if et is null then
    if (select count(*) from public.etiquetas e where e.gimnasio_id = g) >= 100 then raise exception 'Hasta 100 etiquetas por gimnasio.'; end if;
    insert into public.etiquetas (gimnasio_id, nombre) values (g, t) returning id into et;
  end if;
  insert into public.socio_etiquetas (gimnasio_id, socio_id, etiqueta_id) values (g, p_socio_id, et) on conflict do nothing;
  return et;
end $$;

create or replace function public.sacar_etiqueta(p_socio_id uuid, p_etiqueta_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  delete from public.socio_etiquetas se where se.gimnasio_id = g and se.socio_id = p_socio_id and se.etiqueta_id = p_etiqueta_id;
  -- Una etiqueta que ya nadie tiene desaparece.
  delete from public.etiquetas e where e.gimnasio_id = g and e.id = p_etiqueta_id
     and not exists (select 1 from public.socio_etiquetas se where se.etiqueta_id = e.id);
end $$;

create or replace function public.etiquetas_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'nombre', t.nombre,
            'socios', (select count(*) from public.socio_etiquetas se where se.etiqueta_id = t.id)) order by lower(t.nombre)), '[]')
    from public.etiquetas t where t.gimnasio_id = p_gimnasio_id);
end $$;

-- Los socios con una etiqueta (para filtrar Retención).
create or replace function public.socios_con_etiqueta(p_gimnasio_id uuid, p_etiqueta_id uuid) returns uuid[]
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return coalesce((select array_agg(se.socio_id) from public.socio_etiquetas se where se.gimnasio_id = p_gimnasio_id and se.etiqueta_id = p_etiqueta_id), '{}');
end $$;

-- ── Lista de socios con filtro por etiqueta ─────────────────────────
-- Cambia la firma: la vieja se borra (dos versiones con defaults harían ambigua la llamada).
drop function if exists public.buscar_socios(uuid, text, integer);
create or replace function public.buscar_socios(p_gimnasio_id uuid, p_texto text, p_limite int default 30, p_etiqueta uuid default null)
returns table (socio_id uuid, numero int, nombre text, telefono text, dni text, plan text,
               color text, texto text, puede boolean, dado_de_baja boolean)
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; t text := privado.sin_acentos(lower(trim(coalesce(p_texto, '')))); digitos text;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if p_limite is null or p_limite < 1 or p_limite > 100 then raise exception 'El límite va de 1 a 100'; end if;
  digitos := regexp_replace(t, '\D', '', 'g');
  return query
  with candidatos as (
    select s.* from public.socios s
     where s.gimnasio_id = p_gimnasio_id
       and (p_etiqueta is null or exists (select 1 from public.socio_etiquetas se where se.gimnasio_id = p_gimnasio_id
                                            and se.socio_id = s.id and se.etiqueta_id = p_etiqueta))
       and (t = ''
         or privado.sin_acentos(lower(s.nombre || ' ' || s.apellido)) like '%' || t || '%'
         or privado.sin_acentos(lower(s.apellido || ' ' || s.nombre)) like '%' || t || '%'
         or (length(digitos) >= 3 and (s.dni like digitos || '%' or regexp_replace(coalesce(s.telefono, ''), '\D', '', 'g') like '%' || digitos || '%'))
         or (digitos <> '' and s.numero::text = digitos))
     order by (s.dado_de_baja_en is not null), s.nombre, s.apellido
     limit p_limite
  )
  select s.id, s.numero, trim(s.nombre || ' ' || s.apellido), s.telefono, s.dni,
         (select pl.nombre from public.suscripciones su join public.planes pl on pl.id = su.plan_id
           where su.socio_id = s.id and su.baja_en is null order by su.inicio desc limit 1),
         v.color, v.texto, v.puede, s.dado_de_baja_en is not null
    from candidatos s
    cross join lateral privado.calcular_acceso(s.id, now(), e.sede_id) v;
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function privado.gimnasio_del_socio(uuid, text[]) from public, anon, authenticated;
revoke all on function public.notas_y_etiquetas(uuid), public.agregar_nota(uuid, text), public.borrar_nota(uuid),
  public.poner_etiqueta(uuid, text), public.sacar_etiqueta(uuid, uuid), public.etiquetas_gimnasio(uuid),
  public.socios_con_etiqueta(uuid, uuid), public.buscar_socios(uuid, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.notas_y_etiquetas(uuid), public.agregar_nota(uuid, text), public.borrar_nota(uuid),
  public.poner_etiqueta(uuid, text), public.sacar_etiqueta(uuid, uuid), public.etiquetas_gimnasio(uuid),
  public.socios_con_etiqueta(uuid, uuid), public.buscar_socios(uuid, text, integer, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in ('notas_socio', 'etiquetas', 'socio_etiquetas') loop
    if not (select relrowsecurity from pg_class where relname = r.relname and relnamespace = 'public'::regnamespace) then raise exception 'Verificación: % sin RLS', r.relname; end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.relname and cmd <> 'SELECT') then
      raise exception 'Verificación: % se puede escribir desde el cliente', r.relname;
    end if;
  end loop;
  if (select count(*) from pg_proc where proname = 'buscar_socios' and pronamespace = 'public'::regnamespace) <> 1 then
    raise exception 'Verificación: quedó más de una buscar_socios';
  end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'public' and p.proname in ('notas_y_etiquetas', 'agregar_nota', 'borrar_nota', 'poner_etiqueta', 'sacar_etiqueta', 'etiquetas_gimnasio', 'buscar_socios', 'socios_con_etiqueta'))
               or (s.nspname = 'privado' and p.proname = 'gimnasio_del_socio') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
end $$;
