-- C1b · El socio se entera cuando el gimnasio le da una clave nueva.
-- "Te dieron una clave nueva el <fecha>, por <nombre>": así nadie lo hace sin que se entere.
-- Sale de claves_entregadas (quién del equipo y cuándo; nunca la clave). El socio lo lee solo por estas dos funciones:
--   aviso_clave_socio(socio)         la última entrega para SU ficha que todavía no cerró; null si no hay.
--   marcar_aviso_clave_visto(socio)  "Entendido": queda guardado en la base y no vuelve hasta una entrega más nueva.
-- Si el que cambió la clave fue el propio socio, no hay aviso. Permiso denegado = error.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.claves_entregadas') is null or to_regprocedure('privado.mis_socios()') is null then
    raise exception 'Guarda: falta la migración de la clave nueva (claves_entregadas)';
  end if;
end $$;

-- ── Cuándo lo cerró el socio ────────────────────────────────────────
alter table public.claves_entregadas add column if not exists visto_por_socio_en timestamptz;

-- ── La última entrega pendiente, para el socio ──────────────────────
create or replace function public.aviso_clave_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios; c public.claves_entregadas; v_nombre text;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso' using errcode = '42501'; end if;
  -- La última entrega de este gimnasio para esta ficha que todavía no cerró ("Entendido" cierra todas las anteriores).
  select * into c from public.claves_entregadas w
   where w.socio_id = s.id and w.gimnasio_id = s.gimnasio_id and w.visto_por_socio_en is null
   order by w.creado_en desc, w.id desc limit 1;
  if not found then return null; end if;
  -- Si la generó el propio socio, no hay nada que avisarle.
  if c.por_usuario_id is not null and c.por_usuario_id = auth.uid() then return null; end if;
  select q.nombre into v_nombre from public.equipo q where q.id = c.por_equipo_id and q.gimnasio_id = s.gimnasio_id;
  return jsonb_build_object('id', c.id, 'creado_en', c.creado_en, 'por_nombre', coalesce(v_nombre, 'el gimnasio'));
end $$;

-- ── "Entendido" ─────────────────────────────────────────────────────
create or replace function public.marcar_aviso_clave_visto(p_socio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.socios; n int; hay int;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select count(*) into hay from public.claves_entregadas w
   where w.socio_id = s.id and w.gimnasio_id = s.gimnasio_id and w.visto_por_socio_en is null;
  update public.claves_entregadas w set visto_por_socio_en = now()
   where w.socio_id = s.id and w.gimnasio_id = s.gimnasio_id and w.visto_por_socio_en is null;
  get diagnostics n = row_count;
  -- Sin nada pendiente es idempotente; si había algo, tienen que haberse escrito todas.
  if n <> hay then raise exception 'No se pudo marcar el aviso'; end if;
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.aviso_clave_socio(uuid), public.marcar_aviso_clave_visto(uuid) from public, anon, authenticated;
grant execute on function public.aviso_clave_socio(uuid), public.marcar_aviso_clave_visto(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'claves_entregadas' and column_name = 'visto_por_socio_en') then
    raise exception 'Verificación: falta claves_entregadas.visto_por_socio_en';
  end if;
  if has_table_privilege('authenticated', 'public.claves_entregadas', 'select') then
    raise exception 'Verificación: claves_entregadas se lee directo';
  end if;
  foreach f in array array['public.aviso_clave_socio(uuid)', 'public.marcar_aviso_clave_visto(uuid)'] loop
    if has_function_privilege('anon', f::regprocedure, 'execute') then raise exception 'Verificación: % abierta a anon', f; end if;
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
  end loop;
end $$;
