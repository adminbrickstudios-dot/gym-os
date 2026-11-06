-- VD-41 · Gastos y presupuesto del gimnasio.
-- Sobre los gastos simples de 0078: seis categorías (alquiler, sueldos,
-- servicios, mantenimiento, proveedores, otros), día del gasto, foto del
-- comprobante (bucket privado), gastos fijos que se repiten cada mes y
-- presupuesto mensual por categoría. NADA se guarda por mes ni lo repite un
-- cron: los fijos se calculan al consultar (vigentes ese mes) y la ganancia
-- (ingresos - gastos) y el desvío contra el presupuesto salen de ganancia_mes.
-- Permisos: el dueño todo; el encargado ve y carga gastos solo si el dueño se
-- lo prende (encargado_ve_gastos, apagado de origen: hay sueldos); fijos y
-- presupuesto son del dueño. La recepción y el profe no ven nada.
--   ganancia_mes(gimnasio, mes)            { ingresos, gastos, fijos, ganancia, por_categoria + presupuesto }
--   cargar_gasto / anular_gasto            un gasto del día
--   preparar_comprobante_gasto / confirmar_comprobante_gasto / comprobante_gasto
--   guardar_gasto_fijo / terminar_gasto_fijo
--   guardar_presupuesto_gasto
--   guardar_permiso_gastos
--   exportar_gastos(gimnasio, mes)         filas para el CSV

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.gastos') is null then raise exception 'Guarda: falta la migración 0078 (gastos)'; end if;
  if to_regprocedure('privado.cobrado_entre(uuid, timestamptz, timestamptz)') is null then raise exception 'Guarda: falta privado.cobrado_entre'; end if;
end $$;

-- ── Gastos: categorías nuevas, día y comprobante ────────────────────
alter table public.gastos drop constraint if exists gastos_categoria_check;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gastos_categoria_valida' and conrelid = 'public.gastos'::regclass) then
    alter table public.gastos add constraint gastos_categoria_valida
      check (categoria in ('alquiler', 'sueldos', 'servicios', 'mantenimiento', 'proveedores', 'otros'));
  end if;
end $$;

alter table public.gastos add column if not exists fecha date;
alter table public.gastos add column if not exists comprobante_path text;
update public.gastos set fecha = mes where fecha is null;

-- Los gastos que carga la versión vieja (sin día) toman el primero del mes.
create or replace function privado.gasto_fecha() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.fecha := coalesce(new.fecha, new.mes);
  return new;
end $$;
revoke all on function privado.gasto_fecha() from public;
drop trigger if exists gasto_fecha on public.gastos;
create trigger gasto_fecha before insert on public.gastos for each row execute function privado.gasto_fecha();
alter table public.gastos alter column fecha set not null;

-- ── Gastos fijos: se repiten cada mes mientras estén vigentes ───────
create table if not exists public.gastos_fijos (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  categoria    text not null check (categoria in ('alquiler', 'sueldos', 'servicios', 'mantenimiento', 'proveedores', 'otros')),
  detalle      text check (detalle is null or length(detalle) <= 120),
  monto        numeric(12,2) not null check (monto > 0),
  desde        date not null check (extract(day from desde) = 1),   -- primer mes en que cuenta
  hasta        date check (hasta is null or (extract(day from hasta) = 1 and hasta >= desde)),   -- último mes (null = sigue)
  creado_en    timestamptz not null default now(),
  creado_por   uuid not null,
  anulado_en   timestamptz,
  anulado_por  uuid,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, anulado_por) references public.equipo (gimnasio_id, id),
  check ((anulado_en is null) = (anulado_por is null))
);
create index if not exists gastos_fijos_vigentes on public.gastos_fijos (gimnasio_id, desde) where anulado_en is null;
select privado.politicas_estandar('public.gastos_fijos', array['dueno'], null);
revoke all on table public.gastos_fijos from anon;

-- ── Presupuesto mensual por categoría ───────────────────────────────
create table if not exists public.presupuestos_gasto (
  id              uuid primary key default gen_random_uuid(),
  gimnasio_id     uuid not null references public.gimnasios(id),
  categoria       text not null check (categoria in ('alquiler', 'sueldos', 'servicios', 'mantenimiento', 'proveedores', 'otros')),
  monto           numeric(12,2) not null check (monto > 0),
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid not null,
  unique (gimnasio_id, id),
  unique (gimnasio_id, categoria),
  foreign key (gimnasio_id, actualizado_por) references public.equipo (gimnasio_id, id)
);
select privado.politicas_estandar('public.presupuestos_gasto', array['dueno'], null);
revoke all on table public.presupuestos_gasto from anon;

