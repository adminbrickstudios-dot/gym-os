-- 0110 · Suscripción del gimnasio a BRIK (ADM-3, decisión D13).
-- El precio lo carga Mateo en el super admin (planes de BRIK); el código no
-- inventa ninguno. Cada gimnasio puede tener un plan de BRIK; los pagos que
-- BRIK registra dicen hasta qué día cubren. El estado se calcula:
--   sin_abono (sin plan, o el demo) · al_dia · por_vencer (7 días antes) · vencido.
-- Al asignar un plan, el gimnasio tiene 14 días antes del primer pago (nadie
-- queda en solo lectura por asignarle un plan).
--   admin_planes_brik() · admin_guardar_plan_brik(id, nombre, precio, activo)
--   admin_asignar_plan_brik(gimnasio, plan) · admin_registrar_pago_brik(gimnasio, monto, cubre_hasta, nota)
--   admin_anular_pago_brik(pago) · admin_abonos()
--   privado.estado_abono(gimnasio) · estado_abono_panel(gimnasio) (el equipo; los montos solo el dueño)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.cerrar_novedad_plataforma(uuid, uuid)') is null then raise exception 'Guarda: falta la migración 0109'; end if;
end $$;

create table if not exists public.plataforma_planes (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null check (length(trim(nombre)) between 2 and 60),
  precio_mensual  numeric(12,2) not null check (precio_mensual > 0),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now()
);
alter table public.plataforma_planes enable row level security;
revoke all on table public.plataforma_planes from anon, authenticated;

alter table public.gimnasios add column if not exists plataforma_plan_id uuid references public.plataforma_planes(id);
alter table public.gimnasios add column if not exists plataforma_desde date;

create table if not exists public.plataforma_pagos (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  monto         numeric(12,2) not null check (monto > 0),
  cubre_hasta   date not null,
  nota          text check (nota is null or length(nota) <= 200),
  registrado_por uuid not null references auth.users(id),
  creado_en     timestamptz not null default now(),
  anulado_en    timestamptz,
  unique (gimnasio_id, id)
);
alter table public.plataforma_pagos enable row level security;
revoke all on table public.plataforma_pagos from anon, authenticated;
drop trigger if exists plataforma_pagos_inmutable on public.plataforma_pagos;
create trigger plataforma_pagos_inmutable before update or delete on public.plataforma_pagos
  for each row execute function privado.hecho_inmutable('anulado_en');

create or replace function privado.estado_abono(p_gimnasio_id uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare g public.gimnasios; pl public.plataforma_planes; hoy date; hasta date; estado text;
begin
  select * into g from public.gimnasios where id = p_gimnasio_id;
  if g.plataforma_plan_id is null or g.es_demo then return jsonb_build_object('estado', 'sin_abono'); end if;
  select * into pl from public.plataforma_planes where id = g.plataforma_plan_id;
  hoy := privado.dia_local(now(), g.zona_horaria);
  hasta := coalesce((select max(p.cubre_hasta) from public.plataforma_pagos p where p.gimnasio_id = g.id and p.anulado_en is null),
                    coalesce(g.plataforma_desde, hoy) + 14);
  estado := case when hoy > hasta then 'vencido' when hoy > hasta - 7 then 'por_vencer' else 'al_dia' end;
  return jsonb_build_object('estado', estado, 'plan', pl.nombre, 'precio_mensual', pl.precio_mensual, 'pagado_hasta', hasta, 'dias', hasta - hoy);
end $$;
revoke all on function privado.estado_abono(uuid) from public;

create or replace function public.estado_abono_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; a jsonb;
begin
  e := privado.exigir_equipo(p_gimnasio_id);
  a := privado.estado_abono(p_gimnasio_id);
  if e.rol <> 'dueno' then a := jsonb_build_object('estado', a ->> 'estado'); end if;
  return a;
end $$;

create or replace function public.admin_planes_brik() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'precio_mensual', p.precio_mensual, 'activo', p.activo,
            'gimnasios', (select count(*) from public.gimnasios g where g.plataforma_plan_id = p.id)) order by p.activo desc, p.precio_mensual)
    from public.plataforma_planes p), '[]'::jsonb);
end $$;

