-- ═══════════════════════════════════════════════════════════════════
-- 0013 · Lo que leen los paneles.
--
-- Las pantallas leen y escriben SOLO por funciones de public. Cada una
-- valida el rol y el gimnasio y, si no corresponde, falla: nunca
-- devuelve una lista vacía que parezca un cero real.
--
--   mi_sesion          quién soy: admin de plataforma, en qué gimnasios
--                      trabajo y con qué rol, de qué socios soy
--   panel_gimnasio     el marco del panel: marca, secciones, mi rol
--   panel_inicio       los 4 números y "ahora y lo que sigue"
--   guardar_accesos_rapidos   la grilla del inicio, editable por persona
--   buscar_socios / ficha_socio / guardar_socio
--   planes_gimnasio / guardar_plan / programar_precio
--   productos_gimnasio / guardar_producto
--   ingresos_del_dia   la lista de la entrada
--   configuracion_panel / guardar_configuracion
--   equipo_gimnasio / guardar_equipo
--   admin_gimnasios / admin_crear_gimnasio   (super admin de BRIK)
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('privado.retencion(uuid,timestamptz)') is null then
    raise exception 'Guarda: falta la migración 0010';
  end if;
  if to_regprocedure('privado.materializar_dia(uuid,date)') is null then
    raise exception 'Guarda: falta la migración 0011';
  end if;
end $$;

-- ── Preferencias por persona del equipo (accesos rápidos del inicio) ──
alter table public.equipo add column if not exists preferencias jsonb not null default '{}'::jsonb;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'equipo_preferencias_objeto') then
    alter table public.equipo add constraint equipo_preferencias_objeto check (jsonb_typeof(preferencias) = 'object');
  end if;
end $$;

-- Las pantallas que un gimnasio puede apagar. Clases se apaga sola con modo_clases = 'ninguno'.
create or replace function privado.secciones_validas() returns text[]
language sql immutable set search_path = '' as $$
  select array['entrada', 'clases', 'vencen_hoy', 'socios', 'retencion', 'rutinas', 'caja', 'vender', 'resultado', 'transferencias']
$$;
revoke all on function privado.secciones_validas() from public;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_secciones_validas') then
    alter table public.configuracion_gimnasio add constraint configuracion_secciones_validas
      check (secciones_apagadas <@ array['entrada', 'clases', 'vencen_hoy', 'socios', 'retencion', 'rutinas', 'caja', 'vender', 'resultado', 'transferencias']);
  end if;
end $$;

-- Un gimnasio se lee por su id solo si soy de su equipo o admin de plataforma.
create or replace function privado.exigir_equipo(p_gimnasio_id uuid, p_roles text[] default array['dueno', 'encargado', 'recepcion', 'profe'])
returns public.equipo
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  select * into e from public.equipo
   where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and activo and rol = any (p_roles);
  if not found then
    raise exception 'Sin permiso para esta acción en este gimnasio' using errcode = '42501';
  end if;
  return e;
end $$;
revoke all on function privado.exigir_equipo(uuid, text[]) from public;

-- ── Quién soy ───────────────────────────────────────────────────────
create or replace function public.mi_sesion() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  return jsonb_build_object(
    'usuario_id', u,
    'es_admin', exists (select 1 from public.administradores_plataforma a where a.usuario_id = u),
    'equipo', coalesce((
      select jsonb_agg(jsonb_build_object('equipo_id', e.id, 'gimnasio_id', g.id, 'slug', g.slug, 'gimnasio', g.nombre,
                                          'rol', e.rol, 'sede_id', e.sede_id, 'nombre', e.nombre) order by g.nombre)
        from public.equipo e join public.gimnasios g on g.id = e.gimnasio_id
       where e.usuario_id = u and e.activo), '[]'::jsonb),
    'socios', coalesce((
      select jsonb_agg(jsonb_build_object('socio_id', s.id, 'gimnasio_id', g.id, 'slug', g.slug, 'gimnasio', g.nombre,
                                          'nombre', trim(s.nombre || ' ' || s.apellido)) order by g.nombre, s.nombre)
        from public.socios s join public.gimnasios g on g.id = s.gimnasio_id
       where s.usuario_id = u and s.dado_de_baja_en is null), '[]'::jsonb)
  );
end $$;

-- ── El marco del panel ──────────────────────────────────────────────
create or replace function public.panel_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; g public.gimnasios; c public.configuracion_gimnasio; apagadas text[];
begin
  e := privado.exigir_equipo(p_gimnasio_id);
  select * into g from public.gimnasios where id = p_gimnasio_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  apagadas := c.secciones_apagadas;
  if c.modo_clases = 'ninguno' then apagadas := apagadas || array['clases']; end if;
  return jsonb_build_object(
    'gimnasio', jsonb_build_object('id', g.id, 'slug', g.slug, 'nombre', g.nombre, 'zona_horaria', g.zona_horaria),
    'marca', jsonb_build_object('logo_path', c.logo_path, 'favicon_path', c.favicon_path,
                                'color_acento', c.color_acento, 'color_fondo', c.color_fondo),
    'yo', jsonb_build_object('equipo_id', e.id, 'nombre', e.nombre, 'rol', e.rol, 'sede_id', e.sede_id,
                             'accesos', e.preferencias -> 'accesos'),
    'secciones_apagadas', to_jsonb(apagadas),
    'modo_clases', c.modo_clases,
    'cobra', jsonb_build_object('membresia', c.cobra_membresia, 'pase', c.cobra_pase, 'pack', c.cobra_pack),
    'sedes', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre, 'es_principal', s.es_principal)
                                        order by s.es_principal desc, s.nombre)
                         from public.sedes s
                        where s.gimnasio_id = g.id and s.activa and (e.sede_id is null or s.id = e.sede_id)), '[]'::jsonb)
  );
