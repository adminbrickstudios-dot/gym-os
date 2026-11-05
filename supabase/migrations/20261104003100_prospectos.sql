-- 0031 · Prospectos: "Probá una clase" desde la página (PAG-3).
-- La página tiene una sección nueva ("probar", se oculta y se ordena como
-- las otras) con un formulario corto: nombre, WhatsApp y qué le interesa.
-- Lo que deja la gente cae en Prospectos, donde dueño, encargado y recepción
-- lo siguen (nuevo → contactado → vino → se hizo socio / no le interesó),
-- con el WhatsApp armado (mensaje editable "Quiere probar") y "Hacerlo socio".
-- Contra el spam: el mismo celular no se duplica (actualiza el pedido) y cada
-- gimnasio recibe hasta 30 pedidos por hora desde la página.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.socios') is null or to_regclass('public.landing_secciones') is null then
    raise exception 'Guarda: faltan socios o la página';
  end if;
  if to_regprocedure('privado.telefono_normalizado(text, text)') is null then
    raise exception 'Guarda: falta privado.telefono_normalizado (0021)';
  end if;
  if to_regprocedure('privado.landing_completa(uuid)') is null or to_regprocedure('privado.texto_pagina(jsonb, text, int, int)') is null then
    raise exception 'Guarda: falta el editor de la página (0030)';
  end if;
  if to_regprocedure('privado.crear_plantillas(uuid)') is null then
    raise exception 'Guarda: faltan los mensajes (0025)';
  end if;
end $$;

-- ── Teléfonos: "00…" de 10 números es un celular, no un prefijo internacional ──
-- Antes "000 111 2222" quedaba "+01112222" (un número que no existe) sin avisar.
-- Ahora: 10 números siempre son un celular argentino; un número que empieza
-- con +0 se rechaza. Copia de 0021 con esos dos cambios.
create or replace function privado.telefono_normalizado(p_texto text, p_etiqueta text) returns text
language plpgsql immutable set search_path = '' as $$
declare d text;
begin
  d := regexp_replace(coalesce(p_texto, ''), '[\s\-().]', '', 'g');
  if d = '' then return null; end if;
  if d ~ '^\+' then d := '+' || regexp_replace(substr(d, 2), '\D', '', 'g');
  elsif d ~ '^[0-9]{10}$' then d := '+549' || d;
  elsif d ~ '^0[0-9]{10}$' then d := '+549' || substr(d, 2);
  elsif d ~ '^00' then d := '+' || substr(d, 3);
  elsif d ~ '^54' and length(d) >= 12 then d := '+' || d;
  end if;
  if d !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception '%: escribilo con característica, por ejemplo 11 1234 5678 o +54 9 11 1234 5678.', p_etiqueta using errcode = '22023';
  end if;
  return d;
end $$;
revoke all on function privado.telefono_normalizado(text, text) from public, anon, authenticated;

-- ── Tabla ───────────────────────────────────────────────────────────
create table if not exists public.prospectos (
  id             uuid primary key default gen_random_uuid(),
  gimnasio_id    uuid not null references public.gimnasios(id),
  nombre         text not null check (length(trim(nombre)) between 1 and 80),
  telefono       text not null check (telefono ~ '^\+[0-9]{8,15}$'),
  interes        text check (interes is null or length(interes) <= 200),
  origen         text not null default 'pagina' check (origen in ('pagina', 'recepcion', 'referido')),
  estado         text not null default 'nuevo' check (estado in ('nuevo', 'contactado', 'vino', 'socio', 'no')),
  nota           text check (nota is null or length(nota) <= 500),
  socio_id       uuid,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, telefono),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id)
);
create index if not exists prospectos_por_fecha on public.prospectos (gimnasio_id, creado_en desc);
-- Lo leen dueño, encargado y recepción; se escribe solo con las funciones de abajo.
select privado.politicas_estandar('public.prospectos', array['dueno', 'encargado', 'recepcion'], null);
-- Un visitante sin sesión no ve la tabla (ni vacía): solo deja su pedido con quiero_probar.
revoke all on table public.prospectos from anon;

