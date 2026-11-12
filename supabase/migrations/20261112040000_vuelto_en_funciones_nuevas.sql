-- El vuelto en efectivo al cobrar pasa al único interruptor de funciones nuevas (funciones_nuevas_gimnasio), con la clave
-- 'vuelto_efectivo' en el catálogo. Antes tenía su propia columna (configuracion_gimnasio.mostrar_vuelto_efectivo) y su propio guardado.
-- Sigue APAGADO por defecto; es solo una cuenta en pantalla: no toca ningún monto cobrado ni la caja.
-- Aditiva e idempotente. La columna vieja queda sin uso (no se borra).

do $$
begin
  if to_regclass('public.funciones_nuevas_gimnasio') is null then raise exception 'Guarda: falta funciones_nuevas_gimnasio'; end if;
  if to_regprocedure('privado.funciones_nuevas_catalogo()') is null then raise exception 'Guarda: falta privado.funciones_nuevas_catalogo'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'mostrar_vuelto_efectivo') then
    raise exception 'Guarda: falta configuracion_gimnasio.mostrar_vuelto_efectivo';
  end if;
end $$;

-- Lo que ya estuviera prendido en la columna vieja pasa al único (hoy: nada). Si ya hay fila, no se pisa.
insert into public.funciones_nuevas_gimnasio (gimnasio_id, clave, activa, prendida_en, cambiada_en)
select c.gimnasio_id, 'vuelto_efectivo', true, now(), now() from public.configuracion_gimnasio c where c.mostrar_vuelto_efectivo
on conflict (gimnasio_id, clave) do nothing;
update public.configuracion_gimnasio set mostrar_vuelto_efectivo = false where mostrar_vuelto_efectivo;
comment on column public.configuracion_gimnasio.mostrar_vuelto_efectivo is 'SIN USO desde 20261112040000: el vuelto es la función nueva vuelto_efectivo (funciones_nuevas_gimnasio).';

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
      'novedad', 'Al cobrar en efectivo, la hoja Cobrar calcula el vuelto con cuánto paga el socio. Es solo una cuenta: no cambia lo cobrado.')
  )
$$;
revoke all on function privado.funciones_nuevas_catalogo() from public, anon, authenticated;

-- Fuera el interruptor propio del vuelto.
drop function if exists public.vuelto_efectivo_activo(uuid);
drop function if exists public.guardar_vuelto_efectivo(uuid, boolean);

do $$
begin
  if not exists (select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where c ->> 'clave' = 'vuelto_efectivo' and coalesce(c ->> 'novedad', '') <> '') then
    raise exception 'Verificación: el catálogo no tiene vuelto_efectivo';
  end if;
  if jsonb_array_length(privado.funciones_nuevas_catalogo()) <> 8 then raise exception 'Verificación: el catálogo no tiene las 8 claves'; end if;
  if to_regprocedure('public.vuelto_efectivo_activo(uuid)') is not null or to_regprocedure('public.guardar_vuelto_efectivo(uuid, boolean)') is not null then
    raise exception 'Verificación: quedó el interruptor propio del vuelto';
  end if;
  if not exists (select 1 from pg_proc where oid = 'privado.funciones_nuevas_catalogo()'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: funciones_nuevas_catalogo sin search_path vacío';
  end if;
end $$;
