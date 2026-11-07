-- VD-52 · Liquidación de profes (D33, cierra COM-15).
--   reglas_pago_profe        la regla de cada profe: por clase dictada, por alumno presente o por hora, con su monto y desde cuándo
--   horas_profe              horas cargadas a mano (quien no ficha); si el mes tiene horas cargadas, mandan sobre las de las clases
--   pagos_profe              lo que se le pagó (hecho inmutable; se anula con motivo, nunca se borra)
--   configuracion_liquidacion  si el encargado también ve el resumen (por defecto no)
--   liquidacion_profes(g, mes)            el resumen del mes por profe (dueño; encargado si el dueño lo prendió)
--   liquidacion_profe_detalle(g, p, mes)  las clases de un profe en el mes y lo que suma cada una (mismas reglas)
--   mi_liquidacion(g, mes)                lo MÍO del mes (cualquier persona del equipo ve solo lo suyo)
--   guardar_regla_profe / cargar_horas_profe / anular_horas_profe / pagar_profe / anular_pago_profe   solo el dueño (plata)
-- Nada de lo que se debe se guarda: sale de las clases dictadas y de la asistencia de cada mes, así que corregir una
-- asistencia recalcula solo. Lo único que se guarda son hechos: la regla, las horas cargadas y los pagos.
-- Una clase "dictada" es una clase del profe, no cancelada, que ya empezó. Por hora, sin horas cargadas, se cuentan
-- los minutos de cada clase. El pago en efectivo sale de la caja abierta del dueño (queda como retiro con su motivo).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.clases') is null or to_regclass('public.asistencias') is null then raise exception 'Guarda: faltan clases o asistencias'; end if;
  if to_regclass('public.equipo') is null or to_regclass('public.movimientos_caja') is null or to_regclass('public.turnos_caja') is null then
    raise exception 'Guarda: faltan equipo o la caja';
  end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta exigir_equipo'; end if;
  if to_regprocedure('privado.medianoche(date, text)') is null then raise exception 'Guarda: falta medianoche'; end if;
  if to_regprocedure('privado.hecho_inmutable()') is null then raise exception 'Guarda: falta hecho_inmutable'; end if;
end $$;

-- ── Tablas ──────────────────────────────────────────────────────────
create table if not exists public.reglas_pago_profe (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  profe_id      uuid not null,
  modo          text not null check (modo in ('por_clase', 'por_presente', 'por_hora')),
  monto         numeric(12,2) not null check (monto >= 0),
  vigente_desde date not null,
  creado_por    uuid not null,
  creado_en     timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, profe_id, vigente_desde),
  foreign key (gimnasio_id, profe_id) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id)
);
select privado.politicas_estandar('public.reglas_pago_profe', array['dueno'], '{}');
revoke all on table public.reglas_pago_profe from anon;
revoke all on table public.reglas_pago_profe from authenticated;   -- nadie la lee directo: todo por funciones

create table if not exists public.horas_profe (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  profe_id      uuid not null,
  fecha         date not null,
  minutos       int not null check (minutos between 1 and 1440),
  nota          text,
  creado_por    uuid not null,
  creado_en     timestamptz not null default now(),
  anulado_en    timestamptz,
  anulado_por   uuid,
  anulado_motivo text,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, profe_id) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, anulado_por) references public.equipo (gimnasio_id, id),
  check ((anulado_en is null) = (anulado_motivo is null))
);
create index if not exists horas_profe_mes on public.horas_profe (gimnasio_id, profe_id, fecha);
select privado.politicas_estandar('public.horas_profe', array['dueno'], '{}');
revoke all on table public.horas_profe from anon;
revoke all on table public.horas_profe from authenticated;   -- nadie la lee directo: todo por funciones
drop trigger if exists horas_profe_inmutable on public.horas_profe;
create trigger horas_profe_inmutable before update or delete on public.horas_profe
  for each row execute function privado.hecho_inmutable('anulado_en', 'anulado_por', 'anulado_motivo');

