-- ═══════════════════════════════════════════════════════════════════
-- 0011 · Clases, reservas y lista de espera.
--
-- Tres modos por gimnasio (configuracion_gimnasio.modo_clases):
--   reserva      → cupo, reserva desde la app o recepción, lista de espera
--   sin_reserva  → solo se toma asistencia
--   ninguno      → no hay clases
-- La grilla semanal (horarios_clase) es la plantilla; cada clase concreta
-- se crea la primera vez que alguien mira ese día. Sin cron.
-- La lista de espera asciende sola y deja un aviso pendiente
-- (avisos_pendientes) que el módulo de mensajes envía.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('privado.calcular_acceso(uuid,timestamptz,uuid)') is null then
    raise exception 'Guarda: falta la migración 0006';
  end if;
end $$;

alter table public.configuracion_gimnasio add column if not exists reserva_dias_anticipacion int not null default 7
  check (reserva_dias_anticipacion between 0 and 60);
alter table public.configuracion_gimnasio add column if not exists cancelacion_horas_limite int not null default 2
  check (cancelacion_horas_limite between 0 and 72);

-- ── Actividades y grilla ───────────────────────────────────────────
create table if not exists public.actividades (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  nombre       text not null check (length(trim(nombre)) > 0),
  emoji        text,
  color        text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  descripcion  text,
  activa       boolean not null default true,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, nombre)
);
select privado.politicas_estandar('public.actividades', null, array['dueno', 'encargado']);

-- Qué actividades incluye cada plan. Un plan sin filas incluye todas.
create table if not exists public.plan_actividades (
  gimnasio_id   uuid not null references public.gimnasios(id),
  plan_id       uuid not null,
  actividad_id  uuid not null,
  primary key (gimnasio_id, plan_id, actividad_id),
  foreign key (gimnasio_id, plan_id) references public.planes (gimnasio_id, id),
  foreign key (gimnasio_id, actividad_id) references public.actividades (gimnasio_id, id)
);
select privado.politicas_estandar('public.plan_actividades', null, array['dueno', 'encargado']);

create table if not exists public.horarios_clase (
  id             uuid primary key default gen_random_uuid(),
  gimnasio_id    uuid not null references public.gimnasios(id),
  sede_id        uuid not null,
  actividad_id   uuid not null,
  dia_semana     int not null check (dia_semana between 1 and 7),   -- 1 = lunes (ISO)
  hora_inicio    time not null,                                     -- hora de pared en la zona del gimnasio
  duracion_min   int not null check (duracion_min between 10 and 480),
  cupo           int check (cupo is null or cupo between 1 and 500),  -- null = sin tope
  profe_id       uuid,
  vigente_desde  date not null default current_date,
  vigente_hasta  date,
  creado_en      timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  foreign key (gimnasio_id, actividad_id) references public.actividades (gimnasio_id, id),
  foreign key (gimnasio_id, profe_id) references public.equipo (gimnasio_id, id),
  check (vigente_hasta is null or vigente_hasta >= vigente_desde)
);
select privado.politicas_estandar('public.horarios_clase', null, array['dueno', 'encargado']);

-- ── Clases concretas ───────────────────────────────────────────────
create table if not exists public.clases (
  id                 uuid primary key default gen_random_uuid(),
  gimnasio_id        uuid not null references public.gimnasios(id),
  sede_id            uuid not null,
  horario_id         uuid,
  actividad_id       uuid not null,
  inicio             timestamptz not null,
  fin                timestamptz not null,
  cupo               int check (cupo is null or cupo between 1 and 500),
  profe_id           uuid,
  cancelada_en       timestamptz,
  cancelada_motivo   text,
  creado_en          timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  foreign key (gimnasio_id, horario_id) references public.horarios_clase (gimnasio_id, id),
  foreign key (gimnasio_id, actividad_id) references public.actividades (gimnasio_id, id),
  foreign key (gimnasio_id, profe_id) references public.equipo (gimnasio_id, id),
  check (fin > inicio),
  check ((cancelada_en is null) = (cancelada_motivo is null))
);
create unique index if not exists clases_por_horario on public.clases (gimnasio_id, horario_id, inicio) where horario_id is not null;
create index if not exists clases_sede_inicio on public.clases (gimnasio_id, sede_id, inicio);
select privado.politicas_estandar('public.clases', null, '{}');

