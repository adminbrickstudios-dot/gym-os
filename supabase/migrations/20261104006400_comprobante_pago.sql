-- 0064 · Comprobante de pago por WhatsApp (VEN-1).
-- Después de cobrar, Vender ofrece mandarle al socio el comprobante por
-- WhatsApp, ya escrito. El texto es un mensaje más de Configuración →
-- Mensajes ("Comprobante de pago"), editable por gimnasio. Se arma en la base
-- con lo cobrado (comprobante_venta): no se guarda nada nuevo.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.armar_mensaje(text, jsonb)') is null then raise exception 'Guarda: falta la migración 0025'; end if;
  if to_regprocedure('privado.celular_aviso(text, text, date, date)') is null then raise exception 'Guarda: falta la migración 0047'; end if;
  if to_regclass('public.pedidos_anulacion') is null then raise exception 'Guarda: falta la migración 0062'; end if;
end $$;

alter table public.plantillas_mensaje drop constraint if exists plantillas_mensaje_clave_check;
alter table public.plantillas_mensaje add constraint plantillas_mensaje_clave_check
  check (clave in ('no_viene', 'por_vencer', 'vencido', 'se_fue', 'nuevo', 'bienvenida', 'cumpleanos', 'comprobante_rechazado', 'prospecto', 'comprobante_pago'));

-- Catálogo: copia de 0031 con "Comprobante de pago".
create or replace function privado.mensajes_catalogo() returns jsonb
language sql immutable set search_path = '' as $$
  select '[
    {"clave": "por_vencer", "titulo": "Vence pronto", "emoji": "⏰", "cuando": "A los que se les termina la cuota en los próximos días.",
     "usado_en": ["Retención", "Vencen hoy"], "variables": ["nombre", "gimnasio", "plan", "vence", "dias", "debe"],
     "original": "Hola {nombre}! Te recordamos que tu plan en {gimnasio} vence el {vence}. Podés renovarlo cuando vengas o por transferencia 🙌"},
    {"clave": "vencido", "titulo": "Venció", "emoji": "⛔", "cuando": "A los que se les terminó la cuota y no renovaron.",
     "usado_en": ["Retención"], "variables": ["nombre", "gimnasio", "plan", "vence", "dias", "debe", "monto"],
     "original": "Hola {nombre}! Tu plan en {gimnasio} venció el {vence}. Para seguir entrenando son {monto}. ¿Te esperamos esta semana?"},
    {"clave": "no_viene", "titulo": "No viene", "emoji": "👀", "cuando": "A los que pagan pero hace días que no vienen.",
     "usado_en": ["Retención"], "variables": ["nombre", "gimnasio", "plan", "dias"],
     "original": "Hola {nombre}! Te extrañamos en {gimnasio} 💪 Hace {dias} días que no venís. ¿Todo bien? Si querés te ayudamos a armar un horario que te quede cómodo."},
    {"clave": "nuevo", "titulo": "Nuevo que no viene", "emoji": "🌱", "cuando": "A los recién anotados que todavía no agarraron ritmo.",
     "usado_en": ["Retención"], "variables": ["nombre", "gimnasio", "plan", "dias"],
     "original": "Hola {nombre}! ¿Cómo te fue en tus primeras semanas en {gimnasio}? Si necesitás ayuda con la rutina o los horarios, decinos 🙂"},
    {"clave": "se_fue", "titulo": "Se fue", "emoji": "👋", "cuando": "A los que dejaron de pagar hace tiempo o se dieron de baja.",
     "usado_en": ["Retención"], "variables": ["nombre", "gimnasio", "plan", "dias"],
     "original": "Hola {nombre}! ¿Cómo andás? En {gimnasio} nos encantaría volver a verte. Si querés retomar, escribinos y vemos juntos qué plan te conviene."},
    {"clave": "bienvenida", "titulo": "Bienvenida", "emoji": "🎉", "cuando": "Al socio que se acaba de anotar.",
     "usado_en": [], "variables": ["nombre", "gimnasio", "plan", "vence"],
     "original": "¡Bienvenido/a a {gimnasio}, {nombre}! 💪 Tu plan {plan} ya está activo. Cualquier cosa, escribinos por acá."},
    {"clave": "cumpleanos", "titulo": "Cumpleaños", "emoji": "🎂", "cuando": "El día del cumpleaños del socio.",
     "usado_en": [], "variables": ["nombre", "gimnasio"],
     "original": "¡Feliz cumpleaños, {nombre}! 🎂 Todo el equipo de {gimnasio} te desea un gran año. ¡Te esperamos para festejarlo entrenando!"},
    {"clave": "comprobante_rechazado", "titulo": "Comprobante rechazado", "emoji": "🧾", "cuando": "Cuando no se puede aprobar una transferencia que mandó el socio.",
     "usado_en": [], "variables": ["nombre", "gimnasio", "plan", "debe"],
     "original": "Hola {nombre}, no pudimos aprobar el comprobante que mandaste en {gimnasio}. ¿Nos mandás otro, o pasás por recepción? Son {debe}."},
    {"clave": "prospecto", "titulo": "Quiere probar", "emoji": "🌱", "cuando": "Al que dejó sus datos para probar una clase.",
     "usado_en": ["Prospectos"], "variables": ["nombre", "gimnasio"],
     "original": "Hola {nombre}! Te escribimos de {gimnasio} 👋 Vimos que querés venir a probar. ¿Qué día y horario te queda cómodo?"},
    {"clave": "comprobante_pago", "titulo": "Comprobante de pago", "emoji": "🧾", "cuando": "Después de cobrarle algo en Vender, para mandárselo por WhatsApp.",
     "usado_en": ["Vender"], "variables": ["nombre", "gimnasio", "monto", "detalle", "fecha", "al_dia"],
     "original": "Hola {nombre}! Recibimos tu pago de {monto} en {gimnasio} ({detalle}, {fecha}). {al_dia} ¡Gracias! 💪"}
  ]'::jsonb
