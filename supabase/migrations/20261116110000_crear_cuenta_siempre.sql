-- ═══════════════════════════════════════════════════════════════════
-- D83 (Mateo, 16/11) · "Crear mi cuenta" siempre, aunque las altas online estén apagadas.
--
-- Crear la cuenta gratis (nombre, DNI, celular, mail y contraseña, sin plan) ya no depende de `altas_online`: esa llave decide solo si
-- se puede ELEGIR y pagar un plan online. El dueño puede ocultar el botón con `crear_cuenta_visible` (prendida por defecto).
-- Aditiva y compatible con el código anterior:
--   · columna nueva con default true; alta_online y alta_publica conservan su firma (el código viejo manda siempre un plan: sigue igual);
--   · landing_publica se envuelve (como en 20261109020900): suma la clave `crear_cuenta` y no toca nada de lo que ya devolvía;
--   · nada cambia la puerta: la cuenta queda socio SIN PAGAR y `calcular_acceso` lo dice (D26).
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.alta_online(text, uuid, jsonb, int, text)') is null then raise exception 'Guarda: falta public.alta_online'; end if;
  if to_regprocedure('public.alta_publica(text)') is null then raise exception 'Guarda: falta public.alta_publica'; end if;
  if to_regprocedure('public.landing_publica(text)') is null then raise exception 'Guarda: falta public.landing_publica'; end if;
  if to_regprocedure('privado.landing_completa(uuid)') is null then raise exception 'Guarda: falta privado.landing_completa'; end if;
end $$;

alter table public.configuracion_gimnasio add column if not exists crear_cuenta_visible boolean not null default true;

