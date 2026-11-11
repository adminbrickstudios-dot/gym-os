-- F7.1 · (1) TV con modo "entradas": ocupación como número y las últimas entradas (primer nombre e inicial, nunca el estado de pago).
--        (2) Ocupación en vivo para el socio (solo un número; la prende el dueño, por defecto apagada).
--        (3) "Congelar solo": el socio pide su pausa y se aprueba sola si el dueño lo prendió (por defecto apagada) y entra en el tope de días.
-- Parte de pg_get_functiondef de tv_estado, crear_tv, tvs_panel y pedir_pausa_socio vigentes. Firmas que cambian: la vieja se borra.

do $guarda$
begin
  if to_regclass('public.pantallas_tv') is null then raise exception 'Falta pantallas_tv'; end if;
  if to_regprocedure('privado.congelar(uuid,date,date,text,text,uuid,boolean)') is null then raise exception 'Falta privado.congelar'; end if;
  if to_regprocedure('privado.mis_socios()') is null then raise exception 'Falta privado.mis_socios'; end if;
  if to_regclass('public.salidas') is null then raise exception 'Falta salidas'; end if;
end $guarda$;

alter table public.pantallas_tv add column if not exists modo text not null default 'clases';
do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'pantallas_tv_modo_valido') then
    alter table public.pantallas_tv add constraint pantallas_tv_modo_valido check (modo in ('clases', 'entradas'));
  end if;
end $c$;

alter table public.configuracion_gimnasio add column if not exists pausa_autoaprobar boolean not null default false;
alter table public.configuracion_gimnasio add column if not exists pausa_auto_max_dias integer not null default 14;
alter table public.configuracion_gimnasio add column if not exists ocupacion_visible_socios boolean not null default false;
do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_pausa_auto_max_valido') then
    alter table public.configuracion_gimnasio add constraint configuracion_pausa_auto_max_valido check (pausa_auto_max_dias between 1 and 90);
  end if;
end $c$;
alter table public.pedidos_pausa add column if not exists autoaprobado boolean not null default false;

