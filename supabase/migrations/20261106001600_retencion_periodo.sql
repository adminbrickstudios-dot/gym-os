-- VD-16 · Retención y números, por período (docs/v2/03 §6).
-- Cada número lo calcula la base sobre HECHOS (coberturas, bajas, pagos aprobados, ingresos, reservas,
-- asistencias); la pantalla solo los muestra y el CSV sale de la misma llamada. Nada se guarda.
--   retencion_periodo(gimnasio, periodo) → jsonb. Períodos: 'mes' (este mes), 'mes_pasado', '3', '6', '12'
--   (los últimos N meses, contando el mes en curso). Lo ven el dueño y el encargado (hay plata).
--
-- Definiciones (cada una se muestra en la pantalla con su "¿qué es esto?"):
--   al día            socio con cobertura vigente en ese instante y no dado de baja (la cuenta del tablero de retención)
--   churn general     bajas del período ÷ socios al día al empezar el período
--   churn 90 días     de los que se anotaron en el período, los que se dieron de baja a los 90 días o menos de su alta
--                     (los que todavía no cumplieron 90 días y siguen cuentan como que siguen)
--   ingreso por socio lo cobrado (pagos aprobados de ventas no anuladas) ÷ promedio de socios al día (inicio y fin)
--   visitas           días distintos en que vino cada socio (no entradas repetidas el mismo día)
--   pocas visitas     socios al día que vinieron una vez por semana o menos en el período
--   mapa de calor     ingresos por día de la semana (1 lunes … 7 domingo) y hora del día, en la hora del gimnasio
--   ocupación         reservas confirmadas ÷ cupo de las clases del período (las que tienen cupo, no canceladas)
--   ausentes          reservaron, la clase ya terminó y no figuran en la asistencia
-- La cuenta está en privado.numeros_periodo con el "ahora" como parámetro: las pruebas la llaman con datos y
-- momento fijos. La función pública la llama con now().

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.medianoche(date, text)') is null then raise exception 'Guarda: falta privado.medianoche'; end if;
  if to_regprocedure('privado.dia_local(timestamptz, text)') is null then raise exception 'Guarda: falta privado.dia_local'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
  if to_regclass('public.pagos') is null or to_regclass('public.reservas') is null or to_regclass('public.asistencias') is null then
    raise exception 'Guarda: faltan pagos, reservas o asistencias';
  end if;
end $$;

-- Los índices que hacen que esto responda rápido con miles de socios (todo por gimnasio y rango de fechas).
create index if not exists ingresos_gimnasio_momento on public.ingresos (gimnasio_id, momento);
create index if not exists pagos_aprobados_en on public.pagos (gimnasio_id, aprobado_en) where estado = 'aprobado';
create index if not exists socios_alta on public.socios (gimnasio_id, creado_en);
create index if not exists socios_baja on public.socios (gimnasio_id, dado_de_baja_en) where dado_de_baja_en is not null;
create index if not exists clases_gimnasio_inicio on public.clases (gimnasio_id, inicio);

-- ── El rango de un período, en días locales [desde, hasta) ──────────
create or replace function privado.rango_periodo(p_periodo text, p_hoy date, out p_desde date, out p_hasta date)
language plpgsql immutable set search_path = '' as $$
declare mes date := date_trunc('month', p_hoy)::date;
begin
  case coalesce(p_periodo, 'mes')
    when 'mes' then p_desde := mes; p_hasta := p_hoy + 1;
    when 'mes_pasado' then p_desde := (mes - interval '1 month')::date; p_hasta := mes;
    when '3' then p_desde := (mes - interval '2 months')::date; p_hasta := p_hoy + 1;
    when '6' then p_desde := (mes - interval '5 months')::date; p_hasta := p_hoy + 1;
    when '12' then p_desde := (mes - interval '11 months')::date; p_hasta := p_hoy + 1;
    else raise exception 'Período desconocido: %. Usá mes, mes_pasado, 3, 6 o 12', p_periodo using errcode = '22023';
  end case;
end $$;
revoke all on function privado.rango_periodo(text, date) from public, anon, authenticated;

