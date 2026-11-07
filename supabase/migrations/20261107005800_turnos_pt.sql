-- VD-58 · Turnos con personal trainer (PT): sesiones 1 a 1 con un pack de N sesiones.
-- El gimnasio vende packs de sesiones (con Vender, como cualquier producto), el PT (o el dueño) carga las franjas en que atiende,
-- el socio reserva una desde la app (o la recepción por él) y cada reserva gasta UNA sesión del pack. Cancelar con la antelación
-- que fija el gimnasio devuelve la sesión; la sesión dada queda como hecho (dictada) y suma a lo que se le debe al PT.
--
--   DECISIÓN: el pack de PT NO es un "plan tipo pack" de clases. Los packs de clases habilitan la entrada y las reservas de clases
--   (privado.via_pack, habilitacion_clase): un pack de PT ahí dejaría entrar al gimnasio a quien sólo compró sesiones. Por eso el
--   pack de PT es un producto (productos.pt_sesiones) que se cobra con Vender/Cobrar y tiene su propio saldo, calculado de las ventas.
--
--   productos.pt_sesiones / pt_validez_dias / pt_entrenador_id   el pack: cuántas sesiones, cuánto dura y de qué PT (vacío = cualquiera)
--   configuracion_gimnasio.pt_cancelar_horas                      con cuántas horas de antelación se puede cancelar (por defecto 12)
--   pt_franjas      las franjas de atención de cada PT (un PT no se pisa consigo mismo)
--   sesiones_pt     hecho: la reserva de un socio en una franja, pagada con UN pack (venta_item_id)
--                   estados: reservada → dictada | ausente (consumen la sesión) | cancelada (la devuelve)
--   El saldo NO se guarda: sesiones del pack - sesiones reservadas, dictadas o ausentes. Anular la venta lo anula solo.
--   Una franja no se reserva dos veces: índice único parcial sobre la sesión no cancelada (más el candado de la franja).
--   privado.saldo_pt · privado.reservar_sesion_pt
--   guardar_pack_pt · guardar_config_pt · cargar_franjas_pt · quitar_franja_pt · reservar_sesion_pt · cancelar_sesion_pt · marcar_sesion_pt
--   agenda_pt · pt_socio · sesiones_dictadas_pt
--
-- Permisos: carga franjas cada PT (las suyas) y el dueño/encargado (las de cualquiera); reserva el socio (con su pack vigente) o el
-- dueño/encargado/recepción por él; marca dictada/ausente el PT de esa sesión, el encargado y el dueño; los packs y la antelación los
-- fija el dueño/encargado. Sección "pt" apagable por gimnasio.
-- Liquidación de profes (VD-52): no se toca. sesiones_dictadas_pt entrega las sesiones dadas por PT y período para sumarlas ahí.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.seccion_activa(uuid, text)') is null then raise exception 'Guarda: falta la migración 5400 (privado.seccion_activa)'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
  if to_regprocedure('privado.medianoche(date, text)') is null or to_regprocedure('privado.dia_local(timestamptz, text)') is null then
    raise exception 'Guarda: faltan privado.medianoche o privado.dia_local';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'productos' and column_name = 'locker_meses') then
    raise exception 'Guarda: falta la migración 5500 (productos.locker_meses)';
  end if;
end $$;

-- ── El pack: un producto con sesiones ───────────────────────────────
alter table public.productos add column if not exists pt_sesiones int;
alter table public.productos add column if not exists pt_validez_dias int;
alter table public.productos add column if not exists pt_entrenador_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'productos_pt_chk') then
    alter table public.productos add constraint productos_pt_chk check (
      (pt_sesiones is null and pt_validez_dias is null and pt_entrenador_id is null)
      or (pt_sesiones between 1 and 100 and not recurrente and not controla_stock and locker_meses is null
          and (pt_validez_dias is null or pt_validez_dias between 1 and 730)));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'productos_pt_entrenador_fk') then
    alter table public.productos add constraint productos_pt_entrenador_fk foreign key (gimnasio_id, pt_entrenador_id) references public.equipo (gimnasio_id, id);
  end if;
end $$;

-- Un pack ya vendido no cambia de sesiones, vigencia ni de PT: lo que el socio pagó es lo que se le da.
create or replace function privado.pack_pt_congelado() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.pt_sesiones is distinct from old.pt_sesiones or new.pt_validez_dias is distinct from old.pt_validez_dias
      or new.pt_entrenador_id is distinct from old.pt_entrenador_id)
     and exists (select 1 from public.venta_items it where it.producto_id = old.id) then
    raise exception 'Ese pack ya se vendió: no se le cambian las sesiones, la vigencia ni el PT. Creá otro pack y dejá de ofrecer este' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function privado.pack_pt_congelado() from public;
drop trigger if exists pack_pt_congelado on public.productos;
create trigger pack_pt_congelado before update of pt_sesiones, pt_validez_dias, pt_entrenador_id on public.productos
  for each row execute function privado.pack_pt_congelado();

alter table public.configuracion_gimnasio add column if not exists pt_cancelar_horas int not null default 12;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_pt_cancelar_chk') then
    alter table public.configuracion_gimnasio add constraint configuracion_pt_cancelar_chk check (pt_cancelar_horas between 0 and 168);
  end if;
end $$;

