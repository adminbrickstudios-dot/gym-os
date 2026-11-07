-- 6200 · Páginas, segunda pasada (VD-62, docs/v2/06-PAGINA.md).
--  * Portada con video: landing_gimnasio.video_portada_url (link directo https a un .mp4/.webm, lo pega el dueño).
--    La portada lo muestra mudo y en bucle; si no hay video, queda la foto como hasta ahora.
--  * El WhatsApp de BRIK para "Pedí una demo" en la página de Gym OS: un solo renglón de datos que carga el
--    super admin (plataforma_contacto). Nunca un número en el código.
-- Aditiva e idempotente. No toca nada entregado: reemplaza privado.landing_completa (misma firma) con la unión de
-- 6101 (equipo + prueba social) más el video.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.landing_gimnasio') is null then raise exception 'Guarda: falta landing_gimnasio'; end if;
  if to_regprocedure('privado.landing_completa(uuid)') is null then raise exception 'Guarda: falta privado.landing_completa'; end if;
  if to_regprocedure('privado.socios_redondeados(uuid)') is null then raise exception 'Guarda: falta privado.socios_redondeados (VD-25)'; end if;
  if to_regclass('public.equipo_perfil') is null then raise exception 'Guarda: falta equipo_perfil (VD-44)'; end if;
  if to_regprocedure('privado.soy_admin_plataforma()') is null then raise exception 'Guarda: falta privado.soy_admin_plataforma'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid,text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
end $$;

-- ── Video de portada ────────────────────────────────────────────────
alter table public.landing_gimnasio add column if not exists video_portada_url text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'landing_video_portada_valido') then
    alter table public.landing_gimnasio add constraint landing_video_portada_valido
      check (video_portada_url is null or (length(video_portada_url) <= 400 and video_portada_url ~* '^https://[^\s]+\.(mp4|webm)(\?[^\s]*)?$'));
  end if;
end $$;

create or replace function public.guardar_video_portada(p_gimnasio_id uuid, p_url text) returns text
language plpgsql security definer set search_path = '' as $$
declare u text := nullif(btrim(coalesce(p_url, '')), ''); n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if u is not null and not (length(u) <= 400 and u ~* '^https://[^\s]+\.(mp4|webm)(\?[^\s]*)?$') then
    raise exception 'Video de portada: pegá un link directo (https) a un archivo .mp4 o .webm' using errcode = '22023';
  end if;
  update public.landing_gimnasio set video_portada_url = u, actualizado_en = now() where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Este gimnasio no tiene página. Pedile a soporte BRIK que la cree.'; end if;
  return u;
end $$;

-- ── La página pública, con el video ─────────────────────────────────
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
                                  'boton_texto', l.boton_texto, 'video_url', l.video_portada_url),
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

-- ── El WhatsApp de BRIK (Pedí una demo) ─────────────────────────────
-- Una sola fila (id = true). No es de ningún gimnasio: va en la lista de excepciones de scripts/chequeos.mjs.
create table if not exists public.plataforma_contacto (
  id            boolean primary key default true check (id),
  whatsapp      text check (whatsapp is null or whatsapp ~ '^\+[0-9]{8,15}$'),
  mensaje_demo  text not null default 'Hola! Quiero ver una demo de Gym OS.' check (length(btrim(mensaje_demo)) between 1 and 300),
  actualizado_en timestamptz not null default now()
);
alter table public.plataforma_contacto enable row level security;
revoke all on table public.plataforma_contacto from anon, authenticated;
insert into public.plataforma_contacto (id) values (true) on conflict do nothing;

create or replace function public.contacto_plataforma_publico() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('whatsapp', c.whatsapp, 'mensaje_demo', c.mensaje_demo) from public.plataforma_contacto c where c.id;
$$;

create or replace function public.admin_guardar_contacto_plataforma(p_whatsapp text, p_mensaje text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare w text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '[\s\-()]', '', 'g'), ''); m text := nullif(btrim(coalesce(p_mensaje, '')), ''); n int;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if w is not null and w !~ '^\+[0-9]{8,15}$' then
    raise exception 'WhatsApp: con + y característica, solo números (ej: +5493875551234)' using errcode = '22023';
  end if;
  if m is not null and length(m) > 300 then raise exception 'El mensaje es muy largo (hasta 300 letras)' using errcode = '22023'; end if;
  update public.plataforma_contacto set whatsapp = w, mensaje_demo = coalesce(m, 'Hola! Quiero ver una demo de Gym OS.'), actualizado_en = now() where id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar el contacto de la plataforma' using errcode = 'XX000'; end if;
  return public.contacto_plataforma_publico();
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.guardar_video_portada(uuid, text), public.contacto_plataforma_publico(),
  public.admin_guardar_contacto_plataforma(text, text) from public, anon, authenticated;
grant execute on function public.guardar_video_portada(uuid, text), public.admin_guardar_contacto_plataforma(text, text) to authenticated, service_role;
grant execute on function public.contacto_plataforma_publico() to anon, authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare def text := pg_get_functiondef('privado.landing_completa(uuid)'::regprocedure);
begin
  if position('equipo_publico' in def) = 0 or position('prueba_social' in def) = 0 or position('video_url' in def) = 0 then
    raise exception 'Verificación: landing_completa perdió equipo, prueba social o el video';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'landing_gimnasio' and column_name = 'video_portada_url') then
    raise exception 'Verificación: falta video_portada_url';
  end if;
  if (select count(*) from public.plataforma_contacto) <> 1 then raise exception 'Verificación: plataforma_contacto tiene que tener una fila'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.plataforma_contacto'::regclass) then raise exception 'Verificación: plataforma_contacto sin RLS'; end if;
end $$;
