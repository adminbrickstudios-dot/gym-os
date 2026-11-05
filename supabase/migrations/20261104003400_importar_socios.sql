-- 0034 · Importar socios desde Excel o CSV (SOC-1).
-- La pantalla lee el archivo y manda las filas ya con cada columna en su
-- lugar; la base revisa cada fila (nombre, DNI, celular, mail, nacimiento,
-- plan, vence el) y dice qué está mal y dónde, sin guardar nada. Al importar
-- entra todo lo válido junto (lo que tiene error se saltea y se informa).
-- "Vence el" se carga como una cobertura de origen "importación" (un hecho),
-- nunca como un estado. Una importación se puede deshacer completa durante
-- 24 horas si sus socios todavía no tienen movimientos (entradas, ventas,
-- reservas): se borra como si nunca hubiera pasado, solo desde esta función.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'socios' and column_name = 'importacion_id') then
    raise exception 'Guarda: falta socios.importacion_id';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'coberturas' and column_name = 'importacion_id') then
    raise exception 'Guarda: falta coberturas.importacion_id';
  end if;
  if to_regprocedure('privado.telefono_normalizado(text, text)') is null or to_regprocedure('privado.asignar_plan(uuid, uuid, timestamptz, uuid)') is null
     or to_regprocedure('privado.medianoche(date, text)') is null or to_regprocedure('privado.sin_acentos(text)') is null then
    raise exception 'Guarda: faltan funciones base';
  end if;
end $$;

-- ── Tabla de importaciones ──────────────────────────────────────────
create table if not exists public.importaciones (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  archivo      text check (archivo is null or length(archivo) <= 200),
  filas        int not null check (filas >= 0),
  importados   int not null check (importados >= 0),
  creado_en    timestamptz not null default now(),
  creado_por   uuid references auth.users(id),
  deshecha_en  timestamptz,
  deshecha_por uuid references auth.users(id),
  unique (gimnasio_id, id)
);
select privado.politicas_estandar('public.importaciones', array['dueno', 'encargado'], null);
revoke all on table public.importaciones from anon;

