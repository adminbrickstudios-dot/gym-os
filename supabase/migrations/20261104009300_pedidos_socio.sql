-- 0093 · Pedir pausa o baja desde la app (APP-8).
-- El socio pide una pausa (va a los pedidos de pausa que ya existían: los
-- aprueban el dueño o el encargado) o pide la baja con el motivo. Los dos
-- aparecen en la campana del dueño y del encargado y se resuelven en la ficha.
-- Pedir la baja no da de baja: la da el gimnasio (y puede ofrecer una pausa).
--   pedir_pausa_socio(socio, desde, hasta, categoria, nota)
--   pedir_baja_socio(socio, motivo, nota)
--   pedido_baja_socio(socio)          el pendiente (para la ficha y la app)
--   resolver_pedido_baja(pedido, dar_de_baja)   dueño, encargado o recepción
-- Copia: campana (0074) con los pedidos de baja.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.mi_historial(uuid)') is null then raise exception 'Guarda: falta la migración 0092'; end if;
  if to_regprocedure('privado.validar_pausa(uuid, uuid, date, date, text)') is null then raise exception 'Guarda: falta privado.validar_pausa'; end if;
end $$;

create table if not exists public.pedidos_baja (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  socio_id     uuid not null,
  motivo       text not null check (motivo in ('precio', 'horario', 'mudanza', 'otro_gimnasio', 'sin_tiempo', 'insatisfecho', 'otro')),
  nota         text check (nota is null or length(nota) <= 300),
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'dado_de_baja', 'se_queda')),
  pedido_en    timestamptz not null default now(),
  pedido_por   uuid not null references auth.users(id),
  resuelto_en  timestamptz,
  resuelto_por uuid,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, resuelto_por) references public.equipo (gimnasio_id, id),
  check ((estado = 'pendiente') = (resuelto_en is null))
);
create unique index if not exists pedidos_baja_uno_pendiente on public.pedidos_baja (gimnasio_id, socio_id) where estado = 'pendiente';
select privado.politicas_estandar('public.pedidos_baja', array['dueno', 'encargado', 'recepcion'], null, true);
revoke all on table public.pedidos_baja from anon;
revoke truncate, references, trigger on public.pedidos_baja from authenticated;

