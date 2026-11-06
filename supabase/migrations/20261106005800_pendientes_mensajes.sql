-- VD-38b · El contador de Mensajes en el menú del panel.
-- pendientes_panel (0052, la vigente) dejaba `mensajes` en 0 porque los mensajes de los socios no existían.
-- Ahora existen (0053: mensajes_sin_responder). Copia de pendientes_panel de 0052; único cambio: `mensajes`
-- suma los hilos que esperan respuesta. Quien no ve los mensajes (recepción sin permiso) recibe 0 de
-- mensajes_sin_responder, así que el contador nunca rompe la pantalla ni muestra un número que no puede abrir.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.pendientes_panel(uuid)') is null then raise exception 'Guarda: falta pendientes_panel (0052)'; end if;
  if to_regprocedure('public.mensajes_sin_responder(uuid)') is null then raise exception 'Guarda: falta mensajes_sin_responder (0053)'; end if;
end $$;

create or replace function public.pendientes_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; zona text; hoy date; sede uuid; gestion boolean; mostrador boolean;
  vencen int := 0; transf int := 0; tareas int := 0; prosp int := 0; control int := 0; caja int := 0; socios int := 0; msjs int := 0;
  hacer jsonb; r jsonb := '{}'::jsonb;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  gestion := e.rol in ('dueno', 'encargado');
  mostrador := e.rol in ('dueno', 'encargado', 'recepcion');
  sede := e.sede_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := (now() at time zone zona)::date;

  -- Lo mío para hacer (todos los roles): tareas sin hacer para hoy o atrasadas.
  select count(*) into tareas from public.tareas t
   where t.gimnasio_id = p_gimnasio_id and t.para = e.id and t.hecha_en is null and t.dia <= hoy;

  if mostrador then
    -- Vencen y cobrar: los que vencen hoy y todavía no pagaron (el mismo cálculo que la pantalla).
    select count(*) into vencen from privado.retencion(p_gimnasio_id, now()) x where x.lista = 'por_vencer' and x.dias = 0;
    -- Transferencias por aprobar (misma cuenta que "Para hacer hoy").
    select count(*) into transf from public.pagos p join public.ventas v on v.id = p.venta_id
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.medio = 'transferencia'
       and p.comprobante_path is not null and (sede is null or v.sede_id = sede);
    -- Interesados nuevos.
    select count(*) into prosp from public.prospectos p where p.gimnasio_id = p_gimnasio_id and p.estado = 'nuevo';
    -- Para hacer hoy: lo que calcula la base para el mostrador, más mis tareas.
    hacer := public.para_hacer_hoy(p_gimnasio_id);
    tareas := tareas + case jsonb_typeof(hacer)
      when 'array' then jsonb_array_length(hacer)
      when 'object' then case when jsonb_typeof(hacer -> 'items') = 'array' then jsonb_array_length(hacer -> 'items') else 0 end
      else 0 end;
    -- Caja: abiertas que quedaron olvidadas (la recepción, las suyas).
    caja := jsonb_array_length(public.cajas_olvidadas(p_gimnasio_id));
    -- VD-38b: mensajes de los socios que esperan respuesta (0 si este usuario no los ve).
    msjs := coalesce(public.mensajes_sin_responder(p_gimnasio_id), 0);
  end if;

  if gestion then
    -- Caja: cerradas sin contar que esperan revisión, y pedidos de anular una venta.
    caja := caja
      + (select count(*) from public.turnos_caja t where t.gimnasio_id = p_gimnasio_id and t.sin_contar and t.monto_contado is null and t.revisado_en is null)
      + (select count(*) from public.pedidos_anulacion pa where pa.gimnasio_id = p_gimnasio_id and pa.estado = 'pendiente');
    -- Socios: pedidos de pausa y de baja que esperan respuesta.
    socios := (select count(*) from public.pedidos_pausa x where x.gimnasio_id = p_gimnasio_id and x.estado = 'pendiente')
            + (select count(*) from public.pedidos_baja x where x.gimnasio_id = p_gimnasio_id and x.estado = 'pendiente');
    -- Control sin ver: los avisos del Control que todavía no abrió (solo quien ve el Control).
    begin
      control := coalesce((public.campana_control(p_gimnasio_id) ->> 'sin_leer')::int, 0);
    exception when insufficient_privilege then
      control := null;
    end;
  end if;

  r := jsonb_build_object('tareas', tareas);
  if mostrador then
    r := r || jsonb_build_object('vencen_hoy', vencen, 'transferencias', transf, 'prospectos', prosp, 'caja', caja,
                                 'mensajes', msjs);
  end if;
  if gestion then
    r := r || jsonb_build_object('socios', socios);
    if control is not null then r := r || jsonb_build_object('control', control); end if;
  end if;
  return r;
end $$;

revoke all on function public.pendientes_panel(uuid) from public, anon, authenticated;
grant execute on function public.pendientes_panel(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.pendientes_panel(uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: pendientes_panel sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.pendientes_panel(uuid)', 'execute') then raise exception 'Verificación: anon puede ejecutar pendientes_panel'; end if;
  if position('mensajes_sin_responder' in pg_get_functiondef('public.pendientes_panel(uuid)'::regprocedure)) = 0 then
    raise exception 'Verificación: pendientes_panel no suma los mensajes';
  end if;
end $$;
