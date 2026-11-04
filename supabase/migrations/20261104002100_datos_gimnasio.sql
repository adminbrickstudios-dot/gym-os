-- ═══════════════════════════════════════════════════════════════════
-- 0021 · Pestaña "Gimnasio" de Configuración (CFG-1).
--
-- El dueño carga los datos de su gimnasio que ve la gente: nombre,
-- WhatsApp, Instagram, mail de contacto y, de cada sede, nombre,
-- dirección, teléfono y link del mapa. Hasta acá solo se podían cargar
-- desde la base.
--
--   datos_gimnasio_panel(gimnasio)            dueño y encargado (lee)
--   guardar_datos_gimnasio(gimnasio, datos)   solo el dueño
--
-- Todo en una transacción: si un dato no cierra no se guarda nada, y el
-- error dice qué dato y cómo escribirlo. El teléfono se acepta como lo
-- escribe la gente ("11 1234-5678", "+54 9 11...") y se guarda en el
-- formato de la base (+5491112345678).
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.landing_gimnasio') is null then raise exception 'Guarda: falta la migración 0008'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid,text[])') is null then raise exception 'Guarda: falta la migración 0013'; end if;
  if to_regprocedure('public.guardar_configuracion(uuid,jsonb)') is null then raise exception 'Guarda: falta la migración 0020'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sedes' and column_name = 'telefono') then
    raise exception 'Guarda: sedes sin teléfono (migración 0008)';
  end if;
end $$;

-- Un teléfono argentino como lo escribe la gente → +54..., o error con ejemplo.
-- Null si viene vacío.
create or replace function privado.telefono_normalizado(p_texto text, p_etiqueta text) returns text
language plpgsql immutable set search_path = '' as $$
declare d text;
begin
  d := regexp_replace(coalesce(p_texto, ''), '[\s\-().]', '', 'g');
  if d = '' then return null; end if;
  if d ~ '^\+' then d := '+' || regexp_replace(substr(d, 2), '\D', '', 'g');
  elsif d ~ '^00' then d := '+' || substr(d, 3);
  elsif d ~ '^54' and length(d) >= 12 then d := '+' || d;
  elsif d ~ '^0[0-9]{10}$' then d := '+549' || substr(d, 2);
  elsif d ~ '^[0-9]{10}$' then d := '+549' || d;
  end if;
  if d !~ '^\+[0-9]{8,15}$' then
    raise exception '%: escribilo con característica, por ejemplo 11 1234 5678 o +54 9 11 1234 5678.', p_etiqueta using errcode = '22023';
  end if;
  return d;
end $$;

-- Lo que muestra la pestaña Gimnasio y la pestaña Dirección.
create or replace function public.datos_gimnasio_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g public.gimnasios; l public.landing_gimnasio;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select * into g from public.gimnasios where id = p_gimnasio_id;
  select * into l from public.landing_gimnasio where gimnasio_id = p_gimnasio_id;
  return jsonb_build_object(
    'nombre', g.nombre, 'slug', g.slug, 'zona_horaria', g.zona_horaria,
    'whatsapp', l.whatsapp, 'instagram', l.instagram, 'email_contacto', l.email_contacto,
    'publicada', coalesce(l.publicada, false),
    'sedes', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre, 'direccion', s.direccion,
                                                           'telefono', s.telefono, 'mapa_url', s.mapa_url,
                                                           'es_principal', s.es_principal)
                                        order by s.es_principal desc, s.creado_en), '[]')
                from public.sedes s where s.gimnasio_id = p_gimnasio_id and s.activa),
    'dominios', (select coalesce(jsonb_agg(jsonb_build_object('host', d.host, 'tipo', d.tipo,
                                                              'verificado', d.verificado_en is not null)
                                           order by (d.tipo = 'propio') desc, d.creado_en), '[]')
                   from public.dominios_gimnasio d where d.gimnasio_id = p_gimnasio_id));
end $$;

