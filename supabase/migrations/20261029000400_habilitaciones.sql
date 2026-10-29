-- ═══════════════════════════════════════════════════════════════════
-- 0004 · Lo que habilita a entrar. Son HECHOS, nunca estados:
--   suscripciones · coberturas · congelamientos · suspensiones
--   pases_diarios · packs · consumos_pack · cierres
-- Un hecho no se pisa ni se borra: se anula con fecha y motivo (trigger).
-- Los días calendario son intervalos [desde, hasta) con límites en la
-- medianoche local del gimnasio: "vence el 14/11" = hasta 15/11 00:00.
-- Las tablas de las que depende el acceso se escriben SOLO por RPC
-- (sin política de escritura): suscripciones, coberturas, congelamientos,
-- cierres, pases, packs y consumos.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.venta_items') is null then raise exception 'Guarda: falta la migración 0003'; end if;
end $$;

-- Impide UPDATE (salvo las columnas que se pasan como argumento) y DELETE.
create or replace function privado.hecho_inmutable() returns trigger
language plpgsql set search_path = '' as $$
declare
  permitidas text[] := tg_argv::text[];
  viejo jsonb; nuevo jsonb; k text;
begin
  if tg_op = 'DELETE' then
    raise exception 'Los registros de % no se borran: se anulan', tg_table_name using errcode = 'check_violation';
  end if;
  viejo := to_jsonb(old); nuevo := to_jsonb(new);
  for k in select jsonb_object_keys(nuevo) loop
    if (viejo -> k) is distinct from (nuevo -> k) and not (k = any (permitidas)) then
      raise exception 'En % solo se puede cambiar: %', tg_table_name, coalesce(array_to_string(permitidas, ', '), 'nada')
        using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end $$;
revoke all on function privado.hecho_inmutable() from public;

-- ── Suscripciones ──────────────────────────────────────────────────
-- "Juan está anotado en el Plan Full desde el 01/03". Una activa por socio.
-- Cambiar de plan = dar de baja esta y crear otra (public.cambiar_plan),
-- nunca un UPDATE de plan_id.
create table if not exists public.suscripciones (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  socio_id     uuid not null,
  plan_id      uuid not null,
  inicio       timestamptz not null,
  baja_en      timestamptz,
  motivo_baja  text,
  creado_en    timestamptz not null default now(),
  creado_por   uuid references auth.users(id),
  unique (gimnasio_id, id),
  unique (gimnasio_id, id, socio_id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, plan_id) references public.planes (gimnasio_id, id),
  check (baja_en is null or baja_en >= inicio),
  check ((baja_en is null) = (motivo_baja is null))
);
create unique index if not exists suscripciones_una_activa on public.suscripciones (gimnasio_id, socio_id) where baja_en is null;
select privado.politicas_estandar('public.suscripciones', array['dueno','encargado','recepcion'], '{}', true);
drop trigger if exists suscripciones_inmutable on public.suscripciones;
create trigger suscripciones_inmutable before update or delete on public.suscripciones
  for each row execute function privado.hecho_inmutable('baja_en', 'motivo_baja');

create or replace function privado.suscripcion_valida() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select p.tipo from public.planes p where p.id = new.plan_id) <> 'membresia' then
    raise exception 'Una suscripción solo puede ser a un plan de tipo membresía';
  end if;
  return new;
end $$;
revoke all on function privado.suscripcion_valida() from public;
drop trigger if exists suscripciones_valida on public.suscripciones;
create trigger suscripciones_valida before insert on public.suscripciones
  for each row execute function privado.suscripcion_valida();

-- ── Cierres del gimnasio ───────────────────────────────────────────
-- "Cerramos del 1 al 15 de enero". Si compensa, cada membresía recibe los
-- días cubiertos que caen en el cierre (cálculo en 0006, por trigger).
create table if not exists public.cierres (
  id              uuid primary key default gen_random_uuid(),
  gimnasio_id     uuid not null references public.gimnasios(id),
  sede_id         uuid,
  desde           timestamptz not null,
  hasta           timestamptz not null,
  motivo          text not null check (length(trim(motivo)) > 0),
  compensa        boolean not null default true,
  anulado_en      timestamptz,
  anulado_motivo  text,
  creado_en       timestamptz not null default now(),
  creado_por      uuid references auth.users(id),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  check (hasta > desde),
  check ((anulado_en is null) = (anulado_motivo is null)),
  -- Compensar un cierre de UNA sede exige decidir qué planes alcanza: todavía no.
  check (sede_id is null or not compensa)
);
select privado.politicas_estandar('public.cierres', null, '{}');
drop trigger if exists cierres_inmutable on public.cierres;
create trigger cierres_inmutable before update or delete on public.cierres
  for each row execute function privado.hecho_inmutable('anulado_en', 'anulado_motivo');

