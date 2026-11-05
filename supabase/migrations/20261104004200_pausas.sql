-- 0042 · Pausas desde la ficha (SOC-9, decisión D7).
-- Las da el dueño o el encargado; la recepción las pide y quedan pendientes
-- hasta que uno de ellos las aprueba o las rechaza. Motivos: viaje, trabajo,
-- estudio u otro (nunca salud). Máximo de días de pausa por socio y por año
-- calendario, configurable (por defecto 30; 0 = el gimnasio no da pausas).
-- La pausa sigue siendo un congelamiento: los días cubiertos se devuelven
-- solos (trigger congelamientos_compensar, 0006) y la entrada dice
-- "Congelada · vuelve el …".

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.grupos_familiares') is null then raise exception 'Guarda: falta la migración 0041'; end if;
  if to_regprocedure('privado.congelar(uuid, date, date, text, text, uuid, boolean)') is null then
    raise exception 'Guarda: falta privado.congelar (0006)';
  end if;
end $$;

-- ── Máximo de días por año ──────────────────────────────────────────
alter table public.configuracion_gimnasio add column if not exists pausa_dias_por_anio int;
update public.configuracion_gimnasio set pausa_dias_por_anio = 30 where pausa_dias_por_anio is null;
alter table public.configuracion_gimnasio alter column pausa_dias_por_anio set default 30;
alter table public.configuracion_gimnasio alter column pausa_dias_por_anio set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_pausa_dias_rango') then
    alter table public.configuracion_gimnasio add constraint configuracion_pausa_dias_rango check (pausa_dias_por_anio between 0 and 365);
  end if;
end $$;

-- ── Motivos de D7 (los de antes siguen valiendo para lo ya cargado) ──
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'congelamientos_categoria_d7') then
    alter table public.congelamientos drop constraint if exists congelamientos_categoria_check;
    alter table public.congelamientos add constraint congelamientos_categoria_d7
      check (categoria in ('viaje', 'trabajo', 'estudio', 'otro', 'personal', 'economico'));
  end if;
end $$;

-- ── Pedidos de la recepción ─────────────────────────────────────────
create table if not exists public.pedidos_pausa (
  id               uuid primary key default gen_random_uuid(),
  gimnasio_id      uuid not null references public.gimnasios(id),
  socio_id         uuid not null,
  suscripcion_id   uuid not null,
  desde            timestamptz not null,
  hasta            timestamptz not null,
  categoria        text not null check (categoria in ('viaje', 'trabajo', 'estudio', 'otro')),
  nota             text check (nota is null or length(nota) <= 300),
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  pedido_en        timestamptz not null default now(),
  pedido_por       uuid references auth.users(id),
  resuelto_en      timestamptz,
  resuelto_por     uuid references auth.users(id),
  congelamiento_id uuid,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, suscripcion_id) references public.suscripciones (gimnasio_id, id),
  foreign key (gimnasio_id, congelamiento_id) references public.congelamientos (gimnasio_id, id),
  check (hasta > desde),
  check ((estado = 'pendiente') = (resuelto_en is null)),
  check ((estado = 'aprobado') = (congelamiento_id is not null))
);
create index if not exists pedidos_pausa_pendientes on public.pedidos_pausa (gimnasio_id) where estado = 'pendiente';
create index if not exists pedidos_pausa_socio on public.pedidos_pausa (socio_id);
select privado.politicas_estandar('public.pedidos_pausa', array['dueno', 'encargado', 'recepcion'], null);
revoke all on table public.pedidos_pausa from anon;

-- ── Días de pausa de un socio en un año calendario ──────────────────
create or replace function privado.dias_de_pausa(p_socio_id uuid, p_anio int, p_zona text) returns int
language sql stable set search_path = '' as $$
  select coalesce(sum(greatest(0, round(extract(epoch from
           least(coalesce(c.hasta_real, c.hasta_prevista), privado.medianoche(make_date(p_anio + 1, 1, 1), p_zona))
         - greatest(c.desde, privado.medianoche(make_date(p_anio, 1, 1), p_zona))) / 86400))), 0)::int
    from public.congelamientos c
   where c.socio_id = p_socio_id and c.anulado_en is null
