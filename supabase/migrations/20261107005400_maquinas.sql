-- VD-54 · Mantenimiento de máquinas (docs/v2/14-SITUACIONES.md, casos 58-59).
-- El equipo marca una máquina como "fuera de servicio" (motivo, foto opcional, a quién le toca arreglarla) y alguien
-- la deja "en servicio" de nuevo, con fecha y quién. Nada se borra: cada falla es un hecho con su historial.
--
--   maquinas          la lista de máquinas del gimnasio (nombre, sede). No se borran: se dan de baja (activa = false).
--   maquina_fallas    un renglón por falla: quién la reportó, cuándo, el motivo, la foto, el responsable y el arreglo.
--                     El estado de la máquina NO se guarda: está "fuera de servicio" si tiene una falla sin arreglar.
--   privado.seccion_activa(gimnasio, clave)   ¿esta sección está prendida en este gimnasio? (la usan también lockers y PT)
--   crear_maquina · dar_de_baja_maquina · reportar_falla · asignar_responsable_falla · arreglar_falla
--   preparar_foto_falla · confirmar_foto_falla · foto_falla · maquinas_panel · historial_maquina · maquinas_fuera_de_servicio
--
-- Permisos: cualquiera del equipo reporta y ve; sólo el dueño y el encargado dan de alta y de baja máquinas, asignan
-- responsable y cierran la falla. Sección "maquinas" apagable por gimnasio. No se tocan vender ni para_hacer_hoy.
-- La foto va al bucket privado "fotos_maquinas" (sube el servidor con la clave de servicio, como el ticket de caja).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
  if to_regprocedure('privado.secciones_validas()') is null then raise exception 'Guarda: falta privado.secciones_validas'; end if;
  if to_regclass('public.equipo') is null or to_regclass('public.sedes') is null then raise exception 'Guarda: faltan equipo o sedes'; end if;
  if not ('incidentes' = any (privado.secciones_validas())) then raise exception 'Guarda: falta la migración de incidentes (secciones_validas vigente)'; end if;
end $$;

-- ── ¿Está prendida esta sección? ────────────────────────────────────
create or replace function privado.seccion_activa(p_gimnasio_id uuid, p_clave text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select not (p_clave = any (c.secciones_apagadas)) from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id), true)
$$;
revoke all on function privado.seccion_activa(uuid, text) from public;   -- la llaman las funciones de cada sección (security definer): nadie del cliente la ejecuta directo

-- Corta con error si no es del equipo o si la sección está apagada. Devuelve quién soy (con PIN, el operador).
create or replace function privado.exigir_maquinas(p_gimnasio_id uuid, p_solo_gestion boolean default false) returns public.equipo
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, case when p_solo_gestion then array['dueno', 'encargado'] else array['dueno', 'encargado', 'recepcion', 'profe'] end);
  if not privado.seccion_activa(p_gimnasio_id, 'maquinas') then
    raise exception 'El mantenimiento de máquinas está apagado en este gimnasio' using errcode = '42501';
  end if;
  return e;
end $$;
revoke all on function privado.exigir_maquinas(uuid, boolean) from public;

-- ── Las tablas ──────────────────────────────────────────────────────
create table if not exists public.maquinas (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  sede_id      uuid not null,
  nombre       text not null check (length(trim(nombre)) between 1 and 80),
  activa       boolean not null default true,
  creada_por   uuid not null,
  creada_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, sede_id, nombre),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  foreign key (gimnasio_id, creada_por) references public.equipo (gimnasio_id, id)
);
alter table public.maquinas enable row level security;

create table if not exists public.maquina_fallas (
  id               uuid primary key default gen_random_uuid(),
  gimnasio_id      uuid not null references public.gimnasios(id),
  maquina_id       uuid not null,
  reportada_en     timestamptz not null default now(),
  reportada_por    uuid not null,
  motivo           text not null check (length(trim(motivo)) between 3 and 500),
  foto_path        text,
  responsable_id   uuid,
  asignada_por     uuid,
  asignada_en      timestamptz,
  arreglada_en     timestamptz,
  arreglada_por    uuid,
  nota_arreglo     text check (nota_arreglo is null or length(nota_arreglo) <= 500),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, maquina_id) references public.maquinas (gimnasio_id, id),
  foreign key (gimnasio_id, reportada_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, responsable_id) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, asignada_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, arreglada_por) references public.equipo (gimnasio_id, id),
  check ((arreglada_en is null) = (arreglada_por is null)),
  check (arreglada_en is null or arreglada_en >= reportada_en)
);
-- Una sola falla abierta por máquina: "fuera de servicio" no se anota dos veces.
create unique index if not exists maquina_fallas_una_abierta on public.maquina_fallas (gimnasio_id, maquina_id) where arreglada_en is null;
create index if not exists maquina_fallas_maquina on public.maquina_fallas (gimnasio_id, maquina_id, reportada_en desc);
alter table public.maquina_fallas enable row level security;

