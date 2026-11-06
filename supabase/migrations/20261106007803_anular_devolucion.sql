-- VD-46U · Topes y motivos de cortesías y devoluciones en Configuración → Reglas, y anular una devolución registrada por error.
-- Una devolución es un HECHO (inmutable). Anularla no la borra: escribe otro hecho, devoluciones_anuladas (quién, cuándo, por qué),
-- y libera los períodos que había devuelto para poder registrarla de nuevo bien. Si la devolución fue en efectivo y el dueño o el
-- encargado confirma que la plata VOLVIÓ a la caja, se anota un ingreso en SU caja abierta (nunca se toca el retiro original).
--   anular_devolucion(devolucion, motivo, reintegro_caja)   solo dueño y encargado, con motivo; una sola vez por devolución
--   devoluciones_socio(socio)                               lo que muestra la ficha (dueño y encargado)
--   reglas_beneficios(gimnasio)                             topes, motivos y regla de devolución, para Configuración → Reglas
-- Copias de las definiciones VIGENTES (20261106007203): privado.calcular_devolucion_baja, public.calcular_devolucion_baja y
-- public.moderacion_control (Control marca la devolución anulada). Quien toque moderacion_control después copia ESTA versión.

-- ── Guarda de entrada ──────────────────────────────────────────────
do $$
begin
  if to_regclass('public.devoluciones') is null or to_regclass('public.devoluciones_items') is null then raise exception 'Guarda: faltan las devoluciones (7203)'; end if;
  if to_regprocedure('privado.calcular_devolucion_baja(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.calcular_devolucion_baja'; end if;
  if to_regprocedure('public.moderacion_control(uuid, date, date, int)') is null then raise exception 'Guarda: falta moderacion_control'; end if;
  if to_regprocedure('public.beneficios_mes(uuid)') is null then raise exception 'Guarda: falta beneficios_mes (7201)'; end if;
end $$;

-- ── El hecho de la anulación ────────────────────────────────────────
create table if not exists public.devoluciones_anuladas (
  id                  uuid primary key default gen_random_uuid(),
  gimnasio_id         uuid not null references public.gimnasios(id),
  devolucion_id       uuid not null,
  motivo              text not null check (length(trim(motivo)) between 3 and 300),
  reintegro_caja      boolean not null default false,
  movimiento_caja_id  uuid,
  anulada_por         uuid not null,
  anulada_en          timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, devolucion_id),
  foreign key (gimnasio_id, devolucion_id) references public.devoluciones (gimnasio_id, id),
  foreign key (gimnasio_id, anulada_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, movimiento_caja_id) references public.movimientos_caja (gimnasio_id, id),
  check (not reintegro_caja or movimiento_caja_id is not null)
);
create index if not exists devoluciones_anuladas_devolucion on public.devoluciones_anuladas (devolucion_id);
select privado.politicas_estandar('public.devoluciones_anuladas', array['dueno', 'encargado'], '{}');
revoke all on table public.devoluciones_anuladas from anon;
revoke truncate, references, trigger on public.devoluciones_anuladas from authenticated;
drop trigger if exists devoluciones_anuladas_inmutable on public.devoluciones_anuladas;
create trigger devoluciones_anuladas_inmutable before update or delete on public.devoluciones_anuladas for each row execute function privado.hecho_inmutable('_nada_');

-- Cada período se devuelve una sola vez MIENTRAS la devolución esté en pie. El unique de (gimnasio, cobertura) no deja volver a devolver
-- lo de una devolución anulada, así que pasa a ser una verificación (con candado: dos registros a la vez no la burlan).
do $$
declare c text;
begin
  select k.conname into c from pg_constraint k
   where k.conrelid = 'public.devoluciones_items'::regclass and k.contype = 'u'
     and (select array_agg(a.attname::text order by a.attname::text) from pg_attribute a where a.attrelid = k.conrelid and a.attnum = any (k.conkey)) = array['cobertura_id', 'gimnasio_id'];
  if c is not null then execute format('alter table public.devoluciones_items drop constraint %I', c); end if;
