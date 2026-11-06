-- VD-9 (2/2) · Mi turno, "Para revisar", reporte X y Z, configuración de la caja.
--   config_caja(gimnasio) / guardar_config_caja(...)   cómo cierra cada gimnasio (la guarda solo el dueño)
--   mi_turno_caja(sede)                               mi turno abierto o las cajas libres para abrir (Inicio y Entrada)
--   cajas_para_revisar(gimnasio)                      las que se cerraron sin contar (registra las vencidas)
--   contar_caja_sin_contar(turno, contado, nota, billetes) / dejar_caja_sin_contar(turno, motivo)
--   reporte_turno(turno)  (X, o el cierre ya hecho)    reporte_dia(sede, día)  (Z)
-- Todo lo que se hace queda con quién y cuándo (revisado_por/en, actualizado_por/en, historial de configuración).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.configuracion_caja') is null then raise exception 'Guarda: falta la migración 004100 (configuracion_caja)'; end if;
  if to_regprocedure('privado.turno_vence(uuid)') is null then raise exception 'Guarda: falta privado.turno_vence'; end if;
  if to_regprocedure('privado.registrar_cambios(uuid, text, jsonb, jsonb, text[])') is null then raise exception 'Guarda: falta privado.registrar_cambios'; end if;
  if to_regprocedure('privado.mi_equipo_id(uuid)') is null then raise exception 'Guarda: falta privado.mi_equipo_id'; end if;
end $$;

-- ── Configuración ───────────────────────────────────────────────────
create or replace function public.config_caja(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare k public.configuracion_caja;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select * into k from public.configuracion_caja where gimnasio_id = p_gimnasio_id;
  return jsonb_build_object('modo', coalesce(k.modo, 'por_turno'), 'pedir_billetes', coalesce(k.pedir_billetes, false),
                            'fondo_fijo', coalesce(k.fondo_fijo, 0), 'hora_corte', to_char(coalesce(k.hora_corte, time '00:00'), 'HH24:MI'),
                            'horas_max', coalesce(k.horas_max, 14));
end $$;

create or replace function public.guardar_config_caja(p_gimnasio_id uuid, p_modo text, p_pedir_billetes boolean, p_fondo_fijo numeric,
                                                      p_hora_corte text, p_horas_max int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; antes jsonb; n int; corte time;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_modo not in ('por_turno', 'una_por_dia') then raise exception 'Elegí caja por turno o una caja por día' using errcode = '22023'; end if;
  if p_pedir_billetes is null then raise exception 'Elegí si se pide contar los billetes' using errcode = '22023'; end if;
  if p_fondo_fijo is null or p_fondo_fijo < 0 then raise exception 'El fondo fijo no puede ser negativo' using errcode = '22023'; end if;
  if p_horas_max is null or p_horas_max not between 1 and 48 then raise exception 'Las horas de un turno van de 1 a 48' using errcode = '22023'; end if;
  begin corte := p_hora_corte::time; exception when others then raise exception 'La hora de corte es inválida (ejemplo: 00:00)' using errcode = '22023'; end;
  antes := public.config_caja(p_gimnasio_id);
  insert into public.configuracion_caja (gimnasio_id) values (p_gimnasio_id) on conflict (gimnasio_id) do nothing;
  update public.configuracion_caja
     set modo = p_modo, pedir_billetes = p_pedir_billetes, fondo_fijo = round(p_fondo_fijo, 2), hora_corte = corte,
         horas_max = p_horas_max, actualizado_en = now(), actualizado_por = e.id
   where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la configuración de la caja'; end if;
  perform privado.registrar_cambios(p_gimnasio_id, 'caja.', antes, public.config_caja(p_gimnasio_id), array[]::text[]);
  return public.config_caja(p_gimnasio_id);
end $$;

-- ── Mi turno ────────────────────────────────────────────────────────
-- Lo que necesita Inicio y la Entrada: si tengo un turno abierto (y si ya se venció) o qué cajas
-- puedo abrir, con el fondo sugerido (el fondo fijo, o lo que dejó el turno anterior contado).
create or replace function public.mi_turno_caja(p_sede_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; eid uuid; k public.configuracion_caja; mio record; libres jsonb; sugerido numeric; zona text;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], p_sede_id);
  select * into k from public.configuracion_caja where gimnasio_id = g;
  select zona_horaria into zona from public.gimnasios where id = g;
  select t.id, c.nombre, t.abierto_en, privado.turno_vence(t.id) as vence into mio
    from public.turnos_caja t join public.cajas c on c.id = t.caja_id
   where t.gimnasio_id = g and t.abierto_por = eid and t.cerrado_en is null order by t.abierto_en limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('caja_id', c.id, 'nombre', c.nombre,
           'fondo_sugerido', case when coalesce(k.fondo_fijo, 0) > 0 then k.fondo_fijo
                                  else coalesce((select t2.monto_contado from public.turnos_caja t2 where t2.caja_id = c.id and t2.monto_contado is not null
                                                  order by t2.abierto_en desc limit 1), 0) end,
           'con_vencida', exists (select 1 from public.turnos_caja t3 where t3.caja_id = c.id and t3.cerrado_en is null and privado.turno_vence(t3.id) <= now()))
           order by c.nombre), '[]'::jsonb) into libres
    from public.cajas c
   where c.sede_id = p_sede_id and c.activa
     and not exists (select 1 from public.turnos_caja t where t.caja_id = c.id and t.cerrado_en is null and privado.turno_vence(t.id) > now())
     and not (coalesce(k.modo, 'por_turno') = 'una_por_dia' and exists (
           select 1 from public.turnos_caja t4 where t4.caja_id = c.id
              and privado.dia_caja(t4.abierto_en, zona, coalesce(k.hora_corte, time '00:00')) = privado.dia_caja(now(), zona, coalesce(k.hora_corte, time '00:00'))
              and t4.cerrado_en is not null));
  return jsonb_build_object(
    'turno', case when mio.id is null then null else jsonb_build_object('turno_id', mio.id, 'caja', mio.nombre, 'abierto_en', mio.abierto_en, 'vencido', mio.vence <= now()) end,
    'libres', libres, 'modo', coalesce(k.modo, 'por_turno'), 'pedir_billetes', coalesce(k.pedir_billetes, false));
