-- 0081 · Turnos fijos: abonarse a un horario (CLA-2).
-- El socio (o la recepción) se abona a un horario de la grilla y queda
-- reservado solo cada semana mientras pueda tomar la clase. Sin cron: cuando
-- alguien mira las clases de un día (materializar_dia), se sincronizan los
-- turnos de las clases que no empezaron y están dentro de la ventana de
-- reserva: al que puede se le reserva (o queda en espera si está lleno); al
-- que ya no puede (dejó de estar al día) se le libera el lugar y sube la
-- espera. Si el socio cancela una semana, esa semana no se vuelve a reservar.
-- Lo prende el dueño (configuracion_gimnasio.turnos_fijos).
--
--   guardar_turnos_fijos(gimnasio, prendido)   el dueño
--   abonar_turno(socio, horario)               el socio o la recepción
--   quitar_turno(turno)                        el socio o la recepción
--   turnos_socio(socio)                        sus turnos
--   horarios_para_turno(socio)                 para elegir, con los lugares fijos que quedan
--   config_turnos_fijos(gimnasio)              si están prendidos (dueño y encargado)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.politica_reservas(uuid)') is null then raise exception 'Guarda: falta la migración 0080'; end if;
  if to_regprocedure('privado.habilitacion_clase(uuid, uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta privado.habilitacion_clase'; end if;
end $$;

alter table public.configuracion_gimnasio add column if not exists turnos_fijos boolean not null default false;

create table if not exists public.turnos_fijos (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  socio_id     uuid not null,
  horario_id   uuid not null,
  desde        timestamptz not null default now(),
  hasta        timestamptz,
  creado_por   uuid,
  quitado_por  uuid,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, horario_id) references public.horarios_clase (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, quitado_por) references public.equipo (gimnasio_id, id),
  check (hasta is null or hasta >= desde)
);
create unique index if not exists turnos_fijos_uno_activo on public.turnos_fijos (gimnasio_id, socio_id, horario_id) where hasta is null;
create index if not exists turnos_fijos_horario on public.turnos_fijos (horario_id) where hasta is null;
select privado.politicas_estandar('public.turnos_fijos', array['dueno', 'encargado', 'recepcion', 'profe'], null, true);
revoke all on table public.turnos_fijos from anon;
revoke truncate, references, trigger on public.turnos_fijos from authenticated;

alter table public.reservas add column if not exists turno_fijo_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reservas_turno_fijo_fk' and conrelid = 'public.reservas'::regclass) then
    alter table public.reservas add constraint reservas_turno_fijo_fk foreign key (gimnasio_id, turno_fijo_id) references public.turnos_fijos (gimnasio_id, id);
  end if;
  alter table public.reservas drop constraint if exists reservas_cancelada_por_check;
  alter table public.reservas add constraint reservas_cancelada_por_check check (cancelada_por = any (array['socio', 'equipo', 'clase_cancelada', 'turno_fijo']));
end $$;

