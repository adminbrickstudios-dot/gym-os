-- ═══════════════════════════════════════════════════════════════════
-- Mateo 16/11 · El reglamento nuevo se acepta al abrir la app.
--
-- Si el dueño publica una versión nueva del reglamento, el socio que había aceptado una anterior la ve al abrir su app: una sola tarjeta con
-- el texto y un botón "Acepto". Hasta que acepte, ve la app igual: la puerta NO cambia por esto (calcular_acceso no lo mira).
-- Quien nunca aceptó ninguna versión (el que se cargó en recepción antes de que hubiera reglamento) no se asusta con la primera: solo se pide
-- ante una versión NUEVA de algo que ya aceptó.
--
-- Aditiva y sin viajes de más al Inicio del socio: se envuelve documentos_socio (como landing_publica en 20261109020900) y suma la clave
-- `reglamento_nuevo`; el código anterior ignora la clave. Escribe solo aceptaciones_reglamento, con la regla de siempre (una por versión).
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.documentos_socio(uuid)') is null then raise exception 'Guarda: falta public.documentos_socio'; end if;
  if to_regclass('public.aceptaciones_reglamento') is null or to_regclass('public.reglamentos') is null then raise exception 'Guarda: falta reglamentos / aceptaciones_reglamento'; end if;
  if to_regprocedure('privado.mis_socios()') is null then raise exception 'Guarda: falta privado.mis_socios'; end if;
end $$;

-- ── Qué reglamento tiene pendiente (null = ninguno) ─────────────────
create or replace function privado.reglamento_nuevo_de(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios; r public.reglamentos; anterior int;
begin
  select * into s from public.socios x where x.id = p_socio_id;
  if s.id is null or s.dado_de_baja_en is not null then return null; end if;
  select * into r from public.reglamentos x where x.gimnasio_id = s.gimnasio_id order by x.version desc limit 1;
  if r.id is null then return null; end if;
  if exists (select 1 from public.aceptaciones_reglamento a where a.gimnasio_id = s.gimnasio_id and a.socio_id = s.id and a.reglamento_id = r.id) then return null; end if;
  select max(rg.version) into anterior from public.aceptaciones_reglamento a join public.reglamentos rg on rg.id = a.reglamento_id
   where a.gimnasio_id = s.gimnasio_id and a.socio_id = s.id;
  if anterior is null then return null; end if;   -- nunca aceptó ninguna: no es una versión nueva de algo que ya aceptó
  return jsonb_build_object('version', r.version, 'texto', r.texto, 'anterior', anterior);
end $$;
revoke all on function privado.reglamento_nuevo_de(uuid) from public, anon, authenticated;

-- ── documentos_socio suma `reglamento_nuevo` (solo para el propio socio) ──
do $envolver$
begin
  if to_regprocedure('public.documentos_socio_base(uuid)') is null then
    alter function public.documentos_socio(uuid) rename to documentos_socio_base;
  end if;
end $envolver$;
revoke execute on function public.documentos_socio_base(uuid) from public, anon, authenticated;

create or replace function public.documentos_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  r := public.documentos_socio_base(p_socio_id);   -- verifica el permiso (el propio socio o el equipo) y da error si no
  if p_socio_id in (select privado.mis_socios()) then
    r := r || jsonb_build_object('reglamento_nuevo', privado.reglamento_nuevo_de(p_socio_id));
  end if;
  return r;
end $$;
revoke execute on function public.documentos_socio(uuid) from public, anon;
grant execute on function public.documentos_socio(uuid) to authenticated, service_role;

-- ── Aceptar la versión vigente (solo el propio socio) ───────────────
create or replace function public.aceptar_reglamento(p_socio_id uuid, p_version int) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.socios; r public.reglamentos;
begin
  if p_socio_id is null or not (p_socio_id in (select privado.mis_socios())) then
    raise exception 'Esa ficha no es tuya' using errcode = '42501';
  end if;
  select * into s from public.socios x where x.id = p_socio_id and x.dado_de_baja_en is null;
  if s.id is null then raise exception 'Esa ficha no es tuya' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('gymos:reglamento:' || s.id::text, 0));
  select * into r from public.reglamentos x where x.gimnasio_id = s.gimnasio_id order by x.version desc limit 1;
  if r.id is null then raise exception 'Este gimnasio no tiene reglamento' using errcode = '22023'; end if;
  if p_version is distinct from r.version then
    raise exception 'El reglamento cambió: leelo de nuevo y aceptalo.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.aceptaciones_reglamento a where a.gimnasio_id = s.gimnasio_id and a.socio_id = s.id and a.reglamento_id = r.id) then
    insert into public.aceptaciones_reglamento (gimnasio_id, socio_id, reglamento_id) values (s.gimnasio_id, s.id, r.id);
  end if;
end $$;
revoke execute on function public.aceptar_reglamento(uuid, int) from public, anon;
grant execute on function public.aceptar_reglamento(uuid, int) to authenticated, service_role;

do $$
begin
  if has_function_privilege('anon', 'public.aceptar_reglamento(uuid, int)', 'execute') then raise exception 'Verificación: anon puede aceptar reglamentos'; end if;
  if has_function_privilege('anon', 'public.documentos_socio(uuid)', 'execute') then raise exception 'Verificación: anon puede leer documentos_socio'; end if;
  if has_function_privilege('authenticated', 'public.documentos_socio_base(uuid)', 'execute') then raise exception 'Verificación: documentos_socio_base quedó expuesta'; end if;
  if has_function_privilege('authenticated', 'privado.reglamento_nuevo_de(uuid)', 'execute') then raise exception 'Verificación: privado.reglamento_nuevo_de quedó expuesta'; end if;
end $$;
