-- 0100 · Interruptores de permisos por gimnasio (EQU-1, decisión D4).
-- Roles fijos y, además, cuatro interruptores que prende o apaga el dueño
-- (nada de permisos persona por persona; el descuento de la recepción ya
-- tiene su tope en Configuración → Cobros):
--   recepcion_ve_cobrado       la recepción ve "Cobrado hoy" en Inicio      (no)
--   recepcion_vende_productos  la recepción vende productos                 (sí)
--   profe_ve_telefono          el profe ve el teléfono en su lista de clase (no)
--   encargado_ve_resultado     el encargado ve el Resultado y lo exporta    (sí)
-- Los valores por defecto dejan todo como estaba. Cada cambio queda en el
-- historial de configuración (trigger de 0028).
--   permisos_equipo(gimnasio) / guardar_permisos_equipo(gimnasio, datos)   dueño
--   privado.exigir_resultado(gimnasio)
-- Copias: panel_gimnasio (0013, con los permisos; el Resultado apagado para
-- el encargado que no lo ve), panel_inicio (0067), public.vender (0067),
-- lista_clase (0011, con el teléfono: cambia lo que devuelve, se borra y se
-- crea), resultado_mes (0076), exportar_mes (0077), etiqueta_campo (0080).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.mi_link_referido(uuid)') is null then raise exception 'Guarda: falta la migración 0099'; end if;
end $$;

alter table public.configuracion_gimnasio add column if not exists recepcion_ve_cobrado boolean not null default false;
alter table public.configuracion_gimnasio add column if not exists recepcion_vende_productos boolean not null default true;
alter table public.configuracion_gimnasio add column if not exists profe_ve_telefono boolean not null default false;
alter table public.configuracion_gimnasio add column if not exists encargado_ve_resultado boolean not null default true;

create or replace function public.permisos_equipo(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.configuracion_gimnasio;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  return jsonb_build_object('recepcion_ve_cobrado', c.recepcion_ve_cobrado, 'recepcion_vende_productos', c.recepcion_vende_productos,
    'profe_ve_telefono', c.profe_ve_telefono, 'encargado_ve_resultado', c.encargado_ve_resultado,
    'descuento_max_recepcion', c.descuento_max_recepcion);
end $$;

create or replace function public.guardar_permisos_equipo(p_gimnasio_id uuid, p_datos jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare k text; n int;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno']);
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then raise exception 'Nada para guardar' using errcode = '22023'; end if;
  for k in select jsonb_object_keys(p_datos) loop
    if k not in ('recepcion_ve_cobrado', 'recepcion_vende_productos', 'profe_ve_telefono', 'encargado_ve_resultado') then
      raise exception 'Permiso desconocido: %', k using errcode = '22023';
    end if;
    if jsonb_typeof(p_datos -> k) <> 'boolean' then raise exception 'El permiso % va prendido o apagado', k using errcode = '22023'; end if;
  end loop;
  update public.configuracion_gimnasio c set
    recepcion_ve_cobrado = coalesce((p_datos ->> 'recepcion_ve_cobrado')::boolean, c.recepcion_ve_cobrado),
    recepcion_vende_productos = coalesce((p_datos ->> 'recepcion_vende_productos')::boolean, c.recepcion_vende_productos),
    profe_ve_telefono = coalesce((p_datos ->> 'profe_ve_telefono')::boolean, c.profe_ve_telefono),
    encargado_ve_resultado = coalesce((p_datos ->> 'encargado_ve_resultado')::boolean, c.encargado_ve_resultado)
   where c.gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudieron guardar los permisos'; end if;
end $$;

-- El Resultado: el dueño siempre; el encargado si el dueño se lo prendió.
create or replace function privado.exigir_resultado(p_gimnasio_id uuid) returns void
language plpgsql stable set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if e.rol = 'encargado' and not (select c.encargado_ve_resultado from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id) then
    raise exception 'El dueño no le dio acceso al Resultado al encargado' using errcode = '42501';
  end if;
end $$;
revoke all on function privado.exigir_resultado(uuid) from public;

create or replace function public.panel_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; g public.gimnasios; c public.configuracion_gimnasio; apagadas text[];
begin
  e := privado.exigir_equipo(p_gimnasio_id);
  select * into g from public.gimnasios where id = p_gimnasio_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  apagadas := c.secciones_apagadas;
  if c.modo_clases = 'ninguno' then apagadas := apagadas || array['clases']; end if;
  -- EQU-1: para el encargado sin permiso, el Resultado no existe (ni en el menú ni entrando por la dirección).
  if e.rol = 'encargado' and not c.encargado_ve_resultado then apagadas := apagadas || array['resultado']; end if;
  return jsonb_build_object(
    'gimnasio', jsonb_build_object('id', g.id, 'slug', g.slug, 'nombre', g.nombre, 'zona_horaria', g.zona_horaria),
    'marca', jsonb_build_object('logo_path', c.logo_path, 'favicon_path', c.favicon_path,
                                'color_acento', c.color_acento, 'color_fondo', c.color_fondo),
    'yo', jsonb_build_object('equipo_id', e.id, 'nombre', e.nombre, 'rol', e.rol, 'sede_id', e.sede_id,
                             'accesos', e.preferencias -> 'accesos'),
    'secciones_apagadas', to_jsonb(apagadas),
    'modo_clases', c.modo_clases,
    'permisos', jsonb_build_object('recepcion_ve_cobrado', c.recepcion_ve_cobrado, 'recepcion_vende_productos', c.recepcion_vende_productos,
                                   'profe_ve_telefono', c.profe_ve_telefono, 'encargado_ve_resultado', c.encargado_ve_resultado),
    'cobra', jsonb_build_object('membresia', c.cobra_membresia, 'pase', c.cobra_pase, 'pack', c.cobra_pack),
    'sedes', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre, 'es_principal', s.es_principal)
                                        order by s.es_principal desc, s.nombre)
                         from public.sedes s
                        where s.gimnasio_id = g.id and s.activa and (e.sede_id is null or s.id = e.sede_id)), '[]'::jsonb)
  );
