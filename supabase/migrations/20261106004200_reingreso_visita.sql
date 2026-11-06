-- VD-3 · Reingreso: una visita dura N horas (D24) y anti-préstamo.
--   configuracion_visita            una fila por gimnasio: cuánto dura una visita y cuándo se avisa del préstamo
--   config_visita(g)                equipo del gimnasio: lee (si no hay fila, valen 5 h y 60 min)
--   guardar_config_visita(g, datos) dueño y encargado
--   alertas_prestamo                el tablero del dueño: "volvió a entrar por otra vía en pocos minutos"
--   privado.registrar_ingreso       (misma firma) reemplaza los 60 s fijos:
--       · dentro de la visita, el mismo socio por cualquier vía devuelve "ya entró" (repetido) y NO crea otra
--         entrada, no cuenta para estadísticas y no consume pase ni clase del pack.
--       · si además fue por OTRA vía u OTRO dispositivo y hace menos de N minutos: amarillo "¿es la misma
--         persona?" y queda una alerta para el dueño. N = 0 apaga el aviso.
--       · visita_horas = 0 apaga la ventana larga: queda solo el doble toque de 60 segundos de siempre.
-- El color y el veredicto del que ya entró no cambian: el repetido devuelve los de su entrada.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.registrar_ingreso(uuid, uuid, text, uuid, uuid, text, timestamptz)') is null then raise exception 'Guarda: falta privado.registrar_ingreso'; end if;
  if to_regprocedure('privado.calcular_acceso(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta privado.calcular_acceso'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
  if to_regclass('public.ingresos') is null or to_regclass('public.dispositivos') is null then raise exception 'Guarda: faltan ingresos o dispositivos'; end if;
end $$;

-- ── La configuración ────────────────────────────────────────────────
create table if not exists public.configuracion_visita (
  gimnasio_id          uuid primary key references public.gimnasios(id),
  visita_horas         int not null default 5 check (visita_horas between 0 and 24),
  antiprestamo_minutos int not null default 60 check (antiprestamo_minutos between 0 and 720),
  actualizado_en       timestamptz not null default now()
);
select privado.politicas_estandar('public.configuracion_visita', null, '{}');
revoke all on table public.configuracion_visita from anon;
revoke truncate, references, trigger on public.configuracion_visita from authenticated;

create or replace function public.config_visita(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.configuracion_visita;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  select * into c from public.configuracion_visita where gimnasio_id = p_gimnasio_id;
  if not found then return jsonb_build_object('visita_horas', 5, 'antiprestamo_minutos', 60); end if;
  return jsonb_build_object('visita_horas', c.visita_horas, 'antiprestamo_minutos', c.antiprestamo_minutos);
end $$;

create or replace function public.guardar_config_visita(p_gimnasio_id uuid, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare desconocidos text[]; c public.configuracion_visita; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos' using errcode = '22023'; end if;
  select array_agg(k) into desconocidos from jsonb_object_keys(p_datos) k where k not in ('visita_horas', 'antiprestamo_minutos');
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
  update public.configuracion_visita x set visita_horas = c.visita_horas, antiprestamo_minutos = c.antiprestamo_minutos, actualizado_en = now()
   where x.gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la configuración de la visita.'; end if;
  return public.config_visita(p_gimnasio_id);
end $$;

-- ── Las alertas de préstamo ─────────────────────────────────────────
create table if not exists public.alertas_prestamo (
  id                      uuid primary key default gen_random_uuid(),
  gimnasio_id             uuid not null references public.gimnasios(id),
  sede_id                 uuid not null,
  socio_id                uuid not null,
  momento                 timestamptz not null,
  ingreso_anterior_id     uuid not null,
  via_anterior            text not null,
  via_nueva               text not null,
  dispositivo_anterior_id uuid,
  dispositivo_nuevo_id    uuid,
  minutos                 int not null check (minutos >= 0),
  creado_en               timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, ingreso_anterior_id) references public.ingresos (gimnasio_id, id),
  foreign key (gimnasio_id, dispositivo_anterior_id) references public.dispositivos (gimnasio_id, id),
  foreign key (gimnasio_id, dispositivo_nuevo_id) references public.dispositivos (gimnasio_id, id)
);
create index if not exists alertas_prestamo_momento on public.alertas_prestamo (gimnasio_id, momento desc);
-- Solo el dueño y el encargado la leen; se escribe únicamente desde registrar_ingreso.
select privado.politicas_estandar('public.alertas_prestamo', array['dueno', 'encargado'], '{}');
revoke all on table public.alertas_prestamo from anon;
revoke insert, update, delete, truncate, references, trigger on public.alertas_prestamo from authenticated;

create or replace function public.alertas_prestamo(p_gimnasio_id uuid, p_desde date, p_dias int default 7) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; ini timestamptz; fin timestamptz;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if p_desde is null then raise exception 'Elegí desde qué día.' using errcode = '22023'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 31 then raise exception 'Se mira de 1 a 31 días.' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  ini := privado.medianoche(p_desde, zona); fin := privado.medianoche(p_desde + p_dias, zona);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'alerta_id', a.id, 'momento', a.momento, 'socio_id', s.id, 'socio', trim(s.nombre || ' ' || s.apellido),
      'minutos', a.minutos, 'via_anterior', a.via_anterior, 'via_nueva', a.via_nueva,
      'dispositivo_anterior', da.nombre, 'dispositivo_nuevo', dn.nombre) order by a.momento desc)
    from public.alertas_prestamo a
    join public.socios s on s.id = a.socio_id
    left join public.dispositivos da on da.id = a.dispositivo_anterior_id
    left join public.dispositivos dn on dn.id = a.dispositivo_nuevo_id
   where a.gimnasio_id = p_gimnasio_id and a.momento >= ini and a.momento < fin), '[]'::jsonb);