create table if not exists public.pagos_profe (
  id             uuid primary key default gen_random_uuid(),
  gimnasio_id    uuid not null references public.gimnasios(id),
  profe_id       uuid not null,
  mes            date not null check (mes = date_trunc('month', mes)::date),
  monto          numeric(12,2) not null check (monto > 0),
  medio          text not null check (medio in ('efectivo', 'transferencia', 'otro')),
  movimiento_caja_id uuid,
  nota           text,
  clave          text,
  pagado_por     uuid not null,
  pagado_en      timestamptz not null default now(),
  anulado_en     timestamptz,
  anulado_por    uuid,
  anulado_motivo text,
  unique (gimnasio_id, id),
  unique (gimnasio_id, clave),
  foreign key (gimnasio_id, profe_id) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, pagado_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, anulado_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, movimiento_caja_id) references public.movimientos_caja (gimnasio_id, id),
  check ((anulado_en is null) = (anulado_motivo is null))
);
create index if not exists pagos_profe_mes on public.pagos_profe (gimnasio_id, profe_id, mes);
select privado.politicas_estandar('public.pagos_profe', array['dueno'], '{}');
revoke all on table public.pagos_profe from anon;
revoke all on table public.pagos_profe from authenticated;   -- nadie la lee directo: todo por funciones
drop trigger if exists pagos_profe_inmutable on public.pagos_profe;
create trigger pagos_profe_inmutable before update or delete on public.pagos_profe
  for each row execute function privado.hecho_inmutable('anulado_en', 'anulado_por', 'anulado_motivo');

create table if not exists public.configuracion_liquidacion (
  gimnasio_id    uuid primary key references public.gimnasios(id),
  encargado_ve   boolean not null default false,
  actualizado_en timestamptz not null default now()
);
select privado.politicas_estandar('public.configuracion_liquidacion', array['dueno'], '{}');
revoke all on table public.configuracion_liquidacion from anon;
revoke all on table public.configuracion_liquidacion from authenticated;   -- nadie la lee directo: todo por funciones

-- ── El cálculo (una sola fuente; las pantallas solo lo muestran) ────
-- Una fila por clase dictada del mes, con lo que suma según la regla vigente el día de la clase.
create or replace function privado.clases_liquidables(p_gimnasio_id uuid, p_mes date, p_profe_id uuid default null)
returns table (profe_id uuid, clase_id uuid, dia date, actividad text, inicio timestamptz, minutos int, presentes int, modo text, monto_regla numeric, importe numeric)
language plpgsql stable set search_path = '' as $$
declare zona text; v_ini timestamptz; v_fin timestamptz;
begin
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  v_ini := privado.medianoche(date_trunc('month', p_mes)::date, zona);
  v_fin := privado.medianoche((date_trunc('month', p_mes) + interval '1 month')::date, zona);
  return query
  select c.profe_id, c.id, privado.dia_local(c.inicio, zona),
         coalesce(a.nombre, 'Clase'),
         c.inicio,
         greatest(round(extract(epoch from (c.fin - c.inicio)) / 60)::int, 0),
         (select count(*)::int from public.asistencias s where s.clase_id = c.id and s.anulada_en is null),
         rg.modo, rg.monto,
         case rg.modo
           when 'por_clase'    then rg.monto
           when 'por_presente' then rg.monto * (select count(*) from public.asistencias s where s.clase_id = c.id and s.anulada_en is null)
           when 'por_hora'     then round(rg.monto * greatest(extract(epoch from (c.fin - c.inicio)) / 3600.0, 0), 2)
           else 0 end
    from public.clases c
    left join public.actividades a on a.id = c.actividad_id
    left join lateral (select r.modo, r.monto from public.reglas_pago_profe r
                        where r.gimnasio_id = p_gimnasio_id and r.profe_id = c.profe_id and r.vigente_desde <= privado.dia_local(c.inicio, zona)
                        order by r.vigente_desde desc limit 1) rg on true
   where c.gimnasio_id = p_gimnasio_id and c.profe_id is not null and c.cancelada_en is null
     and c.inicio >= v_ini and c.inicio < v_fin and c.inicio < now()
     and (p_profe_id is null or c.profe_id = p_profe_id);
end $$;

