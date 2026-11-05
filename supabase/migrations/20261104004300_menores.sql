-- 0043 · Menores con adulto responsable (SOC-10, decisión D10).
-- Un socio menor de 18 (sale de la fecha de nacimiento, no se guarda) se
-- carga con un adulto responsable: nombre y celular. El menor no entra a la
-- app: al verificar el celular, la cuenta del responsable queda vinculada al
-- menor (y elige a quién mirar, como una familia); el celular del menor no
-- vincula nada.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.pedidos_pausa') is null then raise exception 'Guarda: falta la migración 0042'; end if;
  if to_regprocedure('privado.telefono_normalizado(text, text)') is null then raise exception 'Guarda: falta telefono_normalizado (0033)'; end if;
end $$;

alter table public.socios add column if not exists responsable_nombre text;
alter table public.socios add column if not exists responsable_telefono text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'socios_responsable_telefono_valido') then
    alter table public.socios add constraint socios_responsable_telefono_valido
      check (responsable_telefono is null or responsable_telefono ~ '^\+[0-9]{8,15}$');
  end if;
end $$;
create index if not exists socios_responsable_telefono on public.socios (gimnasio_id, responsable_telefono) where responsable_telefono is not null;

-- ¿Es menor ese día? Sin fecha de nacimiento, no se sabe: se toma como adulto.
create or replace function privado.es_menor(p_nacimiento date, p_hoy date) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_nacimiento > (p_hoy - interval '18 years')::date, false)
$$;
revoke all on function privado.es_menor(date, date) from public, anon, authenticated;

