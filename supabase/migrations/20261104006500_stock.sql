-- 0065 · Productos con stock (VEN-4).
-- El stock no se guarda: se calcula de los hechos. Entra mercadería o se
-- ajusta al contar (movimientos_stock), y sale con cada venta no anulada.
-- Cada producto elige si lleva stock (controla_stock) y desde cuánto avisar
-- (stock_minimo). Vender muestra cuántos quedan y avisa, pero no frena la
-- venta: si el número no cierra, se cuenta y se ajusta.
--
--   stock_productos(gimnasio)                 { producto_id: { controla, stock, minimo } }
--   configurar_stock(producto, controla, minimo)
--   entrada_stock(producto, cantidad, motivo)  mercadería que llegó
--   contar_stock(producto, contado)            ajusta a lo que hay (queda la diferencia)
--   movimientos_stock_producto(producto)       las últimas entradas y ajustes

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.comprobante_venta(uuid)') is null then raise exception 'Guarda: falta la migración 0064'; end if;
end $$;

alter table public.productos add column if not exists controla_stock boolean not null default false;
alter table public.productos add column if not exists stock_minimo int;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'productos_stock_minimo_valido' and conrelid = 'public.productos'::regclass) then
    alter table public.productos add constraint productos_stock_minimo_valido check (stock_minimo is null or stock_minimo between 0 and 10000);
  end if;
end $$;

create table if not exists public.movimientos_stock (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  producto_id  uuid not null,
  cantidad     int not null check (cantidad <> 0 and cantidad between -100000 and 100000),
  tipo         text not null check (tipo in ('entrada', 'conteo')),
  motivo       text check (motivo is null or length(motivo) <= 200),
  creado_en    timestamptz not null default now(),
  creado_por   uuid not null,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, producto_id) references public.productos (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id)
);
create index if not exists movimientos_stock_producto on public.movimientos_stock (producto_id, creado_en desc);
select privado.politicas_estandar('public.movimientos_stock', array['dueno', 'encargado'], null);
revoke all on table public.movimientos_stock from anon;

-- Entradas y ajustes, menos lo vendido (ventas no anuladas).
create or replace function privado.stock_producto(p_producto_id uuid) returns int
language sql stable set search_path = '' as $$
  select (coalesce((select sum(m.cantidad) from public.movimientos_stock m where m.producto_id = p_producto_id), 0)
        - coalesce((select sum(vi.cantidad) from public.venta_items vi join public.ventas v on v.id = vi.venta_id
                     where vi.producto_id = p_producto_id and vi.tipo = 'producto' and v.estado <> 'anulada'), 0))::int
$$;
revoke all on function privado.stock_producto(uuid) from public;

-- La recepción también lo lee: lo ve en Vender.
create or replace function public.stock_productos(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return coalesce((select jsonb_object_agg(p.id, jsonb_build_object('controla', p.controla_stock, 'stock', privado.stock_producto(p.id), 'minimo', p.stock_minimo))
                     from public.productos p where p.gimnasio_id = p_gimnasio_id and p.controla_stock), '{}'::jsonb);
end $$;

create or replace function public.configurar_stock(p_producto_id uuid, p_controla boolean, p_minimo int default null) returns void
language plpgsql security definer set search_path = '' as $$
declare pr public.productos; n int;
begin
  select * into pr from public.productos where id = p_producto_id;
  if not found then raise exception 'Sin permiso o producto inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(pr.gimnasio_id, array['dueno', 'encargado']);
  if p_minimo is not null and (p_minimo < 0 or p_minimo > 10000) then raise exception 'Avisar desde: un número de 0 a 10.000 (vacío = no avisar)' using errcode = '22023'; end if;
  update public.productos set controla_stock = coalesce(p_controla, false), stock_minimo = p_minimo where id = pr.id and gimnasio_id = pr.gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Sin permiso o producto inexistente' using errcode = '42501'; end if;
end $$;

create or replace function public.entrada_stock(p_producto_id uuid, p_cantidad int, p_motivo text default null) returns int
language plpgsql security definer set search_path = '' as $$
declare pr public.productos; eid uuid;
begin
  select * into pr from public.productos where id = p_producto_id;
  if not found then raise exception 'Sin permiso o producto inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(pr.gimnasio_id, array['dueno', 'encargado']);
  if not pr.controla_stock then raise exception '% no lleva stock: prendelo primero', pr.nombre using errcode = '22023'; end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 100000 then raise exception 'Cuántos entraron: un número mayor a cero' using errcode = '22023'; end if;
  insert into public.movimientos_stock (gimnasio_id, producto_id, cantidad, tipo, motivo, creado_por)
  values (pr.gimnasio_id, pr.id, p_cantidad, 'entrada', nullif(trim(coalesce(p_motivo, '')), ''), eid);
  return privado.stock_producto(pr.id);
end $$;

-- Se contó lo que hay: queda un ajuste por la diferencia (si hay).
create or replace function public.contar_stock(p_producto_id uuid, p_contado int) returns int
language plpgsql security definer set search_path = '' as $$
declare pr public.productos; eid uuid; dif int;
begin
  select * into pr from public.productos where id = p_producto_id;
  if not found then raise exception 'Sin permiso o producto inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(pr.gimnasio_id, array['dueno', 'encargado']);
  if not pr.controla_stock then raise exception '% no lleva stock: prendelo primero', pr.nombre using errcode = '22023'; end if;
  if p_contado is null or p_contado < 0 or p_contado > 100000 then raise exception 'Cuántos hay: un número de 0 en adelante' using errcode = '22023'; end if;
  dif := p_contado - privado.stock_producto(pr.id);
  if dif <> 0 then
    insert into public.movimientos_stock (gimnasio_id, producto_id, cantidad, tipo, motivo, creado_por)
    values (pr.gimnasio_id, pr.id, dif, 'conteo', 'Contado: ' || p_contado, eid);
  end if;
  return privado.stock_producto(pr.id);
end $$;

create or replace function public.movimientos_stock_producto(p_producto_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare pr public.productos;
begin
  select * into pr from public.productos where id = p_producto_id;
  if not found then raise exception 'Sin permiso o producto inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(pr.gimnasio_id, array['dueno', 'encargado']);
  return coalesce((select jsonb_agg(jsonb_build_object('fecha', m.creado_en, 'cantidad', m.cantidad, 'tipo', m.tipo, 'motivo', m.motivo, 'por', e.nombre) order by m.creado_en desc)
                     from (select * from public.movimientos_stock where producto_id = pr.id order by creado_en desc limit 20) m
                     join public.equipo e on e.id = m.creado_por), '[]'::jsonb);
end $$;

revoke all on function public.stock_productos(uuid), public.configurar_stock(uuid, boolean, int), public.entrada_stock(uuid, int, text),
  public.contar_stock(uuid, int), public.movimientos_stock_producto(uuid) from public, anon, authenticated;
grant execute on function public.stock_productos(uuid), public.configurar_stock(uuid, boolean, int), public.entrada_stock(uuid, int, text),
  public.contar_stock(uuid, int), public.movimientos_stock_producto(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.movimientos_stock'::regclass) then raise exception 'Verificación: movimientos_stock sin RLS'; end if;
  foreach f in array array['public.stock_productos(uuid)', 'public.configurar_stock(uuid, boolean, int)', 'public.entrada_stock(uuid, int, text)',
                           'public.contar_stock(uuid, int)', 'public.movimientos_stock_producto(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if exists (select 1 from public.productos where controla_stock) then raise exception 'Verificación: el stock tiene que arrancar apagado'; end if;
end $$;
