-- VD-24 · Lista de espera automática y motivo de "no podés reservar".
--
-- Lo que ya andaba (0011): cuando se libera un lugar, privado.promover_espera sube al primero de la
-- espera que todavía puede tomar la clase y deja el aviso en avisos_pendientes. Dos cancelaciones a
-- la vez no confirman a la misma persona porque ambas toman el candado de la fila de la clase.
--
-- Lo que se suma:
--   1. cancelar_reserva (privada y pública) DEVUELVE a quien subió de la espera (o null), para que el
--      servidor le mande el push apenas la base confirmó. Cambia el tipo de retorno: se borra la firma
--      vieja en esta misma migración (privado.cancelar_reserva y public.cancelar_reserva).
--   2. destinos_push_clases('lugar_liberado', reserva): a quién y qué texto del push (una vez por reserva).
--   3. motivo_reserva / motivos_reserva: la base dice si el socio puede reservar una clase y, si no,
--      el motivo en una frase y el botón que corresponde. Una sola fuente de verdad: usa
--      habilitacion_clase y calcular_acceso, no se reimplementa nada.
--   4. avisos_lugar_socio: lo que la app muestra arriba ("se liberó un lugar", "se canceló una clase").
-- No se tocan vender, registrar_ingreso, para_hacer_hoy, panel_gimnasio ni secciones_validas.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.promover_espera(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.promover_espera (0011)'; end if;
  if to_regprocedure('privado.habilitacion_clase(uuid, uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta privado.habilitacion_clase (0011)'; end if;
  if to_regprocedure('privado.bloqueo_reservas(uuid)') is null then raise exception 'Guarda: falta privado.bloqueo_reservas (0080)'; end if;
  if to_regprocedure('public.destinos_push_mensajes(text, uuid)') is null then raise exception 'Guarda: falta el push de mensajes (VD-38)'; end if;
  if to_regclass('public.avisos_pendientes') is null or to_regclass('public.envios_push') is null then raise exception 'Guarda: faltan avisos_pendientes o envios_push'; end if;
end $$;

-- ── 1. Cancelar una reserva devuelve a quien subió de la espera ─────
-- Copia de 0011 (la definición vigente: nadie más la redefine). Único cambio: returns uuid.
drop function if exists privado.cancelar_reserva(uuid, text, boolean, timestamptz);
create function privado.cancelar_reserva(p_reserva_id uuid, p_por text, p_sin_limite boolean, p_momento timestamptz) returns uuid
language plpgsql set search_path = '' as $$
declare r public.reservas; c public.clases; cfg public.configuracion_gimnasio; n int; limite timestamptz; subio uuid;
begin
  select * into r from public.reservas where id = p_reserva_id;
  if not found then raise exception 'Reserva inexistente' using errcode = 'P0002'; end if;
  select * into c from public.clases where id = r.clase_id for update;     -- el candado de la clase ordena a todos
  select * into r from public.reservas where id = p_reserva_id for update;
  if r.estado = 'cancelada' then raise exception 'La reserva ya estaba cancelada'; end if;
  if c.inicio <= p_momento then raise exception 'La clase ya empezó'; end if;
  select * into cfg from public.configuracion_gimnasio where gimnasio_id = c.gimnasio_id;
  limite := c.inicio - make_interval(hours => cfg.cancelacion_horas_limite);
  -- Quien subió de la espera cuando ya no se podía cancelar, sí puede cancelar.
  if not p_sin_limite and r.estado = 'confirmada' and limite < p_momento
     and (r.promovida_en is null or r.promovida_en < limite) then
    raise exception 'Faltan menos de % horas: cancelala desde recepción', cfg.cancelacion_horas_limite;
  end if;
  update public.reservas set estado = 'cancelada', cancelada_en = p_momento, cancelada_por = p_por
   where id = r.id and estado <> 'cancelada';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo cancelar la reserva'; end if;
  if r.estado = 'confirmada' then subio := privado.promover_espera(c.id, p_momento); end if;
  return subio;
end $$;
revoke all on function privado.cancelar_reserva(uuid, text, boolean, timestamptz) from public;

drop function if exists public.cancelar_reserva(uuid);
create function public.cancelar_reserva(p_reserva_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r public.reservas; sede uuid;
begin
  select * into r from public.reservas where id = p_reserva_id;
  if not found then raise exception 'Sin permiso o reserva inexistente' using errcode = '42501'; end if;
  select sede_id into sede from public.clases where id = r.clase_id;
  -- Si la persona es del equipo, cancela como equipo (sin límite de horas), aunque la reserva sea de un socio vinculado a su login.
  if r.gimnasio_id in (select privado.mis_gimnasios(array['dueno', 'encargado', 'recepcion'])) then
    perform privado.exigir_rol(r.gimnasio_id, array['dueno', 'encargado', 'recepcion'], sede);
    return privado.cancelar_reserva(p_reserva_id, 'equipo', true, now());
  elsif r.socio_id in (select privado.mis_socios()) then
    return privado.cancelar_reserva(p_reserva_id, 'socio', false, now());
  else
    raise exception 'Sin permiso o reserva inexistente' using errcode = '42501';
  end if;
end $$;

-- ── 2. El push de "se liberó un lugar" ──────────────────────────────
-- Solo la clave de servicio, después de que la base confirmó. Una vez por reserva promovida.
create or replace function public.destinos_push_clases(p_evento text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare x record; zona text; n int;
begin
  if p_evento <> 'lugar_liberado' then raise exception 'Evento desconocido: %', p_evento using errcode = '22023'; end if;
  select r.gimnasio_id, r.socio_id, k.inicio, a.nombre as actividad, s.usuario_id into x
    from public.reservas r join public.clases k on k.id = r.clase_id join public.actividades a on a.id = k.actividad_id
    join public.socios s on s.id = r.socio_id
   where r.id = p_id and r.estado = 'confirmada' and r.promovida_en is not null and k.cancelada_en is null;
  if not found then return null; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = x.gimnasio_id;
  insert into public.envios_push (gimnasio_id, evento, referencia) values (x.gimnasio_id, p_evento, p_id)
  on conflict (gimnasio_id, evento, referencia) do nothing;
  get diagnostics n = row_count;
  if n = 0 then return null; end if;   -- ya se mandó
  return jsonb_build_object('titulo', '✅ Se liberó un lugar: ya estás anotado',
    'cuerpo', x.actividad || ' del ' || privado.fecha_corta(x.inicio, zona) || ' a las ' || to_char(x.inicio at time zone zona, 'HH24:MI'),
    'url', '/app/clases', 'tipo', 'clases',
    'destinos', coalesce((select jsonb_agg(jsonb_build_object('endpoint', sp.endpoint, 'p256dh', sp.p256dh, 'auth', sp.auth))
                            from public.suscripciones_push sp
                           where sp.gimnasio_id = x.gimnasio_id and x.usuario_id is not null and sp.usuario_id = x.usuario_id
                             and 'clases' = any (sp.tipos)), '[]'::jsonb));
end $$;

-- ── 3. El motivo, calculado por la base ─────────────────────────────
-- puede = true significa "el botón funciona" (reservar o anotarse en espera). Si no, `motivo` es un código estable,
-- `texto` la frase para mostrar y `accion` el botón: reservar | espera | pagar | cambiar_plan | ninguna.
create or replace function privado.motivo_json(p_clase uuid, p_puede boolean, p_motivo text, p_texto text, p_accion text, p_etiqueta text,
                                               p_confirmadas int, p_espera int, p_cupo int) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('clase_id', p_clase, 'puede', p_puede, 'motivo', p_motivo, 'texto', p_texto, 'accion', p_accion,
                            'etiqueta', p_etiqueta, 'confirmadas', p_confirmadas, 'en_espera', p_espera, 'cupo', p_cupo)
$$;
revoke all on function privado.motivo_json(uuid, boolean, text, text, text, text, int, int, int) from public;

create or replace function privado.motivo_reserva(p_clase_id uuid, p_socio_id uuid, p_momento timestamptz, p_con_bloqueo boolean default true) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  c public.clases; cfg public.configuracion_gimnasio; v public.veredicto_acceso; h jsonb; b jsonb; zona text;
  conf int; esp int; mia public.reservas; pos int; abre date;
begin
  select * into c from public.clases where id = p_clase_id;
  if not found then raise exception 'Clase inexistente' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.socios where id = p_socio_id and gimnasio_id = c.gimnasio_id) then
    raise exception 'El socio no es de este gimnasio';
  end if;
  select * into cfg from public.configuracion_gimnasio where gimnasio_id = c.gimnasio_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = c.gimnasio_id;
  select count(*) filter (where estado = 'confirmada')::int, count(*) filter (where estado = 'espera')::int into conf, esp
    from public.reservas where clase_id = c.id;

  if cfg.modo_clases <> 'reserva' then
    return privado.motivo_json(c.id, false, 'sin_reserva', 'En este gimnasio las clases no se reservan: vení directo.', 'ninguna', null, conf, esp, c.cupo);
  end if;
  if c.cancelada_en is not null then
    return privado.motivo_json(c.id, false, 'clase_cancelada', 'Esta clase se canceló' || coalesce(': ' || c.cancelada_motivo, '.'), 'ninguna', null, conf, esp, c.cupo);
  end if;
  if c.inicio <= p_momento then
    return privado.motivo_json(c.id, false, 'clase_cerrada', 'La clase ya empezó: las reservas están cerradas.', 'ninguna', null, conf, esp, c.cupo);
  end if;
  if c.inicio > p_momento + make_interval(days => cfg.reserva_dias_anticipacion) then
    abre := privado.dia_local(c.inicio, zona) - cfg.reserva_dias_anticipacion;
    return privado.motivo_json(c.id, false, 'fuera_de_plazo',
      'Todavía no se puede reservar: se abre ' || cfg.reserva_dias_anticipacion || case when cfg.reserva_dias_anticipacion = 1 then ' día' else ' días' end
      || ' antes (desde el ' || to_char(abre, 'DD/MM') || ').', 'ninguna', null, conf, esp, c.cupo);
  end if;

  select * into mia from public.reservas where clase_id = c.id and socio_id = p_socio_id and estado <> 'cancelada';
  if found then
    if mia.estado = 'espera' then
      select count(*)::int + 1 into pos from public.reservas r where r.clase_id = c.id and r.estado = 'espera' and r.creado_en < mia.creado_en;
      return privado.motivo_json(c.id, false, 'ya_reservada', 'Estás en la lista de espera (' || pos || '°): si se libera un lugar, quedás anotado solo.', 'ninguna', null, conf, esp, c.cupo);
    end if;
    return privado.motivo_json(c.id, false, 'ya_reservada', 'Ya tenés tu lugar en esta clase.', 'ninguna', null, conf, esp, c.cupo);
  end if;

  if p_con_bloqueo then
    b := privado.bloqueo_reservas(p_socio_id);
    if b is not null then
      return privado.motivo_json(c.id, false, 'bloqueo_faltas', b ->> 'texto', 'ninguna', null, conf, esp, c.cupo);
    end if;
  end if;

  h := privado.habilitacion_clase(p_socio_id, c.id, p_momento);
  if not (h ->> 'ok')::boolean then
    v := privado.calcular_acceso(p_socio_id, c.inicio, c.sede_id);
    if v.motivo = 'suspendido' then
      return privado.motivo_json(c.id, false, 'suspendido', h ->> 'texto', 'ninguna', null, conf, esp, c.cupo);
    elsif v.motivo = 'congelada' then
      return privado.motivo_json(c.id, false, 'congelada', 'Tu plan está congelado: ' || lower(left(v.texto, 1)) || substr(v.texto, 2) || '.', 'ninguna', null, conf, esp, c.cupo);
    elsif v.motivo = 'tope_semanal' then
      return privado.motivo_json(c.id, false, 'limite_semanal', 'Llegaste al límite de tu plan esta semana. ' || v.texto || '.', 'cambiar_plan', 'Cambiar de plan', conf, esp, c.cupo);
    elsif v.motivo in ('fuera_de_franja', 'fuera_de_sede') or (v.puede and v.via = 'membresia') then
      return privado.motivo_json(c.id, false, 'plan_no_incluye', coalesce(nullif(h ->> 'texto', ''), v.texto) || '.', 'cambiar_plan', 'Cambiar de plan', conf, esp, c.cupo);
    elsif (v.puede and v.via = 'pack') or v.motivo in ('pack_agotado', 'pack_vencido') then
      return privado.motivo_json(c.id, false, 'pack_sin_clases', coalesce(h ->> 'texto', v.texto) || ': comprá más clases para reservar.', 'pagar', 'Comprar clases', conf, esp, c.cupo);
    else
      return privado.motivo_json(c.id, false, 'vencido', coalesce(h ->> 'texto', v.texto) || ': pagá para poder reservar.', 'pagar', 'Pagar', conf, esp, c.cupo);
    end if;
  end if;

  if c.cupo is not null and conf >= c.cupo then
    return privado.motivo_json(c.id, true, 'cupo_lleno',
      'La clase está llena. ' || case esp when 0 then 'Anotate en la lista de espera: si se libera un lugar, quedás anotado solo.'
                                          else 'Hay ' || esp || case esp when 1 then ' persona' else ' personas' end || ' esperando: si te anotás, quedás ' || (esp + 1) || '°.' end,
      'espera', 'Anotarme en espera', conf, esp, c.cupo);
  end if;
  return privado.motivo_json(c.id, true, 'ok', case when c.cupo is null then 'Hay lugar.' else 'Quedan ' || (c.cupo - conf) || (case when c.cupo - conf = 1 then ' lugar.' else ' lugares.' end) end,
    'reservar', 'Reservar', conf, esp, c.cupo);
end $$;
revoke all on function privado.motivo_reserva(uuid, uuid, timestamptz, boolean) from public;

-- Para una clase y un socio. El socio pregunta por sí; la recepción por cualquiera de su gimnasio.
create or replace function public.motivo_reserva(p_clase_id uuid, p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; sede uuid; propio boolean;
begin
  select gimnasio_id, sede_id into g, sede from public.clases where id = p_clase_id;
  if g is null then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  propio := p_socio_id in (select privado.mis_socios());
  if not (propio or privado.es_servicio()) then
    perform privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], sede);
  end if;
  -- La falta por no cancelar frena al socio, no a la recepción que lo anota (igual que reservar).
  return privado.motivo_reserva(p_clase_id, p_socio_id, now(), propio and not privado.es_servicio());
end $$;

-- Para varias clases de una pantalla (un solo pedido): { "<clase_id>": {...}, ... }
create or replace function public.motivos_reserva(p_socio_id uuid, p_clase_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; propio boolean; cid uuid; r jsonb := '{}'::jsonb;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  propio := p_socio_id in (select privado.mis_socios());
  if not (propio or privado.es_servicio()) then
    perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']);
  end if;
  if coalesce(cardinality(p_clase_ids), 0) > 60 then raise exception 'Son demasiadas clases juntas' using errcode = '22023'; end if;
  foreach cid in array coalesce(p_clase_ids, '{}') loop
    if exists (select 1 from public.clases where id = cid and gimnasio_id = g) then
      r := r || jsonb_build_object(cid::text, privado.motivo_reserva(cid, p_socio_id, now(), propio and not privado.es_servicio()));
    end if;
  end loop;
  return r;
end $$;

-- ── 4. Lo que la app le cuenta al socio ─────────────────────────────
create or replace function public.avisos_lugar_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('tipo', x.tipo, 'texto', x.texto, 'clase_id', x.clase_id, 'creado_en', x.creado_en) order by x.creado_en desc)
                     from (select a.tipo, a.texto, a.clase_id, a.creado_en
                             from public.avisos_pendientes a join public.clases k on k.id = a.clase_id
                            where a.socio_id = p_socio_id and a.tipo in ('lugar_liberado', 'clase_cancelada')
                              and a.creado_en > now() - interval '2 days' and k.inicio > now()
                            order by a.creado_en desc limit 5) x), '[]'::jsonb);
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.cancelar_reserva(uuid), public.destinos_push_clases(text, uuid), public.motivo_reserva(uuid, uuid),
  public.motivos_reserva(uuid, uuid[]), public.avisos_lugar_socio(uuid) from public, anon, authenticated;
