-- VD-38 · Mensajes de los socios al gimnasio (D27, docs/v2/05 §2c).
-- Consultas, quejas y objetos perdidos son mensajes dentro de la app, no un
-- WhatsApp suelto: llegan al panel en una bandeja, con estado, y el socio ve la
-- respuesta en la app. Hilos simples: un hilo por tema (motivo), varios mensajes.
--
--   hilos_socio        el hilo: socio, motivo, estado (nuevo / en_curso / resuelto)
--   mensajes_socio     cada mensaje del hilo: del socio o del equipo, con foto opcional
--   respuestas_rapidas_mensajes   textos guardados del gimnasio ("El horario de feriado es…")
--   config_mensajes    quién del equipo los ve: dueño y encargado siempre;
--                      la recepción solo si el dueño lo prende (patrón EQU-1, tabla propia:
--                      no se toca guardar_configuracion ni panel_gimnasio). El profe nunca.
--
-- Socio:  escribir_al_gimnasio · responder_hilo_socio · mis_mensajes · mi_hilo ·
--         mensajes_estado_socio · preparar_foto_mensaje / confirmar_foto_mensaje · foto_mensaje
-- Equipo: bandeja_mensajes · hilo_mensajes · responder_mensaje · cambiar_estado_hilo ·
--         historial_mensajes_socio · respuestas_rapidas · guardar_respuesta_rapida · quitar_respuesta_rapida ·
--         permisos_mensajes · guardar_permisos_mensajes · mensajes_sin_responder (para el contador de VD-37)
-- Servicio: destinos_push_mensajes (a quién avisar por push; cada mensaje se avisa una vez)
-- Foto: bucket privado mensajes_fotos; sube el servidor con la clave de servicio, la base arma la ruta.
-- Nunca datos de salud: el formulario avisa que no se cuenten diagnósticos; el sistema no clasifica el texto.
-- Sección "mensajes" apagable por gimnasio. No se tocan vender, registrar_ingreso, pendientes_panel ni para_hacer_hoy.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
  if to_regprocedure('privado.exigir_rol(uuid, text[], uuid)') is null then raise exception 'Guarda: falta privado.exigir_rol'; end if;
  if to_regprocedure('privado.mis_socios()') is null then raise exception 'Guarda: falta privado.mis_socios'; end if;
  if to_regprocedure('privado.secciones_validas()') is null then raise exception 'Guarda: falta privado.secciones_validas'; end if;
  if to_regclass('public.envios_push') is null then raise exception 'Guarda: falta envios_push (PUSH-1)'; end if;
  if to_regclass('public.suscripciones_push') is null then raise exception 'Guarda: falta suscripciones_push (PUSH-1)'; end if;
end $$;

-- ── Quién los ve ────────────────────────────────────────────────────
create table if not exists public.config_mensajes (
  gimnasio_id   uuid primary key references public.gimnasios(id),
  recepcion_ve  boolean not null default false,
  actualizado_en timestamptz not null default now()
);
alter table public.config_mensajes enable row level security;

-- ── Los hilos ───────────────────────────────────────────────────────
create table if not exists public.hilos_socio (
  id             uuid primary key default gen_random_uuid(),
  gimnasio_id    uuid not null references public.gimnasios(id),
  socio_id       uuid not null,
  motivo         text not null check (motivo in ('consulta', 'queja', 'objeto_perdido', 'otro')),
  estado         text not null default 'nuevo' check (estado in ('nuevo', 'en_curso', 'resuelto')),
  creado_en      timestamptz not null default now(),
  ultimo_en      timestamptz not null default now(),
  ultimo_autor   text not null default 'socio' check (ultimo_autor in ('socio', 'equipo')),
  socio_leyo_en  timestamptz,
  resuelto_en    timestamptz,
  resuelto_por   uuid,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, resuelto_por) references public.equipo (gimnasio_id, id),
  check ((estado = 'resuelto') = (resuelto_en is not null))
);
create index if not exists hilos_socio_bandeja on public.hilos_socio (gimnasio_id, estado, ultimo_en desc);
create index if not exists hilos_socio_socio on public.hilos_socio (gimnasio_id, socio_id, ultimo_en desc);
alter table public.hilos_socio enable row level security;

create table if not exists public.mensajes_socio (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  hilo_id      uuid not null,
  autor        text not null check (autor in ('socio', 'equipo')),
  equipo_id    uuid,
  texto        text not null check (length(texto) between 1 and 2000),
  foto_path    text,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, hilo_id) references public.hilos_socio (gimnasio_id, id),
  foreign key (gimnasio_id, equipo_id) references public.equipo (gimnasio_id, id),
  check ((autor = 'equipo') = (equipo_id is not null)),
  check (foto_path is null or autor = 'socio')
);
create index if not exists mensajes_socio_hilo on public.mensajes_socio (gimnasio_id, hilo_id, creado_en);
alter table public.mensajes_socio enable row level security;

