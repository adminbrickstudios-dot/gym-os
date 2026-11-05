-- 0101 · El profe busca socios (EQU-2, decisión D3).
-- Solo nombre, foto y semáforo: sin plata, sin teléfono, sin DNI ni número.
-- El texto del semáforo es genérico ("Puede entrar" / "No puede entrar"): el
-- de la puerta puede decir cuánto debe. Los dados de baja no aparecen.
--   buscar_socios_profe(gimnasio, texto) → hasta 10

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.guardar_permisos_equipo(uuid, jsonb)') is null then raise exception 'Guarda: falta la migración 0100'; end if;
end $$;

create or replace function public.buscar_socios_profe(p_gimnasio_id uuid, p_texto text)
returns table (socio_id uuid, nombre text, tiene_foto boolean, color text, puede boolean, texto text)
language plpgsql stable security definer set search_path = '' as $$
declare t text := privado.sin_acentos(lower(trim(coalesce(p_texto, ''))));
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  if length(t) < 2 then raise exception 'Escribí al menos 2 letras' using errcode = '22023'; end if;
  return query
  select s.id, trim(s.nombre || ' ' || s.apellido), s.foto_path is not null, v.color, v.puede,
         case when v.puede then 'Puede entrar' else 'No puede entrar' end
    from public.socios s
    cross join lateral privado.calcular_acceso(s.id, now()) v
   where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null
     and (privado.sin_acentos(lower(s.nombre || ' ' || s.apellido)) like '%' || t || '%'
       or privado.sin_acentos(lower(s.apellido || ' ' || s.nombre)) like '%' || t || '%')
   order by s.apellido, s.nombre
   limit 10;
end $$;

revoke all on function public.buscar_socios_profe(uuid, text) from public, anon, authenticated;
grant execute on function public.buscar_socios_profe(uuid, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.buscar_socios_profe(uuid, text)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: buscar_socios_profe sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.buscar_socios_profe(uuid, text)', 'execute') then raise exception 'Verificación: anon puede buscar socios'; end if;
end $$;
