-- 0052 · Llavero o tarjeta con lector USB (ENT-7, A5).
-- Cada socio puede tener un llavero/tarjeta (el código que escribe el lector),
-- único por gimnasio. En la recepción, el lector lo escribe en el buscador y
-- Enter: entra directo si puede (forma "nfc"). En la tablet también. Se
-- asigna y se quita desde la ficha. Solo con la forma "nfc" prendida.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.entrar_por_qr_pared(uuid, uuid, text, timestamptz)') is null then raise exception 'Guarda: falta la migración 0051'; end if;
end $$;

alter table public.socios add column if not exists llavero text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'socios_llavero_valido') then
    alter table public.socios add constraint socios_llavero_valido check (llavero is null or llavero ~ '^[A-Z0-9]{4,30}$');
  end if;
end $$;
create unique index if not exists socios_llavero_por_gimnasio on public.socios (gimnasio_id, llavero) where llavero is not null;

create or replace function privado.normalizar_llavero(p text) returns text
language sql immutable set search_path = '' as $$
  select nullif(upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')), '')
$$;
revoke all on function privado.normalizar_llavero(text) from public, anon, authenticated;

create or replace function public.asignar_llavero(p_socio_id uuid, p_codigo text) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; c text := privado.normalizar_llavero(p_codigo); otro text; n int;
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  if c is null or c !~ '^[A-Z0-9]{4,30}$' then raise exception 'Pasá el llavero por el lector (o escribí su código: de 4 a 30 letras o números).' using errcode = '22023'; end if;
  select trim(s.nombre || ' ' || s.apellido) into otro from public.socios s where s.gimnasio_id = g and s.llavero = c and s.id <> p_socio_id;
  if otro is not null then raise exception 'Ese llavero ya es de %: quitáselo primero.', otro using errcode = '23505'; end if;
  update public.socios set llavero = c where id = p_socio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo asignar el llavero.'; end if;
end $$;

create or replace function public.quitar_llavero(p_socio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  update public.socios set llavero = null where id = p_socio_id and llavero is not null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No tenía llavero.'; end if;
end $$;

create or replace function public.llavero_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  return jsonb_build_object('usa', exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = g and 'nfc' = any (c.accesos_activos)),
                            'llavero', (select s.llavero from public.socios s where s.id = p_socio_id));
end $$;

-- Lo que escribió el lector en la recepción: ¿es el llavero de alguien? (null si no)
create or replace function public.leer_llavero(p_gimnasio_id uuid, p_codigo text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if not exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id and 'nfc' = any (c.accesos_activos)) then return null; end if;
  select * into s from public.socios where gimnasio_id = p_gimnasio_id and llavero = privado.normalizar_llavero(p_codigo);
  if s.id is null then return null; end if;
  if s.dado_de_baja_en is not null then raise exception '% está dado de baja.', trim(s.nombre || ' ' || s.apellido) using errcode = '22023'; end if;
  return jsonb_build_object('socio_id', s.id, 'nombre', trim(s.nombre || ' ' || s.apellido), 'numero', s.numero);
end $$;

-- La tablet (0050), misma firma: también acepta el llavero.
create or replace function public.kiosco_entrar(p_token text, p_codigo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d public.dispositivos; sid uuid; s public.socios; v public.veredicto_acceso; r jsonb; v_dni text;
begin
  d := privado.tablet_del_token(p_token);
  -- Freno contra probar DNIs al azar: 30 intentos por minuto por tablet.
  if (select count(*) from public.ingresos i where i.dispositivo_id = d.id and i.momento > now() - interval '1 minute') >= 30 then
    raise exception 'Demasiados intentos: esperá un minuto.' using errcode = '54000';
  end if;
  -- Llavero o tarjeta (ENT-7): si el gimnasio lo usa y el código es de un socio, es ese.
  if exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = d.gimnasio_id and 'nfc' = any (c.accesos_activos)) then
    select so.id into sid from public.socios so
     where so.gimnasio_id = d.gimnasio_id and so.llavero = privado.normalizar_llavero(p_codigo) and so.dado_de_baja_en is null;
  end if;
  if sid is not null then
    null;
  elsif trim(coalesce(p_codigo, '')) ~ '^GYMOS1\.' then
    if not exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = d.gimnasio_id and 'qr_socio' = any (c.accesos_activos)) then
      raise exception 'Este gimnasio no usa QR: escribí tu DNI.' using errcode = '22023';
    end if;
    sid := privado.validar_qr(d.gimnasio_id, p_codigo, now());
  else
    v_dni := regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g');
    if v_dni !~ '^[0-9]{6,9}$' then raise exception 'Escribí tu DNI, sin puntos.' using errcode = '22023'; end if;
    select so.id into sid from public.socios so where so.gimnasio_id = d.gimnasio_id and so.dni = v_dni and so.dado_de_baja_en is null;
    if sid is null then raise exception 'No encontramos ese DNI. Pasá por recepción.' using errcode = '22023'; end if;
  end if;
  select * into s from public.socios where id = sid;
  update public.dispositivos set ultimo_uso = now() where id = d.id;
  r := privado.registrar_ingreso(sid, d.sede_id, 'kiosco', null, d.id, null, null);
  v := privado.calcular_acceso(sid, now() - interval '1 second', d.sede_id);
  return jsonb_build_object('nombre', s.nombre, 'resultado', r ->> 'resultado', 'repetido', (r ->> 'repetido')::boolean,
    'color', coalesce(r #>> '{veredicto,color}', r ->> 'color', v.color),
    -- En la puerta lo ve cualquiera: sin la indicación para la recepción y sin montos.
    'texto', regexp_replace(replace(coalesce(r #>> '{veredicto,texto}', r ->> 'texto', v.texto), ' · avisale', ''), ' · debe [^·]*', '', 'g'));
end $$;

revoke all on function public.asignar_llavero(uuid, text), public.quitar_llavero(uuid), public.llavero_socio(uuid), public.leer_llavero(uuid, text),
  public.kiosco_entrar(text, text) from public, anon, authenticated;
grant execute on function public.asignar_llavero(uuid, text), public.quitar_llavero(uuid), public.llavero_socio(uuid), public.leer_llavero(uuid, text)
  to authenticated, service_role;
grant execute on function public.kiosco_entrar(text, text) to anon, authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  if privado.normalizar_llavero(' 00ab-12 ') <> '00AB12' then raise exception 'Verificación: normalizar_llavero'; end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'public' and p.proname in ('asignar_llavero', 'quitar_llavero', 'llavero_socio', 'leer_llavero', 'kiosco_entrar'))
               or (s.nspname = 'privado' and p.proname = 'normalizar_llavero') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if r.proname <> 'kiosco_entrar' and has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
end $$;
