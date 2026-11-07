-- VD-9 (1/2) · La caja por turno se cierra sola, sin cron (D20).
-- Una caja abierta que pasó la hora de corte del gimnasio (por defecto 00:00) o
-- que lleva más de N horas abierta (por defecto 14) ES una caja "sin contar":
-- se CALCULA cuando alguien mira o cobra, no depende de ningún cron.
--   · nadie puede cobrar ni anotar plata en ella (trigger sobre pagos, ventas y
--     movimientos_caja: la base manda, no la pantalla);
--   · al primer acceso (abrir otra caja, o el dueño mirando Caja) queda
--     registrada como cerrada "sin contar", con el esperado calculado y nadie
--     como responsable del conteo;
--   · el dueño o el encargado la cuenta después, o la deja así con un motivo.
-- No se tocan public.vender ni privado.vender: el candado vive en los triggers.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.turnos_caja') is null then raise exception 'Guarda: falta turnos_caja'; end if;
  if to_regprocedure('privado.resumen_turno(uuid)') is null then raise exception 'Guarda: falta privado.resumen_turno'; end if;
  if to_regprocedure('privado.politicas_estandar(regclass, text[], text[], boolean)') is null then raise exception 'Guarda: falta privado.politicas_estandar'; end if;
  if to_regprocedure('privado.exigir_rol(uuid, text[], uuid)') is null then raise exception 'Guarda: falta privado.exigir_rol'; end if;
end $$;

-- ── Cómo cierra cada gimnasio ───────────────────────────────────────
-- Una fila por gimnasio; sin fila valen los valores por defecto de abajo.
create table if not exists public.configuracion_caja (
  gimnasio_id      uuid primary key references public.gimnasios(id),
  modo             text not null default 'por_turno' check (modo in ('por_turno', 'una_por_dia')),
  pedir_billetes   boolean not null default false,
  fondo_fijo       numeric(12,2) not null default 0 check (fondo_fijo >= 0),
  hora_corte       time not null default '00:00',
  horas_max        int not null default 14 check (horas_max between 1 and 48),
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid,
  foreign key (gimnasio_id, actualizado_por) references public.equipo (gimnasio_id, id)
);
select privado.politicas_estandar('public.configuracion_caja', null, '{}');
revoke all on table public.configuracion_caja from anon;
revoke truncate, references, trigger on public.configuracion_caja from authenticated;

-- ── Lo que se anota de un turno que se cerró sola o se contó después ─
alter table public.turnos_caja add column if not exists sin_contar boolean not null default false;
alter table public.turnos_caja add column if not exists sin_contar_en timestamptz;     -- cuándo lo registró el sistema
alter table public.turnos_caja add column if not exists contado_en timestamptz;        -- cuándo se contó (cierre normal o después)
alter table public.turnos_caja add column if not exists billetes jsonb;                -- conteo por billete, si se usó la calculadora
alter table public.turnos_caja add column if not exists revisado_en timestamptz;       -- el dueño lo contó o lo dejó así
alter table public.turnos_caja add column if not exists revisado_por uuid;
alter table public.turnos_caja add column if not exists revisado_nota text;            -- motivo de dejarla sin contar
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'turnos_caja_revisado_por_fk') then
    alter table public.turnos_caja add constraint turnos_caja_revisado_por_fk
      foreign key (gimnasio_id, revisado_por) references public.equipo (gimnasio_id, id);
  end if;
end $$;

-- El check original (0003) exigía contado y responsable siempre que hubiera cierre.
-- Un cierre "sin contar" no tiene ni uno ni otro hasta que alguien la cuenta.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.turnos_caja'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%cerrado_en IS NULL%monto_contado IS NULL%' loop
    execute format('alter table public.turnos_caja drop constraint %I', c.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'turnos_caja_conteo') then
    alter table public.turnos_caja add constraint turnos_caja_conteo check (
         (cerrado_en is null and monto_contado is null and cerrado_por is null and not sin_contar)
      or (cerrado_en is not null and not sin_contar and monto_contado is not null and cerrado_por is not null)
      or (cerrado_en is not null and sin_contar and ((monto_contado is null) = (cerrado_por is null))));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'turnos_caja_sin_contar_registrada') then
    alter table public.turnos_caja add constraint turnos_caja_sin_contar_registrada
      check (not sin_contar or sin_contar_en is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'turnos_caja_revisado_completo') then
    alter table public.turnos_caja add constraint turnos_caja_revisado_completo
      check ((revisado_en is null) = (revisado_por is null));
  end if;
