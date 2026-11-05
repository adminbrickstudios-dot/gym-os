-- 0029 · Página sin publicar con WhatsApp (AUD-2).
-- El "Próximamente" mostraba solo el nombre: quien llegaba por el link no
-- tenía cómo hablar con el gimnasio. Ahora devuelve también el WhatsApp de la
-- página (lo mismo que se ve publicada; nada que no fuera ya público al publicar).
-- Copia de landing_publica (0008) con un solo cambio: el retorno sin publicar.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.landing_publica(text)') is null then
    raise exception 'Guarda: falta public.landing_publica(text) (migración 0008)';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'landing_gimnasio' and column_name = 'mensaje_whatsapp') then
    raise exception 'Guarda: falta landing_gimnasio.mensaje_whatsapp';
  end if;
end $$;

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
    -- Sin publicar: la marca y el WhatsApp (si lo cargó), para que el "Próximamente" no sea un callejón.
    return jsonb_build_object('publicada', false, 'marca', marca,
                              'contacto', jsonb_build_object('whatsapp', l.whatsapp, 'mensaje_whatsapp', l.mensaje_whatsapp));
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

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare d text;
begin
  select pg_get_functiondef('public.landing_publica(text)'::regprocedure) into d;
  if d not like '%''publicada'', false, ''marca'', marca,%''contacto''%' then
    raise exception 'Verificación: landing_publica sin publicar no devuelve el contacto';
  end if;
  if not exists (select 1 from pg_proc where oid = 'public.landing_publica(text)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: landing_publica sin search_path vacío';
  end if;
end $$;
