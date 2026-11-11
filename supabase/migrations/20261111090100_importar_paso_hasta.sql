-- C2 · Importar socios de un gimnasio real: "pagó hasta" como hecho, también vencido.
-- Completa 20261104003400 (no la edita):
--  * columna "fecha de alta": el socio queda con su antigüedad real (creado_en) y
--    la cobertura arranca ese día;
--  * "pagó hasta" ya vencido también se carga como cobertura (hecho) [desde, hasta)
--    con medianoche local del gimnasio: la puerta dice "debe" desde el primer día
--    (antes quedaba "todavía no pagó", que es otra cosa);
--  * socios.cubierto_hasta lo mantiene el trigger existente, no se escribe acá;
--  * dos importaciones a la vez del mismo gimnasio se turnan (candado), así volver
--    a subir el mismo archivo nunca duplica;
--  * sin DNI: el mismo nombre con el mismo celular tampoco se duplica;
--  * cada inserción verifica la fila afectada; el resultado informa cuántas
--    ya existían y cuántas están repetidas dentro del archivo.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.importar_socios(uuid, jsonb, text)') is null
     or to_regprocedure('privado.fila_importacion(uuid, jsonb)') is null
     or to_regprocedure('privado.revisar_filas(uuid, jsonb)') is null
     or to_regprocedure('privado.fecha_importada(text)') is null then
    raise exception 'Guarda: falta la importación de socios (20261104003400)';
  end if;
  if to_regprocedure('privado.recalcular_cubierto_hasta(uuid)') is null then
    raise exception 'Guarda: falta cubierto_hasta (20261108050100)';
  end if;
end $$;

