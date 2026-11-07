-- VD-53 · Fichaje del equipo con PIN (D15). La recepción y los profes marcan entrada y salida; las horas del mes salen de ahí.
--   configuracion_fichaje       si el gimnasio usa fichaje (por defecto NO) y a las cuántas horas una entrada olvidada se cierra sola
--   fichajes                    un turno por fila: quién, sede, entrada y salida. Hecho inmutable: la salida se pone una sola vez y lo demás no se toca
--   correcciones_fichaje        el dueño corrige un turno con motivo; queda cada versión (quién, cuándo, antes y después). Nada se borra
--   privado.fichajes_efectivos  UNA sola fuente: el turno ya con la última corrección y su estado (cerrado, abierto, sin_salida, anulado)
--   fichar / fichar_con_pin     la persona marca; con PIN puesto en la compu, vale quien puso el PIN (no una sesión compartida)
--   mi_fichaje / mis_horas      lo MÍO (cada uno ve solo lo suyo)
--   horas_equipo / fichajes_persona   dueño y encargado ven las horas de todos
--   config_fichaje / guardar_config_fichaje / corregir_fichaje / anular_fichaje   configurar y corregir: solo el dueño
-- Nada depende de un cron: una entrada que pasó el tope de horas se ve "sin salida" al consultar, y no suma horas hasta que el
-- dueño la corrige (en plata, lo más restrictivo). Al siguiente fichaje de esa persona la entrada vieja queda cerrada en el tope.
-- La liquidación de profes (VD-52) toma las horas del fichaje si la persona fichó en el mes; si no, las cargadas a mano.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.equipo') is null or to_regclass('public.sedes') is null then raise exception 'Guarda: faltan equipo o sedes'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta exigir_equipo'; end if;
  if to_regprocedure('privado.operador(uuid)') is null then raise exception 'Guarda: falta el PIN del equipo (0071)'; end if;
  if to_regprocedure('privado.liquidacion_calculo(uuid, date, uuid)') is null then raise exception 'Guarda: falta la liquidación de profes (VD-52)'; end if;
  if to_regprocedure('privado.medianoche(date, text)') is null then raise exception 'Guarda: falta medianoche'; end if;
  if to_regprocedure('privado.hecho_inmutable()') is null then raise exception 'Guarda: falta hecho_inmutable'; end if;
end $$;

-- ── Tablas ──────────────────────────────────────────────────────────
create table if not exists public.configuracion_fichaje (
  gimnasio_id    uuid primary key references public.gimnasios(id),
  usa            boolean not null default false,
  tope_horas     int not null default 12 check (tope_horas between 1 and 24),
  actualizado_en timestamptz not null default now()
);
select privado.politicas_estandar('public.configuracion_fichaje', array['dueno'], '{}');
revoke all on table public.configuracion_fichaje from anon;
revoke all on table public.configuracion_fichaje from authenticated;   -- todo por funciones

create table if not exists public.fichajes (
  id             uuid primary key default gen_random_uuid(),
  gimnasio_id    uuid not null references public.gimnasios(id),
  equipo_id      uuid not null,
  sede_id        uuid,
  entrada_en     timestamptz not null default now(),
  salida_en      timestamptz,
  cierre         text check (cierre in ('manual', 'automatico')),
  anulado_en     timestamptz,
  anulado_por    uuid,
  anulado_motivo text,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, equipo_id) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  foreign key (gimnasio_id, anulado_por) references public.equipo (gimnasio_id, id),
  check (salida_en is null or salida_en > entrada_en),
  check ((salida_en is null) = (cierre is null)),
  check ((anulado_en is null) = (anulado_motivo is null))
);
-- Una sola entrada abierta por persona (dos pestañas o dos clics no abren dos turnos).
create unique index if not exists fichajes_uno_abierto on public.fichajes (gimnasio_id, equipo_id) where salida_en is null and anulado_en is null;
create index if not exists fichajes_persona on public.fichajes (gimnasio_id, equipo_id, entrada_en);
select privado.politicas_estandar('public.fichajes', array['dueno'], '{}');
revoke all on table public.fichajes from anon;
revoke all on table public.fichajes from authenticated;   -- todo por funciones
drop trigger if exists fichajes_inmutable on public.fichajes;
create trigger fichajes_inmutable before update or delete on public.fichajes
  for each row execute function privado.hecho_inmutable('salida_en', 'cierre', 'anulado_en', 'anulado_por', 'anulado_motivo');

