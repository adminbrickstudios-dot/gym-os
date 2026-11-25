-- Cierre para vender (Mateo, 25/11) · Parte 3: el camino de venta. Aditiva y compatible con el código anterior (expandir).
--
--   admin_alta_gimnasio(...)          EL alta de un gimnasio, en una transacción: el gimnasio, su dirección y su dueño (admin_crear_gimnasio,
--                                     que ya lo deja en Pista con Semáforo), la plantilla del tipo (planes, actividades y configuración), el tipo,
--                                     la marca y el plan de Pase. Si algo falla no queda nada a medias. Queda en el registro de BRIK.
--                                     Los permisos son los de las funciones que llama (no se cambia quién puede dar de alta).
--   gimnasios.origen                  de dónde salió cada gimnasio, en datos: alta_super, demo, demo_prospecto
--   privado.telefono_normalizado      "+54 387 412 3456" (con +54 y sin el 9) queda +5493874123456, como ya pasaba sin el +.
--                                     Lo usan el importador, el alta y la ficha: un celular que antes daba error ahora se entiende.
--   privado.fecha_importada           un año de dos cifras: hasta 50 es 20xx, de 51 en adelante 19xx ("1/2/90" es 1990, no 2090).
--                                     Antes un nacimiento escrito así daba "fecha imposible".

-- ── Guarda de entrada ───────────────────────────────────────────────
do $g$ begin
  if to_regprocedure('public.admin_crear_gimnasio(text, text, text, text)') is null then raise exception 'Guarda: falta admin_crear_gimnasio'; end if;
  if to_regprocedure('public.admin_aplicar_plantilla(uuid, text)') is null then raise exception 'Guarda: falta admin_aplicar_plantilla'; end if;
  if to_regprocedure('public.admin_guardar_tipo_gimnasio(uuid, text)') is null then raise exception 'Guarda: falta admin_guardar_tipo_gimnasio'; end if;
  if to_regprocedure('public.admin_guardar_marca(uuid, text, text)') is null then raise exception 'Guarda: falta admin_guardar_marca'; end if;
  if to_regprocedure('public.admin_asignar_plan_brik(uuid, uuid)') is null then raise exception 'Guarda: falta admin_asignar_plan_brik'; end if;
  if to_regprocedure('privado.registrar_brik(text, uuid, jsonb)') is null then raise exception 'Guarda: falta privado.registrar_brik'; end if;
  if to_regprocedure('privado.telefono_normalizado(text, text)') is null then raise exception 'Guarda: falta privado.telefono_normalizado'; end if;
  if pg_get_functiondef('public.admin_crear_gimnasio(text, text, text, text)'::regprocedure) not like '%pista_semaforo%' then
    raise exception 'Guarda: falta la migración 20261125100000 (el alta en Pista con Semáforo)';
  end if;
end $g$;

-- ── 1. De dónde salió cada gimnasio ─────────────────────────────────
alter table public.gimnasios add column if not exists origen text;
update public.gimnasios set origen = case when es_demo and demo_para is not null then 'demo_prospecto' when es_demo then 'demo' else 'alta_super' end
 where origen is null;
alter table public.gimnasios alter column origen set default 'alta_super';
alter table public.gimnasios alter column origen set not null;
do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'gimnasios_origen_valido') then
    alter table public.gimnasios add constraint gimnasios_origen_valido check (origen in ('alta_super', 'demo', 'demo_prospecto'));
  end if;
end $c$;

