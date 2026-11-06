-- VD-46C · Cortesías y descuentos con motivo de una lista y tope BAJO por defecto (docs/v2/14-SITUACIONES.md, casos 11, 22, 23).
-- Las coberturas con origen 'cortesia' existían en la tabla pero ninguna función las creaba. Ahora:
--   motivos_beneficio            la lista de motivos del gimnasio (datos: el dueño la edita). Sirve para las cortesías y para el
--                                motivo del descuento de Cobrar (la pantalla lo elige de la lista, ya no es texto libre)
--   dar_cortesia(socio, días, motivo, nota)   dueño, encargado, recepción. Tope por rol, por cortesía y por mes. Queda quién, cuándo y por qué
--   anular_cortesia(cobertura, motivo)        dueño o encargado (un hecho nuevo; la cobertura queda anulada con quién y por qué)
--   cortesias_socio(socio)       para la ficha: qué puede dar quien mira, cuánto le queda del mes, las últimas cortesías
--   beneficios_mes(gimnasio)     para Control: total de descuentos y de cortesías del mes, por persona, y los topes vigentes
--   guardar_topes_beneficios(...) / guardar_motivo_beneficio(...)   solo el dueño
-- Topes por defecto (BAJOS, el dueño los sube): recepción 1 día por cortesía y 5 días por mes; encargado 7 por cortesía y 30 por mes;
-- el dueño hasta 31 por cortesía, sin tope por mes. Alerta en la campana cuando un socio recibe 2 cortesías en 60 días.
-- Se suman a lo que ya había: moderacion_control (cortesías) y privado.avisos_moderacion (repetidas), copias de las de 7200.
-- No se toca vender: una cortesía no es una venta, es una cobertura con motivo.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.suspender_socio(uuid, text, text, date, date)') is null then raise exception 'Guarda: falta VD-46B (7200)'; end if;
  if to_regprocedure('privado.avisos_moderacion(uuid, text)') is null then raise exception 'Guarda: falta privado.avisos_moderacion (7200)'; end if;
  if to_regprocedure('public.moderacion_control(uuid, date, date, int)') is null then raise exception 'Guarda: falta moderacion_control (7200)'; end if;
  if to_regprocedure('privado.exigir_rol(uuid, text[], uuid)') is null then raise exception 'Guarda: falta privado.exigir_rol'; end if;
  if to_regprocedure('privado.calcular_acceso(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta calcular_acceso'; end if;
  if to_regclass('public.coberturas') is null then raise exception 'Guarda: falta coberturas'; end if;
end $$;

-- ── Los topes: datos del gimnasio ───────────────────────────────────
alter table public.configuracion_gimnasio add column if not exists cortesia_max_dias_recepcion int not null default 1 check (cortesia_max_dias_recepcion between 0 and 31);
alter table public.configuracion_gimnasio add column if not exists cortesia_max_dias_encargado int not null default 7 check (cortesia_max_dias_encargado between 0 and 31);
alter table public.configuracion_gimnasio add column if not exists cortesia_dias_mes_recepcion int not null default 5 check (cortesia_dias_mes_recepcion between 0 and 300);
alter table public.configuracion_gimnasio add column if not exists cortesia_dias_mes_encargado int not null default 30 check (cortesia_dias_mes_encargado between 0 and 300);
alter table public.configuracion_gimnasio add column if not exists cortesia_alerta_repetidas int not null default 2 check (cortesia_alerta_repetidas between 2 and 10);

-- ── La lista de motivos ─────────────────────────────────────────────
create table if not exists public.motivos_beneficio (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  nombre       text not null check (length(trim(nombre)) between 3 and 60),
  activo       boolean not null default true,
  creado_en    timestamptz not null default now(),
  creado_por   uuid references auth.users(id),
  unique (gimnasio_id, id)
);
create unique index if not exists motivos_beneficio_nombre on public.motivos_beneficio (gimnasio_id, lower(trim(nombre)));
select privado.politicas_estandar('public.motivos_beneficio', array['dueno', 'encargado', 'recepcion'], '{}');
revoke all on table public.motivos_beneficio from anon;
revoke truncate, references, trigger on public.motivos_beneficio from authenticated;

-- Los de siempre, para cada gimnasio (y para los que nazcan). Son datos: el dueño los cambia.
create or replace function privado.sembrar_motivos_beneficio(p_gimnasio_id uuid) returns void
language plpgsql set search_path = '' as $$
begin
  insert into public.motivos_beneficio (gimnasio_id, nombre)
  select p_gimnasio_id, m from unnest(array['Amigo o familiar del gimnasio', 'Compensación por un problema', 'Probar el gimnasio',
                                            'Promoción o campaña', 'Convenio o canje', 'Staff o profe']) m
  on conflict do nothing;
end $$;
revoke all on function privado.sembrar_motivos_beneficio(uuid) from public;

create or replace function privado.al_crear_gimnasio_motivos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.sembrar_motivos_beneficio(new.id);
  return new;
end $$;
revoke all on function privado.al_crear_gimnasio_motivos() from public;
drop trigger if exists gimnasios_motivos_beneficio on public.gimnasios;
create trigger gimnasios_motivos_beneficio after insert on public.gimnasios
  for each row execute function privado.al_crear_gimnasio_motivos();

do $$
declare g uuid;
begin
  for g in select id from public.gimnasios loop perform privado.sembrar_motivos_beneficio(g); end loop;
end $$;

create or replace function public.motivos_beneficio_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nombre', m.nombre, 'activo', m.activo) order by m.nombre)
                     from public.motivos_beneficio m
                    where m.gimnasio_id = p_gimnasio_id and (m.activo or e.rol in ('dueno', 'encargado'))), '[]'::jsonb);
