-- 0050 · Tablet en la puerta: modo kiosco (ENT-3).
-- El dueño autoriza una tablet (Configuración → Reglas): la base genera un
-- token que se muestra una sola vez (guarda solo su hash). La tablet lo
-- guarda en una cookie y, sin sesión de nadie, el socio escribe su DNI o
-- muestra su QR: entra si puede (mismo cálculo y mismo registro que la
-- recepción, forma "kiosco"); si no, ve por qué y que pase por recepción.
-- Nadie deja pasar desde la tablet. Revocar la tablet la apaga al instante.
-- Solo con la forma de entrada "kiosco" prendida.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.cupo_dejar_pasar(uuid)') is null then raise exception 'Guarda: falta la migración 0049'; end if;
  if to_regclass('public.dispositivos_tokens') is null then raise exception 'Guarda: falta la migración 0006'; end if;
end $$;

-- Los hashes de los tokens no los lee nadie desde afuera (RLS ya los tapaba; ahora tampoco hay permiso).
revoke all on table public.dispositivos_tokens from public, anon, authenticated;

-- ── La validación del QR, sola (la usan la recepción y la tablet) ───
create or replace function privado.validar_qr(p_gimnasio_id uuid, p_codigo text, p_momento timestamptz) returns uuid
language plpgsql set search_path = '' as $$
declare m text[]; sid uuid; v bigint; actual bigint; s public.socios; sec bytea; n int;
begin
  m := regexp_match(trim(coalesce(p_codigo, '')), '^GYMOS1\.([0-9a-f-]{36})\.([0-9]{1,12})\.([0-9a-f]{24})$');
  if m is null then raise exception 'Ese código no es un QR de socio.' using errcode = '22023'; end if;
  sid := m[1]::uuid; v := m[2]::bigint;
  select * into s from public.socios where id = sid and gimnasio_id = p_gimnasio_id;
  if s.id is null then raise exception 'Ese QR es de otro gimnasio.' using errcode = '22023'; end if;
  if s.dado_de_baja_en is not null then raise exception '% está dado de baja.', trim(s.nombre || ' ' || s.apellido) using errcode = '22023'; end if;
  actual := privado.ventana_qr(p_momento);
  if v not in (actual, actual - 1) then
    raise exception 'El QR venció: que lo abra de nuevo en la app (cambia cada 30 segundos).' using errcode = '22023';
  end if;
  select c.secreto into sec from privado.credenciales_qr c where c.gimnasio_id = p_gimnasio_id and c.socio_id = sid;
  if sec is null or privado.firma_qr(sec, sid, v) <> m[3] then raise exception 'El QR no es válido.' using errcode = '22023'; end if;
  insert into privado.usos_qr (gimnasio_id, socio_id, ventana) values (p_gimnasio_id, sid, v) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Ese QR ya se usó: que lo actualice en la app.' using errcode = '22023'; end if;
  return sid;
end $$;
revoke all on function privado.validar_qr(uuid, text, timestamptz) from public, anon, authenticated;

-- leer_qr (0048), misma firma: ahora usa la validación de arriba.
create or replace function public.leer_qr(p_gimnasio_id uuid, p_codigo text, p_momento timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare sid uuid; s public.socios;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if not exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id and 'qr_socio' = any (c.accesos_activos)) then
    raise exception 'Este gimnasio no tiene prendida la entrada con QR (Configuración → Reglas).' using errcode = '22023';
  end if;
  sid := privado.validar_qr(p_gimnasio_id, p_codigo, p_momento);
  select * into s from public.socios where id = sid;
  return jsonb_build_object('socio_id', s.id, 'nombre', trim(s.nombre || ' ' || s.apellido), 'numero', s.numero);
end $$;

-- ── El dueño autoriza y revoca tablets ──────────────────────────────
create or replace function public.tablets_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'nombre', d.nombre, 'sede', s.nombre, 'ultimo_uso', d.ultimo_uso,
                                                        'creado_en', d.creado_en, 'revocado', d.revocado_en is not null) order by d.revocado_en is not null, d.creado_en desc)
                    from public.dispositivos d join public.sedes s on s.id = d.sede_id
                   where d.gimnasio_id = p_gimnasio_id and d.tipo = 'kiosco'), '[]');
end $$;