$$;
revoke all on function privado.dias_de_pausa(uuid, int, text) from public, anon, authenticated;

-- Valida motivo, fechas y el máximo por año (una pausa que cruza el año se cuenta en cada uno).
create or replace function privado.validar_pausa(p_socio_id uuid, p_gimnasio_id uuid, p_desde date, p_hasta date, p_categoria text)
returns void
language plpgsql stable set search_path = '' as $$
declare zona text; maximo int; y int; usados int; nuevos int;
begin
  if p_categoria is null or p_categoria not in ('viaje', 'trabajo', 'estudio', 'otro') then
    raise exception 'Elegí el motivo: viaje, trabajo, estudio u otro.' using errcode = '22023';
  end if;
  if p_desde is null or p_hasta is null then raise exception 'Poné desde cuándo y el día que vuelve.' using errcode = '22023'; end if;
  if p_hasta <= p_desde then raise exception 'El día que vuelve tiene que ser después del primer día de pausa.' using errcode = '22023'; end if;
  select g.zona_horaria, c.pausa_dias_por_anio into zona, maximo
    from public.gimnasios g join public.configuracion_gimnasio c on c.gimnasio_id = g.id where g.id = p_gimnasio_id;
  if maximo = 0 then raise exception 'Este gimnasio no da pausas (se cambia en Configuración → Reglas).' using errcode = '22023'; end if;
  for y in extract(year from p_desde)::int .. extract(year from p_hasta - 1)::int loop
    nuevos := least(p_hasta, make_date(y + 1, 1, 1)) - greatest(p_desde, make_date(y, 1, 1));
    usados := privado.dias_de_pausa(p_socio_id, y, zona);
    if usados + nuevos > maximo then
      raise exception 'Supera el máximo de % días de pausa por año: en % ya usó % y esta pausa suma %.', maximo, y, usados, nuevos
        using errcode = '22023';
    end if;
  end loop;
end $$;
revoke all on function privado.validar_pausa(uuid, uuid, date, date, text) from public, anon, authenticated;

