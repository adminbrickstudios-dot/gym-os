-- 0128 · Eventos sueltos (COM-8).
-- Un seminario o una clase especial: nombre, día y hora, cupo, precio, una
-- línea de qué es y para quién (todos o solo socios). Por dentro es un
-- producto (así se vende en Vender sin tocar el cobro) con stock = cupo: los
-- anotados son las ventas no anuladas de ese producto. Se ve en la página y
-- en la app mientras no pasó. Terminar o cancelar lo saca de Vender.
--   crear_evento(gimnasio, nombre, inicio, cupo, precio, descripcion, para) → id
--   eventos_panel(gimnasio)    dueño, encargado y recepción: anotados y lugares
--   cerrar_evento(evento)      dueño o encargado: deja de venderse
--   eventos_publicos(host)     la página (sin sesión): los que vienen
--   eventos_socio(socio)       la app

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.stock_producto(uuid)') is null then raise exception 'Guarda: falta el stock (0065)'; end if;
  if to_regprocedure('public.agenda_publica(text)') is null then raise exception 'Guarda: falta agenda_publica'; end if;
end $$;

create table if not exists public.eventos (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  producto_id  uuid not null,
  inicio       timestamptz not null,
  descripcion  text check (descripcion is null or length(descripcion) <= 300),
  cupo         int not null check (cupo between 1 and 1000),
  para         text not null default 'todos' check (para in ('todos', 'socios')),
  cerrado_en   timestamptz,
  creado_por   uuid not null,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, producto_id),
  foreign key (gimnasio_id, producto_id) references public.productos (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id)
);
select privado.politicas_estandar('public.eventos', array['dueno', 'encargado', 'recepcion'], null, false);
revoke all on table public.eventos from anon;
revoke truncate, references, trigger on public.eventos from authenticated;

create or replace function public.crear_evento(p_gimnasio_id uuid, p_nombre text, p_inicio timestamptz, p_cupo int, p_precio numeric,
                                               p_descripcion text default null, p_para text default 'todos') returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; v_nombre text := trim(coalesce(p_nombre, '')); v_prod uuid; v_id uuid; zona text;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if length(v_nombre) < 3 or length(v_nombre) > 60 then raise exception 'El nombre del evento tiene que tener entre 3 y 60 letras.' using errcode = '22023'; end if;
  if p_inicio is null or p_inicio < now() then raise exception 'Elegí un día y una hora que todavía no pasaron.' using errcode = '22023'; end if;
  if p_cupo is null or p_cupo < 1 or p_cupo > 1000 then raise exception 'El cupo va de 1 a 1.000 lugares.' using errcode = '22023'; end if;
  if p_precio is null or p_precio < 0 or p_precio > 10000000 then raise exception 'El precio no es válido (0 si es gratis).' using errcode = '22023'; end if;
  if p_para not in ('todos', 'socios') then raise exception 'Para quién: todos o solo socios.' using errcode = '22023'; end if;
  if length(coalesce(p_descripcion, '')) > 300 then raise exception 'La descripción puede tener hasta 300 letras.' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  -- El producto lleva la fecha en el nombre: en Vender, en el ticket y en el Resultado se sabe qué evento fue.
  insert into public.productos (gimnasio_id, nombre, precio, activo, controla_stock, stock_minimo)
  values (p_gimnasio_id, '🎟️ ' || v_nombre || ' · ' || to_char(p_inicio at time zone zona, 'DD/MM HH24:MI'), round(p_precio, 2), true, true, 0)
  returning id into v_prod;
  insert into public.movimientos_stock (gimnasio_id, producto_id, cantidad, tipo, motivo, creado_por)
  values (p_gimnasio_id, v_prod, p_cupo, 'entrada', 'Cupo del evento', e.id);
  insert into public.eventos (gimnasio_id, producto_id, inicio, descripcion, cupo, para, creado_por)
  values (p_gimnasio_id, v_prod, p_inicio, nullif(trim(coalesce(p_descripcion, '')), ''), p_cupo, p_para, e.id)
  returning id into v_id;
  return v_id;
end $$;

