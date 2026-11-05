-- 0079 · Pagos online listos para MercadoPago (PAY-1).
-- Cada gimnasio conecta su cuenta (token y clave del webhook, guardados en
-- Vault: nunca en texto plano ni en una tabla que se pueda leer). El socio
-- toca "Pagar con MercadoPago": la base arma la venta y el pago pendiente con
-- el precio de ese medio; el servidor crea el checkout. El que acredita es el
-- webhook (firmado e idempotente por ID externo en eventos_webhook), nunca el
-- navegador que vuelve: la cobertura nace cuando la base confirma.
--
--   (Los medios del mostrador, medios_aceptados, no cambian: MercadoPago es solo online.)
--   guardar_mercadopago(gimnasio, token, secreto, modo)   el dueño
--   quitar_mercadopago(gimnasio)                         el dueño
--   estado_pagos_online(gimnasio)                        dueño y encargado (sin secretos)
--   pago_online_disponible(socio)                        el socio: si puede y cuánto
--   iniciar_pago_online(socio)                           el socio: venta + pago pendiente
--   pago_online(pago)                                    el socio: cómo va (para "Confirmando…")
--   credenciales_mp(gimnasio)                            SOLO clave de servicio
--   registrar_evento_webhook / cerrar_evento_webhook     SOLO clave de servicio
--   acreditar_pago_mp(pago, id_mp, monto, estado)        SOLO clave de servicio

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('vault.create_secret(text, text, text, uuid)') is null then
    raise exception 'Guarda: falta Vault (extensión supabase_vault). En Supabase: Database → Extensions → supabase_vault';
  end if;
  if to_regprocedure('privado.confirmar_venta(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.confirmar_venta'; end if;
  if to_regprocedure('public.gastos_mes(uuid, date)') is null then raise exception 'Guarda: falta la migración 0078'; end if;
end $$;

create table if not exists public.proveedores_pago (
  id                  uuid primary key default gen_random_uuid(),
  gimnasio_id         uuid not null references public.gimnasios(id),
  proveedor           text not null default 'mercadopago' check (proveedor in ('mercadopago')),
  modo                text not null check (modo in ('prueba', 'produccion')),
  token_secreto_id    uuid not null,
  webhook_secreto_id  uuid not null,
  activo              boolean not null default true,
  conectado_en        timestamptz not null default now(),
  conectado_por       uuid not null,
  unique (gimnasio_id, id),
  unique (gimnasio_id, proveedor),
  foreign key (gimnasio_id, conectado_por) references public.equipo (gimnasio_id, id)
);
-- Cerrada: RLS sin políticas. Se lee solo con funciones.
alter table public.proveedores_pago enable row level security;
revoke all on table public.proveedores_pago from anon, authenticated;

-- Idempotencia de webhooks por ID externo. El gimnasio se resuelve después de recibir.
create table if not exists public.eventos_webhook (
  id           uuid primary key default gen_random_uuid(),
  origen       text not null check (origen in ('mp_cobros', 'mp_plataforma')),
  tipo         text not null,
  id_externo   text not null,
  gimnasio_id  uuid references public.gimnasios(id),
  payload      jsonb not null default '{}'::jsonb,
  recibido_en  timestamptz not null default now(),
  procesado_en timestamptz,
  intentos     int not null default 1,
  error        text,
  unique (origen, tipo, id_externo)
);
alter table public.eventos_webhook enable row level security;
revoke all on table public.eventos_webhook from anon, authenticated;

create or replace function public.guardar_mercadopago(p_gimnasio_id uuid, p_token text, p_secreto text, p_modo text) returns void
language plpgsql security definer set search_path = '' as $$
declare eid uuid; pp public.proveedores_pago; tok text := trim(coalesce(p_token, '')); sec text := trim(coalesce(p_secreto, ''));
begin
  eid := privado.exigir_rol(p_gimnasio_id, array['dueno']);
  if p_modo is null or p_modo not in ('prueba', 'produccion') then raise exception 'Elegí si es de prueba o de producción' using errcode = '22023'; end if;
  if tok !~ '^(APP_USR|TEST)-[A-Za-z0-9_-]{20,}$' or length(tok) > 300 then
    raise exception 'El Access Token empieza con APP_USR- (o TEST- el de prueba): copialo entero de MercadoPago → Tus integraciones → Credenciales' using errcode = '22023';
  end if;
  if length(sec) < 16 or length(sec) > 200 then raise exception 'La clave secreta del webhook está en MercadoPago → Tus integraciones → Webhooks: copiala entera' using errcode = '22023'; end if;
  select * into pp from public.proveedores_pago where gimnasio_id = p_gimnasio_id and proveedor = 'mercadopago' for update;
  if found then
    perform vault.update_secret(pp.token_secreto_id, tok);
    perform vault.update_secret(pp.webhook_secreto_id, sec);
    update public.proveedores_pago set modo = p_modo, activo = true, conectado_en = now(), conectado_por = eid where id = pp.id and gimnasio_id = p_gimnasio_id;
  else
    insert into public.proveedores_pago (gimnasio_id, modo, token_secreto_id, webhook_secreto_id, conectado_por)
    values (p_gimnasio_id, p_modo,
            vault.create_secret(tok, 'mp_token_' || p_gimnasio_id, 'MercadoPago: Access Token del gimnasio'),
            vault.create_secret(sec, 'mp_webhook_' || p_gimnasio_id, 'MercadoPago: clave del webhook del gimnasio'), eid);
  end if;
end $$;

create or replace function public.quitar_mercadopago(p_gimnasio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare pp public.proveedores_pago;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno']);
  select * into pp from public.proveedores_pago where gimnasio_id = p_gimnasio_id and proveedor = 'mercadopago' for update;
  if not found then raise exception 'MercadoPago no estaba conectado' using errcode = '22023'; end if;
  -- Los secretos se pisan: desconectado no queda ningún token usable.
  perform vault.update_secret(pp.token_secreto_id, 'desconectado');
  perform vault.update_secret(pp.webhook_secreto_id, 'desconectado');
  update public.proveedores_pago set activo = false where id = pp.id and gimnasio_id = p_gimnasio_id;
end $$;

create or replace function public.estado_pagos_online(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return coalesce((select jsonb_build_object('conectado', pp.activo, 'modo', pp.modo, 'conectado_en', pp.conectado_en,
                     'por', (select e.nombre from public.equipo e where e.id = pp.conectado_por))
                     from public.proveedores_pago pp where pp.gimnasio_id = p_gimnasio_id and pp.proveedor = 'mercadopago'),
                  jsonb_build_object('conectado', false));
end $$;

-- Lo que paga el socio con MercadoPago: la cuota de su plan, al precio de ese medio.
create or replace function privado.cuota_online(p_socio_id uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare so public.socios; sus public.suscripciones; pl public.planes; sede uuid; precio numeric;
begin
  select * into so from public.socios where id = p_socio_id;
  if not exists (select 1 from public.proveedores_pago where gimnasio_id = so.gimnasio_id and proveedor = 'mercadopago' and activo) then
    return jsonb_build_object('disponible', false, 'motivo', 'El gimnasio no tiene pagos online');
  end if;
  select * into sus from public.suscripciones where socio_id = so.id and baja_en is null;
  if not found then return jsonb_build_object('disponible', false, 'motivo', 'No tenés una membresía activa: hablá con la recepción'); end if;
  select * into pl from public.planes where id = sus.plan_id;
  select id into sede from public.sedes where gimnasio_id = so.gimnasio_id and es_principal;
  precio := privado.precio_para(pl.id, now(), 'mercadopago', sede, true);
  if precio is null or precio <= 0 then return jsonb_build_object('disponible', false, 'motivo', 'El plan ' || pl.nombre || ' no tiene precio cargado'); end if;
  return jsonb_build_object('disponible', true, 'monto', precio, 'descripcion', 'Cuota ' || pl.nombre, 'plan_id', pl.id, 'suscripcion_id', sus.id, 'sede_id', sede);
end $$;
revoke all on function privado.cuota_online(uuid) from public;

create or replace function public.pago_online_disponible(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return privado.cuota_online(p_socio_id) - 'plan_id' - 'suscripcion_id' - 'sede_id';
end $$;

-- Venta y pago pendientes. Si ya hay uno de la última hora sin pagar, se reusa (no se apilan).
create or replace function public.iniciar_pago_online(p_socio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare so public.socios; c jsonb; vid uuid; pid uuid;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into so from public.socios where id = p_socio_id for update;
  c := privado.cuota_online(so.id);
  if not (c ->> 'disponible')::boolean then raise exception '%', c ->> 'motivo' using errcode = '22023'; end if;
  select p.id into pid from public.pagos p join public.ventas v on v.id = p.venta_id
   where v.socio_id = so.id and p.medio = 'mercadopago' and p.estado = 'pendiente' and p.monto = (c ->> 'monto')::numeric
     and p.creado_en > now() - interval '1 hour' order by p.creado_en desc limit 1;
  if pid is null then
    insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen)
    values (so.gimnasio_id, (c ->> 'sede_id')::uuid, so.id, 'pendiente', 'app') returning id into vid;
    insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, suscripcion_id, descripcion, cantidad, precio_unitario)
    values (so.gimnasio_id, vid, 'cuota', (c ->> 'plan_id')::uuid, (c ->> 'suscripcion_id')::uuid, c ->> 'descripcion', 1, (c ->> 'monto')::numeric);
    insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado)
    values (so.gimnasio_id, vid, 'mercadopago', (c ->> 'monto')::numeric, 'pendiente') returning id into pid;
  end if;
  return jsonb_build_object('pago_id', pid, 'gimnasio_id', so.gimnasio_id, 'monto', (c ->> 'monto')::numeric, 'descripcion', c ->> 'descripcion');
end $$;

create or replace function public.pago_online(p_pago_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  select jsonb_build_object('estado', p.estado, 'monto', p.monto, 'medio', p.medio, 'rechazado_motivo', p.rechazado_motivo,
           'descripcion', (select string_agg(i.descripcion, ' + ') from public.venta_items i where i.venta_id = v.id))
    into r from public.pagos p join public.ventas v on v.id = p.venta_id
   where p.id = p_pago_id and v.socio_id in (select privado.mis_socios());
  if r is null then raise exception 'Sin permiso o pago inexistente' using errcode = '42501'; end if;
  return r;
end $$;

-- ── Solo el servidor (clave de servicio) ────────────────────────────
create or replace function public.credenciales_mp(p_gimnasio_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('modo', pp.modo,
           'token', (select s.decrypted_secret from vault.decrypted_secrets s where s.id = pp.token_secreto_id),
           'webhook_secreto', (select s.decrypted_secret from vault.decrypted_secrets s where s.id = pp.webhook_secreto_id))
    from public.proveedores_pago pp where pp.gimnasio_id = p_gimnasio_id and pp.proveedor = 'mercadopago' and pp.activo
$$;

-- Devuelve { nuevo, procesado }: si ya se procesó, no se vuelve a acreditar.
create or replace function public.registrar_evento_webhook(p_origen text, p_tipo text, p_id_externo text, p_gimnasio_id uuid, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.eventos_webhook;
begin
  insert into public.eventos_webhook (origen, tipo, id_externo, gimnasio_id, payload)
  values (p_origen, p_tipo, p_id_externo, p_gimnasio_id, coalesce(p_payload, '{}'::jsonb))
  on conflict (origen, tipo, id_externo) do update set intentos = public.eventos_webhook.intentos + 1
  returning * into e;
  return jsonb_build_object('evento_id', e.id, 'nuevo', e.intentos = 1, 'procesado', e.procesado_en is not null);
end $$;

create or replace function public.cerrar_evento_webhook(p_evento_id uuid, p_error text default null) returns void
language sql security definer set search_path = '' as $$
  update public.eventos_webhook set procesado_en = case when p_error is null then now() end, error = left(p_error, 500) where id = p_evento_id
$$;

-- Lo que dijo MercadoPago (leído de su API con el token del gimnasio, no del aviso).
create or replace function public.acreditar_pago_mp(p_pago_id uuid, p_mp_pago_id text, p_monto numeric, p_estado text) returns text
language plpgsql security definer set search_path = '' as $$
declare p public.pagos; v public.ventas; n int;
begin
  select v2.* into v from public.ventas v2 join public.pagos p2 on p2.venta_id = v2.id where p2.id = p_pago_id for update of v2;
  if not found then raise exception 'Pago inexistente: %', p_pago_id using errcode = 'P0002'; end if;
  select * into p from public.pagos where id = p_pago_id for update;
  if p.medio <> 'mercadopago' then raise exception 'Ese pago no es de MercadoPago'; end if;
  if p.estado = 'aprobado' then
    if p.mp_pago_id = p_mp_pago_id then return 'ya_acreditado'; end if;
    raise exception 'El pago % ya estaba aprobado con otro ID de MercadoPago (%)', p.id, p.mp_pago_id;
  end if;
  if p.estado <> 'pendiente' then return 'ya_' || p.estado; end if;
  if p_estado = 'approved' then
    if abs(coalesce(p_monto, 0) - p.monto) >= 0.01 then
      raise exception 'MercadoPago cobró % y el pago era de %: no se acredita', p_monto, p.monto;
    end if;
    update public.pagos set estado = 'aprobado', aprobado_en = now(), mp_pago_id = p_mp_pago_id where id = p.id and estado = 'pendiente';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo acreditar el pago'; end if;
    perform privado.confirmar_venta(v.id, now());
    return 'acreditado';
  elsif p_estado in ('rejected', 'cancelled', 'refunded', 'charged_back') then
    update public.pagos set estado = 'rechazado', rechazado_en = now(), mp_pago_id = p_mp_pago_id,
           rechazado_motivo = 'MercadoPago: ' || case p_estado when 'rejected' then 'el pago fue rechazado' when 'cancelled' then 'el pago se canceló' else 'se devolvió' end
     where id = p.id and estado = 'pendiente';
    return 'rechazado';
  end if;
  return 'sin_cambios';   -- pending / in_process: se espera el próximo aviso
end $$;

revoke all on function public.guardar_mercadopago(uuid, text, text, text), public.quitar_mercadopago(uuid), public.estado_pagos_online(uuid),
  public.pago_online_disponible(uuid), public.iniciar_pago_online(uuid), public.pago_online(uuid), public.credenciales_mp(uuid),
  public.registrar_evento_webhook(text, text, text, uuid, jsonb), public.cerrar_evento_webhook(uuid, text), public.acreditar_pago_mp(uuid, text, numeric, text)
  from public, anon, authenticated;
grant execute on function public.guardar_mercadopago(uuid, text, text, text), public.quitar_mercadopago(uuid), public.estado_pagos_online(uuid),
  public.pago_online_disponible(uuid), public.iniciar_pago_online(uuid), public.pago_online(uuid) to authenticated, service_role;
grant execute on function public.credenciales_mp(uuid), public.registrar_evento_webhook(text, text, text, uuid, jsonb),
  public.cerrar_evento_webhook(uuid, text), public.acreditar_pago_mp(uuid, text, numeric, text) to service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.proveedores_pago'::regclass) then raise exception 'Verificación: proveedores_pago sin RLS'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.eventos_webhook'::regclass) then raise exception 'Verificación: eventos_webhook sin RLS'; end if;
  if exists (select 1 from pg_policies where tablename in ('proveedores_pago', 'eventos_webhook') and schemaname = 'public') then
    raise exception 'Verificación: proveedores_pago y eventos_webhook van sin políticas (cerradas)';
  end if;
  foreach f in array array['public.guardar_mercadopago(uuid, text, text, text)', 'public.quitar_mercadopago(uuid)', 'public.estado_pagos_online(uuid)',
      'public.pago_online_disponible(uuid)', 'public.iniciar_pago_online(uuid)', 'public.pago_online(uuid)', 'public.credenciales_mp(uuid)',
      'public.registrar_evento_webhook(text, text, text, uuid, jsonb)', 'public.cerrar_evento_webhook(uuid, text)', 'public.acreditar_pago_mp(uuid, text, numeric, text)',
      'privado.cuota_online(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  foreach f in array array['public.credenciales_mp(uuid)', 'public.registrar_evento_webhook(text, text, text, uuid, jsonb)',
      'public.cerrar_evento_webhook(uuid, text)', 'public.acreditar_pago_mp(uuid, text, numeric, text)'] loop
    if has_function_privilege('authenticated', f, 'execute') then raise exception 'Verificación: % es solo para la clave de servicio', f; end if;
  end loop;
end $$;
