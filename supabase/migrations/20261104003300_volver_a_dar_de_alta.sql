-- 0033 · Volver a dar de alta a un socio dado de baja, y teléfonos como los escribe la gente (AUD-3).
-- Antes, un socio dado de baja que volvía era un callejón: la ficha no
-- ofrecía nada y la Entrada lo mostraba "Se dio de baja" para siempre.
-- Ahora "Volver a darlo de alta" borra la baja del socio (no la de su
-- suscripción vieja: esa sigue terminada) y guarda el hecho en
-- historial_bajas (cuándo se fue, por qué y cuándo volvió), para que las
-- cuentas de bajas no pierdan nada. Después se le asigna un plan y se cobra
-- como a cualquiera: volver no da días gratis.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'socios' and column_name = 'dado_de_baja_en') then
    raise exception 'Guarda: falta socios.dado_de_baja_en';
  end if;
  if to_regprocedure('privado.exigir_rol(uuid, text[], uuid)') is null then raise exception 'Guarda: falta privado.exigir_rol'; end if;
end $$;

-- ── Tabla ───────────────────────────────────────────────────────────
create table if not exists public.historial_bajas (
  id              uuid primary key default gen_random_uuid(),
  gimnasio_id     uuid not null references public.gimnasios(id),
  socio_id        uuid not null,
  dado_de_baja_en timestamptz not null,
  motivo          text,
  volvio_en       timestamptz not null default now(),
  volvio_por      uuid references auth.users(id),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id)
);
create index if not exists historial_bajas_por_socio on public.historial_bajas (gimnasio_id, socio_id);
select privado.politicas_estandar('public.historial_bajas', array['dueno', 'encargado', 'recepcion'], null);
revoke all on table public.historial_bajas from anon;