-- ── Congelamientos ─────────────────────────────────────────────────
-- Las categorías no incluyen "lesión": sería un dato de salud.
create table if not exists public.congelamientos (
  id               uuid primary key default gen_random_uuid(),
  gimnasio_id      uuid not null references public.gimnasios(id),
  suscripcion_id   uuid not null,
  socio_id         uuid not null,
  desde            timestamptz not null,
  hasta_prevista   timestamptz not null,
  hasta_real       timestamptz,
  categoria        text not null check (categoria in ('viaje', 'personal', 'economico', 'otro')),
  nota             text,
  anulado_en       timestamptz,
  anulado_motivo   text,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references auth.users(id),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, suscripcion_id, socio_id) references public.suscripciones (gimnasio_id, id, socio_id),
  check (hasta_prevista > desde),
  check (hasta_real is null or (hasta_real > desde and hasta_real <= hasta_prevista)),
  check ((anulado_en is null) = (anulado_motivo is null))
);
create index if not exists congelamientos_suscripcion on public.congelamientos (suscripcion_id, desde);
select privado.politicas_estandar('public.congelamientos', array['dueno','encargado','recepcion'], '{}', true);
drop trigger if exists congelamientos_inmutable on public.congelamientos;
create trigger congelamientos_inmutable before update or delete on public.congelamientos
  for each row execute function privado.hecho_inmutable('hasta_real', 'anulado_en', 'anulado_motivo');

-- ── Coberturas ─────────────────────────────────────────────────────
-- El corazón: "este período quedó cubierto, y por esto".
--   pago, importacion, cortesia, ajuste, traspaso → los pone una persona o una venta
--   compensacion → la calcula privado.recalcular_compensacion (días devueltos
--                  por congelamientos y cierres); nunca se carga a mano
-- ancla_dia: día del mes al que se alinean las renovaciones (31 sigue
-- siendo 31 aunque febrero lo recorte a 28).
create table if not exists public.coberturas (
  id                uuid primary key default gen_random_uuid(),
  gimnasio_id       uuid not null references public.gimnasios(id),
  suscripcion_id    uuid not null,
  socio_id          uuid not null,
  desde             timestamptz not null,
  hasta             timestamptz not null,
  origen            text not null check (origen in ('pago', 'importacion', 'cortesia', 'ajuste', 'traspaso', 'compensacion')),
  ancla_dia         int check (ancla_dia between 1 and 31),
  venta_item_id     uuid,
  importacion_id    uuid,
  motivo            text,
  anulada_en        timestamptz,
  anulada_por       uuid references auth.users(id),
  anulada_motivo    text,
  creado_en         timestamptz not null default now(),
  creado_por        uuid references auth.users(id),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, suscripcion_id, socio_id) references public.suscripciones (gimnasio_id, id, socio_id),
  foreign key (gimnasio_id, venta_item_id) references public.venta_items (gimnasio_id, id),
  check (hasta > desde),
  check (origen <> 'pago' or venta_item_id is not null),
  check (origen not in ('cortesia', 'ajuste', 'traspaso', 'compensacion') or motivo is not null),
  check ((anulada_en is null) = (anulada_motivo is null))
);
create index if not exists coberturas_vigentes on public.coberturas (suscripcion_id, hasta desc) where anulada_en is null;
create index if not exists coberturas_socio on public.coberturas (gimnasio_id, socio_id, hasta desc) where anulada_en is null;
select privado.politicas_estandar('public.coberturas', array['dueno','encargado','recepcion'], '{}', true);
drop trigger if exists coberturas_inmutable on public.coberturas;
create trigger coberturas_inmutable before update or delete on public.coberturas
  for each row execute function privado.hecho_inmutable('anulada_en', 'anulada_por', 'anulada_motivo');

