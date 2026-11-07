-- VD-50 · Doble cobro (D29, REV-6a): la misma cuota del mismo socio cobrada hace poco por OTRA operación frena y pregunta.
--   · Si el socio ya tiene una cuota cobrada (y no anulada) hace menos de N minutos, vender() rechaza con
--     'ya_cobrada: Sofi ya cobró esta cuota hace 40 s…' (SQLSTATE DC001). Sigue solo con confirmar = true y un motivo escrito,
--     que queda en la venta (ventas.doble_cobro_motivo) junto con cuál era la cobrada antes (ventas.doble_cobro_de).
--   · La misma clave de operación sigue siendo idempotente (devuelve el mismo cobro, ni siquiera llega acá).
--   · No frena un producto, un pase ni nada que no lleve cuota. Pagar varios meses juntos es UNA venta con cantidad > 1.
--   · Dos personas a la vez: el chequeo se hace con un candado por socio, así la segunda ve la venta de la primera.
--   · N es configurable por gimnasio (configuracion_cobro.doble_cobro_minutos, por defecto 2; 0 = apagado) y lo cambia el dueño
--     en Configuración → Cobros; queda en el historial (cambios_cobro).
--   · contexto_cobro avisa al abrir la hoja con la misma regla (una sola fuente: privado.cuota_cobrada_reciente).
-- La firma de public.vender cambia (confirmar y motivo): la anterior se borra acá mismo.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text)') is null then raise exception 'Guarda: falta public.vender (VD-49)'; end if;
  if position('caja_ajena' in pg_get_functiondef('public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text)'::regprocedure)) = 0 then
    raise exception 'Guarda: public.vender no es la versión VD-49 (efectivo en la caja de quien cobra)';
  end if;
  if to_regclass('public.configuracion_cobro') is null then raise exception 'Guarda: falta configuracion_cobro (VD-5)'; end if;
  if to_regclass('public.cambios_cobro') is null then raise exception 'Guarda: falta cambios_cobro (VD-7)'; end if;
  if to_regprocedure('public.contexto_cobro(uuid, uuid)') is null then raise exception 'Guarda: falta public.contexto_cobro (VD-5)'; end if;
  if to_regprocedure('privado.proximo_periodo(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.proximo_periodo'; end if;
end $$;

-- ── 1 · Datos: el tiempo, y el motivo en la venta ───────────────────
alter table public.configuracion_cobro add column if not exists doble_cobro_minutos int not null default 2;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_cobro_doble_minutos_chk') then
    alter table public.configuracion_cobro add constraint configuracion_cobro_doble_minutos_chk check (doble_cobro_minutos between 0 and 60);
  end if;
end $$;

alter table public.ventas add column if not exists doble_cobro_motivo text;   -- por qué se cobró igual (quien confirmó, en creado_por)
alter table public.ventas add column if not exists doble_cobro_de uuid;       -- la venta de la cuota que ya estaba cobrada
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ventas_doble_cobro_de_fk') then
    alter table public.ventas add constraint ventas_doble_cobro_de_fk foreign key (gimnasio_id, doble_cobro_de) references public.ventas (gimnasio_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ventas_doble_cobro_chk') then
    alter table public.ventas add constraint ventas_doble_cobro_chk
      check ((doble_cobro_motivo is null) = (doble_cobro_de is null) and (doble_cobro_motivo is null or length(trim(doble_cobro_motivo)) >= 3));
  end if;
  -- El historial de cambios de cobro suma el tema nuevo.
  alter table public.cambios_cobro drop constraint if exists cambios_cobro_tema_check;
  alter table public.cambios_cobro add constraint cambios_cobro_tema_check check (tema in ('vencimiento', 'plan', 'dejar_pasar', 'doble_cobro'));
end $$;
create index if not exists ventas_doble_cobro on public.ventas (gimnasio_id, creado_en desc) where doble_cobro_de is not null;

-- ── 2 · La regla, en un solo lugar ──────────────────────────────────
-- La cuota del socio cobrada (venta no anulada, con un pago aprobado o una cobertura vigente) hace menos de p_minutos. null si no hay o si está apagado.
create or replace function privado.cuota_cobrada_reciente(p_gimnasio_id uuid, p_socio_id uuid, p_minutos int) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('venta_id', v.id,
           'hace_seg', greatest(extract(epoch from now() - coalesce(v.registrada_en, v.creado_en))::int, 0),
           'quien', q.nombre,
           'total', (select coalesce(sum(p.monto), 0) from public.pagos p where p.venta_id = v.id and p.estado <> 'anulado'))
    from public.ventas v
    left join public.equipo q on q.gimnasio_id = v.gimnasio_id and q.id = v.creado_por
   where coalesce(p_minutos, 0) > 0 and v.gimnasio_id = p_gimnasio_id and v.socio_id = p_socio_id and v.estado <> 'anulada'
     and coalesce(v.registrada_en, v.creado_en) > now() - make_interval(secs => p_minutos * 60)
     and exists (select 1 from public.venta_items i where i.venta_id = v.id and i.tipo = 'cuota')
     -- cobrada de verdad: con un pago aprobado o con su cobertura vigente (un link de pago sin pagar o una transferencia sin aprobar todavía no cuentan)
     and (exists (select 1 from public.pagos p where p.venta_id = v.id and p.estado = 'aprobado')
          or exists (select 1 from public.venta_items i2 join public.coberturas c on c.venta_item_id = i2.id and c.anulada_en is null where i2.venta_id = v.id))
   order by coalesce(v.registrada_en, v.creado_en) desc
   limit 1
$$;
revoke all on function privado.cuota_cobrada_reciente(uuid, uuid, int) from public, anon, authenticated;

-- ── 3 · Configuración → Cobros ──────────────────────────────────────
create or replace function public.config_cobro(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m text; mins int; ult jsonb;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select medio_defecto, doble_cobro_minutos into m, mins from public.configuracion_cobro where gimnasio_id = p_gimnasio_id;
  select jsonb_build_object('detalle', x.detalle, 'por', q.nombre, 'cuando', x.cambiado_en) into ult
    from public.cambios_cobro x left join public.equipo q on q.gimnasio_id = x.gimnasio_id and q.id = x.equipo_id
   where x.gimnasio_id = p_gimnasio_id and x.tema = 'doble_cobro' order by x.cambiado_en desc limit 1;
  return jsonb_build_object('medio_defecto', coalesce(m, 'efectivo'), 'doble_cobro_minutos', coalesce(mins, 2), 'doble_cobro_ultimo_cambio', ult);
end $$;

create or replace function public.guardar_doble_cobro(p_gimnasio_id uuid, p_minutos int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; antes int; n int;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno']);   -- toca plata: solo el dueño
  if p_minutos is null or p_minutos not between 0 and 60 then
    raise exception 'Doble cobro: un número de minutos entre 0 (apagado) y 60.' using errcode = '22023';
  end if;
  select doble_cobro_minutos into antes from public.configuracion_cobro where gimnasio_id = p_gimnasio_id;
  insert into public.configuracion_cobro (gimnasio_id, doble_cobro_minutos) values (p_gimnasio_id, p_minutos)
  on conflict (gimnasio_id) do update set doble_cobro_minutos = excluded.doble_cobro_minutos, actualizado_en = now();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar el aviso de doble cobro.'; end if;
  if antes is distinct from p_minutos then
    insert into public.cambios_cobro (gimnasio_id, tema, detalle, antes, despues, equipo_id, usuario_id)
    values (p_gimnasio_id, 'doble_cobro', 'Aviso de doble cobro (minutos)',
            case when antes is not null then jsonb_build_object('minutos', antes) end, jsonb_build_object('minutos', p_minutos), e.id, auth.uid());
  end if;
  return public.config_cobro(p_gimnasio_id);
end $$;

-- ── 4 · Lo que la hoja Cobrar pregunta al abrirse (avisa con la misma regla) ─
create or replace function public.contexto_cobro(p_sede_id uuid, p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; e public.equipo; op public.equipo; sus public.suscripciones; per record; reciente jsonb; medio text; mins int; rol_efectivo text; cubre jsonb;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']);
  if e.sede_id is not null and e.sede_id <> p_sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  if not exists (select 1 from public.socios where id = p_socio_id and gimnasio_id = g) then raise exception 'El socio no es de este gimnasio'; end if;
  op := privado.operador(g);
  rol_efectivo := coalesce(op.rol, e.rol);
  select medio_defecto, doble_cobro_minutos into medio, mins from public.configuracion_cobro where gimnasio_id = g;
  mins := coalesce(mins, 2);

  select * into sus from public.suscripciones where socio_id = p_socio_id and baja_en is null;
  if found then
    select * into per from privado.proximo_periodo(sus.id, now());
    cubre := jsonb_build_object('desde', per.p_desde, 'hasta', per.p_hasta);
  end if;

  -- Doble cobro (D29): la misma regla que vender(); acá solo se avisa al abrir, allá es donde frena.
  reciente := privado.cuota_cobrada_reciente(g, p_socio_id, mins);

  return jsonb_build_object(
    'medio_defecto', coalesce(medio, 'efectivo'),
    'operador', op.nombre,
    'hay_pines', exists (select 1 from privado.pines_equipo pe join public.equipo q on q.id = pe.equipo_id where pe.gimnasio_id = g and q.activo),
    'rol', rol_efectivo,
    'puede_otro_dia', rol_efectivo in ('dueno', 'encargado'),
    'puede_cambiar_medio', e.rol in ('dueno', 'encargado'),
    'cubre', cubre,
    'doble_cobro_minutos', mins,
    'reciente', reciente);
end $$;

-- ── 5 · vender frena el doble cobro ─────────────────────────────────
-- La firma cambia (p_confirmar, p_motivo_doble): la anterior se borra, dos versiones con defaults harían ambigua la llamada.
drop function if exists public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text);
create or replace function public.vender(
  p_sede_id uuid, p_items jsonb, p_pagos jsonb, p_socio_id uuid default null, p_turno_id uuid default null,
  p_clave_operacion uuid default null, p_cobrado_en timestamptz default null, p_motivo_otro_dia text default null,
  p_comprobante_path text default null, p_confirmar boolean default false, p_motivo_doble text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid; rol text; tope numeric; c public.configuracion_gimnasio; no_acepta text; previa public.ventas; r jsonb;
        momento timestamptz := now(); turno uuid := p_turno_id; motivo text := nullif(trim(coalesce(p_motivo_otro_dia, '')), ''); n int;
        mins int; doble jsonb; doble_motivo text := nullif(trim(coalesce(p_motivo_doble, '')), ''); doble_de uuid; seg int; hace text;
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

  -- VD-50 (D29) · Doble cobro: la cuota del mismo socio ya cobrada hace menos de N minutos por otra operación frena y pregunta.
  -- Solo mira si el carrito lleva una cuota (un producto o un pase nunca se frena). El candado por socio hace que dos personas
  -- cobrando a la vez se turnen: la segunda ve el cobro de la primera.
  if doble_motivo is not null and not coalesce(p_confirmar, false) then
    raise exception 'El motivo es de un cobro confirmado' using errcode = '22023';
  end if;
  if p_socio_id is not null and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) x where x ->> 'tipo' = 'cuota') then
    perform pg_advisory_xact_lock(hashtextextended('gymos:doble-cobro:' || g::text || p_socio_id::text, 0));
    select coalesce((select k.doble_cobro_minutos from public.configuracion_cobro k where k.gimnasio_id = g), 2) into mins;
    doble := privado.cuota_cobrada_reciente(g, p_socio_id, mins);
    if doble is not null then
      if not coalesce(p_confirmar, false) then
        seg := (doble ->> 'hace_seg')::int;
        hace := case when seg < 90 then seg || ' s' else round(seg / 60.0)::int || ' min' end;
        raise exception 'ya_cobrada: % ya cobró esta cuota hace % (por %). Si es otro cobro, confirmalo con un motivo.',
          coalesce(doble ->> 'quien', 'Alguien'), hace, privado.formato_pesos((doble ->> 'total')::numeric) using errcode = 'DC001';
      end if;
      if doble_motivo is null or length(doble_motivo) < 3 then
        raise exception 'Cobrar igual una cuota ya cobrada necesita un motivo escrito' using errcode = '22023';
      end if;
      doble_de := (doble ->> 'venta_id')::uuid;
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
         registrada_en = case when p_cobrado_en is not null then now() end,
         doble_cobro_motivo = case when doble_de is not null then doble_motivo end,
         doble_cobro_de = doble_de
   where gimnasio_id = g and id = (r ->> 'venta_id')::uuid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo registrar la operación'; end if;
  if nullif(trim(coalesce(p_comprobante_path, '')), '') is not null then
    update public.pagos set comprobante_path = p_comprobante_path
     where gimnasio_id = g and venta_id = (r ->> 'venta_id')::uuid and medio = 'transferencia';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo guardar el comprobante'; end if;
  end if;
  return r || case when doble_de is not null then jsonb_build_object('doble_cobro_de', doble_de) else '{}'::jsonb end;
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text, boolean, text) from public, anon;
grant execute on function public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text, boolean, text) to authenticated, service_role;
revoke all on function public.config_cobro(uuid), public.guardar_doble_cobro(uuid, int), public.contexto_cobro(uuid, uuid) from public, anon, authenticated;
grant execute on function public.config_cobro(uuid), public.guardar_doble_cobro(uuid, int), public.contexto_cobro(uuid, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text, boolean, text)', 'public.config_cobro(uuid)',
                           'public.guardar_doble_cobro(uuid, int)', 'public.contexto_cobro(uuid, uuid)', 'privado.cuota_cobrada_reciente(uuid, uuid, int)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if to_regprocedure('public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text)') is not null then raise exception 'Verificación: quedó la vender vieja'; end if;
  if (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'vender') <> 1 then
    raise exception 'Verificación: public.vender duplicada';
  end if;
  if position('caja_ajena' in pg_get_functiondef('public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text, boolean, text)'::regprocedure)) = 0 then
    raise exception 'Verificación: vender perdió lo de la caja de quien cobra (VD-49)';
  end if;
  if position('ya_cobrada' in pg_get_functiondef('public.vender(uuid, jsonb, jsonb, uuid, uuid, uuid, timestamptz, text, text, boolean, text)'::regprocedure)) = 0 then
    raise exception 'Verificación: vender no frena el doble cobro';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ventas' and column_name = 'doble_cobro_motivo') then
    raise exception 'Verificación: falta ventas.doble_cobro_motivo';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_cobro' and column_name = 'doble_cobro_minutos') then
    raise exception 'Verificación: falta configuracion_cobro.doble_cobro_minutos';
  end if;
end $$;