create or replace function public.admin_guardar_plan_brik(p_id uuid, p_nombre text, p_precio numeric, p_activo boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare nid uuid; n int; nom text := trim(coalesce(p_nombre, ''));
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if length(nom) not between 2 and 60 then raise exception 'El nombre del plan: de 2 a 60 letras' using errcode = '22023'; end if;
  if p_precio is null or p_precio <= 0 then raise exception 'El precio tiene que ser mayor a cero' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.plataforma_planes (nombre, precio_mensual, activo) values (nom, round(p_precio, 2), coalesce(p_activo, true)) returning id into nid;
    return nid;
  end if;
  update public.plataforma_planes set nombre = nom, precio_mensual = round(p_precio, 2), activo = coalesce(p_activo, true) where id = p_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese plan no existe' using errcode = 'P0002'; end if;
  return p_id;
end $$;

create or replace function public.admin_asignar_plan_brik(p_gimnasio_id uuid, p_plan_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if p_plan_id is not null and not exists (select 1 from public.plataforma_planes where id = p_plan_id and activo) then
    raise exception 'Ese plan de BRIK no existe o está apagado' using errcode = '22023';
  end if;
  update public.gimnasios g set plataforma_plan_id = p_plan_id,
         plataforma_desde = case when p_plan_id is null then null else coalesce(g.plataforma_desde, privado.dia_local(now(), g.zona_horaria)) end
   where g.id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Gimnasio inexistente' using errcode = 'P0002'; end if;
end $$;

create or replace function public.admin_registrar_pago_brik(p_gimnasio_id uuid, p_monto numeric, p_cubre_hasta date, p_nota text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pid uuid;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if not exists (select 1 from public.gimnasios where id = p_gimnasio_id and plataforma_plan_id is not null) then
    raise exception 'Primero asignale un plan de BRIK a este gimnasio' using errcode = '22023';
  end if;
  if p_monto is null or p_monto <= 0 then raise exception 'El monto tiene que ser mayor a cero' using errcode = '22023'; end if;
  if p_cubre_hasta is null then raise exception 'Elegí hasta qué día cubre el pago' using errcode = '22023'; end if;
  if length(p_nota) > 200 then raise exception 'La nota: hasta 200 letras' using errcode = '22023'; end if;
  insert into public.plataforma_pagos (gimnasio_id, monto, cubre_hasta, nota, registrado_por)
  values (p_gimnasio_id, round(p_monto, 2), p_cubre_hasta, nullif(trim(coalesce(p_nota, '')), ''), auth.uid()) returning id into pid;
  return pid;
end $$;

create or replace function public.admin_anular_pago_brik(p_pago_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  update public.plataforma_pagos set anulado_en = now() where id = p_pago_id and anulado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese pago ya estaba anulado' using errcode = '22023'; end if;
end $$;

create or replace function public.admin_abonos() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  return coalesce((select jsonb_object_agg(g.id, privado.estado_abono(g.id) || jsonb_build_object('plan_id', g.plataforma_plan_id,
            'pagos', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'monto', p.monto, 'cubre_hasta', p.cubre_hasta, 'nota', p.nota, 'creado_en', p.creado_en) order by p.creado_en desc)
                               from (select * from public.plataforma_pagos x where x.gimnasio_id = g.id and x.anulado_en is null order by x.creado_en desc limit 5) p), '[]'::jsonb)))
    from public.gimnasios g), '{}'::jsonb);
end $$;

revoke all on function public.estado_abono_panel(uuid), public.admin_planes_brik(), public.admin_guardar_plan_brik(uuid, text, numeric, boolean),
  public.admin_asignar_plan_brik(uuid, uuid), public.admin_registrar_pago_brik(uuid, numeric, date, text), public.admin_anular_pago_brik(uuid),
  public.admin_abonos() from public, anon, authenticated;
grant execute on function public.estado_abono_panel(uuid), public.admin_planes_brik(), public.admin_guardar_plan_brik(uuid, text, numeric, boolean),
  public.admin_asignar_plan_brik(uuid, uuid), public.admin_registrar_pago_brik(uuid, numeric, date, text), public.admin_anular_pago_brik(uuid),
  public.admin_abonos() to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.plataforma_planes'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.plataforma_pagos'::regclass) then raise exception 'Verificación: abono sin RLS'; end if;
  foreach f in array array['public.estado_abono_panel(uuid)', 'public.admin_planes_brik()', 'public.admin_guardar_plan_brik(uuid, text, numeric, boolean)',
                           'public.admin_asignar_plan_brik(uuid, uuid)', 'public.admin_registrar_pago_brik(uuid, numeric, date, text)',
                           'public.admin_anular_pago_brik(uuid)', 'public.admin_abonos()'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