-- Sincroniza los turnos fijos de una clase que no empezó.
create or replace function privado.sincronizar_turnos(p_clase_id uuid, p_momento timestamptz) returns void
language plpgsql set search_path = '' as $$
declare c public.clases; cfg public.configuracion_gimnasio; t record; r public.reservas; h jsonb; confirmadas int; liberado boolean := false;
begin
  select * into c from public.clases where id = p_clase_id;
  if c.horario_id is null or c.cancelada_en is not null or c.inicio <= p_momento then return; end if;
  select * into cfg from public.configuracion_gimnasio where gimnasio_id = c.gimnasio_id;
  if not cfg.turnos_fijos or cfg.modo_clases <> 'reserva' then return; end if;
  if c.inicio > p_momento + make_interval(days => cfg.reserva_dias_anticipacion) then return; end if;
  if not exists (select 1 from public.turnos_fijos tf where tf.horario_id = c.horario_id and (tf.hasta is null or tf.hasta > c.inicio)) then return; end if;
  select * into c from public.clases where id = p_clase_id for update;   -- mismo lock que reservar
  -- Los que ya no pueden: se libera el lugar.
  for r in select x.* from public.reservas x where x.clase_id = c.id and x.turno_fijo_id is not null and x.estado <> 'cancelada' loop
    h := privado.habilitacion_clase(r.socio_id, c.id, p_momento, r.id);
    if not (h ->> 'ok')::boolean then
      update public.reservas set estado = 'cancelada', cancelada_en = p_momento, cancelada_por = 'turno_fijo' where id = r.id and estado <> 'cancelada';
      liberado := true;
    end if;
  end loop;
  if liberado then perform privado.promover_espera(c.id, p_momento); end if;
  -- Los que pueden y no tienen reserva (ni la cancelaron esta semana): se reservan.
  for t in select tf.* from public.turnos_fijos tf
            where tf.horario_id = c.horario_id and tf.desde <= c.inicio and (tf.hasta is null or tf.hasta > c.inicio)
              -- Si esta semana la canceló él (o el equipo), no se vuelve a reservar; si se liberó porque no podía, sí.
              and not exists (select 1 from public.reservas x where x.clase_id = c.id and x.socio_id = tf.socio_id
                                and not (x.estado = 'cancelada' and x.cancelada_por = 'turno_fijo'))
            order by tf.desde loop
    h := privado.habilitacion_clase(t.socio_id, c.id, p_momento);
    continue when not (h ->> 'ok')::boolean;
    select count(*) into confirmadas from public.reservas where clase_id = c.id and estado = 'confirmada';
    insert into public.reservas (gimnasio_id, clase_id, socio_id, estado, pack_id, turno_fijo_id)
    values (c.gimnasio_id, c.id, t.socio_id, case when c.cupo is null or confirmadas < c.cupo then 'confirmada' else 'espera' end,
            (h ->> 'pack_id')::uuid, t.id);
  end loop;
end $$;
revoke all on function privado.sincronizar_turnos(uuid, timestamptz) from public;

-- Copia de 0011: además de crear las clases del día, sincroniza los turnos fijos.
create or replace function privado.materializar_dia(p_sede_id uuid, p_dia date) returns void
language plpgsql set search_path = '' as $$
declare s public.sedes; zona text; k record;
begin
  select * into s from public.sedes where id = p_sede_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = s.gimnasio_id;
  insert into public.clases (gimnasio_id, sede_id, horario_id, actividad_id, inicio, fin, cupo, profe_id,
                             cancelada_en, cancelada_motivo, cierre_id)
  select h.gimnasio_id, h.sede_id, h.id, h.actividad_id,
         (p_dia + h.hora_inicio) at time zone zona,
         (p_dia + h.hora_inicio) at time zone zona + make_interval(mins => h.duracion_min),
         h.cupo, h.profe_id,
         case when ci.id is not null then now() end,
         case when ci.id is not null then 'Gimnasio cerrado: ' || ci.motivo end,
         ci.id
    from public.horarios_clase h
    join public.actividades a on a.id = h.actividad_id and a.activa
    left join lateral (
      select x.id, x.motivo from public.cierres x
       where x.gimnasio_id = h.gimnasio_id and x.anulado_en is null and (x.sede_id is null or x.sede_id = h.sede_id)
         and x.desde < (p_dia + h.hora_inicio) at time zone zona + make_interval(mins => h.duracion_min)
         and x.hasta > (p_dia + h.hora_inicio) at time zone zona
       order by x.creado_en limit 1
    ) ci on true
   where h.sede_id = p_sede_id and h.dia_semana = extract(isodow from p_dia)
     and h.vigente_desde <= p_dia and (h.vigente_hasta is null or h.vigente_hasta >= p_dia)
  on conflict (gimnasio_id, horario_id, inicio) where horario_id is not null do nothing;
  -- CLA-2: los turnos fijos de las clases de ese día que todavía no empezaron.
  if exists (select 1 from public.configuracion_gimnasio cg where cg.gimnasio_id = s.gimnasio_id and cg.turnos_fijos) then
    for k in select c.id from public.clases c
              where c.sede_id = p_sede_id and c.horario_id is not null and c.cancelada_en is null and c.inicio > now()
                and c.inicio >= privado.medianoche(p_dia, zona) and c.inicio < privado.medianoche(p_dia + 1, zona) loop
      perform privado.sincronizar_turnos(k.id, now());
    end loop;
  end if;