-- La salida se pone una sola vez: después de puesta, solo se puede anular (con motivo).
create or replace function privado.fichaje_salida_una_vez() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.salida_en is not null and (new.salida_en is distinct from old.salida_en or new.cierre is distinct from old.cierre) then
    raise exception 'La salida de un fichaje no se cambia: se corrige con motivo' using errcode = 'check_violation';
  end if;
  if old.anulado_en is not null and new.anulado_en is distinct from old.anulado_en then
    raise exception 'Ese fichaje ya estaba anulado' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function privado.fichaje_salida_una_vez() from public;
drop trigger if exists fichajes_salida_una_vez on public.fichajes;
create trigger fichajes_salida_una_vez before update on public.fichajes
  for each row execute function privado.fichaje_salida_una_vez();

create table if not exists public.correcciones_fichaje (
  id             uuid primary key default gen_random_uuid(),
  gimnasio_id    uuid not null references public.gimnasios(id),
  fichaje_id     uuid not null,
  entrada_antes  timestamptz not null,
  salida_antes   timestamptz,
  entrada_nueva  timestamptz not null,
  salida_nueva   timestamptz not null,
  motivo         text not null check (length(trim(motivo)) > 0),
  corregido_por  uuid not null,
  corregido_en   timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, fichaje_id) references public.fichajes (gimnasio_id, id),
  foreign key (gimnasio_id, corregido_por) references public.equipo (gimnasio_id, id),
  check (salida_nueva > entrada_nueva)
);
create index if not exists correcciones_fichaje_turno on public.correcciones_fichaje (gimnasio_id, fichaje_id, corregido_en desc);
select privado.politicas_estandar('public.correcciones_fichaje', array['dueno'], '{}');
revoke all on table public.correcciones_fichaje from anon;
revoke all on table public.correcciones_fichaje from authenticated;   -- todo por funciones
drop trigger if exists correcciones_fichaje_inmutable on public.correcciones_fichaje;
create trigger correcciones_fichaje_inmutable before update or delete on public.correcciones_fichaje
  for each row execute function privado.hecho_inmutable();

-- ── El cálculo (una sola fuente) ────────────────────────────────────
-- Los turnos cuya entrada (ya corregida) cae en [p_desde, p_hasta), con su estado a la hora p_ahora.
--   abierto     entró y todavía está dentro del tope: no suma horas hasta que salga
--   sin_salida  pasó el tope sin salida (o se cerró sola en el tope): no suma horas hasta que el dueño la corrija
--   cerrado     entrada y salida (o corregido): suma sus minutos
--   anulado     no cuenta
create or replace function privado.fichajes_efectivos(p_gimnasio_id uuid, p_equipo_id uuid, p_desde timestamptz, p_hasta timestamptz, p_ahora timestamptz default now())
returns table (id uuid, equipo_id uuid, sede_id uuid, entrada_en timestamptz, salida_en timestamptz, estado text, minutos int, corregido boolean, corregido_motivo text, anulado_motivo text)
language plpgsql stable set search_path = '' as $$
declare v_tope int;
begin
  select coalesce((select c.tope_horas from public.configuracion_fichaje c where c.gimnasio_id = p_gimnasio_id), 12) into v_tope;
  return query
  select x.id, x.equipo_id, x.sede_id, x.ent, x.sal, x.estado,
         case when x.estado = 'cerrado' then round(extract(epoch from (x.sal - x.ent)) / 60)::int else 0 end,
         x.corregido, x.motivo, x.anulado_motivo
    from (
      select f.id, f.equipo_id, f.sede_id,
             coalesce(c.entrada_nueva, f.entrada_en) as ent,
             case when c.id is not null then c.salida_nueva
                  else coalesce(f.salida_en, case when p_ahora >= f.entrada_en + make_interval(hours => v_tope) then f.entrada_en + make_interval(hours => v_tope) end) end as sal,
             case when f.anulado_en is not null then 'anulado'
                  when c.id is not null then 'cerrado'
                  when f.cierre = 'automatico' then 'sin_salida'
                  when f.salida_en is not null then 'cerrado'
                  when p_ahora >= f.entrada_en + make_interval(hours => v_tope) then 'sin_salida'
                  else 'abierto' end as estado,
             (c.id is not null) as corregido, c.motivo, f.anulado_motivo
        from public.fichajes f
        left join lateral (select cc.id, cc.entrada_nueva, cc.salida_nueva, cc.motivo from public.correcciones_fichaje cc
                            where cc.gimnasio_id = f.gimnasio_id and cc.fichaje_id = f.id order by cc.corregido_en desc, cc.id desc limit 1) c on true
       where f.gimnasio_id = p_gimnasio_id and (p_equipo_id is null or f.equipo_id = p_equipo_id)
    ) x
   where x.ent >= p_desde and x.ent < p_hasta;
