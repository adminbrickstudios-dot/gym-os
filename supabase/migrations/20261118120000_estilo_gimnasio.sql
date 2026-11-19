-- Pase 2.0 · la llave "estilo" por gimnasio (docs/base/DISENO.md § Pase 2.0): 'clasico' (el de hoy) o 'pista' (el rediseño), y el modo de Pista ('oscuro' o 'claro'). Es un dato del gimnasio:
-- lo cambia el dueño desde Configuración → Marca y el super admin desde la ficha. Entra APAGADA ('clasico') para todos; los [demo] se prenden aparte.
-- Aditiva y compatible con el código anterior: una columna con valor por defecto y dos columnas más al final de gimnasio_por_host / gimnasio_por_slug
-- (el código viejo lee por nombre y no las usa). Sin la columna nueva en el código, nada cambia.
do $g$ begin
  if to_regclass('public.configuracion_gimnasio') is null then raise exception 'Guarda: falta configuracion_gimnasio'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid,text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
  if to_regprocedure('privado.soy_admin_plataforma()') is null then raise exception 'Guarda: falta privado.soy_admin_plataforma'; end if;
end $g$;

alter table public.configuracion_gimnasio add column if not exists estilo text not null default 'clasico';
alter table public.configuracion_gimnasio add column if not exists modo text not null default 'oscuro';   -- el modo de Pista (cada persona lo puede cambiar para sí con el tema de Mi cuenta); el estilo clásico no lo usa
do $m$ begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_gimnasio_modo_chk' and conrelid = 'public.configuracion_gimnasio'::regclass) then
    alter table public.configuracion_gimnasio add constraint configuracion_gimnasio_modo_chk check (modo in ('claro', 'oscuro'));
  end if;
end $m$;
do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_gimnasio_estilo_chk' and conrelid = 'public.configuracion_gimnasio'::regclass) then
    alter table public.configuracion_gimnasio add constraint configuracion_gimnasio_estilo_chk check (estilo in ('clasico', 'pista'));
  end if;
end $c$;

-- La dirección ya resuelve el gimnasio en cada pedido (el proxy la guarda 60 s): ahí viaja también el estilo, sin un viaje más.
-- Cambia la forma de lo que devuelve: la vieja se borra en esta misma migración (dos versiones harían ambigua la llamada).
drop function if exists public.gimnasio_por_host(text);
create function public.gimnasio_por_host(p_host text)
 returns table(gimnasio_id uuid, slug text, nombre text, zona_horaria text, logo_path text, favicon_path text, color_acento text, color_fondo text, estilo text, modo text)
 language sql stable security definer set search_path = ''
as $f$
  select g.id, g.slug, g.nombre, g.zona_horaria, c.logo_path, c.favicon_path, c.color_acento, c.color_fondo, c.estilo, c.modo
    from public.dominios_gimnasio d
    join public.gimnasios g on g.id = d.gimnasio_id
    join public.configuracion_gimnasio c on c.gimnasio_id = g.id
   where d.host = lower(p_host)
$f$;

drop function if exists public.gimnasio_por_slug(text);
create function public.gimnasio_por_slug(p_slug text)
 returns table(gimnasio_id uuid, slug text, nombre text, zona_horaria text, logo_path text, favicon_path text, color_acento text, color_fondo text, host text, estilo text, modo text)
 language sql stable security definer set search_path = ''
as $f$
  select g.id, g.slug, g.nombre, g.zona_horaria, c.logo_path, c.favicon_path, c.color_acento, c.color_fondo,
         (select d.host from public.dominios_gimnasio d where d.gimnasio_id = g.id
           order by (d.tipo = 'propio') desc, d.creado_en limit 1), c.estilo, c.modo
    from public.gimnasios g
    join public.configuracion_gimnasio c on c.gimnasio_id = g.id
   where g.slug = lower(p_slug)
$f$;

revoke all on function public.gimnasio_por_host(text), public.gimnasio_por_slug(text) from public;
grant execute on function public.gimnasio_por_host(text), public.gimnasio_por_slug(text) to anon, authenticated, service_role;

