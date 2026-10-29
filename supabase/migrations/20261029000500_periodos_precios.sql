-- ═══════════════════════════════════════════════════════════════════
-- 0005 · Períodos y precios: la aritmética que comparten el cálculo de
-- acceso (cuánto debe) y el cobro (qué período cubre lo que paga).
-- Una sola lógica para las dos cosas: lo que la recepción ve como deuda
-- es exactamente lo que va a cobrar.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.coberturas') is null then raise exception 'Guarda: falta la migración 0004'; end if;
end $$;

-- Fin de la cadena de coberturas contiguas que contiene p_momento.
-- null si p_momento no está cubierto.
create or replace function privado.fin_cadena(p_suscripcion_id uuid, p_momento timestamptz) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare fin timestamptz; siguiente timestamptz;
begin
  select max(c.hasta) into fin from public.coberturas c
   where c.suscripcion_id = p_suscripcion_id and c.anulada_en is null
     and c.desde <= p_momento and c.hasta > p_momento;
  if fin is null then return null; end if;
  loop
    select max(c.hasta) into siguiente from public.coberturas c
     where c.suscripcion_id = p_suscripcion_id and c.anulada_en is null
       and c.desde <= fin and c.hasta > fin;
    exit when siguiente is null or siguiente <= fin;
    fin := siguiente;
  end loop;
  return fin;
end $$;
revoke all on function privado.fin_cadena(uuid, timestamptz) from public;

-- ── Precio ─────────────────────────────────────────────────────────
-- Las filas de un plan con el mismo vigente_desde forman una LISTA.
-- Rige la última lista vigente (un aumento es una lista nueva completa:
-- un descuento viejo no queda pegado al precio viejo). Si esa lista tiene
-- filas de la sede, mandan las de la sede. Entre las filas que aplican
-- (medio de pago, día del mes), el socio paga el MENOR monto.
create or replace function privado.precio_para(
  p_plan_id uuid, p_momento timestamptz, p_medio text, p_sede_id uuid, p_aplicar_dia boolean
) returns numeric
language sql stable set search_path = '' as $$
  with filas as (
    select p.* from public.precios_plan p
     where p.plan_id = p_plan_id and p.vigente_desde <= p_momento
       and (p.sede_id is null or p.sede_id = p_sede_id)
  ), lista as (
    select max(f.vigente_desde) as v from filas f
  ), en_lista as (
    select f.* from filas f, lista where f.vigente_desde = lista.v
  ), nivel as (
    select coalesce(bool_or(e.sede_id is not null), false) as hay_sede from en_lista e
  ), dia as (
    select extract(day from p_momento at time zone g.zona_horaria)::int as d
      from public.planes pl join public.gimnasios g on g.id = pl.gimnasio_id where pl.id = p_plan_id
  )
  select min(e.monto) from en_lista e, nivel, dia
   where (e.sede_id is not null) = nivel.hay_sede
     and (e.medio_pago is null or e.medio_pago = p_medio)
     and (e.pago_hasta_dia is null or (p_aplicar_dia and e.pago_hasta_dia >= dia.d))
$$;
revoke all on function privado.precio_para(uuid, timestamptz, text, uuid, boolean) from public;

-- La deuda se calcula con el precio de lista (sin descuentos por medio ni por día).
create or replace function privado.precio_base(p_plan_id uuid, p_momento timestamptz) returns numeric
language sql stable set search_path = '' as $$
  select privado.precio_para(p_plan_id, p_momento, null, null, false)
$$;
revoke all on function privado.precio_base(uuid, timestamptz) from public;

-- ── Meses con ancla ────────────────────────────────────────────────
-- p_inicio + p_meses, cayendo en el día p_ancla del mes (recortado al
-- último día si el mes es más corto). 31/01 → 28/02 → 31/03 → 30/04.
create or replace function privado.sumar_meses_ancla(p_inicio date, p_meses int, p_ancla int) returns date
language sql immutable parallel safe set search_path = '' as $$
  select (date_trunc('month', p_inicio::timestamp) + make_interval(months => p_meses))::date
       + (least(p_ancla,
                extract(day from date_trunc('month', p_inicio::timestamp) + make_interval(months => p_meses + 1) - interval '1 day')::int)
          - 1)
$$;

-- El último "día X" (recortado al fin de mes) que no es posterior a p_dia.
create or replace function privado.ultimo_dia_x(p_dia date, p_x int) returns date
language sql immutable parallel safe set search_path = '' as $$
  select case when privado.sumar_meses_ancla(p_dia, 0, p_x) <= p_dia
              then privado.sumar_meses_ancla(p_dia, 0, p_x)
              else privado.sumar_meses_ancla(p_dia, -1, p_x) end
$$;
revoke all on function privado.sumar_meses_ancla(date, int, int), privado.ultimo_dia_x(date, int) from public;

