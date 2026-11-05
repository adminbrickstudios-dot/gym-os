-- ═══════════════════════════════════════════════════════════════════
-- 0028 · Historial de cambios de configuración (CFG-8).
--
-- "¿Quién subió el descuento máximo de recepción?" Cada cambio de un dato
-- de configuración deja una fila: qué campo, de qué valor a qué valor,
-- quién (del equipo, o soporte, o el sistema) y cuándo.
--
-- Lo escriben triggers de la base, nunca el navegador: así ningún camino
-- (pantalla, función, soporte) cambia algo sin dejar rastro, y se guarda
-- una fila por campo que CAMBIÓ (no por campo enviado). Tablas cubiertas:
-- configuracion_gimnasio, gimnasios (nombre), landing_gimnasio (contacto
-- y publicada), sedes (datos) y plantillas_mensaje (textos).
--
--   historial_configuracion(gimnasio, limite)   dueño, encargado y
--                                               administradores de BRIK
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.plantillas_mensaje') is null then raise exception 'Guarda: falta la migración 0010'; end if;
  if to_regprocedure('privado.mi_equipo_id(uuid)') is null then raise exception 'Guarda: falta privado.mi_equipo_id'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio'
                  and column_name = 'banco_transferencia') then raise exception 'Guarda: falta la migración 0023'; end if;
end $$;

-- ── Tabla ───────────────────────────────────────────────────────────
create table if not exists public.historial_configuracion (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  campo         text not null check (length(campo) between 1 and 120),
  antes         jsonb,
  despues       jsonb,
  equipo_id     uuid,
  usuario_id    uuid,
  cambiado_en   timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, equipo_id) references public.equipo (gimnasio_id, id)
);
create index if not exists historial_configuracion_reciente on public.historial_configuracion (gimnasio_id, cambiado_en desc);
-- Leen dueño y encargado; nadie escribe desde el cliente (solo los triggers).
select privado.politicas_estandar('public.historial_configuracion', array['dueno', 'encargado'], null);

-- ── Registro ────────────────────────────────────────────────────────
-- Una fila por cada clave cuyo valor cambió entre old y new (como jsonb).
create or replace function privado.registrar_cambios(p_gimnasio_id uuid, p_prefijo text, p_antes jsonb, p_despues jsonb, p_ignorar text[])
returns void language plpgsql security definer set search_path = '' as $$
declare k text; eid uuid;
begin
  eid := privado.mi_equipo_id(p_gimnasio_id);
  for k in select x from jsonb_object_keys(coalesce(p_despues, p_antes)) x where x <> all (p_ignorar) order by 1 loop
    if (p_antes -> k) is distinct from (p_despues -> k) then
      insert into public.historial_configuracion (gimnasio_id, campo, antes, despues, equipo_id, usuario_id)
      values (p_gimnasio_id, p_prefijo || k, p_antes -> k, p_despues -> k, eid, auth.uid());
    end if;
  end loop;
end $$;

create or replace function privado.historial_tg() returns trigger
language plpgsql security definer set search_path = '' as $$
declare comunes text[] := array['gimnasio_id', 'id', 'actualizado_en', 'creado_en', 'creado_por'];
begin
  if tg_table_name = 'configuracion_gimnasio' then
    perform privado.registrar_cambios(new.gimnasio_id, '', to_jsonb(old), to_jsonb(new),
      comunes || array['ultimo_numero_socio', 'onboarding_salteado_en', 'avisar_sin_bloquear_hasta']);
  elsif tg_table_name = 'gimnasios' then
    perform privado.registrar_cambios(new.id, '', jsonb_build_object('nombre', old.nombre), jsonb_build_object('nombre', new.nombre), comunes);
  elsif tg_table_name = 'landing_gimnasio' then
    perform privado.registrar_cambios(new.gimnasio_id, 'pagina.',
      jsonb_build_object('publicada', old.publicada, 'whatsapp', old.whatsapp, 'instagram', old.instagram, 'email_contacto', old.email_contacto),
      jsonb_build_object('publicada', new.publicada, 'whatsapp', new.whatsapp, 'instagram', new.instagram, 'email_contacto', new.email_contacto), comunes);
  elsif tg_table_name = 'sedes' then
    perform privado.registrar_cambios(new.gimnasio_id, 'sede.' || old.nombre || '.',
      jsonb_build_object('nombre', old.nombre, 'direccion', old.direccion, 'telefono', old.telefono, 'mapa_url', old.mapa_url),
      jsonb_build_object('nombre', new.nombre, 'direccion', new.direccion, 'telefono', new.telefono, 'mapa_url', new.mapa_url), comunes);
  elsif tg_table_name = 'plantillas_mensaje' then
    perform privado.registrar_cambios(new.gimnasio_id, 'mensaje.', jsonb_build_object(new.clave, old.texto),
      jsonb_build_object(new.clave, new.texto), comunes);
  end if;
  return null;