create or replace function public.pedir_pausa_socio(p_socio_id uuid, p_desde date, p_hasta date, p_categoria text, p_nota text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare s public.suscripciones; zona text; d timestamptz; h timestamptz; pid uuid; v_nota text := nullif(trim(coalesce(p_nota, '')), '');
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.suscripciones where socio_id = p_socio_id and baja_en is null;
  if not found then raise exception 'No tenés una membresía activa para pausar' using errcode = '22023'; end if;
  perform privado.validar_pausa(s.socio_id, s.gimnasio_id, p_desde, p_hasta, p_categoria);
  if length(v_nota) > 300 then raise exception 'La nota: hasta 300 letras.' using errcode = '22023'; end if;
  select zona_horaria into zona from public.gimnasios where id = s.gimnasio_id;
  if p_desde < privado.dia_local(now(), zona) then raise exception 'La pausa empieza hoy o más adelante.' using errcode = '22023'; end if;
  d := privado.medianoche(p_desde, zona); h := privado.medianoche(p_hasta, zona);
  if exists (select 1 from public.congelamientos c where c.suscripcion_id = s.id and c.anulado_en is null
              and c.desde < h and coalesce(c.hasta_real, c.hasta_prevista) > d) then
    raise exception 'Ya tenés una pausa en esas fechas.' using errcode = '22023';
  end if;
  if exists (select 1 from public.pedidos_pausa x where x.socio_id = s.socio_id and x.estado = 'pendiente' and x.desde < h and x.hasta > d) then
    raise exception 'Ya pediste una pausa en esas fechas: la está por ver el gimnasio.' using errcode = '22023';
  end if;
  insert into public.pedidos_pausa (gimnasio_id, socio_id, suscripcion_id, desde, hasta, categoria, nota, pedido_por)
  values (s.gimnasio_id, s.socio_id, s.id, d, h, p_categoria, v_nota, auth.uid()) returning id into pid;
  return pid;
end $$;

create or replace function public.pedir_baja_socio(p_socio_id uuid, p_motivo text, p_nota text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare so public.socios; pid uuid; v_nota text := nullif(trim(coalesce(p_nota, '')), '');
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into so from public.socios where id = p_socio_id;
  if so.dado_de_baja_en is not null then raise exception 'Ya estás dado de baja' using errcode = '22023'; end if;
  if p_motivo is null or p_motivo not in ('precio', 'horario', 'mudanza', 'otro_gimnasio', 'sin_tiempo', 'insatisfecho', 'otro') then
    raise exception 'Contanos por qué te vas' using errcode = '22023';
  end if;
  if length(v_nota) > 300 then raise exception 'La nota: hasta 300 letras.' using errcode = '22023'; end if;
  if exists (select 1 from public.pedidos_baja where socio_id = so.id and estado = 'pendiente') then
    raise exception 'Ya pediste la baja: el gimnasio te va a contactar.' using errcode = '22023';
  end if;
  insert into public.pedidos_baja (gimnasio_id, socio_id, motivo, nota, pedido_por) values (so.gimnasio_id, so.id, p_motivo, v_nota, auth.uid()) returning id into pid;
  return pid;
end $$;

create or replace function public.pedido_baja_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_socio_id not in (select privado.mis_socios()) then perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']); end if;
  return (select jsonb_build_object('pedido_id', p.id, 'motivo', p.motivo, 'nota', p.nota, 'pedido_en', p.pedido_en)
            from public.pedidos_baja p where p.socio_id = p_socio_id and p.estado = 'pendiente');
end $$;

-- Dar de baja (con el motivo que dio) o "se queda" (se habló y sigue).
create or replace function public.resolver_pedido_baja(p_pedido_id uuid, p_dar_de_baja boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.pedidos_baja; eid uuid; n int;
begin
  select * into p from public.pedidos_baja where id = p_pedido_id for update;
  if not found then raise exception 'Sin permiso o pedido inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(p.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if p.estado <> 'pendiente' then raise exception 'Ese pedido ya se resolvió' using errcode = '22023'; end if;
  if p_dar_de_baja then perform public.dar_de_baja(p.socio_id, p.motivo); end if;
  update public.pedidos_baja set estado = case when p_dar_de_baja then 'dado_de_baja' else 'se_queda' end, resuelto_en = now(), resuelto_por = eid
   where id = p.id and estado = 'pendiente';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo resolver el pedido'; end if;
end $$;

revoke all on function public.pedir_pausa_socio(uuid, date, date, text, text), public.pedir_baja_socio(uuid, text, text), public.pedido_baja_socio(uuid),
  public.resolver_pedido_baja(uuid, boolean) from public, anon, authenticated;
grant execute on function public.pedir_pausa_socio(uuid, date, date, text, text), public.pedir_baja_socio(uuid, text, text), public.pedido_baja_socio(uuid),
  public.resolver_pedido_baja(uuid, boolean) to authenticated, service_role;

-- ── Campana: copia de 0074 con los pedidos de baja ──
create or replace function public.campana(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; items jsonb := '[]'::jsonb; zona text; hoy date; dia date; lunes date;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;

  if e.rol in ('dueno', 'encargado', 'recepcion') then
    -- Comprobantes para revisar (los de su sede, si tiene una).
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'pago:' || p.pago_id, 'emoji', '🏦',
               'titulo', coalesce(p.socio, 'Un socio') || ' mandó un comprobante', 'detalle', privado.formato_pesos(p.monto) || ' · ' || coalesce(p.descripcion, ''),
               'href', '/transferencias', 'en', p.informado_en))
             from public.pagos_por_aprobar(p_gimnasio_id) p), '[]'::jsonb);
    -- Cajas que quedaron abiertas (a la recepción, las suyas).
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'caja_abierta:' || (c ->> 'turno_id'), 'emoji', '🔓',
               'titulo', 'Quedó abierta la ' || (c ->> 'caja'), 'detalle', 'La abrió ' || (c ->> 'abierto_por'),
               'href', '/caja', 'en', c ->> 'abierto_en'))
             from jsonb_array_elements(public.cajas_olvidadas(p_gimnasio_id)) c), '[]'::jsonb);
  end if;

  if e.rol in ('dueno', 'encargado') then
    -- Lo que pasó con la plata (de otros), últimos 7 días.
    items := items || coalesce((select jsonb_agg(jsonb_build_object(
               'clave', 'caja:' || (a ->> 'tipo') || ':' || coalesce(a ->> 'movimiento_id', a ->> 'en'),
               'emoji', case a ->> 'tipo' when 'diferencia' then '⚖️' when 'retiro' then '💸' when 'anulacion' then '↩️' else '🏷️' end,
               'titulo', case a ->> 'tipo'
                 when 'diferencia' then 'La ' || coalesce(a ->> 'caja', 'caja') || ' cerró con ' || privado.formato_pesos(abs((a ->> 'monto')::numeric)) || case when (a ->> 'monto')::numeric > 0 then ' de más' else ' de menos' end
                 when 'retiro' then 'Salieron ' || privado.formato_pesos((a ->> 'monto')::numeric) || ' de la caja'
                 when 'anulacion' then 'Se anuló una venta de ' || privado.formato_pesos((a ->> 'monto')::numeric)
                 else 'Descuento de ' || privado.formato_pesos((a ->> 'monto')::numeric) end,
               'detalle', concat_ws(' · ', a ->> 'por', a ->> 'texto'),
               'href', case when a ->> 'tipo' in ('diferencia', 'retiro') then '/caja/historial' when a ->> 'socio_id' is not null then '/socios/' || (a ->> 'socio_id') else '/caja/historial' end,
               'en', a ->> 'en'))
             from jsonb_array_elements(public.alertas_caja(p_gimnasio_id, 7)) a), '[]'::jsonb);
    -- AVI-6: el resumen del día (desde las 22 h el de hoy; antes, el de ayer) y, desde el lunes, el de la semana pasada.
    hoy := privado.dia_local(now(), zona);
    dia := case when extract(hour from now() at time zone zona) >= 22 then hoy else hoy - 1 end;
    lunes := hoy - (extract(isodow from hoy)::int - 1);
    items := items || jsonb_build_array(
      jsonb_build_object('clave', 'resumen:' || dia, 'emoji', '📊', 'titulo', 'Resumen ' || case when dia = hoy then 'de hoy' else 'de ayer' end,
        'detalle', 'Plata, caja, entradas, altas y bajas', 'href', '/resumen?dia=' || dia,
        'en', case when dia = hoy then privado.medianoche(hoy, zona) + interval '22 hours' else privado.medianoche(hoy, zona) end),
      jsonb_build_object('clave', 'resumen_semana:' || (lunes - 7), 'emoji', '📅', 'titulo', 'Resumen de la semana pasada',
        'detalle', 'Del ' || to_char(lunes - 7, 'DD/MM') || ' al ' || to_char(lunes - 1, 'DD/MM') || ', comparada con la anterior',
        'href', '/resumen?semana=' || (lunes - 7), 'en', privado.medianoche(lunes, zona)));
    -- La recepción pide anular una venta.
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'pedido_anulacion:' || pa.id, 'emoji', '🧾',
               'titulo', q.nombre || ' pide anular una venta', 'detalle', pa.motivo, 'href', '/', 'en', pa.pedido_en))
             from public.pedidos_anulacion pa join public.equipo q on q.id = pa.pedido_por
            where pa.gimnasio_id = p_gimnasio_id and pa.estado = 'pendiente'), '[]'::jsonb);
    -- APP-8: socios que pidieron la baja desde la app.
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'pedido_baja:' || x.id, 'emoji', '👋',
               'titulo', trim(s.nombre || ' ' || s.apellido) || ' pidió la baja', 'detalle', coalesce(x.nota, 'Desde la app'),
               'href', '/socios/' || s.id, 'en', x.pedido_en))
             from public.pedidos_baja x join public.socios s on s.id = x.socio_id
            where x.gimnasio_id = p_gimnasio_id and x.estado = 'pendiente'), '[]'::jsonb);
    -- Pausas que esperan.
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'pedido_pausa:' || x.id, 'emoji', '⏸️',
               'titulo', 'Pausa para aprobar: ' || trim(s.nombre || ' ' || s.apellido),
               'detalle', 'Del ' || to_char(x.desde at time zone zona, 'DD/MM') || ' al ' || to_char(x.hasta at time zone zona, 'DD/MM'),
               'href', '/', 'en', x.pedido_en))
             from public.pedidos_pausa x join public.socios s on s.id = x.socio_id
            where x.gimnasio_id = p_gimnasio_id and x.estado = 'pendiente'), '[]'::jsonb);
    -- Los que entraron sin poder, hoy.
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'dejado:' || (d ->> 'ingreso_id'), 'emoji', '🚪',
               'titulo', coalesce(d ->> 'por', 'Alguien') || ' dejó pasar a ' || (d ->> 'socio'), 'detalle', d ->> 'motivo',
               'href', '/entrada/control', 'en', d ->> 'momento'))
             from jsonb_array_elements(public.dejados_pasar(p_gimnasio_id, null)) d), '[]'::jsonb);
    -- Productos para reponer (la clave cambia con el stock: si baja más, vuelve a avisar).
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'stock:' || p.id || ':' || st.n, 'emoji', '📦',
               'titulo', case when st.n <= 0 then 'Se terminó: ' || p.nombre else 'Quedan ' || st.n || ' de ' || p.nombre end,
               'detalle', 'Para reponer', 'href', '/planes', 'en', null))
             from public.productos p cross join lateral (select privado.stock_producto(p.id) as n) st
            where p.gimnasio_id = p_gimnasio_id and p.activo and p.controla_stock and st.n <= coalesce(p.stock_minimo, 0)), '[]'::jsonb);
  end if;

  if e.rol = 'recepcion' then
    -- Lo que pidió anular, ya resuelto.
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'anulacion_resuelta:' || pa.id,
               'emoji', case pa.estado when 'aprobado' then '✅' else '❌' end,
               'titulo', case pa.estado when 'aprobado' then 'Anularon la venta que pediste' else 'No anularon la venta que pediste' end,
               'detalle', concat_ws(' · ', q.nombre, pa.respuesta), 'href', '/vender', 'en', pa.resuelto_en))
             from public.pedidos_anulacion pa left join public.equipo q on q.id = pa.resuelto_por
            where pa.gimnasio_id = p_gimnasio_id and pa.pedido_por = e.id and pa.estado <> 'pendiente' and pa.resuelto_en > now() - interval '3 days'), '[]'::jsonb);
  end if;

  if e.rol = 'profe' then
    -- Sus clases que se cancelaron (próximos días).
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'clase_cancelada:' || c.id, 'emoji', '❌',
               'titulo', 'Se canceló ' || a.nombre || ' del ' || to_char(c.inicio at time zone zona, 'DD/MM HH24:MI'),
               'detalle', c.cancelada_motivo, 'href', '/clases', 'en', c.cancelada_en))
             from public.clases c join public.actividades a on a.id = c.actividad_id
            where c.gimnasio_id = p_gimnasio_id and c.profe_id = e.id and c.cancelada_en is not null and c.inicio > now()), '[]'::jsonb);
  end if;

  return privado.con_leidos(p_gimnasio_id, items);
end $$;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.pedidos_baja'::regclass) then raise exception 'Verificación: pedidos_baja sin RLS'; end if;
  foreach f in array array['public.pedir_pausa_socio(uuid, date, date, text, text)', 'public.pedir_baja_socio(uuid, text, text)',
                           'public.pedido_baja_socio(uuid)', 'public.resolver_pedido_baja(uuid, boolean)', 'public.campana(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if position('pedido_baja:' in pg_get_functiondef('public.campana(uuid)'::regprocedure)) = 0 then raise exception 'Verificación: la campana no tiene los pedidos de baja'; end if;
end $$;
