-- N1 · Débito automático con MercadoPago (suscripciones). DISEÑO + base lista, APAGADO por defecto (interruptor "debito_automatico", N5).
-- 🔌 Sin credenciales reales de MercadoPago esto no cobra: la base y el aviso (webhook) están y se prueban con el simulador local
-- (scripts/local/mp-simulado.mjs); lo que falta para producción está en docs/base/DEBITO-AUTOMATICO.md.
-- Plata: el webhook firmado manda, nunca el navegador. Cada cobro se acredita UNA vez por su ID externo (cobros_debito, único por
-- gimnasio y pago de MercadoPago; además eventos_webhook). El monto tiene que coincidir con lo acordado en la adhesión.
--   debitos_automaticos     la adhesión de un socio (monto acordado, estado, ID de la suscripción en MercadoPago)
--   cobros_debito           cada cobro mensual recibido (ID de MercadoPago único por gimnasio)
--   debito_estado(gimnasio)                        dueño y encargado: conexión, adhesiones y últimos cobros
--   registrar_adhesion_debito(gim, socio, mp_id, monto)   dueño y encargado (el servidor, después de crear la suscripción en MP)
--   cancelar_adhesion_debito(gim, adhesion)        dueño y encargado
--   actualizar_adhesion_debito(gim, mp_id, estado) SOLO servidor (aviso de MercadoPago: authorized | paused | cancelled)
--   acreditar_cobro_debito(...)                    SOLO servidor (aviso de cobro: approved | rejected | …)
-- Aditiva e idempotente.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.exigir_funcion(uuid, text)') is null then raise exception 'Guarda: falta N5 (funciones nuevas)'; end if;
  if to_regprocedure('privado.confirmar_venta(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.confirmar_venta'; end if;
  if to_regclass('public.proveedores_pago') is null or to_regclass('public.eventos_webhook') is null then raise exception 'Guarda: falta la base de MercadoPago (pagos online)'; end if;
end $$;

create table if not exists public.debitos_automaticos (
  id                 uuid primary key default gen_random_uuid(),
  gimnasio_id        uuid not null references public.gimnasios(id),
  socio_id           uuid not null,
  mp_suscripcion_id  text not null check (length(mp_suscripcion_id) between 3 and 120),
  monto_acordado     numeric(12,2) not null check (monto_acordado > 0),
  estado             text not null default 'pendiente' check (estado in ('pendiente', 'activa', 'pausada', 'cancelada')),
  creada_en          timestamptz not null default now(),
  creada_por         uuid,
  activada_en        timestamptz,
  cancelada_en       timestamptz,
  unique (gimnasio_id, id),
  unique (gimnasio_id, mp_suscripcion_id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, creada_por) references public.equipo (gimnasio_id, id),
  check ((estado = 'cancelada') = (cancelada_en is not null))
);
-- Un socio, una adhesión que siga viva.
create unique index if not exists debitos_automaticos_una_viva on public.debitos_automaticos (gimnasio_id, socio_id) where estado <> 'cancelada';
select privado.politicas_estandar('public.debitos_automaticos', array['dueno', 'encargado'], null);
revoke all on table public.debitos_automaticos from anon;
revoke truncate, references, trigger on public.debitos_automaticos from authenticated;

create table if not exists public.cobros_debito (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  adhesion_id   uuid not null,
  mp_pago_id    text not null,
  monto         numeric(12,2) not null check (monto > 0),
  estado        text not null check (estado in ('acreditado', 'rechazado', 'sin_acreditar', 'devuelto_a_mano')),
  pago_id       uuid,
  creado_en     timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, mp_pago_id),
  foreign key (gimnasio_id, adhesion_id) references public.debitos_automaticos (gimnasio_id, id),
  foreign key (gimnasio_id, pago_id) references public.pagos (gimnasio_id, id)
);
create index if not exists cobros_debito_adhesion on public.cobros_debito (gimnasio_id, adhesion_id, creado_en desc);
select privado.politicas_estandar('public.cobros_debito', array['dueno', 'encargado'], null);
revoke all on table public.cobros_debito from anon;
revoke truncate, references, trigger on public.cobros_debito from authenticated;

