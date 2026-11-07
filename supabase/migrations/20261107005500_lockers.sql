-- VD-55 · Lockers (docs/v2/14-SITUACIONES.md, caso 60).
-- La lista de lockers del gimnasio, alquilados a un socio con vencimiento. El alquiler se COBRA con el flujo de siempre
-- (Vender/Cobrar): la tarifa es un producto con "meses de alquiler" (productos.locker_meses), así el precio lo pone el sistema
-- desde esa tarifa y la plata cae en la caja y en los reportes como cualquier venta. Después se asigna el locker a un
-- alquiler ya cobrado. NO hay otro circuito de cobro.
--
--   lockers              la lista (número, sede, ubicación). No se borran: se dan de baja.
--   alquileres_locker    hecho: qué socio tuvo qué locker, desde y hasta cuándo ([desde, hasta) en medianoche local),
--                        con la línea de la venta que lo pagó (o el motivo de la cortesía, sólo dueño/encargado).
--                        El estado NO se guarda: libre = sin alquiler abierto; ocupado = abierto y vigente; vencido = abierto y pasado.
--   Un locker no se puede asignar a dos socios a la vez: índice único parcial sobre el alquiler abierto.
--   Cada línea de venta paga UN alquiler (índice único sobre venta_item_id): no se cobra una vez y se usa dos.
--   crear_locker · crear_lockers_serie · dar_de_baja_locker · guardar_tarifa_locker · alquilar_locker · renovar_alquiler_locker
--   liberar_locker · lockers_panel · mi_locker · lockers_vencen_semana
--
-- Permisos: asigna, renueva y libera el dueño, el encargado y la recepción (con una venta cobrada); sin cobro (cortesía), sólo el
-- dueño y el encargado, con motivo. Alta/baja de lockers y tarifas: dueño y encargado. Sección "lockers" apagable por gimnasio.
-- No se tocan vender, confirmar_venta ni para_hacer_hoy: lo cobrado se lee de las ventas.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.seccion_activa(uuid, text)') is null then raise exception 'Guarda: falta la migración 5400 (privado.seccion_activa)'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
  if to_regprocedure('privado.medianoche(date, text)') is null or to_regprocedure('privado.dia_local(timestamptz, text)') is null then
    raise exception 'Guarda: faltan privado.medianoche o privado.dia_local';
  end if;
  if to_regclass('public.venta_items') is null or to_regclass('public.productos') is null then raise exception 'Guarda: faltan venta_items o productos'; end if;
end $$;

-- ── La tarifa: un producto que alquila por N meses ──────────────────
alter table public.productos add column if not exists locker_meses int;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'productos_locker_meses_chk') then
    alter table public.productos add constraint productos_locker_meses_chk
      check (locker_meses is null or (locker_meses between 1 and 12 and not recurrente and not controla_stock));
  end if;
end $$;

-- Una tarifa ya vendida no cambia de duración: lo que el socio pagó (meses) es lo que se le da. Para otra duración, otra tarifa.
create or replace function privado.tarifa_locker_congelada() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.locker_meses is not null and new.locker_meses is distinct from old.locker_meses
     and exists (select 1 from public.venta_items it where it.producto_id = old.id) then
    raise exception 'Esa tarifa ya se vendió: no se le cambia la duración. Creá otra tarifa y dejá de ofrecer esta' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function privado.tarifa_locker_congelada() from public;
drop trigger if exists tarifa_locker_congelada on public.productos;
create trigger tarifa_locker_congelada before update of locker_meses on public.productos
  for each row execute function privado.tarifa_locker_congelada();

-- ── Las tablas ──────────────────────────────────────────────────────
create table if not exists public.lockers (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  sede_id      uuid not null,
  numero       text not null check (length(trim(numero)) between 1 and 20),
  ubicacion    text check (ubicacion is null or length(ubicacion) <= 80),
  activo       boolean not null default true,
  creado_por   uuid not null,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, sede_id, numero),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id)
);
alter table public.lockers enable row level security;

