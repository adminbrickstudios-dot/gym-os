-- VD-5 · Cobrar: un solo flujo en todos lados (docs/v2/02 §2).
-- La hoja flotante "Cobrar" necesita de la base:
--   configuracion_cobro / config_cobro / guardar_config_cobro
--       el medio de pago que más se usa en el gimnasio (arranca elegido).
--       Dueño y encargado lo cambian; todo el equipo lo lee.
--   vender(…, p_cobrado_en, p_motivo_otro_dia, p_comprobante_path)
--       "Cobré otro día" (solo dueño o encargado, con motivo, nunca en
--       efectivo) y la foto del comprobante de la transferencia. La firma
--       cambia: la anterior se borra acá mismo.
--   contexto_cobro(sede, socio)
--       lo que la hoja muestra y la base calcula: el medio por defecto, quién
--       atiende (PIN), si esta persona puede cobrar "otro día", qué período
--       cubre la próxima cuota y si se cobró lo mismo hace menos de 2 minutos.
-- Ventas con otro día quedan marcadas: otro_dia_motivo y registrada_en
-- (cuándo se cargó de verdad), además de quién la cargó (creado_por).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid)') is null
     and to_regprocedure('public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text)') is null then
    raise exception 'Guarda: falta public.vender (VD-34)';
  end if;
  if to_regprocedure('privado.vender(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid, numeric, timestamptz)') is null then raise exception 'Guarda: falta privado.vender'; end if;
  if to_regprocedure('privado.proximo_periodo(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.proximo_periodo'; end if;
  if to_regprocedure('privado.operador(uuid)') is null then raise exception 'Guarda: falta privado.operador (PIN)'; end if;
  if to_regprocedure('privado.politicas_estandar(regclass, text[], text[], boolean)') is null then raise exception 'Guarda: falta privado.politicas_estandar'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ventas' and column_name = 'clave_operacion') then
    raise exception 'Guarda: falta ventas.clave_operacion (VD-34)';
  end if;
end $$;

-- ── 1 · El medio por defecto ────────────────────────────────────────
create table if not exists public.configuracion_cobro (
  gimnasio_id    uuid primary key references public.gimnasios(id),
  medio_defecto  text not null default 'efectivo' check (medio_defecto in ('efectivo', 'transferencia', 'debito', 'credito')),
  actualizado_en timestamptz not null default now()
);
select privado.politicas_estandar('public.configuracion_cobro', null, '{}');
revoke all on table public.configuracion_cobro from anon;
revoke truncate, references, trigger on public.configuracion_cobro from authenticated;

create or replace function public.config_cobro(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select medio_defecto into m from public.configuracion_cobro where gimnasio_id = p_gimnasio_id;
  return jsonb_build_object('medio_defecto', coalesce(m, 'efectivo'));
end $$;

create or replace function public.guardar_config_cobro(p_gimnasio_id uuid, p_medio text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if p_medio is null or p_medio not in ('efectivo', 'transferencia', 'debito', 'credito') then
    raise exception 'Medio de pago por defecto: elegí efectivo, transferencia, débito o crédito.' using errcode = '22023';
  end if;
  insert into public.configuracion_cobro (gimnasio_id, medio_defecto) values (p_gimnasio_id, p_medio)
  on conflict (gimnasio_id) do update set medio_defecto = excluded.medio_defecto, actualizado_en = now();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar el medio de pago por defecto.'; end if;
  return public.config_cobro(p_gimnasio_id);
end $$;

revoke all on function public.config_cobro(uuid), public.guardar_config_cobro(uuid, text) from public, anon, authenticated;
grant execute on function public.config_cobro(uuid), public.guardar_config_cobro(uuid, text) to authenticated, service_role;

-- ── 2 · La marca de "cobré otro día" ────────────────────────────────
alter table public.ventas add column if not exists otro_dia_motivo text;
alter table public.ventas add column if not exists registrada_en timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ventas_otro_dia_motivo_chk') then
    alter table public.ventas add constraint ventas_otro_dia_motivo_chk
      check (otro_dia_motivo is null or (length(trim(otro_dia_motivo)) >= 3 and registrada_en is not null));
  end if;
end $$;

-- ── 3 · vender con otro día y comprobante ───────────────────────────
-- Misma función de siempre (VD-34) con tres parámetros más, todos opcionales.
drop function if exists public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid);
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

-- ── 4 · Lo que la hoja de Cobrar pregunta al abrirse ────────────────
create or replace function public.contexto_cobro(p_sede_id uuid, p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; e public.equipo; op public.equipo; sus public.suscripciones; per record; reciente jsonb; medio text; rol_efectivo text; cubre jsonb;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']);
  if e.sede_id is not null and e.sede_id <> p_sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  if not exists (select 1 from public.socios where id = p_socio_id and gimnasio_id = g) then raise exception 'El socio no es de este gimnasio'; end if;
  op := privado.operador(g);
  rol_efectivo := coalesce(op.rol, e.rol);
  select medio_defecto into medio from public.configuracion_cobro where gimnasio_id = g;

  select * into sus from public.suscripciones where socio_id = p_socio_id and baja_en is null;
  if found then
    select * into per from privado.proximo_periodo(sus.id, now());
    cubre := jsonb_build_object('desde', per.p_desde, 'hasta', per.p_hasta);
  end if;

  -- Doble cobro (REV-6a, sigue en revisión): solo se avisa, nunca se frena.
  select jsonb_build_object('hace_seg', greatest(extract(epoch from now() - coalesce(v.registrada_en, v.creado_en))::int, 0),
                            'quien', q.nombre,
                            'total', (select coalesce(sum(p.monto), 0) from public.pagos p where p.venta_id = v.id))
    into reciente
    from public.ventas v left join public.equipo q on q.id = v.creado_por
   where v.gimnasio_id = g and v.socio_id = p_socio_id and v.estado <> 'anulada'
     and coalesce(v.registrada_en, v.creado_en) > now() - interval '2 minutes'
     and exists (select 1 from public.venta_items i where i.venta_id = v.id and i.tipo = 'cuota')
   order by coalesce(v.registrada_en, v.creado_en) desc limit 1;

  return jsonb_build_object(
    'medio_defecto', coalesce(medio, 'efectivo'),
    'operador', op.nombre,
    'hay_pines', exists (select 1 from privado.pines_equipo pe join public.equipo q on q.id = pe.equipo_id where pe.gimnasio_id = g and q.activo),
    'rol', rol_efectivo,
    'puede_otro_dia', rol_efectivo in ('dueno', 'encargado'),
    'puede_cambiar_medio', e.rol in ('dueno', 'encargado'),
    'cubre', cubre,
    'reciente', reciente);
end $$;

revoke all on function public.contexto_cobro(uuid, uuid) from public, anon, authenticated;
grant execute on function public.contexto_cobro(uuid, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.configuracion_cobro'::regclass) then raise exception 'Verificación: configuracion_cobro sin RLS'; end if;
  if to_regprocedure('public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid)') is not null then raise exception 'Verificación: quedó la vender vieja'; end if;
  if not exists (select 1 from pg_proc where oid = 'public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: vender sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text)', 'execute') then raise exception 'Verificación: anon puede vender'; end if;
  if has_function_privilege('anon', 'public.contexto_cobro(uuid, uuid)', 'execute') then raise exception 'Verificación: anon puede leer el contexto de cobro'; end if;
  if has_function_privilege('anon', 'public.guardar_config_cobro(uuid, text)', 'execute') then raise exception 'Verificación: anon puede guardar el medio por defecto'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ventas' and column_name = 'otro_dia_motivo') then
    raise exception 'Verificación: falta ventas.otro_dia_motivo';
  end if;
end $$;
