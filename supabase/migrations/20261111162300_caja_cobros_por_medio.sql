-- H1 · Caja: lo cobrado por cada medio, a la vista, y las transferencias del mostrador para chequear contra el banco.
--
-- Reclamo de Temple Gym: "los cobros por transferencia hechos en el mostrador no salen en Caja". La plata estaba bien guardada (pagos con
-- venta.turno_caja_id) pero la pantalla solo mostraba el efectivo y una línea chica con el resto. Esta migración NO cambia ningún monto ni
-- cómo se cobra: no toca resumen_turno, cobrar, cerrar_caja ni reporte_turno / reporte_dia. Suma solo lecturas y un dato nuevo:
--   public.cobros_de_turnos(uuid[])                    por medio: total, cantidad y la lista (hora, socio, monto, quién cobró). Mismo universo de
--                                                      pagos que reporte_turno.por_medio (aprobados del turno), con las mismas reglas de permiso
--                                                      que reporte_turno (abierto: dueño y encargado; cerrado: la recepción solo el suyo).
--   public.pagos_vistos_en_banco                       la tilde "ya la vi en el banco" de una transferencia cobrada en el mostrador: quién y cuándo.
--   public.cobradas_en_mostrador(gimnasio, dias)       las transferencias cobradas en el mostrador, con su tilde, para la pestaña de Transferencias.
--   public.marcar_transferencia_vista(pago, vista)     pone o saca la tilde (dueño, encargado, recepción de la sede). No toca el pago.
-- La diferencia de caja (contado − esperado) ya cuenta solo el efectivo: esperado = fondo + efectivo + ingresos − retiros (resumen_turno).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.resumen_turno(uuid)') is null then raise exception 'Guarda: falta privado.resumen_turno'; end if;
  if to_regprocedure('privado.exigir_rol(uuid, text[], uuid)') is null then raise exception 'Guarda: falta privado.exigir_rol'; end if;
  if to_regprocedure('privado.politicas_estandar(regclass, text[], text[], boolean)') is null then raise exception 'Guarda: falta privado.politicas_estandar'; end if;
  if to_regclass('public.pagos') is null or to_regclass('public.turnos_caja') is null then raise exception 'Guarda: faltan pagos o turnos_caja'; end if;
end $$;

-- ── La tilde "ya la vi en el banco" ─────────────────────────────────
create table if not exists public.pagos_vistos_en_banco (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  pago_id      uuid not null,
  visto_por    uuid not null,
  visto_en     timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, pago_id),
  foreign key (gimnasio_id, pago_id) references public.pagos (gimnasio_id, id),
  foreign key (gimnasio_id, visto_por) references public.equipo (gimnasio_id, id)
);
select privado.politicas_estandar('public.pagos_vistos_en_banco', array['dueno', 'encargado', 'recepcion'], null);
revoke all on table public.pagos_vistos_en_banco from anon;
revoke truncate, references, trigger on public.pagos_vistos_en_banco from authenticated;
revoke insert, update, delete on public.pagos_vistos_en_banco from authenticated;   -- solo se escribe con marcar_transferencia_vista

-- ── Lo cobrado por medio, con la lista ──────────────────────────────
create or replace function public.cobros_de_turnos(p_turno_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare tid uuid; t public.turnos_caja; c public.cajas; eid uuid; rol text; r jsonb;
begin
  if p_turno_ids is null or cardinality(p_turno_ids) = 0 then return '[]'::jsonb; end if;
  foreach tid in array p_turno_ids loop
    select * into t from public.turnos_caja where id = tid;
    if not found then raise exception 'Sin permiso o turno inexistente' using errcode = '42501'; end if;
    select * into c from public.cajas where id = t.caja_id;
    eid := privado.exigir_rol(t.gimnasio_id, array['dueno', 'encargado', 'recepcion'], c.sede_id);
    select e.rol into rol from public.equipo e where e.id = eid;
    -- Igual que reporte_turno: con el turno abierto, el dueño y el encargado (arqueo ciego); cerrado, la recepción solo los suyos.
    if rol = 'recepcion' and (t.cerrado_en is null or (t.abierto_por <> eid and t.cerrado_por is distinct from eid)) then
      raise exception 'Sin permiso para ver este reporte' using errcode = '42501';
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('medio', m.medio, 'total', m.total, 'cantidad', m.cantidad, 'cobros', m.cobros) order by (m.medio = 'efectivo') desc, m.total desc), '[]'::jsonb)
    into r
    from (
      select x.medio, sum(x.monto) as total, count(*)::int as cantidad,
             jsonb_agg(jsonb_build_object('pago_id', x.id, 'en', x.en, 'monto', x.monto, 'socio', x.socio, 'cobro', x.cobro) order by x.en, x.id) as cobros
        from (
          select p.id, p.medio, p.monto, coalesce(p.aprobado_en, p.creado_en) as en,
                 nullif(trim(coalesce(s.nombre, '') || ' ' || coalesce(s.apellido, '')), '') as socio,
                 (select q.nombre from public.equipo q where q.id = coalesce(p.creado_por, v.creado_por)) as cobro
            from public.pagos p
            join public.ventas v on v.id = p.venta_id
            left join public.socios s on s.id = v.socio_id
           where p.estado = 'aprobado' and (p.turno_caja_id = any (p_turno_ids) or v.turno_caja_id = any (p_turno_ids))
        ) x
       group by x.medio
    ) m;
  return r;
end $$;

