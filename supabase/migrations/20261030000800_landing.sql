-- ═══════════════════════════════════════════════════════════════════
-- 0008 · Landing pública de cada gimnasio, editable.
--
-- Cada gimnasio tiene su página en su subdominio (o dominio propio):
-- portada, secciones que se prenden, se apagan y se reordenan, y los
-- planes con sus precios salen de la base, nunca tipeados dos veces.
-- La página se lee con UNA función pública (landing_publica), que solo
-- devuelve lo que es público. Las tablas no se leen sin sesión.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('privado.precio_para(uuid,timestamptz,text,uuid,boolean)') is null then
    raise exception 'Guarda: falta la migración 0005';
  end if;
end $$;

-- ── Columnas nuevas (aditivas, nullable o con default) ─────────────
alter table public.planes add column if not exists visible_en_landing boolean not null default true;
alter table public.sedes  add column if not exists mapa_url text check (mapa_url is null or mapa_url ~ '^https://');
alter table public.sedes  add column if not exists telefono text check (telefono is null or telefono ~ '^\+[0-9]{8,15}$');

-- ── Portada y datos de contacto (1:1) ──────────────────────────────
create table if not exists public.landing_gimnasio (
  gimnasio_id        uuid primary key references public.gimnasios(id),
  publicada          boolean not null default false,
  titulo             text not null check (length(trim(titulo)) between 1 and 80),
  bajada             text check (bajada is null or length(bajada) <= 240),
  foto_portada_path  text,
  boton_texto        text not null default 'Quiero empezar' check (length(trim(boton_texto)) between 1 and 40),
  whatsapp           text check (whatsapp is null or whatsapp ~ '^\+[0-9]{8,15}$'),
  mensaje_whatsapp   text not null default 'Hola! Quiero info para empezar a entrenar.',
  instagram          text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  email_contacto     text check (email_contacto is null or email_contacto ~ '^[^@\s]+@[^@\s]+$'),
  mostrar_precios    boolean not null default true,
  actualizado_en     timestamptz not null default now()
);
select privado.politicas_estandar('public.landing_gimnasio', null, array['dueno', 'encargado']);

-- ── Secciones ──────────────────────────────────────────────────────
-- Una por tipo. El contenido depende del tipo:
--   sobre_nosotros {"texto": "..."}
--   actividades    {"items": [{"emoji","nombre","descripcion"}]}
--   planes         {}  ← salen de la tabla planes
--   horarios       {"filas": [{"dias","horas"}]}
--   galeria        {"fotos": ["ruta en el bucket marcas"]}
--   equipo         {"personas": [{"nombre","rol","foto"}]}
--   preguntas      {"items": [{"pregunta","respuesta"}]}
--   ubicacion      {}  ← salen de las sedes
-- Una sección visible sin contenido no se muestra: lo vacío está vacío.
create table if not exists public.landing_secciones (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  tipo         text not null check (tipo in ('sobre_nosotros', 'actividades', 'planes', 'horarios', 'galeria', 'equipo', 'preguntas', 'ubicacion')),
  titulo       text not null check (length(trim(titulo)) between 1 and 60),
  orden        int not null default 0,
  visible      boolean not null default true,
  contenido    jsonb not null default '{}'::jsonb check (jsonb_typeof(contenido) = 'object'),
  actualizado_en timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, tipo)
);
select privado.politicas_estandar('public.landing_secciones', null, array['dueno', 'encargado']);

-- Validación del contenido según el tipo: un error claro al guardar es
-- mejor que una sección que se rompe en la página pública.
create or replace function privado.validar_seccion_landing() returns trigger
language plpgsql set search_path = '' as $$
declare
  c jsonb := new.contenido; clave text; campos text[]; e jsonb;
begin
  new.actualizado_en := now();
  case new.tipo
    when 'sobre_nosotros' then
      if c ? 'texto' and jsonb_typeof(c -> 'texto') <> 'string' then raise exception 'sobre_nosotros: "texto" tiene que ser texto'; end if;
      if length(coalesce(c ->> 'texto', '')) > 1500 then raise exception 'sobre_nosotros: máximo 1.500 caracteres'; end if;
      return new;
    when 'actividades' then clave := 'items';    campos := array['nombre'];
    when 'horarios'    then clave := 'filas';    campos := array['dias', 'horas'];
    when 'galeria'     then clave := 'fotos';    campos := null;
    when 'equipo'      then clave := 'personas'; campos := array['nombre'];
    when 'preguntas'   then clave := 'items';    campos := array['pregunta', 'respuesta'];
    else return new;   -- planes, ubicacion: el contenido sale de otras tablas
  end case;
  if not c ? clave then return new; end if;
  if jsonb_typeof(c -> clave) <> 'array' then raise exception '%: "%" tiene que ser una lista', new.tipo, clave; end if;
  if jsonb_array_length(c -> clave) > 30 then raise exception '%: máximo 30 elementos', new.tipo; end if;
  for e in select * from jsonb_array_elements(c -> clave) loop
    if campos is null then
      if jsonb_typeof(e) <> 'string' then raise exception 'galeria: cada foto es una ruta de texto'; end if;
    else
      if jsonb_typeof(e) <> 'object' then raise exception '%: cada elemento tiene que ser un objeto', new.tipo; end if;
      if exists (select 1 from unnest(campos) k where length(trim(coalesce(e ->> k, ''))) = 0) then
        raise exception '%: falta % en algún elemento', new.tipo, array_to_string(campos, ' o ');
      end if;
    end if;
  end loop;
  return new;
