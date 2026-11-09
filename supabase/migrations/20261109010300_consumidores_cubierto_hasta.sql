-- BASE-1 / F1.6 / F0.3 · Quienes cuentan o listan Retención piden solo las listas que usan (privado.retencion_listas, que se apoya en
-- socios.cubierto_hasta). Ningún número cambia: cada consumidor copia su definición VIGENTE y cambia solo de dónde saca las filas.
--   pendientes_panel · para_hacer_hoy_con · vencen_hoy · vencen_pestanas · panel_inicio · numeros_inicio
-- Los que solo cuentan (Pendientes, Para hacer hoy, Inicio, Números) piden además la versión liviana (sin deuda ni texto de los
-- vencidos, que ahí no se usan): las columnas que leen (lista, dias, monto_mensual, nombre, socio_id) son las mismas.
-- Las firmas no cambian: create or replace alcanza.

do $g$ begin
  if to_regprocedure('privado.retencion_listas(uuid, timestamptz, text[], boolean)') is null then raise exception 'Guarda: falta privado.retencion_listas'; end if;
end $g$;

create or replace function public.pendientes_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; zona text; hoy date; sede uuid; gestion boolean; mostrador boolean;
  vencen int := 0; transf int := 0; tareas int := 0; prosp int := 0; control int := 0; caja int := 0; socios int := 0; msjs int := 0;
  hacer jsonb; r jsonb := '{}'::jsonb; ret jsonb;
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
    -- VD-30: la retención (lo más caro de la pantalla) se calcula UNA vez y se comparte con "Para hacer hoy".
    select coalesce(jsonb_agg(jsonb_build_object('socio_id', r2.socio_id, 'nombre', r2.nombre, 'lista', r2.lista, 'dias', r2.dias)), '[]'::jsonb)
      into ret from privado.retencion_pendientes(p_gimnasio_id, now()) r2 where r2.lista in ('por_vencer', 'no_viene', 'nuevo');
    select count(*) into vencen from jsonb_array_elements(ret) x where x ->> 'lista' = 'por_vencer' and (x ->> 'dias')::int = 0;
    -- Transferencias por aprobar (misma cuenta que "Para hacer hoy").
    select count(*) into transf from public.pagos p join public.ventas v on v.id = p.venta_id
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.medio = 'transferencia'
       and p.comprobante_path is not null and (sede is null or v.sede_id = sede);
    -- Interesados nuevos.
    select count(*) into prosp from public.prospectos p where p.gimnasio_id = p_gimnasio_id and p.estado = 'nuevo';
    -- Para hacer hoy: lo que calcula la base para el mostrador, más mis tareas.
    hacer := privado.para_hacer_hoy_con(p_gimnasio_id, ret);
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

