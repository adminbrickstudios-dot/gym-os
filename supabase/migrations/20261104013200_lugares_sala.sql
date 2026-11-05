-- 0132 · Lugar puntual en la sala (COM-12).
-- Para clases con máquinas (bicis, reformers): una actividad en una sede
-- tiene lugares numerados, algunos fuera de servicio. El socio con reserva
-- confirmada elige el suyo; dos reservas confirmadas de la misma clase nunca
-- tienen el mismo lugar (índice único: la base lo garantiza aunque toquen a
-- la vez). La reserva y el cupo no cambian: el lugar es un dato más de la
-- reserva confirmada (una cancelada lo libera sola).
--   guardar_lugares(clase, cantidad, etiqueta, fuera)  dueño y encargado: vale para esa actividad en esa sede
--   lugares_clase(clase, socio)                         el socio (ocupados sin nombres) o el equipo (con nombres)
--   elegir_lugar(reserva, lugar)                        el socio o la recepción; null lo libera

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.reservas') is null then raise exception 'Guarda: falta reservas'; end if;
  if to_regprocedure('privado.exigir_rol(uuid, text[], uuid)') is null then raise exception 'Guarda: falta privado.exigir_rol'; end if;
end $$;

create table if not exists public.lugares_sala (
  id              uuid primary key default gen_random_uuid(),
  gimnasio_id     uuid not null references public.gimnasios(id),
  sede_id         uuid not null,
  actividad_id    uuid not null,
  cantidad        int not null check (cantidad between 1 and 200),
  etiqueta        text not null default 'Lugar' check (length(trim(etiqueta)) between 1 and 20),
  fuera_servicio  int[] not null default '{}',
  actualizado_en  timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, sede_id, actividad_id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  foreign key (gimnasio_id, actividad_id) references public.actividades (gimnasio_id, id)
);
select privado.politicas_estandar('public.lugares_sala', array['dueno', 'encargado', 'recepcion', 'profe'], null, false);
revoke all on table public.lugares_sala from anon;
revoke truncate, references, trigger on public.lugares_sala from authenticated;

alter table public.reservas add column if not exists lugar int;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reservas_lugar_check') then
    alter table public.reservas add constraint reservas_lugar_check check (lugar is null or lugar between 1 and 200);
  end if;
end $$;
create unique index if not exists reservas_un_lugar on public.reservas (gimnasio_id, clase_id, lugar) where estado = 'confirmada' and lugar is not null;

create or replace function public.guardar_lugares(p_clase_id uuid, p_cantidad int, p_etiqueta text default 'Lugar', p_fuera_servicio int[] default '{}') returns void
language plpgsql security definer set search_path = '' as $$
declare c public.clases; v_et text := coalesce(nullif(trim(coalesce(p_etiqueta, '')), ''), 'Lugar'); v_fuera int[];
begin
  select * into c from public.clases where id = p_clase_id;
  if not found then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(c.gimnasio_id, array['dueno', 'encargado'], c.sede_id);
  if p_cantidad is null or p_cantidad = 0 then
    delete from public.lugares_sala where gimnasio_id = c.gimnasio_id and sede_id = c.sede_id and actividad_id = c.actividad_id;
    return;
  end if;
  if p_cantidad < 1 or p_cantidad > 200 then raise exception 'La sala puede tener de 1 a 200 lugares.' using errcode = '22023'; end if;
  if length(v_et) > 20 then raise exception 'El nombre del lugar puede tener hasta 20 letras (ej: Bici).' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct x order by x), '{}') into v_fuera from unnest(coalesce(p_fuera_servicio, '{}')) x;
  if exists (select 1 from unnest(v_fuera) x where x < 1 or x > p_cantidad) then
    raise exception 'Los lugares fuera de servicio van del 1 al %.', p_cantidad using errcode = '22023';
  end if;
  if cardinality(v_fuera) >= p_cantidad then raise exception 'Tiene que quedar al menos un lugar en servicio.' using errcode = '22023'; end if;
  insert into public.lugares_sala (gimnasio_id, sede_id, actividad_id, cantidad, etiqueta, fuera_servicio)
  values (c.gimnasio_id, c.sede_id, c.actividad_id, p_cantidad, v_et, v_fuera)
  on conflict (gimnasio_id, sede_id, actividad_id) do update
    set cantidad = excluded.cantidad, etiqueta = excluded.etiqueta, fuera_servicio = excluded.fuera_servicio, actualizado_en = now();
end $$;

