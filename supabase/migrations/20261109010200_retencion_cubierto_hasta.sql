-- BASE-1 / F1.6 / F0.3 · Retención con socios.cubierto_hasta (D36/BASE-5): ningún veredicto cambia.
-- La cuenta es la misma de siempre (privado.retencion_referencia guarda la anterior para la prueba). Lo que cambia es el trabajo:
--  1) el socio sin cobertura vigente ni futura (cubierto_hasta pasó o es null) no arma sus islas de coberturas: su estado sale
--     directo de la columna (fin_actual null, ultimo_fin = cubierto_hasta);
--  2) quien pide solo algunas listas (p_listas) y ninguna es vencido ni se_fue ni recorre a esos socios.
-- privado.retencion_con (4 argumentos) queda igual de cara afuera: llama al núcleo con p_listas = null.
-- privado.retencion_listas(gimnasio, momento, listas, liviano) es lo nuevo para Pendientes, Vencen hoy, Inicio y Para hacer hoy.

do $g$ begin
  if to_regprocedure('privado.retencion_referencia(uuid, timestamptz, jsonb, boolean)') is null then raise exception 'Guarda: falta privado.retencion_referencia'; end if;
  if to_regprocedure('privado.retencion_con(uuid, timestamptz, jsonb, boolean)') is null then raise exception 'Guarda: falta privado.retencion_con'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'socios' and column_name = 'cubierto_hasta') then
    raise exception 'Guarda: falta socios.cubierto_hasta (BASE-5)';
  end if;
end $g$;

create or replace function privado.retencion_nucleo(p_gimnasio_id uuid, p_momento timestamptz, p_plantillas jsonb, p_liviano boolean default false, p_listas text[] default null)
returns table (
  socio_id uuid, nombre text, telefono text, lista text, texto text, dias int,
  vence_en timestamptz, monto_mensual numeric, debe numeric, ultimo_ingreso timestamptz,
  visitas_por_semana numeric, ultimo_contacto_en timestamptz, ultimo_contacto_por text,
  ultimo_contacto_resultado text, mensaje text
)
language sql stable set search_path = '' as $$
with
g as (select gi.id, gi.nombre, gi.zona_horaria as zona, c.* from public.gimnasios gi
       join public.configuracion_gimnasio c on c.gimnasio_id = gi.id where gi.id = p_gimnasio_id),