-- ── Franjas y sesiones ──────────────────────────────────────────────
create table if not exists public.pt_franjas (
  id               uuid primary key default gen_random_uuid(),
  gimnasio_id      uuid not null references public.gimnasios(id),
  sede_id          uuid not null,
  entrenador_id    uuid not null,
  inicio           timestamptz not null,
  fin              timestamptz not null,
  creada_por       uuid not null,
  creada_en        timestamptz not null default now(),
  cancelada_en     timestamptz,
  cancelada_por    uuid,
  cancelada_motivo text check (cancelada_motivo is null or length(cancelada_motivo) <= 200),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  foreign key (gimnasio_id, entrenador_id) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, creada_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, cancelada_por) references public.equipo (gimnasio_id, id),
  check (fin > inicio and fin <= inicio + interval '4 hours'),
  check ((cancelada_en is null) = (cancelada_por is null))
);
create index if not exists pt_franjas_agenda on public.pt_franjas (gimnasio_id, entrenador_id, inicio) where cancelada_en is null;
create index if not exists pt_franjas_inicio on public.pt_franjas (gimnasio_id, inicio) where cancelada_en is null;
alter table public.pt_franjas enable row level security;

-- Un PT no atiende dos cosas a la vez. El candado por PT hace que dos cargas simultáneas se turnen.
create or replace function privado.pt_franja_no_pisa() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('gymos:pt-franja:' || new.entrenador_id::text, 0));
  if exists (select 1 from public.pt_franjas f where f.entrenador_id = new.entrenador_id and f.cancelada_en is null
                and tstzrange(f.inicio, f.fin) && tstzrange(new.inicio, new.fin)) then
    raise exception 'Ese horario se pisa con otro del mismo PT' using errcode = '23P01';
  end if;
  return new;
end $$;
revoke all on function privado.pt_franja_no_pisa() from public;
drop trigger if exists pt_franja_no_pisa on public.pt_franjas;
create trigger pt_franja_no_pisa before insert on public.pt_franjas for each row execute function privado.pt_franja_no_pisa();

-- La franja no se borra ni se mueve: se cancela (una sola vez).
create or replace function privado.pt_franja_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Las franjas de PT no se borran: se cancelan' using errcode = 'check_violation'; end if;
  if to_jsonb(new) - 'cancelada_en' - 'cancelada_por' - 'cancelada_motivo' is distinct from to_jsonb(old) - 'cancelada_en' - 'cancelada_por' - 'cancelada_motivo' then
    raise exception 'De una franja de PT sólo se completa la cancelación' using errcode = 'check_violation';
  end if;
  if old.cancelada_en is not null then raise exception 'La franja ya está cancelada' using errcode = 'check_violation'; end if;
  return new;
end $$;
revoke all on function privado.pt_franja_inmutable() from public;
drop trigger if exists pt_franja_inmutable on public.pt_franjas;
create trigger pt_franja_inmutable before update or delete on public.pt_franjas for each row execute function privado.pt_franja_inmutable();

create table if not exists public.sesiones_pt (
  id                uuid primary key default gen_random_uuid(),
  gimnasio_id       uuid not null references public.gimnasios(id),
  franja_id         uuid not null,
  socio_id          uuid not null,
  venta_item_id     uuid not null,
  estado            text not null default 'reservada' check (estado in ('reservada', 'dictada', 'ausente', 'cancelada')),
  reservada_por     uuid,
  creada_en         timestamptz not null default now(),
  marcada_en        timestamptz,
  marcada_por       uuid,
  cancelada_en      timestamptz,
  cancelada_por     uuid,
  cancelada_origen  text check (cancelada_origen in ('socio', 'equipo', 'franja')),
  cancelada_motivo  text check (cancelada_motivo is null or length(cancelada_motivo) <= 200),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, franja_id) references public.pt_franjas (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, venta_item_id) references public.venta_items (gimnasio_id, id),
  foreign key (gimnasio_id, reservada_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, marcada_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, cancelada_por) references public.equipo (gimnasio_id, id),
  check ((estado in ('dictada', 'ausente')) = (marcada_en is not null and marcada_por is not null)),
  check ((estado = 'cancelada') = (cancelada_en is not null and cancelada_origen is not null))
);
-- Una franja, una sesión viva (reservada, dictada o ausente). Cancelada deja libre la franja.
create unique index if not exists sesiones_pt_una_por_franja on public.sesiones_pt (gimnasio_id, franja_id) where estado <> 'cancelada';
create index if not exists sesiones_pt_socio on public.sesiones_pt (gimnasio_id, socio_id, creada_en desc);
create index if not exists sesiones_pt_pack on public.sesiones_pt (venta_item_id) where estado <> 'cancelada';
alter table public.sesiones_pt enable row level security;

-- Hecho: no se borra; sólo pasa de "reservada" a un estado final, y ese estado no vuelve atrás.
create or replace function privado.sesion_pt_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Las sesiones de PT no se borran: se cancelan' using errcode = 'check_violation'; end if;
  if new.id is distinct from old.id or new.gimnasio_id is distinct from old.gimnasio_id or new.franja_id is distinct from old.franja_id
     or new.socio_id is distinct from old.socio_id or new.venta_item_id is distinct from old.venta_item_id
     or new.creada_en is distinct from old.creada_en or new.reservada_por is distinct from old.reservada_por then
    raise exception 'De una sesión de PT no se cambia la franja, el socio ni el pack' using errcode = 'check_violation';
  end if;
  if old.estado <> 'reservada' then raise exception 'La sesión ya está cerrada (%): el historial no se cambia', old.estado using errcode = 'check_violation'; end if;
  return new;
end $$;
revoke all on function privado.sesion_pt_inmutable() from public;
drop trigger if exists sesion_pt_inmutable on public.sesiones_pt;
create trigger sesion_pt_inmutable before update or delete on public.sesiones_pt for each row execute function privado.sesion_pt_inmutable();