-- ── La cuenta ───────────────────────────────────────────────────────
create or replace function privado.numeros_periodo(p_gimnasio_id uuid, p_desde date, p_hasta date, p_ahora timestamptz)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  zona text; t0 timestamptz; t1 timestamptz; m_fin timestamptz; n_dias int;
  al_ini int; al_fin int; altas int; bajas int; cohorte int; cohorte_bajas int;
  cobrado numeric; prom numeric; dias_visita int; con_visita int; pocas int; entradas int;
  cupos int; reservas int; ausentes int; res_cupo int;
begin
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  if zona is null then raise exception 'Gimnasio inexistente' using errcode = '42501'; end if;
  t0 := privado.medianoche(p_desde, zona); t1 := privado.medianoche(p_hasta, zona);
  m_fin := least(p_ahora, t1 - interval '1 second');
  n_dias := p_hasta - p_desde;

  select count(distinct c.socio_id) into al_ini from public.coberturas c join public.socios s on s.id = c.socio_id
   where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null and c.desde <= t0 and c.hasta > t0 and (s.dado_de_baja_en is null or s.dado_de_baja_en > t0);
  select count(distinct c.socio_id) into al_fin from public.coberturas c join public.socios s on s.id = c.socio_id
   where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null and c.desde <= m_fin and c.hasta > m_fin and (s.dado_de_baja_en is null or s.dado_de_baja_en > m_fin);

  select count(*) into altas from public.socios s where s.gimnasio_id = p_gimnasio_id and s.creado_en >= t0 and s.creado_en < t1;
  select count(*) into bajas from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en >= t0 and s.dado_de_baja_en < t1;
  select count(*), count(*) filter (where s.dado_de_baja_en is not null and s.dado_de_baja_en <= s.creado_en + interval '90 days')
    into cohorte, cohorte_bajas
    from public.socios s where s.gimnasio_id = p_gimnasio_id and s.creado_en >= t0 and s.creado_en < t1;

  select coalesce(sum(p.monto), 0) into cobrado from public.pagos p join public.ventas v on v.id = p.venta_id
   where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and v.estado <> 'anulada' and p.aprobado_en >= t0 and p.aprobado_en < t1;
  prom := (al_ini + al_fin) / 2.0;

  select count(*) into entradas from public.ingresos i
   where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado' and i.momento >= t0 and i.momento < t1;
  with v as (
    select i.socio_id, count(distinct (i.momento at time zone zona)::date) as dias
      from public.ingresos i
     where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado' and i.momento >= t0 and i.momento < t1
     group by i.socio_id
  ), al_dia as (
    select distinct c.socio_id from public.coberturas c join public.socios s on s.id = c.socio_id
     where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null and c.desde <= m_fin and c.hasta > m_fin and (s.dado_de_baja_en is null or s.dado_de_baja_en > m_fin)
  )
  select coalesce(sum(v.dias), 0), count(*),
         (select count(*) from al_dia a left join v v2 on v2.socio_id = a.socio_id where coalesce(v2.dias, 0) * 7 <= n_dias)
    into dias_visita, con_visita, pocas from v;

  select coalesce(sum(c.cupo), 0) into cupos from public.clases c
   where c.gimnasio_id = p_gimnasio_id and c.cancelada_en is null and c.cupo is not null and c.inicio >= t0 and c.inicio < t1;
  select count(*) into res_cupo from public.reservas r join public.clases c on c.id = r.clase_id
   where r.gimnasio_id = p_gimnasio_id and r.estado = 'confirmada' and c.cancelada_en is null and c.cupo is not null and c.inicio >= t0 and c.inicio < t1;
  select count(*) into reservas from public.reservas r join public.clases c on c.id = r.clase_id
   where r.gimnasio_id = p_gimnasio_id and r.estado = 'confirmada' and c.cancelada_en is null and c.inicio >= t0 and c.inicio < t1;
  select count(*) into ausentes from public.reservas r join public.clases c on c.id = r.clase_id
   where r.gimnasio_id = p_gimnasio_id and r.estado = 'confirmada' and c.cancelada_en is null and c.inicio >= t0 and c.inicio < t1 and c.fin < p_ahora
     and not exists (select 1 from public.asistencias a where a.clase_id = r.clase_id and a.socio_id = r.socio_id and a.anulada_en is null);

  return jsonb_build_object(
    'desde', p_desde, 'hasta', p_hasta, 'dias', n_dias,
    'socios', jsonb_build_object('al_dia_inicio', al_ini, 'al_dia_fin', al_fin, 'altas', altas, 'bajas', bajas, 'neto', altas - bajas),
    'churn', jsonb_build_object(
      'general_pct', case when al_ini > 0 then round(bajas * 100.0 / al_ini, 1) end,
      'bajas', bajas, 'base', al_ini,
      'noventa_pct', case when cohorte > 0 then round(cohorte_bajas * 100.0 / cohorte, 1) end,
      'noventa_bajas', cohorte_bajas, 'noventa_altas', cohorte),
    'plata', jsonb_build_object(
      'cobrado', cobrado, 'socios_promedio', round(prom, 1),
      'por_socio', case when prom > 0 then round(cobrado / prom, 2) end),
    'asistencia', jsonb_build_object(
      'entradas', entradas, 'dias_de_visita', dias_visita, 'socios_que_vinieron', con_visita,
      'visitas_por_socio', case when al_fin > 0 then round(dias_visita::numeric / al_fin, 1) end,
      'pocas_visitas', pocas, 'al_dia_fin', al_fin),
    'calor', coalesce((
      select jsonb_agg(jsonb_build_object('dia', x.dow, 'hora', x.h, 'n', x.n) order by x.dow, x.h)
        from (select extract(isodow from i.momento at time zone zona)::int as dow, extract(hour from i.momento at time zone zona)::int as h, count(*) as n
                from public.ingresos i
               where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado' and i.momento >= t0 and i.momento < t1
               group by 1, 2) x), '[]'::jsonb),
    'clases', jsonb_build_object(
      'cupos', cupos, 'reservas', reservas, 'reservas_con_cupo', res_cupo,
      'ocupacion_pct', case when cupos > 0 then round(res_cupo * 100.0 / cupos, 1) end,
      'ausentes', ausentes,
      'por_actividad', coalesce((
        select jsonb_agg(jsonb_build_object('actividad', y.nombre, 'clases', y.clases, 'cupos', y.cupos, 'reservas', y.reservas,
                                             'ocupacion_pct', case when y.cupos > 0 then round(y.reservas_cupo * 100.0 / y.cupos, 1) end) order by y.nombre)
          from (select a.nombre, count(*) as clases, coalesce(sum(c.cupo), 0) as cupos,
                       coalesce(sum((select count(*) from public.reservas r where r.clase_id = c.id and r.estado = 'confirmada')), 0) as reservas,
                       coalesce(sum((select count(*) from public.reservas r where r.clase_id = c.id and r.estado = 'confirmada') * (c.cupo is not null)::int), 0) as reservas_cupo
                  from public.clases c join public.actividades a on a.id = c.actividad_id
                 where c.gimnasio_id = p_gimnasio_id and c.cancelada_en is null and c.inicio >= t0 and c.inicio < t1
                 group by a.nombre) y), '[]'::jsonb)));