create table if not exists public.respuestas_rapidas_mensajes (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  titulo       text not null check (length(titulo) between 1 and 60),
  texto        text not null check (length(texto) between 1 and 1000),
  orden        int not null default 0,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id)
);
create index if not exists respuestas_rapidas_gimnasio on public.respuestas_rapidas_mensajes (gimnasio_id, orden, creado_en);
alter table public.respuestas_rapidas_mensajes enable row level security;

-- ── Funciones internas ──────────────────────────────────────────────
-- ¿Soy del equipo de este gimnasio y puedo ver los mensajes? (dueño y encargado siempre;
-- recepción solo si el dueño lo prendió; el profe nunca). No tira error: sirve para las políticas.
create or replace function privado.puede_ver_mensajes(p_gimnasio_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.equipo e
     where e.gimnasio_id = p_gimnasio_id and e.usuario_id = auth.uid() and e.activo
       and (e.rol in ('dueno', 'encargado')
            or (e.rol = 'recepcion' and coalesce((select c.recepcion_ve from public.config_mensajes c where c.gimnasio_id = p_gimnasio_id), false)))
  )
$$;
revoke all on function privado.puede_ver_mensajes(uuid) from public;
grant execute on function privado.puede_ver_mensajes(uuid) to authenticated, service_role;

-- Corta con error (nunca una lista vacía) si no puedo ver los mensajes. Devuelve quién soy (con PIN, el operador).
create or replace function privado.exigir_mensajes(p_gimnasio_id uuid) returns public.equipo
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if e.rol = 'recepcion' and not coalesce((select c.recepcion_ve from public.config_mensajes c where c.gimnasio_id = p_gimnasio_id), false) then
    raise exception 'El dueño no le dio acceso a los mensajes de los socios a la recepción' using errcode = '42501';
  end if;
  return e;
end $$;
revoke all on function privado.exigir_mensajes(uuid) from public;

create or replace function privado.mensajes_prendidos(p_gimnasio_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select not ('mensajes' = any (c.secciones_apagadas)) from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id), true)
$$;
revoke all on function privado.mensajes_prendidos(uuid) from public;

-- ── Políticas: el socio los suyos; el equipo, según el dueño ───────
drop policy if exists hilos_lee on public.hilos_socio;
create policy hilos_lee on public.hilos_socio for select to authenticated
  using (socio_id in (select privado.mis_socios()) or privado.puede_ver_mensajes(gimnasio_id));
drop policy if exists mensajes_lee on public.mensajes_socio;
create policy mensajes_lee on public.mensajes_socio for select to authenticated
  using (hilo_id in (select h.id from public.hilos_socio h));
drop policy if exists respuestas_lee on public.respuestas_rapidas_mensajes;
create policy respuestas_lee on public.respuestas_rapidas_mensajes for select to authenticated
  using (privado.puede_ver_mensajes(gimnasio_id));
drop policy if exists config_lee on public.config_mensajes;
create policy config_lee on public.config_mensajes for select to authenticated
  using (privado.puede_ver_mensajes(gimnasio_id));

revoke all on table public.config_mensajes, public.hilos_socio, public.mensajes_socio, public.respuestas_rapidas_mensajes from anon, authenticated;
grant select on table public.config_mensajes, public.hilos_socio, public.mensajes_socio, public.respuestas_rapidas_mensajes to authenticated;

