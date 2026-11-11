-- Carril B · Super admin, fase 2 (segunda parte): F2.1 a F2.9.
--   * Ciudad del gimnasio (admin_guardar_ciudad) y filtros de la lista por ciudad y módulo.
--   * errores_app: errores de pantalla (registrar_error_app) y su lectura (admin_errores).
--   * Tablero con errores de 24 h. Aviso en la campana del dueño cuando BRIK entra a ayudar.
--   * Lanzamiento, pausa, baja con 30 días, demo para reunión (7 días), exportación del gimnasio.
--   * Roles de BRIK (principal, soporte, ventas, lectura), segundo factor obligatorio (se prende cuando Mateo lo activa).
--   * Datos personales (Ley 25.326): exportar y borrar a un socio (la plata queda con el nombre tachado).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.admin_lista_gimnasios(text,text,text,text,date,date)') is null
     and to_regprocedure('public.admin_lista_gimnasios(text,text,text,text,date,date,text,text,boolean)') is null then raise exception 'Guarda: falta admin_lista_gimnasios'; end if;
  if to_regprocedure('privado.avisos_moderacion(uuid,text)') is null
     and to_regprocedure('privado.avisos_moderacion_base(uuid,text)') is null then raise exception 'Guarda: falta privado.avisos_moderacion'; end if;
  if to_regprocedure('privado.primeros_pasos(uuid)') is null then raise exception 'Guarda: falta privado.primeros_pasos'; end if;
  if to_regprocedure('privado.tiene_dos_pasos(uuid)') is null then raise exception 'Guarda: falta privado.tiene_dos_pasos'; end if;
  if to_regprocedure('public.admin_crear_gimnasio(text,text,text,text)') is null then raise exception 'Guarda: falta admin_crear_gimnasio'; end if;
end $$;