$$;

do $$
declare g uuid;
begin
  for g in select id from public.gimnasios loop perform privado.crear_plantillas(g); end loop;
end $$;

-- El comprobante de una venta confirmada de un socio: a qué celular y qué texto.
create or replace function public.comprobante_venta(p_venta_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v public.ventas; s public.socios; g public.gimnasios; ac public.veredicto_acceso; texto text; total numeric; detalle text;
begin
  select * into v from public.ventas where id = p_venta_id;
  if not found then raise exception 'Sin permiso o venta inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(v.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if v.socio_id is null then raise exception 'La venta no es de un socio: no hay a quién mandarle el comprobante' using errcode = '22023'; end if;
  if v.estado <> 'confirmada' then raise exception 'La venta no está cobrada' using errcode = '22023'; end if;
  select * into s from public.socios where id = v.socio_id;
  select * into g from public.gimnasios where id = v.gimnasio_id;
  select coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0), string_agg(i.descripcion, ', ' order by i.id)
    into total, detalle from public.venta_items i where i.venta_id = v.id;
  ac := privado.calcular_acceso(s.id, now(), null);
  select pm.texto into texto from public.plantillas_mensaje pm where pm.gimnasio_id = v.gimnasio_id and pm.clave = 'comprobante_pago';
  return jsonb_build_object(
    'telefono', privado.celular_aviso(s.telefono, s.responsable_telefono, s.fecha_nacimiento, privado.dia_local(now(), g.zona_horaria)),
    'mensaje', trim(privado.armar_mensaje(texto, jsonb_build_object(
      'nombre', s.nombre, 'gimnasio', g.nombre, 'monto', privado.formato_pesos(total), 'detalle', detalle,
      'fecha', to_char(v.creado_en at time zone g.zona_horaria, 'DD/MM'),
      'al_dia', case when ac.vence_en is not null and ac.puede then 'Quedás al día hasta el ' || privado.ultimo_dia(ac.vence_en, g.zona_horaria) || '.' else '' end))));
end $$;

revoke all on function public.comprobante_venta(uuid) from public, anon, authenticated;
grant execute on function public.comprobante_venta(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from public.gimnasios gi where not exists (select 1 from public.plantillas_mensaje p where p.gimnasio_id = gi.id and p.clave = 'comprobante_pago')) then
    raise exception 'Verificación: un gimnasio quedó sin el mensaje de comprobante';
  end if;
  if not exists (select 1 from pg_proc where oid = 'public.comprobante_venta(uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: comprobante_venta sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.comprobante_venta(uuid)', 'execute') then raise exception 'Verificación: anon puede ejecutar comprobante_venta'; end if;
end $$;