end $$;
revoke all on function privado.numeros_periodo(uuid, date, date, timestamptz) from public, anon, authenticated;

create or replace function public.retencion_periodo(p_gimnasio_id uuid, p_periodo text default 'mes') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; r record;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  select * into r from privado.rango_periodo(p_periodo, privado.dia_local(now(), zona));
  return privado.numeros_periodo(p_gimnasio_id, r.p_desde, r.p_hasta, now()) || jsonb_build_object('periodo', coalesce(p_periodo, 'mes'));
end $$;
revoke all on function public.retencion_periodo(uuid, text) from public, anon, authenticated;
grant execute on function public.retencion_periodo(uuid, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  if to_regprocedure('public.retencion_periodo(uuid, text)') is null then raise exception 'Verificación: falta retencion_periodo'; end if;
  if has_function_privilege('anon', 'public.retencion_periodo(uuid, text)', 'execute') then raise exception 'Verificación: retencion_periodo quedó para anon'; end if;
  select * into r from privado.rango_periodo('mes_pasado', date '2026-11-14');
  if r.p_desde <> date '2026-10-01' or r.p_hasta <> date '2026-11-01' then raise exception 'Verificación: rango mes_pasado'; end if;
  select * into r from privado.rango_periodo('3', date '2026-11-14');
  if r.p_desde <> date '2026-09-01' or r.p_hasta <> date '2026-11-15' then raise exception 'Verificación: rango 3 meses'; end if;
end $$;
