-- 0119 · Sumar una sede desde Configuración (REV-2a).
-- Hasta ahora se editaban las sedes que había (la principal la crea el alta).
-- El dueño suma otra con su nombre; la caja de la sede se crea sola (trigger
-- de 0014) y la entrada y la grilla ya trabajan por sede.
--   sumar_sede(gimnasio, nombre) → id de la sede nueva (solo el dueño)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.al_crear_sede_caja()') is null then raise exception 'Guarda: falta la caja automática por sede (0014)'; end if;
  if to_regprocedure('public.guardar_datos_gimnasio(uuid, jsonb)') is null then raise exception 'Guarda: falta guardar_datos_gimnasio'; end if;
end $$;

create or replace function public.sumar_sede(p_gimnasio_id uuid, p_nombre text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_nombre text := trim(coalesce(p_nombre, '')); v_id uuid;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if v_nombre = '' then raise exception 'Escribí el nombre de la sede (por ejemplo, el barrio).' using errcode = '22023'; end if;
  if length(v_nombre) > 60 then raise exception 'El nombre de la sede puede tener hasta 60 letras.' using errcode = '22023'; end if;
  if exists (select 1 from public.sedes s where s.gimnasio_id = p_gimnasio_id and lower(s.nombre) = lower(v_nombre)) then
    raise exception 'Ya hay una sede que se llama "%".', v_nombre using errcode = '23505';
  end if;
  insert into public.sedes (gimnasio_id, nombre, es_principal) values (p_gimnasio_id, v_nombre, false) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.sumar_sede(uuid, text) from public, anon, authenticated;
grant execute on function public.sumar_sede(uuid, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.sumar_sede(uuid, text)') is null then raise exception 'Verificación: falta sumar_sede'; end if;
  if has_function_privilege('anon', 'public.sumar_sede(uuid, text)', 'execute') then raise exception 'Verificación: sumar_sede quedó para anon'; end if;
end $$;
