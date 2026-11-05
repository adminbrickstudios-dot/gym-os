-- 0129 · Cupones (COM-9).
-- El dueño crea un código (por ciento o monto fijo), con tope de usos,
-- vencimiento y los planes a los que aplica (vacío = a todos los planes; a
-- los productos nunca). En Vender, la recepción escribe el código y el
-- descuento se carga en cada línea que corresponde, con el motivo "Cupón X":
-- es el mismo descuento de siempre, así que sigue valiendo el tope de la
-- recepción (el cobro no cambia). Al cobrar, la venta queda anotada como uso
-- del cupón. El Resultado dice cuántos socios trajo cada código.
--   guardar_cupon / desactivar_cupon        dueño
--   cupones_panel(gimnasio)                  dueño y encargado: usos y socios
--   validar_cupon(gimnasio, codigo)          mostrador: si vale y cuánto
--   registrar_uso_cupon(venta, codigo)       mostrador, después de cobrar

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.vender(uuid, jsonb, jsonb, uuid, uuid)') is null then raise exception 'Guarda: falta vender'; end if;
end $$;

create table if not exists public.cupones (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  codigo       text not null check (codigo ~ '^[A-Z0-9]{3,20}$'),
  tipo         text not null check (tipo in ('porcentaje', 'monto')),
  valor        numeric(12,2) not null check (valor > 0),
  tope_usos    int check (tope_usos is null or tope_usos >= 1),
  vence_en     timestamptz,
  planes       uuid[],
  activo       boolean not null default true,
  creado_por   uuid not null,
  creado_en    timestamptz not null default now(),
  check (tipo <> 'porcentaje' or valor <= 100),
  unique (gimnasio_id, id),
  unique (gimnasio_id, codigo),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id)
);
select privado.politicas_estandar('public.cupones', array['dueno', 'encargado'], null, false);
revoke all on table public.cupones from anon;
revoke truncate, references, trigger on public.cupones from authenticated;

create table if not exists public.cupones_usos (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  cupon_id     uuid not null,
  venta_id     uuid not null,
  socio_id     uuid,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, venta_id),
  foreign key (gimnasio_id, cupon_id) references public.cupones (gimnasio_id, id),
  foreign key (gimnasio_id, venta_id) references public.ventas (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id)
);
create index if not exists cupones_usos_por_cupon on public.cupones_usos (cupon_id);
select privado.politicas_estandar('public.cupones_usos', array['dueno', 'encargado'], null, false);
revoke all on table public.cupones_usos from anon;
revoke truncate, references, trigger on public.cupones_usos from authenticated;

create or replace function privado.usos_cupon(p_cupon_id uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.cupones_usos u join public.ventas v on v.id = u.venta_id
   where u.cupon_id = p_cupon_id and v.estado <> 'anulada'
$$;
revoke all on function privado.usos_cupon(uuid) from public, anon, authenticated;

create or replace function public.guardar_cupon(p_gimnasio_id uuid, p_codigo text, p_tipo text, p_valor numeric, p_tope_usos int default null,
                                                p_vence date default null, p_planes uuid[] default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; v_cod text := upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g')); v_id uuid; zona text;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if v_cod !~ '^[A-Z0-9]{3,20}$' then raise exception 'El código va de 3 a 20 letras o números, sin espacios (ej: VERANO25).' using errcode = '22023'; end if;
  if p_tipo not in ('porcentaje', 'monto') then raise exception 'Elegí si descuenta un porcentaje o un monto.' using errcode = '22023'; end if;
  if p_valor is null or p_valor <= 0 or (p_tipo = 'porcentaje' and p_valor > 100) or p_valor > 10000000 then
    raise exception 'El descuento no es válido (porcentaje de 1 a 100, o un monto).' using errcode = '22023';
  end if;
  if p_tope_usos is not null and p_tope_usos < 1 then raise exception 'El tope de usos es un número mayor a cero (o vacío: sin tope).' using errcode = '22023'; end if;
  if exists (select 1 from unnest(coalesce(p_planes, '{}')) x where x not in (select p.id from public.planes p where p.gimnasio_id = p_gimnasio_id)) then
    raise exception 'Uno de los planes no es de este gimnasio' using errcode = '22023';
  end if;
  if exists (select 1 from public.cupones c where c.gimnasio_id = p_gimnasio_id and c.codigo = v_cod) then
    raise exception 'Ya hay un cupón %: elegí otro código.', v_cod using errcode = '23505';
  end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  insert into public.cupones (gimnasio_id, codigo, tipo, valor, tope_usos, vence_en, planes, creado_por)
  values (p_gimnasio_id, v_cod, p_tipo, round(p_valor, 2), p_tope_usos,
          case when p_vence is null then null else privado.medianoche(p_vence + 1, zona) end,
          nullif(p_planes, '{}'), e.id)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.desactivar_cupon(p_cupon_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.cupones; n int;
begin
  select * into c from public.cupones where id = p_cupon_id;
  if not found then raise exception 'Sin permiso o cupón inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(c.gimnasio_id, array['dueno']);
  update public.cupones set activo = false where id = c.id and activo;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese cupón ya estaba desactivado' using errcode = '22023'; end if;
end $$;

create or replace function public.cupones_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'cupon_id', c.id, 'codigo', c.codigo, 'tipo', c.tipo, 'valor', c.valor, 'tope_usos', c.tope_usos, 'vence_en', c.vence_en, 'activo', c.activo,
      'planes', (select coalesce(jsonb_agg(p.nombre order by p.nombre), '[]') from public.planes p where p.id = any (coalesce(c.planes, '{}'))),
      'usos', privado.usos_cupon(c.id),
      'socios', (select count(distinct u.socio_id) from public.cupones_usos u join public.ventas v on v.id = u.venta_id where u.cupon_id = c.id and v.estado <> 'anulada'))
      order by c.activo desc, c.creado_en desc)
    from public.cupones c where c.gimnasio_id = p_gimnasio_id), '[]');
