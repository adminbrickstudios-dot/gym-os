-- 3600 · VD-36 · Las pestañas de la app del socio (Inicio · Clases · Rutina · Yo).
-- Cuáles se muestran sale de la configuración del gimnasio, no de la app:
--   clases: el modo de clases no es "ninguno" y la sección "clases" no está apagada
--   rutina: la sección "rutinas" no está apagada
-- Solo lo puede pedir quien es socio de ese gimnasio. Nada se guarda.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.mis_socios()') is null then raise exception 'Guarda: falta privado.mis_socios'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'secciones_apagadas') then
    raise exception 'Guarda: falta configuracion_gimnasio.secciones_apagadas';
  end if;
end $$;

create or replace function public.pestanas_app(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c record;
begin
  if not exists (select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.id in (select privado.mis_socios())) then
    raise exception 'Sin permiso o gimnasio inexistente' using errcode = '42501';
  end if;
  select modo_clases, secciones_apagadas into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  if not found then raise exception 'El gimnasio no tiene configuración' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'clases', c.modo_clases <> 'ninguno' and not ('clases' = any (c.secciones_apagadas)),
    'rutina', not ('rutinas' = any (c.secciones_apagadas)));
end $$;

revoke all on function public.pestanas_app(uuid) from public, anon, authenticated;
grant execute on function public.pestanas_app(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.pestanas_app(uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: pestanas_app sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.pestanas_app(uuid)', 'execute') then raise exception 'Verificación: anon puede pedir las pestañas'; end if;
end $$;