end $$;

create or replace function public.panel_inicio(p_gimnasio_id uuid, p_sede_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; zona text; c public.configuracion_gimnasio; hoy date; desde timestamptz; hasta timestamptz;
  entraron int; vencen int; al_dia int; cobrado numeric; por_aprobar int; clases_hoy int;
  numeros jsonb; ahora jsonb := '[]'::jsonb; s record; caja record; sede uuid;
begin
  e := privado.exigir_equipo(p_gimnasio_id);
  sede := coalesce(p_sede_id, e.sede_id);
  if e.sede_id is not null and sede <> e.sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  if sede is not null and not exists (select 1 from public.sedes where id = sede and gimnasio_id = p_gimnasio_id) then
    raise exception 'Sede inexistente' using errcode = 'P0002';
  end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = p_gimnasio_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  desde := privado.medianoche(hoy, zona);
  hasta := privado.medianoche(hoy + 1, zona);

  select count(distinct i.socio_id) into entraron from public.ingresos i
   where i.gimnasio_id = p_gimnasio_id and i.momento >= desde and i.momento < hasta and i.anulado_en is null
     and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede);

  select count(*) filter (where r.lista = 'por_vencer' and r.dias = 0) into vencen
    from privado.retencion(p_gimnasio_id, now()) r;

  select count(distinct cb.socio_id) into al_dia from public.coberturas cb
   where cb.gimnasio_id = p_gimnasio_id and cb.anulada_en is null and cb.desde <= now() and cb.hasta > now();

  select count(*) into por_aprobar from public.pagos p join public.ventas v on v.id = p.venta_id
   where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.medio = 'transferencia'
     and p.comprobante_path is not null and (sede is null or v.sede_id = sede);

  if c.modo_clases <> 'ninguno' and not ('clases' = any (c.secciones_apagadas)) then
    for s in select id from public.sedes where gimnasio_id = p_gimnasio_id and activa and (sede is null or id = sede) loop
      perform privado.materializar_dia(s.id, hoy);
    end loop;
    select count(*) into clases_hoy from public.clases k
     where k.gimnasio_id = p_gimnasio_id and k.inicio >= desde and k.inicio < hasta and k.cancelada_en is null
       and (sede is null or k.sede_id = sede);
  end if;

  if e.rol in ('dueno', 'encargado') or (e.rol = 'recepcion' and c.recepcion_ve_cobrado) then   -- EQU-1
    select coalesce(sum(p.monto), 0) into cobrado from public.pagos p join public.ventas v on v.id = p.venta_id
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.aprobado_en >= desde and p.aprobado_en < hasta
       and p.medio <> 'cuenta_corriente'   -- VEN-5: lo fiado no es plata que entró (entra cuando paga la deuda)
       and (sede is null or v.sede_id = sede);
    numeros := jsonb_build_array(
      jsonb_build_object('clave', 'entraron', 'emoji', '🚪', 'etiqueta', 'Entraron hoy', 'valor', entraron),
      jsonb_build_object('clave', 'vencen', 'emoji', '⏰', 'etiqueta', 'Vencen hoy', 'valor', vencen),
      jsonb_build_object('clave', 'cobrado', 'emoji', '💵', 'etiqueta', 'Cobrado hoy', 'valor', cobrado, 'formato', 'pesos'),
      jsonb_build_object('clave', 'al_dia', 'emoji', '✅', 'etiqueta', 'Socios al día', 'valor', al_dia));
  elsif e.rol = 'profe' then
    -- El profe ve lo suyo: sus clases de hoy, cuántos anotados y cuántos presentes.
    numeros := (
      select jsonb_build_array(
        jsonb_build_object('clave', 'mis_clases', 'emoji', '🗓️', 'etiqueta', 'Mis clases hoy', 'valor', count(*)),
        jsonb_build_object('clave', 'anotados', 'emoji', '📝', 'etiqueta', 'Anotados', 'valor',
          coalesce(sum((select count(*) from public.reservas r where r.clase_id = k.id and r.estado = 'confirmada')), 0)),
        jsonb_build_object('clave', 'presentes', 'emoji', '✅', 'etiqueta', 'Presentes', 'valor',
          coalesce(sum((select count(*) from public.asistencias a where a.clase_id = k.id and a.anulada_en is null)), 0)),
        jsonb_build_object('clave', 'faltan', 'emoji', '⏳', 'etiqueta', 'Me quedan hoy', 'valor', count(*) filter (where k.inicio > now())))
        from public.clases k
       where k.gimnasio_id = p_gimnasio_id and k.profe_id = e.id and k.cancelada_en is null
         and k.inicio >= desde and k.inicio < hasta);
  else
    numeros := jsonb_build_array(
      jsonb_build_object('clave', 'entraron', 'emoji', '🚪', 'etiqueta', 'Entraron hoy', 'valor', entraron),
      jsonb_build_object('clave', 'vencen', 'emoji', '⏰', 'etiqueta', 'Vencen hoy', 'valor', vencen),
      case when clases_hoy is not null
        then jsonb_build_object('clave', 'clases', 'emoji', '🗓️', 'etiqueta', 'Clases hoy', 'valor', clases_hoy)
        else jsonb_build_object('clave', 'al_dia', 'emoji', '✅', 'etiqueta', 'Socios al día', 'valor', al_dia) end,
      jsonb_build_object('clave', 'por_aprobar', 'emoji', '🧾', 'etiqueta', 'Transferencias por aprobar', 'valor', por_aprobar));
  end if;

  -- Ahora y lo que sigue: clases de las próximas horas, caja, pendientes.
  if clases_hoy is not null then
    ahora := ahora || coalesce((
      select jsonb_agg(jsonb_build_object(
               'tipo', 'clase', 'emoji', coalesce(a.emoji, '🗓️'), 'hora', to_char(k.inicio at time zone zona, 'HH24:MI'),
               'titulo', a.nombre,
               'detalle', (select count(*) from public.reservas r where r.clase_id = k.id and r.estado = 'confirmada')
                          || ' anotados' || case when k.cupo is not null then ' de ' || k.cupo else '' end
                          || coalesce(' · ' || p.nombre, ''),
               'href', '/clases') order by k.inicio)
        from public.clases k join public.actividades a on a.id = k.actividad_id
        left join public.equipo p on p.id = k.profe_id
       where k.gimnasio_id = p_gimnasio_id and k.cancelada_en is null and (sede is null or k.sede_id = sede)
         and k.fin > now() and k.inicio < now() + interval '6 hours'), '[]'::jsonb);
  end if;

  if e.rol in ('dueno', 'encargado', 'recepcion') and not ('caja' = any (c.secciones_apagadas)) then
    select t.abierto_en, q.nombre as quien into caja from public.turnos_caja t
      join public.cajas cj on cj.id = t.caja_id left join public.equipo q on q.id = t.abierto_por
     where t.gimnasio_id = p_gimnasio_id and t.cerrado_en is null and (sede is null or cj.sede_id = sede)
     order by t.abierto_en limit 1;
    ahora := ahora || jsonb_build_array(case when caja.abierto_en is null
      then jsonb_build_object('tipo', 'caja', 'emoji', '💵', 'titulo', 'La caja está cerrada', 'detalle', 'Abrila para cobrar en efectivo', 'href', '/caja', 'tono', 'amarillo')
      else jsonb_build_object('tipo', 'caja', 'emoji', '💵', 'titulo', 'Caja abierta',
                              'detalle', 'Desde las ' || to_char(caja.abierto_en at time zone zona, 'HH24:MI') || coalesce(' · ' || caja.quien, ''), 'href', '/caja') end);
  end if;
  if por_aprobar > 0 and e.rol <> 'profe' then
    ahora := ahora || jsonb_build_array(jsonb_build_object('tipo', 'transferencias', 'emoji', '🧾',
      'titulo', por_aprobar || case when por_aprobar = 1 then ' transferencia para aprobar' else ' transferencias para aprobar' end,
      'detalle', 'Mirá el comprobante y aprobala', 'href', '/transferencias', 'tono', 'azul'));
  end if;
  if vencen > 0 and e.rol <> 'profe' then
    ahora := ahora || jsonb_build_array(jsonb_build_object('tipo', 'vencen', 'emoji', '⏰',
      'titulo', vencen || case when vencen = 1 then ' socio vence hoy' else ' socios vencen hoy' end,
      'detalle', 'Avisales antes de que se vayan', 'href', '/vencen-hoy', 'tono', 'amarillo'));
  end if;

  return jsonb_build_object('hoy', hoy, 'numeros', numeros, 'ahora', ahora);
