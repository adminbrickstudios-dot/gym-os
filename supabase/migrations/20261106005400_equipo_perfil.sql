-- VD-44 · Equipo con foto, clases y horario.
-- Cada persona del equipo puede tener foto, las actividades que da y su horario de
-- trabajo. Se ve en la página del gimnasio y en la app del socio (en la clase: "Profe: Ana"
-- con su foto) SOLO si el dueño lo prende (equipo_ajustes) y la persona está tildada.
-- Decisiones prudentes:
--   · La foto vive en un bucket PRIVADO: se sirve por /foto-equipo/<id> y la base
--     (foto_equipo) decide si se ve. Apagar la opción la oculta al instante.
--   · El horario de trabajo es interno: no sale en la página ni en la app.
--   · Editan dueño y encargado. La propia foto la puede cambiar cada persona (profe incluido).
--   · No toca guardar_configuracion ni la liquidación (sigue en COM-15).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.equipo') is null or to_regclass('public.actividades') is null then
    raise exception 'Guarda: faltan equipo o actividades';
  end if;
  if to_regprocedure('privado.landing_completa(uuid)') is null then
    raise exception 'Guarda: falta privado.landing_completa';
  end if;
end $$;

-- ── Tablas ──────────────────────────────────────────────────────────
create table if not exists public.equipo_ajustes (
  gimnasio_id  uuid primary key references public.gimnasios(id),
  mostrar_en_pagina_y_app boolean not null default false,
  actualizado_en timestamptz not null default now()
);
select privado.politicas_estandar('public.equipo_ajustes', array['dueno', 'encargado'], '{}');
revoke all on table public.equipo_ajustes from anon;

create table if not exists public.equipo_perfil (
  gimnasio_id  uuid not null references public.gimnasios(id),
  equipo_id    uuid not null,
  foto_path    text,
  mostrar      boolean not null default false,
  actualizado_en timestamptz not null default now(),
  primary key (gimnasio_id, equipo_id),
  foreign key (gimnasio_id, equipo_id) references public.equipo (gimnasio_id, id)
);
select privado.politicas_estandar('public.equipo_perfil', array['dueno', 'encargado'], '{}');
revoke all on table public.equipo_perfil from anon;

create table if not exists public.equipo_actividades (
  gimnasio_id  uuid not null references public.gimnasios(id),
  equipo_id    uuid not null,
  actividad_id uuid not null,
  primary key (gimnasio_id, equipo_id, actividad_id),
  foreign key (gimnasio_id, equipo_id) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, actividad_id) references public.actividades (gimnasio_id, id)
);
select privado.politicas_estandar('public.equipo_actividades', array['dueno', 'encargado'], '{}');
revoke all on table public.equipo_actividades from anon;

create table if not exists public.equipo_horario_trabajo (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  equipo_id    uuid not null,
  dia          int not null check (dia between 1 and 7),   -- 1 = lunes … 7 = domingo
  desde        time not null,
  hasta        time not null,
  check (desde < hasta),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, equipo_id) references public.equipo (gimnasio_id, id)
);
create index if not exists equipo_horario_trabajo_equipo_idx on public.equipo_horario_trabajo (gimnasio_id, equipo_id);
select privado.politicas_estandar('public.equipo_horario_trabajo', array['dueno', 'encargado'], '{}');
revoke all on table public.equipo_horario_trabajo from anon;

