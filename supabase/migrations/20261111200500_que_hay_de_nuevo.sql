-- N6 · "Qué hay de nuevo" para el dueño, adentro del panel, en palabras simples.
-- Se arma con las funciones nuevas que ese gimnasio prendió (N5): cada una trae su frase en el catálogo y la fecha en que se prendió.
-- Un gimnasio que no prendió nada no ve nada. Se calcula al abrir; no guarda nada.
--   que_hay_de_nuevo(gimnasio)   dueño y encargado
-- Aditiva e idempotente.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.funciones_nuevas_catalogo()') is null then raise exception 'Guarda: falta N5 (funciones nuevas)'; end if;
end $$;

create or replace function public.que_hay_de_nuevo(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  return coalesce((
    select jsonb_agg(jsonb_build_object('clave', c ->> 'clave', 'titulo', c ->> 'titulo', 'texto', c ->> 'novedad',
                                        'desde', privado.dia_local(f.prendida_en, zona)) order by f.prendida_en desc)
      from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c
      join public.funciones_nuevas_gimnasio f on f.gimnasio_id = p_gimnasio_id and f.clave = c ->> 'clave' and f.activa), '[]'::jsonb);
end $$;

revoke all on function public.que_hay_de_nuevo(uuid) from public, anon, authenticated;
grant execute on function public.que_hay_de_nuevo(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.que_hay_de_nuevo(uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: que_hay_de_nuevo sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.que_hay_de_nuevo(uuid)', 'execute') then raise exception 'Verificación: anon puede ejecutar que_hay_de_nuevo'; end if;
end $$;
