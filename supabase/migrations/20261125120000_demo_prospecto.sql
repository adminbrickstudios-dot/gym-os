-- Cierre para vender (Mateo, 25/11) · Parte 4: "Demo para un prospecto" en /super, la herramienta para vender. Aditiva (expandir).
--
--   admin_crear_demo_prospecto(nombre, dominio, acento, fondo)   un gimnasio [demo] con el nombre del prospecto, su color, su dirección propia
--                                     y los datos de ejemplo (socios ficticios con 000 y @ejemplo.invalid, un precio de ejemplo en su plan).
--                                     Pasa por la función de alta única (admin_alta_gimnasio: Pista con Semáforo, plantilla, marca) y vence a
--                                     los 14 días: demo_hasta se compara al abrir (sin cron). Queda con origen demo_prospecto.
--   admin_demos_prospectos()          la lista de prospectos de /super: cada demo, su dirección y cuándo vence (calculado)
--   admin_preparar_logo_demo / admin_confirmar_logo_demo   el logo opcional, solo para un gimnasio [demo] (los reales lo sube su dueño)
--   privado.cargar_socios_ejemplo_en  los datos de ejemplo de siempre, sin pedir rol: los usan cargar_socios_ejemplo (el dueño, igual que antes)
--                                     y la demo para un prospecto (BRIK)
-- Nada de esto toca un gimnasio real: todo exige es_demo o crea uno nuevo [demo]. No mueve plata.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $g$ begin
  if to_regprocedure('public.admin_alta_gimnasio(text, text, text, text, text, text, text, uuid)') is null then raise exception 'Guarda: falta admin_alta_gimnasio (20261125110000)'; end if;
  if to_regprocedure('public.cargar_socios_ejemplo(uuid)') is null then raise exception 'Guarda: falta cargar_socios_ejemplo'; end if;
  if to_regprocedure('privado.exigir_brik(text[])') is null then raise exception 'Guarda: falta privado.exigir_brik'; end if;
  if to_regprocedure('privado.reglas_imagen_marca(text)') is null then raise exception 'Guarda: falta privado.reglas_imagen_marca'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gimnasios' and column_name = 'origen') then
    raise exception 'Guarda: falta gimnasios.origen (20261125110000)';
  end if;
end $g$;

-- ── 1. Los datos de ejemplo, sin pedir rol (lo pide quien llama) ────
create or replace function privado.cargar_socios_ejemplo_en(p_gimnasio_id uuid, p_por uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  zona text; hoy date; imp uuid; plan uuid; sid uuid; sus uuid; n int := 0; i int;
  nombres text[] := array['Lucía', 'Mateo', 'Camila', 'Joaquín', 'Valentina', 'Santiago', 'Martina', 'Tomás', 'Sofía', 'Facundo'];
  -- Hasta cuándo pagó cada uno, en días desde hoy: al día, por vencer, vence hoy, y sin cobertura (vencidos).
  dias int[] := array[28, 20, 15, 9, 4, 2, 0, null, null, null];
begin
  if exists (select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.es_ejemplo) then
    raise exception 'Ya hay datos de ejemplo cargados: borralos primero si querés empezar de nuevo' using errcode = '22023';
  end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := (now() at time zone zona)::date;
  select p.id into plan from public.planes p
   where p.gimnasio_id = p_gimnasio_id and p.tipo = 'membresia' and p.activo order by p.orden, p.creado_en limit 1;
  insert into public.importaciones (gimnasio_id, archivo, filas, importados, creado_por)
  values (p_gimnasio_id, 'Datos de ejemplo', 10, 0, p_por) returning id into imp;
  for i in 1 .. 10 loop
    insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, email, origen, importacion_id, es_ejemplo, creado_por)
    select p_gimnasio_id, nombres[i], 'Ejemplo ' || i, '9900000' || lpad(i::text, 2, '0'), '+549000111' || lpad(i::text, 4, '0'),
           'ejemplo' || i || '@ejemplo.invalid', 'importacion', imp, true, p_por
     where not exists (select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dni = '9900000' || lpad(i::text, 2, '0'))
    returning id into sid;
    if sid is null then continue; end if;
    n := n + 1;
    if plan is not null then
      insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio, creado_por, importacion_id)
      values (p_gimnasio_id, sid, plan, now() - interval '40 days', p_por, imp) returning id into sus;
      if dias[i] is not null then
        insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, importacion_id, motivo, creado_por)
        values (p_gimnasio_id, sus, sid, privado.medianoche(hoy, zona), privado.medianoche(hoy + dias[i] + 1, zona),
                'importacion', imp, 'Dato de ejemplo', p_por);
      end if;
    end if;
    sid := null;
  end loop;
  if n = 0 then raise exception 'No se pudo cargar ningún socio de ejemplo' using errcode = '22023'; end if;
  update public.importaciones set importados = n where id = imp;
  return jsonb_build_object('cargados', n, 'con_plan', plan is not null);
