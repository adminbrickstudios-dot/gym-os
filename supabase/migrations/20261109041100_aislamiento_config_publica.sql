-- U3 (carril D) · Cada cuenta entra SOLO a su gimnasio. La prueba de aislamiento (aislamiento-gimnasios.test.mjs) encontró dos funciones que le
-- contaban a cualquier cuenta con sesión una opción de configuración de OTRO gimnasio:
--   usa_qr_pared(gimnasio)   si el gimnasio usa el QR de la pared
--   registra_salida(gimnasio) si el gimnasio registra la salida ("no" / otro modo)
-- Ahora responden solo a quien es del gimnasio (equipo activo o socio con cuenta), al super admin y al servidor; a cualquier otra cuenta le dan
-- error 42501. La app del socio ya las llama con un .catch que deja el valor por defecto, así que no se rompe nada. Mismas firmas y mismos
-- permisos (create or replace conserva los grants). Definiciones de partida: las vigentes (20261104005100 y 20261107004800).

do $g$ begin
  if to_regprocedure('public.usa_qr_pared(uuid)') is null or to_regprocedure('public.registra_salida(uuid)') is null then raise exception 'U3: faltan las funciones a ajustar'; end if;
  if to_regprocedure('privado.es_servicio()') is null or to_regprocedure('privado.soy_admin_plataforma()') is null then raise exception 'U3: faltan privado.es_servicio / soy_admin_plataforma'; end if;
end $g$;

create or replace function privado.es_de_este_gimnasio(p_gimnasio_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select privado.es_servicio() or privado.soy_admin_plataforma()
      or exists (select 1 from public.equipo e where e.gimnasio_id = p_gimnasio_id and e.usuario_id = auth.uid() and e.activo)
      or exists (select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.usuario_id = auth.uid())
$$;
revoke all on function privado.es_de_este_gimnasio(uuid) from public, anon, authenticated;
grant execute on function privado.es_de_este_gimnasio(uuid) to service_role;

create or replace function public.usa_qr_pared(p_gimnasio_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.es_de_este_gimnasio(p_gimnasio_id) then raise exception 'Sin permiso para este gimnasio' using errcode = '42501'; end if;
  return coalesce((select 'qr_pared' = any (c.accesos_activos) from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id), false);
end $$;

create or replace function public.registra_salida(p_gimnasio_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.es_de_este_gimnasio(p_gimnasio_id) then raise exception 'Sin permiso para este gimnasio' using errcode = '42501'; end if;
  return coalesce((select c.registrar_salida from public.configuracion_visita c where c.gimnasio_id = p_gimnasio_id), 'no');
end $$;

do $v$ begin
  if has_function_privilege('anon', 'public.usa_qr_pared(uuid)', 'execute') or has_function_privilege('anon', 'public.registra_salida(uuid)', 'execute') then
    raise exception 'U3: no son para anónimos';
  end if;
  if not has_function_privilege('authenticated', 'public.usa_qr_pared(uuid)', 'execute') then raise exception 'U3: usa_qr_pared perdió el permiso'; end if;
end $v$;
