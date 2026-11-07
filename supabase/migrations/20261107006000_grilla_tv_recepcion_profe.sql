-- VD-60 · Grilla de clases y TV de la sala también para la recepción y el profe (D34).
--   tvs_panel(g)            ahora también recepción y profe (ver las TVs del gimnasio)
--   crear_tv(g, sede, nom)  ahora también recepción y profe (poner una TV en la sala)
--   revocar_tv(id)          NO cambia: sacar una TV sigue siendo del dueño y el encargado
-- La grilla (actividades y horarios) ya se lee con cualquier rol del equipo: se escribe solo por dueño y encargado.
-- Misma firma que 20261104013400 (cambia solo la lista de roles): nada se borra.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.crear_tv(uuid, uuid, text)') is null then raise exception 'Guarda: falta crear_tv'; end if;
  if to_regprocedure('public.tvs_panel(uuid)') is null then raise exception 'Guarda: falta tvs_panel'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta exigir_equipo'; end if;
end $$;

create or replace function public.tvs_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nombre', t.nombre, 'sede', s.nombre, 'creado_en', t.creado_en) order by t.creado_en)
    from public.pantallas_tv t join public.sedes s on s.id = t.sede_id where t.gimnasio_id = p_gimnasio_id and t.revocada_en is null), '[]');
end $$;

create or replace function public.crear_tv(p_gimnasio_id uuid, p_sede_id uuid, p_nombre text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; nom text := nullif(trim(coalesce(p_nombre, '')), ''); tok text; v_id uuid;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  if nom is null then raise exception 'Ponele un nombre a la TV (por ejemplo "Sala de spinning").' using errcode = '22023'; end if;
  if length(nom) > 40 then raise exception 'El nombre: hasta 40 letras.' using errcode = '22023'; end if;
  if not exists (select 1 from public.sedes s where s.id = p_sede_id and s.gimnasio_id = p_gimnasio_id) then
    raise exception 'Esa sede no es de este gimnasio.' using errcode = '22023';
  end if;
  if (select count(*) from public.pantallas_tv t where t.gimnasio_id = p_gimnasio_id and t.revocada_en is null) >= 10 then
    raise exception 'Hay 10 TVs: sacá alguna que no se use.' using errcode = '22023';
  end if;
  tok := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.pantallas_tv (gimnasio_id, sede_id, nombre, token_hash, creado_por)
  values (p_gimnasio_id, p_sede_id, nom, encode(extensions.digest(tok, 'sha256'), 'hex'), e.id)
  returning id into v_id;
  -- El token se ve una sola vez.
  return jsonb_build_object('id', v_id, 'token', tok);
end $$;

revoke all on function public.crear_tv(uuid, uuid, text), public.tvs_panel(uuid) from public, anon, authenticated;
grant execute on function public.crear_tv(uuid, uuid, text), public.tvs_panel(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare d text;
begin
  d := pg_get_functiondef('public.crear_tv(uuid, uuid, text)'::regprocedure);
  if position('recepcion' in d) = 0 or position('profe' in d) = 0 then raise exception 'Verificación: crear_tv no admite recepción y profe'; end if;
  d := pg_get_functiondef('public.tvs_panel(uuid)'::regprocedure);
  if position('recepcion' in d) = 0 or position('profe' in d) = 0 then raise exception 'Verificación: tvs_panel no admite recepción y profe'; end if;
  d := pg_get_functiondef('public.revocar_tv(uuid)'::regprocedure);
  if position('recepcion' in d) > 0 or position('profe' in d) > 0 then raise exception 'Verificación: revocar_tv no debe cambiar'; end if;
  if has_function_privilege('anon', 'public.crear_tv(uuid, uuid, text)', 'execute') then raise exception 'Verificación: crear_tv quedó para anon'; end if;
end $$;
