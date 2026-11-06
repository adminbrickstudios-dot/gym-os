-- VD-46W · Al dar de baja, rechazar también los pedidos de pausa pendientes; y un aviso tardío de MercadoPago no aprueba un pago ya rechazado.
--   * privado.cerrar_pendientes_baja (copia de 7202) rechaza los pedidos de pausa que nadie resolvió.
--   * public.acreditar_pago_mp (copia de 6800): un "approved" que llega sobre un pago rechazado (por la baja o por el equipo) o sobre
--     una venta anulada NO acredita ni habilita nada. Antes devolvía "ya_rechazado" sin dejar rastro aunque MercadoPago hubiera
--     cobrado de verdad. Ahora queda el hecho (pagos.cobro_tarde_en / cobro_tarde_mp_id) y avisos_pagos_mp (copia de 6800)
--     avisa al dueño: hay plata cobrada sin nada que la respalde, hay que devolverla o cobrarla a mano. Nunca se arregla solo (plata).

-- ── Guarda de entrada ──────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.cerrar_pendientes_baja(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta privado.cerrar_pendientes_baja (7202)'; end if;
  if to_regprocedure('public.acreditar_pago_mp(uuid, text, numeric, text, timestamptz, numeric)') is null then raise exception 'Guarda: falta acreditar_pago_mp (6800)'; end if;
  if to_regprocedure('public.avisos_pagos_mp(uuid)') is null then raise exception 'Guarda: falta avisos_pagos_mp (6800)'; end if;
  if to_regclass('public.pedidos_pausa') is null then raise exception 'Guarda: falta pedidos_pausa'; end if;
end $$;

alter table public.pagos add column if not exists cobro_tarde_en timestamptz;
alter table public.pagos add column if not exists cobro_tarde_mp_id text;

-- ── Cerrar lo pendiente de un socio que se va ───────────────────────
-- Pagos pendientes (y las ventas que dependían de ellos), turnos fijos y reservas futuras. Devuelve cuánto se cerró.
create or replace function privado.cerrar_pendientes_baja(p_socio_id uuid, p_momento timestamptz, p_actor uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare g uuid; v record; r record; t record; pagos int := 0; ventas int := 0; turnos int := 0; reservas int := 0; pausas int := 0; n int;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  -- Pagos que esperan aprobación: no se cobraron, no se cobran.
  for v in select ve.id from public.ventas ve where ve.socio_id = p_socio_id and ve.estado = 'pendiente' for update loop
    update public.pagos set estado = 'rechazado', rechazado_en = p_momento, rechazado_por = p_actor, rechazado_motivo = 'Baja del socio'
     where venta_id = v.id and estado = 'pendiente';
    get diagnostics n = row_count; pagos := pagos + n;
    if p_actor is not null and not exists (select 1 from public.pagos x where x.venta_id = v.id and x.estado in ('pendiente', 'aprobado')) then
      update public.ventas set estado = 'anulada', anulada_en = p_momento, anulada_por = p_actor, anulada_motivo = 'Baja del socio'
       where id = v.id and estado = 'pendiente';
      get diagnostics n = row_count; ventas := ventas + n;
    end if;
  end loop;
  -- VD-46W: los pedidos de pausa que nadie resolvió se rechazan: quien se va no se congela.
  update public.pedidos_pausa set estado = 'rechazado', resuelto_en = p_momento, resuelto_por = auth.uid()
   where socio_id = p_socio_id and estado = 'pendiente';
  get diagnostics pausas = row_count;
  -- Turnos fijos: se sacan, y con ellos las reservas que dejaron hechas.
  for t in select tf.id from public.turnos_fijos tf where tf.socio_id = p_socio_id and tf.hasta is null for update loop
    update public.turnos_fijos set hasta = greatest(p_momento, desde), quitado_por = p_actor where id = t.id and hasta is null;
    turnos := turnos + 1;
  end loop;
  -- Reservas futuras (confirmadas o en espera).
  for r in select x.id from public.reservas x join public.clases c on c.id = x.clase_id
            where x.socio_id = p_socio_id and x.estado <> 'cancelada' and c.inicio > p_momento order by c.inicio loop
    perform privado.cancelar_reserva(r.id, 'equipo', true, p_momento);
    reservas := reservas + 1;
  end loop;
  return jsonb_build_object('pagos_anulados', pagos, 'ventas_anuladas', ventas, 'turnos_quitados', turnos, 'reservas_canceladas', reservas, 'pausas_rechazadas', pausas);
end $$;
revoke all on function privado.cerrar_pendientes_baja(uuid, timestamptz, uuid) from public, anon, authenticated;

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

  -- VD-46W: un aviso "approved" tardío NUNCA aprueba un pago que ya se rechazó (la baja del socio, el equipo) ni uno cuya venta se anuló:
  -- no se acredita ni se habilita nada. Pero MercadoPago SÍ cobró: queda escrito (cobro_tarde_en) y se avisa al dueño para que lo devuelva o lo cobre a mano.
  -- (Si el rechazo lo informó la propia MercadoPago, el "approved" es un aviso viejo repetido: sigue siendo "ya_rechazado", sin alarma falsa.)
  if p_estado = 'approved' and ((p.estado = 'rechazado' and coalesce(p.rechazado_motivo, '') not like 'MercadoPago:%') or (p.estado = 'pendiente' and v.estado = 'anulada')) then
    if p.estado = 'pendiente' then
      update public.pagos set estado = 'rechazado', rechazado_en = now(), rechazado_motivo = 'La venta se anuló antes de que llegara el pago'
       where id = p.id and estado = 'pendiente';
      get diagnostics n = row_count;
      if n <> 1 then raise exception 'No se pudo cerrar el pago'; end if;
    end if;
    update public.pagos set cobro_tarde_en = coalesce(cobro_tarde_en, now()), cobro_tarde_mp_id = coalesce(cobro_tarde_mp_id, p_mp_pago_id),
           mp_evento_en = coalesce(p_fecha, mp_evento_en)
     where id = p.id;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo anotar el cobro tardío'; end if;
    return 'cobro_tarde';
  end if;

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
    union all
    -- VD-46W: MercadoPago cobró un pago que ya estaba rechazado o cuya venta se anuló: no se habilitó nada, hay que devolver o cobrar a mano.
    select jsonb_build_object(
             'clave', 'pago_mp:' || p.id || ':cobro_tarde', 'emoji', '⚠️',
             'titulo', 'MercadoPago cobró un pago que ya estaba cerrado: ' || trim(s.nombre || ' ' || s.apellido),
             'detalle', privado.formato_pesos(p.monto) || ' · no se habilitó nada (' || coalesce(p.rechazado_motivo, 'pago cerrado') || '): devolvelo desde MercadoPago o cobralo a mano',
             'href', '/socios/' || s.id || '?pestana=pagos', 'en', p.cobro_tarde_en) as x
      from public.pagos p join public.ventas v on v.id = p.venta_id join public.socios s on s.id = v.socio_id
     where p.gimnasio_id = p_gimnasio_id and p.medio = 'mercadopago' and p.cobro_tarde_en is not null and p.cobro_tarde_en >= now() - interval '30 days'
  ) y;
  return privado.con_leidos(p_gimnasio_id, items);
end $$;

revoke all on function public.acreditar_pago_mp(uuid, text, numeric, text, timestamptz, numeric), public.avisos_pagos_mp(uuid) from public, anon, authenticated;
grant execute on function public.acreditar_pago_mp(uuid, text, numeric, text, timestamptz, numeric) to service_role;
grant execute on function public.avisos_pagos_mp(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['privado.cerrar_pendientes_baja(uuid, timestamptz, uuid)', 'public.acreditar_pago_mp(uuid, text, numeric, text, timestamptz, numeric)', 'public.avisos_pagos_mp(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if has_function_privilege('authenticated', 'public.acreditar_pago_mp(uuid, text, numeric, text, timestamptz, numeric)', 'execute') then
    raise exception 'Verificación: acreditar_pago_mp quedó para authenticated (solo clave de servicio)';
  end if;
  if position('pedidos_pausa' in pg_get_functiondef('privado.cerrar_pendientes_baja(uuid, timestamptz, uuid)'::regprocedure)) = 0 then raise exception 'Verificación: la baja no rechaza pausas'; end if;
  if position('cobro_tarde_en' in pg_get_functiondef('public.acreditar_pago_mp(uuid, text, numeric, text, timestamptz, numeric)'::regprocedure)) = 0 then raise exception 'Verificación: acreditar_pago_mp sin cobro tardío'; end if;
end $$;
