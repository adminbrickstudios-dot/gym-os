-- 5000 · VD-13 · Para hacer hoy: tareas inteligentes.
--   privado.catalogo_tareas_auto()   las automáticas que existen (clave, emoji, para quién por defecto, a dónde lleva)
--   tareas_auto                      lo que cada gimnasio decide: prendida/apagada, para quién y cuántos días (datos, no código)
--   tareas_auto_config(gimnasio)     el catálogo con lo decidido (dueño y encargado)
--   guardar_tarea_auto(...)          prender/apagar una automática, asignarla a un rol o a una persona (dueño y encargado)
--   para_hacer_hoy(gimnasio)         (se reemplaza, misma firma) las automáticas CALCULADAS: aparecen con su dato y salen solas al resolverse
--   tareas.repite / origen_id        las manuales pueden repetirse (diaria, semanal, mensual): al tildarla nace la siguiente
--   crear_tarea(..., p_repite)       (firma nueva: la vieja se borra acá)  marcar_tarea  (se reemplaza)
--   tareas_checklist(+_hechas)       checklist de apertura y cierre del gimnasio, configurable, tildado por día
--   checklist_hoy / guardar_checklist_item / tildar_checklist
-- Nada se guarda de lo automático: se calcula con las mismas funciones de siempre. La plata no se muestra:
-- solo cuántos y quiénes (el profe no entra: su Inicio es el de sus clases).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$ begin
  if to_regprocedure('public.para_hacer_hoy(uuid)') is null then raise exception 'Guarda: falta para_hacer_hoy (3700)'; end if;
  if to_regprocedure('public.tareas_panel(uuid, boolean)') is null then raise exception 'Guarda: falta tareas_panel (COM-4)'; end if;
  if to_regprocedure('public.prometieron_pagar(uuid)') is null then raise exception 'Guarda: falta prometieron_pagar'; end if;
  if to_regprocedure('public.cajas_olvidadas(uuid)') is null then raise exception 'Guarda: falta cajas_olvidadas'; end if;
  if to_regprocedure('public.cajas_para_revisar(uuid)') is null then raise exception 'Guarda: falta cajas_para_revisar'; end if;
  if to_regprocedure('public.cumplen_hoy(uuid, timestamptz)') is null then raise exception 'Guarda: falta cumplen_hoy'; end if;
  if to_regprocedure('public.pedidos_pausa_pendientes(uuid)') is null then raise exception 'Guarda: falta pedidos_pausa_pendientes'; end if;
  if to_regprocedure('public.pedidos_baja_pendientes(uuid)') is null then raise exception 'Guarda: falta pedidos_baja_pendientes'; end if;
  if to_regprocedure('privado.stock_producto(uuid)') is null then raise exception 'Guarda: falta privado.stock_producto'; end if;
  if to_regprocedure('privado.retencion(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.retencion'; end if;
end $$;

-- ── El catálogo de automáticas ──────────────────────────────────────
-- roles = para quién es por defecto (el dueño ve todas; el encargado ve también las de la recepción).
-- gestion = solo dueño y encargado (plata de la caja, pedidos de baja/pausa, stock): no se asignan a la recepción.
-- dias = el "N" configurable (null si la automática no tiene uno).
create or replace function privado.catalogo_tareas_auto() returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_array(
    jsonb_build_object('clave', 'vencen_hoy',      'emoji', '⏰', 'titulo', 'Cobrarle a los que vencen hoy',           'roles', jsonb_build_array('encargado', 'recepcion'), 'gestion', false, 'dias', null, 'href', '/vencen-hoy'),
    jsonb_build_object('clave', 'prometieron',     'emoji', '🤝', 'titulo', 'Prometieron pagar',                       'roles', jsonb_build_array('encargado', 'recepcion'), 'gestion', false, 'dias', null, 'href', '/vencen-hoy'),
    jsonb_build_object('clave', 'transferencias',  'emoji', '🧾', 'titulo', 'Aprobar transferencias',                  'roles', jsonb_build_array('encargado', 'recepcion'), 'gestion', false, 'dias', null, 'href', '/transferencias'),
    jsonb_build_object('clave', 'caja_abierta',    'emoji', '💵', 'titulo', 'Cerrar la caja que quedó abierta',        'roles', jsonb_build_array('encargado', 'recepcion'), 'gestion', false, 'dias', null, 'href', '/caja'),
    jsonb_build_object('clave', 'caja_sin_contar', 'emoji', '🧮', 'titulo', 'Revisar caja sin contar',                 'roles', jsonb_build_array('dueno', 'encargado'),    'gestion', true,  'dias', null, 'href', '/caja'),
    jsonb_build_object('clave', 'vencen_pronto',   'emoji', '📅', 'titulo', 'Avisar a los que vencen en unos días',    'roles', jsonb_build_array('encargado', 'recepcion'), 'gestion', false, 'dias', 3,    'href', '/avisos'),
    jsonb_build_object('clave', 'no_vienen',       'emoji', '👋', 'titulo', 'Los que no vienen hace tiempo',           'roles', jsonb_build_array('dueno', 'encargado'),    'gestion', false, 'dias', null, 'href', '/retencion'),
    jsonb_build_object('clave', 'nuevos_sin_venir','emoji', '🌱', 'titulo', 'Nuevos que no vinieron su primera semana','roles', jsonb_build_array('encargado', 'recepcion'), 'gestion', false, 'dias', null, 'href', '/retencion'),
    jsonb_build_object('clave', 'cumpleanos',      'emoji', '🎂', 'titulo', 'Cumpleaños de hoy',                       'roles', jsonb_build_array('encargado', 'recepcion'), 'gestion', false, 'dias', null, 'href', '/avisos'),
    jsonb_build_object('clave', 'stock_bajo',      'emoji', '📦', 'titulo', 'Reponer stock',                           'roles', jsonb_build_array('dueno', 'encargado'),    'gestion', true,  'dias', null, 'href', '/planes'),
    jsonb_build_object('clave', 'pedidos_pausa',   'emoji', '⏸️', 'titulo', 'Pausas para aprobar',                     'roles', jsonb_build_array('dueno', 'encargado'),    'gestion', true,  'dias', null, 'href', ''),
    jsonb_build_object('clave', 'pedidos_baja',    'emoji', '🚪', 'titulo', 'Bajas pedidas desde la app',              'roles', jsonb_build_array('dueno', 'encargado'),    'gestion', true,  'dias', null, 'href', ''),
    jsonb_build_object('clave', 'clases_espera',   'emoji', '🗓️', 'titulo', 'Clases con lista de espera hoy',          'roles', jsonb_build_array('encargado', 'recepcion'), 'gestion', false, 'dias', null, 'href', '/clases'))
$$;
revoke all on function privado.catalogo_tareas_auto() from public, anon, authenticated;

-- ── Lo que decide cada gimnasio ─────────────────────────────────────
create table if not exists public.tareas_auto (
  gimnasio_id  uuid not null references public.gimnasios(id),
  clave        text not null check (clave in ('vencen_hoy', 'prometieron', 'transferencias', 'caja_abierta', 'caja_sin_contar', 'vencen_pronto',
                                                'no_vienen', 'nuevos_sin_venir', 'cumpleanos', 'stock_bajo', 'pedidos_pausa', 'pedidos_baja', 'clases_espera')),
  activa       boolean not null default true,
  para_rol     text check (para_rol in ('dueno', 'encargado', 'recepcion')),
  para_equipo  uuid,
  dias         int check (dias between 1 and 30),
  actualizado_en timestamptz not null default now(),
  primary key (gimnasio_id, clave),
  check (para_rol is null or para_equipo is null),
  foreign key (gimnasio_id, para_equipo) references public.equipo (gimnasio_id, id)
);
select privado.politicas_estandar('public.tareas_auto', array['dueno', 'encargado'], null, false);
revoke all on table public.tareas_auto from anon;
revoke truncate, references, trigger on public.tareas_auto from authenticated;

-- ── Manuales con repetición ─────────────────────────────────────────
alter table public.tareas add column if not exists repite text;
alter table public.tareas add column if not exists origen_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tareas_repite_ck') then
    alter table public.tareas add constraint tareas_repite_ck check (repite is null or repite in ('diaria', 'semanal', 'mensual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tareas_origen_fk') then
    alter table public.tareas add constraint tareas_origen_fk foreign key (gimnasio_id, origen_id) references public.tareas (gimnasio_id, id);
  end if;
end $$;
-- De cada tarea nace una sola siguiente (tildar, destildar y volver a tildar no duplica).
create unique index if not exists tareas_una_siguiente on public.tareas (gimnasio_id, origen_id) where origen_id is not null;

drop function if exists public.crear_tarea(uuid, text, uuid, date, uuid);
create or replace function public.crear_tarea(p_gimnasio_id uuid, p_que text, p_para uuid, p_dia date, p_socio_id uuid default null, p_repite text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; zona text; v_id uuid; v_que text := trim(coalesce(p_que, ''));
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  if length(v_que) < 2 then raise exception 'Escribí qué hay que hacer.' using errcode = '22023'; end if;
  if length(v_que) > 200 then raise exception 'La tarea puede tener hasta 200 letras.' using errcode = '22023'; end if;
  if p_dia is null then raise exception 'Elegí para qué día es.' using errcode = '22023'; end if;
  if p_repite is not null and p_repite not in ('diaria', 'semanal', 'mensual') then raise exception 'Repetir: todos los días, todas las semanas o todos los meses.' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  if p_dia < (now() at time zone zona)::date - 1 then raise exception 'El día ya pasó: elegí hoy o uno que venga.' using errcode = '22023'; end if;
  if not exists (select 1 from public.equipo q where q.id = p_para and q.gimnasio_id = p_gimnasio_id and q.activo) then
    raise exception 'Esa persona no es del equipo de este gimnasio' using errcode = '22023';
  end if;
  if p_socio_id is not null and not exists (select 1 from public.socios s where s.id = p_socio_id and s.gimnasio_id = p_gimnasio_id) then
    raise exception 'Ese socio no es de este gimnasio' using errcode = '22023';
  end if;
  insert into public.tareas (gimnasio_id, que, socio_id, para, dia, creada_por, repite)
  values (p_gimnasio_id, v_que, p_socio_id, p_para, p_dia, e.id, p_repite) returning id into v_id;
  return v_id;
end $$;

create or replace function public.marcar_tarea(p_tarea_id uuid, p_hecha boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.tareas; e public.equipo; n int; zona text; hoy date; sig date;
begin
  select * into t from public.tareas where id = p_tarea_id;
  if not found then raise exception 'Sin permiso o tarea inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(t.gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  if e.rol not in ('dueno', 'encargado') and t.para <> e.id and t.creada_por <> e.id then
    raise exception 'Esa tarea es de otra persona' using errcode = '42501';
  end if;
  update public.tareas set hecha_en = case when p_hecha then now() end, hecha_por = case when p_hecha then e.id end
   where id = t.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo marcar la tarea'; end if;
  -- Si se repite, nace la siguiente: la próxima fecha de su ritmo que todavía no pasó.
  if p_hecha and t.repite is not null then
    select g.zona_horaria into zona from public.gimnasios g where g.id = t.gimnasio_id;
    hoy := privado.dia_local(now(), zona);
    sig := t.dia;
    for i in 1..400 loop
      sig := case t.repite when 'diaria' then sig + 1 when 'semanal' then sig + 7 else (sig + interval '1 month')::date end;
      exit when sig > hoy;
    end loop;
    insert into public.tareas (gimnasio_id, que, socio_id, para, dia, creada_por, repite, origen_id)
    values (t.gimnasio_id, t.que, t.socio_id, t.para, sig, t.creada_por, t.repite, t.id)
    on conflict (gimnasio_id, origen_id) where origen_id is not null do nothing;
  end if;
end $$;

-- Las tareas que ve la pantalla traen su repetición (misma firma: se reemplaza).
create or replace function public.tareas_panel(p_gimnasio_id uuid, p_todas boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; zona text; hoy date; ve_todas boolean;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := (now() at time zone zona)::date;
  ve_todas := coalesce(p_todas, false) and e.rol in ('dueno', 'encargado');
  return jsonb_build_object(
    'hoy', hoy,
    'tareas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'que', t.que, 'dia', t.dia, 'socio_id', t.socio_id,
        'socio', (select trim(s.nombre || ' ' || s.apellido) from public.socios s where s.id = t.socio_id),
        'para_id', t.para, 'para', p.nombre, 'mia', t.para = e.id, 'creada_por', c.nombre, 'repite', t.repite,
        'hecha_en', t.hecha_en, 'hecha_por', h.nombre, 'atrasada', t.hecha_en is null and t.dia < hoy)
        order by (t.hecha_en is not null), t.dia, t.creado_en)
      from public.tareas t join public.equipo p on p.id = t.para join public.equipo c on c.id = t.creada_por
      left join public.equipo h on h.id = t.hecha_por
     where t.gimnasio_id = p_gimnasio_id
       and (ve_todas or t.para = e.id or t.creada_por = e.id)
       and (t.hecha_en is null or t.hecha_en > now() - interval '7 days')), '[]'),
    'equipo', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'nombre', q.nombre, 'yo', q.id = e.id) order by q.id <> e.id, q.nombre)
      from public.equipo q where q.gimnasio_id = p_gimnasio_id and q.activo and q.usuario_id is not null), '[]'));