-- Las fallas son hechos: no se borran, no se reescribe quién/cuándo/por qué; sólo se completan el responsable,
-- la foto (una vez) y el arreglo (una vez).
create or replace function privado.maquina_falla_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Las fallas de las máquinas no se borran: quedan en el historial' using errcode = 'check_violation';
  end if;
  if new.id is distinct from old.id or new.gimnasio_id is distinct from old.gimnasio_id or new.maquina_id is distinct from old.maquina_id
     or new.reportada_en is distinct from old.reportada_en or new.reportada_por is distinct from old.reportada_por
     or new.motivo is distinct from old.motivo then
    raise exception 'De una falla no se cambia la máquina, el motivo ni quién y cuándo la reportó' using errcode = 'check_violation';
  end if;
  if old.foto_path is not null and new.foto_path is distinct from old.foto_path then
    raise exception 'La foto de la falla ya está cargada' using errcode = 'check_violation';
  end if;
  if old.arreglada_en is not null then
    raise exception 'La falla ya está arreglada: el historial no se cambia' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function privado.maquina_falla_inmutable() from public;

drop trigger if exists maquina_falla_inmutable on public.maquina_fallas;
create trigger maquina_falla_inmutable before update or delete on public.maquina_fallas
  for each row execute function privado.maquina_falla_inmutable();

-- Directo a las tablas sólo se lee (lo hace la base por las funciones): todo el equipo del gimnasio.
drop policy if exists equipo_lee on public.maquinas;
create policy equipo_lee on public.maquinas for select to authenticated
  using (gimnasio_id in (select privado.mis_gimnasios(array['dueno', 'encargado', 'recepcion', 'profe'])) or privado.soy_admin_plataforma());
drop policy if exists equipo_lee on public.maquina_fallas;
create policy equipo_lee on public.maquina_fallas for select to authenticated
  using (gimnasio_id in (select privado.mis_gimnasios(array['dueno', 'encargado', 'recepcion', 'profe'])) or privado.soy_admin_plataforma());
revoke all on table public.maquinas, public.maquina_fallas from anon, authenticated;
grant select on table public.maquinas, public.maquina_fallas to authenticated;

