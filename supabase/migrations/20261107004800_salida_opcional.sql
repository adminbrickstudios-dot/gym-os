-- VD-48 · Salida opcional (D30). Registrar la salida es OPCIONAL y configurable por gimnasio.
--   configuracion_visita.registrar_salida   'no' (por defecto) | 'opcional' | 'obligatoria'
--   salidas                                 un HECHO por ingreso (una sola): quién, cuándo y por qué vía. Nunca una columna "adentro".
--   privado.registrar_salida                cierra la visita abierta: la última entrada válida dentro de la visita sin salida.
--                                           Sin entrada abierta no rompe nada: devuelve "no tenía entrada abierta".
--   public.registrar_salida                 recepción (dueño, encargado, recepción) o el servidor (kiosco / QR) con el dispositivo
--   public.kiosco_salir / salir_por_qr_pared   el botón "Me voy" de la tablet y del QR de la pared
--   public.kiosco_salida_activa / registra_salida   para que la tablet y la app sepan si muestran "Me voy"
--   privado.registrar_ingreso (misma firma; copia de 20261106007501)
--       · entrar de nuevo dentro de la visita SIN haber salido: sigue siendo "ya entró" (no cuenta ni consume), y con
--         salida prendida avisa (obligatoria: "Ya entró a las 15:10 y no marcó la salida: ¿se va?") y ofrece marcarla.
--       · entrar de nuevo DESPUÉS de marcar la salida, dentro de la misma visita: es un reingreso. Queda una entrada nueva
--         que copia el resultado de la anterior y NO consume nada otra vez (el pase o la clase ya se usaron en esa visita).
--   numeros_inicio (misma firma; copia de 20261106003700): con salida prendida, "Adentro ahora" cuenta las visitas abiertas
--       (exacto); con salida en 'no' sigue igual que antes ("Adentro (aprox.)").
-- Sin salida marcada, la visita se cierra sola a las N horas (visita_horas, D24): se calcula, nunca se guarda ni hay cron.
-- NUNCA cambia quién puede entrar: calcular_acceso no se toca.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.configuracion_visita') is null then raise exception 'Guarda: falta configuracion_visita'; end if;
  if to_regclass('public.ingresos') is null or to_regclass('public.dispositivos') is null then raise exception 'Guarda: faltan ingresos o dispositivos'; end if;
  if pg_get_functiondef('privado.registrar_ingreso(uuid, uuid, text, uuid, uuid, text, timestamptz)'::regprocedure) not like '%emergencia_activa%' then
    raise exception 'Guarda: registrar_ingreso vigente sin la emergencia de la puerta (VD-46M)';
  end if;
  if pg_get_functiondef('public.config_visita(uuid)'::regprocedure) not like '%avisar_en_vivo%' then raise exception 'Guarda: config_visita vigente sin avisar_en_vivo (VD-4)'; end if;
  if to_regprocedure('public.numeros_inicio(uuid, uuid)') is null then raise exception 'Guarda: falta numeros_inicio'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null or to_regprocedure('privado.exigir_rol(uuid, text[], uuid)') is null then raise exception 'Guarda: faltan exigir_equipo o exigir_rol'; end if;
  if to_regprocedure('privado.tablet_del_token(text)') is null or to_regprocedure('privado.validar_qr(uuid, text, timestamptz)') is null then raise exception 'Guarda: faltan tablet_del_token o validar_qr'; end if;
  if to_regprocedure('privado.firma_qr(bytea, uuid, bigint)') is null then raise exception 'Guarda: falta privado.firma_qr'; end if;
end $$;

-- ── La configuración ────────────────────────────────────────────────
alter table public.configuracion_visita add column if not exists registrar_salida text not null default 'no';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_visita_registrar_salida_check') then
    alter table public.configuracion_visita add constraint configuracion_visita_registrar_salida_check
      check (registrar_salida in ('no', 'opcional', 'obligatoria'));
  end if;
end $$;

