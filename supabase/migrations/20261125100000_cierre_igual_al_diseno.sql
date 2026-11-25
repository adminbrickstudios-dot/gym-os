-- Cierre para vender (Mateo, 25/11) · Parte 1: los datos que le faltaban a Pista Semáforo para quedar igual al diseño
-- (docs/base/pista/semaforo), y las decisiones de Mateo sobre el estilo de los [demo] y de todo gimnasio nuevo.
-- Aditiva y compatible con el código anterior (expandir): columnas nuevas al final, lecturas nuevas, nombres nuevos en el lote.
-- Ninguna función de esta migración mueve plata ni cupos; ninguna calcula el acceso (todo sale de calcular_acceso, como siempre).
--
--   configuracion_gimnasio.casi_lleno_pct          el umbral de "Casi lleno" en Clases (dato por gimnasio, 85 por defecto)
--   inicio_semaforo(gimnasio, sede)                 la línea chica de cada número del Inicio: adentro ahora, desde cuándo está la caja abierta,
--                                                   los días de ausencia de la regla de retención del gimnasio
--   numeros_inicio · clave 'no_vienen'              "Dejaron de venir" (la lista no_viene de Retención, la misma regla)
--   buscar_socios · vence, ultima_vez, dejo_de_venir  Vence (socios.cubierto_hasta), Última vez (la última entrada, índice ingresos_socio) y
--                                                   si dejó de venir (la regla de la lista no_viene de Retención, con los días del gimnasio)
--                                                   y el límite pasa de 100 a 600: "Ver 60 más" de Socios pedía 120 y la base lo rechazaba
--   ficha_socio · racha                             veces este mes y semanas seguidas (racha_socio, lo mismo que las insignias de la app)
--   movimientos_turno(turno)                        los cobros del turno (cobros_de_turnos) y los ingresos y retiros de la caja, con el mismo permiso
--   config_clases_panel(gimnasio)                   el umbral de Casi lleno para la pantalla de Clases
--   lote_lecturas                                   suma esos nombres y clases_del_dia (un viaje, como cada pantalla)
--   [demo] en Pista con pista_semaforo; admin_crear_gimnasio deja todo gimnasio nuevo en Pista con pista_semaforo (Temple Gym no se toca)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $g$ begin
  if to_regprocedure('public.numeros_inicio(uuid, uuid)') is null then raise exception 'Guarda: falta numeros_inicio'; end if;
  if to_regprocedure('public.guardar_numeros_inicio(uuid, text[])') is null then raise exception 'Guarda: falta guardar_numeros_inicio'; end if;
  if to_regprocedure('public.buscar_socios(uuid, text, integer, uuid, text, uuid, text)') is null then raise exception 'Guarda: falta buscar_socios'; end if;
  if to_regprocedure('public.ficha_socio(uuid)') is null then raise exception 'Guarda: falta ficha_socio'; end if;
  if to_regprocedure('public.racha_socio(uuid)') is null then raise exception 'Guarda: falta racha_socio'; end if;
  if to_regprocedure('public.cobros_de_turnos(uuid[])') is null then raise exception 'Guarda: falta cobros_de_turnos'; end if;
  if to_regprocedure('public.lote_lecturas(jsonb)') is null then raise exception 'Guarda: falta lote_lecturas'; end if;
  if to_regprocedure('public.admin_crear_gimnasio(text, text, text, text)') is null then raise exception 'Guarda: falta admin_crear_gimnasio'; end if;
  if to_regprocedure('privado.adentro_ahora(uuid, uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.adentro_ahora'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'socios' and column_name = 'cubierto_hasta') then
    raise exception 'Guarda: falta socios.cubierto_hasta (D36)';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'retencion_dias_ausencia') then
    raise exception 'Guarda: falta configuracion_gimnasio.retencion_dias_ausencia';
  end if;
  if not exists (select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where c ->> 'clave' = 'pista_semaforo') then
    raise exception 'Guarda: falta la llave pista_semaforo (20261124100000)';
  end if;
