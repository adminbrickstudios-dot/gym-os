-- 0088 · Tablero de retención (RET-1).
-- Arriba de Retención: socios al día y su tendencia (12 semanas), altas y
-- bajas del mes. Calculado de las coberturas y las altas/bajas: nada se guarda.
--   tablero_retencion(gimnasio)   dueño y encargado

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.horarios_gimnasio(uuid)') is null then raise exception 'Guarda: falta horarios_gimnasio'; end if;
  if to_regprocedure('public.editar_horario(uuid, time, int, int, uuid)') is null then raise exception 'Guarda: falta la migración 0086'; end if;
end $$;

create or replace function public.tablero_retencion(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; mes date;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  mes := date_trunc('month', hoy)::date;
  return jsonb_build_object(
    -- Al día al final de cada una de las últimas 12 semanas (la última, hoy).
    'semanas', (select jsonb_agg(jsonb_build_object('dia', d, 'al_dia', (
                   select count(distinct c.socio_id) from public.coberturas c join public.socios s on s.id = c.socio_id
                    where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null
                      and c.desde <= m and c.hasta > m and (s.dado_de_baja_en is null or s.dado_de_baja_en > m))) order by d)
                  from (select (hoy - 7 * k)::date d, least(now(), privado.medianoche((hoy - 7 * k)::date + 1, zona) - interval '1 second') m
                          from generate_series(0, 11) k) x),
    'altas_mes', (select count(*) from public.socios s where s.gimnasio_id = p_gimnasio_id and s.creado_en >= privado.medianoche(mes, zona)),
    'bajas_mes', (select count(*) from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en >= privado.medianoche(mes, zona)),
    'altas_mes_anterior', (select count(*) from public.socios s where s.gimnasio_id = p_gimnasio_id
                             and s.creado_en >= privado.medianoche((mes - interval '1 month')::date, zona) and s.creado_en < privado.medianoche(mes, zona)),
    'bajas_mes_anterior', (select count(*) from public.socios s where s.gimnasio_id = p_gimnasio_id
                             and s.dado_de_baja_en >= privado.medianoche((mes - interval '1 month')::date, zona) and s.dado_de_baja_en < privado.medianoche(mes, zona)));
end $$;

revoke all on function public.tablero_retencion(uuid) from public, anon, authenticated;
grant execute on function public.tablero_retencion(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.tablero_retencion(uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: tablero_retencion sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.tablero_retencion(uuid)', 'execute') then raise exception 'Verificación: anon puede leer el tablero'; end if;
end $$;
