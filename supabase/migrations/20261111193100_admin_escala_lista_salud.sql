-- Carril F9 · F9.5 (ESC-04) · Dos funciones del super admin que con 1.000 gimnasios tardaban segundos (medido: 3,8 s la lista, 1,2 s la salud).
--  · admin_lista_gimnasios: "entradas de hoy" comparaba el día local de CADA ingreso de cada gimnasio (recorría todos los ingresos de la
--    plataforma); ahora usa el rango [medianoche, medianoche + 1 día) del gimnasio, que entra por el índice (gimnasio_id, momento). Mismo resultado.
--  · admin_salud_v2: armaba el resultado pegando un objeto jsonb por gimnasio (cuadrático); ahora junta las claves y los valores y arma el objeto una vez.
-- Mismos permisos que antes (create or replace los conserva). No cambia qué ve cada uno.

do $$
begin
  if to_regprocedure('public.admin_salud_v2()') is null then raise exception 'Guarda: falta admin_salud_v2'; end if;
  if to_regprocedure('public.admin_lista_gimnasios(text, text, text, text, date, date, text, text, boolean)') is null then raise exception 'Guarda: falta admin_lista_gimnasios'; end if;
  if to_regprocedure('privado.medianoche(date, text)') is null then raise exception 'Guarda: falta privado.medianoche'; end if;
end $$;

