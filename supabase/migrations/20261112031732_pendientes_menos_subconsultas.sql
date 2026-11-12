-- F0.3 · retencion_pendientes con menos trabajo repetido. Mismo resultado (columnas, filas y orden) que la versión de 20261111130100,
-- que a su vez es igual a privado.retencion_referencia (lo prueban retencion-cubierto.test.mjs y pendientes-vieja-vs-nueva.test.mjs con
-- momentos fijos). Qué cambia, solo cómo se calcula:
--  · "quién vino hace poco" y "quién tiene cuota adelantada" se unen UNA vez (left join) en vez de preguntarse con una subconsulta
--    por cada uso (eran unas 20 tablas hash de 4.500 filas armadas en cada llamada, y un plan con 40 subplanes que tardaba en planificarse);
--  · la membresía vigente de cada socio sale de UNA pasada por las suscripciones del gimnasio (antes, una búsqueda con orden por socio), y el primer inicio solo se busca para quien lo necesita;
--  · desaparece la lista intermedia de candidatos (se armaba, se deduplicaba y se volvía a buscar cada socio por su clave).
-- ingresos.socio_id y coberturas.socio_id son NOT NULL: no hay filas con socio nulo que cambien el sentido de IN contra join.
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
-- La membresía que importa: la activa, o la última si se cerró hace poco (la misma regla de siempre). Una sola pasada por las
-- suscripciones del gimnasio (antes, una búsqueda con orden por cada socio candidato).
su as materialized (
  select distinct on (s.socio_id) s.socio_id, s.id, s.baja_en
    from public.suscripciones s, g
   where s.gimnasio_id = p_gimnasio_id and s.inicio <= p_momento
     and (s.baja_en is null or s.baja_en > p_momento - make_interval(days => g.retencion_dias_se_fue))
   order by s.socio_id, (s.baja_en is null) desc, s.inicio desc
),
base as (
  select so.id as socio_id, trim(so.nombre || ' ' || so.apellido) as nombre,
         (coalesce(g.plan_familiar_activo, false)
            and exists (select 1 from public.grupos_familiares gf where gf.id = so.grupo_familiar_id and gf.titular_id is not null and gf.titular_id <> so.id)) as vinculado,
         so.dado_de_baja_en, su.id as suscripcion_id, su.baja_en, so.no_escribirle_en is not null as no_escribir,
         an.primer_inicio,
         case when e.complejo then e.fin_actual else so.cubierto_hasta end as fin_actual,
         coalesce(e.complejo and e.tiene_futuro, false) as tiene_futuro,
         (rc.socio_id is not null) as vino_hace_poco,
         v.ultimo as ultimo_ingreso
    from public.socios so
    cross join g
    cross join hoy
    left join con_futuro cf on cf.socio_id = so.id
    left join reciente rc on rc.socio_id = so.id
    join su on su.socio_id = so.id
    -- El primer inicio solo se usa para nuevo y no_viene: quien ya es por_vencer por su cubierto_hasta (sin cuota adelantada) no lo necesita.
    left join lateral (
      select min(s.inicio) as primer_inicio from public.suscripciones s
       where s.gimnasio_id = p_gimnasio_id and s.socio_id = so.id
         and not (cf.socio_id is null and ((so.cubierto_hasta - interval '1 microsecond') at time zone g.zona)::date - hoy.d <= g.dias_aviso)
    ) an on true
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
       where cf.socio_id is not null
    ) e on true
    left join lateral (
      -- La última visita exacta, solo para quien no vino hace poco (para los demás no se usa).
      select max(i.momento) as ultimo from public.ingresos i
       where rc.socio_id is null
         and i.gimnasio_id = p_gimnasio_id and i.socio_id = so.id and i.anulado_en is null
         and i.resultado <> 'rechazado' and i.momento <= p_momento
    ) v on true
   -- F0.3 prefiltro: solo los socios que todavía pueden caer en una de las tres listas (con_futuro / por vencer / no vino hace poco).
   where so.gimnasio_id = p_gimnasio_id and so.cubierto_hasta > p_momento
     and (cf.socio_id is not null
          or ((so.cubierto_hasta - interval '1 microsecond') at time zone g.zona)::date - hoy.d <= g.dias_aviso
          or rc.socio_id is null)
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

-- ── campana_control (la que suma el dueño al menú): los avisos de moderación ──
-- Mismo resultado que la versión de 20261106007203 (que 20261109020200 renombró a avisos_moderacion_base y envolvió). Cambia solo el aviso de
-- cortesías repetidas: agrupa primero por socio y busca los nombres de quienes las dieron solo para los que pasan el umbral.
do $g$ begin
  if to_regprocedure('privado.avisos_moderacion_base(uuid,text)') is null then raise exception 'Guarda: falta privado.avisos_moderacion_base'; end if;
end $g$;

