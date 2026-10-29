-- ═══════════════════════════════════════════════════════════════════
-- 0002 · Socios, planes y precios.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.gimnasios') is null or to_regprocedure('privado.politicas_estandar(regclass,text[],text[],boolean)') is null then
    raise exception 'Guarda: falta la migración 0001 (base)';
  end if;
end $$;

-- ── Socios ─────────────────────────────────────────────────────────
-- El teléfono NO es único: la madre y sus dos hijos comparten número, y
-- un mismo usuario (el teléfono que hace login) puede ver varios socios.
create table if not exists public.socios (
  id                            uuid primary key default gen_random_uuid(),
  gimnasio_id                   uuid not null references public.gimnasios(id),
  numero                        int not null,
  nombre                        text not null check (length(trim(nombre)) > 0),
  apellido                      text not null default '',
  dni                           text check (dni is null or dni ~ '^[0-9]{6,9}$'),
  telefono                      text check (telefono is null or telefono ~ '^\+[0-9]{8,15}$'),
  email                         text check (email is null or email ~ '^[^@\s]+@[^@\s]+$'),
  fecha_nacimiento              date,
  foto_path                     text,
  usuario_id                    uuid references auth.users(id),
  tutor_socio_id                uuid,
  contacto_emergencia_nombre    text,
  contacto_emergencia_telefono  text,
  origen                        text not null default 'manual' check (origen in ('manual', 'importacion', 'alta_web')),
  importacion_id                uuid,
  dado_de_baja_en               timestamptz,
  motivo_baja                   text check (motivo_baja in ('precio', 'horario', 'mudanza', 'otro_gimnasio', 'sin_tiempo', 'insatisfecho', 'otro')),
  notas                         text,
  creado_en                     timestamptz not null default now(),
  creado_por                    uuid references auth.users(id),
  unique (gimnasio_id, id),
  unique (gimnasio_id, numero),
  foreign key (gimnasio_id, tutor_socio_id) references public.socios (gimnasio_id, id),
  check (tutor_socio_id is null or tutor_socio_id <> id),
  check ((dado_de_baja_en is null) or (motivo_baja is not null))
);
create unique index if not exists socios_dni_por_gimnasio on public.socios (gimnasio_id, dni) where dni is not null;
create index if not exists socios_telefono on public.socios (gimnasio_id, telefono) where telefono is not null;
create index if not exists socios_usuario on public.socios (usuario_id) where usuario_id is not null;
create index if not exists socios_busqueda on public.socios
  using gin (privado.sin_acentos(nombre || ' ' || apellido) extensions.gin_trgm_ops);
alter table public.socios enable row level security;

-- Número de socio correlativo por gimnasio, sin carreras entre dos altas.
create or replace function privado.numerar_socio() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.numero is null then
    update public.configuracion_gimnasio
       set ultimo_numero_socio = ultimo_numero_socio + 1
     where gimnasio_id = new.gimnasio_id
     returning ultimo_numero_socio into new.numero;
    if new.numero is null then
      raise exception 'El gimnasio % no tiene configuración', new.gimnasio_id;
    end if;
  end if;
  return new;
end $$;
revoke all on function privado.numerar_socio() from public;
drop trigger if exists socios_numerar on public.socios;
create trigger socios_numerar before insert on public.socios
  for each row execute function privado.numerar_socio();

-- Vincular un login a un socio le da acceso a sus pagos y coberturas:
-- lo hace el servidor (flujo de login por teléfono) o el dueño, nunca la
-- recepción con un UPDATE directo.
create or replace function privado.proteger_usuario_socio() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.usuario_id is not null
     and (tg_op = 'INSERT' or new.usuario_id is distinct from old.usuario_id)
     and current_user = 'authenticated'
     and not (new.gimnasio_id in (select privado.mis_gimnasios(array['dueno']))) then
    raise exception 'Solo el dueño (o el login del socio) vincula una cuenta a un socio' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function privado.proteger_usuario_socio() from public;
drop trigger if exists socios_proteger_usuario on public.socios;
create trigger socios_proteger_usuario before insert or update of usuario_id on public.socios
  for each row execute function privado.proteger_usuario_socio();

-- Ahora sí: los socios vinculados a mi usuario (el login del socio).
create or replace function privado.mis_socios() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select s.id from public.socios s where s.usuario_id = auth.uid()
$$;
revoke all on function privado.mis_socios() from public;
grant execute on function privado.mis_socios() to authenticated, service_role;