end $$;

drop trigger if exists historial on public.configuracion_gimnasio;
create trigger historial after update on public.configuracion_gimnasio for each row execute function privado.historial_tg();
drop trigger if exists historial on public.gimnasios;
create trigger historial after update of nombre on public.gimnasios for each row execute function privado.historial_tg();
drop trigger if exists historial on public.landing_gimnasio;
create trigger historial after update on public.landing_gimnasio for each row execute function privado.historial_tg();
drop trigger if exists historial on public.sedes;
create trigger historial after update on public.sedes for each row execute function privado.historial_tg();
drop trigger if exists historial on public.plantillas_mensaje;
create trigger historial after update of texto on public.plantillas_mensaje for each row execute function privado.historial_tg();

-- ── En palabras ─────────────────────────────────────────────────────
create or replace function privado.etiqueta_campo(p_campo text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_campo like 'mensaje.%' then 'Mensaje “' || coalesce((select x ->> 'titulo' from jsonb_array_elements(privado.mensajes_catalogo()) x
                                                              where x ->> 'clave' = substr(p_campo, 9)), substr(p_campo, 9)) || '”'
    -- "Sede principal: dirección" (no "Sede Sede principal"); "Sede Centro: dirección".
    when p_campo like 'sede.%' then case when split_part(p_campo, '.', 2) ilike 'sede%' then '' else 'Sede ' end
      || split_part(p_campo, '.', 2) || ': ' || case split_part(p_campo, '.', 3)
      when 'nombre' then 'nombre' when 'direccion' then 'dirección' when 'telefono' then 'teléfono' when 'mapa_url' then 'link del mapa'
      else split_part(p_campo, '.', 3) end
    else coalesce(jsonb_build_object(
      'nombre', 'Nombre del gimnasio', 'color_acento', 'Color principal', 'color_fondo', 'Color de fondo', 'logo_path', 'Logo',
      'favicon_path', 'Ícono de la pestaña', 'cobra_membresia', 'Cobra membresía', 'cobra_pase', 'Cobra pase diario',
      'cobra_pack', 'Cobra packs de clases', 'modo_clases', 'Clases', 'accesos_activos', 'Formas de entrada',
      'tolerancia_dias', 'Días de gracia al vencer', 'dias_aviso', 'Avisar que vence (días antes)',
      'reingreso_mismo_dia_consume', 'Volver a entrar el mismo día gasta otra entrada', 'secciones_apagadas', 'Secciones apagadas',
      'alias_transferencia', 'Alias', 'cbu', 'CBU / CVU', 'titular_cuenta', 'Titular de la cuenta', 'banco_transferencia', 'Banco o billetera',
      'medios_aceptados', 'Medios de pago', 'descuento_max_recepcion', 'Descuento máximo de la recepción (%)',
      'retencion_dias_ausencia', '“No viene” después de (días)', 'retencion_dias_nuevo', 'Socio nuevo durante (días)',
      'retencion_dias_vencido', 'Vencido pasa a “se fue” después de (días)', 'retencion_dias_se_fue', 'Los que se fueron se muestran durante (días)',
      'reserva_dias_anticipacion', 'Se reserva con hasta (días)', 'cancelacion_horas_limite', 'Cancelar hasta (horas antes)',
      'pagina.publicada', 'Página publicada', 'pagina.whatsapp', 'WhatsApp', 'pagina.instagram', 'Instagram',
      'pagina.email_contacto', 'Mail de contacto') ->> p_campo, p_campo)
  end
$$;

create or replace function privado.valor_legible(p_campo text, p_valor jsonb) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_valor is null or p_valor = 'null'::jsonb then '(vacío)'
    when p_campo in ('logo_path', 'favicon_path') then 'una imagen'
    when jsonb_typeof(p_valor) = 'number' then regexp_replace(p_valor::text, '\.0+$', '')
    when jsonb_typeof(p_valor) = 'boolean' then case when p_valor::text = 'true' then 'Sí' else 'No' end
    -- Listas (formas de entrada, secciones apagadas, medios de pago): cada código en palabras.
    when jsonb_typeof(p_valor) = 'array' then coalesce(nullif((select string_agg(coalesce(jsonb_build_object(
        'recepcion', 'Recepción', 'qr_socio', 'QR del socio', 'qr_pared', 'QR en la pared', 'kiosco', 'Kiosco', 'nfc', 'Tarjeta',
        'molinete', 'Molinete', 'entrada', 'Entrada', 'vencen_hoy', 'Vencen hoy', 'socios', 'Socios', 'retencion', 'Retención',
        'vender', 'Vender', 'caja', 'Caja', 'transferencias', 'Transferencias', 'clases', 'Clases', 'efectivo', 'Efectivo',
        'transferencia', 'Transferencia', 'debito', 'Débito', 'credito', 'Crédito') ->> x, x), ', ' order by o)
        from jsonb_array_elements_text(p_valor) with ordinality as t(x, o)), ''), '(ninguna)')
    when p_campo = 'modo_clases' then case p_valor #>> '{}' when 'reserva' then 'Con reserva y cupo' when 'sin_reserva' then 'Sin reserva'
                                                           else 'No damos clases' end
    when p_campo like 'mensaje.%' and length(p_valor #>> '{}') > 80 then left(p_valor #>> '{}', 77) || '…'
    else p_valor #>> '{}'
  end
$$;

-- ── Lectura ─────────────────────────────────────────────────────────
create or replace function public.historial_configuracion(p_gimnasio_id uuid, p_limite int default 100) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.soy_admin_plataforma() then
    perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'campo', h.campo, 'etiqueta', privado.etiqueta_campo(h.campo),
            'antes', privado.valor_legible(h.campo, h.antes), 'despues', privado.valor_legible(h.campo, h.despues),
            'quien', case when e.es_soporte then 'Soporte BRIK' when e.id is not null then e.nombre
                          when h.usuario_id is null then 'El sistema' else 'Alguien que ya no está en el equipo' end,
            'cuando', h.cambiado_en,
            -- La hora en la zona del gimnasio, para que ninguna pantalla la tenga que adivinar.
            'cuando_texto', to_char(h.cambiado_en at time zone g.zona_horaria, 'DD/MM/YYYY HH24:MI'))
            order by h.cambiado_en desc, h.campo), '[]')
            from (select * from public.historial_configuracion x where x.gimnasio_id = p_gimnasio_id
                   order by x.cambiado_en desc limit least(greatest(coalesce(p_limite, 100), 1), 500)) h
            join public.gimnasios g on g.id = h.gimnasio_id
            left join public.equipo e on e.id = h.equipo_id);
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function privado.registrar_cambios(uuid, text, jsonb, jsonb, text[]), privado.historial_tg(),
  privado.etiqueta_campo(text), privado.valor_legible(text, jsonb) from public, anon, authenticated;
revoke all on function public.historial_configuracion(uuid, int) from public, anon, authenticated;
grant execute on function public.historial_configuracion(uuid, int) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relname = 'historial_configuracion' and c.relrowsecurity) then
    raise exception 'Verificación: historial sin RLS';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'historial_configuracion' and cmd <> 'SELECT') then
    raise exception 'Verificación: el historial se puede escribir desde el cliente';
  end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'privado' and p.proname in ('registrar_cambios', 'historial_tg', 'etiqueta_campo', 'valor_legible'))
               or (s.nspname = 'public' and p.proname = 'historial_configuracion') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
  if (select count(*) from pg_trigger where tgname = 'historial' and not tgisinternal) <> 5 then
    raise exception 'Verificación: faltan triggers del historial';
  end if;
end $$;
