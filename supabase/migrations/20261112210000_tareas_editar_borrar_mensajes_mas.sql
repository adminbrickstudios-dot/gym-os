-- Q2 · Tareas: editar, borrar y cortar la repetición. Mensajes: "ver más" después de los 100.
--
--   editar_tarea(tarea, que, para, dia, repite)   cambia lo que dice, para quién, para qué día y si se repite
--                                                 (repite = null corta la repetición: no nace la siguiente).
--   borrar_tarea(tarea)                           la borra; si de ella había nacido la siguiente, esa queda suelta (sin origen).
--   bandeja_mensajes(gimnasio, estado, limite, desde)   firma nueva con "desde" (la vieja se borra acá) y 'total' en la respuesta.
--
-- Mismos permisos que marcar_tarea: dueño y encargado, cualquiera; recepción y profe, solo las suyas
-- (para ellos o creadas por ellos). Una tarea hecha no se edita (se reabre primero). Ningún cambio de datos.

do $$
begin
  if to_regclass('public.tareas') is null then raise exception 'Guarda: falta public.tareas'; end if;
  if to_regprocedure('public.marcar_tarea(uuid, boolean)') is null then raise exception 'Guarda: falta public.marcar_tarea'; end if;
  if to_regprocedure('public.bandeja_mensajes(uuid, text, integer)') is null
     and to_regprocedure('public.bandeja_mensajes(uuid, text, integer, integer)') is null then raise exception 'Guarda: falta public.bandeja_mensajes'; end if;
end $$;

