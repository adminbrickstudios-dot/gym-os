-- Super admin · F2.10 y F2.11 (`docs/base/RECTA-FINAL.md`).
--
-- F2.10 · CUIT y razón social de cada gimnasio, para la factura que BRIK le hace (ficha del gimnasio, pestaña Datos).
--   · public.datos_fiscales_gimnasio: una fila por gimnasio (cerrada: solo se toca por las dos funciones de abajo).
--   · privado.cuit_valido: 11 cifras, prefijo 20/23/24/27/30/33/34 y dígito verificador (módulo 11). La pantalla avisa antes, la base decide.
--   · admin_datos_fiscales(gimnasio): lo ven los cuatro roles de BRIK.
--   · admin_guardar_datos_fiscales(gimnasio, cuit, razón social): solo principal y ventas; deja en el registro de BRIK lo de antes y lo de ahora.
--   El dueño no los ve ni los cambia: son datos de BRIK sobre su cliente. No tocan ninguna regla del gimnasio.
--
-- F2.11 · Sesiones abiertas de un gimnasio y "Cerrar todas" (para cuando un empleado se va mal).
--   · admin_sesiones_gimnasio(gimnasio): quién del equipo tiene sesiones abiertas y desde qué equipos. Solo el rol Principal.
--   · admin_cerrar_sesiones_gimnasio(gimnasio, motivo): borra las sesiones de las personas activas del equipo (no las de BRIK, ni la propia).
--     Solo el rol Principal, con motivo obligatorio, y queda en el registro de BRIK (que nadie puede borrar). Si la base no deja borrar
--     auth.sessions, falla con un texto claro y no cierra nada: nunca un éxito falso.
--   LÍMITE QUE HAY QUE SABER: cerrar una sesión corta el permiso de renovar; la pantalla que ya está abierta puede seguir andando hasta
--   que vence su permiso (hasta 1 hora). Para frenar a alguien YA hay que desactivarlo (eso la base lo niega al instante).
--
-- Aditiva e idempotente. Sin aplicar en producción hasta que Mateo lo pida.

do $guarda$
begin
  if to_regprocedure('privado.exigir_brik(text[])') is null then raise exception 'Guarda: falta privado.exigir_brik'; end if;
  if to_regprocedure('privado.registrar_brik(text, uuid, jsonb)') is null then raise exception 'Guarda: falta privado.registrar_brik'; end if;
  if to_regclass('auth.sessions') is null then raise exception 'Guarda: falta auth.sessions'; end if;
  if to_regclass('public.administradores_plataforma') is null then raise exception 'Guarda: falta administradores_plataforma'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'equipo' and column_name = 'es_soporte') then
    raise exception 'Guarda: falta equipo.es_soporte';
  end if;
end $guarda$;