-- ── Leer (panel) ────────────────────────────────────────────────────
-- Dueño y encargado ven a todos; recepción y profe, solo lo propio.
create or replace function public.equipo_perfiles(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare yo public.equipo; todos boolean;
begin
  yo := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  todos := yo.rol in ('dueno', 'encargado');
  return jsonb_build_object(
    'mostrar_en_pagina_y_app', coalesce((select a.mostrar_en_pagina_y_app from public.equipo_ajustes a where a.gimnasio_id = p_gimnasio_id), false),
    'actividades', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nombre', a.nombre, 'emoji', a.emoji) order by a.nombre), '[]')
                      from public.actividades a where a.gimnasio_id = p_gimnasio_id and a.activa),
    'personas', (select coalesce(jsonb_agg(jsonb_build_object(
        'equipo_id', e.id,
        'mostrar', coalesce(p.mostrar, false),
        'tiene_foto', p.foto_path is not null,
        'actividades', (select coalesce(jsonb_agg(ea.actividad_id), '[]') from public.equipo_actividades ea where ea.equipo_id = e.id and ea.gimnasio_id = e.gimnasio_id),
        'horario', (select coalesce(jsonb_agg(jsonb_build_object('dia', h.dia, 'desde', to_char(h.desde, 'HH24:MI'), 'hasta', to_char(h.hasta, 'HH24:MI')) order by h.dia, h.desde), '[]')
                      from public.equipo_horario_trabajo h where h.equipo_id = e.id and h.gimnasio_id = e.gimnasio_id)
      ) order by e.nombre), '[]')
      from public.equipo e
      left join public.equipo_perfil p on p.gimnasio_id = e.gimnasio_id and p.equipo_id = e.id
     where e.gimnasio_id = p_gimnasio_id and e.activo and (todos or e.id = yo.id))
  );
end $$;