create table if not exists public.reservas (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  clase_id      uuid not null,
  socio_id      uuid not null,
  estado        text not null check (estado in ('confirmada', 'espera', 'cancelada')),
  creado_en     timestamptz not null default clock_timestamp(),
  promovida_en  timestamptz,
  cancelada_en  timestamptz,
  cancelada_por text check (cancelada_por in ('socio', 'equipo', 'clase_cancelada')),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, clase_id) references public.clases (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  check ((estado = 'cancelada') = (cancelada_en is not null))
);
create unique index if not exists reservas_una_activa on public.reservas (gimnasio_id, clase_id, socio_id) where estado <> 'cancelada';
create index if not exists reservas_clase on public.reservas (clase_id, estado, creado_en);
select privado.politicas_estandar('public.reservas', null, '{}', true);

create table if not exists public.asistencias (
  id              uuid primary key default gen_random_uuid(),
  gimnasio_id     uuid not null references public.gimnasios(id),
  clase_id        uuid not null,
  socio_id        uuid not null,
  reserva_id      uuid,
  registrado_por  uuid,
  creado_en       timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, clase_id, socio_id),
  foreign key (gimnasio_id, clase_id) references public.clases (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, reserva_id) references public.reservas (gimnasio_id, id),
  foreign key (gimnasio_id, registrado_por) references public.equipo (gimnasio_id, id)
);
select privado.politicas_estandar('public.asistencias', null, '{}', true);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'consumos_pack_asistencia_fk') then
    alter table public.consumos_pack add constraint consumos_pack_asistencia_fk
      foreign key (gimnasio_id, asistencia_id) references public.asistencias (gimnasio_id, id);
  end if;
end $$;

-- ── Avisos pendientes (los envía el módulo de mensajes) ────────────
create table if not exists public.avisos_pendientes (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  socio_id     uuid not null,
  tipo         text not null check (tipo in ('lugar_liberado', 'clase_cancelada')),
  clase_id     uuid,
  texto        text not null,
  creado_en    timestamptz not null default now(),
  enviado_en   timestamptz,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, clase_id) references public.clases (gimnasio_id, id)
);
create index if not exists avisos_sin_enviar on public.avisos_pendientes (gimnasio_id, creado_en) where enviado_en is null;
select privado.politicas_estandar('public.avisos_pendientes', array['dueno', 'encargado'], '{}');

-- ═══ Clases del día (se crean a demanda) ═══════════════════════════
create or replace function privado.materializar_dia(p_sede_id uuid, p_dia date) returns void
language plpgsql set search_path = '' as $$
declare s public.sedes; zona text;
begin
  select * into s from public.sedes where id = p_sede_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = s.gimnasio_id;
  insert into public.clases (gimnasio_id, sede_id, horario_id, actividad_id, inicio, fin, cupo, profe_id,
                             cancelada_en, cancelada_motivo)
  select h.gimnasio_id, h.sede_id, h.id, h.actividad_id,
         (p_dia + h.hora_inicio) at time zone zona,
         (p_dia + h.hora_inicio) at time zone zona + make_interval(mins => h.duracion_min),
         h.cupo, h.profe_id,
         case when ci.id is not null then now() end,
         case when ci.id is not null then 'Gimnasio cerrado: ' || ci.motivo end
    from public.horarios_clase h
    join public.actividades a on a.id = h.actividad_id and a.activa
    left join lateral (
      select x.id, x.motivo from public.cierres x
       where x.gimnasio_id = h.gimnasio_id and x.anulado_en is null and (x.sede_id is null or x.sede_id = h.sede_id)
         and x.desde < (p_dia + h.hora_inicio) at time zone zona + make_interval(mins => h.duracion_min)
         and x.hasta > (p_dia + h.hora_inicio) at time zone zona
       limit 1
    ) ci on true
   where h.sede_id = p_sede_id and h.dia_semana = extract(isodow from p_dia)
     and h.vigente_desde <= p_dia and (h.vigente_hasta is null or h.vigente_hasta >= p_dia)
  on conflict (gimnasio_id, horario_id, inicio) where horario_id is not null do nothing;
end $$;
revoke all on function privado.materializar_dia(uuid, date) from public;