-- Directo a las tablas sólo se lee. Las sesiones (con nombre de socio): mostrador y cada socio lo suyo; las franjas: todo el equipo.
drop policy if exists equipo_lee on public.pt_franjas;
create policy equipo_lee on public.pt_franjas for select to authenticated
  using (gimnasio_id in (select privado.mis_gimnasios(array['dueno', 'encargado', 'recepcion', 'profe'])) or privado.soy_admin_plataforma());
drop policy if exists equipo_lee on public.sesiones_pt;
create policy equipo_lee on public.sesiones_pt for select to authenticated
  using (gimnasio_id in (select privado.mis_gimnasios(array['dueno', 'encargado', 'recepcion'])) or privado.soy_admin_plataforma());
drop policy if exists socio_lee on public.sesiones_pt;
create policy socio_lee on public.sesiones_pt for select to authenticated using (socio_id in (select privado.mis_socios()));
revoke all on table public.pt_franjas, public.sesiones_pt from anon, authenticated;
grant select on table public.pt_franjas, public.sesiones_pt to authenticated;

-- ── Quién puede ─────────────────────────────────────────────────────
create or replace function privado.exigir_pt(p_gimnasio_id uuid, p_roles text[] default array['dueno', 'encargado', 'recepcion', 'profe']) returns public.equipo
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, p_roles);
  if not privado.seccion_activa(p_gimnasio_id, 'pt') then
    raise exception 'Los turnos con personal trainer están apagados en este gimnasio' using errcode = '42501';
  end if;
  return e;
end $$;
revoke all on function privado.exigir_pt(uuid, text[]) from public;

-- Los packs de PT de un socio con lo que lleva usado. Salen de las ventas confirmadas: nada se guarda.
create or replace function privado.saldo_pt(p_socio_id uuid)
returns table (venta_item_id uuid, producto_id uuid, nombre text, entrenador_id uuid, total int, usadas int, restantes int, comprado_en timestamptz, vence_en timestamptz)
language sql stable set search_path = '' as $$
  select x.id, x.producto_id, x.nombre, x.pt_entrenador_id, x.total, x.usadas, x.total - x.usadas, x.comprado, x.vence
    from (
      select it.id, pr.id as producto_id, pr.nombre, pr.pt_entrenador_id, (it.cantidad * pr.pt_sesiones)::int as total,
             (select count(*)::int from public.sesiones_pt s where s.venta_item_id = it.id and s.estado <> 'cancelada') as usadas,
             coalesce(v.confirmada_en, v.creado_en) as comprado,
             case when pr.pt_validez_dias is null then null
                  else privado.medianoche(privado.dia_local(coalesce(v.confirmada_en, v.creado_en), g.zona_horaria) + pr.pt_validez_dias, g.zona_horaria) end as vence
        from public.venta_items it
        join public.ventas v on v.id = it.venta_id and v.gimnasio_id = it.gimnasio_id
        join public.productos pr on pr.id = it.producto_id and pr.gimnasio_id = it.gimnasio_id and pr.pt_sesiones is not null
        join public.gimnasios g on g.id = v.gimnasio_id
       where v.socio_id = p_socio_id and v.estado = 'confirmada'
    ) x
$$;
revoke all on function privado.saldo_pt(uuid) from public;

-- ── Reservar ────────────────────────────────────────────────────────
-- El núcleo: lo llaman el socio (p_equipo_id null) y el mostrador por él. La franja se bloquea: dos reservas a la vez se turnan y la
-- segunda ve la primera. El saldo del socio se serializa con su propio candado: no se gasta dos veces la misma sesión.
create or replace function privado.reservar_sesion_pt(p_socio_id uuid, p_franja_id uuid, p_equipo_id uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare so public.socios; f public.pt_franjas; sp record; sid uuid; hay_packs boolean;
begin
  select * into f from public.pt_franjas where id = p_franja_id for update;
  if not found then raise exception 'Ese horario no existe' using errcode = '22023'; end if;
  select * into so from public.socios where id = p_socio_id and gimnasio_id = f.gimnasio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if f.cancelada_en is not null then raise exception 'Ese horario ya no está disponible' using errcode = '22023'; end if;
  if f.inicio <= now() then raise exception 'Ese horario ya pasó' using errcode = '22023'; end if;
  if exists (select 1 from public.sesiones_pt s where s.franja_id = f.id and s.estado <> 'cancelada') then
    raise exception 'Ese horario ya está reservado' using errcode = '23505';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('gymos:pt-socio:' || so.id::text, 0));
  if exists (select 1 from public.sesiones_pt s join public.pt_franjas f2 on f2.id = s.franja_id
              where s.socio_id = so.id and s.estado = 'reservada' and tstzrange(f2.inicio, f2.fin) && tstzrange(f.inicio, f.fin)) then
    raise exception 'Ya tiene otra sesión reservada a esa hora' using errcode = '23505';
  end if;
  select * into sp from privado.saldo_pt(so.id) x
   where x.restantes > 0 and (x.vence_en is null or x.vence_en > f.inicio) and (x.entrenador_id is null or x.entrenador_id = f.entrenador_id)
   order by x.vence_en nulls last, x.comprado_en limit 1;
  if not found then
    select exists (select 1 from privado.saldo_pt(so.id)) into hay_packs;
    raise exception '%', case when not hay_packs then 'No tiene un pack de sesiones: hay que cobrarle uno primero'
      else 'No le quedan sesiones vigentes para este PT en esa fecha (se agotaron, vencieron o son de otro PT)' end using errcode = '22023';
  end if;
  insert into public.sesiones_pt (gimnasio_id, franja_id, socio_id, venta_item_id, reservada_por)
  values (f.gimnasio_id, f.id, so.id, sp.venta_item_id, p_equipo_id) returning id into sid;
  return jsonb_build_object('sesion_id', sid, 'restantes', sp.restantes - 1, 'pack', sp.nombre);