end $$;
revoke all on function privado.validar_seccion_landing() from public;
drop trigger if exists landing_secciones_validar on public.landing_secciones;
create trigger landing_secciones_validar before insert or update on public.landing_secciones
  for each row execute function privado.validar_seccion_landing();

create or replace function privado.tocar_landing() returns trigger
language plpgsql set search_path = '' as $$
begin new.actualizado_en := now(); return new; end $$;
revoke all on function privado.tocar_landing() from public;
drop trigger if exists landing_gimnasio_tocar on public.landing_gimnasio;
create trigger landing_gimnasio_tocar before update on public.landing_gimnasio
  for each row execute function privado.tocar_landing();

-- ── Landing por defecto al crear un gimnasio ───────────────────────
create or replace function privado.crear_landing(p_gimnasio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.landing_gimnasio (gimnasio_id, titulo, bajada)
  select g.id, g.nombre, 'Entrená con nosotros.' from public.gimnasios g where g.id = p_gimnasio_id
  on conflict do nothing;
  insert into public.landing_secciones (gimnasio_id, tipo, titulo, orden) values
    (p_gimnasio_id, 'sobre_nosotros', 'Quiénes somos', 10),
    (p_gimnasio_id, 'actividades',    'Qué podés hacer', 20),
    (p_gimnasio_id, 'planes',         'Planes', 30),
    (p_gimnasio_id, 'horarios',       'Horarios', 40),
    (p_gimnasio_id, 'galeria',        'El gimnasio', 50),
    (p_gimnasio_id, 'equipo',         'Profes', 60),
    (p_gimnasio_id, 'preguntas',      'Preguntas frecuentes', 70),
    (p_gimnasio_id, 'ubicacion',      'Dónde estamos', 80)
  on conflict (gimnasio_id, tipo) do nothing;
end $$;
revoke all on function privado.crear_landing(uuid) from public;

create or replace function privado.al_crear_gimnasio_landing() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform privado.crear_landing(new.id); return null; end $$;
revoke all on function privado.al_crear_gimnasio_landing() from public;
drop trigger if exists gimnasios_crear_landing on public.gimnasios;
create trigger gimnasios_crear_landing after insert on public.gimnasios
  for each row execute function privado.al_crear_gimnasio_landing();

-- Backfill: los gimnasios que ya existían.
do $$
declare g uuid;
begin
  for g in select id from public.gimnasios where id not in (select gimnasio_id from public.landing_gimnasio) loop
    perform privado.crear_landing(g);
  end loop;
end $$;

-- ── Lo que ve el público ───────────────────────────────────────────
-- Sin publicar: solo la marca, para mostrar "próximamente". Nunca datos
-- de socios, del equipo (salvo lo que el gimnasio cargó en la sección
-- equipo) ni de plata más allá de los precios de lista de los planes.
create or replace function public.landing_publica(p_host text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  g public.gimnasios; c public.configuracion_gimnasio; l public.landing_gimnasio;
  marca jsonb; secciones jsonb; planes jsonb; sedes jsonb;
begin
  select gi.* into g from public.dominios_gimnasio d join public.gimnasios gi on gi.id = d.gimnasio_id
   where d.host = lower(p_host);
  if not found then return null; end if;
  select * into c from public.configuracion_gimnasio where gimnasio_id = g.id;
  select * into l from public.landing_gimnasio where gimnasio_id = g.id;

  marca := jsonb_build_object('nombre', g.nombre, 'slug', g.slug, 'logo_path', c.logo_path,
                              'favicon_path', c.favicon_path, 'color_acento', c.color_acento, 'color_fondo', c.color_fondo);
  if l.gimnasio_id is null or not l.publicada then
    return jsonb_build_object('publicada', false, 'marca', marca);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('tipo', s.tipo, 'titulo', s.titulo, 'contenido', s.contenido) order by s.orden, s.tipo), '[]')
    into secciones from public.landing_secciones s where s.gimnasio_id = g.id and s.visible;

  if l.mostrar_precios then
    select coalesce(jsonb_agg(x.plan order by x.orden, x.nombre), '[]') into planes from (
      select p.orden, p.nombre, jsonb_build_object(
               'nombre', p.nombre, 'tipo', p.tipo, 'descripcion', p.descripcion,
               'duracion_meses', p.duracion_meses, 'cantidad_clases', p.cantidad_clases,
               'hora_desde', to_char(p.hora_desde, 'HH24:MI'), 'hora_hasta', to_char(p.hora_hasta, 'HH24:MI'),
               'max_ingresos_semana', p.max_ingresos_semana,
               'precio', privado.precio_para(p.id, now(), null, null, false),
               'variantes', (
                 select coalesce(jsonb_agg(jsonb_build_object('monto', pp.monto, 'medio_pago', pp.medio_pago,
                                                              'pago_hasta_dia', pp.pago_hasta_dia) order by pp.monto), '[]')
                   from public.precios_plan pp
                  where pp.plan_id = p.id and pp.sede_id is null
                    and (pp.medio_pago is not null or pp.pago_hasta_dia is not null)
                    and pp.vigente_desde = (select max(q.vigente_desde) from public.precios_plan q
                                             where q.plan_id = p.id and q.sede_id is null and q.vigente_desde <= now()))
             ) as plan
        from public.planes p
       where p.gimnasio_id = g.id and p.activo and p.visible_en_landing
         and privado.precio_para(p.id, now(), null, null, false) is not null
    ) x;
  else
    select coalesce(jsonb_agg(jsonb_build_object('nombre', p.nombre, 'tipo', p.tipo, 'descripcion', p.descripcion) order by p.orden, p.nombre), '[]')
      into planes from public.planes p where p.gimnasio_id = g.id and p.activo and p.visible_en_landing;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('nombre', s.nombre, 'direccion', s.direccion, 'mapa_url', s.mapa_url,
                                               'telefono', s.telefono) order by s.es_principal desc, s.nombre), '[]')
    into sedes from public.sedes s where s.gimnasio_id = g.id and s.activa;

  return jsonb_build_object(
    'publicada', true,
    'marca', marca,
    'portada', jsonb_build_object('titulo', l.titulo, 'bajada', l.bajada, 'foto_path', l.foto_portada_path,
                                  'boton_texto', l.boton_texto),
    'contacto', jsonb_build_object('whatsapp', l.whatsapp, 'mensaje_whatsapp', l.mensaje_whatsapp,
                                   'instagram', l.instagram, 'email', l.email_contacto),
    'mostrar_precios', l.mostrar_precios,
    'secciones', secciones,
    'planes', planes,
    'sedes', sedes
  );