-- ── Máquinas: alta y baja ───────────────────────────────────────────
create or replace function public.crear_maquina(p_gimnasio_id uuid, p_sede_id uuid, p_nombre text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; nuevo uuid; nom text := trim(coalesce(p_nombre, ''));
begin
  e := privado.exigir_maquinas(p_gimnasio_id, true);
  if length(nom) < 1 then raise exception 'Poné el nombre de la máquina' using errcode = '22023'; end if;
  if length(nom) > 80 then raise exception 'El nombre de la máquina es demasiado largo (80 letras)' using errcode = '22023'; end if;
  if not exists (select 1 from public.sedes s where s.id = p_sede_id and s.gimnasio_id = p_gimnasio_id and s.activa) then
    raise exception 'Esa sede no existe o está inactiva' using errcode = '22023';
  end if;
  if exists (select 1 from public.maquinas m where m.gimnasio_id = p_gimnasio_id and m.sede_id = p_sede_id and lower(m.nombre) = lower(nom)) then
    raise exception 'Ya hay una máquina con el nombre "%" en esa sede', nom using errcode = '23505';
  end if;
  insert into public.maquinas (gimnasio_id, sede_id, nombre, creada_por) values (p_gimnasio_id, p_sede_id, nom, e.id) returning id into nuevo;
  return nuevo;
end $$;

-- Se da de baja (la máquina se fue) o se vuelve a dar de alta. Una máquina fuera de servicio se arregla antes de darla de baja.
create or replace function public.dar_de_baja_maquina(p_maquina_id uuid, p_activa boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.maquinas; n int;
begin
  select * into m from public.maquinas where id = p_maquina_id;
  if not found then raise exception 'Sin permiso o máquina inexistente' using errcode = '42501'; end if;
  perform privado.exigir_maquinas(m.gimnasio_id, true);
  if p_activa is null then raise exception 'Elegí si se da de baja o de alta' using errcode = '22023'; end if;
  if not p_activa and exists (select 1 from public.maquina_fallas f where f.maquina_id = m.id and f.arreglada_en is null) then
    raise exception 'La máquina está fuera de servicio: cerrá la falla antes de darla de baja' using errcode = '22023';
  end if;
  update public.maquinas set activa = p_activa where id = m.id and gimnasio_id = m.gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo actualizar la máquina'; end if;
end $$;

-- ── Reportar una falla ──────────────────────────────────────────────
-- Cualquiera del equipo. El responsable lo pone el dueño o el encargado (el resto lo deja vacío).
create or replace function public.reportar_falla(p_maquina_id uuid, p_motivo text, p_responsable_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare m public.maquinas; e public.equipo; nuevo uuid; mot text := trim(coalesce(p_motivo, ''));
begin
  select * into m from public.maquinas where id = p_maquina_id for update;
  if not found then raise exception 'Sin permiso o máquina inexistente' using errcode = '42501'; end if;
  e := privado.exigir_maquinas(m.gimnasio_id);
  if not m.activa then raise exception 'Esa máquina está dada de baja' using errcode = '22023'; end if;
  if length(mot) < 3 then raise exception 'Contá qué le pasa a la máquina (al menos unas palabras)' using errcode = '22023'; end if;
  if length(mot) > 500 then raise exception 'El motivo es demasiado largo (500 letras)' using errcode = '22023'; end if;
  if exists (select 1 from public.maquina_fallas f where f.maquina_id = m.id and f.arreglada_en is null) then
    raise exception 'Esa máquina ya está marcada como fuera de servicio' using errcode = '22023';
  end if;
  if p_responsable_id is not null then
    if e.rol not in ('dueno', 'encargado') then raise exception 'Quién la arregla lo elige el dueño o el encargado' using errcode = '42501'; end if;
    if not exists (select 1 from public.equipo q where q.id = p_responsable_id and q.gimnasio_id = m.gimnasio_id and q.activo) then
      raise exception 'Ese responsable no es del equipo' using errcode = '22023';
    end if;
  end if;
  insert into public.maquina_fallas (gimnasio_id, maquina_id, reportada_por, motivo, responsable_id, asignada_por, asignada_en)
  values (m.gimnasio_id, m.id, e.id, mot, p_responsable_id, case when p_responsable_id is not null then e.id end, case when p_responsable_id is not null then now() end)
  returning id into nuevo;
  return nuevo;
end $$;

create or replace function public.asignar_responsable_falla(p_falla_id uuid, p_responsable_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.maquina_fallas; e public.equipo; n int;
begin
  select * into f from public.maquina_fallas where id = p_falla_id for update;
  if not found then raise exception 'Sin permiso o falla inexistente' using errcode = '42501'; end if;
  e := privado.exigir_maquinas(f.gimnasio_id, true);
  if f.arreglada_en is not null then raise exception 'Esa falla ya está arreglada' using errcode = '22023'; end if;
  if p_responsable_id is not null and not exists (select 1 from public.equipo q where q.id = p_responsable_id and q.gimnasio_id = f.gimnasio_id and q.activo) then
    raise exception 'Ese responsable no es del equipo' using errcode = '22023';
  end if;
  update public.maquina_fallas set responsable_id = p_responsable_id, asignada_por = e.id, asignada_en = now() where id = f.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo asignar el responsable'; end if;
end $$;

-- ── Arreglada: vuelve a estar en servicio ───────────────────────────
create or replace function public.arreglar_falla(p_falla_id uuid, p_nota text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.maquina_fallas; e public.equipo; n int;
begin
  select * into f from public.maquina_fallas where id = p_falla_id for update;
  if not found then raise exception 'Sin permiso o falla inexistente' using errcode = '42501'; end if;
  e := privado.exigir_maquinas(f.gimnasio_id, true);
  if f.arreglada_en is not null then raise exception 'Esa falla ya estaba arreglada' using errcode = '22023'; end if;
  if length(coalesce(p_nota, '')) > 500 then raise exception 'La nota es demasiado larga (500 letras)' using errcode = '22023'; end if;
  update public.maquina_fallas set arreglada_en = now(), arreglada_por = e.id, nota_arreglo = nullif(trim(coalesce(p_nota, '')), '') where id = f.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo cerrar la falla'; end if;
end $$;

-- ── La foto (opcional): la base arma la ruta, sube el servidor, la base confirma ─
create or replace function public.preparar_foto_falla(p_falla_id uuid, p_ext text) returns text
language plpgsql security definer set search_path = '' as $$
declare f public.maquina_fallas; e public.equipo;
begin
  select * into f from public.maquina_fallas where id = p_falla_id;
  if not found then raise exception 'Sin permiso o falla inexistente' using errcode = '42501'; end if;
  e := privado.exigir_maquinas(f.gimnasio_id);
  if e.rol not in ('dueno', 'encargado') and e.id <> f.reportada_por then raise exception 'La foto la sube quien reportó la falla' using errcode = '42501'; end if;
  if f.foto_path is not null then raise exception 'Esa falla ya tiene su foto' using errcode = '22023'; end if;
  if f.arreglada_en is not null then raise exception 'Esa falla ya está arreglada' using errcode = '22023'; end if;
  if p_ext not in ('jpg', 'png', 'webp') then raise exception 'La foto tiene que ser JPG, PNG o WEBP' using errcode = '22023'; end if;
  return f.gimnasio_id::text || '/' || f.maquina_id::text || '/falla-' || replace(gen_random_uuid()::text, '-', '') || '.' || p_ext;
end $$;

create or replace function public.confirmar_foto_falla(p_falla_id uuid, p_ruta text) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.maquina_fallas; e public.equipo; n int;
begin
  select * into f from public.maquina_fallas where id = p_falla_id for update;
  if not found then raise exception 'Sin permiso o falla inexistente' using errcode = '42501'; end if;
  e := privado.exigir_maquinas(f.gimnasio_id);
  if e.rol not in ('dueno', 'encargado') and e.id <> f.reportada_por then raise exception 'La foto la sube quien reportó la falla' using errcode = '42501'; end if;
  if p_ruta is null or p_ruta !~ ('^' || f.gimnasio_id::text || '/' || f.maquina_id::text || '/falla-[0-9a-f]{32}\.(jpg|png|webp)$') then
    raise exception 'Ruta de foto inválida';
  end if;
  update public.maquina_fallas set foto_path = p_ruta where id = f.id and foto_path is null and arreglada_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Esa falla ya tiene su foto'; end if;
end $$;

-- Para verla: la ruta, a cualquiera del equipo (la sección tiene que estar prendida).
create or replace function public.foto_falla(p_falla_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare f public.maquina_fallas;
begin
  select * into f from public.maquina_fallas where id = p_falla_id;
  if not found then raise exception 'Sin permiso o falla inexistente' using errcode = '42501'; end if;
  perform privado.exigir_maquinas(f.gimnasio_id);
  return f.foto_path;
end $$;

-- ── Lo que ve la pantalla ───────────────────────────────────────────
-- Máquinas con su estado calculado (fuera de servicio si hay una falla abierta), la falla abierta y la última arreglada.
create or replace function public.maquinas_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; r jsonb;
begin
  e := privado.exigir_maquinas(p_gimnasio_id);
  select jsonb_build_object(
    'puede_gestionar', e.rol in ('dueno', 'encargado'),
    'equipo', case when e.rol in ('dueno', 'encargado') then coalesce((select jsonb_agg(jsonb_build_object('equipo_id', q.id, 'nombre', q.nombre, 'rol', q.rol) order by q.nombre)
                                                                          from public.equipo q where q.gimnasio_id = p_gimnasio_id and q.activo), '[]'::jsonb) else '[]'::jsonb end,
    'sedes', coalesce((select jsonb_agg(jsonb_build_object('sede_id', s.id, 'nombre', s.nombre) order by s.es_principal desc, s.nombre)
                         from public.sedes s where s.gimnasio_id = p_gimnasio_id and s.activa), '[]'::jsonb),
    'maquinas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'maquina_id', m.id, 'nombre', m.nombre, 'sede_id', m.sede_id, 'sede', s.nombre, 'activa', m.activa,
        'estado', case when ab.id is not null then 'fuera_de_servicio' else 'en_servicio' end,
        'falla', case when ab.id is not null then jsonb_build_object(
            'falla_id', ab.id, 'motivo', ab.motivo, 'reportada_en', ab.reportada_en, 'reportada_por', rp.nombre, 'tiene_foto', ab.foto_path is not null,
            'responsable_id', ab.responsable_id, 'responsable', rs.nombre, 'puede_subir_foto', ab.foto_path is null and (e.rol in ('dueno', 'encargado') or ab.reportada_por = e.id)) end,
        'ultima_falla_en', (select max(f.reportada_en) from public.maquina_fallas f where f.maquina_id = m.id),
        'ultimo_arreglo_en', (select max(f.arreglada_en) from public.maquina_fallas f where f.maquina_id = m.id),
        'cantidad_fallas', (select count(*) from public.maquina_fallas f where f.maquina_id = m.id))
        order by (ab.id is null), m.activa desc, s.nombre, m.nombre)
        from public.maquinas m
        join public.sedes s on s.gimnasio_id = m.gimnasio_id and s.id = m.sede_id
        left join public.maquina_fallas ab on ab.maquina_id = m.id and ab.arreglada_en is null
        left join public.equipo rp on rp.gimnasio_id = ab.gimnasio_id and rp.id = ab.reportada_por
        left join public.equipo rs on rs.gimnasio_id = ab.gimnasio_id and rs.id = ab.responsable_id
       where m.gimnasio_id = p_gimnasio_id), '[]'::jsonb))
  into r;
  return r;
end $$;

create or replace function public.historial_maquina(p_maquina_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m public.maquinas;
begin
  select * into m from public.maquinas where id = p_maquina_id;
  if not found then raise exception 'Sin permiso o máquina inexistente' using errcode = '42501'; end if;
  perform privado.exigir_maquinas(m.gimnasio_id);
  return jsonb_build_object('maquina_id', m.id, 'nombre', m.nombre,
    'fallas', coalesce((select jsonb_agg(jsonb_build_object(
        'falla_id', f.id, 'motivo', f.motivo, 'reportada_en', f.reportada_en, 'reportada_por', rp.nombre, 'tiene_foto', f.foto_path is not null,
        'responsable', rs.nombre, 'arreglada_en', f.arreglada_en, 'arreglada_por', ar.nombre, 'nota_arreglo', f.nota_arreglo,
        'dias_fuera', case when f.arreglada_en is not null then greatest(0, (f.arreglada_en::date - f.reportada_en::date)) end)
        order by f.reportada_en desc)
      from public.maquina_fallas f
      join public.equipo rp on rp.gimnasio_id = f.gimnasio_id and rp.id = f.reportada_por
      left join public.equipo rs on rs.gimnasio_id = f.gimnasio_id and rs.id = f.responsable_id
      left join public.equipo ar on ar.gimnasio_id = f.gimnasio_id and ar.id = f.arreglada_por
     where f.maquina_id = m.id), '[]'::jsonb));
end $$;

-- "Fuera de servicio hoy": para el Inicio del dueño y del encargado y para la recepción. Con la sección apagada no hay nada que mostrar
-- (no es un error: es un cuadro del Inicio). Cada renglón trae la frase lista para decirle al socio.
create or replace function public.maquinas_fuera_de_servicio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  if not privado.seccion_activa(p_gimnasio_id, 'maquinas') then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'falla_id', f.id, 'maquina_id', m.id, 'nombre', m.nombre, 'sede', s.nombre, 'desde', f.reportada_en, 'motivo', f.motivo,
      'responsable', rs.nombre,
      'frase', 'La máquina "' || m.nombre || '" está fuera de servicio por ahora. Perdón por la molestia: ya la estamos arreglando.')
      order by f.reportada_en)
    from public.maquina_fallas f
    join public.maquinas m on m.gimnasio_id = f.gimnasio_id and m.id = f.maquina_id
    join public.sedes s on s.gimnasio_id = m.gimnasio_id and s.id = m.sede_id
    left join public.equipo rs on rs.gimnasio_id = f.gimnasio_id and rs.id = f.responsable_id
   where f.gimnasio_id = p_gimnasio_id and f.arreglada_en is null and m.activa), '[]'::jsonb);