-- ── Dar una pausa (dueño o encargado). Misma firma que antes. ────────
create or replace function public.congelar(p_suscripcion_id uuid, p_desde date, p_hasta date,
                                           p_categoria text, p_nota text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare s public.suscripciones; v_rol text;
begin
  select * into s from public.suscripciones where id = p_suscripcion_id;
  if s.id is null then raise exception 'Sin permiso o suscripción inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(s.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select e.rol into v_rol from public.equipo e where e.gimnasio_id = s.gimnasio_id and e.usuario_id = auth.uid() and e.activo
   order by e.rol = 'recepcion' limit 1;
  if v_rol = 'recepcion' then
    raise exception 'La pausa la da el dueño o el encargado: pedila con “Pedir pausa” y la aprueban ellos.' using errcode = '42501';
  end if;
  perform privado.validar_pausa(s.socio_id, s.gimnasio_id, p_desde, p_hasta, p_categoria);
  return privado.congelar(p_suscripcion_id, p_desde, p_hasta, p_categoria, nullif(trim(coalesce(p_nota, '')), ''), auth.uid(), true);
end $$;

-- ── La recepción la pide ────────────────────────────────────────────
create or replace function public.pedir_pausa(p_suscripcion_id uuid, p_desde date, p_hasta date, p_categoria text, p_nota text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare s public.suscripciones; zona text; d timestamptz; h timestamptz; pid uuid; v_nota text := nullif(trim(coalesce(p_nota, '')), '');
begin
  select * into s from public.suscripciones where id = p_suscripcion_id;
  if s.id is null then raise exception 'Sin permiso o suscripción inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(s.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if s.baja_en is not null then raise exception 'Esa membresía está dada de baja.'; end if;
  perform privado.validar_pausa(s.socio_id, s.gimnasio_id, p_desde, p_hasta, p_categoria);
  if length(v_nota) > 300 then raise exception 'La nota: hasta 300 letras.' using errcode = '22023'; end if;
  select zona_horaria into zona from public.gimnasios where id = s.gimnasio_id;
  if p_desde < privado.dia_local(now(), zona) then
    raise exception 'Una pausa con fecha pasada la carga el dueño o el encargado.' using errcode = '22023';
  end if;
  d := privado.medianoche(p_desde, zona); h := privado.medianoche(p_hasta, zona);
  if exists (select 1 from public.congelamientos c where c.suscripcion_id = s.id and c.anulado_en is null
              and c.desde < h and coalesce(c.hasta_real, c.hasta_prevista) > d) then
    raise exception 'Ya tiene una pausa en esas fechas.';
  end if;
  if exists (select 1 from public.pedidos_pausa x where x.socio_id = s.socio_id and x.estado = 'pendiente' and x.desde < h and x.hasta > d) then
    raise exception 'Ya hay un pedido de pausa en esas fechas, esperando que lo aprueben.';
  end if;
  insert into public.pedidos_pausa (gimnasio_id, socio_id, suscripcion_id, desde, hasta, categoria, nota, pedido_por)
  values (s.gimnasio_id, s.socio_id, s.id, d, h, p_categoria, v_nota, auth.uid()) returning id into pid;
  return pid;
end $$;

-- ── El dueño o el encargado lo resuelve ─────────────────────────────
create or replace function public.resolver_pedido_pausa(p_pedido_id uuid, p_aprobar boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare x public.pedidos_pausa; zona text; cid uuid; n int;
begin
  select * into x from public.pedidos_pausa where id = p_pedido_id for update;
  if x.id is null then raise exception 'Sin permiso o pedido inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(x.gimnasio_id, array['dueno', 'encargado']);
  if x.estado <> 'pendiente' then raise exception 'Ese pedido ya estaba resuelto.'; end if;
  if p_aprobar is null then raise exception 'Elegí aprobar o rechazar.'; end if;
  if p_aprobar then
    select zona_horaria into zona from public.gimnasios where id = x.gimnasio_id;
    perform privado.validar_pausa(x.socio_id, x.gimnasio_id, privado.dia_local(x.desde, zona), privado.dia_local(x.hasta, zona), x.categoria);
    cid := privado.congelar(x.suscripcion_id, privado.dia_local(x.desde, zona), privado.dia_local(x.hasta, zona), x.categoria, x.nota, auth.uid(), true);
  end if;
  update public.pedidos_pausa set estado = case when p_aprobar then 'aprobado' else 'rechazado' end,
         resuelto_en = now(), resuelto_por = auth.uid(), congelamiento_id = cid
   where id = x.id and estado = 'pendiente';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo resolver el pedido.'; end if;
end $$;

-- ── Lo que muestra la ficha ─────────────────────────────────────────
create or replace function public.pausas_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; zona text; maximo int; v_rol text; su uuid; hoy date;
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  select gi.zona_horaria, c.pausa_dias_por_anio into zona, maximo
    from public.gimnasios gi join public.configuracion_gimnasio c on c.gimnasio_id = gi.id where gi.id = g;
  hoy := privado.dia_local(now(), zona);
  select e.rol into v_rol from public.equipo e where e.gimnasio_id = g and e.usuario_id = auth.uid() and e.activo
   order by e.rol = 'recepcion' limit 1;
  select s.id into su from public.suscripciones s where s.socio_id = p_socio_id and s.baja_en is null order by s.inicio desc limit 1;
  return jsonb_build_object(
    'maximo', maximo,
    'usados', privado.dias_de_pausa(p_socio_id, extract(year from hoy)::int, zona),
    'anio', extract(year from hoy)::int,
    'hoy', hoy,
    'suscripcion_id', su,
    'puede_dar', coalesce(v_rol <> 'recepcion', false),
    'pausas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'desde', privado.dia_local(c.desde, zona), 'vuelve', privado.dia_local(coalesce(c.hasta_real, c.hasta_prevista), zona),
        'categoria', c.categoria, 'nota', c.nota, 'anulada', c.anulado_en is not null,
        'estado', case when c.anulado_en is not null then 'anulada'
                       when c.desde > now() then 'programada'
                       when coalesce(c.hasta_real, c.hasta_prevista) > now() then 'en_curso'
                       else 'terminada' end)
        order by c.desde desc)
      from public.congelamientos c where c.socio_id = p_socio_id), '[]'),
    'pedidos', coalesce((select jsonb_agg(jsonb_build_object(
        'id', x.id, 'desde', privado.dia_local(x.desde, zona), 'vuelve', privado.dia_local(x.hasta, zona),
        'categoria', x.categoria, 'nota', x.nota, 'pedido_en', x.pedido_en,
        'pedido_por', (select e.nombre from public.equipo e where e.gimnasio_id = g and e.usuario_id = x.pedido_por limit 1))
        order by x.desde)
      from public.pedidos_pausa x where x.socio_id = p_socio_id and x.estado = 'pendiente'), '[]'));
