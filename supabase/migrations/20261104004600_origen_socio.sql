-- 0046 · Cómo llegó el socio y qué reglamento aceptó (SOC-14).
-- Todo sale de hechos que ya estaban (socios.origen, importaciones,
-- prospectos, aceptaciones_reglamento): no se guarda nada nuevo.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.filtros_socios(uuid)') is null then raise exception 'Guarda: falta la migración 0045'; end if;
end $$;

create or replace function public.origen_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; s public.socios;
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  select * into s from public.socios where id = p_socio_id;
  return jsonb_build_object(
    'origen', s.origen,
    'alta', s.creado_en,
    'por', (select e.nombre from public.equipo e where e.gimnasio_id = g and e.usuario_id = s.creado_por limit 1),
    'prospecto', (select jsonb_build_object('origen', p.origen, 'desde', p.creado_en) from public.prospectos p
                   where p.gimnasio_id = g and p.socio_id = s.id order by p.creado_en limit 1),
    'importacion', (select jsonb_build_object('archivo', i.archivo, 'en', i.creado_en) from public.importaciones i
                     where i.gimnasio_id = g and i.id = s.importacion_id),
    'reglamento', (select jsonb_build_object('version', r.version, 'aceptado_en', a.aceptado_en, 'id', r.id)
                     from public.aceptaciones_reglamento a join public.reglamentos r on r.id = a.reglamento_id
                    where a.gimnasio_id = g and a.socio_id = s.id order by a.aceptado_en desc limit 1));
end $$;

-- El texto que aceptó, para mostrárselo (el de esa versión, aunque haya uno más nuevo).
create or replace function public.reglamento_aceptado(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  return (select jsonb_build_object('version', r.version, 'texto', r.texto, 'aceptado_en', a.aceptado_en)
            from public.aceptaciones_reglamento a join public.reglamentos r on r.id = a.reglamento_id
           where a.gimnasio_id = g and a.socio_id = p_socio_id order by a.aceptado_en desc limit 1);
end $$;

revoke all on function public.origen_socio(uuid), public.reglamento_aceptado(uuid) from public, anon, authenticated;
grant execute on function public.origen_socio(uuid), public.reglamento_aceptado(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select p.oid, p.proname, p.proconfig from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname in ('origen_socio', 'reglamento_aceptado') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
end $$;