-- El mapa de una clase. Con p_socio_id: lo ve ese socio (los ocupados sin nombres, y el suyo).
-- Sin socio: el equipo (el profe, solo sus clases), con nombres. null = la sala no tiene lugares numerados.
create or replace function public.lugares_clase(p_clase_id uuid, p_socio_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.clases; l public.lugares_sala; eid uuid; rol text;
begin
  select * into c from public.clases where id = p_clase_id;
  if not found then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  if p_socio_id is not null then
    if p_socio_id not in (select privado.mis_socios())
       or not exists (select 1 from public.socios s where s.id = p_socio_id and s.gimnasio_id = c.gimnasio_id) then
      raise exception 'Sin permiso' using errcode = '42501';
    end if;
  else
    eid := privado.exigir_rol(c.gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe'], c.sede_id);
    select e.rol into rol from public.equipo e where e.id = eid;
    if rol = 'profe' and c.profe_id is distinct from eid then raise exception 'Solo ves los lugares de tus clases' using errcode = '42501'; end if;
  end if;
  select * into l from public.lugares_sala where gimnasio_id = c.gimnasio_id and sede_id = c.sede_id and actividad_id = c.actividad_id;
  if not found then return null; end if;
  return jsonb_build_object('etiqueta', l.etiqueta, 'cantidad', l.cantidad, 'fuera_servicio', to_jsonb(l.fuera_servicio),
    'ocupados', coalesce((select jsonb_agg(case when p_socio_id is null
                                               then jsonb_build_object('lugar', r.lugar, 'socio_id', s.id, 'nombre', trim(s.nombre || ' ' || coalesce(s.apellido, '')))
                                               else to_jsonb(r.lugar) end order by r.lugar)
       from public.reservas r join public.socios s on s.id = r.socio_id
      where r.clase_id = c.id and r.estado = 'confirmada' and r.lugar is not null), '[]'),
    'mio', case when p_socio_id is null then null else
             (select r.lugar from public.reservas r where r.clase_id = c.id and r.socio_id = p_socio_id and r.estado = 'confirmada') end,
    'reserva_id', case when p_socio_id is null then null else
             (select r.id from public.reservas r where r.clase_id = c.id and r.socio_id = p_socio_id and r.estado = 'confirmada') end);
end $$;

create or replace function public.elegir_lugar(p_reserva_id uuid, p_lugar int) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.reservas; c public.clases; l public.lugares_sala; n int;
begin
  select * into r from public.reservas where id = p_reserva_id;
  if not found then raise exception 'Sin permiso o reserva inexistente' using errcode = '42501'; end if;
  select * into c from public.clases where id = r.clase_id;
  if r.socio_id not in (select privado.mis_socios()) then
    perform privado.exigir_rol(c.gimnasio_id, array['dueno', 'encargado', 'recepcion'], c.sede_id);
  end if;
  if r.estado <> 'confirmada' then raise exception 'El lugar se elige con la reserva confirmada (en espera todavía no).' using errcode = '22023'; end if;
  if c.cancelada_en is not null then raise exception 'La clase está cancelada' using errcode = '22023'; end if;
  if c.fin <= now() then raise exception 'La clase ya terminó' using errcode = '22023'; end if;
  select * into l from public.lugares_sala where gimnasio_id = c.gimnasio_id and sede_id = c.sede_id and actividad_id = c.actividad_id;
  if not found then raise exception 'Esta clase no tiene lugares numerados' using errcode = '22023'; end if;
  if p_lugar is not null then
    if p_lugar < 1 or p_lugar > l.cantidad then raise exception 'Elegí un lugar del 1 al %.', l.cantidad using errcode = '22023'; end if;
    if p_lugar = any (l.fuera_servicio) then raise exception '% % está fuera de servicio: elegí otro.', l.etiqueta, p_lugar using errcode = '22023'; end if;
  end if;
  begin
    update public.reservas set lugar = p_lugar where id = r.id and estado = 'confirmada';
    get diagnostics n = row_count;
  exception when unique_violation then
    raise exception '% % ya lo eligió otra persona: elegí otro.', l.etiqueta, p_lugar using errcode = '23505';
  end;
  if n <> 1 then raise exception 'La reserva cambió: recargá y probá de nuevo.' using errcode = '40001'; end if;
end $$;

revoke all on function public.guardar_lugares(uuid, int, text, int[]), public.lugares_clase(uuid, uuid), public.elegir_lugar(uuid, int) from public, anon, authenticated;
grant execute on function public.guardar_lugares(uuid, int, text, int[]), public.lugares_clase(uuid, uuid), public.elegir_lugar(uuid, int) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.lugares_sala'::regclass) then raise exception 'Verificación: lugares_sala sin RLS'; end if;
  if to_regclass('public.reservas_un_lugar') is null then raise exception 'Verificación: falta el índice de un lugar por reserva'; end if;
  if has_function_privilege('anon', 'public.elegir_lugar(uuid, int)', 'execute') then raise exception 'Verificación: elegir_lugar quedó para anon'; end if;
end $$;
