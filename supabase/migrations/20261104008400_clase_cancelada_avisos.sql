-- 0084 · Cancelar una clase avisando a los anotados (CLA-3).
-- Cancelar ya avisaba por la campana y el push (0073, 0075). Faltaba lo del
-- mostrador: los anotados de una clase cancelada aparecen en "Avisos de hoy"
-- con el mensaje "Clase cancelada" ya escrito (editable en Configuración →
-- Mensajes) y el WhatsApp a un toque. Los packs no se descuentan (una
-- reserva no gasta clase: la gasta el presente o la entrada).
-- Copias: mensajes_catalogo (0064, + "Clase cancelada"), bandeja_avisos y
-- marcar_avisado (0072), vista_previa_mensaje (0025: con ejemplos para las
-- variables que no son del socio, así la vista previa no muestra {clase}).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.ocupacion_horarios(uuid, int)') is null then raise exception 'Guarda: falta la migración 0083'; end if;
end $$;

alter table public.plantillas_mensaje drop constraint if exists plantillas_mensaje_clave_check;
alter table public.plantillas_mensaje add constraint plantillas_mensaje_clave_check
  check (clave in ('no_viene', 'por_vencer', 'vencido', 'se_fue', 'nuevo', 'bienvenida', 'cumpleanos', 'comprobante_rechazado', 'prospecto', 'comprobante_pago', 'clase_cancelada'));

alter table public.avisos_enviados drop constraint if exists avisos_enviados_clave_check;
alter table public.avisos_enviados add constraint avisos_enviados_clave_check
  check (clave in ('por_vencer', 'vencido', 'no_viene', 'cumpleanos', 'comprobante_rechazado', 'clase_cancelada'));

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
     "original": "Hola {nombre}! Recibimos tu pago de {monto} en {gimnasio} ({detalle}, {fecha}). {al_dia} ¡Gracias! 💪"},
    {"clave": "clase_cancelada", "titulo": "Clase cancelada", "emoji": "❌", "cuando": "A los anotados en una clase que se canceló.",
     "usado_en": ["Avisos de hoy"], "variables": ["nombre", "gimnasio", "clase", "dia", "motivo"],
     "original": "Hola {nombre}! Te avisamos de {gimnasio}: se canceló {clase} del {dia} ({motivo}). Perdón por el cambio 🙏 Podés reservar otra clase desde la app."}
  ]'::jsonb
$$;

do $$
declare g uuid;
begin
  for g in select id from public.gimnasios loop perform privado.crear_plantillas(g); end loop;
end $$;