end $$;

-- ── Cuándo se vence un turno ────────────────────────────────────────
-- Día de caja: el día calendario del gimnasio corrido por la hora de corte.
create or replace function privado.dia_caja(p_momento timestamptz, p_zona text, p_corte time) returns date
language sql stable parallel safe set search_path = '' as $$
  select ((p_momento at time zone p_zona) - p_corte::interval)::date
$$;
revoke all on function privado.dia_caja(timestamptz, text, time) from public;

-- El instante en que un turno abierto pasa a "sin contar": el primero entre el
-- próximo corte y (en modo por turno) las N horas. Null si el turno ya cerró.
create or replace function privado.turno_vence(p_turno_id uuid) returns timestamptz
language sql stable set search_path = '' as $$
  select case when t.cerrado_en is not null then null else least(
           (((privado.dia_caja(t.abierto_en, g.zona_horaria, coalesce(k.hora_corte, time '00:00')) + 1)::timestamp
              + coalesce(k.hora_corte, time '00:00')::interval) at time zone g.zona_horaria),
           case when coalesce(k.modo, 'por_turno') = 'por_turno'
                then t.abierto_en + make_interval(hours => coalesce(k.horas_max, 14))
                else 'infinity'::timestamptz end) end
    from public.turnos_caja t
    join public.gimnasios g on g.id = t.gimnasio_id
    left join public.configuracion_caja k on k.gimnasio_id = t.gimnasio_id
   where t.id = p_turno_id
$$;
revoke all on function privado.turno_vence(uuid) from public;

-- ── Registrar el cierre "sin contar" (al primer acceso) ─────────────
-- Idempotente y sin carreras: el UPDATE vuelve a mirar la fila si alguien la
-- estaba cerrando en el mismo instante.
create or replace function privado.cerrar_cajas_vencidas(p_gimnasio_id uuid) returns int
language plpgsql set search_path = '' as $$
declare n int;
begin
  update public.turnos_caja t
     set cerrado_en = privado.turno_vence(t.id), sin_contar = true, sin_contar_en = now(),
         monto_esperado = (privado.resumen_turno(t.id) ->> 'esperado')::numeric
   where t.gimnasio_id = p_gimnasio_id and t.cerrado_en is null and privado.turno_vence(t.id) <= now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function privado.cerrar_cajas_vencidas(uuid) from public;

-- ── Candado: en una caja sin contar nadie cobra ni anota plata ──────
create or replace function privado.exigir_turno_usable() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v timestamptz;
begin
  if new.turno_caja_id is null then return new; end if;
  select privado.turno_vence(t.id) into v from public.turnos_caja t where t.id = new.turno_caja_id;
  if v is not null and v <= now() then
    raise exception 'Esa caja quedó abierta de otro día y está sin contar: nadie puede cobrar en ella. Abrí tu turno desde Caja (la otra la cuenta el dueño después)'
      using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function privado.exigir_turno_usable() from public;

drop trigger if exists turno_usable on public.pagos;
create trigger turno_usable before insert on public.pagos for each row execute function privado.exigir_turno_usable();
drop trigger if exists turno_usable on public.ventas;
create trigger turno_usable before insert on public.ventas for each row execute function privado.exigir_turno_usable();
drop trigger if exists turno_usable on public.movimientos_caja;
create trigger turno_usable before insert on public.movimientos_caja for each row execute function privado.exigir_turno_usable();