end $g$;

-- ── 1. El umbral de "Casi lleno" (dato por gimnasio) ────────────────
alter table public.configuracion_gimnasio add column if not exists casi_lleno_pct int;
update public.configuracion_gimnasio set casi_lleno_pct = 85 where casi_lleno_pct is null;
alter table public.configuracion_gimnasio alter column casi_lleno_pct set default 85;
alter table public.configuracion_gimnasio alter column casi_lleno_pct set not null;
do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_casi_lleno_valido') then
    alter table public.configuracion_gimnasio add constraint configuracion_casi_lleno_valido check (casi_lleno_pct between 50 and 100);
  end if;
end $c$;

create or replace function public.config_clases_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.configuracion_gimnasio;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  return jsonb_build_object('casi_lleno_pct', c.casi_lleno_pct);
end $$;
revoke all on function public.config_clases_panel(uuid) from public, anon, authenticated;
grant execute on function public.config_clases_panel(uuid) to authenticated, service_role;

-- ── 2. La línea chica de cada número del Inicio ─────────────────────
-- Solo hechos que la pantalla redacta: cuántos hay adentro ahora (la misma cuenta del número "Adentro"), desde cuándo está abierta la caja
-- (el turno abierto más viejo de la sede: ningún monto) y los días de ausencia de la regla de retención del gimnasio.
create or replace function public.inicio_semaforo(p_gimnasio_id uuid, p_sede_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; sede uuid; zona text; hoy date; desde timestamptz; salida_modo text := 'no'; adentro int := 0; caja timestamptz; dias int;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  sede := coalesce(p_sede_id, e.sede_id);
  if e.sede_id is not null and sede <> e.sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  desde := privado.medianoche(hoy, zona);
  select coalesce(cv.registrar_salida, 'no') into salida_modo from (select 1) u left join public.configuracion_visita cv on cv.gimnasio_id = p_gimnasio_id;
  if salida_modo = 'no' then
    select count(distinct i.socio_id) into adentro from public.ingresos i
     where i.gimnasio_id = p_gimnasio_id and i.momento >= greatest(desde, now() - interval '2 hours') and i.momento <= now()
       and i.anulado_en is null and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede);
  else
    adentro := privado.adentro_ahora(p_gimnasio_id, sede, now());
  end if;
  select min(tc.abierto_en) into caja from public.turnos_caja tc join public.cajas cj on cj.id = tc.caja_id
   where tc.gimnasio_id = p_gimnasio_id and tc.cerrado_en is null and (sede is null or cj.sede_id = sede);
  select c.retencion_dias_ausencia into dias from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  return jsonb_build_object('adentro', coalesce(adentro, 0), 'adentro_exacto', salida_modo <> 'no', 'caja_desde', caja, 'dias_ausencia', dias);
end $$;
revoke all on function public.inicio_semaforo(uuid, uuid) from public, anon, authenticated;
grant execute on function public.inicio_semaforo(uuid, uuid) to authenticated, service_role;

-- ── 3. "Dejaron de venir" como número del Inicio ────────────────────
-- Se parte de la definición VIGENTE (pg_get_functiondef) y se cambia cada trozo con guarda: si un trozo no está exactamente una vez, falla.
alter table public.configuracion_gimnasio drop constraint if exists configuracion_numeros_inicio_ck;
alter table public.configuracion_gimnasio add constraint configuracion_numeros_inicio_ck
  check (numeros_inicio <@ array['adentro','entraron','cobrado','a_cobrar','deben','por_vencer','plata_riesgo','activos','altas_mes','bajas_mes','ocupacion','caja_turno','no_vienen']::text[]
         and cardinality(numeros_inicio) <= 8);