-- ── 2. El alta única ────────────────────────────────────────────────
create or replace function public.admin_alta_gimnasio(p_slug text, p_nombre text, p_dominio_base text, p_dueno_nombre text,
  p_tipo text default null, p_acento text default null, p_fondo text default null, p_plan_brik uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb; gid uuid; v_tipo text := nullif(btrim(coalesce(p_tipo, '')), '');
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if (p_acento is null) <> (p_fondo is null) then raise exception 'Elegí los dos colores (acento y fondo) o ninguno' using errcode = '22023'; end if;
  r := public.admin_crear_gimnasio(p_slug, p_nombre, p_dominio_base, p_dueno_nombre);
  gid := (r ->> 'gimnasio_id')::uuid;
  if gid is null then raise exception 'No se pudo crear el gimnasio'; end if;
  if v_tipo is not null then
    perform public.admin_aplicar_plantilla(gid, v_tipo);
    perform public.admin_guardar_tipo_gimnasio(gid, v_tipo);
  end if;
  if p_acento is not null then perform public.admin_guardar_marca(gid, p_acento, p_fondo); end if;
  if p_plan_brik is not null then perform public.admin_asignar_plan_brik(gid, p_plan_brik); end if;
  perform privado.registrar_brik('alta_gimnasio', gid, jsonb_build_object('slug', p_slug, 'tipo', v_tipo, 'plan_brik', p_plan_brik));
  return r || jsonb_build_object('tipo', v_tipo, 'plan_brik', p_plan_brik);
end $$;
revoke all on function public.admin_alta_gimnasio(text, text, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_alta_gimnasio(text, text, text, text, text, text, text, uuid) to authenticated, service_role;

-- ── 3. El celular con +54 y sin el 9 ────────────────────────────────
-- Se parte de la definición vigente y se cambia un solo trozo (con guarda).
do $m$
declare def text; de text := 'd := ''+'' || regexp_replace(substr(d, 2), ''\D'', '''', ''g'');'; veces int;
begin
  def := pg_get_functiondef('privado.telefono_normalizado(text, text)'::regprocedure);
  if position('+54 y sin el 9' in def) > 0 then return; end if;
  veces := (length(def) - length(replace(def, de, ''))) / length(de);
  if veces <> 1 then raise exception 'telefono_normalizado: el trozo aparece % veces (tiene que ser 1)', veces; end if;
  execute replace(def, de, de || '
    -- +54 y sin el 9 (así lo exportan muchos sistemas): el celular argentino lleva el 9 adelante de la característica.
    if d ~ ''^\+54[0-8][0-9]{9}$'' then d := ''+549'' || substr(d, 4); end if;');
end $m$;
revoke all on function privado.telefono_normalizado(text, text) from public, anon, authenticated;

-- ── 4. El año de dos cifras en las fechas importadas ────────────────
do $m$
declare def text; de text := 'case when length(p[3]) = 2 then 2000 + p[3]::int else p[3]::int end'; veces int;
begin
  def := pg_get_functiondef('privado.fecha_importada(text)'::regprocedure);
  if position('then 1900' in def) > 0 then return; end if;
  veces := (length(def) - length(replace(def, de, ''))) / length(de);
  if veces <> 1 then raise exception 'fecha_importada: el trozo aparece % veces (tiene que ser 1)', veces; end if;
  execute replace(def, de, 'case when length(p[3]) = 2 then (case when p[3]::int <= 50 then 2000 else 1900 end) + p[3]::int else p[3]::int end');
end $m$;
revoke all on function privado.fecha_importada(text) from public, anon, authenticated;

-- ── Verificación ────────────────────────────────────────────────────
do $v$
begin
  if not exists (select 1 from pg_proc where oid = 'public.admin_alta_gimnasio(text, text, text, text, text, text, text, uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: admin_alta_gimnasio sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.admin_alta_gimnasio(text, text, text, text, text, text, text, uuid)', 'execute') then raise exception 'Verificación: anon puede dar de alta'; end if;
  if privado.telefono_normalizado('+54 387 412-3456', 'Celular') <> '+5493874123456' then raise exception 'Verificación: +54 sin el 9 no se normaliza'; end if;
  if privado.telefono_normalizado('+54 9 387 412-3456', 'Celular') <> '+5493874123456' then raise exception 'Verificación: +54 9 cambió'; end if;
  if privado.telefono_normalizado('387 15 412-3456', 'Celular') <> '+5493874123456' then raise exception 'Verificación: 387 15 cambió'; end if;
  if privado.telefono_normalizado('+54 000 400 1111', 'Celular') <> '+5490004001111' then raise exception 'Verificación: el celular ficticio (000) sin el 9 no se normaliza'; end if;
  if privado.telefono_normalizado('+1 415 555 0100', 'Celular') <> '+14155550100' then raise exception 'Verificación: un celular de afuera cambió'; end if;
  if privado.fecha_importada('01/02/90') <> date '1990-02-01' or privado.fecha_importada('05-11-26') <> date '2026-11-05'
     or privado.fecha_importada('5/11/2026') <> date '2026-11-05' then raise exception 'Verificación: las fechas importadas cambiaron'; end if;
  if exists (select 1 from public.gimnasios where origen is null) then raise exception 'Verificación: un gimnasio sin origen'; end if;
end $v$;
