-- 0124 · Tareas del equipo (COM-4).
-- "Llamar a Juan el jueves": qué, sobre qué socio (opcional), para quién y
-- para qué día. Las de hoy y las atrasadas aparecen en el Inicio de quien la
-- tiene. Cada uno ve las suyas (y las que creó); dueño y encargado ven todas.
-- Hechas: quedan con quién y cuándo; se pueden reabrir.
--   tareas_panel(gimnasio, todas)                      → { tareas: [...], equipo: [...] }
--   crear_tarea(gimnasio, que, para, dia, socio = null) → id
--   marcar_tarea(tarea, hecha)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
end $$;

create table if not exists public.tareas (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  que          text not null check (length(trim(que)) between 2 and 200),
  socio_id     uuid,
  para         uuid not null,
  dia          date not null,
  hecha_en     timestamptz,
  hecha_por    uuid,
  creada_por   uuid not null,
  creado_en    timestamptz not null default now(),
  check ((hecha_en is null) = (hecha_por is null)),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, para) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, hecha_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, creada_por) references public.equipo (gimnasio_id, id)
);
create index if not exists tareas_pendientes on public.tareas (gimnasio_id, para, dia) where hecha_en is null;
select privado.politicas_estandar('public.tareas', array['dueno', 'encargado'], null, false);
revoke all on table public.tareas from anon;
revoke truncate, references, trigger on public.tareas from authenticated;

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
        'para_id', t.para, 'para', p.nombre, 'mia', t.para = e.id, 'creada_por', c.nombre,
        'hecha_en', t.hecha_en, 'hecha_por', h.nombre, 'atrasada', t.hecha_en is null and t.dia < hoy)
        order by (t.hecha_en is not null), t.dia, t.creado_en)
      from public.tareas t join public.equipo p on p.id = t.para join public.equipo c on c.id = t.creada_por
      left join public.equipo h on h.id = t.hecha_por
     where t.gimnasio_id = p_gimnasio_id
       and (ve_todas or t.para = e.id or t.creada_por = e.id)
       -- Hechas: solo las de la última semana.
       and (t.hecha_en is null or t.hecha_en > now() - interval '7 days')), '[]'),
    'equipo', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'nombre', q.nombre, 'yo', q.id = e.id) order by q.id <> e.id, q.nombre)
      from public.equipo q where q.gimnasio_id = p_gimnasio_id and q.activo and q.usuario_id is not null), '[]'));
end $$;

create or replace function public.crear_tarea(p_gimnasio_id uuid, p_que text, p_para uuid, p_dia date, p_socio_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; zona text; v_id uuid; v_que text := trim(coalesce(p_que, ''));
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  if length(v_que) < 2 then raise exception 'Escribí qué hay que hacer.' using errcode = '22023'; end if;
  if length(v_que) > 200 then raise exception 'La tarea puede tener hasta 200 letras.' using errcode = '22023'; end if;
  if p_dia is null then raise exception 'Elegí para qué día es.' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  if p_dia < (now() at time zone zona)::date - 1 then raise exception 'El día ya pasó: elegí hoy o uno que venga.' using errcode = '22023'; end if;
  if not exists (select 1 from public.equipo q where q.id = p_para and q.gimnasio_id = p_gimnasio_id and q.activo) then
    raise exception 'Esa persona no es del equipo de este gimnasio' using errcode = '22023';
  end if;
  if p_socio_id is not null and not exists (select 1 from public.socios s where s.id = p_socio_id and s.gimnasio_id = p_gimnasio_id) then
    raise exception 'Ese socio no es de este gimnasio' using errcode = '22023';
  end if;
  insert into public.tareas (gimnasio_id, que, socio_id, para, dia, creada_por)
  values (p_gimnasio_id, v_que, p_socio_id, p_para, p_dia, e.id) returning id into v_id;
  return v_id;
end $$;

create or replace function public.marcar_tarea(p_tarea_id uuid, p_hecha boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.tareas; e public.equipo; n int;
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
end $$;
revoke all on function public.tareas_panel(uuid, boolean), public.crear_tarea(uuid, text, uuid, date, uuid), public.marcar_tarea(uuid, boolean) from public, anon, authenticated;
grant execute on function public.tareas_panel(uuid, boolean), public.crear_tarea(uuid, text, uuid, date, uuid), public.marcar_tarea(uuid, boolean) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.tareas'::regclass) then raise exception 'Verificación: tareas sin RLS'; end if;
  if has_function_privilege('anon', 'public.crear_tarea(uuid, text, uuid, date, uuid)', 'execute') then raise exception 'Verificación: crear_tarea quedó para anon'; end if;
end $$;
