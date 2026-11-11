-- H3b · El camino del socio completo (docs/base/SOCIO-FLUJO.md).
-- 1) alta_online: DNI de 7 u 8 cifras, reglamento opcional (si el gimnasio no cargó ninguno no se pide ni se anota),
--    menores de 18 con adulto responsable (nombre y celular), y dice si el que ya existe lo frenó el DNI o el celular.
-- 2) vincular_cuenta_socio (solo servidor): deja la cuenta recién creada vinculada a la ficha, sin duplicar nada.
-- 3) socio_para_reclamar (solo servidor): el socio ya cargado reclama su ficha con DNI y celular.
-- 4) mi_dni: el socio ve su propio DNI en la app ("Tu DNI para entrar"); permiso denegado = error.
-- Aditiva: no cambia cómo se calcula quién entra (eso es solo privado.calcular_acceso).

do $$
begin
  if to_regprocedure('public.alta_online(text, uuid, jsonb, int, text)') is null then raise exception 'Guarda: falta public.alta_online'; end if;
  if to_regprocedure('privado.telefono_normalizado(text, text)') is null then raise exception 'Guarda: falta privado.telefono_normalizado'; end if;
  if to_regprocedure('privado.es_menor(date, date)') is null then raise exception 'Guarda: falta privado.es_menor'; end if;
  if to_regprocedure('privado.es_servicio()') is null then raise exception 'Guarda: falta privado.es_servicio'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'socios' and column_name = 'responsable_telefono') then
    raise exception 'Guarda: falta socios.responsable_telefono';
  end if;
end $$;