end $$;

revoke all on function public.crear_maquina(uuid, uuid, text), public.dar_de_baja_maquina(uuid, boolean), public.reportar_falla(uuid, text, uuid),
  public.asignar_responsable_falla(uuid, uuid), public.arreglar_falla(uuid, text), public.preparar_foto_falla(uuid, text),
  public.confirmar_foto_falla(uuid, text), public.foto_falla(uuid), public.maquinas_panel(uuid), public.historial_maquina(uuid),
  public.maquinas_fuera_de_servicio(uuid) from public, anon, authenticated;
grant execute on function public.crear_maquina(uuid, uuid, text), public.dar_de_baja_maquina(uuid, boolean), public.reportar_falla(uuid, text, uuid),
  public.asignar_responsable_falla(uuid, uuid), public.arreglar_falla(uuid, text), public.preparar_foto_falla(uuid, text),
  public.confirmar_foto_falla(uuid, text), public.foto_falla(uuid), public.maquinas_panel(uuid), public.historial_maquina(uuid),
  public.maquinas_fuera_de_servicio(uuid) to authenticated, service_role;

-- ── Bucket privado (en Supabase; la base local no tiene storage) ────
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Sin esquema storage (base local): se saltea el bucket fotos_maquinas';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('fotos_maquinas', 'fotos_maquinas', false, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;
end $$;