create or replace function public.clases_del_dia(p_sede_id uuid, p_dia date)
returns table (clase_id uuid, actividad text, emoji text, color text, inicio timestamptz, fin timestamptz,
               profe text, cupo int, confirmadas int, en_espera int, cancelada boolean, cancelada_motivo text,
               mi_reserva text, mi_posicion int)
language plpgsql security definer set search_path = '' as $$
declare g uuid; modo text; soy_socio uuid;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  select s.id into soy_socio from public.socios s where s.id in (select privado.mis_socios()) and s.gimnasio_id = g limit 1;
  if not (privado.es_servicio() or g in (select privado.mis_gimnasios()) or soy_socio is not null) then
    raise exception 'Sin permiso para ver las clases de este gimnasio' using errcode = '42501';
  end if;
  select modo_clases into modo from public.configuracion_gimnasio where gimnasio_id = g;
  if modo = 'ninguno' then raise exception 'Este gimnasio no tiene clases'; end if;
  perform privado.materializar_dia(p_sede_id, p_dia);
  return query
    select c.id, a.nombre, a.emoji, a.color, c.inicio, c.fin, e.nombre, c.cupo,
           (select count(*)::int from public.reservas r where r.clase_id = c.id and r.estado = 'confirmada'),
           (select count(*)::int from public.reservas r where r.clase_id = c.id and r.estado = 'espera'),
           c.cancelada_en is not null, c.cancelada_motivo,
           (select r.estado from public.reservas r where r.clase_id = c.id and r.socio_id = soy_socio and r.estado <> 'cancelada'),
           (select count(*)::int + 1 from public.reservas r2 where r2.clase_id = c.id and r2.estado = 'espera'
              and r2.creado_en < (select r.creado_en from public.reservas r where r.clase_id = c.id and r.socio_id = soy_socio and r.estado = 'espera'))
      from public.clases c
      join public.actividades a on a.id = c.actividad_id
      left join public.equipo e on e.id = c.profe_id
      join public.gimnasios gi on gi.id = c.gimnasio_id
     where c.sede_id = p_sede_id
       and c.inicio >= (p_dia::timestamp) at time zone gi.zona_horaria
       and c.inicio < ((p_dia + 1)::timestamp) at time zone gi.zona_horaria
     order by c.inicio, a.nombre;
end $$;

-- ═══ Reservar ══════════════════════════════════════════════════════
create or replace function privado.reservar(p_clase_id uuid, p_socio_id uuid, p_momento timestamptz) returns jsonb
language plpgsql set search_path = '' as $$
declare
  c public.clases; cfg public.configuracion_gimnasio; v public.veredicto_acceso; sus public.suscripciones;
  confirmadas int; v_estado text; rid uuid; pos int; nombre_act text;
begin
  select * into c from public.clases where id = p_clase_id for update;   -- lock: dos no se quedan con el último lugar
  if not found then raise exception 'Clase inexistente' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.socios where id = p_socio_id and gimnasio_id = c.gimnasio_id) then
    raise exception 'El socio no es de este gimnasio';
  end if;
  select * into cfg from public.configuracion_gimnasio where gimnasio_id = c.gimnasio_id;
  if cfg.modo_clases <> 'reserva' then raise exception 'En este gimnasio las clases no se reservan: vení directo'; end if;
  if c.cancelada_en is not null then raise exception 'La clase está cancelada: %', c.cancelada_motivo; end if;
  if c.inicio <= p_momento then raise exception 'La clase ya empezó'; end if;
  if c.inicio > p_momento + make_interval(days => cfg.reserva_dias_anticipacion) then
    raise exception 'Se puede reservar hasta % días antes', cfg.reserva_dias_anticipacion;
  end if;
  if exists (select 1 from public.reservas where clase_id = c.id and socio_id = p_socio_id and estado <> 'cancelada') then
    raise exception 'Ya tenés una reserva en esta clase';
  end if;

  -- ¿Va a poder entrar a esa hora? Mismo cálculo que la puerta.
  v := privado.calcular_acceso(p_socio_id, c.inicio, c.sede_id);
  if not v.puede or v.modo_aviso then raise exception 'No podés reservar: %', v.texto; end if;
  select nombre into nombre_act from public.actividades where id = c.actividad_id;
  if v.via = 'membresia' then
    select * into sus from public.suscripciones where socio_id = p_socio_id and baja_en is null;
    if exists (select 1 from public.plan_actividades pa where pa.plan_id = sus.plan_id)
       and not exists (select 1 from public.plan_actividades pa where pa.plan_id = sus.plan_id and pa.actividad_id = c.actividad_id) then
      raise exception 'Tu plan no incluye %', nombre_act;
    end if;
  end if;

  select count(*) into confirmadas from public.reservas where clase_id = c.id and estado = 'confirmada';
  v_estado := case when c.cupo is null or confirmadas < c.cupo then 'confirmada' else 'espera' end;
  insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values (c.gimnasio_id, c.id, p_socio_id, v_estado)
  returning id into rid;
  if v_estado = 'espera' then
    select count(*) into pos from public.reservas where clase_id = c.id and estado = 'espera';
  end if;
  return jsonb_build_object('reserva_id', rid, 'estado', v_estado, 'posicion', pos);