-- ── 1 · Alta online ─────────────────────────────────────────────────
create or replace function public.alta_online(p_host text, p_plan_id uuid, p_datos jsonb, p_version int, p_medio text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g uuid; c public.configuracion_gimnasio; regl public.reglamentos; pl public.planes; sid uuid;
  v_nombre text := trim(coalesce(p_datos ->> 'nombre', '')); v_apellido text := trim(coalesce(p_datos ->> 'apellido', ''));
  v_dni text := regexp_replace(coalesce(p_datos ->> 'dni', ''), '\D', '', 'g');
  v_mail text := nullif(lower(trim(coalesce(p_datos ->> 'email', ''))), '');
  v_nac date; v_tel text; v_trans jsonb; zona text; hoy date; v_menor boolean;
  v_resp text := nullif(trim(coalesce(p_datos ->> 'responsable_nombre', '')), ''); v_resp_tel text;
begin
  select d.gimnasio_id into g from public.dominios_gimnasio d
    join public.landing_gimnasio l on l.gimnasio_id = d.gimnasio_id and l.publicada
   where d.host = lower(p_host);
  select * into c from public.configuracion_gimnasio where gimnasio_id = g;
  if g is null or not coalesce(c.altas_online, false) then raise exception 'Este gimnasio no está aceptando altas online. Escribile por WhatsApp.'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = g;
  hoy := (now() at time zone zona)::date;

  select * into pl from public.planes p where p.gimnasio_id = g and p.id = p_plan_id and p.activo and p.visible_en_landing;
  if pl.id is null then raise exception 'Elegí uno de los planes de la página.'; end if;
  -- El reglamento es opcional: si el gimnasio no cargó ninguno, no se pide. Si hay, tiene que ser la versión vigente.
  select * into regl from public.reglamentos r where r.gimnasio_id = g order by r.version desc limit 1;
  if regl.id is not null and p_version is distinct from regl.version then
    raise exception 'El reglamento cambió mientras te anotabas: leelo de nuevo y aceptalo.';
  end if;

  if length(v_nombre) = 0 or length(v_apellido) = 0 then raise exception 'Escribí tu nombre y tu apellido.'; end if;
  if length(v_nombre) > 80 or length(v_apellido) > 80 then raise exception 'Nombre o apellido muy largos (hasta 80 letras).'; end if;
  if v_dni !~ '^[0-9]{7,8}$' then raise exception 'DNI: 7 u 8 números, sin puntos.'; end if;
  if v_mail is not null and v_mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisá el mail.'; end if;
  begin
    v_tel := privado.telefono_normalizado(p_datos ->> 'telefono', 'Celular');
  exception when others then
    raise exception 'Revisá el celular: con característica, por ejemplo 387 555 1234.';
  end;
  if v_tel is null then raise exception 'Dejá tu celular.'; end if;
  if coalesce(p_datos ->> 'fecha_nacimiento', '') = '' then raise exception 'Escribí tu fecha de nacimiento.'; end if;
  begin v_nac := (p_datos ->> 'fecha_nacimiento')::date;
  exception when others then raise exception 'Revisá la fecha de nacimiento.'; end;
  if v_nac > hoy or v_nac < date '1900-01-01' then raise exception 'Revisá la fecha de nacimiento.'; end if;
  -- Menor de 18: el alta lleva el nombre y el celular de un adulto responsable (es quien entra a la app).
  v_menor := privado.es_menor(v_nac, hoy);
  if v_menor then
    begin
      v_resp_tel := privado.telefono_normalizado(p_datos ->> 'responsable_telefono', 'Celular del adulto responsable');
    exception when others then
      raise exception 'Revisá el celular del adulto responsable: con característica, por ejemplo 387 555 1234.';
    end;
    if v_resp is null or v_resp_tel is null then
      raise exception 'Sos menor de 18: escribí el nombre y el celular de un adulto responsable.';
    end if;
    if length(v_resp) > 120 then raise exception 'El nombre del adulto responsable es muy largo.'; end if;
  else
    v_resp := null;
  end if;

  if p_medio is null or p_medio not in ('transferencia', 'mostrador') then raise exception 'Elegí cómo vas a pagar.'; end if;
  v_trans := privado.datos_transferencia(g);
  if p_medio = 'transferencia' and v_trans is null then raise exception 'Este gimnasio no recibe transferencias: elegí pagar en el mostrador.'; end if;

  -- Ya es socio: nunca se crea otro con un DNI que existe. El celular solo frena a los adultos (un menor usa el de su responsable).
  if exists (select 1 from public.socios s where s.gimnasio_id = g and s.dni = v_dni) then
    return jsonb_build_object('ya_socio', true, 'por', 'dni');
  end if;
  if not v_menor and exists (select 1 from public.socios s where s.gimnasio_id = g and s.telefono = v_tel) then
    return jsonb_build_object('ya_socio', true, 'por', 'telefono');
  end if;
  if (select count(*) from public.socios s where s.gimnasio_id = g and s.origen = 'alta_web' and s.creado_en > now() - interval '1 hour') >= 20 then
    raise exception 'Recibimos muchas altas en este momento. Probá en un rato o escribinos por WhatsApp.';
  end if;

  insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, email, fecha_nacimiento, origen, responsable_nombre, responsable_telefono)
  values (g, v_nombre, v_apellido, v_dni, v_tel, v_mail, v_nac, 'alta_web', v_resp, case when v_menor then v_resp_tel end) returning id into sid;
  -- Membresía: queda asignada (sin cobertura hasta pagar: D26, la puerta lo dice). Pase o pack: se compra en el mostrador o con transferencia.
  if pl.tipo = 'membresia' then perform privado.asignar_plan(sid, pl.id, now(), null); end if;
  if regl.id is not null then
    insert into public.aceptaciones_reglamento (gimnasio_id, socio_id, reglamento_id) values (g, sid, regl.id);
  end if;

  -- El aviso al gimnasio: queda en Prospectos → "Se hicieron socios", con lo que eligió.
  insert into public.prospectos (gimnasio_id, nombre, telefono, interes, origen, estado, socio_id, nota)
  values (g, v_nombre || ' ' || v_apellido, v_tel, 'Alta online · ' || pl.nombre, 'pagina', 'socio', sid,
          case p_medio when 'transferencia' then 'Se anotó online: paga por transferencia (manda el comprobante desde la app).'
                       else 'Se anotó online: paga en el mostrador.' end)
  on conflict (gimnasio_id, telefono) do update set estado = 'socio', socio_id = excluded.socio_id, interes = excluded.interes,
    nota = excluded.nota, actualizado_en = now();

  return jsonb_build_object('ya_socio', false, 'socio_id', sid, 'gimnasio_id', g, 'plan', pl.nombre, 'menor', v_menor,
    'precio', privado.precio_para(pl.id, now(), null, null, false), 'medio', p_medio,
    'transferencia', case when p_medio = 'transferencia' then v_trans end);