create or replace function public.editar_tarea(p_tarea_id uuid, p_que text, p_para uuid, p_dia date, p_repite text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.tareas; e public.equipo; n int; zona text; v_que text := trim(coalesce(p_que, ''));
begin
  select * into t from public.tareas where id = p_tarea_id;
  if not found then raise exception 'Sin permiso o tarea inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(t.gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  if e.rol not in ('dueno', 'encargado') and t.para <> e.id and t.creada_por <> e.id then
    raise exception 'Esa tarea es de otra persona' using errcode = '42501';
  end if;
  if t.hecha_en is not null then raise exception 'La tarea ya está hecha: reabrila para editarla.' using errcode = '22023'; end if;
  if length(v_que) < 2 then raise exception 'Escribí qué hay que hacer.' using errcode = '22023'; end if;
  if length(v_que) > 200 then raise exception 'La tarea puede tener hasta 200 letras.' using errcode = '22023'; end if;
  if p_dia is null then raise exception 'Elegí para qué día es.' using errcode = '22023'; end if;
  if p_repite is not null and p_repite not in ('diaria', 'semanal', 'mensual') then raise exception 'Repetir: todos los días, todas las semanas o todos los meses.' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = t.gimnasio_id;
  if p_dia <> t.dia and p_dia < (now() at time zone zona)::date - 1 then raise exception 'El día ya pasó: elegí hoy o uno que venga.' using errcode = '22023'; end if;
  if not exists (select 1 from public.equipo q where q.id = p_para and q.gimnasio_id = t.gimnasio_id and q.activo) then
    raise exception 'Esa persona no es del equipo de este gimnasio' using errcode = '22023';
  end if;
  update public.tareas set que = v_que, para = p_para, dia = p_dia, repite = p_repite where id = t.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo editar la tarea'; end if;
end $$;

create or replace function public.borrar_tarea(p_tarea_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.tareas; e public.equipo; n int;
begin
  select * into t from public.tareas where id = p_tarea_id;
  if not found then raise exception 'Sin permiso o tarea inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(t.gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  if e.rol not in ('dueno', 'encargado') and t.para <> e.id and t.creada_por <> e.id then
    raise exception 'Esa tarea es de otra persona' using errcode = '42501';
  end if;
  -- La siguiente que nació de esta (si la hay) queda suelta: no se pierde ni bloquea el borrado.
  update public.tareas set origen_id = null where gimnasio_id = t.gimnasio_id and origen_id = t.id;
  delete from public.tareas where id = t.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo borrar la tarea'; end if;
end $$;

revoke all on function public.editar_tarea(uuid, text, uuid, date, text), public.borrar_tarea(uuid) from public, anon, authenticated;
grant execute on function public.editar_tarea(uuid, text, uuid, date, text), public.borrar_tarea(uuid) to authenticated, service_role;

-- ── Mensajes: "ver más" ─────────────────────────────────────────────
drop function if exists public.bandeja_mensajes(uuid, text, integer);
create or replace function public.bandeja_mensajes(p_gimnasio_id uuid, p_estado text default 'abiertos', p_limite int default 100, p_desde int default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := coalesce(p_limite, 100); des int := coalesce(p_desde, 0); filas jsonb; cuentas jsonb; total int;
begin
  perform privado.exigir_mensajes(p_gimnasio_id);
  if p_estado is not null and p_estado not in ('nuevo', 'en_curso', 'resuelto', 'abiertos') then raise exception 'Ese estado no existe' using errcode = '22023'; end if;
  if lim < 1 or lim > 200 then raise exception 'Se piden de 1 a 200 por vez.' using errcode = '22023'; end if;
  if des < 0 then raise exception 'El desde no puede ser negativo.' using errcode = '22023'; end if;
  select count(*) into total from public.hilos_socio h
   where h.gimnasio_id = p_gimnasio_id
     and (p_estado is null or (p_estado = 'abiertos' and h.estado <> 'resuelto') or h.estado = p_estado);
  select coalesce(jsonb_agg(z.fila order by z.orden), '[]'::jsonb) into filas from (
    select row_number() over (order by (h.ultimo_autor = 'socio' and h.estado <> 'resuelto') desc, h.ultimo_en desc, h.id) as orden,
           jsonb_build_object('hilo_id', h.id, 'socio_id', h.socio_id, 'socio', trim(s.nombre || ' ' || s.apellido), 'motivo', h.motivo, 'estado', h.estado,
             'creado_en', h.creado_en, 'ultimo_en', h.ultimo_en, 'ultimo_autor', h.ultimo_autor,
             'sin_responder', (h.ultimo_autor = 'socio' and h.estado <> 'resuelto'),
             'con_foto', exists (select 1 from public.mensajes_socio f where f.hilo_id = h.id and f.foto_path is not null),
             'extracto', left((select x.texto from public.mensajes_socio x where x.hilo_id = h.id order by x.creado_en desc, x.id desc limit 1), 140)) as fila
      from public.hilos_socio h join public.socios s on s.id = h.socio_id
     where h.gimnasio_id = p_gimnasio_id
       and (p_estado is null or (p_estado = 'abiertos' and h.estado <> 'resuelto') or h.estado = p_estado)
     order by (h.ultimo_autor = 'socio' and h.estado <> 'resuelto') desc, h.ultimo_en desc, h.id
     offset des limit lim
  ) z;
  select jsonb_build_object('nuevo', count(*) filter (where estado = 'nuevo'), 'en_curso', count(*) filter (where estado = 'en_curso'),
                            'resuelto', count(*) filter (where estado = 'resuelto'),
                            'sin_responder', count(*) filter (where ultimo_autor = 'socio' and estado <> 'resuelto'))
    into cuentas from public.hilos_socio where gimnasio_id = p_gimnasio_id;
  return jsonb_build_object('items', filas, 'conteos', cuentas, 'total', total);
end $$;

revoke all on function public.bandeja_mensajes(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.bandeja_mensajes(uuid, text, integer, integer) to authenticated, service_role;

do $$
begin
  if to_regprocedure('public.editar_tarea(uuid, text, uuid, date, text)') is null then raise exception 'Verificación: falta editar_tarea'; end if;
  if to_regprocedure('public.borrar_tarea(uuid)') is null then raise exception 'Verificación: falta borrar_tarea'; end if;
  if to_regprocedure('public.bandeja_mensajes(uuid, text, integer)') is not null then raise exception 'Verificación: quedó la firma vieja de bandeja_mensajes'; end if;
  if to_regprocedure('public.bandeja_mensajes(uuid, text, integer, integer)') is null then raise exception 'Verificación: falta la bandeja nueva'; end if;
end $$;