-- ── Columnas nuevas ─────────────────────────────────────────────────
alter table public.configuracion_gimnasio add column if not exists ciudad text;
alter table public.gimnasios add column if not exists baja_en timestamptz;
alter table public.gimnasios add column if not exists baja_motivo text;
alter table public.gimnasios add column if not exists demo_hasta timestamptz;
alter table public.gimnasios add column if not exists demo_para text;
alter table public.administradores_plataforma add column if not exists rol text not null default 'principal';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'administradores_plataforma_rol_valido') then
    alter table public.administradores_plataforma add constraint administradores_plataforma_rol_valido check (rol in ('principal', 'soporte', 'ventas', 'lectura'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'configuracion_ciudad_largo') then
    alter table public.configuracion_gimnasio add constraint configuracion_ciudad_largo check (ciudad is null or length(btrim(ciudad)) between 2 and 80);
  end if;
end $$;

-- ── Roles de BRIK ───────────────────────────────────────────────────
create or replace function privado.rol_brik() returns text
language sql stable security definer set search_path = '' as $$
  select a.rol from public.administradores_plataforma a where a.usuario_id = auth.uid()
$$;
revoke all on function privado.rol_brik() from public;

create or replace function privado.exigir_brik(p_roles text[]) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if not (privado.rol_brik() = any (p_roles)) then
    raise exception 'Tu rol de BRIK (%) no puede hacer esto', privado.rol_brik() using errcode = '42501';
  end if;
end $$;
revoke all on function privado.exigir_brik(text[]) from public;

-- Entrar como soporte y buscar personas: principal y soporte.
create or replace function public.admin_entrar_gimnasio(p_gimnasio_id uuid, p_motivo text, p_rol text default 'dueno') returns text
language plpgsql security definer set search_path = '' as $$
declare v_slug text; e public.equipo; n int; v_motivo text := btrim(coalesce(p_motivo, '')); v_rol text := coalesce(nullif(btrim(p_rol), ''), 'dueno');
begin
  perform privado.exigir_brik(array['principal', 'soporte']);
  if v_rol not in ('dueno', 'recepcion', 'profe') then raise exception 'Elegí con qué rol entrar: dueño, recepción o profe' using errcode = '22023'; end if;
  if length(v_motivo) < 5 then raise exception 'Escribí el motivo de la entrada (al menos 5 letras): el dueño lo va a ver en su Control' using errcode = '22023'; end if;
  if length(v_motivo) > 300 then raise exception 'El motivo es muy largo (máximo 300 letras)' using errcode = '22023'; end if;
  select g.slug into v_slug from public.gimnasios g where g.id = p_gimnasio_id;
  if not found then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  select * into e from public.equipo where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid();
  if found then
    if not e.es_soporte then raise exception 'Tu cuenta es parte del equipo de este gimnasio: entrá con ella, no como soporte'; end if;
    update public.equipo set activo = true, rol = v_rol where id = e.id;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo activar el acceso de soporte'; end if;
  else
    insert into public.equipo (gimnasio_id, usuario_id, nombre, rol, es_soporte) values (p_gimnasio_id, auth.uid(), 'Soporte BRIK', v_rol, true);
  end if;
  update public.soportes_gimnasio set salio_en = now() where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and salio_en is null;
  insert into public.soportes_gimnasio (gimnasio_id, usuario_id, motivo, rol) values (p_gimnasio_id, auth.uid(), v_motivo, v_rol);
  perform privado.registrar_brik('entrar_como_soporte', p_gimnasio_id, jsonb_build_object('rol', v_rol, 'motivo', v_motivo));
  return v_slug;
end $$;
revoke execute on function public.admin_entrar_gimnasio(uuid, text, text) from public, anon;
grant execute on function public.admin_entrar_gimnasio(uuid, text, text) to authenticated;

-- ── Segundo factor del super admin ──────────────────────────────────
create table if not exists public.plataforma_ajustes (
  clave  text primary key check (length(clave) between 2 and 60),
  valor  jsonb not null
);
alter table public.plataforma_ajustes enable row level security;
revoke all on table public.plataforma_ajustes from anon, authenticated;

-- Con "exigir_2fa" prendido, ser admin de BRIK pide haber confirmado el código (aal2). Apagado (por defecto) no cambia nada.
create or replace function privado.soy_admin_plataforma() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.administradores_plataforma a where a.usuario_id = auth.uid())
     and (coalesce((select p.valor from public.plataforma_ajustes p where p.clave = 'exigir_2fa'), 'false'::jsonb) <> 'true'::jsonb
          or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
$$;

create or replace function public.admin_estado_seguridad() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  return jsonb_build_object('exigir_2fa', coalesce((select p.valor from public.plataforma_ajustes p where p.clave = 'exigir_2fa'), 'false'::jsonb),
    'yo_tengo_2fa', privado.tiene_dos_pasos(auth.uid()), 'mi_rol', privado.rol_brik(),
    'equipo', coalesce((select jsonb_agg(jsonb_build_object('usuario_id', a.usuario_id, 'email', u.email, 'rol', a.rol, 'tiene_2fa', privado.tiene_dos_pasos(a.usuario_id), 'soy_yo', a.usuario_id = auth.uid()) order by a.creado_en)
                          from public.administradores_plataforma a join auth.users u on u.id = a.usuario_id), '[]'::jsonb));
end $$;

-- Solo se puede exigir si quien lo prende ya confirmó su código (si no, se queda afuera él mismo).
create or replace function public.admin_exigir_2fa(p_exigir boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal']);
  if coalesce(p_exigir, false) and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Primero activá tu verificación en dos pasos y confirmá el código de ahora' using errcode = '42501';
  end if;
  insert into public.plataforma_ajustes (clave, valor) values ('exigir_2fa', to_jsonb(coalesce(p_exigir, false))) on conflict (clave) do update set valor = excluded.valor;
  perform privado.registrar_brik('exigir_2fa', null, jsonb_build_object('exigir', coalesce(p_exigir, false)));
end $$;
revoke execute on function public.admin_estado_seguridad(), public.admin_exigir_2fa(boolean) from public, anon;
grant execute on function public.admin_estado_seguridad(), public.admin_exigir_2fa(boolean) to authenticated;

-- Dar o cambiar el rol de BRIK a una cuenta que ya existe (por mail). Siempre queda al menos un principal.
create or replace function public.admin_dar_rol_brik(p_email text, p_rol text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid; v_rol text := btrim(coalesce(p_rol, ''));
begin
  perform privado.exigir_brik(array['principal']);
  if v_rol not in ('principal', 'soporte', 'ventas', 'lectura') then raise exception 'Rol: principal, soporte, ventas o lectura' using errcode = '22023'; end if;
  select id into u from auth.users where lower(email) = lower(btrim(coalesce(p_email, '')));
  if u is null then raise exception 'No hay ninguna cuenta con ese mail: creala primero' using errcode = 'P0002'; end if;
  if v_rol <> 'principal' and (select a.rol from public.administradores_plataforma a where a.usuario_id = u) = 'principal'
     and (select count(*) from public.administradores_plataforma where rol = 'principal' and usuario_id <> u) = 0 then
    raise exception 'Tiene que quedar al menos un principal' using errcode = '22023';
  end if;
  insert into public.administradores_plataforma (usuario_id, rol) values (u, v_rol) on conflict (usuario_id) do update set rol = excluded.rol;
  perform privado.registrar_brik('dar_rol_brik', null, jsonb_build_object('usuario_id', u, 'rol', v_rol));
end $$;

create or replace function public.admin_quitar_rol_brik(p_usuario_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_brik(array['principal']);
  if p_usuario_id = auth.uid() then raise exception 'No podés sacarte a vos mismo' using errcode = '22023'; end if;
  if (select rol from public.administradores_plataforma where usuario_id = p_usuario_id) = 'principal'
     and (select count(*) from public.administradores_plataforma where rol = 'principal') <= 1 then
    raise exception 'Tiene que quedar al menos un principal' using errcode = '22023';
  end if;
  delete from public.administradores_plataforma where usuario_id = p_usuario_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Esa cuenta no es de BRIK' using errcode = 'P0002'; end if;
  perform privado.registrar_brik('quitar_rol_brik', null, jsonb_build_object('usuario_id', p_usuario_id));
end $$;
revoke execute on function public.admin_dar_rol_brik(text, text), public.admin_quitar_rol_brik(uuid) from public, anon;
grant execute on function public.admin_dar_rol_brik(text, text), public.admin_quitar_rol_brik(uuid) to authenticated;

-- El registro de lo que hizo cada usuario de BRIK (lo ven principal y solo lectura).
create or replace function public.admin_registro_brik(p_limite int default 100) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'lectura']);
  return coalesce((select jsonb_agg(jsonb_build_object('accion', r.accion, 'quien', coalesce(u.email, 'sin mail'), 'gimnasio', g.nombre, 'gimnasio_id', r.gimnasio_id, 'detalle', r.detalle, 'cuando', r.creado_en) order by r.creado_en desc)
    from (select * from public.registro_brik x order by x.creado_en desc limit least(greatest(coalesce(p_limite, 100), 1), 500)) r
    left join auth.users u on u.id = r.usuario_id left join public.gimnasios g on g.id = r.gimnasio_id), '[]'::jsonb);
end $$;
revoke execute on function public.admin_registro_brik(int) from public, anon;
grant execute on function public.admin_registro_brik(int) to authenticated;

-- Buscar a cualquiera: principal y soporte (la versión de la primera parte, con el rol).
create or replace function public.admin_buscar_persona(p_q text, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_q text := btrim(coalesce(p_q, '')); v_motivo text := btrim(coalesce(p_motivo, '')); v_digitos text; v_res jsonb;
begin
  perform privado.exigir_brik(array['principal', 'soporte']);
  if length(v_q) < 4 then raise exception 'Escribí al menos 4 caracteres: mail, DNI o teléfono' using errcode = '22023'; end if;
  if length(v_motivo) < 5 then raise exception 'Escribí el motivo de la búsqueda (al menos 5 letras): queda registrado' using errcode = '22023'; end if;
  v_digitos := regexp_replace(v_q, '[^0-9]', '', 'g');
  select coalesce(jsonb_agg(x order by x ->> 'nombre'), '[]'::jsonb) into v_res from (
    select jsonb_build_object('tipo', 'socio', 'rol', 'socio', 'nombre', btrim(s.nombre || ' ' || s.apellido), 'gimnasio_id', g.id, 'gimnasio', g.nombre, 'slug', g.slug,
                              'persona_id', s.id, 'baja', s.dado_de_baja_en is not null) as x
      from public.socios s join public.gimnasios g on g.id = s.gimnasio_id
     where (position('@' in v_q) > 0 and lower(s.email) = lower(v_q))
        or (length(v_digitos) >= 6 and (s.dni = v_digitos or right(regexp_replace(coalesce(s.telefono, ''), '[^0-9]', '', 'g'), length(v_digitos)) = v_digitos))
    union all
    select jsonb_build_object('tipo', 'equipo', 'rol', e.rol, 'nombre', e.nombre, 'gimnasio_id', g.id, 'gimnasio', g.nombre, 'slug', g.slug,
                              'persona_id', e.id, 'baja', not e.activo)
      from public.equipo e join public.gimnasios g on g.id = e.gimnasio_id join auth.users u on u.id = e.usuario_id
     where not e.es_soporte and position('@' in v_q) > 0 and lower(u.email) = lower(v_q)
     limit 30
  ) t;
  perform privado.registrar_brik('buscar_persona', null, jsonb_build_object('busqueda', v_q, 'motivo', v_motivo, 'encontrados', jsonb_array_length(v_res)));
  return v_res;
end $$;
revoke execute on function public.admin_buscar_persona(text, text) from public, anon;
grant execute on function public.admin_buscar_persona(text, text) to authenticated;

-- ── Ciudad ──────────────────────────────────────────────────────────
create or replace function public.admin_guardar_ciudad(p_gimnasio_id uuid, p_ciudad text) returns void
language plpgsql security definer set search_path = '' as $$
declare n int; v text := nullif(btrim(coalesce(p_ciudad, '')), '');
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  update public.configuracion_gimnasio set ciudad = v where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  perform privado.registrar_brik('guardar_ciudad', p_gimnasio_id, jsonb_build_object('ciudad', v));
end $$;
revoke execute on function public.admin_guardar_ciudad(uuid, text) from public, anon;
grant execute on function public.admin_guardar_ciudad(uuid, text) to authenticated;

-- ── Errores de pantalla ─────────────────────────────────────────────
create table if not exists public.errores_app (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid references public.gimnasios(id),
  usuario_id   uuid references auth.users(id),
  pantalla     text not null check (length(pantalla) between 1 and 200),
  mensaje      text not null check (length(mensaje) between 1 and 400),
  creado_en    timestamptz not null default now()
);
create index if not exists errores_app_por_fecha on public.errores_app (creado_en desc);
create index if not exists errores_app_por_gimnasio on public.errores_app (gimnasio_id, creado_en desc);
alter table public.errores_app enable row level security;
revoke all on table public.errores_app from anon, authenticated;
drop trigger if exists errores_app_inmutable on public.errores_app;
create trigger errores_app_inmutable before update or delete on public.errores_app
  for each row execute function privado.hecho_inmutable('_ninguna');

-- Lo llama la pantalla de error de cada panel. Hasta 20 por hora y por persona (el resto se descarta sin error).
create or replace function public.registrar_error_app(p_gimnasio_id uuid, p_pantalla text, p_mensaje text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  if p_gimnasio_id is not null and not exists (select 1 from public.equipo e where e.gimnasio_id = p_gimnasio_id and e.usuario_id = auth.uid() and e.activo) then
    raise exception 'No sos parte de este gimnasio' using errcode = '42501';
  end if;
  if (select count(*) from public.errores_app x where x.usuario_id = auth.uid() and x.creado_en > now() - interval '1 hour') >= 20 then return; end if;
  insert into public.errores_app (gimnasio_id, usuario_id, pantalla, mensaje)
  values (p_gimnasio_id, auth.uid(), left(coalesce(nullif(btrim(p_pantalla), ''), '?'), 200), left(coalesce(nullif(btrim(p_mensaje), ''), '?'), 400));
end $$;
revoke execute on function public.registrar_error_app(uuid, text, text) from public, anon;
grant execute on function public.registrar_error_app(uuid, text, text) to authenticated;

-- Errores agrupados por pantalla (de toda la plataforma o de un gimnasio).
create or replace function public.admin_errores(p_gimnasio_id uuid default null, p_horas int default 24) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'lectura']);
  return coalesce((select jsonb_agg(jsonb_build_object('pantalla', t.pantalla, 'cantidad', t.n, 'ultimo', t.ultimo, 'mensaje', t.mensaje, 'gimnasio', t.gimnasio, 'gimnasio_id', t.gimnasio_id) order by t.n desc, t.ultimo desc)
    from (select x.pantalla, x.gimnasio_id, g.nombre as gimnasio, count(*)::int n, max(x.creado_en) ultimo, (array_agg(x.mensaje order by x.creado_en desc))[1] mensaje
            from public.errores_app x left join public.gimnasios g on g.id = x.gimnasio_id
           where x.creado_en > now() - make_interval(hours => least(greatest(coalesce(p_horas, 24), 1), 720))
             and (p_gimnasio_id is null or x.gimnasio_id = p_gimnasio_id)
           group by x.pantalla, x.gimnasio_id, g.nombre) t), '[]'::jsonb);
end $$;
revoke execute on function public.admin_errores(uuid, int) from public, anon;
grant execute on function public.admin_errores(uuid, int) to authenticated;

-- ── Pausa y baja ────────────────────────────────────────────────────
-- Pausado: el panel queda en solo lectura (la puerta y la app siguen, igual que con el abono vencido). No se borra nada.
create or replace function privado.solo_lectura(p_gimnasio_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select privado.estado_abono(p_gimnasio_id) ->> 'estado' = 'vencido'
      or exists (select 1 from public.gimnasios g where g.id = p_gimnasio_id and g.suspension_manual_en is not null)
$$;
revoke all on function privado.solo_lectura(uuid) from public;

create or replace function public.admin_pausar_gimnasio(p_gimnasio_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare n int; v text := btrim(coalesce(p_motivo, ''));
begin
  perform privado.exigir_brik(array['principal']);
  if length(v) < 5 then raise exception 'Escribí el motivo de la pausa (al menos 5 letras)' using errcode = '22023'; end if;
  update public.gimnasios set suspension_manual_en = now(), suspension_manual_motivo = v where id = p_gimnasio_id and suspension_manual_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'El gimnasio no existe o ya está pausado' using errcode = 'P0002'; end if;
  perform privado.registrar_brik('pausar_gimnasio', p_gimnasio_id, jsonb_build_object('motivo', v));
end $$;

create or replace function public.admin_reanudar_gimnasio(p_gimnasio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_brik(array['principal']);
  update public.gimnasios set suspension_manual_en = null, suspension_manual_motivo = null where id = p_gimnasio_id and suspension_manual_en is not null and baja_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'El gimnasio no está pausado (o está dado de baja: restauralo primero)' using errcode = 'P0002'; end if;
  perform privado.registrar_brik('reanudar_gimnasio', p_gimnasio_id, '{}'::jsonb);
end $$;

-- Dar de baja: queda pausado y "para borrar" por 30 días; se puede restaurar. El borrado definitivo no está hecho (ver PREGUNTAS.md).
create or replace function public.admin_dar_de_baja(p_gimnasio_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare n int; v text := btrim(coalesce(p_motivo, ''));
begin
  perform privado.exigir_brik(array['principal']);
  if length(v) < 5 then raise exception 'Escribí el motivo de la baja (al menos 5 letras)' using errcode = '22023'; end if;
  update public.gimnasios set baja_en = now(), baja_motivo = v,
         suspension_manual_en = coalesce(suspension_manual_en, now()), suspension_manual_motivo = coalesce(suspension_manual_motivo, 'Dado de baja: ' || v)
   where id = p_gimnasio_id and baja_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'El gimnasio no existe o ya está dado de baja' using errcode = 'P0002'; end if;
  perform privado.registrar_brik('dar_de_baja', p_gimnasio_id, jsonb_build_object('motivo', v));
end $$;

create or replace function public.admin_restaurar_baja(p_gimnasio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_brik(array['principal']);
  update public.gimnasios set baja_en = null, baja_motivo = null, suspension_manual_en = null, suspension_manual_motivo = null
   where id = p_gimnasio_id and baja_en is not null and baja_en > now() - interval '30 days';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No está dado de baja o ya pasaron los 30 días' using errcode = 'P0002'; end if;
  perform privado.registrar_brik('restaurar_baja', p_gimnasio_id, '{}'::jsonb);
end $$;
revoke execute on function public.admin_pausar_gimnasio(uuid, text), public.admin_reanudar_gimnasio(uuid), public.admin_dar_de_baja(uuid, text), public.admin_restaurar_baja(uuid) from public, anon;
grant execute on function public.admin_pausar_gimnasio(uuid, text), public.admin_reanudar_gimnasio(uuid), public.admin_dar_de_baja(uuid, text), public.admin_restaurar_baja(uuid) to authenticated;

-- ── Lista de lanzamiento ────────────────────────────────────────────
create or replace function public.admin_lanzamiento(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare pasos jsonb; hechos int; total int; r jsonb;
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  if not exists (select 1 from public.gimnasios where id = p_gimnasio_id) then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  pasos := privado.primeros_pasos(p_gimnasio_id);
  select count(*) filter (where (x ->> 'hecho')::boolean), count(*) into hechos, total
    from jsonb_array_elements(pasos) x where x ->> 'clave' not in ('socios', 'entrada', 'pagina');
  r := jsonb_build_array(
    jsonb_build_object('clave', 'dueno_entro', 'titulo', 'El dueño entró', 'falta', 'Pasale el link y su contraseña',
      'hecho', exists (select 1 from public.equipo e join auth.users u on u.id = e.usuario_id where e.gimnasio_id = p_gimnasio_id and e.rol = 'dueno' and e.activo and not e.es_soporte and u.last_sign_in_at is not null)),
    jsonb_build_object('clave', 'asistente', 'titulo', 'Terminó el asistente', 'falta', 'Le faltan ' || (total - hechos) || ' de ' || total || ' pasos', 'hecho', hechos = total),
    jsonb_build_object('clave', 'primer_socio', 'titulo', 'Cargó su primer socio', 'falta', 'Pedile que cargue los socios (o los importa con Excel)',
      'hecho', exists (select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and not s.es_ejemplo)),
    jsonb_build_object('clave', 'primer_ingreso', 'titulo', 'Registró su primer ingreso', 'falta', 'Pedile que pruebe la Entrada con un DNI',
      'hecho', exists (select 1 from public.ingresos i where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado')),
    jsonb_build_object('clave', 'primer_cobro', 'titulo', 'Hizo su primer cobro', 'falta', 'Pedile que cobre una cuota',
      'hecho', exists (select 1 from public.ventas v where v.gimnasio_id = p_gimnasio_id and v.estado = 'confirmada' and v.anulada_en is null)),
    jsonb_build_object('clave', 'pagina', 'titulo', 'Publicó su página', 'falta', 'Ayudalo a publicarla',
      'hecho', coalesce((select l.publicada from public.landing_gimnasio l where l.gimnasio_id = p_gimnasio_id), false)),
    jsonb_build_object('clave', 'mercadopago', 'titulo', 'Conectó MercadoPago', 'falta', 'Ofrecele conectar MercadoPago',
      'hecho', exists (select 1 from public.proveedores_pago pp where pp.gimnasio_id = p_gimnasio_id and pp.activo)));
  return r;
end $$;
revoke execute on function public.admin_lanzamiento(uuid) from public, anon;
grant execute on function public.admin_lanzamiento(uuid) to authenticated;

-- ── Demo para una reunión ───────────────────────────────────────────
-- Un gimnasio [demo] aparte, con la plantilla del tipo elegido y el nombre del interesado. A los 7 días queda "vencida" (se calcula).
create or replace function public.admin_crear_demo(p_interesado text, p_tipo text, p_dominio_base text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_nom text := btrim(coalesce(p_interesado, '')); v_slug text; r jsonb;
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  if length(v_nom) < 2 then raise exception 'Escribí el nombre del interesado' using errcode = '22023'; end if;
  v_slug := 'demo-' || left(regexp_replace(lower(privado.sin_acentos(v_nom)), '[^a-z0-9]+', '-', 'g'), 20) || '-' || substr(md5(random()::text), 1, 4);
  v_slug := regexp_replace(v_slug, '-+', '-', 'g');
  r := public.admin_crear_gimnasio(v_slug, '[demo] ' || v_nom, p_dominio_base, 'Demo ' || v_nom);
  update public.gimnasios set es_demo = true, demo_hasta = now() + interval '7 days', demo_para = v_nom where id = (r ->> 'gimnasio_id')::uuid;
  if p_tipo is not null then perform public.admin_aplicar_plantilla((r ->> 'gimnasio_id')::uuid, p_tipo); end if;
  perform privado.registrar_brik('crear_demo', (r ->> 'gimnasio_id')::uuid, jsonb_build_object('interesado', v_nom, 'tipo', p_tipo));
  return r || jsonb_build_object('vence', now() + interval '7 days');
end $$;

-- Demos vencidas (se calcula, sin cron) y "borrarlas": quedan dadas de baja (pausadas y para borrar).
create or replace function public.admin_demos_vencidas() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'ventas', 'lectura']);
  return coalesce((select jsonb_agg(jsonb_build_object('gimnasio_id', g.id, 'nombre', g.nombre, 'vencio', g.demo_hasta) order by g.demo_hasta)
    from public.gimnasios g where g.es_demo and g.demo_hasta is not null and g.demo_hasta < now() and g.baja_en is null), '[]'::jsonb);
end $$;

create or replace function public.admin_borrar_demos_vencidas() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  update public.gimnasios set baja_en = now(), baja_motivo = 'Demo vencida', suspension_manual_en = coalesce(suspension_manual_en, now()), suspension_manual_motivo = coalesce(suspension_manual_motivo, 'Demo vencida')
   where es_demo and demo_hasta is not null and demo_hasta < now() and baja_en is null;
  get diagnostics n = row_count;
  perform privado.registrar_brik('borrar_demos_vencidas', null, jsonb_build_object('cantidad', n));
  return n;
end $$;
revoke execute on function public.admin_crear_demo(text, text, text), public.admin_demos_vencidas(), public.admin_borrar_demos_vencidas() from public, anon;
grant execute on function public.admin_crear_demo(text, text, text), public.admin_demos_vencidas(), public.admin_borrar_demos_vencidas() to authenticated;

-- ── Exportar un gimnasio (la baja y el pedido del dueño) ────────────
-- Devuelve las listas; el servidor las arma en un zip de CSV. Sin claves ni tokens.
create or replace function public.admin_exportar_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  perform privado.exigir_brik(array['principal']);
  if not exists (select 1 from public.gimnasios where id = p_gimnasio_id) then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  select jsonb_build_object(
    'socios', coalesce((select jsonb_agg(jsonb_build_object('numero', s.numero, 'nombre', s.nombre, 'apellido', s.apellido, 'dni', s.dni, 'telefono', s.telefono, 'email', s.email,
        'fecha_nacimiento', s.fecha_nacimiento, 'alta', s.creado_en, 'baja', s.dado_de_baja_en) order by s.numero) from public.socios s where s.gimnasio_id = p_gimnasio_id), '[]'::jsonb),
    'pagos', coalesce((select jsonb_agg(jsonb_build_object('fecha', p.creado_en, 'medio', p.medio, 'monto', p.monto, 'estado', p.estado) order by p.creado_en) from public.pagos p where p.gimnasio_id = p_gimnasio_id), '[]'::jsonb),
    'ingresos', coalesce((select jsonb_agg(jsonb_build_object('momento', i.momento, 'socio_numero', s.numero, 'resultado', i.resultado, 'color', i.color, 'anulado', i.anulado_en) order by i.momento)
        from public.ingresos i left join public.socios s on s.id = i.socio_id where i.gimnasio_id = p_gimnasio_id), '[]'::jsonb),
    'planes', coalesce((select jsonb_agg(jsonb_build_object('tipo', pl.tipo, 'nombre', pl.nombre, 'activo', pl.activo) order by pl.orden, pl.nombre) from public.planes pl where pl.gimnasio_id = p_gimnasio_id), '[]'::jsonb))
  into r;
  perform privado.registrar_brik('exportar_gimnasio', p_gimnasio_id, '{}'::jsonb);
  return r;
end $$;
revoke execute on function public.admin_exportar_gimnasio(uuid) from public, anon;
grant execute on function public.admin_exportar_gimnasio(uuid) to authenticated;

-- ── Datos personales (Ley 25.326) ───────────────────────────────────
create or replace function public.admin_exportar_socio(p_gimnasio_id uuid, p_socio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.socios; r jsonb;
begin
  perform privado.exigir_brik(array['principal']);
  select * into s from public.socios where id = p_socio_id and gimnasio_id = p_gimnasio_id;
  if not found then raise exception 'Ese socio no existe en este gimnasio' using errcode = 'P0002'; end if;
  r := jsonb_build_object(
    'socio', jsonb_build_object('numero', s.numero, 'nombre', s.nombre, 'apellido', s.apellido, 'dni', s.dni, 'telefono', s.telefono, 'email', s.email,
      'fecha_nacimiento', s.fecha_nacimiento, 'contacto_emergencia', s.contacto_emergencia_nombre, 'contacto_emergencia_telefono', s.contacto_emergencia_telefono, 'alta', s.creado_en, 'baja', s.dado_de_baja_en),
    'ingresos', coalesce((select jsonb_agg(jsonb_build_object('momento', i.momento, 'resultado', i.resultado) order by i.momento) from public.ingresos i where i.socio_id = s.id and i.gimnasio_id = s.gimnasio_id), '[]'::jsonb),
    'coberturas', coalesce((select jsonb_agg(jsonb_build_object('desde', c.desde, 'hasta', c.hasta, 'anulada', c.anulada_en) order by c.desde) from public.coberturas c where c.socio_id = s.id and c.gimnasio_id = s.gimnasio_id), '[]'::jsonb));
  perform privado.registrar_brik('exportar_socio', p_gimnasio_id, jsonb_build_object('socio_numero', s.numero));
  return r;
end $$;

-- Borrar a un socio: se borran sus datos personales y el nombre queda tachado. Los pagos y las coberturas se quedan (la plata tiene que cuadrar).
create or replace function public.admin_borrar_socio(p_gimnasio_id uuid, p_socio_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare n int; v text := btrim(coalesce(p_motivo, ''));
begin
  perform privado.exigir_brik(array['principal']);
  if length(v) < 5 then raise exception 'Escribí el motivo (por ejemplo, el pedido del socio)' using errcode = '22023'; end if;
  update public.socios set nombre = 'Socio borrado', apellido = '', dni = null, telefono = null, email = null, fecha_nacimiento = null, foto_path = null, usuario_id = null,
         contacto_emergencia_nombre = null, contacto_emergencia_telefono = null, notas = null,
         dado_de_baja_en = coalesce(dado_de_baja_en, now()), motivo_baja = coalesce(motivo_baja, 'otro')
   where id = p_socio_id and gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese socio no existe en este gimnasio' using errcode = 'P0002'; end if;
  perform privado.registrar_brik('borrar_socio', p_gimnasio_id, jsonb_build_object('socio_id', p_socio_id, 'motivo', v));
end $$;
revoke execute on function public.admin_exportar_socio(uuid, uuid), public.admin_borrar_socio(uuid, uuid, text) from public, anon;
grant execute on function public.admin_exportar_socio(uuid, uuid), public.admin_borrar_socio(uuid, uuid, text) to authenticated;

-- ── Aviso en la campana del dueño: "BRIK entró a ayudarte" ──────────
-- Se envuelve el helper que arma los avisos de moderación (campana_control lo llama): el original queda como avisos_moderacion_base.
do $$
begin
  if to_regprocedure('privado.avisos_moderacion_base(uuid,text)') is null then
    alter function privado.avisos_moderacion(uuid, text) rename to avisos_moderacion_base;
  end if;
end $$;
create or replace function privado.avisos_moderacion(p_gimnasio_id uuid, p_zona text) returns jsonb
language plpgsql stable set search_path = '' as $$
begin
  return privado.avisos_moderacion_base(p_gimnasio_id, p_zona) || coalesce((
    select jsonb_agg(jsonb_build_object('clave', 'soporte:' || s.id::text, 'emoji', '🧱',
             'titulo', 'BRIK entró a ayudarte (' || case s.rol when 'dueno' then 'como dueño' when 'recepcion' then 'como recepción' else 'como profe' end || ')',
             'detalle', s.motivo, 'href', '/control', 'en', s.entro_en))
      from public.soportes_gimnasio s where s.gimnasio_id = p_gimnasio_id and s.entro_en > now() - interval '7 days'), '[]'::jsonb);
end $$;
revoke all on function privado.avisos_moderacion(uuid, text) from public, anon, authenticated;
revoke all on function privado.avisos_moderacion_base(uuid, text) from public, anon, authenticated;

-- ── La lista con ciudad, módulo y bajas ─────────────────────────────
drop function if exists public.admin_lista_gimnasios(text, text, text, text, date, date);
create or replace function public.admin_lista_gimnasios(p_q text default null, p_salud text default null, p_abono text default null,
    p_plan text default null, p_alta_desde date default null, p_alta_hasta date default null,
    p_ciudad text default null, p_modulo text default null, p_con_bajas boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare salud jsonb; v_q text := lower(btrim(coalesce(p_q, ''))); v_res jsonb;
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  if p_salud is not null and p_salud not in ('verde', 'amarillo', 'rojo') then raise exception 'Salud: verde, amarillo o rojo' using errcode = '22023'; end if;
  if p_abono is not null and p_abono not in ('al_dia', 'por_vencer', 'vencido', 'sin_abono') then raise exception 'Abono: al_dia, por_vencer, vencido o sin_abono' using errcode = '22023'; end if;
  if p_modulo is not null and not (array[p_modulo] <@ privado.secciones_validas()) then raise exception 'Ese módulo no existe' using errcode = '22023'; end if;
  salud := public.admin_salud_v2();
  select coalesce(jsonb_agg(f.fila order by f.favorito desc, f.orden, f.nombre), '[]'::jsonb) into v_res from (
    select r.nombre, r.favorito, coalesce((salud -> r.id::text ->> 'orden')::int, 2) as orden,
           jsonb_build_object('gimnasio_id', r.id, 'slug', r.slug, 'nombre', r.nombre, 'es_demo', r.es_demo, 'alta', r.creado_en, 'favorito', r.favorito,
             'suspendido', r.suspendido, 'para_borrar', r.baja_en is not null, 'demo_vencida', r.es_demo and r.demo_hasta is not null and r.demo_hasta < now(), 'ciudad', r.ciudad,
             'socios_activos', r.socios, 'entradas_hoy', r.entradas_hoy, 'ultimo_uso', r.ultimo_uso,
             'abono', r.abono -> 'estado', 'plan', r.abono -> 'plan', 'color', salud -> r.id::text -> 'color', 'motivos', salud -> r.id::text -> 'motivos',
             'dueno', r.dueno, 'dueno_telefono', r.dueno_telefono, 'hosts', r.hosts, 'modulos_apagados', to_jsonb(r.apagadas)) as fila
      from (
        select g.id, g.slug, g.nombre, g.es_demo, g.creado_en, g.baja_en, g.demo_hasta, g.suspension_manual_en is not null as suspendido,
               c.ciudad, coalesce(c.secciones_apagadas, '{}'::text[]) as apagadas,
               exists (select 1 from public.favoritos_brik f where f.usuario_id = auth.uid() and f.gimnasio_id = g.id) as favorito,
               (select count(*)::int from public.socios s where s.gimnasio_id = g.id and s.dado_de_baja_en is null) as socios,
               (select count(*)::int from public.ingresos i where i.gimnasio_id = g.id and i.anulado_en is null and i.resultado <> 'rechazado'
                   and privado.dia_local(i.momento, g.zona_horaria) = privado.dia_local(now(), g.zona_horaria)) as entradas_hoy,
               (select max(u.last_sign_in_at) from public.equipo e join auth.users u on u.id = e.usuario_id
                 where e.gimnasio_id = g.id and e.activo and not e.es_soporte) as ultimo_uso,
               privado.estado_abono(g.id) as abono,
               (select e.nombre from public.equipo e where e.gimnasio_id = g.id and e.rol = 'dueno' and e.activo and not e.es_soporte order by e.creado_en limit 1) as dueno,
               (select u.email from public.equipo e join auth.users u on u.id = e.usuario_id where e.gimnasio_id = g.id and e.rol = 'dueno' and e.activo and not e.es_soporte order by e.creado_en limit 1) as dueno_mail,
               (select u.phone from public.equipo e join auth.users u on u.id = e.usuario_id where e.gimnasio_id = g.id and e.rol = 'dueno' and e.activo and not e.es_soporte order by e.creado_en limit 1) as dueno_telefono,
               array(select d.host from public.dominios_gimnasio d where d.gimnasio_id = g.id order by d.tipo desc, d.host) as hosts
          from public.gimnasios g left join public.configuracion_gimnasio c on c.gimnasio_id = g.id
      ) r
     where (coalesce(p_con_bajas, false) or r.baja_en is null)
       and (v_q = '' or lower(r.nombre || ' ' || r.slug || ' ' || coalesce(r.ciudad, '') || ' ' || coalesce(r.dueno, '') || ' ' || coalesce(r.dueno_mail, '') || ' ' || coalesce(r.dueno_telefono, '') || ' ' || array_to_string(r.hosts, ' ')) like '%' || v_q || '%')
       and (p_salud is null or salud -> r.id::text ->> 'color' = p_salud)
       and (p_abono is null or r.abono ->> 'estado' = p_abono)
       and (p_plan is null or lower(r.abono ->> 'plan') = lower(p_plan))
       and (p_ciudad is null or lower(coalesce(r.ciudad, '')) = lower(btrim(p_ciudad)))
       and (p_modulo is null or not (p_modulo = any (r.apagadas)))
       and (p_alta_desde is null or r.creado_en >= p_alta_desde::timestamptz)
       and (p_alta_hasta is null or r.creado_en < (p_alta_hasta + 1)::timestamptz)
  ) f;
  return v_res;
end $$;
revoke execute on function public.admin_lista_gimnasios(text, text, text, text, date, date, text, text, boolean) from public, anon;
grant execute on function public.admin_lista_gimnasios(text, text, text, text, date, date, text, text, boolean) to authenticated;

-- ── El tablero con los errores de 24 h ──────────────────────────────
create or replace function public.admin_tablero() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare salud jsonb; m jsonb; atencion jsonb; vivo jsonb; hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  salud := public.admin_salud_v2();
  m := public.admin_metricas();
  select coalesce(jsonb_agg(a order by (a ->> 'orden')::int, a ->> 'nombre'), '[]'::jsonb) into atencion from (
    select jsonb_build_object('gimnasio_id', g.id, 'nombre', g.nombre, 'tipo', 'salud', 'motivo', mot.m, 'orden', (salud -> g.id::text ->> 'orden')::int,
             'boton', case when mot.m like 'Abono%' or mot.m like 'El abono%' then 'Ver el abono' when mot.m like 'Alta sin terminar%' then 'Terminar el alta' when mot.m like 'Pidió%' or mot.m like '%pedidos de ayuda%' then 'Responder' else 'Abrir la ficha' end) as a
      from public.gimnasios g, jsonb_array_elements_text(salud -> g.id::text -> 'motivos') mot(m)
     where not g.es_demo and g.baja_en is null
    union all
    select jsonb_build_object('gimnasio_id', g.id, 'nombre', g.nombre, 'tipo', 'webhooks', 'orden', 0, 'boton', 'Ver integraciones',
             'motivo', c.n || (case when c.n = 1 then ' aviso de MercadoPago falló' else ' avisos de MercadoPago fallaron' end) || ' en 24 h')
      from public.gimnasios g join lateral (select count(*)::int n from public.eventos_webhook w where w.gimnasio_id = g.id and w.error is not null and w.procesado_en is null
                                              and w.recibido_en > now() - interval '24 hours') c on c.n > 0
     where not g.es_demo and g.baja_en is null
    union all
    select jsonb_build_object('gimnasio_id', g.id, 'nombre', g.nombre, 'tipo', 'errores', 'orden', 1, 'boton', 'Ver los errores',
             'motivo', c.n || (case when c.n = 1 then ' error en las últimas 24 h' else ' errores en las últimas 24 h' end))
      from public.gimnasios g join lateral (select count(*)::int n from public.errores_app x where x.gimnasio_id = g.id and x.creado_en > now() - interval '24 hours') c on c.n > 0
     where not g.es_demo and g.baja_en is null
    union all
    select jsonb_build_object('gimnasio_id', g.id, 'nombre', g.nombre, 'tipo', 'caja', 'orden', 1, 'boton', 'Abrir la ficha',
             'motivo', 'Hay una caja sin cerrar hace ' || c.dias || ' días')
      from public.gimnasios g join lateral (select (max(extract(day from now() - t.abierto_en)))::int dias from public.turnos_caja t
                                              where t.gimnasio_id = g.id and t.cerrado_en is null and t.abierto_en < now() - interval '2 days') c on c.dias is not null
     where not g.es_demo and g.baja_en is null
  ) x;
  select coalesce(jsonb_agg(v order by v ->> 'cuando' desc), '[]'::jsonb) into vivo from (
    select * from (
      select jsonb_build_object('tipo', 'gimnasio_nuevo', 'texto', 'Gimnasio nuevo: ' || g.nombre, 'cuando', g.creado_en, 'gimnasio_id', g.id) v
        from public.gimnasios g where not g.es_demo and g.creado_en > now() - interval '7 days'
      union all
      select jsonb_build_object('tipo', 'ayuda', 'texto', 'Ayuda nueva de ' || g.nombre, 'cuando', a.creado_en, 'gimnasio_id', g.id)
        from public.ayudas_brik a join public.gimnasios g on g.id = a.gimnasio_id where a.creado_en > now() - interval '7 days'
      union all
      select jsonb_build_object('tipo', 'error', 'texto', 'Error en ' || x.pantalla || ' de ' || g.nombre, 'cuando', x.creado_en, 'gimnasio_id', g.id)
        from public.errores_app x join public.gimnasios g on g.id = x.gimnasio_id where x.creado_en > now() - interval '24 hours'
      union all
      select jsonb_build_object('tipo', 'primer_cobro', 'texto', 'Primer cobro de ' || g.nombre, 'cuando', p.primero, 'gimnasio_id', g.id)
        from public.gimnasios g join lateral (select min(v.confirmada_en) primero from public.ventas v where v.gimnasio_id = g.id and v.estado = 'confirmada' and v.anulada_en is null) p
          on p.primero > now() - interval '7 days'
       where not g.es_demo
    ) u order by u.v ->> 'cuando' desc limit 15
  ) z;
  return jsonb_build_object(
    'numeros', jsonb_build_object(
      'activos_hoy', jsonb_build_object('valor', m -> 'activos_hoy', 'lista', 'activos'),
      'entradas_hoy', jsonb_build_object('valor', (select count(*)::int from public.ingresos i join public.gimnasios g on g.id = i.gimnasio_id
                                                      where not g.es_demo and i.anulado_en is null and i.resultado <> 'rechazado'
                                                        and (i.momento at time zone 'America/Argentina/Buenos_Aires')::date = hoy), 'lista', 'activos'),
      'cobrado_hoy', jsonb_build_object('valor', coalesce((select sum(p.monto) from public.pagos p join public.gimnasios g on g.id = p.gimnasio_id
                                                             where not g.es_demo and p.estado = 'aprobado'
                                                               and (p.aprobado_en at time zone 'America/Argentina/Buenos_Aires')::date = hoy), 0), 'lista', 'activos'),
      'ingreso_mensual_brik', jsonb_build_object('valor', m -> 'cobrado_mes', 'lista', 'al_dia'),
      'abonos_por_vencer', jsonb_build_object('valor', m -> 'por_vencer', 'lista', 'por_vencer'),
      'abonos_vencidos', jsonb_build_object('valor', m -> 'vencidos', 'lista', 'vencido'),
      'ayudas_sin_responder', jsonb_build_object('valor', m -> 'ayudas_pendientes', 'lista', 'ayudas')),
    'necesitan_atencion', atencion,
    'actividad', vivo);
end $$;
revoke execute on function public.admin_tablero() from public, anon;
grant execute on function public.admin_tablero() to authenticated;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['admin_guardar_ciudad(uuid,text)', 'registrar_error_app(uuid,text,text)', 'admin_errores(uuid,integer)', 'admin_pausar_gimnasio(uuid,text)',
      'admin_reanudar_gimnasio(uuid)', 'admin_dar_de_baja(uuid,text)', 'admin_restaurar_baja(uuid)', 'admin_lanzamiento(uuid)', 'admin_crear_demo(text,text,text)',
      'admin_demos_vencidas()', 'admin_borrar_demos_vencidas()', 'admin_exportar_gimnasio(uuid)', 'admin_exportar_socio(uuid,uuid)', 'admin_borrar_socio(uuid,uuid,text)',
      'admin_estado_seguridad()', 'admin_exigir_2fa(boolean)', 'admin_dar_rol_brik(text,text)', 'admin_quitar_rol_brik(uuid)', 'admin_registro_brik(integer)',
      'admin_lista_gimnasios(text,text,text,text,date,date,text,text,boolean)'] loop
    if to_regprocedure('public.' || f) is null then raise exception 'Falta public.%', f; end if;
  end loop;
  if to_regprocedure('public.admin_lista_gimnasios(text,text,text,text,date,date)') is not null then raise exception 'Quedó la firma vieja de admin_lista_gimnasios'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.errores_app'::regclass) then raise exception 'errores_app sin RLS'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.plataforma_ajustes'::regclass) then raise exception 'plataforma_ajustes sin RLS'; end if;
  if to_regprocedure('privado.avisos_moderacion_base(uuid,text)') is null then raise exception 'Falta el helper original de avisos'; end if;
end $$;
