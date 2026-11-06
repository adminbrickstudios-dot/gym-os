-- VD-33b · Mi cuenta: qué sesiones tengo abiertas y si ya tengo contraseña.
-- Cada usuario ve SOLO las suyas (la función lee auth.sessions con auth.uid()).
-- No devuelve IP ni tokens: dispositivo (user agent), cuándo se abrió y la última actividad.
-- Cerrar las demás sesiones se hace por la API de auth (signOut scope 'others'), no acá.

do $$ begin
  if to_regclass('auth.sessions') is null then
    raise exception 'VD-33b: falta auth.sessions (en la base local la crea simular-supabase.sql)';
  end if;
end $$;

create or replace function public.mi_seguridad()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  yo uuid := auth.uid();
  actual uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  tiene boolean;
  lista jsonb;
begin
  if yo is null then
    raise exception 'Tenés que iniciar sesión' using errcode = '42501';
  end if;
  select (u.encrypted_password is not null and u.encrypted_password <> '') into tiene from auth.users u where u.id = yo;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'creada', s.created_at, 'actividad', coalesce(s.updated_at, s.created_at),
           'user_agent', s.user_agent, 'actual', s.id = actual)
         order by (s.id = actual) desc, coalesce(s.updated_at, s.created_at) desc), '[]'::jsonb)
    into lista
    from auth.sessions s
   where s.user_id = yo and (s.not_after is null or s.not_after > now());
  return jsonb_build_object('tiene_contrasena', coalesce(tiene, false), 'sesiones', lista);
end $$;

revoke execute on function public.mi_seguridad() from public, anon;
grant execute on function public.mi_seguridad() to authenticated;

do $$ begin
  if not has_function_privilege('authenticated', 'public.mi_seguridad()', 'execute')
     or has_function_privilege('anon', 'public.mi_seguridad()', 'execute') then
    raise exception 'VD-33b: permisos de mi_seguridad mal';
  end if;
end $$;
