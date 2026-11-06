-- VD-35 · Registro del socio por su cuenta (D26, docs/v2/05-SOCIO.md §2b, 11-INGRESO-Y-SEGURIDAD.md)
--
-- El alta online (REG-1) ya existe: el visitante elige plan, deja datos, acepta el reglamento y queda
-- socio SIN PAGAR con ese plan (sin cobertura: la entrada lo frena hasta que paga). Esta migración
-- cierra lo que faltaba de D26:
--
--   alta_online              (misma firma) la fecha de nacimiento ahora es OBLIGATORIA: sin ella la base
--                            no puede saber si es menor, y un menor no se anota solo (D10: viene un
--                            adulto responsable). Copiada de 0032, sin otro cambio.
--   registro_socios_panel / guardar_registro_socios
--                            el interruptor "registro abierto" del dueño, chico y propio: prende o
--                            apaga las altas online sin tocar el reglamento (que sigue en Tu página).
--                            Lo lee la misma columna que alta_publica y alta_online: un solo interruptor.
--   informar_transferencia / iniciar_pago_online
--                            los pagos de la app del socio llevan la clave de operación de VD-34
--                            (doble toque = un solo pago). Se copian las definiciones más nuevas
--                            (0027 y 0079) y se borran las firmas viejas en la misma migración.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.alta_online(text, uuid, jsonb, int, text)') is null then raise exception 'Guarda: falta alta_online (0032)'; end if;
  if to_regprocedure('privado.informar_transferencia(uuid, int, text, timestamptz, uuid)') is null then raise exception 'Guarda: falta privado.informar_transferencia'; end if;
  if to_regprocedure('public.iniciar_pago_online(uuid)') is null then raise exception 'Guarda: falta iniciar_pago_online (0079)'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ventas' and column_name = 'clave_operacion') then
    raise exception 'Guarda: falta ventas.clave_operacion (VD-34)';
  end if;
end $$;

-- ── Alta online: la fecha de nacimiento es obligatoria ──────────────
create or replace function public.alta_online(p_host text, p_plan_id uuid, p_datos jsonb, p_version int, p_medio text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g uuid; c public.configuracion_gimnasio; regl public.reglamentos; pl public.planes; sid uuid;
  v_nombre text := trim(coalesce(p_datos ->> 'nombre', '')); v_apellido text := trim(coalesce(p_datos ->> 'apellido', ''));
  v_dni text := regexp_replace(coalesce(p_datos ->> 'dni', ''), '\D', '', 'g');
  v_mail text := nullif(lower(trim(coalesce(p_datos ->> 'email', ''))), '');
  v_nac date; v_tel text; v_trans jsonb; zona text;
begin
  select d.gimnasio_id into g from public.dominios_gimnasio d
    join public.landing_gimnasio l on l.gimnasio_id = d.gimnasio_id and l.publicada
   where d.host = lower(p_host);
  select * into c from public.configuracion_gimnasio where gimnasio_id = g;
  if g is null or not coalesce(c.altas_online, false) then raise exception 'Este gimnasio no está aceptando altas online. Escribile por WhatsApp.'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = g;

  select * into pl from public.planes p where p.gimnasio_id = g and p.id = p_plan_id and p.activo and p.visible_en_landing;
  if pl.id is null then raise exception 'Elegí uno de los planes de la página.'; end if;
  select * into regl from public.reglamentos r where r.gimnasio_id = g order by r.version desc limit 1;
  if regl.id is null or p_version is distinct from regl.version then
    raise exception 'El reglamento cambió mientras te anotabas: leelo de nuevo y aceptalo.';
  end if;

  if length(v_nombre) = 0 or length(v_apellido) = 0 then raise exception 'Escribí tu nombre y tu apellido.'; end if;
  if length(v_nombre) > 80 or length(v_apellido) > 80 then raise exception 'Nombre o apellido muy largos (hasta 80 letras).'; end if;
  if v_dni !~ '^[0-9]{6,9}$' then raise exception 'DNI: entre 6 y 9 números, sin puntos.'; end if;
  if v_mail is not null and v_mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisá el mail.'; end if;
  begin
    v_tel := privado.telefono_normalizado(p_datos ->> 'telefono', 'Celular');
  exception when others then
    raise exception 'Revisá el celular: con característica, por ejemplo 387 555 1234.';
  end;
  if v_tel is null then raise exception 'Dejá tu celular: con él entrás a la app.'; end if;
  -- VD-35 (D26): sin fecha de nacimiento no se sabe si es menor, así que no se anota.
  if coalesce(p_datos ->> 'fecha_nacimiento', '') = '' then
    raise exception 'Escribí tu fecha de nacimiento: los menores de 18 se anotan en el gimnasio con un adulto responsable.';
  end if;
  begin v_nac := (p_datos ->> 'fecha_nacimiento')::date;
  exception when others then raise exception 'Revisá la fecha de nacimiento.'; end;
  if v_nac > (now() at time zone zona)::date or v_nac < date '1900-01-01' then raise exception 'Revisá la fecha de nacimiento.'; end if;
  if v_nac > ((now() at time zone zona)::date - interval '18 years') then
    raise exception 'Si tenés menos de 18 años, el alta la hace un adulto responsable en el gimnasio. ¡Te esperamos!';
  end if;

  if p_medio is null or p_medio not in ('transferencia', 'mostrador') then raise exception 'Elegí cómo vas a pagar.'; end if;
  v_trans := privado.datos_transferencia(g);
  if p_medio = 'transferencia' and v_trans is null then raise exception 'Este gimnasio no recibe transferencias: elegí pagar en el mostrador.'; end if;

  -- Ya es socio (por DNI o celular): no se duplica nada.
  if exists (select 1 from public.socios s where s.gimnasio_id = g and (s.dni = v_dni or s.telefono = v_tel)) then
    return jsonb_build_object('ya_socio', true);
  end if;
  if (select count(*) from public.socios s where s.gimnasio_id = g and s.origen = 'alta_web' and s.creado_en > now() - interval '1 hour') >= 20 then
    raise exception 'Recibimos muchas altas en este momento. Probá en un rato o escribinos por WhatsApp.';
  end if;

  insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, email, fecha_nacimiento, origen)
  values (g, v_nombre, v_apellido, v_dni, v_tel, v_mail, v_nac, 'alta_web') returning id into sid;
  -- Membresía: queda asignada (sin cobertura hasta pagar). Pase o pack: se compra en el mostrador o con transferencia.
  if pl.tipo = 'membresia' then perform privado.asignar_plan(sid, pl.id, now(), null); end if;
  insert into public.aceptaciones_reglamento (gimnasio_id, socio_id, reglamento_id) values (g, sid, regl.id);

  -- El aviso al gimnasio: queda en Prospectos → "Se hicieron socios", con lo que eligió.
  insert into public.prospectos (gimnasio_id, nombre, telefono, interes, origen, estado, socio_id, nota)
  values (g, v_nombre || ' ' || v_apellido, v_tel, 'Alta online · ' || pl.nombre, 'pagina', 'socio', sid,
          case p_medio when 'transferencia' then 'Se anotó online: paga por transferencia (manda el comprobante desde la app).'
                       else 'Se anotó online: paga en el mostrador.' end)
  on conflict (gimnasio_id, telefono) do update set estado = 'socio', socio_id = excluded.socio_id, interes = excluded.interes,
    nota = excluded.nota, actualizado_en = now();

  return jsonb_build_object('ya_socio', false, 'socio_id', sid, 'plan', pl.nombre,
    'precio', privado.precio_para(pl.id, now(), null, null, false), 'medio', p_medio,
    'transferencia', case when p_medio = 'transferencia' then v_trans end);
