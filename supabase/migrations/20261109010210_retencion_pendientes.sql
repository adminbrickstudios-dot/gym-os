-- BASE-1 / F0.3 · Lo mínimo que necesitan Pendientes y Para hacer hoy: quién cae en por_vencer, nuevo y no_viene, con sus días.
-- Es la MISMA clasificación de privado.retencion_referencia (misma membresía vigente, mismas islas de coberturas, mismos cortes y mismo
-- orden), sin lo que ahí no se usa: ni precios, ni plan, ni frecuencia por semana, ni último contacto, ni mensajes.
-- Cómo trabaja: parte de los socios con cobertura vigente o futura (socios.cubierto_hasta > momento, por el índice
-- (gimnasio_id, cubierto_hasta)) y de CADA UNO busca lo suyo por índice (su membresía, su primer inicio, sus coberturas, su última visita).
-- Sin uniones entre listas grandes: el plan no depende de que Postgres adivine bien cuántas filas hay (con 5.000 socios una versión con
-- uniones entre CTE se volvió cuadrática en Actions). Las islas de coberturas solo se arman para quien tiene una cobertura que EMPIEZA
-- después del momento (una cuota pagada por adelantado): toda cobertura que termina después del momento y ya empezó se superpone con
-- las demás en ese instante, forma una sola isla y su fin es cubierto_hasta (el mayor "hasta" de todo).
-- La prueba de base "retencion-cubierto" compara sus columnas (socio_id, nombre, lista, dias) y su orden contra privado.retencion_referencia.

do $g$ begin
  if to_regprocedure('privado.retencion_referencia(uuid, timestamptz, jsonb, boolean)') is null then raise exception 'Guarda: falta privado.retencion_referencia'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'socios' and column_name = 'cubierto_hasta') then
    raise exception 'Guarda: falta socios.cubierto_hasta (BASE-5)';
  end if;
end $g$;

create or replace function privado.retencion_pendientes(p_gimnasio_id uuid, p_momento timestamptz)
returns table (socio_id uuid, nombre text, lista text, dias int)
language sql stable set search_path = '' as $$
with
g as materialized (select gi.id, gi.zona_horaria as zona, c.* from public.gimnasios gi
       join public.configuracion_gimnasio c on c.gimnasio_id = gi.id where gi.id = p_gimnasio_id),
hoy as materialized (select ((p_momento) at time zone g.zona)::date as d from g),
base as (
  select so.id as socio_id, trim(so.nombre || ' ' || so.apellido) as nombre,
         (coalesce(g.plan_familiar_activo, false)
            and exists (select 1 from public.grupos_familiares gf where gf.id = so.grupo_familiar_id and gf.titular_id is not null and gf.titular_id <> so.id)) as vinculado,
         so.dado_de_baja_en, su.baja_en, so.no_escribirle_en is not null as no_escribir,
         an.primer_inicio,
         case when e.complejo then e.fin_actual else so.cubierto_hasta end as fin_actual,
         coalesce(e.complejo and e.tiene_futuro, false) as tiene_futuro,
         v.ultimo as ultimo_ingreso,
         exists (select 1 from public.congelamientos c where c.suscripcion_id = su.id and c.anulado_en is null
                  and c.desde <= p_momento and coalesce(c.hasta_real, c.hasta_prevista) > p_momento) as congelado,
         exists (select 1 from public.suspensiones x where x.socio_id = so.id and x.desde <= p_momento
                  and (x.hasta is null or x.hasta > p_momento) and (x.levantada_en is null or x.levantada_en > p_momento)) as suspendido
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
       where exists (select 1 from public.coberturas f where f.gimnasio_id = p_gimnasio_id and f.socio_id = so.id and f.anulada_en is null and f.desde > p_momento)
    ) e on true
    left join lateral (
      select max(i.momento) as ultimo from public.ingresos i
       where i.gimnasio_id = p_gimnasio_id and i.socio_id = so.id and i.anulado_en is null
         and i.resultado <> 'rechazado' and i.momento <= p_momento
    ) v on true
   where so.gimnasio_id = p_gimnasio_id and so.cubierto_hasta > p_momento
),
clasificado as (
  select b.*, hoy.d as hoy_d,
    case
      when b.suspendido or b.congelado then null
      when b.dado_de_baja_en is not null and b.dado_de_baja_en <= p_momento then 'se_fue'
      when b.baja_en is not null and b.baja_en <= p_momento then 'se_fue'
      when b.fin_actual is null and not b.tiene_futuro then 'vencido'
      when b.fin_actual is not null
           and ((b.fin_actual - interval '1 microsecond') at time zone g.zona)::date - hoy.d <= g.dias_aviso then 'por_vencer'
      when b.fin_actual is not null and b.primer_inicio > p_momento - make_interval(days => g.retencion_dias_nuevo)
           and coalesce(b.ultimo_ingreso, b.primer_inicio) <= p_momento - interval '7 days' then 'nuevo'
      when b.fin_actual is not null
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
end $v$;