-- ── El resumen del turno, con su estado ─────────────────────────────
create or replace function privado.resumen_turno(p_turno_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  with t as (select * from public.turnos_caja where id = p_turno_id),
  pagos as (
    select p.medio, sum(p.monto) as total, count(*) as cantidad
      from public.pagos p
     where p.turno_caja_id = p_turno_id and p.estado = 'aprobado'
     group by p.medio
  ), pagos_mostrador as (
    -- lo cobrado en este turno con otros medios (no entra al cajón, pero se informa)
    select p.medio, sum(p.monto) as total, count(*) as cantidad
      from public.pagos p join public.ventas v on v.id = p.venta_id
     where v.turno_caja_id = p_turno_id and p.turno_caja_id is null and p.estado = 'aprobado'
     group by p.medio
  ), mov as (
    select coalesce(sum(m.monto) filter (where m.tipo = 'ingreso'), 0) as ingresos,
           coalesce(sum(m.monto) filter (where m.tipo = 'retiro'), 0) as retiros
      from public.movimientos_caja m where m.turno_caja_id = p_turno_id
  )
  select jsonb_build_object(
    'turno_id', t.id,
    'abierto_en', t.abierto_en,
    'cerrado_en', t.cerrado_en,
    'monto_inicial', t.monto_inicial,
    'efectivo', coalesce((select total from pagos where medio = 'efectivo'), 0),
    'ingresos', mov.ingresos,
    'retiros', mov.retiros,
    -- cerrado: la foto del cierre (lo que se contó contra qué). Abierto: en vivo.
    'esperado', coalesce(t.monto_esperado,
                         t.monto_inicial + coalesce((select total from pagos where medio = 'efectivo'), 0) + mov.ingresos - mov.retiros),
    'contado', t.monto_contado,
    'diferencia', case when t.monto_contado is not null then t.monto_contado - t.monto_esperado end,
    'otros_medios', coalesce((select jsonb_object_agg(medio, total) from pagos_mostrador), '{}'::jsonb),
    -- abierto · sin_contar (se cerró sola o ya pasó su hora) · sin_contar_dejada · contada_despues · cerrado
    'estado', case
                when t.cerrado_en is null then case when privado.turno_vence(t.id) <= now() then 'sin_contar' else 'abierto' end
                when t.sin_contar and t.monto_contado is null then case when t.revisado_en is not null then 'sin_contar_dejada' else 'sin_contar' end
                when t.sin_contar then 'contada_despues'
                else 'cerrado' end,
    'sin_contar', t.sin_contar,
    'billetes', t.billetes,
    'revisado_nota', t.revisado_nota
  )
  from t, mov
$$;
revoke all on function privado.resumen_turno(uuid) from public;

-- ── Billetes: la suma tiene que dar lo contado ──────────────────────
-- {"20000": 3, "1000": 5, "otros": 350} → billetes por denominación y monedas sueltas.
create or replace function privado.validar_billetes(p_billetes jsonb, p_contado numeric, p_gimnasio_id uuid) returns void
language plpgsql stable set search_path = '' as $$
declare k text; v jsonb; suma numeric := 0; pedir boolean;
begin
  select coalesce(c.pedir_billetes, false) into pedir from (select 1) x left join public.configuracion_caja c on c.gimnasio_id = p_gimnasio_id;
  if p_billetes is null then
    if pedir then raise exception 'Este gimnasio pide contar los billetes: usá la calculadora de billetes' using errcode = '22023'; end if;
    return;
  end if;
  if jsonb_typeof(p_billetes) <> 'object' then raise exception 'El conteo de billetes es inválido' using errcode = '22023'; end if;
  for k, v in select * from jsonb_each(p_billetes) loop
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric < 0 then raise exception 'El conteo de billetes es inválido' using errcode = '22023'; end if;
    if k = 'otros' then suma := suma + (v #>> '{}')::numeric;
    elsif k ~ '^[0-9]{1,6}$' and (v #>> '{}')::numeric = trunc((v #>> '{}')::numeric) then suma := suma + k::numeric * (v #>> '{}')::numeric;
    else raise exception 'El conteo de billetes es inválido' using errcode = '22023'; end if;
  end loop;
  if abs(suma - p_contado) > 0.009 then
    raise exception 'Los billetes suman % y escribiste %', privado.formato_pesos(suma), privado.formato_pesos(p_contado) using errcode = '22023';
  end if;
end $$;
revoke all on function privado.validar_billetes(jsonb, numeric, uuid) from public;

-- ── Abrir un turno (ahora registra las cajas sin contar y respeta "una por día") ─
create or replace function public.abrir_caja(p_caja_id uuid, p_monto_inicial numeric) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.cajas; eid uuid; tid uuid; otra record; zona text; k public.configuracion_caja;
begin
  select * into c from public.cajas where id = p_caja_id;
  if not found then raise exception 'Sin permiso o caja inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(c.gimnasio_id, array['dueno', 'encargado', 'recepcion'], c.sede_id);
  if not c.activa then raise exception 'La caja % está desactivada', c.nombre; end if;
  if p_monto_inicial is null or p_monto_inicial < 0 then raise exception 'El monto inicial no puede ser negativo'; end if;
  perform pg_advisory_xact_lock(hashtextextended('gymos:caja:' || c.id::text, 0));
  -- D20: lo que quedó abierto de otro día (o pasadas las N horas) queda registrado como sin contar.
  perform privado.cerrar_cajas_vencidas(c.gimnasio_id);
  if exists (select 1 from public.turnos_caja where caja_id = c.id and cerrado_en is null) then
    raise exception 'La caja % ya está abierta', c.nombre;
  end if;
  select * into k from public.configuracion_caja where gimnasio_id = c.gimnasio_id;
  select zona_horaria into zona from public.gimnasios where id = c.gimnasio_id;
  if coalesce(k.modo, 'por_turno') = 'una_por_dia' and exists (
       select 1 from public.turnos_caja t where t.caja_id = c.id
          and privado.dia_caja(t.abierto_en, zona, coalesce(k.hora_corte, time '00:00')) = privado.dia_caja(now(), zona, coalesce(k.hora_corte, time '00:00'))) then
    raise exception 'La caja % ya se usó hoy: este gimnasio tiene una sola caja por día', c.nombre using errcode = '22023';
  end if;
  -- CAJ-5: quien tiene una caja abierta la cierra antes de abrir otra.
  select cc.nombre, t.abierto_en into otra from public.turnos_caja t join public.cajas cc on cc.id = t.caja_id
   where t.gimnasio_id = c.gimnasio_id and t.abierto_por = eid and t.cerrado_en is null limit 1;
  if found then
    raise exception 'Tenés abierta la % desde el %: contá la plata y cerrala antes de abrir otra',
      otra.nombre, to_char(otra.abierto_en at time zone zona, 'DD/MM HH24:MI') using errcode = '22023';
  end if;
  insert into public.turnos_caja (gimnasio_id, caja_id, abierto_por, monto_inicial)
  values (c.gimnasio_id, c.id, eid, round(p_monto_inicial, 2)) returning id into tid;
  return tid;
end $$;

-- ── Cerrar mi turno (arqueo ciego) ──────────────────────────────────
-- La firma cambia (billetes): la vieja se borra, dos versiones harían ambigua la llamada.
drop function if exists public.cerrar_caja(uuid, numeric, text);
create or replace function public.cerrar_caja(p_turno_id uuid, p_monto_contado numeric, p_nota text default null, p_billetes jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.turnos_caja; c public.cajas; eid uuid; r jsonb; n int; vence timestamptz;
begin
  select * into t from public.turnos_caja where id = p_turno_id for update;
  if not found then raise exception 'Sin permiso o turno inexistente' using errcode = '42501'; end if;
  select * into c from public.cajas where id = t.caja_id;
  eid := privado.exigir_rol(t.gimnasio_id, array['dueno', 'encargado', 'recepcion'], c.sede_id);
  if t.cerrado_en is not null then
    if t.sin_contar and t.monto_contado is null and t.revisado_en is null then
      raise exception 'Esa caja se cerró sola (quedó abierta de otro día): la cuenta el dueño o el encargado desde Caja, en “Para revisar”' using errcode = '22023';
    end if;
    raise exception 'El turno ya estaba cerrado';
  end if;
  if p_monto_contado is null or p_monto_contado < 0 then raise exception 'El monto contado no puede ser negativo'; end if;
  perform privado.validar_billetes(p_billetes, round(p_monto_contado, 2), t.gimnasio_id);
  vence := privado.turno_vence(t.id);
  r := privado.resumen_turno(t.id);
  if vence <= now() then
    -- Ya pasó su hora: quien la abrió (o el dueño/encargado) puede contarla ahora; queda anotado que se cerró sola.
    if t.abierto_por <> eid and not exists (select 1 from public.equipo where id = eid and rol in ('dueno', 'encargado')) then
      raise exception 'Sin permiso para contar la caja de otra persona' using errcode = '42501';
    end if;
    update public.turnos_caja
       set cerrado_en = vence, sin_contar = true, sin_contar_en = now(), monto_esperado = (r ->> 'esperado')::numeric,
           cerrado_por = eid, monto_contado = round(p_monto_contado, 2), contado_en = now(), billetes = p_billetes,
           revisado_en = now(), revisado_por = eid, nota = nullif(trim(coalesce(p_nota, '')), '')
     where id = t.id and cerrado_en is null;
  else
    update public.turnos_caja
       set cerrado_en = now(), cerrado_por = eid, monto_contado = round(p_monto_contado, 2), contado_en = now(), billetes = p_billetes,
           monto_esperado = (r ->> 'esperado')::numeric, nota = nullif(trim(coalesce(p_nota, '')), '')
     where id = t.id and cerrado_en is null;
  end if;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo cerrar el turno'; end if;
  return privado.resumen_turno(t.id);
end $$;

-- ── Cajas de una sede: ahora dice cuál quedó vencida ────────────────
drop function if exists public.cajas_sede(uuid);
create or replace function public.cajas_sede(p_sede_id uuid)
returns table (caja_id uuid, nombre text, activa boolean, turno_id uuid, abierta_en timestamptz, abierta_por text, vencida boolean)
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], p_sede_id);
  return query
    select c.id, c.nombre, c.activa, t.id, t.abierto_en, e.nombre, coalesce(privado.turno_vence(t.id) <= now(), false)
      from public.cajas c
      left join public.turnos_caja t on t.caja_id = c.id and t.cerrado_en is null
      left join public.equipo e on e.id = t.abierto_por
     where c.sede_id = p_sede_id
     order by c.activa desc, c.nombre;
end $$;

revoke all on function public.abrir_caja(uuid, numeric), public.cerrar_caja(uuid, numeric, text, jsonb), public.cajas_sede(uuid)
  from public, anon, authenticated;
grant execute on function public.abrir_caja(uuid, numeric), public.cerrar_caja(uuid, numeric, text, jsonb), public.cajas_sede(uuid)
  to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.configuracion_caja'::regclass) then raise exception 'Verificación: configuracion_caja sin RLS'; end if;
  foreach f in array array['public.abrir_caja(uuid, numeric)', 'public.cerrar_caja(uuid, numeric, text, jsonb)', 'public.cajas_sede(uuid)',
                           'privado.turno_vence(uuid)', 'privado.cerrar_cajas_vencidas(uuid)', 'privado.exigir_turno_usable()',
                           'privado.resumen_turno(uuid)', 'privado.validar_billetes(jsonb, numeric, uuid)', 'privado.dia_caja(timestamptz, text, time)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if to_regprocedure('public.cerrar_caja(uuid, numeric, text)') is not null then raise exception 'Verificación: quedó la firma vieja de cerrar_caja'; end if;
  if (select count(*) from pg_trigger where tgname = 'turno_usable' and not tgisinternal) <> 3 then raise exception 'Verificación: faltan los candados de caja sin contar'; end if;
end $$;
