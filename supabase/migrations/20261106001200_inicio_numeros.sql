-- VD-12 · Inicio del dueño y de la recepción: los 4 números en un solo viaje.
--   configuracion_gimnasio.numeros_inicio   cuáles números ve el gimnasio (datos, no código)
--   numeros_inicio(gimnasio, sede)          los números elegidos con su mini gráfico de 7 días
--   guardar_numeros_inicio(gimnasio, text[])  solo el dueño los elige
-- Permisos: dueño y encargado ven los 8; la recepción ve todos menos "cobrado hoy"
-- (la plata del día no se muestra a quien atiende el mostrador: decisión prudente).
-- El profe no usa esta función (su Inicio sigue siendo el de panel_inicio).

do $$ begin
  if to_regclass('public.configuracion_gimnasio') is null then raise exception 'Guarda: falta configuracion_gimnasio'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid,text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
  if to_regprocedure('privado.retencion(uuid,timestamptz)') is null then raise exception 'Guarda: falta privado.retencion'; end if;
end $$;

alter table public.configuracion_gimnasio add column if not exists numeros_inicio text[] not null default '{}';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_numeros_inicio_ck') then
    alter table public.configuracion_gimnasio add constraint configuracion_numeros_inicio_ck
      check (numeros_inicio <@ array['adentro','entraron','cobrado','a_cobrar','activos','altas_mes','bajas_mes','ocupacion']::text[]
             and cardinality(numeros_inicio) <= 4);
  end if;
end $$;

create or replace function public.numeros_inicio(p_gimnasio_id uuid, p_sede_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; c public.configuracion_gimnasio; zona text; hoy date; desde timestamptz; hasta timestamptz;
  sede uuid; ve_plata boolean; hay_clases boolean;
  todos text[] := array['adentro','entraron','cobrado','a_cobrar','activos','altas_mes','bajas_mes','ocupacion'];
  claves text[] := '{}'; k text; v numeric; serie jsonb; salida jsonb := '[]'::jsonb; disponibles jsonb := '[]'::jsonb;
  mes timestamptz;
  etiq jsonb := jsonb_build_object(
    'adentro', '🏋️|Adentro (aprox.)', 'entraron', '🚪|Entraron hoy', 'cobrado', '💵|Cobrado hoy', 'a_cobrar', '⏰|A cobrar hoy',
    'activos', '✅|Socios activos', 'altas_mes', '🆕|Altas del mes', 'bajas_mes', '👋|Bajas del mes', 'ocupacion', '🗓️|Ocupación de clases (%)');
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  sede := coalesce(p_sede_id, e.sede_id);
  if e.sede_id is not null and sede <> e.sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = p_gimnasio_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  desde := privado.medianoche(hoy, zona);
  hasta := privado.medianoche(hoy + 1, zona);
  mes := privado.medianoche(date_trunc('month', hoy)::date, zona);
  ve_plata := e.rol in ('dueno', 'encargado');
  hay_clases := c.modo_clases <> 'ninguno' and not ('clases' = any (c.secciones_apagadas));

  -- Lo que este rol puede elegir (y lo que el gimnasio tiene prendido).
  foreach k in array todos loop
    if (k = 'cobrado' and not ve_plata) or (k = 'ocupacion' and not hay_clases) then continue; end if;
    disponibles := disponibles || jsonb_build_array(jsonb_build_object('clave', k, 'etiqueta', split_part(etiq ->> k, '|', 2), 'emoji', split_part(etiq ->> k, '|', 1)));
  end loop;

  -- Los elegidos por el dueño; si no eligió o no puede verlos, los de siempre.
  foreach k in array c.numeros_inicio loop
    if exists (select 1 from jsonb_array_elements(disponibles) d where d ->> 'clave' = k) then claves := claves || k; end if;
  end loop;
  if cardinality(claves) = 0 then
    foreach k in array case when ve_plata then array['adentro','entraron','cobrado','a_cobrar'] else array['adentro','entraron','a_cobrar','activos'] end loop
      if exists (select 1 from jsonb_array_elements(disponibles) d where d ->> 'clave' = k) then claves := claves || k; end if;
    end loop;
  end if;

  foreach k in array claves loop
    serie := null; v := 0;
    if k = 'adentro' then
      select count(distinct i.socio_id) into v from public.ingresos i
       where i.gimnasio_id = p_gimnasio_id and i.momento >= greatest(desde, now() - interval '2 hours') and i.momento <= now()
         and i.anulado_en is null and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede);
    elsif k = 'entraron' then
      select count(distinct i.socio_id) into v from public.ingresos i
       where i.gimnasio_id = p_gimnasio_id and i.momento >= desde and i.momento < hasta and i.anulado_en is null
         and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede);
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(distinct i.socio_id) as n from public.ingresos i
           where i.gimnasio_id = p_gimnasio_id and i.momento >= privado.medianoche(g.dia, zona) and i.momento < privado.medianoche(g.dia + 1, zona)
             and i.anulado_en is null and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede)) x on true;
    elsif k = 'cobrado' then
      select coalesce(sum(p.monto), 0) into v from public.pagos p join public.ventas ve on ve.id = p.venta_id
       where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.aprobado_en >= desde and p.aprobado_en < hasta
         and p.medio <> 'cuenta_corriente' and (sede is null or ve.sede_id = sede);
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select sum(p.monto) as n from public.pagos p join public.ventas ve on ve.id = p.venta_id
           where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.medio <> 'cuenta_corriente'
             and p.aprobado_en >= privado.medianoche(g.dia, zona) and p.aprobado_en < privado.medianoche(g.dia + 1, zona)
             and (sede is null or ve.sede_id = sede)) x on true;
    elsif k = 'a_cobrar' then
      select count(*) filter (where r.lista = 'por_vencer' and r.dias = 0) into v from privado.retencion(p_gimnasio_id, now()) r;
    elsif k = 'activos' then
      select count(distinct cb.socio_id) into v from public.coberturas cb
       where cb.gimnasio_id = p_gimnasio_id and cb.anulada_en is null and cb.desde <= now() and cb.hasta > now();
    elsif k = 'altas_mes' then
      select count(*) into v from public.socios s where s.gimnasio_id = p_gimnasio_id and s.creado_en >= mes;
    elsif k = 'bajas_mes' then
      select count(*) into v from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en >= mes;
    elsif k = 'ocupacion' then
      select coalesce(round(100.0 * sum((select count(*) from public.reservas r where r.clase_id = kl.id and r.estado = 'confirmada'))
                            / nullif(sum(kl.cupo), 0)), 0) into v
        from public.clases kl where kl.gimnasio_id = p_gimnasio_id and kl.inicio >= desde and kl.inicio < hasta
         and kl.cancelada_en is null and kl.cupo is not null and (sede is null or kl.sede_id = sede);
    end if;
    salida := salida || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'clave', k, 'emoji', split_part(etiq ->> k, '|', 1), 'etiqueta', split_part(etiq ->> k, '|', 2),
      'valor', coalesce(v, 0), 'formato', case when k = 'cobrado' then 'pesos' when k = 'ocupacion' then 'porcentaje' end,
      'serie', serie)));
  end loop;

  return jsonb_build_object('numeros', salida, 'elegidos', to_jsonb(c.numeros_inicio), 'disponibles', disponibles);
