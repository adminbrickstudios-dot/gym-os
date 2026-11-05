-- 0032 · Hacete socio online (REG-1).
-- Desde la página: elige plan, deja sus datos, acepta el reglamento del
-- gimnasio (se guarda la versión y cuándo) y elige cómo paga: transferencia
-- (ve alias y CBU; manda el comprobante desde la app, que se vincula con su
-- celular) o en el mostrador. Queda como socio con el plan asignado (si es
-- membresía; un pase o un pack se cobra como siempre) y sin
-- cobertura: la entrada lo muestra "sin pagar" hasta que se cobra o se
-- aprueba el comprobante, con la misma cuenta de siempre (estado_acceso).
-- Ningún pago se crea acá: la plata entra como siempre (Vender o Transferencias).
-- El gimnasio lo ve en Prospectos → "Se hicieron socios" (y en Socios).
-- Las altas online arrancan apagadas y no se prenden sin reglamento.
-- Menores de 18: el alta la hace un adulto en el gimnasio (D10).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.prospectos') is null then raise exception 'Guarda: falta la migración 0031 (prospectos)'; end if;
  if to_regprocedure('privado.asignar_plan(uuid, uuid, timestamptz, uuid)') is null then
    raise exception 'Guarda: falta privado.asignar_plan';
  end if;
  if to_regprocedure('privado.landing_completa(uuid)') is null then raise exception 'Guarda: falta la migración 0030'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'socios' and column_name = 'origen') then
    raise exception 'Guarda: falta socios.origen';
  end if;
end $$;

-- ── Datos ───────────────────────────────────────────────────────────
alter table public.configuracion_gimnasio add column if not exists altas_online boolean;
update public.configuracion_gimnasio set altas_online = false where altas_online is null;
alter table public.configuracion_gimnasio alter column altas_online set default false;
alter table public.configuracion_gimnasio alter column altas_online set not null;

-- El reglamento: cada cambio es una versión nueva (lo aceptado nunca cambia).
create table if not exists public.reglamentos (
  id          uuid primary key default gen_random_uuid(),
  gimnasio_id uuid not null references public.gimnasios(id),
  version     int not null check (version >= 1),
  texto       text not null check (length(trim(texto)) between 20 and 8000),
  creado_en   timestamptz not null default now(),
  creado_por  uuid references auth.users(id),
  unique (gimnasio_id, id),
  unique (gimnasio_id, version)
);
select privado.politicas_estandar('public.reglamentos', array['dueno', 'encargado', 'recepcion'], null);
revoke all on table public.reglamentos from anon;

create table if not exists public.aceptaciones_reglamento (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  socio_id     uuid not null,
  reglamento_id uuid not null,
  aceptado_en  timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, reglamento_id) references public.reglamentos (gimnasio_id, id)
);
select privado.politicas_estandar('public.aceptaciones_reglamento', array['dueno', 'encargado', 'recepcion'], null);
revoke all on table public.aceptaciones_reglamento from anon;