-- ── Escribir ────────────────────────────────────────────────────────
create or replace function public.guardar_equipo_ajuste(p_gimnasio_id uuid, p_mostrar boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_mostrar is null then raise exception 'Elegí sí o no'; end if;
  insert into public.equipo_ajustes (gimnasio_id, mostrar_en_pagina_y_app) values (p_gimnasio_id, p_mostrar)
  on conflict (gimnasio_id) do update set mostrar_en_pagina_y_app = excluded.mostrar_en_pagina_y_app, actualizado_en = now();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar'; end if;
end $$;

-- p_horario: [{"dia":1,"desde":"09:00","hasta":"13:00"}, …] (hasta 3 franjas por día, sin pisarse).
create or replace function public.guardar_perfil_equipo(p_gimnasio_id uuid, p_equipo_id uuid, p_mostrar boolean,
                                                       p_actividades uuid[], p_horario jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare f jsonb; v_dia int; v_desde time; v_hasta time; n int; acts uuid[] := coalesce(p_actividades, '{}');
        dias text[] := array['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if not exists (select 1 from public.equipo e where e.id = p_equipo_id and e.gimnasio_id = p_gimnasio_id) then
    raise exception 'Esa persona no es de este gimnasio' using errcode = '42501';
  end if;
  if p_mostrar is null then raise exception 'Elegí si se muestra o no'; end if;
  if jsonb_typeof(coalesce(p_horario, '[]'::jsonb)) <> 'array' then raise exception 'Datos inválidos'; end if;
  if jsonb_array_length(coalesce(p_horario, '[]'::jsonb)) > 21 then raise exception 'Hasta 3 franjas por día.' using errcode = '22023'; end if;
  if exists (select 1 from unnest(acts) a where not exists (select 1 from public.actividades x where x.id = a and x.gimnasio_id = p_gimnasio_id)) then
    raise exception 'Una actividad no es de este gimnasio' using errcode = '42501';
  end if;

  insert into public.equipo_perfil (gimnasio_id, equipo_id, mostrar) values (p_gimnasio_id, p_equipo_id, p_mostrar)
  on conflict (gimnasio_id, equipo_id) do update set mostrar = excluded.mostrar, actualizado_en = now();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar'; end if;

  delete from public.equipo_actividades where gimnasio_id = p_gimnasio_id and equipo_id = p_equipo_id;
  insert into public.equipo_actividades (gimnasio_id, equipo_id, actividad_id)
  select p_gimnasio_id, p_equipo_id, a from (select distinct unnest(acts) a) x;

  delete from public.equipo_horario_trabajo where gimnasio_id = p_gimnasio_id and equipo_id = p_equipo_id;
  for f in select * from jsonb_array_elements(coalesce(p_horario, '[]'::jsonb)) loop
    begin
      v_dia := (f ->> 'dia')::int; v_desde := (f ->> 'desde')::time; v_hasta := (f ->> 'hasta')::time;
    exception when others then
      raise exception 'Revisá las horas: se escriben como 09:00 o 18:30.' using errcode = '22023';
    end;
    if v_dia is null or v_dia not between 1 and 7 then raise exception 'Día inválido' using errcode = '22023'; end if;
    if v_desde is null or v_hasta is null then raise exception 'El %: falta una hora.', dias[v_dia] using errcode = '22023'; end if;
    if v_hasta = '00:00' then v_hasta := '23:59'; end if;
    if v_desde >= v_hasta then
      raise exception 'El %: empieza a las % y termina a las %. La hora de terminar tiene que ser después.', dias[v_dia],
        to_char(v_desde, 'HH24:MI'), to_char(v_hasta, 'HH24:MI') using errcode = '22023';
    end if;
    if exists (select 1 from public.equipo_horario_trabajo h where h.gimnasio_id = p_gimnasio_id and h.equipo_id = p_equipo_id
                and h.dia = v_dia and h.desde < v_hasta and h.hasta > v_desde) then
      raise exception 'El % tiene dos franjas que se pisan.', dias[v_dia] using errcode = '22023';
    end if;
    if (select count(*) from public.equipo_horario_trabajo h where h.gimnasio_id = p_gimnasio_id and h.equipo_id = p_equipo_id and h.dia = v_dia) >= 3 then
      raise exception 'Hasta 3 franjas por día (el %).', dias[v_dia] using errcode = '22023';
    end if;
    insert into public.equipo_horario_trabajo (gimnasio_id, equipo_id, dia, desde, hasta) values (p_gimnasio_id, p_equipo_id, v_dia, v_desde, v_hasta);
  end loop;
end $$;

-- ── Foto ────────────────────────────────────────────────────────────
-- Quién puede cambiar la foto de p_equipo_id: dueño y encargado de su gimnasio, o la propia persona.
create or replace function privado.puede_foto_equipo(p_equipo_id uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; usuario uuid;
begin
  select e.gimnasio_id, e.usuario_id into g, usuario from public.equipo e where e.id = p_equipo_id;
  if g is null then raise exception 'Sin permiso o persona inexistente' using errcode = '42501'; end if;
  if usuario is not null and usuario = auth.uid() and exists (select 1 from public.equipo e where e.id = p_equipo_id and e.activo) then
    return g;
  end if;
  perform privado.exigir_equipo(g, array['dueno', 'encargado']);
  return g;
end $$;
revoke all on function privado.puede_foto_equipo(uuid) from public, anon, authenticated;

-- La ruta de la foto nueva (no se adivina): <gimnasio>/<persona>/foto-<32 hex>.<ext>
create or replace function public.preparar_foto_equipo(p_equipo_id uuid, p_ext text) returns text
language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  g := privado.puede_foto_equipo(p_equipo_id);
  if p_ext not in ('jpg', 'png', 'webp') then raise exception 'La foto tiene que ser JPG, PNG o WEBP'; end if;
  return g::text || '/' || p_equipo_id::text || '/foto-' || replace(gen_random_uuid()::text, '-', '') || '.' || p_ext;
end $$;

-- Confirma la foto subida (o la quita con null); devuelve la anterior para que el servidor la borre.
create or replace function public.guardar_foto_equipo(p_equipo_id uuid, p_ruta text) returns text
language plpgsql security definer set search_path = '' as $$
declare g uuid; anterior text; n int;
begin
  g := privado.puede_foto_equipo(p_equipo_id);
  if p_ruta is not null and p_ruta !~ ('^' || g::text || '/' || p_equipo_id::text || '/foto-[0-9a-f]{32}\.(jpg|png|webp)$') then
    raise exception 'Ruta de foto inválida';
  end if;
  select foto_path into anterior from public.equipo_perfil where gimnasio_id = g and equipo_id = p_equipo_id for update;
  insert into public.equipo_perfil (gimnasio_id, equipo_id, foto_path) values (g, p_equipo_id, p_ruta)
  on conflict (gimnasio_id, equipo_id) do update set foto_path = excluded.foto_path, actualizado_en = now();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la foto'; end if;
  return anterior;
end $$;

-- Quién ve la foto: el equipo del gimnasio siempre; el socio y cualquiera que mire la página,
-- solo si el dueño prendió la opción y la persona está tildada. Devuelve la ruta (o null).
create or replace function public.foto_equipo(p_equipo_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; ruta text; visible boolean;
begin
  select e.gimnasio_id, p.foto_path,
         e.activo and coalesce(p.mostrar, false) and coalesce(a.mostrar_en_pagina_y_app, false)
    into g, ruta, visible
    from public.equipo e
    left join public.equipo_perfil p on p.gimnasio_id = e.gimnasio_id and p.equipo_id = e.id
    left join public.equipo_ajustes a on a.gimnasio_id = e.gimnasio_id
   where e.id = p_equipo_id;
  if g is null or ruta is null then return null; end if;
  if privado.es_servicio() or g in (select privado.mis_gimnasios()) or visible then return ruta; end if;
  return null;
end $$;

-- ── Profes de unas clases (para la app del socio) ──────────────────
-- Solo los que el dueño muestra. [{clase_id, equipo_id, nombre, tiene_foto}]
create or replace function public.profes_de_clases(p_clase_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null and not privado.es_servicio() then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('clase_id', c.id, 'equipo_id', e.id, 'nombre', e.nombre, 'tiene_foto', p.foto_path is not null))
      from public.clases c
      join public.equipo e on e.id = c.profe_id and e.gimnasio_id = c.gimnasio_id and e.activo
      join public.equipo_perfil p on p.gimnasio_id = e.gimnasio_id and p.equipo_id = e.id and p.mostrar
      join public.equipo_ajustes a on a.gimnasio_id = c.gimnasio_id and a.mostrar_en_pagina_y_app
     where c.id = any (coalesce(p_clase_ids, '{}'))
       and (privado.es_servicio() or c.gimnasio_id in (select privado.mis_gimnasios())
            or exists (select 1 from public.socios s where s.id in (select privado.mis_socios()) and s.gimnasio_id = c.gimnasio_id))
  ), '[]'::jsonb);
end $$;

-- ── La página muestra al equipo (copia de 0032 + 'equipo_publico') ─
create or replace function privado.landing_completa(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  g public.gimnasios; c public.configuracion_gimnasio; l public.landing_gimnasio;
  marca jsonb; secciones jsonb; planes jsonb; sedes jsonb; equipo_publico jsonb;
begin
  select gi.* into g from public.gimnasios gi where gi.id = p_gimnasio_id;
  if not found then return null; end if;
  select * into c from public.configuracion_gimnasio where gimnasio_id = g.id;
  select * into l from public.landing_gimnasio where gimnasio_id = g.id;

  marca := jsonb_build_object('nombre', g.nombre, 'slug', g.slug, 'logo_path', c.logo_path,
                              'favicon_path', c.favicon_path, 'color_acento', c.color_acento, 'color_fondo', c.color_fondo);
  if l.gimnasio_id is null then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object('tipo', s.tipo, 'titulo', s.titulo, 'contenido', s.contenido) order by s.orden, s.tipo), '[]')
    into secciones from public.landing_secciones s where s.gimnasio_id = g.id and s.visible;

  if l.mostrar_precios then
    select coalesce(jsonb_agg(x.plan order by x.orden, x.nombre), '[]') into planes from (
      select p.orden, p.nombre, jsonb_build_object(
               'id', p.id, 'nombre', p.nombre, 'tipo', p.tipo, 'descripcion', p.descripcion,
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
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'tipo', p.tipo, 'descripcion', p.descripcion) order by p.orden, p.nombre), '[]')
      into planes from public.planes p where p.gimnasio_id = g.id and p.activo and p.visible_en_landing;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('nombre', s.nombre, 'direccion', s.direccion, 'mapa_url', s.mapa_url,
                                               'telefono', s.telefono) order by s.es_principal desc, s.nombre), '[]')
    into sedes from public.sedes s where s.gimnasio_id = g.id and s.activa;

  -- VD-44: el equipo, solo si el dueño lo prendió y la persona está tildada. Sin horarios de trabajo.
  select coalesce(jsonb_agg(jsonb_build_object(
           'equipo_id', e.id, 'nombre', e.nombre,
           'rol', case e.rol when 'profe' then 'Profe' when 'recepcion' then 'Recepción' when 'encargado' then 'Encargado/a' else 'Dueño/a' end,
           'tiene_foto', p.foto_path is not null,
           'actividades', (select coalesce(jsonb_agg(a.nombre order by a.nombre), '[]')
                             from public.equipo_actividades ea join public.actividades a on a.id = ea.actividad_id and a.activa
                            where ea.equipo_id = e.id and ea.gimnasio_id = e.gimnasio_id)
         ) order by (e.rol = 'profe') desc, e.nombre), '[]')
    into equipo_publico
    from public.equipo e
    join public.equipo_perfil p on p.gimnasio_id = e.gimnasio_id and p.equipo_id = e.id and p.mostrar
    join public.equipo_ajustes aj on aj.gimnasio_id = e.gimnasio_id and aj.mostrar_en_pagina_y_app
   where e.gimnasio_id = g.id and e.activo;

  return jsonb_build_object(
    'publicada', l.publicada,
    'altas_online', coalesce(c.altas_online, false),
    'marca', marca,
    'portada', jsonb_build_object('titulo', l.titulo, 'bajada', l.bajada, 'foto_path', l.foto_portada_path,
                                  'boton_texto', l.boton_texto),
    'contacto', jsonb_build_object('whatsapp', l.whatsapp, 'mensaje_whatsapp', l.mensaje_whatsapp,
                                   'instagram', l.instagram, 'email', l.email_contacto),
    'mostrar_precios', l.mostrar_precios,
    'secciones', secciones,
    'planes', planes,
    'sedes', sedes,
    'equipo_publico', equipo_publico
  );