-- ── Revisar una fila (suma "alta") ──────────────────────────────────
create or replace function privado.fila_importacion(p_gimnasio_id uuid, f jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  err text[] := '{}'; v_nombre text := trim(coalesce(f ->> 'nombre', '')); v_apellido text := trim(coalesce(f ->> 'apellido', ''));
  v_dni text := nullif(regexp_replace(coalesce(f ->> 'dni', ''), '\D', '', 'g'), ''); v_tel text; v_mail text := nullif(lower(trim(coalesce(f ->> 'email', ''))), '');
  v_nac date; v_vence date; v_alta date; v_plan uuid; v_plan_nombre text := nullif(trim(coalesce(f ->> 'plan', '')), '');
  v_zona text; v_hoy date;
begin
  select g.zona_horaria into v_zona from public.gimnasios g where g.id = p_gimnasio_id;
  v_hoy := (now() at time zone coalesce(v_zona, 'America/Argentina/Buenos_Aires'))::date;
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
  -- Sin DNI no hay otra forma de reconocer a un socio que ya está: nombre y celular iguales.
  if v_dni is null and v_tel is not null and v_nombre <> '' and exists (
       select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.telefono = v_tel
          and privado.sin_acentos(lower(s.nombre)) = privado.sin_acentos(lower(v_nombre))) then
    err := array_append(err, format('Sin DNI: ya hay un socio con el nombre %s y ese celular', v_nombre));
  end if;
  if v_mail is not null and v_mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then err := array_append(err, format('Mail “%s”: no es válido', f ->> 'email')); end if;
  begin v_nac := privado.fecha_importada(f ->> 'nacimiento');
  exception when others then err := array_append(err, format('Nacimiento “%s”: usá día/mes/año', f ->> 'nacimiento')); end;
  if v_nac is not null and (v_nac > v_hoy or v_nac < date '1900-01-01') then err := array_append(err, 'Nacimiento: fecha imposible'); end if;
  begin v_alta := privado.fecha_importada(f ->> 'alta');
  exception when others then err := array_append(err, format('Fecha de alta “%s”: usá día/mes/año', f ->> 'alta')); end;
  if v_alta is not null and (v_alta > v_hoy or v_alta < date '1990-01-01') then err := array_append(err, 'Fecha de alta: fecha imposible'); v_alta := null; end if;
  begin v_vence := privado.fecha_importada(f ->> 'vence');
  exception when others then err := array_append(err, format('Pagó hasta “%s”: usá día/mes/año', f ->> 'vence')); end;
  if v_vence is not null and (v_vence < date '1990-01-01' or v_vence > date '2100-01-01') then err := array_append(err, 'Pagó hasta: fecha imposible'); v_vence := null; end if;
  if v_alta is not null and v_vence is not null and v_vence < v_alta then err := array_append(err, 'Pagó hasta es anterior a la fecha de alta'); end if;
  if v_plan_nombre is not null then
    select p.id into v_plan from public.planes p
     where p.gimnasio_id = p_gimnasio_id and p.activo and p.tipo = 'membresia'
       and privado.sin_acentos(lower(p.nombre)) = privado.sin_acentos(lower(v_plan_nombre));
    if v_plan is null then err := array_append(err, format('Plan “%s”: no existe (o no es una membresía activa)', v_plan_nombre)); end if;
  end if;
  if v_vence is not null and v_plan is null and v_plan_nombre is null then err := array_append(err, 'Tiene “pagó hasta” pero no plan'); end if;
  return jsonb_build_object('errores', to_jsonb(err), 'datos', jsonb_build_object(
    'nombre', v_nombre, 'apellido', v_apellido, 'dni', v_dni, 'telefono', v_tel, 'email', v_mail,
    'nacimiento', v_nac, 'plan_id', v_plan, 'vence', v_vence, 'alta', v_alta));
end $$;

-- ── Revisar: suma los conteos de repetidas ──────────────────────────
create or replace function public.revisar_importacion(p_gimnasio_id uuid, p_filas jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  r := privado.revisar_filas(p_gimnasio_id, p_filas);
  return jsonb_build_object(
    'filas', r,
    'validas', (select count(*) from jsonb_array_elements(r) x where not exists (
                  select 1 from jsonb_array_elements_text(x -> 'errores') e where e not like 'Celular repetido%')),
    'ya_existian', (select count(*) from jsonb_array_elements(r) x where exists (
                  select 1 from jsonb_array_elements_text(x -> 'errores') e where e like '%ya es socio' or e like 'Sin DNI: ya hay%')),
    'repetidas_en_archivo', (select count(*) from jsonb_array_elements(r) x where exists (
                  select 1 from jsonb_array_elements_text(x -> 'errores') e where e like 'DNI%repetido en el archivo'))
  );
end $$;

-- ── Importar: una transacción, un candado por gimnasio ──────────────
create or replace function public.importar_socios(p_gimnasio_id uuid, p_filas jsonb, p_archivo text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb; x jsonb; d jsonb; imp uuid; sid uuid; sus uuid; zona text; hoy date; n int := 0; filas_n int; k int;
  v_alta date; v_vence date; v_desde date; v_ya int := 0; v_rep int := 0; v_cob int := 0; v_n_final int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  -- Dos importaciones a la vez del mismo gimnasio se turnan: la segunda ve los DNI de la primera.
  perform pg_advisory_xact_lock(hashtextextended('importar_socios:' || p_gimnasio_id::text, 0));
  r := privado.revisar_filas(p_gimnasio_id, p_filas);
  filas_n := jsonb_array_length(p_filas);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  if zona is null then raise exception 'No se encontró el gimnasio.'; end if;
  hoy := (now() at time zone zona)::date;
  insert into public.importaciones (gimnasio_id, archivo, filas, importados, creado_por)
  values (p_gimnasio_id, left(p_archivo, 200), filas_n, 0, auth.uid()) returning id into imp;
  get diagnostics k = row_count;
  if k <> 1 then raise exception 'No se pudo registrar la importación.'; end if;
  for x in select v from jsonb_array_elements(r) v loop
    if exists (select 1 from jsonb_array_elements_text(x -> 'errores') e where e like '%ya es socio' or e like 'Sin DNI: ya hay%') then v_ya := v_ya + 1; end if;
    if exists (select 1 from jsonb_array_elements_text(x -> 'errores') e where e like 'DNI%repetido en el archivo') then v_rep := v_rep + 1; end if;
    if exists (select 1 from jsonb_array_elements_text(x -> 'errores') e where e not like 'Celular repetido%') then continue; end if;
    d := x -> 'datos';
    v_alta := nullif(d ->> 'alta', '')::date; v_vence := nullif(d ->> 'vence', '')::date;
    insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, email, fecha_nacimiento, origen, importacion_id, creado_por, creado_en)
    values (p_gimnasio_id, d ->> 'nombre', coalesce(d ->> 'apellido', ''), d ->> 'dni', d ->> 'telefono', d ->> 'email',
            (d ->> 'nacimiento')::date, 'importacion', imp, auth.uid(),
            case when v_alta is not null then privado.medianoche(v_alta, zona) else now() end)
    returning id into sid;
    get diagnostics k = row_count;
    if k <> 1 or sid is null then raise exception 'No se pudo crear el socio de la fila %', x ->> 'fila'; end if;
    if (d ->> 'plan_id') is not null then
      -- La cobertura va de la fecha de alta (o de hoy si todavía rige, o del último día si ya venció)
      -- hasta el día siguiente a "pagó hasta" a la medianoche local: [desde, hasta).
      v_desde := case when v_vence is null then null
                      when v_alta is not null then v_alta
                      when v_vence >= hoy then hoy
                      else v_vence end;
      insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio, creado_por, importacion_id)
      values (p_gimnasio_id, sid, (d ->> 'plan_id')::uuid,
              least(now(), privado.medianoche(coalesce(v_desde, v_alta, hoy), zona)), auth.uid(), imp)
      returning id into sus;
      get diagnostics k = row_count;
      if k <> 1 or sus is null then raise exception 'No se pudo crear la suscripción de la fila %', x ->> 'fila'; end if;
      if v_vence is not null then
        insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, importacion_id, motivo, creado_por)
        values (p_gimnasio_id, sus, sid, privado.medianoche(v_desde, zona), privado.medianoche(v_vence + 1, zona),
                'importacion', imp, 'Importado: pagó hasta el ' || to_char(v_vence, 'DD/MM/YYYY'), auth.uid());
        get diagnostics k = row_count;
        if k <> 1 then raise exception 'No se pudo cargar lo que pagó la fila %', x ->> 'fila'; end if;
        v_cob := v_cob + 1;
      end if;
    end if;
    n := n + 1;
  end loop;
  update public.importaciones set importados = n where id = imp;
  get diagnostics k = row_count;
  if k <> 1 then raise exception 'No se pudo cerrar la importación.'; end if;
  select count(*) into v_n_final from public.socios s where s.gimnasio_id = p_gimnasio_id and s.importacion_id = imp;
  if v_n_final <> n then raise exception 'La importación no cerró: % socios creados, % esperados', v_n_final, n; end if;
  analyze public.socios;
  return jsonb_build_object('importacion_id', imp, 'importados', n, 'salteados', filas_n - n,
                            'ya_existian', v_ya, 'repetidas_en_archivo', v_rep, 'con_cobertura', v_cob);
end $$;

-- ── Permisos (las firmas no cambian; se reafirman) ──────────────────
revoke all on function privado.fila_importacion(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.revisar_importacion(uuid, jsonb), public.importar_socios(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.revisar_importacion(uuid, jsonb), public.importar_socios(uuid, jsonb, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'public' and p.proname in ('revisar_importacion', 'importar_socios'))
               or (s.nspname = 'privado' and p.proname = 'fila_importacion') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'importar_socios') <> 1 then
    raise exception 'Verificación: importar_socios quedó duplicada';
  end if;
end $$;
