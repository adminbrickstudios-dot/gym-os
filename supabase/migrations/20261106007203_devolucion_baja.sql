-- VD-46J · Devolución proporcional al dar de baja con cuota adelantada (docs/v2/14-SITUACIONES.md, casos 24 y 16).
-- Un socio que pagó por adelantado (varios meses) y se da de baja tiene derecho a que se le calcule lo que corresponde devolver.
-- La devolución es un HECHO NUEVO: nunca se borra ni se toca el pago original (la venta sigue confirmada y la cobertura que pagó queda como estaba).
--   calcular_devolucion_baja(socio)      cuánto corresponde, línea por línea (cada período pagado que todavía no se usó). Dueño y encargado ven
--                                        los montos; la recepción solo ve si hay algo para evaluar.
--   registrar_devolucion(socio, medio, monto, motivo)   SOLO dueño o encargado, con motivo. Si es en efectivo sale de SU caja abierta como un
--                                        retiro "Devolución de baja …" (así baja lo esperado del cierre y queda en el reporte de caja).
--                                        Puede ser menos de lo calculado (queda anotado cuánto era) o cero ("no se devuelve", con motivo).
--   devolucion_baja_config / guardar_devolucion_baja_modo   la regla del gimnasio (datos): 'ninguna' | 'cuotas_adelantadas' (por defecto: solo
--                                        los períodos que todavía no empezaron) | 'proporcional' (también los días sin usar del período en curso)
-- Cada línea se devuelve una sola vez (único por cobertura). Control lista las devoluciones y avisa en la campana la baja reciente que tiene una
-- devolución por decidir (privado.avisos_moderacion, copia de 7202). No se toca vender ni resumen_turno.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.constancia_baja(uuid)') is null then raise exception 'Guarda: falta VD-46E (7202)'; end if;
  if to_regprocedure('privado.avisos_moderacion(uuid, text)') is null then raise exception 'Guarda: falta privado.avisos_moderacion'; end if;
  if to_regprocedure('public.moderacion_control(uuid, date, date, int)') is null then raise exception 'Guarda: falta moderacion_control'; end if;
  if to_regclass('public.movimientos_caja') is null or to_regclass('public.coberturas') is null then raise exception 'Guarda: faltan movimientos_caja o coberturas'; end if;
  if to_regprocedure('privado.formato_pesos(numeric)') is null then raise exception 'Guarda: falta privado.formato_pesos'; end if;
end $$;

-- ── La regla del gimnasio ───────────────────────────────────────────
alter table public.configuracion_gimnasio add column if not exists devolucion_baja_modo text not null default 'cuotas_adelantadas'
  check (devolucion_baja_modo in ('ninguna', 'cuotas_adelantadas', 'proporcional'));

-- ── Los hechos ──────────────────────────────────────────────────────
create table if not exists public.devoluciones (
  id                  uuid primary key default gen_random_uuid(),
  gimnasio_id         uuid not null references public.gimnasios(id),
  socio_id            uuid not null,
  medio               text not null check (medio in ('efectivo', 'transferencia', 'mercadopago', 'otro', 'ninguno')),
  monto               numeric(12,2) not null check (monto >= 0),
  monto_calculado     numeric(12,2) not null check (monto_calculado >= 0),
  motivo              text not null check (length(trim(motivo)) > 0),
  modo                text not null,
  movimiento_caja_id  uuid,
  creado_en           timestamptz not null default now(),
  creado_por          uuid not null,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, movimiento_caja_id) references public.movimientos_caja (gimnasio_id, id),
  check ((medio = 'ninguno') = (monto = 0)),
  check (medio <> 'efectivo' or movimiento_caja_id is not null)
);
create index if not exists devoluciones_gimnasio on public.devoluciones (gimnasio_id, creado_en desc);
create index if not exists devoluciones_socio on public.devoluciones (socio_id);
select privado.politicas_estandar('public.devoluciones', array['dueno', 'encargado'], '{}', true);
revoke all on table public.devoluciones from anon;
revoke truncate, references, trigger on public.devoluciones from authenticated;
drop trigger if exists devoluciones_inmutable on public.devoluciones;
create trigger devoluciones_inmutable before update or delete on public.devoluciones for each row execute function privado.hecho_inmutable('_nada_');