end $$;
revoke all on function privado.materializar_dia(uuid, date) from public;

create or replace function public.guardar_turnos_fijos(p_gimnasio_id uuid, p_prendido boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno']);
  update public.configuracion_gimnasio set turnos_fijos = coalesce(p_prendido, false), actualizado_en = now() where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar'; end if;
end $$;

-- Quién puede tocar los turnos de un socio: él o el mostrador.
create or replace function privado.exigir_turno(p_socio_id uuid) returns uuid
language plpgsql set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_socio_id in (select privado.mis_socios()) then return null; end if;
  return privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion']);
end $$;
revoke all on function privado.exigir_turno(uuid) from public;

create or replace function public.abonar_turno(p_socio_id uuid, p_horario_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare eid uuid; h public.horarios_clase; cfg public.configuracion_gimnasio; tid uuid; ocupados int; zona text; d date; k record;
begin
  eid := privado.exigir_turno(p_socio_id);
  select * into h from public.horarios_clase where id = p_horario_id for update;
  if not found or h.gimnasio_id <> (select gimnasio_id from public.socios where id = p_socio_id) then
    raise exception 'Ese horario no es de este gimnasio' using errcode = '42501';
  end if;
  select * into cfg from public.configuracion_gimnasio where gimnasio_id = h.gimnasio_id;
  if not cfg.turnos_fijos or cfg.modo_clases <> 'reserva' then raise exception 'Este gimnasio no tiene turnos fijos' using errcode = '22023'; end if;
  if h.vigente_hasta is not null and h.vigente_hasta < current_date then raise exception 'Ese horario ya no está en la grilla' using errcode = '22023'; end if;
  if exists (select 1 from public.turnos_fijos where socio_id = p_socio_id and horario_id = h.id and hasta is null) then
    raise exception 'Ya tenés ese turno fijo' using errcode = '22023';
  end if;
  select count(*) into ocupados from public.turnos_fijos where horario_id = h.id and hasta is null;
  if h.cupo is not null and ocupados >= h.cupo then raise exception 'Ese horario ya tiene todos los lugares fijos tomados' using errcode = '22023'; end if;
  insert into public.turnos_fijos (gimnasio_id, socio_id, horario_id, creado_por) values (h.gimnasio_id, p_socio_id, h.id, eid) returning id into tid;
  -- Las clases que ya existen en la ventana de reserva se reservan ahora.
  select g.zona_horaria into zona from public.gimnasios g where g.id = h.gimnasio_id;
  for d in select generate_series(privado.dia_local(now(), zona), privado.dia_local(now(), zona) + cfg.reserva_dias_anticipacion, interval '1 day')::date loop
    if extract(isodow from d) = h.dia_semana then perform privado.materializar_dia(h.sede_id, d); end if;
  end loop;
  return tid;
end $$;

-- Quitar el turno: las próximas reservas que salieron de él se cancelan (y sube la espera).
create or replace function public.quitar_turno(p_turno_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.turnos_fijos; eid uuid; r record; n int;
begin
  select * into t from public.turnos_fijos where id = p_turno_id for update;
  if not found then raise exception 'Sin permiso o turno inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_turno(t.socio_id);
  if t.hasta is not null then raise exception 'Ese turno ya estaba quitado' using errcode = '22023'; end if;
  update public.turnos_fijos set hasta = now(), quitado_por = eid where id = t.id and hasta is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo quitar el turno'; end if;
  for r in select x.id, x.clase_id from public.reservas x join public.clases c on c.id = x.clase_id
            where x.turno_fijo_id = t.id and x.estado <> 'cancelada' and c.inicio > now() loop
    perform privado.cancelar_reserva(r.id, case when eid is null then 'socio' else 'equipo' end, true, now());
  end loop;
end $$;

create or replace function public.turnos_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_socio_id not in (select privado.mis_socios()) then perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion', 'profe']); end if;
  return jsonb_build_object(
    'prendido', (select cg.turnos_fijos and cg.modo_clases = 'reserva' from public.configuracion_gimnasio cg where cg.gimnasio_id = g),
    'turnos', coalesce((select jsonb_agg(jsonb_build_object('turno_id', t.id, 'horario_id', h.id, 'actividad', a.nombre, 'emoji', a.emoji,
                 'dia_semana', h.dia_semana, 'hora', to_char(h.hora_inicio, 'HH24:MI'), 'desde', t.desde) order by h.dia_semana, h.hora_inicio)
               from public.turnos_fijos t join public.horarios_clase h on h.id = t.horario_id join public.actividades a on a.id = h.actividad_id
              where t.socio_id = p_socio_id and t.hasta is null), '[]'::jsonb));
end $$;


-- Para elegir: los horarios de la grilla con cuántos lugares fijos quedan.
create or replace function public.horarios_para_turno(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_socio_id not in (select privado.mis_socios()) then perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']); end if;
  return coalesce((select jsonb_agg(jsonb_build_object('horario_id', h.id, 'actividad', a.nombre, 'emoji', a.emoji, 'dia_semana', h.dia_semana,
             'hora', to_char(h.hora_inicio, 'HH24:MI'), 'sede', s.nombre,
             'libres', case when h.cupo is null then null else h.cupo - (select count(*) from public.turnos_fijos t where t.horario_id = h.id and t.hasta is null) end)
             order by h.dia_semana, h.hora_inicio)
    from public.horarios_clase h join public.actividades a on a.id = h.actividad_id and a.activa join public.sedes s on s.id = h.sede_id
   where h.gimnasio_id = g and (h.vigente_hasta is null or h.vigente_hasta >= current_date)
     and not exists (select 1 from public.turnos_fijos t where t.horario_id = h.id and t.socio_id = p_socio_id and t.hasta is null)), '[]'::jsonb);
end $$;

create or replace function public.config_turnos_fijos(p_gimnasio_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return (select turnos_fijos from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id);
end $$;

revoke all on function public.horarios_para_turno(uuid), public.config_turnos_fijos(uuid) from public, anon, authenticated;
grant execute on function public.horarios_para_turno(uuid), public.config_turnos_fijos(uuid) to authenticated, service_role;

revoke all on function public.guardar_turnos_fijos(uuid, boolean), public.abonar_turno(uuid, uuid), public.quitar_turno(uuid), public.turnos_socio(uuid)
  from public, anon, authenticated;
grant execute on function public.guardar_turnos_fijos(uuid, boolean), public.abonar_turno(uuid, uuid), public.quitar_turno(uuid), public.turnos_socio(uuid)
  to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.turnos_fijos'::regclass) then raise exception 'Verificación: turnos_fijos sin RLS'; end if;
  foreach f in array array['public.guardar_turnos_fijos(uuid, boolean)', 'public.abonar_turno(uuid, uuid)', 'public.quitar_turno(uuid)', 'public.turnos_socio(uuid)',
                           'privado.sincronizar_turnos(uuid, timestamptz)', 'privado.materializar_dia(uuid, date)', 'privado.exigir_turno(uuid)',
                           'public.horarios_para_turno(uuid)', 'public.config_turnos_fijos(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if exists (select 1 from public.configuracion_gimnasio where turnos_fijos) then raise exception 'Verificación: los turnos fijos arrancan apagados'; end if;
end $$;
