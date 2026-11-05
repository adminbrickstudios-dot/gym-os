-- 0037 · Exportar la lista de socios (SOC-4). Solo dueño y encargado (son
-- datos personales de todos los socios). Mismo filtro que la lista (texto y
-- etiqueta); el estado sale de la misma cuenta que la Entrada.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.socio_etiquetas') is null then raise exception 'Guarda: falta la migración 0036'; end if;
  if to_regprocedure('privado.calcular_acceso(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta calcular_acceso'; end if;
end $$;

create or replace function public.exportar_socios(p_gimnasio_id uuid, p_texto text default null, p_etiqueta uuid default null)
returns table (numero int, nombre text, apellido text, dni text, telefono text, email text, nacimiento date, plan text,
               estado text, cubierto_hasta date, alta date, dado_de_baja date, etiquetas text)
language plpgsql stable security definer set search_path = '' as $$
declare t text := privado.sin_acentos(lower(trim(coalesce(p_texto, '')))); d text; zona text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  d := regexp_replace(t, '\D', '', 'g');
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
    cross join lateral privado.calcular_acceso(s.id, now(), null) v
   where s.gimnasio_id = p_gimnasio_id
     and (p_etiqueta is null or exists (select 1 from public.socio_etiquetas se where se.gimnasio_id = p_gimnasio_id and se.socio_id = s.id and se.etiqueta_id = p_etiqueta))
     and (t = '' or privado.sin_acentos(lower(s.nombre || ' ' || s.apellido)) like '%' || t || '%'
          or (length(d) >= 3 and (s.dni like d || '%' or regexp_replace(coalesce(s.telefono, ''), '\D', '', 'g') like '%' || d || '%')))
   order by s.apellido, s.nombre;
end $$;

revoke all on function public.exportar_socios(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.exportar_socios(uuid, text, uuid) to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.exportar_socios(uuid, text, uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: exportar_socios sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.exportar_socios(uuid, text, uuid)', 'execute') then raise exception 'Verificación: anon exporta'; end if;
end $$;