-- ── Permisos (el dueño decide si la recepción los ve) ──────────────
create or replace function public.permisos_mensajes(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return jsonb_build_object('recepcion_ve', coalesce((select c.recepcion_ve from public.config_mensajes c where c.gimnasio_id = p_gimnasio_id), false));
end $$;

create or replace function public.guardar_permisos_mensajes(p_gimnasio_id uuid, p_recepcion_ve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno']);
  if p_recepcion_ve is null then raise exception 'Elegí si la recepción los ve' using errcode = '22023'; end if;
  insert into public.config_mensajes (gimnasio_id, recepcion_ve) values (p_gimnasio_id, p_recepcion_ve)
  on conflict (gimnasio_id) do update set recepcion_ve = excluded.recepcion_ve, actualizado_en = now();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar el permiso'; end if;
end $$;

-- ── Del lado del socio ──────────────────────────────────────────────
-- ¿Puede escribir este gimnasio? ¿Cuántas respuestas no leyó? (una sola llamada para la fila de Yo)
create or replace function public.mensajes_estado_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select gimnasio_id into g from public.socios where id = p_socio_id;
  return jsonb_build_object('activo', privado.mensajes_prendidos(g),
    'sin_leer', (select count(*)::int from public.hilos_socio h
                  where h.socio_id = p_socio_id and h.ultimo_autor = 'equipo' and (h.socio_leyo_en is null or h.socio_leyo_en < h.ultimo_en)));
end $$;

create or replace function public.escribir_al_gimnasio(p_socio_id uuid, p_motivo text, p_texto text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.socios; t text := trim(coalesce(p_texto, '')); h uuid; m uuid;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.socios where id = p_socio_id;
  if not privado.mensajes_prendidos(s.gimnasio_id) then raise exception 'Este gimnasio no recibe mensajes por la app' using errcode = '22023'; end if;
  if p_motivo is null or p_motivo not in ('consulta', 'queja', 'objeto_perdido', 'otro') then raise exception 'Elegí sobre qué nos escribís' using errcode = '22023'; end if;
  if length(t) < 1 then raise exception 'Escribí tu mensaje' using errcode = '22023'; end if;
  if length(t) > 2000 then raise exception 'El mensaje es muy largo: hasta 2000 letras' using errcode = '22023'; end if;
  if (select count(*) from public.mensajes_socio x join public.hilos_socio y on y.id = x.hilo_id
       where y.socio_id = p_socio_id and x.autor = 'socio' and x.creado_en > now() - interval '1 day') >= 20 then
    raise exception 'Mandaste muchos mensajes hoy. Esperá la respuesta del gimnasio o escribinos mañana.' using errcode = '22023';
  end if;
  insert into public.hilos_socio (gimnasio_id, socio_id, motivo) values (s.gimnasio_id, s.id, p_motivo) returning id into h;
  insert into public.mensajes_socio (gimnasio_id, hilo_id, autor, texto) values (s.gimnasio_id, h, 'socio', t) returning id into m;
  return jsonb_build_object('hilo_id', h, 'mensaje_id', m);
end $$;

-- El socio sigue la conversación (si estaba resuelto, vuelve a nuevo).
create or replace function public.responder_hilo_socio(p_hilo_id uuid, p_texto text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h public.hilos_socio; t text := trim(coalesce(p_texto, '')); m uuid; n int;
begin
  select * into h from public.hilos_socio where id = p_hilo_id for update;
  if not found or h.socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso o mensaje inexistente' using errcode = '42501'; end if;
  if not privado.mensajes_prendidos(h.gimnasio_id) then raise exception 'Este gimnasio no recibe mensajes por la app' using errcode = '22023'; end if;
  if length(t) < 1 then raise exception 'Escribí tu mensaje' using errcode = '22023'; end if;
  if length(t) > 2000 then raise exception 'El mensaje es muy largo: hasta 2000 letras' using errcode = '22023'; end if;
  if (select count(*) from public.mensajes_socio x join public.hilos_socio y on y.id = x.hilo_id
       where y.socio_id = h.socio_id and x.autor = 'socio' and x.creado_en > now() - interval '1 day') >= 20 then
    raise exception 'Mandaste muchos mensajes hoy. Esperá la respuesta del gimnasio o escribinos mañana.' using errcode = '22023';
  end if;
  insert into public.mensajes_socio (gimnasio_id, hilo_id, autor, texto) values (h.gimnasio_id, h.id, 'socio', t) returning id into m;
  update public.hilos_socio set estado = 'nuevo', resuelto_en = null, resuelto_por = null, ultimo_en = now(), ultimo_autor = 'socio', socio_leyo_en = now()
   where id = h.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo enviar el mensaje'; end if;
  return jsonb_build_object('hilo_id', h.id, 'mensaje_id', m);
end $$;

create or replace function public.mis_mensajes(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'hilo_id', h.id, 'motivo', h.motivo, 'estado', h.estado, 'creado_en', h.creado_en, 'ultimo_en', h.ultimo_en, 'ultimo_autor', h.ultimo_autor,
      'sin_leer', h.ultimo_autor = 'equipo' and (h.socio_leyo_en is null or h.socio_leyo_en < h.ultimo_en),
      'extracto', left((select x.texto from public.mensajes_socio x where x.hilo_id = h.id order by x.creado_en desc, x.id desc limit 1), 140)
    ) order by h.ultimo_en desc) from public.hilos_socio h where h.socio_id = p_socio_id), '[]'::jsonb);
end $$;

-- Un hilo mío, con todos sus mensajes. Al abrirlo queda leído (se apaga el aviso).
create or replace function public.mi_hilo(p_hilo_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h public.hilos_socio;
begin
  select * into h from public.hilos_socio where id = p_hilo_id;
  if not found or h.socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso o mensaje inexistente' using errcode = '42501'; end if;
  update public.hilos_socio set socio_leyo_en = now() where id = h.id and (socio_leyo_en is null or socio_leyo_en < ultimo_en);
  return jsonb_build_object('hilo_id', h.id, 'socio_id', h.socio_id, 'motivo', h.motivo, 'estado', h.estado, 'creado_en', h.creado_en,
    'mensajes', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'autor', x.autor, 'texto', x.texto, 'con_foto', x.foto_path is not null, 'creado_en', x.creado_en)
                                           order by x.creado_en, x.id) from public.mensajes_socio x where x.hilo_id = h.id), '[]'::jsonb));
