-- Carril B · F9.1 (EDIT-S07): plantillas globales de textos, en capas.
--   valor del gimnasio  →  plantilla del TIPO de gimnasio  →  plantilla de la PLATAFORMA  →  valor de fábrica
-- La plataforma y cada tipo se editan en /admin/plantillas. Al cambiar una plantilla se actualizan los gimnasios que NO editaron ese texto
-- (el valor que tienen es igual al que les daba la plantilla anterior, o está vacío). "Restaurar por defecto" vuelve un texto a lo que dice su plantilla.
-- El texto del gimnasio sigue guardándose donde siempre (landing_gimnasio): el dueño lo edita como siempre y lo que escribe manda.
-- Hoy cubre los textos de la web (botón, mensaje de WhatsApp y bajada); el registro privado.textos_plantilla() se amplía con una fila por texto nuevo.

do $$
begin
  if to_regprocedure('privado.exigir_brik(text[])') is null then raise exception 'Guarda: falta privado.exigir_brik'; end if;
  if to_regclass('public.landing_gimnasio') is null then raise exception 'Guarda: falta landing_gimnasio'; end if;
end $$;

-- ── El tipo de cada gimnasio (sale de la plantilla con la que se creó) ──
alter table public.gimnasios add column if not exists tipo_plantilla text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gimnasios_tipo_plantilla_valido') then
    alter table public.gimnasios add constraint gimnasios_tipo_plantilla_valido
      check (tipo_plantilla is null or tipo_plantilla in ('musculacion', 'grande', 'box', 'yoga', 'artes', 'natacion', 'personal', '24h'));
  end if;
end $$;

-- ── Las plantillas editadas (la fábrica vive en el registro de abajo) ──
create table if not exists public.plantillas_texto (
  id              uuid primary key default gen_random_uuid(),
  clave           text not null check (length(clave) between 3 and 80),
  tipo            text,                                  -- null = plantilla de la plataforma
  valor           text not null check (length(btrim(valor)) between 1 and 400),
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references auth.users(id),
  check (tipo is null or tipo in ('musculacion', 'grande', 'box', 'yoga', 'artes', 'natacion', 'personal', '24h'))
);
create unique index if not exists plantillas_texto_unica on public.plantillas_texto (clave, coalesce(tipo, ''));
alter table public.plantillas_texto enable row level security;
revoke all on table public.plantillas_texto from anon, authenticated;

-- ── El registro: qué textos se pueden poner en plantilla, de fábrica y dónde se guardan ──
create or replace function privado.textos_plantilla() returns jsonb
language sql immutable set search_path = '' as $$
  select '[
    {"clave": "landing.boton_texto", "etiqueta": "Botón principal de la web", "grupo": "Web", "max": 40,
     "fabrica": "Quiero empezar", "tabla": "landing_gimnasio", "columna": "boton_texto"},
    {"clave": "landing.mensaje_whatsapp", "etiqueta": "Mensaje de WhatsApp de la web", "grupo": "Web", "max": 300,
     "fabrica": "Hola! Quiero info para empezar a entrenar.", "tabla": "landing_gimnasio", "columna": "mensaje_whatsapp"},
    {"clave": "landing.bajada", "etiqueta": "Bajada de la portada", "grupo": "Web", "max": 240,
     "fabrica": "Entrená con nosotros. Planes, horarios y cómo llegar, todo acá.", "creacion": "Entrená con nosotros.", "tabla": "landing_gimnasio", "columna": "bajada"}
  ]'::jsonb
$$;
revoke all on function privado.textos_plantilla() from public;

create or replace function privado.texto_registro(p_clave text) returns jsonb
language sql stable set search_path = '' as $$
  select x from jsonb_array_elements(privado.textos_plantilla()) x where x ->> 'clave' = p_clave
$$;
revoke all on function privado.texto_registro(text) from public;

-- El valor que le toca a un gimnasio por sus plantillas (no mira lo que el dueño editó): tipo → plataforma → fábrica.
create or replace function privado.texto_de_plantilla(p_clave text, p_tipo text) returns text
language sql stable set search_path = '' as $$
  select coalesce(
    (select valor from public.plantillas_texto where clave = p_clave and tipo = p_tipo and p_tipo is not null),
    (select valor from public.plantillas_texto where clave = p_clave and tipo is null),
    privado.texto_registro(p_clave) ->> 'fabrica')
$$;
revoke all on function privado.texto_de_plantilla(text, text) from public;

-- Lo que tiene hoy el gimnasio en ese texto (null si todavía no tiene fila de web).
create or replace function privado.texto_actual(p_gimnasio_id uuid, p_clave text) returns text
language plpgsql stable set search_path = '' as $$
declare r jsonb := privado.texto_registro(p_clave); v text;
begin
  execute format('select %I::text from public.%I where gimnasio_id = $1', r ->> 'columna', r ->> 'tabla') into v using p_gimnasio_id;
  return v;
