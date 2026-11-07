-- VD-49 · Efectivo sin caja (D32): el efectivo cae siempre en la caja de QUIEN cobra, y sin caja abierta de esa persona
-- en esa sede la base lo rechaza con un error que la pantalla reconoce (Cobrar ofrece "Abrir mi turno" y sigue).
--   · public.vender (misma firma que 20261106003450): un pago en efectivo necesita el turno abierto de quien cobra
--     (con PIN del equipo, el de esa persona; privado.exigir_rol ya devuelve a quien opera) en la sede de la venta.
--       - sin p_turno_id: la base busca ese turno. Si no hay → error 'sin_caja' (SQLSTATE CJ001).
--       - con p_turno_id: tiene que ser de quien cobra. Si lo abrió otra persona → error 'caja_ajena' (CJ002).
--         (Una caja inexistente, de otra sede, cerrada o sin contar la sigue rechazando privado.vender y su candado.)
--     Transferencia, tarjeta y a cuenta no necesitan caja y siguen igual.
--   · public.caja_para_cobrar(sede): lo que la hoja Cobrar pregunta al abrirse: mi turno de esta sede (si sirve para
--     cobrar), las cajas que puedo abrir con el fondo sugerido y lo que dejó el turno anterior.
-- "La caja cuadra" no cambia: esperado = fondo + efectivo cobrado − retiros + ingresos (privado.resumen_turno, VD-9);
-- la prueba con números fijos está en supabase/pruebas/efectivo-sin-caja.test.mjs.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text)') is null then raise exception 'Guarda: falta public.vender (VD-5)'; end if;
  if to_regprocedure('privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)') is null then raise exception 'Guarda: falta privado.vender'; end if;
  if to_regprocedure('privado.turno_vence(uuid)') is null then raise exception 'Guarda: falta privado.turno_vence (VD-9)'; end if;
  if to_regprocedure('privado.resumen_turno(uuid)') is null then raise exception 'Guarda: falta privado.resumen_turno'; end if;
  if to_regprocedure('privado.exigir_rol(uuid, text[], uuid)') is null then raise exception 'Guarda: falta privado.exigir_rol'; end if;
  if to_regclass('public.configuracion_caja') is null then raise exception 'Guarda: falta configuracion_caja (VD-9)'; end if;
end $$;