-- ── La pantalla del dueño ───────────────────────────────────────────
create or replace function public.debito_estado(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  perform privado.exigir_funcion(p_gimnasio_id, 'debito_automatico');
  return jsonb_build_object(
    'mp_conectado', exists (select 1 from public.proveedores_pago pp where pp.gimnasio_id = p_gimnasio_id and pp.proveedor = 'mercadopago' and pp.activo),
    'adhesiones', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'socio_id', d.socio_id, 'nombre', trim(s.nombre || ' ' || s.apellido), 'monto', d.monto_acordado,
                     'estado', d.estado, 'creada_en', d.creada_en,
                     'cobros', (select count(*) from public.cobros_debito c where c.gimnasio_id = d.gimnasio_id and c.adhesion_id = d.id and c.estado = 'acreditado'),
                     'sin_acreditar', (select count(*) from public.cobros_debito c where c.gimnasio_id = d.gimnasio_id and c.adhesion_id = d.id and c.estado = 'sin_acreditar')) order by d.creada_en desc)
                  from public.debitos_automaticos d join public.socios s on s.gimnasio_id = d.gimnasio_id and s.id = d.socio_id
                 where d.gimnasio_id = p_gimnasio_id), '[]'::jsonb),
    'ultimos_cobros', coalesce((select jsonb_agg(jsonb_build_object('mp_pago_id', x.mp_pago_id, 'monto', x.monto, 'estado', x.estado, 'creado_en', x.creado_en, 'nombre', x.nombre) order by x.creado_en desc)
                  from (select c.mp_pago_id, c.monto, c.estado, c.creado_en, trim(s.nombre || ' ' || s.apellido) as nombre
                          from public.cobros_debito c join public.debitos_automaticos d on d.gimnasio_id = c.gimnasio_id and d.id = c.adhesion_id
                          join public.socios s on s.gimnasio_id = d.gimnasio_id and s.id = d.socio_id
                         where c.gimnasio_id = p_gimnasio_id order by c.creado_en desc limit 10) x), '[]'::jsonb));
end $$;

-- ── Alta de la adhesión (la llama el servidor con la sesión del equipo, después de crear la suscripción en MercadoPago) ──
create or replace function public.registrar_adhesion_debito(p_gimnasio_id uuid, p_socio_id uuid, p_mp_suscripcion_id text, p_monto numeric) returns uuid
language plpgsql security definer set search_path = '' as $$
declare eid uuid; aid uuid;
begin
  eid := privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado']);
  perform privado.exigir_funcion(p_gimnasio_id, 'debito_automatico');
  if not exists (select 1 from public.proveedores_pago pp where pp.gimnasio_id = p_gimnasio_id and pp.proveedor = 'mercadopago' and pp.activo) then
    raise exception 'Conectá MercadoPago primero (Configuración → Cobros)' using errcode = '22023';
  end if;
  if not exists (select 1 from public.socios s where s.id = p_socio_id and s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null) then
    raise exception 'El socio no existe o está dado de baja' using errcode = '22023';
  end if;
  if not exists (select 1 from public.suscripciones x where x.socio_id = p_socio_id and x.baja_en is null) then
    raise exception 'El socio no tiene una membresía activa: sin plan no hay cuota para debitar' using errcode = '22023';
  end if;
  if p_monto is null or p_monto <= 0 then raise exception 'Poné el monto mensual' using errcode = '22023'; end if;
  if coalesce(length(trim(p_mp_suscripcion_id)), 0) < 3 then raise exception 'Falta el ID de la suscripción de MercadoPago' using errcode = '22023'; end if;
  insert into public.debitos_automaticos (gimnasio_id, socio_id, mp_suscripcion_id, monto_acordado, creada_por)
  values (p_gimnasio_id, p_socio_id, trim(p_mp_suscripcion_id), p_monto, eid) returning id into aid;
  return aid;
end $$;

