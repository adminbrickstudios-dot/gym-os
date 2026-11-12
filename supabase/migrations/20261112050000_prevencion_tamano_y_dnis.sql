-- D4 (docs/base/PREVENCION.md) · Dos avisos del super admin que faltaban:
--   admin_almacenamiento()   cuánto pesan la base y el Storage frente al tope del plan gratis de Supabase (500 MB y 1 GB), con el % usado.
--   admin_dnis_repetidos()   DNIs repetidos por gimnasio (socios, o un Interesado que ya es socio): un import mal hecho arruina "quién debe".
--   admin_alertas()          suma 'almacenamiento' (amarillo desde el 70 %, rojo desde el 90 %) y 'dnis_repetidos' (rojo).
-- Parte de la definición de admin_alertas de 20261109021100. Las dos funciones nuevas son de solo lectura para el equipo de BRIK
-- (principal, soporte, ventas, lectura), como el resto de las alertas. No toca permisos de nadie más ni plata.
-- Los topes (500 MB / 1 GB) son los del plan gratis; al pasar a Supabase Pro se cambian acá en una migración nueva.

do $guarda$
begin
  if to_regprocedure('public.admin_alertas()') is null then raise exception 'Guarda: falta admin_alertas'; end if;
  if to_regprocedure('public.admin_tamano_tablas()') is null then raise exception 'Guarda: falta admin_tamano_tablas'; end if;
  if to_regprocedure('privado.exigir_brik(text[])') is null then raise exception 'Guarda: falta privado.exigir_brik'; end if;
  if to_regclass('public.prospectos') is null then raise exception 'Guarda: falta prospectos'; end if;
end $guarda$;

create or replace function public.admin_almacenamiento() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare base_mb numeric; storage_mb numeric := 0; base_tope constant numeric := 500; storage_tope constant numeric := 1024;
        base_pct numeric; storage_pct numeric;
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  base_mb := round(pg_database_size(current_database()) / 1048576.0, 1);
  if to_regclass('storage.objects') is not null then
    execute $q$select coalesce(round(sum((metadata ->> 'size')::numeric) / 1048576.0, 1), 0) from storage.objects$q$ into storage_mb;
  end if;
  base_pct := round(base_mb * 100 / base_tope, 1);
  storage_pct := round(storage_mb * 100 / storage_tope, 1);
  return jsonb_build_object(
    'base_mb', base_mb, 'base_tope_mb', base_tope, 'base_pct', base_pct,
    'storage_mb', storage_mb, 'storage_tope_mb', storage_tope, 'storage_pct', storage_pct,
    'aviso', greatest(base_pct, storage_pct) >= 70,
    'critico', greatest(base_pct, storage_pct) >= 90);
end $$;

create or replace function public.admin_dnis_repetidos() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  -- El DNI se muestra tapado salvo los últimos 3 números: alcanza para ubicarlo y no deja el dato suelto en pantalla.
  return coalesce((select jsonb_agg(x order by x ->> 'gimnasio', x ->> 'dni') from (
      select jsonb_build_object('gimnasio_id', g.id, 'gimnasio', g.nombre, 'tipo', 'socios', 'dni', '***' || right(s.dni, 3), 'cantidad', count(*)::int) x
        from public.socios s join public.gimnasios g on g.id = s.gimnasio_id
       where s.dni is not null and g.baja_en is null
       group by g.id, g.nombre, s.dni having count(*) > 1
      union all
      select jsonb_build_object('gimnasio_id', g.id, 'gimnasio', g.nombre, 'tipo', 'interesado_ya_socio', 'dni', '***' || right(p.dni, 3), 'cantidad', count(*)::int)
        from public.prospectos p join public.gimnasios g on g.id = p.gimnasio_id
       where p.dni is not null and g.baja_en is null and p.estado not in ('socio', 'no')
         and exists (select 1 from public.socios s where s.gimnasio_id = p.gimnasio_id and s.dni = p.dni and s.dado_de_baja_en is null)
       group by g.id, g.nombre, p.dni) t), '[]'::jsonb);
end $$;

