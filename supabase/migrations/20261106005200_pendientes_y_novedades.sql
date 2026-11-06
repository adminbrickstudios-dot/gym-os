-- VD-37 · Pendientes (números del menú) y centro de notificaciones (docs/v2/12).
--
--   pendientes_panel(gimnasio)
--       TODOS los contadores del menú en un solo pedido, calculados en la base según el rol.
--       Nada se marca ni se guarda: el número sale de los hechos, así que baja solo al resolverse
--       (cobrar a uno baja "Vencen"; aprobar una transferencia baja "Transferencias").
--       Solo trae las claves que el rol ve (una clave ausente = no es de su rol; un 0 = no hay nada).
--       La recepción no ve plata: son cantidades, y lo de la plata (cajas sin contar, pedidos de
--       anular, control) es solo de dueño y encargado.
--   campana_panel(gimnasio)
--       La campana de quien mira ya unida (la de siempre + la del Control) y con el TIPO de cada aviso,
--       sin los tipos que esa persona apagó para el canal "app".
--   preferencias_aviso_panel(gimnasio) / guardar_preferencia_aviso(gimnasio, tipo, canal, activo)
--       Qué tipos de aviso puede elegir cada rol y cuáles apagó. Por defecto todo está prendido.
--       Canal "app" = la campana. Los avisos al celular (push) se eligen por dispositivo en
--       ActivarPush (suscripciones_push.tipos): no se duplican acá.
--
-- Mensajes de los socios (VD-38) todavía no existe: el contador "mensajes" queda en 0 y se llena
-- cuando esa tabla nazca. NO se redefine para_hacer_hoy (VD-13): se la llama.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.retencion(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.retencion'; end if;
  if to_regprocedure('public.para_hacer_hoy(uuid)') is null then raise exception 'Guarda: falta public.para_hacer_hoy'; end if;
  if to_regprocedure('public.cajas_olvidadas(uuid)') is null then raise exception 'Guarda: falta public.cajas_olvidadas'; end if;
  if to_regprocedure('public.campana(uuid)') is null then raise exception 'Guarda: falta public.campana'; end if;
  if to_regprocedure('public.campana_control(uuid)') is null then raise exception 'Guarda: falta public.campana_control (VD-10)'; end if;
  if to_regclass('public.pedidos_baja') is null or to_regclass('public.pedidos_pausa') is null or to_regclass('public.pedidos_anulacion') is null then
    raise exception 'Guarda: faltan las tablas de pedidos';
  end if;
  if to_regclass('public.prospectos') is null or to_regclass('public.tareas') is null then raise exception 'Guarda: faltan prospectos o tareas'; end if;
end $$;

-- ── Preferencias de aviso (chica, de cada usuario) ──────────────────
create table if not exists public.preferencias_aviso (
  id             uuid primary key default gen_random_uuid(),
  gimnasio_id    uuid not null references public.gimnasios(id),
  usuario_id     uuid not null references auth.users(id) on delete cascade,
  tipo           text not null check (tipo in ('comprobantes', 'caja', 'pedidos', 'control', 'stock', 'resumen', 'clases')),
  canal          text not null check (canal in ('app')),
  activo         boolean not null,
  actualizado_en timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, usuario_id, tipo, canal)
);
alter table public.preferencias_aviso enable row level security;
drop policy if exists propias_lee on public.preferencias_aviso;
create policy propias_lee on public.preferencias_aviso for select to authenticated using (usuario_id = auth.uid());
revoke all on table public.preferencias_aviso from anon;
revoke insert, update, delete, truncate, references, trigger on public.preferencias_aviso from authenticated;

-- A qué tipo de preferencia pertenece cada aviso (por el comienzo de su clave). null = siempre se muestra.
create or replace function privado.tipo_aviso(p_clave text) returns text
language sql immutable set search_path = '' as $$
  select case split_part(p_clave, ':', 1)
    when 'pago' then 'comprobantes'
    when 'caja_abierta' then 'caja'
    when 'caja' then 'caja'
    when 'pedido_anulacion' then 'pedidos'
    when 'pedido_pausa' then 'pedidos'
    when 'pedido_baja' then 'pedidos'
    when 'anulacion_resuelta' then 'pedidos'
    when 'dejado' then 'control'
    when 'otro_dia' then 'control'
    when 'prestamo' then 'control'
    when 'stock' then 'stock'
    when 'resumen' then 'resumen'
    when 'resumen_semana' then 'resumen'
    when 'clase_cancelada' then 'clases'
    else null end