end $$;

-- ── Foto (sube el servidor con la clave de servicio) ───────────────
create or replace function public.preparar_foto_mensaje(p_mensaje_id uuid, p_ext text) returns text
language plpgsql security definer set search_path = '' as $$
declare m public.mensajes_socio; h public.hilos_socio;
begin
  select * into m from public.mensajes_socio where id = p_mensaje_id;
  if not found then raise exception 'Sin permiso o mensaje inexistente' using errcode = '42501'; end if;
  select * into h from public.hilos_socio where id = m.hilo_id;
  if m.autor <> 'socio' or h.socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso o mensaje inexistente' using errcode = '42501'; end if;
  if m.foto_path is not null then raise exception 'Ese mensaje ya tiene su foto' using errcode = '22023'; end if;
  if p_ext not in ('jpg', 'png', 'webp') then raise exception 'La foto tiene que ser JPG, PNG o WEBP' using errcode = '22023'; end if;
  return m.gimnasio_id::text || '/' || m.hilo_id::text || '/' || m.id::text || '-' || replace(gen_random_uuid()::text, '-', '') || '.' || p_ext;
end $$;

create or replace function public.confirmar_foto_mensaje(p_mensaje_id uuid, p_ruta text) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.mensajes_socio; h public.hilos_socio; n int;
begin
  select * into m from public.mensajes_socio where id = p_mensaje_id for update;
  if not found then raise exception 'Sin permiso o mensaje inexistente' using errcode = '42501'; end if;
  select * into h from public.hilos_socio where id = m.hilo_id;
  if m.autor <> 'socio' or h.socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso o mensaje inexistente' using errcode = '42501'; end if;
  if p_ruta is null or p_ruta !~ ('^' || m.gimnasio_id::text || '/' || m.hilo_id::text || '/' || m.id::text || '-[0-9a-f]{32}\.(jpg|png|webp)$') then
    raise exception 'Ruta de foto inválida';
  end if;
  update public.mensajes_socio set foto_path = p_ruta where id = m.id and foto_path is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese mensaje ya tiene su foto' using errcode = '22023'; end if;
end $$;