end $$;
revoke all on function privado.reservar_sesion_pt(uuid, uuid, uuid) from public;

create or replace function public.reservar_sesion_pt(p_socio_id uuid, p_franja_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; e public.equipo;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_socio_id in (select privado.mis_socios()) then
    if not privado.seccion_activa(g, 'pt') then raise exception 'Los turnos con personal trainer están apagados en este gimnasio' using errcode = '42501'; end if;
    return privado.reservar_sesion_pt(p_socio_id, p_franja_id, null);
  end if;
  e := privado.exigir_pt(g, array['dueno', 'encargado', 'recepcion']);
  return privado.reservar_sesion_pt(p_socio_id, p_franja_id, e.id);
end $$;

-- ── Cancelar ────────────────────────────────────────────────────────
-- Con la antelación del gimnasio, la sesión se devuelve. Tarde: el socio no puede (la sesión se pierde salvo que el encargado o el dueño
-- la devuelva); la recepción tampoco. El PT de esa sesión, el encargado y el dueño cancelan siempre (si falla el PT, no se le cobra al socio).
create or replace function public.cancelar_sesion_pt(p_sesion_id uuid, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sesiones_pt; f public.pt_franjas; horas int; tarde boolean; e public.equipo; mot text := nullif(trim(coalesce(p_motivo, '')), ''); n int; origen text; quien uuid;
begin
  select * into s from public.sesiones_pt where id = p_sesion_id for update;
  if not found then raise exception 'Sin permiso o sesión inexistente' using errcode = '42501'; end if;
  select * into f from public.pt_franjas where id = s.franja_id;
  select pt_cancelar_horas into horas from public.configuracion_gimnasio where gimnasio_id = s.gimnasio_id;
  horas := coalesce(horas, 12);
  if s.socio_id in (select privado.mis_socios()) then
    if not privado.seccion_activa(s.gimnasio_id, 'pt') then raise exception 'Los turnos con personal trainer están apagados en este gimnasio' using errcode = '42501'; end if;
    origen := 'socio'; quien := null;
  else
    e := privado.exigir_pt(s.gimnasio_id);
    origen := 'equipo'; quien := e.id;
  end if;
  if s.estado <> 'reservada' then raise exception 'Esa sesión ya está %: no se puede cancelar', s.estado using errcode = '22023'; end if;
  if f.inicio <= now() then raise exception 'La sesión ya empezó: se marca como dada o como ausente' using errcode = '22023'; end if;
  tarde := now() > f.inicio - make_interval(hours => horas);
  if origen = 'socio' then
    if tarde then raise exception 'Ya pasó el plazo para cancelar (hasta % horas antes). Hablá con el gimnasio', horas using errcode = '22023'; end if;
  elsif e.rol in ('dueno', 'encargado') or e.id = f.entrenador_id then
    if tarde and e.id <> f.entrenador_id and (mot is null or length(mot) < 3) then
      raise exception 'Cancelar fuera de plazo devuelve la sesión: contá el motivo' using errcode = '22023';
    end if;
  elsif e.rol = 'recepcion' then
    if tarde then raise exception 'Ya pasó el plazo para cancelar: lo decide el encargado o el dueño' using errcode = '42501'; end if;
  else
    raise exception 'Sin permiso para cancelar esta sesión' using errcode = '42501';
  end if;
  update public.sesiones_pt set estado = 'cancelada', cancelada_en = now(), cancelada_por = quien, cancelada_origen = origen, cancelada_motivo = mot
   where id = s.id and estado = 'reservada';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo cancelar la sesión'; end if;
end $$;

-- ── Dada o ausente ──────────────────────────────────────────────────
-- La marca el PT de esa franja, el encargado o el dueño, y sólo cuando la franja ya empezó. "Dictada" y "ausente" gastan la sesión.
create or replace function public.marcar_sesion_pt(p_sesion_id uuid, p_resultado text) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sesiones_pt; f public.pt_franjas; e public.equipo; n int;
begin
  if p_resultado not in ('dictada', 'ausente') then raise exception 'Marcala como dada o como ausente' using errcode = '22023'; end if;
  select * into s from public.sesiones_pt where id = p_sesion_id for update;
  if not found then raise exception 'Sin permiso o sesión inexistente' using errcode = '42501'; end if;
  e := privado.exigir_pt(s.gimnasio_id, array['dueno', 'encargado', 'profe']);
  select * into f from public.pt_franjas where id = s.franja_id;
  if e.rol = 'profe' and e.id <> f.entrenador_id then raise exception 'Sólo el PT de esa sesión la marca' using errcode = '42501'; end if;
  if s.estado <> 'reservada' then raise exception 'Esa sesión ya está %', s.estado using errcode = '22023'; end if;
  if f.inicio > now() then raise exception 'La sesión todavía no empezó' using errcode = '22023'; end if;
  update public.sesiones_pt set estado = p_resultado, marcada_en = now(), marcada_por = e.id where id = s.id and estado = 'reservada';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo marcar la sesión'; end if;
end $$;

-- ── La agenda: cargar y quitar franjas ──────────────────────────────
-- Una franja y, si p_repetir_semanas > 1, la misma hora (de pared, en el gimnasio) cada semana siguiente.
create or replace function public.cargar_franjas_pt(p_gimnasio_id uuid, p_sede_id uuid, p_entrenador_id uuid, p_inicio_local text, p_minutos int, p_repetir_semanas int default 1) returns int
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; zona text; i int; ini timestamptz; local timestamp;
begin
  e := privado.exigir_pt(p_gimnasio_id, array['dueno', 'encargado', 'profe']);
  if e.rol = 'profe' and e.id <> p_entrenador_id then raise exception 'Cada PT carga sus propios horarios' using errcode = '42501'; end if;
  if not exists (select 1 from public.equipo q where q.id = p_entrenador_id and q.gimnasio_id = p_gimnasio_id and q.activo and q.rol in ('dueno', 'encargado', 'profe')) then
    raise exception 'Ese PT no es del equipo (o está dado de baja)' using errcode = '22023';
  end if;
  if not exists (select 1 from public.sedes s where s.id = p_sede_id and s.gimnasio_id = p_gimnasio_id and s.activa) then
    raise exception 'Esa sede no existe o está inactiva' using errcode = '22023';
  end if;
  if p_minutos is null or p_minutos < 15 or p_minutos > 180 then raise exception 'Cada sesión dura entre 15 y 180 minutos' using errcode = '22023'; end if;
  if p_repetir_semanas is null or p_repetir_semanas < 1 or p_repetir_semanas > 12 then raise exception 'Se puede repetir de 1 a 12 semanas' using errcode = '22023'; end if;
  -- El día y la hora llegan como los escribe la persona ("2026-11-20T10:00"), en la hora del gimnasio.
  begin
    local := replace(trim(coalesce(p_inicio_local, '')), 'T', ' ')::timestamp;
  exception when others then
    raise exception 'No entiendo el día y la hora del horario' using errcode = '22023';
  end;
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  if (local at time zone zona) <= now() then raise exception 'El horario tiene que ser a futuro' using errcode = '22023'; end if;
  if (local at time zone zona) > now() + interval '180 days' then raise exception 'Sólo se cargan horarios de los próximos 6 meses' using errcode = '22023'; end if;
  for i in 0 .. p_repetir_semanas - 1 loop
    ini := (local + make_interval(days => 7 * i)) at time zone zona;
    insert into public.pt_franjas (gimnasio_id, sede_id, entrenador_id, inicio, fin, creada_por)
    values (p_gimnasio_id, p_sede_id, p_entrenador_id, ini, ini + make_interval(mins => p_minutos), e.id);
  end loop;
  return p_repetir_semanas;
end $$;

-- Si tenía una sesión reservada, se cancela y se devuelve (la falla no es del socio).
create or replace function public.quitar_franja_pt(p_franja_id uuid, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare f public.pt_franjas; e public.equipo; mot text := nullif(trim(coalesce(p_motivo, '')), ''); n int; tenia boolean := false;
begin
  select * into f from public.pt_franjas where id = p_franja_id for update;
  if not found then raise exception 'Sin permiso o franja inexistente' using errcode = '42501'; end if;
  e := privado.exigir_pt(f.gimnasio_id, array['dueno', 'encargado', 'profe']);
  if e.rol = 'profe' and e.id <> f.entrenador_id then raise exception 'Cada PT quita sus propios horarios' using errcode = '42501'; end if;
  if f.cancelada_en is not null then raise exception 'Ese horario ya estaba quitado' using errcode = '22023'; end if;
  if f.inicio <= now() then raise exception 'Ese horario ya empezó' using errcode = '22023'; end if;
  if exists (select 1 from public.sesiones_pt s where s.franja_id = f.id and s.estado = 'reservada') then
    if mot is null or length(mot) < 3 then raise exception 'Hay un socio con ese horario reservado: contá el motivo para avisarle' using errcode = '22023'; end if;
    update public.sesiones_pt set estado = 'cancelada', cancelada_en = now(), cancelada_por = e.id, cancelada_origen = 'franja', cancelada_motivo = mot
     where franja_id = f.id and estado = 'reservada';
    tenia := true;
  end if;
  update public.pt_franjas set cancelada_en = now(), cancelada_por = e.id, cancelada_motivo = mot where id = f.id and cancelada_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo quitar el horario'; end if;
  return jsonb_build_object('cancelo_sesion', tenia);
end $$;

-- ── Los packs y la antelación ───────────────────────────────────────
create or replace function public.guardar_pack_pt(p_gimnasio_id uuid, p_producto_id uuid, p_nombre text, p_precio numeric, p_sesiones int, p_validez_dias int, p_entrenador_id uuid, p_activo boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pid uuid; n int; nom text := trim(coalesce(p_nombre, ''));
begin
  perform privado.exigir_pt(p_gimnasio_id, array['dueno', 'encargado']);
  if length(nom) < 1 then raise exception 'Poné el nombre del pack (por ejemplo "10 sesiones de PT")' using errcode = '22023'; end if;
  if p_precio is null or p_precio <= 0 then raise exception 'El precio tiene que ser mayor a cero' using errcode = '22023'; end if;
  if p_sesiones is null or p_sesiones < 1 or p_sesiones > 100 then raise exception 'El pack tiene de 1 a 100 sesiones' using errcode = '22023'; end if;
  if p_validez_dias is not null and (p_validez_dias < 1 or p_validez_dias > 730) then raise exception 'La vigencia es de 1 a 730 días (o sin vencimiento)' using errcode = '22023'; end if;
  if p_entrenador_id is not null and not exists (select 1 from public.equipo q where q.id = p_entrenador_id and q.gimnasio_id = p_gimnasio_id and q.activo and q.rol in ('dueno', 'encargado', 'profe')) then
    raise exception 'Ese PT no es del equipo' using errcode = '22023';
  end if;
  if p_producto_id is null then
    insert into public.productos (gimnasio_id, nombre, precio, pt_sesiones, pt_validez_dias, pt_entrenador_id, categoria, orden)
    values (p_gimnasio_id, nom, round(p_precio, 2), p_sesiones, p_validez_dias, p_entrenador_id, 'Personal trainer',
            coalesce((select max(orden) + 1 from public.productos where gimnasio_id = p_gimnasio_id), 0))
    returning id into pid;
  else
    update public.productos set nombre = nom, precio = round(p_precio, 2), pt_sesiones = p_sesiones, pt_validez_dias = p_validez_dias,
           pt_entrenador_id = p_entrenador_id, activo = coalesce(p_activo, true)
     where id = p_producto_id and gimnasio_id = p_gimnasio_id and pt_sesiones is not null
    returning id into pid;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Sin permiso o pack inexistente' using errcode = '42501'; end if;
  end if;
  return pid;
end $$;

create or replace function public.guardar_config_pt(p_gimnasio_id uuid, p_horas int) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_pt(p_gimnasio_id, array['dueno', 'encargado']);
  if p_horas is null or p_horas < 0 or p_horas > 168 then raise exception 'La antelación es de 0 a 168 horas' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set pt_cancelar_horas = p_horas where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la antelación'; end if;
end $$;

-- ── Lo que ve la pantalla ───────────────────────────────────────────
-- La agenda: desde hace 7 días (para marcar lo que se dio) hasta p_dias días. El PT ve sólo la suya; el resto, todas.
create or replace function public.agenda_pt(p_gimnasio_id uuid, p_entrenador_id uuid default null, p_dias int default 21) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; gestion boolean; ent uuid; r jsonb; dias int := greatest(1, least(coalesce(p_dias, 21), 60)); horas int; zona text; mes_ini timestamptz; mes_fin timestamptz;
begin
  e := privado.exigir_pt(p_gimnasio_id);
  gestion := e.rol in ('dueno', 'encargado');
  ent := case when e.rol = 'profe' then e.id else p_entrenador_id end;
  select pt_cancelar_horas, g.zona_horaria into horas, zona from public.configuracion_gimnasio c join public.gimnasios g on g.id = c.gimnasio_id where c.gimnasio_id = p_gimnasio_id;
  mes_ini := privado.medianoche((date_trunc('month', now() at time zone zona))::date, zona);
  mes_fin := privado.medianoche((date_trunc('month', now() at time zone zona) + interval '1 month')::date, zona);
  select jsonb_build_object(
    'puede_gestionar', gestion, 'puede_reservar_por_socio', e.rol in ('dueno', 'encargado', 'recepcion'), 'mi_equipo_id', e.id, 'mi_rol', e.rol, 'horas_cancelar', horas,
    'sedes', coalesce((select jsonb_agg(jsonb_build_object('sede_id', s.id, 'nombre', s.nombre) order by s.es_principal desc, s.nombre) from public.sedes s where s.gimnasio_id = p_gimnasio_id and s.activa), '[]'::jsonb),
    'entrenadores', coalesce((select jsonb_agg(jsonb_build_object('equipo_id', q.id, 'nombre', q.nombre, 'rol', q.rol) order by q.nombre)
                                from public.equipo q where q.gimnasio_id = p_gimnasio_id and q.activo and q.rol in ('dueno', 'encargado', 'profe') and (e.rol <> 'profe' or q.id = e.id)), '[]'::jsonb),
    'packs', case when e.rol = 'profe' then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('producto_id', p.id, 'nombre', p.nombre, 'precio', p.precio, 'sesiones', p.pt_sesiones,
                                'validez_dias', p.pt_validez_dias, 'entrenador_id', p.pt_entrenador_id, 'entrenador', q.nombre, 'activo', p.activo, 'vendido', exists (select 1 from public.venta_items it where it.producto_id = p.id))
                                order by p.activo desc, p.pt_sesiones, p.nombre)
                           from public.productos p left join public.equipo q on q.gimnasio_id = p.gimnasio_id and q.id = p.pt_entrenador_id
                          where p.gimnasio_id = p_gimnasio_id and p.pt_sesiones is not null), '[]'::jsonb) end,
    'franjas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'franja_id', f.id, 'entrenador_id', f.entrenador_id, 'entrenador', q.nombre, 'sede', sd.nombre, 'inicio', f.inicio, 'fin', f.fin,
        'estado', coalesce(s.estado, 'libre'), 'sesion_id', s.id, 'socio_id', s.socio_id, 'socio', trim(so.nombre || ' ' || so.apellido),
        'empezo', f.inicio <= now(),
        'puede_marcar', s.estado = 'reservada' and f.inicio <= now() and (gestion or f.entrenador_id = e.id),
        'puede_cancelar', s.estado = 'reservada' and f.inicio > now() and (gestion or f.entrenador_id = e.id or (e.rol = 'recepcion' and now() <= f.inicio - make_interval(hours => horas))),
        'puede_quitar', s.id is null and f.inicio > now() and (gestion or f.entrenador_id = e.id),
        'puede_quitar_con_sesion', s.estado = 'reservada' and f.inicio > now() and (gestion or f.entrenador_id = e.id))
        order by f.inicio, q.nombre)
        from public.pt_franjas f
        join public.equipo q on q.gimnasio_id = f.gimnasio_id and q.id = f.entrenador_id
        join public.sedes sd on sd.gimnasio_id = f.gimnasio_id and sd.id = f.sede_id
        left join public.sesiones_pt s on s.franja_id = f.id and s.estado <> 'cancelada'
        left join public.socios so on so.gimnasio_id = s.gimnasio_id and so.id = s.socio_id
       where f.gimnasio_id = p_gimnasio_id and f.cancelada_en is null and (ent is null or f.entrenador_id = ent)
         and f.inicio >= now() - interval '7 days' and f.inicio < now() + make_interval(days => dias)), '[]'::jsonb),
    'dictadas_mes', coalesce((
      select jsonb_agg(jsonb_build_object('entrenador_id', x.entrenador_id, 'nombre', x.nombre, 'dictadas', x.dictadas, 'ausentes', x.ausentes) order by x.nombre)
        from (select f.entrenador_id, q.nombre, count(*) filter (where s.estado = 'dictada')::int as dictadas, count(*) filter (where s.estado = 'ausente')::int as ausentes
                from public.sesiones_pt s join public.pt_franjas f on f.id = s.franja_id join public.equipo q on q.gimnasio_id = f.gimnasio_id and q.id = f.entrenador_id
               where s.gimnasio_id = p_gimnasio_id and s.estado in ('dictada', 'ausente') and f.inicio >= mes_ini and f.inicio < mes_fin and (e.rol <> 'profe' or f.entrenador_id = e.id)
               group by f.entrenador_id, q.nombre) x), '[]'::jsonb))
  into r;
  return r;