-- El profe no lee la tabla de socios entera (tiene teléfonos, DNI):
-- sus alumnos le llegan por una vista o RPC en la sección de clases.
select privado.politicas_estandar('public.socios', array['dueno','encargado','recepcion'], array['dueno','encargado','recepcion']);
drop policy if exists socio_lee on public.socios;
create policy socio_lee on public.socios for select to authenticated using (id in (select privado.mis_socios()));

-- ── Planes ─────────────────────────────────────────────────────────
-- Una tabla con check por tipo, no tres tablas: la pantalla es una sola.
create table if not exists public.planes (
  id                   uuid primary key default gen_random_uuid(),
  gimnasio_id          uuid not null references public.gimnasios(id),
  tipo                 text not null check (tipo in ('membresia', 'pase_diario', 'pack')),
  nombre               text not null check (length(trim(nombre)) > 0),
  descripcion          text,
  activo               boolean not null default true,
  orden                int not null default 0,
  todas_las_sedes      boolean not null default true,
  -- membresía
  duracion_meses       int check (duracion_meses between 1 and 24),
  renovacion           text check (renovacion in ('continua', 'desde_pago', 'dia_fijo')),
  dia_fijo             int check (dia_fijo between 1 and 28),
  reinicio_tras_dias   int check (reinicio_tras_dias > 0),
  tolerancia_dias      int check (tolerancia_dias between 0 and 60),
  max_ingresos_semana  int check (max_ingresos_semana between 1 and 7),
  hora_desde           time,
  hora_hasta           time,
  -- pack
  cantidad_clases      int check (cantidad_clases > 0),
  validez_dias         int check (validez_dias > 0),
  consume_en           text check (consume_en in ('ingreso', 'asistencia')),
  creado_en            timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, nombre),
  check (tipo <> 'membresia' or (duracion_meses is not null and renovacion is not null)),
  check (renovacion is distinct from 'dia_fijo' or dia_fijo is not null),
  check (tipo <> 'pack' or (cantidad_clases is not null and consume_en is not null)),
  check ((hora_desde is null) = (hora_hasta is null)),
  check (hora_desde is null or hora_desde < hora_hasta)
);
select privado.politicas_estandar('public.planes', null, array['dueno','encargado']);
-- El socio ve los planes de su gimnasio (para cambiar de plan o pagar).
drop policy if exists socio_lee on public.planes;
create policy socio_lee on public.planes for select to authenticated
  using (gimnasio_id in (select s.gimnasio_id from public.socios s where s.id in (select privado.mis_socios())));

create table if not exists public.plan_sedes (
  gimnasio_id  uuid not null references public.gimnasios(id),
  plan_id      uuid not null,
  sede_id      uuid not null,
  primary key (gimnasio_id, plan_id, sede_id),
  foreign key (gimnasio_id, plan_id) references public.planes (gimnasio_id, id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id)
);
select privado.politicas_estandar('public.plan_sedes', null, array['dueno','encargado']);

-- ── Precios ────────────────────────────────────────────────────────
-- Un precio tiene fecha de vigencia (aumentos programados) y puede
-- depender del medio de pago y del día del mes en que se paga.
-- Precio base = medio_pago null y pago_hasta_dia null.
create table if not exists public.precios_plan (
  id              uuid primary key default gen_random_uuid(),
  gimnasio_id     uuid not null references public.gimnasios(id),
  plan_id         uuid not null,
  sede_id         uuid,
  monto           numeric(12,2) not null check (monto >= 0),
  vigente_desde   timestamptz not null,
  medio_pago      text check (medio_pago in ('efectivo', 'transferencia', 'mercadopago', 'debito', 'credito')),
  pago_hasta_dia  int check (pago_hasta_dia between 1 and 31),
  creado_en       timestamptz not null default now(),
  creado_por      uuid references auth.users(id),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, plan_id) references public.planes (gimnasio_id, id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id)
);
create unique index if not exists precios_plan_unico on public.precios_plan
  (gimnasio_id, plan_id, vigente_desde, coalesce(medio_pago, ''), coalesce(pago_hasta_dia, 0),
   coalesce(sede_id, '00000000-0000-0000-0000-000000000000'::uuid));
select privado.politicas_estandar('public.precios_plan', null, array['dueno','encargado']);
drop policy if exists socio_lee on public.precios_plan;
create policy socio_lee on public.precios_plan for select to authenticated
  using (gimnasio_id in (select s.gimnasio_id from public.socios s where s.id in (select privado.mis_socios())));

-- ── Verificación final ─────────────────────────────────────────────
do $$
declare faltan text;
begin
  select string_agg(c.relname, ', ') into faltan from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname in ('socios','planes','plan_sedes','precios_plan') and not c.relrowsecurity;
  if faltan is not null then raise exception 'Verificación: tablas sin RLS: %', faltan; end if;
end $$;
