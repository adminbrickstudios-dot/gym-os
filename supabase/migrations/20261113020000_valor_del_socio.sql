-- N10 (`NOCHE-1211.md` N-D) · Cuánto deja un socio y cuánto dura, en Resultado. Función nueva APAGADA por defecto (clave `valor_del_socio`).
-- Todo sale de lo ya guardado (pagos, ventas y coberturas): no se guarda ningún número nuevo ni se toca ningún veredicto de la puerta.
--
--   · deja_por_mes: lo que pagó cada socio que pagó algo en la ventana, por mes. Ventana = los últimos 90 días, o menos si el gimnasio
--     cobra hace menos (nunca menos de 30). Cuenta los pagos aprobados de ventas con socio, sin las anuladas y sin la cuenta corriente
--     (la misma plata que "Cobrado" de Resultado, pero solo la de socios: el mostrador sin nombre no suma). Es plata cobrada, no precio de lista.
--       deja_por_mes = round(cobrado / socios que pagaron × 30 / días de la ventana)
--   · dura_meses: de los socios que YA SE FUERON (su cobertura terminó, o se los dio de baja), cuánto pasó entre el principio de su
--     primera cobertura y el fin de la última (o la baja, si fue antes), en meses de 30 días, un decimal. Solo cuentan las coberturas de
--     pago e importación (no cortesías ni ajustes). Sin socios que se hayan ido, es null: la pantalla lo dice, no inventa un número.
--   Los dos números son del momento que se pide (p_momento, por defecto ahora): las pruebas de base usan un momento fijo.
-- Solo dueño y encargado con acceso al Resultado (privado.exigir_resultado); apagada, error con texto claro (nunca una lista vacía).
-- Aditiva e idempotente. Sin aplicar en producción hasta que Mateo lo pida.

do $guarda$
begin
  if to_regprocedure('privado.exigir_resultado(uuid)') is null then raise exception 'Guarda: falta privado.exigir_resultado'; end if;
  if to_regprocedure('privado.exigir_funcion(uuid, text)') is null then raise exception 'Guarda: falta privado.exigir_funcion'; end if;
  if to_regprocedure('privado.funciones_nuevas_catalogo()') is null then raise exception 'Guarda: falta privado.funciones_nuevas_catalogo'; end if;
  if (select jsonb_array_length(privado.funciones_nuevas_catalogo())) <> 8 and not exists (
       select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where c ->> 'clave' = 'valor_del_socio') then
    raise exception 'Guarda: el catálogo de funciones nuevas no es el de las 8 claves esperadas';
  end if;
end $guarda$;

-- ── El catálogo único, con la clave nueva al final ──────────────────
create or replace function privado.funciones_nuevas_catalogo() returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_array(
    jsonb_build_object('clave', 'borrador_alta', 'titulo', 'Borrador del alta de socio', 'plata', false,
      'explicacion', 'Si se corta el alta a la mitad, al volver pregunta “¿Seguimos donde dejaste?”. Se guarda solo en esa computadora, por 7 días.',
      'novedad', 'Si se corta el alta de un socio a la mitad, al volver pregunta si seguís donde dejaste.'),
    jsonb_build_object('clave', 'panel_pago', 'titulo', 'Más datos en el panel del socio', 'plata', false,
      'explicacion', 'En la ficha rápida que abre la Entrada: cuándo le toca pagar y cuánto, desde cuándo debe, qué plan pagaría, y sus notas y etiquetas.',
      'novedad', 'La ficha rápida de la Entrada muestra cuándo le toca pagar al socio, cuánto, desde cuándo debe, y sus notas y etiquetas.'),
    jsonb_build_object('clave', 'horarios_pico', 'titulo', 'Horarios pico por día de la semana', 'plata', false,
      'explicacion', 'En Resultado: un cuadro con las entradas de las últimas 8 semanas por día y hora.',
      'novedad', 'En Resultado hay un cuadro con las entradas de las últimas 8 semanas por día y hora.'),
    jsonb_build_object('clave', 'apto_vencimiento', 'titulo', 'Apto físico: aviso antes de que venza', 'plata', false,
      'explicacion', 'Con “Pedir apto físico” prendido, avisa cuántos aptos vencen pronto y, si lo elegís, la entrada avisa o frena a quien no tiene el apto al día. Solo se guarda la fecha, nunca el certificado.',
      'novedad', 'El apto físico ahora avisa antes de vencer y la entrada puede avisar o frenar a quien lo tiene vencido.'),
    jsonb_build_object('clave', 'origen_altas', 'titulo', 'De dónde vienen los socios nuevos', 'plata', false,
      'explicacion', 'El link de “Quiero ser socio” puede llevar su origen (Instagram, QR del cartel, WhatsApp, recomendado). Cada alta queda con su origen y un reporte cuenta cuántas se hicieron y cuántas pagaron.',
      'novedad', 'Ahora cada socio nuevo queda con el origen del link por el que llegó, y Interesados muestra cuántos vienen de cada lado y cuántos pagaron.'),
    jsonb_build_object('clave', 'resumen_noche', 'titulo', 'Resumen de la noche', 'plata', false,
      'explicacion', 'En Novedades, el dueño ve cuánto se cobró, cuántos entraron, altas, bajas y si la caja quedó cerrada. Se calcula al abrir, con lo que pasó ese día.',
      'novedad', 'En Novedades hay un resumen del día: lo cobrado, las entradas, las altas, las bajas y el estado de la caja.'),
    jsonb_build_object('clave', 'debito_automatico', 'titulo', 'Débito automático con MercadoPago', 'plata', true,
      'explicacion', 'El socio se adhiere una vez y se le cobra solo cada mes; el aviso de MercadoPago crea el pago. Necesita las credenciales de MercadoPago del gimnasio y todavía no cobra sin ellas.',
      'novedad', 'Los socios se pueden adherir al débito automático; cada cobro mensual lo confirma MercadoPago y queda como un pago más.'),
    jsonb_build_object('clave', 'vuelto_efectivo', 'titulo', 'Vuelto al cobrar en efectivo', 'plata', true,
      'explicacion', 'En la hoja Cobrar, con Efectivo elegido, la recepción escribe con cuánto paga el socio y ve el vuelto y los billetes rápidos. Es solo una cuenta en pantalla: lo cobrado y la caja son el total, no cambian.',
      'novedad', 'Al cobrar en efectivo, la hoja Cobrar calcula el vuelto con cuánto paga el socio. Es solo una cuenta: no cambia lo cobrado.'),
    jsonb_build_object('clave', 'valor_del_socio', 'titulo', 'Cuánto deja un socio y cuánto dura', 'plata', false,
      'explicacion', 'En Resultado, dos números calculados con lo que ya está guardado: cuánto paga por mes cada socio que pagó en los últimos 90 días, y cuántos meses se queda en promedio quien ya se fue. No cambia ningún cobro ni ninguna entrada.',
      'novedad', 'En Resultado hay dos números nuevos: cuánto deja un socio por mes y cuántos meses dura en promedio.')
  )
