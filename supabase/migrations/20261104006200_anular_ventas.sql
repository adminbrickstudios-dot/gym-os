-- 0062 · Anular una venta desde la ficha y desde Vender (VEN-6).
-- Anular toca plata: lo hacen el dueño o el encargado, con motivo
-- (public.anular_venta ya existía, 0009). La recepción la pide: queda un
-- pedido que el dueño o el encargado aprueban (y entonces se anula) o
-- rechazan. Nada se borra: la venta queda 'anulada' con quién y por qué, y
-- lo que habilitó (coberturas, pases, packs) se revierte en la base.
--
--   ventas_socio(socio)                     las ventas del socio, con su estado (dueño y encargado)
--   pedir_anulacion(venta, motivo)          la recepción, ventas de hoy que cobró ella
--   pedidos_anulacion_pendientes(gimnasio)  dueño y encargado
--   resolver_pedido_anulacion(pedido, aprobar, motivo)
--   anular_venta_panel(venta, motivo)       dueño y encargado; si hay efectivo de una
--                                           caja ya cerrada, sale de la caja abierta de esa sede

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.anular_venta(uuid, text, uuid, uuid, uuid)') is null then raise exception 'Guarda: falta privado.anular_venta (0009)'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'recargo_tipo') then
    raise exception 'Guarda: falta la migración 0061';
  end if;
end $$;

create table if not exists public.pedidos_anulacion (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  venta_id      uuid not null,
  motivo        text not null check (length(trim(motivo)) between 1 and 300),
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  pedido_en     timestamptz not null default now(),
  pedido_por    uuid not null,
  resuelto_en   timestamptz,
  resuelto_por  uuid,
  respuesta     text check (respuesta is null or length(respuesta) <= 300),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, venta_id) references public.ventas (gimnasio_id, id),
  foreign key (gimnasio_id, pedido_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, resuelto_por) references public.equipo (gimnasio_id, id),
  check ((estado = 'pendiente') = (resuelto_en is null))
);
create unique index if not exists pedidos_anulacion_uno_pendiente on public.pedidos_anulacion (gimnasio_id, venta_id) where estado = 'pendiente';
create index if not exists pedidos_anulacion_pendientes on public.pedidos_anulacion (gimnasio_id) where estado = 'pendiente';
select privado.politicas_estandar('public.pedidos_anulacion', array['dueno', 'encargado'], null);
revoke all on table public.pedidos_anulacion from anon;

-- Una venta como la ve el panel.
create or replace function privado.venta_json(p_venta_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'venta_id', v.id, 'fecha', v.creado_en, 'estado', v.estado, 'sede_id', v.sede_id,
    'socio_id', v.socio_id, 'socio', (select trim(s.nombre || ' ' || s.apellido) from public.socios s where s.id = v.socio_id),
    'total', (select coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0) from public.venta_items i where i.venta_id = v.id),
    'detalle', (select string_agg(i.descripcion, ', ' order by i.id) from public.venta_items i where i.venta_id = v.id),
    'medios', (select coalesce(jsonb_agg(distinct p.medio), '[]') from public.pagos p where p.venta_id = v.id and p.estado <> 'rechazado'),
    'cobro', (select e.nombre from public.equipo e where e.id = v.creado_por),
    'anulada_motivo', v.anulada_motivo, 'anulada_por', (select e.nombre from public.equipo e where e.id = v.anulada_por),
    'pedido', (select jsonb_build_object('pedido_id', pa.id, 'motivo', pa.motivo, 'por', e.nombre, 'en', pa.pedido_en)
                 from public.pedidos_anulacion pa join public.equipo e on e.id = pa.pedido_por
                where pa.venta_id = v.id and pa.estado = 'pendiente'))
    from public.ventas v where v.id = p_venta_id
$$;
revoke all on function privado.venta_json(uuid) from public;

create or replace function public.ventas_socio(p_socio_id uuid, p_limite int default 20) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(g, array['dueno', 'encargado']);
  return coalesce((select jsonb_agg(privado.venta_json(v.id) order by v.creado_en desc)
                     from (select id, creado_en from public.ventas where socio_id = p_socio_id order by creado_en desc
                           limit least(greatest(coalesce(p_limite, 20), 1), 100)) v), '[]'::jsonb);
end $$;

