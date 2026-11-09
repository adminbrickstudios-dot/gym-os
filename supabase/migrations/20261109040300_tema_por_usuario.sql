-- BASE-6 (carril D) · Tema claro u oscuro elegible por cada persona del equipo (D37).
-- Se guarda en equipo.preferencias ->> 'tema' ('claro' | 'oscuro'; sin valor = el del gimnasio). Es una preferencia de pantalla, no un
-- estado del negocio. La pantalla además lo deja en la cookie "tema" para pintar sin esperar a la base (la cookie la lee el layout).
-- Aditiva e idempotente.

do $g$ begin
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'BASE-6: falta privado.exigir_equipo'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'equipo' and column_name = 'preferencias') then
    raise exception 'BASE-6: falta equipo.preferencias';
  end if;
end $g$;

create or replace function public.guardar_tema_usuario(p_gimnasio_id uuid, p_tema text) returns text
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; n int;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  if p_tema is not null and p_tema not in ('claro', 'oscuro') then raise exception 'El tema es claro u oscuro' using errcode = '22023'; end if;
  update public.equipo set preferencias = case when p_tema is null then preferencias - 'tema' else preferencias || jsonb_build_object('tema', p_tema) end
   where id = e.id and gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar el tema'; end if;
  return p_tema;
end $$;

create or replace function public.mi_tema(p_gimnasio_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  return (select q.preferencias ->> 'tema' from public.equipo q where q.id = e.id);
end $$;

revoke all on function public.guardar_tema_usuario(uuid, text), public.mi_tema(uuid) from public, anon, authenticated;
grant execute on function public.guardar_tema_usuario(uuid, text), public.mi_tema(uuid) to authenticated, service_role;

do $v$ begin
  if has_function_privilege('anon', 'public.guardar_tema_usuario(uuid, text)', 'execute') or has_function_privilege('anon', 'public.mi_tema(uuid)', 'execute') then
    raise exception 'BASE-6: el tema no es para anónimos';
  end if;
end $v$;
