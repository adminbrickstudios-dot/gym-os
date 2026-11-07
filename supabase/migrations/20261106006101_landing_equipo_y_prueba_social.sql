-- 6101 · La página con prueba social (VD-25, 6100) Y con el equipo (VD-44, 5400).
-- Las dos migraciones copiaron la definición de 0032 por separado; como la 6100 corre
-- después de la 5400, sola le sacaba el equipo a la página. Acá queda la unión de las dos.
-- Aditiva e idempotente: solo reemplaza la función privada, con la misma firma.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.landing_completa(uuid)') is null then raise exception 'Guarda: falta privado.landing_completa'; end if;
  if to_regprocedure('privado.socios_redondeados(uuid)') is null then raise exception 'Guarda: falta privado.socios_redondeados (VD-25)'; end if;
  if to_regclass('public.equipo_perfil') is null or to_regclass('public.equipo_ajustes') is null then raise exception 'Guarda: falta el perfil del equipo (VD-44)'; end if;
end $$;

create or replace function privado.landing_completa(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  g public.gimnasios; c public.configuracion_gimnasio; l public.landing_gimnasio;
  marca jsonb; secciones jsonb; planes jsonb; sedes jsonb; prueba jsonb; equipo_publico jsonb;
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

  prueba := jsonb_build_object(
    'socios', case when l.mostrar_socios then privado.socios_redondeados(g.id) else null end,
    'resena', case when l.resena_puntaje is not null
                   then jsonb_build_object('puntaje', l.resena_puntaje, 'cantidad', l.resena_cantidad, 'link', c.link_resena)
                   else null end);

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
    'prueba_social', prueba,
    'secciones', secciones,
    'planes', planes,
    'sedes', sedes,
    'equipo_publico', equipo_publico
  );
end $$;
revoke all on function privado.landing_completa(uuid) from public, anon, authenticated;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare def text := pg_get_functiondef('privado.landing_completa(uuid)'::regprocedure);
begin
  if position('equipo_publico' in def) = 0 then raise exception 'Verificación: la página perdió el equipo'; end if;
  if position('prueba_social' in def) = 0 then raise exception 'Verificación: la página perdió la prueba social'; end if;
  if not exists (select 1 from pg_proc where oid = 'privado.landing_completa(uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: landing_completa sin search_path vacío';
  end if;
end $$;