-- ── Ficha (copia de 0013 con el responsable) ────────────────────────
create or replace function public.ficha_socio(p_socio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.socios; e public.equipo; v public.veredicto_acceso; zona text;
begin
  select * into s from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(s.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = s.gimnasio_id;
  v := privado.calcular_acceso(s.id, now(), e.sede_id);
  return jsonb_build_object(
    'socio', jsonb_build_object('id', s.id, 'numero', s.numero, 'nombre', s.nombre, 'apellido', s.apellido, 'dni', s.dni,
      'telefono', s.telefono, 'email', s.email, 'fecha_nacimiento', s.fecha_nacimiento,
      'contacto_emergencia_nombre', s.contacto_emergencia_nombre, 'contacto_emergencia_telefono', s.contacto_emergencia_telefono,
      'notas', s.notas, 'dado_de_baja_en', s.dado_de_baja_en, 'motivo_baja', s.motivo_baja, 'creado_en', s.creado_en,
      'tiene_app', s.usuario_id is not null,
      'responsable_nombre', s.responsable_nombre, 'responsable_telefono', s.responsable_telefono,
      'es_menor', privado.es_menor(s.fecha_nacimiento, privado.dia_local(now(), zona))),
    'acceso', to_jsonb(v),
    'membresia', (select jsonb_build_object('suscripcion_id', su.id, 'plan_id', pl.id, 'plan', pl.nombre, 'tipo', pl.tipo,
                                            'inicio', su.inicio, 'precio', privado.precio_base(pl.id, now()))
                    from public.suscripciones su join public.planes pl on pl.id = su.plan_id
                   where su.socio_id = s.id and su.baja_en is null order by su.inicio desc limit 1),
    'ingresos', coalesce((select jsonb_agg(x order by x.momento desc) from (
                   select i.id, i.momento, i.resultado, i.color, i.texto, i.via_acceso from public.ingresos i
                    where i.socio_id = s.id and i.anulado_en is null order by i.momento desc limit 10) x), '[]'::jsonb),
    'pagos', case when e.rol in ('dueno', 'encargado') then coalesce((select jsonb_agg(x order by x.fecha desc) from (
                   select p.id, coalesce(p.aprobado_en, p.creado_en) as fecha, p.monto, p.medio, p.estado,
                          (select string_agg(vi.descripcion, ', ') from public.venta_items vi where vi.venta_id = p.venta_id) as detalle
                     from public.pagos p join public.ventas ve on ve.id = p.venta_id
                    where ve.socio_id = s.id order by coalesce(p.aprobado_en, p.creado_en) desc limit 10) x), '[]'::jsonb) end,
    'packs', coalesce((select jsonb_agg(jsonb_build_object('id', pk.id, 'plan', pl.nombre, 'cantidad', pk.cantidad,
                         'usadas', (select count(*) from public.consumos_pack cp where cp.pack_id = pk.id and cp.anulado_en is null),
                         'vence_en', pk.vence_en))
                        from public.packs pk join public.planes pl on pl.id = pk.plan_id
                       where pk.socio_id = s.id and pk.anulado_en is null and (pk.vence_en is null or pk.vence_en > now())), '[]'::jsonb)
  );
end $$;

-- ── Alta y edición (copia de 0033 con el responsable) ───────────────
create or replace function public.guardar_socio(p_gimnasio_id uuid, p_socio_id uuid, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; sid uuid; n int; v_tel text; v_dni text; v_mail text;
        v_nac date; v_resp text; v_resp_tel text; zona text;
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
  -- Menor de 18 (D10): se carga con un adulto responsable, nombre y celular.
  v_nac := nullif(p_datos ->> 'fecha_nacimiento', '')::date;
  v_resp := nullif(trim(coalesce(p_datos ->> 'responsable_nombre', '')), '');
  v_resp_tel := privado.telefono_normalizado(p_datos ->> 'responsable_telefono', 'Celular del responsable');
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = p_gimnasio_id;
  if v_nac is not null and v_nac > privado.dia_local(now(), zona) then raise exception 'La fecha de nacimiento no puede ser futura'; end if;
  if privado.es_menor(v_nac, privado.dia_local(now(), zona)) and (v_resp is null or v_resp_tel is null) then
    raise exception 'Es menor de 18: cargá el nombre y el celular del adulto responsable (es quien entra a la app).' using errcode = '22023';
  end if;
  if v_dni is not null and exists (select 1 from public.socios where gimnasio_id = p_gimnasio_id and socios.dni = v_dni
                                  and id is distinct from p_socio_id) then
    raise exception 'Ya hay un socio con el DNI %', v_dni;
  end if;

  if p_socio_id is null then
    insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, email, fecha_nacimiento,
                               contacto_emergencia_nombre, contacto_emergencia_telefono, notas, origen, creado_por,
                               responsable_nombre, responsable_telefono)
    values (p_gimnasio_id, trim(p_datos ->> 'nombre'), trim(coalesce(p_datos ->> 'apellido', '')), v_dni, v_tel, v_mail,
            nullif(p_datos ->> 'fecha_nacimiento', '')::date,
            nullif(trim(coalesce(p_datos ->> 'contacto_emergencia_nombre', '')), ''),
            privado.telefono_normalizado(p_datos ->> 'contacto_emergencia_telefono', 'Teléfono de emergencia'),
            nullif(trim(coalesce(p_datos ->> 'notas', '')), ''), 'manual', auth.uid(), v_resp, v_resp_tel)
    returning id into sid;
  else
    update public.socios set
      nombre = trim(p_datos ->> 'nombre'), apellido = trim(coalesce(p_datos ->> 'apellido', '')), dni = v_dni,
      telefono = v_tel, email = v_mail, fecha_nacimiento = nullif(p_datos ->> 'fecha_nacimiento', '')::date,
      contacto_emergencia_nombre = nullif(trim(coalesce(p_datos ->> 'contacto_emergencia_nombre', '')), ''),
      contacto_emergencia_telefono = privado.telefono_normalizado(p_datos ->> 'contacto_emergencia_telefono', 'Teléfono de emergencia'),
      notas = nullif(trim(coalesce(p_datos ->> 'notas', '')), ''),
      responsable_nombre = v_resp, responsable_telefono = v_resp_tel
     where id = p_socio_id and gimnasio_id = p_gimnasio_id
    returning id into sid;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  end if;
  return sid;
end $$;

-- ── La app: el responsable entra por el menor; el menor no ──────────
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
   where s.gimnasio_id = p_gimnasio_id and s.usuario_id is null and s.dado_de_baja_en is null
     and case when privado.es_menor(s.fecha_nacimiento, hoy) then s.responsable_telefono = tel else s.telefono = tel end;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.ficha_socio(uuid), public.guardar_socio(uuid, uuid, jsonb), public.vincular_socios_por_telefono(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.ficha_socio(uuid), public.guardar_socio(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.vincular_socios_por_telefono(uuid, uuid) to service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  if not privado.es_menor('2010-06-01', '2026-11-05') or privado.es_menor('2008-11-05', '2026-11-05') or privado.es_menor(null, '2026-11-05') then
    raise exception 'Verificación: es_menor no cuenta bien los 18';
  end if;
  if has_function_privilege('authenticated', 'public.vincular_socios_por_telefono(uuid, uuid)', 'execute') then
    raise exception 'Verificación: un usuario puede vincularse solo a un socio';
  end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'public' and p.proname in ('ficha_socio', 'guardar_socio', 'vincular_socios_por_telefono'))
               or (s.nspname = 'privado' and p.proname = 'es_menor') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
end $$;
