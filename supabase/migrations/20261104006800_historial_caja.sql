-- 0068 · Historial de turnos de caja (CAJ-1).
-- Para el dueño y el encargado: cada turno de una sede con quién abrió y
-- cerró, lo que tenía que haber, lo contado y la diferencia, los ingresos y
-- retiros con su motivo, y cuánto se vendió. Sale de los hechos (turnos,
-- movimientos, pagos); no se guarda nada nuevo.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.resumen_turno(uuid)') is null then raise exception 'Guarda: falta privado.resumen_turno (0009)'; end if;
  if to_regprocedure('privado.deuda_socio(uuid)') is null then raise exception 'Guarda: falta la migración 0067'; end if;
end $$;

create or replace function public.historial_caja(p_sede_id uuid, p_limite int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(g, array['dueno', 'encargado']);
  return coalesce((select jsonb_agg(x order by (x ->> 'abierto_en')::timestamptz desc) from (
    select privado.resumen_turno(t.id) || jsonb_build_object(
      'caja', c.nombre,
      'abierto_por', (select e.nombre from public.equipo e where e.id = t.abierto_por),
      'cerrado_por', (select e.nombre from public.equipo e where e.id = t.cerrado_por),
      'nota', t.nota,
      'movimientos', coalesce((select jsonb_agg(jsonb_build_object('tipo', m.tipo, 'monto', m.monto, 'motivo', m.motivo, 'en', m.creado_en,
                                 'por', (select e.nombre from public.equipo e where e.id = m.creado_por)) order by m.creado_en)
                               from public.movimientos_caja m where m.turno_caja_id = t.id), '[]'::jsonb),
      'ventas', (select count(*) from public.ventas v where v.turno_caja_id = t.id and v.estado = 'confirmada'),
      'anuladas', (select count(*) from public.ventas v where v.turno_caja_id = t.id and v.estado = 'anulada')) as x
      from public.turnos_caja t join public.cajas c on c.id = t.caja_id
     where c.sede_id = p_sede_id
     order by t.abierto_en desc
     limit least(greatest(coalesce(p_limite, 30), 1), 200)) y), '[]'::jsonb);
end $$;

revoke all on function public.historial_caja(uuid, int) from public, anon, authenticated;
grant execute on function public.historial_caja(uuid, int) to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.historial_caja(uuid, int)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: historial_caja sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.historial_caja(uuid, int)', 'execute') then raise exception 'Verificación: anon puede ejecutar historial_caja'; end if;
end $$;
