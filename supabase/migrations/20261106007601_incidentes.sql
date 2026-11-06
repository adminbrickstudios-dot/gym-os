-- VD-46I · Registro de incidentes en la sala, SIN diagnóstico (docs/v2/14-SITUACIONES.md, caso 62).
-- Alguien se mareó, se cayó una mancuerna: el equipo anota dónde, qué pasó, quién lo vio y qué se hizo.
-- Se registra el HECHO, nunca un diagnóstico ni datos de salud (la pantalla avisa y rechaza si parece uno).
--
--   incidentes   un renglón por incidente. Se puede corregir hasta 24 h después de cargado, por quien
--                lo cargó o por el dueño/encargado; pasadas las 24 h queda escrito y no cambia (trigger
--                propio, probado). Nunca se borra.
--   crear_incidente · corregir_incidente · incidentes_panel
--
-- Permisos: crea cualquiera del equipo (incluido el profe); lista todos solo el dueño y el encargado.
-- Los demás ven únicamente los que cargaron ellos. Sección "incidentes" apagable por gimnasio.
-- No se tocan vender, registrar_ingreso, pendientes_panel ni para_hacer_hoy.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
  if to_regprocedure('privado.secciones_validas()') is null then raise exception 'Guarda: falta privado.secciones_validas'; end if;
  if to_regclass('public.equipo') is null or to_regclass('public.socios') is null then raise exception 'Guarda: faltan equipo o socios'; end if;
end $$;

-- ── La tabla ────────────────────────────────────────────────────────
create table if not exists public.incidentes (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  ocurrio_en    timestamptz not null default now(),
  donde         text not null check (length(trim(donde)) between 1 and 120),
  que_paso      text not null check (length(trim(que_paso)) between 1 and 1500),
  testigos      text check (testigos is null or length(testigos) <= 300),
  que_se_hizo   text not null check (length(trim(que_se_hizo)) between 1 and 1000),
  socio_id      uuid,
  creado_por    uuid not null,
  creado_en     timestamptz not null default now(),
  corregido_en  timestamptz,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id)
);
create index if not exists incidentes_gimnasio_ocurrio on public.incidentes (gimnasio_id, ocurrio_en desc);
create index if not exists incidentes_socio on public.incidentes (gimnasio_id, socio_id) where socio_id is not null;
alter table public.incidentes enable row level security;

-- Inmutable a las 24 h: no se borra nunca, no se cambia después de un día, y quién/cuándo no cambian jamás.
-- (Trigger propio: privado.hecho_inmutable() sin argumentos no frena nada.)
create or replace function privado.incidente_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Los incidentes no se borran: quedan escritos' using errcode = 'check_violation';
  end if;
  if new.id is distinct from old.id or new.gimnasio_id is distinct from old.gimnasio_id
     or new.creado_por is distinct from old.creado_por or new.creado_en is distinct from old.creado_en then
    raise exception 'De un incidente no se cambia quién lo cargó ni cuándo' using errcode = 'check_violation';
  end if;
  if now() >= old.creado_en + interval '24 hours' then
    raise exception 'Pasaron más de 24 horas: el incidente ya no se puede cambiar' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function privado.incidente_inmutable() from public;

drop trigger if exists incidente_inmutable on public.incidentes;
create trigger incidente_inmutable before update or delete on public.incidentes
  for each row execute function privado.incidente_inmutable();

-- ── Quién puede ─────────────────────────────────────────────────────
-- Dueño o encargado de este gimnasio. No tira error: sirve para las políticas.
create or replace function privado.es_gestion_de(p_gimnasio_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.equipo e
                  where e.gimnasio_id = p_gimnasio_id and e.usuario_id = auth.uid() and e.activo and e.rol in ('dueno', 'encargado'))
$$;
revoke all on function privado.es_gestion_de(uuid) from public;
grant execute on function privado.es_gestion_de(uuid) to authenticated, service_role;

create or replace function privado.incidentes_prendidos(p_gimnasio_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select not ('incidentes' = any (c.secciones_apagadas)) from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id), true)
$$;
revoke all on function privado.incidentes_prendidos(uuid) from public;