end $$;

-- Si el código vale hoy: tipo, valor y planes (Vender calcula el descuento de cada línea con esto).
create or replace function public.validar_cupon(p_gimnasio_id uuid, p_codigo text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.cupones; v_cod text := upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select * into c from public.cupones where gimnasio_id = p_gimnasio_id and codigo = v_cod;
  if not found or not c.activo then raise exception 'No hay un cupón % activo.', v_cod using errcode = '22023'; end if;
  if c.vence_en is not null and c.vence_en <= now() then raise exception 'El cupón % ya venció.', v_cod using errcode = '22023'; end if;
  if c.tope_usos is not null and privado.usos_cupon(c.id) >= c.tope_usos then raise exception 'El cupón % ya se usó las % veces que tenía.', v_cod, c.tope_usos using errcode = '22023'; end if;
  return jsonb_build_object('cupon_id', c.id, 'codigo', c.codigo, 'tipo', c.tipo, 'valor', c.valor, 'planes', to_jsonb(coalesce(c.planes, '{}')));
end $$;

-- Después de cobrar: la venta tiene que ser de este gimnasio, no estar anulada y llevar el descuento "Cupón X".
create or replace function public.registrar_uso_cupon(p_venta_id uuid, p_codigo text) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.ventas; c public.cupones; v_cod text := upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
begin
  select * into v from public.ventas where id = p_venta_id;
  if not found then raise exception 'Sin permiso o venta inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(v.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select * into c from public.cupones where gimnasio_id = v.gimnasio_id and codigo = v_cod;
  if not found then raise exception 'No hay un cupón %.', v_cod using errcode = '22023'; end if;
  if v.estado = 'anulada' then raise exception 'La venta está anulada' using errcode = '22023'; end if;
  if not exists (select 1 from public.venta_items i where i.venta_id = v.id and i.descuento > 0 and i.descuento_motivo = 'Cupón ' || c.codigo) then
    raise exception 'Esa venta no tiene el descuento del cupón %.', c.codigo using errcode = '22023';
  end if;
  insert into public.cupones_usos (gimnasio_id, cupon_id, venta_id, socio_id) values (v.gimnasio_id, c.id, v.id, v.socio_id)
  on conflict (gimnasio_id, venta_id) do nothing;
end $$;

revoke all on function public.guardar_cupon(uuid, text, text, numeric, int, date, uuid[]), public.desactivar_cupon(uuid), public.cupones_panel(uuid),
  public.validar_cupon(uuid, text), public.registrar_uso_cupon(uuid, text) from public, anon, authenticated;
grant execute on function public.guardar_cupon(uuid, text, text, numeric, int, date, uuid[]), public.desactivar_cupon(uuid), public.cupones_panel(uuid),
  public.validar_cupon(uuid, text), public.registrar_uso_cupon(uuid, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.cupones'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.cupones_usos'::regclass) then raise exception 'Verificación: cupones sin RLS'; end if;
  if has_function_privilege('anon', 'public.validar_cupon(uuid, text)', 'execute') then raise exception 'Verificación: validar_cupon quedó para anon'; end if;
end $$;