-- ── Permiso: el encargado ve los gastos solo si el dueño lo prende ──
alter table public.configuracion_gimnasio add column if not exists encargado_ve_gastos boolean not null default false;

create or replace function privado.exigir_gastos(p_gimnasio_id uuid) returns uuid
language plpgsql stable set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if e.rol = 'encargado' and not coalesce((select c.encargado_ve_gastos from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id), false) then
    raise exception 'El dueño no le dio acceso a los gastos al encargado' using errcode = '42501';
  end if;
  return e.id;
end $$;
revoke all on function privado.exigir_gastos(uuid) from public;

create or replace function public.guardar_permiso_gastos(p_gimnasio_id uuid, p_prendido boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno']);
  if p_prendido is null then raise exception 'Prendido o apagado' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set encargado_ve_gastos = p_prendido where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar el permiso'; end if;
end $$;

-- ── La ganancia del mes ─────────────────────────────────────────────
create or replace function public.ganancia_mes(p_gimnasio_id uuid, p_mes date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  eid uuid; es_dueno boolean; zona text; hoy date; m date; ingresos numeric; unicos numeric; fijos numeric; presu numeric; permiso boolean;
  cats text[] := array['alquiler', 'sueldos', 'servicios', 'mantenimiento', 'proveedores', 'otros'];
begin
  eid := privado.exigir_gastos(p_gimnasio_id);
  es_dueno := exists (select 1 from public.equipo where id = eid and rol = 'dueno');
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  m := date_trunc('month', coalesce(p_mes, hoy))::date;
  ingresos := privado.cobrado_entre(p_gimnasio_id, privado.medianoche(m, zona), least(now(), privado.medianoche((m + interval '1 month')::date, zona)));
  select coalesce(sum(x.monto), 0) into unicos from public.gastos x where x.gimnasio_id = p_gimnasio_id and x.mes = m and x.anulado_en is null;
  select coalesce(sum(f.monto), 0) into fijos from public.gastos_fijos f
   where f.gimnasio_id = p_gimnasio_id and f.anulado_en is null and f.desde <= m and (f.hasta is null or f.hasta >= m);
  select coalesce(sum(b.monto), 0) into presu from public.presupuestos_gasto b where b.gimnasio_id = p_gimnasio_id;
  select c.encargado_ve_gastos into permiso from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  return jsonb_build_object(
    'mes', m, 'en_curso', m = date_trunc('month', hoy)::date, 'es_dueno', es_dueno, 'encargado_ve_gastos', permiso,
    'ingresos', ingresos, 'total_unicos', unicos, 'total_fijos', fijos, 'total', unicos + fijos, 'ganancia', ingresos - (unicos + fijos),
    'presupuesto_total', presu,
    'gastos', coalesce((select jsonb_agg(jsonb_build_object('gasto_id', x.id, 'fecha', x.fecha, 'categoria', x.categoria, 'detalle', x.detalle, 'monto', x.monto,
                           'comprobante', x.comprobante_path is not null, 'por', (select e.nombre from public.equipo e where e.id = x.creado_por)) order by x.fecha, x.creado_en)
                          from public.gastos x where x.gimnasio_id = p_gimnasio_id and x.mes = m and x.anulado_en is null), '[]'::jsonb),
    -- La lista de fijos (hay sueldos) es del dueño; el encargado con permiso los ve sumados en el total.
    'fijos', case when not es_dueno then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('fijo_id', f.id, 'categoria', f.categoria, 'detalle', f.detalle,
                           'monto', f.monto, 'desde', f.desde, 'hasta', f.hasta) order by f.categoria, f.creado_en)
                          from public.gastos_fijos f where f.gimnasio_id = p_gimnasio_id and f.anulado_en is null and f.desde <= m and (f.hasta is null or f.hasta >= m)), '[]'::jsonb) end,
    'por_categoria', (select jsonb_agg(jsonb_build_object('categoria', c, 'gastado', g.t, 'presupuesto', b.monto,
                         'desvio', case when b.monto is null then null else g.t - b.monto end) order by array_position(cats, c))
                        from unnest(cats) as k(c)
                        cross join lateral (select coalesce((select sum(x.monto) from public.gastos x where x.gimnasio_id = p_gimnasio_id and x.mes = m and x.anulado_en is null and x.categoria = c), 0)
                                                 + coalesce((select sum(f.monto) from public.gastos_fijos f where f.gimnasio_id = p_gimnasio_id and f.anulado_en is null and f.desde <= m
                                                                and (f.hasta is null or f.hasta >= m) and f.categoria = c), 0) as t) g
                        left join public.presupuestos_gasto b on b.gimnasio_id = p_gimnasio_id and b.categoria = c),
    'hay_gastos_mes_anterior', exists (select 1 from public.gastos x where x.gimnasio_id = p_gimnasio_id and x.mes = (m - interval '1 month')::date and x.anulado_en is null));
