-- ═══════════════════════════════════════════════════════════════════
-- 0022 · Logo, favicon y fotos del gimnasio desde el panel (CFG-2).
--
-- Cómo se sube una imagen (nunca directo desde el navegador):
--   1. preparar_imagen_marca: la base decide si esta persona puede, si el
--      tipo y el tamaño sirven y si hay lugar (12 fotos), y da la ruta.
--   2. El servidor la sube al bucket "marcas" con la clave de servicio.
--   3. confirmar_imagen_marca: la base comprueba que la ruta es de este
--      gimnasio (y en Supabase, que el archivo está) y la usa. Devuelve
--      la imagen anterior, para que el servidor la borre.
--   quitar_imagen_marca y ordenar_fotos completan el manejo.
--
-- Solo el dueño (como el resto de Configuración). Las políticas de
-- escritura directa del bucket se sacan: ya nadie sube con su sesión, y
-- un encargado podía pisar el logo con un archivo propio. El bucket baja
-- a 2 MB por archivo.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.landing_secciones') is null then raise exception 'Guarda: falta la migración 0008'; end if;
  if to_regprocedure('public.datos_gimnasio_panel(uuid)') is null then raise exception 'Guarda: falta la migración 0021'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid,text[])') is null then raise exception 'Guarda: falta la migración 0013'; end if;
end $$;

-- Qué acepta cada tipo de imagen. Un solo lugar: la pantalla lo lee.
create or replace function privado.reglas_imagen_marca(p_tipo text) returns jsonb
language sql immutable set search_path = '' as $$
  select case p_tipo
    when 'logo'    then '{"tipos": ["image/png", "image/jpeg", "image/svg+xml", "image/webp"], "max_bytes": 2097152, "carpeta": "marca"}'::jsonb
    when 'favicon' then '{"tipos": ["image/png", "image/svg+xml"], "max_bytes": 524288, "carpeta": "marca"}'::jsonb
    when 'foto'    then '{"tipos": ["image/png", "image/jpeg", "image/webp"], "max_bytes": 2097152, "carpeta": "galeria", "maximo": 12}'::jsonb
  end
$$;

-- Las fotos de la galería del gimnasio (la sección se crea con la landing).
create or replace function privado.fotos_galeria(p_gimnasio_id uuid) returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array(select jsonb_array_elements_text(coalesce(s.contenido -> 'fotos', '[]'))), '{}')
    from public.landing_secciones s where s.gimnasio_id = p_gimnasio_id and s.tipo = 'galeria'
$$;

create or replace function public.preparar_imagen_marca(p_gimnasio_id uuid, p_tipo text, p_tipo_mime text, p_bytes int)
returns text language plpgsql security definer set search_path = '' as $$
declare r jsonb; ext text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  r := privado.reglas_imagen_marca(p_tipo);
  if r is null then raise exception 'Tipo de imagen desconocido' using errcode = '22023'; end if;
  if p_tipo_mime is null or not (r -> 'tipos') ? p_tipo_mime then
    raise exception '%', case p_tipo
      when 'favicon' then 'El ícono tiene que ser PNG o SVG.'
      when 'foto' then 'La foto tiene que ser JPG, PNG o WEBP.'
      else 'El logo tiene que ser PNG, JPG, SVG o WEBP.' end using errcode = '22023';
  end if;
  if p_bytes is null or p_bytes <= 0 then raise exception 'El archivo está vacío.' using errcode = '22023'; end if;
  if p_bytes > (r ->> 'max_bytes')::int then
    raise exception 'El archivo pesa % KB y el máximo es % KB. Achicalo (por ejemplo con squoosh.app) y probá de nuevo.',
      ceil(p_bytes / 1024.0)::int, (r ->> 'max_bytes')::int / 1024 using errcode = '22023';
  end if;
  if p_tipo = 'foto' and cardinality(privado.fotos_galeria(p_gimnasio_id)) >= (r ->> 'maximo')::int then
    raise exception 'Ya tenés % fotos, que es el máximo. Quitá una para subir otra.', r ->> 'maximo' using errcode = '22023';
  end if;
  ext := case p_tipo_mime when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' else 'svg' end;
  return format('%s/%s/%s-%s.%s', p_gimnasio_id, r ->> 'carpeta', p_tipo, replace(gen_random_uuid()::text, '-', ''), ext);