create table if not exists public.alquileres_locker (
  id                  uuid primary key default gen_random_uuid(),
  gimnasio_id         uuid not null references public.gimnasios(id),
  locker_id           uuid not null,
  socio_id            uuid not null,
  desde               timestamptz not null,
  hasta               timestamptz not null,
  venta_item_id       uuid,
  cortesia_motivo     text check (cortesia_motivo is null or length(trim(cortesia_motivo)) >= 3),
  creado_por          uuid not null,
  creado_en           timestamptz not null default now(),
  liberado_en         timestamptz,
  liberado_por        uuid,
  liberado_motivo     text check (liberado_motivo is null or length(trim(liberado_motivo)) >= 3),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, locker_id) references public.lockers (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, venta_item_id) references public.venta_items (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, liberado_por) references public.equipo (gimnasio_id, id),
  check (hasta > desde),
  check ((venta_item_id is null) <> (cortesia_motivo is null)),                        -- o lo pagó una venta, o es una cortesía con motivo
  check ((liberado_en is null) = (liberado_por is null) and (liberado_en is null) = (liberado_motivo is null))
);
-- Un locker, un alquiler abierto a la vez (aunque venza, sigue ocupado hasta que se lo libera).
create unique index if not exists alquileres_locker_uno_abierto on public.alquileres_locker (gimnasio_id, locker_id) where liberado_en is null;
-- Una línea de venta paga un solo alquiler.
create unique index if not exists alquileres_locker_item_unico on public.alquileres_locker (gimnasio_id, venta_item_id) where venta_item_id is not null;
create index if not exists alquileres_locker_socio on public.alquileres_locker (gimnasio_id, socio_id, desde desc);
alter table public.alquileres_locker enable row level security;

-- Es un hecho: no se borra, y de un alquiler sólo se completa la liberación (una vez).
create or replace function privado.alquiler_locker_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Los alquileres de lockers no se borran: se liberan' using errcode = 'check_violation';
  end if;
  if to_jsonb(new) - 'liberado_en' - 'liberado_por' - 'liberado_motivo' is distinct from to_jsonb(old) - 'liberado_en' - 'liberado_por' - 'liberado_motivo' then
    raise exception 'De un alquiler de locker sólo se completa la liberación' using errcode = 'check_violation';
  end if;
  if old.liberado_en is not null then
    raise exception 'El locker ya fue liberado: el historial no se cambia' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function privado.alquiler_locker_inmutable() from public;

drop trigger if exists alquiler_locker_inmutable on public.alquileres_locker;
create trigger alquiler_locker_inmutable before update or delete on public.alquileres_locker
  for each row execute function privado.alquiler_locker_inmutable();

-- Directo a las tablas sólo se lee: el equipo del mostrador, y cada socio lo suyo.
drop policy if exists equipo_lee on public.lockers;
create policy equipo_lee on public.lockers for select to authenticated
  using (gimnasio_id in (select privado.mis_gimnasios(array['dueno', 'encargado', 'recepcion'])) or privado.soy_admin_plataforma());
drop policy if exists equipo_lee on public.alquileres_locker;
create policy equipo_lee on public.alquileres_locker for select to authenticated
  using (gimnasio_id in (select privado.mis_gimnasios(array['dueno', 'encargado', 'recepcion'])) or privado.soy_admin_plataforma());
drop policy if exists socio_lee on public.alquileres_locker;
create policy socio_lee on public.alquileres_locker for select to authenticated using (socio_id in (select privado.mis_socios()));
revoke all on table public.lockers, public.alquileres_locker from anon, authenticated;
grant select on table public.lockers, public.alquileres_locker to authenticated;

-- ── Quién puede ─────────────────────────────────────────────────────
create or replace function privado.exigir_lockers(p_gimnasio_id uuid, p_solo_gestion boolean default false) returns public.equipo
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, case when p_solo_gestion then array['dueno', 'encargado'] else array['dueno', 'encargado', 'recepcion'] end);
  if not privado.seccion_activa(p_gimnasio_id, 'lockers') then
    raise exception 'Los lockers están apagados en este gimnasio' using errcode = '42501';
  end if;
  return e;
