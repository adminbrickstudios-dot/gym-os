-- VD-10 · Control: todo queda escrito, con alertas al dueño (docs/v2/02 §5).
-- Una línea de tiempo filtrable que junta lo que ya se guarda en otras tablas:
--   cobro · anulacion · descuento · otro_dia (cobré otro día, VD-5) · dejado_pasar (VD-8)
--   caja (abrió, cerró, sin contar: VD-9) · precio · configuracion · entrada_anulada
--   invitado · prestamo (anti-préstamo, VD-3)
-- Nada se guarda aparte: se calcula de los hechos. Lo único nuevo que se escribe es el
-- precio de un producto que cambia (un trigger lo anota en historial_configuracion, que ya
-- guardaba quién y cuándo; los planes ya tenían su historial en precios_plan).
--
--   linea_de_control(gimnasio, desde, hasta, tipos, quien, limite, cursor)
--       dueño siempre; encargado solo si el dueño le dio el Resultado (EQU-1: es plata y
--       es mirar al equipo). Recepción y profe: error, nunca una lista vacía.
--       Paginada por cursor (momento, clave): cada tipo trae como mucho limite+1 filas por su
--       índice por gimnasio y se queda con las más nuevas.
--   campana_control(gimnasio)
--       avisos nuevos para la campana del dueño: cobros cargados con fecha atrasada y
--       alertas de anti-préstamo. Anulaciones y descuentos grandes ya llegan por alertas_caja
--       (campana, 0073): no se duplican. La clave de cada aviso es el id del hecho, así el
--       mismo aviso no vuelve a contar como nuevo (avisos_leidos).
--   Sección "control" apagable por gimnasio (privado.secciones_validas).
-- No se tocan vender, registrar_ingreso ni abrir_caja.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.exigir_resultado(uuid)') is null then raise exception 'Guarda: falta privado.exigir_resultado (EQU-1)'; end if;
  if to_regprocedure('privado.con_leidos(uuid, jsonb)') is null then raise exception 'Guarda: falta privado.con_leidos (campana)'; end if;
  if to_regprocedure('privado.formato_pesos(numeric)') is null then raise exception 'Guarda: falta privado.formato_pesos'; end if;
  if to_regprocedure('privado.registrar_cambios(uuid, text, jsonb, jsonb, text[])') is null then raise exception 'Guarda: falta privado.registrar_cambios (CFG-8)'; end if;
  if to_regprocedure('privado.secciones_validas()') is null then raise exception 'Guarda: falta privado.secciones_validas'; end if;
  if to_regclass('public.promesas_pago') is null then raise exception 'Guarda: falta promesas_pago (VD-8)'; end if;
  if to_regclass('public.alertas_prestamo') is null then raise exception 'Guarda: falta alertas_prestamo (VD-3)'; end if;
  if to_regclass('public.pedidos_anulacion') is null then raise exception 'Guarda: falta pedidos_anulacion'; end if;
  if to_regclass('public.invitados') is null then raise exception 'Guarda: falta invitados'; end if;
  if to_regclass('public.historial_configuracion') is null then raise exception 'Guarda: falta historial_configuracion'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'turnos_caja' and column_name = 'sin_contar_en') then
    raise exception 'Guarda: falta turnos_caja.sin_contar_en (VD-9)';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ventas' and column_name = 'otro_dia_motivo') then
    raise exception 'Guarda: falta ventas.otro_dia_motivo (VD-5)';
  end if;
end $$;

-- ── Índices: cada tipo se lee por gimnasio y fecha ──────────────────
create index if not exists ventas_control_confirmada on public.ventas (gimnasio_id, confirmada_en desc) where confirmada_en is not null;
create index if not exists ventas_control_anulada on public.ventas (gimnasio_id, anulada_en desc) where anulada_en is not null;
create index if not exists ventas_control_otro_dia on public.ventas (gimnasio_id, registrada_en desc) where otro_dia_motivo is not null;
create index if not exists turnos_caja_control_abierto on public.turnos_caja (gimnasio_id, abierto_en desc);
create index if not exists turnos_caja_control_cerrado on public.turnos_caja (gimnasio_id, cerrado_en desc) where cerrado_en is not null;
create index if not exists turnos_caja_control_sin_contar on public.turnos_caja (gimnasio_id, sin_contar_en desc) where sin_contar;
create index if not exists ingresos_control_anulado on public.ingresos (gimnasio_id, anulado_en desc) where anulado_en is not null;
create index if not exists ingresos_control_forzado on public.ingresos (gimnasio_id, momento desc) where resultado = 'forzado';
create index if not exists precios_plan_control on public.precios_plan (gimnasio_id, creado_en desc);
create index if not exists invitados_control on public.invitados (gimnasio_id, creado_en desc);