end $$;

-- ── Checklist de apertura y cierre ──────────────────────────────────
create table if not exists public.tareas_checklist (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  momento      text not null check (momento in ('apertura', 'cierre')),
  texto        text not null check (length(trim(texto)) between 2 and 120),
  orden        int not null default 0,
  activo       boolean not null default true,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id)
);
select privado.politicas_estandar('public.tareas_checklist', array['dueno', 'encargado', 'recepcion'], null, false);
revoke all on table public.tareas_checklist from anon;
revoke truncate, references, trigger on public.tareas_checklist from authenticated;

create table if not exists public.tareas_checklist_hechas (
  gimnasio_id  uuid not null references public.gimnasios(id),
  item_id      uuid not null,
  dia          date not null,
  hecha_en     timestamptz not null default now(),
  hecha_por    uuid not null,
  primary key (gimnasio_id, item_id, dia),
  foreign key (gimnasio_id, item_id) references public.tareas_checklist (gimnasio_id, id),
  foreign key (gimnasio_id, hecha_por) references public.equipo (gimnasio_id, id)
);
select privado.politicas_estandar('public.tareas_checklist_hechas', array['dueno', 'encargado', 'recepcion'], null, false);
revoke all on table public.tareas_checklist_hechas from anon;
revoke truncate, references, trigger on public.tareas_checklist_hechas from authenticated;