-- ── La llave del dueño ──────────────────────────────────────────────
create or replace function public.crear_cuenta_panel(p_gimnasio_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return coalesce((select c.crear_cuenta_visible from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id), true);
end $$;

create or replace function public.guardar_crear_cuenta(p_gimnasio_id uuid, p_visible boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_visible is null then raise exception 'Elegí si el botón "Crear mi cuenta" se muestra o se oculta' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set crear_cuenta_visible = p_visible where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar' using errcode = 'P0002'; end if;
  return p_visible;
end $$;
revoke all on function public.crear_cuenta_panel(uuid), public.guardar_crear_cuenta(uuid, boolean) from public, anon;
grant execute on function public.crear_cuenta_panel(uuid), public.guardar_crear_cuenta(uuid, boolean) to authenticated, service_role;

-- ── El alta: el plan y el medio de pago son opcionales ──────────────
-- Sin plan: solo la cuenta y la ficha ("lo elijo en el gimnasio"). Con plan: igual que antes (pide altas_online, plan visible y medio).
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
  if g is null or not (coalesce(c.altas_online, false) or coalesce(c.crear_cuenta_visible, true)) then
    raise exception 'Este gimnasio no está aceptando altas online. Escribile por WhatsApp.';
  end if;
  -- Elegir y pagar un plan online es lo que decide `altas_online`; crear la cuenta sola no.
  if p_plan_id is not null and not coalesce(c.altas_online, false) then
    raise exception 'Este gimnasio no está aceptando altas online con plan. Creá tu cuenta y elegí el plan en el gimnasio.';
  end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = g;
  hoy := (now() at time zone zona)::date;

  if p_plan_id is not null then
    select * into pl from public.planes p where p.gimnasio_id = g and p.id = p_plan_id and p.activo and p.visible_en_landing;
    if pl.id is null then raise exception 'Elegí uno de los planes de la página.'; end if;
  end if;
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

  if pl.id is not null then
    if p_medio is null or p_medio not in ('transferencia', 'mostrador') then raise exception 'Elegí cómo vas a pagar.'; end if;
    v_trans := privado.datos_transferencia(g);
    if p_medio = 'transferencia' and v_trans is null then raise exception 'Este gimnasio no recibe transferencias: elegí pagar en el mostrador.'; end if;
  end if;

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
  if pl.id is not null and pl.tipo = 'membresia' then perform privado.asignar_plan(sid, pl.id, now(), null); end if;
  if regl.id is not null then
    insert into public.aceptaciones_reglamento (gimnasio_id, socio_id, reglamento_id) values (g, sid, regl.id);
  end if;

  -- El aviso al gimnasio: queda en Prospectos → "Se hicieron socios", con lo que eligió (o sin plan: lo elige en el gimnasio).
  insert into public.prospectos (gimnasio_id, nombre, telefono, interes, origen, estado, socio_id, nota)
  values (g, v_nombre || ' ' || v_apellido, v_tel,
          case when pl.id is null then 'Cuenta creada online · sin plan' else 'Alta online · ' || pl.nombre end, 'pagina', 'socio', sid,
          case when pl.id is null then 'Creó su cuenta online y elige el plan en el gimnasio (primera vez: clase de prueba o alta).'
               when p_medio = 'transferencia' then 'Se anotó online: paga por transferencia (manda el comprobante desde la app).'
               else 'Se anotó online: paga en el mostrador.' end)
  on conflict (gimnasio_id, telefono) do update set estado = 'socio', socio_id = excluded.socio_id, interes = excluded.interes,
    nota = excluded.nota, actualizado_en = now();

  return jsonb_build_object('ya_socio', false, 'socio_id', sid, 'gimnasio_id', g, 'plan', pl.nombre, 'menor', v_menor,
    'precio', case when pl.id is not null then privado.precio_para(pl.id, now(), null, null, false) end, 'medio', p_medio,
    'transferencia', case when p_medio = 'transferencia' then v_trans end);
end $$;

-- ── Lo que necesita la pantalla de alta ─────────────────────────────
-- Igual que antes, pero `abierta` también es verdadera si solo se puede crear la cuenta; `con_plan` dice si además se puede elegir plan.
-- Con las altas online apagadas no se manda ni la lista de planes ni la transferencia: solo la marca, el contacto y el reglamento.
create or replace function public.alta_publica(p_host text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; l jsonb; c public.configuracion_gimnasio; con_plan boolean;
begin
  select d.gimnasio_id into g from public.dominios_gimnasio d where d.host = lower(p_host);
  if g is null then return null; end if;
  l := privado.landing_completa(g);
  select * into c from public.configuracion_gimnasio where gimnasio_id = g;
  con_plan := coalesce((l ->> 'altas_online')::boolean, false);
  if not coalesce((l ->> 'publicada')::boolean, false) or not (con_plan or coalesce(c.crear_cuenta_visible, true)) then
    return jsonb_build_object('abierta', false, 'marca', l -> 'marca', 'contacto', jsonb_build_object('whatsapp', l -> 'contacto' -> 'whatsapp'));
  end if;
  return jsonb_build_object('abierta', true, 'con_plan', con_plan, 'marca', l -> 'marca', 'contacto', l -> 'contacto', 'mostrar_precios', l -> 'mostrar_precios',
    'planes', case when con_plan then l -> 'planes' else '[]'::jsonb end,
    'plan_sugerido', case when con_plan then (select p.id from public.configuracion_gimnasio cc join public.planes p on p.gimnasio_id = cc.gimnasio_id and p.id = cc.alta_plan_sugerido_id
                       where cc.gimnasio_id = g and p.activo and p.visible_en_landing) end,
    'reglamento', (select jsonb_build_object('version', r.version, 'texto', r.texto)
                     from public.reglamentos r where r.gimnasio_id = g order by r.version desc limit 1),
    'transferencia', case when con_plan then privado.datos_transferencia(g) end);
end $$;

-- ── La página: suma `crear_cuenta` (envuelve la función vigente) ────
do $envolver$
begin
  if to_regprocedure('public.landing_publica_sin_cuenta(text)') is null then
    alter function public.landing_publica(text) rename to landing_publica_sin_cuenta;
  end if;
end $envolver$;
revoke execute on function public.landing_publica_sin_cuenta(text) from public, anon, authenticated;

create or replace function public.landing_publica(p_host text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb; v boolean;
begin
  r := public.landing_publica_sin_cuenta(p_host);
  if r is null or coalesce((r ->> 'publicada')::boolean, false) is not true then return r; end if;
  select coalesce(c.crear_cuenta_visible, true) into v from public.dominios_gimnasio d
    join public.configuracion_gimnasio c on c.gimnasio_id = d.gimnasio_id where d.host = lower(p_host);
  return r || jsonb_build_object('crear_cuenta', coalesce(v, true));
end $$;
revoke execute on function public.landing_publica(text) from public;
grant execute on function public.landing_publica(text) to anon, authenticated;

revoke all on function public.alta_online(text, uuid, jsonb, int, text), public.alta_publica(text) from public;
grant execute on function public.alta_online(text, uuid, jsonb, int, text), public.alta_publica(text) to anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'crear_cuenta_visible') then
    raise exception 'Verificación: falta crear_cuenta_visible';
  end if;
  if not has_function_privilege('anon', 'public.landing_publica(text)', 'execute') then raise exception 'Verificación: anon no puede leer la página'; end if;
  if has_function_privilege('anon', 'public.crear_cuenta_panel(uuid)', 'execute') or has_function_privilege('anon', 'public.guardar_crear_cuenta(uuid, boolean)', 'execute') then
    raise exception 'Verificación: anon puede ejecutar la llave de Crear mi cuenta';
  end if;
  if has_function_privilege('anon', 'public.landing_publica_sin_cuenta(text)', 'execute') then raise exception 'Verificación: anon ve la función interna'; end if;
end $$;