-- ── La sección "control" se puede apagar ────────────────────────────
-- Se suma a lo que ya había (otro ítem puede haber sumado la suya): se lee la lista vigente.
do $$
declare actuales text[];
begin
  actuales := privado.secciones_validas();
  if not ('control' = any (actuales)) then
    execute format('create or replace function privado.secciones_validas() returns text[] language sql immutable set search_path = '''' as $f$ select %L::text[] $f$',
                   array_append(actuales, 'control'));
  end if;
  alter table public.configuracion_gimnasio drop constraint if exists configuracion_secciones_validas;
  alter table public.configuracion_gimnasio add constraint configuracion_secciones_validas
    check (secciones_apagadas <@ privado.secciones_validas());
end $$;

-- ── El precio de un producto deja rastro ────────────────────────────
create or replace function privado.historial_precio_producto_tg() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.registrar_cambios(new.gimnasio_id, 'producto.' || new.nombre || '.',
    jsonb_build_object('precio', old.precio), jsonb_build_object('precio', new.precio), array[]::text[]);
  return null;
end $$;
revoke all on function privado.historial_precio_producto_tg() from public;

drop trigger if exists historial_precio on public.productos;
create trigger historial_precio after update of precio on public.productos
  for each row when (old.precio is distinct from new.precio) execute function privado.historial_precio_producto_tg();

-- ── La línea de tiempo ──────────────────────────────────────────────
create or replace function public.linea_de_control(
  p_gimnasio_id uuid, p_desde date, p_hasta date, p_tipos text[] default null, p_quien uuid default null,
  p_limite int default 50, p_cursor text default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  validos constant text[] := array['cobro', 'anulacion', 'descuento', 'otro_dia', 'dejado_pasar', 'caja', 'precio',
                                   'configuracion', 'entrada_anulada', 'invitado', 'prestamo'];
  tipos text[] := validos; zona text; ini timestamptz; fin timestamptz; lim int := coalesce(p_limite, 50);
  c_en timestamptz; c_clave text; filas jsonb; siguiente text; cuantas int;
begin
  perform privado.exigir_resultado(p_gimnasio_id);
  if p_desde is null or p_hasta is null then raise exception 'Elegí desde y hasta qué día.' using errcode = '22023'; end if;
  if p_hasta < p_desde then raise exception 'El "hasta" no puede ser antes del "desde".' using errcode = '22023'; end if;
  if p_hasta - p_desde > 366 then raise exception 'Se mira hasta un año por vez.' using errcode = '22023'; end if;
  if lim < 1 or lim > 200 then raise exception 'Se piden de 1 a 200 por vez.' using errcode = '22023'; end if;
  if p_tipos is not null and cardinality(p_tipos) > 0 then
    if exists (select 1 from unnest(p_tipos) t where t <> all (validos)) then raise exception 'Ese tipo de movimiento no existe.' using errcode = '22023'; end if;
    tipos := p_tipos;
  end if;
  if p_cursor is not null then
    if strpos(p_cursor, '|') = 0 then raise exception 'El cursor no es válido.' using errcode = '22023'; end if;
    begin
      c_en := split_part(p_cursor, '|', 1)::timestamptz;
    exception when others then
      raise exception 'El cursor no es válido.' using errcode = '22023';
    end;
    c_clave := substr(p_cursor, strpos(p_cursor, '|') + 1);
  end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  ini := privado.medianoche(p_desde, zona);
  fin := privado.medianoche(p_hasta + 1, zona);

  select coalesce(jsonb_agg(jsonb_build_object(
           'tipo', u.tipo, 'clave', u.clave, 'en', u.en, 'quien_id', u.quien_id, 'quien', q.nombre,
           'monto', u.monto, 'socio_id', u.socio_id, 'socio', nullif(trim(s.nombre || ' ' || s.apellido), ''),
           'detalle', u.detalle, 'extra', coalesce(u.extra, '{}'::jsonb)) order by u.en desc, u.clave desc), '[]'::jsonb)
    into filas
    from (
      select * from (
        -- Cobros (los anulados siguen estando: anular es un hecho nuevo)
        (select 'cobro'::text as tipo, v.confirmada_en as en, ('cobro:' || v.id::text) as clave, v.creado_por as quien_id,
                (select coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0) from public.venta_items i where i.venta_id = v.id)::numeric as monto,
                v.socio_id as socio_id,
                (select string_agg(i.descripcion, ', ' order by i.descripcion) from public.venta_items i where i.venta_id = v.id)::text as detalle,
                jsonb_build_object('venta_id', v.id, 'anulada', v.estado = 'anulada',
                                   'medios', (select string_agg(distinct p.medio, ', ') from public.pagos p where p.venta_id = v.id)) as extra
           from public.ventas v
          where 'cobro' = any (tipos) and v.gimnasio_id = p_gimnasio_id and v.estado in ('confirmada', 'anulada')
            and v.confirmada_en >= ini and v.confirmada_en < fin
            and (p_quien is null or v.creado_por = p_quien)
            and (c_en is null or (v.confirmada_en, 'cobro:' || v.id::text) < (c_en, c_clave))
          order by v.confirmada_en desc, ('cobro:' || v.id::text) desc limit lim + 1)
        union all
        -- Anulaciones, con quién la pidió y quién la aprobó
        (select 'anulacion'::text, v.anulada_en, 'anulacion:' || v.id::text, v.anulada_por,
                (select coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0) from public.venta_items i where i.venta_id = v.id)::numeric,
                v.socio_id, v.anulada_motivo::text,
                jsonb_build_object('venta_id', v.id, 'pidio', pa.pidio, 'aprobo', pa.aprobo)
           from public.ventas v
           left join lateral (select qp.nombre as pidio, qa.nombre as aprobo
                                from public.pedidos_anulacion x
                                left join public.equipo qp on qp.id = x.pedido_por
                                left join public.equipo qa on qa.id = x.resuelto_por
                               where x.venta_id = v.id and x.estado = 'aprobado'
                               order by x.resuelto_en desc limit 1) pa on true
          where 'anulacion' = any (tipos) and v.gimnasio_id = p_gimnasio_id
            and v.anulada_en >= ini and v.anulada_en < fin
            and (p_quien is null or v.anulada_por = p_quien)
            and (c_en is null or (v.anulada_en, 'anulacion:' || v.id::text) < (c_en, c_clave))
          order by v.anulada_en desc, ('anulacion:' || v.id::text) desc limit lim + 1)
        union all
        -- Descuentos (cada línea con descuento)
        (select 'descuento'::text, v.confirmada_en, 'descuento:' || i.id::text, v.creado_por,
                i.descuento::numeric, v.socio_id,
                (i.descripcion || ': ' || coalesce(i.descuento_motivo, 'sin motivo'))::text,
                jsonb_build_object('venta_id', v.id, 'anulada', v.estado = 'anulada',
                                   'porcentaje', round(i.descuento * 100 / nullif(i.cantidad * i.precio_unitario, 0)))
           from public.venta_items i join public.ventas v on v.id = i.venta_id
          where 'descuento' = any (tipos) and v.gimnasio_id = p_gimnasio_id and i.gimnasio_id = p_gimnasio_id
            and i.descuento > 0 and v.estado in ('confirmada', 'anulada')
            and v.confirmada_en >= ini and v.confirmada_en < fin
            and (p_quien is null or v.creado_por = p_quien)
            and (c_en is null or (v.confirmada_en, 'descuento:' || i.id::text) < (c_en, c_clave))
          order by v.confirmada_en desc, ('descuento:' || i.id::text) desc limit lim + 1)
        union all
        -- "Cobré otro día": cuándo se cargó de verdad, y de qué fecha es el cobro
        (select 'otro_dia'::text, v.registrada_en, 'otro_dia:' || v.id::text, v.creado_por,
                (select coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0) from public.venta_items i where i.venta_id = v.id)::numeric,
                v.socio_id, v.otro_dia_motivo::text,
                jsonb_build_object('venta_id', v.id, 'cobrado_el', v.confirmada_en, 'anulada', v.estado = 'anulada')
           from public.ventas v
          where 'otro_dia' = any (tipos) and v.gimnasio_id = p_gimnasio_id and v.otro_dia_motivo is not null
            and v.registrada_en >= ini and v.registrada_en < fin
            and (p_quien is null or v.creado_por = p_quien)
            and (c_en is null or (v.registrada_en, 'otro_dia:' || v.id::text) < (c_en, c_clave))
          order by v.registrada_en desc, ('otro_dia:' || v.id::text) desc limit lim + 1)
        union all
        -- Dejados pasar (con la promesa de pago, si la hubo)
        (select 'dejado_pasar'::text, i.momento, 'dejado:' || i.id::text, i.registrado_por,
                null::numeric, i.socio_id, coalesce(i.forzado_motivo, 'sin motivo')::text,
                jsonb_build_object('ingreso_id', i.id, 'promete_el', pp.promete_el, 'modo', pp.modo, 'anulado', i.anulado_en is not null)
           from public.ingresos i
           left join public.promesas_pago pp on pp.gimnasio_id = i.gimnasio_id and pp.ingreso_id = i.id
          where 'dejado_pasar' = any (tipos) and i.gimnasio_id = p_gimnasio_id and i.resultado = 'forzado'
            and i.momento >= ini and i.momento < fin
            and (p_quien is null or i.registrado_por = p_quien)
            and (c_en is null or (i.momento, 'dejado:' || i.id::text) < (c_en, c_clave))
          order by i.momento desc, ('dejado:' || i.id::text) desc limit lim + 1)
        union all
        -- Cajas: abrió
        (select 'caja'::text, t.abierto_en, 'caja_abre:' || t.id::text, t.abierto_por,
                t.monto_inicial::numeric, null::uuid, c.nombre::text,
                jsonb_build_object('evento', 'abrio', 'turno_id', t.id)
           from public.turnos_caja t join public.cajas c on c.id = t.caja_id
          where 'caja' = any (tipos) and t.gimnasio_id = p_gimnasio_id
            and t.abierto_en >= ini and t.abierto_en < fin
            and (p_quien is null or t.abierto_por = p_quien)
            and (c_en is null or (t.abierto_en, 'caja_abre:' || t.id::text) < (c_en, c_clave))
          order by t.abierto_en desc, ('caja_abre:' || t.id::text) desc limit lim + 1)
        union all
        -- Cajas: cerró contando (el monto es la diferencia: contado menos esperado)
        (select 'caja'::text, t.cerrado_en, 'caja_cierra:' || t.id::text, t.cerrado_por,
                (t.monto_contado - t.monto_esperado)::numeric, null::uuid, (c.nombre || coalesce(': ' || t.nota, ''))::text,
                jsonb_build_object('evento', 'cerro', 'turno_id', t.id, 'contado', t.monto_contado, 'esperado', t.monto_esperado)
           from public.turnos_caja t join public.cajas c on c.id = t.caja_id
          where 'caja' = any (tipos) and t.gimnasio_id = p_gimnasio_id and t.cerrado_en is not null and not t.sin_contar
            and t.cerrado_en >= ini and t.cerrado_en < fin
            and (p_quien is null or t.cerrado_por = p_quien)
            and (c_en is null or (t.cerrado_en, 'caja_cierra:' || t.id::text) < (c_en, c_clave))
          order by t.cerrado_en desc, ('caja_cierra:' || t.id::text) desc limit lim + 1)
        union all
        -- Cajas: quedó sin contar (nadie es responsable del conteo hasta que alguien la cuenta)
        (select 'caja'::text, t.sin_contar_en, 'caja_sin_contar:' || t.id::text, null::uuid,
                null::numeric, null::uuid, c.nombre::text,
                jsonb_build_object('evento', 'sin_contar', 'turno_id', t.id, 'esperado', t.monto_esperado, 'contado', t.monto_contado,
                                   'revisada', t.revisado_en is not null, 'nota', t.revisado_nota)
           from public.turnos_caja t join public.cajas c on c.id = t.caja_id
          where 'caja' = any (tipos) and t.gimnasio_id = p_gimnasio_id and p_quien is null and t.sin_contar
            and t.sin_contar_en >= ini and t.sin_contar_en < fin
            and (c_en is null or (t.sin_contar_en, 'caja_sin_contar:' || t.id::text) < (c_en, c_clave))
          order by t.sin_contar_en desc, ('caja_sin_contar:' || t.id::text) desc limit lim + 1)
        union all
        -- Precios de planes (cada precio nuevo es una fila nueva: nada se pisa)
        (select 'precio'::text, pp.creado_en, 'precio:' || pp.id::text, e.id,
                pp.monto::numeric, null::uuid, p.nombre::text,
                jsonb_build_object('que', 'plan', 'vigente_desde', pp.vigente_desde, 'medio', pp.medio_pago)
           from public.precios_plan pp
           join public.planes p on p.id = pp.plan_id
           left join public.equipo e on e.gimnasio_id = pp.gimnasio_id and e.usuario_id = pp.creado_por
          where 'precio' = any (tipos) and pp.gimnasio_id = p_gimnasio_id
            and pp.creado_en >= ini and pp.creado_en < fin
            and (p_quien is null or e.id = p_quien)
            and (c_en is null or (pp.creado_en, 'precio:' || pp.id::text) < (c_en, c_clave))
          order by pp.creado_en desc, ('precio:' || pp.id::text) desc limit lim + 1)
        union all
        -- Precios de productos (los anota el trigger en historial_configuracion)
        (select 'precio'::text, h.cambiado_en, 'precio_producto:' || h.id::text, h.equipo_id,
                case when jsonb_typeof(h.despues) = 'number' then (h.despues #>> '{}')::numeric end,
                null::uuid, regexp_replace(h.campo, '^producto\.(.*)\.precio$', '\1')::text,
                jsonb_build_object('que', 'producto', 'antes', h.antes)
           from public.historial_configuracion h
          where 'precio' = any (tipos) and h.gimnasio_id = p_gimnasio_id and h.campo ~ '^producto\..*\.precio$'
            and h.cambiado_en >= ini and h.cambiado_en < fin
            and (p_quien is null or h.equipo_id = p_quien)
            and (c_en is null or (h.cambiado_en, 'precio_producto:' || h.id::text) < (c_en, c_clave))
          order by h.cambiado_en desc, ('precio_producto:' || h.id::text) desc limit lim + 1)
        union all
        -- Cambios de configuración
        (select 'configuracion'::text, h.cambiado_en, 'config:' || h.id::text, h.equipo_id,
                null::numeric, null::uuid, h.campo::text,
                jsonb_build_object('antes', h.antes, 'despues', h.despues)
           from public.historial_configuracion h
          where 'configuracion' = any (tipos) and h.gimnasio_id = p_gimnasio_id and h.campo !~ '^producto\..*\.precio$'
            and h.cambiado_en >= ini and h.cambiado_en < fin
            and (p_quien is null or h.equipo_id = p_quien)
            and (c_en is null or (h.cambiado_en, 'config:' || h.id::text) < (c_en, c_clave))
          order by h.cambiado_en desc, ('config:' || h.id::text) desc limit lim + 1)
        union all
        -- Entradas anuladas
        (select 'entrada_anulada'::text, i.anulado_en, 'entrada_anulada:' || i.id::text, i.anulado_por,
                null::numeric, i.socio_id, i.anulado_motivo::text,
                jsonb_build_object('ingreso_id', i.id, 'momento', i.momento, 'resultado', i.resultado)
           from public.ingresos i
          where 'entrada_anulada' = any (tipos) and i.gimnasio_id = p_gimnasio_id and i.anulado_en is not null
            and i.anulado_en >= ini and i.anulado_en < fin
            and (p_quien is null or i.anulado_por = p_quien)
            and (c_en is null or (i.anulado_en, 'entrada_anulada:' || i.id::text) < (c_en, c_clave))
          order by i.anulado_en desc, ('entrada_anulada:' || i.id::text) desc limit lim + 1)
        union all
        -- Invitados (quién invitó; lo cargó el equipo o el propio socio desde la app)
        (select 'invitado'::text, iv.creado_en, 'invitado:' || iv.id::text, e.id,
                null::numeric, iv.socio_id, iv.nombre::text,
                jsonb_build_object('invitado_id', iv.id, 'para_el_dia', iv.para_el_dia, 'desde_la_app', iv.desde_la_app,
                                   'entro', iv.entro_en is not null, 'anulado', iv.anulado_en is not null)
           from public.invitados iv
           left join public.equipo e on e.gimnasio_id = iv.gimnasio_id and e.usuario_id = iv.creado_por
          where 'invitado' = any (tipos) and iv.gimnasio_id = p_gimnasio_id
            and iv.creado_en >= ini and iv.creado_en < fin
            and (p_quien is null or e.id = p_quien)
            and (c_en is null or (iv.creado_en, 'invitado:' || iv.id::text) < (c_en, c_clave))
          order by iv.creado_en desc, ('invitado:' || iv.id::text) desc limit lim + 1)
        union all
        -- Anti-préstamo: volvió a entrar por otra vía en pocos minutos
        (select 'prestamo'::text, a.momento, 'prestamo:' || a.id::text, null::uuid,
                null::numeric, a.socio_id, ('Volvió a entrar a los ' || a.minutos || ' min por otra vía')::text,
                jsonb_build_object('alerta_id', a.id, 'minutos', a.minutos, 'via_anterior', a.via_anterior, 'via_nueva', a.via_nueva)
           from public.alertas_prestamo a
          where 'prestamo' = any (tipos) and a.gimnasio_id = p_gimnasio_id and p_quien is null
            and a.momento >= ini and a.momento < fin
            and (c_en is null or (a.momento, 'prestamo:' || a.id::text) < (c_en, c_clave))
          order by a.momento desc, ('prestamo:' || a.id::text) desc limit lim + 1)
      ) b
      order by b.en desc, b.clave desc
      limit lim + 1
    ) u
    left join public.equipo q on q.id = u.quien_id
    left join public.socios s on s.id = u.socio_id;

  cuantas := jsonb_array_length(filas);
  if cuantas > lim then
    select jsonb_agg(f order by o) into filas from jsonb_array_elements(filas) with ordinality t(f, o) where o <= lim;
    siguiente := ((filas -> (lim - 1)) ->> 'en') || '|' || ((filas -> (lim - 1)) ->> 'clave');
  end if;
  return jsonb_build_object('items', filas, 'siguiente', siguiente);
end $$;

-- ── Los avisos nuevos para la campana del dueño ─────────────────────
create or replace function public.campana_control(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; items jsonb := '[]'::jsonb; zona text;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  perform privado.exigir_resultado(p_gimnasio_id);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;

  -- Un cobro cargado con una fecha que no es la de hoy (de otros, últimos 7 días).
  items := items || coalesce((select jsonb_agg(jsonb_build_object(
             'clave', 'otro_dia:' || v.id::text, 'emoji', '📅',
             'titulo', 'Cobro cargado con fecha del ' || to_char(v.confirmada_en at time zone zona, 'DD/MM') || ': ' || privado.formato_pesos(t.total),
             'detalle', concat_ws(' · ', q.nombre, v.otro_dia_motivo),
             'href', '/control?tipos=otro_dia', 'en', v.registrada_en))
           from public.ventas v
           left join public.equipo q on q.id = v.creado_por
           cross join lateral (select coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0) as total
                                 from public.venta_items i where i.venta_id = v.id) t
          where v.gimnasio_id = p_gimnasio_id and v.otro_dia_motivo is not null
            and v.registrada_en > now() - interval '7 days' and v.creado_por is distinct from e.id), '[]'::jsonb);

  -- Anti-préstamo: alguien que ya había entrado volvió por otra vía en pocos minutos.
  items := items || coalesce((select jsonb_agg(jsonb_build_object(
             'clave', 'prestamo:' || a.id::text, 'emoji', '🪪',
             'titulo', 'Posible préstamo de entrada: ' || trim(s.nombre || ' ' || s.apellido),
             'detalle', 'Volvió a entrar a los ' || a.minutos || ' min por otra vía',
             'href', '/control?tipos=prestamo', 'en', a.momento))
           from public.alertas_prestamo a join public.socios s on s.id = a.socio_id
          where a.gimnasio_id = p_gimnasio_id and a.momento > now() - interval '7 days'), '[]'::jsonb);

  return privado.con_leidos(p_gimnasio_id, items);
end $$;

revoke all on function public.linea_de_control(uuid, date, date, text[], uuid, int, text), public.campana_control(uuid) from public, anon, authenticated;
grant execute on function public.linea_de_control(uuid, date, date, text[], uuid, int, text), public.campana_control(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text; faltan text;
begin
  foreach f in array array['public.linea_de_control(uuid, date, date, text[], uuid, int, text)', 'public.campana_control(uuid)',
                           'privado.historial_precio_producto_tg()'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if not ('control' = any (privado.secciones_validas())) then raise exception 'Verificación: la sección control no se puede apagar'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'historial_precio' and tgrelid = 'public.productos'::regclass) then
    raise exception 'Verificación: falta el trigger del precio de productos';
  end if;
  select string_agg(n, ', ') into faltan
    from unnest(array['ventas_control_confirmada', 'ventas_control_anulada', 'ventas_control_otro_dia', 'turnos_caja_control_abierto',
                      'turnos_caja_control_cerrado', 'turnos_caja_control_sin_contar', 'ingresos_control_anulado', 'ingresos_control_forzado',
                      'precios_plan_control', 'invitados_control']) n
   where not exists (select 1 from pg_index i join pg_class c on c.oid = i.indexrelid
                      where c.relname = n and c.relnamespace = 'public'::regnamespace and i.indisvalid);
  if faltan is not null then raise exception 'Verificación: faltan índices (%)', faltan; end if;
end $$;
