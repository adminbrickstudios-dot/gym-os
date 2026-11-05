-- 0054 · Control de la puerta (ENT-8).
-- Para el dueño y el encargado: en un rango de días, a quién dejaron pasar
-- (quién, por qué y por qué no podía) y qué entradas se anularon (quién y por
-- qué), con la cuenta por persona del equipo. Sale de ingresos: no se guarda nada.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.invitados') is null then raise exception 'Guarda: falta la migración 0053'; end if;
end $$;

create or replace function public.control_entrada(p_gimnasio_id uuid, p_desde date, p_dias int default 7) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; ini timestamptz; fin timestamptz;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if p_desde is null then raise exception 'Elegí desde qué día.' using errcode = '22023'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 31 then raise exception 'Se mira de 1 a 31 días.' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  ini := privado.medianoche(p_desde, zona); fin := privado.medianoche(p_desde + p_dias, zona);
  return jsonb_build_object(
    'desde', p_desde, 'hasta', p_desde + p_dias - 1,
    'forzados', coalesce((select jsonb_agg(jsonb_build_object('ingreso_id', i.id, 'momento', i.momento, 'socio_id', s.id,
        'socio', trim(s.nombre || ' ' || s.apellido), 'por', q.nombre, 'motivo', i.forzado_motivo, 'porque_no', i.texto,
        'anulado', i.anulado_en is not null) order by i.momento desc)
      from public.ingresos i join public.socios s on s.id = i.socio_id left join public.equipo q on q.id = i.registrado_por
     where i.gimnasio_id = p_gimnasio_id and i.resultado = 'forzado' and i.momento >= ini and i.momento < fin), '[]'),
    'anuladas', coalesce((select jsonb_agg(jsonb_build_object('ingreso_id', i.id, 'momento', i.momento, 'anulado_en', i.anulado_en,
        'socio_id', s.id, 'socio', trim(s.nombre || ' ' || s.apellido), 'por', q.nombre, 'motivo', i.anulado_motivo, 'resultado', i.resultado)
        order by i.anulado_en desc)
      from public.ingresos i join public.socios s on s.id = i.socio_id left join public.equipo q on q.id = i.anulado_por
     where i.gimnasio_id = p_gimnasio_id and i.anulado_en is not null and i.anulado_en >= ini and i.anulado_en < fin), '[]'),
    'por_persona', coalesce((select jsonb_agg(x order by (x ->> 'forzados')::int desc, x ->> 'nombre') from (
        select jsonb_build_object('nombre', e.nombre, 'rol', e.rol,
          'forzados', count(*) filter (where i.resultado = 'forzado' and i.registrado_por = e.id and i.momento >= ini and i.momento < fin),
          'anuladas', count(*) filter (where i.anulado_por = e.id and i.anulado_en >= ini and i.anulado_en < fin)) as x
          from public.equipo e join public.ingresos i on i.gimnasio_id = e.gimnasio_id and (i.registrado_por = e.id or i.anulado_por = e.id)
         where e.gimnasio_id = p_gimnasio_id
           and ((i.resultado = 'forzado' and i.momento >= ini and i.momento < fin) or (i.anulado_en >= ini and i.anulado_en < fin))
         group by e.id, e.nombre, e.rol) y), '[]'));
end $$;

revoke all on function public.control_entrada(uuid, date, int) from public, anon, authenticated;
grant execute on function public.control_entrada(uuid, date, int) to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.control_entrada(uuid, date, int)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: control_entrada sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.control_entrada(uuid, date, int)', 'execute') then raise exception 'Verificación: anon puede ejecutar control_entrada'; end if;
end $$;
