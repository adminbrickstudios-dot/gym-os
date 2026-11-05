-- 0111 · Suspensión gradual del gimnasio (ADM-2, decisión D11).
-- 7 días antes del vencimiento del abono de BRIK, el dueño ve el aviso (lo
-- calcula privado.estado_abono, 0110). Vencido, el panel queda en solo
-- lectura: no vende ni edita. La puerta, la app del socio y la página siguen
-- andando: ningún socio queda afuera por una deuda del gimnasio con BRIK.
-- Se hace cumplir en la base con un trigger en las tablas que el panel
-- escribe (ventas del mostrador, socios, planes, precios, productos, equipo,
-- configuración, página, gastos, caja y membresías). Lo que hace el socio
-- (entrar, reservar, pagar desde la app, vincular su cuenta, hacerse socio
-- desde la página) no se frena: el trigger solo frena a alguien del equipo.
-- BRIK (el admin) y el servidor pueden igual.
--   privado.solo_lectura(gimnasio) · trigger privado.frenar_si_solo_lectura()

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.estado_abono(uuid)') is null then raise exception 'Guarda: falta la migración 0110'; end if;
end $$;

create or replace function privado.solo_lectura(p_gimnasio_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select privado.estado_abono(p_gimnasio_id) ->> 'estado' = 'vencido'
$$;
revoke all on function privado.solo_lectura(uuid) from public;

-- security definer: también corre cuando alguien escribe la tabla directo (con RLS), y
-- tiene que poder leer el abono aunque quien escribe no pueda.
create or replace function privado.frenar_si_solo_lectura() returns trigger
language plpgsql security definer set search_path = '' as $$
declare g uuid := coalesce(new.gimnasio_id, old.gimnasio_id);
begin
  if privado.es_servicio() or privado.soy_admin_plataforma() then return coalesce(new, old); end if;
  -- Solo se frena el panel: lo que no hace alguien del equipo de este gimnasio (el socio, la página, el alta online) sigue.
  if not exists (select 1 from public.equipo e where e.gimnasio_id = g and e.usuario_id = auth.uid() and e.activo) then return coalesce(new, old); end if;
  -- Lo que hace el socio desde la app no se frena: pagar online o informar una transferencia.
  if tg_table_name = 'ventas' and tg_op = 'INSERT' and (to_jsonb(new) ->> 'origen') <> 'recepcion' then return new; end if;
  -- Vincular su cuenta o su código de invitar no es "editar al socio".
  if tg_table_name = 'socios' and tg_op = 'UPDATE'
     and (to_jsonb(new) - 'usuario_id' - 'codigo_referido') = (to_jsonb(old) - 'usuario_id' - 'codigo_referido') then
    return new;
  end if;
  if privado.solo_lectura(g) then
    raise exception 'El abono de Gym OS de este gimnasio está vencido: el panel quedó en solo lectura (la puerta y la app de los socios siguen andando). Hablá con BRIK para regularizarlo.'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
revoke all on function privado.frenar_si_solo_lectura() from public;

do $$
declare t text;
begin
  foreach t in array array['ventas', 'socios', 'planes', 'precios_plan', 'productos', 'equipo', 'configuracion_gimnasio',
                           'landing_gimnasio', 'gastos', 'turnos_caja', 'movimientos_caja', 'suscripciones'] loop
    execute format('drop trigger if exists solo_lectura on public.%I', t);
    execute format('create trigger solo_lectura before insert or update on public.%I for each row execute function privado.frenar_si_solo_lectura()', t);
  end loop;
end $$;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if (select count(*) from pg_trigger where tgname = 'solo_lectura' and not tgisinternal) <> 12 then
    raise exception 'Verificación: faltan triggers de solo lectura';
  end if;
  if not exists (select 1 from pg_proc where oid = 'privado.frenar_si_solo_lectura()'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: frenar_si_solo_lectura sin search_path vacío';
  end if;
end $$;