end $$;
revoke all on function privado.landing_completa(uuid) from public, anon, authenticated;

-- ── Permisos de las funciones públicas ─────────────────────────────
revoke all on function public.equipo_perfiles(uuid), public.guardar_equipo_ajuste(uuid, boolean),
  public.guardar_perfil_equipo(uuid, uuid, boolean, uuid[], jsonb), public.preparar_foto_equipo(uuid, text),
  public.guardar_foto_equipo(uuid, text), public.foto_equipo(uuid), public.profes_de_clases(uuid[])
  from public, anon, authenticated;
grant execute on function public.equipo_perfiles(uuid), public.guardar_equipo_ajuste(uuid, boolean),
  public.guardar_perfil_equipo(uuid, uuid, boolean, uuid[], jsonb), public.preparar_foto_equipo(uuid, text),
  public.guardar_foto_equipo(uuid, text), public.profes_de_clases(uuid[]) to authenticated, service_role;
-- La foto la pide también quien mira la página sin sesión (la base decide si se ve).
grant execute on function public.foto_equipo(uuid) to anon, authenticated, service_role;

-- Bucket privado (en Supabase; la base local no tiene storage).
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Sin esquema storage (base local): se saltea el bucket fotos_equipo';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('fotos_equipo', 'fotos_equipo', false, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;
end $$;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record; publico boolean;
begin
  for r in select p.oid, p.proname, p.proconfig from pg_proc p where p.pronamespace = 'public'::regnamespace
            and p.proname in ('equipo_perfiles', 'guardar_equipo_ajuste', 'guardar_perfil_equipo', 'preparar_foto_equipo',
                              'guardar_foto_equipo', 'foto_equipo', 'profes_de_clases') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if r.proname <> 'foto_equipo' and has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
  if (select count(*) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relrowsecurity
        and c.relname in ('equipo_ajustes', 'equipo_perfil', 'equipo_actividades', 'equipo_horario_trabajo')) <> 4 then
    raise exception 'Verificación: falta RLS en las tablas del equipo';
  end if;
  if to_regclass('storage.buckets') is not null then
    execute 'select exists (select 1 from storage.buckets where id = ''fotos_equipo'' and public)' into publico;
    if publico then raise exception 'Verificación: el bucket de fotos del equipo quedó público'; end if;
  end if;
end $$;