cfg as (select c from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id),
hoy as (select ((p_momento) at time zone g.zona)::date as d from g),
-- La membresía que importa de cada socio: la activa, o la última si se cerró hace poco.
sus as (
  select distinct on (s.socio_id) s.*
    from public.suscripciones s, g
   where s.gimnasio_id = g.id and s.inicio <= p_momento
     and (s.baja_en is null or s.baja_en > p_momento - make_interval(days => g.retencion_dias_se_fue))
   order by s.socio_id, (s.baja_en is null) desc, s.inicio desc
),
-- BASE-1 / D36: el socio cuyo fin de cobertura guardado (socios.cubierto_hasta) ya pasó, o que nunca pagó, NO tiene cobertura
-- vigente ni futura: fin_actual = null, tiene_futuro = false y ultimo_fin = cubierto_hasta (el mayor "hasta" de todo lo que
-- pagó). Ese no necesita las islas. Solo se arman las islas de los que tienen algo que termina después del momento.
sus_a as (
  select s.* from sus s join public.socios so on so.id = s.socio_id and so.gimnasio_id = p_gimnasio_id where so.cubierto_hasta > p_momento
),
-- Desde cuándo es socio: su primera membresía (un cambio de plan no lo hace "nuevo").
antiguedad as (
  select s.socio_id, min(s.inicio) as primer_inicio from public.suscripciones s
   where s.gimnasio_id = p_gimnasio_id group by s.socio_id
),
-- Islas de coberturas contiguas POR SOCIO, sumando todas sus membresías
-- (lo pagado en el plan viejo cuenta para ver desde cuándo debe).
cob as (
  select c.socio_id, c.desde, c.hasta,
         max(c.hasta) over (partition by c.socio_id order by c.desde, c.hasta
                            rows between unbounded preceding and 1 preceding) as hasta_previo
    from public.coberturas c
   where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null and c.socio_id in (select s.socio_id from sus_a s)
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
    from sus_a s left join islas i on i.socio_id = s.socio_id
   group by s.socio_id
  union all
  select s.socio_id, null::timestamptz, so.cubierto_hasta, false
    from sus s join public.socios so on so.id = s.socio_id and so.gimnasio_id = p_gimnasio_id
   where so.cubierto_hasta is null or so.cubierto_hasta <= p_momento
),
precios as (
  select p.id as plan_id, privado.precio_base(p.id, p_momento) as precio
    from public.planes p where p.gimnasio_id = p_gimnasio_id and p.tipo = 'membresia'
),
base as (
  select so.id as socio_id, trim(so.nombre || ' ' || so.apellido) as nombre, so.nombre as nombre_pila,
         -- Un menor (D10): se le escribe al responsable.
         case when coalesce(so.fecha_nacimiento > (((p_momento) at time zone (select zona from g))::date - interval '18 years')::date, false) then so.responsable_telefono else so.telefono end as telefono,
         -- VD-46G: con el plan familiar prendido, el cobro de los vinculados va al titular (una sola vez).
         (coalesce((select g3.plan_familiar_activo from g g3), false) and gf.titular_id is not null and gf.titular_id <> so.id) as vinculado,
         case when coalesce((select g3.plan_familiar_activo from g g3), false) and gf.titular_id = so.id
              then (select count(*) from public.socios m where m.grupo_familiar_id = gf.id and m.id <> so.id and m.dado_de_baja_en is null)::int end as vinculados,
         so.dado_de_baja_en, so.motivo_baja, so.no_escribirle_en is not null as no_escribir, su.id as suscripcion_id, su.baja_en, su.plan_id,
         an.primer_inicio, e.fin_actual, e.ultimo_fin, e.tiene_futuro, v.ultimo as ultimo_ingreso, f.por_semana,
         round(pr.precio / pl.duracion_meses, 2) as monto_mensual,
         exists (select 1 from public.congelamientos c where c.suscripcion_id = su.id and c.anulado_en is null
                  and c.desde <= p_momento and coalesce(c.hasta_real, c.hasta_prevista) > p_momento) as congelado,
         exists (select 1 from public.suspensiones x where x.socio_id = so.id and x.desde <= p_momento
                  and (x.hasta is null or x.hasta > p_momento) and (x.levantada_en is null or x.levantada_en > p_momento)) as suspendido
    from public.socios so
    join sus su on su.socio_id = so.id
    join antiguedad an on an.socio_id = so.id
    join estado e on e.socio_id = so.id
    join public.planes pl on pl.id = su.plan_id
    left join public.grupos_familiares gf on gf.id = so.grupo_familiar_id
    left join precios pr on pr.plan_id = su.plan_id
    -- VD-30: la última visita y la frecuencia, socio por socio por el índice de ingresos (gimnasio, socio, momento).
    -- Antes eran dos CTE que se recorrían enteros por cada socio (8 millones de comparaciones con 3.000 socios).
    left join lateral (
      select max(i.momento) as ultimo from public.ingresos i
       where i.gimnasio_id = p_gimnasio_id and i.socio_id = so.id and i.anulado_en is null
         and i.resultado <> 'rechazado' and i.momento <= p_momento
    ) v on true
    left join lateral (
      -- días distintos con ingreso en las 8 semanas anteriores a su última visita (el día local escrito acá:
      -- privado.dia_local no se puede expandir y era la quinta parte del tiempo)
      select case when count(*) = 0 then null
                  else count(distinct (i.momento at time zone (select g2.zona from g g2))::date)::numeric / 8 end as por_semana
        from public.ingresos i
       where v.ultimo is not null and i.gimnasio_id = p_gimnasio_id and i.socio_id = so.id and i.anulado_en is null
         and i.resultado <> 'rechazado' and i.momento > v.ultimo - interval '56 days' and i.momento <= v.ultimo
    ) f on true
   where so.gimnasio_id = p_gimnasio_id
     and (p_listas is null or p_listas && array['vencido', 'se_fue'] or so.cubierto_hasta > p_momento)
),
clasificado as (
  select b.*, hoy.d as hoy_d,
    -- desde cuándo no está cubierto: el fin de lo último que pagó, o su alta si nunca pagó
    coalesce(b.ultimo_fin, b.primer_inicio) as sin_cubrir_desde,
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
    from base b, g, hoy
),
-- materialized: sin esto Postgres copia via_membresia en cada (vm).campo y
-- la llama varias veces por socio (1,3 s → 0,5 s con 3.000 socios).
con_texto as materialized (
  select c.*,
    -- Vencidos: el texto y la deuda salen de la misma función que usa la puerta.
    case when c.lista = 'vencido' and not p_liviano then privado.via_membresia(c.socio_id, p_momento, null, g.zona, (select cfg.c from cfg)) end as vm,
    case c.lista
      when 'se_fue' then coalesce(c.dado_de_baja_en, c.baja_en, c.ultimo_fin, c.primer_inicio)
      when 'vencido' then c.ultimo_fin
      else c.fin_actual end as vence,
    case
      when c.lista in ('no_viene', 'nuevo') then c.hoy_d - ((coalesce(c.ultimo_ingreso, c.primer_inicio)) at time zone g.zona)::date
      when c.lista in ('vencido', 'se_fue') then c.hoy_d - ((coalesce(c.dado_de_baja_en, c.baja_en, c.sin_cubrir_desde)) at time zone g.zona)::date
      when c.lista = 'por_vencer' then ((c.fin_actual - interval '1 microsecond') at time zone g.zona)::date - c.hoy_d
    end as dias
    from clasificado c, g
   where c.lista is not null and (p_listas is null or c.lista = any (p_listas)) and not (c.vinculado and c.lista in ('vencido', 'por_vencer'))
     -- VD-46N: el que pidió que no le escriban no entra en las listas de re-enganche; sí sigue en vencidos y por vencer (se le cobra)
     and not (c.no_escribir and c.lista in ('nuevo', 'no_viene', 'se_fue'))
),
final as materialized (
  select t.*,
    case when t.lista = 'vencido' and not p_liviano then
      coalesce((t.vm).para_regularizar,
               (select pr.precio from precios pr where pr.plan_id = t.plan_id) * privado.cuotas_para_cubrir(t.suscripcion_id, p_momento))
    end as debe
    from con_texto t
)
select t.socio_id, t.nombre, t.telefono, t.lista,
  (case t.lista
    when 'no_viene' then case when t.ultimo_ingreso is null then 'No vino nunca · se anotó hace ' || t.dias || ' días'
                              else 'No viene hace ' || t.dias || ' días' end
                         || case when t.por_semana >= 0.5 then ' · venía ' || round(t.por_semana) || ' veces por semana' else '' end
    when 'nuevo' then 'Se anotó el ' || to_char((t.primer_inicio) at time zone g.zona, 'DD/MM') || ' · '
                      || case when t.ultimo_ingreso is null then 'todavía no vino' else 'no viene hace ' || t.dias || ' días' end
    when 'por_vencer' then case t.dias when 0 then 'Vence hoy' when 1 then 'Vence mañana'
                                       else 'Vence el ' || privado.ultimo_dia(t.fin_actual, g.zona) end
    when 'vencido' then case when (t.vm).motivo in ('vencida', 'sin_pago') then (t.vm).texto
                             else 'Venció el ' || privado.ultimo_dia(t.ultimo_fin, g.zona)
                                  || coalesce(' · debe ' || privado.formato_pesos(t.debe), '') end
    when 'se_fue' then case when t.dado_de_baja_en is not null
                            then 'Se dio de baja el ' || to_char((t.dado_de_baja_en) at time zone g.zona, 'DD/MM') || coalesce(' · ' || replace(t.motivo_baja, '_', ' '), '')
                            when t.ultimo_fin is null then 'Nunca pagó · se anotó el ' || to_char((t.primer_inicio) at time zone g.zona, 'DD/MM')
                            else 'Dejó de pagar el ' || privado.ultimo_dia(t.ultimo_fin, g.zona) end
  end)
  || case when t.vinculados > 0 and t.lista in ('vencido', 'por_vencer')
          then ' · paga por ' || t.vinculados || case t.vinculados when 1 then ' vinculado' else ' vinculados' end else '' end,
  t.dias, t.vence, t.monto_mensual, t.debe, t.ultimo_ingreso, round(t.por_semana, 1),
  uc.creado_en, uc.quien, uc.resultado,
  privado.armar_mensaje(coalesce(p_plantillas ->> t.lista, pm.texto), jsonb_build_object(
    'nombre', t.nombre_pila, 'gimnasio', g.nombre,
    'plan', (select pl2.nombre from public.planes pl2 where pl2.id = t.plan_id),
    'vence', coalesce(case when t.lista in ('vencido', 'por_vencer') and t.vence is not null then privado.ultimo_dia(t.vence, g.zona) end, 'hace poco'),
    'dias', coalesce(t.dias::text, ''),
    'monto', coalesce(privado.formato_pesos(coalesce(t.debe, t.monto_mensual)), 'la cuota'),
    'debe', coalesce(privado.formato_pesos(coalesce(t.debe, t.monto_mensual)), 'la cuota')))
