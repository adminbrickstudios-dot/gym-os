-- 0045 · Filtros de la lista de Socios por estado y plan (SOC-12).
-- El estado sale de calcular_acceso (la misma función de la puerta), nunca
-- de un cálculo aparte: privado.grupo_estado solo agrupa su color y motivo.
-- buscar_socios suma p_estado y p_plan (la firma vieja se borra: dos
-- versiones con defaults harían ambigua la llamada). filtros_socios da la
-- cuenta de cada píldora.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.aptos_fisicos') is null then raise exception 'Guarda: falta la migración 0044'; end if;
  if to_regprocedure('public.buscar_socios(uuid, text, integer, uuid)') is null
     and to_regprocedure('public.buscar_socios(uuid, text, integer, uuid, text, uuid)') is null then
    raise exception 'Guarda: falta buscar_socios (0036)';
  end if;
end $$;

-- Grupo de la lista a partir del veredicto de la puerta.
create or replace function privado.grupo_estado(p_color text, p_motivo text) returns text
language sql immutable set search_path = '' as $$
  select case when p_motivo = 'congelada' then 'en_pausa'
              when p_color = 'verde' then 'al_dia'
              when p_color in ('amarillo', 'naranja') then 'por_vencer'
              when p_color = 'rojo' then 'vencidos'
              else 'sin_plan' end
$$;
revoke all on function privado.grupo_estado(text, text) from public, anon, authenticated;

drop function if exists public.buscar_socios(uuid, text, integer, uuid);
create or replace function public.buscar_socios(p_gimnasio_id uuid, p_texto text, p_limite int default 30, p_etiqueta uuid default null,
                                                p_estado text default null, p_plan uuid default null)
returns table (socio_id uuid, numero int, nombre text, telefono text, dni text, plan text,
               color text, texto text, puede boolean, dado_de_baja boolean)
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; t text := privado.sin_acentos(lower(trim(coalesce(p_texto, '')))); digitos text;
        por_estado boolean := coalesce(p_estado in ('al_dia', 'por_vencer', 'vencidos', 'en_pausa', 'sin_plan'), false);
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if p_limite is null or p_limite < 1 or p_limite > 100 then raise exception 'El límite va de 1 a 100'; end if;
  if p_estado is not null and not por_estado and p_estado not in ('nuevos', 'bajas') then raise exception 'Filtro desconocido: %', p_estado; end if;
  digitos := regexp_replace(t, '\D', '', 'g');
  return query
  with candidatos as (
    select s.* from public.socios s
     where s.gimnasio_id = p_gimnasio_id
       and (p_etiqueta is null or exists (select 1 from public.socio_etiquetas se where se.gimnasio_id = p_gimnasio_id
                                            and se.socio_id = s.id and se.etiqueta_id = p_etiqueta))
       and (p_plan is null or exists (select 1 from public.suscripciones su where su.socio_id = s.id and su.baja_en is null and su.plan_id = p_plan))
       and (p_estado is null or (p_estado = 'bajas') = (s.dado_de_baja_en is not null))
       and (p_estado is distinct from 'nuevos' or s.creado_en > now() - interval '30 days')
       and (t = ''
         or privado.sin_acentos(lower(s.nombre || ' ' || s.apellido)) like '%' || t || '%'
         or privado.sin_acentos(lower(s.apellido || ' ' || s.nombre)) like '%' || t || '%'
         or (length(digitos) >= 3 and (s.dni like digitos || '%' or regexp_replace(coalesce(s.telefono, ''), '\D', '', 'g') like '%' || digitos || '%'))
         or (digitos <> '' and s.numero::text = digitos))
     order by (s.dado_de_baja_en is not null), s.nombre, s.apellido
     -- Por estado hay que mirar a todos (el estado no está guardado); si no, alcanza con los primeros.
     limit case when por_estado then null else p_limite end
  )
  select s.id, s.numero, trim(s.nombre || ' ' || s.apellido), s.telefono, s.dni,
         (select pl.nombre from public.suscripciones su join public.planes pl on pl.id = su.plan_id
           where su.socio_id = s.id and su.baja_en is null order by su.inicio desc limit 1),
         v.color, v.texto, v.puede, s.dado_de_baja_en is not null
    from candidatos s
    cross join lateral privado.calcular_acceso(s.id, now(), e.sede_id) v
   where not por_estado or privado.grupo_estado(v.color, v.motivo) = p_estado
   order by (s.dado_de_baja_en is not null), s.nombre, s.apellido
   limit p_limite;
end $$;

-- La cuenta de cada píldora (con la misma sede que la lista).
create or replace function public.filtros_socios(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; r jsonb;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  with activos as (
    select s.id, s.creado_en, privado.grupo_estado(v.color, v.motivo) as grupo
      from public.socios s cross join lateral privado.calcular_acceso(s.id, now(), e.sede_id) v
     where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null
  )
  select jsonb_build_object(
    'todos', (select count(*) from activos),
    'al_dia', count(*) filter (where grupo = 'al_dia'), 'por_vencer', count(*) filter (where grupo = 'por_vencer'),
    'vencidos', count(*) filter (where grupo = 'vencidos'), 'en_pausa', count(*) filter (where grupo = 'en_pausa'),
    'sin_plan', count(*) filter (where grupo = 'sin_plan'), 'nuevos', count(*) filter (where creado_en > now() - interval '30 days'),
    'bajas', (select count(*) from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is not null),
    'planes', coalesce((select jsonb_agg(jsonb_build_object('plan_id', pl.id, 'nombre', pl.nombre, 'socios', x.n) order by x.n desc, pl.nombre)
                         from (select su.plan_id, count(distinct su.socio_id) n from public.suscripciones su
                                join public.socios s on s.id = su.socio_id and s.dado_de_baja_en is null
                               where su.gimnasio_id = p_gimnasio_id and su.baja_en is null group by su.plan_id) x
                         join public.planes pl on pl.id = x.plan_id), '[]'))
    into r from activos;
  return r;
end $$;

revoke all on function public.buscar_socios(uuid, text, integer, uuid, text, uuid), public.filtros_socios(uuid) from public, anon, authenticated;
grant execute on function public.buscar_socios(uuid, text, integer, uuid, text, uuid), public.filtros_socios(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  if (select count(*) from pg_proc where proname = 'buscar_socios' and pronamespace = 'public'::regnamespace) <> 1 then
    raise exception 'Verificación: quedó más de una buscar_socios';
  end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'public' and p.proname in ('buscar_socios', 'filtros_socios')) or (s.nspname = 'privado' and p.proname = 'grupo_estado') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
end $$;