-- ── Ocupación: cuánta gente hay adentro ahora (entró en las últimas 3 h y no registró salida) ──
create or replace function privado.ocupacion_ahora(p_gimnasio_id uuid, p_sede_id uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(distinct i.socio_id)::int from public.ingresos i
   where i.gimnasio_id = p_gimnasio_id and (p_sede_id is null or i.sede_id = p_sede_id)
     and i.resultado in ('entro', 'entro_modo_aviso', 'forzado') and i.anulado_en is null and i.momento > now() - interval '3 hours'
     and not exists (select 1 from public.salidas s where s.ingreso_id = i.id and s.gimnasio_id = i.gimnasio_id)
$$;
revoke execute on function privado.ocupacion_ahora(uuid, uuid) from public, anon, authenticated;

create or replace function public.ocupacion_en_vivo(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_visible boolean; v_equipo boolean;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  v_equipo := exists (select 1 from public.equipo e where e.gimnasio_id = p_gimnasio_id and e.usuario_id = auth.uid() and e.activo);
  select c.ocupacion_visible_socios into v_visible from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  if not v_equipo then
    if not exists (select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.id in (select privado.mis_socios())) then
      raise exception 'Sin permiso' using errcode = '42501';
    end if;
    if not coalesce(v_visible, false) then return jsonb_build_object('visible', false); end if;
  end if;
  return jsonb_build_object('visible', true, 'personas', privado.ocupacion_ahora(p_gimnasio_id, null), 'actualizado', now());
end $$;
revoke execute on function public.ocupacion_en_vivo(uuid) from public, anon;
grant execute on function public.ocupacion_en_vivo(uuid) to authenticated;

-- ── Lo que los socios hacen solos: pausa automática y ocupación visible (solo el dueño) ──
create or replace function public.autonomia_socios_estado(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return (select jsonb_build_object('pausa_autoaprobar', c.pausa_autoaprobar, 'pausa_auto_max_dias', c.pausa_auto_max_dias,
                                    'pausa_dias_por_anio', c.pausa_dias_por_anio, 'ocupacion_visible_socios', c.ocupacion_visible_socios)
            from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id);
end $$;
revoke execute on function public.autonomia_socios_estado(uuid) from public, anon;
grant execute on function public.autonomia_socios_estado(uuid) to authenticated;

create or replace function public.guardar_autonomia_socios(p_gimnasio_id uuid, p_pausa_autoaprobar boolean, p_pausa_auto_max_dias integer, p_ocupacion_visible boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_pausa_auto_max_dias is null or p_pausa_auto_max_dias < 1 or p_pausa_auto_max_dias > 90 then
    raise exception 'El máximo de días para aprobar solo: de 1 a 90' using errcode = '22023';
  end if;
  update public.configuracion_gimnasio set pausa_autoaprobar = coalesce(p_pausa_autoaprobar, false), pausa_auto_max_dias = p_pausa_auto_max_dias,
         ocupacion_visible_socios = coalesce(p_ocupacion_visible, false) where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar' using errcode = 'P0002'; end if;
  return public.autonomia_socios_estado(p_gimnasio_id);
end $$;
revoke execute on function public.guardar_autonomia_socios(uuid, boolean, integer, boolean) from public, anon;
grant execute on function public.guardar_autonomia_socios(uuid, boolean, integer, boolean) to authenticated;

-- ── Congelar solo ────────────────────────────────────────────────────
-- Igual que la vigente; al final, si el dueño prendió la aprobación automática y la pausa entra en el tope, queda aprobada en el momento
-- (con las mismas reglas de siempre: validar_pausa ya corrió arriba: días por año, fechas, superposición).
create or replace function public.pedir_pausa_socio(p_socio_id uuid, p_desde date, p_hasta date, p_categoria text, p_nota text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare s public.suscripciones; zona text; d timestamptz; h timestamptz; pid uuid; v_nota text := nullif(trim(coalesce(p_nota, '')), '');
        v_auto boolean; v_max int; cid uuid; n int;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.suscripciones where socio_id = p_socio_id and baja_en is null;
  if not found then raise exception 'No tenés una membresía activa para pausar' using errcode = '22023'; end if;
  perform privado.validar_pausa(s.socio_id, s.gimnasio_id, p_desde, p_hasta, p_categoria);
  if length(v_nota) > 300 then raise exception 'La nota: hasta 300 letras.' using errcode = '22023'; end if;
  select zona_horaria into zona from public.gimnasios where id = s.gimnasio_id;
  if p_desde < privado.dia_local(now(), zona) then raise exception 'La pausa empieza hoy o más adelante.' using errcode = '22023'; end if;
  d := privado.medianoche(p_desde, zona); h := privado.medianoche(p_hasta, zona);
  if exists (select 1 from public.congelamientos c where c.suscripcion_id = s.id and c.anulado_en is null
              and c.desde < h and coalesce(c.hasta_real, c.hasta_prevista) > d) then
    raise exception 'Ya tenés una pausa en esas fechas.' using errcode = '22023';
  end if;
  if exists (select 1 from public.pedidos_pausa x where x.socio_id = s.socio_id and x.estado = 'pendiente' and x.desde < h and x.hasta > d) then
    raise exception 'Ya pediste una pausa en esas fechas: la está por ver el gimnasio.' using errcode = '22023';
  end if;
  insert into public.pedidos_pausa (gimnasio_id, socio_id, suscripcion_id, desde, hasta, categoria, nota, pedido_por)
  values (s.gimnasio_id, s.socio_id, s.id, d, h, p_categoria, v_nota, auth.uid()) returning id into pid;
  select c.pausa_autoaprobar, c.pausa_auto_max_dias into v_auto, v_max from public.configuracion_gimnasio c where c.gimnasio_id = s.gimnasio_id;
  if coalesce(v_auto, false) and (p_hasta - p_desde) <= coalesce(v_max, 14) then
    cid := privado.congelar(s.id, p_desde, p_hasta, p_categoria, v_nota, auth.uid(), true);
    update public.pedidos_pausa set estado = 'aprobado', resuelto_en = now(), resuelto_por = auth.uid(), congelamiento_id = cid, autoaprobado = true
     where id = pid and estado = 'pendiente';
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo aprobar la pausa.'; end if;
  end if;
  return pid;
end $$;
revoke execute on function public.pedir_pausa_socio(uuid, date, date, text, text) from public, anon;
grant execute on function public.pedir_pausa_socio(uuid, date, date, text, text) to authenticated;

-- ── TV: modo entradas ────────────────────────────────────────────────
drop function if exists public.crear_tv(uuid, uuid, text);
create or replace function public.crear_tv(p_gimnasio_id uuid, p_sede_id uuid, p_nombre text, p_modo text default 'clases') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; nom text := nullif(trim(coalesce(p_nombre, '')), ''); tok text; v_id uuid; v_modo text := coalesce(nullif(trim(p_modo), ''), 'clases');
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  if v_modo not in ('clases', 'entradas') then raise exception 'La TV muestra las clases o las entradas.' using errcode = '22023'; end if;
  if nom is null then raise exception 'Ponele un nombre a la TV (por ejemplo "Sala de spinning").' using errcode = '22023'; end if;
  if length(nom) > 40 then raise exception 'El nombre: hasta 40 letras.' using errcode = '22023'; end if;
  if not exists (select 1 from public.sedes s where s.id = p_sede_id and s.gimnasio_id = p_gimnasio_id) then
    raise exception 'Esa sede no es de este gimnasio.' using errcode = '22023';
  end if;
  if (select count(*) from public.pantallas_tv t where t.gimnasio_id = p_gimnasio_id and t.revocada_en is null) >= 10 then
    raise exception 'Hay 10 TVs: sacá alguna que no se use.' using errcode = '22023';
  end if;
  tok := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.pantallas_tv (gimnasio_id, sede_id, nombre, token_hash, creado_por, modo)
  values (p_gimnasio_id, p_sede_id, nom, encode(extensions.digest(tok, 'sha256'), 'hex'), e.id, v_modo)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'token', tok);
end $$;
revoke execute on function public.crear_tv(uuid, uuid, text, text) from public, anon;
grant execute on function public.crear_tv(uuid, uuid, text, text) to authenticated;

create or replace function public.tvs_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'nombre', t.nombre, 'sede', s.nombre, 'creado_en', t.creado_en, 'modo', t.modo) order by t.creado_en)
    from public.pantallas_tv t join public.sedes s on s.id = t.sede_id where t.gimnasio_id = p_gimnasio_id and t.revocada_en is null), '[]');