end $$;
revoke all on function privado.texto_actual(uuid, text) from public;

-- Pone en cada gimnasio que NO lo editó el valor nuevo de su plantilla. "No lo editó" = tiene lo mismo que le daba la plantilla anterior (o está vacío).
-- p_antes: lo que dice cada gimnasio por su plantilla ANTES del cambio (gimnasio → valor).
create or replace function privado.propagar_plantilla(p_clave text, p_antes jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare r jsonb := privado.texto_registro(p_clave); g record; nuevo text; actual text; n int := 0; k int;
begin
  for g in select id, tipo_plantilla from public.gimnasios where p_antes ? id::text loop
    nuevo := privado.texto_de_plantilla(p_clave, g.tipo_plantilla);
    actual := privado.texto_actual(g.id, p_clave);
    if (actual is null or actual = p_antes ->> g.id::text or actual = r ->> 'creacion') and nuevo is distinct from actual then
      execute format('update public.%I set %I = $1 where gimnasio_id = $2', r ->> 'tabla', r ->> 'columna') using nuevo, g.id;
      get diagnostics k = row_count; n := n + k;
    end if;
  end loop;
  return n;
end $$;
revoke all on function privado.propagar_plantilla(text, jsonb) from public, anon, authenticated;

create or replace function privado.antes_de_cambiar(p_clave text, p_tipo text) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_object_agg(g.id::text, privado.texto_de_plantilla(p_clave, g.tipo_plantilla)), '{}'::jsonb)
    from public.gimnasios g where g.baja_en is null and (p_tipo is null or g.tipo_plantilla = p_tipo)
$$;
revoke all on function privado.antes_de_cambiar(text, text) from public;

-- ── Lo que ve y hace el super admin ─────────────────────────────────
create or replace function public.admin_plantillas_texto() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  return jsonb_build_object(
    'tipos', jsonb_build_array('musculacion', 'grande', 'box', 'yoga', 'artes', 'natacion', 'personal', '24h'),
    'textos', coalesce((select jsonb_agg(jsonb_build_object(
        'clave', x ->> 'clave', 'etiqueta', x ->> 'etiqueta', 'grupo', x ->> 'grupo', 'max', (x ->> 'max')::int, 'fabrica', x ->> 'fabrica',
        'plataforma', (select p.valor from public.plantillas_texto p where p.clave = x ->> 'clave' and p.tipo is null),
        'por_tipo', coalesce((select jsonb_object_agg(p.tipo, p.valor) from public.plantillas_texto p where p.clave = x ->> 'clave' and p.tipo is not null), '{}'::jsonb),
        'gimnasios_por_tipo', coalesce((select jsonb_object_agg(coalesce(g.tipo_plantilla, 'sin_tipo'), g.n) from (
            select tipo_plantilla, count(*)::int n from public.gimnasios where baja_en is null and not es_demo group by tipo_plantilla) g), '{}'::jsonb)))
      from jsonb_array_elements(privado.textos_plantilla()) x), '[]'::jsonb));
end $$;

-- Guarda la plantilla de la plataforma (p_tipo null) o de un tipo. Devuelve cuántos gimnasios se actualizaron.
create or replace function public.admin_guardar_plantilla_texto(p_clave text, p_tipo text, p_valor text) returns int
language plpgsql security definer set search_path = '' as $$
declare r jsonb := privado.texto_registro(p_clave); v text := btrim(coalesce(p_valor, '')); antes jsonb; n int;
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  if r is null then raise exception 'Ese texto no tiene plantilla' using errcode = '22023'; end if;
  if length(v) < 1 or length(v) > (r ->> 'max')::int then raise exception 'El texto: de 1 a % letras', r ->> 'max' using errcode = '22023'; end if;
  if p_tipo is not null and p_tipo not in ('musculacion', 'grande', 'box', 'yoga', 'artes', 'natacion', 'personal', '24h') then raise exception 'Tipo de gimnasio desconocido' using errcode = '22023'; end if;
  antes := privado.antes_de_cambiar(p_clave, p_tipo);
  insert into public.plantillas_texto (clave, tipo, valor, actualizado_por) values (p_clave, p_tipo, v, auth.uid())
  on conflict (clave, coalesce(tipo, '')) do update set valor = excluded.valor, actualizado_en = now(), actualizado_por = auth.uid();
  n := privado.propagar_plantilla(p_clave, antes);
  perform privado.registrar_brik('guardar_plantilla_texto', null, jsonb_build_object('clave', p_clave, 'tipo', p_tipo, 'gimnasios', n));
  return n;
end $$;

