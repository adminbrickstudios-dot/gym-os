-- BASE-8 (carril D) · Tope de envíos de formularios públicos + Ley 25.326 (D52).
--  1. Tope por conexión y por persona en los formularios públicos ("Quiero ser socio" y los demás que llegan sin sesión):
--     registrar_envio_publico(formulario, ip, clave) — solo el servidor. El campo trampa (D49) lo resuelve el servidor antes de llamar.
--  2. Política de privacidad de cada gimnasio (texto del dueño, pública) y consentimiento del socio (se anota cuando acepta el reglamento).
--  3. Pedidos de datos del socio (ver, corregir o borrar sus datos): los hace el socio, los resuelve el dueño o el encargado.
-- Aditiva e idempotente. RLS activa en lo nuevo. La inscripción de la base en la AAIP la hace el gimnasio (se le deja escrito en Configuración).

do $g$ begin
  if to_regprocedure('privado.es_servicio()') is null then raise exception 'BASE-8: falta privado.es_servicio'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'BASE-8: falta privado.exigir_equipo'; end if;
  if to_regclass('public.aceptaciones_reglamento') is null then raise exception 'BASE-8: falta aceptaciones_reglamento'; end if;
  if to_regnamespace('extensions') is null then raise exception 'BASE-8: falta el esquema extensions (digest)'; end if;
end $g$;

-- ── 1 · Tope de formularios públicos ───────────────────────────────
create table if not exists public.envios_publicos (
  id          uuid primary key default gen_random_uuid(),
  formulario  text not null check (formulario in ('alta_online', 'consulta', 'prueba', 'otro')),
  clave_hash  text check (clave_hash is null or length(clave_hash) = 64),
  ip          text check (ip is null or length(ip) <= 64),
  creado_en   timestamptz not null default now()
);
create index if not exists envios_publicos_ip on public.envios_publicos (formulario, ip, creado_en);
create index if not exists envios_publicos_clave on public.envios_publicos (formulario, clave_hash, creado_en);
alter table public.envios_publicos enable row level security;
revoke all on table public.envios_publicos from anon, authenticated;

-- Hasta 10 envíos por hora por conexión y 3 por hora por persona (DNI o mail, guardado como hash). Se limpia solo (24 h), sin cron.
create or replace function public.registrar_envio_publico(p_formulario text, p_ip text, p_clave text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_ip text := nullif(left(trim(coalesce(p_ip, '')), 64), ''); h text;
begin
  if not privado.es_servicio() then raise exception 'Solo el servidor' using errcode = '42501'; end if;
  if p_formulario is null or p_formulario not in ('alta_online', 'consulta', 'prueba', 'otro') then
    raise exception 'Formulario desconocido' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_clave, '')), '') is not null then
    h := encode(extensions.digest(lower(trim(p_clave)), 'sha256'), 'hex');
  end if;
  delete from public.envios_publicos where creado_en < now() - interval '24 hours';
  if v_ip is not null and (select count(*) from public.envios_publicos where formulario = p_formulario and ip = v_ip and creado_en > now() - interval '1 hour') >= 10 then
    raise exception 'Mandaste muchos formularios desde esta conexión: esperá un rato y probá de nuevo.' using errcode = 'P0001';
  end if;
  if h is not null and (select count(*) from public.envios_publicos where formulario = p_formulario and clave_hash = h and creado_en > now() - interval '1 hour') >= 3 then
    raise exception 'Ya mandaste este formulario varias veces: esperá una hora y probá de nuevo.' using errcode = 'P0001';
  end if;
  insert into public.envios_publicos (formulario, clave_hash, ip) values (p_formulario, h, v_ip);