create or replace function public.checklist_hoy(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; zona text; hoy date;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  return jsonb_build_object('hoy', hoy, 'items', coalesce((
    select jsonb_agg(jsonb_build_object('id', i.id, 'momento', i.momento, 'texto', i.texto, 'orden', i.orden,
             'hecho', h.item_id is not null, 'hecha_por', q.nombre, 'hecha_en', h.hecha_en)
           order by i.momento, i.orden, i.creado_en)
      from public.tareas_checklist i
      left join public.tareas_checklist_hechas h on h.gimnasio_id = i.gimnasio_id and h.item_id = i.id and h.dia = hoy
      left join public.equipo q on q.id = h.hecha_por
     where i.gimnasio_id = p_gimnasio_id and i.activo), '[]'::jsonb));
end $$;

create or replace function public.guardar_checklist_item(p_gimnasio_id uuid, p_momento text, p_texto text, p_id uuid default null, p_activo boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_texto text := trim(coalesce(p_texto, '')); n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if p_momento not in ('apertura', 'cierre') then raise exception 'Es de apertura o de cierre.' using errcode = '22023'; end if;
  if length(v_texto) < 2 or length(v_texto) > 120 then raise exception 'Escribí qué revisar (hasta 120 letras).' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.tareas_checklist (gimnasio_id, momento, texto, orden)
    values (p_gimnasio_id, p_momento, v_texto, coalesce((select max(orden) + 1 from public.tareas_checklist where gimnasio_id = p_gimnasio_id and momento = p_momento), 0))
    returning id into v_id;
  else
    update public.tareas_checklist set texto = v_texto, momento = p_momento, activo = coalesce(p_activo, true)
     where id = p_id and gimnasio_id = p_gimnasio_id returning id into v_id;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Sin permiso o ítem inexistente' using errcode = '42501'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.tildar_checklist(p_item_id uuid, p_hecha boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare i public.tareas_checklist; e public.equipo; zona text; hoy date; n int;
begin
  select * into i from public.tareas_checklist where id = p_item_id;
  if not found then raise exception 'Sin permiso o ítem inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(i.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.zona_horaria into zona from public.gimnasios g where g.id = i.gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  if coalesce(p_hecha, true) then
    insert into public.tareas_checklist_hechas (gimnasio_id, item_id, dia, hecha_por) values (i.gimnasio_id, i.id, hoy, e.id)
    on conflict (gimnasio_id, item_id, dia) do nothing;
    if not exists (select 1 from public.tareas_checklist_hechas h where h.gimnasio_id = i.gimnasio_id and h.item_id = i.id and h.dia = hoy) then
      raise exception 'No se pudo tildar';
    end if;
  else
    delete from public.tareas_checklist_hechas where gimnasio_id = i.gimnasio_id and item_id = i.id and dia = hoy;
    get diagnostics n = row_count;
  end if;
end $$;

-- ── Configuración de las automáticas ────────────────────────────────
create or replace function public.tareas_auto_config(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return jsonb_build_object(
    'automaticas', (select jsonb_agg(k || jsonb_build_object(
        'activa', coalesce(c.activa, true), 'para_rol', c.para_rol, 'para_equipo', c.para_equipo,
        'dias_actual', coalesce(c.dias, nullif(k ->> 'dias', '')::int)) order by o)
      from jsonb_array_elements(privado.catalogo_tareas_auto()) with ordinality x(k, o)
      left join public.tareas_auto c on c.gimnasio_id = p_gimnasio_id and c.clave = k ->> 'clave'),
    'equipo', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'nombre', q.nombre, 'rol', q.rol) order by q.nombre)
      from public.equipo q where q.gimnasio_id = p_gimnasio_id and q.activo and q.usuario_id is not null and q.rol in ('dueno', 'encargado', 'recepcion')), '[]'));
