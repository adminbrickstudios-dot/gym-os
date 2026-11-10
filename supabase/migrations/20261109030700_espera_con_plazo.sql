-- FA-23 · Lista de espera con plazo: el lugar que se libera se OFRECE al primero de la espera con un plazo para aceptarlo (configurable).
-- Si no lo acepta a tiempo, pasa al siguiente. Se calcula al consultar, sin cron: cada vez que alguien abre sus ofertas (o se libera otro
-- lugar) se vencen las que ya pasaron y se ofrece el lugar al que sigue.
--  · configuracion_gimnasio.espera_plazo_min: null = lo de siempre (el primero de la espera sube solo, sin aceptar nada). Con un número
--    de minutos (5 a 1440), el lugar se ofrece y espera ese tiempo.
--  · reservas.ofrecida_en / ofrecida_hasta / oferta_perdida: la oferta vigente y quién ya la dejó pasar para ese lugar.
--  · Una oferta vigente RESERVA el lugar: nadie más puede tomarlo mientras dura (privado.reservar la cuenta como ocupado).
--  · Aceptar confirma la reserva (misma habilitación de siempre: si ya no puede tomar la clase, se le dice); rechazar la pasa al siguiente.
-- Las funciones existentes (promover_espera, reservar) se parchan partiendo de su definición VIGENTE, con guarda: si el texto a cambiar
-- no está exactamente una vez, la migración falla en vez de pisar nada.

