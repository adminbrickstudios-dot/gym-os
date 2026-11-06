-- VD-22 · Entrar con Google (D23, docs/v2/05 §1).
-- Un Google NUNCA se vincula a un socio por nombre ni por un mail suelto: la primera vez la persona
-- prueba quién es con el DNI del socio + un código al celular o mail que el gimnasio ya tiene cargado
-- (el mismo código de siempre). Recién ahí se guarda el vínculo. Un Google ya vinculado entra directo.
--
--   vinculos_google                 qué cuenta de Google sostiene a qué socio (una sola activa por socio)
--   socio_para_vincular_google      (servidor) el socio de un DNI y a dónde mandarle el código
--   vincular_google                 (servidor) guarda el vínculo si el DNI y el código cierran; si el Google ya
--                                   tiene a otra persona, o el socio ya tiene otro Google, pide confirmar
--   entrar_con_google               (servidor) al volver con Google: el socio vuelve a su cuenta de Google
--   vincular_socios_por_telefono/email  igual que antes, pero un código del celular o el mail también puede
--                                   recuperar al socio que hoy sostiene un Google (si no, quien vinculó Google
--                                   quedaba sin poder entrar por celular)
-- Los socios siguen colgando de socios.usuario_id (una sola fuente): este vínculo es la prueba de por qué.
-- No se tocan vender, registrar_ingreso, para_hacer_hoy, pendientes_panel, panel_gimnasio ni landing_*.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.registrar_pedido_codigo(text, text)') is null then raise exception 'Guarda: falta registrar_pedido_codigo (migración 0112)'; end if;
  if to_regprocedure('public.vincular_socios_por_email(uuid, uuid)') is null then raise exception 'Guarda: falta vincular_socios_por_email (0098)'; end if;
  if to_regprocedure('public.vincular_socios_por_telefono(uuid, uuid)') is null then raise exception 'Guarda: falta vincular_socios_por_telefono'; end if;
  if to_regprocedure('privado.es_menor(date, date)') is null then raise exception 'Guarda: falta privado.es_menor'; end if;
  if to_regprocedure('privado.es_servicio()') is null then raise exception 'Guarda: falta privado.es_servicio'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'socios' and column_name = 'dni') then
    raise exception 'Guarda: falta socios.dni';
  end if;
end $$;

-- ── El vínculo ──────────────────────────────────────────────────────
create table if not exists public.vinculos_google (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  usuario_id   uuid not null references auth.users(id) on delete cascade,
  socio_id     uuid not null,
  metodo       text not null check (metodo in ('celular', 'mail')),
  creado_en    timestamptz not null default now(),
  revocado_en  timestamptz,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id)
);
-- Un socio tiene a lo sumo UN Google activo; un Google puede sostener a varios socios (una familia), con confirmación.
create unique index if not exists vinculos_google_un_google_por_socio on public.vinculos_google (gimnasio_id, socio_id) where revocado_en is null;
create index if not exists vinculos_google_usuario on public.vinculos_google (gimnasio_id, usuario_id) where revocado_en is null;
alter table public.vinculos_google enable row level security;
revoke all on table public.vinculos_google from anon, authenticated;
grant select on table public.vinculos_google to authenticated;
drop policy if exists propios_lee on public.vinculos_google;
create policy propios_lee on public.vinculos_google for select to authenticated using (usuario_id = auth.uid());

