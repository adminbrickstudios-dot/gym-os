-- VD-56 · Recibo de cada pago, para imprimir, guardar como PDF o mandar por WhatsApp.
--   contadores_recibo       el último número usado por gimnasio (se suma dentro de la misma transacción de la venta: sin saltos)
--   recibos                 una fila por venta cobrada con su NÚMERO, asignado una sola vez al confirmarse la venta (trigger) y nunca más
--   recibo_venta(venta)     el recibo armado con los hechos: venta, ítems, pagos, medio, quién cobró, fecha en hora del gimnasio, sede y marca.
--                           Lo ve el equipo (dueño, encargado, recepción) y el socio solo los suyos; la base decide. Una venta anulada
--                           muestra el recibo marcado ANULADO (el número no se reusa). Una venta que nunca se cobró no tiene recibo.
--   privado.venta_json      suma 'recibo_n' para que la ficha enganche el recibo
--   mi_historial            suma 'venta_id' y 'recibo' a cada pago para que la app del socio enganche el recibo
-- Nada del recibo se guarda salvo el número: monto, ítems, medio y fecha salen siempre de la venta, que no se edita.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.ventas') is null or to_regclass('public.venta_items') is null or to_regclass('public.pagos') is null then raise exception 'Guarda: faltan las tablas de ventas'; end if;
  if to_regprocedure('privado.venta_json(uuid)') is null then raise exception 'Guarda: falta venta_json (0062)'; end if;
  if to_regprocedure('public.mi_historial(uuid)') is null then raise exception 'Guarda: falta mi_historial'; end if;
  if to_regprocedure('privado.celular_aviso(text, text, date, date)') is null then raise exception 'Guarda: falta celular_aviso'; end if;
  if to_regprocedure('privado.mis_socios()') is null then raise exception 'Guarda: falta mis_socios'; end if;
end $$;

-- ── Tablas ──────────────────────────────────────────────────────────
create table if not exists public.contadores_recibo (
  gimnasio_id  uuid primary key references public.gimnasios(id),
  ultimo       int not null default 0 check (ultimo >= 0)
);
select privado.politicas_estandar('public.contadores_recibo', array['dueno'], '{}');
revoke all on table public.contadores_recibo from anon;
revoke all on table public.contadores_recibo from authenticated;   -- todo por funciones

create table if not exists public.recibos (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  venta_id     uuid not null,
  numero       int not null check (numero > 0),
  emitido_en   timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, venta_id),
  unique (gimnasio_id, numero),
  foreign key (gimnasio_id, venta_id) references public.ventas (gimnasio_id, id)
);
select privado.politicas_estandar('public.recibos', array['dueno', 'encargado', 'recepcion'], '{}');
revoke all on table public.recibos from anon;
revoke all on table public.recibos from authenticated;   -- todo por recibo_venta
drop trigger if exists recibos_inmutable on public.recibos;
create trigger recibos_inmutable before update or delete on public.recibos
  for each row execute function privado.hecho_inmutable('ninguna_columna');   -- sin argumentos la función no frena nada: se pasa una columna que no existe

-- ── El número, una sola vez y sin saltos ────────────────────────────
-- Se asigna cuando la venta pasa a "confirmada" (cobrada). Si la transacción de la venta se revierte, el número también:
-- por eso no quedan huecos. El contador de cada gimnasio se bloquea hasta que termina la transacción.
create or replace function privado.asignar_numero_recibo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if new.estado <> 'confirmada' then return new; end if;
  if tg_op = 'UPDATE' and old.estado = 'confirmada' then return new; end if;
  if exists (select 1 from public.recibos r where r.gimnasio_id = new.gimnasio_id and r.venta_id = new.id) then return new; end if;
  insert into public.contadores_recibo (gimnasio_id, ultimo) values (new.gimnasio_id, 1)
    on conflict (gimnasio_id) do update set ultimo = public.contadores_recibo.ultimo + 1
    returning ultimo into n;
  insert into public.recibos (gimnasio_id, venta_id, numero) values (new.gimnasio_id, new.id, n);
  return new;
end $$;
revoke all on function privado.asignar_numero_recibo() from public, anon, authenticated;
drop trigger if exists ventas_numero_recibo on public.ventas;
create trigger ventas_numero_recibo after insert or update of estado on public.ventas
  for each row execute function privado.asignar_numero_recibo();

