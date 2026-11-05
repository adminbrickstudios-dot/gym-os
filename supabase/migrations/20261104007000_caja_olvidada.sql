-- 0070 · Caja olvidada abierta (CAJ-5).
-- Una caja quedó "olvidada" si se abrió otro día o si ya pasó la hora en que
-- cierra el gimnasio hoy (horarios_apertura de la sede). No hay cron: se
-- calcula cuando alguien mira (Inicio, Caja) o intenta abrir otra.
--   privado.caja_olvidada(turno)
--   cajas_olvidadas(gimnasio): todas para dueño y encargado; las suyas para la recepción
--   abrir_caja: copia (0009) que no deja abrir otra a quien tiene una abierta

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.horarios_apertura') is null then raise exception 'Guarda: falta la migración 0024'; end if;
  if to_regprocedure('public.alertas_caja(uuid, int)') is null then raise exception 'Guarda: falta la migración 0069'; end if;
end $$;

create or replace function privado.caja_olvidada(p_turno_id uuid, p_momento timestamptz) returns boolean
language sql stable set search_path = '' as $$
  select t.cerrado_en is null and (
           privado.dia_local(t.abierto_en, g.zona_horaria) < privado.dia_local(p_momento, g.zona_horaria)
        or (p_momento at time zone g.zona_horaria)::time >= coalesce(
             (select max(h.cierra) from public.horarios_apertura h
               where h.sede_id = c.sede_id and h.dia = extract(isodow from privado.dia_local(p_momento, g.zona_horaria))::int), '24:00'::time))
    from public.turnos_caja t join public.cajas c on c.id = t.caja_id join public.gimnasios g on g.id = t.gimnasio_id
   where t.id = p_turno_id
$$;
revoke all on function privado.caja_olvidada(uuid, timestamptz) from public;

create or replace function public.cajas_olvidadas(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return coalesce((select jsonb_agg(jsonb_build_object('turno_id', t.id, 'caja', c.nombre, 'sede_id', c.sede_id, 'abierto_en', t.abierto_en,
                     'abierto_por', q.nombre, 'mia', t.abierto_por = e.id) order by t.abierto_en)
                     from public.turnos_caja t join public.cajas c on c.id = t.caja_id join public.equipo q on q.id = t.abierto_por
                    where t.gimnasio_id = p_gimnasio_id and t.cerrado_en is null and privado.caja_olvidada(t.id, now())
                      and (e.rol <> 'recepcion' or t.abierto_por = e.id)), '[]'::jsonb);
end $$;

create or replace function public.abrir_caja(p_caja_id uuid, p_monto_inicial numeric) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.cajas; eid uuid; tid uuid; otra record; zona text;
begin
  select * into c from public.cajas where id = p_caja_id;
  if not found then raise exception 'Sin permiso o caja inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(c.gimnasio_id, array['dueno', 'encargado', 'recepcion'], c.sede_id);
  if not c.activa then raise exception 'La caja % está desactivada', c.nombre; end if;
  if p_monto_inicial is null or p_monto_inicial < 0 then raise exception 'El monto inicial no puede ser negativo'; end if;
  perform pg_advisory_xact_lock(hashtextextended('gymos:caja:' || c.id::text, 0));
  if exists (select 1 from public.turnos_caja where caja_id = c.id and cerrado_en is null) then
    raise exception 'La caja % ya está abierta', c.nombre;
  end if;
  -- CAJ-5: quien tiene una caja abierta (olvidada o no) la cierra antes de abrir otra.
  select cc.nombre, t.abierto_en into otra from public.turnos_caja t join public.cajas cc on cc.id = t.caja_id
   where t.gimnasio_id = c.gimnasio_id and t.abierto_por = eid and t.cerrado_en is null limit 1;
  if found then
    select zona_horaria into zona from public.gimnasios where id = c.gimnasio_id;
    raise exception 'Tenés abierta la % desde el %: contá la plata y cerrala antes de abrir otra',
      otra.nombre, to_char(otra.abierto_en at time zone zona, 'DD/MM HH24:MI') using errcode = '22023';
  end if;
  insert into public.turnos_caja (gimnasio_id, caja_id, abierto_por, monto_inicial)
  values (c.gimnasio_id, c.id, eid, round(p_monto_inicial, 2)) returning id into tid;
  return tid;
end $$;

revoke all on function public.cajas_olvidadas(uuid), public.abrir_caja(uuid, numeric) from public, anon, authenticated;
grant execute on function public.cajas_olvidadas(uuid), public.abrir_caja(uuid, numeric) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.cajas_olvidadas(uuid)', 'public.abrir_caja(uuid, numeric)', 'privado.caja_olvidada(uuid, timestamptz)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