end $$;
create index if not exists devoluciones_items_cobertura on public.devoluciones_items (cobertura_id);
create or replace function privado.devolucion_item_unico() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('devolucion_item:' || new.cobertura_id::text, 0));
  if exists (select 1 from public.devoluciones_items di
              where di.cobertura_id = new.cobertura_id
                and not exists (select 1 from public.devoluciones_anuladas a where a.devolucion_id = di.devolucion_id)) then
    raise exception 'Ese período ya tiene una devolución' using errcode = 'unique_violation';
  end if;
  return new;
end $$;
revoke all on function privado.devolucion_item_unico() from public, anon, authenticated;
drop trigger if exists devoluciones_items_unico on public.devoluciones_items;
create trigger devoluciones_items_unico before insert on public.devoluciones_items for each row execute function privado.devolucion_item_unico();

-- ── Copia de 7203: el cálculo, sin lo que ya se devolvió y sigue en pie ──
create or replace function privado.calcular_devolucion_baja(p_socio_id uuid, p_momento timestamptz) returns jsonb
language plpgsql stable set search_path = '' as $$
declare so public.socios; modo text; zona text; dia date; lineas jsonb; total numeric;
begin
  select * into so from public.socios where id = p_socio_id;
  if not found then return null; end if;
  select c.devolucion_baja_modo into modo from public.configuracion_gimnasio c where c.gimnasio_id = so.gimnasio_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = so.gimnasio_id;
  dia := privado.dia_local(p_momento, zona);
  select coalesce(jsonb_agg(jsonb_build_object('cobertura_id', x.cobertura_id, 'venta_id', x.venta_id, 'concepto', x.descripcion, 'desde', x.desde, 'hasta', x.hasta,
           'pagado', x.pagado, 'dias_total', x.dias_total, 'dias_sin_usar', x.dias_sin_usar, 'empezado', not x.sin_empezar, 'medios', x.medios,
           'a_devolver', x.a_devolver) order by x.desde), '[]'::jsonb),
         coalesce(sum(x.a_devolver), 0)
    into lineas, total
    from (
      select y.*, case when modo = 'ninguna' then 0
                       when y.sin_empezar then y.pagado
                       when modo = 'proporcional' and y.dias_total > 0 then round(y.pagado * y.dias_sin_usar / y.dias_total, 2)
                       else 0 end as a_devolver
        from (
          select c.id as cobertura_id, v.id as venta_id, i.descripcion, c.desde, c.hasta,
                 round((i.cantidad * i.precio_unitario - i.descuento) / i.cantidad, 2) as pagado,
                 (privado.dia_local(c.hasta, zona) - privado.dia_local(c.desde, zona)) as dias_total,
                 greatest(privado.dia_local(c.hasta, zona) - greatest(privado.dia_local(c.desde, zona), dia), 0) as dias_sin_usar,
                 (privado.dia_local(c.desde, zona) >= dia) as sin_empezar,
                 (select string_agg(distinct p.medio, ', ') from public.pagos p where p.venta_id = v.id and p.estado = 'aprobado') as medios
            from public.coberturas c
            join public.venta_items i on i.id = c.venta_item_id
            join public.ventas v on v.id = i.venta_id
           where c.socio_id = p_socio_id and c.origen = 'pago' and c.anulada_en is null and v.estado = 'confirmada'
             and c.hasta > p_momento and i.cantidad > 0
             -- VD-46U: una devolución anulada libera sus períodos (se pueden volver a devolver)
             and not exists (select 1 from public.devoluciones_items di
                              where di.cobertura_id = c.id
                                and not exists (select 1 from public.devoluciones_anuladas a where a.devolucion_id = di.devolucion_id))
        ) y
    ) x
   where x.a_devolver > 0;
  return jsonb_build_object('modo', modo, 'momento', p_momento, 'lineas', lineas, 'total', total);