-- ── La página sabe si hay altas online y el id de cada plan ────────
create or replace function privado.landing_completa(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  g public.gimnasios; c public.configuracion_gimnasio; l public.landing_gimnasio;
  marca jsonb; secciones jsonb; planes jsonb; sedes jsonb;
begin
  select gi.* into g from public.gimnasios gi where gi.id = p_gimnasio_id;
  if not found then return null; end if;
  select * into c from public.configuracion_gimnasio where gimnasio_id = g.id;
  select * into l from public.landing_gimnasio where gimnasio_id = g.id;

  marca := jsonb_build_object('nombre', g.nombre, 'slug', g.slug, 'logo_path', c.logo_path,
                              'favicon_path', c.favicon_path, 'color_acento', c.color_acento, 'color_fondo', c.color_fondo);
  if l.gimnasio_id is null then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object('tipo', s.tipo, 'titulo', s.titulo, 'contenido', s.contenido) order by s.orden, s.tipo), '[]')
    into secciones from public.landing_secciones s where s.gimnasio_id = g.id and s.visible;

  if l.mostrar_precios then
    select coalesce(jsonb_agg(x.plan order by x.orden, x.nombre), '[]') into planes from (
      select p.orden, p.nombre, jsonb_build_object(
               'id', p.id, 'nombre', p.nombre, 'tipo', p.tipo, 'descripcion', p.descripcion,
               'duracion_meses', p.duracion_meses, 'cantidad_clases', p.cantidad_clases,
               'hora_desde', to_char(p.hora_desde, 'HH24:MI'), 'hora_hasta', to_char(p.hora_hasta, 'HH24:MI'),
               'max_ingresos_semana', p.max_ingresos_semana,
               'precio', privado.precio_para(p.id, now(), null, null, false),
               'variantes', (
                 select coalesce(jsonb_agg(jsonb_build_object('monto', pp.monto, 'medio_pago', pp.medio_pago,
                                                              'pago_hasta_dia', pp.pago_hasta_dia) order by pp.monto), '[]')
                   from public.precios_plan pp
                  where pp.plan_id = p.id and pp.sede_id is null
                    and (pp.medio_pago is not null or pp.pago_hasta_dia is not null)
                    and pp.vigente_desde = (select max(q.vigente_desde) from public.precios_plan q
                                             where q.plan_id = p.id and q.sede_id is null and q.vigente_desde <= now()))
             ) as plan
        from public.planes p
       where p.gimnasio_id = g.id and p.activo and p.visible_en_landing
         and privado.precio_para(p.id, now(), null, null, false) is not null
    ) x;
  else
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'tipo', p.tipo, 'descripcion', p.descripcion) order by p.orden, p.nombre), '[]')
      into planes from public.planes p where p.gimnasio_id = g.id and p.activo and p.visible_en_landing;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('nombre', s.nombre, 'direccion', s.direccion, 'mapa_url', s.mapa_url,
                                               'telefono', s.telefono) order by s.es_principal desc, s.nombre), '[]')
    into sedes from public.sedes s where s.gimnasio_id = g.id and s.activa;

  return jsonb_build_object(
    'publicada', l.publicada,
    'altas_online', coalesce(c.altas_online, false),
    'marca', marca,
    'portada', jsonb_build_object('titulo', l.titulo, 'bajada', l.bajada, 'foto_path', l.foto_portada_path,
                                  'boton_texto', l.boton_texto),
    'contacto', jsonb_build_object('whatsapp', l.whatsapp, 'mensaje_whatsapp', l.mensaje_whatsapp,
                                   'instagram', l.instagram, 'email', l.email_contacto),
    'mostrar_precios', l.mostrar_precios,
    'secciones', secciones,
    'planes', planes,
    'sedes', sedes
  );
end $$;

revoke all on function privado.landing_completa(uuid) from public, anon, authenticated;

