-- VD-15 + VD-6b · Socios: Interesados con DNI y autoalta a la vista.
--   prospectos.dni            el Interesado puede traer su DNI (el alta lo ofrece por DNI además de por celular)
--   crear_prospecto(..., dni) firma nueva (la vieja se borra: dos versiones con defaults hacen ambigua la llamada)
--   prospectos_panel          suma el dni
--   prospecto_por_dni         el Interesado con ese DNI, para ofrecerlo en el alta
--   buscar_socios             suma `autoalta` (se registró solo por la web) y el filtro p_origen = 'web'
--   autoaltas_web             cuántos socios vigentes se registraron solos
-- No cambia permisos: las mismas funciones, los mismos roles (dueño, encargado, recepción).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.prospectos') is null then raise exception 'Guarda: falta prospectos'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'socios' and column_name = 'origen') then
    raise exception 'Guarda: falta socios.origen';
  end if;
  if to_regprocedure('public.prospecto_por_telefono(uuid, text)') is null then raise exception 'Guarda: falta prospecto_por_telefono (VD-6)'; end if;
  if to_regprocedure('privado.grupo_estado(text, text)') is null then raise exception 'Guarda: falta grupo_estado'; end if;
end $$;

-- ── Columna: nullable, un DNI por gimnasio ──────────────────────────
alter table public.prospectos add column if not exists dni text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prospectos_dni_check') then
    alter table public.prospectos add constraint prospectos_dni_check check (dni is null or dni ~ '^[0-9]{6,12}$');
  end if;
end $$;
create unique index if not exists prospectos_dni_unico on public.prospectos (gimnasio_id, dni) where dni is not null;

-- ── Alta de Interesado, con DNI opcional ────────────────────────────
drop function if exists public.crear_prospecto(uuid, text, text, text, text);
create or replace function public.crear_prospecto(p_gimnasio_id uuid, p_nombre text, p_telefono text, p_interes text default null,
                                                  p_origen text default 'recepcion', p_dni text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare tel text; v_dni text; v_id uuid;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if length(trim(coalesce(p_nombre, ''))) = 0 then raise exception 'Escribí el nombre.'; end if;
  if p_origen is null or p_origen not in ('recepcion', 'referido') then raise exception 'Origen inválido'; end if;
  tel := privado.telefono_normalizado(p_telefono, 'WhatsApp');
  if tel is null then raise exception 'WhatsApp: escribilo con característica, por ejemplo 387 555 1234.'; end if;
  v_dni := nullif(regexp_replace(coalesce(p_dni, ''), '\D', '', 'g'), '');
  if v_dni is not null and v_dni !~ '^[0-9]{6,12}$' then raise exception 'DNI: tiene que tener entre 6 y 12 números.'; end if;
  if exists (select 1 from public.prospectos p where p.gimnasio_id = p_gimnasio_id and p.telefono = tel) then
    raise exception 'Ya hay un prospecto con ese WhatsApp.';
  end if;
  if v_dni is not null and exists (select 1 from public.prospectos p where p.gimnasio_id = p_gimnasio_id and p.dni = v_dni) then
    raise exception 'Ya hay un interesado con ese DNI.';
  end if;
  insert into public.prospectos (gimnasio_id, nombre, telefono, interes, origen, dni)
  values (p_gimnasio_id, trim(p_nombre), tel, nullif(trim(coalesce(p_interes, '')), ''), p_origen, v_dni) returning prospectos.id into v_id;
  return v_id;
end $$;

-- ── La lista de Interesados trae el DNI ─────────────────────────────
create or replace function public.prospectos_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare plantilla text; gim text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.nombre into gim from public.gimnasios g where g.id = p_gimnasio_id;
  select coalesce(p.texto, (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = 'prospecto'))
    into plantilla from public.plantillas_mensaje p where p.gimnasio_id = p_gimnasio_id and p.clave = 'prospecto';
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'nombre', p.nombre, 'telefono', p.telefono, 'dni', p.dni, 'interes', p.interes, 'origen', p.origen, 'estado', p.estado,
      'nota', p.nota, 'socio_id', p.socio_id, 'creado_en', p.creado_en, 'actualizado_en', p.actualizado_en,
      'referido_por', (select trim(r.nombre || ' ' || r.apellido) from public.socios r where r.id = p.referido_por), 'referido_por_id', p.referido_por,
      'mensaje', privado.armar_mensaje(plantilla, jsonb_build_object('nombre', split_part(p.nombre, ' ', 1), 'gimnasio', gim)))
      order by (p.estado = 'nuevo') desc, p.creado_en desc), '[]')
    from public.prospectos p where p.gimnasio_id = p_gimnasio_id);
end $$;

-- ── El Interesado con ese DNI (el alta lo ofrece al escribir el DNI) ─
create or replace function public.prospecto_por_dni(p_gimnasio_id uuid, p_dni text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_dni text; r record;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  v_dni := nullif(regexp_replace(coalesce(p_dni, ''), '\D', '', 'g'), '');
  if v_dni is null or length(v_dni) < 6 then return null; end if;     -- un DNI a medio escribir no coincide con nadie
  select p.id, p.nombre, p.creado_en into r from public.prospectos p
   where p.gimnasio_id = p_gimnasio_id and p.dni = v_dni and p.estado <> 'socio';
  if not found then return null; end if;
  return jsonb_build_object('id', r.id, 'nombre', r.nombre, 'creado_en', r.creado_en);
end $$;

-- ── Socios que se registraron solos (autoalta de la página) ─────────
create or replace function public.autoaltas_web(p_gimnasio_id uuid) returns int
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return (select count(*)::int from public.socios s
           where s.gimnasio_id = p_gimnasio_id and s.origen = 'alta_web' and s.dado_de_baja_en is null);
end $$;

-- ── buscar_socios: copia de la de 0117 + `autoalta` y el filtro de origen ──
drop function if exists public.buscar_socios(uuid, text, integer, uuid, text, uuid);
create or replace function public.buscar_socios(p_gimnasio_id uuid, p_texto text, p_limite int default 30, p_etiqueta uuid default null,
                                                p_estado text default null, p_plan uuid default null, p_origen text default null)
returns table (socio_id uuid, numero int, nombre text, telefono text, dni text, plan text,
               color text, texto text, puede boolean, dado_de_baja boolean, autoalta boolean)
language plpgsql security definer set search_path = '' as $$
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
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.crear_prospecto(uuid, text, text, text, text, text), public.prospectos_panel(uuid),
  public.prospecto_por_dni(uuid, text), public.autoaltas_web(uuid),
  public.buscar_socios(uuid, text, integer, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.crear_prospecto(uuid, text, text, text, text, text), public.prospectos_panel(uuid),
  public.prospecto_por_dni(uuid, text), public.autoaltas_web(uuid),
  public.buscar_socios(uuid, text, integer, uuid, text, uuid, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prospectos' and column_name = 'dni') then
    raise exception 'Verificación: falta prospectos.dni';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'buscar_socios') <> 1 then
    raise exception 'Verificación: tiene que quedar una sola buscar_socios';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'crear_prospecto') <> 1 then
    raise exception 'Verificación: tiene que quedar una sola crear_prospecto';
  end if;
  foreach f in array array['public.crear_prospecto(uuid, text, text, text, text, text)', 'public.prospectos_panel(uuid)',
    'public.prospecto_por_dni(uuid, text)', 'public.autoaltas_web(uuid)', 'public.buscar_socios(uuid, text, integer, uuid, text, uuid, text)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f::regprocedure, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
