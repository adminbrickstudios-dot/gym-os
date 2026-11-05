-- 0040 · Encontrar y unir socios duplicados (SOC-8).
-- posibles_duplicados: pares con el mismo celular o con nombres casi iguales.
-- unir_socios(queda, se_va): todo lo del que se va (pagos, cuotas, entradas,
-- reservas, notas, etiquetas, cuenta de la app…) pasa al que queda, se
-- completan los datos que le faltan, y el que se va se borra. Queda escrito en
-- uniones_socios. Lo hace solo el dueño (mueve plata y la cuenta de la app).
-- Los hechos siguen sin poder cambiarse: la única excepción es pasar su
-- socio_id de uno al otro, solo durante unir_socios. Si los dos tienen algo
-- que no puede quedar doble (membresía activa, la misma clase, cuenta de la
-- app) no se une y dice qué resolver primero.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.socio_etiquetas') is null or to_regclass('public.importaciones') is null then
    raise exception 'Guarda: faltan las migraciones 0034 y 0036';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_trgm') then raise exception 'Guarda: falta pg_trgm'; end if;
end $$;

-- ── Registro de uniones ─────────────────────────────────────────────
create table if not exists public.uniones_socios (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  queda_id     uuid not null,
  se_fue       jsonb not null,
  unido_en     timestamptz not null default now(),
  unido_por    uuid references auth.users(id),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, queda_id) references public.socios (gimnasio_id, id)
);
select privado.politicas_estandar('public.uniones_socios', array['dueno', 'encargado'], null);
revoke all on table public.uniones_socios from anon;

