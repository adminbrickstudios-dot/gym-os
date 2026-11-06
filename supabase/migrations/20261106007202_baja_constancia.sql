-- VD-46E · Baja con constancia (docs/v2/14-SITUACIONES.md, caso 30; Ley 24.240, art. 10 ter).
-- Pedir la baja por la app ya existía (0093). Faltaba lo que la vuelve un trámite con respaldo:
--   · cada baja tiene un CÓDIGO visible (BAJA-XXXXXXXX): el que pide desde la app lo ve al instante y después, como constancia;
--     la que se da en el mostrador también deja su código (queda un pedido ya resuelto, con quién y cuándo)
--   · un pedido sin resolver hace más de 24 h es un reclamo en potencia: aparece en Para hacer hoy ("2 bajas pedidas, 1 sin responder
--     hace más de 24 h") y avisa en la campana del dueño y el encargado
--   · dar la baja cierra lo pendiente en el mismo acto: anula los pagos que todavía no se aprobaron (y sus ventas pendientes), saca los turnos
--     fijos y cancela las reservas futuras. Los pagos aprobados NO se tocan: la devolución es un hecho aparte (VD-46J)
-- Funciones:
--   constancia_baja(socio)             el último pedido: código, estado, quién y cuándo (el socio mismo o el equipo)
--   dar_de_baja(socio, motivo)         (se reemplaza: ahora devuelve qué se cerró y el código) dueño, encargado, recepción
--   resolver_pedido_baja(pedido, dar)  (se reemplaza: la baja resuelve el pedido adentro)
--   pedido_baja_socio / pedidos_baja_pendientes   (se reemplazan: suman el código)
-- Control: moderacion_control suma las bajas. privado.avisos_moderacion suma los pedidos sin responder. No se toca vender.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.pedidos_baja') is null then raise exception 'Guarda: falta pedidos_baja (0093)'; end if;
  if to_regprocedure('public.dar_cortesia(uuid, int, uuid, text)') is null then raise exception 'Guarda: falta VD-46C (7201)'; end if;
  if to_regprocedure('privado.avisos_moderacion(uuid, text)') is null then raise exception 'Guarda: falta privado.avisos_moderacion'; end if;
  if to_regprocedure('privado.dar_de_baja(uuid, text, timestamptz)') is null then raise exception 'Guarda: falta privado.dar_de_baja'; end if;
  if to_regprocedure('privado.cancelar_reserva(uuid, text, boolean, timestamptz)') is null then raise exception 'Guarda: falta privado.cancelar_reserva'; end if;
  if to_regclass('public.turnos_fijos') is null then raise exception 'Guarda: falta turnos_fijos'; end if;
  if to_regprocedure('public.para_hacer_hoy(uuid)') is null then raise exception 'Guarda: falta para_hacer_hoy'; end if;
end $$;

-- ── El código ───────────────────────────────────────────────────────
alter table public.pedidos_baja add column if not exists codigo text not null default ('BAJA-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)));
create unique index if not exists pedidos_baja_codigo on public.pedidos_baja (gimnasio_id, codigo);
create index if not exists pedidos_baja_pendientes on public.pedidos_baja (gimnasio_id, pedido_en) where estado = 'pendiente';
create index if not exists socios_baja_control on public.socios (gimnasio_id, dado_de_baja_en desc) where dado_de_baja_en is not null;

-- ── Lo que ve el equipo y el socio ──────────────────────────────────
create or replace function public.pedido_baja_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_socio_id not in (select privado.mis_socios()) then perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']); end if;
  return (select jsonb_build_object('pedido_id', p.id, 'motivo', p.motivo, 'nota', p.nota, 'pedido_en', p.pedido_en, 'codigo', p.codigo)
            from public.pedidos_baja p where p.socio_id = p_socio_id and p.estado = 'pendiente');
end $$;

create or replace function public.pedidos_baja_pendientes(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return coalesce((select jsonb_agg(jsonb_build_object('pedido_id', p.id, 'socio_id', s.id, 'nombre', trim(s.nombre || ' ' || s.apellido),
            'motivo', p.motivo, 'nota', p.nota, 'pedido_en', p.pedido_en, 'codigo', p.codigo, 'tarde', p.pedido_en < now() - interval '24 hours') order by p.pedido_en)
    from public.pedidos_baja p join public.socios s on s.id = p.socio_id
   where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente'), '[]'::jsonb);
end $$;

-- La constancia: el último pedido (o la baja dada en el mostrador) con su código, para el propio socio y para el equipo.
create or replace function public.constancia_baja(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_socio_id not in (select privado.mis_socios()) then perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']); end if;
  return (select jsonb_build_object('pedido_id', p.id, 'codigo', p.codigo, 'estado', p.estado, 'motivo', p.motivo, 'pedido_en', p.pedido_en,
                                    'resuelto_en', p.resuelto_en, 'resuelto_por', q.nombre)
            from public.pedidos_baja p left join public.equipo q on q.id = p.resuelto_por
           where p.socio_id = p_socio_id order by p.pedido_en desc limit 1);
end $$;

-- ── Cerrar lo pendiente de un socio que se va ───────────────────────
-- Pagos pendientes (y las ventas que dependían de ellos), turnos fijos y reservas futuras. Devuelve cuánto se cerró.
create or replace function privado.cerrar_pendientes_baja(p_socio_id uuid, p_momento timestamptz, p_actor uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare g uuid; v record; r record; t record; pagos int := 0; ventas int := 0; turnos int := 0; reservas int := 0; n int;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  -- Pagos que esperan aprobación: no se cobraron, no se cobran.
  for v in select ve.id from public.ventas ve where ve.socio_id = p_socio_id and ve.estado = 'pendiente' for update loop
    update public.pagos set estado = 'rechazado', rechazado_en = p_momento, rechazado_por = p_actor, rechazado_motivo = 'Baja del socio'
     where venta_id = v.id and estado = 'pendiente';
    get diagnostics n = row_count; pagos := pagos + n;
    if p_actor is not null and not exists (select 1 from public.pagos x where x.venta_id = v.id and x.estado in ('pendiente', 'aprobado')) then
      update public.ventas set estado = 'anulada', anulada_en = p_momento, anulada_por = p_actor, anulada_motivo = 'Baja del socio'
       where id = v.id and estado = 'pendiente';
      get diagnostics n = row_count; ventas := ventas + n;
    end if;
  end loop;
  -- Turnos fijos: se sacan, y con ellos las reservas que dejaron hechas.
  for t in select tf.id from public.turnos_fijos tf where tf.socio_id = p_socio_id and tf.hasta is null for update loop
    update public.turnos_fijos set hasta = greatest(p_momento, desde), quitado_por = p_actor where id = t.id and hasta is null;
    turnos := turnos + 1;
  end loop;
  -- Reservas futuras (confirmadas o en espera).
  for r in select x.id from public.reservas x join public.clases c on c.id = x.clase_id
            where x.socio_id = p_socio_id and x.estado <> 'cancelada' and c.inicio > p_momento order by c.inicio loop
    perform privado.cancelar_reserva(r.id, 'equipo', true, p_momento);
    reservas := reservas + 1;
  end loop;
  return jsonb_build_object('pagos_anulados', pagos, 'ventas_anuladas', ventas, 'turnos_quitados', turnos, 'reservas_canceladas', reservas);
end $$;
revoke all on function privado.cerrar_pendientes_baja(uuid, timestamptz, uuid) from public, anon, authenticated;

-- La baja completa: la ficha, lo pendiente, el pedido (el que había, o uno nuevo ya resuelto para que quede el código).
create or replace function privado.dar_de_baja_completa(p_socio_id uuid, p_motivo text, p_actor uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare g uuid; ahora timestamptz := now(); pid uuid; cod text; cierre jsonb; v_motivo text := p_motivo; n int;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  perform privado.dar_de_baja(p_socio_id, p_motivo, ahora);
  cierre := privado.cerrar_pendientes_baja(p_socio_id, ahora, p_actor);
  update public.pedidos_baja set estado = 'dado_de_baja', resuelto_en = ahora, resuelto_por = p_actor
   where socio_id = p_socio_id and estado = 'pendiente' returning id, codigo into pid, cod;
  if pid is null then
    -- Baja pedida en el mostrador: también deja su constancia.
    if v_motivo is null or v_motivo not in ('precio', 'horario', 'mudanza', 'otro_gimnasio', 'sin_tiempo', 'insatisfecho', 'otro') then v_motivo := 'otro'; end if;
    insert into public.pedidos_baja (gimnasio_id, socio_id, motivo, estado, pedido_en, pedido_por, resuelto_en, resuelto_por)
    values (g, p_socio_id, v_motivo, 'dado_de_baja', ahora, auth.uid(), ahora, p_actor) returning id, codigo into pid, cod;
  end if;
  get diagnostics n = row_count;
  return cierre || jsonb_build_object('pedido_id', pid, 'codigo', cod);
end $$;
revoke all on function privado.dar_de_baja_completa(uuid, text, uuid) from public, anon, authenticated;

drop function if exists public.dar_de_baja(uuid, text);
create function public.dar_de_baja(p_socio_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion']);
  return privado.dar_de_baja_completa(p_socio_id, p_motivo, eid);
end $$;

-- Dar de baja (con el motivo que dio) o "se queda" (se habló y sigue). Dar la baja resuelve el pedido adentro.
create or replace function public.resolver_pedido_baja(p_pedido_id uuid, p_dar_de_baja boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.pedidos_baja; eid uuid; n int;
begin
  select * into p from public.pedidos_baja where id = p_pedido_id for update;
  if not found then raise exception 'Sin permiso o pedido inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(p.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if p.estado <> 'pendiente' then raise exception 'Ese pedido ya se resolvió' using errcode = '22023'; end if;
  if p_dar_de_baja then
    perform privado.dar_de_baja_completa(p.socio_id, p.motivo, eid);
    if not exists (select 1 from public.pedidos_baja x where x.id = p.id and x.estado = 'dado_de_baja') then raise exception 'No se pudo resolver el pedido'; end if;
  else
    update public.pedidos_baja set estado = 'se_queda', resuelto_en = now(), resuelto_por = eid where id = p.id and estado = 'pendiente';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo resolver el pedido'; end if;
  end if;
end $$;

-- ── Para hacer hoy: las bajas sin responder hace más de 24 h se dicen ──
-- Se parcha la función vigente (otros ítems también la tocan esta noche): se cambia solo el texto de las bajas.
do $$
declare d text;
  viejo constant text := $v$texto := cant || case when cant = 1 then ' baja pedida desde la app' else ' bajas pedidas desde la app' end;$v$;
  nuevo constant text := $n$texto := cant || case when cant = 1 then ' baja pedida desde la app' else ' bajas pedidas desde la app' end
        || coalesce((select ' (' || count(*) || ' sin responder hace más de 24 h)' from public.pedidos_baja pb
                      where pb.gimnasio_id = p_gimnasio_id and pb.estado = 'pendiente' and pb.pedido_en < now() - interval '24 hours' having count(*) > 0), '');$n$;
begin
  d := pg_get_functiondef('public.para_hacer_hoy(uuid)'::regprocedure);
  if position('sin responder hace más de 24 h' in d) = 0 then
    if position(viejo in d) = 0 then raise exception 'Guarda: para_hacer_hoy cambió: no encuentro el texto de las bajas pedidas'; end if;
    execute replace(d, viejo, nuevo);
  end if;
end $$;

-- ── moderacion_control: copia de 7201 + las bajas ──
create or replace function public.moderacion_control(p_gimnasio_id uuid, p_desde date, p_hasta date, p_limite int default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; ini timestamptz; fin timestamptz; lim int := coalesce(p_limite, 50); filas jsonb;
begin
  perform privado.exigir_resultado(p_gimnasio_id);
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'Elegí desde y hasta qué día.' using errcode = '22023'; end if;
  if p_hasta - p_desde > 366 then raise exception 'Se mira hasta un año por vez.' using errcode = '22023'; end if;
  if lim < 1 or lim > 200 then raise exception 'Se piden de 1 a 200 por vez.' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  ini := privado.medianoche(p_desde, zona);
  fin := privado.medianoche(p_hasta + 1, zona);
  select coalesce(jsonb_agg(jsonb_build_object('tipo', u.tipo, 'clave', u.clave, 'en', u.en, 'quien', u.quien, 'socio_id', u.socio_id,
           'socio', nullif(trim(s.nombre || ' ' || s.apellido), ''), 'monto', u.monto, 'detalle', u.detalle) order by u.en desc, u.clave desc), '[]'::jsonb)
    into filas
    from (
      select * from (
        (select x.tipo::text as tipo, x.creado_en as en, 'susp:' || x.id::text as clave, q.nombre::text as quien, x.socio_id,
                null::numeric as monto,
                (x.motivo || case when x.hasta is not null then ' · hasta el ' || to_char(x.hasta at time zone zona, 'DD/MM') else '' end)::text as detalle
           from public.suspensiones x left join public.equipo q on q.gimnasio_id = x.gimnasio_id and q.usuario_id = x.creado_por
          where x.gimnasio_id = p_gimnasio_id and x.creado_en >= ini and x.creado_en < fin
          order by x.creado_en desc limit lim)
        union all
        (select 'levantamiento'::text, x.levantada_en, 'levanta:' || x.id::text, q.nombre::text, x.socio_id, null::numeric,
                (coalesce(x.levantada_motivo, '') || ' (era: ' || x.motivo || ')')::text
           from public.suspensiones x left join public.equipo q on q.gimnasio_id = x.gimnasio_id and q.usuario_id = x.levantada_por
          where x.gimnasio_id = p_gimnasio_id and x.levantada_en >= ini and x.levantada_en < fin
          order by x.levantada_en desc limit lim)
        union all
        (select 'cortesia'::text, c.creado_en, 'cortesia:' || c.id::text, q.nombre::text, c.socio_id, null::numeric,
                (round(extract(epoch from (c.hasta - c.desde)) / 86400)::int || case when round(extract(epoch from (c.hasta - c.desde)) / 86400)::int = 1 then ' día' else ' días' end
                 || ' · ' || coalesce(c.motivo, '') || case when c.anulada_en is not null then ' · ANULADA: ' || coalesce(c.anulada_motivo, '') else '' end)::text
           from public.coberturas c left join public.equipo q on q.gimnasio_id = c.gimnasio_id and q.usuario_id = c.creado_por
          where c.gimnasio_id = p_gimnasio_id and c.origen = 'cortesia' and c.creado_en >= ini and c.creado_en < fin
          order by c.creado_en desc limit lim)
        union all
        -- VD-46E: bajas, con su código de constancia y quién la dio
        (select 'baja'::text, so.dado_de_baja_en, 'baja:' || so.id::text, q.nombre::text, so.id, null::numeric,
                (coalesce(so.motivo_baja, 'sin motivo') || coalesce(' · ' || pb.codigo, ''))::text
           from public.socios so
           left join lateral (select p.codigo, p.resuelto_por from public.pedidos_baja p
                               where p.socio_id = so.id and p.estado = 'dado_de_baja' order by p.resuelto_en desc limit 1) pb on true
           left join public.equipo q on q.id = pb.resuelto_por
          where so.gimnasio_id = p_gimnasio_id and so.dado_de_baja_en >= ini and so.dado_de_baja_en < fin
          order by so.dado_de_baja_en desc limit lim)
      ) b order by b.en desc, b.clave desc limit lim
    ) u left join public.socios s on s.id = u.socio_id;
  return jsonb_build_object('items', filas);
end $$;

-- ── avisos_moderacion: copia de 7201 + los pedidos de baja sin responder ──
create or replace function privado.avisos_moderacion(p_gimnasio_id uuid, p_zona text) returns jsonb
language plpgsql stable set search_path = '' as $$
declare items jsonb := '[]'::jsonb; alerta int;
begin
  select cortesia_alerta_repetidas into alerta from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  -- Suspensiones y expulsiones cuya fecha de revisión ya llegó: alguien tiene que decidir si siguen.
  items := items || coalesce((select jsonb_agg(jsonb_build_object(
             'clave', 'revisar_suspension:' || x.id::text || ':' || to_char(x.revisar_en at time zone p_zona, 'YYYYMMDD'), 'emoji', '🚫',
             'titulo', 'Revisar ' || case when x.tipo = 'expulsion' then 'la expulsión' else 'la suspensión' end || ' de ' || trim(s.nombre || ' ' || s.apellido),
             'detalle', x.motivo, 'href', '/socios/' || s.id, 'en', x.revisar_en))
           from public.suspensiones x join public.socios s on s.id = x.socio_id
          where x.gimnasio_id = p_gimnasio_id and x.levantada_en is null and (x.hasta is null or x.hasta > now())
            and x.revisar_en is not null and x.revisar_en <= now()), '[]'::jsonb);
  -- Un socio con varias cortesías en poco tiempo (la clave cambia con la cantidad: si recibe otra, vuelve a avisar).
  items := items || coalesce((select jsonb_agg(jsonb_build_object(
             'clave', 'cortesias_repetidas:' || r.socio_id::text || ':' || r.n, 'emoji', '🎁',
             'titulo', trim(s.nombre || ' ' || s.apellido) || ' recibió ' || r.n || ' cortesías en 60 días',
             'detalle', 'Las dieron: ' || r.quienes, 'href', '/socios/' || s.id, 'en', r.ultima))
           from (select c.socio_id, count(*)::int as n, max(c.creado_en) as ultima, string_agg(distinct coalesce(q.nombre, 'alguien'), ', ') as quienes
                   from public.coberturas c left join public.equipo q on q.gimnasio_id = c.gimnasio_id and q.usuario_id = c.creado_por
                  where c.gimnasio_id = p_gimnasio_id and c.origen = 'cortesia' and c.anulada_en is null and c.creado_en > now() - interval '60 days'
                  group by c.socio_id having count(*) >= alerta) r
           join public.socios s on s.id = r.socio_id), '[]'::jsonb);
  -- VD-46E: la baja que pidió un socio y nadie contestó en 24 h (art. 10 ter: se pide por el mismo medio y se responde).
  items := items || coalesce((select jsonb_agg(jsonb_build_object(
             'clave', 'pedido_baja_tarde:' || p.id::text, 'emoji', '⏳',
             'titulo', trim(s.nombre || ' ' || s.apellido) || ' pidió la baja hace más de 24 h y nadie respondió',
             'detalle', 'Constancia ' || p.codigo, 'href', '/socios/' || s.id, 'en', p.pedido_en + interval '24 hours'))
           from public.pedidos_baja p join public.socios s on s.id = p.socio_id
          where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.pedido_en < now() - interval '24 hours'), '[]'::jsonb);
  return items;
end $$;

revoke all on function privado.avisos_moderacion(uuid, text) from public, anon, authenticated;
revoke all on function public.pedido_baja_socio(uuid), public.pedidos_baja_pendientes(uuid), public.constancia_baja(uuid), public.dar_de_baja(uuid, text),
  public.resolver_pedido_baja(uuid, boolean), public.moderacion_control(uuid, date, date, int) from public, anon, authenticated;
grant execute on function public.pedido_baja_socio(uuid), public.pedidos_baja_pendientes(uuid), public.constancia_baja(uuid), public.dar_de_baja(uuid, text),
  public.resolver_pedido_baja(uuid, boolean), public.moderacion_control(uuid, date, date, int) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.pedido_baja_socio(uuid)', 'public.pedidos_baja_pendientes(uuid)', 'public.constancia_baja(uuid)', 'public.dar_de_baja(uuid, text)',
                           'public.resolver_pedido_baja(uuid, boolean)', 'public.moderacion_control(uuid, date, date, int)', 'public.para_hacer_hoy(uuid)',
                           'privado.avisos_moderacion(uuid, text)', 'privado.cerrar_pendientes_baja(uuid, timestamptz, uuid)', 'privado.dar_de_baja_completa(uuid, text, uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if position('sin responder hace más de 24 h' in pg_get_functiondef('public.para_hacer_hoy(uuid)'::regprocedure)) = 0 then
    raise exception 'Verificación: Para hacer hoy no dice las bajas sin responder';
  end if;
  foreach f in array array['revisar_suspension', 'cortesias_repetidas', 'pedido_baja_tarde'] loop
    if position(f in pg_get_functiondef('privado.avisos_moderacion(uuid, text)'::regprocedure)) = 0 then raise exception 'Verificación: avisos_moderacion perdió %', f; end if;
  end loop;
  foreach f in array array['levanta:', 'cortesia:', 'baja:'] loop
    if position(f in pg_get_functiondef('public.moderacion_control(uuid, date, date, int)'::regprocedure)) = 0 then raise exception 'Verificación: moderacion_control perdió %', f; end if;
  end loop;
  if exists (select 1 from public.pedidos_baja where codigo is null) then raise exception 'Verificación: hay pedidos de baja sin código'; end if;
end $$;