-- La ruta de la foto, para firmarla: la ve quien escribió o quien del equipo puede ver los mensajes.
create or replace function public.foto_mensaje(p_mensaje_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare m public.mensajes_socio; h public.hilos_socio;
begin
  select * into m from public.mensajes_socio where id = p_mensaje_id;
  if not found then raise exception 'Sin permiso o mensaje inexistente' using errcode = '42501'; end if;
  select * into h from public.hilos_socio where id = m.hilo_id;
  if not (h.socio_id in (select privado.mis_socios()) or privado.puede_ver_mensajes(m.gimnasio_id)) then
    raise exception 'Sin permiso o mensaje inexistente' using errcode = '42501';
  end if;
  return m.foto_path;
end $$;

-- ── Del lado del equipo ─────────────────────────────────────────────
-- p_estado: nuevo · en_curso · resuelto · abiertos (nuevo y en curso) · null = todos.
create or replace function public.bandeja_mensajes(p_gimnasio_id uuid, p_estado text default 'abiertos', p_limite int default 100) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := coalesce(p_limite, 100); filas jsonb; cuentas jsonb;
begin
  perform privado.exigir_mensajes(p_gimnasio_id);
  if p_estado is not null and p_estado not in ('nuevo', 'en_curso', 'resuelto', 'abiertos') then raise exception 'Ese estado no existe' using errcode = '22023'; end if;
  if lim < 1 or lim > 200 then raise exception 'Se piden de 1 a 200 por vez.' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(z.fila order by z.sin_responder desc, z.ultimo_en desc), '[]'::jsonb) into filas from (
    select h.ultimo_en, (h.ultimo_autor = 'socio' and h.estado <> 'resuelto') as sin_responder,
           jsonb_build_object('hilo_id', h.id, 'socio_id', h.socio_id, 'socio', trim(s.nombre || ' ' || s.apellido), 'motivo', h.motivo, 'estado', h.estado,
             'creado_en', h.creado_en, 'ultimo_en', h.ultimo_en, 'ultimo_autor', h.ultimo_autor,
             'sin_responder', (h.ultimo_autor = 'socio' and h.estado <> 'resuelto'),
             'con_foto', exists (select 1 from public.mensajes_socio f where f.hilo_id = h.id and f.foto_path is not null),
             'extracto', left((select x.texto from public.mensajes_socio x where x.hilo_id = h.id order by x.creado_en desc, x.id desc limit 1), 140)) as fila
      from public.hilos_socio h join public.socios s on s.id = h.socio_id
     where h.gimnasio_id = p_gimnasio_id
       and (p_estado is null or (p_estado = 'abiertos' and h.estado <> 'resuelto') or h.estado = p_estado)
     order by (h.ultimo_autor = 'socio' and h.estado <> 'resuelto') desc, h.ultimo_en desc
     limit lim
  ) z;
  select jsonb_build_object('nuevo', count(*) filter (where estado = 'nuevo'), 'en_curso', count(*) filter (where estado = 'en_curso'),
                            'resuelto', count(*) filter (where estado = 'resuelto'),
                            'sin_responder', count(*) filter (where ultimo_autor = 'socio' and estado <> 'resuelto'))
    into cuentas from public.hilos_socio where gimnasio_id = p_gimnasio_id;
  return jsonb_build_object('items', filas, 'conteos', cuentas);
end $$;

create or replace function public.hilo_mensajes(p_hilo_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare h public.hilos_socio;
begin
  select * into h from public.hilos_socio where id = p_hilo_id;
  if not found then raise exception 'Sin permiso o mensaje inexistente' using errcode = '42501'; end if;
  perform privado.exigir_mensajes(h.gimnasio_id);
  return jsonb_build_object('hilo_id', h.id, 'socio_id', h.socio_id,
    'socio', (select trim(s.nombre || ' ' || s.apellido) from public.socios s where s.id = h.socio_id),
    'motivo', h.motivo, 'estado', h.estado, 'creado_en', h.creado_en, 'resuelto_en', h.resuelto_en,
    'mensajes', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'autor', x.autor, 'texto', x.texto, 'con_foto', x.foto_path is not null,
                                                              'creado_en', x.creado_en, 'quien', q.nombre) order by x.creado_en, x.id)
                            from public.mensajes_socio x left join public.equipo q on q.id = x.equipo_id where x.hilo_id = h.id), '[]'::jsonb));
end $$;