end $$;
revoke all on function privado.reservar(uuid, uuid, timestamptz) from public;

-- Libera un lugar: el primero de la lista de espera pasa a confirmado y queda avisado.
create or replace function privado.promover_espera(p_clase_id uuid, p_momento timestamptz) returns uuid
language plpgsql set search_path = '' as $$
declare c public.clases; r public.reservas; zona text; nombre_act text;
begin
  select * into c from public.clases where id = p_clase_id;
  if c.cancelada_en is not null or c.inicio <= p_momento then return null; end if;
  if c.cupo is not null and (select count(*) from public.reservas where clase_id = c.id and estado = 'confirmada') >= c.cupo then
    return null;
  end if;
  select * into r from public.reservas where clase_id = c.id and estado = 'espera' order by creado_en limit 1 for update;
  if not found then return null; end if;
  update public.reservas set estado = 'confirmada', promovida_en = p_momento where id = r.id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = c.gimnasio_id;
  select nombre into nombre_act from public.actividades where id = c.actividad_id;
  insert into public.avisos_pendientes (gimnasio_id, socio_id, tipo, clase_id, texto)
  values (c.gimnasio_id, r.socio_id, 'lugar_liberado', c.id,
          'Se liberó un lugar: tenés confirmada ' || nombre_act || ' del ' || privado.fecha_corta(c.inicio, zona)
          || ' a las ' || to_char(c.inicio at time zone zona, 'HH24:MI') || '.');
  return r.id;
end $$;
revoke all on function privado.promover_espera(uuid, timestamptz) from public;

create or replace function privado.cancelar_reserva(p_reserva_id uuid, p_por text, p_sin_limite boolean, p_momento timestamptz) returns void
language plpgsql set search_path = '' as $$
declare r public.reservas; c public.clases; cfg public.configuracion_gimnasio; n int;
begin
  select * into r from public.reservas where id = p_reserva_id;
  if not found then raise exception 'Reserva inexistente' using errcode = 'P0002'; end if;
  select * into c from public.clases where id = r.clase_id for update;
  select * into r from public.reservas where id = p_reserva_id for update;
  if r.estado = 'cancelada' then raise exception 'La reserva ya estaba cancelada'; end if;
  if c.inicio <= p_momento then raise exception 'La clase ya empezó'; end if;
  select * into cfg from public.configuracion_gimnasio where gimnasio_id = c.gimnasio_id;
  if not p_sin_limite and r.estado = 'confirmada'
     and c.inicio - make_interval(hours => cfg.cancelacion_horas_limite) < p_momento then
    raise exception 'Faltan menos de % horas: cancelala desde recepción', cfg.cancelacion_horas_limite;
  end if;
  update public.reservas set estado = 'cancelada', cancelada_en = p_momento, cancelada_por = p_por
   where id = r.id and estado <> 'cancelada';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo cancelar la reserva'; end if;
  if r.estado = 'confirmada' then perform privado.promover_espera(c.id, p_momento); end if;
end $$;
revoke all on function privado.cancelar_reserva(uuid, text, boolean, timestamptz) from public;