end $$;

create or replace function public.guardar_tarea_auto(p_gimnasio_id uuid, p_clave text, p_activa boolean, p_para_rol text default null, p_para_equipo uuid default null, p_dias int default null) returns void
language plpgsql security definer set search_path = '' as $$
declare k jsonb; n int; v_rol text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select x into k from jsonb_array_elements(privado.catalogo_tareas_auto()) x where x ->> 'clave' = p_clave;
  if k is null then raise exception 'Esa tarea automática no existe: %', p_clave using errcode = '22023'; end if;
  if p_para_rol is not null and p_para_equipo is not null then raise exception 'Elegí un rol o una persona, no los dos.' using errcode = '22023'; end if;
  if p_para_rol is not null and p_para_rol not in ('dueno', 'encargado', 'recepcion') then raise exception 'Ese rol no puede tener tareas.' using errcode = '22023'; end if;
  if p_para_equipo is not null then
    select q.rol into v_rol from public.equipo q where q.id = p_para_equipo and q.gimnasio_id = p_gimnasio_id and q.activo and q.usuario_id is not null;
    if not found or v_rol not in ('dueno', 'encargado', 'recepcion') then raise exception 'Esa persona no puede tener esta tarea.' using errcode = '22023'; end if;
  end if;
  -- Lo de la caja, el stock y los pedidos de baja o pausa son de gestión: no van a la recepción.
  if (k ->> 'gestion')::boolean and (p_para_rol = 'recepcion' or v_rol = 'recepcion') then
    raise exception 'Esa tarea es de dueño o encargado: no se le puede dar a la recepción.' using errcode = '22023';
  end if;
  if p_dias is not null and (k -> 'dias' = 'null'::jsonb or p_dias not between 1 and 30) then
    raise exception 'Esta tarea no tiene días, o van de 1 a 30.' using errcode = '22023';
  end if;
  insert into public.tareas_auto (gimnasio_id, clave, activa, para_rol, para_equipo, dias, actualizado_en)
  values (p_gimnasio_id, p_clave, coalesce(p_activa, true), p_para_rol, p_para_equipo, p_dias, now())
  on conflict (gimnasio_id, clave) do update
    set activa = excluded.activa, para_rol = excluded.para_rol, para_equipo = excluded.para_equipo, dias = excluded.dias, actualizado_en = now();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar'; end if;
