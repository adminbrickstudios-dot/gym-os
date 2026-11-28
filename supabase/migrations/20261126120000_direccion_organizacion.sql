-- Pase 2.0 · organización (26/11): la dirección trae la llave pase_2_organizacion, sin un viaje más (como pista_semaforo el 24/11).
-- Con ella el proxy lleva cada dirección vieja del panel a su pestaña y el marco arma el menú en bloques.
-- EXPANDIR: una columna más al FINAL de gimnasio_por_host / gimnasio_por_slug; el código anterior lee por nombre y no la usa.
-- Cambia la forma de lo que devuelve: la vieja se borra en esta misma migración (dos versiones harían ambigua la llamada).

do $g$ begin
  if not exists (select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where c ->> 'clave' = 'pase_2_organizacion') then
    raise exception 'Guarda: falta la llave pase_2_organizacion (20261126100000)';
  end if;
  if to_regprocedure('public.gimnasio_por_host(text)') is null or to_regprocedure('public.gimnasio_por_slug(text)') is null then
    raise exception 'Guarda: faltan gimnasio_por_host / gimnasio_por_slug';
  end if;
end $g$;

drop function if exists public.gimnasio_por_host(text);
create function public.gimnasio_por_host(p_host text)
 returns table(gimnasio_id uuid, slug text, nombre text, zona_horaria text, logo_path text, favicon_path text, color_acento text, color_fondo text, estilo text, modo text, semaforo boolean, organizacion boolean)
 language sql stable security definer set search_path = ''
as $f$
  select g.id, g.slug, g.nombre, g.zona_horaria, c.logo_path, c.favicon_path, c.color_acento, c.color_fondo, c.estilo, c.modo,
         coalesce((select f.activa from public.funciones_nuevas_gimnasio f where f.gimnasio_id = g.id and f.clave = 'pista_semaforo'), false),
         coalesce((select f.activa from public.funciones_nuevas_gimnasio f where f.gimnasio_id = g.id and f.clave = 'pase_2_organizacion'), false)
    from public.dominios_gimnasio d
    join public.gimnasios g on g.id = d.gimnasio_id
    join public.configuracion_gimnasio c on c.gimnasio_id = g.id
   where d.host = lower(p_host)
$f$;

drop function if exists public.gimnasio_por_slug(text);
create function public.gimnasio_por_slug(p_slug text)
 returns table(gimnasio_id uuid, slug text, nombre text, zona_horaria text, logo_path text, favicon_path text, color_acento text, color_fondo text, host text, estilo text, modo text, semaforo boolean, organizacion boolean)
 language sql stable security definer set search_path = ''
as $f$
  select g.id, g.slug, g.nombre, g.zona_horaria, c.logo_path, c.favicon_path, c.color_acento, c.color_fondo,
         (select d.host from public.dominios_gimnasio d where d.gimnasio_id = g.id
           order by (d.tipo = 'propio') desc, d.creado_en limit 1), c.estilo, c.modo,
         coalesce((select f.activa from public.funciones_nuevas_gimnasio f where f.gimnasio_id = g.id and f.clave = 'pista_semaforo'), false),
         coalesce((select f.activa from public.funciones_nuevas_gimnasio f where f.gimnasio_id = g.id and f.clave = 'pase_2_organizacion'), false)
    from public.gimnasios g
    join public.configuracion_gimnasio c on c.gimnasio_id = g.id
   where g.slug = lower(p_slug)
$f$;

revoke all on function public.gimnasio_por_host(text), public.gimnasio_por_slug(text) from public;
grant execute on function public.gimnasio_por_host(text), public.gimnasio_por_slug(text) to anon, authenticated, service_role;

do $v$
declare f text;
begin
  foreach f in array array['public.gimnasio_por_host(text)', 'public.gimnasio_por_slug(text)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if not has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: el proxy (anon) no puede ejecutar %', f; end if;
    if position('pase_2_organizacion' in pg_get_functiondef(f::regprocedure)) = 0 then raise exception 'Verificación: % sin la llave', f; end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('gimnasio_por_host', 'gimnasio_por_slug')) <> 2 then
    raise exception 'Verificación: quedó más de una versión de gimnasio_por_host/slug';
  end if;
end $v$;