end $$;
revoke all on function privado.exigir_lockers(uuid, boolean) from public;

-- Los meses que paga una línea de venta de tarifa de locker, si todavía se puede usar para este socio. Si no, dice por qué.
create or replace function privado.meses_pagados_locker(p_gimnasio_id uuid, p_socio_id uuid, p_venta_item_id uuid) returns int
language plpgsql stable set search_path = '' as $$
declare it public.venta_items; v public.ventas; pr public.productos;
begin
  select * into it from public.venta_items where id = p_venta_item_id and gimnasio_id = p_gimnasio_id;
  if not found then raise exception 'Ese cobro no existe' using errcode = '22023'; end if;
  select * into v from public.ventas where id = it.venta_id;
  if v.estado <> 'confirmada' then raise exception 'Ese cobro no está confirmado (o fue anulado)' using errcode = '22023'; end if;
  if v.socio_id is distinct from p_socio_id then raise exception 'Ese cobro es de otro socio' using errcode = '22023'; end if;
  select * into pr from public.productos where id = it.producto_id and gimnasio_id = p_gimnasio_id;
  if not found or pr.locker_meses is null then raise exception 'Ese cobro no es un alquiler de locker' using errcode = '22023'; end if;
  if exists (select 1 from public.alquileres_locker a where a.venta_item_id = it.id) then
    raise exception 'Ese cobro ya se usó para un locker' using errcode = '22023';
  end if;
  return pr.locker_meses * it.cantidad;
end $$;
revoke all on function privado.meses_pagados_locker(uuid, uuid, uuid) from public;