create or replace function public.admin_alertas() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare a jsonb := '[]'::jsonb; n int; viejo timestamptz; alm jsonb;
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  select count(*)::int into n from public.errores_app where creado_en > now() - interval '1 hour';
  if n >= 20 then a := a || jsonb_build_array(jsonb_build_object('clave', 'errores_hora', 'nivel', 'rojo', 'texto', n || ' errores en la última hora'));
  elsif n >= 5 then a := a || jsonb_build_array(jsonb_build_object('clave', 'errores_hora', 'nivel', 'amarillo', 'texto', n || ' errores en la última hora')); end if;
  select count(*)::int into n from public.eventos_webhook where error is not null and procesado_en is null and recibido_en > now() - interval '24 hours';
  if n > 0 then a := a || jsonb_build_array(jsonb_build_object('clave', 'webhooks_fallidos', 'nivel', 'rojo', 'texto', n || ' avisos de MercadoPago fallidos en 24 h')); end if;
  select count(*)::int into n from public.gimnasios g where not g.es_demo and g.baja_en is null and privado.estado_abono(g.id) ->> 'estado' = 'vencido';
  if n > 0 then a := a || jsonb_build_array(jsonb_build_object('clave', 'abonos_vencidos', 'nivel', 'amarillo', 'texto', n || ' abonos a BRIK vencidos')); end if;
  select count(*)::int into n from jsonb_array_elements(public.admin_limites_gimnasios()) x where x ->> 'estado' in ('cerca', 'pasado');
  if n > 0 then a := a || jsonb_build_array(jsonb_build_object('clave', 'limites', 'nivel', 'amarillo', 'texto', n || ' gimnasios cerca o por encima del límite de su plan')); end if;
  select count(*)::int into n from jsonb_array_elements(public.admin_tamano_tablas()) x where (x ->> 'partir')::boolean;
  if n > 0 then a := a || jsonb_build_array(jsonb_build_object('clave', 'tablas_grandes', 'nivel', 'amarillo', 'texto', n || ' tablas ya conviene partirlas por mes')); end if;
  -- VD-26B: pedidos de demo que nadie atendió. Rojo si el más viejo lleva más de un día esperando.
  select count(*)::int, min(creado_en) into n, viejo from public.pedidos_demo_brik where atendido_en is null;
  if n > 0 then a := a || jsonb_build_array(jsonb_build_object('clave', 'pedidos_demo', 'nivel', case when viejo < now() - interval '24 hours' then 'rojo' else 'amarillo' end,
    'texto', n || (case when n = 1 then ' pedido de demo sin atender' else ' pedidos de demo sin atender' end)));
  end if;
  -- D4: la base o el Storage llegan al 70 % del tope del plan gratis (rojo desde el 90 %).
  alm := public.admin_almacenamiento();
  if (alm ->> 'aviso')::boolean then
    a := a || jsonb_build_array(jsonb_build_object('clave', 'almacenamiento', 'nivel', case when (alm ->> 'critico')::boolean then 'rojo' else 'amarillo' end,
      'texto', 'Base al ' || (alm ->> 'base_pct') || ' % (' || (alm ->> 'base_mb') || ' de ' || (alm ->> 'base_tope_mb') || ' MB) y Storage al ' || (alm ->> 'storage_pct') || ' % (' || (alm ->> 'storage_mb') || ' de ' || (alm ->> 'storage_tope_mb') || ' MB)'));
  end if;
  -- D4: DNIs repetidos dentro de un gimnasio.
  n := jsonb_array_length(public.admin_dnis_repetidos());
  if n > 0 then a := a || jsonb_build_array(jsonb_build_object('clave', 'dnis_repetidos', 'nivel', 'rojo', 'texto', n || (case when n = 1 then ' DNI repetido' else ' DNIs repetidos' end) || ' en un mismo gimnasio')); end if;
  return jsonb_build_object('alertas', a, 'hay_rojas', exists (select 1 from jsonb_array_elements(a) x where x ->> 'nivel' = 'rojo'), 'hora', now());
end $$;

revoke execute on function public.admin_almacenamiento(), public.admin_dnis_repetidos(), public.admin_alertas() from public, anon;
grant execute on function public.admin_almacenamiento(), public.admin_dnis_repetidos(), public.admin_alertas() to authenticated;

do $verif$
begin
  if to_regprocedure('public.admin_almacenamiento()') is null then raise exception 'Verificación: falta admin_almacenamiento'; end if;
  if to_regprocedure('public.admin_dnis_repetidos()') is null then raise exception 'Verificación: falta admin_dnis_repetidos'; end if;
  if has_function_privilege('anon', 'public.admin_almacenamiento()', 'execute') or has_function_privilege('anon', 'public.admin_dnis_repetidos()', 'execute') then
    raise exception 'Verificación: anon puede ejecutar las funciones del super admin';
  end if;
end $verif$;
