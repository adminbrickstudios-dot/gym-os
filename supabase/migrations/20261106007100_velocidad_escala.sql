-- VD-30 · Velocidad medida y escala (docs/v2/07, 13 §5, 16 §2.7-2.8).
-- Medido con 3.000 socios y 200 gimnasios (workflow "Medir escala", tabla en docs/LOG.md). Solo índices y
-- reescrituras que NO cambian el resultado de ninguna función (las pruebas de la base, sin tocar, lo comprueban).
--
-- 1) para_hacer_hoy: la tarea "clases con lista de espera" nunca andaba, porque la variable `fin` chocaba con la
--    columna public.clases.fin ("column reference fin is ambiguous"). Se renombra la variable. Salió midiendo:
--    pendientes_panel, que la llama, fallaba entero en un gimnasio con clases.
-- 2) privado.retencion_con (Retención, Vencen hoy, Inicio, Para hacer hoy, Pendientes: casi todo el panel): la última visita
--    y la frecuencia de cada socio se buscan por el índice de ingresos, en vez de recorrer una CTE entera por cada socio.
-- 3) pendientes_panel (corre en cada pantalla) calcula la retención UNA vez (antes, dos) y se la pasa a Para hacer hoy
--    (privado.para_hacer_hoy_con). public.para_hacer_hoy sigue igual para quien la llame.
-- 4) resultado_mes: el precio "de hoy" se calcula una vez por plan y no una vez por socio.

-- ── Guarda de entrada ──────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.para_hacer_hoy(uuid)') is null then raise exception 'Guarda: falta public.para_hacer_hoy'; end if;
  if to_regprocedure('public.pendientes_panel(uuid)') is null then raise exception 'Guarda: falta public.pendientes_panel'; end if;
  if to_regprocedure('privado.retencion_con(uuid, timestamptz, jsonb)') is null then raise exception 'Guarda: falta privado.retencion_con'; end if;
  if to_regprocedure('public.resultado_mes(uuid, date)') is null then raise exception 'Guarda: falta public.resultado_mes'; end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'ingresos_socio') then raise exception 'Guarda: falta el índice ingresos_socio'; end if;
end $$;

-- ── 2) Retención ──
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

