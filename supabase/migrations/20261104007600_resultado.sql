-- 0076 · Resultado: la plata del mes, clara (RES-1).
-- Ingresos del mes contra el anterior, por medio, por concepto (plan,
-- productos, matrícula…) y por día; socios activos, altas y bajas; ingreso
-- mensual recurrente estimado; horas pico de entradas. Todo calculado al
-- abrirlo, con las mismas reglas que Inicio y el Resumen (lo fiado no es
-- plata que entró).
--   resultado_mes(gimnasio, mes)   dueño y encargado; mes = cualquier día del mes

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.resumen_periodo(uuid, timestamptz, timestamptz)') is null then raise exception 'Guarda: falta la migración 0074'; end if;
  if to_regprocedure('privado.precio_base(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.precio_base'; end if;
end $$;

-- Lo cobrado en [desde, hasta), sin lo fiado.
create or replace function privado.cobrado_entre(p_gimnasio_id uuid, p_desde timestamptz, p_hasta timestamptz) returns numeric
language sql stable set search_path = '' as $$
  select coalesce(sum(p.monto), 0) from public.pagos p
   where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.medio <> 'cuenta_corriente'
     and p.aprobado_en >= p_desde and p.aprobado_en < p_hasta
$$;
revoke all on function privado.cobrado_entre(uuid, timestamptz, timestamptz) from public;

create or replace function public.resultado_mes(p_gimnasio_id uuid, p_mes date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; mes date; fin date; ant date; d0 timestamptz; d1 timestamptz; corte timestamptz; dias int; en_curso boolean;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  mes := date_trunc('month', coalesce(p_mes, hoy))::date;
  if mes > hoy then raise exception 'Ese mes todavía no empezó' using errcode = '22023'; end if;
  fin := (mes + interval '1 month')::date;
  ant := (mes - interval '1 month')::date;
  en_curso := hoy < fin;
  d0 := privado.medianoche(mes, zona);
  d1 := privado.medianoche(fin, zona);
  corte := least(now(), d1);
  -- Para comparar un mes en curso: el anterior hasta el mismo día.
  dias := case when en_curso then hoy - mes + 1 else fin - mes end;

  return jsonb_build_object(
    'mes', mes, 'en_curso', en_curso, 'dias', dias,
    'cobrado', privado.cobrado_entre(p_gimnasio_id, d0, corte),
    'anterior_mismo_periodo', privado.cobrado_entre(p_gimnasio_id, privado.medianoche(ant, zona), privado.medianoche(least(ant + dias, mes), zona)),
    'anterior_total', privado.cobrado_entre(p_gimnasio_id, privado.medianoche(ant, zona), d0),
    'fiado', (select coalesce(sum(p.monto), 0) from public.pagos p where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado'
                and p.medio = 'cuenta_corriente' and p.aprobado_en >= d0 and p.aprobado_en < d1),
    'por_medio', (select coalesce(jsonb_agg(jsonb_build_object('medio', medio, 'total', t) order by t desc), '[]'::jsonb) from (
                    select p.medio, sum(p.monto) t from public.pagos p
                     where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.medio <> 'cuenta_corriente' and p.aprobado_en >= d0 and p.aprobado_en < d1
                     group by p.medio) x),
    -- Por lo vendido (ventas no anuladas del mes), con el nombre del plan.
    'por_concepto', (select coalesce(jsonb_agg(jsonb_build_object('concepto', concepto, 'total', t, 'cantidad', n) order by t desc), '[]'::jsonb) from (
                       select case when i.plan_id is not null then pl.nombre when i.tipo = 'producto' then 'Productos'
                                   when i.tipo = 'matricula' then 'Matrícula' when i.tipo = 'adicional' then 'Recargos'
                                   when i.tipo = 'deuda' then 'Pagos de deuda' else 'Otros' end as concepto,
                              sum(i.cantidad * i.precio_unitario - i.descuento) t, sum(i.cantidad)::int n
                         from public.venta_items i join public.ventas v on v.id = i.venta_id left join public.planes pl on pl.id = i.plan_id
                        where v.gimnasio_id = p_gimnasio_id and v.estado <> 'anulada' and v.creado_en >= d0 and v.creado_en < d1
                        group by 1) x where t > 0),
    'por_dia', (select jsonb_agg(jsonb_build_object('dia', d::date, 'total',
                  privado.cobrado_entre(p_gimnasio_id, privado.medianoche(d::date, zona), privado.medianoche(d::date + 1, zona))) order by d)
                  from generate_series(mes, least(fin - 1, hoy), interval '1 day') d),
    'activos', (select count(distinct c.socio_id) from public.coberturas c join public.socios s on s.id = c.socio_id
                 where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null and c.desde <= corte - interval '1 second' and c.hasta > corte - interval '1 second'
                   and (s.dado_de_baja_en is null or s.dado_de_baja_en > corte)),
    'altas', (select count(*) from public.socios s where s.gimnasio_id = p_gimnasio_id and s.creado_en >= d0 and s.creado_en < d1),
    'bajas', (select count(*) from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en >= d0 and s.dado_de_baja_en < d1),
    -- Lo que entra por mes si todos los que hoy tienen membresía al día la renuevan, al precio de hoy.
    'recurrente', (select coalesce(round(sum(privado.precio_base(su.plan_id, now()) / greatest(pl.duracion_meses, 1))), 0)
                     from public.suscripciones su join public.planes pl on pl.id = su.plan_id join public.socios s on s.id = su.socio_id
                    where su.gimnasio_id = p_gimnasio_id and su.baja_en is null and pl.tipo = 'membresia' and s.dado_de_baja_en is null
                      and exists (select 1 from public.coberturas c where c.suscripcion_id = su.id and c.anulada_en is null and c.desde <= now() and c.hasta > now())),
    'horas', (select jsonb_agg(coalesce(n, 0) order by h) from generate_series(0, 23) h left join (
                select extract(hour from i.momento at time zone zona)::int hora, count(*) n from public.ingresos i
                 where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado' and i.momento >= d0 and i.momento < d1
                 group by 1) x on x.hora = h)
  );
end $$;

revoke all on function public.resultado_mes(uuid, date) from public, anon, authenticated;
grant execute on function public.resultado_mes(uuid, date) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.resultado_mes(uuid, date)', 'privado.cobrado_entre(uuid, timestamptz, timestamptz)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