-- ── F2.10 · CUIT válido ─────────────────────────────────────────────
create or replace function privado.cuit_valido(p_cuit text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare c text := regexp_replace(coalesce(p_cuit, ''), '\D', '', 'g'); suma int := 0; i int; pesos int[] := array[5, 4, 3, 2, 7, 6, 5, 4, 3, 2]; resto int; dig int;
begin
  if c !~ '^[0-9]{11}$' or substr(c, 1, 2) not in ('20', '23', '24', '27', '30', '33', '34') then return false; end if;
  for i in 1..10 loop suma := suma + pesos[i] * substr(c, i, 1)::int; end loop;
  resto := 11 - (suma % 11);
  dig := case when resto = 11 then 0 else resto end;
  return dig <> 10 and dig = substr(c, 11, 1)::int;
end $$;
revoke all on function privado.cuit_valido(text) from public;

-- ── F2.10 · Los datos ───────────────────────────────────────────────
create table if not exists public.datos_fiscales_gimnasio (
  gimnasio_id     uuid primary key references public.gimnasios(id),
  cuit            text check (cuit is null or cuit ~ '^[0-9]{11}$'),
  razon_social    text check (razon_social is null or length(razon_social) between 2 and 120),
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references auth.users(id)
);
alter table public.datos_fiscales_gimnasio enable row level security;
revoke all on table public.datos_fiscales_gimnasio from anon, authenticated;

create or replace function public.admin_datos_fiscales(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare f public.datos_fiscales_gimnasio; v_mail text;
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  if not exists (select 1 from public.gimnasios g where g.id = p_gimnasio_id) then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  select * into f from public.datos_fiscales_gimnasio d where d.gimnasio_id = p_gimnasio_id;
  if not found then
    return jsonb_build_object('cuit', null, 'razon_social', null, 'actualizado_en', null, 'actualizado_por', null);
  end if;
  select u.email into v_mail from auth.users u where u.id = f.actualizado_por;
  return jsonb_build_object('cuit', f.cuit, 'razon_social', f.razon_social, 'actualizado_en', f.actualizado_en, 'actualizado_por', v_mail);
end $$;
revoke execute on function public.admin_datos_fiscales(uuid) from public, anon;
grant execute on function public.admin_datos_fiscales(uuid) to authenticated;

create or replace function public.admin_guardar_datos_fiscales(p_gimnasio_id uuid, p_cuit text, p_razon_social text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_cuit text := nullif(regexp_replace(coalesce(p_cuit, ''), '\D', '', 'g'), '');
  v_razon text := nullif(btrim(regexp_replace(coalesce(p_razon_social, ''), '\s+', ' ', 'g')), '');
  antes public.datos_fiscales_gimnasio; n int; repetido boolean;
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  if not exists (select 1 from public.gimnasios g where g.id = p_gimnasio_id) then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  if nullif(btrim(coalesce(p_cuit, '')), '') is not null and not privado.cuit_valido(p_cuit) then
    raise exception 'El CUIT no es válido: tiene que tener 11 cifras y el dígito verificador correcto' using errcode = '22023';
  end if;
  if v_razon is not null and length(v_razon) not between 2 and 120 then
    raise exception 'La razón social va de 2 a 120 letras' using errcode = '22023';
  end if;
  select * into antes from public.datos_fiscales_gimnasio d where d.gimnasio_id = p_gimnasio_id;
  if v_cuit is null and v_razon is null then
    delete from public.datos_fiscales_gimnasio where gimnasio_id = p_gimnasio_id;
  else
    insert into public.datos_fiscales_gimnasio (gimnasio_id, cuit, razon_social, actualizado_en, actualizado_por)
    values (p_gimnasio_id, v_cuit, v_razon, now(), auth.uid())
    on conflict (gimnasio_id) do update set cuit = excluded.cuit, razon_social = excluded.razon_social, actualizado_en = now(), actualizado_por = auth.uid();
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudieron guardar los datos fiscales'; end if;
  end if;
  perform privado.registrar_brik('guardar_datos_fiscales', p_gimnasio_id, jsonb_build_object(
    'antes', jsonb_build_object('cuit', antes.cuit, 'razon_social', antes.razon_social),
    'despues', jsonb_build_object('cuit', v_cuit, 'razon_social', v_razon)));
  repetido := v_cuit is not null and exists (select 1 from public.datos_fiscales_gimnasio d where d.cuit = v_cuit and d.gimnasio_id <> p_gimnasio_id);
  return jsonb_build_object('cuit', v_cuit, 'razon_social', v_razon, 'repetido_en_otro_gimnasio', repetido);
end $$;
revoke execute on function public.admin_guardar_datos_fiscales(uuid, text, text) from public, anon;
grant execute on function public.admin_guardar_datos_fiscales(uuid, text, text) to authenticated;

-- ── F2.11 · Sesiones abiertas del equipo de un gimnasio ─────────────
create or replace function public.admin_sesiones_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare personas jsonb;
begin
  perform privado.exigir_brik(array['principal']);
  if not exists (select 1 from public.gimnasios g where g.id = p_gimnasio_id) then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(x.j order by x.cuantas desc, x.nombre), '[]'::jsonb) into personas from (
    select e.nombre, count(s.id) as cuantas,
           jsonb_build_object('equipo_id', e.id, 'nombre', e.nombre, 'rol', e.rol, 'email', u.email,
             'es_brik', exists (select 1 from public.administradores_plataforma a where a.usuario_id = e.usuario_id),
             'sesiones', count(s.id),
             'ultima_actividad', max(coalesce(s.updated_at, s.created_at)),
             'equipos', coalesce(jsonb_agg(distinct left(s.user_agent, 80)) filter (where s.user_agent is not null), '[]'::jsonb)) as j
      from public.equipo e
      join auth.users u on u.id = e.usuario_id
      left join auth.sessions s on s.user_id = e.usuario_id and (s.not_after is null or s.not_after > now())
     where e.gimnasio_id = p_gimnasio_id and e.activo and not e.es_soporte and e.usuario_id is not null
     group by e.id, e.nombre, e.rol, e.usuario_id, u.email) x;
  return jsonb_build_object('personas', personas,
    'total', (select coalesce(sum((p ->> 'sesiones')::int), 0) from jsonb_array_elements(personas) p where not (p ->> 'es_brik')::boolean));
end $$;
revoke execute on function public.admin_sesiones_gimnasio(uuid) from public, anon;
grant execute on function public.admin_sesiones_gimnasio(uuid) to authenticated;

-- ── F2.11 · Cerrar todas ────────────────────────────────────────────
create or replace function public.admin_cerrar_sesiones_gimnasio(p_gimnasio_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_motivo text := btrim(coalesce(p_motivo, '')); usuarios uuid[]; n int := 0;
begin
  perform privado.exigir_brik(array['principal']);
  if not exists (select 1 from public.gimnasios g where g.id = p_gimnasio_id) then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  if length(v_motivo) < 5 or length(v_motivo) > 300 then raise exception 'Escribí el motivo (de 5 a 300 letras): queda en el registro' using errcode = '22023'; end if;
  -- Las personas activas del equipo, menos las cuentas de BRIK (la de quien lo pide incluida): a BRIK no se le cierra la sesión desde acá.
  select array_agg(distinct e.usuario_id) into usuarios
    from public.equipo e
   where e.gimnasio_id = p_gimnasio_id and e.activo and not e.es_soporte and e.usuario_id is not null
     and e.usuario_id is distinct from auth.uid()
     and not exists (select 1 from public.administradores_plataforma a where a.usuario_id = e.usuario_id);
  if usuarios is not null then
    begin
      delete from auth.sessions where user_id = any (usuarios);
      get diagnostics n = row_count;
    exception when insufficient_privilege then
      raise exception 'La base no dejó cerrar las sesiones (sin permiso sobre auth.sessions). No se cerró ninguna.' using errcode = '42501';
    end;
  end if;
  perform privado.registrar_brik('cerrar_sesiones', p_gimnasio_id,
    jsonb_build_object('motivo', v_motivo, 'personas', coalesce(array_length(usuarios, 1), 0), 'sesiones', n));
  return jsonb_build_object('personas', coalesce(array_length(usuarios, 1), 0), 'sesiones', n);
end $$;
revoke execute on function public.admin_cerrar_sesiones_gimnasio(uuid, text) from public, anon;
grant execute on function public.admin_cerrar_sesiones_gimnasio(uuid, text) to authenticated;

-- ── Verificación ────────────────────────────────────────────────────
do $verif$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.datos_fiscales_gimnasio'::regclass) then raise exception 'Verificación: datos_fiscales_gimnasio sin RLS'; end if;
  if has_table_privilege('authenticated', 'public.datos_fiscales_gimnasio', 'select') or has_table_privilege('anon', 'public.datos_fiscales_gimnasio', 'select') then
    raise exception 'Verificación: datos_fiscales_gimnasio abierta a anon o authenticated';
  end if;
  foreach f in array array['privado.cuit_valido(text)', 'public.admin_datos_fiscales(uuid)', 'public.admin_guardar_datos_fiscales(uuid, text, text)',
                           'public.admin_sesiones_gimnasio(uuid)', 'public.admin_cerrar_sesiones_gimnasio(uuid, text)'] loop
    if to_regprocedure(f) is null then raise exception 'Verificación: falta %', f; end if;
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
    if has_function_privilege('authenticated', f, 'execute') <> (f like 'public.%') then raise exception 'Verificación: permisos de %', f; end if;
  end loop;
  if not privado.cuit_valido('20-12345678-6') or privado.cuit_valido('20-12345678-5') or privado.cuit_valido('10-12345678-6') then
    raise exception 'Verificación: cuit_valido no distingue bien';
  end if;
end $verif$;