-- ── 3) Para hacer hoy / Pendientes ──
create or replace function privado.para_hacer_hoy_con(p_gimnasio_id uuid, p_ret jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; c public.configuracion_gimnasio; cfg public.tareas_auto; k jsonb; v_clave text; roles jsonb; visible boolean; gestion boolean;
  salida jsonb := '[]'::jsonb; ret jsonb := p_ret; cant int; socios jsonb; texto text; dias int; sede uuid; ve_clases boolean; zona text; hoy date; fin_dia timestamptz;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  sede := e.sede_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  fin_dia := privado.medianoche(hoy + 1, zona);
  ve_clases := c.modo_clases <> 'ninguno' and not ('clases' = any (c.secciones_apagadas));

  for k in select x from jsonb_array_elements(privado.catalogo_tareas_auto()) x loop
    v_clave := k ->> 'clave';
    gestion := (k ->> 'gestion')::boolean;
    cfg := null;
    select * into cfg from public.tareas_auto t where t.gimnasio_id = p_gimnasio_id and t.clave = v_clave;
    if found and not cfg.activa then continue; end if;
    -- Para quién es: una persona, un rol, o lo de siempre. El dueño ve todo; el encargado ve también lo de la recepción.
    if cfg.para_equipo is not null then
      visible := cfg.para_equipo = e.id or e.rol = 'dueno';
    else
      roles := case when cfg.para_rol is not null then jsonb_build_array(cfg.para_rol) else k -> 'roles' end;
      visible := e.rol = 'dueno' or roles ? e.rol::text or (e.rol = 'encargado' and roles ? 'recepcion');
    end if;
    if gestion and e.rol = 'recepcion' then visible := false; end if;
    if not visible then continue; end if;
    dias := coalesce(cfg.dias, nullif(k ->> 'dias', '')::int);
    cant := 0; socios := null; texto := null;

    if v_clave in ('vencen_hoy', 'vencen_pronto', 'no_vienen', 'nuevos_sin_venir') and ret is null then
      select coalesce(jsonb_agg(jsonb_build_object('socio_id', r.socio_id, 'nombre', r.nombre, 'lista', r.lista, 'dias', r.dias)), '[]'::jsonb)
        into ret from privado.retencion(p_gimnasio_id, now()) r where r.lista in ('por_vencer', 'no_viene', 'nuevo');
    end if;

    if v_clave = 'vencen_hoy' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'nombre')) into cant, socios
        from jsonb_array_elements(ret) x where x ->> 'lista' = 'por_vencer' and (x ->> 'dias')::int = 0;
      texto := 'Cobrarle a ' || cant || case when cant = 1 then ' que vence hoy' else ' que vencen hoy' end;
    elsif v_clave = 'vencen_pronto' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'nombre')) into cant, socios
        from jsonb_array_elements(ret) x where x ->> 'lista' = 'por_vencer' and (x ->> 'dias')::int between 1 and coalesce(dias, 3);
      texto := 'Avisar a ' || cant || case when cant = 1 then ' que vence' else ' que vencen' end || ' en ' || coalesce(dias, 3) || ' días o menos';
    elsif v_clave = 'no_vienen' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'nombre')) into cant, socios
        from jsonb_array_elements(ret) x where x ->> 'lista' = 'no_viene';
      texto := cant || case when cant = 1 then ' no viene' else ' no vienen' end || ' hace ' || c.retencion_dias_ausencia || ' días o más';
    elsif v_clave = 'nuevos_sin_venir' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'nombre')) into cant, socios
        from jsonb_array_elements(ret) x where x ->> 'lista' = 'nuevo';
      texto := cant || case when cant = 1 then ' nuevo todavía no vino' else ' nuevos todavía no vinieron' end;
    elsif v_clave = 'prometieron' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'socio')) into cant, socios
        from jsonb_array_elements(public.prometieron_pagar(p_gimnasio_id)) x;
      texto := cant || case when cant = 1 then ' prometió pagar' else ' prometieron pagar' end;
    elsif v_clave = 'transferencias' then
      select count(*) into cant from public.pagos p join public.ventas v on v.id = p.venta_id
       where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.medio = 'transferencia'
         and p.comprobante_path is not null and (sede is null or v.sede_id = sede);
      texto := 'Aprobar ' || cant || case when cant = 1 then ' transferencia' else ' transferencias' end;
    elsif v_clave = 'caja_abierta' then
      if 'caja' = any (c.secciones_apagadas) then continue; end if;
      cant := jsonb_array_length(public.cajas_olvidadas(p_gimnasio_id));
      texto := case when cant = 1 then 'Cerrar la caja que quedó abierta' else 'Cerrar las ' || cant || ' cajas que quedaron abiertas' end;
    elsif v_clave = 'caja_sin_contar' then
      if 'caja' = any (c.secciones_apagadas) then continue; end if;
      cant := jsonb_array_length(public.cajas_para_revisar(p_gimnasio_id));
      texto := 'Contar ' || cant || case when cant = 1 then ' caja que quedó sin contar' else ' cajas que quedaron sin contar' end;
    elsif v_clave = 'cumpleanos' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'nombre')) into cant, socios
        from jsonb_array_elements(public.cumplen_hoy(p_gimnasio_id)) x;
      texto := cant || case when cant = 1 then ' cumple años hoy' else ' cumplen años hoy' end;
    elsif v_clave = 'stock_bajo' then
      select count(*) into cant from public.productos pr
       where pr.gimnasio_id = p_gimnasio_id and pr.activo and pr.controla_stock
         and (privado.stock_producto(pr.id) <= 0 or (pr.stock_minimo is not null and privado.stock_producto(pr.id) <= pr.stock_minimo));
      texto := 'Reponer ' || cant || case when cant = 1 then ' producto' else ' productos' end;
    elsif v_clave = 'pedidos_pausa' then
      cant := jsonb_array_length(public.pedidos_pausa_pendientes(p_gimnasio_id));
      texto := cant || case when cant = 1 then ' pausa para aprobar' else ' pausas para aprobar' end;
    elsif v_clave = 'pedidos_baja' then
      cant := jsonb_array_length(public.pedidos_baja_pendientes(p_gimnasio_id));
      texto := cant || case when cant = 1 then ' baja pedida desde la app' else ' bajas pedidas desde la app' end;
    elsif v_clave = 'clases_espera' then
      if not ve_clases then continue; end if;
      select count(*) into cant from public.clases kl
       where kl.gimnasio_id = p_gimnasio_id and kl.inicio >= now() and kl.inicio < fin_dia and kl.cancelada_en is null
         and (sede is null or kl.sede_id = sede)
         and exists (select 1 from public.reservas r where r.clase_id = kl.id and r.estado = 'espera');
      texto := cant || case when cant = 1 then ' clase tiene lista de espera' else ' clases tienen lista de espera' end;
    end if;

    if coalesce(cant, 0) > 0 then
      salida := salida || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'clave', v_clave, 'emoji', k ->> 'emoji', 'titulo', k ->> 'titulo', 'texto', texto, 'cantidad', cant, 'href', k ->> 'href',
        'cobrar', v_clave in ('vencen_hoy', 'prometieron'),
        'socios', case when socios is null then null else (select jsonb_agg(s) from (select s from jsonb_array_elements(socios) s limit 8) z) end)));
    end if;
  end loop;
  return salida;