end $$;
revoke all on function privado.calcular_devolucion_baja(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.calcular_devolucion_baja(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare so public.socios; e public.equipo; r jsonb;
begin
  select * into so from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(so.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  r := privado.calcular_devolucion_baja(p_socio_id, coalesce(so.dado_de_baja_en, now()));
  r := r || jsonb_build_object('dado_de_baja', so.dado_de_baja_en is not null, 'puede_registrar', e.rol in ('dueno', 'encargado') and so.dado_de_baja_en is not null,
         'ya_registrada', exists (select 1 from public.devoluciones d where d.socio_id = p_socio_id and d.creado_en >= coalesce(so.dado_de_baja_en, now())
                                  and not exists (select 1 from public.devoluciones_anuladas a where a.devolucion_id = d.id)));
  -- La plata la ve el dueño o el encargado: la recepción solo sabe que hay algo para evaluar.
  if e.rol = 'recepcion' then
    return jsonb_build_object('modo', r -> 'modo', 'hay', (r ->> 'total')::numeric > 0, 'dado_de_baja', r -> 'dado_de_baja', 'puede_registrar', false);
  end if;
  return r || jsonb_build_object('hay', (r ->> 'total')::numeric > 0);
end $$;

-- ── Copia de 7203: Control marca la devolución anulada ──
create or replace function public.moderacion_control(p_gimnasio_id uuid, p_desde date, p_hasta date, p_limite int default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; ini timestamptz; fin timestamptz; lim int := coalesce(p_limite, 50); filas jsonb;
begin
  perform privado.exigir_resultado(p_gimnasio_id);
  if p_desde is null or p_hasta is null or p_hasta < p_desde then raise exception 'Elegí desde y hasta qué día.' using errcode = '22023'; end if;
  if p_hasta - p_desde > 366 then raise exception 'Se mira hasta un año por vez.' using errcode = '22023'; end if;
  if lim < 1 or lim > 200 then raise exception 'Se piden de 1 a 200 por vez.' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  ini := privado.medianoche(p_desde, zona);
  fin := privado.medianoche(p_hasta + 1, zona);
  select coalesce(jsonb_agg(jsonb_build_object('tipo', u.tipo, 'clave', u.clave, 'en', u.en, 'quien', u.quien, 'socio_id', u.socio_id,
           'socio', nullif(trim(s.nombre || ' ' || s.apellido), ''), 'monto', u.monto, 'detalle', u.detalle) order by u.en desc, u.clave desc), '[]'::jsonb)
    into filas
    from (
      select * from (
        (select x.tipo::text as tipo, x.creado_en as en, 'susp:' || x.id::text as clave, q.nombre::text as quien, x.socio_id,
                null::numeric as monto,
                (x.motivo || case when x.hasta is not null then ' · hasta el ' || to_char(x.hasta at time zone zona, 'DD/MM') else '' end)::text as detalle
           from public.suspensiones x left join public.equipo q on q.gimnasio_id = x.gimnasio_id and q.usuario_id = x.creado_por
          where x.gimnasio_id = p_gimnasio_id and x.creado_en >= ini and x.creado_en < fin
          order by x.creado_en desc limit lim)
        union all
        (select 'levantamiento'::text, x.levantada_en, 'levanta:' || x.id::text, q.nombre::text, x.socio_id, null::numeric,
                (coalesce(x.levantada_motivo, '') || ' (era: ' || x.motivo || ')')::text
           from public.suspensiones x left join public.equipo q on q.gimnasio_id = x.gimnasio_id and q.usuario_id = x.levantada_por
          where x.gimnasio_id = p_gimnasio_id and x.levantada_en >= ini and x.levantada_en < fin
          order by x.levantada_en desc limit lim)
        union all
        (select 'cortesia'::text, c.creado_en, 'cortesia:' || c.id::text, q.nombre::text, c.socio_id, null::numeric,
                (round(extract(epoch from (c.hasta - c.desde)) / 86400)::int || case when round(extract(epoch from (c.hasta - c.desde)) / 86400)::int = 1 then ' día' else ' días' end
                 || ' · ' || coalesce(c.motivo, '') || case when c.anulada_en is not null then ' · ANULADA: ' || coalesce(c.anulada_motivo, '') else '' end)::text
           from public.coberturas c left join public.equipo q on q.gimnasio_id = c.gimnasio_id and q.usuario_id = c.creado_por
          where c.gimnasio_id = p_gimnasio_id and c.origen = 'cortesia' and c.creado_en >= ini and c.creado_en < fin
          order by c.creado_en desc limit lim)
        union all
        (select 'baja'::text, so.dado_de_baja_en, 'baja:' || so.id::text, q.nombre::text, so.id, null::numeric,
                (coalesce(so.motivo_baja, 'sin motivo') || coalesce(' · ' || pb.codigo, ''))::text
           from public.socios so
           left join lateral (select p.codigo, p.resuelto_por from public.pedidos_baja p
                               where p.socio_id = so.id and p.estado = 'dado_de_baja' order by p.resuelto_en desc limit 1) pb on true
           left join public.equipo q on q.id = pb.resuelto_por
          where so.gimnasio_id = p_gimnasio_id and so.dado_de_baja_en >= ini and so.dado_de_baja_en < fin
          order by so.dado_de_baja_en desc limit lim)
        union all
        -- VD-46J: devoluciones (hechos nuevos: el pago original no se toca)
        (select 'devolucion'::text, d.creado_en, 'devolucion:' || d.id::text, q.nombre::text, d.socio_id, d.monto,
                (case d.medio when 'efectivo' then 'En efectivo' when 'transferencia' then 'Por transferencia' when 'mercadopago' then 'Por MercadoPago' when 'ninguno' then 'No se devuelve' else 'Otro medio' end
                 || ' · ' || d.motivo || case when d.monto < d.monto_calculado then ' · calculado ' || privado.formato_pesos(d.monto_calculado) else '' end
                 || coalesce((select ' · ANULADA: ' || a.motivo from public.devoluciones_anuladas a where a.devolucion_id = d.id), ''))::text
           from public.devoluciones d left join public.equipo q on q.id = d.creado_por
          where d.gimnasio_id = p_gimnasio_id and d.creado_en >= ini and d.creado_en < fin
          order by d.creado_en desc limit lim)
      ) b order by b.en desc, b.clave desc limit lim
    ) u left join public.socios s on s.id = u.socio_id;
  return jsonb_build_object('items', filas);
end $$;

-- ── Anular una devolución ───────────────────────────────────────────
create or replace function public.anular_devolucion(p_devolucion_id uuid, p_motivo text, p_reintegro_caja boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d public.devoluciones; eid uuid; v_motivo text := trim(coalesce(p_motivo, '')); tid uuid; mid uuid; aid uuid; nombre text;
begin
  select * into d from public.devoluciones where id = p_devolucion_id for share;
  if not found then raise exception 'Sin permiso o devolución inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(d.gimnasio_id, array['dueno', 'encargado']);
  if length(v_motivo) < 3 then raise exception 'Escribí el motivo de la anulación: queda anotado con tu nombre.' using errcode = '22023'; end if;
  if length(v_motivo) > 300 then raise exception 'El motivo: hasta 300 letras.' using errcode = '22023'; end if;
  if exists (select 1 from public.devoluciones_anuladas a where a.devolucion_id = d.id) then
    raise exception 'Esa devolución ya estaba anulada.' using errcode = '22023';
  end if;
  if coalesce(p_reintegro_caja, false) then
    if d.medio <> 'efectivo' then raise exception 'Solo una devolución en efectivo vuelve a la caja.' using errcode = '22023'; end if;
    select t.id into tid from public.turnos_caja t where t.gimnasio_id = d.gimnasio_id and t.abierto_por = eid and t.cerrado_en is null order by t.abierto_en desc limit 1;
    if tid is null then raise exception 'Para anotar que la plata volvió a la caja abrí tu caja: se registra como un ingreso con el motivo.' using errcode = '22023'; end if;
    select trim(s.nombre || ' ' || s.apellido) into nombre from public.socios s where s.id = d.socio_id;
    insert into public.movimientos_caja (gimnasio_id, turno_caja_id, tipo, monto, motivo, creado_por)
    values (d.gimnasio_id, tid, 'ingreso', d.monto, left('Anulación de devolución a ' || coalesce(nombre, 'un socio') || ': ' || v_motivo, 300), eid)
    returning id into mid;
  end if;
  insert into public.devoluciones_anuladas (gimnasio_id, devolucion_id, motivo, reintegro_caja, movimiento_caja_id, anulada_por)
  values (d.gimnasio_id, d.id, v_motivo, coalesce(p_reintegro_caja, false), mid, eid) returning id into aid;
  return jsonb_build_object('anulacion_id', aid, 'devolucion_id', d.id, 'reintegro_caja', coalesce(p_reintegro_caja, false), 'movimiento_caja_id', mid);
end $$;

-- ── Lo que muestra la ficha ─────────────────────────────────────────
create or replace function public.devoluciones_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare so public.socios;
begin
  select * into so from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(so.gimnasio_id, array['dueno', 'encargado']);
  return coalesce((select jsonb_agg(jsonb_build_object(
           'id', d.id, 'medio', d.medio, 'monto', d.monto, 'calculado', d.monto_calculado, 'motivo', d.motivo, 'en', d.creado_en, 'por', q.nombre,
           'anulada', a.id is not null, 'anulada_motivo', a.motivo, 'anulada_en', a.anulada_en, 'anulada_por', qa.nombre, 'reintegro_caja', a.reintegro_caja)
           order by d.creado_en desc)
          from public.devoluciones d
          left join public.equipo q on q.id = d.creado_por
          left join public.devoluciones_anuladas a on a.devolucion_id = d.id
          left join public.equipo qa on qa.id = a.anulada_por
         where d.socio_id = so.id), '[]'::jsonb);
end $$;

-- ── Para Configuración → Reglas ─────────────────────────────────────
create or replace function public.reglas_beneficios(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; cfg public.configuracion_gimnasio;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select * into cfg from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  return jsonb_build_object(
    'puede_editar', e.rol = 'dueno',
    'devolucion_modo', cfg.devolucion_baja_modo,
    'topes', jsonb_build_object('max_dias_recepcion', cfg.cortesia_max_dias_recepcion, 'max_dias_encargado', cfg.cortesia_max_dias_encargado,
                                'dias_mes_recepcion', cfg.cortesia_dias_mes_recepcion, 'dias_mes_encargado', cfg.cortesia_dias_mes_encargado,
                                'alerta_repetidas', cfg.cortesia_alerta_repetidas, 'descuento_max_recepcion', cfg.descuento_max_recepcion),
    'motivos', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nombre', m.nombre, 'activo', m.activo) order by m.nombre)
                           from public.motivos_beneficio m where m.gimnasio_id = p_gimnasio_id), '[]'::jsonb));
end $$;

revoke all on function public.anular_devolucion(uuid, text, boolean), public.devoluciones_socio(uuid), public.reglas_beneficios(uuid),
  public.calcular_devolucion_baja(uuid), public.moderacion_control(uuid, date, date, int) from public, anon, authenticated;
grant execute on function public.anular_devolucion(uuid, text, boolean), public.devoluciones_socio(uuid), public.reglas_beneficios(uuid),
  public.calcular_devolucion_baja(uuid), public.moderacion_control(uuid, date, date, int) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.anular_devolucion(uuid, text, boolean)', 'public.devoluciones_socio(uuid)', 'public.reglas_beneficios(uuid)',
                           'public.calcular_devolucion_baja(uuid)', 'public.moderacion_control(uuid, date, date, int)',
                           'privado.calcular_devolucion_baja(uuid, timestamptz)', 'privado.devolucion_item_unico()'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if not (select relrowsecurity from pg_class where oid = 'public.devoluciones_anuladas'::regclass) then raise exception 'Verificación: devoluciones_anuladas sin RLS'; end if;
  if exists (select 1 from pg_constraint k where k.conrelid = 'public.devoluciones_items'::regclass and k.contype = 'u'
               and (select array_agg(a.attname::text order by a.attname::text) from pg_attribute a where a.attrelid = k.conrelid and a.attnum = any (k.conkey)) = array['cobertura_id', 'gimnasio_id']) then
    raise exception 'Verificación: sigue el unique de cobertura en devoluciones_items';
  end if;
  if position('devoluciones_anuladas' in pg_get_functiondef('privado.calcular_devolucion_baja(uuid, timestamptz)'::regprocedure)) = 0 then
    raise exception 'Verificación: el cálculo no libera las devoluciones anuladas';
  end if;
end $$;
