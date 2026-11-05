-- 0035 · Asistencia del socio en la ficha (SOC-2): qué días vino en un mes
-- (en la hora del gimnasio), cuántas veces, y su racha de semanas seguidas
-- viniendo. Sale de los ingresos (hechos); no se guarda nada nuevo.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.ingresos') is null then raise exception 'Guarda: falta ingresos'; end if;
  if to_regprocedure('privado.exigir_rol(uuid, text[], uuid)') is null then raise exception 'Guarda: falta privado.exigir_rol'; end if;
end $$;

create or replace function public.asistencia_socio(p_socio_id uuid, p_mes date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; zona text; hoy date; mes date; dias jsonb; racha int := 0; semana date;
begin
  select s.gimnasio_id into g from public.socios s where s.id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion']);
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = g;
  hoy := (now() at time zone zona)::date;
  mes := date_trunc('month', coalesce(p_mes, hoy))::date;

  select coalesce(jsonb_agg(d order by d), '[]') into dias from (
    select distinct (i.momento at time zone zona)::date as d from public.ingresos i
     where i.socio_id = p_socio_id and i.resultado <> 'rechazado'
       and i.momento >= privado.medianoche(mes, zona) and i.momento < privado.medianoche((mes + interval '1 month')::date, zona)
  ) x;

  -- Racha: semanas seguidas (lunes a domingo) con al menos una entrada, contando hacia atrás desde esta.
  semana := date_trunc('week', hoy)::date;
  if not exists (select 1 from public.ingresos i where i.socio_id = p_socio_id and i.resultado <> 'rechazado'
                  and i.momento >= privado.medianoche(semana, zona)) then
    semana := semana - 7;   -- esta semana todavía puede venir: la racha cuenta desde la anterior
  end if;
  while racha < 104 and exists (select 1 from public.ingresos i where i.socio_id = p_socio_id and i.resultado <> 'rechazado'
                  and i.momento >= privado.medianoche(semana, zona) and i.momento < privado.medianoche(semana + 7, zona)) loop
    racha := racha + 1; semana := semana - 7;
  end loop;

  return jsonb_build_object('mes', to_char(mes, 'YYYY-MM'), 'hoy', hoy, 'dias', dias, 'veces', jsonb_array_length(dias),
    'racha_semanas', racha,
    'veces_mes_anterior', (select count(distinct (i.momento at time zone zona)::date) from public.ingresos i
                            where i.socio_id = p_socio_id and i.resultado <> 'rechazado'
                              and i.momento >= privado.medianoche((mes - interval '1 month')::date, zona) and i.momento < privado.medianoche(mes, zona)));
end $$;

revoke all on function public.asistencia_socio(uuid, date) from public, anon, authenticated;
grant execute on function public.asistencia_socio(uuid, date) to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.asistencia_socio(uuid, date)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: asistencia_socio sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.asistencia_socio(uuid, date)', 'execute') then raise exception 'Verificación: anon ve asistencia'; end if;
end $$;
