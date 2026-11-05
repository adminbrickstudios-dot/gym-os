-- 0069 · Alertas de caja al dueño (CAJ-4).
-- Lo que el dueño quiere enterarse sin estar: una caja que cerró con
-- diferencia, plata que salió del cajón (con la foto del ticket, si la
-- sacaron), una venta anulada y un descuento más grande que el tope de la
-- recepción. No se guarda ninguna "alerta": se calculan de los hechos
-- (alertas_caja) y no se muestran las que hizo quien las mira.
-- La foto del ticket va al bucket privado "tickets_caja"; sube el servidor
-- con la clave de servicio, como la foto del socio (la base arma la ruta).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.historial_caja(uuid, int)') is null then raise exception 'Guarda: falta la migración 0068'; end if;
end $$;

alter table public.movimientos_caja add column if not exists ticket_path text;

-- Ruta nueva (no se adivina): <gimnasio>/<turno>/ticket-<32 hex>.<ext>. Solo quien
-- lo anotó, el dueño o el encargado; un movimiento con ticket no se cambia.
create or replace function public.preparar_ticket(p_movimiento_id uuid, p_ext text) returns text
language plpgsql security definer set search_path = '' as $$
declare m public.movimientos_caja; e public.equipo;
begin
  select * into m from public.movimientos_caja where id = p_movimiento_id;
  if not found then raise exception 'Sin permiso o movimiento inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(m.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if e.rol = 'recepcion' and m.creado_por <> e.id then raise exception 'El ticket lo sube quien anotó el retiro' using errcode = '42501'; end if;
  if m.ticket_path is not null then raise exception 'Ese retiro ya tiene su ticket' using errcode = '22023'; end if;
  if p_ext not in ('jpg', 'png', 'webp') then raise exception 'La foto tiene que ser JPG, PNG o WEBP' using errcode = '22023'; end if;
  return m.gimnasio_id::text || '/' || m.turno_caja_id::text || '/ticket-' || replace(gen_random_uuid()::text, '-', '') || '.' || p_ext;
end $$;

create or replace function public.confirmar_ticket(p_movimiento_id uuid, p_ruta text) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.movimientos_caja; e public.equipo; n int;
begin
  select * into m from public.movimientos_caja where id = p_movimiento_id for update;
  if not found then raise exception 'Sin permiso o movimiento inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(m.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if e.rol = 'recepcion' and m.creado_por <> e.id then raise exception 'El ticket lo sube quien anotó el retiro' using errcode = '42501'; end if;
  if p_ruta is null or p_ruta !~ ('^' || m.gimnasio_id::text || '/' || m.turno_caja_id::text || '/ticket-[0-9a-f]{32}\.(jpg|png|webp)$') then
    raise exception 'Ruta de ticket inválida';
  end if;
  update public.movimientos_caja set ticket_path = p_ruta where id = m.id and ticket_path is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese retiro ya tiene su ticket' using errcode = '22023'; end if;
end $$;

-- Para verlo: la ruta, solo al dueño y al encargado.
create or replace function public.ticket_movimiento(p_movimiento_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare m public.movimientos_caja;
begin
  select * into m from public.movimientos_caja where id = p_movimiento_id;
  if not found then raise exception 'Sin permiso o movimiento inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(m.gimnasio_id, array['dueno', 'encargado']);
  return m.ticket_path;
end $$;

-- Las alertas de los últimos días, de lo que hicieron otros.
create or replace function public.alertas_caja(p_gimnasio_id uuid, p_dias int default 7) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; desde timestamptz; tope numeric;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  desde := now() - make_interval(days => least(greatest(coalesce(p_dias, 7), 1), 60));
  select descuento_max_recepcion into tope from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  return coalesce((select jsonb_agg(x order by (x ->> 'en')::timestamptz desc) from (
    -- Caja que cerró con diferencia
    select jsonb_build_object('tipo', 'diferencia', 'en', t.cerrado_en, 'monto', t.monto_contado - t.monto_esperado, 'caja', c.nombre,
             'por', (select q.nombre from public.equipo q where q.id = t.cerrado_por), 'texto', t.nota) as x
      from public.turnos_caja t join public.cajas c on c.id = t.caja_id
     where t.gimnasio_id = p_gimnasio_id and t.cerrado_en >= desde and t.monto_contado <> t.monto_esperado and t.cerrado_por <> e.id
    union all
    -- Plata que salió del cajón
    select jsonb_build_object('tipo', 'retiro', 'en', m.creado_en, 'monto', m.monto, 'texto', m.motivo, 'movimiento_id', m.id,
             'ticket', m.ticket_path is not null, 'por', (select q.nombre from public.equipo q where q.id = m.creado_por))
      from public.movimientos_caja m
     where m.gimnasio_id = p_gimnasio_id and m.tipo = 'retiro' and m.creado_en >= desde and m.creado_por <> e.id
    union all
    -- Venta anulada
    select jsonb_build_object('tipo', 'anulacion', 'en', v.anulada_en, 'texto', v.anulada_motivo,
             'monto', (select coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0) from public.venta_items i where i.venta_id = v.id),
             'por', (select q.nombre from public.equipo q where q.id = v.anulada_por), 'socio_id', v.socio_id)
      from public.ventas v
     where v.gimnasio_id = p_gimnasio_id and v.estado = 'anulada' and v.anulada_en >= desde and v.anulada_por is distinct from e.id
    union all
    -- Descuento más grande que el tope de la recepción (sin contar convenios)
    select jsonb_build_object('tipo', 'descuento', 'en', v.creado_en, 'monto', i.descuento, 'texto', i.descripcion || ': ' || i.descuento_motivo,
             'porcentaje', round(i.descuento * 100 / nullif(i.cantidad * i.precio_unitario, 0)),
             'por', (select q.nombre from public.equipo q where q.id = v.creado_por), 'socio_id', v.socio_id)
      from public.venta_items i join public.ventas v on v.id = i.venta_id
     where v.gimnasio_id = p_gimnasio_id and v.creado_en >= desde and v.estado <> 'anulada' and v.creado_por <> e.id
       and i.descuento > 0 and coalesce(i.descuento_motivo, '') not like 'Convenio %'
       and i.descuento * 100 > coalesce(tope, 0) * i.cantidad * i.precio_unitario
  ) y), '[]'::jsonb);
end $$;

revoke all on function public.preparar_ticket(uuid, text), public.confirmar_ticket(uuid, text), public.ticket_movimiento(uuid), public.alertas_caja(uuid, int)
  from public, anon, authenticated;
grant execute on function public.preparar_ticket(uuid, text), public.confirmar_ticket(uuid, text), public.ticket_movimiento(uuid), public.alertas_caja(uuid, int)
  to authenticated, service_role;

-- Bucket privado (en Supabase; la base local no tiene storage).
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Sin esquema storage (base local): se saltea el bucket tickets_caja';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('tickets_caja', 'tickets_caja', false, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;
end $$;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text; publico boolean;
begin
  foreach f in array array['public.preparar_ticket(uuid, text)', 'public.confirmar_ticket(uuid, text)', 'public.ticket_movimiento(uuid)', 'public.alertas_caja(uuid, int)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if to_regclass('storage.buckets') is not null then
    execute 'select exists (select 1 from storage.buckets where id = ''tickets_caja'' and public)' into publico;
    if publico then raise exception 'Verificación: el bucket de tickets quedó público'; end if;
  end if;
end $$;
