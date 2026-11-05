-- 0095 · Faltas: descontar la clase del pack (CLA-9, tercera opción de D16).
-- Con la regla "descontar", una falta (reserva confirmada con pack de una clase
-- que terminó sin presente y sin cancelar) cuenta como una clase usada de ese
-- pack. No se guarda: se calcula, igual en la puerta, la reserva, la app y la
-- ficha (privado.faltas_pack). Cuenta desde que se prende la regla; si ese día
-- el socio entró por la puerta, no es falta (no se cobra dos veces).
--   privado.faltas_pack(pack, momento, reserva_excluida)
-- Copias: privado.via_pack (0006), privado.habilitacion_clase (0011),
-- ficha_socio (0043), mi_socio (0027), guardar_configuracion y
-- politica_reservas (0080); el trigger de falta_politica_desde.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.editar_horario(uuid, time, int, int, uuid)') is null
     or position('h.vigente_desde + 1' in pg_get_functiondef('public.editar_horario(uuid, time, int, int, uuid)'::regprocedure)) = 0 then
    raise exception 'Guarda: falta la migración 0094';
  end if;
  if to_regprocedure('privado.faltas(uuid, timestamptz)') is null then raise exception 'Guarda: falta la migración 0080'; end if;
end $$;

alter table public.configuracion_gimnasio drop constraint if exists configuracion_falta_valida;
alter table public.configuracion_gimnasio add constraint configuracion_falta_valida
  check (falta_politica in ('nada', 'bloquear', 'descontar') and falta_bloqueo_dias between 1 and 60);

-- La regla cuenta desde que se prende o se cambia (no castiga lo de antes).
create or replace function privado.falta_politica_desde() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.falta_politica <> 'nada' and (tg_op = 'INSERT' or old.falta_politica is distinct from new.falta_politica) then
    new.falta_politica_desde := now();
  end if;
  return new;
end $$;
revoke all on function privado.falta_politica_desde() from public;

-- Las faltas que se descuentan de un pack hasta un momento.
create or replace function privado.faltas_pack(p_pack_id uuid, p_momento timestamptz, p_excluir_reserva uuid default null) returns int
language sql stable set search_path = '' as $$
  select count(*)::int
    from public.reservas r
    join public.clases c on c.id = r.clase_id
    join public.configuracion_gimnasio cfg on cfg.gimnasio_id = r.gimnasio_id
    join public.gimnasios g on g.id = r.gimnasio_id
   where r.pack_id = p_pack_id and r.estado = 'confirmada' and r.id is distinct from p_excluir_reserva
     and cfg.falta_politica = 'descontar' and c.inicio >= cfg.falta_politica_desde
     and c.cancelada_en is null and c.fin <= p_momento
     and not exists (select 1 from public.asistencias a where a.clase_id = c.id and a.socio_id = r.socio_id and a.anulada_en is null)
     and not exists (select 1 from public.ingresos i where i.socio_id = r.socio_id and i.resultado <> 'rechazado'
                       and privado.dia_local(i.momento, g.zona_horaria) = privado.dia_local(c.inicio, g.zona_horaria))
$$;
revoke all on function privado.faltas_pack(uuid, timestamptz, uuid) from public;

create or replace function privado.via_pack(
  p_socio_id uuid, p_momento timestamptz, p_sede_id uuid, p_zona text, p_cfg public.configuracion_gimnasio
) returns public.veredicto_acceso
language plpgsql stable set search_path = '' as $$
declare
  v public.veredicto_acceso; pk record; ultimo record; consumio_hoy boolean; hay_otra_sede boolean := false;
