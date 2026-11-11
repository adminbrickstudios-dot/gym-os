-- P8 / P8b · Estilo de la página del gimnasio y clases de la semana.
--  1) landing_gimnasio.tipografia: la letra de los títulos (condensada, ancha o clásica). Aditiva, con default.
--  2) privado.landing_completa suma marca.tipografia a lo que ya devolvía (se envuelve la anterior, como se hizo con
--     landing_publica: lo que otras migraciones le agregaron sigue igual). La usan la página pública y la vista previa.
--  3) guardar_estilo_pagina: colores y letra, solo el dueño. Devuelve la página como quedó (pagina_panel).
--  4) pagina_por_defecto: lo que vale "Restaurar por defecto" (portada, secciones y estilo de un gimnasio nuevo), solo lectura:
--     el editor lo carga como borrador, se puede deshacer y recién se guarda con Guardar.
--  5) clases_semana_publica: las clases de los próximos 7 días para el bloque Horarios de la página, sin sesión, solo si la
--     página está publicada y la sección Horarios se muestra.
-- Sin tablas nuevas: la RLS de landing_gimnasio y configuracion_gimnasio sigue como estaba.

do $g$
begin
  if to_regclass('public.landing_gimnasio') is null or to_regclass('public.landing_secciones') is null then
    raise exception 'Guarda: faltan las tablas de la página';
  end if;
  if to_regprocedure('privado.landing_completa(uuid)') is null and to_regprocedure('privado.landing_completa_base(uuid)') is null then
    raise exception 'Guarda: falta privado.landing_completa';
  end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
  if to_regprocedure('public.pagina_panel(uuid)') is null then raise exception 'Guarda: falta public.pagina_panel'; end if;
  if to_regclass('public.clases') is null or to_regclass('public.actividades') is null then raise exception 'Guarda: faltan clases o actividades'; end if;
end $g$;

-- ── 1) La letra ──────────────────────────────────────────────────────
alter table public.landing_gimnasio add column if not exists tipografia text not null default 'condensada';
alter table public.landing_gimnasio drop constraint if exists landing_gimnasio_tipografia_check;
alter table public.landing_gimnasio add constraint landing_gimnasio_tipografia_check
  check (tipografia in ('condensada', 'ancha', 'clasica'));

-- ── 2) La página completa, con la letra ──────────────────────────────
do $envolver$
begin
  if to_regprocedure('privado.landing_completa_base(uuid)') is null then
    alter function privado.landing_completa(uuid) rename to landing_completa_base;
  end if;
end $envolver$;
revoke all on function privado.landing_completa_base(uuid) from public, anon, authenticated;