create or replace function public.config_visita(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.configuracion_visita;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  select * into c from public.configuracion_visita where gimnasio_id = p_gimnasio_id;
  if not found then return jsonb_build_object('visita_horas', 5, 'antiprestamo_minutos', 60, 'avisar_en_vivo', true, 'registrar_salida', 'no'); end if;
  return jsonb_build_object('visita_horas', c.visita_horas, 'antiprestamo_minutos', c.antiprestamo_minutos, 'avisar_en_vivo', c.avisar_en_vivo,
                            'registrar_salida', c.registrar_salida);
end $$;

create or replace function public.guardar_config_visita(p_gimnasio_id uuid, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare desconocidos text[]; c public.configuracion_visita; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos' using errcode = '22023'; end if;
  select array_agg(k) into desconocidos from jsonb_object_keys(p_datos) k
   where k not in ('visita_horas', 'antiprestamo_minutos', 'avisar_en_vivo', 'registrar_salida');
  if desconocidos is not null then raise exception 'Campos que no se pueden cambiar acá: %', array_to_string(desconocidos, ', ') using errcode = '22023'; end if;
  insert into public.configuracion_visita (gimnasio_id) values (p_gimnasio_id) on conflict (gimnasio_id) do nothing;
  select * into c from public.configuracion_visita where gimnasio_id = p_gimnasio_id;
  if p_datos ? 'visita_horas' then
    if jsonb_typeof(p_datos -> 'visita_horas') is distinct from 'number' or (p_datos ->> 'visita_horas')::numeric <> trunc((p_datos ->> 'visita_horas')::numeric)
       or (p_datos ->> 'visita_horas')::numeric not between 0 and 24 then
      raise exception 'Una visita dura: elegí un número entero de horas, de 0 a 24.' using errcode = '22023';
    end if;
    c.visita_horas := (p_datos ->> 'visita_horas')::int;
  end if;
  if p_datos ? 'antiprestamo_minutos' then
    if jsonb_typeof(p_datos -> 'antiprestamo_minutos') is distinct from 'number' or (p_datos ->> 'antiprestamo_minutos')::numeric <> trunc((p_datos ->> 'antiprestamo_minutos')::numeric)
       or (p_datos ->> 'antiprestamo_minutos')::numeric not between 0 and 720 then
      raise exception 'Avisar si vuelve a entrar antes de: elegí minutos enteros, de 0 a 720 (0 apaga el aviso).' using errcode = '22023';
    end if;
    c.antiprestamo_minutos := (p_datos ->> 'antiprestamo_minutos')::int;
  end if;
  if p_datos ? 'avisar_en_vivo' then
    if jsonb_typeof(p_datos -> 'avisar_en_vivo') is distinct from 'boolean' then raise exception 'Avisar entradas en vivo: elegí sí o no.' using errcode = '22023'; end if;
    c.avisar_en_vivo := (p_datos ->> 'avisar_en_vivo')::boolean;
  end if;
  if p_datos ? 'registrar_salida' then
    if jsonb_typeof(p_datos -> 'registrar_salida') is distinct from 'string' or (p_datos ->> 'registrar_salida') not in ('no', 'opcional', 'obligatoria') then
      raise exception 'Registrar la salida: elegí no, opcional u obligatoria.' using errcode = '22023';
    end if;
    c.registrar_salida := p_datos ->> 'registrar_salida';
  end if;
  update public.configuracion_visita x set visita_horas = c.visita_horas, antiprestamo_minutos = c.antiprestamo_minutos,
         avisar_en_vivo = c.avisar_en_vivo, registrar_salida = c.registrar_salida, actualizado_en = now()
   where x.gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la configuración de la visita.'; end if;
  return public.config_visita(p_gimnasio_id);
end $$;

-- ── El hecho: la salida ─────────────────────────────────────────────
create table if not exists public.salidas (
  id              uuid primary key default gen_random_uuid(),
  gimnasio_id     uuid not null references public.gimnasios(id),
  sede_id         uuid not null,
  ingreso_id      uuid not null,
  socio_id        uuid not null,
  momento         timestamptz not null,
  via_acceso      text not null check (via_acceso in ('recepcion', 'qr_socio', 'qr_pared', 'kiosco')),
  registrado_por  uuid,
  dispositivo_id  uuid,
  creado_en       timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, ingreso_id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  foreign key (gimnasio_id, ingreso_id) references public.ingresos (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, registrado_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, dispositivo_id) references public.dispositivos (gimnasio_id, id)
);
create index if not exists salidas_socio on public.salidas (gimnasio_id, socio_id, momento desc);
create index if not exists salidas_sede_momento on public.salidas (gimnasio_id, sede_id, momento);
-- Se lee con las mismas reglas que las entradas; se escribe solo desde registrar_salida. Un hecho no se corrige ni se borra.
select privado.politicas_estandar('public.salidas', array['dueno', 'encargado', 'recepcion'], '{}', true);
revoke all on table public.salidas from anon;
revoke insert, update, delete, truncate, references, trigger on public.salidas from authenticated;
drop trigger if exists salidas_inmutable on public.salidas;
create trigger salidas_inmutable before update or delete on public.salidas
  for each row execute function privado.hecho_inmutable();

-- ── "1 h 20" ────────────────────────────────────────────────────────
create or replace function privado.duracion_corta(p_minutos int) returns text
language sql immutable set search_path = '' as $$
  select case when p_minutos < 1 then 'menos de 1 min'
              when p_minutos < 60 then p_minutos || ' min'
              when p_minutos % 60 = 0 then (p_minutos / 60) || ' h'
              else (p_minutos / 60) || ' h ' || lpad((p_minutos % 60)::text, 2, '0') end
$$;
revoke all on function privado.duracion_corta(int) from public, anon, authenticated;

-- ── Cerrar la visita abierta ────────────────────────────────────────
-- La visita abierta = la última entrada válida (no anulada, no rechazada) dentro de la visita y sin salida.
-- Con visita_horas = 0 (sin ventana larga) para la salida se mira una visita de 5 h: no hay otra forma de "estar adentro".
create or replace function privado.registrar_salida(
  p_socio_id uuid, p_sede_id uuid, p_via_acceso text, p_registrado_por uuid, p_dispositivo_id uuid, p_momento timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  g uuid; m timestamptz; modo text; horas int; ventana interval; so public.socios; ing public.ingresos; sal uuid; n int; minutos int; zona text;
begin
  perform pg_advisory_xact_lock(hashtextextended('gymos:ingreso:' || p_socio_id::text, 0));
  m := coalesce(p_momento, clock_timestamp());
  select * into so from public.socios where id = p_socio_id;
  if so.id is null then raise exception 'Socio inexistente: %', p_socio_id using errcode = 'P0002'; end if;
  g := so.gimnasio_id;
  select coalesce(c.registrar_salida, 'no'), coalesce(c.visita_horas, 5) into modo, horas
    from (select 1) u left join public.configuracion_visita c on c.gimnasio_id = g;
  if modo = 'no' then raise exception 'Este gimnasio no registra la salida.' using errcode = '22023'; end if;
  ventana := (case when horas > 0 then horas else 5 end) * interval '1 hour';

  select i.* into ing from public.ingresos i
   where i.socio_id = p_socio_id and i.anulado_en is null and i.resultado in ('entro', 'entro_modo_aviso', 'forzado')
     and i.momento <= m and i.momento > m - ventana and (p_sede_id is null or i.sede_id = p_sede_id)
   order by i.momento desc limit 1;
  if ing.id is null or exists (select 1 from public.salidas s where s.ingreso_id = ing.id) then
    -- No rompe nada: no había una entrada abierta (nunca entró, ya salió o la visita se cerró sola).
    return jsonb_build_object('registrada', false, 'nombre', so.nombre,
                              'texto', 'No tenía entrada abierta: no hace falta marcar la salida.');
  end if;

  insert into public.salidas (gimnasio_id, sede_id, ingreso_id, socio_id, momento, via_acceso, registrado_por, dispositivo_id)
  values (g, ing.sede_id, ing.id, p_socio_id, m, p_via_acceso, p_registrado_por, p_dispositivo_id)
  returning id into sal;
  get diagnostics n = row_count;
  if n <> 1 or sal is null then raise exception 'No se pudo registrar la salida.'; end if;

  minutos := greatest(floor(extract(epoch from (m - ing.momento)) / 60)::int, 0);
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = g;
  return jsonb_build_object('registrada', true, 'salida_id', sal, 'ingreso_id', ing.id, 'nombre', so.nombre, 'minutos', minutos,
                            'entro_a', ing.momento, 'salio_a', m,
                            'texto', 'Chau ' || so.nombre || ', estuviste ' || privado.duracion_corta(minutos));
end $$;
revoke all on function privado.registrar_salida(uuid, uuid, text, uuid, uuid, timestamptz) from public, anon, authenticated;

-- Para la recepción (con sesión) o el servidor (kiosco / QR, que ya validó el dispositivo).
create or replace function public.registrar_salida(
  p_socio_id uuid, p_sede_id uuid, p_via_acceso text default 'recepcion', p_dispositivo_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid; r jsonb;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_via_acceso not in ('recepcion', 'qr_socio', 'qr_pared', 'kiosco') then raise exception 'Vía de salida inválida' using errcode = '22023'; end if;
  if privado.es_servicio() then
    eid := null;
    if p_dispositivo_id is not null and not exists (
         select 1 from public.dispositivos d
          where d.id = p_dispositivo_id and d.gimnasio_id = g and d.sede_id = p_sede_id and d.revocado_en is null) then
      raise exception 'Dispositivo revocado o de otra sede' using errcode = '42501';
    end if;
  else
    eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], p_sede_id);
    if p_dispositivo_id is not null then raise exception 'Un dispositivo solo registra desde el servidor' using errcode = '42501'; end if;
    if p_via_acceso <> 'recepcion' then raise exception 'La recepción registra la salida por la vía recepción' using errcode = '22023'; end if;
  end if;
  if p_sede_id is null or not exists (select 1 from public.sedes s where s.id = p_sede_id and s.gimnasio_id = g) then
    raise exception 'Sede inválida' using errcode = '22023';
  end if;
  r := privado.registrar_salida(p_socio_id, p_sede_id, p_via_acceso, eid, p_dispositivo_id, null);
  return r;
end $$;

-- ── Lo que ve la tablet y la app ────────────────────────────────────
create or replace function public.kiosco_salida_activa(p_token text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare d public.dispositivos;
begin
  d := privado.tablet_del_token(p_token);
  return coalesce((select c.registrar_salida <> 'no' from public.configuracion_visita c where c.gimnasio_id = d.gimnasio_id), false);
end $$;

-- "Me voy" en la tablet: con el DNI o con el QR del socio. No cuenta quién existe: un DNI que no está y uno sin entrada abierta
-- contestan lo mismo, y la respuesta no lleva el nombre cuando no se registró nada.
create or replace function public.kiosco_salir(p_token text, p_codigo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d public.dispositivos; sid uuid; v_dni text; r jsonb; vacio constant jsonb := jsonb_build_object('registrada', false, 'texto', 'No tenías entrada abierta: no hace falta marcar la salida.');
begin
  d := privado.tablet_del_token(p_token);
  if coalesce((select c.registrar_salida from public.configuracion_visita c where c.gimnasio_id = d.gimnasio_id), 'no') = 'no' then
    raise exception 'Este gimnasio no registra la salida.' using errcode = '22023';
  end if;
  -- Freno contra probar DNIs al azar: 30 intentos por minuto por tablet (entradas y salidas juntas).
  if (select count(*) from public.ingresos i where i.dispositivo_id = d.id and i.momento > now() - interval '1 minute')
   + (select count(*) from public.salidas s where s.dispositivo_id = d.id and s.momento > now() - interval '1 minute') >= 30 then
    raise exception 'Demasiados intentos: esperá un minuto.' using errcode = '54000';
  end if;
  if trim(coalesce(p_codigo, '')) ~ '^GYMOS1\.' then
    if not exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = d.gimnasio_id and 'qr_socio' = any (c.accesos_activos)) then
      raise exception 'Este gimnasio no usa QR: escribí tu DNI.' using errcode = '22023';
    end if;
    sid := privado.validar_qr(d.gimnasio_id, p_codigo, now());
  else
    v_dni := regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g');
    if v_dni !~ '^[0-9]{6,9}$' then raise exception 'Escribí tu DNI, sin puntos.' using errcode = '22023'; end if;
    select so.id into sid from public.socios so where so.gimnasio_id = d.gimnasio_id and so.dni = v_dni and so.dado_de_baja_en is null;
    if sid is null then return vacio; end if;
  end if;
  update public.dispositivos set ultimo_uso = now() where id = d.id;
  r := privado.registrar_salida(sid, d.sede_id, 'kiosco', null, d.id, null);
  if not (r ->> 'registrada')::boolean then return vacio; end if;
  return jsonb_build_object('registrada', true, 'nombre', r ->> 'nombre', 'minutos', (r ->> 'minutos')::int,
                            'texto', 'Chau ' || (r ->> 'nombre') || ', estuviste ' || privado.duracion_corta((r ->> 'minutos')::int));
end $$;

-- ¿El gimnasio registra la salida? (para mostrar "Me voy" en la app del socio)
create or replace function public.registra_salida(p_gimnasio_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select c.registrar_salida from public.configuracion_visita c where c.gimnasio_id = p_gimnasio_id), 'no')
$$;

-- "Me voy" desde la app del socio, escaneando el QR de la tablet (misma validación que para entrar).
create or replace function public.salir_por_qr_pared(p_gimnasio_id uuid, p_socio_id uuid, p_codigo text, p_momento timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.socios; m text[]; did uuid; v bigint; actual bigint; d public.dispositivos;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  select * into s from public.socios where id = p_socio_id and gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and dado_de_baja_en is null;
  if s.id is null then raise exception 'Sin permiso para ese socio' using errcode = '42501'; end if;
  m := regexp_match(trim(coalesce(p_codigo, '')), '^GYMOSP1\.([0-9a-f-]{36})\.([0-9]{1,12})\.([0-9a-f]{24})$');
  if m is null then raise exception 'Ese no es el QR de la entrada: buscá el de la tablet.' using errcode = '22023'; end if;
  did := m[1]::uuid; v := m[2]::bigint;
  select * into d from public.dispositivos where id = did;
  if d.id is null or d.gimnasio_id <> p_gimnasio_id then raise exception 'Ese QR es de otro gimnasio.' using errcode = '22023'; end if;
  if d.revocado_en is not null then raise exception 'Esa tablet ya no está habilitada: pasá por recepción.' using errcode = '22023'; end if;
  if not exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id and 'qr_pared' = any (c.accesos_activos)) then
    raise exception 'El QR en la tablet está apagado: pasá por recepción.' using errcode = '22023';
  end if;
  actual := privado.ventana_qr(p_momento);
  if v not in (actual, actual - 1) then raise exception 'El QR cambió: escanealo de nuevo.' using errcode = '22023'; end if;
  if privado.firma_qr(privado.secreto_tablet(d.id), d.id, v) <> m[3] then raise exception 'El QR no es válido.' using errcode = '22023'; end if;
  update public.dispositivos set ultimo_uso = now() where id = d.id;
  return privado.registrar_salida(s.id, d.sede_id, 'qr_pared', null, d.id, p_momento);
end $$;

-- ── El registro de la entrada con la salida ─────────────────────────
create or replace function privado.registrar_ingreso(
  p_socio_id uuid, p_sede_id uuid, p_via_acceso text, p_registrado_por uuid,
  p_dispositivo_id uuid, p_forzar_motivo text, p_momento timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  g uuid; m timestamptz; prev public.ingresos; v public.veredicto_acceso; res text; nuevo uuid; n int;
  em public.emergencias_puerta; por_emergencia boolean := false; vv jsonb;
  horas int; minutos_prestamo int; ventana interval; zona text; hace int; texto_repetido text;
  modo_salida text; salida_prev public.salidas; hora_prev text; propia boolean;
  etiquetas constant jsonb := jsonb_build_object('recepcion', 'recepción', 'qr_socio', 'el QR', 'qr_pared', 'el QR de la pared',
                                                 'kiosco', 'la tablet', 'nfc', 'el llavero', 'molinete', 'el molinete');
begin
  perform pg_advisory_xact_lock(hashtextextended('gymos:ingreso:' || p_socio_id::text, 0));
  m := coalesce(p_momento, clock_timestamp());

  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Socio inexistente: %', p_socio_id using errcode = 'P0002'; end if;

  select coalesce(c.visita_horas, 5), coalesce(c.antiprestamo_minutos, 60), coalesce(c.registrar_salida, 'no')
    into horas, minutos_prestamo, modo_salida
    from (select 1) u left join public.configuracion_visita c on c.gimnasio_id = g;
  -- visita_horas = 0: sin ventana larga, queda solo el doble toque de 60 segundos.
  ventana := case when horas > 0 then horas * interval '1 hour' else interval '60 seconds' end;

  -- Idempotente: dentro de la visita, el mismo socio por cualquier vía devuelve su entrada (no crea otra).
  select * into prev from public.ingresos i
   where i.socio_id = p_socio_id and i.anulado_en is null
     and i.resultado in ('entro', 'entro_modo_aviso', 'forzado')
     and i.momento > m - ventana and i.momento <= m
   order by i.momento desc limit 1;
  if found then
    select gi.zona_horaria into zona from public.gimnasios gi where gi.id = g;
    hora_prev := to_char(prev.momento at time zone zona, 'HH24:MI');
    propia := p_via_acceso in ('qr_socio', 'qr_pared', 'kiosco', 'nfc');
    select * into salida_prev from public.salidas s where s.ingreso_id = prev.id;

    -- VD-48: ya había salido y vuelve dentro de la misma visita: es un reingreso. Entrada nueva que copia la anterior,
    -- sin consumir otra vez el pase ni la clase de esa visita.
    if salida_prev.id is not null then
      insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto,
                                   forzado_motivo, registrado_por, dispositivo_id, emergencia_id)
      values (g, p_sede_id, p_socio_id, m, p_via_acceso, prev.resultado, prev.via_habilitante, prev.color, prev.motivo, prev.texto,
              prev.forzado_motivo, p_registrado_por, p_dispositivo_id, prev.emergencia_id)
      returning id into nuevo;
      if nuevo is null then raise exception 'No se registró el reingreso'; end if;
      v := privado.calcular_acceso(p_socio_id, m, p_sede_id);
      vv := to_jsonb(v) || jsonb_build_object('puede', prev.resultado <> 'forzado', 'color', prev.color, 'motivo', prev.motivo,
              'texto', case when propia then 'Volviste a entrar ✓' else 'Volvió a entrar (había salido a las '
                          || to_char(salida_prev.momento at time zone zona, 'HH24:MI') || ')' end);
      return jsonb_build_object('ingreso_id', nuevo, 'repetido', false, 'reingreso', true, 'resultado', prev.resultado, 'veredicto', vv);
    end if;

    hace := greatest(floor(extract(epoch from (m - prev.momento)) / 60)::int, 0);
    -- Otra vía u otro dispositivo y hace pocos minutos: amarillo, y le queda la alerta al dueño.
    if minutos_prestamo > 0 and hace < minutos_prestamo
       and (prev.via_acceso is distinct from p_via_acceso or prev.dispositivo_id is distinct from p_dispositivo_id) then
      insert into public.alertas_prestamo (gimnasio_id, sede_id, socio_id, momento, ingreso_anterior_id, via_anterior, via_nueva,
                                           dispositivo_anterior_id, dispositivo_nuevo_id, minutos)
      values (g, p_sede_id, p_socio_id, m, prev.id, prev.via_acceso, p_via_acceso, prev.dispositivo_id, p_dispositivo_id, hace);
      get diagnostics n = row_count;
      if n <> 1 then raise exception 'No se pudo guardar la alerta de préstamo'; end if;
      return jsonb_build_object('ingreso_id', prev.id, 'repetido', true, 'resultado', prev.resultado,
        'color', 'amarillo', 'motivo', 'posible_prestamo', 'alerta_prestamo', true,
        'entro_a', prev.momento, 'color_entrada', prev.color,
        'texto', 'Ya entró ' || case when hace < 1 then 'hace menos de 1 min' else 'hace ' || hace || ' min' end
                 || ' por ' || coalesce(etiquetas ->> prev.via_acceso, prev.via_acceso) || ': ¿es la misma persona?');
    end if;
    texto_repetido := case when propia then 'Ya entraste a las ' || hora_prev || ' ✓'
                           else 'Ya entró a las ' || hora_prev end;
    -- Obligatoria: entrar de nuevo sin haber salido avisa, y la pantalla ofrece marcar la salida.
    if modo_salida = 'obligatoria' then
      texto_repetido := case when propia then 'Ya entraste a las ' || hora_prev || ' y no marcaste la salida: ¿te vas?'
                             else 'Ya entró a las ' || hora_prev || ' y no marcó la salida: ¿se va?' end;
    end if;
    return jsonb_build_object('ingreso_id', prev.id, 'repetido', true, 'resultado', prev.resultado,
                              'color', prev.color, 'motivo', prev.motivo, 'texto', texto_repetido,
                              'entro_a', prev.momento, 'puede_salir', modo_salida <> 'no',
                              'avisar_salida', modo_salida = 'obligatoria');
  end if;

  v := privado.calcular_acceso(p_socio_id, m, p_sede_id);
  -- VD-46M: con la puerta en emergencia en esta sede, quien no podía entrar pasa igual (queda 'entro_modo_aviso' marcado
  -- con la emergencia). No se abre a un suspendido ni a un dado de baja, ni cuando la recepción dejó pasar a mano con motivo.
  em := privado.emergencia_activa(g, p_sede_id, m);
  if v.puede then
    res := case when v.modo_aviso then 'entro_modo_aviso' else 'entro' end;
  elsif em.id is not null and v.motivo not in ('suspendido', 'se_fue') and length(trim(coalesce(p_forzar_motivo, ''))) = 0 then
    res := 'entro_modo_aviso'; por_emergencia := true;
  elsif length(trim(coalesce(p_forzar_motivo, ''))) > 0 then
    res := 'forzado';
  else
    res := 'rechazado';
  end if;

  insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado,
                               via_habilitante, color, motivo, texto, forzado_motivo,
                               registrado_por, dispositivo_id, emergencia_id)
  values (g, p_sede_id, p_socio_id, m, p_via_acceso, res,
          case when v.puede and not v.modo_aviso and v.via <> 'ninguna' then v.via end,
          v.color, v.motivo, v.texto,
          case when res = 'forzado' then trim(p_forzar_motivo) when por_emergencia then 'Emergencia de la puerta' end,
          p_registrado_por, p_dispositivo_id, case when em.id is not null and res <> 'rechazado' then em.id end)
  returning id into nuevo;
  if nuevo is null then raise exception 'No se registró el ingreso'; end if;

  if res in ('entro', 'entro_modo_aviso') and v.consume = 'pase' then
    update public.pases_diarios set usado_en_ingreso_id = nuevo
     where id = v.consume_id and usado_en_ingreso_id is null;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo marcar el pase % como usado', v.consume_id; end if;
  elsif res in ('entro', 'entro_modo_aviso') and v.consume = 'pack' then
    insert into public.consumos_pack (gimnasio_id, pack_id, socio_id, momento, ingreso_id)
    values (g, v.consume_id, p_socio_id, m, nuevo);
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo descontar la clase del pack %', v.consume_id; end if;
  end if;

  if por_emergencia then
    -- Lo que ve la puerta (tablet, QR, ventana): amarillo y "pasá". El color real queda en el ingreso.
    vv := to_jsonb(v) || jsonb_build_object('puede', true, 'color', 'amarillo', 'modo_aviso', true, 'emergencia', true,
            'texto', 'La puerta está en emergencia: pasá. Después pasá por recepción.');
    return jsonb_build_object('ingreso_id', nuevo, 'repetido', false, 'resultado', res, 'emergencia', true, 'veredicto', vv);
  end if;
  return jsonb_build_object('ingreso_id', nuevo, 'repetido', false, 'resultado', res, 'veredicto', to_jsonb(v));
end $$;
revoke all on function privado.registrar_ingreso(uuid, uuid, text, uuid, uuid, text, timestamptz) from public;

-- ── Los números de Inicio: "Adentro ahora" exacto con la salida prendida ──
-- Visitas abiertas en un momento: entradas válidas dentro de la visita, sin salida hasta ese momento. Un socio cuenta una vez.
create or replace function privado.adentro_ahora(p_gimnasio_id uuid, p_sede_id uuid, p_momento timestamptz) returns int
language sql stable set search_path = '' as $$
  select count(distinct i.socio_id)::int from public.ingresos i
   where i.gimnasio_id = p_gimnasio_id
     and i.momento > p_momento - (select case when coalesce(cv.visita_horas, 5) > 0 then coalesce(cv.visita_horas, 5) else 5 end
                                    from (select 1) u left join public.configuracion_visita cv on cv.gimnasio_id = p_gimnasio_id) * interval '1 hour'
     and i.momento <= p_momento
     and i.anulado_en is null and i.resultado <> 'rechazado' and (p_sede_id is null or i.sede_id = p_sede_id)
     and not exists (select 1 from public.salidas sa where sa.ingreso_id = i.id and sa.momento <= p_momento)
$$;
revoke all on function privado.adentro_ahora(uuid, uuid, timestamptz) from public, anon, authenticated;

create or replace function public.numeros_inicio(p_gimnasio_id uuid, p_sede_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; c public.configuracion_gimnasio; zona text; hoy date; desde timestamptz; hasta timestamptz;
  sede uuid; ve_plata boolean; hay_clases boolean; corrido interval;
  todos text[] := array['adentro','entraron','cobrado','a_cobrar','activos','altas_mes','bajas_mes','ocupacion'];
  claves text[] := '{}'; k text; v numeric; serie jsonb; salida jsonb := '[]'::jsonb; disponibles jsonb := '[]'::jsonb;
  mes timestamptz; salida_modo text := 'no'; horas_visita int := 5; adentro_etiq text := 'Adentro (aprox.)';
  etiq jsonb := jsonb_build_object(
    'adentro', '🏋️|Adentro (aprox.)', 'entraron', '🚪|Entraron hoy', 'cobrado', '💵|Cobrado hoy', 'a_cobrar', '⏰|A cobrar hoy',
    'activos', '✅|Socios activos', 'altas_mes', '🆕|Altas del mes', 'bajas_mes', '👋|Bajas del mes', 'ocupacion', '🗓️|Ocupación de clases (%)');
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  sede := coalesce(p_sede_id, e.sede_id);
  if e.sede_id is not null and sede <> e.sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = p_gimnasio_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  -- VD-48: con la salida prendida, "Adentro ahora" cuenta las visitas abiertas (exacto).
  select coalesce(cv.registrar_salida, 'no'), case when coalesce(cv.visita_horas, 5) > 0 then coalesce(cv.visita_horas, 5) else 5 end into salida_modo, horas_visita
    from (select 1) u left join public.configuracion_visita cv on cv.gimnasio_id = p_gimnasio_id;
  if salida_modo <> 'no' then adentro_etiq := 'Adentro ahora'; end if;
  hoy := privado.dia_local(now(), zona);
  desde := privado.medianoche(hoy, zona);
  hasta := privado.medianoche(hoy + 1, zona);
  mes := privado.medianoche(date_trunc('month', hoy)::date, zona);
  corrido := now() - desde;
  -- La plata del día: dueño y encargado siempre; la recepción solo si el dueño lo prendió (EQU-1).
  ve_plata := e.rol in ('dueno', 'encargado') or (e.rol = 'recepcion' and c.recepcion_ve_cobrado);
  hay_clases := c.modo_clases <> 'ninguno' and not ('clases' = any (c.secciones_apagadas));

  foreach k in array todos loop
    if (k = 'cobrado' and not ve_plata) or (k = 'ocupacion' and not hay_clases) then continue; end if;
    disponibles := disponibles || jsonb_build_array(jsonb_build_object('clave', k, 'etiqueta', case when k = 'adentro' then adentro_etiq else split_part(etiq ->> k, '|', 2) end, 'emoji', split_part(etiq ->> k, '|', 1)));
  end loop;

  foreach k in array c.numeros_inicio loop
    if exists (select 1 from jsonb_array_elements(disponibles) d where d ->> 'clave' = k) then claves := claves || k; end if;
  end loop;
  if cardinality(claves) = 0 then
    foreach k in array case when ve_plata then array['adentro','entraron','cobrado','a_cobrar'] else array['adentro','entraron','a_cobrar','activos'] end loop
      if exists (select 1 from jsonb_array_elements(disponibles) d where d ->> 'clave' = k) then claves := claves || k; end if;
    end loop;
  end if;

  foreach k in array claves loop
    serie := null; v := 0;
    if k = 'adentro' then
      if salida_modo = 'no' then
        select count(distinct i.socio_id) into v from public.ingresos i
         where i.gimnasio_id = p_gimnasio_id and i.momento >= greatest(desde, now() - interval '2 hours') and i.momento <= now()
           and i.anulado_en is null and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede);
      else
        v := privado.adentro_ahora(p_gimnasio_id, sede, now());
      end if;
      -- cuántos había adentro a esta misma hora en cada uno de los últimos 7 días
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(distinct i.socio_id) as n from public.ingresos i
           where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede)
             and i.momento >= greatest(privado.medianoche(g.dia, zona), privado.medianoche(g.dia, zona) + corrido - interval '2 hours')
             and i.momento <= privado.medianoche(g.dia, zona) + corrido) x on true;
    elsif k = 'entraron' then
      select count(distinct i.socio_id) into v from public.ingresos i
       where i.gimnasio_id = p_gimnasio_id and i.momento >= desde and i.momento < hasta and i.anulado_en is null
         and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede);
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(distinct i.socio_id) as n from public.ingresos i
           where i.gimnasio_id = p_gimnasio_id and i.momento >= privado.medianoche(g.dia, zona) and i.momento < privado.medianoche(g.dia + 1, zona)
             and i.anulado_en is null and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede)) x on true;
    elsif k = 'cobrado' then
      select coalesce(sum(p.monto), 0) into v from public.pagos p join public.ventas ve on ve.id = p.venta_id
       where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.aprobado_en >= desde and p.aprobado_en < hasta
         and p.medio <> 'cuenta_corriente' and (sede is null or ve.sede_id = sede);
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select sum(p.monto) as n from public.pagos p join public.ventas ve on ve.id = p.venta_id
           where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.medio <> 'cuenta_corriente'
             and p.aprobado_en >= privado.medianoche(g.dia, zona) and p.aprobado_en < privado.medianoche(g.dia + 1, zona)
             and (sede is null or ve.sede_id = sede)) x on true;
    elsif k = 'a_cobrar' then
      select count(*) filter (where r.lista = 'por_vencer' and r.dias = 0) into v from privado.retencion(p_gimnasio_id, now()) r;
      -- a cuántos les vencía la cobertura en cada uno de los últimos 7 días
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(distinct cb.socio_id) as n from public.coberturas cb
           where cb.gimnasio_id = p_gimnasio_id and cb.anulada_en is null
             and cb.hasta > privado.medianoche(g.dia, zona) and cb.hasta <= privado.medianoche(g.dia + 1, zona)) x on true;
    elsif k = 'activos' then
      select count(distinct cb.socio_id) into v from public.coberturas cb
       where cb.gimnasio_id = p_gimnasio_id and cb.anulada_en is null and cb.desde <= now() and cb.hasta > now();
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(distinct cb.socio_id) as n from public.coberturas cb
           where cb.gimnasio_id = p_gimnasio_id and (cb.anulada_en is null or cb.anulada_en > least(now(), privado.medianoche(g.dia + 1, zona) - interval '1 second'))
             and cb.desde <= least(now(), privado.medianoche(g.dia + 1, zona) - interval '1 second')
             and cb.hasta > least(now(), privado.medianoche(g.dia + 1, zona) - interval '1 second')) x on true;
    elsif k = 'altas_mes' then
      select count(*) into v from public.socios s where s.gimnasio_id = p_gimnasio_id and s.creado_en >= mes;
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(*) as n from public.socios s where s.gimnasio_id = p_gimnasio_id
           and s.creado_en >= privado.medianoche(g.dia, zona) and s.creado_en < privado.medianoche(g.dia + 1, zona)) x on true;
    elsif k = 'bajas_mes' then
      select count(*) into v from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en >= mes;
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(*) as n from public.socios s where s.gimnasio_id = p_gimnasio_id
           and s.dado_de_baja_en >= privado.medianoche(g.dia, zona) and s.dado_de_baja_en < privado.medianoche(g.dia + 1, zona)) x on true;
    elsif k = 'ocupacion' then
      select coalesce(round(100.0 * sum((select count(*) from public.reservas r where r.clase_id = kl.id and r.estado = 'confirmada'))
                            / nullif(sum(kl.cupo), 0)), 0) into v
        from public.clases kl where kl.gimnasio_id = p_gimnasio_id and kl.inicio >= desde and kl.inicio < hasta
         and kl.cancelada_en is null and kl.cupo is not null and (sede is null or kl.sede_id = sede);
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select coalesce(round(100.0 * sum((select count(*) from public.reservas r where r.clase_id = kl.id and r.estado = 'confirmada'))
                                  / nullif(sum(kl.cupo), 0)), 0) as n
           from public.clases kl where kl.gimnasio_id = p_gimnasio_id and kl.inicio >= privado.medianoche(g.dia, zona) and kl.inicio < privado.medianoche(g.dia + 1, zona)
            and kl.cancelada_en is null and kl.cupo is not null and (sede is null or kl.sede_id = sede)) x on true;
    end if;
    -- El último punto es hoy: tiene que coincidir con el número que se ve.
    if serie is not null and jsonb_array_length(serie) = 7 then serie := jsonb_set(serie, '{6}', to_jsonb(coalesce(v, 0))); end if;
    salida := salida || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'clave', k, 'emoji', split_part(etiq ->> k, '|', 1), 'etiqueta', case when k = 'adentro' then adentro_etiq else split_part(etiq ->> k, '|', 2) end,
      'valor', coalesce(v, 0), 'formato', case when k = 'cobrado' then 'pesos' when k = 'ocupacion' then 'porcentaje' end,
      'serie', serie)));
  end loop;

  return jsonb_build_object('numeros', salida, 'elegidos', to_jsonb(c.numeros_inicio), 'disponibles', disponibles,
                            'adentro_exacto', salida_modo <> 'no');
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.registrar_salida(uuid, uuid, text, uuid), public.kiosco_salida_activa(text), public.kiosco_salir(text, text),
  public.registra_salida(uuid), public.salir_por_qr_pared(uuid, uuid, text, timestamptz),
  public.numeros_inicio(uuid, uuid) from public, anon, authenticated;