-- ── Lockers: alta y baja ────────────────────────────────────────────
create or replace function public.crear_locker(p_gimnasio_id uuid, p_sede_id uuid, p_numero text, p_ubicacion text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; nuevo uuid; num text := trim(coalesce(p_numero, ''));
begin
  e := privado.exigir_lockers(p_gimnasio_id, true);
  if length(num) < 1 or length(num) > 20 then raise exception 'Poné el número o nombre del locker (hasta 20 letras)' using errcode = '22023'; end if;
  if length(coalesce(p_ubicacion, '')) > 80 then raise exception 'La ubicación es demasiado larga (80 letras)' using errcode = '22023'; end if;
  if not exists (select 1 from public.sedes s where s.id = p_sede_id and s.gimnasio_id = p_gimnasio_id and s.activa) then
    raise exception 'Esa sede no existe o está inactiva' using errcode = '22023';
  end if;
  if exists (select 1 from public.lockers l where l.gimnasio_id = p_gimnasio_id and l.sede_id = p_sede_id and lower(l.numero) = lower(num)) then
    raise exception 'Ya hay un locker "%" en esa sede', num using errcode = '23505';
  end if;
  insert into public.lockers (gimnasio_id, sede_id, numero, ubicacion, creado_por)
  values (p_gimnasio_id, p_sede_id, num, nullif(trim(coalesce(p_ubicacion, '')), ''), e.id) returning id into nuevo;
  return nuevo;
end $$;

-- Una tanda: del 1 al 60 (con un prefijo opcional, "A-"). Los que ya existen se saltean; devuelve cuántos creó.
create or replace function public.crear_lockers_serie(p_gimnasio_id uuid, p_sede_id uuid, p_desde int, p_hasta int, p_prefijo text default null, p_ubicacion text default null) returns int
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; n int; pre text := coalesce(trim(p_prefijo), '');
begin
  e := privado.exigir_lockers(p_gimnasio_id, true);
  if p_desde is null or p_hasta is null or p_desde < 1 or p_hasta < p_desde then raise exception 'Poné desde qué número hasta cuál (el primero tiene que ser menor)' using errcode = '22023'; end if;
  if p_hasta - p_desde + 1 > 300 then raise exception 'Hasta 300 lockers por vez' using errcode = '22023'; end if;
  if length(pre) > 8 then raise exception 'El prefijo es demasiado largo (8 letras)' using errcode = '22023'; end if;
  if length(coalesce(p_ubicacion, '')) > 80 then raise exception 'La ubicación es demasiado larga (80 letras)' using errcode = '22023'; end if;
  if not exists (select 1 from public.sedes s where s.id = p_sede_id and s.gimnasio_id = p_gimnasio_id and s.activa) then
    raise exception 'Esa sede no existe o está inactiva' using errcode = '22023';
  end if;
  insert into public.lockers (gimnasio_id, sede_id, numero, ubicacion, creado_por)
  select p_gimnasio_id, p_sede_id, pre || g::text, nullif(trim(coalesce(p_ubicacion, '')), ''), e.id from generate_series(p_desde, p_hasta) g
  on conflict (gimnasio_id, sede_id, numero) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.dar_de_baja_locker(p_locker_id uuid, p_activo boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.lockers; n int;
begin
  select * into l from public.lockers where id = p_locker_id for update;
  if not found then raise exception 'Sin permiso o locker inexistente' using errcode = '42501'; end if;
  perform privado.exigir_lockers(l.gimnasio_id, true);
  if p_activo is null then raise exception 'Elegí si se da de baja o de alta' using errcode = '22023'; end if;
  if not p_activo and exists (select 1 from public.alquileres_locker a where a.locker_id = l.id and a.liberado_en is null) then
    raise exception 'El locker está alquilado: liberalo antes de darlo de baja' using errcode = '22023';
  end if;
  update public.lockers set activo = p_activo where id = l.id and gimnasio_id = l.gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo actualizar el locker'; end if;
end $$;

-- ── La tarifa: un producto "Locker mensual" con su precio ───────────
-- p_producto_id null = nueva. El producto sale en Vender como cualquier otro (precio, caja, reportes); lo que lo hace tarifa
-- es locker_meses. El precio se cambia acá o en Productos; el cobro siempre usa el precio vigente.
create or replace function public.guardar_tarifa_locker(p_gimnasio_id uuid, p_producto_id uuid, p_nombre text, p_precio numeric, p_meses int, p_activo boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pid uuid; n int; nom text := trim(coalesce(p_nombre, ''));
begin
  perform privado.exigir_lockers(p_gimnasio_id, true);
  if length(nom) < 1 then raise exception 'Poné el nombre de la tarifa (por ejemplo "Locker mensual")' using errcode = '22023'; end if;
  if p_precio is null or p_precio <= 0 then raise exception 'El precio tiene que ser mayor a cero' using errcode = '22023'; end if;
  if p_meses is null or p_meses < 1 or p_meses > 12 then raise exception 'El alquiler es de 1 a 12 meses' using errcode = '22023'; end if;
  if p_producto_id is null then
    insert into public.productos (gimnasio_id, nombre, precio, locker_meses, categoria, orden)
    values (p_gimnasio_id, nom, round(p_precio, 2), p_meses, 'Lockers', coalesce((select max(orden) + 1 from public.productos where gimnasio_id = p_gimnasio_id), 0))
    returning id into pid;
  else
    update public.productos set nombre = nom, precio = round(p_precio, 2), locker_meses = p_meses, activo = coalesce(p_activo, true)
     where id = p_producto_id and gimnasio_id = p_gimnasio_id and locker_meses is not null
    returning id into pid;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Sin permiso o tarifa inexistente' using errcode = '42501'; end if;
  end if;
  return pid;
end $$;

-- ── Asignar ─────────────────────────────────────────────────────────
-- Con un cobro (p_venta_item_id) lo hace cualquiera del mostrador; los meses salen de lo que se cobró. Sin cobro es una cortesía:
-- dueño o encargado, con motivo y de 1 a 12 meses. Empieza hoy (medianoche local) y vence en la medianoche local N meses después.
create or replace function public.alquilar_locker(p_locker_id uuid, p_socio_id uuid, p_venta_item_id uuid default null, p_meses int default null, p_motivo text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare l public.lockers; e public.equipo; zona text; meses int; ini timestamptz; fin timestamptz; nuevo uuid; mot text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  select * into l from public.lockers where id = p_locker_id for update;
  if not found then raise exception 'Sin permiso o locker inexistente' using errcode = '42501'; end if;
  e := privado.exigir_lockers(l.gimnasio_id);
  if not l.activo then raise exception 'Ese locker está dado de baja' using errcode = '22023'; end if;
  if not exists (select 1 from public.socios s where s.id = p_socio_id and s.gimnasio_id = l.gimnasio_id) then
    raise exception 'Ese socio no existe en este gimnasio' using errcode = '22023';
  end if;
  if exists (select 1 from public.alquileres_locker a where a.locker_id = l.id and a.liberado_en is null) then
    raise exception 'El locker % ya está alquilado: liberalo antes de asignarlo', l.numero using errcode = '23505';
  end if;
  if p_venta_item_id is not null then
    if mot is not null or p_meses is not null then raise exception 'Con un cobro, los meses y el precio salen de lo cobrado' using errcode = '22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended('gymos:locker-item:' || p_venta_item_id::text, 0));
    meses := privado.meses_pagados_locker(l.gimnasio_id, p_socio_id, p_venta_item_id);
  else
    if e.rol not in ('dueno', 'encargado') then raise exception 'Asignar un locker sin cobrar lo hace el dueño o el encargado: cobralo primero en Vender' using errcode = '42501'; end if;
    if mot is null or length(mot) < 3 then raise exception 'Asignar un locker sin cobrar necesita un motivo' using errcode = '22023'; end if;
    if p_meses is null or p_meses < 1 or p_meses > 12 then raise exception 'La cortesía es de 1 a 12 meses' using errcode = '22023'; end if;
    meses := p_meses;
  end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = l.gimnasio_id;
  ini := privado.medianoche(privado.dia_local(now(), zona), zona);
  fin := privado.medianoche((privado.dia_local(now(), zona) + make_interval(months => meses))::date, zona);
  insert into public.alquileres_locker (gimnasio_id, locker_id, socio_id, desde, hasta, venta_item_id, cortesia_motivo, creado_por)
  values (l.gimnasio_id, l.id, p_socio_id, ini, fin, p_venta_item_id, case when p_venta_item_id is null then mot end, e.id)
  returning id into nuevo;
  return nuevo;
end $$;

-- Renovar: el mismo socio sigue con su locker. Si todavía no venció, el nuevo período arranca donde termina el actual (no se pierde
-- nada de lo pagado); si ya venció, arranca hoy. El alquiler anterior se cierra "por renovación" y se abre el nuevo, en una sola transacción.
create or replace function public.renovar_alquiler_locker(p_alquiler_id uuid, p_venta_item_id uuid default null, p_meses int default null, p_motivo text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.alquileres_locker; e public.equipo; zona text; meses int; ini timestamptz; fin timestamptz; hoy timestamptz; nuevo uuid; n int;
        mot text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  select * into a from public.alquileres_locker where id = p_alquiler_id for update;
  if not found then raise exception 'Sin permiso o alquiler inexistente' using errcode = '42501'; end if;
  e := privado.exigir_lockers(a.gimnasio_id);
  if a.liberado_en is not null then raise exception 'Ese alquiler ya terminó: asigná el locker de nuevo' using errcode = '22023'; end if;
  if p_venta_item_id is not null then
    if mot is not null or p_meses is not null then raise exception 'Con un cobro, los meses y el precio salen de lo cobrado' using errcode = '22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended('gymos:locker-item:' || p_venta_item_id::text, 0));
    meses := privado.meses_pagados_locker(a.gimnasio_id, a.socio_id, p_venta_item_id);
  else
    if e.rol not in ('dueno', 'encargado') then raise exception 'Renovar sin cobrar lo hace el dueño o el encargado: cobralo primero en Vender' using errcode = '42501'; end if;
    if mot is null or length(mot) < 3 then raise exception 'Renovar sin cobrar necesita un motivo' using errcode = '22023'; end if;
    if p_meses is null or p_meses < 1 or p_meses > 12 then raise exception 'La cortesía es de 1 a 12 meses' using errcode = '22023'; end if;
    meses := p_meses;
  end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = a.gimnasio_id;
  hoy := privado.medianoche(privado.dia_local(now(), zona), zona);
  ini := greatest(a.hasta, hoy);
  fin := privado.medianoche((privado.dia_local(ini, zona) + make_interval(months => meses))::date, zona);
  update public.alquileres_locker set liberado_en = now(), liberado_por = e.id, liberado_motivo = 'Renovación' where id = a.id and liberado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo cerrar el alquiler anterior'; end if;
  insert into public.alquileres_locker (gimnasio_id, locker_id, socio_id, desde, hasta, venta_item_id, cortesia_motivo, creado_por)
  values (a.gimnasio_id, a.locker_id, a.socio_id, ini, fin, p_venta_item_id, case when p_venta_item_id is null then mot end, e.id)
  returning id into nuevo;
  return nuevo;
end $$;

-- Liberar: el socio devolvió la llave, o se lo sacan. Siempre con motivo. No devuelve plata (eso es una devolución en Caja).
create or replace function public.liberar_locker(p_locker_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.lockers; e public.equipo; n int; mot text := trim(coalesce(p_motivo, ''));
begin
  select * into l from public.lockers where id = p_locker_id for update;
  if not found then raise exception 'Sin permiso o locker inexistente' using errcode = '42501'; end if;
  e := privado.exigir_lockers(l.gimnasio_id);
  if length(mot) < 3 then raise exception 'Contá por qué se libera (por ejemplo "devolvió la llave")' using errcode = '22023'; end if;
  if length(mot) > 200 then raise exception 'El motivo es demasiado largo (200 letras)' using errcode = '22023'; end if;
  update public.alquileres_locker set liberado_en = now(), liberado_por = e.id, liberado_motivo = mot where locker_id = l.id and liberado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese locker no está alquilado' using errcode = '22023'; end if;
end $$;

-- ── Lo que ve la pantalla ───────────────────────────────────────────
-- El estado se calcula acá, en un solo lugar: libre / ocupado / vencido. "Por cobrar" = alquileres ya cobrados esperando locker.
create or replace function public.lockers_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; r jsonb; zona text;
begin
  e := privado.exigir_lockers(p_gimnasio_id);
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  select jsonb_build_object(
    'puede_gestionar', e.rol in ('dueno', 'encargado'),
    'sedes', coalesce((select jsonb_agg(jsonb_build_object('sede_id', s.id, 'nombre', s.nombre) order by s.es_principal desc, s.nombre)
                         from public.sedes s where s.gimnasio_id = p_gimnasio_id and s.activa), '[]'::jsonb),
    'tarifas', coalesce((select jsonb_agg(jsonb_build_object('producto_id', p.id, 'nombre', p.nombre, 'precio', p.precio, 'meses', p.locker_meses, 'activo', p.activo)
                                          order by p.activo desc, p.locker_meses, p.nombre)
                           from public.productos p where p.gimnasio_id = p_gimnasio_id and p.locker_meses is not null), '[]'::jsonb),
    'lockers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'locker_id', l.id, 'numero', l.numero, 'ubicacion', l.ubicacion, 'sede_id', l.sede_id, 'sede', s.nombre, 'activo', l.activo,
        'estado', case when a.id is null then 'libre' when a.hasta <= now() then 'vencido' else 'ocupado' end,
        'alquiler', case when a.id is not null then jsonb_build_object(
            'alquiler_id', a.id, 'socio_id', a.socio_id, 'socio', trim(so.nombre || ' ' || so.apellido), 'desde', a.desde, 'hasta', a.hasta,
            'ultimo_dia', privado.dia_local(a.hasta - interval '1 second', zona),
            'dias', (privado.dia_local(a.hasta - interval '1 second', zona) - privado.dia_local(now(), zona)),
            'cortesia', a.venta_item_id is null, 'cortesia_motivo', a.cortesia_motivo) end)
        order by (case when a.id is null then 2 when a.hasta <= now() then 0 else 1 end), s.nombre,
                 (case when l.numero ~ '^[0-9]+$' then lpad(l.numero, 10, '0') else l.numero end))
        from public.lockers l
        join public.sedes s on s.gimnasio_id = l.gimnasio_id and s.id = l.sede_id
        left join public.alquileres_locker a on a.locker_id = l.id and a.liberado_en is null
        left join public.socios so on so.gimnasio_id = a.gimnasio_id and so.id = a.socio_id
       where l.gimnasio_id = p_gimnasio_id), '[]'::jsonb),
    'por_asignar', coalesce((
      select jsonb_agg(jsonb_build_object('venta_item_id', it.id, 'socio_id', v.socio_id, 'socio', trim(so.nombre || ' ' || so.apellido), 'tarifa', pr.nombre,
                                          'meses', pr.locker_meses * it.cantidad, 'cobrado_en', coalesce(v.registrada_en, v.creado_en)) order by v.creado_en desc)
        from public.venta_items it
        join public.ventas v on v.id = it.venta_id and v.gimnasio_id = it.gimnasio_id
        join public.productos pr on pr.id = it.producto_id and pr.gimnasio_id = it.gimnasio_id and pr.locker_meses is not null
        join public.socios so on so.gimnasio_id = v.gimnasio_id and so.id = v.socio_id
       where it.gimnasio_id = p_gimnasio_id and v.estado = 'confirmada' and v.socio_id is not null
         and v.creado_en > now() - interval '120 days'
         and not exists (select 1 from public.alquileres_locker a where a.venta_item_id = it.id)), '[]'::jsonb))
  into r;
  return r;
end $$;

-- Lo del socio: sus lockers (abiertos), para la app. Lo pide él mismo o el equipo.
create or replace function public.mi_locker(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; zona text;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_socio_id not in (select privado.mis_socios()) then perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']); end if;
  if not privado.seccion_activa(g, 'lockers') then return jsonb_build_object('prendido', false, 'lockers', '[]'::jsonb); end if;
  select zona_horaria into zona from public.gimnasios where id = g;
  return jsonb_build_object('prendido', true, 'lockers', coalesce((
    select jsonb_agg(jsonb_build_object('numero', l.numero, 'ubicacion', l.ubicacion, 'sede', s.nombre, 'desde', a.desde, 'hasta', a.hasta,
                                        'ultimo_dia', privado.dia_local(a.hasta - interval '1 second', zona),
                                        'estado', case when a.hasta <= now() then 'vencido' else 'ocupado' end,
                                        'dias', (privado.dia_local(a.hasta - interval '1 second', zona) - privado.dia_local(now(), zona))) order by a.hasta)
      from public.alquileres_locker a
      join public.lockers l on l.gimnasio_id = a.gimnasio_id and l.id = a.locker_id
      join public.sedes s on s.gimnasio_id = l.gimnasio_id and s.id = l.sede_id
     where a.socio_id = p_socio_id and a.liberado_en is null), '[]'::jsonb));
end $$;

-- Los que vencen en los próximos 7 días o ya vencieron y siguen ocupando el locker (para el Inicio). Con la sección apagada: nada.
create or replace function public.lockers_vencen_semana(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if not privado.seccion_activa(p_gimnasio_id, 'lockers') then return '[]'::jsonb; end if;
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'alquiler_id', a.id, 'locker', l.numero, 'socio_id', a.socio_id, 'socio', trim(so.nombre || ' ' || so.apellido), 'hasta', a.hasta,
      'ultimo_dia', privado.dia_local(a.hasta - interval '1 second', zona),
      'dias', (privado.dia_local(a.hasta - interval '1 second', zona) - privado.dia_local(now(), zona)), 'vencido', a.hasta <= now())
      order by a.hasta)
    from public.alquileres_locker a
    join public.lockers l on l.gimnasio_id = a.gimnasio_id and l.id = a.locker_id
    join public.socios so on so.gimnasio_id = a.gimnasio_id and so.id = a.socio_id
   where a.gimnasio_id = p_gimnasio_id and a.liberado_en is null and a.hasta < now() + interval '7 days'), '[]'::jsonb);