-- Corta con error si no es del equipo o si la sección está apagada. Devuelve quién soy (con PIN, el operador).
create or replace function privado.exigir_incidentes(p_gimnasio_id uuid) returns public.equipo
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  if not privado.incidentes_prendidos(p_gimnasio_id) then
    raise exception 'Los incidentes están apagados en este gimnasio' using errcode = '42501';
  end if;
  return e;
end $$;
revoke all on function privado.exigir_incidentes(uuid) from public;

-- Directo a la tabla solo se lee: el dueño/encargado todo, cada uno lo suyo.
drop policy if exists incidentes_lee on public.incidentes;
create policy incidentes_lee on public.incidentes for select to authenticated
  using (privado.es_gestion_de(gimnasio_id)
         or creado_por in (select e.id from public.equipo e where e.gimnasio_id = incidentes.gimnasio_id and e.usuario_id = auth.uid() and e.activo));
revoke all on table public.incidentes from anon, authenticated;
grant select on table public.incidentes to authenticated;

-- ── Cargar ──────────────────────────────────────────────────────────
create or replace function public.crear_incidente(p_gimnasio_id uuid, p_donde text, p_que_paso text, p_testigos text,
                                                  p_que_se_hizo text, p_socio_id uuid default null, p_ocurrio_en timestamptz default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; nuevo uuid; cuando timestamptz := coalesce(p_ocurrio_en, now());
begin
  e := privado.exigir_incidentes(p_gimnasio_id);
  if length(trim(coalesce(p_donde, ''))) < 1 then raise exception 'Decí dónde pasó' using errcode = '22023'; end if;
  if length(trim(coalesce(p_que_paso, ''))) < 1 then raise exception 'Contá qué pasó' using errcode = '22023'; end if;
  if length(trim(coalesce(p_que_se_hizo, ''))) < 1 then raise exception 'Anotá qué se hizo' using errcode = '22023'; end if;
  if cuando > now() + interval '10 minutes' then raise exception 'La hora del incidente no puede ser futura' using errcode = '22023'; end if;
  if cuando < now() - interval '7 days' then raise exception 'Solo se cargan incidentes de los últimos 7 días' using errcode = '22023'; end if;
  if p_socio_id is not null and not exists (select 1 from public.socios s where s.id = p_socio_id and s.gimnasio_id = p_gimnasio_id) then
    raise exception 'Ese socio no existe en este gimnasio' using errcode = '22023';
  end if;
  insert into public.incidentes (gimnasio_id, ocurrio_en, donde, que_paso, testigos, que_se_hizo, socio_id, creado_por)
  values (p_gimnasio_id, cuando, trim(p_donde), trim(p_que_paso), nullif(trim(coalesce(p_testigos, '')), ''), trim(p_que_se_hizo), p_socio_id, e.id)
  returning id into nuevo;
  return nuevo;
end $$;

-- ── Corregir (solo en las primeras 24 h) ────────────────────────────
create or replace function public.corregir_incidente(p_incidente_id uuid, p_donde text, p_que_paso text, p_testigos text, p_que_se_hizo text)
returns void
language plpgsql security definer set search_path = '' as $$
declare i public.incidentes; e public.equipo; n int;
begin
  select * into i from public.incidentes where id = p_incidente_id for update;
  if not found then raise exception 'Sin permiso o incidente inexistente' using errcode = '42501'; end if;
  e := privado.exigir_incidentes(i.gimnasio_id);
  if e.id <> i.creado_por and e.rol not in ('dueno', 'encargado') then
    raise exception 'Solo quien lo cargó, el encargado o el dueño pueden corregirlo' using errcode = '42501';
  end if;
  if now() >= i.creado_en + interval '24 hours' then
    raise exception 'Pasaron más de 24 horas: el incidente ya no se puede cambiar' using errcode = 'check_violation';
  end if;
  if length(trim(coalesce(p_donde, ''))) < 1 or length(trim(coalesce(p_que_paso, ''))) < 1 or length(trim(coalesce(p_que_se_hizo, ''))) < 1 then
    raise exception 'Completá dónde, qué pasó y qué se hizo' using errcode = '22023';
  end if;
  update public.incidentes
     set donde = trim(p_donde), que_paso = trim(p_que_paso), testigos = nullif(trim(coalesce(p_testigos, '')), ''),
         que_se_hizo = trim(p_que_se_hizo), corregido_en = now()
   where id = i.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo corregir el incidente'; end if;
end $$;

-- ── Listar ──────────────────────────────────────────────────────────
-- Dueño y encargado: todos. El resto: solo los que cargó. Con p_socio_id, los de ese socio.
create or replace function public.incidentes_panel(p_gimnasio_id uuid, p_socio_id uuid default null, p_limite int default 100)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; todo boolean; r jsonb;
begin
  e := privado.exigir_incidentes(p_gimnasio_id);
  todo := e.rol in ('dueno', 'encargado');
  select jsonb_build_object(
    'puede_ver_todo', todo,
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'ocurrio_en', x.ocurrio_en, 'donde', x.donde, 'que_paso', x.que_paso, 'testigos', x.testigos, 'que_se_hizo', x.que_se_hizo,
      'socio_id', x.socio_id, 'socio_nombre', x.socio_nombre, 'autor', x.autor, 'creado_en', x.creado_en, 'corregido_en', x.corregido_en,
      'editable', (x.creado_en + interval '24 hours' > now()) and (todo or x.creado_por = e.id)
    ) order by x.ocurrio_en desc), '[]'::jsonb))
  into r
  from (
    select i.*, trim(coalesce(s.nombre, '') || ' ' || coalesce(s.apellido, '')) as socio_nombre, q.nombre as autor
      from public.incidentes i
      join public.equipo q on q.gimnasio_id = i.gimnasio_id and q.id = i.creado_por
      left join public.socios s on s.gimnasio_id = i.gimnasio_id and s.id = i.socio_id
     where i.gimnasio_id = p_gimnasio_id
       and (todo or i.creado_por = e.id)
       and (p_socio_id is null or i.socio_id = p_socio_id)
     order by i.ocurrio_en desc
     limit greatest(1, least(coalesce(p_limite, 100), 300))
  ) x;
  return r;