-- ── Función ─────────────────────────────────────────────────────────
create or replace function public.volver_a_dar_de_alta(p_socio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare so public.socios; n int;
begin
  select * into so from public.socios where id = p_socio_id for update;
  if so.id is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(so.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if so.dado_de_baja_en is null then raise exception 'Este socio no está dado de baja.'; end if;
  insert into public.historial_bajas (gimnasio_id, socio_id, dado_de_baja_en, motivo, volvio_por)
  values (so.gimnasio_id, so.id, so.dado_de_baja_en, so.motivo_baja, auth.uid());
  update public.socios set dado_de_baja_en = null, motivo_baja = null where id = so.id and dado_de_baja_en is not null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo volver a dar de alta'; end if;
end $$;

revoke all on function public.volver_a_dar_de_alta(uuid) from public, anon, authenticated;
grant execute on function public.volver_a_dar_de_alta(uuid) to authenticated, service_role;


-- ── Teléfonos como los escribe la gente ─────────────────────────────
-- "387 15 555-1234", "0387 15 5551234", "011 1234-5678", "+54 9 387…",
-- "0054 9 387…" y "000 111 2222" (ficticio) quedan todos como +549…. Antes
-- el 15 del celular no se entendía y el alta de socios pedía escribir +54 9
-- (y la pantalla lo armaba mal con algunos números). Ahora un solo lugar.
create or replace function privado.telefono_normalizado(p_texto text, p_etiqueta text) returns text
language plpgsql immutable set search_path = '' as $$
declare d text; a int;
begin
  d := regexp_replace(coalesce(p_texto, ''), '[\s\-().]', '', 'g');
  if d = '' then return null; end if;
  if d ~ '^\+' then
    d := '+' || regexp_replace(substr(d, 2), '\D', '', 'g');
  else
    d := regexp_replace(d, '\D', '', 'g');
    if d ~ '^549[0-9]{10}$' then d := '+' || d;
    elsif d ~ '^54[0-9]{10}$' then d := '+549' || substr(d, 3);
    elsif d ~ '^00' and length(d) > 13 then d := '+' || substr(d, 3);          -- 0054 9 …: prefijo internacional
    else
      if length(d) in (11, 13) and d ~ '^0[1-9]' then d := substr(d, 2); end if;   -- 0387…, 011…
      if length(d) = 12 then                                                     -- característica + 15 + número
        for a in 2..4 loop
          if substr(d, a + 1, 2) = '15' then d := substr(d, 1, a) || substr(d, a + 3); exit; end if;
        end loop;
      end if;
      if length(d) = 10 then d := '+549' || d; end if;
    end if;
  end if;
  if d !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception '%: escribilo con característica, por ejemplo 387 555 1234 o 11 1234 5678.', p_etiqueta using errcode = '22023';
  end if;
  return d;
end $$;
revoke all on function privado.telefono_normalizado(text, text) from public, anon, authenticated;

create or replace function public.guardar_socio(p_gimnasio_id uuid, p_socio_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; sid uuid; n int; v_tel text; v_dni text; v_mail text;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  if length(trim(coalesce(p_datos ->> 'nombre', ''))) = 0 then raise exception 'El nombre es obligatorio'; end if;
  -- El teléfono como lo escribe la gente (387 15 555-1234, 011 4…): lo normaliza la base (0033).
  v_tel := privado.telefono_normalizado(p_datos ->> 'telefono', 'WhatsApp');
  v_dni := nullif(regexp_replace(coalesce(p_datos ->> 'dni', ''), '\D', '', 'g'), '');
  if v_dni is not null and v_dni !~ '^[0-9]{6,9}$' then raise exception 'El DNI tiene que tener entre 6 y 9 números'; end if;
  v_mail := nullif(lower(trim(coalesce(p_datos ->> 'email', ''))), '');
  if v_mail is not null and v_mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'El mail no es válido'; end if;
  if v_dni is not null and exists (select 1 from public.socios where gimnasio_id = p_gimnasio_id and socios.dni = v_dni
                                  and id is distinct from p_socio_id) then
    raise exception 'Ya hay un socio con el DNI %', v_dni;
  end if;

  if p_socio_id is null then
    insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, email, fecha_nacimiento,
                               contacto_emergencia_nombre, contacto_emergencia_telefono, notas, origen, creado_por)
    values (p_gimnasio_id, trim(p_datos ->> 'nombre'), trim(coalesce(p_datos ->> 'apellido', '')), v_dni, v_tel, v_mail,
            nullif(p_datos ->> 'fecha_nacimiento', '')::date,
            nullif(trim(coalesce(p_datos ->> 'contacto_emergencia_nombre', '')), ''),
            privado.telefono_normalizado(p_datos ->> 'contacto_emergencia_telefono', 'Teléfono de emergencia'),
            nullif(trim(coalesce(p_datos ->> 'notas', '')), ''), 'manual', auth.uid())
    returning id into sid;
  else
    update public.socios set
      nombre = trim(p_datos ->> 'nombre'), apellido = trim(coalesce(p_datos ->> 'apellido', '')), dni = v_dni,
      telefono = v_tel, email = v_mail, fecha_nacimiento = nullif(p_datos ->> 'fecha_nacimiento', '')::date,
      contacto_emergencia_nombre = nullif(trim(coalesce(p_datos ->> 'contacto_emergencia_nombre', '')), ''),
      contacto_emergencia_telefono = privado.telefono_normalizado(p_datos ->> 'contacto_emergencia_telefono', 'Teléfono de emergencia'),
      notas = nullif(trim(coalesce(p_datos ->> 'notas', '')), '')
     where id = p_socio_id and gimnasio_id = p_gimnasio_id
    returning id into sid;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  end if;
  return sid;
end $$;

revoke all on function public.guardar_socio(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.guardar_socio(uuid, uuid, jsonb) to authenticated, service_role;

do $$
declare c record;
begin
  for c in select * from (values ('387 15 555-1234', '+5493875551234'), ('0387 15 5551234', '+5493875551234'),
                                 ('011 1234-5678', '+5491112345678'), ('11 15 1234 5678', '+5491112345678'),
                                 ('+54 9 387 555 1234', '+5493875551234'), ('0054 9 387 555 1234', '+5493875551234'),
                                 ('54 387 555 1234', '+5493875551234'), ('000 111 2222', '+5490001112222'),
                                 ('3875551234', '+5493875551234')) v(entrada, sale) loop
    if privado.telefono_normalizado(c.entrada, 'x') <> c.sale then
      raise exception 'Verificación: % quedó % (esperaba %)', c.entrada, privado.telefono_normalizado(c.entrada, 'x'), c.sale;
    end if;
  end loop;
end $$;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.historial_bajas'::regclass) then
    raise exception 'Verificación: historial_bajas sin RLS';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'historial_bajas' and cmd <> 'SELECT') then
    raise exception 'Verificación: historial_bajas se puede escribir desde el cliente';
  end if;
  if not exists (select 1 from pg_proc where oid = 'public.volver_a_dar_de_alta(uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: volver_a_dar_de_alta sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.volver_a_dar_de_alta(uuid)', 'execute') then
    raise exception 'Verificación: anon puede volver a dar de alta';
  end if;
end $$;