create or replace function public.autorizar_tablet(p_gimnasio_id uuid, p_sede_id uuid, p_nombre text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare did uuid; tok text; nom text := nullif(trim(coalesce(p_nombre, '')), '');
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if nom is null then raise exception 'Ponele un nombre a la tablet (por ejemplo "Puerta principal").' using errcode = '22023'; end if;
  if length(nom) > 40 then raise exception 'El nombre: hasta 40 letras.' using errcode = '22023'; end if;
  if not exists (select 1 from public.sedes s where s.id = p_sede_id and s.gimnasio_id = p_gimnasio_id) then
    raise exception 'Esa sede no es de este gimnasio.' using errcode = '22023';
  end if;
  if (select count(*) from public.dispositivos d where d.gimnasio_id = p_gimnasio_id and d.revocado_en is null) >= 20 then
    raise exception 'Hay 20 tablets autorizadas: revocá alguna que no se use.' using errcode = '22023';
  end if;
  insert into public.dispositivos (gimnasio_id, sede_id, nombre, tipo) values (p_gimnasio_id, p_sede_id, nom, 'kiosco') returning id into did;
  tok := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.dispositivos_tokens (gimnasio_id, dispositivo_id, token_hash)
  values (p_gimnasio_id, did, encode(extensions.digest(tok, 'sha256'), 'hex'));
  -- El token se ve una sola vez: la base guarda solo su hash.
  return jsonb_build_object('id', did, 'token', tok);
end $$;

create or replace function public.revocar_tablet(p_dispositivo_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; n int;
begin
  select d.gimnasio_id into g from public.dispositivos d where d.id = p_dispositivo_id;
  if g is null then raise exception 'Sin permiso o tablet inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(g, array['dueno']);
  update public.dispositivos set revocado_en = now() where id = p_dispositivo_id and revocado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Esa tablet ya estaba revocada.'; end if;
end $$;

-- ── La tablet ───────────────────────────────────────────────────────
-- Desde la tablet: el token es la credencial (sin sesión). Devuelve lo mínimo:
-- nombre de pila, color y el porqué; nunca DNI, teléfono ni plata.
create or replace function privado.tablet_del_token(p_token text) returns public.dispositivos
language plpgsql stable security definer set search_path = '' as $$
declare d public.dispositivos;
begin
  select dv.* into d from public.dispositivos_tokens t join public.dispositivos dv on dv.id = t.dispositivo_id
   where t.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if d.id is null or d.revocado_en is not null then
    raise exception 'Esta tablet no está autorizada. El dueño la autoriza desde Configuración → Reglas.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = d.gimnasio_id and 'kiosco' = any (c.accesos_activos)) then
    raise exception 'La entrada con tablet está apagada en este gimnasio.' using errcode = '42501';
  end if;
  return d;
end $$;
revoke all on function privado.tablet_del_token(text) from public, anon, authenticated;

create or replace function public.kiosco_estado(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d public.dispositivos;
begin
  d := privado.tablet_del_token(p_token);
  return jsonb_build_object('tablet', d.nombre, 'sede', (select s.nombre from public.sedes s where s.id = d.sede_id),
    'gimnasio', (select g.nombre from public.gimnasios g where g.id = d.gimnasio_id),
    'con_qr', exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = d.gimnasio_id and 'qr_socio' = any (c.accesos_activos)));
end $$;

create or replace function public.kiosco_entrar(p_token text, p_codigo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d public.dispositivos; sid uuid; s public.socios; v public.veredicto_acceso; r jsonb; v_dni text;
begin
  d := privado.tablet_del_token(p_token);
  -- Freno contra probar DNIs al azar: 30 intentos por minuto por tablet.
  if (select count(*) from public.ingresos i where i.dispositivo_id = d.id and i.momento > now() - interval '1 minute') >= 30 then
    raise exception 'Demasiados intentos: esperá un minuto.' using errcode = '54000';
  end if;
  if trim(coalesce(p_codigo, '')) ~ '^GYMOS1\.' then
    if not exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = d.gimnasio_id and 'qr_socio' = any (c.accesos_activos)) then
      raise exception 'Este gimnasio no usa QR: escribí tu DNI.' using errcode = '22023';
    end if;
    sid := privado.validar_qr(d.gimnasio_id, p_codigo, now());
  else
    v_dni := regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g');
    if v_dni !~ '^[0-9]{6,9}$' then raise exception 'Escribí tu DNI, sin puntos.' using errcode = '22023'; end if;
    select so.id into sid from public.socios so where so.gimnasio_id = d.gimnasio_id and so.dni = v_dni and so.dado_de_baja_en is null;
    if sid is null then raise exception 'No encontramos ese DNI. Pasá por recepción.' using errcode = '22023'; end if;
  end if;
  select * into s from public.socios where id = sid;
  update public.dispositivos set ultimo_uso = now() where id = d.id;
  r := privado.registrar_ingreso(sid, d.sede_id, 'kiosco', null, d.id, null, null);
  v := privado.calcular_acceso(sid, now() - interval '1 second', d.sede_id);
  return jsonb_build_object('nombre', s.nombre, 'resultado', r ->> 'resultado', 'repetido', (r ->> 'repetido')::boolean,
    'color', coalesce(r #>> '{veredicto,color}', r ->> 'color', v.color),
    -- En la puerta lo ve cualquiera: sin la indicación para la recepción y sin montos.
    'texto', regexp_replace(replace(coalesce(r #>> '{veredicto,texto}', r ->> 'texto', v.texto), ' · avisale', ''), ' · debe [^·]*', '', 'g'));
end $$;

revoke all on function public.tablets_panel(uuid), public.autorizar_tablet(uuid, uuid, text), public.revocar_tablet(uuid),
  public.kiosco_estado(text), public.kiosco_entrar(text, text), public.leer_qr(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.tablets_panel(uuid), public.autorizar_tablet(uuid, uuid, text), public.revocar_tablet(uuid),
  public.leer_qr(uuid, text, timestamptz) to authenticated, service_role;
-- La tablet no tiene sesión: el token la autoriza adentro de la función.
grant execute on function public.kiosco_estado(text), public.kiosco_entrar(text, text) to anon, authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  if has_table_privilege('anon', 'public.dispositivos_tokens', 'select') or has_table_privilege('authenticated', 'public.dispositivos_tokens', 'select') then
    raise exception 'Verificación: los tokens de las tablets se pueden leer';
  end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'public' and p.proname in ('tablets_panel', 'autorizar_tablet', 'revocar_tablet', 'kiosco_estado', 'kiosco_entrar', 'leer_qr'))
               or (s.nspname = 'privado' and p.proname in ('validar_qr', 'tablet_del_token')) loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if r.proname not in ('kiosco_estado', 'kiosco_entrar') and has_function_privilege('anon', r.oid, 'execute') then
      raise exception 'Verificación: anon puede ejecutar %', r.proname;
    end if;
  end loop;
end $$;
