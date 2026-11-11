-- Carril B · PLAT-05: el registro de BRIK anota lo que se hace con la API de Vercel (agregar y verificar dominios).
-- Lo hace el servidor DESPUÉS de hablar con Vercel, con la sesión del principal: la base solo deja anotar acciones de una lista corta.

do $$
begin
  if to_regprocedure('privado.registrar_brik(text,uuid,jsonb)') is null then raise exception 'Guarda: falta privado.registrar_brik'; end if;
  if to_regprocedure('privado.exigir_brik(text[])') is null then raise exception 'Guarda: falta privado.exigir_brik'; end if;
end $$;

create or replace function public.admin_anotar_registro(p_accion text, p_gimnasio_id uuid, p_detalle jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal']);
  if p_accion not in ('agregar_dominio_vercel', 'verificar_dominio_vercel') then raise exception 'Esa acción no se anota desde acá' using errcode = '22023'; end if;
  if p_gimnasio_id is not null and not exists (select 1 from public.gimnasios where id = p_gimnasio_id) then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  -- El detalle es chico y sin claves: solo el dominio y el estado.
  perform privado.registrar_brik(p_accion, p_gimnasio_id, jsonb_build_object('dominio', left(coalesce(p_detalle ->> 'dominio', ''), 120), 'estado', left(coalesce(p_detalle ->> 'estado', ''), 20)));
end $$;
revoke execute on function public.admin_anotar_registro(text, uuid, jsonb) from public, anon;
grant execute on function public.admin_anotar_registro(text, uuid, jsonb) to authenticated;

do $$
begin
  if to_regprocedure('public.admin_anotar_registro(text,uuid,jsonb)') is null then raise exception 'Falta admin_anotar_registro'; end if;
  if has_function_privilege('anon', 'public.admin_anotar_registro(text,uuid,jsonb)', 'execute') then raise exception 'anon puede ejecutar admin_anotar_registro'; end if;
end $$;
