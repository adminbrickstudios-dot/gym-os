-- C9 · QR y link para anotarse solo ("Quiero ser socio"), plan sugerido por el dueño.
--
-- Ya existía todo lo de fondo: la página /hacete-socio, el interruptor "registro abierto" (configuracion_gimnasio.altas_online,
-- apagado por defecto y sin reglamento no se prende), el alta que deja al socio SIN pagar (sin cobertura: la puerta dice que debe)
-- y el aviso a Interesados/Altas. Esta migración suma solo lo que faltaba:
--   configuracion_gimnasio.alta_plan_sugerido_id   el plan que llega elegido cuando la persona abre el QR o el link (nullable;
--                                                  FK compuesta con el gimnasio). Elegir un plan nunca da acceso: el alta sigue sin cobertura.
--   qr_alta_panel(gimnasio)                        lo que necesita la pantalla del dueño (interruptor, plan sugerido, planes, WhatsApp)
--   guardar_alta_plan_sugerido(gimnasio, plan)     solo el dueño; el plan tiene que estar activo y visible en la página
--   alta_publica(host)                             igual que antes, más el plan sugerido (solo si sigue activo y visible)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.alta_publica(text)') is null then raise exception 'Guarda: falta alta_publica'; end if;
  if to_regprocedure('privado.landing_completa(uuid)') is null then raise exception 'Guarda: falta privado.landing_completa'; end if;
  if to_regprocedure('public.guardar_registro_socios(uuid, boolean)') is null then raise exception 'Guarda: falta guardar_registro_socios'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'altas_online') then
    raise exception 'Guarda: falta configuracion_gimnasio.altas_online';
  end if;
end $$;

-- ── Datos ───────────────────────────────────────────────────────────
alter table public.configuracion_gimnasio add column if not exists alta_plan_sugerido_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'config_alta_plan_sugerido_fk' and conrelid = 'public.configuracion_gimnasio'::regclass) then
    alter table public.configuracion_gimnasio add constraint config_alta_plan_sugerido_fk
      foreign key (gimnasio_id, alta_plan_sugerido_id) references public.planes (gimnasio_id, id);
  end if;
end $$;

-- ── Panel: lo que ve el dueño ───────────────────────────────────────
create or replace function public.qr_alta_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return jsonb_build_object(
    'abierto', coalesce((select c.altas_online from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id), false),
    'tiene_reglamento', exists (select 1 from public.reglamentos r where r.gimnasio_id = p_gimnasio_id),
    'publicada', coalesce((select l.publicada from public.landing_gimnasio l where l.gimnasio_id = p_gimnasio_id), false),
    'whatsapp', (select l.whatsapp from public.landing_gimnasio l where l.gimnasio_id = p_gimnasio_id),
    'plan_sugerido_id', (select p.id from public.configuracion_gimnasio c join public.planes p on p.gimnasio_id = c.gimnasio_id and p.id = c.alta_plan_sugerido_id
                          where c.gimnasio_id = p_gimnasio_id and p.activo and p.visible_en_landing),
    'planes', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'tipo', p.tipo) order by p.orden, p.nombre), '[]')
                 from public.planes p where p.gimnasio_id = p_gimnasio_id and p.activo and p.visible_en_landing));
end $$;

create or replace function public.guardar_alta_plan_sugerido(p_gimnasio_id uuid, p_plan_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_plan_id is not null and not exists (
    select 1 from public.planes p where p.gimnasio_id = p_gimnasio_id and p.id = p_plan_id and p.activo and p.visible_en_landing) then
    raise exception 'Elegí un plan activo que se vea en tu página.' using errcode = '22023';
  end if;
  update public.configuracion_gimnasio set alta_plan_sugerido_id = p_plan_id where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar'; end if;
  return public.qr_alta_panel(p_gimnasio_id);
end $$;

-- ── Público: lo que necesita la pantalla de alta (igual que antes + plan sugerido) ──
create or replace function public.alta_publica(p_host text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; l jsonb;
begin
  select d.gimnasio_id into g from public.dominios_gimnasio d where d.host = lower(p_host);
  if g is null then return null; end if;
  l := privado.landing_completa(g);
  if not coalesce((l ->> 'publicada')::boolean, false) or not coalesce((l ->> 'altas_online')::boolean, false) then
    return jsonb_build_object('abierta', false, 'marca', l -> 'marca', 'contacto', jsonb_build_object('whatsapp', l -> 'contacto' -> 'whatsapp'));
  end if;
  return jsonb_build_object('abierta', true, 'marca', l -> 'marca', 'contacto', l -> 'contacto', 'mostrar_precios', l -> 'mostrar_precios',
    'planes', l -> 'planes',
    'plan_sugerido', (select p.id from public.configuracion_gimnasio c join public.planes p on p.gimnasio_id = c.gimnasio_id and p.id = c.alta_plan_sugerido_id
                       where c.gimnasio_id = g and p.activo and p.visible_en_landing),
    'reglamento', (select jsonb_build_object('version', r.version, 'texto', r.texto)
                     from public.reglamentos r where r.gimnasio_id = g order by r.version desc limit 1),
    'transferencia', privado.datos_transferencia(g));
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.qr_alta_panel(uuid), public.guardar_alta_plan_sugerido(uuid, uuid), public.alta_publica(text) from public, anon, authenticated;
grant execute on function public.qr_alta_panel(uuid), public.guardar_alta_plan_sugerido(uuid, uuid) to authenticated, service_role;
grant execute on function public.alta_publica(text) to anon, authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.qr_alta_panel(uuid)', 'public.guardar_alta_plan_sugerido(uuid, uuid)', 'public.alta_publica(text)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
  end loop;
  foreach f in array array['public.qr_alta_panel(uuid)', 'public.guardar_alta_plan_sugerido(uuid, uuid)'] loop
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if not has_function_privilege('anon', 'public.alta_publica(text)', 'execute') then raise exception 'Verificación: alta_publica tiene que ser pública'; end if;
  if not exists (select 1 from pg_constraint where conname = 'config_alta_plan_sugerido_fk') then raise exception 'Verificación: falta la FK del plan sugerido'; end if;
end $$;