end $$;

-- ── El interruptor "registro abierto" del dueño ─────────────────────
create or replace function public.registro_socios_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return jsonb_build_object(
    'abierto', coalesce((select c.altas_online from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id), false),
    'tiene_reglamento', exists (select 1 from public.reglamentos r where r.gimnasio_id = p_gimnasio_id),
    'publicada', coalesce((select l.publicada from public.landing_gimnasio l where l.gimnasio_id = p_gimnasio_id), false),
    'anotados_web', (select count(*) from public.socios s where s.gimnasio_id = p_gimnasio_id and s.origen = 'alta_web' and s.dado_de_baja_en is null));
end $$;

create or replace function public.guardar_registro_socios(p_gimnasio_id uuid, p_abierto boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_abierto is null then raise exception 'Elegí si el registro está abierto o cerrado' using errcode = '22023'; end if;
  if p_abierto and not exists (select 1 from public.reglamentos r where r.gimnasio_id = p_gimnasio_id) then
    raise exception 'Escribí el reglamento antes de abrir el registro (en Tu página): cada socio nuevo lo tiene que aceptar.' using errcode = '22023';
  end if;
  update public.configuracion_gimnasio set altas_online = p_abierto where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar'; end if;
  return public.registro_socios_panel(p_gimnasio_id);
end $$;

-- ── Pagos de la app con clave de operación (VD-34) ──────────────────
-- Transferencia informada: la misma clave devuelve el pago ya hecho; no se repite ni se vuelve a rechazar.
drop function if exists public.informar_transferencia(uuid, text, int);
create or replace function public.informar_transferencia(p_socio_id uuid, p_comprobante_path text, p_cuotas int default 1, p_clave_operacion uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid; previa public.ventas; pg public.pagos; r jsonb; n int;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if not exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = g and 'transferencia' = any (c.medios_aceptados)
                   and not ('transferencias' = any (c.secciones_apagadas))) then
    raise exception 'Este gimnasio no recibe pagos por transferencia: pagá en el mostrador.' using errcode = '22023';
  end if;
  if p_socio_id not in (select privado.mis_socios()) then
    eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion']);
  end if;

  if p_clave_operacion is not null then
    perform pg_advisory_xact_lock(hashtextextended(g::text || p_clave_operacion::text, 0));
    select * into previa from public.ventas v where v.gimnasio_id = g and v.clave_operacion = p_clave_operacion;
    if found then
      if previa.socio_id is distinct from p_socio_id then raise exception 'Esa operación ya se usó' using errcode = '22023'; end if;
      select * into pg from public.pagos p where p.venta_id = previa.id order by p.creado_en limit 1;
      return jsonb_build_object('venta_id', previa.id, 'pago_id', pg.id, 'monto', pg.monto, 'repetida', true);
    end if;
  end if;

  r := privado.informar_transferencia(p_socio_id, p_cuotas, p_comprobante_path, now(), eid);
  if p_clave_operacion is not null then
    update public.ventas set clave_operacion = p_clave_operacion where gimnasio_id = g and id = (r ->> 'venta_id')::uuid;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo registrar la clave de la operación'; end if;
  end if;
  return r;
end $$;

-- MercadoPago: la misma clave devuelve el pago ya iniciado (además de reusar el pendiente de la última hora).
drop function if exists public.iniciar_pago_online(uuid);
create or replace function public.iniciar_pago_online(p_socio_id uuid, p_clave_operacion uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare so public.socios; c jsonb; vid uuid; pid uuid; previa public.ventas; pg public.pagos;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into so from public.socios where id = p_socio_id for update;
  if p_clave_operacion is not null then
    perform pg_advisory_xact_lock(hashtextextended(so.gimnasio_id::text || p_clave_operacion::text, 0));
    select * into previa from public.ventas v where v.gimnasio_id = so.gimnasio_id and v.clave_operacion = p_clave_operacion;
    if found then
      if previa.socio_id is distinct from so.id then raise exception 'Esa operación ya se usó' using errcode = '22023'; end if;
      select * into pg from public.pagos p where p.venta_id = previa.id and p.medio = 'mercadopago' order by p.creado_en limit 1;
      if pg.id is null then raise exception 'Esa operación ya se usó' using errcode = '22023'; end if;
      return jsonb_build_object('pago_id', pg.id, 'gimnasio_id', so.gimnasio_id, 'monto', pg.monto, 'repetida', true,
        'descripcion', (select string_agg(i.descripcion, ' + ' order by i.id) from public.venta_items i where i.venta_id = previa.id));
    end if;
  end if;
  c := privado.cuota_online(so.id);
  if not (c ->> 'disponible')::boolean then raise exception '%', c ->> 'motivo' using errcode = '22023'; end if;
  select p.id into pid from public.pagos p join public.ventas v on v.id = p.venta_id
   where v.socio_id = so.id and p.medio = 'mercadopago' and p.estado = 'pendiente' and p.monto = (c ->> 'monto')::numeric
     and p.creado_en > now() - interval '1 hour' order by p.creado_en desc limit 1;
  if pid is null then
    insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, clave_operacion)
    values (so.gimnasio_id, (c ->> 'sede_id')::uuid, so.id, 'pendiente', 'app', p_clave_operacion) returning id into vid;
    insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, suscripcion_id, descripcion, cantidad, precio_unitario)
    values (so.gimnasio_id, vid, 'cuota', (c ->> 'plan_id')::uuid, (c ->> 'suscripcion_id')::uuid, c ->> 'descripcion', 1, (c ->> 'monto')::numeric);
    insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado)
    values (so.gimnasio_id, vid, 'mercadopago', (c ->> 'monto')::numeric, 'pendiente') returning id into pid;
  end if;
  return jsonb_build_object('pago_id', pid, 'gimnasio_id', so.gimnasio_id, 'monto', (c ->> 'monto')::numeric, 'descripcion', c ->> 'descripcion');
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.alta_online(text, uuid, jsonb, int, text), public.registro_socios_panel(uuid), public.guardar_registro_socios(uuid, boolean),
  public.informar_transferencia(uuid, text, int, uuid), public.iniciar_pago_online(uuid, uuid) from public, anon, authenticated;
grant execute on function public.alta_online(text, uuid, jsonb, int, text) to anon, authenticated, service_role;
grant execute on function public.registro_socios_panel(uuid), public.guardar_registro_socios(uuid, boolean),
  public.informar_transferencia(uuid, text, int, uuid), public.iniciar_pago_online(uuid, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.alta_online(text, uuid, jsonb, int, text)', 'public.registro_socios_panel(uuid)', 'public.guardar_registro_socios(uuid, boolean)',
                           'public.informar_transferencia(uuid, text, int, uuid)', 'public.iniciar_pago_online(uuid, uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
  end loop;
  foreach f in array array['public.registro_socios_panel(uuid)', 'public.guardar_registro_socios(uuid, boolean)',
                           'public.informar_transferencia(uuid, text, int, uuid)', 'public.iniciar_pago_online(uuid, uuid)'] loop
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if to_regprocedure('public.informar_transferencia(uuid, text, int)') is not null then raise exception 'Verificación: quedó la firma vieja de informar_transferencia'; end if;
  if to_regprocedure('public.iniciar_pago_online(uuid)') is not null then raise exception 'Verificación: quedó la firma vieja de iniciar_pago_online'; end if;
end $$;