create or replace function public.cancelar_adhesion_debito(p_gimnasio_id uuid, p_adhesion_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado']);
  perform privado.exigir_funcion(p_gimnasio_id, 'debito_automatico');
  update public.debitos_automaticos set estado = 'cancelada', cancelada_en = now() where id = p_adhesion_id and gimnasio_id = p_gimnasio_id and estado <> 'cancelada';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Esa adhesión no existe o ya estaba cancelada' using errcode = '22023'; end if;
end $$;

-- ── El aviso de MercadoPago cambia el estado de la suscripción (solo el servidor) ──
create or replace function public.actualizar_adhesion_debito(p_gimnasio_id uuid, p_mp_suscripcion_id text, p_estado text) returns text
language plpgsql security definer set search_path = '' as $$
declare d public.debitos_automaticos; nuevo text; n int;
begin
  if not privado.funcion_activa(p_gimnasio_id, 'debito_automatico') then return 'funcion_apagada'; end if;
  select * into d from public.debitos_automaticos where gimnasio_id = p_gimnasio_id and mp_suscripcion_id = p_mp_suscripcion_id for update;
  if not found then raise exception 'Adhesión inexistente: %', p_mp_suscripcion_id using errcode = 'P0002'; end if;
  nuevo := case p_estado when 'authorized' then 'activa' when 'paused' then 'pausada' when 'cancelled' then 'cancelada' else null end;
  if nuevo is null then return 'sin_cambios'; end if;
  if d.estado = nuevo then return 'ya_estaba'; end if;
  if d.estado = 'cancelada' then return 'ya_cancelada'; end if;   -- una cancelada no revive: se adhiere de nuevo
  update public.debitos_automaticos
     set estado = nuevo, activada_en = case when nuevo = 'activa' then coalesce(activada_en, now()) else activada_en end,
         cancelada_en = case when nuevo = 'cancelada' then now() end
   where id = d.id and gimnasio_id = d.gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo actualizar la adhesión'; end if;
  return nuevo;
end $$;

-- ── Un cobro mensual avisado por MercadoPago (solo el servidor) ─────
-- Idempotente por el ID de pago de MercadoPago. approved crea la venta de la cuota con un pago "debito_automatico" aprobado y la confirma
-- (así se mueve la cobertura como en cualquier cobro); rejected se anota sin tocar nada; devoluciones y contracargos NO se revierten solos.
create or replace function public.acreditar_cobro_debito(p_gimnasio_id uuid, p_mp_suscripcion_id text, p_mp_pago_id text, p_monto numeric,
                                                          p_estado text, p_fecha timestamptz default null) returns text
language plpgsql security definer set search_path = '' as $$
declare d public.debitos_automaticos; sus public.suscripciones; pl public.planes; sede uuid; vid uuid; pid uuid; previo public.cobros_debito;
begin
  if not privado.funcion_activa(p_gimnasio_id, 'debito_automatico') then return 'funcion_apagada'; end if;
  if coalesce(length(trim(p_mp_pago_id)), 0) < 1 then raise exception 'Falta el ID del pago de MercadoPago'; end if;
  select * into d from public.debitos_automaticos where gimnasio_id = p_gimnasio_id and mp_suscripcion_id = p_mp_suscripcion_id for update;
  if not found then raise exception 'Adhesión inexistente: %', p_mp_suscripcion_id using errcode = 'P0002'; end if;

  select * into previo from public.cobros_debito where gimnasio_id = p_gimnasio_id and mp_pago_id = p_mp_pago_id;
  if found then
    if previo.adhesion_id <> d.id then raise exception 'Ese pago de MercadoPago ya está asociado a otra adhesión'; end if;
    return 'ya_procesado';
  end if;

  if p_estado in ('rejected', 'cancelled') then
    insert into public.cobros_debito (gimnasio_id, adhesion_id, mp_pago_id, monto, estado) values (p_gimnasio_id, d.id, p_mp_pago_id, coalesce(nullif(p_monto, 0), d.monto_acordado), 'rechazado');
    return 'rechazado';
  end if;
  if p_estado in ('refunded', 'charged_back') then
    -- Devolver o contracargar un cobro automático toca plata: lo resuelve una persona (se avisa en la pantalla), nunca solo.
    return 'devolucion_manual';
  end if;
  if p_estado is distinct from 'approved' then return 'sin_cambios'; end if;

  if abs(coalesce(p_monto, 0) - d.monto_acordado) >= 0.01 then
    raise exception 'MercadoPago cobró % y la adhesión era de %: no se acredita', p_monto, d.monto_acordado;
  end if;
  -- Cobró pero la adhesión ya estaba cancelada: no se acredita nada; queda escrito para devolverlo a mano.
  if d.estado = 'cancelada' then
    insert into public.cobros_debito (gimnasio_id, adhesion_id, mp_pago_id, monto, estado) values (p_gimnasio_id, d.id, p_mp_pago_id, p_monto, 'sin_acreditar');
    return 'adhesion_cancelada';
  end if;
  select * into sus from public.suscripciones x where x.socio_id = d.socio_id and x.baja_en is null;
  if not found then
    insert into public.cobros_debito (gimnasio_id, adhesion_id, mp_pago_id, monto, estado) values (p_gimnasio_id, d.id, p_mp_pago_id, p_monto, 'sin_acreditar');
    return 'sin_membresia';
  end if;
  select * into pl from public.planes where id = sus.plan_id;
  select s.id into sede from public.sedes s where s.gimnasio_id = p_gimnasio_id and s.es_principal;

  insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen) values (p_gimnasio_id, sede, d.socio_id, 'pendiente', 'debito') returning id into vid;
  insert into public.venta_items (gimnasio_id, venta_id, tipo, plan_id, suscripcion_id, descripcion, cantidad, precio_unitario)
  values (p_gimnasio_id, vid, 'cuota', pl.id, sus.id, 'Cuota ' || pl.nombre || ' (débito automático)', 1, p_monto);
  insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en, mp_pago_id)
  values (p_gimnasio_id, vid, 'debito_automatico', p_monto, 'aprobado', coalesce(p_fecha, now()), p_mp_pago_id) returning id into pid;
  perform privado.confirmar_venta(vid, now());
  insert into public.cobros_debito (gimnasio_id, adhesion_id, mp_pago_id, monto, estado, pago_id) values (p_gimnasio_id, d.id, p_mp_pago_id, p_monto, 'acreditado', pid);
  if d.estado = 'pendiente' then
    update public.debitos_automaticos set estado = 'activa', activada_en = now() where id = d.id and gimnasio_id = d.gimnasio_id;
  end if;
  return 'acreditado';