create or replace function privado.avisos_moderacion_base(p_gimnasio_id uuid, p_zona text) returns jsonb
language plpgsql stable set search_path = '' as $$
declare items jsonb := '[]'::jsonb; alerta int; modo text;
begin
  select c.cortesia_alerta_repetidas, c.devolucion_baja_modo into alerta, modo from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  -- Suspensiones y expulsiones cuya fecha de revisión ya llegó: alguien tiene que decidir si siguen.
  items := items || coalesce((select jsonb_agg(jsonb_build_object(
             'clave', 'revisar_suspension:' || x.id::text || ':' || to_char(x.revisar_en at time zone p_zona, 'YYYYMMDD'), 'emoji', '🚫',
             'titulo', 'Revisar ' || case when x.tipo = 'expulsion' then 'la expulsión' else 'la suspensión' end || ' de ' || trim(s.nombre || ' ' || s.apellido),
             'detalle', x.motivo, 'href', '/socios/' || s.id, 'en', x.revisar_en))
           from public.suspensiones x join public.socios s on s.id = x.socio_id
          where x.gimnasio_id = p_gimnasio_id and x.levantada_en is null and (x.hasta is null or x.hasta > now())
            and x.revisar_en is not null and x.revisar_en <= now()), '[]'::jsonb);
  -- Un socio con varias cortesías en poco tiempo (la clave cambia con la cantidad: si recibe otra, vuelve a avisar).
  items := items || coalesce((select jsonb_agg(jsonb_build_object(
             'clave', 'cortesias_repetidas:' || r.socio_id::text || ':' || r.n, 'emoji', '🎁',
             'titulo', trim(s.nombre || ' ' || s.apellido) || ' recibió ' || r.n || ' cortesías en 60 días',
             'detalle', 'Las dieron: ' || w.quienes, 'href', '/socios/' || s.id, 'en', r.ultima))
           from (select c.socio_id, count(*)::int as n, max(c.creado_en) as ultima
                   from public.coberturas c
                  where c.gimnasio_id = p_gimnasio_id and c.origen = 'cortesia' and c.anulada_en is null and c.creado_en > now() - interval '60 days'
                  group by c.socio_id having count(*) >= alerta) r
           join public.socios s on s.id = r.socio_id
           -- Los nombres de quienes las dieron se buscan solo para los pocos socios que pasan el umbral (antes, un cruce con el equipo por cada cobertura).
           cross join lateral (select string_agg(distinct coalesce(q.nombre, 'alguien'), ', ') as quienes
                                 from public.coberturas c left join public.equipo q on q.gimnasio_id = c.gimnasio_id and q.usuario_id = c.creado_por
                                where c.gimnasio_id = p_gimnasio_id and c.socio_id = r.socio_id and c.origen = 'cortesia' and c.anulada_en is null
                                  and c.creado_en > now() - interval '60 days') w), '[]'::jsonb);
  -- La baja que pidió un socio y nadie contestó en 24 h.
  items := items || coalesce((select jsonb_agg(jsonb_build_object(
             'clave', 'pedido_baja_tarde:' || p.id::text, 'emoji', '⏳',
             'titulo', trim(s.nombre || ' ' || s.apellido) || ' pidió la baja hace más de 24 h y nadie respondió',
             'detalle', 'Constancia ' || p.codigo, 'href', '/socios/' || s.id, 'en', p.pedido_en + interval '24 hours'))
           from public.pedidos_baja p join public.socios s on s.id = p.socio_id
          where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.pedido_en < now() - interval '24 hours'), '[]'::jsonb);
  -- VD-46J: una baja de los últimos 30 días con períodos pagados por adelantado y la devolución sin decidir.
  if modo is distinct from 'ninguna' then
    items := items || coalesce((select jsonb_agg(jsonb_build_object(
               'clave', 'devolucion_pendiente:' || z.socio_id::text || ':' || z.total::text, 'emoji', '↩️',
               'titulo', 'Hay que decidir la devolución a ' || z.nombre || ': ' || privado.formato_pesos(z.total),
               'detalle', 'Pagó por adelantado y se dio de baja', 'href', '/socios/' || z.socio_id, 'en', z.dado_de_baja_en))
             from (select so.id as socio_id, trim(so.nombre || ' ' || so.apellido) as nombre, so.dado_de_baja_en,
                          (privado.calcular_devolucion_baja(so.id, so.dado_de_baja_en) ->> 'total')::numeric as total
                     from public.socios so
                    where so.gimnasio_id = p_gimnasio_id and so.dado_de_baja_en > now() - interval '30 days'
                      and exists (select 1 from public.coberturas c where c.socio_id = so.id and c.origen = 'pago' and c.anulada_en is null and c.hasta > so.dado_de_baja_en)) z
            where z.total > 0), '[]'::jsonb);
  end if;
  return items;
end $$;
revoke all on function privado.avisos_moderacion_base(uuid, text) from public, anon, authenticated;

do $v$
declare f text;
begin
  if not exists (select 1 from pg_proc where oid = 'privado.retencion_pendientes(uuid, timestamptz)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: retencion_pendientes sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'privado.retencion_pendientes(uuid, timestamptz)', 'execute')
     or has_function_privilege('authenticated', 'privado.retencion_pendientes(uuid, timestamptz)', 'execute') then
    raise exception 'Verificación: retencion_pendientes ejecutable desde el navegador';
  end if;
  if pg_get_functiondef('privado.retencion_pendientes(uuid, timestamptz)'::regprocedure) not like '%F0.3 prefiltro%'
     or pg_get_functiondef('privado.retencion_pendientes(uuid, timestamptz)'::regprocedure) like '%candidatos%' then
    raise exception 'Verificación: retencion_pendientes no quedó con el prefiltro y los joins';
  end if;
  if not exists (select 1 from pg_proc where oid = 'privado.avisos_moderacion_base(uuid, text)'::regprocedure and 'search_path=""' = any (proconfig))
     or has_function_privilege('authenticated', 'privado.avisos_moderacion_base(uuid, text)', 'execute') then
    raise exception 'Verificación: avisos_moderacion_base sin search_path vacío o ejecutable desde el navegador';
  end if;
  foreach f in array array['revisar_suspension', 'cortesias_repetidas', 'pedido_baja_tarde', 'devolucion_pendiente'] loop
    if position(f in pg_get_functiondef('privado.avisos_moderacion_base(uuid, text)'::regprocedure)) = 0 then raise exception 'Verificación: avisos_moderacion_base perdió %', f; end if;
  end loop;
end $v$;
