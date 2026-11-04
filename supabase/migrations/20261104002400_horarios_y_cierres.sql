-- ═══════════════════════════════════════════════════════════════════
-- 0024 · Horarios de apertura y cierres desde el panel (CFG-4).
--
-- 1. horarios_apertura: franjas por sede y día de la semana (1 = lunes …
--    7 = domingo), hora local del gimnasio. Varias por día (turno partido).
--    Son horas del reloj de pared, no momentos: por eso `time`.
-- 2. privado.agenda: con la hora local, si cada sede está abierta ahora,
--    hasta cuándo, o cuándo abre; y si hoy hay un cierre. Una sola cuenta
--    para la página, la app y el panel.
-- 3. agenda_publica(host): horarios, "abierto ahora" y próximos cierres
--    para la página y la app (sin sesión, como landing_publica).
-- 4. Panel: horarios_apertura_panel / guardar_horarios_apertura (dueño),
--    cierres_panel (dueño y encargado, con cuántas clases canceló), y
--    crear_cierre con errores que se entienden (misma firma; el último
--    día sigue siendo exclusivo: la pantalla manda el día siguiente).
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.crear_cierre(uuid,date,date,text,boolean,uuid)') is null then raise exception 'Guarda: falta la migración 0006'; end if;
  if to_regprocedure('privado.medianoche(date,text)') is null then raise exception 'Guarda: falta privado.medianoche'; end if;
  if to_regclass('public.clases') is null then raise exception 'Guarda: falta la migración 0011'; end if;
end $$;

-- ── Tabla ───────────────────────────────────────────────────────────
create table if not exists public.horarios_apertura (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  sede_id      uuid not null,
  dia          smallint not null check (dia between 1 and 7),
  abre         time not null,
  cierra       time not null check (cierra <= '24:00'),
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  check (abre < cierra)
);
create index if not exists horarios_apertura_sede on public.horarios_apertura (sede_id, dia, abre);
select privado.politicas_estandar('public.horarios_apertura', null, array['dueno']);
-- Borrar: solo el dueño (guardar reemplaza las franjas de la sede).
drop policy if exists equipo_borra on public.horarios_apertura;
create policy equipo_borra on public.horarios_apertura for delete to authenticated
  using (gimnasio_id in (select privado.mis_gimnasios(array['dueno'])));

