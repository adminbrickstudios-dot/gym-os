-- F0.3 · filtros_socios en lote: la cuenta de las píldoras de Socios con 5.000 socios pasa de ~4 s a decenas de ms.
-- Antes: privado.calcular_acceso por cada socio activo (0,4 a 0,6 ms c/u). Ahora: los socios SIN casos especiales se clasifican por conjuntos
-- con los mismos hechos que mira la puerta; el resto (y todo lo dudoso) sigue pasando por privado.calcular_acceso, que sigue siendo la fuente
-- de verdad. El camino rápido da EXACTAMENTE el mismo grupo (lo prueba filtros-en-lote.test.mjs: grupo por socio y JSON completo,
-- contra una copia de la función de antes y contra calcular_acceso, con momentos fijos).
--
-- Un socio activo va por el camino rápido solo si NO tiene:
--   · suspensión vigente, pack, prueba gratis, pase vigente, ni rastro de deuda a cuenta (ventas con pago a cuenta corriente o ítem 'deuda');
--   · plan familiar activo con grupo (la puerta puede darle la cobertura del titular);
--   · modo aviso vigente en el gimnasio (la puerta deja pasar a todos);
--   · congelamiento vigente de su membresía, ni cobertura que empiece después del momento;
--   · un plan con restricciones (otra sede, franja horaria, tope semanal): ahí el veredicto depende de la sede y de sus ingresos.
-- Con eso, el veredicto de la puerta es el de via_membresia sola: sin membresía → sin_plan; fin de cadena = última cobertura (todas
-- empiezan antes del momento, así la cadena llega hasta la de hasta más lejano) → por_vencer o al_día según dias_aviso; vencida dentro de
-- la tolerancia → por_vencer (naranja); si no → vencidos. (socios.cubierto_hasta no alcanza solo: es del socio, y la membresía
-- mira las coberturas de UNA suscripción; se lee la cobertura de esa suscripción con el índice coberturas_vigentes.)
-- (F0.3 en lote: la marca de abajo la busca la verificación.)