begin
  -- Packs con clases y vigentes; los que no valen en esta sede se cuentan aparte.
  for pk in
    select p.*, pl.consume_en, pl.todas_las_sedes,
           p.cantidad - (select count(*) from public.consumos_pack c where c.pack_id = p.id and c.anulado_en is null) - privado.faltas_pack(p.id, p_momento) as restantes,
           (p_sede_id is null or pl.todas_las_sedes
            or exists (select 1 from public.plan_sedes ps where ps.plan_id = pl.id and ps.sede_id = p_sede_id)) as vale_aca
      from public.packs p join public.planes pl on pl.id = p.plan_id
     where p.socio_id = p_socio_id and p.anulado_en is null
       and p.desde <= p_momento and (p.vence_en is null or p.vence_en > p_momento)
     order by p.vence_en nulls last, p.desde
  loop
    continue when pk.restantes <= 0;
    if not pk.vale_aca then hay_otra_sede := true; continue; end if;

    v.via := 'pack'; v.puede := true; v.color := 'verde';
    if pk.consume_en = 'asistencia' then
      v.motivo := 'pack'; v.consume := 'nada'; v.pack_restantes := pk.restantes;
      v.texto := 'Tiene pack · le quedan ' || pk.restantes || ' · se descuenta en la clase';
      return v;
    end if;
    select exists (
      select 1 from public.consumos_pack c
       where c.socio_id = p_socio_id and c.anulado_en is null and c.ingreso_id is not null
         and privado.dia_local(c.momento, p_zona) = privado.dia_local(p_momento, p_zona)
    ) into consumio_hoy;
    if consumio_hoy and not p_cfg.reingreso_mismo_dia_consume then
      v.motivo := 'pack_reingreso'; v.consume := 'nada'; v.pack_restantes := pk.restantes;
      v.texto := 'Reingreso de hoy · el pack no se descuenta · le quedan ' || pk.restantes;
    else
      v.motivo := 'pack'; v.consume := 'pack'; v.consume_id := pk.id; v.pack_restantes := pk.restantes - 1;
      v.texto := 'Entra con el pack · le quedan ' || (pk.restantes - 1);
    end if;
    return v;
  end loop;

  v.puede := false; v.color := 'rojo'; v.via := 'pack'; v.consume := 'nada';
  if hay_otra_sede then
    v.motivo := 'fuera_de_sede'; v.texto := 'El pack no incluye esta sede';
    return v;
  end if;

  select p.*, p.cantidad - (select count(*) from public.consumos_pack c where c.pack_id = p.id and c.anulado_en is null) - privado.faltas_pack(p.id, p_momento) as restantes
    into ultimo
    from public.packs p
   where p.socio_id = p_socio_id and p.anulado_en is null and p.desde <= p_momento
   order by p.desde desc limit 1;
  if not found then return null; end if;
  v.pack_restantes := greatest(ultimo.restantes, 0);
  if ultimo.vence_en is not null and ultimo.vence_en <= p_momento and ultimo.restantes > 0 then
    v.motivo := 'pack_vencido';
    v.texto := 'El pack venció el ' || privado.ultimo_dia(ultimo.vence_en, p_zona) || ' con ' || ultimo.restantes || ' clases sin usar';
  else
    v.motivo := 'pack_agotado';
    v.texto := 'Usó las ' || ultimo.cantidad || ' clases del pack';
  end if;
  return v;
end $$;

create or replace function privado.habilitacion_clase(p_socio_id uuid, p_clase_id uuid, p_momento timestamptz,
                                                      p_excluir_reserva uuid default null) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  c public.clases; v public.veredicto_acceso; sus public.suscripciones; act text; pk record; memb_no_incluye boolean := false;
begin
  select * into c from public.clases where id = p_clase_id;
  select nombre into act from public.actividades where id = c.actividad_id;
  v := privado.calcular_acceso(p_socio_id, c.inicio, c.sede_id);
  if v.motivo = 'suspendido' then
    return jsonb_build_object('ok', false, 'texto', v.texto);
  end if;

  if v.via = 'membresia' and v.puede and not v.modo_aviso then
    select * into sus from public.suscripciones x
     where x.socio_id = p_socio_id and x.inicio <= c.inicio and (x.baja_en is null or x.baja_en > c.inicio)
     order by x.inicio desc limit 1;
    if privado.plan_incluye(sus.plan_id, c.actividad_id) then
      return jsonb_build_object('ok', true, 'via', 'membresia', 'consume', false);
    end if;
    memb_no_incluye := true;
  end if;

  select p.id, pl.consume_en into pk
    from public.packs p join public.planes pl on pl.id = p.plan_id
   where p.socio_id = p_socio_id and p.anulado_en is null
     and p.desde <= c.inicio and (p.vence_en is null or p.vence_en > c.inicio)
     and (pl.todas_las_sedes or exists (select 1 from public.plan_sedes ps where ps.plan_id = pl.id and ps.sede_id = c.sede_id))
     and privado.plan_incluye(pl.id, c.actividad_id)
     and p.cantidad
         - (select count(*) from public.consumos_pack x where x.pack_id = p.id and x.anulado_en is null)
         - privado.faltas_pack(p.id, p_momento, p_excluir_reserva)
         - (select count(*) from public.reservas r join public.clases k on k.id = r.clase_id
             where r.pack_id = p.id and r.estado <> 'cancelada' and r.id is distinct from p_excluir_reserva
               and k.cancelada_en is null and k.inicio > p_momento
               and not exists (select 1 from public.asistencias a where a.clase_id = k.id and a.socio_id = p_socio_id and a.anulada_en is null))
         > 0
   order by p.vence_en nulls last, p.desde
   limit 1;
  if found then
    return jsonb_build_object('ok', true, 'via', 'pack', 'pack_id', pk.id, 'consume', pk.consume_en = 'asistencia');
  end if;

  if v.puede and (v.via = 'pase' or v.modo_aviso) then
    return jsonb_build_object('ok', true, 'via', case when v.modo_aviso then 'modo_aviso' else 'pase' end, 'consume', false);
  end if;

  return jsonb_build_object('ok', false, 'texto',
    case when memb_no_incluye then 'Tu plan no incluye ' || act
         when v.puede and v.via = 'pack' then 'Tu pack no incluye ' || act || ' o ya tiene todas sus clases reservadas'
         else v.texto end);