end $$;
revoke all on function privado.para_hacer_hoy_con(uuid, jsonb) from public, anon, authenticated;

create or replace function public.para_hacer_hoy(p_gimnasio_id uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select privado.para_hacer_hoy_con(p_gimnasio_id, null)
$$;
revoke all on function public.para_hacer_hoy(uuid) from public, anon, authenticated;
grant execute on function public.para_hacer_hoy(uuid) to authenticated, service_role;

create or replace function public.pendientes_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; zona text; hoy date; sede uuid; gestion boolean; mostrador boolean;
  vencen int := 0; transf int := 0; tareas int := 0; prosp int := 0; control int := 0; caja int := 0; socios int := 0; msjs int := 0;
  hacer jsonb; r jsonb := '{}'::jsonb; ret jsonb;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  gestion := e.rol in ('dueno', 'encargado');
  mostrador := e.rol in ('dueno', 'encargado', 'recepcion');
  sede := e.sede_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := (now() at time zone zona)::date;

  -- Lo mío para hacer (todos los roles): tareas sin hacer para hoy o atrasadas.
  select count(*) into tareas from public.tareas t
   where t.gimnasio_id = p_gimnasio_id and t.para = e.id and t.hecha_en is null and t.dia <= hoy;

  if mostrador then
    -- Vencen y cobrar: los que vencen hoy y todavía no pagaron (el mismo cálculo que la pantalla).
    -- VD-30: la retención (lo más caro de la pantalla) se calcula UNA vez y se comparte con "Para hacer hoy".
    select coalesce(jsonb_agg(jsonb_build_object('socio_id', r2.socio_id, 'nombre', r2.nombre, 'lista', r2.lista, 'dias', r2.dias)), '[]'::jsonb)
      into ret from privado.retencion(p_gimnasio_id, now()) r2 where r2.lista in ('por_vencer', 'no_viene', 'nuevo');
    select count(*) into vencen from jsonb_array_elements(ret) x where x ->> 'lista' = 'por_vencer' and (x ->> 'dias')::int = 0;
    -- Transferencias por aprobar (misma cuenta que "Para hacer hoy").
    select count(*) into transf from public.pagos p join public.ventas v on v.id = p.venta_id
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.medio = 'transferencia'
       and p.comprobante_path is not null and (sede is null or v.sede_id = sede);
    -- Interesados nuevos.
    select count(*) into prosp from public.prospectos p where p.gimnasio_id = p_gimnasio_id and p.estado = 'nuevo';
    -- Para hacer hoy: lo que calcula la base para el mostrador, más mis tareas.
    hacer := privado.para_hacer_hoy_con(p_gimnasio_id, ret);
    tareas := tareas + case jsonb_typeof(hacer)
      when 'array' then jsonb_array_length(hacer)
      when 'object' then case when jsonb_typeof(hacer -> 'items') = 'array' then jsonb_array_length(hacer -> 'items') else 0 end
      else 0 end;
    -- Caja: abiertas que quedaron olvidadas (la recepción, las suyas).
    caja := jsonb_array_length(public.cajas_olvidadas(p_gimnasio_id));
    -- VD-38b: mensajes de los socios que esperan respuesta (0 si este usuario no los ve).
    msjs := coalesce(public.mensajes_sin_responder(p_gimnasio_id), 0);
  end if;

  if gestion then
    -- Caja: cerradas sin contar que esperan revisión, y pedidos de anular una venta.
    caja := caja
      + (select count(*) from public.turnos_caja t where t.gimnasio_id = p_gimnasio_id and t.sin_contar and t.monto_contado is null and t.revisado_en is null)
      + (select count(*) from public.pedidos_anulacion pa where pa.gimnasio_id = p_gimnasio_id and pa.estado = 'pendiente');
    -- Socios: pedidos de pausa y de baja que esperan respuesta.
    socios := (select count(*) from public.pedidos_pausa x where x.gimnasio_id = p_gimnasio_id and x.estado = 'pendiente')
            + (select count(*) from public.pedidos_baja x where x.gimnasio_id = p_gimnasio_id and x.estado = 'pendiente');
    -- Control sin ver: los avisos del Control que todavía no abrió (solo quien ve el Control).
    begin
      control := coalesce((public.campana_control(p_gimnasio_id) ->> 'sin_leer')::int, 0);
    exception when insufficient_privilege then
      control := null;
    end;
  end if;

  r := jsonb_build_object('tareas', tareas);
  if mostrador then
    r := r || jsonb_build_object('vencen_hoy', vencen, 'transferencias', transf, 'prospectos', prosp, 'caja', caja,
                                 'mensajes', msjs);
  end if;
  if gestion then
    r := r || jsonb_build_object('socios', socios);
    if control is not null then r := r || jsonb_build_object('control', control); end if;
  end if;
  return r;
end $$;
revoke all on function public.pendientes_panel(uuid) from public, anon, authenticated;
grant execute on function public.pendientes_panel(uuid) to authenticated, service_role;

-- ── 4) Resultado del mes ──
create or replace function public.resultado_mes(p_gimnasio_id uuid, p_mes date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; mes date; fin date; ant date; d0 timestamptz; d1 timestamptz; corte timestamptz; dias int; en_curso boolean;
begin
  perform privado.exigir_resultado(p_gimnasio_id);   -- EQU-1
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
    -- VD-30: el precio se calcula una vez por plan (no una vez por socio: 0,18 ms cada una, 350 ms con 3.000 socios) y se
    -- multiplica por cuántos hay. n × (precio / meses) es exactamente la suma de n filas iguales: el resultado no cambia.
    'recurrente', (select coalesce(round(sum(x.n * (privado.precio_base(x.plan_id, now()) / greatest(x.meses, 1)))), 0)
                     from (select su.plan_id, pl.duracion_meses as meses, count(*) as n
                             from public.suscripciones su join public.planes pl on pl.id = su.plan_id join public.socios s on s.id = su.socio_id
                            where su.gimnasio_id = p_gimnasio_id and su.baja_en is null and pl.tipo = 'membresia' and s.dado_de_baja_en is null
                              and exists (select 1 from public.coberturas c where c.suscripcion_id = su.id and c.anulada_en is null and c.desde <= now() and c.hasta > now())
                            group by su.plan_id, pl.duracion_meses) x),
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
  foreach f in array array['public.para_hacer_hoy(uuid)', 'public.pendientes_panel(uuid)', 'public.resultado_mes(uuid, date)',
                           'privado.para_hacer_hoy_con(uuid, jsonb)', 'privado.retencion_con(uuid, timestamptz, jsonb)'] loop
    if to_regprocedure(f) is null then raise exception 'Verificación: falta %', f; end if;
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') <> (f like 'public.%') then
      raise exception 'Verificación: permisos de %', f;
    end if;
  end loop;
  if position('fin_dia' in pg_get_functiondef('privado.para_hacer_hoy_con(uuid, jsonb)'::regprocedure)) = 0 then
    raise exception 'Verificación: para_hacer_hoy_con todavía usa la variable fin';
  end if;
  if position('para_hacer_hoy_con' in pg_get_functiondef('public.pendientes_panel(uuid)'::regprocedure)) = 0 then
    raise exception 'Verificación: pendientes_panel no comparte la retención';
  end if;
end $$;