from final t
cross join g
left join public.plantillas_mensaje pm on pm.gimnasio_id = g.id and pm.clave = t.lista
left join lateral (
  select cr.creado_en, e.nombre as quien, cr.resultado from public.contactos_retencion cr
    join public.equipo e on e.id = cr.creado_por
   where cr.socio_id = t.socio_id order by cr.creado_en desc limit 1
) uc on true
order by array_position(array['vencido', 'por_vencer', 'nuevo', 'no_viene', 'se_fue'], t.lista),
         case when t.lista = 'por_vencer' then t.dias else -t.dias end, t.nombre
$$;
revoke all on function privado.retencion_nucleo(uuid, timestamptz, jsonb, boolean, text[]) from public, anon, authenticated;

create or replace function privado.retencion_con(p_gimnasio_id uuid, p_momento timestamptz, p_plantillas jsonb, p_liviano boolean default false)
returns table (
  socio_id uuid, nombre text, telefono text, lista text, texto text, dias int,
  vence_en timestamptz, monto_mensual numeric, debe numeric, ultimo_ingreso timestamptz,
  visitas_por_semana numeric, ultimo_contacto_en timestamptz, ultimo_contacto_por text,
  ultimo_contacto_resultado text, mensaje text
)
language sql stable set search_path = '' as $$
  select * from privado.retencion_nucleo(p_gimnasio_id, p_momento, p_plantillas, p_liviano, null)
