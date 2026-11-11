-- F0.3 · retencion_pendientes: antes de las búsquedas por socio, se descartan los que NO pueden caer en por_vencer, nuevo ni no_viene.
-- Mismo resultado (columnas, filas y orden) que la versión de 20261109010210, que a su vez es igual a privado.retencion_referencia
-- (lo prueba retencion-cubierto.test.mjs con momentos fijos). El descarte es exacto, no una aproximación:
--  · sin cuota adelantada (no está en con_futuro), el fin vigente es socios.cubierto_hasta: por_vencer sale de esa fecha, con la MISMA cuenta
--    de la clasificación (días hasta el último día cubierto <= dias_aviso);
--  · nuevo y no_viene exigen "no vino hace poco": quien vino en la última semana no puede caer ahí;
--  · quien no cumple ninguna de las tres cosas termina con lista nula, 'vencido' o 'se_fue', y esas listas no salen de esta función.
-- Así, quien viene seguido y vence lejos no paga las búsquedas de membresía, primer inicio, islas e ingresos.
-- (F0.3 prefiltro: la marca de abajo la busca la verificación.)

do $g$ begin
  if to_regprocedure('privado.retencion_pendientes(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.retencion_pendientes'; end if;
end $g$;

create or replace function privado.retencion_pendientes(p_gimnasio_id uuid, p_momento timestamptz)
returns table (socio_id uuid, nombre text, lista text, dias int)
language sql stable set search_path = '' as $$
with
g as materialized (select gi.id, gi.zona_horaria as zona, c.* from public.gimnasios gi
       join public.configuracion_gimnasio c on c.gimnasio_id = gi.id where gi.id = p_gimnasio_id),
hoy as materialized (select ((p_momento) at time zone g.zona)::date as d from g),
-- Quién tiene una cuota pagada por adelantado (una cobertura que empieza después del momento).
con_futuro as materialized (
  select distinct c.socio_id from public.coberturas c
   where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null and c.desde > p_momento
),
-- Quién vino en los últimos días que importan (el menor entre 7 y los días de ausencia): ese no puede ser nuevo ni no_viene.
reciente as materialized (
  select distinct i.socio_id from public.ingresos i, g
   where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado'
     and i.momento <= p_momento and i.momento > p_momento - make_interval(days => least(7, g.retencion_dias_ausencia))
),
-- F0.3 prefiltro: solo los socios que todavía pueden caer en una de las tres listas.
candidatos as materialized (
  select so.id
    from public.socios so
    cross join g
    cross join hoy
   where so.gimnasio_id = p_gimnasio_id and so.cubierto_hasta > p_momento
     and (so.id in (select f.socio_id from con_futuro f)
          or ((so.cubierto_hasta - interval '1 microsecond') at time zone g.zona)::date - hoy.d <= g.dias_aviso
          or not (so.id in (select r.socio_id from reciente r)))
),
base as (
  select so.id as socio_id, trim(so.nombre || ' ' || so.apellido) as nombre,
         (coalesce(g.plan_familiar_activo, false)
            and exists (select 1 from public.grupos_familiares gf where gf.id = so.grupo_familiar_id and gf.titular_id is not null and gf.titular_id <> so.id)) as vinculado,
         so.dado_de_baja_en, su.id as suscripcion_id, su.baja_en, so.no_escribirle_en is not null as no_escribir,
         an.primer_inicio,
         case when e.complejo then e.fin_actual else so.cubierto_hasta end as fin_actual,
         coalesce(e.complejo and e.tiene_futuro, false) as tiene_futuro,
         (so.id in (select r.socio_id from reciente r)) as vino_hace_poco,
         v.ultimo as ultimo_ingreso
    from public.socios so
    cross join g
    -- La membresía que importa: la activa, o la última si se cerró hace poco (la misma regla de siempre).
    cross join lateral (
      select s.id, s.baja_en from public.suscripciones s
       where s.gimnasio_id = p_gimnasio_id and s.socio_id = so.id and s.inicio <= p_momento
         and (s.baja_en is null or s.baja_en > p_momento - make_interval(days => g.retencion_dias_se_fue))
       order by (s.baja_en is null) desc, s.inicio desc limit 1
    ) su
    cross join lateral (
      select min(s.inicio) as primer_inicio from public.suscripciones s where s.gimnasio_id = p_gimnasio_id and s.socio_id = so.id
    ) an
    left join lateral (
      -- Islas de coberturas contiguas, solo si tiene una que empieza después del momento.
      select bool_or(true) as complejo,
             max(i.hasta) filter (where i.desde <= p_momento and i.hasta > p_momento) as fin_actual,
             coalesce(bool_or(i.desde > p_momento), false) as tiene_futuro
        from (
          select min(m.desde) as desde, max(m.hasta) as hasta
            from (
              select k.desde, k.hasta,
                     sum(case when k.hasta_previo is null or k.desde > k.hasta_previo then 1 else 0 end) over (order by k.desde, k.hasta) as isla
                from (
                  select c.desde, c.hasta,
                         max(c.hasta) over (order by c.desde, c.hasta rows between unbounded preceding and 1 preceding) as hasta_previo
                    from public.coberturas c
                   where c.gimnasio_id = p_gimnasio_id and c.socio_id = so.id and c.anulada_en is null
                ) k
            ) m group by m.isla
        ) i
       where so.id in (select f.socio_id from con_futuro f)
    ) e on true
    left join lateral (
      -- La última visita exacta, solo para quien no vino hace poco (para los demás no se usa).
      select max(i.momento) as ultimo from public.ingresos i
       where not (so.id in (select r.socio_id from reciente r))
         and i.gimnasio_id = p_gimnasio_id and i.socio_id = so.id and i.anulado_en is null
         and i.resultado <> 'rechazado' and i.momento <= p_momento
    ) v on true
   where so.id in (select ca.id from candidatos ca)
),
clasificado as (
  select b.*, hoy.d as hoy_d,
    case
      when b.dado_de_baja_en is not null and b.dado_de_baja_en <= p_momento then 'se_fue'
      when b.baja_en is not null and b.baja_en <= p_momento then 'se_fue'
      when b.fin_actual is null and not b.tiene_futuro then 'vencido'
      when b.fin_actual is not null
           and ((b.fin_actual - interval '1 microsecond') at time zone g.zona)::date - hoy.d <= g.dias_aviso then 'por_vencer'
      when b.fin_actual is not null and not b.vino_hace_poco and b.primer_inicio > p_momento - make_interval(days => g.retencion_dias_nuevo)
           and coalesce(b.ultimo_ingreso, b.primer_inicio) <= p_momento - interval '7 days' then 'nuevo'
      when b.fin_actual is not null and not b.vino_hace_poco
           and coalesce(b.ultimo_ingreso, b.primer_inicio) <= p_momento - make_interval(days => g.retencion_dias_ausencia) then 'no_viene'
    end as lista
    from base b cross join g cross join hoy
),
final as (
  select c.socio_id, c.nombre, c.lista,
    case
      when c.lista in ('no_viene', 'nuevo') then c.hoy_d - ((coalesce(c.ultimo_ingreso, c.primer_inicio)) at time zone (select zona from g))::date
      when c.lista = 'por_vencer' then ((c.fin_actual - interval '1 microsecond') at time zone (select zona from g))::date - c.hoy_d
    end as dias
    from clasificado c
   where c.lista in ('por_vencer', 'nuevo', 'no_viene')
     and not (c.vinculado and c.lista = 'por_vencer')
     and not (c.no_escribir and c.lista in ('nuevo', 'no_viene'))
     -- Suspendido o congelado: sin lista (se mira solo ahora, para quien ya cayó en una).
     and not exists (select 1 from public.suspensiones x where x.socio_id = c.socio_id and x.desde <= p_momento
                      and (x.hasta is null or x.hasta > p_momento) and (x.levantada_en is null or x.levantada_en > p_momento))
     and not exists (select 1 from public.congelamientos z where z.suscripcion_id = c.suscripcion_id and z.anulado_en is null
                      and z.desde <= p_momento and coalesce(z.hasta_real, z.hasta_prevista) > p_momento)
)
select f.socio_id, f.nombre, f.lista, f.dias from final f
order by array_position(array['vencido', 'por_vencer', 'nuevo', 'no_viene', 'se_fue'], f.lista),
         case when f.lista = 'por_vencer' then f.dias else -f.dias end, f.nombre
$$;
revoke all on function privado.retencion_pendientes(uuid, timestamptz) from public, anon, authenticated;

do $v$ begin
  if not exists (select 1 from pg_proc where oid = 'privado.retencion_pendientes(uuid, timestamptz)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: retencion_pendientes sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'privado.retencion_pendientes(uuid, timestamptz)', 'execute')
     or has_function_privilege('authenticated', 'privado.retencion_pendientes(uuid, timestamptz)', 'execute') then
    raise exception 'Verificación: retencion_pendientes ejecutable desde el navegador';
  end if;
  if pg_get_functiondef('privado.retencion_pendientes(uuid, timestamptz)'::regprocedure) not like '%F0.3 prefiltro%' then
    raise exception 'Verificación: retencion_pendientes sin el prefiltro';
  end if;
end $v$;