end $$;

-- ── Para revisar: lo que se cerró sin contar ────────────────────────
-- Registra las vencidas (el "primer acceso") y lista las que nadie contó ni dejó con motivo.
create or replace function public.cajas_para_revisar(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  perform privado.cerrar_cajas_vencidas(p_gimnasio_id);
  return coalesce((select jsonb_agg(privado.resumen_turno(t.id) || jsonb_build_object(
           'caja', c.nombre, 'sede_id', c.sede_id, 'abierto_por', (select q.nombre from public.equipo q where q.id = t.abierto_por),
           'registrada_en', t.sin_contar_en) order by t.abierto_en desc)
      from public.turnos_caja t join public.cajas c on c.id = t.caja_id
     where t.gimnasio_id = p_gimnasio_id and t.sin_contar and t.monto_contado is null and t.revisado_en is null), '[]'::jsonb);
end $$;

create or replace function public.contar_caja_sin_contar(p_turno_id uuid, p_monto_contado numeric, p_nota text default null, p_billetes jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.turnos_caja; c public.cajas; eid uuid; n int;
begin
  select * into t from public.turnos_caja where id = p_turno_id for update;
  if not found then raise exception 'Sin permiso o turno inexistente' using errcode = '42501'; end if;
  select * into c from public.cajas where id = t.caja_id;
  eid := privado.exigir_rol(t.gimnasio_id, array['dueno', 'encargado'], c.sede_id);
  if not t.sin_contar then raise exception 'Esa caja no quedó sin contar' using errcode = '22023'; end if;
  if t.monto_contado is not null or t.revisado_en is not null then raise exception 'Esa caja ya se revisó' using errcode = '22023'; end if;
  if p_monto_contado is null or p_monto_contado < 0 then raise exception 'El monto contado no puede ser negativo' using errcode = '22023'; end if;
  perform privado.validar_billetes(p_billetes, round(p_monto_contado, 2), t.gimnasio_id);
  update public.turnos_caja
     set monto_contado = round(p_monto_contado, 2), cerrado_por = eid, contado_en = now(), billetes = p_billetes,
         revisado_en = now(), revisado_por = eid, nota = coalesce(nullif(trim(coalesce(p_nota, '')), ''), nota)
   where id = t.id and monto_contado is null and revisado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo anotar el conteo'; end if;
  return privado.resumen_turno(t.id);
end $$;

create or replace function public.dejar_caja_sin_contar(p_turno_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.turnos_caja; c public.cajas; eid uuid; n int;
begin
  select * into t from public.turnos_caja where id = p_turno_id for update;
  if not found then raise exception 'Sin permiso o turno inexistente' using errcode = '42501'; end if;
  select * into c from public.cajas where id = t.caja_id;
  eid := privado.exigir_rol(t.gimnasio_id, array['dueno', 'encargado'], c.sede_id);
  if not t.sin_contar or t.monto_contado is not null or t.revisado_en is not null then raise exception 'Esa caja no está para revisar' using errcode = '22023'; end if;
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'Escribí el motivo de dejarla sin contar' using errcode = '22023'; end if;
  update public.turnos_caja set revisado_en = now(), revisado_por = eid, revisado_nota = trim(p_motivo)
   where id = t.id and monto_contado is null and revisado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo anotar el motivo'; end if;
  return privado.resumen_turno(t.id);
end $$;

-- ── Reporte del turno (X; es el cierre cuando ya cerró) ─────────────
-- Con el turno abierto lo ve solo el dueño o el encargado (arqueo ciego). Ya cerrado, la
-- recepción ve solo los suyos (los que abrió o cerró).
create or replace function public.reporte_turno(p_turno_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t public.turnos_caja; c public.cajas; eid uuid; rol text; hasta timestamptz;
begin
  select * into t from public.turnos_caja where id = p_turno_id;
  if not found then raise exception 'Sin permiso o turno inexistente' using errcode = '42501'; end if;
  select * into c from public.cajas where id = t.caja_id;
  eid := privado.exigir_rol(t.gimnasio_id, array['dueno', 'encargado', 'recepcion'], c.sede_id);
  select e.rol into rol from public.equipo e where e.id = eid;
  if rol = 'recepcion' and (t.cerrado_en is null or (t.abierto_por <> eid and t.cerrado_por is distinct from eid)) then
    raise exception 'Sin permiso para ver este reporte' using errcode = '42501';
  end if;
  hasta := coalesce(t.cerrado_en, now());
  return privado.resumen_turno(t.id) || jsonb_build_object(
    'caja', c.nombre, 'sede_id', c.sede_id,
    'abierto_por', (select q.nombre from public.equipo q where q.id = t.abierto_por),
    'cerrado_por', (select q.nombre from public.equipo q where q.id = t.cerrado_por),
    'revisado_por', (select q.nombre from public.equipo q where q.id = t.revisado_por), 'revisado_en', t.revisado_en,
    'nota', t.nota, 'contado_en', t.contado_en,
    'por_medio', coalesce((select jsonb_agg(jsonb_build_object('medio', m.medio, 'total', m.total, 'cantidad', m.cantidad) order by m.total desc)
        from (select p.medio, sum(p.monto) as total, count(*) as cantidad
                from public.pagos p join public.ventas v on v.id = p.venta_id
               where p.estado = 'aprobado' and (p.turno_caja_id = t.id or v.turno_caja_id = t.id) group by p.medio) m), '[]'::jsonb),
    'ventas', jsonb_build_object(
        'cantidad', (select count(*) from public.ventas v where v.turno_caja_id = t.id and v.estado = 'confirmada'),
        'total', coalesce((select sum(i.cantidad * i.precio_unitario - i.descuento) from public.venta_items i join public.ventas v on v.id = i.venta_id
                            where v.turno_caja_id = t.id and v.estado = 'confirmada'), 0)),
    'anuladas', jsonb_build_object(
        'cantidad', (select count(*) from public.ventas v where v.turno_caja_id = t.id and v.estado = 'anulada'),
        'total', coalesce((select sum(i.cantidad * i.precio_unitario - i.descuento) from public.venta_items i join public.ventas v on v.id = i.venta_id
                            where v.turno_caja_id = t.id and v.estado = 'anulada'), 0)),
    'movimientos', coalesce((select jsonb_agg(jsonb_build_object('tipo', m.tipo, 'monto', m.monto, 'motivo', m.motivo, 'en', m.creado_en,
                      'por', (select q.nombre from public.equipo q where q.id = m.creado_por)) order by m.creado_en)
                      from public.movimientos_caja m where m.turno_caja_id = t.id), '[]'::jsonb),
    'dejados_pasar', (select count(*) from public.ingresos i where i.sede_id = c.sede_id and i.resultado = 'forzado' and i.anulado_en is null
                          and i.momento >= t.abierto_en and i.momento < hasta));
end $$;

-- ── Reporte del día (Z) ─────────────────────────────────────────────
-- Todos los turnos de la sede que se abrieron en el día de caja, con lo contado y lo que falta contar.
create or replace function public.reporte_dia(p_sede_id uuid, p_dia date default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; k public.configuracion_caja; zona text; corte time; dia date; desde timestamptz; hasta timestamptz; r jsonb;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(g, array['dueno', 'encargado'], p_sede_id);
  perform privado.cerrar_cajas_vencidas(g);
  select * into k from public.configuracion_caja where gimnasio_id = g;
  select zona_horaria into zona from public.gimnasios where id = g;
  corte := coalesce(k.hora_corte, time '00:00');
  dia := coalesce(p_dia, privado.dia_caja(now(), zona, corte));
  desde := (dia::timestamp + corte::interval) at time zone zona;
  hasta := ((dia + 1)::timestamp + corte::interval) at time zone zona;
  with ts as (
    select t.*, c.nombre as caja from public.turnos_caja t join public.cajas c on c.id = t.caja_id
     where c.sede_id = p_sede_id and t.abierto_en >= desde and t.abierto_en < hasta)
  select jsonb_build_object(
    'dia', dia, 'desde', desde, 'hasta', hasta,
    'turnos', coalesce((select jsonb_agg(privado.resumen_turno(ts.id) || jsonb_build_object(
         'caja', ts.caja, 'abierto_por', (select q.nombre from public.equipo q where q.id = ts.abierto_por),
         'cerrado_por', (select q.nombre from public.equipo q where q.id = ts.cerrado_por)) order by ts.abierto_en) from ts), '[]'::jsonb),
    -- Sobra o falta: solo con lo contado. Lo que nadie contó se informa aparte, no se mezcla.
    'esperado_contado', coalesce((select sum(ts.monto_esperado) from ts where ts.monto_contado is not null), 0),
    'contado', coalesce((select sum(ts.monto_contado) from ts where ts.monto_contado is not null), 0),
    'diferencia', coalesce((select sum(ts.monto_contado - ts.monto_esperado) from ts where ts.monto_contado is not null), 0),
    'sin_contar', (select count(*) from ts where ts.monto_contado is null and (ts.sin_contar or (ts.cerrado_en is null and privado.turno_vence(ts.id) <= now()))),
    'esperado_sin_contar', coalesce((select sum(coalesce(ts.monto_esperado, (privado.resumen_turno(ts.id) ->> 'esperado')::numeric)) from ts
                                      where ts.monto_contado is null and (ts.sin_contar or (ts.cerrado_en is null and privado.turno_vence(ts.id) <= now()))), 0),
    'abiertos', (select count(*) from ts where ts.cerrado_en is null and privado.turno_vence(ts.id) > now()),
    'por_medio', coalesce((select jsonb_agg(jsonb_build_object('medio', m.medio, 'total', m.total, 'cantidad', m.cantidad) order by m.total desc)
        from (select p.medio, sum(p.monto) as total, count(*) as cantidad
                from public.pagos p join public.ventas v on v.id = p.venta_id join ts on ts.id = coalesce(p.turno_caja_id, v.turno_caja_id)
               where p.estado = 'aprobado' group by p.medio) m), '[]'::jsonb),
    'ventas', jsonb_build_object(
        'cantidad', (select count(*) from public.ventas v join ts on ts.id = v.turno_caja_id where v.estado = 'confirmada'),
        'total', coalesce((select sum(i.cantidad * i.precio_unitario - i.descuento) from public.venta_items i join public.ventas v on v.id = i.venta_id
                            join ts on ts.id = v.turno_caja_id where v.estado = 'confirmada'), 0)),
    'anuladas', (select count(*) from public.ventas v join ts on ts.id = v.turno_caja_id where v.estado = 'anulada'),
    'retiros', coalesce((select sum(m.monto) from public.movimientos_caja m join ts on ts.id = m.turno_caja_id where m.tipo = 'retiro'), 0),
    'dejados_pasar', (select count(*) from public.ingresos i where i.sede_id = p_sede_id and i.resultado = 'forzado' and i.anulado_en is null
                          and i.momento >= desde and i.momento < hasta)) into r;
  return r;
end $$;

revoke all on function public.config_caja(uuid), public.guardar_config_caja(uuid, text, boolean, numeric, text, int), public.mi_turno_caja(uuid),
  public.cajas_para_revisar(uuid), public.contar_caja_sin_contar(uuid, numeric, text, jsonb), public.dejar_caja_sin_contar(uuid, text),
  public.reporte_turno(uuid), public.reporte_dia(uuid, date) from public, anon, authenticated;
grant execute on function public.config_caja(uuid), public.guardar_config_caja(uuid, text, boolean, numeric, text, int), public.mi_turno_caja(uuid),
  public.cajas_para_revisar(uuid), public.contar_caja_sin_contar(uuid, numeric, text, jsonb), public.dejar_caja_sin_contar(uuid, text),
  public.reporte_turno(uuid), public.reporte_dia(uuid, date) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.config_caja(uuid)', 'public.guardar_config_caja(uuid, text, boolean, numeric, text, int)', 'public.mi_turno_caja(uuid)',
      'public.cajas_para_revisar(uuid)', 'public.contar_caja_sin_contar(uuid, numeric, text, jsonb)', 'public.dejar_caja_sin_contar(uuid, text)',
      'public.reporte_turno(uuid)', 'public.reporte_dia(uuid, date)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