-- Qué cobertura se devolvió y cuánto (una cobertura se devuelve una sola vez).
create table if not exists public.devoluciones_items (
  id             uuid primary key default gen_random_uuid(),
  gimnasio_id    uuid not null references public.gimnasios(id),
  devolucion_id  uuid not null,
  cobertura_id   uuid not null,
  monto          numeric(12,2) not null check (monto >= 0),
  unique (gimnasio_id, id),
  unique (gimnasio_id, cobertura_id),
  foreign key (gimnasio_id, devolucion_id) references public.devoluciones (gimnasio_id, id),
  foreign key (gimnasio_id, cobertura_id) references public.coberturas (gimnasio_id, id)
);
create index if not exists devoluciones_items_devolucion on public.devoluciones_items (devolucion_id);
select privado.politicas_estandar('public.devoluciones_items', array['dueno', 'encargado'], '{}');
revoke all on table public.devoluciones_items from anon;
revoke truncate, references, trigger on public.devoluciones_items from authenticated;
drop trigger if exists devoluciones_items_inmutable on public.devoluciones_items;
create trigger devoluciones_items_inmutable before update or delete on public.devoluciones_items for each row execute function privado.hecho_inmutable('_nada_');

-- ── El cálculo (una sola cuenta, para la ficha, el registro y el aviso) ──
-- Los períodos pagados con una venta confirmada que terminan después del momento de la baja y todavía no se devolvieron.
--   período que no empezó (o empieza el día de la baja) → se devuelve lo que costó (precio menos descuento, por período)
--   período en curso → solo con la regla 'proporcional': lo que costó × días sin usar / días del período
create or replace function privado.calcular_devolucion_baja(p_socio_id uuid, p_momento timestamptz) returns jsonb
language plpgsql stable set search_path = '' as $$
declare so public.socios; modo text; zona text; dia date; lineas jsonb; total numeric;
begin
  select * into so from public.socios where id = p_socio_id;
  if not found then return null; end if;
  select c.devolucion_baja_modo into modo from public.configuracion_gimnasio c where c.gimnasio_id = so.gimnasio_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = so.gimnasio_id;
  dia := privado.dia_local(p_momento, zona);
  select coalesce(jsonb_agg(jsonb_build_object('cobertura_id', x.cobertura_id, 'venta_id', x.venta_id, 'concepto', x.descripcion, 'desde', x.desde, 'hasta', x.hasta,
           'pagado', x.pagado, 'dias_total', x.dias_total, 'dias_sin_usar', x.dias_sin_usar, 'empezado', not x.sin_empezar, 'medios', x.medios,
           'a_devolver', x.a_devolver) order by x.desde), '[]'::jsonb),
         coalesce(sum(x.a_devolver), 0)
    into lineas, total
    from (
      select y.*, case when modo = 'ninguna' then 0
                       when y.sin_empezar then y.pagado
                       when modo = 'proporcional' and y.dias_total > 0 then round(y.pagado * y.dias_sin_usar / y.dias_total, 2)
                       else 0 end as a_devolver
        from (
          select c.id as cobertura_id, v.id as venta_id, i.descripcion, c.desde, c.hasta,
                 round((i.cantidad * i.precio_unitario - i.descuento) / i.cantidad, 2) as pagado,
                 (privado.dia_local(c.hasta, zona) - privado.dia_local(c.desde, zona)) as dias_total,
                 greatest(privado.dia_local(c.hasta, zona) - greatest(privado.dia_local(c.desde, zona), dia), 0) as dias_sin_usar,
                 (privado.dia_local(c.desde, zona) >= dia) as sin_empezar,
                 (select string_agg(distinct p.medio, ', ') from public.pagos p where p.venta_id = v.id and p.estado = 'aprobado') as medios
            from public.coberturas c
            join public.venta_items i on i.id = c.venta_item_id
            join public.ventas v on v.id = i.venta_id
           where c.socio_id = p_socio_id and c.origen = 'pago' and c.anulada_en is null and v.estado = 'confirmada'
             and c.hasta > p_momento and i.cantidad > 0
             and not exists (select 1 from public.devoluciones_items di where di.cobertura_id = c.id)
        ) y
    ) x
   where x.a_devolver > 0;
  return jsonb_build_object('modo', modo, 'momento', p_momento, 'lineas', lineas, 'total', total);
