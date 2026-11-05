-- 0098 · El socio entra con su mail y un código (APP-9).
-- Igual que con el celular: el servidor vincula la cuenta a los socios de ESE
-- gimnasio con ese mail (verificado). Los menores no: los vincula el celular
-- del adulto responsable. Si el socio ya está vinculado a otra cuenta (entró
-- con el celular), se dice, en vez de "tu mail no está cargado".
--   vincular_socios_por_email(gimnasio, usuario) → { vinculados, ya_vinculado }

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if position('vigente_desde - 1' in pg_get_constraintdef((select oid from pg_constraint where conname = 'horarios_clase_vigencia'))) = 0 then
    raise exception 'Guarda: falta la migración 0097';
  end if;
end $$;

create or replace function public.vincular_socios_por_email(p_gimnasio_id uuid, p_usuario_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare mail text; n int; hoy date; ya boolean;
begin
  if not privado.es_servicio() then raise exception 'Solo el servidor vincula socios' using errcode = '42501'; end if;
  select lower(u.email) into mail from auth.users u where u.id = p_usuario_id and u.email_confirmed_at is not null;
  if mail is null or mail = '' then raise exception 'El mail de esa cuenta no está verificado'; end if;
  select privado.dia_local(now(), gi.zona_horaria) into hoy from public.gimnasios gi where gi.id = p_gimnasio_id;
  update public.socios s set usuario_id = p_usuario_id
   where s.gimnasio_id = p_gimnasio_id and s.usuario_id is null and s.dado_de_baja_en is null
     and lower(s.email) = mail and not privado.es_menor(s.fecha_nacimiento, hoy);
  get diagnostics n = row_count;
  select exists (select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null
                  and lower(s.email) = mail and s.usuario_id is not null and s.usuario_id <> p_usuario_id) into ya;
  return jsonb_build_object('vinculados', n, 'ya_vinculado', ya);
end $$;

revoke all on function public.vincular_socios_por_email(uuid, uuid) from public, anon, authenticated;
grant execute on function public.vincular_socios_por_email(uuid, uuid) to service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if has_function_privilege('authenticated', 'public.vincular_socios_por_email(uuid, uuid)', 'execute') then
    raise exception 'Verificación: un usuario puede vincularse solo a un socio';
  end if;
  if not exists (select 1 from pg_proc where oid = 'public.vincular_socios_por_email(uuid, uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: vincular_socios_por_email sin search_path vacío';
  end if;
end $$;