create or replace function privado.evento_json(ev public.eventos, p_con_anotados boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('evento_id', ev.id, 'producto_id', ev.producto_id, 'nombre', regexp_replace(p.nombre, '^🎟️ (.*) · \d\d/\d\d \d\d:\d\d$', '\1'),
           'inicio', ev.inicio, 'precio', p.precio, 'descripcion', ev.descripcion, 'cupo', ev.cupo, 'para', ev.para,
           'quedan', greatest(privado.stock_producto(p.id), 0), 'cerrado', ev.cerrado_en is not null,
           'zona', (select g.zona_horaria from public.gimnasios g where g.id = ev.gimnasio_id))
       || case when p_con_anotados then jsonb_build_object('anotados', coalesce((
            select jsonb_agg(jsonb_build_object('nombre', coalesce(trim(s.nombre || ' ' || s.apellido), 'Sin socio (venta suelta)'), 'cantidad', vi.cantidad, 'socio_id', s.id) order by v.creado_en)
              from public.venta_items vi join public.ventas v on v.id = vi.venta_id left join public.socios s on s.id = v.socio_id
             where vi.producto_id = p.id and vi.tipo = 'producto' and v.estado <> 'anulada'), '[]')) else '{}'::jsonb end
    from public.productos p where p.id = ev.producto_id
$$;
revoke all on function privado.evento_json(public.eventos, boolean) from public, anon, authenticated;

create or replace function public.eventos_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return coalesce((select jsonb_agg(privado.evento_json(ev, true) order by (ev.cerrado_en is null and ev.inicio > now() - interval '1 day') desc, ev.inicio)
    from public.eventos ev where ev.gimnasio_id = p_gimnasio_id and (ev.cerrado_en is null or ev.cerrado_en > now() - interval '30 days')), '[]');
end $$;

create or replace function public.cerrar_evento(p_evento_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare ev public.eventos; n int;
begin
  select * into ev from public.eventos where id = p_evento_id;
  if not found then raise exception 'Sin permiso o evento inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(ev.gimnasio_id, array['dueno', 'encargado']);
  update public.eventos set cerrado_en = now() where id = ev.id and cerrado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese evento ya estaba cerrado' using errcode = '22023'; end if;
  update public.productos set activo = false where id = ev.producto_id;
end $$;

create or replace function public.eventos_publicos(p_host text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select d.gimnasio_id into g from public.dominios_gimnasio d where d.host = lower(p_host);
  if g is null then return '[]'; end if;
  if not exists (select 1 from public.landing_gimnasio l where l.gimnasio_id = g and l.publicada) then return '[]'; end if;
  return coalesce((select jsonb_agg(privado.evento_json(ev, false) order by ev.inicio)
    from public.eventos ev where ev.gimnasio_id = g and ev.cerrado_en is null and ev.inicio > now()), '[]');
end $$;

create or replace function public.eventos_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.socios where id = p_socio_id;
  return coalesce((select jsonb_agg(privado.evento_json(ev, false) || jsonb_build_object('anotado', exists (
             select 1 from public.venta_items vi join public.ventas v on v.id = vi.venta_id
              where vi.producto_id = ev.producto_id and vi.tipo = 'producto' and v.estado <> 'anulada' and v.socio_id = s.id)) order by ev.inicio)
    from public.eventos ev where ev.gimnasio_id = s.gimnasio_id and ev.cerrado_en is null and ev.inicio > now()), '[]');
end $$;

revoke all on function public.crear_evento(uuid, text, timestamptz, int, numeric, text, text), public.eventos_panel(uuid), public.cerrar_evento(uuid),
  public.eventos_publicos(text), public.eventos_socio(uuid) from public, anon, authenticated;
grant execute on function public.crear_evento(uuid, text, timestamptz, int, numeric, text, text), public.eventos_panel(uuid), public.cerrar_evento(uuid),
  public.eventos_socio(uuid) to authenticated, service_role;
grant execute on function public.eventos_publicos(text) to anon, authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.eventos'::regclass) then raise exception 'Verificación: eventos sin RLS'; end if;
  if has_function_privilege('anon', 'public.crear_evento(uuid, text, timestamptz, int, numeric, text, text)', 'execute') then raise exception 'Verificación: crear_evento quedó para anon'; end if;
end $$;
