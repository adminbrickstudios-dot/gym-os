-- BASE-1 / F0.3 · Lo mínimo que necesitan Pendientes y Para hacer hoy: quién cae en por_vencer, nuevo y no_viene, con sus días.
-- Es la MISMA clasificación de privado.retencion_nucleo (misma membresía vigente, mismas islas de coberturas, mismos cortes y mismo
-- orden), sin lo que ahí no se usa: ni precios, ni plan, ni frecuencia por semana, ni último contacto, ni mensajes, ni los socios sin
-- cobertura vigente o futura (socios.cubierto_hasta <= momento: de ellos solo salen vencido y se_fue). La prueba de base
-- "retencion-cubierto" compara sus columnas (socio_id, nombre, lista, dias) y su orden contra privado.retencion_referencia.

do $g$ begin
  if to_regprocedure('privado.retencion_referencia(uuid, timestamptz, jsonb, boolean)') is null then raise exception 'Guarda: falta privado.retencion_referencia'; end if;
  if to_regprocedure('privado.retencion_nucleo(uuid, timestamptz, jsonb, boolean, text[])') is null then raise exception 'Guarda: falta privado.retencion_nucleo'; end if;
end $g$;

create or replace function privado.retencion_pendientes(p_gimnasio_id uuid, p_momento timestamptz)
returns table (socio_id uuid, nombre text, lista text, dias int)
language sql stable set search_path = '' as $$
with
g as (select gi.id, gi.zona_horaria as zona, c.* from public.gimnasios gi
       join public.configuracion_gimnasio c on c.gimnasio_id = gi.id where gi.id = p_gimnasio_id),
hoy as (select ((p_momento) at time zone g.zona)::date as d from g),
sus as (
  select distinct on (s.socio_id) s.*
    from public.suscripciones s, g
   where s.gimnasio_id = g.id and s.inicio <= p_momento
     and (s.baja_en is null or s.baja_en > p_momento - make_interval(days => g.retencion_dias_se_fue))
   order by s.socio_id, (s.baja_en is null) desc, s.inicio desc
),
-- Solo los socios con algo cubierto que termina después del momento (los demás no pueden ser por_vencer, nuevo ni no_viene).
sus_a as (
  select s.* from sus s join public.socios so on so.id = s.socio_id and so.gimnasio_id = p_gimnasio_id where so.cubierto_hasta > p_momento
),
-- Los que ya tienen una cobertura que EMPIEZA después del momento (una cuota pagada por adelantado) necesitan las islas. Los demás no:
-- toda su cobertura que termina después del momento ya empezó, así que se superpone con las otras en ese instante y forma una sola
-- isla cuyo fin es cubierto_hasta (el mayor "hasta" de todo).
con_futuro as (
  select distinct c.socio_id from public.coberturas c
   where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null and c.desde > p_momento
),
sus_c as (select a.* from sus_a a where a.socio_id in (select socio_id from con_futuro)),
antiguedad as (
  select s.socio_id, min(s.inicio) as primer_inicio from public.suscripciones s
   where s.gimnasio_id = p_gimnasio_id and s.socio_id in (select a.socio_id from sus_a a) group by s.socio_id
),
cob as (
  select c.socio_id, c.desde, c.hasta,
         max(c.hasta) over (partition by c.socio_id order by c.desde, c.hasta
                            rows between unbounded preceding and 1 preceding) as hasta_previo
    from public.coberturas c
   where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null and c.socio_id in (select s.socio_id from sus_c s)
),
islas_marcadas as (
  select *, sum(case when hasta_previo is null or desde > hasta_previo then 1 else 0 end)
              over (partition by socio_id order by desde, hasta) as isla
    from cob
),
islas as (
  select socio_id, min(desde) as desde, max(hasta) as hasta from islas_marcadas group by socio_id, isla
),
estado as (
  select s.socio_id,
         max(i.hasta) filter (where i.desde <= p_momento and i.hasta > p_momento) as fin_actual,
         max(i.hasta) filter (where i.hasta <= p_momento) as ultimo_fin,
         coalesce(bool_or(i.desde > p_momento), false) as tiene_futuro
    from sus_c s left join islas i on i.socio_id = s.socio_id
   group by s.socio_id
  union all
  select s.socio_id, so.cubierto_hasta, null::timestamptz, false
    from sus_a s join public.socios so on so.id = s.socio_id and so.gimnasio_id = p_gimnasio_id
   where s.socio_id not in (select socio_id from con_futuro)
),
base as (
  select so.id as socio_id, trim(so.nombre || ' ' || so.apellido) as nombre,
         (coalesce(g.plan_familiar_activo, false) and gf.titular_id is not null and gf.titular_id <> so.id) as vinculado,
         so.dado_de_baja_en, su.baja_en, so.no_escribirle_en is not null as no_escribir,
         an.primer_inicio, e.fin_actual, e.ultimo_fin, e.tiene_futuro, v.ultimo as ultimo_ingreso,
         exists (select 1 from public.congelamientos c where c.suscripcion_id = su.id and c.anulado_en is null
                  and c.desde <= p_momento and coalesce(c.hasta_real, c.hasta_prevista) > p_momento) as congelado,
         exists (select 1 from public.suspensiones x where x.socio_id = so.id and x.desde <= p_momento
                  and (x.hasta is null or x.hasta > p_momento) and (x.levantada_en is null or x.levantada_en > p_momento)) as suspendido
    from public.socios so
    join sus_a su on su.socio_id = so.id
    join antiguedad an on an.socio_id = so.id
    join estado e on e.socio_id = so.id
    left join public.grupos_familiares gf on gf.id = so.grupo_familiar_id
    cross join g
    left join lateral (
      select max(i.momento) as ultimo from public.ingresos i
       where i.gimnasio_id = p_gimnasio_id and i.socio_id = so.id and i.anulado_en is null
         and i.resultado <> 'rechazado' and i.momento <= p_momento
    ) v on true
   where so.gimnasio_id = p_gimnasio_id
),
clasificado as (
  select b.*, hoy.d as hoy_d,
    case
      when b.suspendido or b.congelado then null
      when b.dado_de_baja_en is not null and b.dado_de_baja_en <= p_momento then 'se_fue'
      when b.baja_en is not null and b.baja_en <= p_momento then 'se_fue'
      when b.fin_actual is null and not b.tiene_futuro
           and hoy.d - ((coalesce(b.ultimo_fin, b.primer_inicio)) at time zone g.zona)::date > g.retencion_dias_vencido then 'se_fue'
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
