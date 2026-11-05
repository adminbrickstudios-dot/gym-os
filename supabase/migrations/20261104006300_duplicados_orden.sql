-- 0063 · Posibles duplicados: los de mismo celular y los más nuevos primero.
-- posibles_duplicados (0040) cortaba en 100 pares sin orden: con muchos
-- nombres parecidos, un par con el mismo celular recién cargado podía no
-- aparecer. Ahora el corte se hace después de ordenar.

do $$
begin
  if to_regprocedure('public.posibles_duplicados(uuid)') is null then raise exception 'Guarda: falta posibles_duplicados (0040)'; end if;
  if to_regclass('public.pedidos_anulacion') is null then raise exception 'Guarda: falta la migración 0062'; end if;
end $$;

create or replace function public.posibles_duplicados(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return (select coalesce(jsonb_agg(x order by x ->> 'motivo', x ->> 'a_nombre'), '[]') from (
    select jsonb_build_object(
      'motivo', case when a.telefono = b.telefono then 'Mismo celular' else 'Nombre casi igual' end,
      'a', a.id, 'a_numero', a.numero, 'a_nombre', trim(a.nombre || ' ' || a.apellido), 'a_dni', a.dni, 'a_telefono', a.telefono, 'a_alta', a.creado_en,
      'b', b.id, 'b_numero', b.numero, 'b_nombre', trim(b.nombre || ' ' || b.apellido), 'b_dni', b.dni, 'b_telefono', b.telefono, 'b_alta', b.creado_en) as x
      from public.socios a join public.socios b on b.gimnasio_id = a.gimnasio_id and a.numero < b.numero
     where a.gimnasio_id = p_gimnasio_id and a.dado_de_baja_en is null and b.dado_de_baja_en is null
       and not (a.dni is not null and b.dni is not null and a.dni <> b.dni)   -- con DNI distinto son dos personas
       and (a.telefono = b.telefono
            or extensions.similarity(privado.sin_acentos(lower(a.nombre || ' ' || a.apellido)), privado.sin_acentos(lower(b.nombre || ' ' || b.apellido))) >= 0.75)
     -- Primero los de mismo celular (casi seguro la misma persona) y los más nuevos: con más de 100, esos no se pierden.
     order by (a.telefono is not null and a.telefono = b.telefono) desc, greatest(a.creado_en, b.creado_en) desc
     limit 100) y);
end $$;

revoke all on function public.posibles_duplicados(uuid) from public, anon, authenticated;
grant execute on function public.posibles_duplicados(uuid) to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.posibles_duplicados(uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: posibles_duplicados sin search_path vacío';
  end if;
  if position('order by (a.telefono' in pg_get_functiondef('public.posibles_duplicados(uuid)'::regprocedure)) = 0 then
    raise exception 'Verificación: posibles_duplicados sigue cortando sin ordenar';
  end if;
end $$;