end $$;

-- ── Gastos del día ──────────────────────────────────────────────────
create or replace function public.cargar_gasto(p_gimnasio_id uuid, p_fecha date, p_categoria text, p_detalle text, p_monto numeric) returns uuid
language plpgsql security definer set search_path = '' as $$
declare eid uuid; zona text; f date; gid uuid;
begin
  eid := privado.exigir_gastos(p_gimnasio_id);
  if p_categoria is null or p_categoria not in ('alquiler', 'sueldos', 'servicios', 'mantenimiento', 'proveedores', 'otros') then
    raise exception 'Elegí qué es: alquiler, sueldos, servicios, mantenimiento, proveedores u otros' using errcode = '22023';
  end if;
  if p_monto is null or p_monto <= 0 or p_monto > 9999999999 then raise exception 'El monto tiene que ser mayor a cero' using errcode = '22023'; end if;
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  f := coalesce(p_fecha, privado.dia_local(now(), zona));
  insert into public.gastos (gimnasio_id, mes, fecha, categoria, detalle, monto, creado_por)
  values (p_gimnasio_id, date_trunc('month', f)::date, f, p_categoria, nullif(trim(coalesce(p_detalle, '')), ''), round(p_monto, 2), eid)
  returning id into gid;
  return gid;
end $$;

