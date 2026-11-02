-- ═══════════════════════════════════════════════════════════════════
-- 0014 · Lo que necesita el mostrador.
--
--   · Cada sede nace con su caja ("Caja principal"). Sin caja no se
--     puede abrir un turno ni cobrar en efectivo, y hasta ahora un
--     gimnasio nuevo no tenía ninguna. Backfill para las sedes que ya
--     existen.
--   · cajas_sede: las cajas de una sede y si están abiertas (sin montos).
--   · precios_venta: lo que se puede vender en el mostrador y su precio
--     por medio de pago, para que el carrito muestre el total. El precio
--     que vale es el que vuelve a calcular vender(): esto es para mostrar.
--   · vencen_hoy: la lista de la recepción (la retención completa es
--     solo del dueño y el encargado).
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('privado.vender(uuid,uuid,uuid,jsonb,jsonb,uuid,uuid,numeric,timestamptz)') is null then
    raise exception 'Guarda: falta la migración 0009';
  end if;
  if to_regprocedure('privado.exigir_equipo(uuid,text[])') is null then
    raise exception 'Guarda: falta la migración 0013';
  end if;
end $$;

-- ── Una caja por sede, desde el día 1 ───────────────────────────────
create or replace function privado.al_crear_sede_caja() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.cajas (gimnasio_id, sede_id, nombre) values (new.gimnasio_id, new.id, 'Caja principal')
  on conflict (gimnasio_id, sede_id, nombre) do nothing;
  return new;
end $$;
revoke all on function privado.al_crear_sede_caja() from public;

drop trigger if exists sedes_crear_caja on public.sedes;
create trigger sedes_crear_caja after insert on public.sedes
  for each row execute function privado.al_crear_sede_caja();

insert into public.cajas (gimnasio_id, sede_id, nombre)
select s.gimnasio_id, s.id, 'Caja principal' from public.sedes s
 where not exists (select 1 from public.cajas c where c.sede_id = s.id)
on conflict (gimnasio_id, sede_id, nombre) do nothing;

-- ── Cajas de una sede ───────────────────────────────────────────────
create or replace function public.cajas_sede(p_sede_id uuid)
returns table (caja_id uuid, nombre text, activa boolean, turno_id uuid, abierta_en timestamptz, abierta_por text)
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], p_sede_id);
  return query
    select c.id, c.nombre, c.activa, t.id, t.abierto_en, e.nombre
      from public.cajas c
      left join public.turnos_caja t on t.caja_id = c.id and t.cerrado_en is null
      left join public.equipo e on e.id = t.abierto_por
     where c.sede_id = p_sede_id
     order by c.activa desc, c.nombre;
end $$;

-- ── Precios del mostrador ───────────────────────────────────────────
-- Para cada cosa vendible: el precio de lista y el de cada medio. Con un
-- solo medio rige su precio; con pago mixto, el de lista (como en vender).
create or replace function privado.precios_por_medio(p_plan_id uuid, p_sede_id uuid, p_momento timestamptz) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'lista', privado.precio_para(p_plan_id, p_momento, null, p_sede_id, true),
    'efectivo', privado.precio_para(p_plan_id, p_momento, 'efectivo', p_sede_id, true),
    'transferencia', privado.precio_para(p_plan_id, p_momento, 'transferencia', p_sede_id, true),
    'debito', privado.precio_para(p_plan_id, p_momento, 'debito', p_sede_id, true),
    'credito', privado.precio_para(p_plan_id, p_momento, 'credito', p_sede_id, true))
$$;
revoke all on function privado.precios_por_medio(uuid, uuid, timestamptz) from public;

create or replace function public.precios_venta(p_sede_id uuid, p_socio_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; e public.equipo; c public.configuracion_gimnasio; sus public.suscripciones; pl public.planes;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']);
  if e.sede_id is not null and e.sede_id <> p_sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  if p_socio_id is not null and not exists (select 1 from public.socios where id = p_socio_id and gimnasio_id = g) then
    raise exception 'El socio no es de este gimnasio';
  end if;
  select * into c from public.configuracion_gimnasio where gimnasio_id = g;
  if p_socio_id is not null then
    select * into sus from public.suscripciones where socio_id = p_socio_id and baja_en is null;
    if found then select * into pl from public.planes where id = sus.plan_id; end if;
  end if;
  return jsonb_build_object(
    'tope_descuento', case when e.rol = 'recepcion' then c.descuento_max_recepcion end,
    'cuota', case when pl.id is not null and c.cobra_membresia then jsonb_build_object(
               'plan_id', pl.id, 'plan', pl.nombre, 'duracion_meses', pl.duracion_meses,
               'precios', privado.precios_por_medio(pl.id, p_sede_id, now())) end,
    'pases', case when c.cobra_pase then coalesce((
               select jsonb_agg(jsonb_build_object('plan_id', p.id, 'nombre', p.nombre,
                                                   'precios', privado.precios_por_medio(p.id, p_sede_id, now())) order by p.orden, p.nombre)
                 from public.planes p where p.gimnasio_id = g and p.activo and p.tipo = 'pase_diario'), '[]'::jsonb) else '[]'::jsonb end,
    'packs', case when c.cobra_pack then coalesce((
               select jsonb_agg(jsonb_build_object('plan_id', p.id, 'nombre', p.nombre, 'cantidad_clases', p.cantidad_clases,
                                                   'precios', privado.precios_por_medio(p.id, p_sede_id, now())) order by p.orden, p.nombre)
                 from public.planes p where p.gimnasio_id = g and p.activo and p.tipo = 'pack'), '[]'::jsonb) else '[]'::jsonb end,
    'productos', coalesce((select jsonb_agg(jsonb_build_object('producto_id', pr.id, 'nombre', pr.nombre, 'precio', pr.precio)
                                            order by pr.orden, pr.nombre)
                             from public.productos pr where pr.gimnasio_id = g and pr.activo), '[]'::jsonb)
  );
end $$;

-- ── Vencen hoy ──────────────────────────────────────────────────────
-- Misma fuente que la retención (privado.retencion): el último día cubierto es hoy.
create or replace function public.vencen_hoy(p_gimnasio_id uuid)
returns table (socio_id uuid, nombre text, telefono text, texto text, monto_mensual numeric, ultimo_ingreso timestamptz,
               ultimo_contacto_en timestamptz, ultimo_contacto_por text, mensaje text)
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return query
  select r.socio_id, r.nombre, r.telefono, r.texto, r.monto_mensual, r.ultimo_ingreso,
         r.ultimo_contacto_en, r.ultimo_contacto_por, r.mensaje
    from privado.retencion(p_gimnasio_id, now()) r
   where r.lista = 'por_vencer' and r.dias = 0
   order by r.nombre;
end $$;

revoke all on function public.cajas_sede(uuid), public.precios_venta(uuid, uuid), public.vencen_hoy(uuid)
  from public, anon, authenticated;
grant execute on function public.cajas_sede(uuid), public.precios_venta(uuid, uuid), public.vencen_hoy(uuid)
  to authenticated, service_role;

do $$
begin
  if exists (select 1 from public.sedes s where not exists (select 1 from public.cajas c where c.sede_id = s.id)) then
    raise exception 'Verificación: quedó una sede sin caja';
  end if;
  if has_function_privilege('anon', 'public.precios_venta(uuid, uuid)', 'execute') then
    raise exception 'Verificación: anon puede leer precios del mostrador';
  end if;
end $$;
