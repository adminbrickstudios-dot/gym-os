-- Vuelta final (Mateo, 22/11) · las dos landings detrás de su llave. Aditiva, idempotente y compatible con el código anterior
-- (el código de hoy ignora las claves nuevas del jsonb y las columnas nuevas).
--  1) Llave por gimnasio 'landing_nueva' en el catálogo de funciones nuevas: apagada por defecto (Temple Gym y todo gimnasio real),
--     prendida en los [demo]. landing_publica() devuelve 'landing_nueva' (true/false): la página no hace un viaje más.
--  2) Llave de plataforma 'landing_venta_nueva' en plataforma_ajustes (false): el público sigue viendo la página de venta de hoy.
--     contacto_plataforma_publico() la devuelve (la página de la plataforma ya hace ese viaje). La cambia el super admin.
--  3) Los planes de Pase con su descripción y sus módulos (además de nombre, precio y límites, que ya estaban), editables desde /super.
--     planes_brik_publicos() devuelve también límites, descripción y módulos.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $g$ begin
  if to_regprocedure('privado.funciones_nuevas_catalogo()') is null then raise exception 'Guarda: falta el catálogo de funciones nuevas'; end if;
  if jsonb_array_length(privado.funciones_nuevas_catalogo()) <> 10
     and not exists (select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where c ->> 'clave' = 'landing_nueva') then
    raise exception 'Guarda: el catálogo no es el esperado (10 claves)';
  end if;
  if to_regprocedure('public.landing_publica_sin_cuenta(text)') is null then raise exception 'Guarda: falta landing_publica_sin_cuenta'; end if;
  if to_regclass('public.plataforma_ajustes') is null or to_regclass('public.plataforma_planes') is null then raise exception 'Guarda: faltan las tablas de la plataforma'; end if;
  if to_regprocedure('privado.exigir_brik(text[])') is null then raise exception 'Guarda: falta privado.exigir_brik'; end if;
  if to_regprocedure('public.admin_planes_con_limites()') is null then raise exception 'Guarda: falta admin_planes_con_limites'; end if;
  if to_regclass('public.terminos_gimnasio') is null then raise exception 'Guarda: falta terminos_gimnasio'; end if;
  if to_regclass('public.funciones_nuevas_gimnasio') is null then raise exception 'Guarda: falta funciones_nuevas_gimnasio'; end if;
end $g$;

-- ── 1. La llave de la landing del gimnasio ─────────────────────────
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
      'novedad', 'La página del gimnasio tiene un diseño nuevo, con ilustraciones en el color del gimnasio y los planes arriba.')
  )
$$;
revoke all on function privado.funciones_nuevas_catalogo() from public, anon, authenticated;

-- La misma landing_publica de hoy (crear_cuenta) más la llave. Una lectura más dentro del mismo viaje.
create or replace function public.landing_publica(p_host text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb; v boolean; g uuid;
begin
  r := public.landing_publica_sin_cuenta(p_host);
  if r is null or coalesce((r ->> 'publicada')::boolean, false) is not true then return r; end if;
  select coalesce(c.crear_cuenta_visible, true), c.gimnasio_id into v, g from public.dominios_gimnasio d
    join public.configuracion_gimnasio c on c.gimnasio_id = d.gimnasio_id where d.host = lower(p_host);
  return r || jsonb_build_object('crear_cuenta', coalesce(v, true),
    'landing_nueva', coalesce((select f.activa from public.funciones_nuevas_gimnasio f where f.gimnasio_id = g and f.clave = 'landing_nueva'), false),
    -- La página nueva muestra "Reglamento" solo si el dueño publicó sus términos (nunca un link a una página que no existe).
    'tiene_terminos', exists (select 1 from public.terminos_gimnasio t where t.gimnasio_id = g and t.publicado and t.texto is not null));
end $$;
revoke execute on function public.landing_publica(text) from public;
grant execute on function public.landing_publica(text) to anon, authenticated;

-- Prendida en los [demo] (solo donde todavía no hay fila: si alguien la apagó en un demo, queda apagada).
insert into public.funciones_nuevas_gimnasio (gimnasio_id, clave, activa, prendida_en, cambiada_en)
select g.id, 'landing_nueva', true, now(), now() from public.gimnasios g where g.es_demo
on conflict (gimnasio_id, clave) do nothing;

-- ── 2. La llave de la landing de venta (plataforma) ────────────────
insert into public.plataforma_ajustes (clave, valor) values ('landing_venta_nueva', 'false'::jsonb) on conflict (clave) do nothing;

create or replace function public.contacto_plataforma_publico() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('whatsapp', c.whatsapp, 'mensaje_demo', c.mensaje_demo,
           'landing_nueva', coalesce((select a.valor = 'true'::jsonb from public.plataforma_ajustes a where a.clave = 'landing_venta_nueva'), false))
    from public.plataforma_contacto c where c.id;
$$;
revoke all on function public.contacto_plataforma_publico() from public;
grant execute on function public.contacto_plataforma_publico() to anon, authenticated, service_role;

create or replace function public.admin_landing_venta() returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  return coalesce((select a.valor = 'true'::jsonb from public.plataforma_ajustes a where a.clave = 'landing_venta_nueva'), false);
end $$;

create or replace function public.admin_guardar_landing_venta(p_activa boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_brik(array['principal']);
  if p_activa is null then raise exception 'Elegí prendida o apagada' using errcode = '22023'; end if;
  insert into public.plataforma_ajustes (clave, valor) values ('landing_venta_nueva', to_jsonb(p_activa))
    on conflict (clave) do update set valor = excluded.valor;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se guardó la llave de la página de venta'; end if;
  return p_activa;
end $$;

-- ── 3. Los planes de Pase: descripción y módulos ───────────────────
alter table public.plataforma_planes add column if not exists descripcion text;
alter table public.plataforma_planes add column if not exists modulos text[] not null default '{}';
do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'plataforma_planes_detalle_valido' and conrelid = 'public.plataforma_planes'::regclass) then
    alter table public.plataforma_planes add constraint plataforma_planes_detalle_valido
      check ((descripcion is null or length(descripcion) between 1 and 200) and cardinality(modulos) <= 20);
  end if;
end $c$;

create or replace function public.planes_brik_publicos() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('nombre', p.nombre, 'precio_mensual', p.precio_mensual, 'max_socios', p.max_socios, 'max_sedes', p.max_sedes,
                                               'descripcion', p.descripcion, 'modulos', to_jsonb(p.modulos)) order by p.precio_mensual, p.nombre), '[]'::jsonb)
    from public.plataforma_planes p where p.activo and p.publico;