grant execute on function public.registrar_salida(uuid, uuid, text, uuid), public.registra_salida(uuid), public.salir_por_qr_pared(uuid, uuid, text, timestamptz),
  public.numeros_inicio(uuid, uuid) to authenticated, service_role;
-- La tablet no tiene sesión: el token la autoriza adentro de la función.
grant execute on function public.kiosco_salida_activa(text), public.kiosco_salir(text, text) to anon, authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.salidas'::regclass) then raise exception 'Verificación: salidas sin RLS'; end if;
  if has_table_privilege('anon', 'public.salidas', 'select') then raise exception 'Verificación: anon lee las salidas'; end if;
  if has_table_privilege('authenticated', 'public.salidas', 'insert') or has_table_privilege('authenticated', 'public.salidas', 'update') then
    raise exception 'Verificación: se puede escribir salidas directo';
  end if;
  foreach f in array array['public.registrar_salida(uuid, uuid, text, uuid)', 'public.registra_salida(uuid)',
                           'public.salir_por_qr_pared(uuid, uuid, text, timestamptz)', 'public.numeros_inicio(uuid, uuid)'] loop
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon ejecuta %', f; end if;
  end loop;
  if has_function_privilege('authenticated', 'privado.registrar_salida(uuid, uuid, text, uuid, uuid, timestamptz)', 'execute') then
    raise exception 'Verificación: authenticated ejecuta privado.registrar_salida';
  end if;
  if position('salidas' in pg_get_functiondef('privado.registrar_ingreso(uuid, uuid, text, uuid, uuid, text, timestamptz)'::regprocedure)) = 0 then
    raise exception 'Verificación: registrar_ingreso no mira las salidas';
  end if;
  if position('emergencia_activa' in pg_get_functiondef('privado.registrar_ingreso(uuid, uuid, text, uuid, uuid, text, timestamptz)'::regprocedure)) = 0 then
    raise exception 'Verificación: registrar_ingreso perdió la emergencia';
  end if;
  if position('Adentro ahora' in pg_get_functiondef('public.numeros_inicio(uuid, uuid)'::regprocedure)) = 0 then
    raise exception 'Verificación: numeros_inicio sin "Adentro ahora"';
  end if;
end $$;