-- Restaurar por defecto la plantilla (borra la edición: vuelve a la de la plataforma o a la de fábrica) y actualiza a los que no editaron.
create or replace function public.admin_restaurar_plantilla_texto(p_clave text, p_tipo text) returns int
language plpgsql security definer set search_path = '' as $$
declare antes jsonb; n int; b int;
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  if privado.texto_registro(p_clave) is null then raise exception 'Ese texto no tiene plantilla' using errcode = '22023'; end if;
  antes := privado.antes_de_cambiar(p_clave, p_tipo);
  delete from public.plantillas_texto where clave = p_clave and tipo is not distinct from p_tipo;
  get diagnostics b = row_count;
  if b <> 1 then raise exception 'Esa plantilla ya está por defecto' using errcode = '22023'; end if;
  n := privado.propagar_plantilla(p_clave, antes);
  perform privado.registrar_brik('restaurar_plantilla_texto', null, jsonb_build_object('clave', p_clave, 'tipo', p_tipo, 'gimnasios', n));
  return n;
end $$;

-- "Restaurar por defecto" de UN gimnasio: ese texto vuelve a lo que dice su plantilla (se pierde lo que había escrito el dueño).
create or replace function public.admin_restaurar_texto_gimnasio(p_gimnasio_id uuid, p_clave text) returns text
language plpgsql security definer set search_path = '' as $$
declare r jsonb := privado.texto_registro(p_clave); g public.gimnasios; nuevo text; n int;
begin
  perform privado.exigir_brik(array['principal', 'soporte']);
  if r is null then raise exception 'Ese texto no tiene plantilla' using errcode = '22023'; end if;
  select * into g from public.gimnasios where id = p_gimnasio_id;
  if not found then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  nuevo := privado.texto_de_plantilla(p_clave, g.tipo_plantilla);
  execute format('update public.%I set %I = $1 where gimnasio_id = $2', r ->> 'tabla', r ->> 'columna') using nuevo, p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese gimnasio todavía no tiene su web' using errcode = 'P0002'; end if;
  perform privado.registrar_brik('restaurar_texto_gimnasio', p_gimnasio_id, jsonb_build_object('clave', p_clave));
  return nuevo;
end $$;

-- El tipo del gimnasio (para saber qué plantilla de tipo le toca) y los textos de un gimnasio nuevo.
create or replace function public.admin_guardar_tipo_gimnasio(p_gimnasio_id uuid, p_tipo text) returns void
language plpgsql security definer set search_path = '' as $$
declare n int; x jsonb;
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas']);
  update public.gimnasios set tipo_plantilla = nullif(btrim(p_tipo), '') where id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  -- Un gimnasio recién creado con valores de fábrica toma los de su plantilla (si ya escribió otra cosa, no se toca).
  for x in select e from jsonb_array_elements(privado.textos_plantilla()) e loop
    perform 1 from public.landing_gimnasio where gimnasio_id = p_gimnasio_id;
    if found and (privado.texto_actual(p_gimnasio_id, x ->> 'clave') is null or privado.texto_actual(p_gimnasio_id, x ->> 'clave') in (x ->> 'fabrica', coalesce(x ->> 'creacion', x ->> 'fabrica'))) then
      execute format('update public.%I set %I = $1 where gimnasio_id = $2', x ->> 'tabla', x ->> 'columna')
        using privado.texto_de_plantilla(x ->> 'clave', nullif(btrim(p_tipo), '')), p_gimnasio_id;
    end if;
  end loop;
end $$;

revoke execute on function public.admin_plantillas_texto(), public.admin_guardar_plantilla_texto(text, text, text), public.admin_restaurar_plantilla_texto(text, text),
  public.admin_restaurar_texto_gimnasio(uuid, text), public.admin_guardar_tipo_gimnasio(uuid, text) from public, anon;
grant execute on function public.admin_plantillas_texto(), public.admin_guardar_plantilla_texto(text, text, text), public.admin_restaurar_plantilla_texto(text, text),
  public.admin_restaurar_texto_gimnasio(uuid, text), public.admin_guardar_tipo_gimnasio(uuid, text) to authenticated;

do $$
declare f text;
begin
  foreach f in array array['admin_plantillas_texto()', 'admin_guardar_plantilla_texto(text,text,text)', 'admin_restaurar_plantilla_texto(text,text)',
                           'admin_restaurar_texto_gimnasio(uuid,text)', 'admin_guardar_tipo_gimnasio(uuid,text)'] loop
    if to_regprocedure('public.' || f) is null then raise exception 'Falta public.%', f; end if;
  end loop;
  if not (select relrowsecurity from pg_class where oid = 'public.plantillas_texto'::regclass) then raise exception 'plantillas_texto sin RLS'; end if;
end $$;
