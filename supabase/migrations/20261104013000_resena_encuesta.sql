-- 0130 · Reseña y encuesta (COM-10).
-- El dueño carga el link de reseñas de Google (Configuración → Mensajes).
-- Avisos de hoy sugiere pedir la reseña al que llegó a su entrada 10 (con
-- su WhatsApp y la plantilla "Reseña en Google"). En la app, después de la
-- entrada 10 o del primer mes, una sola pregunta: "del 0 al 10, ¿cuánto nos
-- recomendarías?" (cada 90 días como mucho). Los 9 y 10 ven el link de la
-- reseña y la invitación a traer a un amigo; el dueño los ve en el Resultado.
--   guardar_link_resena(gimnasio, link)  · encuesta_socio(socio)
--   responder_encuesta(socio, puntaje)   · encuestas_panel(gimnasio)
-- Copias: mensajes_catalogo, marcar_avisado, bandeja_avisos, vista_previa_mensaje (0122).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.kiosco_habituales(text)') is null then raise exception 'Guarda: falta la migración 0127'; end if;
end $$;

alter table public.configuracion_gimnasio add column if not exists link_resena text;
alter table public.configuracion_gimnasio drop constraint if exists configuracion_link_resena;
alter table public.configuracion_gimnasio add constraint configuracion_link_resena check (link_resena is null or (link_resena ~ '^https://\S+$' and length(link_resena) <= 300));

alter table public.plantillas_mensaje drop constraint if exists plantillas_mensaje_clave_check;
alter table public.plantillas_mensaje add constraint plantillas_mensaje_clave_check
  check (clave in ('no_viene', 'por_vencer', 'vencido', 'se_fue', 'nuevo', 'bienvenida', 'cumpleanos', 'comprobante_rechazado', 'prospecto', 'comprobante_pago', 'clase_cancelada',
                   'primera_semana', 'primer_mes', 'resena'));
alter table public.avisos_enviados drop constraint if exists avisos_enviados_clave_check;
alter table public.avisos_enviados add constraint avisos_enviados_clave_check
  check (clave in ('por_vencer', 'vencido', 'no_viene', 'cumpleanos', 'comprobante_rechazado', 'clase_cancelada', 'bienvenida', 'primera_semana', 'primer_mes', 'resena'));

create table if not exists public.encuestas (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  socio_id     uuid not null,
  puntaje      int not null check (puntaje between 0 and 10),
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id)
);
create index if not exists encuestas_por_socio on public.encuestas (socio_id, creado_en desc);
select privado.politicas_estandar('public.encuestas', array['dueno', 'encargado'], null, true);
revoke all on table public.encuestas from anon;
revoke truncate, references, trigger on public.encuestas from authenticated;

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
    {"clave": "bienvenida", "titulo": "Bienvenida", "emoji": "🎉", "cuando": "Al socio que se acaba de anotar (su primer día).",
     "usado_en": ["Avisos de hoy"], "variables": ["nombre", "gimnasio", "plan", "vence"],
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
     "original": "Hola {nombre}! Te avisamos de {gimnasio}: se canceló {clase} del {dia} ({motivo}). Perdón por el cambio 🙏 Podés reservar otra clase desde la app."},
    {"clave": "primera_semana", "titulo": "Primera semana", "emoji": "🌱", "cuando": "Al socio nuevo, a la semana de anotarse.",
     "usado_en": ["Avisos de hoy"], "variables": ["nombre", "gimnasio", "entradas", "meta"],
     "original": "Hola {nombre}! Ya pasó tu primera semana en {gimnasio} 💪 Viniste {entradas}. ¿Cómo te sentiste? Si querés, te ayudamos a armar tu rutina y tus horarios."},
    {"clave": "primer_mes", "titulo": "Primer mes", "emoji": "🎉", "cuando": "Al socio nuevo, al cumplir su primer mes.",
     "usado_en": ["Avisos de hoy"], "variables": ["nombre", "gimnasio", "entradas", "meta"],
     "original": "Hola {nombre}! Se cumple tu primer mes en {gimnasio} 🎉 Viniste {entradas}. ¡Gracias por entrenar con nosotros! ¿Hay algo que te gustaría que mejoremos?"},
    {"clave": "resena", "titulo": "Reseña en Google", "emoji": "⭐", "cuando": "Al socio que llegó a su entrada número 10.",
     "usado_en": ["Avisos de hoy"], "variables": ["nombre", "gimnasio", "link"],
     "original": "Hola {nombre}! Ya viniste 10 veces a {gimnasio} 💪 ¿Nos dejarías tu opinión en Google? Nos ayuda un montón: {link} ¡Gracias!"}
  ]'::jsonb
