-- H7 · Exportar socios con los filtros de la lista (estado, plan, origen), sin el tope de 100 filas de buscar_socios.
-- Antes el botón de Socios, con un filtro de estado/plan/origen puesto, decía "Exportar todos los socios" porque exportar_socios solo
-- entendía texto y etiqueta. Ahora el archivo tiene lo mismo que la lista: el universo de buscar_socios (texto con tolerancia de tipeo,
-- número, etiqueta, plan, origen web, estado por el grupo del veredicto de la puerta, bajas) pero sin límite de filas, en páginas
-- (p_desde / p_cantidad, hasta 1.000 por llamada: el servidor las junta; PostgREST corta por su cuenta en 1.000).
-- NO cambia ningún veredicto: la columna "Estado" sigue saliendo de privado.calcular_acceso(socio, momento, null) como antes, y el
-- filtro de estado usa la misma cuenta y la sede de quien exporta, como la lista. La cuenta vive en privado.exportar_socios_calc con
-- el momento como parámetro para probarla con momentos fijos contra una copia de la función de antes (exportar-filtros.test.mjs).
-- Cambia la firma: la de 3 parámetros se borra acá (dos versiones con defaults hacen ambigua la llamada). Mismo permiso (dueño y
-- encargado) y mismo aal2 de antes.