alter table public.suscripciones add column if not exists importacion_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'socios_importacion_fk') then
    alter table public.socios add constraint socios_importacion_fk foreign key (gimnasio_id, importacion_id) references public.importaciones (gimnasio_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suscripciones_importacion_fk') then
    alter table public.suscripciones add constraint suscripciones_importacion_fk foreign key (gimnasio_id, importacion_id) references public.importaciones (gimnasio_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'coberturas_importacion_fk') then
    alter table public.coberturas add constraint coberturas_importacion_fk foreign key (gimnasio_id, importacion_id) references public.importaciones (gimnasio_id, id);
  end if;
end $$;

-- ── Los hechos no se borran… salvo deshacer una importación ─────────
-- Copia de hecho_inmutable (0004) con una sola excepción: durante
-- deshacer_importacion (que pone gymos.deshacer_importacion en la
-- transacción) se pueden borrar las filas de ESA importación. Del lado del
-- cliente nadie puede borrar estas tablas (RLS sin políticas de borrado).
create or replace function privado.hecho_inmutable() returns trigger
language plpgsql set search_path = '' as $$
declare
  permitidas text[] := tg_argv::text[];
  viejo jsonb; nuevo jsonb; k text;
begin
  if tg_op = 'DELETE' then
    if nullif(current_setting('gymos.deshacer_importacion', true), '') is not null
       and (to_jsonb(old) ->> 'importacion_id') = current_setting('gymos.deshacer_importacion', true) then
      return old;
    end if;
    raise exception 'Los registros de % no se borran: se anulan', tg_table_name using errcode = 'check_violation';
  end if;
  viejo := to_jsonb(old); nuevo := to_jsonb(new);
  for k in select jsonb_object_keys(nuevo) loop
    if (viejo -> k) is distinct from (nuevo -> k) and not (k = any (permitidas)) then
      raise exception 'En % solo se puede cambiar: %', tg_table_name, coalesce(array_to_string(permitidas, ', '), 'nada')
        using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end $$;
revoke all on function privado.hecho_inmutable() from public;

-- ── Una fecha como la escribe la gente ─────────────────────────────
create or replace function privado.fecha_importada(p_texto text) returns date
language plpgsql immutable set search_path = '' as $$
declare t text := trim(coalesce(p_texto, '')); p text[];
begin
  if t = '' then return null; end if;
  if t ~ '^\d{4}-\d{1,2}-\d{1,2}$' then return t::date; end if;
  p := regexp_match(t, '^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$');
  if p is null then raise exception 'fecha'; end if;
  return make_date(case when length(p[3]) = 2 then 2000 + p[3]::int else p[3]::int end, p[2]::int, p[1]::int);
end $$;

-- ── Revisar una fila ────────────────────────────────────────────────
-- Devuelve {datos, errores[]}. Los repetidos dentro del archivo los marca quien llama.
create or replace function privado.fila_importacion(p_gimnasio_id uuid, f jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  err text[] := '{}'; v_nombre text := trim(coalesce(f ->> 'nombre', '')); v_apellido text := trim(coalesce(f ->> 'apellido', ''));
  v_dni text := nullif(regexp_replace(coalesce(f ->> 'dni', ''), '\D', '', 'g'), ''); v_tel text; v_mail text := nullif(lower(trim(coalesce(f ->> 'email', ''))), '');
  v_nac date; v_vence date; v_plan uuid; v_plan_nombre text := nullif(trim(coalesce(f ->> 'plan', '')), '');
begin
  -- "Juan Pérez" en una sola columna: se separa en nombre y apellido.
  if v_apellido = '' and position(' ' in v_nombre) > 0 then
    v_apellido := trim(substr(v_nombre, position(' ' in v_nombre) + 1)); v_nombre := split_part(v_nombre, ' ', 1);
  end if;
  if v_nombre = '' then err := array_append(err, 'Falta el nombre'); end if;
  if length(v_nombre) > 80 or length(v_apellido) > 80 then err := array_append(err, 'Nombre o apellido de más de 80 letras'); end if;
  if v_dni is not null and v_dni !~ '^[0-9]{6,9}$' then err := array_append(err, format('DNI “%s”: entre 6 y 9 números', f ->> 'dni')); end if;
  if v_dni is not null and exists (select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dni = v_dni) then
    err := array_append(err, format('DNI %s: ya es socio', v_dni));
  end if;
  begin
    v_tel := privado.telefono_normalizado(f ->> 'telefono', 'Celular');
  exception when others then err := array_append(err, format('Celular “%s”: no se entiende', f ->> 'telefono'));
  end;
  if v_mail is not null and v_mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then err := array_append(err, format('Mail “%s”: no es válido', f ->> 'email')); end if;
  begin v_nac := privado.fecha_importada(f ->> 'nacimiento');
  exception when others then err := array_append(err, format('Nacimiento “%s”: usá día/mes/año', f ->> 'nacimiento')); end;
  if v_nac is not null and (v_nac > current_date or v_nac < date '1900-01-01') then err := array_append(err, 'Nacimiento: fecha imposible'); end if;
  begin v_vence := privado.fecha_importada(f ->> 'vence');
  exception when others then err := array_append(err, format('Vence “%s”: usá día/mes/año', f ->> 'vence')); end;
  if v_plan_nombre is not null then
    select p.id into v_plan from public.planes p
     where p.gimnasio_id = p_gimnasio_id and p.activo and p.tipo = 'membresia'
       and privado.sin_acentos(lower(p.nombre)) = privado.sin_acentos(lower(v_plan_nombre));
    if v_plan is null then err := array_append(err, format('Plan “%s”: no existe (o no es una membresía activa)', v_plan_nombre)); end if;
  end if;
  if v_vence is not null and v_plan is null and v_plan_nombre is null then err := array_append(err, 'Tiene “vence el” pero no plan'); end if;
  return jsonb_build_object('errores', to_jsonb(err), 'datos', jsonb_build_object(
    'nombre', v_nombre, 'apellido', v_apellido, 'dni', v_dni, 'telefono', v_tel, 'email', v_mail,
    'nacimiento', v_nac, 'plan_id', v_plan, 'vence', v_vence));
end $$;

-- Revisa todas las filas, con los repetidos dentro del archivo.
create or replace function privado.revisar_filas(p_gimnasio_id uuid, p_filas jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare r jsonb := '[]'; f jsonb; x jsonb; i int := 0; dnis text[] := '{}'; tels text[] := '{}'; err jsonb;
begin
  if jsonb_typeof(p_filas) is distinct from 'array' then raise exception 'Datos inválidos'; end if;
  if jsonb_array_length(p_filas) = 0 then raise exception 'El archivo no tiene filas'; end if;
  if jsonb_array_length(p_filas) > 5000 then raise exception 'Hasta 5.000 socios por vez (el archivo tiene %)', jsonb_array_length(p_filas); end if;
  for f in select v from jsonb_array_elements(p_filas) v loop
    i := i + 1;
    x := privado.fila_importacion(p_gimnasio_id, f);
    err := x -> 'errores';
    if (x -> 'datos' ->> 'dni') is not null then
      if (x -> 'datos' ->> 'dni') = any (dnis) then err := err || to_jsonb(format('DNI %s: repetido en el archivo', x -> 'datos' ->> 'dni')); end if;
      dnis := dnis || (x -> 'datos' ->> 'dni');
    end if;
    if (x -> 'datos' ->> 'telefono') is not null then
      if (x -> 'datos' ->> 'telefono') = any (tels) then err := err || to_jsonb('Celular repetido en el archivo (se importa igual)'::text); end if;
      tels := tels || (x -> 'datos' ->> 'telefono');
    end if;
    r := r || jsonb_build_array(jsonb_build_object('fila', i, 'errores', err, 'datos', x -> 'datos'));
  end loop;
  return r;
end $$;

-- ── Público (equipo): revisar, importar, ver y deshacer ────────────
create or replace function public.revisar_importacion(p_gimnasio_id uuid, p_filas jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  r := privado.revisar_filas(p_gimnasio_id, p_filas);
  return jsonb_build_object(
    'filas', r,
    'validas', (select count(*) from jsonb_array_elements(r) x where not exists (
                  select 1 from jsonb_array_elements_text(x -> 'errores') e where e not like 'Celular repetido%'))
  );
end $$;

create or replace function public.importar_socios(p_gimnasio_id uuid, p_filas jsonb, p_archivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb; x jsonb; d jsonb; imp uuid; sid uuid; sus uuid; zona text; hoy date; n int := 0;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  r := privado.revisar_filas(p_gimnasio_id, p_filas);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := (now() at time zone zona)::date;
  insert into public.importaciones (gimnasio_id, archivo, filas, importados, creado_por)
  values (p_gimnasio_id, left(p_archivo, 200), jsonb_array_length(p_filas), 0, auth.uid()) returning id into imp;
  for x in select v from jsonb_array_elements(r) v loop
    if exists (select 1 from jsonb_array_elements_text(x -> 'errores') e where e not like 'Celular repetido%') then continue; end if;
    d := x -> 'datos';
    insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, email, fecha_nacimiento, origen, importacion_id, creado_por)
    values (p_gimnasio_id, d ->> 'nombre', coalesce(d ->> 'apellido', ''), d ->> 'dni', d ->> 'telefono', d ->> 'email',
            (d ->> 'nacimiento')::date, 'importacion', imp, auth.uid())
    returning id into sid;
    if (d ->> 'plan_id') is not null then
      -- Como privado.asignar_plan, pero atada a la importación (para poder deshacerla).
      insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio, creado_por, importacion_id)
      values (p_gimnasio_id, sid, (d ->> 'plan_id')::uuid, now(), auth.uid(), imp) returning id into sus;
      -- Pagó hasta "vence el" (inclusive): una cobertura de origen importación, desde hoy.
      if (d ->> 'vence') is not null and (d ->> 'vence')::date >= hoy then
        insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, importacion_id, motivo, creado_por)
        values (p_gimnasio_id, sus, sid, privado.medianoche(hoy, zona), privado.medianoche((d ->> 'vence')::date + 1, zona),
                'importacion', imp, 'Importado: pagó hasta el ' || to_char((d ->> 'vence')::date, 'DD/MM/YYYY'), auth.uid());
      end if;
    end if;
    n := n + 1;
  end loop;
  update public.importaciones set importados = n where id = imp;
  analyze public.socios;
  return jsonb_build_object('importacion_id', imp, 'importados', n, 'salteados', jsonb_array_length(p_filas) - n);
end $$;

create or replace function public.importaciones_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'archivo', i.archivo, 'filas', i.filas, 'importados', i.importados,
            'creado_en', i.creado_en, 'deshecha_en', i.deshecha_en,
            'puede_deshacer', i.deshecha_en is null and i.creado_en > now() - interval '24 hours' and i.importados > 0)
            order by i.creado_en desc), '[]')
    from public.importaciones i where i.gimnasio_id = p_gimnasio_id);