-- ── Qué período cubre la próxima cuota ─────────────────────────────
-- Si hay cobertura vigente o futura: arranca donde termina la última
--   (paga por adelantado) y mantiene el ancla de esa cadena.
-- Si no:
--   continua    → desde que venció (los días sin cubrir se cobran)
--   desde_pago  → desde hoy (los días sin cubrir se pierden)
--   dia_fijo    → desde el último "día X" (sin pisar lo ya pagado)
--   reinicio_tras_dias: afuera más que eso → arranca hoy
-- Primera cuota: desde hoy (día fijo: desde el último día X).
create or replace function privado.proximo_periodo(
  p_suscripcion_id uuid, p_momento timestamptz,
  out p_desde timestamptz, out p_hasta timestamptz, out p_ancla int
)
language plpgsql stable set search_path = '' as $$
declare
  s public.suscripciones; pl public.planes; zona text; hoy date;
  futuro timestamptz; ultimo timestamptz; ref timestamptz; inicio date; ult record;
begin
  select * into s from public.suscripciones where id = p_suscripcion_id;
  if not found then raise exception 'Suscripción inexistente' using errcode = 'P0002'; end if;
  select * into pl from public.planes where id = s.plan_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = s.gimnasio_id;
  hoy := privado.dia_local(p_momento, zona);

  select max(c.hasta) into futuro from public.coberturas c
   where c.suscripcion_id = s.id and c.anulada_en is null and c.hasta > p_momento;

  if futuro is not null then
    inicio := privado.dia_local(futuro, zona); ref := futuro;
  else
    select max(c.hasta) into ultimo from public.coberturas c
     where c.suscripcion_id = s.id and c.anulada_en is null and c.hasta <= p_momento;
    if ultimo is null then
      inicio := greatest(hoy, privado.dia_local(s.inicio, zona));
      if pl.renovacion = 'dia_fijo' then inicio := privado.ultimo_dia_x(inicio, pl.dia_fijo); end if;
    elsif pl.reinicio_tras_dias is not null and hoy - privado.dia_local(ultimo, zona) >= pl.reinicio_tras_dias then
      inicio := hoy;
      if pl.renovacion = 'dia_fijo' then inicio := privado.ultimo_dia_x(hoy, pl.dia_fijo); end if;
    elsif pl.renovacion = 'desde_pago' then
      inicio := hoy;
    elsif pl.renovacion = 'dia_fijo' then
      inicio := greatest(privado.ultimo_dia_x(hoy, pl.dia_fijo), privado.dia_local(ultimo, zona));
    else
      inicio := privado.dia_local(ultimo, zona); ref := ultimo;
    end if;
  end if;

  if ref is not null then
    -- Mantener el ancla de la última cuota si la cadena termina justo ahí;
    -- si terminó corrida (días devueltos), el ancla pasa a ser ese día.
    select c.hasta, c.ancla_dia into ult from public.coberturas c
     where c.suscripcion_id = s.id and c.anulada_en is null and c.origen <> 'compensacion' and c.hasta <= ref
     order by c.hasta desc limit 1;
    if found and ult.hasta = ref and ult.ancla_dia is not null then
      p_ancla := ult.ancla_dia;
    else
      p_ancla := extract(day from inicio)::int;
    end if;
  elsif pl.renovacion = 'dia_fijo' then
    p_ancla := pl.dia_fijo;
  else
    p_ancla := extract(day from inicio)::int;
  end if;

  p_desde := privado.medianoche(inicio, zona);
  p_hasta := privado.medianoche(privado.sumar_meses_ancla(inicio, pl.duracion_meses, p_ancla), zona);
  if p_hasta <= p_desde then
    p_hasta := privado.medianoche(privado.sumar_meses_ancla(inicio, pl.duracion_meses + 1, p_ancla), zona);
  end if;
end $$;
revoke all on function privado.proximo_periodo(uuid, timestamptz) from public;

-- Cuántas cuotas tiene que pagar hoy para quedar cubierto: la misma
-- secuencia de períodos que va a generar el cobro.
create or replace function privado.cuotas_para_cubrir(p_suscripcion_id uuid, p_momento timestamptz) returns int
language plpgsql stable set search_path = '' as $$
declare per record; k int := 1; fin timestamptz; zona text; meses int;
begin
  select g.zona_horaria, pl.duracion_meses into zona, meses
    from public.suscripciones s join public.planes pl on pl.id = s.plan_id join public.gimnasios g on g.id = s.gimnasio_id
   where s.id = p_suscripcion_id;
  select * into per from privado.proximo_periodo(p_suscripcion_id, p_momento);
  fin := per.p_hasta;
  while fin <= p_momento loop
    k := k + 1;
    if k > 240 then raise exception 'Deuda fuera de rango para la suscripción %', p_suscripcion_id; end if;
    fin := privado.medianoche(privado.sumar_meses_ancla(privado.dia_local(fin, zona), meses, per.p_ancla), zona);
  end loop;
  return k;
end $$;
revoke all on function privado.cuotas_para_cubrir(uuid, timestamptz) from public;