end $$;

-- Lo del socio: sus packs, sus sesiones y los horarios libres que puede reservar (sólo si le queda saldo). Lo pide él o el mostrador.
create or replace function public.pt_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; horas int; zona text; saldo boolean;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_socio_id not in (select privado.mis_socios()) then perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']); end if;
  if not privado.seccion_activa(g, 'pt') then return jsonb_build_object('prendido', false); end if;
  select c.pt_cancelar_horas, gi.zona_horaria into horas, zona from public.configuracion_gimnasio c join public.gimnasios gi on gi.id = c.gimnasio_id where c.gimnasio_id = g;
  select exists (select 1 from privado.saldo_pt(p_socio_id) x where x.restantes > 0 and (x.vence_en is null or x.vence_en > now())) into saldo;
  return jsonb_build_object(
    'prendido', true, 'horas_cancelar', horas, 'tiene_saldo', saldo,
    'ofrece', exists (select 1 from public.productos p where p.gimnasio_id = g and p.pt_sesiones is not null and p.activo),
    'packs', coalesce((select jsonb_agg(jsonb_build_object('venta_item_id', x.venta_item_id, 'nombre', x.nombre, 'entrenador', q.nombre, 'total', x.total, 'usadas', x.usadas,
                                  'restantes', x.restantes, 'vence_en', x.vence_en, 'vigente', x.restantes > 0 and (x.vence_en is null or x.vence_en > now())) order by x.comprado_en desc)
                         from privado.saldo_pt(p_socio_id) x left join public.equipo q on q.gimnasio_id = g and q.id = x.entrenador_id), '[]'::jsonb),
    'sesiones', coalesce((
      select jsonb_agg(jsonb_build_object('sesion_id', s.id, 'franja_id', f.id, 'inicio', f.inicio, 'fin', f.fin, 'entrenador', q.nombre, 'sede', sd.nombre, 'estado', s.estado,
                                          'puede_cancelar', s.estado = 'reservada' and now() <= f.inicio - make_interval(hours => horas),
                                          'cancelar_hasta', f.inicio - make_interval(hours => horas),
                                          'cancelada_origen', s.cancelada_origen, 'cancelada_motivo', s.cancelada_motivo) order by f.inicio desc)
        from public.sesiones_pt s join public.pt_franjas f on f.id = s.franja_id
        join public.equipo q on q.gimnasio_id = f.gimnasio_id and q.id = f.entrenador_id
        join public.sedes sd on sd.gimnasio_id = f.gimnasio_id and sd.id = f.sede_id
       where s.socio_id = p_socio_id and (f.inicio >= now() - interval '60 days')), '[]'::jsonb),
    'libres', case when not saldo then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('franja_id', f.id, 'inicio', f.inicio, 'fin', f.fin, 'entrenador_id', f.entrenador_id, 'entrenador', q.nombre, 'sede', sd.nombre) order by f.inicio, q.nombre)
        from (select f0.* from public.pt_franjas f0
               where f0.gimnasio_id = g and f0.cancelada_en is null and f0.inicio > now() and f0.inicio < now() + interval '21 days'
                 and not exists (select 1 from public.sesiones_pt s where s.franja_id = f0.id and s.estado <> 'cancelada')
                 and exists (select 1 from privado.saldo_pt(p_socio_id) x where x.restantes > 0 and (x.vence_en is null or x.vence_en > f0.inicio)
                                and (x.entrenador_id is null or x.entrenador_id = f0.entrenador_id))
               order by f0.inicio limit 80) f
        join public.equipo q on q.gimnasio_id = f.gimnasio_id and q.id = f.entrenador_id
        join public.sedes sd on sd.gimnasio_id = f.gimnasio_id and sd.id = f.sede_id), '[]'::jsonb) end);
