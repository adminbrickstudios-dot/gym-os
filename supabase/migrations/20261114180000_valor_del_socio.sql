-- N10 (NOCHE-1211 N-D) · "Cuánto deja un socio": dos números nuevos en Resultado, calculados de lo ya guardado (pagos aprobados y coberturas no anuladas),
-- sin guardar nada nuevo y APAGADOS por defecto (función nueva 'valor_socio' del interruptor de funciones nuevas). No cambia ningún cobro ni la puerta.
--   · deja_por_socio  = lo cobrado en total / socios que pagaron alguna vez
--   · meses_ex_socios = meses entre el inicio de su primera cobertura y el fin de la última, promedio de quienes YA terminaron (cubierto hasta antes de hoy)
--   · meses_todos     = lo mismo, de todos los que tuvieron cobertura (incluye a los que siguen)
do $g$ begin
  if to_regclass('public.funciones_nuevas_gimnasio') is null then raise exception 'Guarda: falta funciones_nuevas_gimnasio'; end if;
  if to_regprocedure('privado.funciones_nuevas_catalogo()') is null then raise exception 'Guarda: falta privado.funciones_nuevas_catalogo'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
end $g$;

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
    jsonb_build_object('clave', 'valor_socio', 'titulo', 'Cuánto deja un socio', 'plata', false,
      'explicacion', 'En Resultado: cuánto dejó en promedio cada socio que pagó alguna vez y cuántos meses dura (los que ya se fueron, y todos). Se calcula de lo ya guardado (pagos y coberturas): no cambia ningún cobro.',
      'novedad', 'En Resultado hay dos números nuevos: cuánto deja un socio en promedio y cuántos meses dura.')
  )
$$;
revoke all on function privado.funciones_nuevas_catalogo() from public, anon, authenticated;

create or replace function public.valor_del_socio(p_gimnasio_id uuid, p_momento timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  with pagado as (
    select v.socio_id, sum(p.monto) as total
      from public.pagos p
      join public.ventas v on v.gimnasio_id = p.gimnasio_id and v.id = p.venta_id
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and v.estado = 'confirmada' and v.socio_id is not null
     group by v.socio_id),
  cobertura as (
    select c.socio_id, min(c.desde) as desde, max(c.hasta) as hasta
      from public.coberturas c
     where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null
     group by c.socio_id),
  meses as (
    select socio_id, hasta, extract(epoch from (hasta - desde)) / 86400.0 / 30.4375 as m from cobertura)
  select jsonb_build_object(
    'socios_que_pagaron', (select count(*) from pagado where total > 0),
    'cobrado_total', coalesce((select sum(total) from pagado), 0),
    'deja_por_socio', (select case when count(*) filter (where total > 0) = 0 then null else round(sum(total) / count(*) filter (where total > 0), 2) end from pagado),
    'ex_socios', (select count(*) from meses where hasta < p_momento),
    'meses_ex_socios', (select round(avg(m)::numeric, 1) from meses where hasta < p_momento),
    'con_cobertura', (select count(*) from meses),
    'meses_todos', (select round(avg(m)::numeric, 1) from meses))
    into r;
  return r;
end $$;
revoke all on function public.valor_del_socio(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.valor_del_socio(uuid, timestamptz) to authenticated, service_role;

do $v$ begin
  if jsonb_array_length(privado.funciones_nuevas_catalogo()) <> 9 then raise exception 'Verificación: el catálogo no tiene las 9 claves'; end if;
  if not exists (select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where c ->> 'clave' = 'valor_socio' and coalesce(c ->> 'novedad', '') <> '') then
    raise exception 'Verificación: falta valor_socio en el catálogo';
  end if;
  if has_function_privilege('anon', 'public.valor_del_socio(uuid, timestamptz)', 'execute') then raise exception 'Verificación: anon puede ejecutar valor_del_socio'; end if;
end $v$;