$$;
revoke all on function privado.tipo_aviso(text) from public, anon, authenticated;

-- Qué tipos puede elegir cada rol (los de lo que ese rol llega a ver en la campana).
create or replace function privado.tipos_aviso_de_rol(p_rol text) returns text[]
language sql immutable set search_path = '' as $$
  select case p_rol
    when 'dueno' then array['comprobantes', 'caja', 'pedidos', 'control', 'stock', 'resumen']
    when 'encargado' then array['comprobantes', 'caja', 'pedidos', 'control', 'stock', 'resumen']
    when 'recepcion' then array['comprobantes', 'caja', 'pedidos']
    when 'profe' then array['clases']
    else array[]::text[] end
$$;
revoke all on function privado.tipos_aviso_de_rol(text) from public, anon, authenticated;

-- ── Los contadores del menú, en un solo pedido ──────────────────────
create or replace function public.pendientes_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; zona text; hoy date; sede uuid; gestion boolean; mostrador boolean;
  vencen int := 0; transf int := 0; tareas int := 0; prosp int := 0; control int := 0; caja int := 0; socios int := 0;
  hacer jsonb; r jsonb := '{}'::jsonb;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  gestion := e.rol in ('dueno', 'encargado');
  mostrador := e.rol in ('dueno', 'encargado', 'recepcion');
  sede := e.sede_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := (now() at time zone zona)::date;

  -- Lo mío para hacer (todos los roles): tareas sin hacer para hoy o atrasadas.
  select count(*) into tareas from public.tareas t
   where t.gimnasio_id = p_gimnasio_id and t.para = e.id and t.hecha_en is null and t.dia <= hoy;

  if mostrador then
    -- Vencen y cobrar: los que vencen hoy y todavía no pagaron (el mismo cálculo que la pantalla).
    select count(*) into vencen from privado.retencion(p_gimnasio_id, now()) x where x.lista = 'por_vencer' and x.dias = 0;
    -- Transferencias por aprobar (misma cuenta que "Para hacer hoy").
    select count(*) into transf from public.pagos p join public.ventas v on v.id = p.venta_id
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.medio = 'transferencia'
       and p.comprobante_path is not null and (sede is null or v.sede_id = sede);
    -- Interesados nuevos.
    select count(*) into prosp from public.prospectos p where p.gimnasio_id = p_gimnasio_id and p.estado = 'nuevo';
    -- Para hacer hoy: lo que calcula la base para el mostrador, más mis tareas.
    hacer := public.para_hacer_hoy(p_gimnasio_id);
    tareas := tareas + case jsonb_typeof(hacer)
      when 'array' then jsonb_array_length(hacer)
      when 'object' then case when jsonb_typeof(hacer -> 'items') = 'array' then jsonb_array_length(hacer -> 'items') else 0 end
      else 0 end;
    -- Caja: abiertas que quedaron olvidadas (la recepción, las suyas).
    caja := jsonb_array_length(public.cajas_olvidadas(p_gimnasio_id));
  end if;

  if gestion then
    -- Caja: cerradas sin contar que esperan revisión, y pedidos de anular una venta.
    caja := caja
      + (select count(*) from public.turnos_caja t where t.gimnasio_id = p_gimnasio_id and t.sin_contar and t.monto_contado is null and t.revisado_en is null)
      + (select count(*) from public.pedidos_anulacion pa where pa.gimnasio_id = p_gimnasio_id and pa.estado = 'pendiente');
    -- Socios: pedidos de pausa y de baja que esperan respuesta.
    socios := (select count(*) from public.pedidos_pausa x where x.gimnasio_id = p_gimnasio_id and x.estado = 'pendiente')
            + (select count(*) from public.pedidos_baja x where x.gimnasio_id = p_gimnasio_id and x.estado = 'pendiente');
    -- Control sin ver: los avisos del Control que todavía no abrió (solo quien ve el Control).
    begin
      control := coalesce((public.campana_control(p_gimnasio_id) ->> 'sin_leer')::int, 0);
    exception when insufficient_privilege then
      control := null;
    end;
  end if;

  r := jsonb_build_object('tareas', tareas);
  if mostrador then
    r := r || jsonb_build_object('vencen_hoy', vencen, 'transferencias', transf, 'prospectos', prosp, 'caja', caja,
                                 -- VD-38 (mensajes de los socios) todavía no existe: queda en 0.
                                 'mensajes', 0);
  end if;
  if gestion then
    r := r || jsonb_build_object('socios', socios);
    if control is not null then r := r || jsonb_build_object('control', control); end if;
  end if;
  return r;
