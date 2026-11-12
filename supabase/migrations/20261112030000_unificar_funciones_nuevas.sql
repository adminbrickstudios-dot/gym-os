-- Un solo interruptor por gimnasio para las funciones nuevas: `funciones_nuevas_gimnasio` (N5) es la única fuente.
-- Antes había dos sistemas: la tabla de N5 (origen de altas, resumen de la noche, apto, débito) y la lista
-- `configuracion_gimnasio.funciones_nuevas` de F4/F5 (borrador del alta FA-17, panel lateral FA-1, horarios pico).
-- Esta migración:
--   1. pasa a la tabla de N5 lo que cada gimnasio tenía prendido en la lista (hoy: nada; todo sigue apagado por defecto);
--   2. suma las tres claves de F4/F5 al catálogo único (con su frase para "Qué hay de nuevo");
--   3. borra las dos funciones del sistema viejo (`funciones_nuevas_gimnasio(uuid)` y `guardar_funcion_nueva(uuid, text, boolean)`):
--      ahora se lee con `funciones_nuevas_activas`, se cambia con `cambiar_funcion_nueva` y se ve en `funciones_nuevas_panel`.
-- La columna `configuracion_gimnasio.funciones_nuevas` queda vacía y sin uso (no se borra: esta migración es aditiva).
-- Aditiva e idempotente.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.funciones_nuevas_gimnasio') is null then raise exception 'Guarda: falta funciones_nuevas_gimnasio (N5)'; end if;
  if to_regprocedure('privado.funciones_nuevas_catalogo()') is null then raise exception 'Guarda: falta privado.funciones_nuevas_catalogo'; end if;
  if to_regprocedure('privado.funcion_activa(uuid, text)') is null then raise exception 'Guarda: falta privado.funcion_activa'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'funciones_nuevas') then
    raise exception 'Guarda: falta configuracion_gimnasio.funciones_nuevas (F4/F5)';
  end if;
end $$;

-- ── 1. Lo que ya estaba prendido en el sistema viejo pasa al único ──
-- Solo las claves que existían allá; si el gimnasio ya tiene fila en la tabla única, no se toca (repetir la migración no pisa nada).
insert into public.funciones_nuevas_gimnasio (gimnasio_id, clave, activa, prendida_en, cambiada_en)
select c.gimnasio_id, x.clave, true, now(), now()
  from public.configuracion_gimnasio c
  cross join lateral unnest(c.funciones_nuevas) as x(clave)
 where x.clave in ('borrador_alta', 'panel_pago', 'horarios_pico')
on conflict (gimnasio_id, clave) do nothing;

-- Nadie pierde ni gana nada: todo lo que estaba prendido en la lista vieja tiene que estar prendido en la tabla única.
do $$
begin
  if exists (select 1 from public.configuracion_gimnasio c cross join lateral unnest(c.funciones_nuevas) x(clave)
              where x.clave in ('borrador_alta', 'panel_pago', 'horarios_pico') and not privado.funcion_activa(c.gimnasio_id, x.clave)) then
    raise exception 'Verificación: una función prendida en la lista vieja no quedó prendida en la tabla única';
  end if;
end $$;

-- La lista vieja queda vacía: así repetir la migración nunca vuelve a prender algo que el dueño ya apagó.
update public.configuracion_gimnasio set funciones_nuevas = '{}' where funciones_nuevas <> '{}';

comment on column public.configuracion_gimnasio.funciones_nuevas is
  'SIN USO desde 20261112030000: el interruptor de las funciones nuevas vive en funciones_nuevas_gimnasio (cambiar_funcion_nueva / funciones_nuevas_activas).';

-- ── 2. El catálogo único ─────────────────────────────────────────────
-- Para sumar una función: un objeto más acá (clave, titulo, plata, explicacion, novedad), y preguntar con
-- privado.funcion_activa(gimnasio, clave) o con funciones_nuevas_activas(gimnasio). Nada más: la pantalla sale de este catálogo.
-- PUNTO DE EXTENSIÓN: el "vuelto en efectivo al cobrar" (carril/z-resto, configuracion_gimnasio.mostrar_vuelto_efectivo) todavía tiene
-- su propio interruptor; para pasarlo acá basta sumar su objeto a esta lista y que Cobrar pregunte por la clave 'vuelto_efectivo'.
-- Esta migración no lo toca.
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
      'novedad', 'Los socios se pueden adherir al débito automático; cada cobro mensual lo confirma MercadoPago y queda como un pago más.')
  )
$$;
revoke all on function privado.funciones_nuevas_catalogo() from public, anon, authenticated;

-- ── 3. Fuera el sistema viejo ────────────────────────────────────────
drop function if exists public.funciones_nuevas_gimnasio(uuid);
drop function if exists public.guardar_funcion_nueva(uuid, text, boolean);

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare claves text[];
begin
  select array_agg(c ->> 'clave' order by o.n) into claves from jsonb_array_elements(privado.funciones_nuevas_catalogo()) with ordinality as o(c, n);
  if claves is distinct from array['borrador_alta', 'panel_pago', 'horarios_pico', 'apto_vencimiento', 'origen_altas', 'resumen_noche', 'debito_automatico'] then
    raise exception 'Verificación: el catálogo no tiene las 7 claves esperadas (%)', claves;
  end if;
  if exists (select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where coalesce(c ->> 'novedad', '') = '' or coalesce(c ->> 'explicacion', '') = '') then
    raise exception 'Verificación: una función del catálogo no tiene explicación o novedad';
  end if;
  if to_regprocedure('public.funciones_nuevas_gimnasio(uuid)') is not null or to_regprocedure('public.guardar_funcion_nueva(uuid, text, boolean)') is not null then
    raise exception 'Verificación: quedó una función del sistema viejo';
  end if;
  if not exists (select 1 from pg_proc where oid = 'privado.funciones_nuevas_catalogo()'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: funciones_nuevas_catalogo sin search_path vacío';
  end if;
end $$;