end $$;

create or replace function public.guardar_numeros_inicio(p_gimnasio_id uuid, p_claves text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare n int; claves text[];
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  claves := coalesce(p_claves, '{}');
  if cardinality(claves) > 4 then raise exception 'Elegí hasta 4 números'; end if;
  if (select count(distinct x) from unnest(claves) x) <> cardinality(claves) then raise exception 'No repitas un número'; end if;
  if not (claves <@ array['adentro','entraron','cobrado','a_cobrar','activos','altas_mes','bajas_mes','ocupacion']::text[]) then
    raise exception 'Ese número no existe';
  end if;
  update public.configuracion_gimnasio set numeros_inicio = claves, actualizado_en = now() where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar: el gimnasio no tiene configuración'; end if;
end $$;

revoke all on function public.numeros_inicio(uuid, uuid), public.guardar_numeros_inicio(uuid, text[]) from public, anon, authenticated;
grant execute on function public.numeros_inicio(uuid, uuid), public.guardar_numeros_inicio(uuid, text[]) to authenticated, service_role;

do $$ begin
  if to_regprocedure('public.numeros_inicio(uuid,uuid)') is null or to_regprocedure('public.guardar_numeros_inicio(uuid,text[])') is null then
    raise exception 'Verificación: faltan las funciones del Inicio';
  end if;
  if has_function_privilege('anon', 'public.numeros_inicio(uuid, uuid)', 'execute') then raise exception 'Verificación: anon ejecuta numeros_inicio'; end if;
  if not exists (select 1 from information_schema.columns where table_name = 'configuracion_gimnasio' and column_name = 'numeros_inicio') then
    raise exception 'Verificación: falta la columna numeros_inicio';
  end if;
end $$;