-- ── 1 · vender: el efectivo va a la caja de quien cobra ─────────────
-- Copia de la definición vigente (20261106003450) con el bloque VD-49 después de "cobré otro día".
create or replace function public.vender(
  p_sede_id uuid, p_items jsonb, p_pagos jsonb, p_socio_id uuid default null, p_turno_id uuid default null,
  p_clave_operacion uuid default null, p_cobrado_en timestamptz default null, p_motivo_otro_dia text default null,
  p_comprobante_path text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid; rol text; tope numeric; c public.configuracion_gimnasio; no_acepta text; previa public.ventas; r jsonb;
        momento timestamptz := now(); turno uuid := p_turno_id; motivo text := nullif(trim(coalesce(p_motivo_otro_dia, '')), ''); n int;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], p_sede_id);
  select e.rol into rol from public.equipo e where e.id = eid;

  -- Misma operación otra vez: se devuelve lo ya hecho. El lock hace que dos
  -- envíos simultáneos se turnen: el segundo ve la venta del primero.
  if p_clave_operacion is not null then
    perform pg_advisory_xact_lock(hashtextextended(g::text || p_clave_operacion::text, 0));
    select * into previa from public.ventas where gimnasio_id = g and clave_operacion = p_clave_operacion;
    if found then
      return jsonb_build_object('venta_id', previa.id,
        'total', (select coalesce(sum(p.monto), 0) from public.pagos p where p.venta_id = previa.id),
        'generados', 0, 'repetida', true,
        'veredicto', case when previa.socio_id is not null then to_jsonb(privado.calcular_acceso(previa.socio_id, now(), previa.sede_id)) end);
    end if;
  end if;

  select * into c from public.configuracion_gimnasio where gimnasio_id = g;
  select string_agg(distinct case x ->> 'medio' when 'credito' then 'tarjeta de crédito' when 'debito' then 'tarjeta de débito' when 'cuenta_corriente' then 'a cuenta (fiado)'
                                              else x ->> 'medio' end, ', ') into no_acepta
    from jsonb_array_elements(case when jsonb_typeof(p_pagos) = 'array' then p_pagos else '[]'::jsonb end) x
   where coalesce(x ->> 'medio', '') <> all (array(select m from unnest(c.medios_aceptados) m
                                                      where not (m = 'efectivo' and 'caja' = any (c.secciones_apagadas)))
                                                || case when c.fiado_activo then array['cuenta_corriente'] else '{}'::text[] end);
  if no_acepta is not null then
    raise exception 'Este gimnasio no cobra con %. Se cambia en Configuración → Cobros.', no_acepta using errcode = '22023';
  end if;
  -- EQU-1: si el dueño lo apagó, la recepción no vende productos.
  if rol = 'recepcion' and not c.recepcion_vende_productos
     and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) x where x ->> 'tipo' = 'producto') then
    raise exception 'En este gimnasio la recepción no vende productos: lo cambia el dueño en Equipo → Permisos.' using errcode = '42501';
  end if;
  if rol = 'recepcion' then
    select descuento_max_recepcion into tope from public.configuracion_gimnasio where gimnasio_id = g;
  end if;

  -- VD-5 · "Cobré otro día": toca plata, así que solo dueño o encargado (el de quien opera: con PIN, el del PIN),
  -- con motivo, hacia atrás hasta 90 días, y nunca en efectivo (esa plata no entró hoy en la caja que se cuenta).
  if p_cobrado_en is not null then
    if rol not in ('dueno', 'encargado') then
      raise exception 'Cobrar con otra fecha lo hace el dueño o el encargado' using errcode = '42501';
    end if;
    if motivo is null or length(motivo) < 3 then raise exception 'Cobrar con otra fecha necesita un motivo' using errcode = '22023'; end if;
    if p_cobrado_en > now() + interval '1 minute' then raise exception 'La fecha del cobro no puede ser futura' using errcode = '22023'; end if;
    if p_cobrado_en < now() - interval '90 days' then raise exception 'Solo se puede cargar un cobro de hasta 90 días atrás' using errcode = '22023'; end if;
    if exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_pagos) = 'array' then p_pagos else '[]'::jsonb end) x where x ->> 'medio' in ('efectivo', 'cuenta_corriente')) then
      raise exception 'Un cobro de otro día no puede ser en efectivo ni a cuenta: el efectivo de hoy es el de la caja de hoy' using errcode = '22023';
    end if;
    momento := least(p_cobrado_en, now());
    turno := null;
  elsif motivo is not null then
    raise exception 'El motivo es de un cobro con otra fecha' using errcode = '22023';
  end if;

  -- VD-49 (D32) · El efectivo cae en la caja de quien cobra. La base lo decide, no la pantalla.
  if exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_pagos) = 'array' then p_pagos else '[]'::jsonb end) x where x ->> 'medio' = 'efectivo') then
    if turno is not null then
      -- Un turno que existe pero lo abrió otra persona no recibe el efectivo de ésta. (Si no existe o es de otra sede,
      -- lo dice privado.vender como siempre.)
      if exists (select 1 from public.turnos_caja t where t.id = turno and t.gimnasio_id = g and t.abierto_por is distinct from eid) then
        raise exception 'caja_ajena: esa caja la abrió otra persona. El efectivo va a la caja de quien cobra: abrí tu turno o cobrá con tu PIN.'
          using errcode = 'CJ002';
      end if;
    else
      select t.id into turno
        from public.turnos_caja t join public.cajas ca on ca.id = t.caja_id
       where t.gimnasio_id = g and t.abierto_por = eid and t.cerrado_en is null and ca.sede_id = p_sede_id
         and privado.turno_vence(t.id) > now()
       order by t.abierto_en limit 1;
      if turno is null then
        raise exception 'sin_caja: para cobrar en efectivo tiene que haber una caja abierta a tu nombre en esta sede. Abrí tu turno (con el fondo) y seguí.'
          using errcode = 'CJ001';
      end if;
    end if;
  end if;

  -- El comprobante es de la transferencia de un socio de este gimnasio.
  if nullif(trim(coalesce(p_comprobante_path, '')), '') is not null then
    if p_socio_id is null then raise exception 'El comprobante necesita un socio' using errcode = '22023'; end if;
    if split_part(p_comprobante_path, '/', 1) <> g::text or split_part(p_comprobante_path, '/', 2) <> p_socio_id::text
       or p_comprobante_path like '%..%' or length(p_comprobante_path) > 200 then
      raise exception 'Ese comprobante no es de este socio' using errcode = '22023';
    end if;
    if (select count(*) from jsonb_array_elements(case when jsonb_typeof(p_pagos) = 'array' then p_pagos else '[]'::jsonb end) x where x ->> 'medio' = 'transferencia') <> 1 then
      raise exception 'El comprobante va con un pago por transferencia' using errcode = '22023';
    end if;
  end if;

  r := privado.vender(g, p_sede_id, p_socio_id, p_items, p_pagos, turno, eid, tope, momento);
  update public.ventas set clave_operacion = coalesce(p_clave_operacion, clave_operacion),
         otro_dia_motivo = case when p_cobrado_en is not null then motivo end,
         registrada_en = case when p_cobrado_en is not null then now() end
   where gimnasio_id = g and id = (r ->> 'venta_id')::uuid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo registrar la operación'; end if;
  if nullif(trim(coalesce(p_comprobante_path, '')), '') is not null then
    update public.pagos set comprobante_path = p_comprobante_path
     where gimnasio_id = g and venta_id = (r ->> 'venta_id')::uuid and medio = 'transferencia';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo guardar el comprobante'; end if;
  end if;
  return r;