-- ── La sección "Probá una clase" de la página ───────────────────────
alter table public.landing_secciones drop constraint if exists landing_secciones_tipo_check;
alter table public.landing_secciones add constraint landing_secciones_tipo_check
  check (tipo in ('sobre_nosotros', 'actividades', 'planes', 'horarios', 'galeria', 'equipo', 'preguntas', 'ubicacion', 'probar'));

create or replace function privado.crear_landing(p_gimnasio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.landing_gimnasio (gimnasio_id, titulo, bajada)
  select g.id, g.nombre, 'Entrená con nosotros.' from public.gimnasios g where g.id = p_gimnasio_id
  on conflict do nothing;
  insert into public.landing_secciones (gimnasio_id, tipo, titulo, orden) values
    (p_gimnasio_id, 'sobre_nosotros', 'Quiénes somos', 10),
    (p_gimnasio_id, 'actividades',    'Qué podés hacer', 20),
    (p_gimnasio_id, 'planes',         'Planes', 30),
    (p_gimnasio_id, 'horarios',       'Horarios', 40),
    (p_gimnasio_id, 'galeria',        'El gimnasio', 50),
    (p_gimnasio_id, 'equipo',         'Profes', 60),
    (p_gimnasio_id, 'preguntas',      'Preguntas frecuentes', 70),
    (p_gimnasio_id, 'ubicacion',      'Dónde estamos', 80),
    (p_gimnasio_id, 'probar',         'Probá una clase', 90)
  on conflict (gimnasio_id, tipo) do nothing;
end $$;

revoke all on function privado.crear_landing(uuid) from public, anon, authenticated;

-- Los gimnasios que ya existen también la tienen (al final, visible).
insert into public.landing_secciones (gimnasio_id, tipo, titulo, orden)
select g.id, 'probar', 'Probá una clase', 90 from public.gimnasios g
 where exists (select 1 from public.landing_gimnasio l where l.gimnasio_id = g.id)
on conflict (gimnasio_id, tipo) do nothing;

create or replace function public.guardar_pagina(p_gimnasio_id uuid, p_portada jsonb, p_secciones jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  foto text; s jsonb; i int := 0; n int; v_tipo text; v_nombre text; v_contenido jsonb; vistos text[] := '{}';
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_portada is null or jsonb_typeof(p_portada) <> 'object' or p_secciones is null or jsonb_typeof(p_secciones) <> 'array' then
    raise exception 'Datos inválidos';
  end if;

  -- Portada
  foto := privado.texto_pagina(p_portada -> 'foto_portada_path', 'Foto de portada', 0, 300);
  if foto is not null and not (foto = any (privado.fotos_galeria(p_gimnasio_id))) then
    raise exception 'Foto de portada: elegila entre las fotos del gimnasio (Configuración → Marca)';
  end if;
  if not (p_portada ? 'mostrar_precios') or jsonb_typeof(p_portada -> 'mostrar_precios') <> 'boolean' then
    raise exception 'Mostrar precios: elegí sí o no';
  end if;
  update public.landing_gimnasio set
    titulo = privado.texto_pagina(p_portada -> 'titulo', 'Título de la portada', 1, 80),
    bajada = privado.texto_pagina(p_portada -> 'bajada', 'Frase de la portada', 0, 240),
    boton_texto = privado.texto_pagina(p_portada -> 'boton_texto', 'Texto del botón', 1, 40),
    mensaje_whatsapp = privado.texto_pagina(p_portada -> 'mensaje_whatsapp', 'Mensaje de WhatsApp', 1, 300),
    foto_portada_path = foto,
    mostrar_precios = (p_portada ->> 'mostrar_precios')::boolean
  where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Este gimnasio no tiene página. Pedile a soporte BRIK que la cree.'; end if;

  -- Secciones, en el orden en que llegan
  for s in select x from jsonb_array_elements(p_secciones) x loop
    i := i + 1;
    v_tipo := s ->> 'tipo';
    if v_tipo is null or v_tipo = any (vistos) then raise exception 'Secciones: la % está repetida o no tiene tipo', i; end if;
    vistos := vistos || v_tipo;
    v_nombre := coalesce(privado.texto_pagina(s -> 'titulo', format('Sección %s: el título', i), 0, 60), '');
    if v_nombre = '' then raise exception 'Sección %: escribí un título (hasta 60 letras)', i; end if;
    if jsonb_typeof(s -> 'visible') is distinct from 'boolean' then raise exception 'Sección "%": elegí si se muestra', v_nombre; end if;
    v_contenido := case v_tipo
      when 'sobre_nosotros' then jsonb_strip_nulls(jsonb_build_object('texto',
        privado.texto_pagina(s -> 'contenido' -> 'texto', format('Sección "%s": el texto', v_nombre), 0, 1500)))
      when 'actividades' then jsonb_build_object('items', privado.lista_pagina(s -> 'contenido' -> 'items', format('Sección "%s"', v_nombre),
        '{"nombre": ["Actividad", 1, 40], "descripcion": ["Descripción de la actividad", 0, 160], "emoji": ["Emoji de la actividad", 0, 8]}'))
      when 'equipo' then jsonb_build_object('personas', privado.lista_pagina(s -> 'contenido' -> 'personas', format('Sección "%s"', v_nombre),
        '{"nombre": ["Nombre del profe", 1, 60], "rol": ["Especialidad del profe", 0, 60]}'))
      when 'preguntas' then jsonb_build_object('items', privado.lista_pagina(s -> 'contenido' -> 'items', format('Sección "%s"', v_nombre),
        '{"pregunta": ["Pregunta", 1, 160], "respuesta": ["Respuesta", 1, 800]}'))
      when 'probar' then jsonb_strip_nulls(jsonb_build_object('texto',
        privado.texto_pagina(s -> 'contenido' -> 'texto', format('Sección "%s": el texto', v_nombre), 0, 300)))
      else null   -- planes, horarios, galería, ubicación: el contenido sale de otras pantallas
    end;
    update public.landing_secciones x set
      titulo = v_nombre, visible = (s ->> 'visible')::boolean, orden = i * 10,
      contenido = coalesce(v_contenido, x.contenido)
    where x.gimnasio_id = p_gimnasio_id and x.tipo = v_tipo;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Sección "%": no existe en la página de este gimnasio', v_nombre; end if;
  end loop;

  return public.pagina_panel(p_gimnasio_id);
end $$;

revoke all on function public.guardar_pagina(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.guardar_pagina(uuid, jsonb, jsonb) to authenticated, service_role;

-- ── El mensaje "Quiere probar" ──────────────────────────────────────
alter table public.plantillas_mensaje drop constraint if exists plantillas_mensaje_clave_check;
alter table public.plantillas_mensaje add constraint plantillas_mensaje_clave_check
  check (clave in ('no_viene', 'por_vencer', 'vencido', 'se_fue', 'nuevo', 'bienvenida', 'cumpleanos', 'comprobante_rechazado', 'prospecto'));

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
     "original": "Hola {nombre}! Te escribimos de {gimnasio} 👋 Vimos que querés venir a probar. ¿Qué día y horario te queda cómodo?"}
  ]'::jsonb
$$;

revoke all on function privado.mensajes_catalogo() from public, anon, authenticated;
select privado.crear_plantillas(g.id) from public.gimnasios g;

-- ── Desde la página: "Quiero probar" (sin sesión) ──────────────────
create or replace function public.quiero_probar(p_host text, p_nombre text, p_telefono text, p_interes text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; tel text; nom text := trim(coalesce(p_nombre, '')); v_interes text := nullif(trim(coalesce(p_interes, '')), '');
begin
  select d.gimnasio_id into g from public.dominios_gimnasio d
    join public.landing_gimnasio l on l.gimnasio_id = d.gimnasio_id and l.publicada
    join public.landing_secciones s on s.gimnasio_id = d.gimnasio_id and s.tipo = 'probar' and s.visible
   where d.host = lower(p_host);
  if g is null then raise exception 'Este gimnasio no está recibiendo pedidos desde la página.'; end if;
  if length(nom) = 0 then raise exception 'Escribí tu nombre.'; end if;
  if length(nom) > 80 then raise exception 'El nombre es muy largo (hasta 80 letras).'; end if;
  if v_interes is not null and length(v_interes) > 200 then raise exception 'Lo que te interesa: hasta 200 letras.'; end if;
  begin
    tel := privado.telefono_normalizado(p_telefono, 'WhatsApp');
  exception when others then
    raise exception 'Revisá el WhatsApp: con característica, por ejemplo 387 555 1234.';
  end;
  if tel is null then raise exception 'Dejanos tu WhatsApp para escribirte.'; end if;
  -- El mismo celular no se duplica: se actualiza su pedido y vuelve a "nuevo" si ya se había cerrado sin éxito.
  if exists (select 1 from public.prospectos p where p.gimnasio_id = g and p.telefono = tel) then
    update public.prospectos p set nombre = nom, interes = coalesce(v_interes, p.interes), actualizado_en = now(),
      estado = case when p.estado = 'no' then 'nuevo' else p.estado end
     where p.gimnasio_id = g and p.telefono = tel;
    return jsonb_build_object('ok', true, 'repetido', true);
  end if;
  if (select count(*) from public.prospectos p where p.gimnasio_id = g and p.origen = 'pagina'
        and p.creado_en > now() - interval '1 hour') >= 30 then
    raise exception 'Recibimos muchos pedidos en este momento. Probá en un rato o escribinos por WhatsApp.';
  end if;
  insert into public.prospectos (gimnasio_id, nombre, telefono, interes, origen) values (g, nom, tel, v_interes, 'pagina');
  return jsonb_build_object('ok', true, 'repetido', false);
end $$;

-- ── Panel ───────────────────────────────────────────────────────────
create or replace function public.prospectos_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare plantilla text; gim text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.nombre into gim from public.gimnasios g where g.id = p_gimnasio_id;
  select coalesce(p.texto, (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = 'prospecto'))
    into plantilla from public.plantillas_mensaje p where p.gimnasio_id = p_gimnasio_id and p.clave = 'prospecto';
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'nombre', p.nombre, 'telefono', p.telefono, 'interes', p.interes, 'origen', p.origen, 'estado', p.estado,
      'nota', p.nota, 'socio_id', p.socio_id, 'creado_en', p.creado_en, 'actualizado_en', p.actualizado_en,
      'mensaje', privado.armar_mensaje(plantilla, jsonb_build_object('nombre', split_part(p.nombre, ' ', 1), 'gimnasio', gim)))
      order by (p.estado = 'nuevo') desc, p.creado_en desc), '[]')
    from public.prospectos p where p.gimnasio_id = p_gimnasio_id);