CREATE OR REPLACE FUNCTION public.admin_salud_v2()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record; res jsonb := '{}'::jsonb; claves text[] := '{}'; valores jsonb[] := '{}'; rojos text[]; amarillos text[]; color text; abono text; dias int; orden int;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  for r in
    select g.id, g.es_demo, g.creado_en, g.suspension_manual_en is not null as suspendido,
           (select max(u.last_sign_in_at) from public.equipo e join auth.users u on u.id = e.usuario_id
             where e.gimnasio_id = g.id and e.activo and not e.es_soporte) as ultimo,
           (select count(*)::int from public.socios s where s.gimnasio_id = g.id and s.dado_de_baja_en is null) as socios,
           (select count(*)::int from public.ventas v where v.gimnasio_id = g.id and v.estado = 'confirmada' and v.anulada_en is null and v.confirmada_en > now() - interval '7 days') as ventas,
           (select count(*)::int from public.ingresos i where i.gimnasio_id = g.id and i.anulado_en is null and i.resultado <> 'rechazado' and i.momento > now() - interval '7 days') as entradas,
           not exists (select 1 from public.equipo e where e.gimnasio_id = g.id and e.rol = 'dueno' and e.activo and not e.es_soporte and e.usuario_id is not null) as sin_dueno,
           (select count(*)::int from public.ayudas_brik a where a.gimnasio_id = g.id and a.resuelta_en is null) as ayudas
      from public.gimnasios g
  loop
    rojos := '{}'; amarillos := '{}';
    abono := privado.estado_abono(r.id) ->> 'estado';
    dias := case when r.ultimo is null then null else floor(extract(epoch from (now() - r.ultimo)) / 86400)::int end;
    if not r.es_demo then
      if abono = 'vencido' then rojos := array_append(rojos, 'Abono a BRIK vencido'::text); end if;
      if r.suspendido then rojos := array_append(rojos, 'Suspendido'::text); end if;
      if r.socios > 0 and r.entradas = 0 and r.creado_en < now() - interval '7 days' then rojos := array_append(rojos, 'Nadie entró en 7 días'::text); end if;
      if r.socios = 0 or r.sin_dueno then
        amarillos := array_append(amarillos, (case when r.sin_dueno then 'Alta sin terminar: el dueño no tiene acceso' else 'Alta sin terminar: todavía no tiene socios' end)::text);
      end if;
      if r.creado_en < now() - interval '3 days' and (r.ultimo is null or r.ultimo < now() - interval '3 days') and not r.sin_dueno then
        amarillos := array_append(amarillos, ('El equipo no entra al panel hace ' || coalesce(dias::text, 'mucho') || ' días')::text); end if;
      if abono = 'por_vencer' then amarillos := array_append(amarillos, 'El abono a BRIK está por vencer'::text); end if;
      if r.ayudas > 0 then amarillos := array_append(amarillos, (case when r.ayudas = 1 then 'Pidió ayuda y está sin responder' else r.ayudas::text || ' pedidos de ayuda sin responder' end)::text); end if;
    end if;
    color := case when r.es_demo then 'verde' when cardinality(rojos) > 0 then 'rojo' when cardinality(amarillos) > 0 then 'amarillo' else 'verde' end;
    orden := case when r.es_demo then 3 when color = 'rojo' then 0 when color = 'amarillo' then 1 else 2 end;
    claves := array_append(claves, r.id::text);
    valores := array_append(valores, jsonb_build_object(
      'color', color, 'orden', orden, 'puntaje', cardinality(rojos) * 10 + cardinality(amarillos),
      'motivos', to_jsonb(rojos || amarillos),
      'ultimo_acceso_equipo', r.ultimo, 'ventas_7_dias', r.ventas, 'entradas_7_dias', r.entradas, 'ayudas_pendientes', r.ayudas,
      'abono', abono));
  end loop;
  res := coalesce((select jsonb_object_agg(k, v) from unnest(claves, valores) as t(k, v)), '{}'::jsonb);
  return res;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_lista_gimnasios(p_q text DEFAULT NULL::text, p_salud text DEFAULT NULL::text, p_abono text DEFAULT NULL::text, p_plan text DEFAULT NULL::text, p_alta_desde date DEFAULT NULL::date, p_alta_hasta date DEFAULT NULL::date, p_ciudad text DEFAULT NULL::text, p_modulo text DEFAULT NULL::text, p_con_bajas boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare salud jsonb; v_q text := lower(btrim(coalesce(p_q, ''))); v_res jsonb;
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  if p_salud is not null and p_salud not in ('verde', 'amarillo', 'rojo') then raise exception 'Salud: verde, amarillo o rojo' using errcode = '22023'; end if;
  if p_abono is not null and p_abono not in ('al_dia', 'por_vencer', 'vencido', 'sin_abono') then raise exception 'Abono: al_dia, por_vencer, vencido o sin_abono' using errcode = '22023'; end if;
  if p_modulo is not null and not (array[p_modulo] <@ privado.secciones_validas()) then raise exception 'Ese módulo no existe' using errcode = '22023'; end if;
  salud := public.admin_salud_v2();
  select coalesce(jsonb_agg(f.fila order by f.favorito desc, f.orden, f.nombre), '[]'::jsonb) into v_res from (
    select r.nombre, r.favorito, coalesce((salud -> r.id::text ->> 'orden')::int, 2) as orden,
           jsonb_build_object('gimnasio_id', r.id, 'slug', r.slug, 'nombre', r.nombre, 'es_demo', r.es_demo, 'alta', r.creado_en, 'favorito', r.favorito,
             'suspendido', r.suspendido, 'para_borrar', r.baja_en is not null, 'demo_vencida', r.es_demo and r.demo_hasta is not null and r.demo_hasta < now(), 'ciudad', r.ciudad,
             'socios_activos', r.socios, 'entradas_hoy', r.entradas_hoy, 'ultimo_uso', r.ultimo_uso,
             'abono', r.abono -> 'estado', 'plan', r.abono -> 'plan', 'color', salud -> r.id::text -> 'color', 'motivos', salud -> r.id::text -> 'motivos',
             'dueno', r.dueno, 'dueno_telefono', r.dueno_telefono, 'hosts', r.hosts, 'modulos_apagados', to_jsonb(r.apagadas)) as fila
      from (
        select g.id, g.slug, g.nombre, g.es_demo, g.creado_en, g.baja_en, g.demo_hasta, g.suspension_manual_en is not null as suspendido,
               c.ciudad, coalesce(c.secciones_apagadas, '{}'::text[]) as apagadas,
               exists (select 1 from public.favoritos_brik f where f.usuario_id = auth.uid() and f.gimnasio_id = g.id) as favorito,
               (select count(*)::int from public.socios s where s.gimnasio_id = g.id and s.dado_de_baja_en is null) as socios,
               (select count(*)::int from public.ingresos i where i.gimnasio_id = g.id and i.anulado_en is null and i.resultado <> 'rechazado'
                   and i.momento >= privado.medianoche(privado.dia_local(now(), g.zona_horaria), g.zona_horaria)
                   and i.momento < privado.medianoche(privado.dia_local(now(), g.zona_horaria) + 1, g.zona_horaria)) as entradas_hoy,
               (select max(u.last_sign_in_at) from public.equipo e join auth.users u on u.id = e.usuario_id
                 where e.gimnasio_id = g.id and e.activo and not e.es_soporte) as ultimo_uso,
               privado.estado_abono(g.id) as abono,
               (select e.nombre from public.equipo e where e.gimnasio_id = g.id and e.rol = 'dueno' and e.activo and not e.es_soporte order by e.creado_en limit 1) as dueno,
               (select u.email from public.equipo e join auth.users u on u.id = e.usuario_id where e.gimnasio_id = g.id and e.rol = 'dueno' and e.activo and not e.es_soporte order by e.creado_en limit 1) as dueno_mail,
               (select u.phone from public.equipo e join auth.users u on u.id = e.usuario_id where e.gimnasio_id = g.id and e.rol = 'dueno' and e.activo and not e.es_soporte order by e.creado_en limit 1) as dueno_telefono,
               array(select d.host from public.dominios_gimnasio d where d.gimnasio_id = g.id order by d.tipo desc, d.host) as hosts
          from public.gimnasios g left join public.configuracion_gimnasio c on c.gimnasio_id = g.id
      ) r
     where (coalesce(p_con_bajas, false) or r.baja_en is null)
       and (v_q = '' or lower(r.nombre || ' ' || r.slug || ' ' || coalesce(r.ciudad, '') || ' ' || coalesce(r.dueno, '') || ' ' || coalesce(r.dueno_mail, '') || ' ' || coalesce(r.dueno_telefono, '') || ' ' || array_to_string(r.hosts, ' ')) like '%' || v_q || '%')
       and (p_salud is null or salud -> r.id::text ->> 'color' = p_salud)
       and (p_abono is null or r.abono ->> 'estado' = p_abono)
       and (p_plan is null or lower(r.abono ->> 'plan') = lower(p_plan))
       and (p_ciudad is null or lower(coalesce(r.ciudad, '')) = lower(btrim(p_ciudad)))
       and (p_modulo is null or not (p_modulo = any (r.apagadas)))
       and (p_alta_desde is null or r.creado_en >= p_alta_desde::timestamptz)
       and (p_alta_hasta is null or r.creado_en < (p_alta_hasta + 1)::timestamptz)
  ) f;
  return v_res;
end $function$;

-- Verificación: siguen cerradas a anónimos y con search_path vacío.
do $v$
declare f text;
begin
  foreach f in array array['public.admin_salud_v2()', 'public.admin_lista_gimnasios(text, text, text, text, date, date, text, text, boolean)'] loop
    if has_function_privilege('anon', f::regprocedure, 'execute') then raise exception 'F9: anon puede ejecutar %', f; end if;
    if not coalesce((select 'search_path=""' = any (p.proconfig) from pg_proc p where p.oid = f::regprocedure), false) then raise exception 'F9: % sin search_path vacío', f; end if;
  end loop;
end $v$;