-- Dueño y encargado. El efectivo de una caja ya cerrada (y contada) sale de la
-- caja abierta de la sede de la venta, como retiro con el motivo.
create or replace function public.anular_venta_panel(p_venta_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.ventas; eid uuid; turno uuid;
begin
  select * into v from public.ventas where id = p_venta_id;
  if not found then raise exception 'Sin permiso o venta inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(v.gimnasio_id, array['dueno', 'encargado']);
  if exists (select 1 from public.pagos p join public.turnos_caja t on t.id = p.turno_caja_id
              where p.venta_id = v.id and p.estado = 'aprobado' and p.medio = 'efectivo' and t.cerrado_en is not null) then
    select t.id into turno from public.turnos_caja t join public.cajas c on c.id = t.caja_id
     where c.sede_id = v.sede_id and t.cerrado_en is null order by t.abierto_en limit 1;
    if turno is null then
      raise exception 'Se cobró en efectivo en una caja que ya se cerró: para devolver la plata, abrí una caja en esa sede y volvé a anular.' using errcode = '22023';
    end if;
  end if;
  perform privado.anular_venta(p_venta_id, p_motivo, eid, auth.uid(), turno);
  update public.pedidos_anulacion set estado = 'aprobado', resuelto_en = now(), resuelto_por = eid
   where venta_id = p_venta_id and estado = 'pendiente';
end $$;

-- La recepción pide anular una venta de hoy que cobró ella.
create or replace function public.pedir_anulacion(p_venta_id uuid, p_motivo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v public.ventas; eid uuid; zona text; pid uuid;
begin
  select * into v from public.ventas where id = p_venta_id;
  if not found then raise exception 'Sin permiso o venta inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(v.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'Escribí por qué hay que anularla' using errcode = '22023'; end if;
  if v.estado = 'anulada' then raise exception 'La venta ya está anulada' using errcode = '22023'; end if;
  select zona_horaria into zona from public.gimnasios where id = v.gimnasio_id;
  if v.creado_por is distinct from eid or privado.dia_local(v.creado_en, zona) <> privado.dia_local(now(), zona) then
    raise exception 'Se pide anular solo una venta de hoy que cobraste vos. Para otra, hablá con el dueño o el encargado.' using errcode = '42501';
  end if;
  if exists (select 1 from public.pedidos_anulacion where venta_id = v.id and estado = 'pendiente') then
    raise exception 'Ya pediste anular esta venta: la está por ver el dueño o el encargado' using errcode = '22023';
  end if;
  insert into public.pedidos_anulacion (gimnasio_id, venta_id, motivo, pedido_por)
  values (v.gimnasio_id, v.id, trim(p_motivo), eid) returning id into pid;
  return pid;
end $$;

create or replace function public.pedidos_anulacion_pendientes(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return coalesce((select jsonb_agg(privado.venta_json(pa.venta_id) order by pa.pedido_en)
                     from public.pedidos_anulacion pa where pa.gimnasio_id = p_gimnasio_id and pa.estado = 'pendiente'), '[]'::jsonb);
end $$;

-- Aprobar anula la venta (con el motivo de la recepción); rechazar la deja como está.
create or replace function public.resolver_pedido_anulacion(p_pedido_id uuid, p_aprobar boolean, p_respuesta text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare pa public.pedidos_anulacion; eid uuid; n int;
begin
  select * into pa from public.pedidos_anulacion where id = p_pedido_id for update;
  if not found then raise exception 'Sin permiso o pedido inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(pa.gimnasio_id, array['dueno', 'encargado']);
  if pa.estado <> 'pendiente' then raise exception 'Ese pedido ya se resolvió' using errcode = '22023'; end if;
  if p_aprobar then
    perform public.anular_venta_panel(pa.venta_id, pa.motivo);   -- marca el pedido aprobado
  else
    update public.pedidos_anulacion set estado = 'rechazado', resuelto_en = now(), resuelto_por = eid,
           respuesta = nullif(trim(coalesce(p_respuesta, '')), '')
     where id = pa.id and estado = 'pendiente';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo resolver el pedido'; end if;
  end if;
end $$;

revoke all on function public.ventas_socio(uuid, int), public.anular_venta_panel(uuid, text), public.pedir_anulacion(uuid, text),
  public.pedidos_anulacion_pendientes(uuid), public.resolver_pedido_anulacion(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.ventas_socio(uuid, int), public.anular_venta_panel(uuid, text), public.pedir_anulacion(uuid, text),
  public.pedidos_anulacion_pendientes(uuid), public.resolver_pedido_anulacion(uuid, boolean, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.pedidos_anulacion'::regclass) then raise exception 'Verificación: pedidos_anulacion sin RLS'; end if;
  foreach f in array array['public.ventas_socio(uuid, int)', 'public.anular_venta_panel(uuid, text)', 'public.pedir_anulacion(uuid, text)',
                           'public.pedidos_anulacion_pendientes(uuid)', 'public.resolver_pedido_anulacion(uuid, boolean, text)', 'privado.venta_json(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