end $$;
revoke all on function public.registrar_envio_publico(text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_envio_publico(text, text, text) to service_role;

-- ── 2 · Política de privacidad y consentimiento ────────────────────
alter table public.configuracion_gimnasio add column if not exists politica_privacidad text check (politica_privacidad is null or length(politica_privacidad) <= 20000);
alter table public.configuracion_gimnasio add column if not exists politica_privacidad_en timestamptz;
alter table public.socios add column if not exists consentimiento_datos_en timestamptz;

create or replace function public.guardar_politica_privacidad(p_gimnasio_id uuid, p_texto text) returns void
language plpgsql security definer set search_path = '' as $$
declare t text := nullif(trim(coalesce(p_texto, '')), ''); n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if t is not null and length(t) < 50 then raise exception 'La política de privacidad es muy corta: contá qué datos guardás, para qué y cómo pedir borrarlos.' using errcode = '22023'; end if;
  if t is not null and length(t) > 20000 then raise exception 'La política de privacidad es muy larga (hasta 20.000 letras).' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set politica_privacidad = t, politica_privacidad_en = case when t is null then null else now() end where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la política de privacidad'; end if;
end $$;

-- Para la pantalla del panel (dueño y encargado): el texto propio, sin pasar por el host.
create or replace function public.politica_privacidad_propia(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return (select jsonb_build_object('texto', c.politica_privacidad, 'actualizada_en', c.politica_privacidad_en)
            from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id);
end $$;

-- Pública: la página del gimnasio la muestra en /privacidad (y en "Quiero ser socio"). Sin texto del dueño devuelve null y la página muestra el modelo.
create or replace function public.politica_privacidad_publica(p_host text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('gimnasio', g.nombre, 'texto', c.politica_privacidad, 'actualizada_en', c.politica_privacidad_en)
    from public.dominios_gimnasio d
    join public.gimnasios g on g.id = d.gimnasio_id
    join public.configuracion_gimnasio c on c.gimnasio_id = d.gimnasio_id
   where d.host = lower(p_host)
$$;

-- Aceptar el reglamento (alta online o en el mostrador) anota el consentimiento sobre el tratamiento de los datos, una sola vez.
create or replace function privado.anotar_consentimiento_datos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.socios set consentimiento_datos_en = new.aceptado_en where id = new.socio_id and gimnasio_id = new.gimnasio_id and consentimiento_datos_en is null;
  return new;
end $$;
drop trigger if exists anotar_consentimiento_datos on public.aceptaciones_reglamento;
create trigger anotar_consentimiento_datos after insert on public.aceptaciones_reglamento
  for each row execute function privado.anotar_consentimiento_datos();
revoke all on function privado.anotar_consentimiento_datos() from public, anon, authenticated;

-- Los que ya aceptaron el reglamento antes de esta migración quedan con la fecha de su primera aceptación.
update public.socios s set consentimiento_datos_en = a.primera
  from (select socio_id, min(aceptado_en) primera from public.aceptaciones_reglamento group by socio_id) a
 where a.socio_id = s.id and s.consentimiento_datos_en is null;

-- ── 3 · Pedidos de datos del socio ─────────────────────────────────
create table if not exists public.pedidos_datos (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  socio_id      uuid not null,
  tipo          text not null check (tipo in ('ver', 'corregir', 'borrar')),
  detalle       text check (detalle is null or length(detalle) <= 1000),
  creado_en     timestamptz not null default now(),
  resuelto_en   timestamptz,
  resuelto_por  uuid,
  nota_resolucion text check (nota_resolucion is null or length(nota_resolucion) <= 1000),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, resuelto_por) references public.equipo (gimnasio_id, id),
  check ((resuelto_en is null) = (resuelto_por is null))
);
create index if not exists pedidos_datos_abiertos on public.pedidos_datos (gimnasio_id, creado_en) where resuelto_en is null;
create unique index if not exists pedidos_datos_uno_abierto on public.pedidos_datos (gimnasio_id, socio_id, tipo) where resuelto_en is null;
select privado.politicas_estandar('public.pedidos_datos', array['dueno', 'encargado'], null, true);
revoke all on table public.pedidos_datos from anon;

create or replace function public.pedir_mis_datos(p_socio_id uuid, p_tipo text, p_detalle text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare s public.socios; v_id uuid;
begin
  if p_socio_id is null or not exists (select 1 from privado.mis_socios() m where m = p_socio_id) then
    raise exception 'Sin permiso para pedir los datos de este socio' using errcode = '42501';
  end if;
  if p_tipo is null or p_tipo not in ('ver', 'corregir', 'borrar') then raise exception 'Elegí qué querés pedir: ver, corregir o borrar tus datos.' using errcode = '22023'; end if;
  if p_tipo = 'corregir' and length(trim(coalesce(p_detalle, ''))) < 3 then raise exception 'Contanos qué dato hay que corregir.' using errcode = '22023'; end if;
  select * into s from public.socios where id = p_socio_id;
  if exists (select 1 from public.pedidos_datos where socio_id = p_socio_id and tipo = p_tipo and resuelto_en is null) then
    raise exception 'Ya hiciste este pedido: el gimnasio lo está viendo.' using errcode = '22023';
  end if;
  insert into public.pedidos_datos (gimnasio_id, socio_id, tipo, detalle) values (s.gimnasio_id, s.id, p_tipo, nullif(left(trim(coalesce(p_detalle, '')), 1000), ''))
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.pedidos_datos_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'socio_id', p.socio_id, 'socio', s.nombre || ' ' || s.apellido, 'tipo', p.tipo, 'detalle', p.detalle,
             'creado_en', p.creado_en, 'resuelto_en', p.resuelto_en, 'nota', p.nota_resolucion)
           order by (p.resuelto_en is null) desc, p.creado_en desc)
      from public.pedidos_datos p join public.socios s on s.id = p.socio_id and s.gimnasio_id = p.gimnasio_id
     where p.gimnasio_id = p_gimnasio_id and (p.resuelto_en is null or p.resuelto_en > now() - interval '90 days')), '[]'::jsonb);
