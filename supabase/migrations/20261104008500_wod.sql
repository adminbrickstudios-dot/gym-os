-- 0085 · WOD / rutina del día en la clase (CLA-4).
-- El profe (en sus clases), el encargado o el dueño escriben qué se hace en
-- la clase. Lo ven los anotados en la app, debajo de su reserva.
--   guardar_wod(clase, texto)   vacío = lo borra
--   wods_socio(socio)           sus clases reservadas de los próximos 7 días con WOD
-- Copia: clase_detalle (0015) con el WOD.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.bandeja_avisos(uuid)') is null then raise exception 'Guarda: falta la migración 0072'; end if;
  if not exists (select 1 from pg_constraint where conname = 'avisos_enviados_clave_check' and pg_get_constraintdef(oid) like '%clase_cancelada%') then
    raise exception 'Guarda: falta la migración 0084';
  end if;
end $$;

alter table public.clases add column if not exists wod text;
alter table public.clases add column if not exists wod_en timestamptz;
alter table public.clases add column if not exists wod_por uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clases_wod_valido' and conrelid = 'public.clases'::regclass) then
    alter table public.clases add constraint clases_wod_valido check (wod is null or length(wod) between 1 and 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clases_wod_por_fk' and conrelid = 'public.clases'::regclass) then
    alter table public.clases add constraint clases_wod_por_fk foreign key (gimnasio_id, wod_por) references public.equipo (gimnasio_id, id);
  end if;
end $$;

create or replace function public.guardar_wod(p_clase_id uuid, p_texto text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.clases; eid uuid; rol text; t text := nullif(trim(coalesce(p_texto, '')), ''); n int;
begin
  select * into c from public.clases where id = p_clase_id;
  if not found then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(c.gimnasio_id, array['dueno', 'encargado', 'profe'], c.sede_id);
  select e.rol into rol from public.equipo e where e.id = eid;
  if rol = 'profe' and c.profe_id is distinct from eid then raise exception 'Solo podés escribir el WOD de tus clases' using errcode = '42501'; end if;
  if length(t) > 2000 then raise exception 'El WOD puede tener hasta 2000 letras (tiene %)', length(t) using errcode = '22023'; end if;
  update public.clases set wod = t, wod_en = case when t is null then null else now() end, wod_por = case when t is null then null else eid end
   where id = c.id and gimnasio_id = c.gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar el WOD'; end if;
end $$;

create or replace function public.wods_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('clase_id', c.id, 'actividad', a.nombre, 'inicio', c.inicio, 'wod', c.wod) order by c.inicio)
    from public.reservas r join public.clases c on c.id = r.clase_id join public.actividades a on a.id = c.actividad_id
   where r.socio_id = p_socio_id and r.estado = 'confirmada' and c.cancelada_en is null and c.wod is not null
     and c.fin > now() and c.inicio < now() + interval '7 days'), '[]'::jsonb);
end $$;

-- Copia de 0015 con el WOD.
create or replace function public.clase_detalle(p_clase_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.clases;
begin
  select * into c from public.clases where id = p_clase_id;
  if not found then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(c.gimnasio_id);
  return (select jsonb_build_object('clase_id', c.id, 'actividad', a.nombre, 'emoji', a.emoji, 'inicio', c.inicio, 'fin', c.fin,
            'profe', p.nombre, 'profe_id', c.profe_id, 'cupo', c.cupo,
            'confirmadas', (select count(*) from public.reservas r where r.clase_id = c.id and r.estado = 'confirmada'),
            'cancelada', c.cancelada_en is not null, 'cancelada_motivo', c.cancelada_motivo,
            'wod', c.wod, 'wod_por', (select w.nombre from public.equipo w where w.id = c.wod_por))
            from public.actividades a left join public.equipo p on p.id = c.profe_id where a.id = c.actividad_id);
end $$;

revoke all on function public.guardar_wod(uuid, text), public.wods_socio(uuid) from public, anon, authenticated;
grant execute on function public.guardar_wod(uuid, text), public.wods_socio(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.guardar_wod(uuid, text)', 'public.wods_socio(uuid)', 'public.clase_detalle(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
