-- N3 · Resumen de la noche para el dueño (función nueva, apagada por defecto: interruptor "resumen_noche", ver N5).
-- Sale de los hechos del día (pagos aprobados, entradas, altas, bajas, cajas) y se calcula al abrir: no hay cron, no hay nada guardado.
-- Si nadie lo abre, no pasa nada; cuando se abre, está al día. Lo ve solo el dueño, en Novedades.
--   resumen_noche(gimnasio, dia)   dia = null → hoy (día local del gimnasio); apagada: error claro
-- Aditiva e idempotente.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.exigir_funcion(uuid, text)') is null then raise exception 'Guarda: falta N5 (funciones nuevas)'; end if;
  if to_regclass('public.turnos_caja') is null or to_regclass('public.ingresos') is null or to_regclass('public.pagos') is null then
    raise exception 'Guarda: faltan tablas de caja, accesos o pagos';
  end if;
end $$;

create or replace function public.resumen_noche(p_gimnasio_id uuid, p_dia date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; dia date; d0 timestamptz; d1 timestamptz;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  perform privado.exigir_funcion(p_gimnasio_id, 'resumen_noche');
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  dia := coalesce(p_dia, hoy);
  if dia > hoy or dia < hoy - 60 then raise exception 'Elegí un día de los últimos 60' using errcode = '22023'; end if;
  d0 := privado.medianoche(dia, zona);
  d1 := privado.medianoche(dia + 1, zona);
  return jsonb_build_object(
    'dia', dia, 'es_hoy', dia = hoy, 'calculado_en', now(),
    'cobrado', coalesce((select sum(p.monto) from public.pagos p where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.aprobado_en >= d0 and p.aprobado_en < d1), 0),
    'cobros', (select count(*) from public.pagos p where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.aprobado_en >= d0 and p.aprobado_en < d1),
    'por_medio', coalesce((select jsonb_agg(jsonb_build_object('medio', m.medio, 'monto', m.monto) order by m.monto desc)
                             from (select p.medio, sum(p.monto) as monto from public.pagos p
                                    where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.aprobado_en >= d0 and p.aprobado_en < d1 group by p.medio) m), '[]'::jsonb),
    'entradas', (select count(*) from public.ingresos i where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null
                    and i.resultado in ('entro', 'entro_modo_aviso', 'forzado') and i.momento >= d0 and i.momento < d1),
    'personas', (select count(distinct i.socio_id) from public.ingresos i where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null
                    and i.resultado in ('entro', 'entro_modo_aviso', 'forzado') and i.momento >= d0 and i.momento < d1),
    'altas', (select count(*) from public.socios s where s.gimnasio_id = p_gimnasio_id and s.creado_en >= d0 and s.creado_en < d1),
    'bajas', (select count(*) from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en >= d0 and s.dado_de_baja_en < d1),
    'cajas_abiertas', (select count(*) from public.turnos_caja t where t.gimnasio_id = p_gimnasio_id and t.cerrado_en is null),
    'cajas_cerradas', (select count(*) from public.turnos_caja t where t.gimnasio_id = p_gimnasio_id and t.cerrado_en >= d0 and t.cerrado_en < d1));
end $$;

revoke all on function public.resumen_noche(uuid, date) from public, anon, authenticated;
grant execute on function public.resumen_noche(uuid, date) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.resumen_noche(uuid, date)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: resumen_noche sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.resumen_noche(uuid, date)', 'execute') then raise exception 'Verificación: anon puede ejecutar resumen_noche'; end if;
end $$;
