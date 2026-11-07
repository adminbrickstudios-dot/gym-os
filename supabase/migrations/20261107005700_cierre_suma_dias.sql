-- VD-57 · Día cerrado suma al vencimiento: una regla del gimnasio (caso 54), no la decisión de cada recepcionista.
-- Qué hacía ya la base: cada cierre del gimnasio entero lleva su propio "compensa" (0004) y privado.recalcular_compensacion (0006)
-- devuelve a cada membresía los días cubiertos que cayeron en un cierre con compensa (cobertura de origen 'compensacion', recalculada
-- por trigger; nada de cron). Quien cargaba el cierre elegía el tilde: dos recepcionistas, dos criterios.
-- Qué cambia:
--   configuracion_cierres            la regla: suma_dias (por defecto NO: la restrictiva, no regala días). La cambia solo el dueño.
--   config_cierres / guardar_config_cierres
--   crear_cierre                     el tilde por cierre desaparece: el cierre nace con compensa = regla (y solo si cierra todo el gimnasio).
--                                    Un p_compensa explícito que contradiga la regla es error (se deja la columna para pruebas viejas).
--   previsualizar_cierre             "esto corre el vencimiento de N socios N días", ANTES de confirmar; con la regla en no suma dice que no corre nada.
-- El cálculo de los días devueltos sigue siendo UNO: privado.recalcular_compensacion. Los cierres ya cargados conservan su compensa
-- (hecho inmutable): cambiar la regla vale de ahí en adelante, no reescribe vencimientos ya corridos.
-- Cambia la firma de crear_cierre (el default de p_compensa pasa de true a null): se borra la vieja en esta misma migración.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.cierres') is null or to_regclass('public.coberturas') is null or to_regclass('public.suscripciones') is null then raise exception 'Guarda: faltan cierres, coberturas o suscripciones'; end if;
  if to_regprocedure('privado.recalcular_compensacion(uuid)') is null then raise exception 'Guarda: falta recalcular_compensacion (0006)'; end if;
  if to_regprocedure('public.crear_cierre(uuid, date, date, text, boolean, uuid)') is null and to_regprocedure('public.crear_cierre(uuid, date, date, text, uuid)') is null then
    raise exception 'Guarda: falta crear_cierre (0024)';
  end if;
  if to_regprocedure('privado.exigir_rol(uuid, text[], uuid)') is null then raise exception 'Guarda: falta exigir_rol'; end if;
end $$;

create table if not exists public.configuracion_cierres (
  gimnasio_id    uuid primary key references public.gimnasios(id),
  suma_dias      boolean not null default false,
  actualizado_en timestamptz not null default now()
);
select privado.politicas_estandar('public.configuracion_cierres', array['dueno'], '{}');
revoke all on table public.configuracion_cierres from anon;
revoke all on table public.configuracion_cierres from authenticated;   -- todo por funciones

