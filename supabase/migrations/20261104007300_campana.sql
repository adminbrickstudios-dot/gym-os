-- 0073 · Campana de avisos (AVI-5).
-- Lo que pasó y le toca ver a cada uno, con el link a lo que hay que hacer.
-- Los avisos NO se guardan: se calculan al pedirlos de los hechos que ya
-- existen (comprobantes, cajas, pedidos, clases). Lo único que se guarda es
-- qué vio cada usuario (avisos_leidos), para separar lo nuevo de lo visto.
--
--   campana(gimnasio)              el equipo, según su rol
--   campana_socio(gimnasio, socio) el socio, en su app
--   leer_campana(gimnasio, claves) marca vistos (de quien llama)
--
-- Cada aviso: { clave, emoji, titulo, detalle, href, en, leido }. La clave es
-- estable (el id del hecho): el mismo aviso no vuelve a contar como nuevo.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.bandeja_avisos(uuid)') is null then raise exception 'Guarda: falta la migración 0072'; end if;
  if to_regprocedure('public.alertas_caja(uuid, int)') is null then raise exception 'Guarda: falta la migración 0069'; end if;
  if to_regprocedure('public.cajas_olvidadas(uuid)') is null then raise exception 'Guarda: falta la migración 0070'; end if;
end $$;

create table if not exists public.avisos_leidos (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  usuario_id   uuid not null references auth.users(id) on delete cascade,
  clave        text not null check (length(clave) between 1 and 160),
  leido_en     timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, usuario_id, clave)
);
alter table public.avisos_leidos enable row level security;
drop policy if exists propios_lee on public.avisos_leidos;
create policy propios_lee on public.avisos_leidos for select to authenticated using (usuario_id = auth.uid());
revoke all on table public.avisos_leidos from anon;

-- Lo leído de quien llama, sobre una lista de avisos.
create or replace function privado.con_leidos(p_gimnasio_id uuid, p_items jsonb) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(i || jsonb_build_object('leido', l.id is not null) order by (i ->> 'en')::timestamptz desc nulls last), '[]'::jsonb),
    'sin_leer', count(*) filter (where l.id is null))
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
    left join public.avisos_leidos l on l.gimnasio_id = p_gimnasio_id and l.usuario_id = auth.uid() and l.clave = i ->> 'clave'
$$;
revoke all on function privado.con_leidos(uuid, jsonb) from public;

create or replace function public.campana(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; items jsonb := '[]'::jsonb; zona text;
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
    -- La recepción pide anular una venta.
    items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'pedido_anulacion:' || pa.id, 'emoji', '🧾',
               'titulo', q.nombre || ' pide anular una venta', 'detalle', pa.motivo, 'href', '/', 'en', pa.pedido_en))
             from public.pedidos_anulacion pa join public.equipo q on q.id = pa.pedido_por
            where pa.gimnasio_id = p_gimnasio_id and pa.estado = 'pendiente'), '[]'::jsonb);
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

create or replace function public.campana_socio(p_gimnasio_id uuid, p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios; v public.veredicto_acceso; items jsonb := '[]'::jsonb; zona text;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  select * into s from public.socios where id = p_socio_id and gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and dado_de_baja_en is null;
  if not found then raise exception 'Sin permiso para ver ese socio' using errcode = '42501'; end if;
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;

  -- Si hoy no está al día: lo mismo que dice la entrada (una sola cuenta).
  v := privado.calcular_acceso(s.id, now(), null);
  if v.color in ('amarillo', 'naranja', 'rojo') then
    items := items || jsonb_build_array(jsonb_build_object(
      'clave', 'acceso:' || v.color || ':' || coalesce(v.motivo, '') || ':' || privado.dia_local(now(), zona),
      'emoji', case v.color when 'rojo' then '⛔' else '⚠️' end, 'titulo', v.texto, 'detalle', null, 'href', '/app', 'en', null));
  end if;
  -- Comprobantes: rechazados (14 días) y aprobados (7 días).
  items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'pago:' || p.id || ':' || p.estado,
             'emoji', case p.estado when 'aprobado' then '✅' else '🧾' end,
             'titulo', case p.estado when 'aprobado' then 'Aprobaron tu pago de ' || privado.formato_pesos(p.monto) else 'No pudimos aprobar tu comprobante' end,
             'detalle', case p.estado when 'rechazado' then p.rechazado_motivo end,
             'href', '/app', 'en', coalesce(p.rechazado_en, p.aprobado_en)))
           from public.pagos p join public.ventas vt on vt.id = p.venta_id
          where vt.socio_id = s.id and p.comprobante_path is not null
            and ((p.estado = 'rechazado' and p.rechazado_en > now() - interval '14 days')
              or (p.estado = 'aprobado' and p.aprobado_en > now() - interval '7 days'))), '[]'::jsonb);
  -- Clases: canceladas y lugares que se liberaron (lista de espera).
  items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'clase_cancelada:' || c.id, 'emoji', '❌',
             'titulo', 'Se canceló ' || a.nombre || ' del ' || to_char(c.inicio at time zone zona, 'DD/MM HH24:MI'),
             'detalle', c.cancelada_motivo, 'href', '/app/clases', 'en', c.cancelada_en))
           from public.reservas r join public.clases c on c.id = r.clase_id join public.actividades a on a.id = c.actividad_id
          where r.socio_id = s.id and c.cancelada_en > now() - interval '7 days' and c.inicio > now() - interval '1 day'), '[]'::jsonb);
  items := items || coalesce((select jsonb_agg(jsonb_build_object('clave', 'promovida:' || r.id, 'emoji', '🎉',
             'titulo', 'Se liberó un lugar: estás en ' || a.nombre || ' del ' || to_char(c.inicio at time zone zona, 'DD/MM HH24:MI'),
             'detalle', null, 'href', '/app/clases', 'en', r.promovida_en))
           from public.reservas r join public.clases c on c.id = r.clase_id join public.actividades a on a.id = c.actividad_id
          where r.socio_id = s.id and r.promovida_en > now() - interval '3 days' and r.cancelada_en is null
            and c.cancelada_en is null and c.inicio > now()), '[]'::jsonb);

  return privado.con_leidos(p_gimnasio_id, items);
end $$;

-- Vistos. Solo quien es del gimnasio (equipo o socio); repetir no suma filas.
create or replace function public.leer_campana(p_gimnasio_id uuid, p_claves text[]) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  if not exists (select 1 from public.equipo where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and activo)
     and not exists (select 1 from public.socios where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and dado_de_baja_en is null) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if cardinality(coalesce(p_claves, '{}')) > 300 then raise exception 'Demasiados avisos de una vez' using errcode = '22023'; end if;
  insert into public.avisos_leidos (gimnasio_id, usuario_id, clave)
  select p_gimnasio_id, auth.uid(), c from unnest(p_claves) c where length(c) between 1 and 160
  on conflict (gimnasio_id, usuario_id, clave) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.campana(uuid), public.campana_socio(uuid, uuid), public.leer_campana(uuid, text[]) from public, anon, authenticated;
grant execute on function public.campana(uuid), public.campana_socio(uuid, uuid), public.leer_campana(uuid, text[]) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.avisos_leidos'::regclass) then raise exception 'Verificación: avisos_leidos sin RLS'; end if;
  foreach f in array array['public.campana(uuid)', 'public.campana_socio(uuid, uuid)', 'public.leer_campana(uuid, text[])', 'privado.con_leidos(uuid, jsonb)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