end $$;

revoke all on function public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text) from public, anon;
grant execute on function public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text) to authenticated, service_role;

-- ── 2 · Mi caja para cobrar ─────────────────────────────────────────
-- turno_id        mi turno abierto en ESTA sede, si todavía sirve (no pasó su hora de corte ni sus N horas)
-- vencido         tengo uno en esta sede pero ya quedó "sin contar": no se cobra en él; abrir otro lo registra
-- otra_sede       tengo un turno abierto en otra sede: hay que cerrarlo antes de abrir éste (CAJ-5)
-- libres          cajas que puedo abrir, con fondo_sugerido (fondo fijo o lo que dejó el turno anterior) y
--                 dejo_anterior (lo contado al cerrar el turno anterior de esa caja, para avisar si no coincide)
create or replace function public.caja_para_cobrar(p_sede_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; eid uuid; k public.configuracion_caja; zona text; mio record; otra text; libres jsonb;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], p_sede_id);
  select * into k from public.configuracion_caja where gimnasio_id = g;
  select zona_horaria into zona from public.gimnasios where id = g;

  select t.id, ca.nombre, ca.sede_id, t.abierto_en, (privado.turno_vence(t.id) <= now()) as vencido into mio
    from public.turnos_caja t join public.cajas ca on ca.id = t.caja_id
   where t.gimnasio_id = g and t.abierto_por = eid and t.cerrado_en is null
   order by (ca.sede_id = p_sede_id) desc, t.abierto_en limit 1;
  if mio.id is not null and mio.sede_id <> p_sede_id and not mio.vencido then
    select s.nombre into otra from public.sedes s where s.id = mio.sede_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('caja_id', ca.id, 'nombre', ca.nombre,
           'fondo_sugerido', case when coalesce(k.fondo_fijo, 0) > 0 then k.fondo_fijo else coalesce(ult.monto_contado, 0) end,
           'dejo_anterior', ult.monto_contado,
           'con_vencida', exists (select 1 from public.turnos_caja t3 where t3.caja_id = ca.id and t3.cerrado_en is null and privado.turno_vence(t3.id) <= now()))
           order by ca.nombre), '[]'::jsonb) into libres
    from public.cajas ca
    left join lateral (select t2.monto_contado from public.turnos_caja t2 where t2.caja_id = ca.id and t2.monto_contado is not null
                        order by t2.abierto_en desc limit 1) ult on true
   where ca.sede_id = p_sede_id and ca.activa
     and not exists (select 1 from public.turnos_caja t where t.caja_id = ca.id and t.cerrado_en is null and privado.turno_vence(t.id) > now())
     and not (coalesce(k.modo, 'por_turno') = 'una_por_dia' and exists (
           select 1 from public.turnos_caja t4 where t4.caja_id = ca.id
              and privado.dia_caja(t4.abierto_en, zona, coalesce(k.hora_corte, time '00:00')) = privado.dia_caja(now(), zona, coalesce(k.hora_corte, time '00:00'))
              and t4.cerrado_en is not null));

  return jsonb_build_object(
    'turno_id', case when mio.id is not null and mio.sede_id = p_sede_id and not mio.vencido then mio.id end,
    'caja', case when mio.id is not null and mio.sede_id = p_sede_id then mio.nombre end,
    'vencido', coalesce(mio.sede_id = p_sede_id and mio.vencido, false),
    'otra_sede', otra,
    'libres', libres,
    'modo', coalesce(k.modo, 'por_turno'));
end $$;

revoke all on function public.caja_para_cobrar(uuid) from public, anon, authenticated;
grant execute on function public.caja_para_cobrar(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text)', 'public.caja_para_cobrar(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
    if not has_function_privilege('authenticated', f, 'execute') then raise exception 'Verificación: authenticated no puede ejecutar %', f; end if;
  end loop;
  if position('caja_ajena' in pg_get_functiondef('public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text)'::regprocedure)) = 0
     or position('sin_caja' in pg_get_functiondef('public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text)'::regprocedure)) = 0 then
    raise exception 'Verificación: vender no exige la caja de quien cobra';
  end if;
  if (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'vender') <> 1 then
    raise exception 'Verificación: public.vender duplicada';
  end if;
end $$;
