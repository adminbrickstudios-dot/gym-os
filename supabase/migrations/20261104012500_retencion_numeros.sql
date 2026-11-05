-- 0125 · Retención en números (COM-5).
-- Tres números con su lista de nombres, calculados al abrir:
--   · altas y bajas del mes (y el neto), con las mismas cuentas que el tablero (0088)
--   · de los que se anotaron hace 3 meses (ese mes calendario), cuántos siguen al día hoy
--   · de los socios al día, cuántos vinieron menos de 4 días en los últimos 30
-- Lo ven el dueño y el encargado (como el tablero de Retención).
--   retencion_numeros(gimnasio) → { altas[], bajas[], cohorte{ mes, entraron, siguen[], se_fueron[] }, pocas{ activos, lista[] } }

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.tablero_retencion(uuid)') is null then raise exception 'Guarda: falta el tablero de retención (0088)'; end if;
end $$;

create or replace function public.retencion_numeros(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; mes date; c_desde timestamptz; c_hasta timestamptz;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  hoy := (now() at time zone zona)::date;
  mes := date_trunc('month', hoy)::date;
  c_desde := privado.medianoche((mes - interval '3 months')::date, zona);
  c_hasta := privado.medianoche((mes - interval '2 months')::date, zona);
  return (
    with al_dia as (
      select distinct c.socio_id from public.coberturas c join public.socios s on s.id = c.socio_id
       where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null and c.desde <= now() and c.hasta > now() and s.dado_de_baja_en is null
    ),
    cohorte as (
      select s.id, trim(s.nombre || ' ' || s.apellido) as nombre, s.id in (select socio_id from al_dia) as sigue
        from public.socios s where s.gimnasio_id = p_gimnasio_id and s.creado_en >= c_desde and s.creado_en < c_hasta
    ),
    visitas as (
      select a.socio_id, (select count(distinct (i.momento at time zone zona)::date) from public.ingresos i
                           where i.socio_id = a.socio_id and i.anulado_en is null and i.resultado <> 'rechazado'
                             and i.momento > now() - interval '30 days') as dias
        from al_dia a
    )
    select jsonb_build_object(
      'altas', coalesce((select jsonb_agg(jsonb_build_object('socio_id', s.id, 'nombre', trim(s.nombre || ' ' || s.apellido), 'fecha', s.creado_en) order by s.creado_en)
                 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.creado_en >= privado.medianoche(mes, zona)), '[]'),
      'bajas', coalesce((select jsonb_agg(jsonb_build_object('socio_id', s.id, 'nombre', trim(s.nombre || ' ' || s.apellido), 'fecha', s.dado_de_baja_en,
                                                             'motivo', replace(s.motivo_baja, '_', ' ')) order by s.dado_de_baja_en)
                 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en >= privado.medianoche(mes, zona)), '[]'),
      'cohorte', jsonb_build_object(
        'mes', to_char(mes - interval '3 months', 'YYYY-MM'),
        'entraron', (select count(*) from cohorte),
        'siguen', coalesce((select jsonb_agg(jsonb_build_object('socio_id', id, 'nombre', nombre) order by nombre) from cohorte where sigue), '[]'),
        'se_fueron', coalesce((select jsonb_agg(jsonb_build_object('socio_id', id, 'nombre', nombre) order by nombre) from cohorte where not sigue), '[]')),
      'pocas', jsonb_build_object(
        'activos', (select count(*) from al_dia),
        'lista', coalesce((select jsonb_agg(jsonb_build_object('socio_id', v.socio_id, 'nombre', (select trim(s.nombre || ' ' || s.apellido) from public.socios s where s.id = v.socio_id),
                                                               'dias', v.dias) order by v.dias, v.socio_id)
                           from visitas v where v.dias < 4), '[]')))
  );
end $$;
revoke all on function public.retencion_numeros(uuid) from public, anon, authenticated;
grant execute on function public.retencion_numeros(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.retencion_numeros(uuid)') is null or has_function_privilege('anon', 'public.retencion_numeros(uuid)', 'execute') then
    raise exception 'Verificación: retencion_numeros';
  end if;
end $$;
