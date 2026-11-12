-- Vuelto en efectivo al cobrar: un interruptor por gimnasio, APAGADO por defecto.
-- Prendido, la hoja Cobrar muestra debajo del medio "Efectivo" una cuenta de "paga con" y vuelto. Es solo una cuenta en pantalla:
-- el monto cobrado sigue siendo el total, y esta migración no toca ninguna función de cobro, de caja ni de ventas.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.configuracion_gimnasio') is null then raise exception 'Guarda: falta public.configuracion_gimnasio'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
end $$;

alter table public.configuracion_gimnasio add column if not exists mostrar_vuelto_efectivo boolean not null default false;

-- ── Lectura: la hoja Cobrar pregunta si está prendido (cualquiera del mostrador) ──
create or replace function public.vuelto_efectivo_activo(p_gimnasio_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return coalesce((select c.mostrar_vuelto_efectivo from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id), false);
end $$;
revoke execute on function public.vuelto_efectivo_activo(uuid) from public, anon;
grant execute on function public.vuelto_efectivo_activo(uuid) to authenticated;

-- ── Guardado: solo el dueño, y solo de su gimnasio ──────────────────
create or replace function public.guardar_vuelto_efectivo(p_gimnasio_id uuid, p_activo boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_activo is null then raise exception 'Datos inválidos' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set mostrar_vuelto_efectivo = p_activo where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar' using errcode = 'P0002'; end if;
  return p_activo;
end $$;
revoke execute on function public.guardar_vuelto_efectivo(uuid, boolean) from public, anon;
grant execute on function public.guardar_vuelto_efectivo(uuid, boolean) to authenticated;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio'
                  and column_name = 'mostrar_vuelto_efectivo' and column_default = 'false') then raise exception 'Verificación: la columna no tiene default false'; end if;
  if has_function_privilege('anon', 'public.guardar_vuelto_efectivo(uuid, boolean)', 'execute')
     or has_function_privilege('anon', 'public.vuelto_efectivo_activo(uuid)', 'execute') then raise exception 'Verificación: ejecutable por anon'; end if;
end $$;
