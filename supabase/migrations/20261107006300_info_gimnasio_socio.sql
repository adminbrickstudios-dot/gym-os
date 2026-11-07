-- VD-63 · "Info del gimnasio" en la app del socio.
-- Los horarios, los cierres, el contacto, la ubicación y las preguntas frecuentes ya salen de los mismos datos que la
-- página pública (landing_publica / agenda_publica): no se duplican. Lo único que el socio no podía releer es el
-- reglamento una vez firmado (documentos_socio solo devuelve el texto de lo pendiente). Esta función lo da:
--   info_gimnasio_socio(socio)  el reglamento vigente de SU gimnasio, solo para el propio socio (no para el equipo:
--                               el equipo lo ve en Documentos). Sin reglamento cargado devuelve null en ese campo.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.documentos') is null then raise exception 'Guarda: falta la tabla documentos'; end if;
  if to_regclass('public.reglamentos') is null then raise exception 'Guarda: falta la tabla reglamentos'; end if;
  if to_regprocedure('privado.mis_socios()') is null then raise exception 'Guarda: falta privado.mis_socios'; end if;
end $$;

create or replace function public.info_gimnasio_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios; v_doc jsonb;
begin
  select * into s from public.socios x where x.id = p_socio_id;
  if not found or not (p_socio_id in (select privado.mis_socios())) then
    raise exception 'Sin permiso o socio inexistente' using errcode = '42501';
  end if;
  -- El reglamento de los documentos para firmar; si el gimnasio solo cargó el del alta online, ese.
  select jsonb_build_object('titulo', d.titulo, 'version', d.version, 'texto', d.texto) into v_doc
    from public.documentos d where d.gimnasio_id = s.gimnasio_id and d.clave = 'reglamento' and d.activo;
  if v_doc is null then
    select jsonb_build_object('titulo', 'Reglamento', 'version', r.version, 'texto', r.texto) into v_doc
      from public.reglamentos r where r.gimnasio_id = s.gimnasio_id order by r.version desc limit 1;
  end if;
  return jsonb_build_object('reglamento', v_doc);
end $$;

revoke all on function public.info_gimnasio_socio(uuid) from public, anon, authenticated;
grant execute on function public.info_gimnasio_socio(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.info_gimnasio_socio(uuid)') is null then raise exception 'Verificación: no quedó info_gimnasio_socio'; end if;
  if has_function_privilege('anon', 'public.info_gimnasio_socio(uuid)', 'execute') then raise exception 'Verificación: anon puede ejecutar info_gimnasio_socio'; end if;
  if not has_function_privilege('authenticated', 'public.info_gimnasio_socio(uuid)', 'execute') then raise exception 'Verificación: authenticated no puede ejecutar info_gimnasio_socio'; end if;
end $$;
