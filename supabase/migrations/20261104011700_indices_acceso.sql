-- 0117 · El estado de muchos socios juntos, más rápido (SEG-8).
-- El filtro "al día" de Socios llama privado.calcular_acceso por cada socio, y
-- la retención (Inicio, Avisos, Vencen hoy) la membresía de cada vencido.
-- Medido con 3.000 socios: la mitad
-- del tiempo era buscar la suscripción vigente (el índice de 0114 es parcial,
-- "baja_en is null", y la búsqueda pide también las bajas futuras: no lo usa)
-- y el precio del plan (el índice único empieza por gimnasio_id).
-- Además: la retención calcula la frecuencia sin una llamada por ingreso, y
-- Socios con filtro de estado deja de calcular apenas tiene los que muestra.
-- Ningún resultado cambia (las pruebas de acceso, retención y filtros lo
-- comprueban), y el cálculo de acceso sigue siendo uno solo.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.calcular_acceso(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta privado.calcular_acceso'; end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'suscripciones_por_socio') then
    raise exception 'Guarda: falta la migración 0114';
  end if;
end $$;

create index if not exists suscripciones_socio_inicio on public.suscripciones (socio_id, inicio desc);
create index if not exists precios_por_plan on public.precios_plan (plan_id, vigente_desde);

-- ── Retención (Inicio, Avisos, Vencen hoy): la frecuencia sin llamar una función por ingreso ──
create or replace function privado.retencion_con(p_gimnasio_id uuid, p_momento timestamptz, p_plantillas jsonb)
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
hoy as (select privado.dia_local(p_momento, g.zona) as d from g),
-- La membresía que importa de cada socio: la activa, o la última si se cerró hace poco.
sus as (
  select distinct on (s.socio_id) s.*
    from public.suscripciones s, g
   where s.gimnasio_id = g.id and s.inicio <= p_momento
     and (s.baja_en is null or s.baja_en > p_momento - make_interval(days => g.retencion_dias_se_fue))
   order by s.socio_id, (s.baja_en is null) desc, s.inicio desc
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
   where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null and c.socio_id in (select s.socio_id from sus s)
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
    from sus s left join islas i on i.socio_id = s.socio_id
   group by s.socio_id
),
precios as (
  select p.id as plan_id, privado.precio_base(p.id, p_momento) as precio
    from public.planes p where p.gimnasio_id = p_gimnasio_id and p.tipo = 'membresia'
),
visitas as (
  select i.socio_id, max(i.momento) as ultimo
    from public.ingresos i
   where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado' and i.momento <= p_momento
   group by i.socio_id
),
frecuencia as (
  -- días distintos con ingreso en las 8 semanas anteriores a su última visita
  select i.socio_id, -- el día local escrito acá y no con privado.dia_local: con 80 mil ingresos
  -- la llamada a la función (no se puede expandir) era la quinta parte del tiempo.
  count(distinct (i.momento at time zone g.zona)::date)::numeric / 8 as por_semana
    from public.ingresos i join visitas v on v.socio_id = i.socio_id, g
   where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado'
     and i.momento > v.ultimo - interval '56 days' and i.momento <= v.ultimo
   group by i.socio_id
),
base as (
  select so.id as socio_id, trim(so.nombre || ' ' || so.apellido) as nombre, so.nombre as nombre_pila,
         -- Un menor (D10): se le escribe al responsable.
         privado.celular_aviso(so.telefono, so.responsable_telefono, so.fecha_nacimiento, privado.dia_local(p_momento, (select zona from g))) as telefono,
         so.dado_de_baja_en, so.motivo_baja, su.id as suscripcion_id, su.baja_en, su.plan_id,
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
    left join precios pr on pr.plan_id = su.plan_id
    left join visitas v on v.socio_id = so.id
    left join frecuencia f on f.socio_id = so.id
   where so.gimnasio_id = p_gimnasio_id
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
           and hoy.d - privado.dia_local(coalesce(b.ultimo_fin, b.primer_inicio), g.zona) > g.retencion_dias_vencido then 'se_fue'
      when b.fin_actual is null and not b.tiene_futuro then 'vencido'
      when b.fin_actual is not null
           and privado.dia_local(b.fin_actual - interval '1 microsecond', g.zona) - hoy.d <= g.dias_aviso then 'por_vencer'
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
    case when c.lista = 'vencido' then privado.via_membresia(c.socio_id, p_momento, null, g.zona, (select cfg.c from cfg)) end as vm,
    case c.lista
      when 'se_fue' then coalesce(c.dado_de_baja_en, c.baja_en, c.ultimo_fin, c.primer_inicio)
      when 'vencido' then c.ultimo_fin
      else c.fin_actual end as vence,
    case
      when c.lista in ('no_viene', 'nuevo') then c.hoy_d - privado.dia_local(coalesce(c.ultimo_ingreso, c.primer_inicio), g.zona)
      when c.lista in ('vencido', 'se_fue') then c.hoy_d - privado.dia_local(coalesce(c.dado_de_baja_en, c.baja_en, c.sin_cubrir_desde), g.zona)
      when c.lista = 'por_vencer' then privado.dia_local(c.fin_actual - interval '1 microsecond', g.zona) - c.hoy_d
    end as dias
    from clasificado c, g
   where c.lista is not null
),
final as (
  select t.*,
    case when t.lista = 'vencido' then
      coalesce((t.vm).para_regularizar,
               (select pr.precio from precios pr where pr.plan_id = t.plan_id) * privado.cuotas_para_cubrir(t.suscripcion_id, p_momento))
    end as debe
    from con_texto t
)
select t.socio_id, t.nombre, t.telefono, t.lista,
  case t.lista
    when 'no_viene' then case when t.ultimo_ingreso is null then 'No vino nunca · se anotó hace ' || t.dias || ' días'
                              else 'No viene hace ' || t.dias || ' días' end
                         || case when t.por_semana >= 0.5 then ' · venía ' || round(t.por_semana) || ' veces por semana' else '' end
    when 'nuevo' then 'Se anotó el ' || privado.fecha_corta(t.primer_inicio, g.zona) || ' · '
                      || case when t.ultimo_ingreso is null then 'todavía no vino' else 'no viene hace ' || t.dias || ' días' end
    when 'por_vencer' then case t.dias when 0 then 'Vence hoy' when 1 then 'Vence mañana'
                                       else 'Vence el ' || privado.ultimo_dia(t.fin_actual, g.zona) end
    when 'vencido' then case when (t.vm).motivo in ('vencida', 'sin_pago') then (t.vm).texto
                             else 'Venció el ' || privado.ultimo_dia(t.ultimo_fin, g.zona)
                                  || coalesce(' · debe ' || privado.formato_pesos(t.debe), '') end
    when 'se_fue' then case when t.dado_de_baja_en is not null
                            then 'Se dio de baja el ' || privado.fecha_corta(t.dado_de_baja_en, g.zona) || coalesce(' · ' || replace(t.motivo_baja, '_', ' '), '')
                            when t.ultimo_fin is null then 'Nunca pagó · se anotó el ' || privado.fecha_corta(t.primer_inicio, g.zona)
                            else 'Dejó de pagar el ' || privado.ultimo_dia(t.ultimo_fin, g.zona) end
  end,
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
revoke all on function privado.retencion_con(uuid, timestamptz, jsonb) from public, anon, authenticated;

-- ── Socios por estado: deja de calcular cuando tiene los que muestra ──
create or replace function public.buscar_socios(p_gimnasio_id uuid, p_texto text, p_limite int default 30, p_etiqueta uuid default null,
                                                p_estado text default null, p_plan uuid default null)
returns table (socio_id uuid, numero int, nombre text, telefono text, dni text, plan text,
               color text, texto text, puede boolean, dado_de_baja boolean)
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; t text := privado.sin_acentos(lower(trim(coalesce(p_texto, '')))); digitos text;
        por_estado boolean := coalesce(p_estado in ('al_dia', 'por_vencer', 'vencidos', 'en_pausa', 'sin_plan'), false);
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if p_limite is null or p_limite < 1 or p_limite > 100 then raise exception 'El límite va de 1 a 100'; end if;
  if p_estado is not null and not por_estado and p_estado not in ('nuevos', 'bajas') then raise exception 'Filtro desconocido: %', p_estado; end if;
  digitos := regexp_replace(t, '\D', '', 'g');
  return query
  with candidatos as (
    select s.*, (s.dado_de_baja_en is not null) as baja from public.socios s
     where s.gimnasio_id = p_gimnasio_id
       and (p_etiqueta is null or exists (select 1 from public.socio_etiquetas se where se.gimnasio_id = p_gimnasio_id
                                            and se.socio_id = s.id and se.etiqueta_id = p_etiqueta))
       and (p_plan is null or exists (select 1 from public.suscripciones su where su.socio_id = s.id and su.baja_en is null and su.plan_id = p_plan))
       and (p_estado is null or (p_estado = 'bajas') = (s.dado_de_baja_en is not null))
       and (p_estado is distinct from 'nuevos' or s.creado_en > now() - interval '30 days')
       and (t = ''
         or privado.sin_acentos(lower(s.nombre || ' ' || s.apellido)) like '%' || t || '%'
         or privado.sin_acentos(lower(s.apellido || ' ' || s.nombre)) like '%' || t || '%'
         or (length(digitos) >= 3 and (s.dni like digitos || '%' or regexp_replace(coalesce(s.telefono, ''), '\D', '', 'g') like '%' || digitos || '%'))
         or (digitos <> '' and s.numero::text = digitos))
     order by (s.dado_de_baja_en is not null), s.nombre, s.apellido
     -- Por estado hay que mirar a todos (el estado no está guardado); si no, alcanza con los primeros.
     limit case when por_estado then null else p_limite end
  )
  select s.id, s.numero, trim(s.nombre || ' ' || s.apellido), s.telefono, s.dni,
         (select pl.nombre from public.suscripciones su join public.planes pl on pl.id = su.plan_id
           where su.socio_id = s.id and su.baja_en is null order by su.inicio desc limit 1),
         v.color, v.texto, v.puede, s.baja
    -- SEG-8: los candidatos llegan ya ordenados y el orden de afuera usa las
    -- mismas columnas: Postgres no reordena y deja de calcular el acceso
    -- apenas junta p_limite socios del estado pedido (antes, a todos).
    from (select c.* from candidatos c order by c.baja, c.nombre, c.apellido) s
    cross join lateral privado.calcular_acceso(s.id, now(), e.sede_id) v
   where not por_estado or privado.grupo_estado(v.color, v.motivo) = p_estado
   order by s.baja, s.nombre, s.apellido
   limit p_limite;
end $$;
revoke all on function public.buscar_socios(uuid, text, integer, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.buscar_socios(uuid, text, integer, uuid, text, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if (select count(*) from pg_indexes where schemaname = 'public'
       and indexname in ('suscripciones_socio_inicio', 'precios_por_plan')) <> 2 then
    raise exception 'Verificación: faltan índices';
  end if;
  if has_function_privilege('anon', 'public.buscar_socios(uuid, text, integer, uuid, text, uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.buscar_socios(uuid, text, integer, uuid, text, uuid)', 'execute') then
    raise exception 'Verificación: permisos de buscar_socios';
  end if;
end $$;
