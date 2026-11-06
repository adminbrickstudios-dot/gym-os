-- VD-6 · Alta rápida (Entrada) y alta completa (Socios): lo que la pantalla necesita de la base.
--   planes_para_alta(sede)               las membresías activas con su primer pago (cuota + matrícula), en un viaje
--   prospecto_por_telefono(gim, celular) el Interesado con ese celular, para ofrecerlo en el alta
-- Los precios y el total salen de la misma cuenta que usa Vender (privado.precios_por_medio y la
-- matrícula del plan): la pantalla no suma nada.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.precios_por_medio(uuid, uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.precios_por_medio'; end if;
  if to_regprocedure('privado.telefono_normalizado(text, text)') is null then raise exception 'Guarda: falta privado.telefono_normalizado'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
  if to_regclass('public.prospectos') is null then raise exception 'Guarda: falta prospectos'; end if;
end $$;

create or replace function public.planes_para_alta(p_sede_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; e public.equipo;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']);
  if e.sede_id is not null and e.sede_id <> p_sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'plan_id', p.id, 'nombre', p.nombre, 'descripcion', p.descripcion, 'duracion_meses', p.duracion_meses,
             'renovacion', p.renovacion, 'dia_fijo', p.dia_fijo,
             'lista', x.lista, 'efectivo', x.efectivo, 'matricula', p.matricula,
             'total_lista', case when x.lista is not null then x.lista + coalesce(p.matricula, 0) end,
             'total_efectivo', case when x.efectivo is not null then x.efectivo + coalesce(p.matricula, 0) end)
           order by p.orden, p.nombre)
      from public.planes p
      cross join lateral (select (pm ->> 'lista')::numeric as lista, (pm ->> 'efectivo')::numeric as efectivo
                            from (select privado.precios_por_medio(p.id, p_sede_id, now()) as pm) s) x
     where p.gimnasio_id = g and p.activo and p.tipo = 'membresia'), '[]'::jsonb);
end $$;

create or replace function public.prospecto_por_telefono(p_gimnasio_id uuid, p_telefono text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare tel text; r record;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  begin
    tel := privado.telefono_normalizado(p_telefono, 'Celular');
  exception when others then
    return null;     -- un celular a medio escribir no es un error: simplemente no coincide con nadie
  end;
  if tel is null then return null; end if;
  select p.id, p.nombre, p.creado_en into r from public.prospectos p
   where p.gimnasio_id = p_gimnasio_id and p.telefono = tel and p.estado <> 'socio';
  if not found then return null; end if;
  return jsonb_build_object('id', r.id, 'nombre', r.nombre, 'creado_en', r.creado_en);
end $$;

revoke all on function public.planes_para_alta(uuid), public.prospecto_por_telefono(uuid, text) from public, anon, authenticated;
grant execute on function public.planes_para_alta(uuid), public.prospecto_por_telefono(uuid, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.planes_para_alta(uuid)', 'public.prospecto_por_telefono(uuid, text)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
    if not has_function_privilege('authenticated', f, 'execute') then raise exception 'Verificación: authenticated no puede ejecutar %', f; end if;
  end loop;
end $$;