-- ── Cuenta única: ¿está abierto? ────────────────────────────────────
-- Por sede activa: abierto ahora, texto listo ("Abierto · cierra 22:00",
-- "Cerrado · abre mañana 07:00", "Cerrado hoy: Feriado") y las franjas.
create or replace function privado.agenda(p_gimnasio_id uuid, p_momento timestamptz) returns jsonb
language plpgsql stable set search_path = '' as $$
declare zona text; v_local timestamp; hoy date; hora time; v_dia_hoy int; s record; r jsonb := '[]'; f record;
        abierto boolean; texto text; cierre text; prox record; franjas jsonb; dias text[] := array['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
begin
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  v_local := p_momento at time zone zona;
  hoy := v_local::date; hora := v_local::time; v_dia_hoy := extract(isodow from v_local)::int;
  for s in select x.id, x.nombre from public.sedes x where x.gimnasio_id = p_gimnasio_id and x.activa order by x.es_principal desc, x.nombre loop
    select coalesce(jsonb_agg(jsonb_build_object('dia', h.dia, 'abre', to_char(h.abre, 'HH24:MI'),
                                                 'cierra', case when h.cierra = '24:00' then '24:00' else to_char(h.cierra, 'HH24:MI') end)
                              order by h.dia, h.abre), '[]')
      into franjas from public.horarios_apertura h where h.sede_id = s.id;
    select k.motivo into cierre from public.cierres k
     where k.gimnasio_id = p_gimnasio_id and k.anulado_en is null and (k.sede_id is null or k.sede_id = s.id)
       and k.desde <= p_momento and k.hasta > p_momento
     order by k.desde limit 1;
    abierto := false; texto := null;
    if jsonb_array_length(franjas) = 0 then
      texto := null;   -- sin horarios cargados: no se dice nada
    elsif cierre is not null then
      texto := 'Cerrado hoy: ' || cierre;
    else
      select h.* into f from public.horarios_apertura h where h.sede_id = s.id and h.dia = v_dia_hoy and h.abre <= hora and h.cierra > hora limit 1;
      if found then
        abierto := true;
        texto := 'Abierto · cierra ' || case when f.cierra = '24:00' then '24:00' else to_char(f.cierra, 'HH24:MI') end;
      else
        -- La próxima apertura en los próximos 7 días que no caiga en un cierre.
        select d.n, h.abre into prox
          from generate_series(0, 7) d(n)
          join public.horarios_apertura h on h.sede_id = s.id and h.dia = extract(isodow from hoy + d.n)::int
         where (d.n > 0 or h.abre > hora)
           and not exists (select 1 from public.cierres k where k.gimnasio_id = p_gimnasio_id and k.anulado_en is null
                             and (k.sede_id is null or k.sede_id = s.id)
                             and k.desde <= privado.medianoche(hoy + d.n, zona) + h.abre
                             and k.hasta > privado.medianoche(hoy + d.n, zona) + h.abre)
         order by d.n, h.abre limit 1;
        if found then
          texto := 'Cerrado · abre ' || case prox.n when 0 then 'hoy' when 1 then 'mañana' else 'el ' || dias[extract(isodow from hoy + prox.n)::int] end
                   || ' ' || to_char(prox.abre, 'HH24:MI');
        else
          texto := 'Cerrado';
        end if;
      end if;
    end if;
    r := r || jsonb_build_object('sede_id', s.id, 'sede', s.nombre, 'abierto', abierto, 'texto', texto, 'franjas', franjas);
  end loop;
  return jsonb_build_object(
    'sedes', r,
    'cierres', (select coalesce(jsonb_agg(jsonb_build_object(
                  'desde', (k.desde at time zone zona)::date, 'hasta', ((k.hasta at time zone zona)::date - 1),
                  'motivo', k.motivo, 'sede', (select x.nombre from public.sedes x where x.id = k.sede_id)) order by k.desde), '[]')
                  from public.cierres k
                 where k.gimnasio_id = p_gimnasio_id and k.anulado_en is null
                   and k.hasta > p_momento and k.desde < p_momento + interval '60 days'));
end $$;

-- Para la página y la app: por la dirección, como landing_publica. Horarios y
-- cierres son públicos (los publica el gimnasio); nada de socios ni de plata.
create or replace function public.agenda_publica(p_host text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select d.gimnasio_id into g from public.dominios_gimnasio d where d.host = lower(p_host);
  if g is null then return null; end if;
  return privado.agenda(g, now());
end $$;

-- ── Panel: horarios ─────────────────────────────────────────────────
create or replace function public.horarios_apertura_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return privado.agenda(p_gimnasio_id, now());
end $$;

-- Reemplaza todas las franjas de una sede. p_franjas: [{"dia":1,"abre":"07:00","cierra":"22:00"}, …]
create or replace function public.guardar_horarios_apertura(p_gimnasio_id uuid, p_sede_id uuid, p_franjas jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare f jsonb; v_dia int; v_abre time; v_cierra time; i int := 0;
        dias text[] := array['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if not exists (select 1 from public.sedes s where s.id = p_sede_id and s.gimnasio_id = p_gimnasio_id) then
    raise exception 'Esa sede no es de este gimnasio' using errcode = '42501';
  end if;
  if jsonb_typeof(p_franjas) is distinct from 'array' then raise exception 'Datos inválidos'; end if;
  if jsonb_array_length(p_franjas) > 21 then raise exception 'Hasta 3 franjas por día.' using errcode = '22023'; end if;
  delete from public.horarios_apertura where sede_id = p_sede_id and gimnasio_id = p_gimnasio_id;
  for f in select * from jsonb_array_elements(p_franjas) loop
    i := i + 1;
    begin
      v_dia := (f ->> 'dia')::int;
      v_abre := (f ->> 'abre')::time;
      v_cierra := (f ->> 'cierra')::time;
    exception when others then
      raise exception 'Revisá las horas: se escriben como 07:00 o 22:30.' using errcode = '22023';
    end;
    if v_dia is null or v_dia not between 1 and 7 then raise exception 'Día inválido' using errcode = '22023'; end if;
    if v_abre is null or v_cierra is null then
      raise exception 'El %: falta la hora de %.', dias[v_dia], case when v_abre is null then 'abrir' else 'cerrar' end using errcode = '22023';
    end if;
    if v_cierra = '00:00' then v_cierra := '24:00'; end if;   -- "abre 18, cierra 00" = hasta la medianoche
    if v_abre >= v_cierra then
      raise exception 'El %: abre a las % y cierra a las %. La hora de cerrar tiene que ser después.', dias[v_dia],
        to_char(v_abre, 'HH24:MI'), to_char(v_cierra, 'HH24:MI') using errcode = '22023';
    end if;
    if exists (select 1 from public.horarios_apertura h where h.sede_id = p_sede_id and h.dia = v_dia
                and h.abre < v_cierra and h.cierra > v_abre) then
      raise exception 'El % tiene dos franjas que se pisan.', dias[v_dia] using errcode = '22023';
    end if;
    if (select count(*) from public.horarios_apertura h where h.sede_id = p_sede_id and h.dia = v_dia) >= 3 then
      raise exception 'Hasta 3 franjas por día (el %).', dias[v_dia] using errcode = '22023';
    end if;
    insert into public.horarios_apertura (gimnasio_id, sede_id, dia, abre, cierra) values (p_gimnasio_id, p_sede_id, v_dia, v_abre, v_cierra);
  end loop;
end $$;

-- ── Panel: cierres ──────────────────────────────────────────────────
-- Los próximos y los de los últimos 60 días, con cuántas clases canceló.
create or replace function public.cierres_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'cierre_id', k.id, 'desde', (k.desde at time zone zona)::date, 'hasta', ((k.hasta at time zone zona)::date - 1),
            'motivo', k.motivo, 'compensa', k.compensa, 'sede', (select x.nombre from public.sedes x where x.id = k.sede_id),
            'pasado', k.hasta <= now(),
            'clases_canceladas', (select count(*) from public.clases c where c.cierre_id = k.id))
          order by k.desde desc), '[]')
            from public.cierres k
           where k.gimnasio_id = p_gimnasio_id and k.anulado_en is null and k.hasta > now() - interval '60 days');
