-- FA-9 (carril D) · Socios: selección múltiple (WhatsApp, etiqueta, exportar). Antes de mandar un mensaje a varios hay que saber a cuáles
-- NO se les escribe (la marca "no escribirle", VD-46N). Esta función recibe los socios elegidos y devuelve los que tienen la marca,
-- para sacarlos del envío. Solo dueño, encargado y recepción; solo socios de su gimnasio. Aditiva e idempotente.

do $g$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'socios' and column_name = 'no_escribirle_en') then
    raise exception 'FA-9: falta socios.no_escribirle_en';
  end if;
end $g$;

create or replace function public.no_escribirles_de(p_gimnasio_id uuid, p_socio_ids uuid[]) returns uuid[]
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if coalesce(cardinality(p_socio_ids), 0) > 600 then raise exception 'Son demasiados socios juntos (hasta 600)' using errcode = '22023'; end if;
  return coalesce((select array_agg(s.id) from public.socios s
                    where s.gimnasio_id = p_gimnasio_id and s.id = any (coalesce(p_socio_ids, '{}')) and s.no_escribirle_en is not null), '{}');
end $$;

revoke all on function public.no_escribirles_de(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.no_escribirles_de(uuid, uuid[]) to authenticated, service_role;

do $v$ begin
  if has_function_privilege('anon', 'public.no_escribirles_de(uuid, uuid[])', 'execute') then raise exception 'FA-9: no es para anónimos'; end if;
end $v$;