end $$;

revoke all on function public.crear_incidente(uuid, text, text, text, text, uuid, timestamptz),
  public.corregir_incidente(uuid, text, text, text, text), public.incidentes_panel(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.crear_incidente(uuid, text, text, text, text, uuid, timestamptz),
  public.corregir_incidente(uuid, text, text, text, text), public.incidentes_panel(uuid, uuid, int) to authenticated, service_role;

-- ── La sección "incidentes" se puede apagar ─────────────────────────
-- Se suma a lo que ya había (otros ítems suman las suyas): se lee la lista vigente.
do $$
declare actuales text[];
begin
  actuales := privado.secciones_validas();
  if not ('incidentes' = any (actuales)) then
    execute format('create or replace function privado.secciones_validas() returns text[] language sql immutable set search_path = '''' as $f$ select %L::text[] $f$',
                   array_append(actuales, 'incidentes'));
  end if;
  alter table public.configuracion_gimnasio drop constraint if exists configuracion_secciones_validas;
  alter table public.configuracion_gimnasio add constraint configuracion_secciones_validas
    check (secciones_apagadas <@ privado.secciones_validas());
end $$;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.incidentes'::regclass) then raise exception 'Verificación: incidentes sin RLS'; end if;
  if has_table_privilege('authenticated', 'public.incidentes', 'insert') or has_table_privilege('authenticated', 'public.incidentes', 'update')
     or has_table_privilege('authenticated', 'public.incidentes', 'delete') or has_table_privilege('anon', 'public.incidentes', 'select') then
    raise exception 'Verificación: permisos de más sobre incidentes';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.incidentes'::regclass and tgname = 'incidente_inmutable' and not tgisinternal) then
    raise exception 'Verificación: falta el trigger de inmutabilidad';
  end if;
  foreach f in array array['public.crear_incidente(uuid, text, text, text, text, uuid, timestamptz)', 'public.corregir_incidente(uuid, text, text, text, text)',
    'public.incidentes_panel(uuid, uuid, int)', 'privado.exigir_incidentes(uuid)', 'privado.incidentes_prendidos(uuid)', 'privado.es_gestion_de(uuid)',
    'privado.incidente_inmutable()'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if not ('incidentes' = any (privado.secciones_validas())) then raise exception 'Verificación: la sección incidentes no quedó entre las válidas'; end if;
end $$;