end $$;

-- Agregar (p_id null), renombrar o apagar un motivo. Apagar no borra: las cortesías viejas siguen diciendo su motivo.
create or replace function public.guardar_motivo_beneficio(p_gimnasio_id uuid, p_id uuid, p_nombre text, p_activo boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_nombre text := trim(coalesce(p_nombre, '')); mid uuid := p_id; n int;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno']);
  if length(v_nombre) < 3 or length(v_nombre) > 60 then raise exception 'El motivo tiene de 3 a 60 letras.' using errcode = '22023'; end if;
  if p_id is null then
    if exists (select 1 from public.motivos_beneficio m where m.gimnasio_id = p_gimnasio_id and lower(trim(m.nombre)) = lower(v_nombre)) then
      raise exception 'Ya hay un motivo con ese nombre.' using errcode = '22023';
    end if;
    insert into public.motivos_beneficio (gimnasio_id, nombre, activo, creado_por) values (p_gimnasio_id, v_nombre, coalesce(p_activo, true), auth.uid()) returning id into mid;
    return mid;
  end if;
  if exists (select 1 from public.motivos_beneficio m where m.gimnasio_id = p_gimnasio_id and m.id <> p_id and lower(trim(m.nombre)) = lower(v_nombre)) then
    raise exception 'Ya hay un motivo con ese nombre.' using errcode = '22023';
  end if;
  update public.motivos_beneficio set nombre = v_nombre, activo = coalesce(p_activo, true) where id = p_id and gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Sin permiso o motivo inexistente' using errcode = '42501'; end if;
  if not exists (select 1 from public.motivos_beneficio m where m.gimnasio_id = p_gimnasio_id and m.activo) then
    raise exception 'Tiene que quedar al menos un motivo prendido.' using errcode = '22023';
  end if;
  return mid;
end $$;

create or replace function public.guardar_topes_beneficios(
  p_gimnasio_id uuid, p_max_dias_recepcion int, p_max_dias_encargado int, p_dias_mes_recepcion int, p_dias_mes_encargado int, p_alerta_repetidas int
) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno']);
  if p_max_dias_recepcion is null or p_max_dias_recepcion not between 0 and 31 or p_max_dias_encargado is null or p_max_dias_encargado not between 0 and 31 then
    raise exception 'Los días por cortesía van de 0 a 31.' using errcode = '22023';
  end if;
  if p_dias_mes_recepcion is null or p_dias_mes_recepcion not between 0 and 300 or p_dias_mes_encargado is null or p_dias_mes_encargado not between 0 and 300 then
    raise exception 'Los días por mes van de 0 a 300.' using errcode = '22023';
  end if;
  if p_alerta_repetidas is null or p_alerta_repetidas not between 2 and 10 then raise exception 'La alerta de repetidas va de 2 a 10 cortesías.' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set cortesia_max_dias_recepcion = p_max_dias_recepcion, cortesia_max_dias_encargado = p_max_dias_encargado,
         cortesia_dias_mes_recepcion = p_dias_mes_recepcion, cortesia_dias_mes_encargado = p_dias_mes_encargado,
         cortesia_alerta_repetidas = p_alerta_repetidas, actualizado_en = now()
   where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudieron guardar los topes'; end if;
end $$;

-- ── Dar una cortesía ────────────────────────────────────────────────
-- La cortesía es una cobertura: empieza hoy (o cuando termina lo que ya tiene cubierto) y dura los días que se den.
-- Nunca se da sin motivo de la lista, ni a un suspendido, ni más allá del tope de quien la da.
create or replace function public.dar_cortesia(p_socio_id uuid, p_dias int, p_motivo_id uuid, p_nota text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  so public.socios; sus public.suscripciones; eid uuid; e public.equipo; cfg public.configuracion_gimnasio; mot public.motivos_beneficio;
  zona text; hoy date; ini_mes timestamptz; fin_mes timestamptz; futuro timestamptz; v_desde timestamptz; v_hasta timestamptz;
  tope_dia int; tope_mes int; usados int; v_nota text := nullif(trim(coalesce(p_nota, '')), ''); cid uuid; txt text;
begin
  select * into so from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(so.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select * into e from public.equipo where id = eid;
  if p_dias is null or p_dias < 1 or p_dias > 31 then raise exception 'Una cortesía es de 1 a 31 días.' using errcode = '22023'; end if;
  select * into mot from public.motivos_beneficio where id = p_motivo_id and gimnasio_id = so.gimnasio_id and activo;
  if not found then raise exception 'Elegí el motivo de la lista.' using errcode = '22023'; end if;
  if length(v_nota) > 200 then raise exception 'La nota: hasta 200 letras.' using errcode = '22023'; end if;
  if so.dado_de_baja_en is not null then raise exception 'Está dado de baja: primero hay que volver a darlo de alta.' using errcode = '22023'; end if;
  if (privado.bloqueo_persona(p_socio_id, now())).color is not null then raise exception 'Está suspendido: no se le dan cortesías hasta que se levante.' using errcode = '22023'; end if;
  select * into sus from public.suscripciones where socio_id = so.id and baja_en is null for update;
  if not found then raise exception 'No tiene una membresía a la que darle la cortesía: asignale un plan primero.' using errcode = '22023'; end if;

  select * into cfg from public.configuracion_gimnasio where gimnasio_id = so.gimnasio_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = so.gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  tope_dia := case e.rol when 'recepcion' then cfg.cortesia_max_dias_recepcion when 'encargado' then cfg.cortesia_max_dias_encargado else 31 end;
  tope_mes := case e.rol when 'recepcion' then cfg.cortesia_dias_mes_recepcion when 'encargado' then cfg.cortesia_dias_mes_encargado else null end;
  if tope_dia = 0 then raise exception 'Tu rol no da cortesías: pedíselo al encargado o al dueño.' using errcode = '42501'; end if;
  if p_dias > tope_dia then
    raise exception 'Podés dar hasta % % por cortesía: para más, pedíselo al % o al dueño.', tope_dia, case when tope_dia = 1 then 'día' else 'días' end,
      case when e.rol = 'recepcion' then 'encargado' else 'dueño' end using errcode = '42501';
  end if;
  if tope_mes is not null then
    ini_mes := privado.medianoche(date_trunc('month', hoy)::date, zona);
    fin_mes := privado.medianoche((date_trunc('month', hoy) + interval '1 month')::date, zona);
    select coalesce(sum(round(extract(epoch from (c.hasta - c.desde)) / 86400))::int, 0) into usados
      from public.coberturas c
     where c.gimnasio_id = so.gimnasio_id and c.origen = 'cortesia' and c.anulada_en is null and c.creado_por = auth.uid()
       and c.creado_en >= ini_mes and c.creado_en < fin_mes;
    if usados + p_dias > tope_mes then
      raise exception 'Este mes ya diste % % de cortesía y tu tope es %: con estos % pasarías.', usados, case when usados = 1 then 'día' else 'días' end, tope_mes, p_dias
        using errcode = '42501';
    end if;
  end if;

  select max(c.hasta) into futuro from public.coberturas c
   where c.suscripcion_id = sus.id and c.anulada_en is null and c.origen <> 'compensacion' and c.hasta > now();
  v_desde := coalesce(futuro, privado.medianoche(hoy, zona));
  v_hasta := privado.medianoche(privado.dia_local(v_desde, zona) + p_dias, zona);
  txt := mot.nombre || coalesce(': ' || v_nota, '');
  insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo, creado_por)
  values (so.gimnasio_id, sus.id, so.id, v_desde, v_hasta, 'cortesia', txt, auth.uid()) returning id into cid;
  return jsonb_build_object('cobertura_id', cid, 'desde', v_desde, 'hasta', v_hasta, 'dias', p_dias,
    'veredicto', to_jsonb(privado.calcular_acceso(so.id, now(), null)));
end $$;

create or replace function public.anular_cortesia(p_cobertura_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.coberturas; v_motivo text := trim(coalesce(p_motivo, '')); n int;
begin
  select * into c from public.coberturas where id = p_cobertura_id and origen = 'cortesia' for update;
  if not found then raise exception 'Sin permiso o cortesía inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(c.gimnasio_id, array['dueno', 'encargado']);
  if length(v_motivo) < 3 then raise exception 'Escribí por qué se anula: queda anotado con tu nombre.' using errcode = '22023'; end if;
  if c.anulada_en is not null then raise exception 'Esa cortesía ya estaba anulada.' using errcode = '22023'; end if;
  update public.coberturas set anulada_en = now(), anulada_por = auth.uid(), anulada_motivo = left(v_motivo, 300)
   where id = c.id and anulada_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo anular la cortesía'; end if;
end $$;

-- ── Para la ficha ───────────────────────────────────────────────────
create or replace function public.cortesias_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  so public.socios; e public.equipo; cfg public.configuracion_gimnasio; zona text; hoy date; ini_mes timestamptz; fin_mes timestamptz;
  tope_dia int; tope_mes int; usados int := 0; tiene boolean; recientes int;
begin
  select * into so from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(so.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select * into cfg from public.configuracion_gimnasio where gimnasio_id = so.gimnasio_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = so.gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  tope_dia := case e.rol when 'recepcion' then cfg.cortesia_max_dias_recepcion when 'encargado' then cfg.cortesia_max_dias_encargado else 31 end;
  tope_mes := case e.rol when 'recepcion' then cfg.cortesia_dias_mes_recepcion when 'encargado' then cfg.cortesia_dias_mes_encargado else null end;
  if tope_mes is not null then
    ini_mes := privado.medianoche(date_trunc('month', hoy)::date, zona);
    fin_mes := privado.medianoche((date_trunc('month', hoy) + interval '1 month')::date, zona);
    select coalesce(sum(round(extract(epoch from (c.hasta - c.desde)) / 86400))::int, 0) into usados
      from public.coberturas c
     where c.gimnasio_id = so.gimnasio_id and c.origen = 'cortesia' and c.anulada_en is null and c.creado_por = auth.uid()
       and c.creado_en >= ini_mes and c.creado_en < fin_mes;
  end if;
  tiene := exists (select 1 from public.suscripciones s where s.socio_id = so.id and s.baja_en is null);
  select count(*)::int into recientes from public.coberturas c
   where c.socio_id = so.id and c.origen = 'cortesia' and c.anulada_en is null and c.creado_en > now() - interval '60 days';
  return jsonb_build_object(
    'rol', e.rol, 'tiene_membresia', tiene, 'tope_dias', tope_dia, 'tope_mes', tope_mes, 'usados_mes', usados,
    'puede_dar', tope_dia > 0 and tiene and so.dado_de_baja_en is null and (tope_mes is null or usados < tope_mes),
    'puede_anular', e.rol in ('dueno', 'encargado'), 'recientes_60_dias', recientes, 'alerta_desde', cfg.cortesia_alerta_repetidas,
    'motivos', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nombre', m.nombre) order by m.nombre)
                           from public.motivos_beneficio m where m.gimnasio_id = so.gimnasio_id and m.activo), '[]'::jsonb),
    'cortesias', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'desde', x.desde, 'hasta', x.hasta,
                   'dias', round(extract(epoch from (x.hasta - x.desde)) / 86400)::int, 'motivo', x.motivo, 'por', x.por,
                   'en', x.creado_en, 'anulada', x.anulada_en is not null, 'anulada_motivo', x.anulada_motivo) order by x.creado_en desc)
                  from (select c.*, q.nombre as por from public.coberturas c
                          left join public.equipo q on q.gimnasio_id = c.gimnasio_id and q.usuario_id = c.creado_por
                         where c.socio_id = so.id and c.origen = 'cortesia' order by c.creado_en desc limit 5) x), '[]'::jsonb));
