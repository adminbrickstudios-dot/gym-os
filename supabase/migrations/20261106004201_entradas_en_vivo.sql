-- VD-4 · Entradas en vivo en todas las pantallas del panel.
--   entradas_desde(gimnasio, sede, desde)   equipo de puerta: las entradas e intentos posteriores a un momento
--                                           (y, para dueño/encargado, los avisos de préstamo). Sin `desde` solo devuelve
--                                           el cursor (`hasta`) para empezar a mirar desde ahora.
--   configuracion_visita.avisar_en_vivo     "Avisar entradas por QR/tablet en todas las pantallas" (sí por defecto)
--   config_visita / guardar_config_visita   (misma firma, se reemplazan) ahora llevan también avisar_en_vivo
-- Sin Realtime por ahora: la pantalla pregunta cada 4 s mientras la pestaña se ve. El cursor es de la base
-- (`hasta`), no del reloj del navegador.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.configuracion_visita') is null then raise exception 'Guarda: falta configuracion_visita (4200)'; end if;
  if to_regclass('public.alertas_prestamo') is null then raise exception 'Guarda: falta alertas_prestamo (4200)'; end if;
  if to_regprocedure('privado.calcular_acceso(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta privado.calcular_acceso'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
end $$;

alter table public.configuracion_visita add column if not exists avisar_en_vivo boolean not null default true;

create or replace function public.config_visita(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.configuracion_visita;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  select * into c from public.configuracion_visita where gimnasio_id = p_gimnasio_id;
  if not found then return jsonb_build_object('visita_horas', 5, 'antiprestamo_minutos', 60, 'avisar_en_vivo', true); end if;
  return jsonb_build_object('visita_horas', c.visita_horas, 'antiprestamo_minutos', c.antiprestamo_minutos, 'avisar_en_vivo', c.avisar_en_vivo);
end $$;

create or replace function public.guardar_config_visita(p_gimnasio_id uuid, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare desconocidos text[]; c public.configuracion_visita; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos' using errcode = '22023'; end if;
  select array_agg(k) into desconocidos from jsonb_object_keys(p_datos) k where k not in ('visita_horas', 'antiprestamo_minutos', 'avisar_en_vivo');
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
  update public.configuracion_visita x set visita_horas = c.visita_horas, antiprestamo_minutos = c.antiprestamo_minutos,
         avisar_en_vivo = c.avisar_en_vivo, actualizado_en = now()
   where x.gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la configuración de la visita.'; end if;
  return public.config_visita(p_gimnasio_id);
end $$;

-- ── Lo que pasó en la puerta desde un momento ───────────────────────
create or replace function public.entradas_desde(p_gimnasio_id uuid, p_sede_id uuid default null, p_desde timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.equipo; sede uuid; hasta timestamptz := clock_timestamp(); desde timestamptz; avisar boolean;
  entradas jsonb; alertas jsonb := '[]'::jsonb;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  sede := coalesce(p_sede_id, e.sede_id);
  if e.sede_id is not null and sede <> e.sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  select coalesce(c.avisar_en_vivo, true) into avisar
    from (select 1) u left join public.configuracion_visita c on c.gimnasio_id = p_gimnasio_id;
  -- Sin cursor: solo se anota desde cuándo mirar.
  if p_desde is null then
    return jsonb_build_object('hasta', hasta, 'avisar', avisar, 'entradas', '[]'::jsonb, 'alertas', '[]'::jsonb);
  end if;
  -- Una pestaña que estuvo dormida horas no recibe todo de golpe: como mucho los últimos 10 minutos.
  desde := greatest(p_desde, hasta - interval '10 minutes');

  select coalesce(jsonb_agg(jsonb_build_object(
           'ingreso_id', x.id, 'momento', x.momento, 'socio_id', x.socio_id, 'socio', x.socio, 'numero', x.numero,
           'resultado', x.resultado, 'color', x.color, 'texto', x.texto, 'via_acceso', x.via_acceso, 'sede_id', x.sede_id,
           'cobrar', case when x.resultado in ('rechazado', 'forzado') or x.color in ('rojo', 'naranja')
                          then not coalesce((x.v).puede and (x.v).color = 'verde', false) else false end) order by x.creado_en), '[]'::jsonb)
    into entradas
    from (
      select i.id, i.momento, i.creado_en, i.socio_id, trim(s.nombre || ' ' || s.apellido) as socio, s.numero, i.resultado, i.color, i.texto,
             i.via_acceso, i.sede_id,
             case when i.resultado in ('rechazado', 'forzado') or i.color in ('rojo', 'naranja')
                  then privado.calcular_acceso(i.socio_id, now(), null) end as v
        from public.ingresos i
        join public.socios s on s.id = i.socio_id
       where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null
         and i.creado_en > desde and i.creado_en <= hasta
         and (sede is null or i.sede_id = sede)
       order by i.creado_en
       limit 30
    ) x;

  -- El aviso de préstamo es para el dueño y el encargado.
  if e.rol in ('dueno', 'encargado') then
    select coalesce(jsonb_agg(jsonb_build_object(
             'alerta_id', a.id, 'momento', a.momento, 'socio_id', a.socio_id, 'socio', trim(s.nombre || ' ' || s.apellido),
             'minutos', a.minutos, 'via_anterior', a.via_anterior, 'via_nueva', a.via_nueva) order by a.creado_en), '[]'::jsonb)
      into alertas
      from public.alertas_prestamo a join public.socios s on s.id = a.socio_id
     where a.gimnasio_id = p_gimnasio_id and a.creado_en > desde and a.creado_en <= hasta and (sede is null or a.sede_id = sede);
  end if;

  return jsonb_build_object('hasta', hasta, 'avisar', avisar, 'entradas', entradas, 'alertas', alertas);
end $$;

revoke all on function public.config_visita(uuid), public.guardar_config_visita(uuid, jsonb), public.entradas_desde(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.config_visita(uuid), public.guardar_config_visita(uuid, jsonb), public.entradas_desde(uuid, uuid, timestamptz) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_visita' and column_name = 'avisar_en_vivo') then
    raise exception 'Verificación: falta avisar_en_vivo';
  end if;
  if has_function_privilege('anon', 'public.entradas_desde(uuid, uuid, timestamptz)', 'execute') then raise exception 'Verificación: anon puede pedir las entradas'; end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'entradas_desde') <> 1 then
    raise exception 'Verificación: hay más de una entradas_desde';
  end if;
end $$;