-- Contestar: queda escrito quién, el hilo pasa a "en curso" y el socio lo ve (y le llega el aviso).
create or replace function public.responder_mensaje(p_hilo_id uuid, p_texto text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h public.hilos_socio; e public.equipo; t text := trim(coalesce(p_texto, '')); m uuid; n int;
begin
  select * into h from public.hilos_socio where id = p_hilo_id for update;
  if not found then raise exception 'Sin permiso o mensaje inexistente' using errcode = '42501'; end if;
  e := privado.exigir_mensajes(h.gimnasio_id);
  if length(t) < 1 then raise exception 'Escribí la respuesta' using errcode = '22023'; end if;
  if length(t) > 2000 then raise exception 'La respuesta es muy larga: hasta 2000 letras' using errcode = '22023'; end if;
  insert into public.mensajes_socio (gimnasio_id, hilo_id, autor, equipo_id, texto) values (h.gimnasio_id, h.id, 'equipo', e.id, t) returning id into m;
  update public.hilos_socio set estado = 'en_curso', resuelto_en = null, resuelto_por = null, ultimo_en = now(), ultimo_autor = 'equipo'
   where id = h.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo enviar la respuesta'; end if;
  return jsonb_build_object('hilo_id', h.id, 'mensaje_id', m);
end $$;

create or replace function public.cambiar_estado_hilo(p_hilo_id uuid, p_estado text) returns void
language plpgsql security definer set search_path = '' as $$
declare h public.hilos_socio; e public.equipo; n int;
begin
  select * into h from public.hilos_socio where id = p_hilo_id for update;
  if not found then raise exception 'Sin permiso o mensaje inexistente' using errcode = '42501'; end if;
  e := privado.exigir_mensajes(h.gimnasio_id);
  if p_estado is null or p_estado not in ('nuevo', 'en_curso', 'resuelto') then raise exception 'Ese estado no existe' using errcode = '22023'; end if;
  update public.hilos_socio set estado = p_estado,
         resuelto_en = case when p_estado = 'resuelto' then now() else null end,
         resuelto_por = case when p_estado = 'resuelto' then e.id else null end
   where id = h.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo cambiar el estado'; end if;
end $$;

-- Lo que este socio escribió, para su ficha. Quien no ve los mensajes recibe error (la ficha esconde la tarjeta).
create or replace function public.historial_mensajes_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios;
begin
  select * into s from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_mensajes(s.gimnasio_id);
  return coalesce((select jsonb_agg(jsonb_build_object('hilo_id', h.id, 'motivo', h.motivo, 'estado', h.estado, 'creado_en', h.creado_en, 'ultimo_en', h.ultimo_en,
      'sin_responder', h.ultimo_autor = 'socio' and h.estado <> 'resuelto',
      'extracto', left((select x.texto from public.mensajes_socio x where x.hilo_id = h.id order by x.creado_en desc, x.id desc limit 1), 140)
    ) order by h.ultimo_en desc) from public.hilos_socio h where h.socio_id = s.id), '[]'::jsonb);
end $$;

-- Cuántos esperan respuesta. Lo llama el contador de "Para hacer hoy" (VD-37): por eso, quien es del
-- equipo pero no los ve (recepción sin permiso) recibe 0 y no un error que rompería la pantalla que lo suma;
-- quien no es del equipo, error.
create or replace function public.mensajes_sin_responder(p_gimnasio_id uuid) returns int
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  if not privado.puede_ver_mensajes(p_gimnasio_id) then return 0; end if;
  return (select count(*)::int from public.hilos_socio h
           where h.gimnasio_id = p_gimnasio_id and h.ultimo_autor = 'socio' and h.estado <> 'resuelto');
end $$;

-- ¿Puedo ver los mensajes? Para que el panel saque "Mensajes" del menú de la recepción cuando el dueño no se lo prendió
-- (panel_gimnasio no se toca). Cualquiera del equipo puede preguntarlo; la base exige el permiso igual en cada función.
create or replace function public.ver_mensajes_equipo(p_gimnasio_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  return privado.puede_ver_mensajes(p_gimnasio_id);
end $$;

-- ── Respuestas rápidas ──────────────────────────────────────────────
create or replace function public.respuestas_rapidas(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_mensajes(p_gimnasio_id);
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'titulo', r.titulo, 'texto', r.texto) order by r.orden, r.creado_en)
                     from public.respuestas_rapidas_mensajes r where r.gimnasio_id = p_gimnasio_id), '[]'::jsonb);
end $$;