do $g$ begin
  if to_regprocedure('public.exportar_socios(uuid, text, uuid)') is null and to_regprocedure('public.exportar_socios(uuid, text, uuid, text, uuid, text, integer, integer)') is null then
    raise exception 'Guarda: falta public.exportar_socios';
  end if;
  if to_regprocedure('privado.calcular_acceso(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta calcular_acceso'; end if;
  if to_regprocedure('privado.grupo_estado(text, text)') is null then raise exception 'Guarda: falta grupo_estado'; end if;
  if to_regprocedure('privado.exigir_aal2(uuid)') is null then raise exception 'Guarda: falta exigir_aal2'; end if;
  if to_regprocedure('extensions.word_similarity(text, text)') is null then raise exception 'Guarda: falta pg_trgm'; end if;
end $g$;

drop function if exists public.exportar_socios(uuid, text, uuid);

create or replace function privado.exportar_socios_calc(p_gimnasio_id uuid, p_momento timestamptz, p_sede_id uuid, p_texto text, p_etiqueta uuid,
                                                         p_estado text, p_plan uuid, p_origen text, p_desde int, p_cantidad int)
returns table (numero int, nombre text, apellido text, dni text, telefono text, email text, nacimiento date, plan text,
               estado text, cubierto_hasta date, alta date, dado_de_baja date, etiquetas text)
language plpgsql stable set search_path = '' as $$
declare t text := privado.sin_acentos(lower(trim(coalesce(p_texto, '')))); digitos text; zona text;
        por_estado boolean := coalesce(p_estado in ('al_dia', 'por_vencer', 'vencidos', 'en_pausa', 'sin_plan'), false);
begin
  if p_estado is not null and not por_estado and p_estado not in ('nuevos', 'bajas') then raise exception 'Filtro desconocido: %', p_estado; end if;
  if p_origen is not null and p_origen <> 'web' then raise exception 'Filtro desconocido: %', p_origen; end if;
  if p_desde is null or p_desde < 0 then raise exception 'El desde no puede ser negativo'; end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 1000 then raise exception 'La cantidad va de 1 a 1000'; end if;
  digitos := regexp_replace(t, '\D', '', 'g');
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  return query
  select s.numero, s.nombre, s.apellido, s.dni, s.telefono, s.email, s.fecha_nacimiento,
         (select pl.nombre from public.suscripciones su join public.planes pl on pl.id = su.plan_id
           where su.socio_id = s.id and su.baja_en is null order by su.inicio desc limit 1),
         v.texto,
         case when v.vence_en is not null then ((v.vence_en - interval '1 second') at time zone zona)::date end,
         (s.creado_en at time zone zona)::date,
         (s.dado_de_baja_en at time zone zona)::date,
         (select string_agg(e.nombre, ', ' order by lower(e.nombre)) from public.socio_etiquetas se join public.etiquetas e on e.id = se.etiqueta_id
           where se.socio_id = s.id)
    from public.socios s
    cross join lateral privado.calcular_acceso(s.id, p_momento, null) v
   where s.gimnasio_id = p_gimnasio_id
     and (p_etiqueta is null or exists (select 1 from public.socio_etiquetas se where se.gimnasio_id = p_gimnasio_id and se.socio_id = s.id and se.etiqueta_id = p_etiqueta))
     and (p_plan is null or exists (select 1 from public.suscripciones su where su.socio_id = s.id and su.baja_en is null and su.plan_id = p_plan))
     and (p_origen is null or s.origen = 'alta_web')
     and (p_estado is null or (p_estado = 'bajas') = (s.dado_de_baja_en is not null))
     and (p_estado is distinct from 'nuevos' or s.creado_en > p_momento - interval '30 days')
     and (not por_estado or (select privado.grupo_estado(x.color, x.motivo) from privado.calcular_acceso(s.id, p_momento, p_sede_id) x) = p_estado)
     and (t = ''
       or privado.sin_acentos(lower(s.nombre || ' ' || s.apellido)) like '%' || t || '%'
       or privado.sin_acentos(lower(s.apellido || ' ' || s.nombre)) like '%' || t || '%'
       or (length(t) >= 4 and (extensions.word_similarity(t, privado.sin_acentos(lower(s.nombre || ' ' || s.apellido))) >= 0.6
                               or extensions.word_similarity(t, privado.sin_acentos(lower(s.apellido || ' ' || s.nombre))) >= 0.6))
       or (length(digitos) >= 3 and (s.dni like digitos || '%' or regexp_replace(coalesce(s.telefono, ''), '\D', '', 'g') like '%' || digitos || '%'))
       or (digitos <> '' and s.numero::text = digitos))
   order by s.apellido, s.nombre, s.numero
   offset p_desde limit p_cantidad;
end $$;
revoke all on function privado.exportar_socios_calc(uuid, timestamptz, uuid, text, uuid, text, uuid, text, int, int) from public, anon, authenticated;

create or replace function public.exportar_socios(p_gimnasio_id uuid, p_texto text default null, p_etiqueta uuid default null,
                                                  p_estado text default null, p_plan uuid default null, p_origen text default null,
                                                  p_desde int default 0, p_cantidad int default 1000)
returns table (numero int, nombre text, apellido text, dni text, telefono text, email text, nacimiento date, plan text,
               estado text, cubierto_hasta date, alta date, dado_de_baja date, etiquetas text)
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  perform privado.exigir_aal2(p_gimnasio_id);
  return query select * from privado.exportar_socios_calc(p_gimnasio_id, now(), e.sede_id, p_texto, p_etiqueta, p_estado, p_plan, p_origen, p_desde, p_cantidad);
end $$;

revoke all on function public.exportar_socios(uuid, text, uuid, text, uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.exportar_socios(uuid, text, uuid, text, uuid, text, integer, integer) to authenticated, service_role;

do $v$
declare f text;
begin
  foreach f in array array['public.exportar_socios(uuid, text, uuid, text, uuid, text, integer, integer)',
                           'privado.exportar_socios_calc(uuid, timestamptz, uuid, text, uuid, text, uuid, text, integer, integer)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if has_function_privilege('authenticated', 'privado.exportar_socios_calc(uuid, timestamptz, uuid, text, uuid, text, uuid, text, integer, integer)', 'execute') then
    raise exception 'Verificación: el cálculo privado no es para el navegador';
  end if;
  if (select count(*) from pg_proc where proname = 'exportar_socios' and pronamespace = 'public'::regnamespace) <> 1 then
    raise exception 'Verificación: quedó más de una exportar_socios';
  end if;
  if position('exigir_aal2' in pg_get_functiondef('public.exportar_socios(uuid, text, uuid, text, uuid, text, integer, integer)'::regprocedure)) = 0
     or position('exigir_equipo' in pg_get_functiondef('public.exportar_socios(uuid, text, uuid, text, uuid, text, integer, integer)'::regprocedure)) = 0 then
    raise exception 'Verificación: exportar_socios perdió el permiso o el aal2';
  end if;
end $v$;