do $g$ begin
  if to_regprocedure('public.filtros_socios(uuid)') is null then raise exception 'Guarda: falta public.filtros_socios'; end if;
  if to_regprocedure('privado.calcular_acceso(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta calcular_acceso'; end if;
  if to_regprocedure('privado.grupo_estado(text, text)') is null then raise exception 'Guarda: falta grupo_estado'; end if;
  if to_regclass('public.pruebas_gratis') is null then raise exception 'Guarda: falta pruebas_gratis (la puerta la mira)'; end if;
  if pg_get_functiondef('privado.calcular_acceso(uuid, timestamptz, uuid)'::regprocedure) not like '%via_prueba%' then
    raise exception 'Guarda: calcular_acceso vigente sin la prueba gratis; el camino rápido está escrito para esa versión';
  end if;
end $g$;

-- Para encontrar rápido a quien tiene rastro de deuda a cuenta (lo que mira privado.deuda_socio).
create index if not exists pagos_cuenta_corriente_por_venta on public.pagos (gimnasio_id, venta_id) where medio = 'cuenta_corriente';
create index if not exists venta_items_deuda_por_venta on public.venta_items (gimnasio_id, venta_id) where tipo = 'deuda';

-- El grupo de cada socio activo en un momento dado (el mismo que privado.grupo_estado del veredicto de la puerta).
create or replace function privado.filtros_socios_grupos(p_gimnasio_id uuid, p_momento timestamptz, p_sede_id uuid)
returns table (socio_id uuid, creado_en timestamptz, grupo text, por_puerta boolean)
language sql stable set search_path = '' as $$
with
g as materialized (
  select gi.zona_horaria as zona, c.dias_aviso, c.tolerancia_dias as tol_cfg,
         (coalesce(c.plan_familiar_activo, false)) as familiar,
         (c.avisar_sin_bloquear_hasta is not null and c.avisar_sin_bloquear_hasta > p_momento) as modo_aviso
    from public.gimnasios gi join public.configuracion_gimnasio c on c.gimnasio_id = gi.id
   where gi.id = p_gimnasio_id
),
hoy as materialized (select privado.dia_local(p_momento, g.zona) as d from g),
-- Quién no puede ir por el camino rápido (por los hechos de la puerta que no mira el camino rápido).
especiales as materialized (
  select x.socio_id from public.suspensiones x
   where x.gimnasio_id = p_gimnasio_id and x.desde <= p_momento
     and (x.hasta is null or x.hasta > p_momento) and (x.levantada_en is null or x.levantada_en > p_momento)
  union
  select k.socio_id from public.packs k where k.gimnasio_id = p_gimnasio_id and k.anulado_en is null
  union
  select r.socio_id from public.pruebas_gratis r where r.gimnasio_id = p_gimnasio_id and r.anulada_en is null and r.socio_id is not null
  union
  select pa.socio_id from public.pases_diarios pa
   where pa.gimnasio_id = p_gimnasio_id and pa.anulado_en is null and pa.desde <= p_momento and pa.hasta > p_momento
  union
  select v.socio_id from public.ventas v
   where v.gimnasio_id = p_gimnasio_id and v.socio_id is not null
     and (v.id in (select p.venta_id from public.pagos p where p.gimnasio_id = p_gimnasio_id and p.medio = 'cuenta_corriente')
          or v.id in (select vi.venta_id from public.venta_items vi where vi.gimnasio_id = p_gimnasio_id and vi.tipo = 'deuda'))
),
congeladas as materialized (
  select z.suscripcion_id from public.congelamientos z
   where z.gimnasio_id = p_gimnasio_id and z.anulado_en is null
     and z.desde <= p_momento and coalesce(z.hasta_real, z.hasta_prevista) > p_momento
),
con_futuro as materialized (
  select distinct c.suscripcion_id from public.coberturas c
   where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null and c.desde > p_momento
),
base as (
  select so.id, so.creado_en, s.id as suscripcion_id, s.restringe, s.tol,
         (g.modo_aviso or (g.familiar and so.grupo_familiar_id is not null)
          or so.id in (select e.socio_id from especiales e)) as especial
    from public.socios so
    cross join g
    left join lateral (
      select su.id,
             (pl.todas_las_sedes is not true or pl.hora_desde is not null or pl.max_ingresos_semana is not null) as restringe,
             coalesce(pl.tolerancia_dias, g.tol_cfg) as tol
        from public.suscripciones su join public.planes pl on pl.id = su.plan_id
       where su.socio_id = so.id and su.inicio <= p_momento and (su.baja_en is null or su.baja_en > p_momento)
       order by su.inicio desc limit 1
    ) s on true
   where so.gimnasio_id = p_gimnasio_id and so.dado_de_baja_en is null
),
rapido as (
  select b.id, b.creado_en,
         case
           when b.especial then null
           when b.suscripcion_id is null then 'sin_plan'
           when b.suscripcion_id in (select c.suscripcion_id from congeladas c)
             or b.suscripcion_id in (select f.suscripcion_id from con_futuro f)
             or b.restringe then null
           when h.hasta is not null and h.hasta > p_momento then
             case when privado.dia_local(h.hasta - interval '1 microsecond', g.zona) - hoy.d <= g.dias_aviso then 'por_vencer' else 'al_dia' end
           when h.hasta is not null and hoy.d - privado.dia_local(h.hasta, g.zona) + 1 <= b.tol then 'por_vencer'
           else 'vencidos'
         end as grupo
    from base b cross join g cross join hoy
    left join lateral (
      select max(c.hasta) as hasta from public.coberturas c
       where c.suscripcion_id = b.suscripcion_id and c.anulada_en is null and not b.especial
    ) h on true
)
select r.id, r.creado_en,
       coalesce(r.grupo, privado.grupo_estado(v.color, v.motivo)),
       r.grupo is null
  from rapido r
  left join lateral (select x.color, x.motivo from privado.calcular_acceso(r.id, p_momento, p_sede_id) x where r.grupo is null) v on true
$$;
revoke all on function privado.filtros_socios_grupos(uuid, timestamptz, uuid) from public, anon, authenticated;

-- La cuenta de cada píldora en un momento dado, con la sede dada.
create or replace function privado.filtros_socios_calc(p_gimnasio_id uuid, p_momento timestamptz, p_sede_id uuid)
returns jsonb
language plpgsql stable set search_path = '' as $$
declare r jsonb;
begin
  with activos as (select a.socio_id as id, a.creado_en, a.grupo from privado.filtros_socios_grupos(p_gimnasio_id, p_momento, p_sede_id) a)
  select jsonb_build_object(
    'todos', (select count(*) from activos),
    'al_dia', count(*) filter (where grupo = 'al_dia'), 'por_vencer', count(*) filter (where grupo = 'por_vencer'),
    'vencidos', count(*) filter (where grupo = 'vencidos'), 'en_pausa', count(*) filter (where grupo = 'en_pausa'),
    'sin_plan', count(*) filter (where grupo = 'sin_plan'), 'nuevos', count(*) filter (where creado_en > p_momento - interval '30 days'),
    'bajas', (select count(*) from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is not null),
    'planes', coalesce((select jsonb_agg(jsonb_build_object('plan_id', pl.id, 'nombre', pl.nombre, 'socios', x.n) order by x.n desc, pl.nombre)
                         from (select su.plan_id, count(distinct su.socio_id) n from public.suscripciones su
                                join public.socios s on s.id = su.socio_id and s.dado_de_baja_en is null
                               where su.gimnasio_id = p_gimnasio_id and su.baja_en is null group by su.plan_id) x
                         join public.planes pl on pl.id = x.plan_id), '[]'))
    into r from activos;
  return r;
end $$;
revoke all on function privado.filtros_socios_calc(uuid, timestamptz, uuid) from public, anon, authenticated;

-- La pública: misma firma y mismos permisos de antes; ahora llama a la de arriba con el momento y la sede de quien pregunta.
create or replace function public.filtros_socios(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return privado.filtros_socios_calc(p_gimnasio_id, now(), e.sede_id);
end $$;
revoke all on function public.filtros_socios(uuid) from public, anon, authenticated;
grant execute on function public.filtros_socios(uuid) to authenticated, service_role;

do $v$
declare r record;
begin
  for r in select p.oid, p.proname, p.proconfig, p.pronamespace::regnamespace::text as esquema from pg_proc p
            where (p.pronamespace = 'privado'::regnamespace and p.proname in ('filtros_socios_grupos', 'filtros_socios_calc'))
               or (p.pronamespace = 'public'::regnamespace and p.proname = 'filtros_socios') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
    if r.esquema = 'privado' and has_function_privilege('authenticated', r.oid, 'execute') then raise exception 'Verificación: authenticated puede ejecutar %', r.proname; end if;
  end loop;
  if (select count(*) from pg_proc where proname = 'filtros_socios' and pronamespace = 'public'::regnamespace) <> 1 then
    raise exception 'Verificación: quedó más de una filtros_socios';
  end if;
  if pg_get_functiondef('privado.filtros_socios_grupos(uuid, timestamptz, uuid)'::regprocedure) not like '%calcular_acceso%' then
    raise exception 'Verificación: el camino lento ya no pasa por calcular_acceso';
  end if;
  if pg_get_functiondef('public.filtros_socios(uuid)'::regprocedure) not like '%filtros_socios_calc%' then
    raise exception 'Verificación: filtros_socios no usa el cálculo en lote';
  end if;
end $v$;
