-- 0056 · El precio de un plan como lista completa (PLA-5).
-- precios_plan ya guarda, para cada momento, una lista: el precio general y
-- los más baratos por medio de pago ("efectivo $X") o por pagar antes de un
-- día del mes ("hasta el 10, $Y"). Cobrar usa el menor que aplica
-- (privado.precio_para). Un precio nuevo arma una lista nueva: lo que no está
-- en ella deja de regir. Por eso la pantalla edita la lista entera, de una vez.
--
--   lista_precios_plan(plan)          la de hoy y la que viene (si hay)
--   programar_lista_precios(plan, general, variantes, desde)
--                                     guarda la lista entera desde una fecha
--   anular_precio_programado(plan, desde)
--                                     borra una lista que todavía no rige
--
-- Solo las listas sin sede (las de todo el gimnasio). Lo ya cobrado no cambia:
-- cada cobro guardó su monto.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.precio_para(uuid, timestamptz, text, uuid, boolean)') is null then raise exception 'Guarda: falta precio_para (0005)'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'medios_aceptados') then
    raise exception 'Guarda: falta medios_aceptados (0023)';
  end if;
  if to_regprocedure('public.guardar_plan(uuid, uuid, jsonb)') is null then raise exception 'Guarda: falta la migración 0055'; end if;
end $$;

-- Una lista (las filas sin sede de un mismo momento) como jsonb.
create or replace function privado.lista_precios_json(p_plan_id uuid, p_desde timestamptz) returns jsonb
language sql stable set search_path = '' as $$
  select case when count(*) = 0 then null else jsonb_build_object(
    'desde', p_desde,
    'general', max(pp.monto) filter (where pp.medio_pago is null and pp.pago_hasta_dia is null),
    'variantes', coalesce(jsonb_agg(jsonb_build_object('medio', pp.medio_pago, 'hasta_dia', pp.pago_hasta_dia, 'monto', pp.monto)
                                    order by pp.pago_hasta_dia nulls first, pp.medio_pago)
                          filter (where pp.medio_pago is not null or pp.pago_hasta_dia is not null), '[]'::jsonb)) end
    from public.precios_plan pp
   where pp.plan_id = p_plan_id and pp.sede_id is null and pp.vigente_desde = p_desde
$$;
revoke all on function privado.lista_precios_json(uuid, timestamptz) from public;

