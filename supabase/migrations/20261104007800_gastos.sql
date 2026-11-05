-- 0078 · Gastos y ganancia (RES-3).
-- Gastos simples del mes (alquiler, sueldos, servicios, otros) para ver la
-- ganancia: cobrado del mes menos gastos. Los sueldos son sensibles: los
-- gastos los ve y los carga solo el dueño. Nada se borra: un gasto quitado
-- queda anulado con quién y cuándo.
--   gastos_mes(gimnasio, mes)                         { gastos, total, por_categoria, cobrado, ganancia }
--   guardar_gasto(gimnasio, mes, categoria, detalle, monto)
--   quitar_gasto(gasto)
--   repetir_gastos(gimnasio, mes)                     copia los del mes anterior (si este no tiene)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.cobrado_entre(uuid, timestamptz, timestamptz)') is null then raise exception 'Guarda: falta la migración 0076'; end if;
end $$;

create table if not exists public.gastos (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  mes          date not null check (extract(day from mes) = 1),
  categoria    text not null check (categoria in ('alquiler', 'sueldos', 'servicios', 'otros')),
  detalle      text check (detalle is null or length(detalle) <= 120),
  monto        numeric(12,2) not null check (monto > 0),
  creado_en    timestamptz not null default now(),
  creado_por   uuid not null,
  anulado_en   timestamptz,
  anulado_por  uuid,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, anulado_por) references public.equipo (gimnasio_id, id),
  check ((anulado_en is null) = (anulado_por is null))
);
create index if not exists gastos_mes on public.gastos (gimnasio_id, mes) where anulado_en is null;
select privado.politicas_estandar('public.gastos', array['dueno'], null);
revoke all on table public.gastos from anon;

create or replace function public.gastos_mes(p_gimnasio_id uuid, p_mes date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; m date; cobrado numeric; total numeric;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  m := date_trunc('month', coalesce(p_mes, privado.dia_local(now(), zona)))::date;
  cobrado := privado.cobrado_entre(p_gimnasio_id, privado.medianoche(m, zona), least(now(), privado.medianoche((m + interval '1 month')::date, zona)));
  select coalesce(sum(monto), 0) into total from public.gastos x where x.gimnasio_id = p_gimnasio_id and x.mes = m and x.anulado_en is null;
  return jsonb_build_object('mes', m, 'cobrado', cobrado, 'total', total, 'ganancia', cobrado - total,
    'gastos', coalesce((select jsonb_agg(jsonb_build_object('gasto_id', x.id, 'categoria', x.categoria, 'detalle', x.detalle, 'monto', x.monto,
                         'por', (select e.nombre from public.equipo e where e.id = x.creado_por)) order by x.categoria, x.creado_en)
                        from public.gastos x where x.gimnasio_id = p_gimnasio_id and x.mes = m and x.anulado_en is null), '[]'::jsonb),
    'por_categoria', coalesce((select jsonb_object_agg(y.categoria, y.t) from (select x.categoria, sum(x.monto) t from public.gastos x
                                 where x.gimnasio_id = p_gimnasio_id and x.mes = m and x.anulado_en is null group by x.categoria) y), '{}'::jsonb),
    'mes_anterior_tiene', exists (select 1 from public.gastos x where x.gimnasio_id = p_gimnasio_id and x.mes = (m - interval '1 month')::date and x.anulado_en is null));
end $$;

create or replace function public.guardar_gasto(p_gimnasio_id uuid, p_mes date, p_categoria text, p_detalle text, p_monto numeric) returns uuid
language plpgsql security definer set search_path = '' as $$
declare eid uuid; gid uuid;
begin
  eid := privado.exigir_rol(p_gimnasio_id, array['dueno']);
  if p_categoria is null or p_categoria not in ('alquiler', 'sueldos', 'servicios', 'otros') then raise exception 'Elegí qué es: alquiler, sueldos, servicios u otros' using errcode = '22023'; end if;
  if p_monto is null or p_monto <= 0 or p_monto > 9999999999 then raise exception 'El monto tiene que ser mayor a cero' using errcode = '22023'; end if;
  if p_mes is null then raise exception 'Falta el mes' using errcode = '22023'; end if;
  insert into public.gastos (gimnasio_id, mes, categoria, detalle, monto, creado_por)
  values (p_gimnasio_id, date_trunc('month', p_mes)::date, p_categoria, nullif(trim(coalesce(p_detalle, '')), ''), round(p_monto, 2), eid)
  returning id into gid;
  return gid;
end $$;

create or replace function public.quitar_gasto(p_gasto_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g public.gastos; eid uuid; n int;
begin
  select * into g from public.gastos where id = p_gasto_id;
  if not found then raise exception 'Sin permiso o gasto inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(g.gimnasio_id, array['dueno']);
  update public.gastos set anulado_en = now(), anulado_por = eid where id = g.id and gimnasio_id = g.gimnasio_id and anulado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese gasto ya se había quitado' using errcode = '22023'; end if;
end $$;

create or replace function public.repetir_gastos(p_gimnasio_id uuid, p_mes date) returns int
language plpgsql security definer set search_path = '' as $$
declare eid uuid; m date; n int;
begin
  eid := privado.exigir_rol(p_gimnasio_id, array['dueno']);
  m := date_trunc('month', p_mes)::date;
  if exists (select 1 from public.gastos x where x.gimnasio_id = p_gimnasio_id and x.mes = m and x.anulado_en is null) then
    raise exception 'Este mes ya tiene gastos: agregá los que falten de a uno' using errcode = '22023';
  end if;
  insert into public.gastos (gimnasio_id, mes, categoria, detalle, monto, creado_por)
  select p_gimnasio_id, m, x.categoria, x.detalle, x.monto, eid from public.gastos x
   where x.gimnasio_id = p_gimnasio_id and x.mes = (m - interval '1 month')::date and x.anulado_en is null;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'El mes anterior no tiene gastos para repetir' using errcode = '22023'; end if;
  return n;
end $$;

revoke all on function public.gastos_mes(uuid, date), public.guardar_gasto(uuid, date, text, text, numeric), public.quitar_gasto(uuid), public.repetir_gastos(uuid, date)
  from public, anon, authenticated;
grant execute on function public.gastos_mes(uuid, date), public.guardar_gasto(uuid, date, text, text, numeric), public.quitar_gasto(uuid), public.repetir_gastos(uuid, date)
  to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.gastos'::regclass) then raise exception 'Verificación: gastos sin RLS'; end if;
  foreach f in array array['public.gastos_mes(uuid, date)', 'public.guardar_gasto(uuid, date, text, text, numeric)', 'public.quitar_gasto(uuid)', 'public.repetir_gastos(uuid, date)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
