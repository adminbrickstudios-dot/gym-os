-- 0068 · MercadoPago: reembolso, contracargo y conciliación (VD-46A, caso 17 de 14-SITUACIONES).
-- Hasta acá un pago ya aprobado que MercadoPago devolvía o le sacaban por contracargo seguía contando:
-- la cobertura seguía y el socio entraba gratis. Ahora:
--
--   * Un pago aprobado + "refunded" o "charged_back" pasa a 'devuelto'. Se anula la venta con el motivo
--     (privado.anular_venta, la misma de siempre: retira coberturas, pases y packs) y queda marcada
--     como anulada por MercadoPago, sin persona. NADA se borra: el pago conserva su ID de MercadoPago y
--     la fecha en que se aprobó; lo nuevo (devuelto_en, devuelto_motivo) se suma al hecho original.
--   * Si la venta tenía otro pago aprobado (efectivo, transferencia) no se anula sola: el pago de
--     MercadoPago queda 'devuelto', la venta sigue y el aviso al dueño dice que la revise a mano.
--   * Un reembolso PARCIAL no toca la cobertura: queda anotado y avisa al dueño, que decide.
--   * Guarda de orden: cada aviso trae la fecha en que MercadoPago actualizó el pago; uno más viejo que
--     lo ya aplicado se ignora. Un 'approved' que llega después de un 'refunded' no revive nada.
--   * Conciliación SIN cron: revisar_pagos_mp lista (y sella) lo que hay que reconsultar a MercadoPago:
--     pagos pendientes de más de 15 minutos y aprobados de los últimos 30 días. Lo consulta el servidor
--     al abrir /app/pago y con el botón "Revisar con MercadoPago" del dueño. Revierte SOLO el webhook
--     firmado o esa reconsulta del servidor (clave de servicio): nunca el navegador.
--   * Las alertas al dueño se calculan de los hechos (avisos_pagos_mp), no se guardan.
--
--   acreditar_pago_mp(pago, id_mp, monto, estado, fecha, reembolsado)   SOLO clave de servicio
--   revertir_pago_mp(pago, id_mp, estado, fecha)                        SOLO clave de servicio
--   revisar_pagos_mp(gimnasio, pago)                                    SOLO clave de servicio
--   pago_online_revisable(pago)                                         el socio dueño del pago
--   avisos_pagos_mp(gimnasio)                                           dueño y encargado

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.acreditar_pago_mp(uuid, text, numeric, text)') is null
     and to_regprocedure('public.acreditar_pago_mp(uuid, text, numeric, text, timestamptz, numeric)') is null then
    raise exception 'Guarda: falta acreditar_pago_mp (0079)';
  end if;
  if to_regprocedure('privado.anular_venta(uuid, text, uuid, uuid, uuid)') is null then raise exception 'Guarda: falta privado.anular_venta'; end if;
  if to_regprocedure('privado.con_leidos(uuid, jsonb)') is null then raise exception 'Guarda: falta privado.con_leidos (0073)'; end if;
  if to_regprocedure('privado.confirmar_venta(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.confirmar_venta'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pagos' and column_name = 'rechazado_motivo') then
    raise exception 'Guarda: falta pagos.rechazado_motivo';
  end if;
end $$;

-- ── Pagos: el estado nuevo 'devuelto' y lo que se anota de MercadoPago ──
alter table public.pagos add column if not exists devuelto_en    timestamptz;
alter table public.pagos add column if not exists devuelto_motivo text;
alter table public.pagos add column if not exists mp_evento_en   timestamptz;   -- fecha del último estado de MercadoPago ya aplicado
alter table public.pagos add column if not exists mp_reembolsado numeric(12,2); -- lo devuelto parcialmente (el pago sigue aprobado)
alter table public.pagos add column if not exists mp_revisado_en timestamptz;   -- última vez que se reconsultó a MercadoPago

do $$
declare c record;
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.pagos'::regclass and conname = 'pagos_estado_valido') then
    for c in select conname from pg_constraint
              where conrelid = 'public.pagos'::regclass and contype = 'c'
                and pg_get_constraintdef(oid) like '%ARRAY%' and pg_get_constraintdef(oid) like '%pendiente%'
                and pg_get_constraintdef(oid) like '%anulado%' and pg_get_constraintdef(oid) like '%''aprobado''%'
                and pg_get_constraintdef(oid) not like '%mp_pago_id%' and pg_get_constraintdef(oid) not like '%devuelto%' loop
      execute format('alter table public.pagos drop constraint %I', c.conname);
    end loop;
    alter table public.pagos add constraint pagos_estado_valido
      check (estado in ('pendiente', 'aprobado', 'rechazado', 'anulado', 'devuelto'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.pagos'::regclass and conname = 'pagos_aprobado_con_fecha') then
    for c in select conname from pg_constraint
              where conrelid = 'public.pagos'::regclass and contype = 'c'
                and pg_get_constraintdef(oid) like '%aprobado_en IS NOT NULL%' and pg_get_constraintdef(oid) not like '%devuelto%' loop
      execute format('alter table public.pagos drop constraint %I', c.conname);
    end loop;
    -- Un pago devuelto sigue diciendo cuándo se aprobó: el hecho original no se pierde.
    alter table public.pagos add constraint pagos_aprobado_con_fecha
      check ((estado in ('aprobado', 'devuelto')) = (aprobado_en is not null) or estado = 'anulado');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.pagos'::regclass and conname = 'pagos_devuelto_completo') then
    alter table public.pagos add constraint pagos_devuelto_completo
      check ((estado = 'devuelto') = (devuelto_en is not null)
             and (devuelto_en is null or length(trim(coalesce(devuelto_motivo, ''))) > 0));
  end if;
end $$;

create index if not exists pagos_mp_a_revisar on public.pagos (gimnasio_id, creado_en)
  where medio = 'mercadopago' and estado in ('pendiente', 'aprobado');
create index if not exists pagos_devueltos on public.pagos (gimnasio_id, devuelto_en) where estado = 'devuelto';

-- ── Ventas: anulada por MercadoPago (sin una persona del equipo) ────
alter table public.ventas add column if not exists anulada_origen text;
do $$
declare c record;
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.ventas'::regclass and conname = 'ventas_anulada_con_quien') then
    for c in select conname from pg_constraint
              where conrelid = 'public.ventas'::regclass and contype = 'c'
                and pg_get_constraintdef(oid) like '%anulada_por IS NOT NULL%' and pg_get_constraintdef(oid) not like '%anulada_origen%' loop
      execute format('alter table public.ventas drop constraint %I', c.conname);
    end loop;
    alter table public.ventas add constraint ventas_anulada_con_quien
      check (anulada_en is null or (anulada_motivo is not null and (anulada_por is not null or anulada_origen is not null)));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.ventas'::regclass and conname = 'ventas_anulada_origen_valido') then
    alter table public.ventas add constraint ventas_anulada_origen_valido check (anulada_origen is null or anulada_origen in ('mercadopago'));
  end if;
end $$;

-- ── Revertir un pago aprobado que MercadoPago devolvió ──────────────
-- Una sola vez por pago: lo que ya está devuelto se reconoce y no hace nada.
create or replace function public.revertir_pago_mp(p_pago_id uuid, p_mp_pago_id text, p_estado text, p_fecha timestamptz default null) returns text
language plpgsql security definer set search_path = '' as $$
declare p public.pagos; v public.ventas; n int; motivo text; hay_otros boolean;
begin
  if p_estado is null or p_estado not in ('refunded', 'charged_back') then
    raise exception 'Estado de devolución inválido: %', p_estado using errcode = '22023';
  end if;
  select v2.* into v from public.ventas v2 join public.pagos p2 on p2.venta_id = v2.id where p2.id = p_pago_id for update of v2;
  if not found then raise exception 'Pago inexistente: %', p_pago_id using errcode = 'P0002'; end if;
  select * into p from public.pagos where id = p_pago_id for update;
  if p.medio <> 'mercadopago' then raise exception 'Ese pago no es de MercadoPago'; end if;
  if p.estado = 'devuelto' then return 'ya_devuelto'; end if;
  if p_fecha is not null and p.mp_evento_en is not null and p_fecha < p.mp_evento_en then return 'ignorado_viejo'; end if;
  if p.estado <> 'aprobado' then return 'ya_' || p.estado; end if;   -- nunca se acreditó: no hay nada que retirar
  if p.mp_pago_id is distinct from p_mp_pago_id then
    raise exception 'El pago % se aprobó con otro ID de MercadoPago (%)', p.id, p.mp_pago_id;
  end if;

  motivo := case p_estado when 'charged_back' then 'MercadoPago: contracargo, el pago fue desconocido por el titular de la tarjeta'
                          else 'MercadoPago: el pago se devolvió' end;
  select exists (select 1 from public.pagos o where o.venta_id = v.id and o.id <> p.id and o.estado = 'aprobado') into hay_otros;

  if not hay_otros and v.estado <> 'anulada' then
    -- Se marca el origen antes: el check de ventas pide "quién" o "origen" al anular.
    update public.ventas set anulada_origen = 'mercadopago' where id = v.id and estado <> 'anulada';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo marcar la venta'; end if;
    perform privado.anular_venta(v.id, motivo, null, null, null);   -- retira coberturas, pases y packs; los pagos quedan 'anulado'
  end if;

  update public.pagos set estado = 'devuelto', devuelto_en = now(), devuelto_motivo = motivo,
         mp_evento_en = coalesce(p_fecha, now())
   where id = p.id and estado in ('aprobado', 'anulado');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo marcar el pago como devuelto'; end if;
  return case when hay_otros then 'devuelto_revisar' else 'devuelto' end;
end $$;

-- ── Acreditar (y ahora también revertir) lo que dice MercadoPago ────
-- Firma nueva (fecha del estado y monto reembolsado): la vieja se borra, dos versiones con defaults
-- harían ambigua la llamada.
drop function if exists public.acreditar_pago_mp(uuid, text, numeric, text);
create or replace function public.acreditar_pago_mp(p_pago_id uuid, p_mp_pago_id text, p_monto numeric, p_estado text,
                                                    p_fecha timestamptz default null, p_reembolsado numeric default null) returns text
language plpgsql security definer set search_path = '' as $$
declare p public.pagos; v public.ventas; n int;
begin
  select v2.* into v from public.ventas v2 join public.pagos p2 on p2.venta_id = v2.id where p2.id = p_pago_id for update of v2;
  if not found then raise exception 'Pago inexistente: %', p_pago_id using errcode = 'P0002'; end if;
  select * into p from public.pagos where id = p_pago_id for update;
  if p.medio <> 'mercadopago' then raise exception 'Ese pago no es de MercadoPago'; end if;

  -- Un aviso más viejo que lo ya aplicado no pisa nada (un approved tardío después de un refunded).
  if p_fecha is not null and p.mp_evento_en is not null and p_fecha < p.mp_evento_en then return 'ignorado_viejo'; end if;
  if p.estado = 'devuelto' then return 'ya_devuelto'; end if;

  if p.estado = 'aprobado' then
    if p.mp_pago_id <> p_mp_pago_id then
      raise exception 'El pago % ya estaba aprobado con otro ID de MercadoPago (%)', p.id, p.mp_pago_id;
    end if;
    if p_estado in ('refunded', 'charged_back') then
      return public.revertir_pago_mp(p.id, p_mp_pago_id, p_estado, p_fecha);
    end if;
    if p_estado = 'approved' and coalesce(p_reembolsado, 0) > 0 then
      if p_reembolsado >= p.monto then
        return public.revertir_pago_mp(p.id, p_mp_pago_id, 'refunded', p_fecha);
      end if;
      if p.mp_reembolsado is distinct from p_reembolsado then
        update public.pagos set mp_reembolsado = p_reembolsado, mp_evento_en = coalesce(p_fecha, p.mp_evento_en)
         where id = p.id and estado = 'aprobado';
        get diagnostics n = row_count;
        if n <> 1 then raise exception 'No se pudo anotar el reembolso'; end if;
        return 'reembolso_parcial';
      end if;
    end if;
    return 'ya_acreditado';
  end if;
  if p.estado <> 'pendiente' then return 'ya_' || p.estado; end if;

  if p_estado = 'approved' then
    if abs(coalesce(p_monto, 0) - p.monto) >= 0.01 then
      raise exception 'MercadoPago cobró % y el pago era de %: no se acredita', p_monto, p.monto;
    end if;
    update public.pagos set estado = 'aprobado', aprobado_en = now(), mp_pago_id = p_mp_pago_id,
           mp_evento_en = coalesce(p_fecha, now())
     where id = p.id and estado = 'pendiente';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo acreditar el pago'; end if;
    perform privado.confirmar_venta(v.id, now());
    -- Aprobó y ya tenía una devolución parcial (aviso que llegó junto): se anota.
    if coalesce(p_reembolsado, 0) > 0 and p_reembolsado < p.monto then
      update public.pagos set mp_reembolsado = p_reembolsado where id = p.id;
    end if;
    return 'acreditado';
  elsif p_estado in ('rejected', 'cancelled', 'refunded', 'charged_back') then
    update public.pagos set estado = 'rechazado', rechazado_en = now(), mp_pago_id = p_mp_pago_id, mp_evento_en = coalesce(p_fecha, now()),
           rechazado_motivo = 'MercadoPago: ' || case p_estado when 'rejected' then 'el pago fue rechazado' when 'cancelled' then 'el pago se canceló' else 'se devolvió' end
     where id = p.id and estado = 'pendiente';
    return 'rechazado';
  end if;
  return 'sin_cambios';   -- pending / in_process / in_mediation: se espera el próximo aviso
end $$;

-- ── Qué hay que reconsultar a MercadoPago (sin cron) ────────────────
-- Lo llama el servidor (después de comprobar quién pide): al abrir /app/pago con un pago colgado, o con el
-- botón del dueño. Devuelve los candidatos y los sella (no se reconsulta lo mismo dos veces en un minuto).
create or replace function public.revisar_pagos_mp(p_gimnasio_id uuid, p_pago_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  with c as (
    select p.id from public.pagos p
     where p.gimnasio_id = p_gimnasio_id and p.medio = 'mercadopago'
       and (p_pago_id is null or p.id = p_pago_id)
       and (   (p.estado = 'pendiente' and p.creado_en < now() - interval '15 minutes' and p.creado_en > now() - interval '7 days')
            or (p.estado = 'aprobado' and p_pago_id is null and p.aprobado_en > now() - interval '30 days'))
       and (p.mp_revisado_en is null or p.mp_revisado_en < now() - interval '1 minute')
     order by p.mp_revisado_en nulls first, p.creado_en
     limit 40
       for update of p skip locked),
  s as (
    update public.pagos p set mp_revisado_en = now() from c where p.id = c.id
    returning p.id, p.mp_pago_id, p.estado)
  select coalesce(jsonb_agg(jsonb_build_object('pago_id', s.id, 'mp_pago_id', s.mp_pago_id, 'estado', s.estado)), '[]'::jsonb) into r from s;
  return r;
end $$;

-- El socio: ¿mi pago lleva más de 15 minutos colgado? (para que el servidor lo reconsulte al abrir la pantalla)
create or replace function public.pago_online_revisable(p_pago_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  select jsonb_build_object('revisable', p.estado = 'pendiente' and p.creado_en < now() - interval '15 minutes', 'gimnasio_id', p.gimnasio_id)
    into r from public.pagos p join public.ventas v on v.id = p.venta_id
   where p.id = p_pago_id and p.medio = 'mercadopago' and v.socio_id in (select privado.mis_socios());
  if r is null then raise exception 'Sin permiso o pago inexistente' using errcode = '42501'; end if;
  return r;
end $$;

-- ── Avisos al dueño (se calculan de los hechos; la campana los suma) ─
create or replace function public.avisos_pagos_mp(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare items jsonb;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select coalesce(jsonb_agg(x order by (x ->> 'en')::timestamptz desc), '[]'::jsonb) into items from (
    select jsonb_build_object(
             'clave', 'pago_mp:' || p.id || ':devuelto', 'emoji', '↩️',
             'titulo', case when p.devuelto_motivo like '%contracargo%' then 'Contracargo de MercadoPago' else 'MercadoPago devolvió un pago' end
                       || ': ' || trim(s.nombre || ' ' || s.apellido),
             'detalle', privado.formato_pesos(p.monto) || ' · ' ||
                        case when v.estado = 'anulada' then 'la venta se anuló y se retiró lo que habilitó'
                             else 'la venta tenía otro pago: revisala a mano, la cobertura sigue' end,
             'href', '/socios/' || s.id || '?pestana=pagos', 'en', p.devuelto_en) as x
      from public.pagos p join public.ventas v on v.id = p.venta_id join public.socios s on s.id = v.socio_id
     where p.gimnasio_id = p_gimnasio_id and p.medio = 'mercadopago' and p.estado = 'devuelto' and p.devuelto_en >= now() - interval '30 days'
    union all
    select jsonb_build_object(
             'clave', 'pago_mp:' || p.id || ':parcial:' || p.mp_reembolsado, 'emoji', '↩️',
             'titulo', 'MercadoPago devolvió una parte: ' || trim(s.nombre || ' ' || s.apellido),
             'detalle', privado.formato_pesos(p.mp_reembolsado) || ' de ' || privado.formato_pesos(p.monto) || ' · la cobertura sigue: decidí vos',
             'href', '/socios/' || s.id || '?pestana=pagos', 'en', coalesce(p.mp_evento_en, p.aprobado_en)) as x
      from public.pagos p join public.ventas v on v.id = p.venta_id join public.socios s on s.id = v.socio_id
     where p.gimnasio_id = p_gimnasio_id and p.medio = 'mercadopago' and p.estado = 'aprobado'
       and coalesce(p.mp_reembolsado, 0) > 0 and coalesce(p.mp_evento_en, p.aprobado_en) >= now() - interval '30 days'
  ) y;
  return privado.con_leidos(p_gimnasio_id, items);
end $$;

revoke all on function public.acreditar_pago_mp(uuid, text, numeric, text, timestamptz, numeric), public.revertir_pago_mp(uuid, text, text, timestamptz),
  public.revisar_pagos_mp(uuid, uuid), public.pago_online_revisable(uuid), public.avisos_pagos_mp(uuid) from public, anon, authenticated;
grant execute on function public.acreditar_pago_mp(uuid, text, numeric, text, timestamptz, numeric), public.revertir_pago_mp(uuid, text, text, timestamptz),
  public.revisar_pagos_mp(uuid, uuid) to service_role;
grant execute on function public.pago_online_revisable(uuid), public.avisos_pagos_mp(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.acreditar_pago_mp(uuid, text, numeric, text, timestamptz, numeric)', 'public.revertir_pago_mp(uuid, text, text, timestamptz)',
      'public.revisar_pagos_mp(uuid, uuid)', 'public.pago_online_revisable(uuid)', 'public.avisos_pagos_mp(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  foreach f in array array['public.acreditar_pago_mp(uuid, text, numeric, text, timestamptz, numeric)', 'public.revertir_pago_mp(uuid, text, text, timestamptz)',
      'public.revisar_pagos_mp(uuid, uuid)'] loop
    if has_function_privilege('authenticated', f, 'execute') then raise exception 'Verificación: % es solo para la clave de servicio', f; end if;
  end loop;
  if to_regprocedure('public.acreditar_pago_mp(uuid, text, numeric, text)') is not null then
    raise exception 'Verificación: quedó la versión vieja de acreditar_pago_mp';
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.pagos'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%ARRAY%' and pg_get_constraintdef(oid) like '%anulado%' and pg_get_constraintdef(oid) like '%''aprobado''%'
              and pg_get_constraintdef(oid) not like '%mp_pago_id%' and pg_get_constraintdef(oid) not like '%devuelto%') then
    raise exception 'Verificación: pagos todavía no acepta el estado devuelto';
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.ventas'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%anulada_por IS NOT NULL%' and pg_get_constraintdef(oid) not like '%anulada_origen%') then
    raise exception 'Verificación: ventas todavía exige una persona para anular';
  end if;
end $$;
