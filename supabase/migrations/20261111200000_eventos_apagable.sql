-- Eventos se puede apagar desde Configuración → Secciones.
-- Un gimnasio con Eventos apagado no ve nada de eventos: ni en el panel, ni en la página pública, ni en la app del socio,
-- ni en la ventana de la Entrada. No se borra nada: los eventos y las inscripciones quedan guardados; al prender de nuevo, vuelven.
-- Las funciones de lectura devuelven lista vacía mientras la sección está apagada (apagado = no hay eventos que mostrar, no un permiso denegado).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.eventos') is null then raise exception 'Guarda: falta la tabla public.eventos'; end if;
  if to_regprocedure('privado.secciones_validas()') is null then raise exception 'Guarda: falta privado.secciones_validas()'; end if;
  if to_regprocedure('privado.evento_json(public.eventos, boolean)') is null then raise exception 'Guarda: falta privado.evento_json'; end if;
end $$;

-- ── La sección "eventos" es válida ──────────────────────────────────
do $$
declare actuales text[];
begin
  actuales := privado.secciones_validas();
  if not ('eventos' = any (actuales)) then
    execute format('create or replace function privado.secciones_validas() returns text[] language sql immutable set search_path = '''' as $f$ select %L::text[] $f$',
                   array_append(actuales, 'eventos'));
  end if;
  alter table public.configuracion_gimnasio drop constraint if exists configuracion_secciones_validas;
  alter table public.configuracion_gimnasio add constraint configuracion_secciones_validas
    check (secciones_apagadas <@ privado.secciones_validas());
end $$;

-- ── ¿Eventos está apagado en este gimnasio? ─────────────────────────
create or replace function privado.eventos_apagado(p_gimnasio_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select 'eventos' = any (c.secciones_apagadas) from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id), false)
$$;
revoke execute on function privado.eventos_apagado(uuid) from public, anon, authenticated;

-- ── Lecturas: iguales a las vigentes, con la guarda de apagado ──────
create or replace function public.eventos_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if privado.eventos_apagado(p_gimnasio_id) then return '[]'; end if;
  return coalesce((select jsonb_agg(privado.evento_json(ev, true)
      order by (ev.cerrado_en is null and privado.evento_ultima(ev) > now() - interval '1 day') desc, ev.inicio)
    from public.eventos ev where ev.gimnasio_id = p_gimnasio_id and (ev.cerrado_en is null or ev.cerrado_en > now() - interval '30 days')), '[]');
end $$;

create or replace function public.eventos_publicos(p_host text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select d.gimnasio_id into g from public.dominios_gimnasio d where d.host = lower(p_host);
  if g is null then return '[]'; end if;
  if not exists (select 1 from public.landing_gimnasio l where l.gimnasio_id = g and l.publicada) then return '[]'; end if;
  if privado.eventos_apagado(g) then return '[]'; end if;
  return coalesce((select jsonb_agg(privado.evento_json(ev, false) order by ev.inicio)
    from public.eventos ev where ev.gimnasio_id = g and ev.cerrado_en is null and not ev.borrador and privado.evento_ultima(ev) > now()), '[]');
end $$;

create or replace function public.eventos_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.socios where id = p_socio_id;
  if privado.eventos_apagado(s.gimnasio_id) then return '[]'; end if;
  return coalesce((
    select jsonb_agg(x.j order by x.orden) from (
      select privado.evento_json(ev, false) || jsonb_build_object(
               'anotado', exists (select 1 from jsonb_array_elements(privado.evento_gente(ev)->'anotados') a where a->>'socio_id' = s.id::text),
               'en_espera_pos', (select (w->>'posicion')::int from jsonb_array_elements(privado.evento_gente(ev)->'espera') w where w->>'socio_id' = s.id::text limit 1),
               'puede_cancelar', exists (select 1 from public.evento_inscripciones i where i.evento_id = ev.id and i.socio_id = s.id and i.cancelada_en is null)
                 and not exists (select 1 from public.venta_items vi join public.ventas v on v.id = vi.venta_id
                                  where vi.producto_id = ev.producto_id and vi.tipo = 'producto' and v.estado <> 'anulada' and v.socio_id = s.id),
               'mi_precio', coalesce(ev.precio_socio, (select pr.precio from public.productos pr where pr.id = ev.producto_id)),
               'cuando_cerca', (select case when d = (now() at time zone gi.zona_horaria)::date then 'hoy'
                                            when d = (now() at time zone gi.zona_horaria)::date + 1 then 'manana' end
                                  from unnest(privado.evento_fechas(ev)) f, public.gimnasios gi, lateral (select (f at time zone gi.zona_horaria)::date as d) dd
                                 where gi.id = ev.gimnasio_id and (f at time zone gi.zona_horaria)::date between (now() at time zone gi.zona_horaria)::date and (now() at time zone gi.zona_horaria)::date + 1
                                 order by f limit 1),
               'cancelado', false) as j, ev.inicio as orden
        from public.eventos ev
       where ev.gimnasio_id = s.gimnasio_id and ev.cerrado_en is null and not ev.borrador and privado.evento_ultima(ev) > now()
      union all
      -- Se cancelaron hace poco y yo estaba anotado: la app lo avisa una semana.
      select privado.evento_json(ev, false) || jsonb_build_object('anotado', false, 'cancelado', true), ev.inicio
        from public.eventos ev
       where ev.gimnasio_id = s.gimnasio_id and ev.cerrado_motivo = 'cancelado' and ev.cerrado_en > now() - interval '7 days'
         and exists (select 1 from public.evento_inscripciones i where i.evento_id = ev.id and i.socio_id = s.id)
    ) x), '[]');
end $$;

create or replace function public.eventos_del_dia_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios; zona text; hoy date;
begin
  select * into s from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(s.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if privado.eventos_apagado(s.gimnasio_id) then return '[]'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = s.gimnasio_id;
  hoy := (now() at time zone zona)::date;
  return coalesce((
    select jsonb_agg(jsonb_build_object('evento_id', ev.id,
        'nombre', regexp_replace(pr.nombre, '^🎟️ (.*) · \d\d/\d\d \d\d:\d\d$', '\1'),
        'espera', (x.gente->'anotados') is not null and not exists (select 1 from jsonb_array_elements(x.gente->'anotados') a where a->>'socio_id' = s.id::text),
        'presente', exists (select 1 from public.evento_asistencias a where a.evento_id = ev.id and a.socio_id = s.id and a.dia = hoy),
        'inscripcion_id', (select i.id from public.evento_inscripciones i where i.evento_id = ev.id and i.socio_id = s.id and i.cancelada_en is null limit 1)))
      from public.eventos ev
      join public.productos pr on pr.id = ev.producto_id
      cross join lateral (select privado.evento_gente(ev) as gente) x
     where ev.gimnasio_id = s.gimnasio_id and ev.cerrado_en is null and not ev.borrador
       and exists (select 1 from unnest(privado.evento_fechas(ev)) f where (f at time zone zona)::date = hoy)
       and (exists (select 1 from jsonb_array_elements(x.gente->'anotados') a where a->>'socio_id' = s.id::text)
         or exists (select 1 from jsonb_array_elements(x.gente->'espera') a where a->>'socio_id' = s.id::text))), '[]');
end $$;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not ('eventos' = any (privado.secciones_validas())) then raise exception 'Verificación: eventos no es una sección válida'; end if;
  foreach f in array array['public.eventos_panel(uuid)', 'public.eventos_publicos(text)', 'public.eventos_socio(uuid)', 'public.eventos_del_dia_socio(uuid)'] loop
    if not exists (select 1 from pg_proc p where p.oid = f::regprocedure and p.prosrc like '%eventos_apagado%') then raise exception 'Verificación: % no mira si Eventos está apagado', f; end if;
    if not exists (select 1 from pg_proc p where p.oid = f::regprocedure and exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')) then raise exception 'Verificación: % sin search_path', f; end if;
  end loop;
  if has_function_privilege('anon', 'privado.eventos_apagado(uuid)', 'execute') or has_function_privilege('authenticated', 'privado.eventos_apagado(uuid)', 'execute') then
    raise exception 'Verificación: privado.eventos_apagado ejecutable de más';
  end if;
end $$;