do $g$ begin
  if to_regprocedure('privado.promover_espera(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.promover_espera'; end if;
  if to_regprocedure('privado.reservar(uuid, uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.reservar'; end if;
  if to_regprocedure('privado.habilitacion_clase(uuid, uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta privado.habilitacion_clase'; end if;
  if to_regprocedure('privado.mis_socios()') is null then raise exception 'Guarda: falta privado.mis_socios'; end if;
end $g$;

alter table public.configuracion_gimnasio add column if not exists espera_plazo_min int check (espera_plazo_min is null or espera_plazo_min between 5 and 1440);
alter table public.reservas add column if not exists ofrecida_en timestamptz;
alter table public.reservas add column if not exists ofrecida_hasta timestamptz;
alter table public.reservas add column if not exists oferta_perdida boolean not null default false;
do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'reservas_oferta_coherente') then
    alter table public.reservas add constraint reservas_oferta_coherente check ((ofrecida_en is null) = (ofrecida_hasta is null));
  end if;
end $c$;
create index if not exists reservas_ofertas on public.reservas (clase_id) where ofrecida_hasta is not null;

-- ── Vencer las ofertas pasadas y ofrecer el lugar libre al que sigue ──
create or replace function privado.ofrecer_espera(p_clase_id uuid, p_momento timestamptz) returns uuid
language plpgsql set search_path = '' as $$
declare c public.clases; plazo int; libres int; r public.reservas; h jsonb; zona text; nombre_act text; v_hasta timestamptz; n int;
begin
  select * into c from public.clases where id = p_clase_id for update;
  if not found or c.cancelada_en is not null or c.inicio <= p_momento then return null; end if;
  select espera_plazo_min into plazo from public.configuracion_gimnasio where gimnasio_id = c.gimnasio_id;
  if plazo is null then return null; end if;
  -- Las ofertas que ya pasaron: quien no aceptó a tiempo deja pasar ese lugar (sigue en la espera, pero no se le vuelve a ofrecer).
  update public.reservas set oferta_perdida = true, ofrecida_en = null, ofrecida_hasta = null
   where clase_id = c.id and estado = 'espera' and ofrecida_hasta is not null and ofrecida_hasta <= p_momento;
  if c.cupo is null then return null; end if;
  libres := c.cupo - (select count(*) from public.reservas where clase_id = c.id and (estado = 'confirmada' or (estado = 'espera' and ofrecida_hasta is not null)));
  if libres <= 0 then return null; end if;
  for r in select * from public.reservas where clase_id = c.id and estado = 'espera' and ofrecida_hasta is null and not oferta_perdida order by creado_en for update loop
    h := privado.habilitacion_clase(r.socio_id, c.id, p_momento, r.id);
    continue when not (h ->> 'ok')::boolean;
    v_hasta := least(p_momento + make_interval(mins => plazo), c.inicio);
    update public.reservas set ofrecida_en = p_momento, ofrecida_hasta = v_hasta where id = r.id and estado = 'espera';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo ofrecer el lugar'; end if;
    select g.zona_horaria into zona from public.gimnasios g where g.id = c.gimnasio_id;
    select nombre into nombre_act from public.actividades where id = c.actividad_id;
    insert into public.avisos_pendientes (gimnasio_id, socio_id, tipo, clase_id, texto)
    values (c.gimnasio_id, r.socio_id, 'lugar_liberado', c.id,
            'Se liberó un lugar en ' || nombre_act || ' del ' || privado.fecha_corta(c.inicio, zona) || ' a las ' || to_char(c.inicio at time zone zona, 'HH24:MI')
            || ': tenés hasta las ' || to_char(v_hasta at time zone zona, 'HH24:MI') || ' para aceptarlo.');
    return r.id;
  end loop;
  return null;
end $$;
revoke all on function privado.ofrecer_espera(uuid, timestamptz) from public, anon, authenticated;

-- ── Parches a lo vigente ────────────────────────────────────────────
do $p$
declare
  parches jsonb := jsonb_build_array(
    jsonb_build_object('f', 'privado.promover_espera(uuid, timestamptz)',
      'de', $a$  for r in select * from public.reservas where clase_id = c.id and estado = 'espera' order by creado_en for update loop$a$,
      'a',  $a$  if (select espera_plazo_min from public.configuracion_gimnasio where gimnasio_id = c.gimnasio_id) is not null then return privado.ofrecer_espera(c.id, p_momento); end if;
  for r in select * from public.reservas where clase_id = c.id and estado = 'espera' order by creado_en for update loop$a$),
    jsonb_build_object('f', 'privado.reservar(uuid, uuid, timestamptz)',
      'de', $a$select count(*) into confirmadas from public.reservas where clase_id = c.id and estado = 'confirmada';$a$,
      'a',  $a$select count(*) into confirmadas from public.reservas where clase_id = c.id and (estado = 'confirmada' or (estado = 'espera' and ofrecida_hasta is not null and ofrecida_hasta > p_momento));$a$));
  x jsonb; def text; veces int;
begin
  for x in select * from jsonb_array_elements(parches) loop
    def := pg_get_functiondef((x ->> 'f')::regprocedure);
    veces := (length(def) - length(replace(def, x ->> 'de', ''))) / greatest(length(x ->> 'de'), 1);
    if veces <> 1 then raise exception 'FA-23: en % el texto a cambiar aparece % veces (tiene que ser 1); la función cambió y hay que revisar este parche', x ->> 'f', veces; end if;
    execute replace(def, x ->> 'de', x ->> 'a');
  end loop;
end $p$;

-- La promoción vigente chequea el cupo contando solo las confirmadas; con plazo, ofrecer_espera cuenta también las ofertas (arriba).

-- ── Lo que ve y hace el socio ───────────────────────────────────────
-- Las ofertas vigentes del socio (antes, se vencen las que pasaron y se ofrece a quien sigue en las clases donde él espera).
create or replace function public.ofertas_socio(p_socio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k record; g uuid;
begin
  if not exists (select 1 from public.socios s where s.id = p_socio_id and s.id in (select privado.mis_socios())) then
    raise exception 'Sin permiso o socio inexistente' using errcode = '42501';
  end if;
  for k in select distinct r.clase_id from public.reservas r join public.clases c on c.id = r.clase_id
            where r.socio_id = p_socio_id and r.estado = 'espera' and c.inicio > now() and c.cancelada_en is null loop
    perform privado.ofrecer_espera(k.clase_id, now());
  end loop;
  return coalesce((
    select jsonb_agg(jsonb_build_object('reserva_id', r.id, 'clase_id', c.id, 'actividad', a.nombre, 'inicio', c.inicio, 'hasta', r.ofrecida_hasta) order by r.ofrecida_hasta)
      from public.reservas r join public.clases c on c.id = r.clase_id join public.actividades a on a.id = c.actividad_id
     where r.socio_id = p_socio_id and r.estado = 'espera' and r.ofrecida_hasta is not null and r.ofrecida_hasta > now()), '[]'::jsonb);
end $$;

create or replace function public.aceptar_oferta(p_reserva_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reservas; c public.clases; h jsonb; n int;
begin
  select * into r from public.reservas where id = p_reserva_id for update;
  if not found or not exists (select 1 from public.socios s where s.id = r.socio_id and s.id in (select privado.mis_socios())) then
    raise exception 'Sin permiso o reserva inexistente' using errcode = '42501';
  end if;
  select * into c from public.clases where id = r.clase_id for update;
  if r.estado <> 'espera' or r.ofrecida_hasta is null then raise exception 'No tenés un lugar ofrecido en esta clase.' using errcode = '22023'; end if;
  if r.ofrecida_hasta <= now() then
    perform privado.ofrecer_espera(c.id, now());
    raise exception 'El plazo para aceptar el lugar ya pasó. Seguís en la lista de espera.' using errcode = '22023';
  end if;
  if c.cancelada_en is not null or c.inicio <= now() then raise exception 'La clase ya no está disponible.' using errcode = '22023'; end if;
  h := privado.habilitacion_clase(r.socio_id, c.id, now(), r.id);
  if not (h ->> 'ok')::boolean then raise exception 'No podés tomar esta clase: %', h ->> 'texto' using errcode = '22023'; end if;
  update public.reservas set estado = 'confirmada', promovida_en = now(), pack_id = (h ->> 'pack_id')::uuid, ofrecida_en = null, ofrecida_hasta = null
   where id = r.id and estado = 'espera';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo confirmar la reserva'; end if;
end $$;

create or replace function public.rechazar_oferta(p_reserva_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reservas; n int;
begin
  select * into r from public.reservas where id = p_reserva_id for update;
  if not found or not exists (select 1 from public.socios s where s.id = r.socio_id and s.id in (select privado.mis_socios())) then
    raise exception 'Sin permiso o reserva inexistente' using errcode = '42501';
  end if;
  if r.estado <> 'espera' or r.ofrecida_hasta is null then raise exception 'No tenés un lugar ofrecido en esta clase.' using errcode = '22023'; end if;
  update public.reservas set oferta_perdida = true, ofrecida_en = null, ofrecida_hasta = null where id = r.id and estado = 'espera';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo rechazar la oferta'; end if;
  perform privado.ofrecer_espera(r.clase_id, now());
end $$;

-- ── Lo que configura el dueño ───────────────────────────────────────
create or replace function public.guardar_espera_plazo(p_gimnasio_id uuid, p_minutos int) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_minutos is not null and (p_minutos < 5 or p_minutos > 1440) then raise exception 'El plazo va de 5 minutos a 24 horas (o sin plazo: el lugar sube solo).' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set espera_plazo_min = p_minutos where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la configuración'; end if;
end $$;

revoke all on function public.ofertas_socio(uuid), public.aceptar_oferta(uuid), public.rechazar_oferta(uuid), public.guardar_espera_plazo(uuid, int) from public, anon, authenticated;
grant execute on function public.ofertas_socio(uuid), public.aceptar_oferta(uuid), public.rechazar_oferta(uuid), public.guardar_espera_plazo(uuid, int) to authenticated, service_role;

do $v$
declare f text;
begin
  foreach f in array array['privado.ofrecer_espera(uuid, timestamptz)', 'public.ofertas_socio(uuid)', 'public.aceptar_oferta(uuid)', 'public.rechazar_oferta(uuid)', 'public.guardar_espera_plazo(uuid, integer)',
                           'privado.promover_espera(uuid, timestamptz)', 'privado.reservar(uuid, uuid, timestamptz)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if f not like 'public.%' and has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if pg_get_functiondef('privado.promover_espera(uuid, timestamptz)'::regprocedure) not like '%ofrecer_espera%' then raise exception 'FA-23: promover_espera no ofrece'; end if;
  if pg_get_functiondef('privado.reservar(uuid, uuid, timestamptz)'::regprocedure) not like '%ofrecida_hasta%' then raise exception 'FA-23: reservar no cuenta las ofertas'; end if;
end $v$;