end $$;
revoke all on function privado.fichajes_efectivos(uuid, uuid, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;

-- Las horas del mes de una persona: ¿ficha?, minutos que suman, turnos sin salida. La usa la liquidación de profes.
create or replace function privado.fichaje_mes(p_gimnasio_id uuid, p_equipo_id uuid, p_mes date, p_ahora timestamptz default now())
returns table (hay boolean, minutos int, sin_salida int)
language plpgsql stable set search_path = '' as $$
declare zona text; v_ini timestamptz; v_fin timestamptz;
begin
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  v_ini := privado.medianoche(date_trunc('month', p_mes)::date, zona);
  v_fin := privado.medianoche((date_trunc('month', p_mes) + interval '1 month')::date, zona);
  return query
  select count(*) filter (where e.estado <> 'anulado') > 0,
         coalesce(sum(e.minutos) filter (where e.estado = 'cerrado'), 0)::int,
         (count(*) filter (where e.estado = 'sin_salida'))::int
    from privado.fichajes_efectivos(p_gimnasio_id, p_equipo_id, v_ini, v_fin, p_ahora) e;
end $$;
revoke all on function privado.fichaje_mes(uuid, uuid, date, timestamptz) from public, anon, authenticated;

-- ── Fichar ──────────────────────────────────────────────────────────
-- Núcleo: marca de `e` a la hora `p_momento`. La salida sin entrada abierta y la entrada con otra abierta NO rompen:
-- devuelven un aviso y no escriben nada. Una entrada vieja pasada del tope se cierra en el tope (queda "sin salida").
create or replace function privado.fichar_en(p_gimnasio_id uuid, e public.equipo, p_accion text, p_momento timestamptz, p_sede_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare cfg public.configuracion_fichaje; abierta public.fichajes; v_sede uuid; accion text := p_accion; n int; mins int; tope interval;
begin
  select * into cfg from public.configuracion_fichaje c where c.gimnasio_id = p_gimnasio_id;
  if not found or not cfg.usa then raise exception 'Este gimnasio no usa fichaje: lo prende el dueño en Configuración.' using errcode = '22023'; end if;
  tope := make_interval(hours => cfg.tope_horas);
  select f.* into abierta from public.fichajes f where f.gimnasio_id = p_gimnasio_id and f.equipo_id = e.id and f.salida_en is null and f.anulado_en is null for update;
  -- Una entrada olvidada que pasó el tope queda cerrada en el tope, sin salida: no es "un turno abierto" para nadie.
  if found and p_momento >= abierta.entrada_en + tope then
    update public.fichajes set salida_en = abierta.entrada_en + tope, cierre = 'automatico' where id = abierta.id and salida_en is null;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo cerrar la entrada vieja.'; end if;
    abierta := null;
    if accion = 'salida' then
      return jsonb_build_object('accion', 'sin_entrada', 'aviso', 'Tu última entrada quedó sin salida y se cerró sola. Pedile al dueño que la corrija.', 'nombre', e.nombre);
    end if;
  end if;
  if accion is null then accion := case when abierta.id is not null then 'salida' else 'entrada' end; end if;
  if accion not in ('entrada', 'salida') then raise exception 'Elegí si fichás entrada o salida.' using errcode = '22023'; end if;
  if accion = 'entrada' then
    if abierta.id is not null then
      return jsonb_build_object('accion', 'ya_en_turno', 'momento', abierta.entrada_en, 'nombre', e.nombre, 'aviso', 'Ya habías fichado la entrada.');
    end if;
    v_sede := coalesce(p_sede_id, e.sede_id, (select s.id from public.sedes s where s.gimnasio_id = p_gimnasio_id and s.es_principal));
    insert into public.fichajes (gimnasio_id, equipo_id, sede_id, entrada_en) values (p_gimnasio_id, e.id, v_sede, p_momento);
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo registrar la entrada.'; end if;
    return jsonb_build_object('accion', 'entrada', 'momento', p_momento, 'nombre', e.nombre);
  end if;
  if abierta.id is null then
    return jsonb_build_object('accion', 'sin_entrada', 'aviso', 'No tenías una entrada fichada: no se registró nada.', 'nombre', e.nombre);
  end if;
  if p_momento <= abierta.entrada_en then raise exception 'La salida tiene que ser después de la entrada.' using errcode = '22023'; end if;
  update public.fichajes set salida_en = p_momento, cierre = 'manual' where id = abierta.id and salida_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo registrar la salida.'; end if;
  mins := round(extract(epoch from (p_momento - abierta.entrada_en)) / 60)::int;
  return jsonb_build_object('accion', 'salida', 'momento', p_momento, 'nombre', e.nombre, 'minutos', mins, 'entrada', abierta.entrada_en);
end $$;
revoke all on function privado.fichar_en(uuid, public.equipo, text, timestamptz, uuid) from public, anon, authenticated;

-- Quien fichó es quien opera: con PIN puesto en la compu, quien puso el PIN (exigir_equipo lo resuelve).
create or replace function public.fichar(p_gimnasio_id uuid, p_accion text default null, p_sede_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['recepcion', 'profe', 'encargado']);
  if p_sede_id is not null and not exists (select 1 from public.sedes s where s.id = p_sede_id and s.gimnasio_id = p_gimnasio_id) then
    raise exception 'Esa sede no es de este gimnasio.' using errcode = '22023';
  end if;
  return privado.fichar_en(p_gimnasio_id, e, p_accion, clock_timestamp(), p_sede_id);
end $$;

-- En la compu del mostrador: la persona pone su PIN y ficha sin cambiar quién atiende. Mismo límite de intentos que entrar_con_pin.
-- PIN equivocado: { error, quedan } (sin error de la base, para que el intento quede anotado).
create or replace function public.fichar_con_pin(p_gimnasio_id uuid, p_pin text, p_accion text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare sesion public.equipo; e public.equipo; fallos int;
begin
  select * into sesion from public.equipo where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and activo;
  if not found then raise exception 'Sin permiso para esta acción en este gimnasio' using errcode = '42501'; end if;
  select count(*) into fallos from privado.intentos_pin
   where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and not ok and en > now() - interval '10 minutes';
  if fallos >= 5 then raise exception 'Demasiados PIN equivocados: esperá 10 minutos' using errcode = '42501'; end if;
  select q.* into e from privado.pines_equipo pe join public.equipo q on q.id = pe.equipo_id
   where pe.gimnasio_id = p_gimnasio_id and q.activo and pe.pin_hash = extensions.crypt(coalesce(p_pin, ''), pe.pin_hash) limit 1;
  insert into privado.intentos_pin (gimnasio_id, usuario_id, ok) values (p_gimnasio_id, auth.uid(), e.id is not null);
  if e.id is null then return jsonb_build_object('error', 'PIN equivocado', 'quedan', greatest(4 - fallos, 0)); end if;
  if e.rol not in ('recepcion', 'profe', 'encargado') then
    return jsonb_build_object('error', 'Ese PIN es de alguien que no ficha (' || e.nombre || ')', 'quedan', greatest(4 - fallos, 0));
  end if;
  return privado.fichar_en(p_gimnasio_id, e, p_accion, clock_timestamp(), null);
end $$;

-- ── Configuración (solo el dueño la cambia; cualquiera del equipo sabe si se usa) ──
create or replace function public.config_fichaje(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.configuracion_fichaje;
begin
  perform privado.exigir_equipo(p_gimnasio_id);
  select * into c from public.configuracion_fichaje x where x.gimnasio_id = p_gimnasio_id;
  return jsonb_build_object('usa', coalesce(c.usa, false), 'tope_horas', coalesce(c.tope_horas, 12));
end $$;

create or replace function public.guardar_config_fichaje(p_gimnasio_id uuid, p_usa boolean, p_tope_horas int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_usa is null then raise exception 'Elegí si el gimnasio usa fichaje o no.' using errcode = '22023'; end if;
  if p_tope_horas is null or p_tope_horas < 1 or p_tope_horas > 24 then raise exception 'El tope de horas va de 1 a 24.' using errcode = '22023'; end if;
  insert into public.configuracion_fichaje (gimnasio_id, usa, tope_horas) values (p_gimnasio_id, p_usa, p_tope_horas)
    on conflict (gimnasio_id) do update set usa = excluded.usa, tope_horas = excluded.tope_horas, actualizado_en = now();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar.'; end if;
  return public.config_fichaje(p_gimnasio_id);
end $$;

-- ── Lo mío ──────────────────────────────────────────────────────────
create or replace function public.mi_fichaje(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; cfg jsonb; v_estado text; v_entrada timestamptz;
begin
  e := privado.exigir_equipo(p_gimnasio_id);
  cfg := public.config_fichaje(p_gimnasio_id);
  select x.estado, x.entrada_en into v_estado, v_entrada from privado.fichajes_efectivos(p_gimnasio_id, e.id, now() - interval '2 days', now() + interval '1 hour', now()) x
   where x.estado in ('abierto', 'sin_salida') order by x.entrada_en desc limit 1;
  return jsonb_build_object('usa', (cfg ->> 'usa')::boolean, 'tope_horas', (cfg ->> 'tope_horas')::int, 'nombre', e.nombre, 'rol', e.rol,
    'puede', e.rol in ('recepcion', 'profe', 'encargado'),
    'en_turno', coalesce(v_estado = 'abierto', false), 'entrada_en', case when v_estado = 'abierto' then v_entrada end,
    'sin_salida_desde', case when v_estado = 'sin_salida' then v_entrada end);
end $$;

-- Los turnos del mes con su estado. `p_equipo_id` null = todos. Uso interno de las tres lecturas.
create or replace function privado.horas_json(p_gimnasio_id uuid, p_equipo_id uuid, p_mes date) returns jsonb
language plpgsql stable set search_path = '' as $$
declare zona text; v_ini timestamptz; v_fin timestamptz;
begin
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  v_ini := privado.medianoche(date_trunc('month', p_mes)::date, zona);
  v_fin := privado.medianoche((date_trunc('month', p_mes) + interval '1 month')::date, zona);
  return jsonb_build_object(
    'mes', date_trunc('month', p_mes)::date,
    'turnos', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'dia', privado.dia_local(x.entrada_en, zona), 'entrada', x.entrada_en,
              'salida', case when x.estado in ('cerrado') then x.salida_en end, 'estado', x.estado, 'minutos', x.minutos,
              'corregido', x.corregido, 'corregido_motivo', x.corregido_motivo, 'anulado_motivo', x.anulado_motivo,
              'sede', (select s.nombre from public.sedes s where s.id = x.sede_id)) order by x.entrada_en)
            from privado.fichajes_efectivos(p_gimnasio_id, p_equipo_id, v_ini, v_fin, now()) x), '[]'::jsonb));
end $$;
revoke all on function privado.horas_json(uuid, uuid, date) from public, anon, authenticated;

create or replace function public.mis_horas(p_gimnasio_id uuid, p_mes date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; r jsonb; m record;
begin
  e := privado.exigir_equipo(p_gimnasio_id);
  if p_mes is null then raise exception 'Elegí el mes.' using errcode = '22023'; end if;
  r := privado.horas_json(p_gimnasio_id, e.id, p_mes);
  select * into m from privado.fichaje_mes(p_gimnasio_id, e.id, p_mes);
  return r || jsonb_build_object('minutos', coalesce(m.minutos, 0), 'sin_salida', coalesce(m.sin_salida, 0));
end $$;

-- ── Lo de todos: dueño y encargado ──────────────────────────────────
create or replace function public.horas_equipo(p_gimnasio_id uuid, p_mes date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; v_ini timestamptz; v_fin timestamptz;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if p_mes is null then raise exception 'Elegí el mes.' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  v_ini := privado.medianoche(date_trunc('month', p_mes)::date, zona);
  v_fin := privado.medianoche((date_trunc('month', p_mes) + interval '1 month')::date, zona);
  return jsonb_build_object('mes', date_trunc('month', p_mes)::date,
    'personas', coalesce((select jsonb_agg(p.fila order by p.nombre) from (
      select q.nombre, jsonb_build_object('equipo_id', q.id, 'nombre', q.nombre, 'rol', q.rol, 'activo', q.activo,
               'turnos', coalesce(t.turnos, 0), 'minutos', coalesce(t.minutos, 0), 'sin_salida', coalesce(t.sin_salida, 0), 'en_turno', coalesce(t.abiertos, 0) > 0) as fila
        from public.equipo q
        left join lateral (select count(*) filter (where x.estado <> 'anulado')::int turnos,
                                  coalesce(sum(x.minutos) filter (where x.estado = 'cerrado'), 0)::int minutos,
                                  (count(*) filter (where x.estado = 'sin_salida'))::int sin_salida,
                                  (count(*) filter (where x.estado = 'abierto'))::int abiertos
                             from privado.fichajes_efectivos(p_gimnasio_id, q.id, v_ini, v_fin, now()) x) t on true
       where q.gimnasio_id = p_gimnasio_id and q.rol in ('recepcion', 'profe', 'encargado') and (q.activo or coalesce(t.turnos, 0) > 0)
    ) p), '[]'::jsonb));
end $$;

create or replace function public.fichajes_persona(p_gimnasio_id uuid, p_equipo_id uuid, p_mes date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb; m record;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if p_mes is null then raise exception 'Elegí el mes.' using errcode = '22023'; end if;
  if not exists (select 1 from public.equipo q where q.id = p_equipo_id and q.gimnasio_id = p_gimnasio_id) then raise exception 'Esa persona no es del equipo.' using errcode = '22023'; end if;
  r := privado.horas_json(p_gimnasio_id, p_equipo_id, p_mes);
  select * into m from privado.fichaje_mes(p_gimnasio_id, p_equipo_id, p_mes);
  return r || jsonb_build_object('minutos', coalesce(m.minutos, 0), 'sin_salida', coalesce(m.sin_salida, 0),
    'correcciones', coalesce((select jsonb_agg(jsonb_build_object('fichaje_id', c.fichaje_id, 'por', q.nombre, 'en', c.corregido_en, 'motivo', c.motivo,
                       'entrada_antes', c.entrada_antes, 'salida_antes', c.salida_antes, 'entrada_nueva', c.entrada_nueva, 'salida_nueva', c.salida_nueva) order by c.corregido_en)
                  from public.correcciones_fichaje c join public.equipo q on q.id = c.corregido_por
                  join public.fichajes f on f.id = c.fichaje_id
                 where c.gimnasio_id = p_gimnasio_id and f.equipo_id = p_equipo_id
                   and c.fichaje_id in (select (t ->> 'id')::uuid from jsonb_array_elements(r -> 'turnos') t)), '[]'::jsonb));
end $$;

-- ── Corregir: solo el dueño, con motivo, sin borrar ─────────────────
create or replace function public.corregir_fichaje(p_fichaje_id uuid, p_entrada_local text, p_salida_local text, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.fichajes; e public.equipo; ef record; n int; zona text; p_entrada timestamptz; p_salida timestamptz;
begin
  select * into f from public.fichajes where id = p_fichaje_id;
  if not found then raise exception 'Sin permiso o fichaje inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(f.gimnasio_id, array['dueno']);
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'Escribí el motivo de la corrección.' using errcode = '22023'; end if;
  if f.anulado_en is not null then raise exception 'Ese fichaje está anulado.' using errcode = '22023'; end if;
  if p_entrada_local is null or p_salida_local is null or p_entrada_local !~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$' or p_salida_local !~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$' then
    raise exception 'Poné la entrada y la salida (día y hora).' using errcode = '22023';
  end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = f.gimnasio_id;
  p_entrada := p_entrada_local::timestamp at time zone zona;   -- lo escrito es hora del gimnasio: la convierte la base
  p_salida := p_salida_local::timestamp at time zone zona;
  if p_salida <= p_entrada then raise exception 'La salida tiene que ser después de la entrada.' using errcode = '22023'; end if;
  if abs(extract(epoch from (p_entrada - f.entrada_en))) > 7 * 86400 then raise exception 'La entrada corregida no puede estar a más de 7 días de la original.' using errcode = '22023'; end if;
  if p_salida > now() then raise exception 'La salida no puede ser futura.' using errcode = '22023'; end if;
  if p_salida - p_entrada > interval '24 hours' then raise exception 'Un turno no puede durar más de 24 horas.' using errcode = '22023'; end if;
  select x.entrada_en, x.salida_en into ef from privado.fichajes_efectivos(f.gimnasio_id, f.equipo_id, f.entrada_en - interval '40 days', f.entrada_en + interval '40 days', now()) x where x.id = f.id;
  insert into public.correcciones_fichaje (gimnasio_id, fichaje_id, entrada_antes, salida_antes, entrada_nueva, salida_nueva, motivo, corregido_por, corregido_en)
  values (f.gimnasio_id, f.id, coalesce(ef.entrada_en, f.entrada_en), ef.salida_en, p_entrada, p_salida, trim(p_motivo), e.id, clock_timestamp());
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la corrección.'; end if;
end $$;

create or replace function public.anular_fichaje(p_fichaje_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.fichajes; e public.equipo; n int;
begin
  select * into f from public.fichajes where id = p_fichaje_id;
  if not found then raise exception 'Sin permiso o fichaje inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(f.gimnasio_id, array['dueno']);
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'Escribí el motivo.' using errcode = '22023'; end if;
  update public.fichajes set anulado_en = now(), anulado_por = e.id, anulado_motivo = trim(p_motivo) where id = f.id and anulado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese fichaje ya estaba anulado.' using errcode = '22023'; end if;
end $$;

-- ── Liquidación de profes: las horas salen del fichaje si la persona fichó ──
-- Copia de privado.liquidacion_calculo (VD-52) con una fuente más: fichaje > horas cargadas a mano > minutos de las clases.
create or replace function privado.liquidacion_calculo(p_gimnasio_id uuid, p_mes date, p_profe_id uuid default null)
returns jsonb
language plpgsql stable set search_path = '' as $$
declare zona text; v_mes date := date_trunc('month', p_mes)::date; v_fin timestamptz; salida jsonb;
begin
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  v_fin := privado.medianoche((v_mes + interval '1 month')::date, zona);
  select coalesce(jsonb_agg(x.fila order by x.nombre), '[]'::jsonb) into salida from (
    select e.nombre,
      jsonb_build_object(
        'profe_id', e.id, 'nombre', e.nombre, 'rol', e.rol, 'activo', e.activo,
        'regla', (select jsonb_build_object('modo', r.modo, 'monto', r.monto, 'vigente_desde', r.vigente_desde)
                    from public.reglas_pago_profe r
                   where r.gimnasio_id = p_gimnasio_id and r.profe_id = e.id and r.vigente_desde <= privado.dia_local(least(now(), v_fin - interval '1 second'), zona)
                   order by r.vigente_desde desc limit 1),
        'clases', coalesce(t.clases, 0), 'presentes', coalesce(t.presentes, 0),
        'horas_clases', round(coalesce(t.minutos, 0) / 60.0, 2),
        'horas_cargadas', case when h.minutos is null then null else round(h.minutos / 60.0, 2) end,
        'horas_fuente', case when fh.hay then 'fichaje' when h.minutos is not null then 'carga' else null end,
        'fichajes_sin_salida', coalesce(fh.sin_salida, 0),
        'total', case
           when rf.modo = 'por_hora' and h.minutos is not null then round(rf.monto * h.minutos / 60.0, 2)
           else coalesce(t.importe, 0) end,
        'pagado', coalesce(p.pagado, 0),
        'sin_regla', (rf.modo is null and coalesce(t.clases, 0) > 0)
      ) || jsonb_build_object('pendiente',
        greatest(case when rf.modo = 'por_hora' and h.minutos is not null then round(rf.monto * h.minutos / 60.0, 2) else coalesce(t.importe, 0) end - coalesce(p.pagado, 0), 0)) as fila
      from public.equipo e
      left join lateral privado.fichaje_mes(p_gimnasio_id, e.id, v_mes) fh on true
      left join lateral (select count(*)::int clases, coalesce(sum(l.presentes), 0)::int presentes, coalesce(sum(l.minutos), 0)::int minutos,
                                coalesce(sum(case when l.modo = 'por_hora' and (fh.hay or exists (
                                  select 1 from public.horas_profe hp where hp.gimnasio_id = p_gimnasio_id and hp.profe_id = e.id and hp.anulado_en is null
                                     and hp.fecha >= v_mes and hp.fecha < (v_mes + interval '1 month')::date)) then 0 else l.importe end), 0) importe
                           from privado.clases_liquidables(p_gimnasio_id, v_mes, e.id) l) t on true
      left join lateral (select case when fh.hay then fh.minutos else (select sum(hp.minutos)::int from public.horas_profe hp
                          where hp.gimnasio_id = p_gimnasio_id and hp.profe_id = e.id and hp.anulado_en is null
                            and hp.fecha >= v_mes and hp.fecha < (v_mes + interval '1 month')::date) end as minutos) h on true
      left join lateral (select r.modo, r.monto from public.reglas_pago_profe r
                          where r.gimnasio_id = p_gimnasio_id and r.profe_id = e.id and r.vigente_desde <= privado.dia_local(least(now(), v_fin - interval '1 second'), zona)
                          order by r.vigente_desde desc limit 1) rf on true
      left join lateral (select sum(pp.monto) pagado from public.pagos_profe pp
                          where pp.gimnasio_id = p_gimnasio_id and pp.profe_id = e.id and pp.mes = v_mes and pp.anulado_en is null) p on true
     where e.gimnasio_id = p_gimnasio_id and (p_profe_id is null or e.id = p_profe_id)
       and (e.rol = 'profe' or coalesce(t.clases, 0) > 0 or exists (select 1 from public.reglas_pago_profe r where r.profe_id = e.id and r.gimnasio_id = p_gimnasio_id)
            or h.minutos is not null or p.pagado is not null)
       and (e.activo or coalesce(t.clases, 0) > 0 or h.minutos is not null or p.pagado is not null)
  ) x;
  return salida;
end $$;
revoke all on function privado.liquidacion_calculo(uuid, date, uuid) from public, anon, authenticated;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.fichar(uuid, text, uuid), public.fichar_con_pin(uuid, text, text), public.config_fichaje(uuid), public.guardar_config_fichaje(uuid, boolean, int),
  public.mi_fichaje(uuid), public.mis_horas(uuid, date), public.horas_equipo(uuid, date), public.fichajes_persona(uuid, uuid, date),
  public.corregir_fichaje(uuid, text, text, text), public.anular_fichaje(uuid, text) from public, anon, authenticated;
grant execute on function public.fichar(uuid, text, uuid), public.fichar_con_pin(uuid, text, text), public.config_fichaje(uuid), public.guardar_config_fichaje(uuid, boolean, int),
  public.mi_fichaje(uuid), public.mis_horas(uuid, date), public.horas_equipo(uuid, date), public.fichajes_persona(uuid, uuid, date),
  public.corregir_fichaje(uuid, text, text, text), public.anular_fichaje(uuid, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare t text; f text;
begin
  foreach t in array array['configuracion_fichaje', 'fichajes', 'correcciones_fichaje'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then raise exception 'Verificación: % sin RLS', t; end if;
    if has_table_privilege('anon', 'public.' || t, 'select') then raise exception 'Verificación: anon lee %', t; end if;
    if has_table_privilege('authenticated', 'public.' || t, 'insert') or has_table_privilege('authenticated', 'public.' || t, 'select') then raise exception 'Verificación: se puede leer o escribir % directo', t; end if;
  end loop;
  foreach f in array array['public.fichar(uuid, text, uuid)', 'public.fichar_con_pin(uuid, text, text)', 'public.corregir_fichaje(uuid, text, text, text)',
                           'privado.fichar_en(uuid, public.equipo, text, timestamptz, uuid)', 'privado.fichajes_efectivos(uuid, uuid, timestamptz, timestamptz, timestamptz)',
                           'privado.liquidacion_calculo(uuid, date, uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon ejecuta %', f; end if;
  end loop;
  if has_function_privilege('authenticated', 'privado.fichar_en(uuid, public.equipo, text, timestamptz, uuid)', 'execute') then raise exception 'Verificación: fichar_en expuesta (se podría fichar a otra hora)'; end if;
  if has_function_privilege('authenticated', 'privado.fichajes_efectivos(uuid, uuid, timestamptz, timestamptz, timestamptz)', 'execute') then raise exception 'Verificación: fichajes_efectivos expuesta'; end if;
end $$;