-- Cuota y congelamiento apuntan a (suscripción, socio): al mover las dos cosas
-- en la misma transacción, la revisión espera al final.
-- (Se vuelven a crear: ALTER CONSTRAINT no cambia los disparadores del lado de suscripciones.)
do $$
declare t text;
begin
  foreach t in array array['coberturas', 'congelamientos'] loop
    if not exists (select 1 from pg_constraint where conname = t || '_suscripcion_diferible') then
      execute format('alter table public.%I drop constraint if exists %I', t, t || '_gimnasio_id_suscripcion_id_socio_id_fkey');
      execute format('alter table public.%I add constraint %I foreign key (gimnasio_id, suscripcion_id, socio_id)
                      references public.suscripciones (gimnasio_id, id, socio_id) deferrable initially immediate', t, t || '_suscripcion_diferible');
    end if;
  end loop;
end $$;

-- ── Los hechos no se cambian… salvo el socio_id al unir ─────────────
-- Copia de hecho_inmutable (0034) con una excepción más: durante unir_socios
-- (gymos.unir_socios = '<se_va>><queda>') se puede cambiar solo socio_id de uno al otro.
create or replace function privado.hecho_inmutable() returns trigger
language plpgsql set search_path = '' as $$
declare
  permitidas text[] := tg_argv::text[];
  viejo jsonb; nuevo jsonb; k text;
begin
  if tg_op = 'DELETE' then
    if nullif(current_setting('gymos.deshacer_importacion', true), '') is not null
       and (to_jsonb(old) ->> 'importacion_id') = current_setting('gymos.deshacer_importacion', true) then
      return old;
    end if;
    raise exception 'Los registros de % no se borran: se anulan', tg_table_name using errcode = 'check_violation';
  end if;
  viejo := to_jsonb(old); nuevo := to_jsonb(new);
  if nullif(current_setting('gymos.unir_socios', true), '') is not null
     and current_setting('gymos.unir_socios', true) = (viejo ->> 'socio_id') || '>' || (nuevo ->> 'socio_id') then
    permitidas := array_append(permitidas, 'socio_id');
  end if;
  for k in select jsonb_object_keys(nuevo) loop
    if (viejo -> k) is distinct from (nuevo -> k) and not (k = any (permitidas)) then
      raise exception 'En % solo se puede cambiar: %', tg_table_name, coalesce(array_to_string(permitidas, ', '), 'nada')
        using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end $$;
revoke all on function privado.hecho_inmutable() from public;

-- ── Posibles duplicados ─────────────────────────────────────────────
create or replace function public.posibles_duplicados(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return (select coalesce(jsonb_agg(x order by x ->> 'motivo', x ->> 'a_nombre'), '[]') from (
    select jsonb_build_object(
      'motivo', case when a.telefono = b.telefono then 'Mismo celular' else 'Nombre casi igual' end,
      'a', a.id, 'a_numero', a.numero, 'a_nombre', trim(a.nombre || ' ' || a.apellido), 'a_dni', a.dni, 'a_telefono', a.telefono, 'a_alta', a.creado_en,
      'b', b.id, 'b_numero', b.numero, 'b_nombre', trim(b.nombre || ' ' || b.apellido), 'b_dni', b.dni, 'b_telefono', b.telefono, 'b_alta', b.creado_en) as x
      from public.socios a join public.socios b on b.gimnasio_id = a.gimnasio_id and a.numero < b.numero
     where a.gimnasio_id = p_gimnasio_id and a.dado_de_baja_en is null and b.dado_de_baja_en is null
       and not (a.dni is not null and b.dni is not null and a.dni <> b.dni)   -- con DNI distinto son dos personas
       and (a.telefono = b.telefono
            or extensions.similarity(privado.sin_acentos(lower(a.nombre || ' ' || a.apellido)), privado.sin_acentos(lower(b.nombre || ' ' || b.apellido))) >= 0.75)
     limit 100) y);
end $$;

-- ── Unir ────────────────────────────────────────────────────────────
create or replace function public.unir_socios(p_gimnasio_id uuid, p_queda uuid, p_se_va uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare q public.socios; v public.socios; t record; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_queda = p_se_va then raise exception 'Elegí dos socios distintos.'; end if;
  select * into q from public.socios where id = p_queda and gimnasio_id = p_gimnasio_id for update;
  select * into v from public.socios where id = p_se_va and gimnasio_id = p_gimnasio_id for update;
  if q.id is null or v.id is null then raise exception 'No se encontraron los dos socios en este gimnasio.'; end if;
  if q.dni is not null and v.dni is not null and q.dni <> v.dni then raise exception 'Tienen DNI distinto: son dos personas.'; end if;
  if q.usuario_id is not null and v.usuario_id is not null then
    raise exception 'Los dos entran a la app con cuentas distintas: no se pueden unir.';
  end if;
  if exists (select 1 from public.suscripciones a join public.suscripciones b on b.socio_id = v.id and b.baja_en is null
              where a.socio_id = q.id and a.baja_en is null) then
    raise exception 'Los dos tienen una membresía activa: dale de baja a una (o cambiá de plan) antes de unirlos.';
  end if;
  if exists (select 1 from public.reservas a join public.reservas b on b.clase_id = a.clase_id and b.socio_id = v.id and b.estado <> 'cancelada'
              where a.socio_id = q.id and a.estado <> 'cancelada') then
    raise exception 'Los dos están anotados en la misma clase: cancelá una de las reservas antes.';
  end if;
  if exists (select 1 from public.asistencias a join public.asistencias b on b.clase_id = a.clase_id and b.socio_id = v.id and b.anulada_en is null
              where a.socio_id = q.id and a.anulada_en is null) then
    raise exception 'Los dos tienen presente en la misma clase: anulá uno antes.';
  end if;

  perform set_config('gymos.unir_socios', v.id::text || '>' || q.id::text, true);
  set constraints public.coberturas_suscripcion_diferible, public.congelamientos_suscripcion_diferible deferred;
  -- Etiquetas: las del que se va, sin repetir.
  insert into public.socio_etiquetas (gimnasio_id, socio_id, etiqueta_id, puesta_en)
  select gimnasio_id, q.id, etiqueta_id, puesta_en from public.socio_etiquetas where socio_id = v.id on conflict do nothing;
  delete from public.socio_etiquetas where socio_id = v.id;
  -- Todo lo demás que apunta al socio: cada tabla con socio_id (se descubren solas, así no se olvida una nueva).
  -- (Toda tabla de public con columna socio_id, también las que apuntan al socio a través de la suscripción.)
  for t in select c.oid::regclass as tabla from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attname = 'socio_id' and not a.attisdropped
            where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
              and c.oid not in ('public.socios'::regclass, 'public.socio_etiquetas'::regclass)
  loop
    execute format('update %s set socio_id = $1 where socio_id = $2', t.tabla) using q.id, v.id;
  end loop;
  update public.socios set tutor_socio_id = q.id where tutor_socio_id = v.id;
  set constraints public.coberturas_suscripcion_diferible, public.congelamientos_suscripcion_diferible immediate;
  perform set_config('gymos.unir_socios', '', true);

  insert into public.uniones_socios (gimnasio_id, queda_id, se_fue, unido_por)
  values (p_gimnasio_id, q.id, jsonb_build_object('numero', v.numero, 'nombre', v.nombre, 'apellido', v.apellido, 'dni', v.dni,
          'telefono', v.telefono, 'email', v.email, 'alta', v.creado_en), auth.uid());
  -- El que se va libera DNI y cuenta; el que queda completa lo que le falta.
  delete from public.socios where id = v.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo terminar de unir.'; end if;
  update public.socios set
    dni = coalesce(q.dni, v.dni), telefono = coalesce(q.telefono, v.telefono), email = coalesce(q.email, v.email),
    fecha_nacimiento = coalesce(q.fecha_nacimiento, v.fecha_nacimiento), foto_path = coalesce(q.foto_path, v.foto_path),
    usuario_id = coalesce(q.usuario_id, v.usuario_id),
    contacto_emergencia_nombre = coalesce(q.contacto_emergencia_nombre, v.contacto_emergencia_nombre),
    contacto_emergencia_telefono = coalesce(q.contacto_emergencia_telefono, v.contacto_emergencia_telefono),
    notas = nullif(concat_ws(E'\n', q.notas, v.notas), '')
  where id = q.id;
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.posibles_duplicados(uuid), public.unir_socios(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.posibles_duplicados(uuid), public.unir_socios(uuid, uuid, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.uniones_socios'::regclass) then raise exception 'Verificación: uniones_socios sin RLS'; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'uniones_socios' and cmd <> 'SELECT') then
    raise exception 'Verificación: uniones_socios se puede escribir desde el cliente';
  end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'public' and p.proname in ('posibles_duplicados', 'unir_socios'))
               or (s.nspname = 'privado' and p.proname = 'hecho_inmutable') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
end $$;
