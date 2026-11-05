-- 0105 · Marcas personales y progreso (RUT-3).
-- Por ejercicio: la marca (el mayor peso, y con cuántas repeticiones y
-- cuándo) y los últimos registros para el gráfico. Se calcula de lo que
-- anotó (nada se guarda aparte). Lo ve el socio y el equipo de rutinas
-- (dueño, encargado, profe).
--   progreso_socio(socio)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.anotar_ejercicio(uuid, uuid, numeric, integer)') is null then raise exception 'Guarda: falta la migración 0104'; end if;
end $$;

create or replace function public.progreso_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_socio_o_rutinas(p_socio_id);
  return jsonb_build_object(
    'socio', (select trim(s.nombre || ' ' || s.apellido) from public.socios s where s.id = p_socio_id),
    'ejercicios', coalesce((
      select jsonb_agg(x order by x ->> 'ultimo' desc) from (
        select jsonb_build_object('ejercicio_id', e.id, 'ejercicio', e.nombre, 'grupo', e.grupo,
          'marca', (select jsonb_build_object('peso', r.peso, 'repeticiones', r.repeticiones, 'momento', r.momento)
                      from public.registros_ejercicio r where r.socio_id = p_socio_id and r.ejercicio_id = e.id and r.anulado_en is null and r.peso is not null
                     order by r.peso desc, r.repeticiones desc nulls last, r.momento limit 1),
          'ultimo', (select max(r.momento) from public.registros_ejercicio r where r.socio_id = p_socio_id and r.ejercicio_id = e.id and r.anulado_en is null),
          'registros', (select coalesce(jsonb_agg(jsonb_build_object('peso', z.peso, 'repeticiones', z.repeticiones, 'momento', z.momento) order by z.momento), '[]'::jsonb)
                          from (select r.peso, r.repeticiones, r.momento from public.registros_ejercicio r
                                 where r.socio_id = p_socio_id and r.ejercicio_id = e.id and r.anulado_en is null
                                 order by r.momento desc limit 30) z)) x
          from public.ejercicios e
         where exists (select 1 from public.registros_ejercicio r where r.socio_id = p_socio_id and r.ejercicio_id = e.id and r.anulado_en is null)
      ) q), '[]'::jsonb));
end $$;

revoke all on function public.progreso_socio(uuid) from public, anon, authenticated;
grant execute on function public.progreso_socio(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.progreso_socio(uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: progreso_socio sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.progreso_socio(uuid)', 'execute') then raise exception 'Verificación: anon puede ver el progreso'; end if;
end $$;