$$;
revoke all on function privado.funciones_nuevas_catalogo() from public, anon, authenticated;

-- ── Los dos números ─────────────────────────────────────────────────
create or replace function public.valor_del_socio(p_gimnasio_id uuid, p_momento timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  m timestamptz := coalesce(p_momento, now());
  primer timestamptz; ventana int; d0 timestamptz;
  cobrado numeric; pagaron int; deja numeric;
  se_fueron int; dias_prom numeric; dura numeric;
begin
  perform privado.exigir_resultado(p_gimnasio_id);
  perform privado.exigir_funcion(p_gimnasio_id, 'valor_del_socio');

  select min(p.aprobado_en) into primer from public.pagos p
   where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.medio <> 'cuenta_corriente' and p.aprobado_en <= m;
  ventana := case when primer is null then 90 else least(90, greatest(30, ceil(extract(epoch from (m - primer)) / 86400)::int)) end;
  d0 := m - make_interval(days => ventana);

  select coalesce(sum(p.monto), 0), count(distinct v.socio_id)::int into cobrado, pagaron
    from public.pagos p join public.ventas v on v.id = p.venta_id
   where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.medio <> 'cuenta_corriente'
     and v.estado <> 'anulada' and v.socio_id is not null and p.aprobado_en > d0 and p.aprobado_en <= m;
  deja := case when pagaron > 0 then round(cobrado / pagaron * 30.0 / ventana) end;

  select count(*)::int, avg(extract(epoch from (x.fin - x.ini)) / 86400.0) into se_fueron, dias_prom from (
    select min(c.desde) as ini, least(max(c.hasta), coalesce(s.dado_de_baja_en, max(c.hasta))) as fin
      from public.coberturas c join public.socios s on s.id = c.socio_id
     where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null and c.origen in ('pago', 'importacion') and c.desde <= m
     group by c.socio_id, s.dado_de_baja_en
    having (max(c.hasta) <= m or (s.dado_de_baja_en is not null and s.dado_de_baja_en <= m))
       and least(max(c.hasta), coalesce(s.dado_de_baja_en, max(c.hasta))) > min(c.desde)) x;
  dura := case when se_fueron > 0 then round(dias_prom / 30.0, 1) end;

  return jsonb_build_object('deja_por_mes', deja, 'socios_que_pagaron', pagaron, 'ventana_dias', ventana,
                            'dura_meses', dura, 'socios_que_se_fueron', se_fueron);
end $$;
revoke execute on function public.valor_del_socio(uuid, timestamptz) from public, anon;
grant execute on function public.valor_del_socio(uuid, timestamptz) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $verif$
declare claves text[];
begin
  select array_agg(c ->> 'clave' order by o.n) into claves from jsonb_array_elements(privado.funciones_nuevas_catalogo()) with ordinality as o(c, n);
  if claves is distinct from array['borrador_alta', 'panel_pago', 'horarios_pico', 'apto_vencimiento', 'origen_altas', 'resumen_noche', 'debito_automatico', 'vuelto_efectivo', 'valor_del_socio'] then
    raise exception 'Verificación: el catálogo no tiene las 9 claves esperadas (%)', claves;
  end if;
  if exists (select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where coalesce(c ->> 'novedad', '') = '' or coalesce(c ->> 'explicacion', '') = '') then
    raise exception 'Verificación: una función del catálogo no tiene explicación o novedad';
  end if;
  if not exists (select 1 from pg_proc where oid = 'privado.funciones_nuevas_catalogo()'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: funciones_nuevas_catalogo sin search_path vacío';
  end if;
  if not exists (select 1 from pg_proc where oid = 'public.valor_del_socio(uuid, timestamptz)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: valor_del_socio sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.valor_del_socio(uuid, timestamptz)', 'execute') or not has_function_privilege('authenticated', 'public.valor_del_socio(uuid, timestamptz)', 'execute') then
    raise exception 'Verificación: permisos de valor_del_socio';
  end if;
end $verif$;