-- ── Suspensiones (bloquean a la PERSONA, todas las vías) ───────────
create table if not exists public.suspensiones (
  id             uuid primary key default gen_random_uuid(),
  gimnasio_id    uuid not null references public.gimnasios(id),
  socio_id       uuid not null,
  desde          timestamptz not null,
  hasta          timestamptz,
  motivo         text not null check (length(trim(motivo)) > 0),
  levantada_en   timestamptz,
  levantada_por  uuid references auth.users(id),
  creado_en      timestamptz not null default now(),
  creado_por     uuid references auth.users(id),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  check (hasta is null or hasta > desde)
);
select privado.politicas_estandar('public.suspensiones', array['dueno','encargado','recepcion'], array['dueno','encargado']);
drop trigger if exists suspensiones_inmutable on public.suspensiones;
create trigger suspensiones_inmutable before update or delete on public.suspensiones
  for each row execute function privado.hecho_inmutable('levantada_en', 'levantada_por');

-- ── Pases diarios ──────────────────────────────────────────────────
create table if not exists public.pases_diarios (
  id                   uuid primary key default gen_random_uuid(),
  gimnasio_id          uuid not null references public.gimnasios(id),
  socio_id             uuid not null,
  plan_id              uuid,
  sede_id              uuid,
  desde                timestamptz not null,
  hasta                timestamptz not null,
  venta_item_id        uuid,
  usado_en_ingreso_id  uuid,
  anulado_en           timestamptz,
  creado_en            timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, plan_id) references public.planes (gimnasio_id, id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  foreign key (gimnasio_id, venta_item_id) references public.venta_items (gimnasio_id, id),
  check (hasta > desde)
);
create index if not exists pases_socio on public.pases_diarios (gimnasio_id, socio_id, desde desc);
select privado.politicas_estandar('public.pases_diarios', array['dueno','encargado','recepcion'], '{}', true);
drop trigger if exists pases_inmutable on public.pases_diarios;
create trigger pases_inmutable before update or delete on public.pases_diarios
  for each row execute function privado.hecho_inmutable('usado_en_ingreso_id', 'anulado_en');

-- ── Packs ──────────────────────────────────────────────────────────
-- Restantes = cantidad − consumos no anulados. Nunca una columna.
create table if not exists public.packs (
  id             uuid primary key default gen_random_uuid(),
  gimnasio_id    uuid not null references public.gimnasios(id),
  socio_id       uuid not null,
  plan_id        uuid not null,
  cantidad       int not null check (cantidad > 0),
  desde          timestamptz not null,
  vence_en       timestamptz,
  venta_item_id  uuid,
  anulado_en     timestamptz,
  creado_en      timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, plan_id) references public.planes (gimnasio_id, id),
  foreign key (gimnasio_id, venta_item_id) references public.venta_items (gimnasio_id, id),
  check (vence_en is null or vence_en > desde)
);
create index if not exists packs_socio on public.packs (gimnasio_id, socio_id, desde desc);
select privado.politicas_estandar('public.packs', array['dueno','encargado','recepcion'], '{}', true);
drop trigger if exists packs_inmutable on public.packs;
create trigger packs_inmutable before update or delete on public.packs
  for each row execute function privado.hecho_inmutable('anulado_en');

create table if not exists public.consumos_pack (
  id             uuid primary key default gen_random_uuid(),
  gimnasio_id    uuid not null references public.gimnasios(id),
  pack_id        uuid not null,
  socio_id       uuid not null,
  momento        timestamptz not null default now(),
  ingreso_id     uuid,
  asistencia_id  uuid,
  anulado_en     timestamptz,
  creado_en      timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, pack_id) references public.packs (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  check (ingreso_id is not null or asistencia_id is not null)
);
create index if not exists consumos_pack_pack on public.consumos_pack (pack_id) where anulado_en is null;
select privado.politicas_estandar('public.consumos_pack', array['dueno','encargado','recepcion'], '{}', true);
drop trigger if exists consumos_inmutable on public.consumos_pack;
create trigger consumos_inmutable before update or delete on public.consumos_pack
  for each row execute function privado.hecho_inmutable('anulado_en');

do $$
declare faltan text;
begin
  select string_agg(c.relname, ', ') into faltan from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname in ('suscripciones','cierres','congelamientos','coberturas','suspensiones','pases_diarios','packs','consumos_pack')
     and not c.relrowsecurity;
  if faltan is not null then raise exception 'Verificación: tablas sin RLS: %', faltan; end if;
end $$;