create or replace function public.anular_gasto(p_gasto_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g public.gastos; eid uuid; n int;
begin
  select * into g from public.gastos where id = p_gasto_id;
  if not found then raise exception 'Sin permiso o gasto inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_gastos(g.gimnasio_id);
  update public.gastos set anulado_en = now(), anulado_por = eid where id = g.id and gimnasio_id = g.gimnasio_id and anulado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese gasto ya se había quitado' using errcode = '22023'; end if;
end $$;

-- ── Comprobante del gasto (sube el servidor con la clave de servicio) ─
create or replace function public.preparar_comprobante_gasto(p_gasto_id uuid, p_ext text) returns text
language plpgsql security definer set search_path = '' as $$
declare g public.gastos;
begin
  select * into g from public.gastos where id = p_gasto_id;
  if not found then raise exception 'Sin permiso o gasto inexistente' using errcode = '42501'; end if;
  perform privado.exigir_gastos(g.gimnasio_id);
  if g.anulado_en is not null then raise exception 'Ese gasto se quitó' using errcode = '22023'; end if;
  if g.comprobante_path is not null then raise exception 'Ese gasto ya tiene su comprobante' using errcode = '22023'; end if;
  if p_ext not in ('jpg', 'png', 'webp', 'pdf') then raise exception 'El comprobante tiene que ser JPG, PNG, WEBP o PDF' using errcode = '22023'; end if;
  return g.gimnasio_id::text || '/' || g.id::text || '/comprobante-' || replace(gen_random_uuid()::text, '-', '') || '.' || p_ext;
end $$;

create or replace function public.confirmar_comprobante_gasto(p_gasto_id uuid, p_ruta text) returns void
language plpgsql security definer set search_path = '' as $$
declare g public.gastos; n int;
begin
  select * into g from public.gastos where id = p_gasto_id for update;
  if not found then raise exception 'Sin permiso o gasto inexistente' using errcode = '42501'; end if;
  perform privado.exigir_gastos(g.gimnasio_id);
  if p_ruta is null or p_ruta !~ ('^' || g.gimnasio_id::text || '/' || g.id::text || '/comprobante-[0-9a-f]{32}\.(jpg|png|webp|pdf)$') then
    raise exception 'Ruta de comprobante inválida';
  end if;
  update public.gastos set comprobante_path = p_ruta where id = g.id and comprobante_path is null and anulado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese gasto ya tiene su comprobante' using errcode = '22023'; end if;
end $$;

create or replace function public.comprobante_gasto(p_gasto_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare g public.gastos;
begin
  select * into g from public.gastos where id = p_gasto_id;
  if not found then raise exception 'Sin permiso o gasto inexistente' using errcode = '42501'; end if;
  perform privado.exigir_gastos(g.gimnasio_id);
  return g.comprobante_path;
end $$;

-- ── Gastos fijos (del dueño) ────────────────────────────────────────
create or replace function public.guardar_gasto_fijo(p_gimnasio_id uuid, p_categoria text, p_detalle text, p_monto numeric, p_desde date default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare eid uuid; zona text; fid uuid;
begin
  eid := privado.exigir_rol(p_gimnasio_id, array['dueno']);
  if p_categoria is null or p_categoria not in ('alquiler', 'sueldos', 'servicios', 'mantenimiento', 'proveedores', 'otros') then
    raise exception 'Elegí qué es: alquiler, sueldos, servicios, mantenimiento, proveedores u otros' using errcode = '22023';
  end if;
  if p_monto is null or p_monto <= 0 or p_monto > 9999999999 then raise exception 'El monto tiene que ser mayor a cero' using errcode = '22023'; end if;
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  insert into public.gastos_fijos (gimnasio_id, categoria, detalle, monto, desde, creado_por)
  values (p_gimnasio_id, p_categoria, nullif(trim(coalesce(p_detalle, '')), ''), round(p_monto, 2),
          date_trunc('month', coalesce(p_desde, privado.dia_local(now(), zona)))::date, eid)
  returning id into fid;
  return fid;
end $$;

-- Deja de contar desde el mes indicado (los meses anteriores no cambian).
create or replace function public.terminar_gasto_fijo(p_fijo_id uuid, p_desde_mes date) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.gastos_fijos; eid uuid; corte date; n int;
begin
  select * into f from public.gastos_fijos where id = p_fijo_id;
  if not found then raise exception 'Sin permiso o gasto fijo inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(f.gimnasio_id, array['dueno']);
  if p_desde_mes is null then raise exception 'Falta el mes' using errcode = '22023'; end if;
  corte := (date_trunc('month', p_desde_mes) - interval '1 month')::date;
  if corte < f.desde then
    update public.gastos_fijos set anulado_en = now(), anulado_por = eid where id = f.id and gimnasio_id = f.gimnasio_id and anulado_en is null;
  else
    update public.gastos_fijos set hasta = corte where id = f.id and gimnasio_id = f.gimnasio_id and anulado_en is null;
  end if;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese gasto fijo ya estaba terminado' using errcode = '22023'; end if;
end $$;

-- ── Presupuesto mensual por categoría (del dueño) ───────────────────
-- Monto 0 o vacío saca el presupuesto de esa categoría.
create or replace function public.guardar_presupuesto_gasto(p_gimnasio_id uuid, p_categoria text, p_monto numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare eid uuid;
begin
  eid := privado.exigir_rol(p_gimnasio_id, array['dueno']);
  if p_categoria is null or p_categoria not in ('alquiler', 'sueldos', 'servicios', 'mantenimiento', 'proveedores', 'otros') then
    raise exception 'Elegí la categoría' using errcode = '22023';
  end if;
  if p_monto is not null and (p_monto < 0 or p_monto > 9999999999) then raise exception 'El presupuesto no puede ser negativo' using errcode = '22023'; end if;
  if p_monto is null or p_monto = 0 then
    delete from public.presupuestos_gasto where gimnasio_id = p_gimnasio_id and categoria = p_categoria;
  else
    insert into public.presupuestos_gasto (gimnasio_id, categoria, monto, actualizado_por)
    values (p_gimnasio_id, p_categoria, round(p_monto, 2), eid)
    on conflict (gimnasio_id, categoria) do update set monto = excluded.monto, actualizado_en = now(), actualizado_por = excluded.actualizado_por;
  end if;
end $$;

-- ── Para el CSV del contador ────────────────────────────────────────
create or replace function public.exportar_gastos(p_gimnasio_id uuid, p_mes date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare es_dueno boolean; m date;
begin
  es_dueno := exists (select 1 from public.equipo where id = privado.exigir_gastos(p_gimnasio_id) and rol = 'dueno');
  if p_mes is null then raise exception 'Falta el mes' using errcode = '22023'; end if;
  m := date_trunc('month', p_mes)::date;
  return coalesce((select jsonb_agg(y order by y ->> 'fecha', y ->> 'categoria') from (
    select jsonb_build_object('fecha', x.fecha, 'categoria', x.categoria, 'detalle', x.detalle, 'monto', x.monto, 'tipo', 'Único',
             'comprobante', x.comprobante_path is not null, 'por', (select e.nombre from public.equipo e where e.id = x.creado_por)) as y
      from public.gastos x where x.gimnasio_id = p_gimnasio_id and x.mes = m and x.anulado_en is null
    union all
    select jsonb_build_object('fecha', m, 'categoria', f.categoria, 'detalle', f.detalle, 'monto', f.monto, 'tipo', 'Fijo', 'comprobante', false,
             'por', (select e.nombre from public.equipo e where e.id = f.creado_por))
      from public.gastos_fijos f
     where es_dueno and f.gimnasio_id = p_gimnasio_id and f.anulado_en is null and f.desde <= m and (f.hasta is null or f.hasta >= m)
  ) z), '[]'::jsonb);
end $$;

revoke all on function public.guardar_permiso_gastos(uuid, boolean), public.ganancia_mes(uuid, date), public.cargar_gasto(uuid, date, text, text, numeric),
  public.anular_gasto(uuid), public.preparar_comprobante_gasto(uuid, text), public.confirmar_comprobante_gasto(uuid, text), public.comprobante_gasto(uuid),
  public.guardar_gasto_fijo(uuid, text, text, numeric, date), public.terminar_gasto_fijo(uuid, date), public.guardar_presupuesto_gasto(uuid, text, numeric),
  public.exportar_gastos(uuid, date) from public, anon, authenticated;
grant execute on function public.guardar_permiso_gastos(uuid, boolean), public.ganancia_mes(uuid, date), public.cargar_gasto(uuid, date, text, text, numeric),
  public.anular_gasto(uuid), public.preparar_comprobante_gasto(uuid, text), public.confirmar_comprobante_gasto(uuid, text), public.comprobante_gasto(uuid),
  public.guardar_gasto_fijo(uuid, text, text, numeric, date), public.terminar_gasto_fijo(uuid, date), public.guardar_presupuesto_gasto(uuid, text, numeric),
  public.exportar_gastos(uuid, date) to authenticated, service_role;

-- La sección "Gastos" se apaga por gimnasio como cualquier otra: entra en la
-- lista de secciones válidas (la función y la restricción de la tabla).
create or replace function privado.secciones_validas() returns text[]
language sql immutable set search_path = '' as $$
  select array['entrada', 'clases', 'vencen_hoy', 'socios', 'retencion', 'rutinas', 'caja', 'vender', 'resultado', 'transferencias', 'gastos']
$$;
revoke all on function privado.secciones_validas() from public;
alter table public.configuracion_gimnasio drop constraint if exists configuracion_secciones_validas;
alter table public.configuracion_gimnasio add constraint configuracion_secciones_validas
  check (secciones_apagadas <@ array['entrada', 'clases', 'vencen_hoy', 'socios', 'retencion', 'rutinas', 'caja', 'vender', 'resultado', 'transferencias', 'gastos']);

-- Bucket privado (en Supabase; la base local no tiene storage).
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Sin esquema storage (base local): se saltea el bucket comprobantes_gastos';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('comprobantes_gastos', 'comprobantes_gastos', false, 6291456, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  on conflict (id) do nothing;
end $$;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text; t text; publico boolean;
begin
  foreach t in array array['public.gastos_fijos', 'public.presupuestos_gasto'] loop
    if not (select relrowsecurity from pg_class where oid = t::regclass) then raise exception 'Verificación: % sin RLS', t; end if;
  end loop;
  foreach f in array array['public.guardar_permiso_gastos(uuid, boolean)', 'public.ganancia_mes(uuid, date)', 'public.cargar_gasto(uuid, date, text, text, numeric)',
    'public.anular_gasto(uuid)', 'public.preparar_comprobante_gasto(uuid, text)', 'public.confirmar_comprobante_gasto(uuid, text)', 'public.comprobante_gasto(uuid)',
    'public.guardar_gasto_fijo(uuid, text, text, numeric, date)', 'public.terminar_gasto_fijo(uuid, date)', 'public.guardar_presupuesto_gasto(uuid, text, numeric)',
    'public.exportar_gastos(uuid, date)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if exists (select 1 from public.gastos where fecha is null) then raise exception 'Verificación: gastos sin fecha'; end if;
  if to_regclass('storage.buckets') is not null then
    execute 'select exists (select 1 from storage.buckets where id = ''comprobantes_gastos'' and public)' into publico;
    if publico then raise exception 'Verificación: el bucket de comprobantes de gastos quedó público'; end if;
  end if;
end $$;
