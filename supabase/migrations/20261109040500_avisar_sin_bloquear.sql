-- FA-7 (carril D) · "Los primeros N días, la entrada avisa pero no frena": pantalla de Configuración sobre lo que la base ya tiene
-- (configuracion_gimnasio.avisar_sin_bloquear_hasta, que calcular_acceso ya respeta). Es para el primer gimnasio real, mientras
-- carga sus socios y cobros. No cambia cómo se calcula el acceso: solo deja poner y sacar esa fecha.
--   avisar_sin_bloquear_estado(gimnasio)         dueño y encargado: hasta cuándo, o null
--   guardar_avisar_sin_bloquear(gimnasio, dias)  solo dueño: 0 lo saca; 1 a 60 días desde ahora
-- Aditiva e idempotente.

do $g$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'avisar_sin_bloquear_hasta') then
    raise exception 'FA-7: falta configuracion_gimnasio.avisar_sin_bloquear_hasta';
  end if;
end $g$;

create or replace function public.avisar_sin_bloquear_estado(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare h timestamptz;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select c.avisar_sin_bloquear_hasta into h from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  return jsonb_build_object('hasta', h, 'activo', h is not null and h > now());
end $$;

create or replace function public.guardar_avisar_sin_bloquear(p_gimnasio_id uuid, p_dias int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h timestamptz; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_dias is null or p_dias < 0 or p_dias > 60 then raise exception 'Elegí entre 0 (sin aviso) y 60 días' using errcode = '22023'; end if;
  h := case when p_dias = 0 then null else now() + make_interval(days => p_dias) end;
  update public.configuracion_gimnasio set avisar_sin_bloquear_hasta = h where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar'; end if;
  return jsonb_build_object('hasta', h, 'activo', h is not null);
end $$;

revoke all on function public.avisar_sin_bloquear_estado(uuid), public.guardar_avisar_sin_bloquear(uuid, int) from public, anon, authenticated;
grant execute on function public.avisar_sin_bloquear_estado(uuid), public.guardar_avisar_sin_bloquear(uuid, int) to authenticated, service_role;

do $v$ begin
  if has_function_privilege('anon', 'public.guardar_avisar_sin_bloquear(uuid, int)', 'execute') then raise exception 'FA-7: no es para anónimos'; end if;
end $v$;