end $$;

-- ── La campana ya unida, con tipo y con las preferencias ────────────
create or replace function public.campana_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; c jsonb; k jsonb := '{"items": []}'::jsonb; items jsonb; apagados text[];
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  c := public.campana(p_gimnasio_id);
  if e.rol in ('dueno', 'encargado') then
    begin
      k := public.campana_control(p_gimnasio_id);
    exception when insufficient_privilege then
      k := '{"items": []}'::jsonb;   -- el encargado sin acceso al Resultado no ve el Control
    end;
  end if;
  select coalesce(array_agg(pa.tipo), '{}') into apagados from public.preferencias_aviso pa
   where pa.gimnasio_id = p_gimnasio_id and pa.usuario_id = auth.uid() and pa.canal = 'app' and not pa.activo;
  select coalesce(jsonb_agg(i || jsonb_build_object('tipo', privado.tipo_aviso(i ->> 'clave'))
                            order by (i ->> 'en')::timestamptz desc nulls last), '[]'::jsonb)
    into items
    from jsonb_array_elements((c -> 'items') || (k -> 'items')) i
   where privado.tipo_aviso(i ->> 'clave') is null or not (privado.tipo_aviso(i ->> 'clave') = any (apagados));
  return jsonb_build_object('items', items);
end $$;

-- ── Preferencias por tipo y canal ───────────────────────────────────
create or replace function public.preferencias_aviso_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  return coalesce((select jsonb_agg(jsonb_build_object('tipo', t, 'app', coalesce(
            (select pa.activo from public.preferencias_aviso pa
              where pa.gimnasio_id = p_gimnasio_id and pa.usuario_id = auth.uid() and pa.tipo = t and pa.canal = 'app'), true))
            order by o)
          from unnest(privado.tipos_aviso_de_rol(e.rol)) with ordinality x(t, o)), '[]'::jsonb);
end $$;

create or replace function public.guardar_preferencia_aviso(p_gimnasio_id uuid, p_tipo text, p_canal text, p_activo boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; n int;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  if p_canal is distinct from 'app' then raise exception 'Ese canal no se puede elegir acá' using errcode = '22023'; end if;
  if p_activo is null then raise exception 'Falta elegir si se prende o se apaga' using errcode = '22023'; end if;
  if p_tipo is null or not (p_tipo = any (privado.tipos_aviso_de_rol(e.rol))) then
    raise exception 'Ese tipo de aviso no es de tu rol' using errcode = '42501';
  end if;
  insert into public.preferencias_aviso (gimnasio_id, usuario_id, tipo, canal, activo)
  values (p_gimnasio_id, auth.uid(), p_tipo, p_canal, p_activo)
  on conflict (gimnasio_id, usuario_id, tipo, canal) do update set activo = excluded.activo, actualizado_en = now();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la preferencia'; end if;
end $$;

revoke all on function public.pendientes_panel(uuid), public.campana_panel(uuid), public.preferencias_aviso_panel(uuid),
  public.guardar_preferencia_aviso(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.pendientes_panel(uuid), public.campana_panel(uuid), public.preferencias_aviso_panel(uuid),
  public.guardar_preferencia_aviso(uuid, text, text, boolean) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.preferencias_aviso'::regclass) then raise exception 'Verificación: preferencias_aviso sin RLS'; end if;
  foreach f in array array['public.pendientes_panel(uuid)', 'public.campana_panel(uuid)', 'public.preferencias_aviso_panel(uuid)',
                           'public.guardar_preferencia_aviso(uuid, text, text, boolean)', 'privado.tipo_aviso(text)', 'privado.tipos_aviso_de_rol(text)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if privado.tipo_aviso('pago:abc') is distinct from 'comprobantes' or privado.tipo_aviso('acceso:rojo:x') is not null then
    raise exception 'Verificación: tipo_aviso';
  end if;
end $$;
