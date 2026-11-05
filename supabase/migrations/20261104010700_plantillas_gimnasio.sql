-- 0107 · Plantillas por tipo de gimnasio al crear (ADM-1).
-- El super admin elige el tipo (la tabla de HOJA-DE-RUTA: musculación,
-- grande, box, yoga/pilates, artes marciales, natación, personal, 24 h) y
-- queda prendido lo que corresponde: modo de clases, qué cobra, turnos fijos,
-- actividades y planes de ejemplo. Los planes van SIN precio: el precio lo
-- pone el dueño (Primeros pasos se lo pide); hasta entonces no se venden.
--   admin_aplicar_plantilla(gimnasio, tipo)   solo en un gimnasio sin planes
--   privado.plantillas_gimnasio()             el catálogo

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.pedidos_baja_pendientes(uuid)') is null then raise exception 'Guarda: falta la migración 0106'; end if;
  if to_regprocedure('public.admin_crear_gimnasio(text, text, text, text)') is null then raise exception 'Guarda: falta admin_crear_gimnasio'; end if;
end $$;

create or replace function privado.plantillas_gimnasio() returns jsonb
language sql immutable set search_path = '' as $$
  select '{
    "musculacion": {"modo_clases": "ninguno", "membresia": true, "pase": true, "pack": false, "turnos_fijos": false, "actividades": [],
      "planes": [{"tipo": "membresia", "nombre": "Mensual libre", "duracion_meses": 1}, {"tipo": "pase_diario", "nombre": "Pase diario"}]},
    "grande": {"modo_clases": "sin_reserva", "membresia": true, "pase": true, "pack": false, "turnos_fijos": false, "actividades": [["Funcional", "🔥"], ["Spinning", "🚴"]],
      "planes": [{"tipo": "membresia", "nombre": "Mensual", "duracion_meses": 1}, {"tipo": "membresia", "nombre": "Trimestral", "duracion_meses": 3}, {"tipo": "pase_diario", "nombre": "Pase diario"}]},
    "box": {"modo_clases": "reserva", "membresia": true, "pase": true, "pack": true, "turnos_fijos": false, "actividades": [["CrossFit", "🔥"], ["Funcional", "💪"]],
      "planes": [{"tipo": "membresia", "nombre": "Libre mensual", "duracion_meses": 1}, {"tipo": "pack", "nombre": "Pack 8 clases", "cantidad_clases": 8, "validez_dias": 30},
                 {"tipo": "pack", "nombre": "Pack 12 clases", "cantidad_clases": 12, "validez_dias": 30}]},
    "yoga": {"modo_clases": "reserva", "membresia": true, "pase": false, "pack": true, "turnos_fijos": true, "actividades": [["Yoga", "🧘"], ["Pilates", "🤸"]],
      "planes": [{"tipo": "pack", "nombre": "Pack 4 clases", "cantidad_clases": 4, "validez_dias": 30}, {"tipo": "pack", "nombre": "Pack 8 clases", "cantidad_clases": 8, "validez_dias": 30},
                 {"tipo": "pack", "nombre": "Pack 12 clases", "cantidad_clases": 12, "validez_dias": 45}, {"tipo": "membresia", "nombre": "Libre mensual", "duracion_meses": 1}]},
    "artes": {"modo_clases": "sin_reserva", "membresia": true, "pase": false, "pack": false, "turnos_fijos": false, "actividades": [["Artes marciales", "🥋"], ["Infantiles", "🧒"]],
      "planes": [{"tipo": "membresia", "nombre": "Cuota mensual", "duracion_meses": 1}, {"tipo": "membresia", "nombre": "2 veces por semana", "duracion_meses": 1, "max_ingresos_semana": 2}]},
    "natacion": {"modo_clases": "reserva", "membresia": true, "pase": false, "pack": false, "turnos_fijos": true, "actividades": [["Natación", "🏊"]],
      "planes": [{"tipo": "membresia", "nombre": "2 veces por semana", "duracion_meses": 1, "max_ingresos_semana": 2}, {"tipo": "membresia", "nombre": "3 veces por semana", "duracion_meses": 1, "max_ingresos_semana": 3}]},
    "personal": {"modo_clases": "reserva", "membresia": false, "pase": false, "pack": true, "turnos_fijos": false, "actividades": [["Entrenamiento personal", "🎯"]],
      "planes": [{"tipo": "pack", "nombre": "Pack 4 sesiones", "cantidad_clases": 4, "validez_dias": 30}, {"tipo": "pack", "nombre": "Pack 8 sesiones", "cantidad_clases": 8, "validez_dias": 45}]},
    "24h": {"modo_clases": "ninguno", "membresia": true, "pase": false, "pack": false, "turnos_fijos": false, "actividades": [],
      "planes": [{"tipo": "membresia", "nombre": "Mensual 24 h", "duracion_meses": 1}]}
  }'::jsonb