create or replace function privado.landing_completa(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb; v_tipo text;
begin
  r := privado.landing_completa_base(p_gimnasio_id);
  if r is null then return null; end if;
  select l.tipografia into v_tipo from public.landing_gimnasio l where l.gimnasio_id = p_gimnasio_id;
  return jsonb_set(r, '{marca,tipografia}', to_jsonb(coalesce(v_tipo, 'condensada')));
end $$;
revoke all on function privado.landing_completa(uuid) from public, anon, authenticated;

-- ── 3) Guardar colores y letra ───────────────────────────────────────
create or replace function public.guardar_estilo_pagina(p_gimnasio_id uuid, p_color_acento text, p_color_fondo text, p_tipografia text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_color_acento is null or p_color_acento !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Color principal: tiene que ser un color como #16a34a'; end if;
  if p_color_fondo is null or p_color_fondo !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Color de fondo: tiene que ser un color como #F4F5F6'; end if;
  if p_tipografia is null or p_tipografia not in ('condensada', 'ancha', 'clasica') then raise exception 'Letra: elegí condensada, ancha o clásica'; end if;
  update public.configuracion_gimnasio set color_acento = lower(p_color_acento), color_fondo = lower(p_color_fondo) where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Este gimnasio no tiene configuración. Pedile a soporte BRIK que la cree.'; end if;
  update public.landing_gimnasio set tipografia = p_tipografia where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Este gimnasio no tiene página. Pedile a soporte BRIK que la cree.'; end if;
  return public.pagina_panel(p_gimnasio_id);
end $$;
revoke all on function public.guardar_estilo_pagina(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.guardar_estilo_pagina(uuid, text, text, text) to authenticated, service_role;

-- ── 4) Lo que vale "Restaurar por defecto" ───────────────────────────
-- Los textos de las secciones quedan vacíos a propósito: la página completa lo vacío con un texto sensato según el tipo de gimnasio.
-- El logo y las fotos son archivos del gimnasio, no estilo: no se tocan.
create or replace function public.pagina_por_defecto(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g public.gimnasios;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select gi.* into g from public.gimnasios gi where gi.id = p_gimnasio_id;
  if not found then raise exception 'Este gimnasio no existe.'; end if;
  return jsonb_build_object(
    'portada', jsonb_build_object('titulo', left(g.nombre, 80), 'bajada', null, 'boton_texto', 'Quiero empezar',
                                  'foto_portada_path', null, 'mensaje_whatsapp', 'Hola! Quiero info para empezar a entrenar.',
                                  'mostrar_precios', true),
    'secciones', (
      select coalesce(jsonb_agg(jsonb_build_object('tipo', d.tipo, 'titulo', d.titulo, 'visible', true, 'contenido', '{}'::jsonb) order by d.orden), '[]'::jsonb)
        from (values ('sobre_nosotros', 'Quiénes somos', 10), ('actividades', 'Qué podés hacer', 20), ('planes', 'Planes', 30),
                     ('horarios', 'Horarios', 40), ('galeria', 'El gimnasio', 50), ('equipo', 'Profes', 60),
                     ('preguntas', 'Preguntas frecuentes', 70), ('ubicacion', 'Dónde estamos', 80), ('probar', 'Probá una clase', 90)) as d(tipo, titulo, orden)
       where exists (select 1 from public.landing_secciones s where s.gimnasio_id = p_gimnasio_id and s.tipo = d.tipo)),
    'estilo', jsonb_build_object('color_acento', '#16a34a', 'color_fondo', '#f4f5f6', 'tipografia', 'condensada'));
end $$;
revoke all on function public.pagina_por_defecto(uuid) from public, anon, authenticated;
grant execute on function public.pagina_por_defecto(uuid) to authenticated, service_role;

-- ── 5) Clases de la semana, para la página ───────────────────────────
create or replace function public.clases_semana_publica(p_host text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; zona text;
begin
  select d.gimnasio_id into g from public.dominios_gimnasio d
    join public.landing_gimnasio l on l.gimnasio_id = d.gimnasio_id and l.publicada
    join public.landing_secciones s on s.gimnasio_id = d.gimnasio_id and s.tipo = 'horarios' and s.visible
   where d.host = lower(p_host);
  if g is null then return '[]'::jsonb; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = g and gi.baja_en is null;
  if zona is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'inicio', x.inicio, 'actividad', x.actividad, 'sede', x.sede, 'zona', zona,
             'dia', to_char(x.inicio at time zone zona, 'YYYY-MM-DD'), 'hora', to_char(x.inicio at time zone zona, 'HH24:MI')) order by x.inicio)
      from (
        select c.inicio, a.nombre as actividad, s.nombre as sede
          from public.clases c
          join public.actividades a on a.id = c.actividad_id
          join public.sedes s on s.id = c.sede_id
         where c.gimnasio_id = g and c.cancelada_en is null and c.inicio >= now() and c.inicio < now() + interval '7 days'
         order by c.inicio limit 80
      ) x), '[]'::jsonb);
end $$;
revoke all on function public.clases_semana_publica(text) from public, anon, authenticated;
grant execute on function public.clases_semana_publica(text) to anon, authenticated, service_role;

-- ── Verificación ─────────────────────────────────────────────────────
do $v$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'landing_gimnasio' and column_name = 'tipografia') then
    raise exception 'Verificación: falta landing_gimnasio.tipografia';
  end if;
  if to_regprocedure('privado.landing_completa_base(uuid)') is null then raise exception 'Verificación: falta la función envuelta'; end if;
  if not has_function_privilege('anon', 'public.clases_semana_publica(text)', 'execute') then raise exception 'Verificación: la página no puede leer las clases'; end if;
  if has_function_privilege('anon', 'public.guardar_estilo_pagina(uuid, text, text, text)', 'execute') then raise exception 'Verificación: anon puede guardar el estilo'; end if;
  if has_function_privilege('anon', 'public.pagina_por_defecto(uuid)', 'execute') then raise exception 'Verificación: anon puede leer el estilo por defecto'; end if;
  if has_function_privilege('authenticated', 'privado.landing_completa_base(uuid)', 'execute') then raise exception 'Verificación: la función envuelta quedó abierta'; end if;
end $v$;
