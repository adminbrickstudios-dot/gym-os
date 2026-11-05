-- 0089 · Motivos de baja en el Resultado (RET-3).
-- Por qué se fue la gente en el mes (el motivo se pide al dar de baja).
--   motivos_baja_mes(gimnasio, mes)   dueño y encargado

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.tablero_retencion(uuid)') is null then raise exception 'Guarda: falta la migración 0088'; end if;
end $$;

create or replace function public.motivos_baja_mes(p_gimnasio_id uuid, p_mes date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; mes date;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  mes := date_trunc('month', coalesce(p_mes, privado.dia_local(now(), zona)))::date;
  return coalesce((select jsonb_agg(jsonb_build_object('motivo', motivo_baja, 'cantidad', n) order by n desc, motivo_baja) from (
    select s.motivo_baja, count(*)::int n from public.socios s
     where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en >= privado.medianoche(mes, zona)
       and s.dado_de_baja_en < privado.medianoche((mes + interval '1 month')::date, zona)
     group by s.motivo_baja) x), '[]'::jsonb);
end $$;

revoke all on function public.motivos_baja_mes(uuid, date) from public, anon, authenticated;
grant execute on function public.motivos_baja_mes(uuid, date) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.motivos_baja_mes(uuid, date)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: motivos_baja_mes sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.motivos_baja_mes(uuid, date)', 'execute') then raise exception 'Verificación: anon puede leer los motivos'; end if;
end $$;