end $$;

-- ── Para hacer hoy: calculado, no guardado ──────────────────────────
-- [{ clave, emoji, texto, cantidad, href, titulo, socios: [{socio_id, nombre}], cobrar }]. Solo entra lo prendido, lo que
-- le toca a quien mira y lo que tiene cantidad > 0: al resolverse (cobrar, aprobar, cerrar) deja de entrar solo.
create or replace function public.para_hacer_hoy(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; c public.configuracion_gimnasio; cfg public.tareas_auto; k jsonb; v_clave text; roles jsonb; visible boolean; gestion boolean;
  salida jsonb := '[]'::jsonb; ret jsonb; cant int; socios jsonb; texto text; dias int; sede uuid; ve_clases boolean; zona text; hoy date; fin timestamptz;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  sede := e.sede_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  fin := privado.medianoche(hoy + 1, zona);
  ve_clases := c.modo_clases <> 'ninguno' and not ('clases' = any (c.secciones_apagadas));

  for k in select x from jsonb_array_elements(privado.catalogo_tareas_auto()) x loop
    v_clave := k ->> 'clave';
    gestion := (k ->> 'gestion')::boolean;
    cfg := null;
    select * into cfg from public.tareas_auto t where t.gimnasio_id = p_gimnasio_id and t.clave = v_clave;
    if found and not cfg.activa then continue; end if;
    -- Para quién es: una persona, un rol, o lo de siempre. El dueño ve todo; el encargado ve también lo de la recepción.
    if cfg.para_equipo is not null then
      visible := cfg.para_equipo = e.id or e.rol = 'dueno';
    else
      roles := case when cfg.para_rol is not null then jsonb_build_array(cfg.para_rol) else k -> 'roles' end;
      visible := e.rol = 'dueno' or roles ? e.rol::text or (e.rol = 'encargado' and roles ? 'recepcion');
    end if;
    if gestion and e.rol = 'recepcion' then visible := false; end if;
    if not visible then continue; end if;
    dias := coalesce(cfg.dias, nullif(k ->> 'dias', '')::int);
    cant := 0; socios := null; texto := null;

    if v_clave in ('vencen_hoy', 'vencen_pronto', 'no_vienen', 'nuevos_sin_venir') and ret is null then
      select coalesce(jsonb_agg(jsonb_build_object('socio_id', r.socio_id, 'nombre', r.nombre, 'lista', r.lista, 'dias', r.dias)), '[]'::jsonb)
        into ret from privado.retencion(p_gimnasio_id, now()) r where r.lista in ('por_vencer', 'no_viene', 'nuevo');
    end if;

    if v_clave = 'vencen_hoy' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'nombre')) into cant, socios
        from jsonb_array_elements(ret) x where x ->> 'lista' = 'por_vencer' and (x ->> 'dias')::int = 0;
      texto := 'Cobrarle a ' || cant || case when cant = 1 then ' que vence hoy' else ' que vencen hoy' end;
    elsif v_clave = 'vencen_pronto' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'nombre')) into cant, socios
        from jsonb_array_elements(ret) x where x ->> 'lista' = 'por_vencer' and (x ->> 'dias')::int between 1 and coalesce(dias, 3);
      texto := 'Avisar a ' || cant || case when cant = 1 then ' que vence' else ' que vencen' end || ' en ' || coalesce(dias, 3) || ' días o menos';
    elsif v_clave = 'no_vienen' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'nombre')) into cant, socios
        from jsonb_array_elements(ret) x where x ->> 'lista' = 'no_viene';
      texto := cant || case when cant = 1 then ' no viene' else ' no vienen' end || ' hace ' || c.retencion_dias_ausencia || ' días o más';
    elsif v_clave = 'nuevos_sin_venir' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'nombre')) into cant, socios
        from jsonb_array_elements(ret) x where x ->> 'lista' = 'nuevo';
      texto := cant || case when cant = 1 then ' nuevo todavía no vino' else ' nuevos todavía no vinieron' end;
    elsif v_clave = 'prometieron' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'socio')) into cant, socios
        from jsonb_array_elements(public.prometieron_pagar(p_gimnasio_id)) x;
      texto := cant || case when cant = 1 then ' prometió pagar' else ' prometieron pagar' end;
    elsif v_clave = 'transferencias' then
      select count(*) into cant from public.pagos p join public.ventas v on v.id = p.venta_id
       where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.medio = 'transferencia'
         and p.comprobante_path is not null and (sede is null or v.sede_id = sede);
      texto := 'Aprobar ' || cant || case when cant = 1 then ' transferencia' else ' transferencias' end;
    elsif v_clave = 'caja_abierta' then
      if 'caja' = any (c.secciones_apagadas) then continue; end if;
      cant := jsonb_array_length(public.cajas_olvidadas(p_gimnasio_id));
      texto := case when cant = 1 then 'Cerrar la caja que quedó abierta' else 'Cerrar las ' || cant || ' cajas que quedaron abiertas' end;
    elsif v_clave = 'caja_sin_contar' then
      if 'caja' = any (c.secciones_apagadas) then continue; end if;
      cant := jsonb_array_length(public.cajas_para_revisar(p_gimnasio_id));
      texto := 'Contar ' || cant || case when cant = 1 then ' caja que quedó sin contar' else ' cajas que quedaron sin contar' end;
    elsif v_clave = 'cumpleanos' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'nombre')) into cant, socios
        from jsonb_array_elements(public.cumplen_hoy(p_gimnasio_id)) x;
      texto := cant || case when cant = 1 then ' cumple años hoy' else ' cumplen años hoy' end;
    elsif v_clave = 'stock_bajo' then
      select count(*) into cant from public.productos pr
       where pr.gimnasio_id = p_gimnasio_id and pr.activo and pr.controla_stock
         and (privado.stock_producto(pr.id) <= 0 or (pr.stock_minimo is not null and privado.stock_producto(pr.id) <= pr.stock_minimo));
      texto := 'Reponer ' || cant || case when cant = 1 then ' producto' else ' productos' end;
    elsif v_clave = 'pedidos_pausa' then
      cant := jsonb_array_length(public.pedidos_pausa_pendientes(p_gimnasio_id));
      texto := cant || case when cant = 1 then ' pausa para aprobar' else ' pausas para aprobar' end;
    elsif v_clave = 'pedidos_baja' then
      cant := jsonb_array_length(public.pedidos_baja_pendientes(p_gimnasio_id));
      texto := cant || case when cant = 1 then ' baja pedida desde la app' else ' bajas pedidas desde la app' end;
    elsif v_clave = 'clases_espera' then
      if not ve_clases then continue; end if;
      select count(*) into cant from public.clases kl
       where kl.gimnasio_id = p_gimnasio_id and kl.inicio >= now() and kl.inicio < fin and kl.cancelada_en is null
         and (sede is null or kl.sede_id = sede)
         and exists (select 1 from public.reservas r where r.clase_id = kl.id and r.estado = 'espera');
      texto := cant || case when cant = 1 then ' clase tiene lista de espera' else ' clases tienen lista de espera' end;
    end if;

    if coalesce(cant, 0) > 0 then
      salida := salida || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'clave', v_clave, 'emoji', k ->> 'emoji', 'titulo', k ->> 'titulo', 'texto', texto, 'cantidad', cant, 'href', k ->> 'href',
        'cobrar', v_clave in ('vencen_hoy', 'prometieron'),
        'socios', case when socios is null then null else (select jsonb_agg(s) from (select s from jsonb_array_elements(socios) s limit 8) z) end)));
    end if;
  end loop;
  return salida;
