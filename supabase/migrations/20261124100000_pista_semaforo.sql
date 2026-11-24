-- Pista Semáforo (Mateo, 24/11) · la llave por gimnasio 'pista_semaforo' (docs/base/pista/semaforo, DISENO.md § Pista Semáforo).
-- Aditiva y compatible con el código anterior: una clave más en el catálogo de funciones nuevas (apagada por defecto, prendida en los [demo])
-- y una columna más al final de gimnasio_por_host / gimnasio_por_slug (el código viejo lee por nombre y no la usa). Solo cambia cómo se ve,
-- y solo con el estilo Pista elegido: el <html> lleva data-semaforo y el CSS hace el resto.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $g$ begin
  if to_regprocedure('privado.funciones_nuevas_catalogo()') is null then raise exception 'Guarda: falta el catálogo de funciones nuevas'; end if;
  if jsonb_array_length(privado.funciones_nuevas_catalogo()) <> 11
     and not exists (select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where c ->> 'clave' = 'pista_semaforo') then
    raise exception 'Guarda: el catálogo no es el esperado (11 claves)';
  end if;
  if to_regclass('public.funciones_nuevas_gimnasio') is null then raise exception 'Guarda: falta funciones_nuevas_gimnasio'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'estilo') then
    raise exception 'Guarda: falta configuracion_gimnasio.estilo';
  end if;
end $g$;

-- ── 1. La clave en el catálogo (las once de antes, sin cambios, más pista_semaforo) ──
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
      'novedad', 'En Resultado hay dos números nuevos: cuánto deja un socio en promedio y cuántos meses dura.'),
    jsonb_build_object('clave', 'aviso_vencimiento', 'titulo', 'Aviso en la app: “te quedan 3 días”', 'plata', false,
      'explicacion', 'En el Inicio de la app del socio, cuando le faltan 3 días o menos para que venza su cuota, aparece un aviso arriba con la fecha. Se calcula al abrir la app (sin cron) y solo avisa: no cambia el acceso ni cobra nada.',
      'novedad', 'La app del socio avisa arriba del Inicio cuando le quedan 3 días o menos de cuota.'),
    jsonb_build_object('clave', 'landing_nueva', 'titulo', 'Página del gimnasio nueva, con ilustraciones', 'plata', false,
      'explicacion', 'La página pública del gimnasio pasa al diseño nuevo: arriba el nombre y “Hacete socio”, después planes y precios, clases de la semana, cómo llegar, horarios y WhatsApp, y al final el reglamento y “Ya soy socio”. Con ilustraciones pintadas con el color del gimnasio. Lo que no cargaste no se muestra.',
      'novedad', 'La página del gimnasio tiene un diseño nuevo, con ilustraciones en el color del gimnasio y los planes arriba.'),
    jsonb_build_object('clave', 'pista_semaforo', 'titulo', 'Pista Semáforo: el diseño nuevo de todas las pantallas', 'plata', false,
      'explicacion', 'Con el estilo Pista elegido, todas las pantallas pasan al diseño Semáforo: botones y campos redondeados, el resultado de la puerta grande en verde, amarillo o rojo, emojis en el menú y en los títulos, y en el celular una barra abajo con Inicio, Entrada, Socios, Caja y Más. Cambia solo cómo se ve: las mismas pantallas y las mismas funciones.',
      'novedad', 'Todas las pantallas tienen el diseño Semáforo: el resultado de la puerta en grande, botones redondeados y emojis para encontrar todo más rápido.')
  )
$$;
revoke all on function privado.funciones_nuevas_catalogo() from public, anon, authenticated;

-- Prendida en los [demo] (solo donde todavía no hay fila: si alguien la apagó en un demo, queda apagada).
insert into public.funciones_nuevas_gimnasio (gimnasio_id, clave, activa, prendida_en, cambiada_en)
select g.id, 'pista_semaforo', true, now(), now() from public.gimnasios g where g.es_demo
on conflict (gimnasio_id, clave) do nothing;

-- ── 2. La dirección trae la llave, sin un viaje más ─────────────────
-- Cambia la forma de lo que devuelve: la vieja se borra en esta misma migración (dos versiones harían ambigua la llamada).
drop function if exists public.gimnasio_por_host(text);
create function public.gimnasio_por_host(p_host text)
 returns table(gimnasio_id uuid, slug text, nombre text, zona_horaria text, logo_path text, favicon_path text, color_acento text, color_fondo text, estilo text, modo text, semaforo boolean)
 language sql stable security definer set search_path = ''
as $f$
  select g.id, g.slug, g.nombre, g.zona_horaria, c.logo_path, c.favicon_path, c.color_acento, c.color_fondo, c.estilo, c.modo,
         coalesce((select f.activa from public.funciones_nuevas_gimnasio f where f.gimnasio_id = g.id and f.clave = 'pista_semaforo'), false)
    from public.dominios_gimnasio d
    join public.gimnasios g on g.id = d.gimnasio_id
    join public.configuracion_gimnasio c on c.gimnasio_id = g.id
   where d.host = lower(p_host)
$f$;

drop function if exists public.gimnasio_por_slug(text);
create function public.gimnasio_por_slug(p_slug text)
 returns table(gimnasio_id uuid, slug text, nombre text, zona_horaria text, logo_path text, favicon_path text, color_acento text, color_fondo text, host text, estilo text, modo text, semaforo boolean)
 language sql stable security definer set search_path = ''
as $f$
  select g.id, g.slug, g.nombre, g.zona_horaria, c.logo_path, c.favicon_path, c.color_acento, c.color_fondo,
         (select d.host from public.dominios_gimnasio d where d.gimnasio_id = g.id
           order by (d.tipo = 'propio') desc, d.creado_en limit 1), c.estilo, c.modo,
         coalesce((select f.activa from public.funciones_nuevas_gimnasio f where f.gimnasio_id = g.id and f.clave = 'pista_semaforo'), false)
    from public.gimnasios g
    join public.configuracion_gimnasio c on c.gimnasio_id = g.id
   where g.slug = lower(p_slug)
$f$;

revoke all on function public.gimnasio_por_host(text), public.gimnasio_por_slug(text) from public;
grant execute on function public.gimnasio_por_host(text), public.gimnasio_por_slug(text) to anon, authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $v$
declare f text;
begin
  if jsonb_array_length(privado.funciones_nuevas_catalogo()) <> 12 then raise exception 'Verificación: el catálogo no tiene las 12 claves'; end if;
  if not exists (select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where c ->> 'clave' = 'pista_semaforo' and coalesce(c ->> 'novedad', '') <> '') then
    raise exception 'Verificación: falta pista_semaforo en el catálogo';
  end if;
  if exists (select 1 from public.funciones_nuevas_gimnasio x join public.gimnasios g on g.id = x.gimnasio_id
              where not g.es_demo and x.clave = 'pista_semaforo' and x.activa) then
    raise exception 'Verificación: pista_semaforo quedó prendida en un gimnasio real';
  end if;
  foreach f in array array['public.gimnasio_por_host(text)', 'public.gimnasio_por_slug(text)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if not has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: el proxy (anon) no puede ejecutar %', f; end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('gimnasio_por_host', 'gimnasio_por_slug')) <> 2 then
    raise exception 'Verificación: quedó más de una versión de gimnasio_por_host/slug';
  end if;
end $v$;
