-- 0091 · Racha y entradas del mes en la app del socio (APP-7).
-- Entradas de este mes (y del anterior) y semanas seguidas viniendo (la
-- semana en curso cuenta si ya vino; si todavía no, la racha llega hasta la
-- anterior). De los ingresos que pasaron: nada se guarda.
--   racha_socio(socio)   el socio (o el equipo)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.motivos_baja_mes(uuid, date)') is null then raise exception 'Guarda: falta la migración 0089'; end if;
end $$;

create or replace function public.racha_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; zona text; hoy date; semana date; racha int := 0; semanas date[]; inicio date;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_socio_id not in (select privado.mis_socios()) then perform privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion', 'profe']); end if;
  select zona_horaria into zona from public.gimnasios where id = g;
  hoy := privado.dia_local(now(), zona);
  semana := date_trunc('week', hoy)::date;   -- el lunes de esta semana
  select array_agg(distinct date_trunc('week', privado.dia_local(i.momento, zona))::date) into semanas
    from public.ingresos i where i.socio_id = p_socio_id and i.anulado_en is null and i.resultado <> 'rechazado' and i.momento > now() - interval '2 years';
  inicio := case when semana = any (coalesce(semanas, '{}')) then semana when semana - 7 = any (coalesce(semanas, '{}')) then semana - 7 end;
  if inicio is not null then
    while (inicio - 7 * racha) = any (semanas) loop racha := racha + 1; end loop;
  end if;
  return jsonb_build_object(
    'semanas_seguidas', racha,
    'entradas_mes', (select count(*) from public.ingresos i where i.socio_id = p_socio_id and i.anulado_en is null and i.resultado <> 'rechazado'
                       and i.momento >= privado.medianoche(date_trunc('month', hoy)::date, zona)),
    'entradas_mes_anterior', (select count(*) from public.ingresos i where i.socio_id = p_socio_id and i.anulado_en is null and i.resultado <> 'rechazado'
                       and i.momento >= privado.medianoche((date_trunc('month', hoy) - interval '1 month')::date, zona)
                       and i.momento < privado.medianoche(date_trunc('month', hoy)::date, zona)),
    'vino_esta_semana', exists (select 1 from public.ingresos i where i.socio_id = p_socio_id and i.anulado_en is null and i.resultado <> 'rechazado'
                       and i.momento >= privado.medianoche(semana, zona)));
end $$;

revoke all on function public.racha_socio(uuid) from public, anon, authenticated;
grant execute on function public.racha_socio(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.racha_socio(uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: racha_socio sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.racha_socio(uuid)', 'execute') then raise exception 'Verificación: anon puede leer rachas'; end if;
end $$;