$$;

do $$
declare g uuid;
begin
  for g in select id from public.gimnasios loop perform privado.crear_plantillas(g); end loop;
end $$;

create or replace function public.marcar_avisado(p_socio_id uuid, p_clave text, p_referencia text) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; e public.equipo;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']);
  if p_clave is null or p_clave not in ('por_vencer', 'vencido', 'no_viene', 'cumpleanos', 'comprobante_rechazado', 'clase_cancelada', 'bienvenida', 'primera_semana', 'primer_mes', 'resena') then
    raise exception 'Aviso desconocido' using errcode = '22023';
  end if;
  insert into public.avisos_enviados (gimnasio_id, socio_id, clave, referencia, creado_por)
  values (g, p_socio_id, p_clave, left(coalesce(nullif(trim(p_referencia), ''), 'sin'), 64), e.id)
  on conflict (gimnasio_id, socio_id, clave, referencia) do nothing;
end $$;

create or replace function public.bandeja_avisos(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; gim text; plantilla text; plantilla_cc text; meta int; link text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.zona_horaria, g.nombre into zona, gim from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  select c.meta_primer_mes, c.link_resena into meta, link from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
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
      union all
      -- COM-2: el primer mes del socio nuevo. Bienvenida (días 1 y 2), primera semana (7 a 9) y primer mes (30 a 33).
      select n.socio_id, n.nombre, n.telefono, n.clave,
             case n.clave when 'bienvenida' then 'Se anotó el ' || to_char(n.primer_dia, 'DD/MM')
                          when 'primera_semana' then 'Primera semana: vino ' || n.entradas || (case when n.entradas = 1 then ' vez' else ' veces' end)
                          else 'Primer mes: vino ' || n.entradas || (case when n.entradas = 1 then ' vez' else ' veces' end) || ' (la meta era ' || meta || ')' end,
             privado.armar_mensaje(coalesce(
               (select p.texto from public.plantillas_mensaje p where p.gimnasio_id = p_gimnasio_id and p.clave = n.clave),
               (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = n.clave)),
               privado.variables_socio(n.socio_id, now()) || jsonb_build_object('entradas', n.entradas || case when n.entradas = 1 then ' vez' else ' veces' end, 'meta', meta::text)),
             n.primer_dia::text
        from (
          select s.id as socio_id, trim(s.nombre || ' ' || s.apellido) as nombre,
                 privado.celular_aviso(s.telefono, s.responsable_telefono, s.fecha_nacimiento, hoy) as telefono,
                 pm.primer_dia,
                 case when hoy - pm.primer_dia between 0 and 1 then 'bienvenida'
                      when hoy - pm.primer_dia between 7 and 9 then 'primera_semana'
                      when hoy - pm.primer_dia between 30 and 33 then 'primer_mes' end as clave,
                 (select count(distinct (i.momento at time zone zona)::date) from public.ingresos i
                   where i.socio_id = s.id and i.anulado_en is null and i.resultado <> 'rechazado') as entradas
            from public.socios s
            join (select su.socio_id, min((su.inicio at time zone zona)::date) as primer_dia from public.suscripciones su
                   where su.gimnasio_id = p_gimnasio_id group by su.socio_id) pm on pm.socio_id = s.id
           where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null and hoy - pm.primer_dia between 0 and 33
        ) n
       where n.clave is not null
      union all
      -- COM-10: el que llegó a su entrada 10 en los últimos 3 días: pedirle la reseña (si el gimnasio cargó su link).
      select s.id, trim(s.nombre || ' ' || s.apellido), privado.celular_aviso(s.telefono, s.responsable_telefono, s.fecha_nacimiento, hoy),
             'resena', 'Llegó a su entrada 10',
             privado.armar_mensaje(coalesce(
               (select p.texto from public.plantillas_mensaje p where p.gimnasio_id = p_gimnasio_id and p.clave = 'resena'),
               (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = 'resena')),
               privado.variables_socio(s.id, now()) || jsonb_build_object('link', link)),
             'entrada-10'
        from public.socios s
       where link is not null and s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null
         and (select (array_agg(x.dia order by x.dia))[10] from (
                select distinct (i.momento at time zone zona)::date as dia from public.ingresos i
                 where i.socio_id = s.id and i.anulado_en is null and i.resultado <> 'rechazado') x) between hoy - 3 and hoy
    )
    select jsonb_agg(jsonb_build_object('socio_id', c.socio_id, 'nombre', c.nombre, 'telefono', c.telefono, 'clave', c.clave,
             'motivo', c.motivo, 'mensaje', c.mensaje, 'referencia', c.referencia,
             'avisado_en', a.creado_en, 'avisado_por', (select q.nombre from public.equipo q where q.id = a.creado_por))
             order by (a.id is not null), array_position(array['clase_cancelada', 'por_vencer', 'vencido', 'comprobante_rechazado', 'bienvenida', 'primera_semana', 'primer_mes', 'resena', 'cumpleanos', 'no_viene'], c.clave), c.nombre)
      from candidatos c
      left join public.avisos_enviados a on a.gimnasio_id = p_gimnasio_id and a.socio_id = c.socio_id and a.clave = c.clave and a.referencia = c.referencia
     -- Lo avisado otro día no vuelve; lo avisado hoy se ve con ✓.
     where a.id is null or privado.dia_local(a.creado_en, zona) = hoy
  ), '[]'::jsonb);
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
                                                           'plan', 'Mensual', 'vence', 'el 10/12', 'dias', '7', 'debe', '$25.000', 'monto', '$25.000', 'entradas', '6 veces', 'meta', '8', 'link', 'https://g.page/r/tu-gimnasio/review')));
  end if;
  return jsonb_build_object('socio', (select trim(s.nombre || ' ' || s.apellido) from public.socios s where s.id = sid),
                            'situacion', null, 'de_la_lista', false,
                            'texto', privado.armar_mensaje(t, jsonb_build_object('clase', 'Spinning', 'dia', '10/11 a las 19:00', 'motivo', 'el profe está enfermo',
                                       'detalle', 'Cuota Mensual', 'fecha', '10/11', 'al_dia', 'Quedaste al día hasta el 10/12.', 'monto', '$25.000', 'entradas', '6 veces', 'meta', '8', 'link', 'https://g.page/r/tu-gimnasio/review')
                                     || privado.variables_socio(sid, now())));
