-- 0108 · Salud de cada gimnasio en el super admin (ADM-4).
-- Por gimnasio: cuándo entró por última vez alguien de su equipo (sin contar
-- a Soporte BRIK), ventas y entradas de los últimos 7 días, y una alerta si
-- dejó de usarse (creado hace más de 7 días y sin entradas ni ventas en 7).
--   admin_salud_gimnasios()

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.admin_aplicar_plantilla(uuid, text)') is null then raise exception 'Guarda: falta la migración 0107'; end if;
end $$;

create or replace function public.admin_salud_gimnasios() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  return coalesce((select jsonb_object_agg(x.id, jsonb_build_object(
      'ultimo_acceso_equipo', x.ultimo, 'ventas_7_dias', x.ventas, 'cobrado_7_dias', x.cobrado, 'entradas_7_dias', x.entradas,
      'sin_uso', x.creado_en < now() - interval '7 days' and x.ventas = 0 and x.entradas = 0))
    from (select g.id, g.creado_en,
            (select max(u.last_sign_in_at) from public.equipo e join auth.users u on u.id = e.usuario_id
              where e.gimnasio_id = g.id and e.activo and not e.es_soporte) ultimo,
            (select count(*) from public.ventas v where v.gimnasio_id = g.id and v.estado = 'confirmada' and v.anulada_en is null and v.confirmada_en > now() - interval '7 days') ventas,
            (select coalesce(sum(p.monto), 0) from public.pagos p where p.gimnasio_id = g.id and p.estado = 'aprobado' and p.medio <> 'cuenta_corriente' and p.aprobado_en > now() - interval '7 days') cobrado,
            (select count(*) from public.ingresos i where i.gimnasio_id = g.id and i.anulado_en is null and i.resultado <> 'rechazado' and i.momento > now() - interval '7 days') entradas
           from public.gimnasios g) x), '{}'::jsonb);
end $$;

revoke all on function public.admin_salud_gimnasios() from public, anon, authenticated;
grant execute on function public.admin_salud_gimnasios() to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.admin_salud_gimnasios()'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: admin_salud_gimnasios sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.admin_salud_gimnasios()', 'execute') then raise exception 'Verificación: anon puede ver la salud'; end if;
end $$;