end $$;

revoke all on function public.crear_locker(uuid, uuid, text, text), public.crear_lockers_serie(uuid, uuid, int, int, text, text), public.dar_de_baja_locker(uuid, boolean),
  public.guardar_tarifa_locker(uuid, uuid, text, numeric, int, boolean), public.alquilar_locker(uuid, uuid, uuid, int, text),
  public.renovar_alquiler_locker(uuid, uuid, int, text), public.liberar_locker(uuid, text), public.lockers_panel(uuid), public.mi_locker(uuid),
  public.lockers_vencen_semana(uuid) from public, anon, authenticated;
grant execute on function public.crear_locker(uuid, uuid, text, text), public.crear_lockers_serie(uuid, uuid, int, int, text, text), public.dar_de_baja_locker(uuid, boolean),
  public.guardar_tarifa_locker(uuid, uuid, text, numeric, int, boolean), public.alquilar_locker(uuid, uuid, uuid, int, text),
  public.renovar_alquiler_locker(uuid, uuid, int, text), public.liberar_locker(uuid, text), public.lockers_panel(uuid), public.mi_locker(uuid),
  public.lockers_vencen_semana(uuid) to authenticated, service_role;

-- ── La sección "lockers" se puede apagar ────────────────────────────
do $$
declare actuales text[];
begin
  actuales := privado.secciones_validas();
  if not ('lockers' = any (actuales)) then
    execute format('create or replace function privado.secciones_validas() returns text[] language sql immutable set search_path = '''' as $f$ select %L::text[] $f$',
                   array_append(actuales, 'lockers'));
  end if;
  alter table public.configuracion_gimnasio drop constraint if exists configuracion_secciones_validas;
  alter table public.configuracion_gimnasio add constraint configuracion_secciones_validas
    check (secciones_apagadas <@ privado.secciones_validas());
end $$;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text; t text;
begin
  foreach t in array array['public.lockers', 'public.alquileres_locker'] loop
    if not (select relrowsecurity from pg_class where oid = t::regclass) then raise exception 'Verificación: % sin RLS', t; end if;
    if has_table_privilege('authenticated', t, 'insert') or has_table_privilege('authenticated', t, 'update')
       or has_table_privilege('authenticated', t, 'delete') or has_table_privilege('anon', t, 'select') then
      raise exception 'Verificación: permisos de más sobre %', t;
    end if;
  end loop;
  if not exists (select 1 from pg_indexes where indexname = 'alquileres_locker_uno_abierto') then raise exception 'Verificación: falta el índice que impide dos alquileres abiertos'; end if;
  if not exists (select 1 from pg_indexes where indexname = 'alquileres_locker_item_unico') then raise exception 'Verificación: falta el índice de un alquiler por cobro'; end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.alquileres_locker'::regclass and tgname = 'alquiler_locker_inmutable' and not tgisinternal) then
    raise exception 'Verificación: falta el trigger de inmutabilidad de los alquileres';
  end if;
  foreach f in array array['public.crear_locker(uuid, uuid, text, text)', 'public.crear_lockers_serie(uuid, uuid, int, int, text, text)', 'public.dar_de_baja_locker(uuid, boolean)',
    'public.guardar_tarifa_locker(uuid, uuid, text, numeric, int, boolean)', 'public.alquilar_locker(uuid, uuid, uuid, int, text)',
    'public.renovar_alquiler_locker(uuid, uuid, int, text)', 'public.liberar_locker(uuid, text)', 'public.lockers_panel(uuid)', 'public.mi_locker(uuid)',
    'public.lockers_vencen_semana(uuid)', 'privado.exigir_lockers(uuid, boolean)', 'privado.meses_pagados_locker(uuid, uuid, uuid)', 'privado.alquiler_locker_inmutable()', 'privado.tarifa_locker_congelada()'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if not ('lockers' = any (privado.secciones_validas())) then raise exception 'Verificación: la sección lockers no quedó entre las válidas'; end if;
end $$;
