-- VD-46Q · Perdonar una falta o un bloqueo de reservas, con motivo (docs/v2/14-SITUACIONES.md, caso 52).
-- Una falta se CALCULA (reserva confirmada de una clase que terminó, sin presente y sin cancelar). Perdonarla
-- es un hecho nuevo: queda escrito quién, cuándo y por qué, y esa reserva deja de contar. Como todo lo que
-- usa faltas llama a las mismas funciones (privado.faltas para el bloqueo y la lista, privado.faltas_pack para
-- el descuento del pack), alcanza con que las dos ignoren las reservas perdonadas: el socio vuelve a poder
-- reservar y el pack recupera la clase, en la puerta, la reserva, la app y la ficha.
--
--   faltas_perdonadas   un renglón por reserva perdonada (inmutable: no se cambia ni se borra)
--   perdonar_falta(clase, socio, motivo) · perdonar_bloqueo(socio, motivo) · faltas_socio_detalle(socio, dias) · faltas_clase(clase)
--
-- Permisos: solo dueño y encargado (perdonar una falta devuelve una clase de un pack: es plata). Se copian
-- las definiciones VIGENTES de privado.faltas (0080) y privado.faltas_pack (0095) con una sola condición más.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.faltas(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.faltas'; end if;
  if to_regprocedure('privado.faltas_pack(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta privado.faltas_pack'; end if;
  if to_regprocedure('privado.bloqueo_reservas(uuid)') is null then raise exception 'Guarda: falta privado.bloqueo_reservas'; end if;
  if to_regclass('public.reservas') is null then raise exception 'Guarda: falta reservas'; end if;
end $$;

create table if not exists public.faltas_perdonadas (
  id             uuid primary key default gen_random_uuid(),
  gimnasio_id    uuid not null references public.gimnasios(id),
  reserva_id     uuid not null,
  socio_id       uuid not null,
  clase_id       uuid not null,
  motivo         text not null check (length(trim(motivo)) between 3 and 300),
  perdonado_por  uuid not null,
  creado_en      timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, reserva_id),
  foreign key (gimnasio_id, reserva_id) references public.reservas (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, clase_id) references public.clases (gimnasio_id, id),
  foreign key (gimnasio_id, perdonado_por) references public.equipo (gimnasio_id, id)
);
create index if not exists faltas_perdonadas_socio on public.faltas_perdonadas (gimnasio_id, socio_id, creado_en desc);
alter table public.faltas_perdonadas enable row level security;

create or replace function privado.falta_perdonada_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Un perdón queda escrito: no se cambia ni se borra' using errcode = 'check_violation';
end $$;
revoke all on function privado.falta_perdonada_inmutable() from public;
drop trigger if exists falta_perdonada_inmutable on public.faltas_perdonadas;
create trigger falta_perdonada_inmutable before update or delete on public.faltas_perdonadas
  for each row execute function privado.falta_perdonada_inmutable();

drop policy if exists faltas_perdonadas_lee on public.faltas_perdonadas;
create policy faltas_perdonadas_lee on public.faltas_perdonadas for select to authenticated
  using (exists (select 1 from public.equipo e where e.gimnasio_id = faltas_perdonadas.gimnasio_id and e.usuario_id = auth.uid() and e.activo and e.rol in ('dueno', 'encargado')));
revoke all on table public.faltas_perdonadas from anon, authenticated;
grant select on table public.faltas_perdonadas to authenticated;

-- ── Copia de 0080: las faltas, sin las perdonadas ───────────────────
create or replace function privado.faltas(p_socio_id uuid, p_desde timestamptz) returns table (reserva_id uuid, clase_id uuid, actividad text, inicio timestamptz, fin timestamptz)
language sql stable set search_path = '' as $$
  select r.id, c.id, a.nombre, c.inicio, c.fin
    from public.reservas r join public.clases c on c.id = r.clase_id join public.actividades a on a.id = c.actividad_id
   where r.socio_id = p_socio_id and r.estado = 'confirmada' and c.cancelada_en is null
     and c.fin <= now() and c.inicio >= coalesce(p_desde, '-infinity'::timestamptz)
     and not exists (select 1 from public.asistencias x where x.clase_id = c.id and x.socio_id = p_socio_id and x.anulada_en is null)
     and not exists (select 1 from public.faltas_perdonadas fp where fp.reserva_id = r.id)
   order by c.inicio desc
$$;
revoke all on function privado.faltas(uuid, timestamptz) from public;

-- ── Copia de 0095: las faltas que descuentan del pack, sin las perdonadas ──
create or replace function privado.faltas_pack(p_pack_id uuid, p_momento timestamptz, p_excluir_reserva uuid default null) returns int
language sql stable set search_path = '' as $$
  select count(*)::int
    from public.reservas r
    join public.clases c on c.id = r.clase_id
    join public.configuracion_gimnasio cfg on cfg.gimnasio_id = r.gimnasio_id
    join public.gimnasios g on g.id = r.gimnasio_id
   where r.pack_id = p_pack_id and r.estado = 'confirmada' and r.id is distinct from p_excluir_reserva
     and cfg.falta_politica = 'descontar' and c.inicio >= cfg.falta_politica_desde
     and c.cancelada_en is null and c.fin <= p_momento
     and not exists (select 1 from public.asistencias a where a.clase_id = c.id and a.socio_id = r.socio_id and a.anulada_en is null)
     and not exists (select 1 from public.faltas_perdonadas fp where fp.reserva_id = r.id)
     and not exists (select 1 from public.ingresos i where i.socio_id = r.socio_id and i.resultado <> 'rechazado'
                       and privado.dia_local(i.momento, g.zona_horaria) = privado.dia_local(c.inicio, g.zona_horaria))
$$;
revoke all on function privado.faltas_pack(uuid, timestamptz, uuid) from public;

-- ── Perdonar una falta ──────────────────────────────────────────────
create or replace function public.perdonar_falta(p_clase_id uuid, p_socio_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.clases; e public.equipo; r public.reservas; m text := trim(coalesce(p_motivo, '')); id_nuevo uuid;
begin
  select * into c from public.clases where id = p_clase_id;
  if not found then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(c.gimnasio_id, array['dueno', 'encargado']);
  if length(m) < 3 then raise exception 'Escribí el motivo del perdón (por ejemplo: avisó por teléfono)' using errcode = '22023'; end if;
  if length(m) > 300 then raise exception 'El motivo es muy largo: hasta 300 letras' using errcode = '22023'; end if;
  select * into r from public.reservas where clase_id = c.id and socio_id = p_socio_id and gimnasio_id = c.gimnasio_id and estado = 'confirmada' for update;
  if not found then raise exception 'Ese socio no tiene una reserva confirmada en esa clase' using errcode = '22023'; end if;
  if exists (select 1 from public.faltas_perdonadas fp where fp.reserva_id = r.id) then
    raise exception 'Esa falta ya estaba perdonada' using errcode = '22023';
  end if;
  if not exists (select 1 from privado.faltas(p_socio_id, null) f where f.reserva_id = r.id) then
    raise exception 'Esa reserva no cuenta como falta (la clase no terminó, vino o se canceló)' using errcode = '22023';
  end if;
  insert into public.faltas_perdonadas (gimnasio_id, reserva_id, socio_id, clase_id, motivo, perdonado_por)
  values (c.gimnasio_id, r.id, p_socio_id, c.id, m, e.id) returning id into id_nuevo;
  return jsonb_build_object('id', id_nuevo, 'reserva_id', r.id, 'bloqueo', privado.bloqueo_reservas(p_socio_id));
end $$;

-- ── Perdonar el bloqueo de reservas (todas las faltas que lo sostienen) ──
create or replace function public.perdonar_bloqueo(p_socio_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; e public.equipo; cfg public.configuracion_gimnasio; m text := trim(coalesce(p_motivo, '')); n int;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(g, array['dueno', 'encargado']);
  if length(m) < 3 then raise exception 'Escribí el motivo del perdón (por ejemplo: avisó por teléfono)' using errcode = '22023'; end if;
  if length(m) > 300 then raise exception 'El motivo es muy largo: hasta 300 letras' using errcode = '22023'; end if;
  if privado.bloqueo_reservas(p_socio_id) is null then raise exception 'Este socio no tiene un bloqueo de reservas' using errcode = '22023'; end if;
  select * into cfg from public.configuracion_gimnasio where gimnasio_id = g;
  -- La misma ventana que usa privado.bloqueo_reservas para bloquear.
  insert into public.faltas_perdonadas (gimnasio_id, reserva_id, socio_id, clase_id, motivo, perdonado_por)
  select g, f.reserva_id, p_socio_id, f.clase_id, m, e.id
    from privado.faltas(p_socio_id, greatest(coalesce(cfg.falta_politica_desde, now()), now() - make_interval(days => cfg.falta_bloqueo_dias + 1))) f
  on conflict (gimnasio_id, reserva_id) do nothing;
  get diagnostics n = row_count;
  if n < 1 then raise exception 'No se pudo perdonar el bloqueo'; end if;
  if privado.bloqueo_reservas(p_socio_id) is not null then raise exception 'El bloqueo sigue: revisalo'; end if;
  return jsonb_build_object('perdonadas', n);
end $$;

-- ── Lo que ve la ficha: faltas vigentes, perdonadas (con motivo) y bloqueo ──
create or replace function public.faltas_socio_detalle(p_socio_id uuid, p_dias int default 60) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; e public.equipo; d int := least(greatest(coalesce(p_dias, 60), 1), 365);
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion', 'profe']);
  return jsonb_build_object(
    'puede_perdonar', e.rol in ('dueno', 'encargado'),
    'bloqueo', privado.bloqueo_reservas(p_socio_id),
    'faltas', coalesce((select jsonb_agg(jsonb_build_object('reserva_id', f.reserva_id, 'clase_id', f.clase_id, 'actividad', f.actividad, 'inicio', f.inicio) order by f.inicio desc)
                          from privado.faltas(p_socio_id, now() - make_interval(days => d)) f), '[]'::jsonb),
    'perdonadas', case when e.rol in ('dueno', 'encargado') then coalesce((
        select jsonb_agg(jsonb_build_object('clase_id', fp.clase_id, 'actividad', a.nombre, 'inicio', c.inicio, 'motivo', fp.motivo, 'por', q.nombre, 'creado_en', fp.creado_en) order by fp.creado_en desc)
          from public.faltas_perdonadas fp
          join public.clases c on c.gimnasio_id = fp.gimnasio_id and c.id = fp.clase_id
          join public.actividades a on a.gimnasio_id = c.gimnasio_id and a.id = c.actividad_id
          join public.equipo q on q.gimnasio_id = fp.gimnasio_id and q.id = fp.perdonado_por
         where fp.gimnasio_id = g and fp.socio_id = p_socio_id and c.inicio >= now() - make_interval(days => d)), '[]'::jsonb)
      else '[]'::jsonb end);
end $$;

-- ── Lo que ve la lista de la clase: quién faltó y a quién ya se le perdonó ──
create or replace function public.faltas_clase(p_clase_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.clases;
begin
  select * into c from public.clases where id = p_clase_id;
  if not found then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(c.gimnasio_id, array['dueno', 'encargado']);
  if c.cancelada_en is not null or c.fin > now() then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('socio_id', r.socio_id, 'perdonada', fp.id is not null, 'motivo', fp.motivo))
      from public.reservas r
      left join public.faltas_perdonadas fp on fp.reserva_id = r.id
     where r.gimnasio_id = c.gimnasio_id and r.clase_id = c.id and r.estado = 'confirmada'
       and not exists (select 1 from public.asistencias x where x.clase_id = c.id and x.socio_id = r.socio_id and x.anulada_en is null)
  ), '[]'::jsonb);
end $$;

revoke all on function public.perdonar_falta(uuid, uuid, text), public.perdonar_bloqueo(uuid, text), public.faltas_socio_detalle(uuid, int), public.faltas_clase(uuid) from public, anon, authenticated;
grant execute on function public.perdonar_falta(uuid, uuid, text), public.perdonar_bloqueo(uuid, text), public.faltas_socio_detalle(uuid, int), public.faltas_clase(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.faltas_perdonadas'::regclass) then raise exception 'Verificación: faltas_perdonadas sin RLS'; end if;
  if has_table_privilege('authenticated', 'public.faltas_perdonadas', 'insert') or has_table_privilege('authenticated', 'public.faltas_perdonadas', 'update')
     or has_table_privilege('authenticated', 'public.faltas_perdonadas', 'delete') or has_table_privilege('anon', 'public.faltas_perdonadas', 'select') then
    raise exception 'Verificación: permisos de más sobre faltas_perdonadas';
  end if;
  foreach f in array array['public.perdonar_falta(uuid, uuid, text)', 'public.perdonar_bloqueo(uuid, text)', 'public.faltas_socio_detalle(uuid, int)', 'public.faltas_clase(uuid)',
    'privado.faltas(uuid, timestamptz)', 'privado.faltas_pack(uuid, timestamptz, uuid)', 'privado.falta_perdonada_inmutable()'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if position('faltas_perdonadas' in pg_get_functiondef('privado.faltas(uuid, timestamptz)'::regprocedure)) = 0
     or position('faltas_perdonadas' in pg_get_functiondef('privado.faltas_pack(uuid, timestamptz, uuid)'::regprocedure)) = 0 then
    raise exception 'Verificación: las faltas no ignoran los perdones';
  end if;
end $$;