create or replace function public.bandeja_avisos(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; gim text; plantilla text; plantilla_cc text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.zona_horaria, g.nombre into zona, gim from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  select coalesce(p.texto, (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = 'comprobante_rechazado'))
    into plantilla from public.plantillas_mensaje p where p.gimnasio_id = p_gimnasio_id and p.clave = 'comprobante_rechazado';
  select coalesce(p.texto, (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = 'clase_cancelada'))
    into plantilla_cc from public.plantillas_mensaje p where p.gimnasio_id = p_gimnasio_id and p.clave = 'clase_cancelada';
  return coalesce((
    with candidatos as (
      -- De Retención: misma cuenta, mismo mensaje.
      select r.socio_id, r.nombre, r.telefono, r.lista as clave, r.texto as motivo, r.mensaje,
             case r.lista when 'no_viene' then coalesce(privado.dia_local(r.ultimo_ingreso, zona)::text, 'nunca')
                          else coalesce(privado.dia_local(r.vence_en, zona)::text, hoy::text) end as referencia
        from privado.retencion(p_gimnasio_id, now()) r
       where r.lista in ('por_vencer', 'no_viene') or (r.lista = 'vencido' and r.dias between 1 and 3)
      union all
      select (c ->> 'socio_id')::uuid, c ->> 'nombre', c ->> 'telefono', 'cumpleanos', 'Cumple ' || (c ->> 'cumple') || ' hoy', c ->> 'mensaje',
             extract(year from hoy)::text
        from jsonb_array_elements(public.cumplen_hoy(p_gimnasio_id, now())) c
      union all
      select s.id, trim(s.nombre || ' ' || s.apellido), privado.celular_aviso(s.telefono, s.responsable_telefono, s.fecha_nacimiento, hoy),
             'comprobante_rechazado', 'Le rechazaron el comprobante: ' || p.rechazado_motivo,
             privado.armar_mensaje(plantilla, privado.variables_socio(s.id, now())), p.id::text
        from public.pagos p join public.ventas v on v.id = p.venta_id join public.socios s on s.id = v.socio_id
       where p.gimnasio_id = p_gimnasio_id and p.estado = 'rechazado' and p.rechazado_en > now() - interval '3 days'
         and s.dado_de_baja_en is null
      union all
      -- CLA-3: los anotados de una clase cancelada (en los últimos 2 días, si la clase no pasó hace más de un día).
      select s.id, trim(s.nombre || ' ' || s.apellido), privado.celular_aviso(s.telefono, s.responsable_telefono, s.fecha_nacimiento, hoy),
             'clase_cancelada', 'Se canceló ' || a.nombre || ' del ' || to_char(c.inicio at time zone zona, 'DD/MM HH24:MI') || coalesce(': ' || c.cancelada_motivo, ''),
             privado.armar_mensaje(plantilla_cc, privado.variables_socio(s.id, now()) || jsonb_build_object('clase', a.nombre,
               'dia', to_char(c.inicio at time zone zona, 'DD/MM') || ' a las ' || to_char(c.inicio at time zone zona, 'HH24:MI'),
               'motivo', coalesce(c.cancelada_motivo, 'se canceló'))),
             c.id::text
        from public.reservas r join public.clases c on c.id = r.clase_id join public.actividades a on a.id = c.actividad_id
        join public.socios s on s.id = r.socio_id
       where r.gimnasio_id = p_gimnasio_id and r.cancelada_por = 'clase_cancelada' and c.cancelada_en > now() - interval '2 days'
         and c.inicio > now() - interval '1 day' and s.dado_de_baja_en is null
    )
    select jsonb_agg(jsonb_build_object('socio_id', c.socio_id, 'nombre', c.nombre, 'telefono', c.telefono, 'clave', c.clave,
             'motivo', c.motivo, 'mensaje', c.mensaje, 'referencia', c.referencia,
             'avisado_en', a.creado_en, 'avisado_por', (select q.nombre from public.equipo q where q.id = a.creado_por))
             order by (a.id is not null), array_position(array['clase_cancelada', 'por_vencer', 'vencido', 'comprobante_rechazado', 'cumpleanos', 'no_viene'], c.clave), c.nombre)
      from candidatos c
      left join public.avisos_enviados a on a.gimnasio_id = p_gimnasio_id and a.socio_id = c.socio_id and a.clave = c.clave and a.referencia = c.referencia
     -- Lo avisado otro día no vuelve; lo avisado hoy se ve con ✓.
     where a.id is null or privado.dia_local(a.creado_en, zona) = hoy
  ), '[]'::jsonb);
end $$;

create or replace function public.marcar_avisado(p_socio_id uuid, p_clave text, p_referencia text) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; e public.equipo;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']);
  if p_clave is null or p_clave not in ('por_vencer', 'vencido', 'no_viene', 'cumpleanos', 'comprobante_rechazado', 'clase_cancelada') then
    raise exception 'Aviso desconocido' using errcode = '22023';
  end if;
  insert into public.avisos_enviados (gimnasio_id, socio_id, clave, referencia, creado_por)
  values (g, p_socio_id, p_clave, left(coalesce(nullif(trim(p_referencia), ''), 'sin'), 64), e.id)
  on conflict (gimnasio_id, socio_id, clave, referencia) do nothing;
end $$;

create or replace function public.vista_previa_mensaje(p_gimnasio_id uuid, p_clave text, p_texto text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t text; r record; sid uuid;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  t := privado.validar_mensaje(p_clave, p_texto);
  if p_clave in ('no_viene', 'por_vencer', 'vencido', 'se_fue', 'nuevo') then
    select x.socio_id, x.nombre, x.texto, x.mensaje into r
      from privado.retencion_con(p_gimnasio_id, now(), jsonb_build_object(p_clave, t)) x
     where x.lista = p_clave limit 1;
    if found then
      return jsonb_build_object('socio', r.nombre, 'situacion', r.texto, 'texto', r.mensaje, 'de_la_lista', true);
    end if;
  end if;
  select s.id into sid from public.socios s
    join public.suscripciones x on x.socio_id = s.id and x.baja_en is null
   where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null
   order by s.numero limit 1;
  if sid is null then
    select s.id into sid from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null order by s.numero limit 1;
  end if;
  if sid is null then
    return jsonb_build_object('socio', null, 'situacion', null, 'de_la_lista', false,
      'texto', privado.armar_mensaje(t, jsonb_build_object('nombre', 'Sofía', 'gimnasio', (select g.nombre from public.gimnasios g where g.id = p_gimnasio_id),
                                                           'plan', 'Mensual', 'vence', 'el 10/12', 'dias', '7', 'debe', '$25.000', 'monto', '$25.000')));
  end if;
  return jsonb_build_object('socio', (select trim(s.nombre || ' ' || s.apellido) from public.socios s where s.id = sid),
                            'situacion', null, 'de_la_lista', false,
                            'texto', privado.armar_mensaje(t, jsonb_build_object('clase', 'Spinning', 'dia', '10/11 a las 19:00', 'motivo', 'el profe está enfermo',
                                       'detalle', 'Cuota Mensual', 'fecha', '10/11', 'al_dia', 'Quedaste al día hasta el 10/12.', 'monto', '$25.000')
                                     || privado.variables_socio(sid, now())));
end $$;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = 'clase_cancelada') then
    raise exception 'Verificación: falta el mensaje Clase cancelada';
  end if;
  if exists (select 1 from public.gimnasios g where not exists (select 1 from public.plantillas_mensaje p where p.gimnasio_id = g.id and p.clave = 'clase_cancelada')) then
    raise exception 'Verificación: un gimnasio quedó sin la plantilla Clase cancelada';
  end if;
  if position('clase_cancelada' in pg_get_functiondef('public.bandeja_avisos(uuid)'::regprocedure)) = 0 then raise exception 'Verificación: la bandeja no tiene las clases canceladas'; end if;
end $$;