end $$;

create or replace function public.confirmar_imagen_marca(p_gimnasio_id uuid, p_tipo text, p_ruta text)
returns text language plpgsql security definer set search_path = '' as $$
declare r jsonb; anterior text; existe boolean; n int; fotos text[];
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  r := privado.reglas_imagen_marca(p_tipo);
  if r is null then raise exception 'Tipo de imagen desconocido' using errcode = '22023'; end if;
  if p_ruta is null or p_ruta !~ ('^' || p_gimnasio_id::text || '/' || (r ->> 'carpeta') || '/' || p_tipo || '-[0-9a-f]{32}\.(png|jpg|webp|svg)$') then
    raise exception 'Esa imagen no es de este gimnasio' using errcode = '42501';
  end if;
  -- En Supabase: el archivo tiene que estar subido. (La base local no tiene Storage.)
  if to_regclass('storage.objects') is not null then
    execute 'select exists (select 1 from storage.objects where bucket_id = ''marcas'' and name = $1)' into existe using p_ruta;
    if not existe then raise exception 'No encontramos la imagen: volvé a subirla'; end if;
  end if;

  if p_tipo in ('logo', 'favicon') then
    select case p_tipo when 'logo' then c.logo_path else c.favicon_path end into anterior
      from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
    update public.configuracion_gimnasio c set
      logo_path = case when p_tipo = 'logo' then p_ruta else c.logo_path end,
      favicon_path = case when p_tipo = 'favicon' then p_ruta else c.favicon_path end,
      actualizado_en = now()
     where c.gimnasio_id = p_gimnasio_id;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo guardar la imagen'; end if;
    return anterior;
  end if;

  fotos := privado.fotos_galeria(p_gimnasio_id);
  if p_ruta = any (fotos) then return null; end if;
  if cardinality(fotos) >= (r ->> 'maximo')::int then
    raise exception 'Ya tenés % fotos, que es el máximo. Quitá una para subir otra.', r ->> 'maximo' using errcode = '22023';
  end if;
  update public.landing_secciones s
     set contenido = jsonb_set(s.contenido, '{fotos}', to_jsonb(fotos || p_ruta)), actualizado_en = now()
   where s.gimnasio_id = p_gimnasio_id and s.tipo = 'galeria';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Este gimnasio no tiene la sección de fotos de la página'; end if;
  return null;
end $$;

