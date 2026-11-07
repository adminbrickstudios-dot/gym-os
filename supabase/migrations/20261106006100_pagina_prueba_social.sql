-- 0161 · Página del gimnasio rediseñada: prueba social (VD-25).
-- El dueño elige si la portada muestra "+N socios" y, si quiere, el puntaje y
-- la cantidad de reseñas de Google (los escribe él: Google no se consulta
-- desde acá). El link de reseñas es el de Configuración (link_resena).
--   prueba_social_panel(gimnasio)                         dueño y encargado
--   guardar_prueba_social(gimnasio, socios, puntaje, n)   dueño
--   privado.landing_completa(gimnasio)                    suma 'prueba_social'
-- El "+N" se calcula de los socios sin baja, redondeado hacia abajo (nunca se
-- guarda ni se muestra un número chico: debajo de 20 no se muestra).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.landing_gimnasio') is null then raise exception 'Guarda: falta landing_gimnasio'; end if;
  if to_regprocedure('privado.landing_completa(uuid)') is null then raise exception 'Guarda: falta privado.landing_completa'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'link_resena') then
    raise exception 'Guarda: falta configuracion_gimnasio.link_resena';
  end if;
end $$;

alter table public.landing_gimnasio add column if not exists mostrar_socios boolean;
update public.landing_gimnasio set mostrar_socios = false where mostrar_socios is null;
alter table public.landing_gimnasio alter column mostrar_socios set default false;
alter table public.landing_gimnasio alter column mostrar_socios set not null;
alter table public.landing_gimnasio add column if not exists resena_puntaje numeric(2,1);
alter table public.landing_gimnasio add column if not exists resena_cantidad int;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'landing_gimnasio_resena_check') then
    alter table public.landing_gimnasio add constraint landing_gimnasio_resena_check check (
      (resena_puntaje is null and resena_cantidad is null)
      or (resena_puntaje between 1 and 5 and resena_cantidad between 1 and 100000));
  end if;
end $$;

-- ── Socios redondeados hacia abajo ──────────────────────────────────
create or replace function privado.socios_redondeados(p_gimnasio_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select case when n >= 1000 then (n / 100) * 100 when n >= 100 then (n / 50) * 50 when n >= 20 then (n / 10) * 10 else null end
    from (select count(*)::int n from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null) x
$$;

-- ── La página completa (la definición de la 0032 + prueba_social) ───
create or replace function privado.landing_completa(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  g public.gimnasios; c public.configuracion_gimnasio; l public.landing_gimnasio;
  marca jsonb; secciones jsonb; planes jsonb; sedes jsonb; prueba jsonb;
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
    'sedes', sedes
  );
end $$;

-- ── Panel ───────────────────────────────────────────────────────────
create or replace function public.prueba_social_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare l public.landing_gimnasio; c public.configuracion_gimnasio;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select * into l from public.landing_gimnasio where gimnasio_id = p_gimnasio_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  return jsonb_build_object('mostrar_socios', coalesce(l.mostrar_socios, false), 'resena_puntaje', l.resena_puntaje,
                            'resena_cantidad', l.resena_cantidad, 'link_resena', c.link_resena,
                            'socios_ahora', privado.socios_redondeados(p_gimnasio_id));
end $$;

create or replace function public.guardar_prueba_social(p_gimnasio_id uuid, p_mostrar_socios boolean, p_puntaje numeric, p_cantidad int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_mostrar_socios is null then raise exception 'Elegí si se muestra la cantidad de socios' using errcode = '22023'; end if;
  if (p_puntaje is null) <> (p_cantidad is null) then
    raise exception 'Reseñas: completá el puntaje y la cantidad, o dejá los dos vacíos' using errcode = '22023';
  end if;
  if p_puntaje is not null and (p_puntaje < 1 or p_puntaje > 5) then
    raise exception 'Reseñas: el puntaje va de 1 a 5 (ej: 4.8)' using errcode = '22023';
  end if;
  if p_cantidad is not null and (p_cantidad < 1 or p_cantidad > 100000) then
    raise exception 'Reseñas: la cantidad va de 1 a 100.000' using errcode = '22023';
  end if;
  update public.landing_gimnasio set mostrar_socios = p_mostrar_socios, resena_puntaje = round(p_puntaje, 1),
         resena_cantidad = p_cantidad, actualizado_en = now()
   where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Primero armá la página (Tu página → Guardar).' using errcode = '22023'; end if;
  return public.prueba_social_panel(p_gimnasio_id);
end $$;

revoke all on function privado.socios_redondeados(uuid), privado.landing_completa(uuid) from public, anon, authenticated;
revoke all on function public.prueba_social_panel(uuid), public.guardar_prueba_social(uuid, boolean, numeric, int) from public, anon, authenticated;
grant execute on function public.prueba_social_panel(uuid), public.guardar_prueba_social(uuid, boolean, numeric, int) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'landing_gimnasio' and column_name = 'mostrar_socios') then
    raise exception 'Verificación: falta mostrar_socios';
  end if;
  if has_function_privilege('anon', 'public.guardar_prueba_social(uuid, boolean, numeric, int)', 'execute') then raise exception 'Verificación: guardar_prueba_social quedó para anon'; end if;
  if has_function_privilege('anon', 'public.prueba_social_panel(uuid)', 'execute') then raise exception 'Verificación: prueba_social_panel quedó para anon'; end if;
  if has_function_privilege('anon', 'privado.landing_completa(uuid)', 'execute') then raise exception 'Verificación: landing_completa quedó para anon'; end if;
end $$;