create or replace function privado.para_hacer_hoy_con(p_gimnasio_id uuid, p_ret jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; c public.configuracion_gimnasio; cfg public.tareas_auto; k jsonb; v_clave text; roles jsonb; visible boolean; gestion boolean;
  salida jsonb := '[]'::jsonb; ret jsonb := p_ret; cant int; socios jsonb; texto text; dias int; sede uuid; ve_clases boolean; zona text; hoy date; fin_dia timestamptz;
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
        into ret from privado.retencion_pendientes(p_gimnasio_id, now()) r where r.lista in ('por_vencer', 'no_viene', 'nuevo');
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

create or replace function public.vencen_hoy(p_gimnasio_id uuid)
returns table (socio_id uuid, nombre text, telefono text, texto text, monto_mensual numeric, ultimo_ingreso timestamptz,
               ultimo_contacto_en timestamptz, ultimo_contacto_por text, mensaje text)
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return query
  select r.socio_id, r.nombre, r.telefono, r.texto, r.monto_mensual, r.ultimo_ingreso,
         r.ultimo_contacto_en, r.ultimo_contacto_por, r.mensaje
    from privado.retencion_listas(p_gimnasio_id, now(), array['por_vencer']) r
   where r.lista = 'por_vencer' and r.dias = 0
   order by r.nombre;
end $$;

create or replace function public.vencen_pestanas(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; zona text; gestion boolean; c public.configuracion_vencimiento; hay boolean; r jsonb;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  gestion := e.rol in ('dueno', 'encargado');
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  select * into c from public.configuracion_vencimiento where gimnasio_id = p_gimnasio_id;
  hay := found;
  with x as materialized (
    select t.socio_id, t.nombre, t.telefono, t.texto, t.dias, t.vence_en,
           case when gestion then t.monto_mensual end as monto_mensual, t.debe, t.ultimo_ingreso,
           t.ultimo_contacto_en, t.ultimo_contacto_por, t.mensaje,
           case when t.lista = 'vencido' then 'vencidos' when t.dias = 0 then 'hoy' else 'por_vencer' end as pestana
      from privado.retencion_listas(p_gimnasio_id, now(), array['vencido', 'por_vencer']) t
     where t.lista in ('vencido', 'por_vencer')
  )
  select jsonb_build_object(
    'modo', privado.periodo_pago(case when hay then c.renovacion end, case when hay then c.dia_fijo end, privado.dia_local(now(), zona)),
    'hoy', jsonb_build_object(
      'cantidad', (select count(*) from x where pestana = 'hoy'),
      'plata', case when gestion then (select coalesce(sum(monto_mensual), 0) from x where pestana = 'hoy') end,
      'filas', coalesce((select jsonb_agg(to_jsonb(x) - 'pestana' order by x.nombre) from x where pestana = 'hoy'), '[]')),
    'vencidos', jsonb_build_object(
      'cantidad', (select count(*) from x where pestana = 'vencidos'),
      'plata', (select coalesce(sum(debe), 0) from x where pestana = 'vencidos'),
      'filas', coalesce((select jsonb_agg(to_jsonb(x) - 'pestana' order by x.dias desc, x.nombre) from x where pestana = 'vencidos'), '[]')),
    'por_vencer', jsonb_build_object(
      'cantidad', (select count(*) from x where pestana = 'por_vencer'),
      'plata', case when gestion then (select coalesce(sum(monto_mensual), 0) from x where pestana = 'por_vencer') end,
      'filas', coalesce((select jsonb_agg(to_jsonb(x) - 'pestana' order by x.dias, x.nombre) from x where pestana = 'por_vencer'), '[]')))
    into r;
  return r;
end $$;

create or replace function public.panel_inicio(p_gimnasio_id uuid, p_sede_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; zona text; c public.configuracion_gimnasio; hoy date; desde timestamptz; hasta timestamptz;
  entraron int; vencen int; al_dia int; cobrado numeric; por_aprobar int; clases_hoy int;
  numeros jsonb; ahora jsonb := '[]'::jsonb; s record; caja record; sede uuid;
begin
  e := privado.exigir_equipo(p_gimnasio_id);
  sede := coalesce(p_sede_id, e.sede_id);
  if e.sede_id is not null and sede <> e.sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  if sede is not null and not exists (select 1 from public.sedes where id = sede and gimnasio_id = p_gimnasio_id) then
    raise exception 'Sede inexistente' using errcode = 'P0002';
  end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = p_gimnasio_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  desde := privado.medianoche(hoy, zona);
  hasta := privado.medianoche(hoy + 1, zona);

  select count(distinct i.socio_id) into entraron from public.ingresos i
   where i.gimnasio_id = p_gimnasio_id and i.momento >= desde and i.momento < hasta and i.anulado_en is null
     and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede);

  select count(*) filter (where r.lista = 'por_vencer' and r.dias = 0) into vencen
    from privado.retencion_listas(p_gimnasio_id, now(), array['por_vencer'], true) r;

  select count(distinct cb.socio_id) into al_dia from public.coberturas cb
   where cb.gimnasio_id = p_gimnasio_id and cb.anulada_en is null and cb.desde <= now() and cb.hasta > now();

  select count(*) into por_aprobar from public.pagos p join public.ventas v on v.id = p.venta_id
   where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.medio = 'transferencia'
     and p.comprobante_path is not null and (sede is null or v.sede_id = sede);

  if c.modo_clases <> 'ninguno' and not ('clases' = any (c.secciones_apagadas)) then
    for s in select id from public.sedes where gimnasio_id = p_gimnasio_id and activa and (sede is null or id = sede) loop
      perform privado.materializar_dia(s.id, hoy);
    end loop;
    select count(*) into clases_hoy from public.clases k
     where k.gimnasio_id = p_gimnasio_id and k.inicio >= desde and k.inicio < hasta and k.cancelada_en is null
       and (sede is null or k.sede_id = sede);
  end if;

  if e.rol in ('dueno', 'encargado') or (e.rol = 'recepcion' and c.recepcion_ve_cobrado) then   -- EQU-1
    select coalesce(sum(p.monto), 0) into cobrado from public.pagos p join public.ventas v on v.id = p.venta_id
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.aprobado_en >= desde and p.aprobado_en < hasta
       and p.medio <> 'cuenta_corriente'   -- VEN-5: lo fiado no es plata que entró (entra cuando paga la deuda)
       and (sede is null or v.sede_id = sede);
    numeros := jsonb_build_array(
      jsonb_build_object('clave', 'entraron', 'emoji', '🚪', 'etiqueta', 'Entraron hoy', 'valor', entraron),
      jsonb_build_object('clave', 'vencen', 'emoji', '⏰', 'etiqueta', 'Vencen hoy', 'valor', vencen),
      jsonb_build_object('clave', 'cobrado', 'emoji', '💵', 'etiqueta', 'Cobrado hoy', 'valor', cobrado, 'formato', 'pesos'),
      jsonb_build_object('clave', 'al_dia', 'emoji', '✅', 'etiqueta', 'Socios al día', 'valor', al_dia));
  elsif e.rol = 'profe' then
    -- El profe ve lo suyo: sus clases de hoy, cuántos anotados y cuántos presentes.
    numeros := (
      select jsonb_build_array(
        jsonb_build_object('clave', 'mis_clases', 'emoji', '🗓️', 'etiqueta', 'Mis clases hoy', 'valor', count(*)),
        jsonb_build_object('clave', 'anotados', 'emoji', '📝', 'etiqueta', 'Anotados', 'valor',
          coalesce(sum((select count(*) from public.reservas r where r.clase_id = k.id and r.estado = 'confirmada')), 0)),
        jsonb_build_object('clave', 'presentes', 'emoji', '✅', 'etiqueta', 'Presentes', 'valor',
          coalesce(sum((select count(*) from public.asistencias a where a.clase_id = k.id and a.anulada_en is null)), 0)),
        jsonb_build_object('clave', 'faltan', 'emoji', '⏳', 'etiqueta', 'Me quedan hoy', 'valor', count(*) filter (where k.inicio > now())))
        from public.clases k
       where k.gimnasio_id = p_gimnasio_id and k.profe_id = e.id and k.cancelada_en is null
         and k.inicio >= desde and k.inicio < hasta);
  else
    numeros := jsonb_build_array(
      jsonb_build_object('clave', 'entraron', 'emoji', '🚪', 'etiqueta', 'Entraron hoy', 'valor', entraron),
      jsonb_build_object('clave', 'vencen', 'emoji', '⏰', 'etiqueta', 'Vencen hoy', 'valor', vencen),
      case when clases_hoy is not null
        then jsonb_build_object('clave', 'clases', 'emoji', '🗓️', 'etiqueta', 'Clases hoy', 'valor', clases_hoy)
        else jsonb_build_object('clave', 'al_dia', 'emoji', '✅', 'etiqueta', 'Socios al día', 'valor', al_dia) end,
      jsonb_build_object('clave', 'por_aprobar', 'emoji', '🧾', 'etiqueta', 'Transferencias por aprobar', 'valor', por_aprobar));
  end if;

  -- Ahora y lo que sigue: clases de las próximas horas, caja, pendientes.
  if clases_hoy is not null then
    ahora := ahora || coalesce((
      select jsonb_agg(jsonb_build_object(
               'tipo', 'clase', 'emoji', coalesce(a.emoji, '🗓️'), 'hora', to_char(k.inicio at time zone zona, 'HH24:MI'),
               'titulo', a.nombre,
               'detalle', (select count(*) from public.reservas r where r.clase_id = k.id and r.estado = 'confirmada')
                          || ' anotados' || case when k.cupo is not null then ' de ' || k.cupo else '' end
                          || coalesce(' · ' || p.nombre, ''),
               'href', '/clases') order by k.inicio)
        from public.clases k join public.actividades a on a.id = k.actividad_id
        left join public.equipo p on p.id = k.profe_id
       where k.gimnasio_id = p_gimnasio_id and k.cancelada_en is null and (sede is null or k.sede_id = sede)
         and k.fin > now() and k.inicio < now() + interval '6 hours'), '[]'::jsonb);
  end if;

  if e.rol in ('dueno', 'encargado', 'recepcion') and not ('caja' = any (c.secciones_apagadas)) then
    select t.abierto_en, q.nombre as quien into caja from public.turnos_caja t
      join public.cajas cj on cj.id = t.caja_id left join public.equipo q on q.id = t.abierto_por
     where t.gimnasio_id = p_gimnasio_id and t.cerrado_en is null and (sede is null or cj.sede_id = sede)
     order by t.abierto_en limit 1;
    ahora := ahora || jsonb_build_array(case when caja.abierto_en is null
      then jsonb_build_object('tipo', 'caja', 'emoji', '💵', 'titulo', 'La caja está cerrada', 'detalle', 'Abrila para cobrar en efectivo', 'href', '/caja', 'tono', 'amarillo')
      else jsonb_build_object('tipo', 'caja', 'emoji', '💵', 'titulo', 'Caja abierta',
                              'detalle', 'Desde las ' || to_char(caja.abierto_en at time zone zona, 'HH24:MI') || coalesce(' · ' || caja.quien, ''), 'href', '/caja') end);
  end if;
  if por_aprobar > 0 and e.rol <> 'profe' then
    ahora := ahora || jsonb_build_array(jsonb_build_object('tipo', 'transferencias', 'emoji', '🧾',
      'titulo', por_aprobar || case when por_aprobar = 1 then ' transferencia para aprobar' else ' transferencias para aprobar' end,
      'detalle', 'Mirá el comprobante y aprobala', 'href', '/transferencias', 'tono', 'azul'));
  end if;
  if vencen > 0 and e.rol <> 'profe' then
    ahora := ahora || jsonb_build_array(jsonb_build_object('tipo', 'vencen', 'emoji', '⏰',
      'titulo', vencen || case when vencen = 1 then ' socio vence hoy' else ' socios vencen hoy' end,
      'detalle', 'Avisales antes de que se vayan', 'href', '/vencen-hoy', 'tono', 'amarillo'));
  end if;

  return jsonb_build_object('hoy', hoy, 'numeros', numeros, 'ahora', ahora);
end $$;

create or replace function public.numeros_inicio(p_gimnasio_id uuid, p_sede_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; c public.configuracion_gimnasio; zona text; hoy date; desde timestamptz; hasta timestamptz;
  sede uuid; ve_plata boolean; hay_clases boolean; corrido interval;
  todos text[] := array['adentro','entraron','cobrado','a_cobrar','deben','por_vencer','plata_riesgo','activos','altas_mes','bajas_mes','ocupacion'];
  claves text[] := '{}'; k text; v numeric; serie jsonb; salida jsonb := '[]'::jsonb; disponibles jsonb := '[]'::jsonb;
  r_hoy int := 0; r_sem int := 0; r_deben int := 0; r_riesgo numeric := 0; mes timestamptz; salida_modo text := 'no'; horas_visita int := 5; adentro_etiq text := 'Adentro (aprox.)';
  etiq jsonb := jsonb_build_object(
    'adentro', '🏋️|Adentro (aprox.)', 'entraron', '🚪|Entraron hoy', 'cobrado', '💵|Cobrado hoy', 'a_cobrar', '⏰|A cobrar hoy',
    'activos', '✅|Socios activos', 'altas_mes', '🆕|Altas del mes', 'bajas_mes', '👋|Bajas del mes',
    'deben', '🔴|Deben', 'por_vencer', '🟡|Vencen esta semana', 'plata_riesgo', '⚠️|Plata en riesgo', 'ocupacion', '🗓️|Ocupación de clases (%)');
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  sede := coalesce(p_sede_id, e.sede_id);
  if e.sede_id is not null and sede <> e.sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = p_gimnasio_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  -- VD-48: con la salida prendida, "Adentro ahora" cuenta las visitas abiertas (exacto).
  select coalesce(cv.registrar_salida, 'no'), case when coalesce(cv.visita_horas, 5) > 0 then coalesce(cv.visita_horas, 5) else 5 end into salida_modo, horas_visita
    from (select 1) u left join public.configuracion_visita cv on cv.gimnasio_id = p_gimnasio_id;
  if salida_modo <> 'no' then adentro_etiq := 'Adentro ahora'; end if;
  hoy := privado.dia_local(now(), zona);
  desde := privado.medianoche(hoy, zona);
  hasta := privado.medianoche(hoy + 1, zona);
  mes := privado.medianoche(date_trunc('month', hoy)::date, zona);
  corrido := now() - desde;
  -- La plata del día: dueño y encargado siempre; la recepción solo si el dueño lo prendió (EQU-1).
  ve_plata := e.rol in ('dueno', 'encargado') or (e.rol = 'recepcion' and c.recepcion_ve_cobrado);
  hay_clases := c.modo_clases <> 'ninguno' and not ('clases' = any (c.secciones_apagadas));

  foreach k in array todos loop
    if (k = 'cobrado' and not ve_plata) or (k = 'plata_riesgo' and e.rol not in ('dueno', 'encargado')) or (k = 'ocupacion' and not hay_clases) then continue; end if;
    disponibles := disponibles || jsonb_build_array(jsonb_build_object('clave', k, 'etiqueta', case when k = 'adentro' then adentro_etiq else split_part(etiq ->> k, '|', 2) end, 'emoji', split_part(etiq ->> k, '|', 1)));
  end loop;

  foreach k in array c.numeros_inicio loop
    if exists (select 1 from jsonb_array_elements(disponibles) d where d ->> 'clave' = k) then claves := claves || k; end if;
  end loop;
  if cardinality(claves) = 0 then
    foreach k in array case when ve_plata then array['adentro','entraron','cobrado','a_cobrar','por_vencer','deben','plata_riesgo'] else array['adentro','entraron','a_cobrar','por_vencer','deben'] end loop
      if exists (select 1 from jsonb_array_elements(disponibles) d where d ->> 'clave' = k) then claves := claves || k; end if;
    end loop;
  end if;

  -- BASE-1: Retención es lo caro; los 4 números que salen de ahí se sacan de UNA sola pasada.
  if claves && array['a_cobrar', 'deben', 'por_vencer', 'plata_riesgo'] then
    select count(*) filter (where r.lista = 'por_vencer' and r.dias = 0), count(*) filter (where r.lista = 'por_vencer' and r.dias between 1 and 7),
           count(*) filter (where r.lista = 'vencido'), coalesce(sum(r.monto_mensual) filter (where r.lista in ('vencido', 'por_vencer', 'nuevo', 'no_viene')), 0)
      into r_hoy, r_sem, r_deben, r_riesgo from privado.retencion_listas(p_gimnasio_id, now(), array['por_vencer', 'vencido', 'nuevo', 'no_viene'], true) r;
  end if;

  foreach k in array claves loop
    serie := null; v := 0;
    if k = 'adentro' then
      if salida_modo = 'no' then
        select count(distinct i.socio_id) into v from public.ingresos i
         where i.gimnasio_id = p_gimnasio_id and i.momento >= greatest(desde, now() - interval '2 hours') and i.momento <= now()
           and i.anulado_en is null and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede);
      else
        v := privado.adentro_ahora(p_gimnasio_id, sede, now());
      end if;
      -- cuántos había adentro a esta misma hora en cada uno de los últimos 7 días
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(distinct i.socio_id) as n from public.ingresos i
           where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede)
             and i.momento >= greatest(privado.medianoche(g.dia, zona), privado.medianoche(g.dia, zona) + corrido - interval '2 hours')
             and i.momento <= privado.medianoche(g.dia, zona) + corrido) x on true;
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
      v := r_hoy;
      -- a cuántos les vencía la cobertura en cada uno de los últimos 7 días
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(distinct cb.socio_id) as n from public.coberturas cb
           where cb.gimnasio_id = p_gimnasio_id and cb.anulada_en is null
             and cb.hasta > privado.medianoche(g.dia, zona) and cb.hasta <= privado.medianoche(g.dia + 1, zona)) x on true;
    elsif k = 'deben' then
      v := r_deben;
    elsif k = 'por_vencer' then
      v := r_sem;
    elsif k = 'plata_riesgo' then
      v := r_riesgo;
    elsif k = 'activos' then
      select count(distinct cb.socio_id) into v from public.coberturas cb
       where cb.gimnasio_id = p_gimnasio_id and cb.anulada_en is null and cb.desde <= now() and cb.hasta > now();
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(distinct cb.socio_id) as n from public.coberturas cb
           where cb.gimnasio_id = p_gimnasio_id and (cb.anulada_en is null or cb.anulada_en > least(now(), privado.medianoche(g.dia + 1, zona) - interval '1 second'))
             and cb.desde <= least(now(), privado.medianoche(g.dia + 1, zona) - interval '1 second')
             and cb.hasta > least(now(), privado.medianoche(g.dia + 1, zona) - interval '1 second')) x on true;
    elsif k = 'altas_mes' then
      select count(*) into v from public.socios s where s.gimnasio_id = p_gimnasio_id and s.creado_en >= mes;
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(*) as n from public.socios s where s.gimnasio_id = p_gimnasio_id
           and s.creado_en >= privado.medianoche(g.dia, zona) and s.creado_en < privado.medianoche(g.dia + 1, zona)) x on true;
    elsif k = 'bajas_mes' then
      select count(*) into v from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en >= mes;
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(*) as n from public.socios s where s.gimnasio_id = p_gimnasio_id
           and s.dado_de_baja_en >= privado.medianoche(g.dia, zona) and s.dado_de_baja_en < privado.medianoche(g.dia + 1, zona)) x on true;
    elsif k = 'ocupacion' then
      select coalesce(round(100.0 * sum((select count(*) from public.reservas r where r.clase_id = kl.id and r.estado = 'confirmada'))
                            / nullif(sum(kl.cupo), 0)), 0) into v
        from public.clases kl where kl.gimnasio_id = p_gimnasio_id and kl.inicio >= desde and kl.inicio < hasta
         and kl.cancelada_en is null and kl.cupo is not null and (sede is null or kl.sede_id = sede);
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select coalesce(round(100.0 * sum((select count(*) from public.reservas r where r.clase_id = kl.id and r.estado = 'confirmada'))
                                  / nullif(sum(kl.cupo), 0)), 0) as n
           from public.clases kl where kl.gimnasio_id = p_gimnasio_id and kl.inicio >= privado.medianoche(g.dia, zona) and kl.inicio < privado.medianoche(g.dia + 1, zona)
            and kl.cancelada_en is null and kl.cupo is not null and (sede is null or kl.sede_id = sede)) x on true;
    end if;
    -- El último punto es hoy: tiene que coincidir con el número que se ve.
    if serie is not null and jsonb_array_length(serie) = 7 then serie := jsonb_set(serie, '{6}', to_jsonb(coalesce(v, 0))); end if;
    salida := salida || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'clave', k, 'emoji', split_part(etiq ->> k, '|', 1), 'etiqueta', case when k = 'adentro' then adentro_etiq else split_part(etiq ->> k, '|', 2) end,
      'valor', coalesce(v, 0), 'formato', case when k in ('cobrado', 'plata_riesgo') then 'pesos' when k = 'ocupacion' then 'porcentaje' end,
      'serie', serie)));
  end loop;

  return jsonb_build_object('numeros', salida, 'elegidos', to_jsonb(c.numeros_inicio), 'disponibles', disponibles,
                            'adentro_exacto', salida_modo <> 'no');
end $$;

do $v$
declare f text;
begin
  foreach f in array array['public.pendientes_panel(uuid)', 'privado.para_hacer_hoy_con(uuid, jsonb)', 'public.vencen_hoy(uuid)', 'public.vencen_pestanas(uuid)', 'public.panel_inicio(uuid, uuid)', 'public.numeros_inicio(uuid, uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $v$;