end $$;

create or replace function public.guardar_accesos_rapidos(p_gimnasio_id uuid, p_accesos text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; n int;
begin
  e := privado.exigir_equipo(p_gimnasio_id);
  if p_accesos is null or cardinality(p_accesos) = 0 then raise exception 'Elegí al menos un acceso'; end if;
  if cardinality(p_accesos) > 9 then raise exception 'Son 9 accesos como máximo'; end if;
  if exists (select 1 from unnest(p_accesos) a where a !~ '^[a-z_]{2,30}$') then raise exception 'Acceso no válido'; end if;
  if (select count(distinct a) from unnest(p_accesos) a) <> cardinality(p_accesos) then raise exception 'Hay accesos repetidos'; end if;
  update public.equipo set preferencias = preferencias || jsonb_build_object('accesos', to_jsonb(p_accesos)) where id = e.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudieron guardar los accesos'; end if;
end $$;

-- ── Inicio: 4 números y "ahora y lo que sigue" ──────────────────────
-- Los números dependen del rol: la recepción no ve lo cobrado (con eso
-- reconstruiría lo esperado de la caja y el arqueo dejaría de ser ciego).
create or replace function public.panel_inicio(p_gimnasio_id uuid, p_sede_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; zona text; c public.configuracion_gimnasio; hoy date; desde timestamptz; hasta timestamptz;
  entraron int; vencen int; al_dia int; cobrado numeric; por_aprobar int; clases_hoy int;
  numeros jsonb; ahora jsonb := '[]'::jsonb; s record; caja record; sede uuid;
begin
  e := privado.exigir_equipo(p_gimnasio_id);
  sede := coalesce(p_sede_id, e.sede_id);
  if e.sede_id is not null and sede <> e.sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  if sede is not null and not exists (select 1 from public.sedes where id = sede and gimnasio_id = p_gimnasio_id) then
    raise exception 'Sede inexistente' using errcode = 'P0002';
  end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = p_gimnasio_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  desde := privado.medianoche(hoy, zona);
  hasta := privado.medianoche(hoy + 1, zona);

  select count(distinct i.socio_id) into entraron from public.ingresos i
   where i.gimnasio_id = p_gimnasio_id and i.momento >= desde and i.momento < hasta and i.anulado_en is null
     and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede);

  select count(*) filter (where r.lista = 'por_vencer' and r.dias = 0) into vencen
    from privado.retencion(p_gimnasio_id, now()) r;

  select count(distinct cb.socio_id) into al_dia from public.coberturas cb
   where cb.gimnasio_id = p_gimnasio_id and cb.anulada_en is null and cb.desde <= now() and cb.hasta > now();

  select count(*) into por_aprobar from public.pagos p join public.ventas v on v.id = p.venta_id
   where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.medio = 'transferencia'
     and p.comprobante_path is not null and (sede is null or v.sede_id = sede);

  if c.modo_clases <> 'ninguno' and not ('clases' = any (c.secciones_apagadas)) then
    for s in select id from public.sedes where gimnasio_id = p_gimnasio_id and activa and (sede is null or id = sede) loop
      perform privado.materializar_dia(s.id, hoy);
    end loop;
    select count(*) into clases_hoy from public.clases k
     where k.gimnasio_id = p_gimnasio_id and k.inicio >= desde and k.inicio < hasta and k.cancelada_en is null
       and (sede is null or k.sede_id = sede);
  end if;

  if e.rol in ('dueno', 'encargado') then
    select coalesce(sum(p.monto), 0) into cobrado from public.pagos p join public.ventas v on v.id = p.venta_id
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.aprobado_en >= desde and p.aprobado_en < hasta
       and (sede is null or v.sede_id = sede);
    numeros := jsonb_build_array(
      jsonb_build_object('clave', 'entraron', 'emoji', '🚪', 'etiqueta', 'Entraron hoy', 'valor', entraron),
      jsonb_build_object('clave', 'vencen', 'emoji', '⏰', 'etiqueta', 'Vencen hoy', 'valor', vencen),
      jsonb_build_object('clave', 'cobrado', 'emoji', '💵', 'etiqueta', 'Cobrado hoy', 'valor', cobrado, 'formato', 'pesos'),
      jsonb_build_object('clave', 'al_dia', 'emoji', '✅', 'etiqueta', 'Socios al día', 'valor', al_dia));
  elsif e.rol = 'profe' then
    -- El profe ve lo suyo: sus clases de hoy, cuántos anotados y cuántos presentes.
    numeros := (
      select jsonb_build_array(
        jsonb_build_object('clave', 'mis_clases', 'emoji', '🗓️', 'etiqueta', 'Mis clases hoy', 'valor', count(*)),
        jsonb_build_object('clave', 'anotados', 'emoji', '📝', 'etiqueta', 'Anotados', 'valor',
          coalesce(sum((select count(*) from public.reservas r where r.clase_id = k.id and r.estado = 'confirmada')), 0)),
        jsonb_build_object('clave', 'presentes', 'emoji', '✅', 'etiqueta', 'Presentes', 'valor',
          coalesce(sum((select count(*) from public.asistencias a where a.clase_id = k.id and a.anulada_en is null)), 0)),
        jsonb_build_object('clave', 'faltan', 'emoji', '⏳', 'etiqueta', 'Me quedan hoy', 'valor', count(*) filter (where k.inicio > now())))
        from public.clases k
       where k.gimnasio_id = p_gimnasio_id and k.profe_id = e.id and k.cancelada_en is null
         and k.inicio >= desde and k.inicio < hasta);
  else
    numeros := jsonb_build_array(
      jsonb_build_object('clave', 'entraron', 'emoji', '🚪', 'etiqueta', 'Entraron hoy', 'valor', entraron),
      jsonb_build_object('clave', 'vencen', 'emoji', '⏰', 'etiqueta', 'Vencen hoy', 'valor', vencen),
      case when clases_hoy is not null
        then jsonb_build_object('clave', 'clases', 'emoji', '🗓️', 'etiqueta', 'Clases hoy', 'valor', clases_hoy)
        else jsonb_build_object('clave', 'al_dia', 'emoji', '✅', 'etiqueta', 'Socios al día', 'valor', al_dia) end,
      jsonb_build_object('clave', 'por_aprobar', 'emoji', '🧾', 'etiqueta', 'Transferencias por aprobar', 'valor', por_aprobar));
  end if;

  -- Ahora y lo que sigue: clases de las próximas horas, caja, pendientes.
  if clases_hoy is not null then
    ahora := ahora || coalesce((
      select jsonb_agg(jsonb_build_object(
               'tipo', 'clase', 'emoji', coalesce(a.emoji, '🗓️'), 'hora', to_char(k.inicio at time zone zona, 'HH24:MI'),
               'titulo', a.nombre,
               'detalle', (select count(*) from public.reservas r where r.clase_id = k.id and r.estado = 'confirmada')
                          || ' anotados' || case when k.cupo is not null then ' de ' || k.cupo else '' end
                          || coalesce(' · ' || p.nombre, ''),
               'href', '/clases') order by k.inicio)
        from public.clases k join public.actividades a on a.id = k.actividad_id
        left join public.equipo p on p.id = k.profe_id
       where k.gimnasio_id = p_gimnasio_id and k.cancelada_en is null and (sede is null or k.sede_id = sede)
         and k.fin > now() and k.inicio < now() + interval '6 hours'), '[]'::jsonb);
  end if;

  if e.rol in ('dueno', 'encargado', 'recepcion') and not ('caja' = any (c.secciones_apagadas)) then
    select t.abierto_en, q.nombre as quien into caja from public.turnos_caja t
      join public.cajas cj on cj.id = t.caja_id left join public.equipo q on q.id = t.abierto_por
     where t.gimnasio_id = p_gimnasio_id and t.cerrado_en is null and (sede is null or cj.sede_id = sede)
     order by t.abierto_en limit 1;
    ahora := ahora || jsonb_build_array(case when caja.abierto_en is null
      then jsonb_build_object('tipo', 'caja', 'emoji', '💵', 'titulo', 'La caja está cerrada', 'detalle', 'Abrila para cobrar en efectivo', 'href', '/caja', 'tono', 'amarillo')
      else jsonb_build_object('tipo', 'caja', 'emoji', '💵', 'titulo', 'Caja abierta',
                              'detalle', 'Desde las ' || to_char(caja.abierto_en at time zone zona, 'HH24:MI') || coalesce(' · ' || caja.quien, ''), 'href', '/caja') end);
  end if;
  if por_aprobar > 0 and e.rol <> 'profe' then
    ahora := ahora || jsonb_build_array(jsonb_build_object('tipo', 'transferencias', 'emoji', '🧾',
      'titulo', por_aprobar || case when por_aprobar = 1 then ' transferencia para aprobar' else ' transferencias para aprobar' end,
      'detalle', 'Mirá el comprobante y aprobala', 'href', '/transferencias', 'tono', 'azul'));
  end if;
  if vencen > 0 and e.rol <> 'profe' then
    ahora := ahora || jsonb_build_array(jsonb_build_object('tipo', 'vencen', 'emoji', '⏰',
      'titulo', vencen || case when vencen = 1 then ' socio vence hoy' else ' socios vencen hoy' end,
      'detalle', 'Avisales antes de que se vayan', 'href', '/vencen-hoy', 'tono', 'amarillo'));
  end if;

  return jsonb_build_object('hoy', hoy, 'numeros', numeros, 'ahora', ahora);
end $$;

-- ── Socios ──────────────────────────────────────────────────────────
-- Busca por nombre, apellido, DNI, teléfono o número de socio. El estado
-- de cada resultado sale de calcular_acceso: la misma respuesta que la puerta.
create or replace function public.buscar_socios(p_gimnasio_id uuid, p_texto text, p_limite int default 30)
returns table (socio_id uuid, numero int, nombre text, telefono text, dni text, plan text,
               color text, texto text, puede boolean, dado_de_baja boolean)
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; t text := privado.sin_acentos(lower(trim(coalesce(p_texto, '')))); digitos text;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if p_limite is null or p_limite < 1 or p_limite > 100 then raise exception 'El límite va de 1 a 100'; end if;
  digitos := regexp_replace(t, '\D', '', 'g');
  return query
  with candidatos as (
    select s.* from public.socios s
     where s.gimnasio_id = p_gimnasio_id
       and (t = ''
         or privado.sin_acentos(lower(s.nombre || ' ' || s.apellido)) like '%' || t || '%'
         or privado.sin_acentos(lower(s.apellido || ' ' || s.nombre)) like '%' || t || '%'
         or (length(digitos) >= 3 and (s.dni like digitos || '%' or regexp_replace(coalesce(s.telefono, ''), '\D', '', 'g') like '%' || digitos || '%'))
         or (digitos <> '' and s.numero::text = digitos))
     order by (s.dado_de_baja_en is not null), s.nombre, s.apellido
     limit p_limite
  )
  select s.id, s.numero, trim(s.nombre || ' ' || s.apellido), s.telefono, s.dni,
         (select pl.nombre from public.suscripciones su join public.planes pl on pl.id = su.plan_id
           where su.socio_id = s.id and su.baja_en is null order by su.inicio desc limit 1),
         v.color, v.texto, v.puede, s.dado_de_baja_en is not null
    from candidatos s
    cross join lateral privado.calcular_acceso(s.id, now(), e.sede_id) v;
end $$;

create or replace function public.ficha_socio(p_socio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.socios; e public.equipo; v public.veredicto_acceso; zona text;
begin
  select * into s from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(s.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = s.gimnasio_id;
  v := privado.calcular_acceso(s.id, now(), e.sede_id);
  return jsonb_build_object(
    'socio', jsonb_build_object('id', s.id, 'numero', s.numero, 'nombre', s.nombre, 'apellido', s.apellido, 'dni', s.dni,
      'telefono', s.telefono, 'email', s.email, 'fecha_nacimiento', s.fecha_nacimiento,
      'contacto_emergencia_nombre', s.contacto_emergencia_nombre, 'contacto_emergencia_telefono', s.contacto_emergencia_telefono,
      'notas', s.notas, 'dado_de_baja_en', s.dado_de_baja_en, 'motivo_baja', s.motivo_baja, 'creado_en', s.creado_en,
      'tiene_app', s.usuario_id is not null),
    'acceso', to_jsonb(v),
    'membresia', (select jsonb_build_object('suscripcion_id', su.id, 'plan_id', pl.id, 'plan', pl.nombre, 'tipo', pl.tipo,
                                            'inicio', su.inicio, 'precio', privado.precio_base(pl.id, now()))
                    from public.suscripciones su join public.planes pl on pl.id = su.plan_id
                   where su.socio_id = s.id and su.baja_en is null order by su.inicio desc limit 1),
    'ingresos', coalesce((select jsonb_agg(x order by x.momento desc) from (
                   select i.id, i.momento, i.resultado, i.color, i.texto, i.via_acceso from public.ingresos i
                    where i.socio_id = s.id and i.anulado_en is null order by i.momento desc limit 10) x), '[]'::jsonb),
    'pagos', case when e.rol in ('dueno', 'encargado') then coalesce((select jsonb_agg(x order by x.fecha desc) from (
                   select p.id, coalesce(p.aprobado_en, p.creado_en) as fecha, p.monto, p.medio, p.estado,
                          (select string_agg(vi.descripcion, ', ') from public.venta_items vi where vi.venta_id = p.venta_id) as detalle
                     from public.pagos p join public.ventas ve on ve.id = p.venta_id
                    where ve.socio_id = s.id order by coalesce(p.aprobado_en, p.creado_en) desc limit 10) x), '[]'::jsonb) end,
    'packs', coalesce((select jsonb_agg(jsonb_build_object('id', pk.id, 'plan', pl.nombre, 'cantidad', pk.cantidad,
                         'usadas', (select count(*) from public.consumos_pack cp where cp.pack_id = pk.id and cp.anulado_en is null),
                         'vence_en', pk.vence_en))
                        from public.packs pk join public.planes pl on pl.id = pk.plan_id
                       where pk.socio_id = s.id and pk.anulado_en is null and (pk.vence_en is null or pk.vence_en > now())), '[]'::jsonb)
  );
end $$;

-- Alta y edición. Sin datos de salud: el schema no tiene dónde ponerlos.
create or replace function public.guardar_socio(p_gimnasio_id uuid, p_socio_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; sid uuid; n int; v_tel text; v_dni text; v_mail text;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  if length(trim(coalesce(p_datos ->> 'nombre', ''))) = 0 then raise exception 'El nombre es obligatorio'; end if;
  v_tel := nullif(regexp_replace(coalesce(p_datos ->> 'telefono', ''), '[\s\-()]', '', 'g'), '');
  if v_tel is not null and v_tel !~ '^\+' then raise exception 'El teléfono va con código de país: +54 9 …'; end if;
  if v_tel is not null and v_tel !~ '^\+[0-9]{8,15}$' then raise exception 'El teléfono no es válido'; end if;
  v_dni := nullif(regexp_replace(coalesce(p_datos ->> 'dni', ''), '\D', '', 'g'), '');
  if v_dni is not null and v_dni !~ '^[0-9]{6,9}$' then raise exception 'El DNI tiene que tener entre 6 y 9 números'; end if;
  v_mail := nullif(lower(trim(coalesce(p_datos ->> 'email', ''))), '');
  if v_mail is not null and v_mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'El mail no es válido'; end if;
  if v_dni is not null and exists (select 1 from public.socios where gimnasio_id = p_gimnasio_id and socios.dni = v_dni
                                  and id is distinct from p_socio_id) then
    raise exception 'Ya hay un socio con el DNI %', v_dni;
  end if;

  if p_socio_id is null then
    insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, email, fecha_nacimiento,
                               contacto_emergencia_nombre, contacto_emergencia_telefono, notas, origen, creado_por)
    values (p_gimnasio_id, trim(p_datos ->> 'nombre'), trim(coalesce(p_datos ->> 'apellido', '')), v_dni, v_tel, v_mail,
            nullif(p_datos ->> 'fecha_nacimiento', '')::date,
            nullif(trim(coalesce(p_datos ->> 'contacto_emergencia_nombre', '')), ''),
            nullif(regexp_replace(coalesce(p_datos ->> 'contacto_emergencia_telefono', ''), '[\s\-()]', '', 'g'), ''),
            nullif(trim(coalesce(p_datos ->> 'notas', '')), ''), 'manual', auth.uid())
    returning id into sid;
  else
    update public.socios set
      nombre = trim(p_datos ->> 'nombre'), apellido = trim(coalesce(p_datos ->> 'apellido', '')), dni = v_dni,
      telefono = v_tel, email = v_mail, fecha_nacimiento = nullif(p_datos ->> 'fecha_nacimiento', '')::date,
      contacto_emergencia_nombre = nullif(trim(coalesce(p_datos ->> 'contacto_emergencia_nombre', '')), ''),
      contacto_emergencia_telefono = nullif(regexp_replace(coalesce(p_datos ->> 'contacto_emergencia_telefono', ''), '[\s\-()]', '', 'g'), ''),
      notas = nullif(trim(coalesce(p_datos ->> 'notas', '')), '')
     where id = p_socio_id and gimnasio_id = p_gimnasio_id
    returning id into sid;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  end if;
  return sid;
end $$;

-- ── Planes, precios y productos ─────────────────────────────────────
create or replace function public.planes_gimnasio(p_gimnasio_id uuid)
returns table (plan_id uuid, tipo text, nombre text, descripcion text, activo boolean, orden int,
               duracion_meses int, renovacion text, cantidad_clases int, validez_dias int, consume_en text,
               max_ingresos_semana int, hora_desde time, hora_hasta time, visible_en_landing boolean,
               precio numeric, proximo_precio numeric, proximo_desde timestamptz, socios_activos int)
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id);
  return query
  select p.id, p.tipo, p.nombre, p.descripcion, p.activo, p.orden, p.duracion_meses, p.renovacion, p.cantidad_clases,
         p.validez_dias, p.consume_en, p.max_ingresos_semana, p.hora_desde, p.hora_hasta, p.visible_en_landing,
         privado.precio_base(p.id, now()),
         prox.monto, prox.vigente_desde,
         (select count(*)::int from public.suscripciones su where su.plan_id = p.id and su.baja_en is null)
    from public.planes p
    left join lateral (select pp.monto, pp.vigente_desde from public.precios_plan pp
                        where pp.plan_id = p.id and pp.vigente_desde > now() and pp.sede_id is null and pp.medio_pago is null
                          and pp.pago_hasta_dia is null order by pp.vigente_desde limit 1) prox on true
   where p.gimnasio_id = p_gimnasio_id
   order by p.activo desc, p.orden, p.nombre;
end $$;

create or replace function public.guardar_plan(p_gimnasio_id uuid, p_plan_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; pid uuid; n int; tipo text := p_datos ->> 'tipo';
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  if p_plan_id is null then
    if tipo not in ('membresia', 'pase_diario', 'pack') then raise exception 'Elegí qué tipo de plan es'; end if;
    insert into public.planes (gimnasio_id, tipo, nombre, descripcion, duracion_meses, renovacion, cantidad_clases, validez_dias,
                               consume_en, max_ingresos_semana, hora_desde, hora_hasta, visible_en_landing, orden)
    values (p_gimnasio_id, tipo, trim(p_datos ->> 'nombre'), nullif(trim(coalesce(p_datos ->> 'descripcion', '')), ''),
            case when tipo = 'membresia' then coalesce((p_datos ->> 'duracion_meses')::int, 1) end,
            case when tipo = 'membresia' then coalesce(p_datos ->> 'renovacion', 'continua') end,
            case when tipo = 'pack' then (p_datos ->> 'cantidad_clases')::int end,
            case when tipo = 'pack' then nullif(p_datos ->> 'validez_dias', '')::int end,
            case when tipo = 'pack' then coalesce(p_datos ->> 'consume_en', 'ingreso') end,
            nullif(p_datos ->> 'max_ingresos_semana', '')::int,
            nullif(p_datos ->> 'hora_desde', '')::time, nullif(p_datos ->> 'hora_hasta', '')::time,
            coalesce((p_datos ->> 'visible_en_landing')::boolean, true),
            coalesce((select max(orden) + 1 from public.planes where gimnasio_id = p_gimnasio_id), 0))
    returning id into pid;
  else
    -- El tipo no cambia: cambiaría qué significan las coberturas ya vendidas.
    update public.planes set
      nombre = trim(p_datos ->> 'nombre'),
      descripcion = nullif(trim(coalesce(p_datos ->> 'descripcion', '')), ''),
      max_ingresos_semana = nullif(p_datos ->> 'max_ingresos_semana', '')::int,
      hora_desde = nullif(p_datos ->> 'hora_desde', '')::time,
      hora_hasta = nullif(p_datos ->> 'hora_hasta', '')::time,
      activo = coalesce((p_datos ->> 'activo')::boolean, activo),
      visible_en_landing = coalesce((p_datos ->> 'visible_en_landing')::boolean, visible_en_landing)
     where id = p_plan_id and gimnasio_id = p_gimnasio_id
    returning id into pid;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Sin permiso o plan inexistente' using errcode = '42501'; end if;
  end if;
  return pid;
end $$;

-- Un precio nuevo nunca pisa al anterior: queda programado desde una fecha
-- (hoy = desde ahora). Lo ya cobrado no cambia.
create or replace function public.programar_precio(p_plan_id uuid, p_monto numeric, p_desde date default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare p public.planes; e public.equipo; zona text; desde timestamptz; pid uuid;
begin
  select * into p from public.planes where id = p_plan_id;
  if not found then raise exception 'Sin permiso o plan inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(p.gimnasio_id, array['dueno', 'encargado']);
  if p_monto is null or p_monto <= 0 then raise exception 'El precio tiene que ser mayor a cero'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = p.gimnasio_id;
  desde := case when p_desde is null or p_desde <= privado.dia_local(now(), zona) then now() else privado.medianoche(p_desde, zona) end;
  insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde, creado_por)
  values (p.gimnasio_id, p.id, round(p_monto, 2), desde, auth.uid()) returning id into pid;
  return pid;
end $$;

create or replace function public.productos_gimnasio(p_gimnasio_id uuid)
returns table (producto_id uuid, nombre text, precio numeric, activo boolean, orden int)
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return query select pr.id, pr.nombre, pr.precio, pr.activo, pr.orden from public.productos pr
                where pr.gimnasio_id = p_gimnasio_id order by pr.activo desc, pr.orden, pr.nombre;
end $$;

create or replace function public.guardar_producto(p_gimnasio_id uuid, p_producto_id uuid, p_nombre text, p_precio numeric, p_activo boolean default true)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare pid uuid; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if length(trim(coalesce(p_nombre, ''))) = 0 then raise exception 'El nombre es obligatorio'; end if;
  if p_precio is null or p_precio < 0 then raise exception 'El precio no puede ser negativo'; end if;
  if p_producto_id is null then
    insert into public.productos (gimnasio_id, nombre, precio, orden)
    values (p_gimnasio_id, trim(p_nombre), round(p_precio, 2),
            coalesce((select max(orden) + 1 from public.productos where gimnasio_id = p_gimnasio_id), 0))
    returning id into pid;
  else
    update public.productos set nombre = trim(p_nombre), precio = round(p_precio, 2), activo = coalesce(p_activo, true)
     where id = p_producto_id and gimnasio_id = p_gimnasio_id returning id into pid;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Sin permiso o producto inexistente' using errcode = '42501'; end if;
  end if;
  return pid;
end $$;

-- ── Entrada: lo que pasó hoy en la puerta ───────────────────────────
create or replace function public.ingresos_del_dia(p_gimnasio_id uuid, p_sede_id uuid default null, p_dia date default null)
returns table (ingreso_id uuid, momento timestamptz, socio_id uuid, socio text, numero int, resultado text,
               color text, texto text, via_acceso text, registrado_por text)
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; zona text; dia date; sede uuid;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  sede := coalesce(p_sede_id, e.sede_id);
  if e.sede_id is not null and sede <> e.sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = p_gimnasio_id;
  dia := coalesce(p_dia, privado.dia_local(now(), zona));
  return query
  select i.id, i.momento, s.id, trim(s.nombre || ' ' || s.apellido), s.numero, i.resultado, i.color, i.texto, i.via_acceso, q.nombre
    from public.ingresos i join public.socios s on s.id = i.socio_id
    left join public.equipo q on q.id = i.registrado_por
   where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null
     and i.momento >= privado.medianoche(dia, zona) and i.momento < privado.medianoche(dia + 1, zona)
     and (sede is null or i.sede_id = sede)
   order by i.momento desc
   limit 300;
end $$;

-- ── Configuración del gimnasio ──────────────────────────────────────
create or replace function public.configuracion_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.configuracion_gimnasio; g public.gimnasios;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  select * into g from public.gimnasios where id = p_gimnasio_id;
  return jsonb_build_object(
    'nombre', g.nombre, 'slug', g.slug,
    'color_acento', c.color_acento, 'color_fondo', c.color_fondo, 'logo_path', c.logo_path,
    'cobra_membresia', c.cobra_membresia, 'cobra_pase', c.cobra_pase, 'cobra_pack', c.cobra_pack,
    'modo_clases', c.modo_clases, 'accesos_activos', to_jsonb(c.accesos_activos),
    'tolerancia_dias', c.tolerancia_dias, 'dias_aviso', c.dias_aviso,
    'reingreso_mismo_dia_consume', c.reingreso_mismo_dia_consume,
    'secciones_apagadas', to_jsonb(c.secciones_apagadas),
    'alias_transferencia', c.alias_transferencia, 'cbu', c.cbu, 'titular_cuenta', c.titular_cuenta,
    'descuento_max_recepcion', c.descuento_max_recepcion,
    'retencion_dias_ausencia', c.retencion_dias_ausencia, 'retencion_dias_nuevo', c.retencion_dias_nuevo,
    'retencion_dias_vencido', c.retencion_dias_vencido, 'retencion_dias_se_fue', c.retencion_dias_se_fue,
    'reserva_dias_anticipacion', c.reserva_dias_anticipacion, 'cancelacion_horas_limite', c.cancelacion_horas_limite);
end $$;

-- Solo el dueño. Cada campo se valida con los CHECK de la tabla; los
-- que no vienen en p_datos quedan como estaban.
create or replace function public.guardar_configuracion(p_gimnasio_id uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare n int; desconocidos text[];
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  select array_agg(k) into desconocidos from jsonb_object_keys(p_datos) k
   where k not in ('nombre', 'color_acento', 'color_fondo', 'cobra_membresia', 'cobra_pase', 'cobra_pack', 'modo_clases',
                   'accesos_activos', 'tolerancia_dias', 'dias_aviso', 'reingreso_mismo_dia_consume', 'secciones_apagadas',
                   'alias_transferencia', 'cbu', 'titular_cuenta', 'descuento_max_recepcion', 'retencion_dias_ausencia',
                   'retencion_dias_nuevo', 'retencion_dias_vencido', 'retencion_dias_se_fue', 'reserva_dias_anticipacion',
                   'cancelacion_horas_limite');
  if desconocidos is not null then raise exception 'Campos que no se pueden cambiar acá: %', array_to_string(desconocidos, ', '); end if;
  if exists (select 1 from jsonb_array_elements_text(coalesce(p_datos -> 'secciones_apagadas', '[]')) x
              where x <> all (privado.secciones_validas())) then
    raise exception 'Sección desconocida';
  end if;

  if p_datos ? 'nombre' then
    if length(trim(coalesce(p_datos ->> 'nombre', ''))) = 0 then raise exception 'El nombre es obligatorio'; end if;
    update public.gimnasios set nombre = trim(p_datos ->> 'nombre') where id = p_gimnasio_id;
  end if;

  update public.configuracion_gimnasio c set
    color_acento = coalesce(lower(p_datos ->> 'color_acento'), c.color_acento),
    color_fondo = coalesce(lower(p_datos ->> 'color_fondo'), c.color_fondo),
    cobra_membresia = coalesce((p_datos ->> 'cobra_membresia')::boolean, c.cobra_membresia),
    cobra_pase = coalesce((p_datos ->> 'cobra_pase')::boolean, c.cobra_pase),
    cobra_pack = coalesce((p_datos ->> 'cobra_pack')::boolean, c.cobra_pack),
    modo_clases = coalesce(p_datos ->> 'modo_clases', c.modo_clases),
    accesos_activos = case when p_datos ? 'accesos_activos'
                           then array(select jsonb_array_elements_text(p_datos -> 'accesos_activos')) else c.accesos_activos end,
    tolerancia_dias = coalesce((p_datos ->> 'tolerancia_dias')::int, c.tolerancia_dias),
    dias_aviso = coalesce((p_datos ->> 'dias_aviso')::int, c.dias_aviso),
    reingreso_mismo_dia_consume = coalesce((p_datos ->> 'reingreso_mismo_dia_consume')::boolean, c.reingreso_mismo_dia_consume),
    secciones_apagadas = case when p_datos ? 'secciones_apagadas'
                              then array(select jsonb_array_elements_text(p_datos -> 'secciones_apagadas')) else c.secciones_apagadas end,
    alias_transferencia = case when p_datos ? 'alias_transferencia' then nullif(trim(p_datos ->> 'alias_transferencia'), '') else c.alias_transferencia end,
    cbu = case when p_datos ? 'cbu' then nullif(regexp_replace(coalesce(p_datos ->> 'cbu', ''), '\D', '', 'g'), '') else c.cbu end,
    titular_cuenta = case when p_datos ? 'titular_cuenta' then nullif(trim(p_datos ->> 'titular_cuenta'), '') else c.titular_cuenta end,
    descuento_max_recepcion = coalesce((p_datos ->> 'descuento_max_recepcion')::numeric, c.descuento_max_recepcion),
    retencion_dias_ausencia = coalesce((p_datos ->> 'retencion_dias_ausencia')::int, c.retencion_dias_ausencia),
    retencion_dias_nuevo = coalesce((p_datos ->> 'retencion_dias_nuevo')::int, c.retencion_dias_nuevo),
    retencion_dias_vencido = coalesce((p_datos ->> 'retencion_dias_vencido')::int, c.retencion_dias_vencido),
    retencion_dias_se_fue = coalesce((p_datos ->> 'retencion_dias_se_fue')::int, c.retencion_dias_se_fue),
    reserva_dias_anticipacion = coalesce((p_datos ->> 'reserva_dias_anticipacion')::int, c.reserva_dias_anticipacion),
    cancelacion_horas_limite = coalesce((p_datos ->> 'cancelacion_horas_limite')::int, c.cancelacion_horas_limite),
    actualizado_en = now()
   where c.gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la configuración'; end if;
end $$;

-- ── Equipo ──────────────────────────────────────────────────────────
create or replace function public.equipo_gimnasio(p_gimnasio_id uuid)
returns table (equipo_id uuid, nombre text, rol text, sede_id uuid, sede text, activo boolean, tiene_acceso boolean, soy_yo boolean)
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return query
  select e.id, e.nombre, e.rol, e.sede_id, s.nombre, e.activo, e.usuario_id is not null, e.usuario_id = auth.uid()
    from public.equipo e left join public.sedes s on s.id = e.sede_id
   where e.gimnasio_id = p_gimnasio_id
   order by e.activo desc, array_position(array['dueno', 'encargado', 'recepcion', 'profe'], e.rol), e.nombre;
end $$;

-- Alta y edición del equipo. El usuario (login) lo vincula el servidor
-- después de invitar por mail (service_role), nunca el navegador.
create or replace function public.guardar_equipo(p_gimnasio_id uuid, p_equipo_id uuid, p_nombre text, p_rol text,
                                                 p_sede_id uuid default null, p_activo boolean default true)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare yo public.equipo; previo public.equipo; eid uuid; n int;
begin
  yo := privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if length(trim(coalesce(p_nombre, ''))) = 0 then raise exception 'El nombre es obligatorio'; end if;
  if p_rol not in ('dueno', 'encargado', 'recepcion', 'profe') then raise exception 'Rol no válido'; end if;
  if p_sede_id is not null and not exists (select 1 from public.sedes where id = p_sede_id and gimnasio_id = p_gimnasio_id) then
    raise exception 'Sede inexistente';
  end if;
  if p_equipo_id is null then
    insert into public.equipo (gimnasio_id, nombre, rol, sede_id) values (p_gimnasio_id, trim(p_nombre), p_rol, p_sede_id)
    returning id into eid;
  else
    select * into previo from public.equipo where id = p_equipo_id and gimnasio_id = p_gimnasio_id for update;
    if not found then raise exception 'Sin permiso o persona inexistente' using errcode = '42501'; end if;
    if previo.id = yo.id and (p_rol <> 'dueno' or not coalesce(p_activo, true)) then
      raise exception 'No podés sacarte a vos mismo el rol de dueño';
    end if;
    update public.equipo set nombre = trim(p_nombre), rol = p_rol, sede_id = p_sede_id, activo = coalesce(p_activo, true)
     where id = p_equipo_id returning id into eid;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo guardar'; end if;
  end if;
  if not exists (select 1 from public.equipo where gimnasio_id = p_gimnasio_id and rol = 'dueno' and activo) then
    raise exception 'El gimnasio tiene que tener al menos un dueño activo';
  end if;
  return eid;
end $$;

-- Lo llama el servidor (service_role) después de invitar por mail.
create or replace function public.vincular_usuario_equipo(p_equipo_id uuid, p_usuario_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not privado.es_servicio() then raise exception 'Solo el servidor vincula usuarios' using errcode = '42501'; end if;
  update public.equipo set usuario_id = p_usuario_id where id = p_equipo_id and usuario_id is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'La persona no existe o ya tiene un usuario'; end if;
end $$;

-- ── Super admin de BRIK ─────────────────────────────────────────────
create or replace function public.admin_gimnasios()
returns table (gimnasio_id uuid, slug text, nombre text, es_demo boolean, creado_en timestamptz, suspendido boolean,
               hosts text[], socios int, socios_al_dia int, ingresos_7_dias int, duenos text[])
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  return query
  select g.id, g.slug, g.nombre, g.es_demo, g.creado_en, g.suspension_manual_en is not null,
         array(select d.host from public.dominios_gimnasio d where d.gimnasio_id = g.id order by d.tipo desc, d.host),
         (select count(*)::int from public.socios s where s.gimnasio_id = g.id and s.dado_de_baja_en is null),
         (select count(distinct cb.socio_id)::int from public.coberturas cb
           where cb.gimnasio_id = g.id and cb.anulada_en is null and cb.desde <= now() and cb.hasta > now()),
         (select count(*)::int from public.ingresos i where i.gimnasio_id = g.id and i.anulado_en is null
             and i.resultado <> 'rechazado' and i.momento > now() - interval '7 days'),
         array(select e.nombre from public.equipo e where e.gimnasio_id = g.id and e.rol = 'dueno' and e.activo order by e.nombre)
    from public.gimnasios g
   order by g.es_demo, g.nombre;
end $$;

-- Crea el gimnasio (con su sede, configuración, landing y plantillas por
-- los triggers), su subdominio y al dueño en el equipo. El login del dueño
-- lo invita y vincula el servidor.
create or replace function public.admin_crear_gimnasio(p_slug text, p_nombre text, p_dominio_base text, p_dueno_nombre text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare gid uuid; eid uuid; v_host text;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if p_slug !~ '^[a-z0-9]([a-z0-9-]{0,40}[a-z0-9])?$' then
    raise exception 'La dirección va en minúsculas, sin espacios ni acentos (ej: olympo-gym)';
  end if;
  if length(trim(coalesce(p_nombre, ''))) = 0 then raise exception 'El nombre del gimnasio es obligatorio'; end if;
  if length(trim(coalesce(p_dueno_nombre, ''))) = 0 then raise exception 'El nombre del dueño es obligatorio'; end if;
  if coalesce(p_dominio_base, '') !~ '^[a-z0-9.-]+$' then raise exception 'Dominio base no válido'; end if;
  if exists (select 1 from public.gimnasios where slug = p_slug) then raise exception 'Ya existe un gimnasio con la dirección %', p_slug; end if;
  v_host := p_slug || '.' || p_dominio_base;
  if exists (select 1 from public.dominios_gimnasio d where d.host = v_host) then
    raise exception 'La dirección % ya está en uso', v_host;
  end if;
  insert into public.gimnasios (slug, nombre) values (p_slug, trim(p_nombre)) returning id into gid;
  insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values (gid, v_host, 'subdominio');
  insert into public.equipo (gimnasio_id, nombre, rol) values (gid, trim(p_dueno_nombre), 'dueno') returning id into eid;
  return jsonb_build_object('gimnasio_id', gid, 'equipo_id', eid, 'host', v_host);
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function
  public.mi_sesion(), public.panel_gimnasio(uuid), public.guardar_accesos_rapidos(uuid, text[]),
  public.panel_inicio(uuid, uuid), public.buscar_socios(uuid, text, int), public.ficha_socio(uuid),
  public.guardar_socio(uuid, uuid, jsonb), public.planes_gimnasio(uuid), public.guardar_plan(uuid, uuid, jsonb),
  public.programar_precio(uuid, numeric, date), public.productos_gimnasio(uuid),
  public.guardar_producto(uuid, uuid, text, numeric, boolean), public.ingresos_del_dia(uuid, uuid, date),
  public.configuracion_panel(uuid), public.guardar_configuracion(uuid, jsonb), public.equipo_gimnasio(uuid),
  public.guardar_equipo(uuid, uuid, text, text, uuid, boolean), public.vincular_usuario_equipo(uuid, uuid),
  public.admin_gimnasios(), public.admin_crear_gimnasio(text, text, text, text)
  from public, anon, authenticated;
grant execute on function
  public.mi_sesion(), public.panel_gimnasio(uuid), public.guardar_accesos_rapidos(uuid, text[]),
  public.panel_inicio(uuid, uuid), public.buscar_socios(uuid, text, int), public.ficha_socio(uuid),
  public.guardar_socio(uuid, uuid, jsonb), public.planes_gimnasio(uuid), public.guardar_plan(uuid, uuid, jsonb),
  public.programar_precio(uuid, numeric, date), public.productos_gimnasio(uuid),
  public.guardar_producto(uuid, uuid, text, numeric, boolean), public.ingresos_del_dia(uuid, uuid, date),
  public.configuracion_panel(uuid), public.guardar_configuracion(uuid, jsonb), public.equipo_gimnasio(uuid),
  public.guardar_equipo(uuid, uuid, text, text, uuid, boolean),
  public.admin_gimnasios(), public.admin_crear_gimnasio(text, text, text, text)
  to authenticated, service_role;
grant execute on function public.vincular_usuario_equipo(uuid, uuid) to service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if has_function_privilege('anon', 'public.panel_inicio(uuid, uuid)', 'execute') then
    raise exception 'Verificación: anon puede leer el inicio';
  end if;
  if has_function_privilege('authenticated', 'public.vincular_usuario_equipo(uuid, uuid)', 'execute') then
    raise exception 'Verificación: un usuario puede vincularse solo al equipo';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'equipo' and column_name = 'preferencias') then
    raise exception 'Verificación: falta equipo.preferencias';
  end if;
end $$;