-- El resumen del mes de cada profe: clases, presentes, horas, lo que suma, lo pagado y lo que falta.
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
        'total', case
           when rf.modo = 'por_hora' and h.minutos is not null then round(rf.monto * h.minutos / 60.0, 2)
           else coalesce(t.importe, 0) end,
        'pagado', coalesce(p.pagado, 0),
        'sin_regla', (rf.modo is null and coalesce(t.clases, 0) > 0)
      ) || jsonb_build_object('pendiente',
        greatest(case when rf.modo = 'por_hora' and h.minutos is not null then round(rf.monto * h.minutos / 60.0, 2) else coalesce(t.importe, 0) end - coalesce(p.pagado, 0), 0)) as fila
      from public.equipo e
      left join lateral (select count(*)::int clases, coalesce(sum(l.presentes), 0)::int presentes, coalesce(sum(l.minutos), 0)::int minutos,
                                coalesce(sum(case when l.modo = 'por_hora' and exists (
                                  select 1 from public.horas_profe hp where hp.gimnasio_id = p_gimnasio_id and hp.profe_id = e.id and hp.anulado_en is null
                                     and hp.fecha >= v_mes and hp.fecha < (v_mes + interval '1 month')::date) then 0 else l.importe end), 0) importe
                           from privado.clases_liquidables(p_gimnasio_id, v_mes, e.id) l) t on true
      left join lateral (select sum(hp.minutos)::int minutos from public.horas_profe hp
                          where hp.gimnasio_id = p_gimnasio_id and hp.profe_id = e.id and hp.anulado_en is null
                            and hp.fecha >= v_mes and hp.fecha < (v_mes + interval '1 month')::date) h on true
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

-- ── Quién ve qué ────────────────────────────────────────────────────
create or replace function privado.ve_liquidacion(p_gimnasio_id uuid) returns public.equipo
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; ve boolean;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if e.rol = 'encargado' then
    select coalesce(c.encargado_ve, false) into ve from (select 1) u left join public.configuracion_liquidacion c on c.gimnasio_id = p_gimnasio_id;
    if not ve then raise exception 'Sin permiso: el dueño no te dio acceso a la liquidación de profes' using errcode = '42501'; end if;
  end if;
  return e;
end $$;

create or replace function public.config_liquidacion(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare ve boolean;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  select coalesce(c.encargado_ve, false) into ve from (select 1) u left join public.configuracion_liquidacion c on c.gimnasio_id = p_gimnasio_id;
  return jsonb_build_object('encargado_ve', ve);
end $$;

create or replace function public.guardar_config_liquidacion(p_gimnasio_id uuid, p_encargado_ve boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_encargado_ve is null then raise exception 'Elegí si el encargado la ve o no.' using errcode = '22023'; end if;
  insert into public.configuracion_liquidacion (gimnasio_id, encargado_ve) values (p_gimnasio_id, p_encargado_ve)
    on conflict (gimnasio_id) do update set encargado_ve = excluded.encargado_ve, actualizado_en = now();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar.'; end if;
  return public.config_liquidacion(p_gimnasio_id);
end $$;

-- ── Lo que ven el dueño, el encargado (si se prendió) y cada profe ──
create or replace function public.liquidacion_profes(p_gimnasio_id uuid, p_mes date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.ve_liquidacion(p_gimnasio_id);
  if p_mes is null then raise exception 'Elegí el mes.' using errcode = '22023'; end if;
  return jsonb_build_object('mes', date_trunc('month', p_mes)::date, 'profes', privado.liquidacion_calculo(p_gimnasio_id, p_mes, null));
end $$;

create or replace function public.liquidacion_profe_detalle(p_gimnasio_id uuid, p_profe_id uuid, p_mes date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.ve_liquidacion(p_gimnasio_id);
  if p_mes is null then raise exception 'Elegí el mes.' using errcode = '22023'; end if;
  if not exists (select 1 from public.equipo e where e.id = p_profe_id and e.gimnasio_id = p_gimnasio_id) then raise exception 'Esa persona no es del equipo.' using errcode = '22023'; end if;
  return jsonb_build_object(
    'mes', date_trunc('month', p_mes)::date,
    'clases', coalesce((select jsonb_agg(jsonb_build_object('clase_id', l.clase_id, 'dia', l.dia, 'actividad', l.actividad, 'minutos', l.minutos,
                                                            'presentes', l.presentes, 'modo', l.modo, 'importe', l.importe) order by l.inicio)
                          from privado.clases_liquidables(p_gimnasio_id, p_mes, p_profe_id) l), '[]'::jsonb),
    'horas', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'fecha', h.fecha, 'minutos', h.minutos, 'nota', h.nota) order by h.fecha)
                         from public.horas_profe h where h.gimnasio_id = p_gimnasio_id and h.profe_id = p_profe_id and h.anulado_en is null
                          and h.fecha >= date_trunc('month', p_mes)::date and h.fecha < (date_trunc('month', p_mes) + interval '1 month')::date), '[]'::jsonb),
    'pagos', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'monto', p.monto, 'medio', p.medio, 'nota', p.nota, 'pagado_en', p.pagado_en,
                                                           'pagado_por', q.nombre, 'anulado_en', p.anulado_en, 'anulado_motivo', p.anulado_motivo) order by p.pagado_en)
                         from public.pagos_profe p join public.equipo q on q.id = p.pagado_por
                        where p.gimnasio_id = p_gimnasio_id and p.profe_id = p_profe_id and p.mes = date_trunc('month', p_mes)::date), '[]'::jsonb));