end $$;

create or replace function public.tv_estado(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t public.pantallas_tv; ahora public.clases; prox public.clases;
begin
  select * into t from public.pantallas_tv where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if t.id is null or t.revocada_en is not null then
    raise exception 'Esta TV no está autorizada. El dueño la autoriza desde Clases → TV de la sala.' using errcode = '42501';
  end if;
  select * into ahora from public.clases c
   where c.sede_id = t.sede_id and c.cancelada_en is null and c.fin > now() and c.inicio <= now() + interval '15 minutes'
   order by c.inicio limit 1;
  select * into prox from public.clases c
   where c.sede_id = t.sede_id and c.cancelada_en is null and c.inicio > coalesce(ahora.inicio, now()) and c.inicio < now() + interval '18 hours'
     and c.id is distinct from ahora.id
   order by c.inicio limit 1;
  return jsonb_build_object('tv', t.nombre, 'modo', t.modo,
    'gimnasio', (select g.nombre from public.gimnasios g where g.id = t.gimnasio_id),
    'sede', (select s.nombre from public.sedes s where s.id = t.sede_id),
    'zona', (select g.zona_horaria from public.gimnasios g where g.id = t.gimnasio_id),
    'ocupacion', privado.ocupacion_ahora(t.gimnasio_id, t.sede_id),
    'ahora', case when ahora.id is null then null else privado.clase_tv(ahora) end,
    'proxima', case when prox.id is null then null else privado.clase_tv(prox) - 'wod' end,
    -- Solo en el modo entradas: primer nombre e inicial y la hora. Nunca el color, el plan ni lo que debe.
    'entradas', case when t.modo <> 'entradas' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('nombre', trim(s.nombre || ' ' || coalesce(left(nullif(s.apellido, ''), 1) || '.', '')), 'momento', x.momento) order by x.momento desc)
        from (select i.socio_id, i.momento from public.ingresos i
               where i.gimnasio_id = t.gimnasio_id and i.sede_id = t.sede_id and i.resultado in ('entro', 'entro_modo_aviso', 'forzado') and i.anulado_en is null
                 and i.momento > now() - interval '12 hours'
               order by i.momento desc limit 8) x
        join public.socios s on s.id = x.socio_id), '[]'::jsonb) end);
end $$;

do $verif$
begin
  if to_regprocedure('public.crear_tv(uuid,uuid,text)') is not null then raise exception 'Quedó la firma vieja de crear_tv'; end if;
  if to_regprocedure('public.crear_tv(uuid,uuid,text,text)') is null then raise exception 'Falta crear_tv nueva'; end if;
  if not exists (select 1 from information_schema.columns where table_name = 'configuracion_gimnasio' and column_name = 'pausa_autoaprobar') then raise exception 'Falta pausa_autoaprobar'; end if;
  if to_regprocedure('public.ocupacion_en_vivo(uuid)') is null then raise exception 'Falta ocupacion_en_vivo'; end if;
end $verif$;