$$;
revoke all on function privado.retencion_con(uuid, timestamptz, jsonb, boolean) from public, anon, authenticated;

create or replace function privado.retencion_listas(p_gimnasio_id uuid, p_momento timestamptz, p_listas text[], p_liviano boolean default false)
returns table (
  socio_id uuid, nombre text, telefono text, lista text, texto text, dias int,
  vence_en timestamptz, monto_mensual numeric, debe numeric, ultimo_ingreso timestamptz,
  visitas_por_semana numeric, ultimo_contacto_en timestamptz, ultimo_contacto_por text,
  ultimo_contacto_resultado text, mensaje text
)
language sql stable set search_path = '' as $$
  select * from privado.retencion_nucleo(p_gimnasio_id, p_momento, null, p_liviano, p_listas)
$$;
revoke all on function privado.retencion_listas(uuid, timestamptz, text[], boolean) from public, anon, authenticated;

do $v$
declare f text;
begin
  foreach f in array array['privado.retencion_nucleo(uuid, timestamptz, jsonb, boolean, text[])', 'privado.retencion_con(uuid, timestamptz, jsonb, boolean)', 'privado.retencion_listas(uuid, timestamptz, text[], boolean)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then raise exception 'Verificación: % ejecutable desde el navegador', f; end if;
  end loop;
end $v$;
