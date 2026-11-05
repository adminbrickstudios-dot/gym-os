-- 0075 · Notificaciones push (PUSH-1).
-- Web push con claves VAPID propias (variables de entorno, nunca en la base
-- ni en el código): sin costo y sin un servicio de terceros. Cada dispositivo
-- se suscribe y elige qué recibir. El envío lo hace el servidor después de
-- que la base confirmó el hecho (comprobante informado, pago resuelto, caja
-- con diferencia, retiro, pedido de anulación, clase cancelada): a quién y
-- con qué texto lo decide la base, y cada hecho se manda una sola vez.
-- Nada depende de esto: si no llega, todo sigue en la campana (AVI-5).
--
--   guardar_suscripcion_push(gimnasio, endpoint, p256dh, auth, tipos)   quien es del gimnasio
--   borrar_suscripcion_push(gimnasio, endpoint)
--   suscripcion_push(gimnasio, endpoint)       la de este dispositivo y los tipos que puede elegir
--   destinos_push(evento, id)                  SOLO la clave de servicio: a quién y qué
--   baja_push(endpoint)                        SOLO la clave de servicio: el navegador la dio de baja

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.resumen_dueno(uuid, date, int)') is null then raise exception 'Guarda: falta la migración 0074'; end if;
end $$;

create table if not exists public.suscripciones_push (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  usuario_id   uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh       text not null check (length(p256dh) between 20 and 200),
  auth         text not null check (length(auth) between 8 and 100),
  tipos        text[] not null default '{}',
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, endpoint)
);
create index if not exists suscripciones_push_usuario on public.suscripciones_push (gimnasio_id, usuario_id);
alter table public.suscripciones_push enable row level security;
drop policy if exists propias_lee on public.suscripciones_push;
create policy propias_lee on public.suscripciones_push for select to authenticated using (usuario_id = auth.uid());
revoke all on table public.suscripciones_push from anon;

-- Cada hecho se manda una vez (si la acción se repite, no llega dos veces).
create table if not exists public.envios_push (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  evento       text not null,
  referencia   uuid not null,
  destinos     int not null default 0,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, evento, referencia)
);
alter table public.envios_push enable row level security;
revoke all on table public.envios_push from anon, authenticated;

-- Qué puede elegir cada uno (y qué recibe por defecto: todo lo suyo).
create or replace function privado.tipos_push(p_gimnasio_id uuid) returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(distinct t), '{}') from (
    select unnest(case e.rol when 'dueno' then array['comprobantes', 'caja', 'pedidos']
                             when 'encargado' then array['comprobantes', 'caja', 'pedidos']
                             when 'recepcion' then array['comprobantes'] else array[]::text[] end) t
      from public.equipo e where e.gimnasio_id = p_gimnasio_id and e.usuario_id = auth.uid() and e.activo
    union all
    select unnest(array['pagos', 'clases']) from public.socios s
     where s.gimnasio_id = p_gimnasio_id and s.usuario_id = auth.uid() and s.dado_de_baja_en is null
  ) x
$$;
revoke all on function privado.tipos_push(uuid) from public;

create or replace function public.guardar_suscripcion_push(p_gimnasio_id uuid, p_endpoint text, p_p256dh text, p_auth text, p_tipos text[] default null)
returns void language plpgsql security definer set search_path = '' as $$
declare puede text[]; elegidos text[];
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  puede := privado.tipos_push(p_gimnasio_id);
  if cardinality(puede) = 0 then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_endpoint is null or p_endpoint !~ '^https://' then raise exception 'Suscripción inválida' using errcode = '22023'; end if;
  elegidos := coalesce((select array_agg(t) from unnest(coalesce(p_tipos, puede)) t where t = any (puede)), '{}');
  insert into public.suscripciones_push (gimnasio_id, usuario_id, endpoint, p256dh, auth, tipos)
  values (p_gimnasio_id, auth.uid(), p_endpoint, p_p256dh, p_auth, elegidos)
  on conflict (gimnasio_id, endpoint) do update
    set usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth, tipos = excluded.tipos;
end $$;