$$;
revoke all on function public.planes_brik_publicos() from public;
grant execute on function public.planes_brik_publicos() to anon, authenticated, service_role;

create or replace function public.admin_guardar_detalle_plan_brik(p_id uuid, p_descripcion text, p_modulos text[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare n int; d text := nullif(trim(coalesce(p_descripcion, '')), '');
  m text[] := coalesce((select array_agg(distinct trim(x)) from unnest(coalesce(p_modulos, '{}'::text[])) x where trim(x) <> ''), '{}'::text[]);
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  if d is not null and length(d) > 200 then raise exception 'La descripción: hasta 200 letras' using errcode = '22023'; end if;
  if cardinality(m) > 20 then raise exception 'Hasta 20 módulos por plan' using errcode = '22023'; end if;
  if exists (select 1 from unnest(m) x where length(x) > 60) then raise exception 'Cada módulo: hasta 60 letras' using errcode = '22023'; end if;
  update public.plataforma_planes set descripcion = d, modulos = m where id = p_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese plan no existe' using errcode = 'P0002'; end if;
  return p_id;
end $$;

-- La lista del super admin (Escala → planes) suma descripción y módulos, para editarlos ahí mismo.
create or replace function public.admin_planes_con_limites() returns jsonb
language plpgsql stable security definer set search_path = '' as $
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'activo', p.activo, 'publico', p.publico, 'max_socios', p.max_socios, 'max_sedes', p.max_sedes,
            'descripcion', p.descripcion, 'modulos', to_jsonb(p.modulos),
            'gimnasios', (select count(*)::int from public.gimnasios g where g.plataforma_plan_id = p.id)) order by p.activo desc, p.precio_mensual)
    from public.plataforma_planes p), '[]'::jsonb);
end $;

revoke all on function public.admin_landing_venta(), public.admin_guardar_landing_venta(boolean), public.admin_guardar_detalle_plan_brik(uuid, text, text[]) from public, anon;
grant execute on function public.admin_landing_venta(), public.admin_guardar_landing_venta(boolean), public.admin_guardar_detalle_plan_brik(uuid, text, text[]) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $v$
declare f text;
begin
  if jsonb_array_length(privado.funciones_nuevas_catalogo()) <> 11 then raise exception 'Verificación: el catálogo no tiene las 11 claves'; end if;
  if not exists (select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where c ->> 'clave' = 'landing_nueva' and coalesce(c ->> 'novedad', '') <> '') then
    raise exception 'Verificación: falta landing_nueva en el catálogo';
  end if;
  if exists (select 1 from public.funciones_nuevas_gimnasio x join public.gimnasios g on g.id = x.gimnasio_id
              where not g.es_demo and x.clave = 'landing_nueva' and x.activa) then
    raise exception 'Verificación: landing_nueva quedó prendida en un gimnasio real';
  end if;
  if not exists (select 1 from public.plataforma_ajustes where clave = 'landing_venta_nueva') then raise exception 'Verificación: falta la llave landing_venta_nueva'; end if;
  foreach f in array array['public.landing_publica(text)', 'public.contacto_plataforma_publico()', 'public.planes_brik_publicos()',
                           'public.admin_landing_venta()', 'public.admin_guardar_landing_venta(boolean)', 'public.admin_guardar_detalle_plan_brik(uuid, text, text[])'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
  end loop;
  foreach f in array array['public.admin_landing_venta()', 'public.admin_guardar_landing_venta(boolean)', 'public.admin_guardar_detalle_plan_brik(uuid, text, text[])'] loop
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if not has_function_privilege('anon', 'public.landing_publica(text)', 'execute') then raise exception 'Verificación: anon perdió landing_publica'; end if;
end $v$;