create or replace function privado.cancelar_clase(p_clase_id uuid, p_motivo text) returns int
language plpgsql set search_path = '' as $$
declare c public.clases; zona text; nombre_act text; n int;
begin
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'El motivo es obligatorio: les llega a los anotados'; end if;
  select * into c from public.clases where id = p_clase_id for update;
  if not found then raise exception 'Clase inexistente' using errcode = 'P0002'; end if;
  if c.cancelada_en is not null then raise exception 'La clase ya estaba cancelada'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = c.gimnasio_id;
  select nombre into nombre_act from public.actividades where id = c.actividad_id;
  update public.clases set cancelada_en = now(), cancelada_motivo = trim(p_motivo) where id = c.id;
  insert into public.avisos_pendientes (gimnasio_id, socio_id, tipo, clase_id, texto)
  select c.gimnasio_id, r.socio_id, 'clase_cancelada', c.id,
         'Se canceló ' || nombre_act || ' del ' || privado.fecha_corta(c.inicio, zona) || ' a las '
         || to_char(c.inicio at time zone zona, 'HH24:MI') || ': ' || trim(p_motivo)
    from public.reservas r where r.clase_id = c.id and r.estado <> 'cancelada';
  update public.reservas set estado = 'cancelada', cancelada_en = now(), cancelada_por = 'clase_cancelada'
   where clase_id = c.id and estado <> 'cancelada';
  get diagnostics n = row_count;
  -- Si alguien ya había dado presente con un pack, la clase se le devuelve.
  update public.consumos_pack set anulado_en = now()
   where anulado_en is null and asistencia_id in (select id from public.asistencias where clase_id = c.id);
  return n;
end $$;
revoke all on function privado.cancelar_clase(uuid, text) from public;

-- Asistencia: con pack "se descuenta en la clase", se descuenta acá.
create or replace function privado.tomar_asistencia(p_clase_id uuid, p_socio_id uuid, p_registrado_por uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare c public.clases; aid uuid; rid uuid; pk record; consumio boolean := false;
begin
  select * into c from public.clases where id = p_clase_id for update;
  if not found then raise exception 'Clase inexistente' using errcode = 'P0002'; end if;
  if c.cancelada_en is not null then raise exception 'La clase está cancelada'; end if;
  if not exists (select 1 from public.socios where id = p_socio_id and gimnasio_id = c.gimnasio_id) then
    raise exception 'El socio no es de este gimnasio';
  end if;
  if exists (select 1 from public.asistencias where clase_id = c.id and socio_id = p_socio_id) then
    raise exception 'Ya tiene el presente en esta clase';
  end if;
  select id into rid from public.reservas where clase_id = c.id and socio_id = p_socio_id and estado = 'confirmada';
  insert into public.asistencias (gimnasio_id, clase_id, socio_id, reserva_id, registrado_por)
  values (c.gimnasio_id, c.id, p_socio_id, rid, p_registrado_por) returning id into aid;

  select p.id, pl.todas_las_sedes, pl.id as plan_id into pk
    from public.packs p join public.planes pl on pl.id = p.plan_id
   where p.socio_id = p_socio_id and p.anulado_en is null and pl.consume_en = 'asistencia'
     and p.desde <= c.inicio and (p.vence_en is null or p.vence_en > c.inicio)
     and p.cantidad > (select count(*) from public.consumos_pack x where x.pack_id = p.id and x.anulado_en is null)
     and (pl.todas_las_sedes or exists (select 1 from public.plan_sedes ps where ps.plan_id = pl.id and ps.sede_id = c.sede_id))
   order by p.vence_en nulls last, p.desde limit 1;
  if found then
    insert into public.consumos_pack (gimnasio_id, pack_id, socio_id, momento, asistencia_id)
    values (c.gimnasio_id, pk.id, p_socio_id, c.inicio, aid);
    consumio := true;
  end if;
  return jsonb_build_object('asistencia_id', aid, 'tenia_reserva', rid is not null, 'descontó_pack', consumio);
end $$;
revoke all on function privado.tomar_asistencia(uuid, uuid, uuid) from public;

-- ═══ API pública ═══════════════════════════════════════════════════
-- El socio reserva para sí; la recepción reserva para cualquier socio.
create or replace function public.reservar(p_clase_id uuid, p_socio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; sede uuid;
begin
  select gimnasio_id, sede_id into g, sede from public.clases where id = p_clase_id;
  if g is null then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  if not (p_socio_id in (select privado.mis_socios()) or privado.es_servicio()) then
    perform privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], sede);
  end if;
  return privado.reservar(p_clase_id, p_socio_id, now());