-- ── Las transferencias cobradas en el mostrador, para chequear contra el banco ──
-- Entran todas las del mostrador, también las cobradas sin caja abierta (transferencia y tarjeta cobran sin caja: esas no quedan en ningún turno).
create or replace function public.cobradas_en_mostrador(p_gimnasio_id uuid, p_dias int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare eid uuid; mi_sede uuid; desde timestamptz; r jsonb;
begin
  eid := privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select e.sede_id into mi_sede from public.equipo e where e.id = eid;
  p_dias := least(greatest(coalesce(p_dias, 30), 1), 120);
  desde := now() - make_interval(days => p_dias);
  select jsonb_build_object(
    'dias', p_dias,
    'sin_ver_cantidad', count(*) filter (where f.visto_en is null),
    'sin_ver_total', coalesce(sum(f.monto) filter (where f.visto_en is null), 0),
    'filas', coalesce(jsonb_agg(jsonb_build_object('pago_id', f.pago_id, 'en', f.en, 'monto', f.monto, 'socio_id', f.socio_id, 'socio', f.socio,
                      'cobro', f.cobro, 'caja', f.caja, 'turno_id', f.turno_id, 'visto_en', f.visto_en, 'visto_por', f.visto_por) order by f.en desc, f.pago_id), '[]'::jsonb))
    into r
    from (
      select p.id as pago_id, coalesce(p.aprobado_en, p.creado_en) as en, p.monto, s.id as socio_id,
             nullif(trim(coalesce(s.nombre, '') || ' ' || coalesce(s.apellido, '')), '') as socio,
             (select q.nombre from public.equipo q where q.id = coalesce(p.creado_por, v.creado_por)) as cobro,
             c.nombre as caja, v.turno_caja_id as turno_id, b.visto_en,
             (select q.nombre from public.equipo q where q.id = b.visto_por) as visto_por
        from public.pagos p
        join public.ventas v on v.id = p.venta_id and v.gimnasio_id = p.gimnasio_id
        left join public.turnos_caja t on t.id = v.turno_caja_id
        left join public.cajas c on c.id = t.caja_id
        left join public.socios s on s.id = v.socio_id
        left join public.pagos_vistos_en_banco b on b.pago_id = p.id
       where p.gimnasio_id = p_gimnasio_id and p.medio = 'transferencia' and p.estado = 'aprobado'
         and v.origen = 'recepcion' and v.estado = 'confirmada'
         and coalesce(p.aprobado_en, p.creado_en) >= desde
         and (mi_sede is null or v.sede_id = mi_sede)
    ) f;
  return r;
end $$;

-- ── Poner o sacar la tilde ──────────────────────────────────────────
create or replace function public.marcar_transferencia_vista(p_pago_id uuid, p_vista boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.pagos; v public.ventas; eid uuid; rol text; b public.pagos_vistos_en_banco; n int;
begin
  select * into p from public.pagos where id = p_pago_id;
  if not found then raise exception 'Sin permiso o pago inexistente' using errcode = '42501'; end if;
  select * into v from public.ventas where id = p.venta_id;
  eid := privado.exigir_rol(p.gimnasio_id, array['dueno', 'encargado', 'recepcion'], v.sede_id);
  select e.rol into rol from public.equipo e where e.id = eid;
  if p.medio <> 'transferencia' or p.estado <> 'aprobado' or v.origen <> 'recepcion' or v.estado <> 'confirmada' then
    raise exception 'Solo se tilda una transferencia cobrada en el mostrador' using errcode = '22023';
  end if;
  select * into b from public.pagos_vistos_en_banco where pago_id = p.id;
  if coalesce(p_vista, true) then
    if not found then
      insert into public.pagos_vistos_en_banco (gimnasio_id, pago_id, visto_por) values (p.gimnasio_id, p.id, eid) returning * into b;
      get diagnostics n = row_count;
      if n <> 1 then raise exception 'No se pudo guardar la tilde'; end if;
    end if;
  else
    if found then
      -- La tilde la saca quien la puso, el encargado o el dueño (la recepción no destilda lo de otra persona).
      if rol = 'recepcion' and b.visto_por <> eid then raise exception 'Solo quien la tildó, el encargado o el dueño pueden sacarla' using errcode = '42501'; end if;
      delete from public.pagos_vistos_en_banco where id = b.id;
      get diagnostics n = row_count;
      if n <> 1 then raise exception 'No se pudo sacar la tilde'; end if;
    end if;
    return jsonb_build_object('pago_id', p.id, 'visto_en', null, 'visto_por', null);
  end if;
  return jsonb_build_object('pago_id', p.id, 'visto_en', b.visto_en, 'visto_por', (select q.nombre from public.equipo q where q.id = b.visto_por));
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.cobros_de_turnos(uuid[]), public.cobradas_en_mostrador(uuid, int), public.marcar_transferencia_vista(uuid, boolean) from public, anon, authenticated;
grant execute on function public.cobros_de_turnos(uuid[]), public.cobradas_en_mostrador(uuid, int), public.marcar_transferencia_vista(uuid, boolean) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.cobros_de_turnos(uuid[])', 'public.cobradas_en_mostrador(uuid, int)', 'public.marcar_transferencia_vista(uuid, boolean)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
    if not has_function_privilege('authenticated', f, 'execute') then raise exception 'Verificación: authenticated no puede ejecutar %', f; end if;
  end loop;
  if not (select relrowsecurity from pg_class where oid = 'public.pagos_vistos_en_banco'::regclass) then raise exception 'Verificación: pagos_vistos_en_banco sin RLS'; end if;
  if has_table_privilege('authenticated', 'public.pagos_vistos_en_banco', 'insert') then raise exception 'Verificación: se puede escribir la tilde sin pasar por la función'; end if;
end $$;