end $$;

-- ── Para Control: los descuentos y las cortesías del mes ────────────
create or replace function public.beneficios_mes(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; cfg public.configuracion_gimnasio; zona text; hoy date; ini timestamptz; fin timestamptz; desc_total numeric; desc_n int; cort_dias int; cort_n int; personas jsonb;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  perform privado.exigir_resultado(p_gimnasio_id);
  select * into cfg from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  ini := privado.medianoche(date_trunc('month', hoy)::date, zona);
  fin := privado.medianoche((date_trunc('month', hoy) + interval '1 month')::date, zona);

  select coalesce(sum(i.descuento), 0), count(*)::int into desc_total, desc_n
    from public.venta_items i join public.ventas v on v.id = i.venta_id
   where v.gimnasio_id = p_gimnasio_id and i.gimnasio_id = p_gimnasio_id and i.descuento > 0 and v.estado = 'confirmada'
     and v.confirmada_en >= ini and v.confirmada_en < fin;
  select coalesce(sum(round(extract(epoch from (c.hasta - c.desde)) / 86400))::int, 0), count(*)::int into cort_dias, cort_n
    from public.coberturas c
   where c.gimnasio_id = p_gimnasio_id and c.origen = 'cortesia' and c.anulada_en is null and c.creado_en >= ini and c.creado_en < fin;

  select coalesce(jsonb_agg(jsonb_build_object('nombre', p.nombre, 'rol', p.rol, 'descuentos', p.descuentos, 'cortesias_dias', p.cortesias_dias) order by p.descuentos desc, p.cortesias_dias desc), '[]'::jsonb)
    into personas
    from (
      select q.nombre, q.rol,
             coalesce((select sum(i.descuento) from public.venta_items i join public.ventas v on v.id = i.venta_id
                        where v.gimnasio_id = p_gimnasio_id and i.gimnasio_id = p_gimnasio_id and i.descuento > 0 and v.estado = 'confirmada'
                          and v.creado_por = q.id and v.confirmada_en >= ini and v.confirmada_en < fin), 0) as descuentos,
             coalesce((select sum(round(extract(epoch from (c.hasta - c.desde)) / 86400))::int from public.coberturas c
                        where c.gimnasio_id = p_gimnasio_id and c.origen = 'cortesia' and c.anulada_en is null and c.creado_por = q.usuario_id
                          and c.creado_en >= ini and c.creado_en < fin), 0) as cortesias_dias
        from public.equipo q where q.gimnasio_id = p_gimnasio_id
    ) p where p.descuentos > 0 or p.cortesias_dias > 0;

  return jsonb_build_object(
    'mes', to_char(hoy, 'YYYY-MM'), 'descuentos_total', desc_total, 'descuentos_cantidad', desc_n, 'cortesias_dias', cort_dias, 'cortesias_cantidad', cort_n,
    'por_persona', personas, 'puede_editar', e.rol = 'dueno',
    'topes', jsonb_build_object('max_dias_recepcion', cfg.cortesia_max_dias_recepcion, 'max_dias_encargado', cfg.cortesia_max_dias_encargado,
                                'dias_mes_recepcion', cfg.cortesia_dias_mes_recepcion, 'dias_mes_encargado', cfg.cortesia_dias_mes_encargado,
                                'alerta_repetidas', cfg.cortesia_alerta_repetidas, 'descuento_max_recepcion', cfg.descuento_max_recepcion),
    'motivos', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nombre', m.nombre, 'activo', m.activo) order by m.nombre)
                           from public.motivos_beneficio m where m.gimnasio_id = p_gimnasio_id), '[]'::jsonb));
