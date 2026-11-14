-- F2.11 (SA-10) · Sesiones abiertas de un gimnasio y "Cerrar todas" (para cuando una persona del equipo se va mal). Solo el rol Principal de BRIK,
-- y para cerrar, con un motivo. Hasta hoy el super admin solo veía las suyas y la baja de un usuario cortaba las de ese usuario.
-- Qué se corta: las sesiones de las cuentas ACTIVAS del equipo de ESE gimnasio. No se tocan las de los administradores de BRIK ni las de la
-- entrada de soporte, ni nada del socio. Si la misma cuenta está en otro gimnasio, también tiene que volver a entrar ahí: la lista lo dice.
-- Queda en el registro de BRIK con el motivo y cuántas se cerraron.
do $g$ begin
  if to_regclass('auth.sessions') is null then raise exception 'Guarda: falta auth.sessions (en la base local la crea simular-supabase.sql)'; end if;
  if to_regprocedure('privado.exigir_brik(text[])') is null then raise exception 'Guarda: falta privado.exigir_brik'; end if;
end $g$;

create or replace function public.admin_sesiones_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lista jsonb;
begin
  perform privado.exigir_brik(array['principal']);
  if not exists (select 1 from public.gimnasios g where g.id = p_gimnasio_id) then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'sesion_id', s.id, 'equipo_id', e.id, 'nombre', e.nombre, 'rol', e.rol, 'mail', u.email,
           'creada', s.created_at, 'actividad', coalesce(s.updated_at, s.created_at), 'dispositivo', s.user_agent,
           'tambien_en_otros', exists (select 1 from public.equipo o where o.usuario_id = e.usuario_id and o.gimnasio_id <> p_gimnasio_id and o.activo))
         order by coalesce(s.updated_at, s.created_at) desc), '[]'::jsonb)
    into lista
    from public.equipo e
    join auth.users u on u.id = e.usuario_id
    join auth.sessions s on s.user_id = e.usuario_id and (s.not_after is null or s.not_after > now())
   where e.gimnasio_id = p_gimnasio_id and e.activo and not e.es_soporte
     and not exists (select 1 from public.administradores_plataforma a where a.usuario_id = e.usuario_id);
  return lista;
end $$;
revoke execute on function public.admin_sesiones_gimnasio(uuid) from public, anon;
grant execute on function public.admin_sesiones_gimnasio(uuid) to authenticated;

create or replace function public.admin_cerrar_sesiones_gimnasio(p_gimnasio_id uuid, p_motivo text) returns int
language plpgsql security definer set search_path = '' as $$
declare motivo text := btrim(coalesce(p_motivo, '')); n int;
begin
  perform privado.exigir_brik(array['principal']);
  if char_length(motivo) < 10 then raise exception 'Escribí el motivo (al menos 10 letras): queda en el registro' using errcode = '22023'; end if;
  if not exists (select 1 from public.gimnasios g where g.id = p_gimnasio_id) then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  with cerradas as (
    delete from auth.sessions s
     where s.user_id in (
       select e.usuario_id from public.equipo e
        where e.gimnasio_id = p_gimnasio_id and e.activo and not e.es_soporte
          and not exists (select 1 from public.administradores_plataforma a where a.usuario_id = e.usuario_id))
    returning 1)
  select count(*) into n from cerradas;
  perform privado.registrar_brik('cerrar_sesiones_gimnasio', p_gimnasio_id, jsonb_build_object('motivo', motivo, 'sesiones', n));
  return n;
end $$;
revoke execute on function public.admin_cerrar_sesiones_gimnasio(uuid, text) from public, anon;
grant execute on function public.admin_cerrar_sesiones_gimnasio(uuid, text) to authenticated;

do $v$ begin
  if has_function_privilege('anon', 'public.admin_sesiones_gimnasio(uuid)', 'execute') then raise exception 'Verificación: anon puede listar sesiones'; end if;
  if has_function_privilege('anon', 'public.admin_cerrar_sesiones_gimnasio(uuid, text)', 'execute') then raise exception 'Verificación: anon puede cerrar sesiones'; end if;
end $v$;