-- Saca el logo, el ícono o una foto. Devuelve la ruta que quedó sin usar
-- (el servidor borra el archivo), o null si no había nada.
create or replace function public.quitar_imagen_marca(p_gimnasio_id uuid, p_tipo text, p_ruta text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare anterior text; fotos text[]; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_tipo in ('logo', 'favicon') then
    select case p_tipo when 'logo' then c.logo_path else c.favicon_path end into anterior
      from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
    update public.configuracion_gimnasio c set
      logo_path = case when p_tipo = 'logo' then null else c.logo_path end,
      favicon_path = case when p_tipo = 'favicon' then null else c.favicon_path end,
      actualizado_en = now()
     where c.gimnasio_id = p_gimnasio_id;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo quitar la imagen'; end if;
    return anterior;
  elsif p_tipo = 'foto' then
    fotos := privado.fotos_galeria(p_gimnasio_id);
    if p_ruta is null or not (p_ruta = any (fotos)) then raise exception 'Esa foto ya no está en la galería' using errcode = 'P0002'; end if;
    update public.landing_secciones s
       set contenido = jsonb_set(s.contenido, '{fotos}', to_jsonb(array_remove(fotos, p_ruta))), actualizado_en = now()
     where s.gimnasio_id = p_gimnasio_id and s.tipo = 'galeria';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo quitar la foto'; end if;
    return p_ruta;
  end if;
  raise exception 'Tipo de imagen desconocido' using errcode = '22023';
end $$;

-- Nuevo orden de las fotos: tienen que ser exactamente las mismas.
create or replace function public.ordenar_fotos(p_gimnasio_id uuid, p_rutas text[])
returns void language plpgsql security definer set search_path = '' as $$
declare fotos text[]; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  fotos := privado.fotos_galeria(p_gimnasio_id);
  if p_rutas is null or cardinality(p_rutas) <> cardinality(fotos)
     or exists (select 1 from unnest(p_rutas) x where not (x = any (fotos)))
     or (select count(distinct x) from unnest(p_rutas) x) <> cardinality(fotos) then
    raise exception 'Las fotos cambiaron mientras ordenabas: recargá la página.' using errcode = '40001';
  end if;
  update public.landing_secciones s
     set contenido = jsonb_set(s.contenido, '{fotos}', to_jsonb(p_rutas)), actualizado_en = now()
   where s.gimnasio_id = p_gimnasio_id and s.tipo = 'galeria';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo ordenar'; end if;
end $$;

-- La pestaña Gimnasio/Marca también muestra las imágenes. Misma firma que 0021.
create or replace function public.datos_gimnasio_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g public.gimnasios; l public.landing_gimnasio; c public.configuracion_gimnasio;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select * into g from public.gimnasios where id = p_gimnasio_id;
  select * into l from public.landing_gimnasio where gimnasio_id = p_gimnasio_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  return jsonb_build_object(
    'nombre', g.nombre, 'slug', g.slug, 'zona_horaria', g.zona_horaria,
    'whatsapp', l.whatsapp, 'instagram', l.instagram, 'email_contacto', l.email_contacto,
    'publicada', coalesce(l.publicada, false),
    'logo_path', c.logo_path, 'favicon_path', c.favicon_path,
    'fotos', to_jsonb(privado.fotos_galeria(p_gimnasio_id)),
    'reglas_imagenes', jsonb_build_object('logo', privado.reglas_imagen_marca('logo'),
                                          'favicon', privado.reglas_imagen_marca('favicon'),
                                          'foto', privado.reglas_imagen_marca('foto')),
    'sedes', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre, 'direccion', s.direccion,
                                                           'telefono', s.telefono, 'mapa_url', s.mapa_url,
                                                           'es_principal', s.es_principal)
                                        order by s.es_principal desc, s.creado_en), '[]')
                from public.sedes s where s.gimnasio_id = p_gimnasio_id and s.activa),
    'dominios', (select coalesce(jsonb_agg(jsonb_build_object('host', d.host, 'tipo', d.tipo,
                                                              'verificado', d.verificado_en is not null)
                                           order by (d.tipo = 'propio') desc, d.creado_en), '[]')
                   from public.dominios_gimnasio d where d.gimnasio_id = p_gimnasio_id));
end $$;

-- ── Bucket: 2 MB y sin escritura directa ────────────────────────────
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Sin esquema storage (base local): se saltea el bucket marcas';
    return;
  end if;
  update storage.buckets set file_size_limit = 2097152,
         allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
   where id = 'marcas';
  execute 'drop policy if exists marcas_equipo_sube on storage.objects';
  execute 'drop policy if exists marcas_equipo_cambia on storage.objects';
  execute 'drop policy if exists marcas_equipo_borra on storage.objects';
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function privado.reglas_imagen_marca(text), privado.fotos_galeria(uuid) from public, anon, authenticated;
revoke all on function
  public.preparar_imagen_marca(uuid, text, text, int), public.confirmar_imagen_marca(uuid, text, text),
  public.quitar_imagen_marca(uuid, text, text), public.ordenar_fotos(uuid, text[]), public.datos_gimnasio_panel(uuid)
  from public, anon, authenticated;
grant execute on function
  public.preparar_imagen_marca(uuid, text, text, int), public.confirmar_imagen_marca(uuid, text, text),
  public.quitar_imagen_marca(uuid, text, text), public.ordenar_fotos(uuid, text[]), public.datos_gimnasio_panel(uuid)
  to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'privado' and p.proname in ('reglas_imagen_marca', 'fotos_galeria'))
               or (s.nspname = 'public' and p.proname in ('preparar_imagen_marca', 'confirmar_imagen_marca',
                                                         'quitar_imagen_marca', 'ordenar_fotos', 'datos_gimnasio_panel')) loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
  if (privado.reglas_imagen_marca('foto') ->> 'maximo')::int <> 12 then raise exception 'Verificación: el máximo de fotos no es 12'; end if;
  if to_regclass('storage.objects') is not null and exists (
       select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
          and policyname in ('marcas_equipo_sube', 'marcas_equipo_cambia', 'marcas_equipo_borra')) then
    raise exception 'Verificación: quedaron políticas de escritura directa en el bucket marcas';
  end if;
end $$;