-- ── El socio de un DNI y a dónde mandarle el código (solo el servidor) ───
create or replace function public.socio_para_vincular_google(p_gimnasio_id uuid, p_dni text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios; hoy date; menor boolean;
begin
  if not privado.es_servicio() then raise exception 'Solo el servidor' using errcode = '42501'; end if;
  select * into s from public.socios x
   where x.gimnasio_id = p_gimnasio_id and x.dni = nullif(trim(p_dni), '') and x.dado_de_baja_en is null;
  if s.id is null then return null; end if;
  select privado.dia_local(now(), gi.zona_horaria) into hoy from public.gimnasios gi where gi.id = p_gimnasio_id;
  menor := privado.es_menor(s.fecha_nacimiento, hoy);
  -- El menor se prueba con el celular del adulto responsable; el mail es solo de los adultos.
  return jsonb_build_object('socio_id', s.id,
    'telefono', case when menor then s.responsable_telefono else s.telefono end,
    'email', case when menor then null else lower(s.email) end);
end $$;

-- ── Vincular (solo el servidor, con la prueba del código) ───────────
create or replace function public.vincular_google(p_gimnasio_id uuid, p_usuario_id uuid, p_dni text, p_verificado_id uuid, p_confirmar boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  generico constant text := 'El DNI o el código no son correctos';
  s public.socios; hoy date; menor boolean; ok_google boolean;
  v_tel text; v_mail text; v_ingreso timestamptz; v_tel_ok timestamptz; v_mail_ok timestamptz;
  tel_v text; mail_v text; via text; otros text[]; otra uuid; n int;
begin
  if not privado.es_servicio() then raise exception 'Solo el servidor vincula socios' using errcode = '42501'; end if;

  -- 1 · La cuenta tiene que ser de Google (si no, no hay nada que vincular).
  select coalesce(u.raw_app_meta_data ->> 'provider' = 'google', false) or coalesce((u.raw_app_meta_data -> 'providers') ? 'google', false)
    into ok_google from auth.users u where u.id = p_usuario_id;
  if not coalesce(ok_google, false) then raise exception 'Esa cuenta no entró con Google' using errcode = 'P0001'; end if;

  -- 2 · El socio por DNI, de ESTE gimnasio. Mismo mensaje si no existe o si el código no cierra: no se averigua quién es socio.
  select * into s from public.socios x
   where x.gimnasio_id = p_gimnasio_id and x.dni = nullif(trim(p_dni), '') and x.dado_de_baja_en is null;
  if s.id is null then raise exception '%', generico using errcode = 'P0001'; end if;
  select privado.dia_local(now(), gi.zona_horaria) into hoy from public.gimnasios gi where gi.id = p_gimnasio_id;
  menor := privado.es_menor(s.fecha_nacimiento, hoy);

  -- 3 · La prueba: el servidor acaba de verificar un código en el celular (o mail) del socio. Esa cuenta tiene que
  --     tener el contacto confirmado, igual al que el gimnasio cargó, y haber entrado hace minutos.
  select u.phone, lower(u.email), u.last_sign_in_at, u.phone_confirmed_at, u.email_confirmed_at
    into v_tel, v_mail, v_ingreso, v_tel_ok, v_mail_ok from auth.users u where u.id = p_verificado_id;
  if v_ingreso is null or v_ingreso < now() - interval '15 minutes' then raise exception '%', generico using errcode = 'P0001'; end if;
  if v_tel_ok is not null and v_tel is not null then tel_v := '+' || regexp_replace(v_tel, '\D', '', 'g'); end if;
  if v_mail_ok is not null and v_mail is not null then mail_v := v_mail; end if;
  if tel_v is not null and tel_v = case when menor then s.responsable_telefono else s.telefono end then via := 'celular';
  elsif mail_v is not null and not menor and mail_v = lower(s.email) then via := 'mail';
  else raise exception '%', generico using errcode = 'P0001';
  end if;

  -- 4 · Cosas que piden confirmación: este Google ya sostiene a otra persona, o este socio ya tiene otro Google.
  select coalesce(array_agg(trim(x.nombre || ' ' || x.apellido) order by x.nombre), '{}') into otros
    from public.vinculos_google vg
    join public.socios x on x.gimnasio_id = vg.gimnasio_id and x.id = vg.socio_id
   where vg.gimnasio_id = p_gimnasio_id and vg.usuario_id = p_usuario_id and vg.revocado_en is null and vg.socio_id <> s.id
     and not ((tel_v is not null and tel_v in (coalesce(x.telefono, ''), coalesce(x.responsable_telefono, '')))
              or (mail_v is not null and mail_v = lower(coalesce(x.email, ''))));
  select vg.usuario_id into otra from public.vinculos_google vg
   where vg.gimnasio_id = p_gimnasio_id and vg.socio_id = s.id and vg.revocado_en is null and vg.usuario_id <> p_usuario_id;
  if (cardinality(otros) > 0 or otra is not null) and not coalesce(p_confirmar, false) then
    return jsonb_build_object('estado', 'confirmar', 'socio', trim(s.nombre || ' ' || s.apellido),
                              'otros', to_jsonb(otros), 'otra_cuenta', otra is not null);
  end if;

  -- 5 · Se guarda: el Google anterior del socio (si lo había) se revoca, y el socio pasa a esta cuenta.
  update public.vinculos_google set revocado_en = now()
   where gimnasio_id = p_gimnasio_id and socio_id = s.id and revocado_en is null and usuario_id <> p_usuario_id;
  insert into public.vinculos_google (gimnasio_id, usuario_id, socio_id, metodo)
  values (p_gimnasio_id, p_usuario_id, s.id, via)
  on conflict (gimnasio_id, socio_id) where revocado_en is null do nothing;
  update public.socios set usuario_id = p_usuario_id where id = s.id and gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo vincular al socio'; end if;
  return jsonb_build_object('estado', 'vinculado', 'socio_id', s.id, 'socio', trim(s.nombre || ' ' || s.apellido), 'metodo', via);
end $$;

-- ── Volver con Google: el socio ya vinculado entra directo ──────────
create or replace function public.entrar_con_google(p_gimnasio_id uuid, p_usuario_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not privado.es_servicio() then raise exception 'Solo el servidor' using errcode = '42501'; end if;
  -- Solo los socios de un vínculo vigente de ESTE Google en ESTE gimnasio (volvió a su cuenta de Google tras entrar por celular).
  update public.socios s set usuario_id = p_usuario_id
    from public.vinculos_google vg
   where vg.gimnasio_id = p_gimnasio_id and vg.usuario_id = p_usuario_id and vg.revocado_en is null
     and s.gimnasio_id = vg.gimnasio_id and s.id = vg.socio_id and s.dado_de_baja_en is null
     and s.usuario_id is distinct from p_usuario_id;
  select count(*)::int into n from public.socios s where s.gimnasio_id = p_gimnasio_id and s.usuario_id = p_usuario_id and s.dado_de_baja_en is null;
  return n;
end $$;

-- ── El código del celular y del mail también recuperan al socio que sostiene un Google ──
create or replace function public.vincular_socios_por_telefono(p_gimnasio_id uuid, p_usuario_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare tel text; n int; hoy date;
begin
  if not privado.es_servicio() then raise exception 'Solo el servidor vincula socios' using errcode = '42501'; end if;
  select u.phone into tel from auth.users u where u.id = p_usuario_id and u.phone_confirmed_at is not null;
  if tel is null then raise exception 'El teléfono de esa cuenta no está verificado'; end if;
  tel := '+' || regexp_replace(tel, '\D', '', 'g');
  select privado.dia_local(now(), gi.zona_horaria) into hoy from public.gimnasios gi where gi.id = p_gimnasio_id;
  update public.socios s set usuario_id = p_usuario_id
   where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null
     and (s.usuario_id is null
          or exists (select 1 from public.vinculos_google vg where vg.gimnasio_id = s.gimnasio_id and vg.socio_id = s.id
                      and vg.usuario_id = s.usuario_id and vg.revocado_en is null))
     and case when privado.es_menor(s.fecha_nacimiento, hoy) then s.responsable_telefono = tel else s.telefono = tel end;
  get diagnostics n = row_count;
  return n;
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
   where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null
     and (s.usuario_id is null
          or exists (select 1 from public.vinculos_google vg where vg.gimnasio_id = s.gimnasio_id and vg.socio_id = s.id
                      and vg.usuario_id = s.usuario_id and vg.revocado_en is null))
     and lower(s.email) = mail and not privado.es_menor(s.fecha_nacimiento, hoy);
  get diagnostics n = row_count;
  select exists (select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null
                  and lower(s.email) = mail and s.usuario_id is not null and s.usuario_id <> p_usuario_id) into ya;
  return jsonb_build_object('vinculados', n, 'ya_vinculado', ya);
end $$;

-- ── Permisos: todo es del servidor ──────────────────────────────────
revoke all on function public.socio_para_vincular_google(uuid, text) from public, anon, authenticated;
revoke all on function public.vincular_google(uuid, uuid, text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.entrar_con_google(uuid, uuid) from public, anon, authenticated;
revoke all on function public.vincular_socios_por_telefono(uuid, uuid) from public, anon, authenticated;
revoke all on function public.vincular_socios_por_email(uuid, uuid) from public, anon, authenticated;
grant execute on function public.socio_para_vincular_google(uuid, text) to service_role;
grant execute on function public.vincular_google(uuid, uuid, text, uuid, boolean) to service_role;
grant execute on function public.entrar_con_google(uuid, uuid) to service_role;
grant execute on function public.vincular_socios_por_telefono(uuid, uuid) to service_role;
grant execute on function public.vincular_socios_por_email(uuid, uuid) to service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.vinculos_google'::regclass) then raise exception 'Verificación: vinculos_google sin RLS'; end if;
  foreach f in array array['public.socio_para_vincular_google(uuid, text)', 'public.vincular_google(uuid, uuid, text, uuid, boolean)',
                           'public.entrar_con_google(uuid, uuid)', 'public.vincular_socios_por_telefono(uuid, uuid)',
                           'public.vincular_socios_por_email(uuid, uuid)'] loop
    if has_function_privilege('authenticated', f, 'execute') or has_function_privilege('anon', f, 'execute') then
      raise exception 'Verificación: % no es solo del servidor', f;
    end if;
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.vinculos_google', 'insert') or has_table_privilege('authenticated', 'public.vinculos_google', 'update')
     or has_table_privilege('authenticated', 'public.vinculos_google', 'delete') then
    raise exception 'Verificación: un usuario puede escribir vinculos_google';
  end if;
end $$;