end $$;

create or replace function public.guardar_link_resena(p_gimnasio_id uuid, p_link text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := nullif(trim(coalesce(p_link, '')), ''); n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if v is not null and (v !~ '^https://\S+$' or length(v) > 300) then
    raise exception 'El link tiene que empezar con https:// (en Google: tu perfil → Pedir reseñas → Copiar el vínculo).' using errcode = '22023';
  end if;
  update public.configuracion_gimnasio set link_resena = v where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar el link'; end if;
end $$;

-- Toca la pregunta si llegó a 10 entradas o pasó su primer mes, y no contestó en los últimos 90 días.
create or replace function privado.encuesta_de(s public.socios) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'pendiente', s.dado_de_baja_en is null
      and ((select count(distinct (i.momento at time zone (select g.zona_horaria from public.gimnasios g where g.id = s.gimnasio_id))::date) from public.ingresos i where i.socio_id = s.id and i.anulado_en is null and i.resultado <> 'rechazado') >= 10
           or (select min(su.inicio) from public.suscripciones su where su.socio_id = s.id) <= now() - interval '30 days')
      and not exists (select 1 from public.encuestas e where e.socio_id = s.id and e.creado_en > now() - interval '90 days'),
    'link_resena', (select c.link_resena from public.configuracion_gimnasio c where c.gimnasio_id = s.gimnasio_id),
    'ultima', (select jsonb_build_object('puntaje', e.puntaje, 'creado_en', e.creado_en) from public.encuestas e where e.socio_id = s.id order by e.creado_en desc limit 1))