end $$;

-- ── El registro de la entrada: la visita y el anti-préstamo ─────────
-- Copia de la definición de 20261029000600 (misma firma) con el cambio del bloque "idempotente".
create or replace function privado.registrar_ingreso(
  p_socio_id uuid, p_sede_id uuid, p_via_acceso text, p_registrado_por uuid,
  p_dispositivo_id uuid, p_forzar_motivo text, p_momento timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  g uuid; m timestamptz; prev public.ingresos; v public.veredicto_acceso; res text; nuevo uuid; n int;
  horas int; minutos_prestamo int; ventana interval; zona text; hace int; texto_repetido text;
  etiquetas constant jsonb := jsonb_build_object('recepcion', 'recepción', 'qr_socio', 'el QR', 'qr_pared', 'el QR de la pared',
                                                 'kiosco', 'la tablet', 'nfc', 'el llavero', 'molinete', 'el molinete');
begin
  perform pg_advisory_xact_lock(hashtextextended('gymos:ingreso:' || p_socio_id::text, 0));
  m := coalesce(p_momento, clock_timestamp());

  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Socio inexistente: %', p_socio_id using errcode = 'P0002'; end if;

  select coalesce(c.visita_horas, 5), coalesce(c.antiprestamo_minutos, 60) into horas, minutos_prestamo
    from (select 1) u left join public.configuracion_visita c on c.gimnasio_id = g;
  -- visita_horas = 0: sin ventana larga, queda solo el doble toque de 60 segundos.
  ventana := case when horas > 0 then horas * interval '1 hour' else interval '60 seconds' end;

  -- Idempotente: dentro de la visita, el mismo socio por cualquier vía devuelve su entrada (no crea otra).
  select * into prev from public.ingresos i
   where i.socio_id = p_socio_id and i.anulado_en is null
     and i.resultado in ('entro', 'entro_modo_aviso', 'forzado')
     and i.momento > m - ventana
   order by i.momento desc limit 1;
  if found then
    select gi.zona_horaria into zona from public.gimnasios gi where gi.id = g;
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
    texto_repetido := case when p_via_acceso in ('qr_socio', 'qr_pared', 'kiosco', 'nfc')
                           then 'Ya entraste a las ' || to_char(prev.momento at time zone zona, 'HH24:MI') || ' ✓'
                           else 'Ya entró a las ' || to_char(prev.momento at time zone zona, 'HH24:MI') end;
    return jsonb_build_object('ingreso_id', prev.id, 'repetido', true, 'resultado', prev.resultado,
                              'color', prev.color, 'motivo', prev.motivo, 'texto', texto_repetido,
                              'entro_a', prev.momento);
  end if;

  v := privado.calcular_acceso(p_socio_id, m, p_sede_id);
  if v.puede then
    res := case when v.modo_aviso then 'entro_modo_aviso' else 'entro' end;
  elsif length(trim(coalesce(p_forzar_motivo, ''))) > 0 then
    res := 'forzado';
  else
    res := 'rechazado';
  end if;

  insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado,
                               via_habilitante, color, motivo, texto, forzado_motivo,
                               registrado_por, dispositivo_id)
  values (g, p_sede_id, p_socio_id, m, p_via_acceso, res,
          case when v.puede and not v.modo_aviso and v.via <> 'ninguna' then v.via end,
          v.color, v.motivo, v.texto,
          case when res = 'forzado' then trim(p_forzar_motivo) end,
          p_registrado_por, p_dispositivo_id)
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

  return jsonb_build_object('ingreso_id', nuevo, 'repetido', false, 'resultado', res, 'veredicto', to_jsonb(v));
end $$;

revoke all on function privado.registrar_ingreso(uuid, uuid, text, uuid, uuid, text, timestamptz) from public;
revoke all on function public.config_visita(uuid), public.guardar_config_visita(uuid, jsonb), public.alertas_prestamo(uuid, date, int) from public, anon, authenticated;
grant execute on function public.config_visita(uuid), public.guardar_config_visita(uuid, jsonb), public.alertas_prestamo(uuid, date, int) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.configuracion_visita'::regclass) then raise exception 'Verificación: configuracion_visita sin RLS'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.alertas_prestamo'::regclass) then raise exception 'Verificación: alertas_prestamo sin RLS'; end if;
  if has_function_privilege('anon', 'public.guardar_config_visita(uuid, jsonb)', 'execute') then raise exception 'Verificación: anon puede guardar la visita'; end if;
  if has_function_privilege('anon', 'public.alertas_prestamo(uuid, date, int)', 'execute') then raise exception 'Verificación: anon lee las alertas'; end if;
  if position('configuracion_visita' in pg_get_functiondef('privado.registrar_ingreso(uuid, uuid, text, uuid, uuid, text, timestamptz)'::regprocedure)) = 0 then
    raise exception 'Verificación: registrar_ingreso no lee la configuración de la visita';
  end if;
  if position('60 seconds' in pg_get_functiondef('privado.registrar_ingreso(uuid, uuid, text, uuid, uuid, text, timestamptz)'::regprocedure)) = 0 then
    raise exception 'Verificación: falta el doble toque de 60 segundos con la ventana apagada';
  end if;
end $$;