create or replace function public.guardar_datos_gimnasio(p_gimnasio_id uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  desconocidos text[];
  v_nombre text; v_whatsapp text; v_instagram text; v_email text;
  s jsonb; v_sede_nombre text; v_dir text; v_tel text; v_mapa text; n int; i int := 0;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  select array_agg(k) into desconocidos from jsonb_object_keys(p_datos) k
   where k not in ('nombre', 'whatsapp', 'instagram', 'email_contacto', 'sedes');
  if desconocidos is not null then raise exception 'Campos que no se pueden cambiar acá: %', array_to_string(desconocidos, ', '); end if;

  -- Validar todo antes de escribir nada.
  if p_datos ? 'nombre' then
    v_nombre := trim(coalesce(p_datos ->> 'nombre', ''));
    if v_nombre = '' then raise exception 'El nombre del gimnasio es obligatorio.' using errcode = '22023'; end if;
    if length(v_nombre) > 60 then raise exception 'El nombre del gimnasio puede tener hasta 60 letras.' using errcode = '22023'; end if;
  end if;
  if p_datos ? 'whatsapp' then v_whatsapp := privado.telefono_normalizado(p_datos ->> 'whatsapp', 'WhatsApp'); end if;
  if p_datos ? 'instagram' then
    v_instagram := nullif(regexp_replace(regexp_replace(trim(coalesce(p_datos ->> 'instagram', '')),
                     '^(https?://)?(www\.)?instagram\.com/', '', 'i'), '^@|/.*$', '', 'g'), '');
    if v_instagram is not null and v_instagram !~ '^[A-Za-z0-9._]{1,30}$' then
      raise exception 'Instagram: poné solo el usuario, por ejemplo @tugimnasio.' using errcode = '22023';
    end if;
  end if;
  if p_datos ? 'email_contacto' then
    v_email := nullif(lower(trim(coalesce(p_datos ->> 'email_contacto', ''))), '');
    if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'Mail de contacto: no parece un mail (falta la @ o el dominio).' using errcode = '22023';
    end if;
  end if;
  if p_datos ? 'sedes' then
    if jsonb_typeof(p_datos -> 'sedes') is distinct from 'array' then raise exception 'Datos inválidos'; end if;
    for s in select * from jsonb_array_elements(p_datos -> 'sedes') loop
      i := i + 1;
      if jsonb_typeof(s -> 'id') is distinct from 'string' then raise exception 'Datos inválidos'; end if;
      if not exists (select 1 from public.sedes x where x.id = (s ->> 'id')::uuid and x.gimnasio_id = p_gimnasio_id and x.activa) then
        raise exception 'Esa sede no es de este gimnasio' using errcode = '42501';
      end if;
      v_sede_nombre := trim(coalesce(s ->> 'nombre', ''));
      if v_sede_nombre = '' then raise exception 'Sede %: el nombre es obligatorio.', i using errcode = '22023'; end if;
      if length(v_sede_nombre) > 60 then raise exception 'Sede "%": el nombre puede tener hasta 60 letras.', v_sede_nombre using errcode = '22023'; end if;
      if length(trim(coalesce(s ->> 'direccion', ''))) > 160 then
        raise exception 'Sede "%": la dirección puede tener hasta 160 letras.', v_sede_nombre using errcode = '22023';
      end if;
      perform privado.telefono_normalizado(s ->> 'telefono', format('Teléfono de %s', v_sede_nombre));
      v_mapa := nullif(trim(coalesce(s ->> 'mapa_url', '')), '');
      if v_mapa is not null and v_mapa !~ '^https://[^\s]+$' then
        raise exception 'Sede "%": el link del mapa tiene que empezar con https:// (copialo de Google Maps → Compartir).', v_sede_nombre using errcode = '22023';
      end if;
    end loop;
  end if;

  -- Escribir.
  if v_nombre is not null then
    update public.gimnasios set nombre = v_nombre where id = p_gimnasio_id;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo guardar el nombre'; end if;
  end if;
  if p_datos ?| array['whatsapp', 'instagram', 'email_contacto'] then
    insert into public.landing_gimnasio (gimnasio_id, titulo)
    select g.id, g.nombre from public.gimnasios g where g.id = p_gimnasio_id
    on conflict (gimnasio_id) do nothing;
    update public.landing_gimnasio l set
      whatsapp = case when p_datos ? 'whatsapp' then v_whatsapp else l.whatsapp end,
      instagram = case when p_datos ? 'instagram' then v_instagram else l.instagram end,
      email_contacto = case when p_datos ? 'email_contacto' then v_email else l.email_contacto end
     where l.gimnasio_id = p_gimnasio_id;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudieron guardar los datos de contacto'; end if;
  end if;
  if p_datos ? 'sedes' then
    for s in select * from jsonb_array_elements(p_datos -> 'sedes') loop
      v_sede_nombre := trim(s ->> 'nombre');
      update public.sedes x set
        nombre = v_sede_nombre,
        direccion = nullif(trim(coalesce(s ->> 'direccion', '')), ''),
        telefono = privado.telefono_normalizado(s ->> 'telefono', format('Teléfono de %s', v_sede_nombre)),
        mapa_url = nullif(trim(coalesce(s ->> 'mapa_url', '')), '')
       where x.id = (s ->> 'id')::uuid and x.gimnasio_id = p_gimnasio_id;
      get diagnostics n = row_count;
      if n <> 1 then raise exception 'No se pudo guardar la sede %', v_sede_nombre; end if;
    end loop;
  end if;
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function privado.telefono_normalizado(text, text) from public, anon, authenticated;
revoke all on function public.datos_gimnasio_panel(uuid), public.guardar_datos_gimnasio(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.datos_gimnasio_panel(uuid), public.guardar_datos_gimnasio(uuid, jsonb) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'privado' and p.proname = 'telefono_normalizado')
               or (s.nspname = 'public' and p.proname in ('datos_gimnasio_panel', 'guardar_datos_gimnasio')) loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
  if privado.telefono_normalizado('11 1234-5678', 'x') <> '+5491112345678'
     or privado.telefono_normalizado('+54 9 000 111-2222', 'x') <> '+549000111' || '2222'
     or privado.telefono_normalizado('011 1234 5678', 'x') <> '+5491112345678'
     or privado.telefono_normalizado('', 'x') is not null then
    raise exception 'Verificación: telefono_normalizado no normaliza bien';
  end if;
  begin
    perform privado.telefono_normalizado('123', 'x');
    raise exception 'Verificación: telefono_normalizado aceptó 123';
  exception when invalid_parameter_value then null;
  end;
end $$;
