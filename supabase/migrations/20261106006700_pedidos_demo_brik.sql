-- 0067 · Página de Gym OS para vender (VD-26, docs/v2/06-PAGINA.md).
-- La dirección de la plataforma (sin gimnasio) muestra una landing de venta. Esta migración le da lo que
-- necesita de la base, sin tocar nada de lo existente:
--   * pedidos_demo_brik: lo que deja un dueño de gimnasio en "Quiero una demo" (sin sesión). No es de ningún
--     gimnasio todavía (por eso no lleva gimnasio_id: está en la lista de excepciones de scripts/chequeos.mjs).
--   * pedir_demo_brik(nombre, gimnasio, contacto, mensaje): lo llama la página sin sesión. Tope contra spam.
--   * planes_brik_publicos(): los planes de BRIK que Mateo dejó activos (plataforma_planes). Si no hay, la página no
--     muestra precios: el código nunca inventa uno.
--   * admin_pedidos_demo(pendientes) · admin_atender_demo(id): el listado del super admin.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.plataforma_planes') is null then raise exception 'Guarda: falta plataforma_planes (migración 0110)'; end if;
  if to_regprocedure('privado.soy_admin_plataforma()') is null then raise exception 'Guarda: falta privado.soy_admin_plataforma'; end if;
  if to_regprocedure('privado.hecho_inmutable()') is null then raise exception 'Guarda: falta privado.hecho_inmutable'; end if;
end $$;

create table if not exists public.pedidos_demo_brik (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null check (length(btrim(nombre)) between 2 and 80),
  gimnasio      text check (gimnasio is null or length(gimnasio) <= 100),
  contacto      text not null check (length(btrim(contacto)) between 5 and 120),
  mensaje       text check (mensaje is null or length(mensaje) <= 500),
  creado_en     timestamptz not null default now(),
  atendido_en   timestamptz,
  atendido_por  uuid references auth.users(id),
  check ((atendido_en is null) = (atendido_por is null))
);
create index if not exists pedidos_demo_brik_pendientes on public.pedidos_demo_brik (creado_en desc) where atendido_en is null;
alter table public.pedidos_demo_brik enable row level security;
revoke all on table public.pedidos_demo_brik from anon, authenticated;
drop trigger if exists pedidos_demo_brik_inmutable on public.pedidos_demo_brik;
create trigger pedidos_demo_brik_inmutable before update or delete on public.pedidos_demo_brik
  for each row execute function privado.hecho_inmutable('atendido_en', 'atendido_por');

-- ── Desde la página (sin sesión) ────────────────────────────────────
create or replace function public.pedir_demo_brik(p_nombre text, p_gimnasio text, p_contacto text, p_mensaje text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare nom text := btrim(coalesce(p_nombre, '')); gim text := nullif(btrim(coalesce(p_gimnasio, '')), '');
        con text := btrim(coalesce(p_contacto, '')); msg text := nullif(btrim(coalesce(p_mensaje, '')), '');
begin
  if length(nom) < 2 then raise exception 'Escribí tu nombre.' using errcode = '22023'; end if;
  if length(nom) > 80 then raise exception 'El nombre es muy largo (hasta 80 letras).' using errcode = '22023'; end if;
  if gim is not null and length(gim) > 100 then raise exception 'El nombre del gimnasio es muy largo (hasta 100 letras).' using errcode = '22023'; end if;
  if msg is not null and length(msg) > 500 then raise exception 'El mensaje es muy largo (hasta 500 letras).' using errcode = '22023'; end if;
  -- Un mail o un WhatsApp: algo con lo que BRIK pueda contestar.
  if length(con) > 120 or not (con ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(regexp_replace(con, '\D', '', 'g')) between 8 and 15) then
    raise exception 'Dejanos un WhatsApp (con característica) o un mail para contestarte.' using errcode = '22023';
  end if;
  -- El mismo contacto no se duplica: si ya hay un pedido sin atender, es ese.
  if exists (select 1 from public.pedidos_demo_brik p where lower(p.contacto) = lower(con) and p.atendido_en is null
              and p.creado_en > now() - interval '7 days') then
    return jsonb_build_object('ok', true, 'repetido', true);
  end if;
  if (select count(*) from public.pedidos_demo_brik p where p.creado_en > now() - interval '1 hour') >= 20 then
    raise exception 'Recibimos muchos pedidos en este momento. Probá en un rato.' using errcode = '53400';
  end if;
  insert into public.pedidos_demo_brik (nombre, gimnasio, contacto, mensaje) values (nom, gim, con, msg);
  return jsonb_build_object('ok', true, 'repetido', false);
end $$;

-- Los planes que Mateo dejó prendidos en el super admin. El precio es suyo: acá solo se lee.
create or replace function public.planes_brik_publicos() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('nombre', p.nombre, 'precio_mensual', p.precio_mensual) order by p.precio_mensual, p.nombre), '[]'::jsonb)
    from public.plataforma_planes p where p.activo;
$$;

-- ── Super admin ─────────────────────────────────────────────────────
create or replace function public.admin_pedidos_demo(p_pendientes boolean default true) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre, 'gimnasio', x.gimnasio, 'contacto', x.contacto,
            'mensaje', x.mensaje, 'creado_en', x.creado_en, 'atendido_en', x.atendido_en) order by x.creado_en desc)
    from (select p.* from public.pedidos_demo_brik p where (not coalesce(p_pendientes, true)) or p.atendido_en is null
           order by p.creado_en desc limit 100) x), '[]'::jsonb);
end $$;

create or replace function public.admin_atender_demo(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  update public.pedidos_demo_brik set atendido_en = now(), atendido_por = auth.uid() where id = p_id and atendido_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese pedido de demo ya estaba atendido o no existe' using errcode = '22023'; end if;
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.pedir_demo_brik(text, text, text, text), public.planes_brik_publicos(),
  public.admin_pedidos_demo(boolean), public.admin_atender_demo(uuid) from public, anon, authenticated;
grant execute on function public.pedir_demo_brik(text, text, text, text), public.planes_brik_publicos() to anon, authenticated, service_role;
grant execute on function public.admin_pedidos_demo(boolean), public.admin_atender_demo(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.pedidos_demo_brik'::regclass) then raise exception 'Verificación: pedidos_demo_brik sin RLS'; end if;
  if has_table_privilege('authenticated', 'public.pedidos_demo_brik', 'select') or has_table_privilege('anon', 'public.pedidos_demo_brik', 'select') then
    raise exception 'Verificación: pedidos_demo_brik se puede leer directo'; end if;
  foreach f in array array['public.pedir_demo_brik(text, text, text, text)', 'public.planes_brik_publicos()', 'public.admin_pedidos_demo(boolean)', 'public.admin_atender_demo(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
  end loop;
  if has_function_privilege('anon', 'public.admin_pedidos_demo(boolean)', 'execute') or has_function_privilege('anon', 'public.admin_atender_demo(uuid)', 'execute') then
    raise exception 'Verificación: anon puede ejecutar el listado del super admin'; end if;
  if not has_function_privilege('anon', 'public.pedir_demo_brik(text, text, text, text)', 'execute') then raise exception 'Verificación: la página no puede pedir la demo'; end if;
end $$;