-- Crear (p_id nulo) o cambiar una. Dueño y encargado: son lo que se le dice a los socios en nombre del gimnasio.
create or replace function public.guardar_respuesta_rapida(p_gimnasio_id uuid, p_id uuid, p_titulo text, p_texto text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare ti text := trim(coalesce(p_titulo, '')); te text := trim(coalesce(p_texto, '')); r uuid; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if length(ti) < 1 or length(ti) > 60 then raise exception 'El nombre de la respuesta va de 1 a 60 letras' using errcode = '22023'; end if;
  if length(te) < 1 or length(te) > 1000 then raise exception 'La respuesta va de 1 a 1000 letras' using errcode = '22023'; end if;
  if p_id is null then
    if (select count(*) from public.respuestas_rapidas_mensajes where gimnasio_id = p_gimnasio_id) >= 30 then
      raise exception 'Ya hay 30 respuestas rápidas: quitá alguna antes de sumar otra' using errcode = '22023';
    end if;
    insert into public.respuestas_rapidas_mensajes (gimnasio_id, titulo, texto, orden)
    values (p_gimnasio_id, ti, te, coalesce((select max(orden) + 1 from public.respuestas_rapidas_mensajes where gimnasio_id = p_gimnasio_id), 0)) returning id into r;
  else
    update public.respuestas_rapidas_mensajes set titulo = ti, texto = te where id = p_id and gimnasio_id = p_gimnasio_id returning id into r;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Esa respuesta ya no existe' using errcode = 'P0002'; end if;
  end if;
  return r;
end $$;

create or replace function public.quitar_respuesta_rapida(p_gimnasio_id uuid, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  delete from public.respuestas_rapidas_mensajes where id = p_id and gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Esa respuesta ya no existe' using errcode = 'P0002'; end if;
end $$;

-- Tres de ejemplo para los gimnasios que ya existen (el dueño las cambia o las quita).
insert into public.respuestas_rapidas_mensajes (gimnasio_id, titulo, texto, orden)
select g.id, v.titulo, v.texto, v.orden
  from public.gimnasios g
  cross join (values
    (0, 'Gracias por escribirnos', 'Gracias por escribirnos. Lo estamos viendo y te contestamos a la brevedad.'),
    (1, 'Horario de feriado', 'En feriados abrimos en horario reducido. Cualquier cambio lo avisamos por la app.'),
    (2, 'Objeto encontrado', 'Encontramos lo que perdiste. Pasá por la recepción y te lo damos.')
  ) as v(orden, titulo, texto)
 where not exists (select 1 from public.respuestas_rapidas_mensajes r where r.gimnasio_id = g.id);

-- ── Aviso por push (solo la clave de servicio; cada mensaje se avisa una vez) ──
--   mensaje_nuevo      → al equipo que los ve (dueño, encargado, y recepción si el dueño lo prendió)
--   mensaje_respuesta  → al socio, cuando el gimnasio le contesta
-- No filtra por "tipo" de aviso: quien activó los avisos en su celular los recibe.
create or replace function public.destinos_push_mensajes(p_evento text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.mensajes_socio; h public.hilos_socio; s public.socios; usuarios uuid[]; titulo text; cuerpo text; url text; n int;
begin
  select * into m from public.mensajes_socio where id = p_id;
  if not found then return null; end if;
  select * into h from public.hilos_socio where id = m.hilo_id;
  select * into s from public.socios where id = h.socio_id;
  if p_evento = 'mensaje_nuevo' then
    if m.autor <> 'socio' then return null; end if;
    titulo := '💬 ' || trim(s.nombre || ' ' || s.apellido) || ' te escribió';
    cuerpo := case h.motivo when 'queja' then 'Queja: ' when 'objeto_perdido' then 'Objeto perdido: ' when 'consulta' then 'Consulta: ' else '' end || left(m.texto, 100);
    url := '/panel/mensajes?hilo=' || h.id::text;
    select array_agg(e.usuario_id) into usuarios from public.equipo e
     where e.gimnasio_id = m.gimnasio_id and e.activo
       and (e.rol in ('dueno', 'encargado')
            or (e.rol = 'recepcion' and coalesce((select c.recepcion_ve from public.config_mensajes c where c.gimnasio_id = m.gimnasio_id), false)));
  elsif p_evento = 'mensaje_respuesta' then
    if m.autor <> 'equipo' or s.usuario_id is null then return null; end if;
    titulo := '💬 El gimnasio te respondió';
    cuerpo := left(m.texto, 120);
    url := '/app/mensajes/' || h.id::text;
    usuarios := array[s.usuario_id];
  else
    raise exception 'Evento desconocido: %', p_evento using errcode = '22023';
  end if;
  insert into public.envios_push (gimnasio_id, evento, referencia) values (m.gimnasio_id, p_evento, p_id)
  on conflict (gimnasio_id, evento, referencia) do nothing;
  get diagnostics n = row_count;
  if n = 0 then return null; end if;   -- ya se mandó
  return jsonb_build_object('titulo', titulo, 'cuerpo', cuerpo, 'url', url, 'tipo', 'mensajes',
    'destinos', coalesce((select jsonb_agg(jsonb_build_object('endpoint', sp.endpoint, 'p256dh', sp.p256dh, 'auth', sp.auth))
                            from public.suscripciones_push sp
                           where sp.gimnasio_id = m.gimnasio_id and sp.usuario_id = any (coalesce(usuarios, '{}'))), '[]'::jsonb));
end $$;

revoke all on function public.permisos_mensajes(uuid), public.guardar_permisos_mensajes(uuid, boolean), public.mensajes_estado_socio(uuid),
  public.escribir_al_gimnasio(uuid, text, text), public.responder_hilo_socio(uuid, text), public.mis_mensajes(uuid), public.mi_hilo(uuid),
  public.preparar_foto_mensaje(uuid, text), public.confirmar_foto_mensaje(uuid, text), public.foto_mensaje(uuid),
  public.bandeja_mensajes(uuid, text, int), public.hilo_mensajes(uuid), public.responder_mensaje(uuid, text), public.cambiar_estado_hilo(uuid, text),
  public.historial_mensajes_socio(uuid), public.mensajes_sin_responder(uuid), public.respuestas_rapidas(uuid),
  public.guardar_respuesta_rapida(uuid, uuid, text, text), public.quitar_respuesta_rapida(uuid, uuid), public.destinos_push_mensajes(text, uuid),
  public.ver_mensajes_equipo(uuid)
  from public, anon, authenticated;
grant execute on function public.permisos_mensajes(uuid), public.guardar_permisos_mensajes(uuid, boolean), public.mensajes_estado_socio(uuid),
  public.escribir_al_gimnasio(uuid, text, text), public.responder_hilo_socio(uuid, text), public.mis_mensajes(uuid), public.mi_hilo(uuid),
  public.preparar_foto_mensaje(uuid, text), public.confirmar_foto_mensaje(uuid, text), public.foto_mensaje(uuid),
  public.bandeja_mensajes(uuid, text, int), public.hilo_mensajes(uuid), public.responder_mensaje(uuid, text), public.cambiar_estado_hilo(uuid, text),
  public.historial_mensajes_socio(uuid), public.mensajes_sin_responder(uuid), public.respuestas_rapidas(uuid),
  public.guardar_respuesta_rapida(uuid, uuid, text, text), public.quitar_respuesta_rapida(uuid, uuid), public.ver_mensajes_equipo(uuid) to authenticated, service_role;
grant execute on function public.destinos_push_mensajes(text, uuid) to service_role;

-- ── La sección "mensajes" se puede apagar ──────────────────────────
-- Se suma a lo que ya había (otros ítems suman las suyas): se lee la lista vigente.
do $$
declare actuales text[];
begin
  actuales := privado.secciones_validas();
  if not ('mensajes' = any (actuales)) then
    execute format('create or replace function privado.secciones_validas() returns text[] language sql immutable set search_path = '''' as $f$ select %L::text[] $f$',
                   array_append(actuales, 'mensajes'));
  end if;
  alter table public.configuracion_gimnasio drop constraint if exists configuracion_secciones_validas;
  alter table public.configuracion_gimnasio add constraint configuracion_secciones_validas
    check (secciones_apagadas <@ privado.secciones_validas());
end $$;

-- ── Bucket privado de las fotos (en Supabase; la base local no tiene storage) ──
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Sin esquema storage (base local): se saltea el bucket mensajes_fotos';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('mensajes_fotos', 'mensajes_fotos', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;
end $$;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text; t text; publico boolean;
begin
  foreach t in array array['public.config_mensajes', 'public.hilos_socio', 'public.mensajes_socio', 'public.respuestas_rapidas_mensajes'] loop
    if not (select relrowsecurity from pg_class where oid = t::regclass) then raise exception 'Verificación: % sin RLS', t; end if;
    if has_table_privilege('authenticated', t, 'insert') or has_table_privilege('authenticated', t, 'update') or has_table_privilege('authenticated', t, 'delete') then
      raise exception 'Verificación: % se puede escribir directo', t;
    end if;
    if has_table_privilege('anon', t, 'select') then raise exception 'Verificación: anon lee %', t; end if;
  end loop;
  foreach f in array array['public.permisos_mensajes(uuid)', 'public.guardar_permisos_mensajes(uuid, boolean)', 'public.mensajes_estado_socio(uuid)',
    'public.escribir_al_gimnasio(uuid, text, text)', 'public.responder_hilo_socio(uuid, text)', 'public.mis_mensajes(uuid)', 'public.mi_hilo(uuid)',
    'public.preparar_foto_mensaje(uuid, text)', 'public.confirmar_foto_mensaje(uuid, text)', 'public.foto_mensaje(uuid)',
    'public.bandeja_mensajes(uuid, text, int)', 'public.hilo_mensajes(uuid)', 'public.responder_mensaje(uuid, text)', 'public.cambiar_estado_hilo(uuid, text)',
    'public.historial_mensajes_socio(uuid)', 'public.mensajes_sin_responder(uuid)', 'public.respuestas_rapidas(uuid)',
    'public.guardar_respuesta_rapida(uuid, uuid, text, text)', 'public.quitar_respuesta_rapida(uuid, uuid)', 'public.destinos_push_mensajes(text, uuid)',
    'public.ver_mensajes_equipo(uuid)', 'privado.puede_ver_mensajes(uuid)', 'privado.exigir_mensajes(uuid)', 'privado.mensajes_prendidos(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if has_function_privilege('authenticated', 'public.destinos_push_mensajes(text, uuid)', 'execute') then
    raise exception 'Verificación: destinos_push_mensajes es solo para la clave de servicio';
  end if;
  if not ('mensajes' = any (privado.secciones_validas())) then raise exception 'Verificación: la sección mensajes no quedó entre las válidas'; end if;
  if to_regclass('storage.buckets') is not null then
    execute 'select exists (select 1 from storage.buckets where id = ''mensajes_fotos'' and public)' into publico;
    if publico then raise exception 'Verificación: el bucket de fotos de mensajes quedó público'; end if;
  end if;
end $$;