-- ── La sección "maquinas" se puede apagar ───────────────────────────
-- Se suma a lo que ya había (otros ítems suman las suyas): se lee la lista vigente.
do $$
declare actuales text[];
begin
  actuales := privado.secciones_validas();
  if not ('maquinas' = any (actuales)) then
    execute format('create or replace function privado.secciones_validas() returns text[] language sql immutable set search_path = '''' as $f$ select %L::text[] $f$',
                   array_append(actuales, 'maquinas'));
  end if;
  alter table public.configuracion_gimnasio drop constraint if exists configuracion_secciones_validas;
  alter table public.configuracion_gimnasio add constraint configuracion_secciones_validas
    check (secciones_apagadas <@ privado.secciones_validas());
end $$;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text; t text; publico boolean;
begin
  foreach t in array array['public.maquinas', 'public.maquina_fallas'] loop
    if not (select relrowsecurity from pg_class where oid = t::regclass) then raise exception 'Verificación: % sin RLS', t; end if;
    if has_table_privilege('authenticated', t, 'insert') or has_table_privilege('authenticated', t, 'update')
       or has_table_privilege('authenticated', t, 'delete') or has_table_privilege('anon', t, 'select') then
      raise exception 'Verificación: permisos de más sobre %', t;
    end if;
  end loop;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.maquina_fallas'::regclass and tgname = 'maquina_falla_inmutable' and not tgisinternal) then
    raise exception 'Verificación: falta el trigger de inmutabilidad de las fallas';
  end if;
  foreach f in array array['public.crear_maquina(uuid, uuid, text)', 'public.dar_de_baja_maquina(uuid, boolean)', 'public.reportar_falla(uuid, text, uuid)',
    'public.asignar_responsable_falla(uuid, uuid)', 'public.arreglar_falla(uuid, text)', 'public.preparar_foto_falla(uuid, text)',
    'public.confirmar_foto_falla(uuid, text)', 'public.foto_falla(uuid)', 'public.maquinas_panel(uuid)', 'public.historial_maquina(uuid)',
    'public.maquinas_fuera_de_servicio(uuid)', 'privado.seccion_activa(uuid, text)', 'privado.exigir_maquinas(uuid, boolean)', 'privado.maquina_falla_inmutable()'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if not ('maquinas' = any (privado.secciones_validas())) then raise exception 'Verificación: la sección maquinas no quedó entre las válidas'; end if;
  if to_regclass('storage.buckets') is not null then
    execute 'select exists (select 1 from storage.buckets where id = ''fotos_maquinas'' and public)' into publico;
    if publico then raise exception 'Verificación: el bucket de fotos de máquinas quedó público'; end if;
  end if;
end $$;