end $$;

create or replace function public.cancelar_reserva(p_reserva_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reservas; sede uuid;
begin
  select * into r from public.reservas where id = p_reserva_id;
  if not found then raise exception 'Sin permiso o reserva inexistente' using errcode = '42501'; end if;
  select sede_id into sede from public.clases where id = r.clase_id;
  if r.socio_id in (select privado.mis_socios()) then
    perform privado.cancelar_reserva(p_reserva_id, 'socio', false, now());
  else
    perform privado.exigir_rol(r.gimnasio_id, array['dueno', 'encargado', 'recepcion'], sede);
    perform privado.cancelar_reserva(p_reserva_id, 'equipo', true, now());
  end if;
end $$;

create or replace function public.cancelar_clase(p_clase_id uuid, p_motivo text) returns int
language plpgsql security definer set search_path = '' as $$
declare c public.clases; eid uuid; rol text;
begin
  select * into c from public.clases where id = p_clase_id;
  if not found then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(c.gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe'], c.sede_id);
  select e.rol into rol from public.equipo e where e.id = eid;
  if rol = 'profe' and c.profe_id is distinct from eid then
    raise exception 'Solo podés cancelar tus clases' using errcode = '42501';
  end if;
  return privado.cancelar_clase(p_clase_id, p_motivo);
end $$;

create or replace function public.tomar_asistencia(p_clase_id uuid, p_socio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.clases; eid uuid; rol text;
begin
  select * into c from public.clases where id = p_clase_id;
  if not found then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(c.gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe'], c.sede_id);
  select e.rol into rol from public.equipo e where e.id = eid;
  if rol = 'profe' and c.profe_id is distinct from eid then
    raise exception 'Solo podés tomar asistencia en tus clases' using errcode = '42501';
  end if;
  return privado.tomar_asistencia(p_clase_id, p_socio_id, eid);
end $$;

-- La lista de la clase (para el profe, que no lee la tabla de socios).
create or replace function public.lista_clase(p_clase_id uuid)
returns table (socio_id uuid, nombre text, estado text, posicion int, presente boolean)
language plpgsql stable security definer set search_path = '' as $$
declare c public.clases; eid uuid; rol text;
begin
  select * into c from public.clases where id = p_clase_id;
  if not found then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(c.gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe'], c.sede_id);
  select e.rol into rol from public.equipo e where e.id = eid;
  if rol = 'profe' and c.profe_id is distinct from eid then
    raise exception 'Solo podés ver la lista de tus clases' using errcode = '42501';
  end if;
  return query
    select s.id, trim(s.nombre || ' ' || s.apellido), r.estado,
           case when r.estado = 'espera' then (row_number() over (partition by r.estado order by r.creado_en))::int end,
           exists (select 1 from public.asistencias a where a.clase_id = c.id and a.socio_id = s.id)
      from public.reservas r join public.socios s on s.id = r.socio_id
     where r.clase_id = c.id and r.estado <> 'cancelada'
    union all
    select s.id, trim(s.nombre || ' ' || s.apellido), 'sin_reserva', null::int, true
      from public.asistencias a join public.socios s on s.id = a.socio_id
     where a.clase_id = c.id and a.reserva_id is null
     order by 3, 4 nulls first, 2;
end $$;

revoke all on function public.clases_del_dia(uuid, date), public.reservar(uuid, uuid), public.cancelar_reserva(uuid),
  public.cancelar_clase(uuid, text), public.tomar_asistencia(uuid, uuid), public.lista_clase(uuid)
  from public, anon, authenticated;
grant execute on function public.clases_del_dia(uuid, date), public.reservar(uuid, uuid), public.cancelar_reserva(uuid),
  public.cancelar_clase(uuid, text), public.tomar_asistencia(uuid, uuid), public.lista_clase(uuid)
  to authenticated, service_role;

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

do $$
declare faltan text;
begin
  select string_agg(c.relname, ', ') into faltan from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
     and c.relname in ('actividades', 'plan_actividades', 'horarios_clase', 'clases', 'reservas', 'asistencias', 'avisos_pendientes');
  if faltan is not null then raise exception 'Verificación: tablas sin RLS: %', faltan; end if;
end $$;