end $$;

-- Misma firma que 0006 (p_hasta exclusivo), con errores que se entienden.
create or replace function public.crear_cierre(p_gimnasio_id uuid, p_desde date, p_hasta date, p_motivo text,
                                               p_compensa boolean default true, p_sede_id uuid default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare zona text; cid uuid;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado']);
  if p_desde is null or p_hasta is null then raise exception 'Elegí desde qué día y hasta qué día cierra.' using errcode = '22023'; end if;
  if p_hasta <= p_desde then raise exception 'El último día no puede ser antes del primero.' using errcode = '22023'; end if;
  if p_hasta - p_desde > 92 then raise exception 'Un cierre puede durar hasta 3 meses. Para más, cargá varios.' using errcode = '22023'; end if;
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'Escribí el motivo (lo ven los socios): por ejemplo "Feriado" o "Vacaciones".' using errcode = '22023'; end if;
  if length(trim(p_motivo)) > 80 then raise exception 'El motivo puede tener hasta 80 letras.' using errcode = '22023'; end if;
  if p_sede_id is not null and coalesce(p_compensa, true) then
    raise exception 'Devolver días solo se puede con el gimnasio entero cerrado (no una sede sola).' using errcode = '22023';
  end if;
  if p_sede_id is not null and not exists (select 1 from public.sedes s where s.id = p_sede_id and s.gimnasio_id = p_gimnasio_id) then
    raise exception 'Esa sede no es de este gimnasio' using errcode = '42501';
  end if;
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  if exists (select 1 from public.cierres k where k.gimnasio_id = p_gimnasio_id and k.anulado_en is null
               and (k.sede_id is null or p_sede_id is null or k.sede_id = p_sede_id)
               and k.desde < privado.medianoche(p_hasta, zona) and k.hasta > privado.medianoche(p_desde, zona)) then
    raise exception 'Ya hay un cierre cargado en esos días.' using errcode = '22023';
  end if;
  insert into public.cierres (gimnasio_id, sede_id, desde, hasta, motivo, compensa, creado_por)
  values (p_gimnasio_id, p_sede_id, privado.medianoche(p_desde, zona), privado.medianoche(p_hasta, zona), trim(p_motivo),
          coalesce(p_compensa, true), auth.uid())
  returning id into cid;
  return cid;
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function privado.agenda(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.agenda_publica(text), public.horarios_apertura_panel(uuid), public.guardar_horarios_apertura(uuid, uuid, jsonb),
  public.cierres_panel(uuid), public.crear_cierre(uuid, date, date, text, boolean, uuid) from public, anon, authenticated;
grant execute on function public.agenda_publica(text) to anon, authenticated, service_role;
grant execute on function public.horarios_apertura_panel(uuid), public.guardar_horarios_apertura(uuid, uuid, jsonb),
  public.cierres_panel(uuid), public.crear_cierre(uuid, date, date, text, boolean, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relname = 'horarios_apertura' and c.relrowsecurity) then
    raise exception 'Verificación: horarios_apertura sin RLS';
  end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'privado' and p.proname = 'agenda')
               or (s.nspname = 'public' and p.proname in ('agenda_publica', 'horarios_apertura_panel', 'guardar_horarios_apertura',
                                                         'cierres_panel', 'crear_cierre')) loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
  end loop;
  if has_function_privilege('anon', 'public.cierres_panel(uuid)', 'execute') then raise exception 'Verificación: anon lee los cierres del panel'; end if;
  if (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'crear_cierre') <> 1 then
    raise exception 'Verificación: quedó más de una versión de crear_cierre';
  end if;
end $$;