end $$;

-- Lo mío: nadie ve la liquidación de otro por acá.
create or replace function public.mi_liquidacion(p_gimnasio_id uuid, p_mes date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; resumen jsonb;
begin
  e := privado.exigir_equipo(p_gimnasio_id);
  if p_mes is null then raise exception 'Elegí el mes.' using errcode = '22023'; end if;
  resumen := (privado.liquidacion_calculo(p_gimnasio_id, p_mes, e.id)) -> 0;
  return jsonb_build_object(
    'mes', date_trunc('month', p_mes)::date,
    'resumen', resumen,
    'clases', coalesce((select jsonb_agg(jsonb_build_object('dia', l.dia, 'actividad', l.actividad, 'minutos', l.minutos, 'presentes', l.presentes, 'importe', l.importe) order by l.inicio)
                          from privado.clases_liquidables(p_gimnasio_id, p_mes, e.id) l), '[]'::jsonb),
    'pagos', coalesce((select jsonb_agg(jsonb_build_object('monto', p.monto, 'medio', p.medio, 'pagado_en', p.pagado_en) order by p.pagado_en)
                         from public.pagos_profe p where p.gimnasio_id = p_gimnasio_id and p.profe_id = e.id and p.mes = date_trunc('month', p_mes)::date and p.anulado_en is null), '[]'::jsonb));
end $$;

-- ── Lo que cambia plata: solo el dueño ──────────────────────────────
create or replace function public.guardar_regla_profe(p_gimnasio_id uuid, p_profe_id uuid, p_modo text, p_monto numeric, p_vigente_desde date default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; zona text; desde date; n int;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if not exists (select 1 from public.equipo q where q.id = p_profe_id and q.gimnasio_id = p_gimnasio_id) then raise exception 'Esa persona no es del equipo.' using errcode = '22023'; end if;
  if p_modo is null or p_modo not in ('por_clase', 'por_presente', 'por_hora') then raise exception 'Elegí cómo se le paga: por clase, por alumno presente o por hora.' using errcode = '22023'; end if;
  if p_monto is null or p_monto < 0 or p_monto > 99999999 or p_monto <> round(p_monto, 2) then raise exception 'El monto tiene que ser de 0 en adelante, con hasta dos decimales.' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  desde := coalesce(p_vigente_desde, privado.dia_local(now(), zona));
  insert into public.reglas_pago_profe (gimnasio_id, profe_id, modo, monto, vigente_desde, creado_por)
  values (p_gimnasio_id, p_profe_id, p_modo, p_monto, desde, e.id)
  on conflict (gimnasio_id, profe_id, vigente_desde) do update set modo = excluded.modo, monto = excluded.monto, creado_por = excluded.creado_por, creado_en = now();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la regla.'; end if;
  return jsonb_build_object('profe_id', p_profe_id, 'modo', p_modo, 'monto', p_monto, 'vigente_desde', desde);
end $$;

create or replace function public.cargar_horas_profe(p_gimnasio_id uuid, p_profe_id uuid, p_fecha date, p_minutos int, p_nota text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; nuevo uuid;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if not exists (select 1 from public.equipo q where q.id = p_profe_id and q.gimnasio_id = p_gimnasio_id) then raise exception 'Esa persona no es del equipo.' using errcode = '22023'; end if;
  if p_fecha is null or p_fecha > current_date + 1 then raise exception 'La fecha no puede ser futura.' using errcode = '22023'; end if;
  if p_minutos is null or p_minutos < 1 or p_minutos > 1440 then raise exception 'Los minutos: de 1 a 1440.' using errcode = '22023'; end if;
  insert into public.horas_profe (gimnasio_id, profe_id, fecha, minutos, nota, creado_por)
  values (p_gimnasio_id, p_profe_id, p_fecha, p_minutos, nullif(trim(coalesce(p_nota, '')), ''), e.id) returning id into nuevo;
  if nuevo is null then raise exception 'No se pudieron cargar las horas.'; end if;
  return nuevo;
end $$;

create or replace function public.anular_horas_profe(p_horas_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.horas_profe; e public.equipo; n int;
begin
  select * into h from public.horas_profe where id = p_horas_id;
  if not found then raise exception 'Sin permiso o horas inexistentes' using errcode = '42501'; end if;
  e := privado.exigir_equipo(h.gimnasio_id, array['dueno']);
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'Escribí el motivo.' using errcode = '22023'; end if;
  update public.horas_profe set anulado_en = now(), anulado_por = e.id, anulado_motivo = trim(p_motivo) where id = h.id and anulado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Esas horas ya estaban anuladas.' using errcode = '22023'; end if;
end $$;

create or replace function public.pagar_profe(p_gimnasio_id uuid, p_profe_id uuid, p_mes date, p_monto numeric, p_medio text,
                                              p_nota text default null, p_turno_id uuid default null, p_clave text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; v_mes date := date_trunc('month', p_mes)::date; pendiente numeric; nuevo uuid; mov uuid; nom text; previo uuid; fila jsonb;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_clave is not null then
    select p.id into previo from public.pagos_profe p where p.gimnasio_id = p_gimnasio_id and p.clave = p_clave;
    if found then return previo; end if;   -- el mismo pago mandado dos veces es uno solo
  end if;
  select q.nombre into nom from public.equipo q where q.id = p_profe_id and q.gimnasio_id = p_gimnasio_id;
  if nom is null then raise exception 'Esa persona no es del equipo.' using errcode = '22023'; end if;
  if p_mes is null or v_mes > date_trunc('month', now())::date then raise exception 'Ese mes todavía no empezó.' using errcode = '22023'; end if;
  if p_medio is null or p_medio not in ('efectivo', 'transferencia', 'otro') then raise exception 'Elegí cómo se le pagó: efectivo, transferencia u otro.' using errcode = '22023'; end if;
  if p_monto is null or p_monto <= 0 or p_monto <> round(p_monto, 2) then raise exception 'El monto tiene que ser mayor a cero, con hasta dos decimales.' using errcode = '22023'; end if;
  fila := (privado.liquidacion_calculo(p_gimnasio_id, v_mes, p_profe_id)) -> 0;
  pendiente := coalesce((fila ->> 'pendiente')::numeric, 0);
  if p_monto > pendiente then
    raise exception 'Eso es más de lo que falta pagarle de ese mes ($%). Revisá el monto.', trim(to_char(pendiente, 'FM999G999G999D00')) using errcode = '22023';
  end if;
  if p_medio = 'efectivo' then
    if p_turno_id is null then raise exception 'Para pagar en efectivo abrí tu turno de caja: la plata sale de ahí.' using errcode = '22023'; end if;
    if not exists (select 1 from public.turnos_caja t where t.id = p_turno_id and t.gimnasio_id = p_gimnasio_id and t.abierto_por = e.id and t.cerrado_en is null) then
      raise exception 'Ese turno de caja no es tuyo o ya está cerrado.' using errcode = '22023';
    end if;
    insert into public.movimientos_caja (gimnasio_id, turno_caja_id, tipo, monto, motivo, creado_por)
    values (p_gimnasio_id, p_turno_id, 'retiro', p_monto, 'Pago a profe: ' || nom || ' · ' || to_char(v_mes, 'MM/YYYY'), e.id) returning id into mov;
    if mov is null then raise exception 'No se pudo registrar el retiro de caja.'; end if;
  end if;
  insert into public.pagos_profe (gimnasio_id, profe_id, mes, monto, medio, movimiento_caja_id, nota, clave, pagado_por)
  values (p_gimnasio_id, p_profe_id, v_mes, p_monto, p_medio, mov, nullif(trim(coalesce(p_nota, '')), ''), p_clave, e.id) returning id into nuevo;
  if nuevo is null then raise exception 'No se pudo registrar el pago.'; end if;
  return nuevo;
end $$;

create or replace function public.anular_pago_profe(p_pago_id uuid, p_motivo text, p_turno_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.pagos_profe; e public.equipo; n int; mov uuid;
begin
  select * into p from public.pagos_profe where id = p_pago_id;
  if not found then raise exception 'Sin permiso o pago inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(p.gimnasio_id, array['dueno']);
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'Escribí el motivo.' using errcode = '22023'; end if;
  if p.anulado_en is not null then raise exception 'Ese pago ya estaba anulado.' using errcode = '22023'; end if;
  -- Un pago en efectivo salió de una caja: se anula devolviendo la plata a la caja abierta de quien anula.
  if p.medio = 'efectivo' then
    if p_turno_id is null then raise exception 'Ese pago salió de la caja: abrí tu turno para devolver la plata.' using errcode = '22023'; end if;
    if not exists (select 1 from public.turnos_caja t where t.id = p_turno_id and t.gimnasio_id = p.gimnasio_id and t.abierto_por = e.id and t.cerrado_en is null) then
      raise exception 'Ese turno de caja no es tuyo o ya está cerrado.' using errcode = '22023';
    end if;
    insert into public.movimientos_caja (gimnasio_id, turno_caja_id, tipo, monto, motivo, creado_por)
    values (p.gimnasio_id, p_turno_id, 'ingreso', p.monto, 'Se anuló un pago a profe: ' || trim(p_motivo), e.id) returning id into mov;
    if mov is null then raise exception 'No se pudo devolver la plata a la caja.'; end if;
  end if;
  update public.pagos_profe set anulado_en = now(), anulado_por = e.id, anulado_motivo = trim(p_motivo) where id = p.id and anulado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo anular el pago.'; end if;
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function privado.clases_liquidables(uuid, date, uuid), privado.liquidacion_calculo(uuid, date, uuid), privado.ve_liquidacion(uuid) from public, anon, authenticated;
revoke all on function public.config_liquidacion(uuid), public.guardar_config_liquidacion(uuid, boolean), public.liquidacion_profes(uuid, date),
  public.liquidacion_profe_detalle(uuid, uuid, date), public.mi_liquidacion(uuid, date), public.guardar_regla_profe(uuid, uuid, text, numeric, date),
  public.cargar_horas_profe(uuid, uuid, date, int, text), public.anular_horas_profe(uuid, text),
  public.pagar_profe(uuid, uuid, date, numeric, text, text, uuid, text), public.anular_pago_profe(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.config_liquidacion(uuid), public.guardar_config_liquidacion(uuid, boolean), public.liquidacion_profes(uuid, date),
  public.liquidacion_profe_detalle(uuid, uuid, date), public.mi_liquidacion(uuid, date), public.guardar_regla_profe(uuid, uuid, text, numeric, date),
  public.cargar_horas_profe(uuid, uuid, date, int, text), public.anular_horas_profe(uuid, text),
  public.pagar_profe(uuid, uuid, date, numeric, text, text, uuid, text), public.anular_pago_profe(uuid, text, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['reglas_pago_profe', 'horas_profe', 'pagos_profe', 'configuracion_liquidacion'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then raise exception 'Verificación: % sin RLS', t; end if;
    if has_table_privilege('anon', 'public.' || t, 'select') then raise exception 'Verificación: anon lee %', t; end if;
    if has_table_privilege('authenticated', 'public.' || t, 'insert') or has_table_privilege('authenticated', 'public.' || t, 'select') then raise exception 'Verificación: se puede leer o escribir % directo', t; end if;
  end loop;
  if has_function_privilege('anon', 'public.pagar_profe(uuid, uuid, date, numeric, text, text, uuid, text)', 'execute') then raise exception 'Verificación: anon paga profes'; end if;
  if has_function_privilege('authenticated', 'privado.liquidacion_calculo(uuid, date, uuid)', 'execute') then raise exception 'Verificación: liquidacion_calculo expuesta'; end if;
end $$;