end $$;

create or replace function public.vender(
  p_sede_id uuid, p_items jsonb, p_pagos jsonb, p_socio_id uuid default null, p_turno_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid; rol text; tope numeric; c public.configuracion_gimnasio; no_acepta text;
begin
  select gimnasio_id into g from public.sedes where id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], p_sede_id);
  select e.rol into rol from public.equipo e where e.id = eid;
  select * into c from public.configuracion_gimnasio where gimnasio_id = g;
  select string_agg(distinct case x ->> 'medio' when 'credito' then 'tarjeta de crédito' when 'debito' then 'tarjeta de débito' when 'cuenta_corriente' then 'a cuenta (fiado)'
                                              else x ->> 'medio' end, ', ') into no_acepta
    from jsonb_array_elements(case when jsonb_typeof(p_pagos) = 'array' then p_pagos else '[]'::jsonb end) x
   where coalesce(x ->> 'medio', '') <> all (array(select m from unnest(c.medios_aceptados) m
                                                      where not (m = 'efectivo' and 'caja' = any (c.secciones_apagadas)))
                                                || case when c.fiado_activo then array['cuenta_corriente'] else '{}'::text[] end);
  if no_acepta is not null then
    raise exception 'Este gimnasio no cobra con %. Se cambia en Configuración → Cobros.', no_acepta using errcode = '22023';
  end if;
  -- EQU-1: si el dueño lo apagó, la recepción no vende productos.
  if rol = 'recepcion' and not c.recepcion_vende_productos
     and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) x where x ->> 'tipo' = 'producto') then
    raise exception 'En este gimnasio la recepción no vende productos: lo cambia el dueño en Equipo → Permisos.' using errcode = '42501';
  end if;
  if rol = 'recepcion' then
    select descuento_max_recepcion into tope from public.configuracion_gimnasio where gimnasio_id = g;
  end if;
  return privado.vender(g, p_sede_id, p_socio_id, p_items, p_pagos, p_turno_id, eid, tope, now());