-- Las ventas ya cobradas (y las anuladas que alguna vez se cobraron) reciben su número en el orden en que se cobraron.
do $$
declare v record; n int;
begin
  for v in select x.id, x.gimnasio_id from public.ventas x
            where x.confirmada_en is not null and not exists (select 1 from public.recibos r where r.venta_id = x.id)
            order by x.gimnasio_id, x.confirmada_en, x.id loop
    insert into public.contadores_recibo (gimnasio_id, ultimo) values (v.gimnasio_id, 1)
      on conflict (gimnasio_id) do update set ultimo = public.contadores_recibo.ultimo + 1
      returning ultimo into n;
    insert into public.recibos (gimnasio_id, venta_id, numero) values (v.gimnasio_id, v.id, n);
  end loop;
end $$;

-- ── El recibo ───────────────────────────────────────────────────────
create or replace function public.recibo_venta(p_venta_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v public.ventas; r public.recibos; s public.socios; g public.gimnasios; sd public.sedes; logo text; zona text;
        equipo boolean; total numeric; items jsonb; pagos jsonb; cobro text;
begin
  select * into v from public.ventas where id = p_venta_id;
  if not found then raise exception 'Sin permiso o recibo inexistente' using errcode = '42501'; end if;
  equipo := exists (select 1 from public.equipo e where e.gimnasio_id = v.gimnasio_id and e.usuario_id = auth.uid() and e.activo and e.rol in ('dueno', 'encargado', 'recepcion'));
  if equipo then
    perform privado.exigir_equipo(v.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  elsif v.socio_id is null or v.socio_id not in (select privado.mis_socios()) then
    raise exception 'Sin permiso o recibo inexistente' using errcode = '42501';
  end if;
  select * into r from public.recibos x where x.venta_id = v.id;
  if not found then raise exception 'Esta venta no tiene recibo: todavía no se cobró.' using errcode = '22023'; end if;
  select * into g from public.gimnasios where id = v.gimnasio_id;
  select * into sd from public.sedes where id = v.sede_id;
  select c.logo_path into logo from public.configuracion_gimnasio c where c.gimnasio_id = v.gimnasio_id;
  if v.socio_id is not null then select * into s from public.socios where id = v.socio_id; end if;
  zona := g.zona_horaria;
  select coalesce(jsonb_agg(jsonb_build_object('descripcion', i.descripcion, 'cantidad', i.cantidad, 'precio_unitario', i.precio_unitario,
                                               'descuento', i.descuento, 'subtotal', i.cantidad * i.precio_unitario - i.descuento) order by i.descripcion, i.id), '[]'::jsonb),
         coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0)
    into items, total from public.venta_items i where i.venta_id = v.id;
  select coalesce(jsonb_agg(jsonb_build_object('medio', p.medio, 'monto', p.monto) order by p.aprobado_en, p.id), '[]'::jsonb)
    into pagos from public.pagos p where p.venta_id = v.id and p.aprobado_en is not null;
  select e.nombre into cobro from public.equipo e where e.id = v.creado_por;
  return jsonb_build_object(
    'venta_id', v.id, 'numero', r.numero, 'numero_texto', lpad(r.numero::text, 8, '0'),
    'anulado', v.estado = 'anulada',
    'fecha', to_char(coalesce(v.confirmada_en, r.emitido_en) at time zone zona, 'DD/MM/YYYY HH24:MI'),
    'gimnasio', jsonb_build_object('nombre', g.nombre, 'logo_path', logo),
    'sede', jsonb_build_object('nombre', sd.nombre, 'direccion', sd.direccion, 'telefono', sd.telefono),
    'socio', case when s.id is null then null else jsonb_build_object('nombre', trim(s.nombre || ' ' || s.apellido), 'dni', s.dni) end,
    'items', items, 'total', total, 'pagos', pagos,
    'cobro', coalesce(cobro, case v.origen when 'app' then 'Pago desde la app' when 'web' then 'Pago desde la web' when 'debito' then 'Débito automático' else null end),
    'telefono', case when equipo and s.id is not null then privado.celular_aviso(s.telefono, s.responsable_telefono, s.fecha_nacimiento, privado.dia_local(now(), zona)) end,
    'anulacion', case when v.estado = 'anulada' then jsonb_build_object(
        'fecha', to_char(v.anulada_en at time zone zona, 'DD/MM/YYYY HH24:MI'),
        'motivo', case when equipo then v.anulada_motivo end) end);
end $$;

-- ── La ficha y la app enganchan el recibo ───────────────────────────
-- Copia de privado.venta_json (0062) con 'recibo_n'.
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
    'recibo_n', (select r.numero from public.recibos r where r.venta_id = v.id),
    'pedido', (select jsonb_build_object('pedido_id', pa.id, 'motivo', pa.motivo, 'por', e.nombre, 'en', pa.pedido_en)
                 from public.pedidos_anulacion pa join public.equipo e on e.id = pa.pedido_por
                where pa.venta_id = v.id and pa.estado = 'pendiente'))
    from public.ventas v where v.id = p_venta_id