end $$;
revoke all on function privado.cargar_socios_ejemplo_en(uuid, uuid) from public, anon, authenticated;

-- El del dueño, igual que antes (mismo permiso, mismo resultado): ahora llama al de arriba.
create or replace function public.cargar_socios_ejemplo(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  return privado.cargar_socios_ejemplo_en(p_gimnasio_id, auth.uid());
end $$;
revoke all on function public.cargar_socios_ejemplo(uuid) from public, anon, authenticated;
grant execute on function public.cargar_socios_ejemplo(uuid) to authenticated, service_role;

-- ── 2. La demo para un prospecto ────────────────────────────────────
create or replace function public.admin_crear_demo_prospecto(p_nombre text, p_dominio_base text, p_acento text default null, p_fondo text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_nom text := btrim(coalesce(p_nombre, '')); v_slug text; r jsonb; gid uuid; hasta timestamptz := now() + interval '14 days'; pl record; n int;
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  if length(v_nom) < 2 or length(v_nom) > 60 then raise exception 'Escribí el nombre del gimnasio del prospecto (de 2 a 60 letras)' using errcode = '22023'; end if;
  v_slug := 'demo-' || btrim(left(regexp_replace(lower(privado.sin_acentos(v_nom)), '[^a-z0-9]+', '-', 'g'), 24), '-') || '-' || substr(md5(random()::text), 1, 4);
  v_slug := regexp_replace(v_slug, '-+', '-', 'g');
  -- La función de alta única: Pista con Semáforo, la plantilla (planes y configuración) y la marca del prospecto.
  r := public.admin_alta_gimnasio(v_slug, v_nom, p_dominio_base, 'Demo ' || v_nom, 'musculacion', p_acento, p_fondo, null);
  gid := (r ->> 'gimnasio_id')::uuid;
  update public.gimnasios set es_demo = true, demo_hasta = hasta, demo_para = v_nom, origen = 'demo_prospecto' where id = gid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo marcar la demo'; end if;
  -- Un precio de ejemplo en cada plan de la plantilla, para poder mostrar un cobro (datos ficticios de una demo).
  for pl in select p.id, p.tipo from public.planes p where p.gimnasio_id = gid loop
    insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde, creado_por)
    values (gid, pl.id, case pl.tipo when 'membresia' then 25000 when 'pase_diario' then 5000 else 20000 end, now() - interval '60 days', auth.uid());
  end loop;
  perform privado.cargar_socios_ejemplo_en(gid, auth.uid());
  perform privado.registrar_brik('crear_demo_prospecto', gid, jsonb_build_object('prospecto', v_nom, 'vence', hasta));
  return r || jsonb_build_object('vence', hasta, 'slug', v_slug);
end $$;
revoke all on function public.admin_crear_demo_prospecto(text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_crear_demo_prospecto(text, text, text, text) to authenticated, service_role;

-- La lista de prospectos de /super: el vencimiento se calcula al pedirla (sin cron).
create or replace function public.admin_demos_prospectos() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'ventas', 'lectura']);
  return coalesce((select jsonb_agg(jsonb_build_object('gimnasio_id', g.id, 'nombre', g.nombre, 'slug', g.slug, 'para', g.demo_para,
             'creado_en', g.creado_en, 'vence', g.demo_hasta, 'vencida', g.demo_hasta < now(),
             'dias', greatest(0, ceil(extract(epoch from (g.demo_hasta - now())) / 86400))::int,
             'host', (select d.host from public.dominios_gimnasio d where d.gimnasio_id = g.id order by (d.tipo = 'propio') desc, d.creado_en limit 1))
           order by g.creado_en desc)
    from public.gimnasios g where g.es_demo and g.origen = 'demo_prospecto' and g.baja_en is null), '[]'::jsonb);