grant execute on function public.cancelar_reserva(uuid), public.motivo_reserva(uuid, uuid), public.motivos_reserva(uuid, uuid[]),
  public.avisos_lugar_socio(uuid) to authenticated, service_role;
grant execute on function public.destinos_push_clases(text, uuid) to service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.cancelar_reserva(uuid)', 'public.destinos_push_clases(text, uuid)', 'public.motivo_reserva(uuid, uuid)',
                           'public.motivos_reserva(uuid, uuid[])', 'public.avisos_lugar_socio(uuid)', 'privado.cancelar_reserva(uuid, text, boolean, timestamptz)',
                           'privado.motivo_reserva(uuid, uuid, timestamptz, boolean)', 'privado.motivo_json(uuid, boolean, text, text, text, text, int, int, int)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if has_function_privilege('authenticated', 'public.destinos_push_clases(text, uuid)', 'execute') then
    raise exception 'Verificación: destinos_push_clases es solo para la clave de servicio';
  end if;
  if (select prorettype from pg_proc where oid = 'public.cancelar_reserva(uuid)'::regprocedure) <> 'uuid'::regtype then
    raise exception 'Verificación: cancelar_reserva tiene que devolver uuid';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'cancelar_reserva') <> 1 then
    raise exception 'Verificación: quedó más de una cancelar_reserva';
  end if;
end $$;