end $$;

revoke all on function public.debito_estado(uuid), public.registrar_adhesion_debito(uuid, uuid, text, numeric), public.cancelar_adhesion_debito(uuid, uuid),
  public.actualizar_adhesion_debito(uuid, text, text), public.acreditar_cobro_debito(uuid, text, text, numeric, text, timestamptz) from public, anon, authenticated;
grant execute on function public.debito_estado(uuid), public.registrar_adhesion_debito(uuid, uuid, text, numeric), public.cancelar_adhesion_debito(uuid, uuid) to authenticated, service_role;
grant execute on function public.actualizar_adhesion_debito(uuid, text, text), public.acreditar_cobro_debito(uuid, text, text, numeric, text, timestamptz) to service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.debito_estado(uuid)', 'public.registrar_adhesion_debito(uuid, uuid, text, numeric)', 'public.cancelar_adhesion_debito(uuid, uuid)',
                           'public.actualizar_adhesion_debito(uuid, text, text)', 'public.acreditar_cobro_debito(uuid, text, text, numeric, text, timestamptz)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  foreach f in array array['public.actualizar_adhesion_debito(uuid, text, text)', 'public.acreditar_cobro_debito(uuid, text, text, numeric, text, timestamptz)'] loop
    if has_function_privilege('authenticated', f, 'execute') then raise exception 'Verificación: un usuario con sesión puede ejecutar % (es solo del servidor)', f; end if;
  end loop;
  if not (select relrowsecurity from pg_class where oid = 'public.debitos_automaticos'::regclass) then raise exception 'Verificación: debitos_automaticos sin RLS'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.cobros_debito'::regclass) then raise exception 'Verificación: cobros_debito sin RLS'; end if;
end $$;