end $$;

-- Para Inicio: los pedidos que esperan.
create or replace function public.pedidos_pausa_pendientes(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', x.id, 'socio_id', x.socio_id, 'nombre', trim(s.nombre || ' ' || s.apellido),
      'desde', privado.dia_local(x.desde, zona), 'vuelve', privado.dia_local(x.hasta, zona), 'categoria', x.categoria)
      order by x.pedido_en)
    from public.pedidos_pausa x join public.socios s on s.id = x.socio_id
   where x.gimnasio_id = p_gimnasio_id and x.estado = 'pendiente'), '[]');
end $$;

-- ── Configuración: el máximo se guarda con el resto de las reglas ───
create or replace function public.configuracion_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.configuracion_gimnasio; g public.gimnasios;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  select * into g from public.gimnasios where id = p_gimnasio_id;
  return jsonb_build_object(
    'nombre', g.nombre, 'slug', g.slug,
    'color_acento', c.color_acento, 'color_fondo', c.color_fondo, 'logo_path', c.logo_path,
    'cobra_membresia', c.cobra_membresia, 'cobra_pase', c.cobra_pase, 'cobra_pack', c.cobra_pack,
    'modo_clases', c.modo_clases, 'accesos_activos', to_jsonb(c.accesos_activos),
    'tolerancia_dias', c.tolerancia_dias, 'dias_aviso', c.dias_aviso,
    'reingreso_mismo_dia_consume', c.reingreso_mismo_dia_consume,
    'secciones_apagadas', to_jsonb(c.secciones_apagadas),
    'alias_transferencia', c.alias_transferencia, 'banco_transferencia', c.banco_transferencia, 'medios_aceptados', to_jsonb(c.medios_aceptados), 'cbu', c.cbu, 'titular_cuenta', c.titular_cuenta,
    'descuento_max_recepcion', c.descuento_max_recepcion,
    'retencion_dias_ausencia', c.retencion_dias_ausencia, 'retencion_dias_nuevo', c.retencion_dias_nuevo,
    'retencion_dias_vencido', c.retencion_dias_vencido, 'retencion_dias_se_fue', c.retencion_dias_se_fue,
    'reserva_dias_anticipacion', c.reserva_dias_anticipacion, 'cancelacion_horas_limite', c.cancelacion_horas_limite,
    'pausa_dias_por_anio', c.pausa_dias_por_anio);
end $$;