create or replace function privado.etiqueta_campo(p_campo text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_campo like 'mensaje.%' then 'Mensaje “' || coalesce((select x ->> 'titulo' from jsonb_array_elements(privado.mensajes_catalogo()) x
                                                              where x ->> 'clave' = substr(p_campo, 9)), substr(p_campo, 9)) || '”'
    -- "Sede principal: dirección" (no "Sede Sede principal"); "Sede Centro: dirección".
    when p_campo like 'sede.%' then case when split_part(p_campo, '.', 2) ilike 'sede%' then '' else 'Sede ' end
      || split_part(p_campo, '.', 2) || ': ' || case split_part(p_campo, '.', 3)
      when 'nombre' then 'nombre' when 'direccion' then 'dirección' when 'telefono' then 'teléfono' when 'mapa_url' then 'link del mapa'
      else split_part(p_campo, '.', 3) end
    else coalesce(jsonb_build_object(
      'nombre', 'Nombre del gimnasio', 'color_acento', 'Color principal', 'color_fondo', 'Color de fondo', 'logo_path', 'Logo',
      'favicon_path', 'Ícono de la pestaña', 'cobra_membresia', 'Cobra membresía', 'cobra_pase', 'Cobra pase diario',
      'cobra_pack', 'Cobra packs de clases', 'modo_clases', 'Clases', 'accesos_activos', 'Formas de entrada',
      'tolerancia_dias', 'Días de gracia al vencer', 'dias_aviso', 'Avisar que vence (días antes)',
      'reingreso_mismo_dia_consume', 'Volver a entrar el mismo día gasta otra entrada', 'secciones_apagadas', 'Secciones apagadas',
      'alias_transferencia', 'Alias', 'cbu', 'CBU / CVU', 'titular_cuenta', 'Titular de la cuenta', 'banco_transferencia', 'Banco o billetera',
      'medios_aceptados', 'Medios de pago', 'descuento_max_recepcion', 'Descuento máximo de la recepción (%)',
      'retencion_dias_ausencia', '“No viene” después de (días)', 'retencion_dias_nuevo', 'Socio nuevo durante (días)',
      'retencion_dias_vencido', 'Vencido pasa a “se fue” después de (días)', 'retencion_dias_se_fue', 'Los que se fueron se muestran durante (días)',
      'reserva_dias_anticipacion', 'Se reserva con hasta (días)', 'cancelacion_horas_limite', 'Cancelar hasta (horas antes)',
      'pagina.publicada', 'Página publicada', 'pagina.whatsapp', 'WhatsApp', 'pagina.instagram', 'Instagram',
      'pagina.email_contacto', 'Mail de contacto', 'altas_online', 'Altas online desde la página') ->> p_campo, p_campo)
  end
$$;

revoke all on function privado.etiqueta_campo(text) from public, anon, authenticated;

-- Transferencia: si el gimnasio la acepta, tiene la sección prendida y cargó alias o CBU.
create or replace function privado.datos_transferencia(p_gimnasio_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when 'transferencia' = any (c.medios_aceptados) and not ('transferencias' = any (c.secciones_apagadas))
                   and (c.alias_transferencia is not null or c.cbu is not null)
              then jsonb_build_object('alias', c.alias_transferencia, 'cbu', c.cbu, 'titular', c.titular_cuenta, 'banco', c.banco_transferencia)
         end
    from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id
$$;

-- ── Panel: prender altas y escribir el reglamento ──────────────────
create or replace function public.altas_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return jsonb_build_object(
    'altas_online', (select c.altas_online from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id),
    'reglamento', (select jsonb_build_object('version', r.version, 'texto', r.texto, 'creado_en', r.creado_en)
                     from public.reglamentos r where r.gimnasio_id = p_gimnasio_id order by r.version desc limit 1),
    'transferencia', privado.datos_transferencia(p_gimnasio_id),
    'aceptaciones', (select count(*) from public.aceptaciones_reglamento a where a.gimnasio_id = p_gimnasio_id));
end $$;

create or replace function public.guardar_altas(p_gimnasio_id uuid, p_altas_online boolean, p_reglamento text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actual public.reglamentos; t text := nullif(trim(coalesce(p_reglamento, '')), ''); n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_altas_online is null then raise exception 'Elegí si se aceptan altas online'; end if;
  select * into actual from public.reglamentos r where r.gimnasio_id = p_gimnasio_id order by r.version desc limit 1;
  if t is not null and (actual.id is null or actual.texto <> t) then
    if length(t) < 20 then raise exception 'Reglamento: muy corto (escribí al menos un par de líneas)'; end if;
    if length(t) > 8000 then raise exception 'Reglamento: hasta 8.000 letras (tiene %)', length(t); end if;
    insert into public.reglamentos (gimnasio_id, version, texto, creado_por)
    values (p_gimnasio_id, coalesce(actual.version, 0) + 1, t, auth.uid());
  elsif t is null and actual.id is not null then
    raise exception 'Reglamento: no se puede borrar (quien se anotó aceptó una versión). Escribí uno nuevo si cambió.';
  end if;
  if p_altas_online and not exists (select 1 from public.reglamentos r where r.gimnasio_id = p_gimnasio_id) then
    raise exception 'Escribí el reglamento antes de prender las altas online: cada socio nuevo lo tiene que aceptar.';
  end if;
  update public.configuracion_gimnasio set altas_online = p_altas_online where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar'; end if;
  return public.altas_panel(p_gimnasio_id);
end $$;

-- ── Público: lo que necesita la pantalla de alta ───────────────────
create or replace function public.alta_publica(p_host text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; l jsonb;
begin
  select d.gimnasio_id into g from public.dominios_gimnasio d where d.host = lower(p_host);
  if g is null then return null; end if;
  l := privado.landing_completa(g);
  if not coalesce((l ->> 'publicada')::boolean, false) or not coalesce((l ->> 'altas_online')::boolean, false) then
    return jsonb_build_object('abierta', false, 'marca', l -> 'marca', 'contacto', jsonb_build_object('whatsapp', l -> 'contacto' -> 'whatsapp'));
  end if;
  return jsonb_build_object('abierta', true, 'marca', l -> 'marca', 'contacto', l -> 'contacto', 'mostrar_precios', l -> 'mostrar_precios',
    'planes', l -> 'planes',
    'reglamento', (select jsonb_build_object('version', r.version, 'texto', r.texto)
                     from public.reglamentos r where r.gimnasio_id = g order by r.version desc limit 1),
    'transferencia', privado.datos_transferencia(g));
end $$;

-- ── Público: hacerse socio ──────────────────────────────────────────
create or replace function public.alta_online(p_host text, p_plan_id uuid, p_datos jsonb, p_version int, p_medio text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g uuid; c public.configuracion_gimnasio; regl public.reglamentos; pl public.planes; sid uuid;
  v_nombre text := trim(coalesce(p_datos ->> 'nombre', '')); v_apellido text := trim(coalesce(p_datos ->> 'apellido', ''));
  v_dni text := regexp_replace(coalesce(p_datos ->> 'dni', ''), '\D', '', 'g');
  v_mail text := nullif(lower(trim(coalesce(p_datos ->> 'email', ''))), '');
  v_nac date; v_tel text; v_trans jsonb; zona text;
begin
  select d.gimnasio_id into g from public.dominios_gimnasio d
    join public.landing_gimnasio l on l.gimnasio_id = d.gimnasio_id and l.publicada
   where d.host = lower(p_host);
  select * into c from public.configuracion_gimnasio where gimnasio_id = g;
  if g is null or not coalesce(c.altas_online, false) then raise exception 'Este gimnasio no está aceptando altas online. Escribile por WhatsApp.'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = g;

  select * into pl from public.planes p where p.gimnasio_id = g and p.id = p_plan_id and p.activo and p.visible_en_landing;
  if pl.id is null then raise exception 'Elegí uno de los planes de la página.'; end if;
  select * into regl from public.reglamentos r where r.gimnasio_id = g order by r.version desc limit 1;
  if regl.id is null or p_version is distinct from regl.version then
    raise exception 'El reglamento cambió mientras te anotabas: leelo de nuevo y aceptalo.';
  end if;

  if length(v_nombre) = 0 or length(v_apellido) = 0 then raise exception 'Escribí tu nombre y tu apellido.'; end if;
  if length(v_nombre) > 80 or length(v_apellido) > 80 then raise exception 'Nombre o apellido muy largos (hasta 80 letras).'; end if;
  if v_dni !~ '^[0-9]{6,9}$' then raise exception 'DNI: entre 6 y 9 números, sin puntos.'; end if;
  if v_mail is not null and v_mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisá el mail.'; end if;
  begin
    v_tel := privado.telefono_normalizado(p_datos ->> 'telefono', 'Celular');
  exception when others then
    raise exception 'Revisá el celular: con característica, por ejemplo 387 555 1234.';
  end;
  if v_tel is null then raise exception 'Dejá tu celular: con él entrás a la app.'; end if;
  if coalesce(p_datos ->> 'fecha_nacimiento', '') <> '' then
    begin v_nac := (p_datos ->> 'fecha_nacimiento')::date;
    exception when others then raise exception 'Revisá la fecha de nacimiento.'; end;
    if v_nac > (now() at time zone zona)::date or v_nac < date '1900-01-01' then raise exception 'Revisá la fecha de nacimiento.'; end if;
    if v_nac > ((now() at time zone zona)::date - interval '18 years') then
      raise exception 'Si tenés menos de 18 años, el alta la hace un adulto responsable en el gimnasio. ¡Te esperamos!';
    end if;
  end if;

  if p_medio is null or p_medio not in ('transferencia', 'mostrador') then raise exception 'Elegí cómo vas a pagar.'; end if;
  v_trans := privado.datos_transferencia(g);
  if p_medio = 'transferencia' and v_trans is null then raise exception 'Este gimnasio no recibe transferencias: elegí pagar en el mostrador.'; end if;

  -- Ya es socio (por DNI o celular): no se duplica nada.
  if exists (select 1 from public.socios s where s.gimnasio_id = g and (s.dni = v_dni or s.telefono = v_tel)) then
    return jsonb_build_object('ya_socio', true);
  end if;
  if (select count(*) from public.socios s where s.gimnasio_id = g and s.origen = 'alta_web' and s.creado_en > now() - interval '1 hour') >= 20 then
    raise exception 'Recibimos muchas altas en este momento. Probá en un rato o escribinos por WhatsApp.';
  end if;

  insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, email, fecha_nacimiento, origen)
  values (g, v_nombre, v_apellido, v_dni, v_tel, v_mail, v_nac, 'alta_web') returning id into sid;
  -- Membresía: queda asignada (sin cobertura hasta pagar). Pase o pack: se compra en el mostrador o con transferencia.
  if pl.tipo = 'membresia' then perform privado.asignar_plan(sid, pl.id, now(), null); end if;
  insert into public.aceptaciones_reglamento (gimnasio_id, socio_id, reglamento_id) values (g, sid, regl.id);

  -- El aviso al gimnasio: queda en Prospectos → "Se hicieron socios", con lo que eligió.
  insert into public.prospectos (gimnasio_id, nombre, telefono, interes, origen, estado, socio_id, nota)
  values (g, v_nombre || ' ' || v_apellido, v_tel, 'Alta online · ' || pl.nombre, 'pagina', 'socio', sid,
          case p_medio when 'transferencia' then 'Se anotó online: paga por transferencia (manda el comprobante desde la app).'
                       else 'Se anotó online: paga en el mostrador.' end)
  on conflict (gimnasio_id, telefono) do update set estado = 'socio', socio_id = excluded.socio_id, interes = excluded.interes,
    nota = excluded.nota, actualizado_en = now();

  return jsonb_build_object('ya_socio', false, 'socio_id', sid, 'plan', pl.nombre,
    'precio', privado.precio_para(pl.id, now(), null, null, false), 'medio', p_medio,
    'transferencia', case when p_medio = 'transferencia' then v_trans end);
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function privado.datos_transferencia(uuid) from public, anon, authenticated;
revoke all on function public.altas_panel(uuid), public.guardar_altas(uuid, boolean, text), public.alta_publica(text),
  public.alta_online(text, uuid, jsonb, int, text) from public, anon, authenticated;
grant execute on function public.alta_publica(text), public.alta_online(text, uuid, jsonb, int, text) to anon, authenticated, service_role;
grant execute on function public.altas_panel(uuid), public.guardar_altas(uuid, boolean, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  if exists (select 1 from public.configuracion_gimnasio where altas_online) then
    raise exception 'Verificación: las altas online tienen que arrancar apagadas';
  end if;
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname in ('reglamentos', 'aceptaciones_reglamento') loop
    if not (select relrowsecurity from pg_class where relname = r.relname and relnamespace = 'public'::regnamespace) then
      raise exception 'Verificación: % sin RLS', r.relname;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.relname and cmd <> 'SELECT') then
      raise exception 'Verificación: % se puede escribir desde el cliente', r.relname;
    end if;
    if has_table_privilege('anon', 'public.' || r.relname, 'select') then raise exception 'Verificación: anon lee %', r.relname; end if;
  end loop;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'public' and p.proname in ('altas_panel', 'guardar_altas', 'alta_publica', 'alta_online'))
               or (s.nspname = 'privado' and p.proname in ('datos_transferencia', 'landing_completa', 'etiqueta_campo')) loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if r.proname not in ('alta_publica', 'alta_online') and has_function_privilege('anon', r.oid, 'execute') then
      raise exception 'Verificación: anon puede ejecutar %', r.proname;
    end if;
  end loop;
end $$;