$$;
revoke all on function privado.encuesta_de(public.socios) from public, anon, authenticated;

create or replace function public.encuesta_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.socios where id = p_socio_id;
  return privado.encuesta_de(s);
end $$;

create or replace function public.responder_encuesta(p_socio_id uuid, p_puntaje int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.socios;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if p_puntaje is null or p_puntaje < 0 or p_puntaje > 10 then raise exception 'Elegí un número del 0 al 10.' using errcode = '22023'; end if;
  select * into s from public.socios where id = p_socio_id;
  if exists (select 1 from public.encuestas e where e.socio_id = s.id and e.creado_en > now() - interval '90 days') then
    raise exception 'Ya contestaste hace poco: ¡gracias!' using errcode = '22023';
  end if;
  insert into public.encuestas (gimnasio_id, socio_id, puntaje) values (s.gimnasio_id, s.id, p_puntaje);
  return jsonb_build_object('promotor', p_puntaje >= 9, 'link_resena', (select c.link_resena from public.configuracion_gimnasio c where c.gimnasio_id = s.gimnasio_id));
end $$;

create or replace function public.encuestas_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return (
    with r as (
      select distinct on (e.socio_id) e.socio_id, e.puntaje, e.creado_en from public.encuestas e
       where e.gimnasio_id = p_gimnasio_id and e.creado_en > now() - interval '90 days' order by e.socio_id, e.creado_en desc
    )
    select jsonb_build_object(
      'link_resena', (select c.link_resena from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id),
      'respuestas', (select count(*) from r),
      'nps', (select case when count(*) = 0 then null else round(100.0 * (count(*) filter (where puntaje >= 9) - count(*) filter (where puntaje <= 6)) / count(*)) end from r),
      'promotores', coalesce((select jsonb_agg(jsonb_build_object('socio_id', s.id, 'nombre', trim(s.nombre || ' ' || s.apellido), 'telefono', s.telefono,
                                                                  'puntaje', r.puntaje, 'fecha', r.creado_en) order by r.creado_en desc)
                              from r join public.socios s on s.id = r.socio_id where r.puntaje >= 9), '[]'),
      'detractores', coalesce((select jsonb_agg(jsonb_build_object('socio_id', s.id, 'nombre', trim(s.nombre || ' ' || s.apellido), 'telefono', s.telefono,
                                                                   'puntaje', r.puntaje, 'fecha', r.creado_en) order by r.puntaje, r.creado_en desc)
                               from r join public.socios s on s.id = r.socio_id where r.puntaje <= 6), '[]'))
  );
end $$;

revoke all on function public.guardar_link_resena(uuid, text), public.encuesta_socio(uuid), public.responder_encuesta(uuid, int), public.encuestas_panel(uuid)
  from public, anon, authenticated;
grant execute on function public.guardar_link_resena(uuid, text), public.encuesta_socio(uuid), public.responder_encuesta(uuid, int), public.encuestas_panel(uuid)
  to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.encuestas'::regclass) then raise exception 'Verificación: encuestas sin RLS'; end if;
  if exists (select 1 from public.gimnasios g where not exists (select 1 from public.plantillas_mensaje p where p.gimnasio_id = g.id and p.clave = 'resena')) then
    raise exception 'Verificación: un gimnasio quedó sin la plantilla Reseña';
  end if;
end $$;