create or replace function public.borrar_suscripcion_push(p_gimnasio_id uuid, p_endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  delete from public.suscripciones_push where gimnasio_id = p_gimnasio_id and endpoint = p_endpoint and usuario_id = auth.uid();
end $$;

create or replace function public.suscripcion_push(p_gimnasio_id uuid, p_endpoint text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare puede text[];
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  puede := privado.tipos_push(p_gimnasio_id);
  if cardinality(puede) = 0 then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return jsonb_build_object('puede', to_jsonb(puede),
    'tipos', (select to_jsonb(s.tipos) from public.suscripciones_push s
               where s.gimnasio_id = p_gimnasio_id and s.endpoint = p_endpoint and s.usuario_id = auth.uid()));
end $$;

-- A quién y qué, para un hecho que ya pasó. Solo la clave de servicio (el
-- servidor, después de que la acción salió bien). Devuelve vacío si ya se mandó.
create or replace function public.destinos_push(p_evento text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; tipo text; titulo text; cuerpo text; url text; usuarios uuid[]; zona text; n int;
        p record; t record; m record; pa record; c record;
begin
  if p_evento = 'comprobante' then
    select pg.id, pg.gimnasio_id, pg.monto, v.sede_id, trim(s.nombre || ' ' || s.apellido) as socio into p
      from public.pagos pg join public.ventas v on v.id = pg.venta_id left join public.socios s on s.id = v.socio_id
     where pg.id = p_id and pg.estado = 'pendiente';
    if not found then return null; end if;
    g := p.gimnasio_id; tipo := 'comprobantes'; url := '/panel/transferencias';
    titulo := '🏦 ' || coalesce(p.socio, 'Un socio') || ' mandó un comprobante';
    cuerpo := privado.formato_pesos(p.monto) || ' para revisar';
    select array_agg(e.usuario_id) into usuarios from public.equipo e
     where e.gimnasio_id = g and e.activo and e.rol in ('dueno', 'encargado', 'recepcion') and (e.sede_id is null or e.sede_id = p.sede_id);
  elsif p_evento = 'pago_resuelto' then
    select pg.id, pg.gimnasio_id, pg.monto, pg.estado, pg.rechazado_motivo, s.usuario_id into p
      from public.pagos pg join public.ventas v on v.id = pg.venta_id join public.socios s on s.id = v.socio_id
     where pg.id = p_id and pg.estado in ('aprobado', 'rechazado');
    if not found then return null; end if;
    g := p.gimnasio_id; tipo := 'pagos'; url := '/app';
    titulo := case p.estado when 'aprobado' then '✅ Aprobaron tu pago' else '🧾 No pudimos aprobar tu comprobante' end;
    cuerpo := case p.estado when 'aprobado' then privado.formato_pesos(p.monto) || '. Ya podés entrar.' else coalesce(p.rechazado_motivo, 'Mirá el motivo en la app') end;
    usuarios := array[p.usuario_id];
  elsif p_evento = 'caja_diferencia' then
    select tc.gimnasio_id, tc.monto_contado - tc.monto_esperado as dif, cj.nombre, tc.cerrado_por into t
      from public.turnos_caja tc join public.cajas cj on cj.id = tc.caja_id
     where tc.id = p_id and tc.cerrado_en is not null and tc.monto_contado <> tc.monto_esperado;
    if not found then return null; end if;
    g := t.gimnasio_id; tipo := 'caja'; url := '/panel/caja/historial';
    titulo := '⚖️ La ' || t.nombre || ' cerró con ' || privado.formato_pesos(abs(t.dif)) || case when t.dif > 0 then ' de más' else ' de menos' end;
    cuerpo := 'La cerró ' || coalesce((select q.nombre from public.equipo q where q.id = t.cerrado_por), 'alguien');
    select array_agg(e.usuario_id) into usuarios from public.equipo e
     where e.gimnasio_id = g and e.activo and e.rol in ('dueno', 'encargado') and e.id <> t.cerrado_por;
  elsif p_evento = 'caja_retiro' then
    select mc.gimnasio_id, mc.monto, mc.motivo, mc.creado_por into m from public.movimientos_caja mc where mc.id = p_id and mc.tipo = 'retiro';
    if not found then return null; end if;
    g := m.gimnasio_id; tipo := 'caja'; url := '/panel/caja/historial';
    titulo := '💸 Salieron ' || privado.formato_pesos(m.monto) || ' de la caja';
    cuerpo := coalesce((select q.nombre from public.equipo q where q.id = m.creado_por), 'Alguien') || ': ' || m.motivo;
    select array_agg(e.usuario_id) into usuarios from public.equipo e
     where e.gimnasio_id = g and e.activo and e.rol in ('dueno', 'encargado') and e.id <> m.creado_por;
  elsif p_evento = 'pedido_anulacion' then
    select x.gimnasio_id, x.motivo, x.pedido_por into pa from public.pedidos_anulacion x where x.id = p_id and x.estado = 'pendiente';
    if not found then return null; end if;
    g := pa.gimnasio_id; tipo := 'pedidos'; url := '/panel';
    titulo := '🧾 ' || coalesce((select q.nombre from public.equipo q where q.id = pa.pedido_por), 'La recepción') || ' pide anular una venta';
    cuerpo := pa.motivo;
    select array_agg(e.usuario_id) into usuarios from public.equipo e
     where e.gimnasio_id = g and e.activo and e.rol in ('dueno', 'encargado');
  elsif p_evento = 'clase_cancelada' then
    select k.id, k.gimnasio_id, k.inicio, k.cancelada_motivo, a.nombre into c
      from public.clases k join public.actividades a on a.id = k.actividad_id where k.id = p_id and k.cancelada_en is not null;
    if not found then return null; end if;
    g := c.gimnasio_id; tipo := 'clases'; url := '/app/clases';
    select zona_horaria into zona from public.gimnasios where id = g;
    titulo := '❌ Se canceló ' || c.nombre || ' del ' || to_char(c.inicio at time zone zona, 'DD/MM HH24:MI');
    cuerpo := coalesce(c.cancelada_motivo, 'Mirá las otras clases en la app');
    select array_agg(distinct s.usuario_id) into usuarios from public.reservas r join public.socios s on s.id = r.socio_id
     where r.clase_id = c.id and s.usuario_id is not null;
  else
    raise exception 'Evento desconocido: %', p_evento using errcode = '22023';
  end if;

  insert into public.envios_push (gimnasio_id, evento, referencia) values (g, p_evento, p_id)
  on conflict (gimnasio_id, evento, referencia) do nothing;
  get diagnostics n = row_count;
  if n = 0 then return null; end if;   -- ya se mandó

  return jsonb_build_object('titulo', titulo, 'cuerpo', cuerpo, 'url', url, 'tipo', tipo,
    'destinos', coalesce((select jsonb_agg(jsonb_build_object('endpoint', sp.endpoint, 'p256dh', sp.p256dh, 'auth', sp.auth))
                            from public.suscripciones_push sp
                           where sp.gimnasio_id = g and sp.usuario_id = any (coalesce(usuarios, '{}')) and tipo = any (sp.tipos)), '[]'::jsonb));
end $$;

create or replace function public.baja_push(p_endpoint text) returns void
language sql security definer set search_path = '' as $$
  delete from public.suscripciones_push where endpoint = p_endpoint
$$;

revoke all on function public.guardar_suscripcion_push(uuid, text, text, text, text[]), public.borrar_suscripcion_push(uuid, text),
  public.suscripcion_push(uuid, text), public.destinos_push(text, uuid), public.baja_push(text) from public, anon, authenticated;
grant execute on function public.guardar_suscripcion_push(uuid, text, text, text, text[]), public.borrar_suscripcion_push(uuid, text),
  public.suscripcion_push(uuid, text) to authenticated, service_role;
grant execute on function public.destinos_push(text, uuid), public.baja_push(text) to service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.suscripciones_push'::regclass) then raise exception 'Verificación: suscripciones_push sin RLS'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.envios_push'::regclass) then raise exception 'Verificación: envios_push sin RLS'; end if;
  foreach f in array array['public.guardar_suscripcion_push(uuid, text, text, text, text[])', 'public.borrar_suscripcion_push(uuid, text)',
                           'public.suscripcion_push(uuid, text)', 'public.destinos_push(text, uuid)', 'public.baja_push(text)', 'privado.tipos_push(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  foreach f in array array['public.destinos_push(text, uuid)', 'public.baja_push(text)'] loop
    if has_function_privilege('authenticated', f, 'execute') then raise exception 'Verificación: % es solo para la clave de servicio', f; end if;
  end loop;
end $$;