end $$;

create or replace function public.crear_prospecto(p_gimnasio_id uuid, p_nombre text, p_telefono text, p_interes text default null,
                                                  p_origen text default 'recepcion') returns uuid
language plpgsql security definer set search_path = '' as $$
declare tel text; v_id uuid;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if length(trim(coalesce(p_nombre, ''))) = 0 then raise exception 'Escribí el nombre.'; end if;
  if p_origen is null or p_origen not in ('recepcion', 'referido') then raise exception 'Origen inválido'; end if;
  tel := privado.telefono_normalizado(p_telefono, 'WhatsApp');
  if tel is null then raise exception 'WhatsApp: escribilo con característica, por ejemplo 387 555 1234.'; end if;
  if exists (select 1 from public.prospectos p where p.gimnasio_id = p_gimnasio_id and p.telefono = tel) then
    raise exception 'Ya hay un prospecto con ese WhatsApp.';
  end if;
  insert into public.prospectos (gimnasio_id, nombre, telefono, interes, origen)
  values (p_gimnasio_id, trim(p_nombre), tel, nullif(trim(coalesce(p_interes, '')), ''), p_origen) returning prospectos.id into v_id;
  return v_id;
end $$;

create or replace function public.actualizar_prospecto(p_gimnasio_id uuid, p_prospecto_id uuid, p_estado text, p_nota text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if p_estado is null or p_estado not in ('nuevo', 'contactado', 'vino', 'no') then
    raise exception 'Estado inválido (“se hizo socio” se marca al darlo de alta).';
  end if;
  if p_nota is not null and length(p_nota) > 500 then raise exception 'La nota: hasta 500 letras.'; end if;
  update public.prospectos p set estado = p_estado, nota = coalesce(nullif(trim(p_nota), ''), p.nota), actualizado_en = now()
   where p.gimnasio_id = p_gimnasio_id and p.id = p_prospecto_id and p.estado <> 'socio';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se encontró ese prospecto (o ya es socio).'; end if;
end $$;

-- Al dar de alta desde un prospecto: queda atado al socio y en "se hizo socio".
create or replace function public.prospecto_es_socio(p_gimnasio_id uuid, p_prospecto_id uuid, p_socio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if not exists (select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.id = p_socio_id) then
    raise exception 'Ese socio no es de este gimnasio.';
  end if;
  update public.prospectos p set estado = 'socio', socio_id = p_socio_id, actualizado_en = now()
   where p.gimnasio_id = p_gimnasio_id and p.id = p_prospecto_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se encontró ese prospecto.'; end if;
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.quiero_probar(text, text, text, text), public.prospectos_panel(uuid),
  public.crear_prospecto(uuid, text, text, text, text), public.actualizar_prospecto(uuid, uuid, text, text),
  public.prospecto_es_socio(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.quiero_probar(text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.prospectos_panel(uuid), public.crear_prospecto(uuid, text, text, text, text),
  public.actualizar_prospecto(uuid, uuid, text, text), public.prospecto_es_socio(uuid, uuid, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record; faltan int;
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relname = 'prospectos' and c.relrowsecurity) then
    raise exception 'Verificación: prospectos sin RLS';
  end if;
  if has_table_privilege('anon', 'public.prospectos', 'select') then
    raise exception 'Verificación: un visitante sin sesión puede leer prospectos';
  end if;
  if privado.telefono_normalizado('000 111 2222', 'x') <> '+5490001112222' or privado.telefono_normalizado('0054 9 387 555 1234', 'x') <> '+5493875551234'
     or privado.telefono_normalizado('011 1234-5678', 'x') <> '+5491112345678' then
    raise exception 'Verificación: los teléfonos no se normalizan como se espera';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'prospectos' and cmd <> 'SELECT') then
    raise exception 'Verificación: prospectos se puede escribir desde el cliente';
  end if;
  select count(*) into faltan from public.landing_gimnasio l
   where not exists (select 1 from public.landing_secciones s where s.gimnasio_id = l.gimnasio_id and s.tipo = 'probar');
  if faltan > 0 then raise exception 'Verificación: % páginas sin la sección Probá una clase', faltan; end if;
  select count(*) into faltan from public.gimnasios g
   where not exists (select 1 from public.plantillas_mensaje p where p.gimnasio_id = g.id and p.clave = 'prospecto');
  if faltan > 0 then raise exception 'Verificación: % gimnasios sin el mensaje Quiere probar', faltan; end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where s.nspname = 'public' and p.proname in ('quiero_probar', 'prospectos_panel', 'crear_prospecto', 'actualizar_prospecto', 'prospecto_es_socio', 'guardar_pagina')
               or s.nspname = 'privado' and p.proname in ('crear_landing', 'mensajes_catalogo') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if r.proname <> 'quiero_probar' and has_function_privilege('anon', r.oid, 'execute') then
      raise exception 'Verificación: anon puede ejecutar %', r.proname;
    end if;
  end loop;
end $$;