create or replace function public.guardar_configuracion(p_gimnasio_id uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n int;
  desconocidos text[];
  v_nombre text;
  v_alias text;
  v_cbu text;
  v_titular text;
  v_descuento numeric;
  v_modo text;
  v_accesos text[];
  v_secciones text[];
  v_membresia boolean;
  v_pase boolean;
  v_pack boolean;
  v_tol int; v_aviso int; v_aus int; v_nuevo int; v_venc int; v_fue int; v_res int; v_canc int; v_pausa int;
  v_acento text; v_fondo text; v_reingreso boolean; v_medios text[]; v_banco text; v_secciones_final text[]; v_medios_final text[];
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  select array_agg(k) into desconocidos from jsonb_object_keys(p_datos) k
   where k not in ('nombre', 'color_acento', 'color_fondo', 'cobra_membresia', 'cobra_pase', 'cobra_pack', 'modo_clases',
                   'accesos_activos', 'tolerancia_dias', 'dias_aviso', 'reingreso_mismo_dia_consume', 'secciones_apagadas',
                   'alias_transferencia', 'cbu', 'titular_cuenta', 'descuento_max_recepcion', 'retencion_dias_ausencia',
                   'retencion_dias_nuevo', 'retencion_dias_vencido', 'retencion_dias_se_fue', 'reserva_dias_anticipacion',
                   'cancelacion_horas_limite', 'medios_aceptados', 'banco_transferencia', 'pausa_dias_por_anio');
  if desconocidos is not null then raise exception 'Campos que no se pueden cambiar acá: %', array_to_string(desconocidos, ', '); end if;

  -- Marca
  if p_datos ? 'nombre' then
    v_nombre := trim(coalesce(p_datos ->> 'nombre', ''));
    if v_nombre = '' then raise exception 'El nombre del gimnasio es obligatorio.' using errcode = '22023'; end if;
    if length(v_nombre) > 60 then raise exception 'El nombre del gimnasio puede tener hasta 60 letras.' using errcode = '22023'; end if;
  end if;
  v_acento := privado.config_color(p_datos, 'color_acento', 'Color principal');
  v_fondo := privado.config_color(p_datos, 'color_fondo', 'Color de fondo');

  -- Qué cobrás
  v_membresia := privado.config_booleano(p_datos, 'cobra_membresia', 'Membresía');
  v_pase := privado.config_booleano(p_datos, 'cobra_pase', 'Pase diario');
  v_pack := privado.config_booleano(p_datos, 'cobra_pack', 'Pack de clases');

  -- Medios de pago
  if p_datos ? 'medios_aceptados' then
    if jsonb_typeof(p_datos -> 'medios_aceptados') is distinct from 'array' then raise exception 'Datos inválidos'; end if;
    v_medios := array(select distinct x from jsonb_array_elements_text(p_datos -> 'medios_aceptados') x order by 1);
    if exists (select 1 from unnest(v_medios) x where x <> all (array['efectivo', 'transferencia', 'debito', 'credito'])) then
      raise exception 'Medio de pago desconocido.' using errcode = '22023';
    end if;
    if cardinality(v_medios) = 0 then
      raise exception 'Dejá prendido al menos un medio de pago.' using errcode = '22023';
    end if;
  end if;

  -- Clases y accesos
  if p_datos ? 'modo_clases' then
    v_modo := p_datos ->> 'modo_clases';
    if v_modo is null or v_modo not in ('reserva', 'sin_reserva', 'ninguno') then
      raise exception 'Elegí cómo funcionan las clases: con reserva, sin reserva o sin clases.' using errcode = '22023';
    end if;
  end if;
  if p_datos ? 'accesos_activos' then
    if jsonb_typeof(p_datos -> 'accesos_activos') is distinct from 'array' then raise exception 'Datos inválidos'; end if;
    v_accesos := array(select distinct x from jsonb_array_elements_text(p_datos -> 'accesos_activos') x);
    if exists (select 1 from unnest(v_accesos) x
                where x <> all (array['recepcion', 'qr_socio', 'qr_pared', 'kiosco', 'nfc', 'molinete'])) then
      raise exception 'Forma de entrada desconocida.' using errcode = '22023';
    end if;
    if cardinality(v_accesos) = 0 then
      raise exception 'Dejá prendida al menos una forma de entrar al gimnasio.' using errcode = '22023';
    end if;
  end if;
  if p_datos ? 'secciones_apagadas' then
    if jsonb_typeof(p_datos -> 'secciones_apagadas') is distinct from 'array' then raise exception 'Datos inválidos'; end if;
    v_secciones := array(select distinct x from jsonb_array_elements_text(p_datos -> 'secciones_apagadas') x);
    if exists (select 1 from unnest(v_secciones) x where x <> all (privado.secciones_validas())) then
      raise exception 'Sección desconocida';
    end if;
  end if;

  -- Reglas
  v_tol := privado.config_entero(p_datos, 'tolerancia_dias', 0, 60, 'Días de tolerancia');
  v_aviso := privado.config_entero(p_datos, 'dias_aviso', 0, 30, 'Días de aviso antes del vencimiento');
  v_reingreso := privado.config_booleano(p_datos, 'reingreso_mismo_dia_consume', 'Volver a entrar el mismo día');
  if p_datos ? 'descuento_max_recepcion' then
    begin
      v_descuento := nullif(trim(coalesce(p_datos ->> 'descuento_max_recepcion', '')), '')::numeric;
    exception when invalid_text_representation then
      raise exception 'Descuento máximo de recepción: tiene que ser un número entre 0 y 100.' using errcode = '22023';
    end;
    if v_descuento is null then raise exception 'Descuento máximo de recepción: no puede quedar vacío, poné un número entre 0 y 100.' using errcode = '22023'; end if;
    if v_descuento < 0 or v_descuento > 100 then raise exception 'Descuento máximo de recepción: tiene que estar entre 0 y 100 %%.' using errcode = '22023'; end if;
  end if;
  v_aus := privado.config_entero(p_datos, 'retencion_dias_ausencia', 3, 90, 'Días sin venir para avisar');
  v_nuevo := privado.config_entero(p_datos, 'retencion_dias_nuevo', 7, 90, 'Días que un socio cuenta como nuevo');
  v_venc := privado.config_entero(p_datos, 'retencion_dias_vencido', 1, 120, 'Días vencido para avisar');
  v_fue := privado.config_entero(p_datos, 'retencion_dias_se_fue', 7, 365, 'Días para darlo por ido');
  v_res := privado.config_entero(p_datos, 'reserva_dias_anticipacion', 0, 60, 'Días de anticipación para reservar');
  v_canc := privado.config_entero(p_datos, 'cancelacion_horas_limite', 0, 72, 'Horas límite para cancelar');
  v_pausa := privado.config_entero(p_datos, 'pausa_dias_por_anio', 0, 365, 'Pausa: máximo de días por año');

  -- Transferencias
  if p_datos ? 'alias_transferencia' then
    v_alias := nullif(trim(coalesce(p_datos ->> 'alias_transferencia', '')), '');
    if v_alias is not null and v_alias !~ '^[A-Za-z0-9.-]{6,20}$' then
      raise exception 'El alias tiene que tener de 6 a 20 caracteres: letras, números, puntos o guiones, sin espacios.' using errcode = '22023';
    end if;
  end if;
  if p_datos ? 'cbu' then
    v_cbu := nullif(regexp_replace(coalesce(p_datos ->> 'cbu', ''), '[\s-]', '', 'g'), '');
    if v_cbu is not null and v_cbu !~ '^[0-9]{22}$' then
      raise exception 'El CBU o CVU tiene 22 números (sin letras). El que pusiste tiene %.', length(regexp_replace(v_cbu, '\D', '', 'g'))
        using errcode = '22023';
    end if;
  end if;
  if p_datos ? 'banco_transferencia' then
    v_banco := nullif(trim(coalesce(p_datos ->> 'banco_transferencia', '')), '');
    if length(v_banco) > 60 then raise exception 'El banco puede tener hasta 60 letras.' using errcode = '22023'; end if;
  end if;
  if p_datos ? 'titular_cuenta' then
    v_titular := nullif(trim(coalesce(p_datos ->> 'titular_cuenta', '')), '');
    if length(v_titular) > 80 then raise exception 'El titular de la cuenta puede tener hasta 80 letras.' using errcode = '22023'; end if;
  end if;

  if v_nombre is not null then
    update public.gimnasios set nombre = v_nombre where id = p_gimnasio_id;
  end if;

  update public.configuracion_gimnasio c set
    color_acento = coalesce(v_acento, c.color_acento),
    color_fondo = coalesce(v_fondo, c.color_fondo),
    cobra_membresia = coalesce(v_membresia, c.cobra_membresia),
    cobra_pase = coalesce(v_pase, c.cobra_pase),
    cobra_pack = coalesce(v_pack, c.cobra_pack),
    modo_clases = coalesce(v_modo, c.modo_clases),
    accesos_activos = case when p_datos ? 'accesos_activos' then v_accesos else c.accesos_activos end,
    tolerancia_dias = coalesce(v_tol, c.tolerancia_dias),
    dias_aviso = coalesce(v_aviso, c.dias_aviso),
    reingreso_mismo_dia_consume = coalesce(v_reingreso, c.reingreso_mismo_dia_consume),
    secciones_apagadas = case when p_datos ? 'secciones_apagadas' then v_secciones else c.secciones_apagadas end,
    alias_transferencia = case when p_datos ? 'alias_transferencia' then v_alias else c.alias_transferencia end,
    cbu = case when p_datos ? 'cbu' then v_cbu else c.cbu end,
    titular_cuenta = case when p_datos ? 'titular_cuenta' then v_titular else c.titular_cuenta end,
    banco_transferencia = case when p_datos ? 'banco_transferencia' then v_banco else c.banco_transferencia end,
    medios_aceptados = coalesce(v_medios, c.medios_aceptados),
    descuento_max_recepcion = coalesce(v_descuento, c.descuento_max_recepcion),
    retencion_dias_ausencia = coalesce(v_aus, c.retencion_dias_ausencia),
    retencion_dias_nuevo = coalesce(v_nuevo, c.retencion_dias_nuevo),
    retencion_dias_vencido = coalesce(v_venc, c.retencion_dias_vencido),
    retencion_dias_se_fue = coalesce(v_fue, c.retencion_dias_se_fue),
    reserva_dias_anticipacion = coalesce(v_res, c.reserva_dias_anticipacion),
    cancelacion_horas_limite = coalesce(v_canc, c.cancelacion_horas_limite),
    pausa_dias_por_anio = coalesce(v_pausa, c.pausa_dias_por_anio),
    actualizado_en = now()
   where c.gimnasio_id = p_gimnasio_id
  returning c.cobra_membresia, c.cobra_pase, c.cobra_pack, c.secciones_apagadas, c.medios_aceptados
       into v_membresia, v_pase, v_pack, v_secciones_final, v_medios_final;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la configuración'; end if;
  if not (v_membresia or v_pase or v_pack) then
    raise exception 'Dejá prendida al menos una forma de cobrar (membresía, pase diario o pack de clases).' using errcode = '22023';
  end if;
  -- Sin Caja no se cobra en efectivo: si es el único medio, no quedaría cómo cobrar.
  if 'caja' = any (v_secciones_final) and v_medios_final <@ array['efectivo'] then
    raise exception 'Sin Caja no se cobra en efectivo, y es el único medio prendido: prendé otro medio de pago o dejá Caja prendida.' using errcode = '22023';
  end if;
end $$;

create or replace function privado.etiqueta_campo(p_campo text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_campo like 'mensaje.%' then 'Mensaje “' || coalesce((select x ->> 'titulo' from jsonb_array_elements(privado.mensajes_catalogo()) x
                                                              where x ->> 'clave' = substr(p_campo, 9)), substr(p_campo, 9)) || '”'
    -- "Sede principal: dirección" (no "Sede Sede principal"); "Sede Centro: dirección".
    when p_campo like 'sede.%' then case when split_part(p_campo, '.', 2) ilike 'sede%' then '' else 'Sede ' end
      || split_part(p_campo, '.', 2) || ': ' || case split_part(p_campo, '.', 3)
      when 'nombre' then 'nombre' when 'direccion' then 'dirección' when 'telefono' then 'teléfono' when 'mapa_url' then 'link del mapa'
      else split_part(p_campo, '.', 3) end
    else coalesce(jsonb_build_object(
      'nombre', 'Nombre del gimnasio', 'color_acento', 'Color principal', 'color_fondo', 'Color de fondo', 'logo_path', 'Logo',
      'favicon_path', 'Ícono de la pestaña', 'cobra_membresia', 'Cobra membresía', 'cobra_pase', 'Cobra pase diario',
      'cobra_pack', 'Cobra packs de clases', 'modo_clases', 'Clases', 'accesos_activos', 'Formas de entrada',
      'tolerancia_dias', 'Días de gracia al vencer', 'dias_aviso', 'Avisar que vence (días antes)',
      'reingreso_mismo_dia_consume', 'Volver a entrar el mismo día gasta otra entrada', 'secciones_apagadas', 'Secciones apagadas',
      'alias_transferencia', 'Alias', 'cbu', 'CBU / CVU', 'titular_cuenta', 'Titular de la cuenta', 'banco_transferencia', 'Banco o billetera',
      'medios_aceptados', 'Medios de pago', 'descuento_max_recepcion', 'Descuento máximo de la recepción (%)',
      'retencion_dias_ausencia', '“No viene” después de (días)', 'retencion_dias_nuevo', 'Socio nuevo durante (días)',
      'retencion_dias_vencido', 'Vencido pasa a “se fue” después de (días)', 'retencion_dias_se_fue', 'Los que se fueron se muestran durante (días)',
      'reserva_dias_anticipacion', 'Se reserva con hasta (días)', 'cancelacion_horas_limite', 'Cancelar hasta (horas antes)',
      'pagina.publicada', 'Página publicada', 'pagina.whatsapp', 'WhatsApp', 'pagina.instagram', 'Instagram',
      'pagina.email_contacto', 'Mail de contacto', 'altas_online', 'Altas online desde la página',
      'pausa_dias_por_anio', 'Pausa: máximo de días por año') ->> p_campo, p_campo)
  end
$$;
revoke all on function privado.etiqueta_campo(text) from public, anon, authenticated;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.congelar(uuid, date, date, text, text), public.pedir_pausa(uuid, date, date, text, text),
  public.resolver_pedido_pausa(uuid, boolean), public.pausas_socio(uuid), public.pedidos_pausa_pendientes(uuid),
  public.configuracion_panel(uuid), public.guardar_configuracion(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.congelar(uuid, date, date, text, text), public.pedir_pausa(uuid, date, date, text, text),
  public.resolver_pedido_pausa(uuid, boolean), public.pausas_socio(uuid), public.pedidos_pausa_pendientes(uuid),
  public.configuracion_panel(uuid), public.guardar_configuracion(uuid, jsonb) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.pedidos_pausa'::regclass) then raise exception 'Verificación: pedidos_pausa sin RLS'; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'pedidos_pausa' and cmd <> 'SELECT') then
    raise exception 'Verificación: pedidos_pausa se puede escribir desde el cliente';
  end if;
  if exists (select 1 from public.configuracion_gimnasio where pausa_dias_por_anio is null) then raise exception 'Verificación: falta el máximo de pausa'; end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'public' and p.proname in ('congelar', 'pedir_pausa', 'resolver_pedido_pausa', 'pausas_socio',
                                                          'pedidos_pausa_pendientes', 'configuracion_panel', 'guardar_configuracion'))
               or (s.nspname = 'privado' and p.proname in ('dias_de_pausa', 'validar_pausa', 'etiqueta_campo')) loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
end $$;
