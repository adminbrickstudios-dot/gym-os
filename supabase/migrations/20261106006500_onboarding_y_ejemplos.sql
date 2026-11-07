-- VD-43 · Gimnasio nuevo: primeros pasos calculados y datos de ejemplo.
--
-- Los pasos SE CALCULAN de los datos reales (nunca se guarda "paso hecho"), y los socios de ejemplo no
-- cuentan como datos reales: cargar los ejemplos no tacha "Tus socios". Se suma el paso "Probá la entrada
-- con un DNI" (se tacha cuando hubo una entrada de un socio real).
--
--   socios.es_ejemplo                 marca de los socios ficticios
--   cargar_socios_ejemplo(gimnasio)   10 socios (teléfonos +54 9 000…, mails @ejemplo.invalid); si hay un plan
--                                     de membresía, con su plan y distintos estados de cobertura
--   borrar_socios_ejemplo(gimnasio)   los borra, y solo a ellos; el que ya tiene movimientos reales (una venta,
--                                     una entrada, una reserva) se queda y se avisa
--   datos_ejemplo(gimnasio)           cuántos hay cargados
--   privado.primeros_pasos            9 pasos (copia de 0026 con lo de arriba)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.primeros_pasos(uuid)') is null then raise exception 'VD-43: falta privado.primeros_pasos (0026)'; end if;
  if to_regclass('public.importaciones') is null then raise exception 'VD-43: falta importaciones (0034)'; end if;
  if to_regprocedure('privado.medianoche(date, text)') is null then raise exception 'VD-43: falta privado.medianoche'; end if;
  if position('gymos.deshacer_importacion' in pg_get_functiondef('privado.hecho_inmutable()'::regprocedure)) = 0 then
    raise exception 'VD-43: hecho_inmutable no deja deshacer importaciones';
  end if;
end $$;

alter table public.socios add column if not exists es_ejemplo boolean not null default false;
create index if not exists socios_ejemplo on public.socios (gimnasio_id) where es_ejemplo;