end $$;

drop function if exists public.lista_clase(uuid);
create or replace function public.lista_clase(p_clase_id uuid)
returns table (socio_id uuid, nombre text, estado text, posicion int, presente boolean, telefono text)
language plpgsql stable security definer set search_path = '' as $$
declare c public.clases; eid uuid; rol text; ve_tel boolean;
begin
  select * into c from public.clases where id = p_clase_id;
  if not found then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(c.gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe'], c.sede_id);
  select e.rol into rol from public.equipo e where e.id = eid;
  if rol = 'profe' and c.profe_id is distinct from eid then
    raise exception 'Solo podés ver la lista de tus clases' using errcode = '42501';
  end if;
  -- EQU-1: el profe ve el teléfono solo si el dueño lo prendió; el resto del equipo ya lo ve en la ficha.
  ve_tel := rol <> 'profe' or (select cg.profe_ve_telefono from public.configuracion_gimnasio cg where cg.gimnasio_id = c.gimnasio_id);
  return query
    select x.socio_id, x.nombre, x.estado, x.posicion, x.presente, case when ve_tel then x.telefono end from (
      select s.id as socio_id, trim(s.nombre || ' ' || s.apellido) as nombre, r.estado,
             case when r.estado = 'espera' then (row_number() over (partition by r.estado order by r.creado_en))::int end as posicion,
             exists (select 1 from public.asistencias a where a.clase_id = c.id and a.socio_id = s.id and a.anulada_en is null) as presente, s.telefono
        from public.reservas r join public.socios s on s.id = r.socio_id
       where r.clase_id = c.id and r.estado <> 'cancelada'
      union all
      select s.id, trim(s.nombre || ' ' || s.apellido), 'sin_reserva', null::int, true, s.telefono
        from public.asistencias a join public.socios s on s.id = a.socio_id
       where a.clase_id = c.id and a.anulada_en is null
         and not exists (select 1 from public.reservas r where r.clase_id = c.id and r.socio_id = a.socio_id and r.estado <> 'cancelada')
    ) x
    order by x.estado, x.posicion nulls first, x.nombre;
end $$;

create or replace function public.resultado_mes(p_gimnasio_id uuid, p_mes date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; mes date; fin date; ant date; d0 timestamptz; d1 timestamptz; corte timestamptz; dias int; en_curso boolean;
begin
  perform privado.exigir_resultado(p_gimnasio_id);   -- EQU-1
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  mes := date_trunc('month', coalesce(p_mes, hoy))::date;
  if mes > hoy then raise exception 'Ese mes todavía no empezó' using errcode = '22023'; end if;
  fin := (mes + interval '1 month')::date;
  ant := (mes - interval '1 month')::date;
  en_curso := hoy < fin;
  d0 := privado.medianoche(mes, zona);
  d1 := privado.medianoche(fin, zona);
  corte := least(now(), d1);
  -- Para comparar un mes en curso: el anterior hasta el mismo día.
  dias := case when en_curso then hoy - mes + 1 else fin - mes end;

  return jsonb_build_object(
    'mes', mes, 'en_curso', en_curso, 'dias', dias,
    'cobrado', privado.cobrado_entre(p_gimnasio_id, d0, corte),
    'anterior_mismo_periodo', privado.cobrado_entre(p_gimnasio_id, privado.medianoche(ant, zona), privado.medianoche(least(ant + dias, mes), zona)),
    'anterior_total', privado.cobrado_entre(p_gimnasio_id, privado.medianoche(ant, zona), d0),
    'fiado', (select coalesce(sum(p.monto), 0) from public.pagos p where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado'
                and p.medio = 'cuenta_corriente' and p.aprobado_en >= d0 and p.aprobado_en < d1),
    'por_medio', (select coalesce(jsonb_agg(jsonb_build_object('medio', medio, 'total', t) order by t desc), '[]'::jsonb) from (
                    select p.medio, sum(p.monto) t from public.pagos p
                     where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.medio <> 'cuenta_corriente' and p.aprobado_en >= d0 and p.aprobado_en < d1
                     group by p.medio) x),
    -- Por lo vendido (ventas no anuladas del mes), con el nombre del plan.
    'por_concepto', (select coalesce(jsonb_agg(jsonb_build_object('concepto', concepto, 'total', t, 'cantidad', n) order by t desc), '[]'::jsonb) from (
                       select case when i.plan_id is not null then pl.nombre when i.tipo = 'producto' then 'Productos'
                                   when i.tipo = 'matricula' then 'Matrícula' when i.tipo = 'adicional' then 'Recargos'
                                   when i.tipo = 'deuda' then 'Pagos de deuda' else 'Otros' end as concepto,
                              sum(i.cantidad * i.precio_unitario - i.descuento) t, sum(i.cantidad)::int n
                         from public.venta_items i join public.ventas v on v.id = i.venta_id left join public.planes pl on pl.id = i.plan_id
                        where v.gimnasio_id = p_gimnasio_id and v.estado <> 'anulada' and v.creado_en >= d0 and v.creado_en < d1
                        group by 1) x where t > 0),
    'por_dia', (select jsonb_agg(jsonb_build_object('dia', d::date, 'total',
                  privado.cobrado_entre(p_gimnasio_id, privado.medianoche(d::date, zona), privado.medianoche(d::date + 1, zona))) order by d)
                  from generate_series(mes, least(fin - 1, hoy), interval '1 day') d),
    'activos', (select count(distinct c.socio_id) from public.coberturas c join public.socios s on s.id = c.socio_id
                 where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null and c.desde <= corte - interval '1 second' and c.hasta > corte - interval '1 second'
                   and (s.dado_de_baja_en is null or s.dado_de_baja_en > corte)),
    'altas', (select count(*) from public.socios s where s.gimnasio_id = p_gimnasio_id and s.creado_en >= d0 and s.creado_en < d1),
    'bajas', (select count(*) from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en >= d0 and s.dado_de_baja_en < d1),
    -- Lo que entra por mes si todos los que hoy tienen membresía al día la renuevan, al precio de hoy.
    'recurrente', (select coalesce(round(sum(privado.precio_base(su.plan_id, now()) / greatest(pl.duracion_meses, 1))), 0)
                     from public.suscripciones su join public.planes pl on pl.id = su.plan_id join public.socios s on s.id = su.socio_id
                    where su.gimnasio_id = p_gimnasio_id and su.baja_en is null and pl.tipo = 'membresia' and s.dado_de_baja_en is null
                      and exists (select 1 from public.coberturas c where c.suscripcion_id = su.id and c.anulada_en is null and c.desde <= now() and c.hasta > now())),
    'horas', (select jsonb_agg(coalesce(n, 0) order by h) from generate_series(0, 23) h left join (
                select extract(hour from i.momento at time zone zona)::int hora, count(*) n from public.ingresos i
                 where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado' and i.momento >= d0 and i.momento < d1
                 group by 1) x on x.hora = h)
  );
end $$;

create or replace function public.exportar_mes(p_gimnasio_id uuid, p_mes date, p_que text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; mes date; d0 timestamptz; d1 timestamptz;
begin
  perform privado.exigir_resultado(p_gimnasio_id);   -- EQU-1
  if p_que is null or p_que not in ('ventas', 'pagos', 'caja') then raise exception 'Qué exportar: ventas, pagos o caja' using errcode = '22023'; end if;
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  mes := date_trunc('month', coalesce(p_mes, privado.dia_local(now(), zona)))::date;
  d0 := privado.medianoche(mes, zona);
  d1 := privado.medianoche((mes + interval '1 month')::date, zona);

  if p_que = 'ventas' then
    return coalesce((select jsonb_agg(jsonb_build_object(
        'fecha', to_char(v.creado_en at time zone zona, 'DD/MM/YYYY HH24:MI'), 'venta', left(v.id::text, 8),
        'socio', (select trim(s.nombre || ' ' || s.apellido) from public.socios s where s.id = v.socio_id),
        'detalle', (select string_agg(i.descripcion || case when i.cantidad > 1 then ' x' || i.cantidad else '' end, ' + ' order by i.id) from public.venta_items i where i.venta_id = v.id),
        'bruto', (select coalesce(sum(i.cantidad * i.precio_unitario), 0) from public.venta_items i where i.venta_id = v.id),
        'descuento', (select coalesce(sum(i.descuento), 0) from public.venta_items i where i.venta_id = v.id),
        'total', (select coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0) from public.venta_items i where i.venta_id = v.id),
        'estado', v.estado, 'cobro', (select e.nombre from public.equipo e where e.id = v.creado_por),
        'sede', (select x.nombre from public.sedes x where x.id = v.sede_id),
        'anulada', case when v.anulada_en is not null then to_char(v.anulada_en at time zone zona, 'DD/MM/YYYY') || ': ' || v.anulada_motivo end)
        order by v.creado_en)
      from public.ventas v where v.gimnasio_id = p_gimnasio_id and v.creado_en >= d0 and v.creado_en < d1), '[]'::jsonb);
  elsif p_que = 'pagos' then
    return coalesce((select jsonb_agg(jsonb_build_object(
        'fecha', to_char(coalesce(p.aprobado_en, p.creado_en) at time zone zona, 'DD/MM/YYYY HH24:MI'), 'venta', left(p.venta_id::text, 8),
        'socio', (select trim(s.nombre || ' ' || s.apellido) from public.ventas v join public.socios s on s.id = v.socio_id where v.id = p.venta_id),
        'medio', p.medio, 'monto', p.monto, 'estado', p.estado,
        'quien', (select e.nombre from public.equipo e where e.id = coalesce(p.creado_por, p.aprobado_por)))
        order by coalesce(p.aprobado_en, p.creado_en))
      from public.pagos p where p.gimnasio_id = p_gimnasio_id and coalesce(p.aprobado_en, p.creado_en) >= d0 and coalesce(p.aprobado_en, p.creado_en) < d1), '[]'::jsonb);
  else
    return coalesce((select jsonb_agg(x order by x ->> 'orden') from (
      select jsonb_build_object('orden', t.abierto_en, 'fecha', to_char(t.abierto_en at time zone zona, 'DD/MM/YYYY HH24:MI'), 'caja', c.nombre, 'tipo', 'Apertura',
               'monto', t.monto_inicial, 'motivo', null, 'quien', (select e.nombre from public.equipo e where e.id = t.abierto_por)) x
        from public.turnos_caja t join public.cajas c on c.id = t.caja_id
       where t.gimnasio_id = p_gimnasio_id and t.abierto_en >= d0 and t.abierto_en < d1
      union all
      select jsonb_build_object('orden', m.creado_en, 'fecha', to_char(m.creado_en at time zone zona, 'DD/MM/YYYY HH24:MI'), 'caja', c.nombre,
               'tipo', case m.tipo when 'retiro' then 'Retiro' when 'ingreso' then 'Ingreso' else initcap(m.tipo) end,
               'monto', m.monto, 'motivo', m.motivo, 'quien', (select e.nombre from public.equipo e where e.id = m.creado_por))
        from public.movimientos_caja m join public.turnos_caja t on t.id = m.turno_caja_id join public.cajas c on c.id = t.caja_id
       where m.gimnasio_id = p_gimnasio_id and m.creado_en >= d0 and m.creado_en < d1
      union all
      select jsonb_build_object('orden', t.cerrado_en, 'fecha', to_char(t.cerrado_en at time zone zona, 'DD/MM/YYYY HH24:MI'), 'caja', c.nombre, 'tipo', 'Cierre',
               'monto', t.monto_contado, 'motivo', 'Esperado ' || privado.formato_pesos(t.monto_esperado) || ', diferencia ' || privado.formato_pesos(t.monto_contado - t.monto_esperado)
                        || coalesce(' · ' || t.nota, ''),
               'quien', (select e.nombre from public.equipo e where e.id = t.cerrado_por))
        from public.turnos_caja t join public.cajas c on c.id = t.caja_id
       where t.gimnasio_id = p_gimnasio_id and t.cerrado_en >= d0 and t.cerrado_en < d1
    ) y), '[]'::jsonb);
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
      'pausa_dias_por_anio', 'Pausa: máximo de días por año', 'pide_apto', 'Pedir apto físico', 'tope_dejar_pasar', 'Dejar pasar: tope por día de la recepción', 'invitados_por_mes', 'Invitados por socio por mes',
    'recargo_tipo', 'Recargo por pagar tarde', 'recargo_valor', 'Recargo: cuánto', 'recargo_dias', 'Recargo: días de atraso',
    'fiado_activo', 'Fiar (cuenta corriente)', 'fiado_tope', 'Fiar: tope por socio',
    'falta_politica', 'Faltas a clases reservadas', 'falta_bloqueo_dias', 'Faltas: días sin poder reservar',
    'recepcion_ve_cobrado', 'Permiso: la recepción ve lo cobrado del día', 'recepcion_vende_productos', 'Permiso: la recepción vende productos',
    'profe_ve_telefono', 'Permiso: el profe ve el teléfono del socio', 'encargado_ve_resultado', 'Permiso: el encargado ve el Resultado') ->> p_campo, p_campo)
  end