-- ── La regla ────────────────────────────────────────────────────────
create or replace function public.config_cierres(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare suma boolean;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado']);
  select c.suma_dias into suma from public.configuracion_cierres c where c.gimnasio_id = p_gimnasio_id;
  return jsonb_build_object('suma_dias', coalesce(suma, false));
end $$;

create or replace function public.guardar_config_cierres(p_gimnasio_id uuid, p_suma_dias boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno']);
  if p_suma_dias is null then raise exception 'Elegí si los días cerrados se suman al vencimiento o no.' using errcode = '22023'; end if;
  insert into public.configuracion_cierres (gimnasio_id, suma_dias) values (p_gimnasio_id, p_suma_dias)
    on conflict (gimnasio_id) do update set suma_dias = excluded.suma_dias, actualizado_en = now();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la regla.'; end if;
  return public.config_cierres(p_gimnasio_id);
end $$;

-- ── Crear un cierre: la regla decide si devuelve días ───────────────
drop function if exists public.crear_cierre(uuid, date, date, text, boolean, uuid);
create or replace function public.crear_cierre(p_gimnasio_id uuid, p_desde date, p_hasta date, p_motivo text,
                                               p_compensa boolean default null, p_sede_id uuid default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare zona text; cid uuid; suma boolean; efectiva boolean;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado']);
  if p_desde is null or p_hasta is null then raise exception 'Elegí desde qué día y hasta qué día cierra.' using errcode = '22023'; end if;
  if p_hasta <= p_desde then raise exception 'El último día no puede ser antes del primero.' using errcode = '22023'; end if;
  if p_hasta - p_desde > 92 then raise exception 'Un cierre puede durar hasta 3 meses. Para más, cargá varios.' using errcode = '22023'; end if;
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'Escribí el motivo (lo ven los socios): por ejemplo "Feriado" o "Vacaciones".' using errcode = '22023'; end if;
  if length(trim(p_motivo)) > 80 then raise exception 'El motivo puede tener hasta 80 letras.' using errcode = '22023'; end if;
  if p_sede_id is not null and coalesce(p_compensa, false) then
    raise exception 'Devolver días solo se puede con el gimnasio entero cerrado (no una sede sola).' using errcode = '22023';
  end if;
  if p_sede_id is not null and not exists (select 1 from public.sedes s where s.id = p_sede_id and s.gimnasio_id = p_gimnasio_id) then
    raise exception 'Esa sede no es de este gimnasio' using errcode = '42501';
  end if;
  select coalesce((select c.suma_dias from public.configuracion_cierres c where c.gimnasio_id = p_gimnasio_id), false) into suma;
  efectiva := suma and p_sede_id is null;
  if p_compensa is not null and p_compensa is distinct from efectiva then
    raise exception 'La regla de este gimnasio es % los días cerrados al vencimiento (Configuración → Reglas): el cierre no puede decidir otra cosa.',
      case when suma then 'sumar' else 'no sumar' end using errcode = '22023';
  end if;
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  if exists (select 1 from public.cierres k where k.gimnasio_id = p_gimnasio_id and k.anulado_en is null
               and (k.sede_id is null or p_sede_id is null or k.sede_id = p_sede_id)
               and k.desde < privado.medianoche(p_hasta, zona) and k.hasta > privado.medianoche(p_desde, zona)) then
    raise exception 'Ya hay un cierre cargado en esos días.' using errcode = '22023';
  end if;
  insert into public.cierres (gimnasio_id, sede_id, desde, hasta, motivo, compensa, creado_por)
  values (p_gimnasio_id, p_sede_id, privado.medianoche(p_desde, zona), privado.medianoche(p_hasta, zona), trim(p_motivo), efectiva, auth.uid())
  returning id into cid;
  return cid;
end $$;

-- ── Antes de confirmar: a cuántos socios y cuántos días ─────────────
-- Cuenta las membresías vigentes con algún día cubierto dentro del cierre (las que recuperan días); p_hasta es exclusivo, como crear_cierre.
-- No calcula vencimientos: eso lo sigue haciendo recalcular_compensacion cuando el cierre se carga.
create or replace function public.previsualizar_cierre(p_gimnasio_id uuid, p_desde date, p_hasta date, p_sede_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; suma boolean; efectiva boolean; dias int; socios int := 0; ini timestamptz; fin timestamptz;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado']);
  if p_desde is null or p_hasta is null or p_hasta <= p_desde then raise exception 'Elegí desde qué día y hasta qué día cierra.' using errcode = '22023'; end if;
  select coalesce((select c.suma_dias from public.configuracion_cierres c where c.gimnasio_id = p_gimnasio_id), false) into suma;
  efectiva := suma and p_sede_id is null;
  dias := p_hasta - p_desde;
  if efectiva then
    select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
    ini := privado.medianoche(p_desde, zona); fin := privado.medianoche(p_hasta, zona);
    select count(*)::int into socios from public.suscripciones su
     where su.gimnasio_id = p_gimnasio_id and (su.baja_en is null or su.baja_en > ini)
       and exists (select 1 from public.coberturas c where c.suscripcion_id = su.id and c.anulada_en is null and c.origen <> 'compensacion'
                      and c.desde < fin and c.hasta > ini);
  end if;
  return jsonb_build_object('suma_dias', efectiva, 'regla_suma', suma, 'dias', dias, 'socios', socios);
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.config_cierres(uuid), public.guardar_config_cierres(uuid, boolean), public.crear_cierre(uuid, date, date, text, boolean, uuid),
  public.previsualizar_cierre(uuid, date, date, uuid) from public, anon, authenticated;
grant execute on function public.config_cierres(uuid), public.guardar_config_cierres(uuid, boolean), public.crear_cierre(uuid, date, date, text, boolean, uuid),
  public.previsualizar_cierre(uuid, date, date, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text; n int;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.configuracion_cierres'::regclass) then raise exception 'Verificación: configuracion_cierres sin RLS'; end if;
  if has_table_privilege('authenticated', 'public.configuracion_cierres', 'select') or has_table_privilege('authenticated', 'public.configuracion_cierres', 'insert') then
    raise exception 'Verificación: se puede leer o escribir configuracion_cierres directo';
  end if;
  foreach f in array array['public.config_cierres(uuid)', 'public.guardar_config_cierres(uuid, boolean)', 'public.crear_cierre(uuid, date, date, text, boolean, uuid)',
                           'public.previsualizar_cierre(uuid, date, date, uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon ejecuta %', f; end if;
  end loop;
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'crear_cierre';
  if n <> 1 then raise exception 'Verificación: hay % versiones de crear_cierre (tiene que haber una)', n; end if;
end $$;