$$;
revoke all on function privado.plantillas_gimnasio() from public;

create or replace function public.admin_aplicar_plantilla(p_gimnasio_id uuid, p_tipo text) returns void
language plpgsql security definer set search_path = '' as $$
declare t jsonb := privado.plantillas_gimnasio() -> p_tipo; pl jsonb; a jsonb; n int; i int := 0;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if t is null then raise exception 'Tipo de gimnasio desconocido: %', p_tipo using errcode = '22023'; end if;
  if not exists (select 1 from public.gimnasios where id = p_gimnasio_id) then raise exception 'Gimnasio inexistente' using errcode = 'P0002'; end if;
  if exists (select 1 from public.planes where gimnasio_id = p_gimnasio_id) then
    raise exception 'Este gimnasio ya tiene planes: la plantilla es solo para uno recién creado' using errcode = '22023';
  end if;
  update public.configuracion_gimnasio set modo_clases = t ->> 'modo_clases', cobra_membresia = (t ->> 'membresia')::boolean,
    cobra_pase = (t ->> 'pase')::boolean, cobra_pack = (t ->> 'pack')::boolean, turnos_fijos = (t ->> 'turnos_fijos')::boolean
   where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo aplicar la plantilla'; end if;
  for a in select x from jsonb_array_elements(t -> 'actividades') x loop
    insert into public.actividades (gimnasio_id, nombre, emoji) values (p_gimnasio_id, a ->> 0, a ->> 1);
  end loop;
  for pl in select x from jsonb_array_elements(t -> 'planes') x loop
    i := i + 1;
    insert into public.planes (gimnasio_id, tipo, nombre, orden, duracion_meses, renovacion, max_ingresos_semana, cantidad_clases, validez_dias, consume_en)
    values (p_gimnasio_id, pl ->> 'tipo', pl ->> 'nombre', i, (pl ->> 'duracion_meses')::int,
            case when pl ->> 'tipo' = 'membresia' then 'continua' end, (pl ->> 'max_ingresos_semana')::int,
            (pl ->> 'cantidad_clases')::int, (pl ->> 'validez_dias')::int,
            case when pl ->> 'tipo' = 'pack' then case when t ->> 'modo_clases' = 'ninguno' then 'ingreso' else 'asistencia' end end);
  end loop;
end $$;

revoke all on function public.admin_aplicar_plantilla(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_aplicar_plantilla(uuid, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare k text;
begin
  for k in select jsonb_object_keys(privado.plantillas_gimnasio()) loop
    if (privado.plantillas_gimnasio() -> k ->> 'modo_clases') not in ('ninguno', 'sin_reserva', 'reserva') then raise exception 'Verificación: plantilla % con modo de clases inválido', k; end if;
  end loop;
  if not exists (select 1 from pg_proc where oid = 'public.admin_aplicar_plantilla(uuid, text)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: admin_aplicar_plantilla sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.admin_aplicar_plantilla(uuid, text)', 'execute') then raise exception 'Verificación: anon puede aplicar plantillas'; end if;
end $$;