-- ── Los pasos, calculados ───────────────────────────────────────────
create or replace function privado.primeros_pasos(p_gimnasio_id uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare c public.configuracion_gimnasio; l public.landing_gimnasio; con_clases boolean;
begin
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  select * into l from public.landing_gimnasio where gimnasio_id = p_gimnasio_id;
  con_clases := c.modo_clases <> 'ninguno';
  return jsonb_build_array(
    jsonb_build_object('clave', 'gimnasio', 'emoji', '🏠', 'titulo', 'Tus datos y dónde queda',
      'ayuda', 'WhatsApp o mail de contacto, y la dirección.', 'href', '/configuracion?pestana=gimnasio',
      'hecho', (l.whatsapp is not null or l.email_contacto is not null)
               and exists (select 1 from public.sedes s where s.gimnasio_id = p_gimnasio_id and s.activa and s.direccion is not null)),
    jsonb_build_object('clave', 'marca', 'emoji', '🎨', 'titulo', 'Tu logo y tus colores',
      'ayuda', 'Para que el panel, la página y la app sean tuyos.', 'href', '/configuracion?pestana=marca',
      'hecho', c.logo_path is not null),
    jsonb_build_object('clave', 'planes', 'emoji', '🏷️', 'titulo', 'Tus planes y precios',
      'ayuda', 'Lo que vendés y cuánto cuesta.', 'href', '/planes',
      'hecho', exists (select 1 from public.planes p where p.gimnasio_id = p_gimnasio_id and p.activo
                         and privado.precio_base(p.id, now()) is not null)),
    jsonb_build_object('clave', 'horarios', 'emoji', '⏰', 'titulo', case when con_clases then 'Horarios y clases' else 'Tus horarios' end,
      'ayuda', case when con_clases then 'Cuándo abrís y la grilla de clases de la semana.' else 'Cuándo abrís cada día.' end,
      'href', case when con_clases and exists (select 1 from public.horarios_apertura h where h.gimnasio_id = p_gimnasio_id)
                   then '/clases/grilla' else '/configuracion?pestana=horarios' end,
      'hecho', exists (select 1 from public.horarios_apertura h where h.gimnasio_id = p_gimnasio_id)
               and (not con_clases or exists (select 1 from public.horarios_clase h where h.gimnasio_id = p_gimnasio_id))),
    jsonb_build_object('clave', 'cobros', 'emoji', '💳', 'titulo', 'Cómo te pagan',
      'ayuda', 'Medios de pago y tu alias para las transferencias.', 'href', '/configuracion?pestana=cobros',
      'hecho', not ('transferencia' = any (c.medios_aceptados)) or c.alias_transferencia is not null or c.cbu is not null),
    jsonb_build_object('clave', 'equipo', 'emoji', '🧑‍🤝‍🧑', 'titulo', 'Tu equipo',
      'ayuda', 'Recepción, profes y encargados, cada uno con su usuario.', 'href', '/equipo',
      'hecho', exists (select 1 from public.equipo e where e.gimnasio_id = p_gimnasio_id and e.activo and e.rol <> 'dueno' and not e.es_soporte)),
    jsonb_build_object('clave', 'socios', 'emoji', '👥', 'titulo', 'Tus socios',
      'ayuda', 'Cargá los que ya tenés (los de ejemplo no cuentan).', 'href', '/socios/nuevo',
      'hecho', exists (select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and not s.es_ejemplo)),
    jsonb_build_object('clave', 'entrada', 'emoji', '🚪', 'titulo', 'Probá la entrada con un DNI',
      'ayuda', 'Tipeá el DNI de un socio y mirá cómo responde la puerta.', 'href', '/entrada',
      'hecho', exists (select 1 from public.ingresos i join public.socios s on s.id = i.socio_id
                        where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado' and not s.es_ejemplo)),
    jsonb_build_object('clave', 'pagina', 'emoji', '🌐', 'titulo', 'Publicar tu página',
      'ayuda', 'Para que la gente te encuentre y vea tus precios.', 'href', '/configuracion?pestana=pagina',
      'hecho', coalesce(l.publicada, false))
  );
end $$;
revoke all on function privado.primeros_pasos(uuid) from public, anon, authenticated;

-- ── Datos de ejemplo ────────────────────────────────────────────────
create or replace function public.datos_ejemplo(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  return jsonb_build_object('cargados', (select count(*) from public.socios s where s.gimnasio_id = p_gimnasio_id and s.es_ejemplo));
end $$;

create or replace function public.cargar_socios_ejemplo(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  zona text; hoy date; imp uuid; plan uuid; sid uuid; sus uuid; n int := 0; i int;
  nombres text[] := array['Lucía', 'Mateo', 'Camila', 'Joaquín', 'Valentina', 'Santiago', 'Martina', 'Tomás', 'Sofía', 'Facundo'];
  -- Hasta cuándo pagó cada uno, en días desde hoy: al día, por vencer, vence hoy, y sin cobertura (vencidos).
  dias int[] := array[28, 20, 15, 9, 4, 2, 0, null, null, null];
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if exists (select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.es_ejemplo) then
    raise exception 'Ya hay datos de ejemplo cargados: borralos primero si querés empezar de nuevo' using errcode = '22023';
  end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := (now() at time zone zona)::date;
  select p.id into plan from public.planes p
   where p.gimnasio_id = p_gimnasio_id and p.tipo = 'membresia' and p.activo order by p.orden, p.creado_en limit 1;
  insert into public.importaciones (gimnasio_id, archivo, filas, importados, creado_por)
  values (p_gimnasio_id, 'Datos de ejemplo', 10, 0, auth.uid()) returning id into imp;
  for i in 1 .. 10 loop
    insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, email, origen, importacion_id, es_ejemplo, creado_por)
    select p_gimnasio_id, nombres[i], 'Ejemplo ' || i, '9900000' || lpad(i::text, 2, '0'), '+549000111' || lpad(i::text, 4, '0'),
           'ejemplo' || i || '@ejemplo.invalid', 'importacion', imp, true, auth.uid()
     where not exists (select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dni = '9900000' || lpad(i::text, 2, '0'))
    returning id into sid;
    if sid is null then continue; end if;
    n := n + 1;
    if plan is not null then
      insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio, creado_por, importacion_id)
      values (p_gimnasio_id, sid, plan, now() - interval '40 days', auth.uid(), imp) returning id into sus;
      if dias[i] is not null then
        insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, importacion_id, motivo, creado_por)
        values (p_gimnasio_id, sus, sid, privado.medianoche(hoy, zona), privado.medianoche(hoy + dias[i] + 1, zona),
                'importacion', imp, 'Dato de ejemplo', auth.uid());
      end if;
    end if;
    sid := null;
  end loop;
  if n = 0 then raise exception 'No se pudo cargar ningún socio de ejemplo' using errcode = '22023'; end if;
  update public.importaciones set importados = n where id = imp;
  return jsonb_build_object('cargados', n, 'con_plan', plan is not null);
end $$;

create or replace function public.borrar_socios_ejemplo(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s record; borrados int := 0; quedaron int := 0; total int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  select count(*) into total from public.socios x where x.gimnasio_id = p_gimnasio_id and x.es_ejemplo;
  if total = 0 then raise exception 'No hay datos de ejemplo para borrar' using errcode = '22023'; end if;
  for s in select x.id, x.importacion_id from public.socios x where x.gimnasio_id = p_gimnasio_id and x.es_ejemplo order by x.numero loop
    -- hecho_inmutable deja borrar solo lo de esta importación, y solo mientras dura este permiso.
    perform set_config('gymos.deshacer_importacion', coalesce(s.importacion_id::text, ''), true);
    begin
      delete from public.coberturas c where c.gimnasio_id = p_gimnasio_id and c.socio_id = s.id and c.importacion_id = s.importacion_id;
      delete from public.suscripciones su where su.gimnasio_id = p_gimnasio_id and su.socio_id = s.id and su.importacion_id = s.importacion_id;
      delete from public.socios so where so.gimnasio_id = p_gimnasio_id and so.id = s.id and so.es_ejemplo;
      borrados := borrados + 1;
    exception when foreign_key_violation or check_violation then
      quedaron := quedaron + 1;     -- ya tiene movimientos reales: se queda (el bloque deshizo lo suyo)
    end;
  end loop;
  perform set_config('gymos.deshacer_importacion', '', true);
  if borrados + quedaron <> total then raise exception 'No se pudieron borrar los ejemplos'; end if;
  update public.importaciones i set deshecha_en = now(), deshecha_por = auth.uid()
   where i.gimnasio_id = p_gimnasio_id and i.archivo = 'Datos de ejemplo' and i.deshecha_en is null
     and not exists (select 1 from public.socios x where x.gimnasio_id = p_gimnasio_id and x.importacion_id = i.id);
  return jsonb_build_object('borrados', borrados, 'quedaron', quedaron);
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.datos_ejemplo(uuid), public.cargar_socios_ejemplo(uuid), public.borrar_socios_ejemplo(uuid)
  from public, anon, authenticated;
grant execute on function public.datos_ejemplo(uuid), public.cargar_socios_ejemplo(uuid), public.borrar_socios_ejemplo(uuid)
  to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.datos_ejemplo(uuid)', 'public.cargar_socios_ejemplo(uuid)', 'public.borrar_socios_ejemplo(uuid)', 'privado.primeros_pasos(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if exists (select 1 from public.gimnasios g where jsonb_array_length(privado.primeros_pasos(g.id)) <> 9) then
    raise exception 'Verificación: primeros pasos no devuelve los 9 pasos';
  end if;
end $$;