end $$;
revoke all on function privado.calcular_devolucion_baja(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.calcular_devolucion_baja(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare so public.socios; e public.equipo; r jsonb;
begin
  select * into so from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(so.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  r := privado.calcular_devolucion_baja(p_socio_id, coalesce(so.dado_de_baja_en, now()));
  r := r || jsonb_build_object('dado_de_baja', so.dado_de_baja_en is not null, 'puede_registrar', e.rol in ('dueno', 'encargado') and so.dado_de_baja_en is not null,
         'ya_registrada', exists (select 1 from public.devoluciones d where d.socio_id = p_socio_id and d.creado_en >= coalesce(so.dado_de_baja_en, now())));
  -- La plata la ve el dueño o el encargado: la recepción solo sabe que hay algo para evaluar.
  if e.rol = 'recepcion' then
    return jsonb_build_object('modo', r -> 'modo', 'hay', (r ->> 'total')::numeric > 0, 'dado_de_baja', r -> 'dado_de_baja', 'puede_registrar', false);
  end if;
  return r || jsonb_build_object('hay', (r ->> 'total')::numeric > 0);
end $$;

-- ── Registrar la devolución ─────────────────────────────────────────
create or replace function public.registrar_devolucion(p_socio_id uuid, p_medio text, p_monto numeric, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  so public.socios; eid uuid; calc jsonb; total numeric; v_monto numeric; v_motivo text := trim(coalesce(p_motivo, '')); tid uuid; mid uuid; did uuid; l jsonb; codigo text;
begin
  select * into so from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(so.gimnasio_id, array['dueno', 'encargado']);
  if so.dado_de_baja_en is null then raise exception 'Primero hay que darlo de baja: la devolución se calcula con el día de la baja.' using errcode = '22023'; end if;
  if p_medio is null or p_medio not in ('efectivo', 'transferencia', 'mercadopago', 'otro', 'ninguno') then raise exception 'Elegí cómo se devuelve.' using errcode = '22023'; end if;
  if length(v_motivo) < 3 then raise exception 'Escribí el motivo: queda anotado con tu nombre.' using errcode = '22023'; end if;
  if length(v_motivo) > 300 then raise exception 'El motivo: hasta 300 letras.' using errcode = '22023'; end if;
  v_monto := round(coalesce(p_monto, 0), 2);
  if v_monto < 0 then raise exception 'El monto no puede ser negativo.' using errcode = '22023'; end if;
  if (p_medio = 'ninguno') <> (v_monto = 0) then raise exception 'Si no se devuelve nada, elegí “No se devuelve” y poné 0; si se devuelve algo, elegí cómo.' using errcode = '22023'; end if;

  calc := privado.calcular_devolucion_baja(p_socio_id, so.dado_de_baja_en);
  total := (calc ->> 'total')::numeric;
  if total <= 0 then raise exception 'No hay nada para devolver: no tenía períodos adelantados sin usar (o ya se registró).' using errcode = '22023'; end if;
  if v_monto > total then raise exception 'No se puede devolver más de lo calculado (%).', privado.formato_pesos(total) using errcode = '22023'; end if;

  if p_medio = 'efectivo' then
    select t.id into tid from public.turnos_caja t where t.gimnasio_id = so.gimnasio_id and t.abierto_por = eid and t.cerrado_en is null order by t.abierto_en desc limit 1;
    if tid is null then raise exception 'Para devolver en efectivo abrí tu caja: la devolución sale de ahí como un retiro con el motivo.' using errcode = '22023'; end if;
    select p.codigo into codigo from public.pedidos_baja p where p.socio_id = so.id and p.estado = 'dado_de_baja' order by p.resuelto_en desc limit 1;
    insert into public.movimientos_caja (gimnasio_id, turno_caja_id, tipo, monto, motivo, creado_por)
    values (so.gimnasio_id, tid, 'retiro', v_monto, left('Devolución de baja' || coalesce(' ' || codigo, '') || ' a ' || trim(so.nombre || ' ' || so.apellido) || ': ' || v_motivo, 300), eid)
    returning id into mid;
  end if;

  insert into public.devoluciones (gimnasio_id, socio_id, medio, monto, monto_calculado, motivo, modo, movimiento_caja_id, creado_por)
  values (so.gimnasio_id, so.id, p_medio, v_monto, total, v_motivo, calc ->> 'modo', mid, eid) returning id into did;
  -- Lo calculado queda devuelto (aunque se haya devuelto menos): cada período se resuelve una sola vez. A cada línea le toca su parte.
  for l in select x from jsonb_array_elements(calc -> 'lineas') x loop
    insert into public.devoluciones_items (gimnasio_id, devolucion_id, cobertura_id, monto)
    values (so.gimnasio_id, did, (l ->> 'cobertura_id')::uuid, round(v_monto * (l ->> 'a_devolver')::numeric / total, 2));
  end loop;
  return jsonb_build_object('devolucion_id', did, 'monto', v_monto, 'calculado', total, 'medio', p_medio, 'movimiento_caja_id', mid);
end $$;

-- ── La regla ────────────────────────────────────────────────────────
create or replace function public.devolucion_baja_config(p_gimnasio_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return (select c.devolucion_baja_modo from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id);
end $$;

create or replace function public.guardar_devolucion_baja_modo(p_gimnasio_id uuid, p_modo text) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno']);
  if p_modo is null or p_modo not in ('ninguna', 'cuotas_adelantadas', 'proporcional') then raise exception 'Elegí una de las tres reglas.' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set devolucion_baja_modo = p_modo, actualizado_en = now() where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la regla'; end if;
end $$;

-- ── moderacion_control: copia de 7202 + las devoluciones ──
create or replace function public.moderacion_control(p_gimnasio_id uuid, p_desde date, p_hasta date, p_limite int default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; ini timestamptz; fin timestamptz; lim int := coalesce(p_limite, 50); filas jsonb;
begin
  perform privado.exigir_resultado(p_gimnasio_id);
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'Elegí desde y hasta qué día.' using errcode = '22023'; end if;
  if p_hasta - p_desde > 366 then raise exception 'Se mira hasta un año por vez.' using errcode = '22023'; end if;
  if lim < 1 or lim > 200 then raise exception 'Se piden de 1 a 200 por vez.' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  ini := privado.medianoche(p_desde, zona);
  fin := privado.medianoche(p_hasta + 1, zona);
  select coalesce(jsonb_agg(jsonb_build_object('tipo', u.tipo, 'clave', u.clave, 'en', u.en, 'quien', u.quien, 'socio_id', u.socio_id,
           'socio', nullif(trim(s.nombre || ' ' || s.apellido), ''), 'monto', u.monto, 'detalle', u.detalle) order by u.en desc, u.clave desc), '[]'::jsonb)
    into filas
    from (
      select * from (
        (select x.tipo::text as tipo, x.creado_en as en, 'susp:' || x.id::text as clave, q.nombre::text as quien, x.socio_id,
                null::numeric as monto,
                (x.motivo || case when x.hasta is not null then ' · hasta el ' || to_char(x.hasta at time zone zona, 'DD/MM') else '' end)::text as detalle
           from public.suspensiones x left join public.equipo q on q.gimnasio_id = x.gimnasio_id and q.usuario_id = x.creado_por
          where x.gimnasio_id = p_gimnasio_id and x.creado_en >= ini and x.creado_en < fin
          order by x.creado_en desc limit lim)
        union all
        (select 'levantamiento'::text, x.levantada_en, 'levanta:' || x.id::text, q.nombre::text, x.socio_id, null::numeric,
                (coalesce(x.levantada_motivo, '') || ' (era: ' || x.motivo || ')')::text
           from public.suspensiones x left join public.equipo q on q.gimnasio_id = x.gimnasio_id and q.usuario_id = x.levantada_por
          where x.gimnasio_id = p_gimnasio_id and x.levantada_en >= ini and x.levantada_en < fin
          order by x.levantada_en desc limit lim)
        union all
        (select 'cortesia'::text, c.creado_en, 'cortesia:' || c.id::text, q.nombre::text, c.socio_id, null::numeric,
                (round(extract(epoch from (c.hasta - c.desde)) / 86400)::int || case when round(extract(epoch from (c.hasta - c.desde)) / 86400)::int = 1 then ' día' else ' días' end
                 || ' · ' || coalesce(c.motivo, '') || case when c.anulada_en is not null then ' · ANULADA: ' || coalesce(c.anulada_motivo, '') else '' end)::text
           from public.coberturas c left join public.equipo q on q.gimnasio_id = c.gimnasio_id and q.usuario_id = c.creado_por
          where c.gimnasio_id = p_gimnasio_id and c.origen = 'cortesia' and c.creado_en >= ini and c.creado_en < fin
          order by c.creado_en desc limit lim)
        union all
        (select 'baja'::text, so.dado_de_baja_en, 'baja:' || so.id::text, q.nombre::text, so.id, null::numeric,
                (coalesce(so.motivo_baja, 'sin motivo') || coalesce(' · ' || pb.codigo, ''))::text
           from public.socios so
           left join lateral (select p.codigo, p.resuelto_por from public.pedidos_baja p
                               where p.socio_id = so.id and p.estado = 'dado_de_baja' order by p.resuelto_en desc limit 1) pb on true
           left join public.equipo q on q.id = pb.resuelto_por
          where so.gimnasio_id = p_gimnasio_id and so.dado_de_baja_en >= ini and so.dado_de_baja_en < fin
          order by so.dado_de_baja_en desc limit lim)
        union all
        -- VD-46J: devoluciones (hechos nuevos: el pago original no se toca)
        (select 'devolucion'::text, d.creado_en, 'devolucion:' || d.id::text, q.nombre::text, d.socio_id, d.monto,
                (case d.medio when 'efectivo' then 'En efectivo' when 'transferencia' then 'Por transferencia' when 'mercadopago' then 'Por MercadoPago' when 'ninguno' then 'No se devuelve' else 'Otro medio' end
                 || ' · ' || d.motivo || case when d.monto < d.monto_calculado then ' · calculado ' || privado.formato_pesos(d.monto_calculado) else '' end)::text
           from public.devoluciones d left join public.equipo q on q.id = d.creado_por
          where d.gimnasio_id = p_gimnasio_id and d.creado_en >= ini and d.creado_en < fin
          order by d.creado_en desc limit lim)
      ) b order by b.en desc, b.clave desc limit lim
    ) u left join public.socios s on s.id = u.socio_id;
  return jsonb_build_object('items', filas);
end $$;

-- ── avisos_moderacion: copia de 7202 + la devolución por decidir ──
create or replace function privado.avisos_moderacion(p_gimnasio_id uuid, p_zona text) returns jsonb
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
             'detalle', 'Las dieron: ' || r.quienes, 'href', '/socios/' || s.id, 'en', r.ultima))
           from (select c.socio_id, count(*)::int as n, max(c.creado_en) as ultima, string_agg(distinct coalesce(q.nombre, 'alguien'), ', ') as quienes
                   from public.coberturas c left join public.equipo q on q.gimnasio_id = c.gimnasio_id and q.usuario_id = c.creado_por
                  where c.gimnasio_id = p_gimnasio_id and c.origen = 'cortesia' and c.anulada_en is null and c.creado_en > now() - interval '60 days'
                  group by c.socio_id having count(*) >= alerta) r
           join public.socios s on s.id = r.socio_id), '[]'::jsonb);
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

revoke all on function privado.avisos_moderacion(uuid, text) from public, anon, authenticated;
revoke all on function public.calcular_devolucion_baja(uuid), public.registrar_devolucion(uuid, text, numeric, text), public.devolucion_baja_config(uuid),
  public.guardar_devolucion_baja_modo(uuid, text), public.moderacion_control(uuid, date, date, int) from public, anon, authenticated;
grant execute on function public.calcular_devolucion_baja(uuid), public.registrar_devolucion(uuid, text, numeric, text), public.devolucion_baja_config(uuid),
  public.guardar_devolucion_baja_modo(uuid, text), public.moderacion_control(uuid, date, date, int) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text; t text;
begin
  foreach f in array array['public.calcular_devolucion_baja(uuid)', 'public.registrar_devolucion(uuid, text, numeric, text)', 'public.devolucion_baja_config(uuid)',
                           'public.guardar_devolucion_baja_modo(uuid, text)', 'public.moderacion_control(uuid, date, date, int)', 'privado.avisos_moderacion(uuid, text)',
                           'privado.calcular_devolucion_baja(uuid, timestamptz)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  foreach t in array array['devoluciones', 'devoluciones_items'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then raise exception 'Verificación: % sin RLS', t; end if;
  end loop;
  foreach f in array array['revisar_suspension', 'cortesias_repetidas', 'pedido_baja_tarde', 'devolucion_pendiente'] loop
    if position(f in pg_get_functiondef('privado.avisos_moderacion(uuid, text)'::regprocedure)) = 0 then raise exception 'Verificación: avisos_moderacion perdió %', f; end if;
  end loop;
  foreach f in array array['levanta:', 'cortesia:', 'baja:', 'devolucion:'] loop
    if position(f in pg_get_functiondef('public.moderacion_control(uuid, date, date, int)'::regprocedure)) = 0 then raise exception 'Verificación: moderacion_control perdió %', f; end if;
  end loop;
end $$;
