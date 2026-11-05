-- 0057 · Aumento de precios de varios planes a la vez, programado (PLA-4).
-- Elegir planes, un % o un monto, a cuánto redondear y desde qué día. Cada
-- plan recibe su lista nueva (general y precios especiales, con el mismo
-- aumento) con programar_lista_precios (0056): lo ya cobrado no cambia y lo
-- programado se puede anular plan por plan. La vista previa y el aplicar usan
-- la misma cuenta (privado.aumento_planes): lo que se ve es lo que se guarda.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.programar_lista_precios(uuid, numeric, jsonb, date)') is null then raise exception 'Guarda: falta la migración 0056'; end if;
end $$;

create or replace function privado.redondear_precio(p_monto numeric, p_a int) returns numeric
language sql immutable set search_path = '' as $$
  select case when coalesce(p_a, 1) <= 1 then round(p_monto, 2) else round(p_monto / p_a) * p_a end
$$;
revoke all on function privado.redondear_precio(numeric, int) from public;

-- Para cada plan elegido: la lista que rige justo antes de p_desde y la nueva.
create or replace function privado.aumento_planes(p_gimnasio_id uuid, p_planes uuid[], p_tipo text, p_valor numeric, p_redondeo int, p_desde date)
returns jsonb
language plpgsql stable set search_path = '' as $$
declare zona text; momento timestamptz; r record; base timestamptz; lista jsonb; nuevo numeric; vs jsonb; v jsonb; res jsonb := '[]'; nv numeric; problema text; despues timestamptz;
begin
  if p_tipo not in ('porcentaje', 'monto') then raise exception 'Elegí si el aumento es un porcentaje o un monto' using errcode = '22023'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'El aumento tiene que ser mayor a cero' using errcode = '22023'; end if;
  if p_tipo = 'porcentaje' and p_valor > 200 then raise exception 'Un aumento de más del 200%% seguro es un error de tipeo' using errcode = '22023'; end if;
  if p_redondeo is not null and p_redondeo not in (1, 10, 50, 100, 500, 1000) then raise exception 'Se redondea a $1, $10, $50, $100, $500 o $1.000' using errcode = '22023'; end if;
  if coalesce(cardinality(p_planes), 0) = 0 then raise exception 'Elegí al menos un plan' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  momento := case when p_desde is null or p_desde <= privado.dia_local(now(), zona) then now() else privado.medianoche(p_desde, zona) end;
  for r in select p.id, p.nombre, p.tipo,
                  (select count(*)::int from public.suscripciones su where su.plan_id = p.id and su.baja_en is null) as socios
             from public.planes p where p.id = any (p_planes) and p.gimnasio_id = p_gimnasio_id order by p.orden, p.nombre loop
    select max(pp.vigente_desde) into base from public.precios_plan pp
     where pp.plan_id = r.id and pp.sede_id is null and pp.vigente_desde < momento;
    lista := case when base is not null then privado.lista_precios_json(r.id, base) end;
    select min(pp.vigente_desde) into despues from public.precios_plan pp
     where pp.plan_id = r.id and pp.sede_id is null and pp.vigente_desde > momento;
    problema := null; nuevo := null; vs := '[]';
    if lista is null or (lista ->> 'general') is null then
      problema := 'No tiene precio: ponele uno desde 💲 Precios';
    else
      nuevo := privado.redondear_precio(case when p_tipo = 'porcentaje' then (lista ->> 'general')::numeric * (1 + p_valor / 100)
                                             else (lista ->> 'general')::numeric + p_valor end, p_redondeo);
      for v in select * from jsonb_array_elements(lista -> 'variantes') loop
        nv := privado.redondear_precio(case when p_tipo = 'porcentaje' then (v ->> 'monto')::numeric * (1 + p_valor / 100)
                                            else (v ->> 'monto')::numeric + p_valor end, p_redondeo);
        if nv >= nuevo then problema := 'Con el redondeo, un precio especial queda igual al general: redondeá a menos'; end if;
        vs := vs || jsonb_build_object('medio', v -> 'medio', 'hasta_dia', v -> 'hasta_dia', 'antes', (v ->> 'monto')::numeric, 'monto', nv);
      end loop;
    end if;
    res := res || jsonb_build_object('plan_id', r.id, 'nombre', r.nombre, 'tipo', r.tipo, 'socios', r.socios,
      'antes', (lista ->> 'general')::numeric, 'nuevo', nuevo, 'variantes', vs, 'problema', problema,
      'despues', despues);  -- otro aumento ya programado más adelante: va a regir ese
  end loop;
  if jsonb_array_length(res) <> cardinality(p_planes) then raise exception 'Sin permiso o plan inexistente' using errcode = '42501'; end if;
  return jsonb_build_object('desde', momento, 'planes', res);
end $$;
revoke all on function privado.aumento_planes(uuid, uuid[], text, numeric, int, date) from public;

create or replace function public.vista_aumento(p_gimnasio_id uuid, p_planes uuid[], p_tipo text, p_valor numeric, p_redondeo int, p_desde date)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return privado.aumento_planes(p_gimnasio_id, p_planes, p_tipo, p_valor, p_redondeo, p_desde);
end $$;

create or replace function public.aplicar_aumento(p_gimnasio_id uuid, p_planes uuid[], p_tipo text, p_valor numeric, p_redondeo int, p_desde date)
returns int
language plpgsql security definer set search_path = '' as $$
declare a jsonb; x jsonb; n int := 0;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  a := privado.aumento_planes(p_gimnasio_id, p_planes, p_tipo, p_valor, p_redondeo, p_desde);
  for x in select * from jsonb_array_elements(a -> 'planes') loop
    if x ->> 'problema' is not null then raise exception '%: %', x ->> 'nombre', x ->> 'problema' using errcode = '22023'; end if;
  end loop;
  for x in select * from jsonb_array_elements(a -> 'planes') loop
    perform public.programar_lista_precios((x ->> 'plan_id')::uuid, (x ->> 'nuevo')::numeric,
      (select coalesce(jsonb_agg(jsonb_build_object('medio', v -> 'medio', 'hasta_dia', v -> 'hasta_dia', 'monto', v -> 'monto')), '[]')
         from jsonb_array_elements(x -> 'variantes') v),
      p_desde);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.vista_aumento(uuid, uuid[], text, numeric, int, date), public.aplicar_aumento(uuid, uuid[], text, numeric, int, date)
  from public, anon, authenticated;
grant execute on function public.vista_aumento(uuid, uuid[], text, numeric, int, date), public.aplicar_aumento(uuid, uuid[], text, numeric, int, date)
  to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.vista_aumento(uuid, uuid[], text, numeric, int, date)', 'public.aplicar_aumento(uuid, uuid[], text, numeric, int, date)',
                           'privado.aumento_planes(uuid, uuid[], text, numeric, int, date)', 'privado.redondear_precio(numeric, int)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if privado.redondear_precio(31234, 100) <> 31200 or privado.redondear_precio(31250, 100) <> 31300 then
    raise exception 'Verificación: redondear_precio';
  end if;
end $$;
