-- DETALLE #1 (carril D) · La búsqueda de socios tolera errores de tipeo ("gonzales" encuentra a González), además de acentos y mayúsculas
-- (que ya toleraba). Es la definición VIGENTE de public.buscar_socios con una condición más (similitud de palabra de pg_trgm, 0,6),
-- solo para textos de 4 letras o más. Mismas columnas, mismos permisos (create or replace conserva los grants).

do $g$ begin
  if to_regprocedure('public.buscar_socios(uuid, text, integer, uuid, text, uuid, text)') is null then raise exception 'Guarda: falta buscar_socios'; end if;
  if to_regprocedure('extensions.word_similarity(text, text)') is null then raise exception 'Guarda: falta pg_trgm'; end if;
end $g$;

CREATE OR REPLACE FUNCTION public.buscar_socios(p_gimnasio_id uuid, p_texto text, p_limite integer DEFAULT 30, p_etiqueta uuid DEFAULT NULL::uuid, p_estado text DEFAULT NULL::text, p_plan uuid DEFAULT NULL::uuid, p_origen text DEFAULT NULL::text)
 RETURNS TABLE(socio_id uuid, numero integer, nombre text, telefono text, dni text, plan text, color text, texto text, puede boolean, dado_de_baja boolean, autoalta boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.equipo; t text := privado.sin_acentos(lower(trim(coalesce(p_texto, '')))); digitos text;
        por_estado boolean := coalesce(p_estado in ('al_dia', 'por_vencer', 'vencidos', 'en_pausa', 'sin_plan'), false);
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if p_limite is null or p_limite < 1 or p_limite > 100 then raise exception 'El límite va de 1 a 100'; end if;
  if p_estado is not null and not por_estado and p_estado not in ('nuevos', 'bajas') then raise exception 'Filtro desconocido: %', p_estado; end if;
  if p_origen is not null and p_origen <> 'web' then raise exception 'Filtro desconocido: %', p_origen; end if;
  digitos := regexp_replace(t, '\D', '', 'g');
  return query
  with candidatos as (
    select s.*, (s.dado_de_baja_en is not null) as baja from public.socios s
     where s.gimnasio_id = p_gimnasio_id
       and (p_etiqueta is null or exists (select 1 from public.socio_etiquetas se where se.gimnasio_id = p_gimnasio_id
                                            and se.socio_id = s.id and se.etiqueta_id = p_etiqueta))
       and (p_plan is null or exists (select 1 from public.suscripciones su where su.socio_id = s.id and su.baja_en is null and su.plan_id = p_plan))
       and (p_origen is null or s.origen = 'alta_web')
       and (p_estado is null or (p_estado = 'bajas') = (s.dado_de_baja_en is not null))
       and (p_estado is distinct from 'nuevos' or s.creado_en > now() - interval '30 days')
       and (t = ''
         or privado.sin_acentos(lower(s.nombre || ' ' || s.apellido)) like '%' || t || '%'
         or privado.sin_acentos(lower(s.apellido || ' ' || s.nombre)) like '%' || t || '%'
         or (length(t) >= 4 and (extensions.word_similarity(t, privado.sin_acentos(lower(s.nombre || ' ' || s.apellido))) >= 0.6
                                 or extensions.word_similarity(t, privado.sin_acentos(lower(s.apellido || ' ' || s.nombre))) >= 0.6))
         or (length(digitos) >= 3 and (s.dni like digitos || '%' or regexp_replace(coalesce(s.telefono, ''), '\D', '', 'g') like '%' || digitos || '%'))
         or (digitos <> '' and s.numero::text = digitos))
     order by (s.dado_de_baja_en is not null), s.nombre, s.apellido
     limit case when por_estado then null else p_limite end
  )
  select s.id, s.numero, trim(s.nombre || ' ' || s.apellido), s.telefono, s.dni,
         (select pl.nombre from public.suscripciones su join public.planes pl on pl.id = su.plan_id
           where su.socio_id = s.id and su.baja_en is null order by su.inicio desc limit 1),
         v.color, v.texto, v.puede, s.baja, (s.origen = 'alta_web')
    from (select c.* from candidatos c order by c.baja, c.nombre, c.apellido) s
    cross join lateral privado.calcular_acceso(s.id, now(), e.sede_id) v
   where not por_estado or privado.grupo_estado(v.color, v.motivo) = p_estado
   order by s.baja, s.nombre, s.apellido
   limit p_limite;
end $function$;

do $v$ begin
  if has_function_privilege('anon', 'public.buscar_socios(uuid, text, integer, uuid, text, uuid, text)', 'execute') then raise exception 'buscar_socios no es para anónimos'; end if;
  if not has_function_privilege('authenticated', 'public.buscar_socios(uuid, text, integer, uuid, text, uuid, text)', 'execute') then raise exception 'buscar_socios perdió el permiso'; end if;
end $v$;