do $m$
declare def text; nuevo text; de text; a text; veces int; par text[];
  parches text[][] := array[
    array['''bajas_mes'',''ocupacion'',''caja_turno'']::text[]', '''bajas_mes'',''ocupacion'',''caja_turno'',''no_vienen'']::text[]']];
begin
  def := pg_get_functiondef('public.guardar_numeros_inicio(uuid, text[])'::regprocedure);
  if position('''no_vienen''' in def) > 0 then return; end if;
  nuevo := def;
  foreach par slice 1 in array parches loop
    de := par[1]; a := par[2];
    veces := (length(nuevo) - length(replace(nuevo, de, ''))) / length(de);
    if veces <> 1 then raise exception 'guardar_numeros_inicio: el trozo % aparece % veces (tiene que ser 1)', de, veces; end if;
    nuevo := replace(nuevo, de, a);
  end loop;
  execute nuevo;
end $m$;

do $m$
declare def text; nuevo text; de text; a text; veces int; par text[];
  parches text[][] := array[
    -- la lista de claves
    array['''bajas_mes'',''ocupacion'',''caja_turno''];', '''bajas_mes'',''ocupacion'',''caja_turno'',''no_vienen''];'],
    -- la variable
    array['r_riesgo numeric := 0;', 'r_riesgo numeric := 0; r_no_vienen int := 0;'],
    -- la etiqueta
    array['''caja_turno'', ''💵|Caja del turno'');', '''caja_turno'', ''💵|Caja del turno'', ''no_vienen'', ''💤|Dejaron de venir'');'],
    -- quién la ve: con Retención prendida
    array['or (k = ''caja_turno'' and (e.rol', 'or (k = ''no_vienen'' and ''retencion'' = any (c.secciones_apagadas)) or (k = ''caja_turno'' and (e.rol'],
    -- la pasada única de Retención la cuenta también
    array['if claves && array[''a_cobrar'', ''deben'', ''por_vencer'', ''plata_riesgo''] then', 'if claves && array[''a_cobrar'', ''deben'', ''por_vencer'', ''plata_riesgo'', ''no_vienen''] then'],
    array['into r_hoy, r_sem, r_deben, r_riesgo from', ', count(*) filter (where r.lista = ''no_viene'') into r_hoy, r_sem, r_deben, r_riesgo, r_no_vienen from'],
    -- el número
    array['elsif k = ''deben'' then', 'elsif k = ''no_vienen'' then
      v := r_no_vienen;
    elsif k = ''deben'' then']];
begin
  def := pg_get_functiondef('public.numeros_inicio(uuid, uuid)'::regprocedure);
  if position('''no_vienen''' in def) > 0 then return; end if;
  nuevo := def;
  foreach par slice 1 in array parches loop
    de := par[1]; a := par[2];
    veces := (length(nuevo) - length(replace(nuevo, de, ''))) / length(de);
    if veces <> 1 then raise exception 'numeros_inicio: el trozo % aparece % veces (tiene que ser 1); la función cambió', de, veces; end if;
    nuevo := replace(nuevo, de, a);
  end loop;
  execute nuevo;
end $m$;
revoke all on function public.numeros_inicio(uuid, uuid), public.guardar_numeros_inicio(uuid, text[]) from public, anon, authenticated;
grant execute on function public.numeros_inicio(uuid, uuid), public.guardar_numeros_inicio(uuid, text[]) to authenticated, service_role;

-- ── 4. Socios: Vence y Última vez ───────────────────────────────────
-- Dos columnas más al final (el código viejo lee por nombre). Cambia la forma de lo que devuelve: la vieja se borra acá mismo.
-- La última entrada sale del índice ingresos_socio (gimnasio, socio, momento desc): una búsqueda por fila de la página, no un recorrido.
drop function if exists public.buscar_socios(uuid, text, integer, uuid, text, uuid, text);
create function public.buscar_socios(p_gimnasio_id uuid, p_texto text, p_limite integer default 30, p_etiqueta uuid default null,
                                     p_estado text default null, p_plan uuid default null, p_origen text default null)
returns table (socio_id uuid, numero integer, nombre text, telefono text, dni text, plan text, color text, texto text, puede boolean,
               dado_de_baja boolean, autoalta boolean, vence timestamptz, ultima_vez timestamptz, dejo_de_venir boolean)
language plpgsql security definer set search_path = '' as $function$
declare e public.equipo; t text := privado.sin_acentos(lower(trim(coalesce(p_texto, '')))); digitos text;
        por_estado boolean := coalesce(p_estado in ('al_dia', 'por_vencer', 'vencidos', 'en_pausa', 'sin_plan'), false);
        ausencia int;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select c.retencion_dias_ausencia into ausencia from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  if p_limite is null or p_limite < 1 or p_limite > 600 then raise exception 'El límite va de 1 a 600'; end if;
  if p_estado is not null and not por_estado and p_estado not in ('nuevos', 'bajas') then raise exception 'Filtro desconocido: %', p_estado; end if;
  if p_origen is not null and p_origen <> 'web' then raise exception 'Filtro desconocido: %', p_origen; end if;
  digitos := regexp_replace(t, '\D', '', 'g');
  return query
  with candidatos as (
    select s.*, (s.dado_de_baja_en is not null) as baja from public.socios s
     where s.gimnasio_id = p_gimnasio_id
       and (p_etiqueta is null or exists (select 1 from public.socio_etiquetas se where se.gimnasio_id = p_gimnasio_id
                                            and se.socio_id = s.id and se.etiqueta_id = p_etiqueta))
       and (p_plan is null or exists (select 1 from public.suscripciones su where su.socio_id = s.id and su.baja_en is null and su.plan_id = p_plan))
       and (p_origen is null or s.origen = 'alta_web')
       and (p_estado is null or (p_estado = 'bajas') = (s.dado_de_baja_en is not null))
       and (p_estado is distinct from 'nuevos' or s.creado_en > now() - interval '30 days')
       and (t = ''
         or privado.sin_acentos(lower(s.nombre || ' ' || s.apellido)) like '%' || t || '%'
         or privado.sin_acentos(lower(s.apellido || ' ' || s.nombre)) like '%' || t || '%'
         or (length(t) >= 4 and (extensions.word_similarity(t, privado.sin_acentos(lower(s.nombre || ' ' || s.apellido))) >= 0.6
                                 or extensions.word_similarity(t, privado.sin_acentos(lower(s.apellido || ' ' || s.nombre))) >= 0.6))
         or (length(digitos) >= 3 and (s.dni like digitos || '%' or regexp_replace(coalesce(s.telefono, ''), '\D', '', 'g') like '%' || digitos || '%'))
         or (digitos <> '' and s.numero::text = digitos))
     order by (s.dado_de_baja_en is not null), s.nombre, s.apellido
     limit case when por_estado then null else p_limite end
  ), elegidos as (
    select s.id, s.numero, s.nombre, s.apellido, s.telefono, s.dni, s.baja, s.origen, s.cubierto_hasta, s.creado_en, v.color, v.texto, v.puede
      from (select c.* from candidatos c order by c.baja, c.nombre, c.apellido) s
      cross join lateral privado.calcular_acceso(s.id, now(), e.sede_id) v
     where not por_estado or privado.grupo_estado(v.color, v.motivo) = p_estado
     order by s.baja, s.nombre, s.apellido
     limit p_limite
  )
  select s.id, s.numero, trim(s.nombre || ' ' || s.apellido), s.telefono, s.dni,
         (select pl.nombre from public.suscripciones su join public.planes pl on pl.id = su.plan_id
           where su.socio_id = s.id and su.baja_en is null order by su.inicio desc limit 1),
         s.color, s.texto, s.puede, s.baja, (s.origen = 'alta_web'), s.cubierto_hasta, u.momento,
         -- "Dejó de venir": la misma regla que la lista no_viene de Retención (puede entrar y no vino en los días de ausencia del gimnasio).
         (not s.baja and s.puede and coalesce(u.momento, s.creado_en) <= now() - make_interval(days => coalesce(ausencia, 14)))
    from elegidos s
    left join lateral (select i.momento from public.ingresos i
           where i.gimnasio_id = p_gimnasio_id and i.socio_id = s.id and i.anulado_en is null and i.resultado <> 'rechazado'
           order by i.momento desc limit 1) u on true
   order by s.baja, s.nombre, s.apellido;
end $function$;
revoke all on function public.buscar_socios(uuid, text, integer, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.buscar_socios(uuid, text, integer, uuid, text, uuid, text) to authenticated, service_role;

-- ── 5. Ficha: veces este mes y semanas seguidas ─────────────────────
do $m$
declare def text; de text := '''acceso'', to_jsonb(v),'; veces int;
begin
  def := pg_get_functiondef('public.ficha_socio(uuid)'::regprocedure);
  if position('''racha''' in def) > 0 then return; end if;
  veces := (length(def) - length(replace(def, de, ''))) / length(de);
  if veces <> 1 then raise exception 'ficha_socio: el trozo % aparece % veces (tiene que ser 1)', de, veces; end if;
  execute replace(def, de, de || ' ''racha'', public.racha_socio(s.id),');
end $m$;

-- ── 6. Caja: los movimientos del turno ──────────────────────────────
-- Los cobros salen de cobros_de_turnos (el mismo permiso: arqueo ciego, con el turno abierto solo el dueño y el encargado) y se suman los
-- ingresos y retiros de la caja. Solo lectura: no mueve plata.
create or replace function public.movimientos_turno(p_turno_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare cobros jsonb; movs jsonb; detalle jsonb;
begin
  if p_turno_id is null then raise exception 'Falta el turno' using errcode = '22023'; end if;
  cobros := public.cobros_de_turnos(array[p_turno_id]);   -- exige el permiso (o falla)
  select coalesce(jsonb_agg(jsonb_build_object('pago_id', p.id, 'detalle',
           (select string_agg(vi.descripcion, ' + ' order by vi.id) from public.venta_items vi where vi.venta_id = p.venta_id))), '[]'::jsonb)
    into detalle
    from public.pagos p join public.ventas v on v.id = p.venta_id
   where p.estado = 'aprobado' and (p.turno_caja_id = p_turno_id or v.turno_caja_id = p_turno_id);
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'tipo', m.tipo, 'monto', m.monto, 'motivo', m.motivo, 'en', m.creado_en,
           'por', (select q.nombre from public.equipo q where q.id = m.creado_por)) order by m.creado_en, m.id), '[]'::jsonb)
    into movs
    from public.movimientos_caja m where m.turno_caja_id = p_turno_id;
  return jsonb_build_object('cobros', cobros, 'detalle', detalle, 'movimientos', movs);
end $$;
revoke all on function public.movimientos_turno(uuid) from public, anon, authenticated;
grant execute on function public.movimientos_turno(uuid) to authenticated, service_role;

-- ── 7. El lote suma las lecturas nuevas (misma función, misma seguridad) ──
do $lote$
declare def text;
begin
  def := pg_get_functiondef('public.lote_lecturas(jsonb)'::regprocedure);
  if position('''inicio_semaforo''' in def) = 0 then
    if position('''resumen_app_socio'']' in def) = 0 then raise exception 'Guarda: la lista de lote_lecturas no termina como se esperaba (falta 20261119130000)'; end if;
    def := replace(def, '''resumen_app_socio'']', '''resumen_app_socio'',''inicio_semaforo'',''movimientos_turno'',''config_clases_panel'',''clases_del_dia'']');
    execute def;
  end if;
end $lote$;

-- ── 8. Decisiones de Mateo (25/11): los [demo] y todo gimnasio nuevo, en Pista con Semáforo ──
-- Solo los [demo]: los gimnasios reales (Temple Gym) no se tocan.
update public.configuracion_gimnasio c set estilo = 'pista'
  from public.gimnasios g where g.id = c.gimnasio_id and g.es_demo and c.estilo <> 'pista';
insert into public.funciones_nuevas_gimnasio (gimnasio_id, clave, activa, prendida_en, cambiada_en)
select g.id, 'pista_semaforo', true, now(), now() from public.gimnasios g where g.es_demo
on conflict (gimnasio_id, clave) do update set activa = true, prendida_en = coalesce(public.funciones_nuevas_gimnasio.prendida_en, now()), cambiada_en = now()
  where not public.funciones_nuevas_gimnasio.activa;

-- La función de alta única (todo alta pasa por acá: /super, la demo para un prospecto, la de prueba) deja el gimnasio en Pista con Semáforo.
do $m$
declare def text; de text := 'return jsonb_build_object(''gimnasio_id'', gid, ''equipo_id'', eid, ''host'', v_host);'; veces int;
begin
  def := pg_get_functiondef('public.admin_crear_gimnasio(text, text, text, text)'::regprocedure);
  if position('pista_semaforo' in def) > 0 then return; end if;
  veces := (length(def) - length(replace(def, de, ''))) / length(de);
  if veces <> 1 then raise exception 'admin_crear_gimnasio: el trozo % aparece % veces (tiene que ser 1)', de, veces; end if;
  execute replace(def, de,
    '-- Cierre para vender (25/11): todo gimnasio nuevo arranca en Pista con Semáforo.
  update public.configuracion_gimnasio set estilo = ''pista'' where gimnasio_id = gid;
  insert into public.funciones_nuevas_gimnasio (gimnasio_id, clave, activa, prendida_en, cambiada_en)
  values (gid, ''pista_semaforo'', true, now(), now()) on conflict (gimnasio_id, clave) do update set activa = true, cambiada_en = now();
  ' || de);
end $m$;
revoke all on function public.admin_crear_gimnasio(text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_crear_gimnasio(text, text, text, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $v$
declare f text;
begin
  foreach f in array array['public.config_clases_panel(uuid)', 'public.inicio_semaforo(uuid, uuid)', 'public.movimientos_turno(uuid)',
                           'public.buscar_socios(uuid, text, integer, uuid, text, uuid, text)', 'public.ficha_socio(uuid)', 'public.numeros_inicio(uuid, uuid)',
                           'public.guardar_numeros_inicio(uuid, text[])', 'public.admin_crear_gimnasio(text, text, text, text)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
    if not has_function_privilege('authenticated', f, 'execute') then raise exception 'Verificación: authenticated no puede ejecutar %', f; end if;
  end loop;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'buscar_socios') <> 1 then raise exception 'Verificación: tiene que quedar una sola buscar_socios'; end if;
  if pg_get_functiondef('public.numeros_inicio(uuid, uuid)'::regprocedure) not like '%r_no_vienen%' then raise exception 'Verificación: numeros_inicio sin no_vienen'; end if;
  if pg_get_functiondef('public.ficha_socio(uuid)'::regprocedure) not like '%racha_socio%' then raise exception 'Verificación: ficha_socio sin racha'; end if;
  if position('''inicio_semaforo''' in pg_get_functiondef('public.lote_lecturas(jsonb)'::regprocedure)) = 0 then raise exception 'Verificación: faltan las lecturas nuevas en lote_lecturas'; end if;
  if pg_get_functiondef('public.admin_crear_gimnasio(text, text, text, text)'::regprocedure) not like '%pista_semaforo%' then raise exception 'Verificación: el alta no deja Pista Semáforo'; end if;
  if exists (select 1 from public.configuracion_gimnasio where casi_lleno_pct is null) then raise exception 'Verificación: quedó una configuración sin casi_lleno_pct'; end if;
  if exists (select 1 from public.gimnasios g join public.configuracion_gimnasio c on c.gimnasio_id = g.id where g.es_demo and c.estilo <> 'pista') then
    raise exception 'Verificación: quedó un [demo] fuera de Pista';
  end if;
  if exists (select 1 from public.gimnasios g where g.es_demo and not exists (
               select 1 from public.funciones_nuevas_gimnasio x where x.gimnasio_id = g.id and x.clave = 'pista_semaforo' and x.activa)) then
    raise exception 'Verificación: quedó un [demo] sin pista_semaforo';
  end if;
end $v$;
