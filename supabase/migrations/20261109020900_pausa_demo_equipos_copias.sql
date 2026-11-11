-- Cierre de F2: pantalla de gimnasio pausado/dado de baja/demo vencida, franja de mantenimiento (ya existe mantenimiento_vigente),
-- estado de copias (F2.7) y aviso de equipo nuevo en el super admin (F2.8).
-- landing_publica se envuelve (la original se renombra) para que una demo vencida muestre una portada neutral: nunca el contenido de la demo.

do $guarda$
begin
  if to_regprocedure('public.landing_publica(text)') is null and to_regprocedure('public.landing_publica_base(text)') is null then raise exception 'Falta landing_publica'; end if;
  if to_regprocedure('privado.exigir_brik(text[])') is null then raise exception 'Falta privado.exigir_brik'; end if;
  if to_regclass('auth.sessions') is null then raise exception 'Falta auth.sessions'; end if;
end $guarda$;

-- ── Estado del gimnasio para la pantalla del panel ───────────────────
-- Lo pide el panel de alguien del equipo (o BRIK). Devuelve solo lo necesario para decidir qué pantalla mostrar.
create or replace function public.estado_gimnasio_aviso(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g public.gimnasios; v_wa text;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  if not (privado.soy_admin_plataforma() or exists (select 1 from public.equipo e where e.gimnasio_id = p_gimnasio_id and e.usuario_id = auth.uid() and e.activo)) then
    raise exception 'No tenés acceso a este gimnasio' using errcode = '42501';
  end if;
  select * into g from public.gimnasios where id = p_gimnasio_id;
  if not found then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  select c.whatsapp into v_wa from public.plataforma_contacto c where c.id;
  return jsonb_build_object(
    'pausado', g.suspension_manual_en is not null,
    'baja', g.baja_en is not null,
    'demo_vencida', coalesce(g.es_demo, false) and g.demo_hasta is not null and g.demo_hasta < now(),
    'whatsapp_brik', v_wa);
end $$;
revoke execute on function public.estado_gimnasio_aviso(uuid) from public, anon;
grant execute on function public.estado_gimnasio_aviso(uuid) to authenticated;

-- ── Landing: demo vencida o dado de baja = portada neutral (la marca y nada más) ──
do $envolver$
begin
  if to_regprocedure('public.landing_publica_base(text)') is null then
    alter function public.landing_publica(text) rename to landing_publica_base;
  end if;
end $envolver$;
revoke execute on function public.landing_publica_base(text) from public, anon, authenticated;

create or replace function public.landing_publica(p_host text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb; g public.gimnasios;
begin
  r := public.landing_publica_base(p_host);
  if r is null or coalesce((r ->> 'publicada')::boolean, false) is not true then return r; end if;
  select gi.* into g from public.dominios_gimnasio d join public.gimnasios gi on gi.id = d.gimnasio_id where d.host = lower(p_host);
  if found and (g.baja_en is not null or (coalesce(g.es_demo, false) and g.demo_hasta is not null and g.demo_hasta < now())) then
    return jsonb_build_object('publicada', false, 'marca', r -> 'marca', 'contacto', jsonb_build_object('whatsapp', null, 'mensaje_whatsapp', null));
  end if;
  return r;
end $$;
revoke execute on function public.landing_publica(text) from public;
grant execute on function public.landing_publica(text) to anon, authenticated;

-- ── F2.7 · Estado de copias ──────────────────────────────────────────
-- Lo que BRIK puede decir con certeza: cuándo se exportaron los datos de este gimnasio por última vez y quién lo hizo.
-- Las copias automáticas son de Supabase (diarias en Pro, D51): no se pueden consultar desde acá.
create or replace function public.admin_estado_copias(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.registro_brik; v_mail text;
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  select x.* into r from public.registro_brik x where x.gimnasio_id = p_gimnasio_id and x.accion = 'exportar_gimnasio' order by x.creado_en desc limit 1;
  if found then select u.email into v_mail from auth.users u where u.id = r.usuario_id; end if;
  return jsonb_build_object('ultima_exportacion', r.creado_en, 'por', v_mail,
    'exportaciones', (select count(*)::int from public.registro_brik x where x.gimnasio_id = p_gimnasio_id and x.accion = 'exportar_gimnasio'));
end $$;
revoke execute on function public.admin_estado_copias(uuid) from public, anon;
grant execute on function public.admin_estado_copias(uuid) to authenticated;

-- ── F2.8 · Equipos desde los que entran los usuarios de BRIK ─────────
create table if not exists public.huellas_brik (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  huella text not null,
  user_agent text,
  primera_vez timestamptz not null default now(),
  ultima_vez timestamptz not null default now(),
  primary key (usuario_id, huella)
);
alter table public.huellas_brik enable row level security;
revoke all on public.huellas_brik from anon, authenticated;

-- Se llama al abrir el super admin. Un equipo que no se había visto (y no es la primera vez de la cuenta) queda en el registro de BRIK.
create or replace function public.admin_registrar_equipo() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare sid uuid; ua text; h text; conocida boolean; primera boolean;
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  sid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  if sid is null then return jsonb_build_object('nuevo', false); end if;
  select s.user_agent into ua from auth.sessions s where s.id = sid and s.user_id = auth.uid();
  if ua is null or length(trim(ua)) = 0 then return jsonb_build_object('nuevo', false); end if;
  h := md5(ua);
  conocida := exists (select 1 from public.huellas_brik x where x.usuario_id = auth.uid() and x.huella = h);
  primera := not exists (select 1 from public.huellas_brik x where x.usuario_id = auth.uid());
  insert into public.huellas_brik (usuario_id, huella, user_agent) values (auth.uid(), h, left(ua, 400))
  on conflict (usuario_id, huella) do update set ultima_vez = now();
  if not conocida and not primera then
    perform privado.registrar_brik('equipo_nuevo', null, jsonb_build_object('user_agent', left(ua, 200)));
    return jsonb_build_object('nuevo', true);
  end if;
  return jsonb_build_object('nuevo', false);
end $$;
revoke execute on function public.admin_registrar_equipo() from public, anon;
grant execute on function public.admin_registrar_equipo() to authenticated;

do $verif$
begin
  if to_regprocedure('public.landing_publica_base(text)') is null then raise exception 'Falta landing_publica_base'; end if;
  if to_regprocedure('public.estado_gimnasio_aviso(uuid)') is null or to_regprocedure('public.admin_estado_copias(uuid)') is null
     or to_regprocedure('public.admin_registrar_equipo()') is null then raise exception 'Faltan funciones'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.huellas_brik'::regclass) then raise exception 'huellas_brik sin RLS'; end if;
end $verif$;