end $$;
revoke all on function public.landing_publica(text) from public, anon, authenticated;
grant execute on function public.landing_publica(text) to anon, authenticated, service_role;

-- ── Fotos y logos (Supabase Storage) ───────────────────────────────
-- Bucket público "marcas". Cada gimnasio sube solo dentro de su carpeta
-- <gimnasio_id>/… y solo el dueño o el encargado.
-- En la base local de pruebas no existe el esquema storage: se saltea.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Sin esquema storage (base local): se saltea el bucket marcas';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('marcas', 'marcas', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
  on conflict (id) do nothing;

  execute 'drop policy if exists marcas_equipo_sube on storage.objects';
  execute $p$create policy marcas_equipo_sube on storage.objects for insert to authenticated
    with check (bucket_id = 'marcas' and (storage.foldername(name))[1]::uuid in (select privado.mis_gimnasios(array['dueno','encargado'])))$p$;
  execute 'drop policy if exists marcas_equipo_cambia on storage.objects';
  execute $p$create policy marcas_equipo_cambia on storage.objects for update to authenticated
    using (bucket_id = 'marcas' and (storage.foldername(name))[1]::uuid in (select privado.mis_gimnasios(array['dueno','encargado'])))$p$;
  execute 'drop policy if exists marcas_equipo_borra on storage.objects';
  execute $p$create policy marcas_equipo_borra on storage.objects for delete to authenticated
    using (bucket_id = 'marcas' and (storage.foldername(name))[1]::uuid in (select privado.mis_gimnasios(array['dueno','encargado'])))$p$;
end $$;

-- ── Verificación final ─────────────────────────────────────────────
do $$
declare faltan int;
begin
  select count(*) into faltan from public.gimnasios g
   where not exists (select 1 from public.landing_gimnasio l where l.gimnasio_id = g.id);
  if faltan > 0 then raise exception 'Verificación: % gimnasios sin landing', faltan; end if;
  if not has_function_privilege('anon', 'public.landing_publica(text)', 'execute') then
    raise exception 'Verificación: anon no puede leer la landing';
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relname in ('landing_gimnasio', 'landing_secciones') and not c.relrowsecurity) then
    raise exception 'Verificación: tablas de landing sin RLS';
  end if;
end $$;