end $$;
revoke all on function public.admin_demos_prospectos() from public, anon, authenticated;
grant execute on function public.admin_demos_prospectos() to authenticated, service_role;

-- ── 3. El logo opcional de la demo (solo gimnasios [demo]) ──────────
create or replace function public.admin_preparar_logo_demo(p_gimnasio_id uuid, p_tipo_mime text, p_bytes int) returns text
language plpgsql security definer set search_path = '' as $$
declare r jsonb := privado.reglas_imagen_marca('logo'); ext text;
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  if not exists (select 1 from public.gimnasios g where g.id = p_gimnasio_id and g.es_demo) then
    raise exception 'El logo desde /super es solo para una demo: el de un gimnasio real lo sube su dueño' using errcode = '42501';
  end if;
  if p_tipo_mime is null or not (r -> 'tipos') ? p_tipo_mime then raise exception 'El logo tiene que ser PNG, JPG, SVG o WEBP.' using errcode = '22023'; end if;
  if p_bytes is null or p_bytes <= 0 then raise exception 'El archivo está vacío.' using errcode = '22023'; end if;
  if p_bytes > (r ->> 'max_bytes')::int then raise exception 'El logo pesa % KB y el máximo es % KB.', ceil(p_bytes / 1024.0)::int, (r ->> 'max_bytes')::int / 1024 using errcode = '22023'; end if;
  ext := case p_tipo_mime when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'image/webp' then 'webp' else 'svg' end;
  return format('%s/%s/logo-%s.%s', p_gimnasio_id, r ->> 'carpeta', replace(gen_random_uuid()::text, '-', ''), ext);
end $$;

create or replace function public.admin_confirmar_logo_demo(p_gimnasio_id uuid, p_ruta text) returns void
language plpgsql security definer set search_path = '' as $$
declare r jsonb := privado.reglas_imagen_marca('logo'); existe boolean; n int;
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  if not exists (select 1 from public.gimnasios g where g.id = p_gimnasio_id and g.es_demo) then
    raise exception 'El logo desde /super es solo para una demo: el de un gimnasio real lo sube su dueño' using errcode = '42501';
  end if;
  if p_ruta is null or p_ruta !~ ('^' || p_gimnasio_id::text || '/' || (r ->> 'carpeta') || '/logo-[0-9a-f]{32}\.(png|jpg|webp|svg)$') then
    raise exception 'Esa imagen no es de este gimnasio' using errcode = '42501';
  end if;
  if to_regclass('storage.objects') is not null then
    execute 'select exists (select 1 from storage.objects where bucket_id = ''marcas'' and name = $1)' into existe using p_ruta;
    if not existe then raise exception 'No encontramos la imagen: volvé a subirla'; end if;
  end if;
  update public.configuracion_gimnasio set logo_path = p_ruta, actualizado_en = now() where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar el logo'; end if;
end $$;
revoke all on function public.admin_preparar_logo_demo(uuid, text, int), public.admin_confirmar_logo_demo(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_preparar_logo_demo(uuid, text, int), public.admin_confirmar_logo_demo(uuid, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $v$
declare f text;
begin
  foreach f in array array['public.admin_crear_demo_prospecto(text, text, text, text)', 'public.admin_demos_prospectos()', 'public.admin_preparar_logo_demo(uuid, text, integer)',
                           'public.admin_confirmar_logo_demo(uuid, text)', 'public.cargar_socios_ejemplo(uuid)', 'privado.cargar_socios_ejemplo_en(uuid, uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if has_function_privilege('authenticated', 'privado.cargar_socios_ejemplo_en(uuid, uuid)', 'execute') then raise exception 'Verificación: un usuario puede cargar ejemplos sin rol'; end if;
end $v$;