end $$;

-- ── moderacion_control: copia de 7200 + las cortesías ──
create or replace function public.moderacion_control(p_gimnasio_id uuid, p_desde date, p_hasta date, p_limite int default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; ini timestamptz; fin timestamptz; lim int := coalesce(p_limite, 50); filas jsonb;
begin
  perform privado.exigir_resultado(p_gimnasio_id);
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'Elegí desde y hasta qué día.' using errcode = '22023'; end if;
  if p_hasta - p_desde > 366 then raise exception 'Se mira hasta un año por vez.' using errcode = '22023'; end if;
  if lim < 1 or lim > 200 then raise exception 'Se piden de 1 a 200 por vez.' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  ini := privado.medianoche(p_desde, zona);
  fin := privado.medianoche(p_hasta + 1, zona);
  select coalesce(jsonb_agg(jsonb_build_object('tipo', u.tipo, 'clave', u.clave, 'en', u.en, 'quien', u.quien, 'socio_id', u.socio_id,
           'socio', nullif(trim(s.nombre || ' ' || s.apellido), ''), 'monto', u.monto, 'detalle', u.detalle) order by u.en desc, u.clave desc), '[]'::jsonb)
    into filas
    from (
      select * from (
        (select x.tipo::text as tipo, x.creado_en as en, 'susp:' || x.id::text as clave, q.nombre::text as quien, x.socio_id,
                null::numeric as monto,
                (x.motivo || case when x.hasta is not null then ' · hasta el ' || to_char(x.hasta at time zone zona, 'DD/MM') else '' end)::text as detalle
           from public.suspensiones x left join public.equipo q on q.gimnasio_id = x.gimnasio_id and q.usuario_id = x.creado_por
          where x.gimnasio_id = p_gimnasio_id and x.creado_en >= ini and x.creado_en < fin
          order by x.creado_en desc limit lim)
        union all
        (select 'levantamiento'::text, x.levantada_en, 'levanta:' || x.id::text, q.nombre::text, x.socio_id, null::numeric,
                (coalesce(x.levantada_motivo, '') || ' (era: ' || x.motivo || ')')::text
           from public.suspensiones x left join public.equipo q on q.gimnasio_id = x.gimnasio_id and q.usuario_id = x.levantada_por
          where x.gimnasio_id = p_gimnasio_id and x.levantada_en >= ini and x.levantada_en < fin
          order by x.levantada_en desc limit lim)
        union all
        -- VD-46C: cortesías (las anuladas también: anular es un hecho nuevo)
        (select 'cortesia'::text, c.creado_en, 'cortesia:' || c.id::text, q.nombre::text, c.socio_id, null::numeric,
                (round(extract(epoch from (c.hasta - c.desde)) / 86400)::int || case when round(extract(epoch from (c.hasta - c.desde)) / 86400)::int = 1 then ' día' else ' días' end
                 || ' · ' || coalesce(c.motivo, '') || case when c.anulada_en is not null then ' · ANULADA: ' || coalesce(c.anulada_motivo, '') else '' end)::text
           from public.coberturas c left join public.equipo q on q.gimnasio_id = c.gimnasio_id and q.usuario_id = c.creado_por
          where c.gimnasio_id = p_gimnasio_id and c.origen = 'cortesia' and c.creado_en >= ini and c.creado_en < fin
          order by c.creado_en desc limit lim)
      ) b order by b.en desc, b.clave desc limit lim
    ) u left join public.socios s on s.id = u.socio_id;
  return jsonb_build_object('items', filas);
end $$;

-- ── avisos_moderacion: copia de 7200 + cortesías repetidas ──
create or replace function privado.avisos_moderacion(p_gimnasio_id uuid, p_zona text) returns jsonb
language plpgsql stable set search_path = '' as $$
declare items jsonb := '[]'::jsonb; alerta int;
begin
  select cortesia_alerta_repetidas into alerta from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  -- Suspensiones y expulsiones cuya fecha de revisión ya llegó: alguien tiene que decidir si siguen.
  items := items || coalesce((select jsonb_agg(jsonb_build_object(
             'clave', 'revisar_suspension:' || x.id::text || ':' || to_char(x.revisar_en at time zone p_zona, 'YYYYMMDD'), 'emoji', '🚫',
             'titulo', 'Revisar ' || case when x.tipo = 'expulsion' then 'la expulsión' else 'la suspensión' end || ' de ' || trim(s.nombre || ' ' || s.apellido),
             'detalle', x.motivo, 'href', '/socios/' || s.id, 'en', x.revisar_en))
           from public.suspensiones x join public.socios s on s.id = x.socio_id
          where x.gimnasio_id = p_gimnasio_id and x.levantada_en is null and (x.hasta is null or x.hasta > now())
            and x.revisar_en is not null and x.revisar_en <= now()), '[]'::jsonb);
  -- VD-46C: un socio con varias cortesías en poco tiempo (la clave cambia con la cantidad: si recibe otra, vuelve a avisar).
  items := items || coalesce((select jsonb_agg(jsonb_build_object(
             'clave', 'cortesias_repetidas:' || r.socio_id::text || ':' || r.n, 'emoji', '🎁',
             'titulo', trim(s.nombre || ' ' || s.apellido) || ' recibió ' || r.n || ' cortesías en 60 días',
             'detalle', 'Las dieron: ' || r.quienes, 'href', '/socios/' || s.id, 'en', r.ultima))
           from (select c.socio_id, count(*)::int as n, max(c.creado_en) as ultima, string_agg(distinct coalesce(q.nombre, 'alguien'), ', ') as quienes
                   from public.coberturas c left join public.equipo q on q.gimnasio_id = c.gimnasio_id and q.usuario_id = c.creado_por
                  where c.gimnasio_id = p_gimnasio_id and c.origen = 'cortesia' and c.anulada_en is null and c.creado_en > now() - interval '60 days'
                  group by c.socio_id having count(*) >= alerta) r
           join public.socios s on s.id = r.socio_id), '[]'::jsonb);
  return items;
end $$;

revoke all on function privado.avisos_moderacion(uuid, text) from public, anon, authenticated;
revoke all on function public.motivos_beneficio_gimnasio(uuid), public.guardar_motivo_beneficio(uuid, uuid, text, boolean),
  public.guardar_topes_beneficios(uuid, int, int, int, int, int), public.dar_cortesia(uuid, int, uuid, text), public.anular_cortesia(uuid, text),
  public.cortesias_socio(uuid), public.beneficios_mes(uuid), public.moderacion_control(uuid, date, date, int) from public, anon, authenticated;
grant execute on function public.motivos_beneficio_gimnasio(uuid), public.guardar_motivo_beneficio(uuid, uuid, text, boolean),
  public.guardar_topes_beneficios(uuid, int, int, int, int, int), public.dar_cortesia(uuid, int, uuid, text), public.anular_cortesia(uuid, text),
  public.cortesias_socio(uuid), public.beneficios_mes(uuid), public.moderacion_control(uuid, date, date, int) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text; sin_motivos text;
begin
  foreach f in array array['public.motivos_beneficio_gimnasio(uuid)', 'public.guardar_motivo_beneficio(uuid, uuid, text, boolean)',
                           'public.guardar_topes_beneficios(uuid, int, int, int, int, int)', 'public.dar_cortesia(uuid, int, uuid, text)',
                           'public.anular_cortesia(uuid, text)', 'public.cortesias_socio(uuid)', 'public.beneficios_mes(uuid)',
                           'public.moderacion_control(uuid, date, date, int)', 'privado.avisos_moderacion(uuid, text)',
                           'privado.sembrar_motivos_beneficio(uuid)', 'privado.al_crear_gimnasio_motivos()'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if not (select relrowsecurity from pg_class where oid = 'public.motivos_beneficio'::regclass) then raise exception 'Verificación: motivos_beneficio sin RLS'; end if;
  select string_agg(g.slug, ', ') into sin_motivos from public.gimnasios g
   where not exists (select 1 from public.motivos_beneficio m where m.gimnasio_id = g.id);
  if sin_motivos is not null then raise exception 'Verificación: gimnasios sin motivos de cortesía: %', sin_motivos; end if;
  if position('cortesias_repetidas' in pg_get_functiondef('privado.avisos_moderacion(uuid, text)'::regprocedure)) = 0
     or position('revisar_suspension' in pg_get_functiondef('privado.avisos_moderacion(uuid, text)'::regprocedure)) = 0 then
    raise exception 'Verificación: avisos_moderacion perdió una pieza';
  end if;
  if position('levanta:' in pg_get_functiondef('public.moderacion_control(uuid, date, date, int)'::regprocedure)) = 0 then
    raise exception 'Verificación: moderacion_control perdió las suspensiones';
  end if;
end $$;
