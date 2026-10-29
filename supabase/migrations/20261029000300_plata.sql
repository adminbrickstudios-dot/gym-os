-- ═══════════════════════════════════════════════════════════════════
-- 0003 · Plata del gimnasio: cajas, turnos, ventas, ítems, pagos.
-- Flujo "cobros" (el gimnasio cobra a sus socios). La suscripción de
-- BRIK al gimnasio vive en tablas plataforma_* (otra migración).
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.socios') is null then raise exception 'Guarda: falta la migración 0002'; end if;
end $$;

create table if not exists public.cajas (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  sede_id      uuid not null,
  nombre       text not null,
  activa       boolean not null default true,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, sede_id, nombre),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id)
);
select privado.politicas_estandar('public.cajas', array['dueno','encargado','recepcion'], array['dueno']);

-- Esperado = monto_inicial + pagos en efectivo + ingresos − retiros: se CALCULA.
create table if not exists public.turnos_caja (
  id             uuid primary key default gen_random_uuid(),
  gimnasio_id    uuid not null references public.gimnasios(id),
  caja_id        uuid not null,
  abierto_por    uuid not null,
  abierto_en     timestamptz not null default now(),
  monto_inicial  numeric(12,2) not null check (monto_inicial >= 0),
  cerrado_en     timestamptz,
  cerrado_por    uuid,
  monto_contado  numeric(12,2) check (monto_contado >= 0),
  nota           text,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, caja_id) references public.cajas (gimnasio_id, id),
  foreign key (gimnasio_id, abierto_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, cerrado_por) references public.equipo (gimnasio_id, id),
  check ((cerrado_en is null) = (monto_contado is null) and (cerrado_en is null) = (cerrado_por is null))
);
create unique index if not exists turnos_caja_uno_abierto on public.turnos_caja (caja_id) where cerrado_en is null;
select privado.politicas_estandar('public.turnos_caja', array['dueno','encargado','recepcion'], '{}');

create table if not exists public.movimientos_caja (
  id             uuid primary key default gen_random_uuid(),
  gimnasio_id    uuid not null references public.gimnasios(id),
  turno_caja_id  uuid not null,
  tipo           text not null check (tipo in ('retiro', 'ingreso')),
  monto          numeric(12,2) not null check (monto > 0),
  motivo         text not null check (length(trim(motivo)) > 0),
  creado_en      timestamptz not null default now(),
  creado_por     uuid not null,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, turno_caja_id) references public.turnos_caja (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id)
);
select privado.politicas_estandar('public.movimientos_caja', array['dueno','encargado','recepcion'], '{}');

-- Total de una venta = suma de ítems: se calcula.
create table if not exists public.ventas (
  id              uuid primary key default gen_random_uuid(),
  gimnasio_id     uuid not null references public.gimnasios(id),
  sede_id         uuid not null,
  socio_id        uuid,
  estado          text not null default 'pendiente' check (estado in ('pendiente', 'confirmada', 'anulada')),
  origen          text not null check (origen in ('recepcion', 'app', 'debito', 'web', 'importacion')),
  turno_caja_id   uuid,
  confirmada_en   timestamptz,
  anulada_en      timestamptz,
  anulada_por     uuid,
  anulada_motivo  text,
  creado_en       timestamptz not null default now(),
  creado_por      uuid,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, turno_caja_id) references public.turnos_caja (gimnasio_id, id),
  foreign key (gimnasio_id, anulada_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id),
  check ((estado = 'confirmada') = (confirmada_en is not null) or estado = 'anulada'),
  check ((estado = 'anulada') = (anulada_en is not null)),
  check (anulada_en is null or (anulada_motivo is not null and anulada_por is not null))
);
create index if not exists ventas_socio on public.ventas (gimnasio_id, socio_id, creado_en desc);
select privado.politicas_estandar('public.ventas', array['dueno','encargado','recepcion'], '{}', true);

create table if not exists public.venta_items (
  id                uuid primary key default gen_random_uuid(),
  gimnasio_id       uuid not null references public.gimnasios(id),
  venta_id          uuid not null,
  tipo              text not null check (tipo in ('cuota', 'pase', 'pack', 'producto', 'matricula', 'adicional', 'otro')),
  plan_id           uuid,
  producto_id       uuid,
  descripcion       text not null,
  cantidad          int not null default 1 check (cantidad > 0),
  precio_unitario   numeric(12,2) not null check (precio_unitario >= 0),
  descuento         numeric(12,2) not null default 0 check (descuento >= 0),
  descuento_motivo  text,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, venta_id) references public.ventas (gimnasio_id, id),
  foreign key (gimnasio_id, plan_id) references public.planes (gimnasio_id, id),
  check (descuento <= cantidad * precio_unitario),
  check (descuento = 0 or descuento_motivo is not null),
  check (tipo not in ('cuota', 'pase', 'pack') or plan_id is not null)
);
select privado.politicas_estandar('public.venta_items', array['dueno','encargado','recepcion'], '{}');
drop policy if exists socio_lee on public.venta_items;
create policy socio_lee on public.venta_items for select to authenticated
  using (venta_id in (select v.id from public.ventas v where v.socio_id in (select privado.mis_socios())));

-- Una venta se puede pagar con dos medios. El pago de MercadoPago lo
-- aprueba el webhook, nunca el navegador. La transferencia la aprueba
-- una persona del equipo mirando el comprobante.
create table if not exists public.pagos (
  id                uuid primary key default gen_random_uuid(),
  gimnasio_id       uuid not null references public.gimnasios(id),
  venta_id          uuid not null,
  medio             text not null check (medio in ('efectivo', 'transferencia', 'mercadopago', 'debito', 'credito', 'debito_automatico')),
  monto             numeric(12,2) not null check (monto > 0),
  estado            text not null check (estado in ('pendiente', 'aprobado', 'rechazado', 'anulado')),
  mp_pago_id        text,
  comprobante_path  text,
  turno_caja_id     uuid,
  aprobado_en       timestamptz,
  aprobado_por      uuid,
  creado_en         timestamptz not null default now(),
  creado_por        uuid,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, venta_id) references public.ventas (gimnasio_id, id),
  foreign key (gimnasio_id, turno_caja_id) references public.turnos_caja (gimnasio_id, id),
  foreign key (gimnasio_id, aprobado_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id),
  check (medio <> 'mercadopago' or mp_pago_id is not null or estado = 'pendiente'),
  check (medio <> 'efectivo' or turno_caja_id is not null),
  check ((estado = 'aprobado') = (aprobado_en is not null) or estado = 'anulado')
);
create unique index if not exists pagos_mp_unico on public.pagos (gimnasio_id, mp_pago_id) where mp_pago_id is not null;
select privado.politicas_estandar('public.pagos', array['dueno','encargado','recepcion'], '{}');
drop policy if exists socio_lee on public.pagos;
create policy socio_lee on public.pagos for select to authenticated
  using (venta_id in (select v.id from public.ventas v where v.socio_id in (select privado.mis_socios())));

do $$
declare faltan text;
begin
  select string_agg(c.relname, ', ') into faltan from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname in ('cajas','turnos_caja','movimientos_caja','ventas','venta_items','pagos') and not c.relrowsecurity;
  if faltan is not null then raise exception 'Verificación: tablas sin RLS: %', faltan; end if;
end $$;
