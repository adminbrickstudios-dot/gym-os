-- 0120 · "Le prometió pagar" (REV-1a).
-- Al que dejaron pasar sin poder entrar ("paga a la tarde", "paga mañana"),
-- Vencen hoy se lo recuerda hoy y mañana, mientras siga sin poder entrar.
-- Se calcula de las entradas forzadas y del mismo cálculo de la puerta: no se
-- guarda ningún estado. Lo ven el dueño y el encargado (todos) y la
-- recepción (los que dejó pasar ella): no le muestra a nadie más de lo que ya veía.
--   prometieron_pagar(gimnasio) → [{ socio_id, socio, momento, motivo, por, texto, telefono }]

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.dejados_pasar(uuid, date)') is null then raise exception 'Guarda: falta dejados_pasar (0049)'; end if;
  if to_regprocedure('privado.calcular_acceso(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta privado.calcular_acceso'; end if;
end $$;

create or replace function public.prometieron_pagar(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; zona text; desde timestamptz;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  desde := privado.medianoche(privado.dia_local(now(), zona) - 1, zona);   -- ayer y hoy
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'socio_id', x.socio_id, 'socio', x.socio, 'momento', x.momento, 'motivo', x.motivo, 'por', x.por,
             'texto', (x.v).texto, 'telefono', x.telefono) order by x.momento desc)
      from (
        select distinct on (i.socio_id) i.socio_id, trim(s.nombre || ' ' || s.apellido) as socio, i.momento,
               i.forzado_motivo as motivo, q.nombre as por, s.telefono,
               privado.calcular_acceso(i.socio_id, now(), null) as v
          from public.ingresos i
          join public.socios s on s.id = i.socio_id
          left join public.equipo q on q.id = i.registrado_por
         where i.gimnasio_id = p_gimnasio_id and i.resultado = 'forzado' and i.anulado_en is null and i.momento >= desde
           and s.dado_de_baja_en is null
           and (e.rol <> 'recepcion' or i.registrado_por = e.id)
         order by i.socio_id, i.momento desc
      ) x
     where not coalesce((x.v).puede, false) or (x.v).modo_aviso), '[]');
end $$;
revoke all on function public.prometieron_pagar(uuid) from public, anon, authenticated;
grant execute on function public.prometieron_pagar(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.prometieron_pagar(uuid)') is null then raise exception 'Verificación: falta prometieron_pagar'; end if;
  if has_function_privilege('anon', 'public.prometieron_pagar(uuid)', 'execute') then raise exception 'Verificación: quedó para anon'; end if;
end $$;