-- El dueño elige el estilo de su gimnasio.
create or replace function public.guardar_estilo_gimnasio(p_gimnasio_id uuid, p_estilo text, p_modo text default null) returns text
 language plpgsql security definer set search_path = ''
as $f$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_estilo is null or p_estilo not in ('clasico', 'pista') then raise exception 'Estilo: elegí clásico o Pista' using errcode = '22023'; end if;
  if p_modo is not null and p_modo not in ('claro', 'oscuro') then raise exception 'Modo: elegí claro u oscuro' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set estilo = p_estilo, modo = coalesce(p_modo, modo) where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Este gimnasio no tiene configuración. Pedile a soporte BRIK que la cree.' using errcode = 'P0002'; end if;
  return p_estilo;
end $f$;

-- El super admin lo cambia desde la ficha del gimnasio.
create or replace function public.admin_guardar_estilo(p_gimnasio_id uuid, p_estilo text, p_modo text default null) returns text
 language plpgsql security definer set search_path = ''
as $f$
declare n int;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if p_estilo is null or p_estilo not in ('clasico', 'pista') then raise exception 'Estilo: clasico o pista' using errcode = '22023'; end if;
  if p_modo is not null and p_modo not in ('claro', 'oscuro') then raise exception 'Modo: claro u oscuro' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set estilo = p_estilo, modo = coalesce(p_modo, modo) where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'El gimnasio no tiene configuración' using errcode = 'P0002'; end if;
  return p_estilo;
end $f$;

-- Lo que el panel lee para mostrar la llave (cualquiera del equipo; la base verifica).
create or replace function public.estilo_gimnasio(p_gimnasio_id uuid) returns jsonb
 language plpgsql stable security definer set search_path = ''
as $f$
declare r jsonb;
begin
  if not privado.soy_admin_plataforma() then perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']); end if;   -- el super admin lo lee desde la ficha
  select jsonb_build_object('estilo', c.estilo, 'modo', c.modo) into r from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  if r is null then raise exception 'Este gimnasio no tiene configuración' using errcode = 'P0002'; end if;
  return r;
end $f$;

revoke all on function public.guardar_estilo_gimnasio(uuid, text, text), public.admin_guardar_estilo(uuid, text, text), public.estilo_gimnasio(uuid) from public, anon;
grant execute on function public.guardar_estilo_gimnasio(uuid, text, text), public.admin_guardar_estilo(uuid, text, text), public.estilo_gimnasio(uuid) to authenticated, service_role;

-- Configuración → Marca lee la llave en el mismo viaje que el resto de la pantalla (lote_lecturas, lista cerrada).
do $lote$
declare def text;
begin
  if to_regprocedure('public.lote_lecturas(jsonb)') is null then raise exception 'Guarda: falta lote_lecturas'; end if;
  def := pg_get_functiondef('public.lote_lecturas(jsonb)'::regprocedure);
  if position('''estilo_gimnasio''' in def) = 0 then
    if position('''version_registro'']' in def) = 0 then raise exception 'Guarda: la lista de lote_lecturas no termina como se esperaba (falta la migración 20261118110000)'; end if;
    def := replace(def, '''version_registro'']', '''version_registro'',''estilo_gimnasio'']');
    execute def;
  end if;
end $lote$;

do $v$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'estilo') then raise exception 'Verificación: falta la columna estilo'; end if;
  if (select count(*) from public.configuracion_gimnasio where estilo <> 'clasico') <> 0 then raise exception 'Verificación: ningún gimnasio debería quedar en Pista al crear la llave'; end if;
  if has_function_privilege('anon', 'public.guardar_estilo_gimnasio(uuid,text,text)', 'execute') then raise exception 'Verificación: anon puede cambiar el estilo'; end if;
  if not has_function_privilege('anon', 'public.gimnasio_por_host(text)', 'execute') then raise exception 'Verificación: el proxy (anon) no puede resolver la dirección'; end if;
end $v$;