end $$;

create or replace function public.deshacer_importacion(p_gimnasio_id uuid, p_importacion_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare i public.importaciones; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select * into i from public.importaciones x where x.gimnasio_id = p_gimnasio_id and x.id = p_importacion_id for update;
  if i.id is null then raise exception 'No se encontró esa importación.'; end if;
  if i.deshecha_en is not null then raise exception 'Esa importación ya se deshizo.'; end if;
  if i.creado_en <= now() - interval '24 hours' then raise exception 'Pasaron más de 24 horas: ya no se puede deshacer entera. Corregí los socios uno por uno.'; end if;
  perform set_config('gymos.deshacer_importacion', i.id::text, true);
  begin
    delete from public.coberturas c where c.gimnasio_id = p_gimnasio_id and c.importacion_id = i.id;
    delete from public.suscripciones s where s.gimnasio_id = p_gimnasio_id and s.importacion_id = i.id;
    delete from public.socios s where s.gimnasio_id = p_gimnasio_id and s.importacion_id = i.id;
    get diagnostics n = row_count;
  exception when foreign_key_violation or check_violation then
    raise exception 'No se puede deshacer: algunos de esos socios ya tienen movimientos (entradas, ventas, reservas o pagos).';
  end;
  perform set_config('gymos.deshacer_importacion', '', true);
  update public.importaciones set deshecha_en = now(), deshecha_por = auth.uid() where id = i.id;
  return n;
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function privado.fecha_importada(text), privado.fila_importacion(uuid, jsonb), privado.revisar_filas(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.revisar_importacion(uuid, jsonb), public.importar_socios(uuid, jsonb, text),
  public.importaciones_panel(uuid), public.deshacer_importacion(uuid, uuid) from public, anon, authenticated;
grant execute on function public.revisar_importacion(uuid, jsonb), public.importar_socios(uuid, jsonb, text),
  public.importaciones_panel(uuid), public.deshacer_importacion(uuid, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.importaciones'::regclass) then raise exception 'Verificación: importaciones sin RLS'; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'importaciones' and cmd <> 'SELECT') then
    raise exception 'Verificación: importaciones se puede escribir desde el cliente';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('coberturas', 'suscripciones') and cmd in ('DELETE', 'ALL')) then
    raise exception 'Verificación: coberturas o suscripciones se pueden borrar desde el cliente';
  end if;
  if privado.fecha_importada('5/11/2026') <> date '2026-11-05' or privado.fecha_importada('2026-11-05') <> date '2026-11-05'
     or privado.fecha_importada('05-11-26') <> date '2026-11-05' then
    raise exception 'Verificación: las fechas no se leen como día/mes/año';
  end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'public' and p.proname in ('revisar_importacion', 'importar_socios', 'importaciones_panel', 'deshacer_importacion'))
               or (s.nspname = 'privado' and p.proname in ('fecha_importada', 'fila_importacion', 'revisar_filas', 'hecho_inmutable')) loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
end $$;