end $$;

create or replace function public.resolver_pedido_datos(p_pedido_id uuid, p_nota text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.pedidos_datos; e public.equipo; n int;
begin
  select * into p from public.pedidos_datos where id = p_pedido_id;
  if not found then raise exception 'Sin permiso o pedido inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(p.gimnasio_id, array['dueno', 'encargado']);
  if p.resuelto_en is not null then raise exception 'Ese pedido ya está resuelto' using errcode = '22023'; end if;
  if length(trim(coalesce(p_nota, ''))) < 3 then raise exception 'Escribí qué se hizo (por ejemplo: se corrigió el teléfono, o se le mandó una copia).' using errcode = '22023'; end if;
  update public.pedidos_datos set resuelto_en = now(), resuelto_por = e.id, nota_resolucion = left(trim(p_nota), 1000) where id = p.id and resuelto_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo resolver el pedido'; end if;
end $$;

revoke all on function public.guardar_politica_privacidad(uuid, text), public.politica_privacidad_publica(text), public.politica_privacidad_propia(uuid),
  public.pedir_mis_datos(uuid, text, text), public.pedidos_datos_panel(uuid), public.resolver_pedido_datos(uuid, text) from public, anon, authenticated;
grant execute on function public.guardar_politica_privacidad(uuid, text), public.politica_privacidad_propia(uuid), public.pedir_mis_datos(uuid, text, text),
  public.pedidos_datos_panel(uuid), public.resolver_pedido_datos(uuid, text) to authenticated, service_role;
grant execute on function public.politica_privacidad_publica(text) to anon, authenticated, service_role;

-- ── Verificación ───────────────────────────────────────────────────
do $v$
declare f text;
begin
  foreach f in array array['public.envios_publicos', 'public.pedidos_datos'] loop
    if not (select relrowsecurity from pg_class where oid = f::regclass) then raise exception 'BASE-8: % sin RLS', f; end if;
  end loop;
  if has_function_privilege('anon', 'public.registrar_envio_publico(text, text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.registrar_envio_publico(text, text, text)', 'execute') then
    raise exception 'BASE-8: registrar_envio_publico solo es del servidor';
  end if;
  if has_function_privilege('anon', 'public.pedir_mis_datos(uuid, text, text)', 'execute') then raise exception 'BASE-8: pedir_mis_datos no es para anónimos'; end if;
  if not has_function_privilege('anon', 'public.politica_privacidad_publica(text)', 'execute') then raise exception 'BASE-8: la política tiene que ser pública'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'anotar_consentimiento_datos' and not tgisinternal) then raise exception 'BASE-8: falta el trigger de consentimiento'; end if;
end $v$;