end $$;

revoke all on function public.crear_tarea(uuid, text, uuid, date, uuid, text), public.marcar_tarea(uuid, boolean), public.tareas_panel(uuid, boolean),
  public.checklist_hoy(uuid), public.guardar_checklist_item(uuid, text, text, uuid, boolean), public.tildar_checklist(uuid, boolean),
  public.tareas_auto_config(uuid), public.guardar_tarea_auto(uuid, text, boolean, text, uuid, int), public.para_hacer_hoy(uuid) from public, anon, authenticated;
grant execute on function public.crear_tarea(uuid, text, uuid, date, uuid, text), public.marcar_tarea(uuid, boolean), public.tareas_panel(uuid, boolean),
  public.checklist_hoy(uuid), public.guardar_checklist_item(uuid, text, text, uuid, boolean), public.tildar_checklist(uuid, boolean),
  public.tareas_auto_config(uuid), public.guardar_tarea_auto(uuid, text, boolean, text, uuid, int), public.para_hacer_hoy(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.crear_tarea(uuid, text, uuid, date, uuid, text)', 'public.marcar_tarea(uuid, boolean)', 'public.tareas_panel(uuid, boolean)',
      'public.checklist_hoy(uuid)', 'public.guardar_checklist_item(uuid, text, text, uuid, boolean)', 'public.tildar_checklist(uuid, boolean)',
      'public.tareas_auto_config(uuid)', 'public.guardar_tarea_auto(uuid, text, boolean, text, uuid, int)', 'public.para_hacer_hoy(uuid)'] loop
    if to_regprocedure(f) is null then raise exception 'Verificación: falta %', f; end if;
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if to_regprocedure('public.crear_tarea(uuid, text, uuid, date, uuid)') is not null then raise exception 'Verificación: quedó la firma vieja de crear_tarea'; end if;
  if jsonb_array_length(privado.catalogo_tareas_auto()) <> 13 then raise exception 'Verificación: el catálogo no tiene 13 automáticas'; end if;
  foreach f in array array['public.tareas_auto', 'public.tareas_checklist', 'public.tareas_checklist_hechas'] loop
    if not (select relrowsecurity from pg_class where oid = f::regclass) then raise exception 'Verificación: % sin RLS', f; end if;
  end loop;
end $$;
