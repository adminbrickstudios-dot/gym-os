-- 0030 · Editor de la página del gimnasio (PAG-1).
-- La portada (título, bajada, botón, foto, mensaje de WhatsApp, mostrar
-- precios) y las secciones (título, mostrar u ocultar, orden y contenido) se
-- editan desde el panel. Lee dueño y encargado; guarda el dueño (como el
-- resto de la configuración). Cada error dice qué sección y qué campo.
-- La foto de portada se elige entre las fotos del gimnasio; si esa foto se
-- quita de la galería, la portada queda sin foto (nunca un link roto).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.landing_gimnasio') is null or to_regclass('public.landing_secciones') is null then
    raise exception 'Guarda: faltan las tablas de la página (migración 0008)';
  end if;
  if to_regprocedure('privado.fotos_galeria(uuid)') is null then
    raise exception 'Guarda: falta privado.fotos_galeria (migración 0022)';
  end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then
    raise exception 'Guarda: falta privado.exigir_equipo';
  end if;
end $$;

-- ── La página completa, en un solo lugar ───────────────────────────
-- privado.landing_completa arma la página de un gimnasio (publicada o no):
-- la usan la página pública (solo si está publicada) y la vista previa del
-- editor. Antes el armado vivía dentro de landing_publica (0008/0029).
create or replace function privado.landing_completa(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  g public.gimnasios; c public.configuracion_gimnasio; l public.landing_gimnasio;
  marca jsonb; secciones jsonb; planes jsonb; sedes jsonb;
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
    'publicada', l.publicada,
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

create or replace function public.landing_publica(p_host text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  g public.gimnasios; c public.configuracion_gimnasio; l public.landing_gimnasio;
begin
  select gi.* into g from public.dominios_gimnasio d join public.gimnasios gi on gi.id = d.gimnasio_id
   where d.host = lower(p_host);
  if not found then return null; end if;
  select * into c from public.configuracion_gimnasio where gimnasio_id = g.id;
  select * into l from public.landing_gimnasio where gimnasio_id = g.id;
  if l.gimnasio_id is null or not l.publicada then
    -- Sin publicar: la marca y el WhatsApp (0029).
    return jsonb_build_object('publicada', false,
      'marca', jsonb_build_object('nombre', g.nombre, 'slug', g.slug, 'logo_path', c.logo_path,
                                  'favicon_path', c.favicon_path, 'color_acento', c.color_acento, 'color_fondo', c.color_fondo),
      'contacto', jsonb_build_object('whatsapp', l.whatsapp, 'mensaje_whatsapp', l.mensaje_whatsapp));
  end if;
  return privado.landing_completa(g.id);
end $$;

-- ── Leer ────────────────────────────────────────────────────────────
create or replace function public.pagina_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare l public.landing_gimnasio;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select * into l from public.landing_gimnasio where gimnasio_id = p_gimnasio_id;
  if not found then raise exception 'Este gimnasio no tiene página. Pedile a soporte BRIK que la cree.'; end if;
  return jsonb_build_object(
    'portada', jsonb_build_object('titulo', l.titulo, 'bajada', l.bajada, 'boton_texto', l.boton_texto,
                                  'foto_portada_path', l.foto_portada_path, 'mensaje_whatsapp', l.mensaje_whatsapp,
                                  'mostrar_precios', l.mostrar_precios),
    'secciones', (select coalesce(jsonb_agg(jsonb_build_object('tipo', s.tipo, 'titulo', s.titulo, 'visible', s.visible,
                                                               'contenido', s.contenido) order by s.orden, s.tipo), '[]')
                    from public.landing_secciones s where s.gimnasio_id = p_gimnasio_id),
    'fotos', to_jsonb(privado.fotos_galeria(p_gimnasio_id)),
    -- Para la vista previa: marca, contacto, planes con precio y sedes, como los ve la gente.
    'vista', privado.landing_completa(p_gimnasio_id));
end $$;

-- ── Validar el texto de un campo ───────────────────────────────────
create or replace function privado.texto_pagina(p_valor jsonb, p_donde text, p_min int, p_max int) returns text
language plpgsql immutable set search_path = '' as $$
declare t text;
begin
  if p_valor is null or p_valor = 'null'::jsonb then t := null;
  elsif jsonb_typeof(p_valor) <> 'string' then raise exception '%: tiene que ser un texto', p_donde;
  else t := nullif(trim(p_valor #>> '{}'), '');
  end if;
  if t is null and p_min > 0 then raise exception '%: no puede quedar vacío', p_donde; end if;
  if t is not null and length(t) > p_max then
    raise exception '%: hasta % letras (tiene %)', p_donde, p_max, length(t);
  end if;
  return t;
end $$;

-- Una lista de elementos (actividades, profes, preguntas): cada campo con su largo.
create or replace function privado.lista_pagina(p_lista jsonb, p_seccion text, p_campos jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare e jsonb; i int := 0; f record; item jsonb; salida jsonb := '[]';
begin
  if p_lista is null or p_lista = 'null'::jsonb then return '[]'; end if;
  if jsonb_typeof(p_lista) <> 'array' then raise exception '%: la lista no es válida', p_seccion; end if;
  if jsonb_array_length(p_lista) > 30 then raise exception '%: hasta 30 elementos', p_seccion; end if;
  for e in select x from jsonb_array_elements(p_lista) x loop
    i := i + 1;
    if jsonb_typeof(e) <> 'object' then raise exception '%: el elemento % no es válido', p_seccion, i; end if;
    item := '{}';
    -- p_campos: {"campo": ["Etiqueta", min, max]}
    for f in select key, value from jsonb_each(p_campos) loop
      item := item || jsonb_strip_nulls(jsonb_build_object(f.key, privado.texto_pagina(e -> f.key,
                format('%s, %s %s', p_seccion, lower(f.value ->> 0), i), (f.value ->> 1)::int, (f.value ->> 2)::int)));
    end loop;
    salida := salida || jsonb_build_array(item);
  end loop;
  return salida;
end $$;

-- ── Guardar ─────────────────────────────────────────────────────────
create or replace function public.guardar_pagina(p_gimnasio_id uuid, p_portada jsonb, p_secciones jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  foto text; s jsonb; i int := 0; n int; v_tipo text; v_nombre text; v_contenido jsonb; vistos text[] := '{}';
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_portada is null or jsonb_typeof(p_portada) <> 'object' or p_secciones is null or jsonb_typeof(p_secciones) <> 'array' then
    raise exception 'Datos inválidos';
  end if;

  -- Portada
  foto := privado.texto_pagina(p_portada -> 'foto_portada_path', 'Foto de portada', 0, 300);
  if foto is not null and not (foto = any (privado.fotos_galeria(p_gimnasio_id))) then
    raise exception 'Foto de portada: elegila entre las fotos del gimnasio (Configuración → Marca)';
  end if;
  if not (p_portada ? 'mostrar_precios') or jsonb_typeof(p_portada -> 'mostrar_precios') <> 'boolean' then
    raise exception 'Mostrar precios: elegí sí o no';
  end if;
  update public.landing_gimnasio set
    titulo = privado.texto_pagina(p_portada -> 'titulo', 'Título de la portada', 1, 80),
    bajada = privado.texto_pagina(p_portada -> 'bajada', 'Frase de la portada', 0, 240),
    boton_texto = privado.texto_pagina(p_portada -> 'boton_texto', 'Texto del botón', 1, 40),
    mensaje_whatsapp = privado.texto_pagina(p_portada -> 'mensaje_whatsapp', 'Mensaje de WhatsApp', 1, 300),
    foto_portada_path = foto,
    mostrar_precios = (p_portada ->> 'mostrar_precios')::boolean
  where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Este gimnasio no tiene página. Pedile a soporte BRIK que la cree.'; end if;

  -- Secciones, en el orden en que llegan
  for s in select x from jsonb_array_elements(p_secciones) x loop
    i := i + 1;
    v_tipo := s ->> 'tipo';
    if v_tipo is null or v_tipo = any (vistos) then raise exception 'Secciones: la % está repetida o no tiene tipo', i; end if;
    vistos := vistos || v_tipo;
    v_nombre := coalesce(privado.texto_pagina(s -> 'titulo', format('Sección %s: el título', i), 0, 60), '');
    if v_nombre = '' then raise exception 'Sección %: escribí un título (hasta 60 letras)', i; end if;
    if jsonb_typeof(s -> 'visible') is distinct from 'boolean' then raise exception 'Sección "%": elegí si se muestra', v_nombre; end if;
    v_contenido := case v_tipo
      when 'sobre_nosotros' then jsonb_strip_nulls(jsonb_build_object('texto',
        privado.texto_pagina(s -> 'contenido' -> 'texto', format('Sección "%s": el texto', v_nombre), 0, 1500)))
      when 'actividades' then jsonb_build_object('items', privado.lista_pagina(s -> 'contenido' -> 'items', format('Sección "%s"', v_nombre),
        '{"nombre": ["Actividad", 1, 40], "descripcion": ["Descripción de la actividad", 0, 160], "emoji": ["Emoji de la actividad", 0, 8]}'))
      when 'equipo' then jsonb_build_object('personas', privado.lista_pagina(s -> 'contenido' -> 'personas', format('Sección "%s"', v_nombre),
        '{"nombre": ["Nombre del profe", 1, 60], "rol": ["Especialidad del profe", 0, 60]}'))
      when 'preguntas' then jsonb_build_object('items', privado.lista_pagina(s -> 'contenido' -> 'items', format('Sección "%s"', v_nombre),
        '{"pregunta": ["Pregunta", 1, 160], "respuesta": ["Respuesta", 1, 800]}'))
      else null   -- planes, horarios, galería, ubicación: el contenido sale de otras pantallas
    end;
    update public.landing_secciones x set
      titulo = v_nombre, visible = (s ->> 'visible')::boolean, orden = i * 10,
      contenido = coalesce(v_contenido, x.contenido)
    where x.gimnasio_id = p_gimnasio_id and x.tipo = v_tipo;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Sección "%": no existe en la página de este gimnasio', v_nombre; end if;
  end loop;

  return public.pagina_panel(p_gimnasio_id);
end $$;

-- ── La portada nunca apunta a una foto que ya no está ──────────────
create or replace function privado.portada_sigue_en_galeria() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.tipo = 'galeria' then
    update public.landing_gimnasio l set foto_portada_path = null
     where l.gimnasio_id = new.gimnasio_id and l.foto_portada_path is not null
       and not coalesce(new.contenido -> 'fotos', '[]'::jsonb) ? l.foto_portada_path;
  end if;
  return null;
end $$;
drop trigger if exists portada_sigue_en_galeria on public.landing_secciones;
create trigger portada_sigue_en_galeria after update of contenido on public.landing_secciones
  for each row execute function privado.portada_sigue_en_galeria();

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function privado.landing_completa(uuid) from public, anon, authenticated;
revoke all on function public.landing_publica(text) from public, anon, authenticated;
grant execute on function public.landing_publica(text) to anon, authenticated, service_role;
revoke all on function privado.texto_pagina(jsonb, text, int, int), privado.lista_pagina(jsonb, text, jsonb),
  privado.portada_sigue_en_galeria() from public, anon, authenticated;
revoke all on function public.pagina_panel(uuid), public.guardar_pagina(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.pagina_panel(uuid), public.guardar_pagina(uuid, jsonb, jsonb) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'privado' and p.proname in ('texto_pagina', 'lista_pagina', 'portada_sigue_en_galeria', 'landing_completa'))
               or (s.nspname = 'public' and p.proname in ('pagina_panel', 'guardar_pagina', 'landing_publica')) loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if r.proname <> 'landing_publica' and has_function_privilege('anon', r.oid, 'execute') then
      raise exception 'Verificación: anon puede ejecutar %', r.proname;
    end if;
  end loop;
  if not has_function_privilege('anon', 'public.landing_publica(text)', 'execute') then
    raise exception 'Verificación: la página pública dejó de ser pública';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'portada_sigue_en_galeria' and not tgisinternal) then
    raise exception 'Verificación: falta el trigger de la foto de portada';
  end if;
end $$;