$$;
revoke all on function privado.venta_json(uuid) from public;

-- Copia de mi_historial (0136) con 'venta_id' y 'recibo' en cada pago.
create or replace function public.mi_historial(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_socio_id not in (select privado.mis_socios()) then perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']); end if;
  return jsonb_build_object(
    'pagos', coalesce((select jsonb_agg(x order by (x ->> 'fecha')::timestamptz desc) from (
        select jsonb_build_object('fecha', coalesce(p.aprobado_en, p.rechazado_en, p.creado_en), 'monto', p.monto, 'medio', p.medio, 'estado', p.estado,
                 'detalle', (select string_agg(i.descripcion, ' + ' order by i.id) from public.venta_items i where i.venta_id = v.id),
                 'motivo', p.rechazado_motivo, 'venta_id', v.id,
                 'recibo', p.estado = 'aprobado' and exists (select 1 from public.recibos r where r.venta_id = v.id)) x
          from public.pagos p join public.ventas v on v.id = p.venta_id
         where v.socio_id = p_socio_id
           and (p.estado = 'rechazado' or (v.estado <> 'anulada' and p.estado <> 'anulado'))
         order by coalesce(p.aprobado_en, p.rechazado_en, p.creado_en) desc limit 12) y), '[]'::jsonb),
    'entradas', coalesce((select jsonb_agg(jsonb_build_object('momento', u.m, 'tipo', u.tipo, 'actividad', u.actividad) order by u.m desc) from (
        select i.momento m, 'entrada' tipo, null::text actividad from public.ingresos i
         where i.socio_id = p_socio_id and i.anulado_en is null and i.resultado <> 'rechazado'
        union all
        select c.inicio, 'clase', a.nombre
          from public.asistencias s join public.clases c on c.id = s.clase_id join public.actividades a on a.id = c.actividad_id
         where s.socio_id = p_socio_id and s.anulada_en is null
        order by 1 desc limit 15) u), '[]'::jsonb));
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.recibo_venta(uuid), public.mi_historial(uuid) from public, anon, authenticated;
grant execute on function public.recibo_venta(uuid), public.mi_historial(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare t text; f text; falta int;
begin
  foreach t in array array['contadores_recibo', 'recibos'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then raise exception 'Verificación: % sin RLS', t; end if;
    if has_table_privilege('anon', 'public.' || t, 'select') then raise exception 'Verificación: anon lee %', t; end if;
    if has_table_privilege('authenticated', 'public.' || t, 'insert') or has_table_privilege('authenticated', 'public.' || t, 'select') then raise exception 'Verificación: se puede leer o escribir % directo', t; end if;
  end loop;
  foreach f in array array['public.recibo_venta(uuid)', 'public.mi_historial(uuid)', 'privado.asignar_numero_recibo()', 'privado.venta_json(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon ejecuta %', f; end if;
  end loop;
  select count(*) into falta from public.ventas x where x.confirmada_en is not null and not exists (select 1 from public.recibos r where r.venta_id = x.id);
  if falta > 0 then raise exception 'Verificación: % ventas cobradas sin número de recibo', falta; end if;
  if exists (select 1 from public.recibos r group by r.gimnasio_id having max(r.numero) <> count(*)) then raise exception 'Verificación: hay saltos en los números de recibo'; end if;
end $$;
