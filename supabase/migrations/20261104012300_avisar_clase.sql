-- 0123 · Avisar a los anotados de una clase (COM-3).
-- Desde la lista de la clase: un texto (con {nombre}, {clase}, {dia} y
-- {gimnasio}) y un WhatsApp armado por persona. El aviso queda anotado en la
-- clase (qué se dijo, quién y cuándo). Pueden los mismos que ven la lista;
-- el profe, solo en sus clases y con teléfonos solo si el dueño lo prendió
-- (EQU-1): sin teléfono, la persona aparece sin WhatsApp.
--   avisar_clase(clase, texto) → { aviso_id, mensajes: [{ socio_id, nombre, telefono, mensaje }] }
--   avisos_clase(clase)        → [{ texto, por, creado_en, personas }]

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.lista_clase(uuid)') is null then raise exception 'Guarda: falta lista_clase'; end if;
end $$;

create table if not exists public.avisos_clase (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  clase_id     uuid not null,
  texto        text not null check (length(trim(texto)) between 1 and 500),
  personas     int not null default 0 check (personas >= 0),
  creado_por   uuid not null,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, clase_id) references public.clases (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id)
);
create index if not exists avisos_clase_por_clase on public.avisos_clase (clase_id, creado_en desc);
select privado.politicas_estandar('public.avisos_clase', array['dueno', 'encargado', 'recepcion', 'profe'], null, false);
revoke all on table public.avisos_clase from anon;
revoke truncate, references, trigger on public.avisos_clase from authenticated;

-- Quién puede tocar la lista de una clase: la misma regla que lista_clase.
create or replace function privado.equipo_de_clase(p_clase public.clases) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare eid uuid; rol text;
begin
  eid := privado.exigir_rol(p_clase.gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe'], p_clase.sede_id);
  select e.rol into rol from public.equipo e where e.id = eid;
  if rol = 'profe' and p_clase.profe_id is distinct from eid then
    raise exception 'Solo podés avisar en tus clases' using errcode = '42501';
  end if;
  return eid;
end $$;
revoke all on function privado.equipo_de_clase(public.clases) from public, anon, authenticated;

create or replace function public.avisar_clase(p_clase_id uuid, p_texto text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.clases; eid uuid; zona text; gim text; act text; dia text; t text := trim(coalesce(p_texto, '')); v_id uuid; r jsonb;
begin
  select * into c from public.clases where id = p_clase_id;
  if not found then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  eid := privado.equipo_de_clase(c);
  if t = '' then raise exception 'Escribí qué les querés avisar.' using errcode = '22023'; end if;
  if length(t) > 500 then raise exception 'El aviso puede tener hasta 500 letras.' using errcode = '22023'; end if;
  select g.zona_horaria, g.nombre into zona, gim from public.gimnasios g where g.id = c.gimnasio_id;
  select a.nombre into act from public.actividades a where a.id = c.actividad_id;
  dia := to_char(c.inicio at time zone zona, 'DD/MM') || ' a las ' || to_char(c.inicio at time zone zona, 'HH24:MI');
  -- La lista y los teléfonos, tal como los ve quien avisa.
  select coalesce(jsonb_agg(jsonb_build_object('socio_id', l.socio_id, 'nombre', l.nombre, 'telefono', l.telefono,
           'mensaje', privado.armar_mensaje(t, jsonb_build_object('nombre', split_part(l.nombre, ' ', 1), 'clase', coalesce(act, 'la clase'),
                                                                  'dia', dia, 'gimnasio', gim))) order by l.nombre), '[]')
    into r from public.lista_clase(c.id) l;
  insert into public.avisos_clase (gimnasio_id, clase_id, texto, personas, creado_por)
  values (c.gimnasio_id, c.id, t, jsonb_array_length(r), eid) returning id into v_id;
  return jsonb_build_object('aviso_id', v_id, 'mensajes', r);
end $$;

create or replace function public.avisos_clase(p_clase_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.clases;
begin
  select * into c from public.clases where id = p_clase_id;
  if not found then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  perform privado.equipo_de_clase(c);
  return coalesce((select jsonb_agg(jsonb_build_object('texto', a.texto, 'por', e.nombre, 'creado_en', a.creado_en, 'personas', a.personas) order by a.creado_en desc)
                     from public.avisos_clase a join public.equipo e on e.id = a.creado_por where a.clase_id = c.id), '[]');
end $$;
revoke all on function public.avisar_clase(uuid, text), public.avisos_clase(uuid) from public, anon, authenticated;
grant execute on function public.avisar_clase(uuid, text), public.avisos_clase(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.avisos_clase'::regclass) then raise exception 'Verificación: avisos_clase sin RLS'; end if;
  if has_function_privilege('anon', 'public.avisar_clase(uuid, text)', 'execute') then raise exception 'Verificación: avisar_clase quedó para anon'; end if;
end $$;