end $$;

create or replace function public.ficha_socio(p_socio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.socios; e public.equipo; v public.veredicto_acceso; zona text;
begin
  select * into s from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(s.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = s.gimnasio_id;
  v := privado.calcular_acceso(s.id, now(), e.sede_id);
  return jsonb_build_object(
    'socio', jsonb_build_object('id', s.id, 'numero', s.numero, 'nombre', s.nombre, 'apellido', s.apellido, 'dni', s.dni,
      'telefono', s.telefono, 'email', s.email, 'fecha_nacimiento', s.fecha_nacimiento,
      'contacto_emergencia_nombre', s.contacto_emergencia_nombre, 'contacto_emergencia_telefono', s.contacto_emergencia_telefono,
      'notas', s.notas, 'dado_de_baja_en', s.dado_de_baja_en, 'motivo_baja', s.motivo_baja, 'creado_en', s.creado_en,
      'tiene_app', s.usuario_id is not null,
      'responsable_nombre', s.responsable_nombre, 'responsable_telefono', s.responsable_telefono,
      'es_menor', privado.es_menor(s.fecha_nacimiento, privado.dia_local(now(), zona))),
    'acceso', to_jsonb(v),
    'membresia', (select jsonb_build_object('suscripcion_id', su.id, 'plan_id', pl.id, 'plan', pl.nombre, 'tipo', pl.tipo,
                                            'inicio', su.inicio, 'precio', privado.precio_base(pl.id, now()))
                    from public.suscripciones su join public.planes pl on pl.id = su.plan_id
                   where su.socio_id = s.id and su.baja_en is null order by su.inicio desc limit 1),
    'ingresos', coalesce((select jsonb_agg(x order by x.momento desc) from (
                   select i.id, i.momento, i.resultado, i.color, i.texto, i.via_acceso from public.ingresos i
                    where i.socio_id = s.id and i.anulado_en is null order by i.momento desc limit 10) x), '[]'::jsonb),
    'pagos', case when e.rol in ('dueno', 'encargado') then coalesce((select jsonb_agg(x order by x.fecha desc) from (
                   select p.id, coalesce(p.aprobado_en, p.creado_en) as fecha, p.monto, p.medio, p.estado,
                          (select string_agg(vi.descripcion, ', ') from public.venta_items vi where vi.venta_id = p.venta_id) as detalle
                     from public.pagos p join public.ventas ve on ve.id = p.venta_id
                    where ve.socio_id = s.id order by coalesce(p.aprobado_en, p.creado_en) desc limit 10) x), '[]'::jsonb) end,
    'packs', coalesce((select jsonb_agg(jsonb_build_object('id', pk.id, 'plan', pl.nombre, 'cantidad', pk.cantidad,
                         'usadas', (select count(*) from public.consumos_pack cp where cp.pack_id = pk.id and cp.anulado_en is null) + privado.faltas_pack(pk.id, now()),
                         'vence_en', pk.vence_en))
                        from public.packs pk join public.planes pl on pl.id = pk.plan_id
                       where pk.socio_id = s.id and pk.anulado_en is null and (pk.vence_en is null or pk.vence_en > now())), '[]'::jsonb)
  );
end $$;

create or replace function public.mi_socio(p_gimnasio_id uuid, p_socio_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.socios; c public.configuracion_gimnasio; v public.veredicto_acceso; sus public.suscripciones; pl public.planes;
        mios jsonb;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('socio_id', x.id, 'nombre', trim(x.nombre || ' ' || x.apellido)) order by x.nombre), '[]'::jsonb)
    into mios from public.socios x where x.gimnasio_id = p_gimnasio_id and x.usuario_id = auth.uid() and x.dado_de_baja_en is null;
  if jsonb_array_length(mios) = 0 then
    raise exception 'Tu cuenta no es de ningún socio de este gimnasio' using errcode = '42501';
  end if;
  if p_socio_id is null then
    if jsonb_array_length(mios) > 1 then
      return jsonb_build_object('elegir', true, 'socios', mios);
    end if;
    select * into s from public.socios where id = (mios -> 0 ->> 'socio_id')::uuid;
  else
    select * into s from public.socios where id = p_socio_id and gimnasio_id = p_gimnasio_id and usuario_id = auth.uid();
    if not found then raise exception 'Sin permiso para ver ese socio' using errcode = '42501'; end if;
  end if;

  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  v := privado.calcular_acceso(s.id, now(), null);
  select * into sus from public.suscripciones where socio_id = s.id and baja_en is null;
  if found then select * into pl from public.planes where id = sus.plan_id; end if;

  return jsonb_build_object(
    'elegir', false,
    'socios', mios,
    'socio', jsonb_build_object('socio_id', s.id, 'nombre', s.nombre, 'apellido', s.apellido, 'numero', s.numero),
    -- Mismo veredicto que la puerta; sin la indicación para la recepción ("· avisale").
    'acceso', to_jsonb(v) || jsonb_build_object('texto', replace(v.texto, ' · avisale', '')),
    'plan', case when pl.id is not null then jsonb_build_object('nombre', pl.nombre,
              'precio_transferencia', privado.precio_para(pl.id, now(), 'transferencia', null, true)) end,
    'packs', coalesce((select jsonb_agg(jsonb_build_object('plan', p2.nombre, 'cantidad', pk.cantidad, 'vence_en', pk.vence_en,
                         'usadas', (select count(*) from public.consumos_pack cp where cp.pack_id = pk.id and cp.anulado_en is null) + privado.faltas_pack(pk.id, now())))
                        from public.packs pk join public.planes p2 on p2.id = pk.plan_id
                       where pk.socio_id = s.id and pk.anulado_en is null and (pk.vence_en is null or pk.vence_en > now())), '[]'::jsonb),
    'reservas', coalesce((select jsonb_agg(jsonb_build_object('reserva_id', r.id, 'clase_id', k.id, 'actividad', a.nombre, 'emoji', a.emoji,
                            'inicio', k.inicio, 'estado', r.estado,
                            'posicion', case when r.estado = 'espera' then (select count(*) from public.reservas r2
                                          where r2.clase_id = r.clase_id and r2.estado = 'espera' and r2.creado_en <= r.creado_en) end)
                            order by k.inicio)
                           from public.reservas r join public.clases k on k.id = r.clase_id join public.actividades a on a.id = k.actividad_id
                          where r.socio_id = s.id and r.estado in ('confirmada', 'espera') and k.inicio > now() and k.cancelada_en is null), '[]'::jsonb),
    'transferencia', case when 'transferencia' = any (c.medios_aceptados) and not ('transferencias' = any (c.secciones_apagadas))
                               and (c.alias_transferencia is not null or c.cbu is not null) then
                       jsonb_build_object('alias', c.alias_transferencia, 'cbu', c.cbu, 'titular', c.titular_cuenta,
                                          'banco', c.banco_transferencia) end,
    'pendiente', (select jsonb_build_object('monto', p.monto, 'informado_en', p.creado_en)
                    from public.pagos p join public.ventas ve on ve.id = p.venta_id
                   where ve.socio_id = s.id and p.estado = 'pendiente' and p.comprobante_path is not null
                   order by p.creado_en desc limit 1),
    'modo_clases', c.modo_clases,
    'zona', (select gi.zona_horaria from public.gimnasios gi where gi.id = p_gimnasio_id),
    'sedes', coalesce((select jsonb_agg(jsonb_build_object('sede_id', se.id, 'nombre', se.nombre) order by se.es_principal desc, se.nombre)
                         from public.sedes se where se.gimnasio_id = p_gimnasio_id and se.activa), '[]'::jsonb)
  );
end $$;

create or replace function public.guardar_configuracion(p_gimnasio_id uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n int;
  desconocidos text[];
  v_nombre text;
  v_alias text;
  v_cbu text;
  v_titular text;
  v_descuento numeric;
  v_modo text;
  v_accesos text[];
  v_secciones text[];
  v_membresia boolean;
  v_pase boolean;
  v_pack boolean;
  v_tol int; v_aviso int; v_aus int; v_nuevo int; v_venc int; v_fue int; v_res int; v_canc int; v_pausa int; v_apto boolean; v_tope int; v_invitados int; v_rtipo text; v_rvalor numeric; v_rdias int; v_rfinal record; v_fiado boolean; v_ftope numeric; v_falta text; v_fbloq int;
  v_acento text; v_fondo text; v_reingreso boolean; v_medios text[]; v_banco text; v_secciones_final text[]; v_medios_final text[];
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  select array_agg(k) into desconocidos from jsonb_object_keys(p_datos) k
   where k not in ('nombre', 'color_acento', 'color_fondo', 'cobra_membresia', 'cobra_pase', 'cobra_pack', 'modo_clases',
                   'accesos_activos', 'tolerancia_dias', 'dias_aviso', 'reingreso_mismo_dia_consume', 'secciones_apagadas',
                   'alias_transferencia', 'cbu', 'titular_cuenta', 'descuento_max_recepcion', 'retencion_dias_ausencia',
                   'retencion_dias_nuevo', 'retencion_dias_vencido', 'retencion_dias_se_fue', 'reserva_dias_anticipacion',
                   'cancelacion_horas_limite', 'medios_aceptados', 'banco_transferencia', 'pausa_dias_por_anio', 'pide_apto', 'tope_dejar_pasar', 'invitados_por_mes',
                   'recargo_tipo', 'recargo_valor', 'recargo_dias', 'fiado_activo', 'fiado_tope', 'falta_politica', 'falta_bloqueo_dias');
  if desconocidos is not null then raise exception 'Campos que no se pueden cambiar acá: %', array_to_string(desconocidos, ', '); end if;

  -- Marca
  if p_datos ? 'nombre' then
    v_nombre := trim(coalesce(p_datos ->> 'nombre', ''));
    if v_nombre = '' then raise exception 'El nombre del gimnasio es obligatorio.' using errcode = '22023'; end if;
    if length(v_nombre) > 60 then raise exception 'El nombre del gimnasio puede tener hasta 60 letras.' using errcode = '22023'; end if;
  end if;
  v_acento := privado.config_color(p_datos, 'color_acento', 'Color principal');
  v_fondo := privado.config_color(p_datos, 'color_fondo', 'Color de fondo');

  -- Qué cobrás
  v_membresia := privado.config_booleano(p_datos, 'cobra_membresia', 'Membresía');
  v_pase := privado.config_booleano(p_datos, 'cobra_pase', 'Pase diario');
  v_pack := privado.config_booleano(p_datos, 'cobra_pack', 'Pack de clases');

  -- Medios de pago
  if p_datos ? 'medios_aceptados' then
    if jsonb_typeof(p_datos -> 'medios_aceptados') is distinct from 'array' then raise exception 'Datos inválidos'; end if;
    v_medios := array(select distinct x from jsonb_array_elements_text(p_datos -> 'medios_aceptados') x order by 1);
    if exists (select 1 from unnest(v_medios) x where x <> all (array['efectivo', 'transferencia', 'debito', 'credito'])) then
      raise exception 'Medio de pago desconocido.' using errcode = '22023';
    end if;
    if cardinality(v_medios) = 0 then
      raise exception 'Dejá prendido al menos un medio de pago.' using errcode = '22023';
    end if;
  end if;

  -- Clases y accesos
  if p_datos ? 'modo_clases' then
    v_modo := p_datos ->> 'modo_clases';
    if v_modo is null or v_modo not in ('reserva', 'sin_reserva', 'ninguno') then
      raise exception 'Elegí cómo funcionan las clases: con reserva, sin reserva o sin clases.' using errcode = '22023';
    end if;
  end if;
  if p_datos ? 'accesos_activos' then
    if jsonb_typeof(p_datos -> 'accesos_activos') is distinct from 'array' then raise exception 'Datos inválidos'; end if;
    v_accesos := array(select distinct x from jsonb_array_elements_text(p_datos -> 'accesos_activos') x);
    if exists (select 1 from unnest(v_accesos) x
                where x <> all (array['recepcion', 'qr_socio', 'qr_pared', 'kiosco', 'nfc', 'molinete'])) then
      raise exception 'Forma de entrada desconocida.' using errcode = '22023';
    end if;
    if cardinality(v_accesos) = 0 then
      raise exception 'Dejá prendida al menos una forma de entrar al gimnasio.' using errcode = '22023';
    end if;
  end if;
  if p_datos ? 'secciones_apagadas' then
    if jsonb_typeof(p_datos -> 'secciones_apagadas') is distinct from 'array' then raise exception 'Datos inválidos'; end if;
    v_secciones := array(select distinct x from jsonb_array_elements_text(p_datos -> 'secciones_apagadas') x);
    if exists (select 1 from unnest(v_secciones) x where x <> all (privado.secciones_validas())) then
      raise exception 'Sección desconocida';
    end if;
  end if;

  -- Reglas
  v_tol := privado.config_entero(p_datos, 'tolerancia_dias', 0, 60, 'Días de tolerancia');
  v_aviso := privado.config_entero(p_datos, 'dias_aviso', 0, 30, 'Días de aviso antes del vencimiento');
  v_reingreso := privado.config_booleano(p_datos, 'reingreso_mismo_dia_consume', 'Volver a entrar el mismo día');
  if p_datos ? 'descuento_max_recepcion' then
    begin
      v_descuento := nullif(trim(coalesce(p_datos ->> 'descuento_max_recepcion', '')), '')::numeric;
    exception when invalid_text_representation then
      raise exception 'Descuento máximo de recepción: tiene que ser un número entre 0 y 100.' using errcode = '22023';
    end;
    if v_descuento is null then raise exception 'Descuento máximo de recepción: no puede quedar vacío, poné un número entre 0 y 100.' using errcode = '22023'; end if;
    if v_descuento < 0 or v_descuento > 100 then raise exception 'Descuento máximo de recepción: tiene que estar entre 0 y 100 %%.' using errcode = '22023'; end if;
  end if;
  v_aus := privado.config_entero(p_datos, 'retencion_dias_ausencia', 3, 90, 'Días sin venir para avisar');
  v_nuevo := privado.config_entero(p_datos, 'retencion_dias_nuevo', 7, 90, 'Días que un socio cuenta como nuevo');
  v_venc := privado.config_entero(p_datos, 'retencion_dias_vencido', 1, 120, 'Días vencido para avisar');
  v_fue := privado.config_entero(p_datos, 'retencion_dias_se_fue', 7, 365, 'Días para darlo por ido');
  v_res := privado.config_entero(p_datos, 'reserva_dias_anticipacion', 0, 60, 'Días de anticipación para reservar');
  v_canc := privado.config_entero(p_datos, 'cancelacion_horas_limite', 0, 72, 'Horas límite para cancelar');
  if p_datos ? 'pide_apto' then
    if jsonb_typeof(p_datos -> 'pide_apto') is distinct from 'boolean' then raise exception 'Pedir apto físico: elegí sí o no.' using errcode = '22023'; end if;
    v_apto := (p_datos ->> 'pide_apto')::boolean;
  end if;
  -- Recargo por pagar tarde (PLA-7, D8)
  if p_datos ? 'recargo_tipo' then
    v_rtipo := p_datos ->> 'recargo_tipo';
    if v_rtipo is null or v_rtipo not in ('no', 'porcentaje', 'monto') then
      raise exception 'Recargo por pagar tarde: elegí sin recargo, un porcentaje o un monto fijo.' using errcode = '22023';
    end if;
  end if;
  if p_datos ? 'recargo_valor' then
    begin
      v_rvalor := nullif(trim(coalesce(p_datos ->> 'recargo_valor', '')), '')::numeric;
    exception when invalid_text_representation then
      raise exception 'Recargo por pagar tarde: el valor tiene que ser un número.' using errcode = '22023';
    end;
    if v_rvalor is null or v_rvalor < 0 then raise exception 'Recargo por pagar tarde: el valor tiene que ser un número mayor a cero.' using errcode = '22023'; end if;
  end if;
  -- Cuenta corriente (VEN-5, D5)
  v_fiado := privado.config_booleano(p_datos, 'fiado_activo', 'Fiar (cuenta corriente)');
  if p_datos ? 'fiado_tope' then
    begin
      v_ftope := nullif(trim(coalesce(p_datos ->> 'fiado_tope', '')), '')::numeric;
    exception when invalid_text_representation then
      raise exception 'Fiar: el tope tiene que ser un monto en pesos.' using errcode = '22023';
    end;
    if v_ftope is null or v_ftope < 0 or v_ftope > 10000000 then raise exception 'Fiar: el tope va de $0 a $10.000.000.' using errcode = '22023'; end if;
  end if;
  -- Faltas a clases reservadas (CLA-1, D16)
  if p_datos ? 'falta_politica' then
    v_falta := p_datos ->> 'falta_politica';
    if v_falta is null or v_falta not in ('nada', 'bloquear', 'descontar') then
      raise exception 'Faltas: elegí no hacer nada, descontar la clase del pack o no dejar reservar por unos días.' using errcode = '22023';
    end if;
  end if;
  v_fbloq := privado.config_entero(p_datos, 'falta_bloqueo_dias', 1, 60, 'Faltas: días sin poder reservar');
  v_rdias := privado.config_entero(p_datos, 'recargo_dias', 1, 60, 'Recargo: días de atraso');
  v_invitados := privado.config_entero(p_datos, 'invitados_por_mes', 0, 10, 'Invitados por socio por mes');
  v_tope := privado.config_entero(p_datos, 'tope_dejar_pasar', 0, 50, 'Dejar pasar: tope por día de la recepción');
  v_pausa := privado.config_entero(p_datos, 'pausa_dias_por_anio', 0, 365, 'Pausa: máximo de días por año');

  -- Transferencias
  if p_datos ? 'alias_transferencia' then
    v_alias := nullif(trim(coalesce(p_datos ->> 'alias_transferencia', '')), '');
    if v_alias is not null and v_alias !~ '^[A-Za-z0-9.-]{6,20}$' then
      raise exception 'El alias tiene que tener de 6 a 20 caracteres: letras, números, puntos o guiones, sin espacios.' using errcode = '22023';
    end if;
  end if;
  if p_datos ? 'cbu' then
    v_cbu := nullif(regexp_replace(coalesce(p_datos ->> 'cbu', ''), '[\s-]', '', 'g'), '');
    if v_cbu is not null and v_cbu !~ '^[0-9]{22}$' then
      raise exception 'El CBU o CVU tiene 22 números (sin letras). El que pusiste tiene %.', length(regexp_replace(v_cbu, '\D', '', 'g'))
        using errcode = '22023';
    end if;
  end if;
  if p_datos ? 'banco_transferencia' then
    v_banco := nullif(trim(coalesce(p_datos ->> 'banco_transferencia', '')), '');
    if length(v_banco) > 60 then raise exception 'El banco puede tener hasta 60 letras.' using errcode = '22023'; end if;
  end if;
  if p_datos ? 'titular_cuenta' then
    v_titular := nullif(trim(coalesce(p_datos ->> 'titular_cuenta', '')), '');
    if length(v_titular) > 80 then raise exception 'El titular de la cuenta puede tener hasta 80 letras.' using errcode = '22023'; end if;
  end if;

  -- El recargo se valida con cómo queda (lo que viene + lo que ya estaba), antes de guardar.
  select coalesce(v_rtipo, c.recargo_tipo) as tipo, coalesce(v_rvalor, c.recargo_valor) as valor into v_rfinal
    from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  if v_rfinal.tipo <> 'no' and v_rfinal.valor <= 0 then
    raise exception 'Recargo por pagar tarde: poné de cuánto es (o elegí sin recargo).' using errcode = '22023';
  end if;
  if v_rfinal.tipo = 'porcentaje' and v_rfinal.valor > 50 then
    raise exception 'Recargo por pagar tarde: hasta 50 %%.' using errcode = '22023';
  end if;

  if v_nombre is not null then
    update public.gimnasios set nombre = v_nombre where id = p_gimnasio_id;
  end if;

  update public.configuracion_gimnasio c set
    color_acento = coalesce(v_acento, c.color_acento),
    color_fondo = coalesce(v_fondo, c.color_fondo),
    cobra_membresia = coalesce(v_membresia, c.cobra_membresia),
    cobra_pase = coalesce(v_pase, c.cobra_pase),
    cobra_pack = coalesce(v_pack, c.cobra_pack),
    modo_clases = coalesce(v_modo, c.modo_clases),
    accesos_activos = case when p_datos ? 'accesos_activos' then v_accesos else c.accesos_activos end,
    tolerancia_dias = coalesce(v_tol, c.tolerancia_dias),
    dias_aviso = coalesce(v_aviso, c.dias_aviso),
    reingreso_mismo_dia_consume = coalesce(v_reingreso, c.reingreso_mismo_dia_consume),
    secciones_apagadas = case when p_datos ? 'secciones_apagadas' then v_secciones else c.secciones_apagadas end,
    alias_transferencia = case when p_datos ? 'alias_transferencia' then v_alias else c.alias_transferencia end,
    cbu = case when p_datos ? 'cbu' then v_cbu else c.cbu end,
    titular_cuenta = case when p_datos ? 'titular_cuenta' then v_titular else c.titular_cuenta end,
    banco_transferencia = case when p_datos ? 'banco_transferencia' then v_banco else c.banco_transferencia end,
    medios_aceptados = coalesce(v_medios, c.medios_aceptados),
    descuento_max_recepcion = coalesce(v_descuento, c.descuento_max_recepcion),
    retencion_dias_ausencia = coalesce(v_aus, c.retencion_dias_ausencia),
    retencion_dias_nuevo = coalesce(v_nuevo, c.retencion_dias_nuevo),
    retencion_dias_vencido = coalesce(v_venc, c.retencion_dias_vencido),
    retencion_dias_se_fue = coalesce(v_fue, c.retencion_dias_se_fue),
    reserva_dias_anticipacion = coalesce(v_res, c.reserva_dias_anticipacion),
    cancelacion_horas_limite = coalesce(v_canc, c.cancelacion_horas_limite),
    pausa_dias_por_anio = coalesce(v_pausa, c.pausa_dias_por_anio),
    pide_apto = coalesce(v_apto, c.pide_apto),
    tope_dejar_pasar = coalesce(v_tope, c.tope_dejar_pasar),
    invitados_por_mes = coalesce(v_invitados, c.invitados_por_mes),
    recargo_tipo = coalesce(v_rtipo, c.recargo_tipo),
    recargo_valor = case when coalesce(v_rtipo, c.recargo_tipo) = 'no' then 0 else coalesce(v_rvalor, c.recargo_valor) end,
    recargo_dias = coalesce(v_rdias, c.recargo_dias),
    fiado_activo = coalesce(v_fiado, c.fiado_activo),
    fiado_tope = coalesce(round(v_ftope, 2), c.fiado_tope),
    falta_politica = coalesce(v_falta, c.falta_politica),
    falta_bloqueo_dias = coalesce(v_fbloq, c.falta_bloqueo_dias),
    actualizado_en = now()
   where c.gimnasio_id = p_gimnasio_id
  returning c.cobra_membresia, c.cobra_pase, c.cobra_pack, c.secciones_apagadas, c.medios_aceptados
       into v_membresia, v_pase, v_pack, v_secciones_final, v_medios_final;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la configuración'; end if;
  if not (v_membresia or v_pase or v_pack) then
    raise exception 'Dejá prendida al menos una forma de cobrar (membresía, pase diario o pack de clases).' using errcode = '22023';
  end if;
  -- Sin Caja no se cobra en efectivo: si es el único medio, no quedaría cómo cobrar.
  if 'caja' = any (v_secciones_final) and v_medios_final <@ array['efectivo'] then
    raise exception 'Sin Caja no se cobra en efectivo, y es el único medio prendido: prendé otro medio de pago o dejá Caja prendida.' using errcode = '22023';
  end if;
end $$;

create or replace function public.politica_reservas(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare cfg public.configuracion_gimnasio;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select c.* into cfg from public.configuracion_gimnasio c join public.socios s on s.gimnasio_id = c.gimnasio_id where s.id = p_socio_id;
  return jsonb_build_object(
    'reglas', array_remove(array[
      case when cfg.cancelacion_horas_limite > 0 then 'Podés cancelar hasta ' || cfg.cancelacion_horas_limite || ' h antes de la clase.' end,
      case when cfg.falta_politica = 'bloquear' then 'Si reservás y no venís sin cancelar, no podés reservar por ' || cfg.falta_bloqueo_dias
           || case when cfg.falta_bloqueo_dias = 1 then ' día.' else ' días.' end end,
      case when cfg.falta_politica = 'descontar' then 'Si reservás con tu pack y no venís sin cancelar, la clase se descuenta igual.' end], null),
    'bloqueo', privado.bloqueo_reservas(p_socio_id));
end $$;

revoke all on function public.ficha_socio(uuid), public.mi_socio(uuid, uuid), public.guardar_configuracion(uuid, jsonb), public.politica_reservas(uuid)
  from public, anon, authenticated;
grant execute on function public.ficha_socio(uuid), public.mi_socio(uuid, uuid), public.guardar_configuracion(uuid, jsonb), public.politica_reservas(uuid)
  to authenticated, service_role;
revoke all on function privado.via_pack(uuid, timestamptz, uuid, text, public.configuracion_gimnasio) from public;
revoke all on function privado.habilitacion_clase(uuid, uuid, timestamptz, uuid) from public;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['privado.via_pack(uuid, timestamptz, uuid, text, public.configuracion_gimnasio)', 'privado.habilitacion_clase(uuid, uuid, timestamptz, uuid)',
                           'public.ficha_socio(uuid)', 'public.mi_socio(uuid, uuid)'] loop
    if position('faltas_pack' in pg_get_functiondef(f::regprocedure)) = 0 then raise exception 'Verificación: % no cuenta las faltas del pack', f; end if;
  end loop;
  foreach f in array array['privado.faltas_pack(uuid, timestamptz, uuid)', 'public.ficha_socio(uuid)', 'public.mi_socio(uuid, uuid)',
                           'public.guardar_configuracion(uuid, jsonb)', 'public.politica_reservas(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
