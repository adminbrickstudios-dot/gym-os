-- FA-12 · Avisos en la app del socio, que SOLO avisan y no deciden nada (ni el acceso ni la plata):
--  · "Tu clase empieza en menos de 1 hora" (solo si el socio lo quiere: socios.aviso_clase_1h, apagado por defecto);
--  · "Mañana: <evento>" para el evento al que está anotado.
-- Se calculan al abrir la app (nada guardado como estado, sin cron). La parte del equipo (clase sin anotados 2 h antes, clase llena)
-- vive en la campana del panel y la hace el carril D.
--   avisos_app_socio(socio) · guardar_aviso_clase(socio, si)

do $g$ begin
  if to_regprocedure('privado.mis_socios()') is null then raise exception 'Guarda: falta privado.mis_socios'; end if;
  if to_regclass('public.evento_inscripciones') is null or to_regclass('public.eventos') is null then raise exception 'Guarda: faltan los eventos'; end if;
end $g$;

alter table public.socios add column if not exists aviso_clase_1h boolean not null default false;

create or replace function public.guardar_aviso_clase(p_socio_id uuid, p_si boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not exists (select 1 from public.socios s where s.id = p_socio_id and s.id in (select privado.mis_socios())) then
    raise exception 'Sin permiso o socio inexistente' using errcode = '42501';
  end if;
  update public.socios set aviso_clase_1h = coalesce(p_si, false) where id = p_socio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar'; end if;
end $$;

create or replace function public.avisos_app_socio(p_socio_id uuid, p_momento timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios; zona text; manana date; res jsonb := '[]'::jsonb;
begin
  select * into s from public.socios x where x.id = p_socio_id and x.id in (select privado.mis_socios());
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = s.gimnasio_id;
  manana := (p_momento at time zone zona)::date + 1;
  if s.aviso_clase_1h then
    res := res || coalesce((
      select jsonb_agg(jsonb_build_object('tipo', 'clase_pronto', 'clase_id', c.id, 'inicio', c.inicio,
               'texto', 'Tu clase de ' || a.nombre || ' empieza a las ' || to_char(c.inicio at time zone zona, 'HH24:MI') || '.') order by c.inicio)
        from public.reservas r join public.clases c on c.id = r.clase_id join public.actividades a on a.id = c.actividad_id
       where r.socio_id = s.id and r.estado = 'confirmada' and c.cancelada_en is null
         and c.inicio > p_momento and c.inicio <= p_momento + interval '1 hour'), '[]'::jsonb);
  end if;
  res := res || coalesce((
    select jsonb_agg(jsonb_build_object('tipo', 'evento_manana', 'evento_id', e.id, 'inicio', e.inicio,
             'texto', 'Mañana: ' || p.nombre || '.') order by e.inicio)
      from public.evento_inscripciones i join public.eventos e on e.id = i.evento_id and e.gimnasio_id = i.gimnasio_id
      join public.productos p on p.id = e.producto_id and p.gimnasio_id = e.gimnasio_id
     where i.socio_id = s.id and i.cancelada_en is null and e.cerrado_en is null
       and (e.inicio at time zone zona)::date = manana), '[]'::jsonb);
  return res;
end $$;

create or replace function public.aviso_clase_socio(p_socio_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v boolean;
begin
  select s.aviso_clase_1h into v from public.socios s where s.id = p_socio_id and s.id in (select privado.mis_socios());
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  return v;
end $$;

revoke all on function public.guardar_aviso_clase(uuid, boolean), public.avisos_app_socio(uuid, timestamptz), public.aviso_clase_socio(uuid) from public, anon, authenticated;
grant execute on function public.guardar_aviso_clase(uuid, boolean), public.avisos_app_socio(uuid, timestamptz), public.aviso_clase_socio(uuid) to authenticated, service_role;

do $v$
declare f text;
begin
  foreach f in array array['public.guardar_aviso_clase(uuid, boolean)', 'public.avisos_app_socio(uuid, timestamp with time zone)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $v$;
