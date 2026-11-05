-- 0113 · El dueño descarga todos los datos de su gimnasio (SEG-2).
-- Tabla por tabla (lista cerrada), filtrado por el gimnasio, sin columnas
-- internas (rutas de archivos, preferencias, gimnasio_id). Solo el dueño. El
-- servidor arma un zip de CSV.
--   exportar_gimnasio(gimnasio, tabla) → filas (jsonb)
--   privado.tablas_exportables()

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.registrar_pedido_codigo(text, text)') is null then raise exception 'Guarda: falta la migración 0112'; end if;
end $$;

create or replace function privado.tablas_exportables() returns text[]
language sql immutable set search_path = '' as $$
  select array['socios', 'planes', 'precios_plan', 'suscripciones', 'coberturas', 'congelamientos', 'packs', 'ventas', 'venta_items', 'pagos',
               'ingresos', 'turnos_caja', 'movimientos_caja', 'equipo', 'actividades', 'clases', 'reservas', 'asistencias', 'prospectos',
               'productos', 'gastos', 'ejercicios', 'rutinas', 'registros_ejercicio']
$$;
revoke all on function privado.tablas_exportables() from public;

create or replace function public.exportar_gimnasio(p_gimnasio_id uuid, p_tabla text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno']);
  if p_tabla is null or not (p_tabla = any (privado.tablas_exportables())) then raise exception 'Tabla que no se exporta: %', p_tabla using errcode = '22023'; end if;
  execute format('select coalesce(jsonb_agg(to_jsonb(x) - ''gimnasio_id'' - ''foto_path'' - ''comprobante_path'' - ''ticket_path'' - ''preferencias'' order by x.id), ''[]''::jsonb)
                    from public.%I x where x.gimnasio_id = $1', p_tabla)
    into r using p_gimnasio_id;
  return r;
end $$;

revoke all on function public.exportar_gimnasio(uuid, text) from public, anon, authenticated;
grant execute on function public.exportar_gimnasio(uuid, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array privado.tablas_exportables() loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'gimnasio_id') then
      raise exception 'Verificación: % no tiene gimnasio_id', t;
    end if;
  end loop;
  if not exists (select 1 from pg_proc where oid = 'public.exportar_gimnasio(uuid, text)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: exportar_gimnasio sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.exportar_gimnasio(uuid, text)', 'execute') then raise exception 'Verificación: anon puede exportar'; end if;
end $$;