end $$;

-- ── 2 · Vincular la cuenta a la ficha (solo el servidor) ────────────
create or replace function public.vincular_cuenta_socio(p_gimnasio_id uuid, p_socio_id uuid, p_usuario_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not privado.es_servicio() then raise exception 'Solo el servidor vincula socios' using errcode = '42501'; end if;
  update public.socios s set usuario_id = p_usuario_id
   where s.id = p_socio_id and s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null and s.usuario_id is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'La ficha no existe o ya tiene una cuenta vinculada' using errcode = '22023'; end if;
end $$;

-- ── 3 · Reclamar la ficha ya cargada (solo el servidor) ─────────────
-- Un solo resultado cuando algo no coincide: no se revela si el DNI existe.
create or replace function public.socio_para_reclamar(p_gimnasio_id uuid, p_dni text, p_telefono text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_dni text := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g'); v_tel text; s public.socios; hoy date; coincide boolean;
begin
  if not privado.es_servicio() then raise exception 'Solo el servidor reclama fichas' using errcode = '42501'; end if;
  begin v_tel := privado.telefono_normalizado(p_telefono, 'Celular'); exception when others then v_tel := null; end;
  if v_dni !~ '^[0-9]{7,8}$' or v_tel is null then return jsonb_build_object('estado', 'no_coincide'); end if;
  select * into s from public.socios x where x.gimnasio_id = p_gimnasio_id and x.dni = v_dni and x.dado_de_baja_en is null;
  if s.id is null then return jsonb_build_object('estado', 'no_coincide'); end if;
  select (now() at time zone gi.zona_horaria)::date into hoy from public.gimnasios gi where gi.id = p_gimnasio_id;
  coincide := case when privado.es_menor(s.fecha_nacimiento, hoy) then s.responsable_telefono = v_tel else s.telefono = v_tel end;
  if not coalesce(coincide, false) then return jsonb_build_object('estado', 'no_coincide'); end if;
  if s.usuario_id is not null then return jsonb_build_object('estado', 'ya_tiene_cuenta'); end if;
  return jsonb_build_object('estado', 'ok', 'socio_id', s.id, 'nombre', s.nombre, 'email', s.email);
end $$;

-- ── 4 · Mi DNI (el socio lee el suyo) ───────────────────────────────
create or replace function public.mi_dni(p_socio_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v text;
begin
  select s.dni into v from public.socios s where s.id = p_socio_id and s.usuario_id = (select auth.uid()) and s.dado_de_baja_en is null;
  if v is null then raise exception 'Esa ficha no es tuya' using errcode = '42501'; end if;
  return v;
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke execute on function public.alta_online(text, uuid, jsonb, int, text) from public;
grant execute on function public.alta_online(text, uuid, jsonb, int, text) to anon, authenticated, service_role;
revoke execute on function public.vincular_cuenta_socio(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.vincular_cuenta_socio(uuid, uuid, uuid) to service_role;
revoke execute on function public.socio_para_reclamar(uuid, text, text) from public, anon, authenticated;
grant execute on function public.socio_para_reclamar(uuid, text, text) to service_role;
revoke execute on function public.mi_dni(uuid) from public, anon;
grant execute on function public.mi_dni(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.alta_online(text, uuid, jsonb, int, text)', 'public.vincular_cuenta_socio(uuid, uuid, uuid)',
                           'public.socio_para_reclamar(uuid, text, text)', 'public.mi_dni(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
  end loop;
  if has_function_privilege('anon', 'public.vincular_cuenta_socio(uuid, uuid, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.vincular_cuenta_socio(uuid, uuid, uuid)', 'execute')
     or has_function_privilege('anon', 'public.socio_para_reclamar(uuid, text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.socio_para_reclamar(uuid, text, text)', 'execute') then
    raise exception 'Verificación: vincular_cuenta_socio y socio_para_reclamar son solo del servidor';
  end if;
  if has_function_privilege('anon', 'public.mi_dni(uuid)', 'execute') then raise exception 'Verificación: mi_dni no es para anónimos'; end if;
  if not has_function_privilege('anon', 'public.alta_online(text, uuid, jsonb, int, text)', 'execute') then raise exception 'Verificación: alta_online tiene que seguir abierta a la página pública'; end if;
end $$;
