-- VD-30 · Velocidad medida y escala (docs/v2/07, 13 §5, 16 §2.7-2.8).
-- Medido con 3.000 socios y 200 gimnasios (workflow "Medir escala"). Solo índices y reescrituras que NO
-- cambian el resultado de ninguna función.
--
-- 1) para_hacer_hoy: la tarea "clases con lista de espera" nunca andaba, porque la variable `fin` chocaba
--    con la columna public.clases.fin ("column reference fin is ambiguous"). Se renombra la variable.
--    (Salió midiendo: pendientes_panel, que la llama, fallaba entero en un gimnasio con clases.)

-- ── Guarda de entrada ──────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.para_hacer_hoy(uuid)') is null then raise exception 'Guarda: falta public.para_hacer_hoy'; end if;
  if to_regprocedure('public.pendientes_panel(uuid)') is null then raise exception 'Guarda: falta public.pendientes_panel'; end if;
end $$;

create or replace function public.para_hacer_hoy(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; c public.configuracion_gimnasio; cfg public.tareas_auto; k jsonb; v_clave text; roles jsonb; visible boolean; gestion boolean;
  salida jsonb := '[]'::jsonb; ret jsonb; cant int; socios jsonb; texto text; dias int; sede uuid; ve_clases boolean; zona text; hoy date; fin_dia timestamptz;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  sede := e.sede_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  fin_dia := privado.medianoche(hoy + 1, zona);
  ve_clases := c.modo_clases <> 'ninguno' and not ('clases' = any (c.secciones_apagadas));

  for k in select x from jsonb_array_elements(privado.catalogo_tareas_auto()) x loop
    v_clave := k ->> 'clave';
    gestion := (k ->> 'gestion')::boolean;
    cfg := null;
    select * into cfg from public.tareas_auto t where t.gimnasio_id = p_gimnasio_id and t.clave = v_clave;
    if found and not cfg.activa then continue; end if;
    -- Para quién es: una persona, un rol, o lo de siempre. El dueño ve todo; el encargado ve también lo de la recepción.
    if cfg.para_equipo is not null then
      visible := cfg.para_equipo = e.id or e.rol = 'dueno';
    else
      roles := case when cfg.para_rol is not null then jsonb_build_array(cfg.para_rol) else k -> 'roles' end;
      visible := e.rol = 'dueno' or roles ? e.rol::text or (e.rol = 'encargado' and roles ? 'recepcion');
    end if;
    if gestion and e.rol = 'recepcion' then visible := false; end if;
    if not visible then continue; end if;
    dias := coalesce(cfg.dias, nullif(k ->> 'dias', '')::int);
    cant := 0; socios := null; texto := null;

    if v_clave in ('vencen_hoy', 'vencen_pronto', 'no_vienen', 'nuevos_sin_venir') and ret is null then
      select coalesce(jsonb_agg(jsonb_build_object('socio_id', r.socio_id, 'nombre', r.nombre, 'lista', r.lista, 'dias', r.dias)), '[]'::jsonb)
        into ret from privado.retencion(p_gimnasio_id, now()) r where r.lista in ('por_vencer', 'no_viene', 'nuevo');
    end if;

    if v_clave = 'vencen_hoy' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'nombre')) into cant, socios
        from jsonb_array_elements(ret) x where x ->> 'lista' = 'por_vencer' and (x ->> 'dias')::int = 0;
      texto := 'Cobrarle a ' || cant || case when cant = 1 then ' que vence hoy' else ' que vencen hoy' end;
    elsif v_clave = 'vencen_pronto' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'nombre')) into cant, socios
        from jsonb_array_elements(ret) x where x ->> 'lista' = 'por_vencer' and (x ->> 'dias')::int between 1 and coalesce(dias, 3);
      texto := 'Avisar a ' || cant || case when cant = 1 then ' que vence' else ' que vencen' end || ' en ' || coalesce(dias, 3) || ' días o menos';
    elsif v_clave = 'no_vienen' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'nombre')) into cant, socios
        from jsonb_array_elements(ret) x where x ->> 'lista' = 'no_viene';
      texto := cant || case when cant = 1 then ' no viene' else ' no vienen' end || ' hace ' || c.retencion_dias_ausencia || ' días o más';
    elsif v_clave = 'nuevos_sin_venir' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'nombre')) into cant, socios
        from jsonb_array_elements(ret) x where x ->> 'lista' = 'nuevo';
      texto := cant || case when cant = 1 then ' nuevo todavía no vino' else ' nuevos todavía no vinieron' end;
    elsif v_clave = 'prometieron' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'socio')) into cant, socios
        from jsonb_array_elements(public.prometieron_pagar(p_gimnasio_id)) x;
      texto := cant || case when cant = 1 then ' prometió pagar' else ' prometieron pagar' end;
    elsif v_clave = 'transferencias' then
      select count(*) into cant from public.pagos p join public.ventas v on v.id = p.venta_id
       where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.medio = 'transferencia'
         and p.comprobante_path is not null and (sede is null or v.sede_id = sede);
      texto := 'Aprobar ' || cant || case when cant = 1 then ' transferencia' else ' transferencias' end;
    elsif v_clave = 'caja_abierta' then
      if 'caja' = any (c.secciones_apagadas) then continue; end if;
      cant := jsonb_array_length(public.cajas_olvidadas(p_gimnasio_id));
      texto := case when cant = 1 then 'Cerrar la caja que quedó abierta' else 'Cerrar las ' || cant || ' cajas que quedaron abiertas' end;
    elsif v_clave = 'caja_sin_contar' then
      if 'caja' = any (c.secciones_apagadas) then continue; end if;
      cant := jsonb_array_length(public.cajas_para_revisar(p_gimnasio_id));
      texto := 'Contar ' || cant || case when cant = 1 then ' caja que quedó sin contar' else ' cajas que quedaron sin contar' end;
    elsif v_clave = 'cumpleanos' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'nombre')) into cant, socios
        from jsonb_array_elements(public.cumplen_hoy(p_gimnasio_id)) x;
      texto := cant || case when cant = 1 then ' cumple años hoy' else ' cumplen años hoy' end;
    elsif v_clave = 'stock_bajo' then
      select count(*) into cant from public.productos pr
       where pr.gimnasio_id = p_gimnasio_id and pr.activo and pr.controla_stock
         and (privado.stock_producto(pr.id) <= 0 or (pr.stock_minimo is not null and privado.stock_producto(pr.id) <= pr.stock_minimo));
      texto := 'Reponer ' || cant || case when cant = 1 then ' producto' else ' productos' end;
    elsif v_clave = 'pedidos_pausa' then
      cant := jsonb_array_length(public.pedidos_pausa_pendientes(p_gimnasio_id));
      texto := cant || case when cant = 1 then ' pausa para aprobar' else ' pausas para aprobar' end;
    elsif v_clave = 'pedidos_baja' then
      cant := jsonb_array_length(public.pedidos_baja_pendientes(p_gimnasio_id));
      texto := cant || case when cant = 1 then ' baja pedida desde la app' else ' bajas pedidas desde la app' end;
    elsif v_clave = 'clases_espera' then
      if not ve_clases then continue; end if;
      select count(*) into cant from public.clases kl
       where kl.gimnasio_id = p_gimnasio_id and kl.inicio >= now() and kl.inicio < fin_dia and kl.cancelada_en is null
         and (sede is null or kl.sede_id = sede)
         and exists (select 1 from public.reservas r where r.clase_id = kl.id and r.estado = 'espera');
      texto := cant || case when cant = 1 then ' clase tiene lista de espera' else ' clases tienen lista de espera' end;
    end if;

    if coalesce(cant, 0) > 0 then
      salida := salida || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'clave', v_clave, 'emoji', k ->> 'emoji', 'titulo', k ->> 'titulo', 'texto', texto, 'cantidad', cant, 'href', k ->> 'href',
        'cobrar', v_clave in ('vencen_hoy', 'prometieron'),
        'socios', case when socios is null then null else (select jsonb_agg(s) from (select s from jsonb_array_elements(socios) s limit 8) z) end)));
    end if;
  end loop;
  return salida;
end $$;

revoke all on function public.para_hacer_hoy(uuid) from public, anon, authenticated;
grant execute on function public.para_hacer_hoy(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.para_hacer_hoy(uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: para_hacer_hoy sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.para_hacer_hoy(uuid)', 'execute') then raise exception 'Verificación: anon puede ejecutar para_hacer_hoy'; end if;
end $$;