end $$;

-- Sesiones dadas por cada PT en [desde, hasta) (días del gimnasio): lo que falta para sumarlas a la liquidación (VD-52). El PT ve sólo las suyas.
create or replace function public.sesiones_dictadas_pt(p_gimnasio_id uuid, p_desde date, p_hasta date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; zona text;
begin
  e := privado.exigir_pt(p_gimnasio_id, array['dueno', 'encargado', 'profe']);
  if p_desde is null or p_hasta is null or p_hasta <= p_desde then raise exception 'Elegí un período válido' using errcode = '22023'; end if;
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  return coalesce((select jsonb_agg(jsonb_build_object('entrenador_id', x.entrenador_id, 'nombre', x.nombre, 'dictadas', x.dictadas, 'ausentes', x.ausentes) order by x.nombre)
    from (select f.entrenador_id, q.nombre, count(*) filter (where s.estado = 'dictada')::int as dictadas, count(*) filter (where s.estado = 'ausente')::int as ausentes
            from public.sesiones_pt s join public.pt_franjas f on f.id = s.franja_id join public.equipo q on q.gimnasio_id = f.gimnasio_id and q.id = f.entrenador_id
           where s.gimnasio_id = p_gimnasio_id and s.estado in ('dictada', 'ausente')
             and f.inicio >= privado.medianoche(p_desde, zona) and f.inicio < privado.medianoche(p_hasta, zona)
             and (e.rol <> 'profe' or f.entrenador_id = e.id)
           group by f.entrenador_id, q.nombre) x), '[]'::jsonb);
end $$;

revoke all on function public.reservar_sesion_pt(uuid, uuid), public.cancelar_sesion_pt(uuid, text), public.marcar_sesion_pt(uuid, text),
  public.cargar_franjas_pt(uuid, uuid, uuid, text, int, int), public.quitar_franja_pt(uuid, text),
  public.guardar_pack_pt(uuid, uuid, text, numeric, int, int, uuid, boolean), public.guardar_config_pt(uuid, int),
  public.agenda_pt(uuid, uuid, int), public.pt_socio(uuid), public.sesiones_dictadas_pt(uuid, date, date) from public, anon, authenticated;
grant execute on function public.reservar_sesion_pt(uuid, uuid), public.cancelar_sesion_pt(uuid, text), public.marcar_sesion_pt(uuid, text),
  public.cargar_franjas_pt(uuid, uuid, uuid, text, int, int), public.quitar_franja_pt(uuid, text),
  public.guardar_pack_pt(uuid, uuid, text, numeric, int, int, uuid, boolean), public.guardar_config_pt(uuid, int),
  public.agenda_pt(uuid, uuid, int), public.pt_socio(uuid), public.sesiones_dictadas_pt(uuid, date, date) to authenticated, service_role;

-- ── La sección "pt" se puede apagar ─────────────────────────────────
do $$
declare actuales text[];
begin
  actuales := privado.secciones_validas();
  if not ('pt' = any (actuales)) then
    execute format('create or replace function privado.secciones_validas() returns text[] language sql immutable set search_path = '''' as $f$ select %L::text[] $f$',
                   array_append(actuales, 'pt'));
  end if;
  alter table public.configuracion_gimnasio drop constraint if exists configuracion_secciones_validas;
  alter table public.configuracion_gimnasio add constraint configuracion_secciones_validas
    check (secciones_apagadas <@ privado.secciones_validas());
end $$;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text; t text;
begin
  foreach t in array array['public.pt_franjas', 'public.sesiones_pt'] loop
    if not (select relrowsecurity from pg_class where oid = t::regclass) then raise exception 'Verificación: % sin RLS', t; end if;
    if has_table_privilege('authenticated', t, 'insert') or has_table_privilege('authenticated', t, 'update')
       or has_table_privilege('authenticated', t, 'delete') or has_table_privilege('anon', t, 'select') then
      raise exception 'Verificación: permisos de más sobre %', t;
    end if;
  end loop;
  if not exists (select 1 from pg_indexes where indexname = 'sesiones_pt_una_por_franja') then raise exception 'Verificación: falta el índice que impide reservar dos veces la misma franja'; end if;
  foreach t in array array['pt_franja_no_pisa', 'pt_franja_inmutable'] loop
    if not exists (select 1 from pg_trigger where tgrelid = 'public.pt_franjas'::regclass and tgname = t and not tgisinternal) then raise exception 'Verificación: falta el trigger %', t; end if;
  end loop;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.sesiones_pt'::regclass and tgname = 'sesion_pt_inmutable' and not tgisinternal) then raise exception 'Verificación: falta el trigger de las sesiones'; end if;
  foreach f in array array['public.reservar_sesion_pt(uuid, uuid)', 'public.cancelar_sesion_pt(uuid, text)', 'public.marcar_sesion_pt(uuid, text)',
    'public.cargar_franjas_pt(uuid, uuid, uuid, text, int, int)', 'public.quitar_franja_pt(uuid, text)', 'public.guardar_pack_pt(uuid, uuid, text, numeric, int, int, uuid, boolean)',
    'public.guardar_config_pt(uuid, int)', 'public.agenda_pt(uuid, uuid, int)', 'public.pt_socio(uuid)', 'public.sesiones_dictadas_pt(uuid, date, date)',
    'privado.exigir_pt(uuid, text[])', 'privado.saldo_pt(uuid)', 'privado.reservar_sesion_pt(uuid, uuid, uuid)', 'privado.pt_franja_no_pisa()', 'privado.pt_franja_inmutable()',
    'privado.sesion_pt_inmutable()', 'privado.pack_pt_congelado()'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if not ('pt' = any (privado.secciones_validas())) then raise exception 'Verificación: la sección pt no quedó entre las válidas'; end if;
end $$;