create or replace function public.lista_precios_plan(p_plan_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p public.planes; hoy timestamptz; prox timestamptz; medios text[];
begin
  select * into p from public.planes where id = p_plan_id;
  if not found then raise exception 'Sin permiso o plan inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(p.gimnasio_id, array['dueno', 'encargado']);
  select c.medios_aceptados into medios from public.configuracion_gimnasio c where c.gimnasio_id = p.gimnasio_id;
  select max(vigente_desde) into hoy from public.precios_plan where plan_id = p.id and sede_id is null and vigente_desde <= now();
  select min(vigente_desde) into prox from public.precios_plan where plan_id = p.id and sede_id is null and vigente_desde > now();
  return jsonb_build_object(
    'plan_id', p.id, 'tipo', p.tipo, 'medios', to_jsonb(coalesce(medios, '{}')),
    'hoy', case when hoy is not null then privado.lista_precios_json(p.id, hoy) end,
    'proxima', case when prox is not null then privado.lista_precios_json(p.id, prox) end,
    'con_sede', exists (select 1 from public.precios_plan where plan_id = p.id and sede_id is not null));
end $$;

-- p_variantes: [{ "medio": "efectivo", "monto": 40000 }, { "hasta_dia": 10, "monto": 42000 }, …]
-- Cada una tiene medio, día o los dos, y es más barata que el general (se
-- cobra el menor que aplica: una más cara nunca se usaría).
create or replace function public.programar_lista_precios(p_plan_id uuid, p_general numeric, p_variantes jsonb, p_desde date default null)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare p public.planes; zona text; medios text[]; desde timestamptz; v jsonb; medio text; dia int; monto numeric; vistos text[] := '{}'; clave text;
begin
  select * into p from public.planes where id = p_plan_id;
  if not found then raise exception 'Sin permiso o plan inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(p.gimnasio_id, array['dueno', 'encargado']);
  if p_general is null or p_general <= 0 then raise exception 'El precio tiene que ser mayor a cero' using errcode = '22023'; end if;
  if p_variantes is not null and jsonb_typeof(p_variantes) <> 'array' then raise exception 'Datos inválidos' using errcode = '22023'; end if;
  select g.zona_horaria, c.medios_aceptados into zona, medios
    from public.gimnasios g join public.configuracion_gimnasio c on c.gimnasio_id = g.id where g.id = p.gimnasio_id;
  desde := case when p_desde is null or p_desde <= privado.dia_local(now(), zona) then now() else privado.medianoche(p_desde, zona) end;

  -- Validar todo antes de escribir.
  for v in select * from jsonb_array_elements(coalesce(p_variantes, '[]'::jsonb)) loop
    medio := nullif(v ->> 'medio', '');
    dia := nullif(v ->> 'hasta_dia', '')::int;
    monto := nullif(v ->> 'monto', '')::numeric;
    if medio is null and dia is null then raise exception 'Cada precio especial dice con qué medio o hasta qué día' using errcode = '22023'; end if;
    if medio is not null and not (medio = any (coalesce(medios, '{}'))) then
      raise exception 'No aceptás %: prendelo en Configuración → Cobros', medio using errcode = '22023';
    end if;
    if dia is not null and (dia < 1 or dia > 28) then raise exception 'El día va del 1 al 28 (todos los meses lo tienen)' using errcode = '22023'; end if;
    if monto is null or monto <= 0 then raise exception 'Cada precio especial tiene que ser mayor a cero' using errcode = '22023'; end if;
    if monto >= p_general then
      raise exception 'El precio % tiene que ser menor que el general: se cobra siempre el más barato que corresponde',
        coalesce(medio, '') || case when dia is not null then ' hasta el día ' || dia else '' end using errcode = '22023';
    end if;
    clave := coalesce(medio, '') || '/' || coalesce(dia::text, '');
    if clave = any (vistos) then raise exception 'Hay dos precios para lo mismo (% %)', coalesce(medio, ''), coalesce('hasta el ' || dia, '') using errcode = '22023'; end if;
    vistos := vistos || clave;
  end loop;

  -- Una lista futura para el mismo día se reemplaza (todavía no rige: nadie la pagó).
  if desde > now() then
    delete from public.precios_plan where plan_id = p.id and sede_id is null and vigente_desde = desde;
  end if;
  insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde, creado_por)
  values (p.gimnasio_id, p.id, round(p_general, 2), desde, auth.uid());
  insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde, medio_pago, pago_hasta_dia, creado_por)
  select p.gimnasio_id, p.id, round((x ->> 'monto')::numeric, 2), desde, nullif(x ->> 'medio', ''), nullif(x ->> 'hasta_dia', '')::int, auth.uid()
    from jsonb_array_elements(coalesce(p_variantes, '[]'::jsonb)) x;
  return desde;
end $$;

-- Borra una lista que todavía no rige. Las que ya rigieron no se tocan nunca.
create or replace function public.anular_precio_programado(p_plan_id uuid, p_desde timestamptz) returns int
language plpgsql security definer set search_path = '' as $$
declare p public.planes; n int;
begin
  select * into p from public.planes where id = p_plan_id;
  if not found then raise exception 'Sin permiso o plan inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(p.gimnasio_id, array['dueno', 'encargado']);
  if p_desde is null or p_desde <= now() then raise exception 'Ese precio ya rige: para cambiarlo, programá uno nuevo' using errcode = '22023'; end if;
  delete from public.precios_plan where plan_id = p.id and sede_id is null and vigente_desde = p_desde;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'No hay un precio programado para esa fecha' using errcode = '22023'; end if;
  return n;
end $$;

revoke all on function public.lista_precios_plan(uuid), public.programar_lista_precios(uuid, numeric, jsonb, date),
  public.anular_precio_programado(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.lista_precios_plan(uuid), public.programar_lista_precios(uuid, numeric, jsonb, date),
  public.anular_precio_programado(uuid, timestamptz) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.lista_precios_plan(uuid)', 'public.programar_lista_precios(uuid, numeric, jsonb, date)',
                           'public.anular_precio_programado(uuid, timestamptz)', 'privado.lista_precios_json(uuid, timestamptz)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