$$;

revoke all on function public.permisos_equipo(uuid), public.guardar_permisos_equipo(uuid, jsonb), public.panel_gimnasio(uuid),
  public.panel_inicio(uuid, uuid), public.vender(uuid, jsonb, jsonb, uuid, uuid), public.lista_clase(uuid),
  public.resultado_mes(uuid, date), public.exportar_mes(uuid, date, text) from public, anon, authenticated;
grant execute on function public.permisos_equipo(uuid), public.guardar_permisos_equipo(uuid, jsonb), public.panel_gimnasio(uuid),
  public.panel_inicio(uuid, uuid), public.vender(uuid, jsonb, jsonb, uuid, uuid), public.lista_clase(uuid),
  public.resultado_mes(uuid, date), public.exportar_mes(uuid, date, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.permisos_equipo(uuid)', 'public.guardar_permisos_equipo(uuid, jsonb)', 'public.panel_gimnasio(uuid)',
                           'public.panel_inicio(uuid, uuid)', 'public.vender(uuid, jsonb, jsonb, uuid, uuid)', 'public.lista_clase(uuid)',
                           'public.resultado_mes(uuid, date)', 'public.exportar_mes(uuid, date, text)', 'privado.exigir_resultado(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if position('exigir_resultado' in pg_get_functiondef('public.resultado_mes(uuid, date)'::regprocedure)) = 0
     or position('exigir_resultado' in pg_get_functiondef('public.exportar_mes(uuid, date, text)'::regprocedure)) = 0 then
    raise exception 'Verificación: el Resultado no mira el permiso del encargado';
  end if;
  if position('recepcion_vende_productos' in pg_get_functiondef('public.vender(uuid, jsonb, jsonb, uuid, uuid)'::regprocedure)) = 0 then
    raise exception 'Verificación: vender no mira si la recepción vende productos';
  end if;
end $$;
