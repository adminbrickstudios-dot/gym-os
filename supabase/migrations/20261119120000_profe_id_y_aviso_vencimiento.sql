-- Paneles completos (Mateo, 19/11) · tres cambios aditivos, ninguno toca plata ni la puerta:
--  1) clases_del_dia devuelve también profe_id (SOLO al equipo; el socio recibe null) para que el panel decida "clase ajena" por id y no por el nombre
--     (PREGUNTAS: opción recomendada). Cambia el tipo de lo que devuelve: se borra la firma vieja y se crea la nueva con los mismos permisos.
--     Compatible: el código anterior ignora la columna nueva.
--  2) Llave nueva 'aviso_vencimiento' (apagada por defecto) en funciones_nuevas_catalogo.
--  3) avisos_app_socio suma el aviso "te quedan N días" (FA-12) cuando la llave está prendida. Se calcula al abrir, sin cron.
do $g$ begin
  if to_regprocedure('public.clases_del_dia(uuid, date, uuid)') is null then raise exception 'Guarda: falta clases_del_dia'; end if;
  if to_regprocedure('public.avisos_app_socio(uuid, timestamptz)') is null then raise exception 'Guarda: falta avisos_app_socio'; end if;
  if to_regprocedure('privado.funciones_nuevas_catalogo()') is null then raise exception 'Guarda: falta el catálogo de funciones nuevas'; end if;
  if jsonb_array_length(privado.funciones_nuevas_catalogo()) <> 9 and not exists (select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where c ->> 'clave' = 'aviso_vencimiento') then
    raise exception 'Guarda: el catálogo no es el esperado';
  end if;
end $g$;

create or replace function privado.funciones_nuevas_catalogo() returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_array(
    jsonb_build_object('clave', 'borrador_alta', 'titulo', 'Borrador del alta de socio', 'plata', false,
      'explicacion', 'Si se corta el alta a la mitad, al volver pregunta “¿Seguimos donde dejaste?”. Se guarda solo en esa computadora, por 7 días.',
      'novedad', 'Si se corta el alta de un socio a la mitad, al volver pregunta si seguís donde dejaste.'),
    jsonb_build_object('clave', 'panel_pago', 'titulo', 'Más datos en el panel del socio', 'plata', false,
      'explicacion', 'En la ficha rápida que abre la Entrada: cuándo le toca pagar y cuánto, desde cuándo debe, qué plan pagaría, y sus notas y etiquetas.',
      'novedad', 'La ficha rápida de la Entrada muestra cuándo le toca pagar al socio, cuánto, desde cuándo debe, y sus notas y etiquetas.'),
    jsonb_build_object('clave', 'horarios_pico', 'titulo', 'Horarios pico por día de la semana', 'plata', false,
      'explicacion', 'En Resultado: un cuadro con las entradas de las últimas 8 semanas por día y hora.',
      'novedad', 'En Resultado hay un cuadro con las entradas de las últimas 8 semanas por día y hora.'),
    jsonb_build_object('clave', 'apto_vencimiento', 'titulo', 'Apto físico: aviso antes de que venza', 'plata', false,
      'explicacion', 'Con “Pedir apto físico” prendido, avisa cuántos aptos vencen pronto y, si lo elegís, la entrada avisa o frena a quien no tiene el apto al día. Solo se guarda la fecha, nunca el certificado.',
      'novedad', 'El apto físico ahora avisa antes de vencer y la entrada puede avisar o frenar a quien lo tiene vencido.'),
    jsonb_build_object('clave', 'origen_altas', 'titulo', 'De dónde vienen los socios nuevos', 'plata', false,
      'explicacion', 'El link de “Quiero ser socio” puede llevar su origen (Instagram, QR del cartel, WhatsApp, recomendado). Cada alta queda con su origen y un reporte cuenta cuántas se hicieron y cuántas pagaron.',
      'novedad', 'Ahora cada socio nuevo queda con el origen del link por el que llegó, y Interesados muestra cuántos vienen de cada lado y cuántos pagaron.'),
    jsonb_build_object('clave', 'resumen_noche', 'titulo', 'Resumen de la noche', 'plata', false,
      'explicacion', 'En Novedades, el dueño ve cuánto se cobró, cuántos entraron, altas, bajas y si la caja quedó cerrada. Se calcula al abrir, con lo que pasó ese día.',
      'novedad', 'En Novedades hay un resumen del día: lo cobrado, las entradas, las altas, las bajas y el estado de la caja.'),
    jsonb_build_object('clave', 'debito_automatico', 'titulo', 'Débito automático con MercadoPago', 'plata', true,
      'explicacion', 'El socio se adhiere una vez y se le cobra solo cada mes; el aviso de MercadoPago crea el pago. Necesita las credenciales de MercadoPago del gimnasio y todavía no cobra sin ellas.',
      'novedad', 'Los socios se pueden adherir al débito automático; cada cobro mensual lo confirma MercadoPago y queda como un pago más.'),
    jsonb_build_object('clave', 'vuelto_efectivo', 'titulo', 'Vuelto al cobrar en efectivo', 'plata', true,
      'explicacion', 'En la hoja Cobrar, con Efectivo elegido, la recepción escribe con cuánto paga el socio y ve el vuelto y los billetes rápidos. Es solo una cuenta en pantalla: lo cobrado y la caja son el total, no cambian.',
      'novedad', 'Al cobrar en efectivo, la hoja Cobrar calcula el vuelto con cuánto paga el socio. Es solo una cuenta: no cambia lo cobrado.'),
    jsonb_build_object('clave', 'valor_socio', 'titulo', 'Cuánto deja un socio', 'plata', false,
      'explicacion', 'En Resultado: cuánto dejó en promedio cada socio que pagó alguna vez y cuántos meses dura (los que ya se fueron, y todos). Se calcula de lo ya guardado (pagos y coberturas): no cambia ningún cobro.',
      'novedad', 'En Resultado hay dos números nuevos: cuánto deja un socio en promedio y cuántos meses dura.'),
    jsonb_build_object('clave', 'aviso_vencimiento', 'titulo', 'Aviso en la app: “te quedan 3 días”', 'plata', false,
      'explicacion', 'En el Inicio de la app del socio, cuando le faltan 3 días o menos para que venza su cuota, aparece un aviso arriba con la fecha. Se calcula al abrir la app (sin cron) y solo avisa: no cambia el acceso ni cobra nada.',
      'novedad', 'La app del socio avisa arriba del Inicio cuando le quedan 3 días o menos de cuota.')
  )
$$;
revoke all on function privado.funciones_nuevas_catalogo() from public, anon, authenticated;

drop function if exists public.clases_del_dia(uuid, date, uuid);
create or replace function public.clases_del_dia(p_sede_id uuid, p_dia date, p_socio_id uuid default null)
returns table (clase_id uuid, actividad text, emoji text, color text, inicio timestamptz, fin timestamptz,
               profe text, cupo int, confirmadas int, en_espera int, cancelada boolean, cancelada_motivo text,
               mi_reserva text, mi_posicion int, profe_id uuid)
language plpgsql security definer set search_path = '' as $$
declare g uuid; zona text; cfg public.configuracion_gimnasio; socio uuid; hoy date; es_equipo boolean; cant int;
begin
  select s.gimnasio_id, gi.zona_horaria into g, zona from public.sedes s join public.gimnasios gi on gi.id = s.gimnasio_id where s.id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  es_equipo := privado.es_servicio() or g in (select privado.mis_gimnasios());
  if p_socio_id is not null then
    if not (p_socio_id in (select privado.mis_socios()) or es_equipo)
       or not exists (select 1 from public.socios where id = p_socio_id and gimnasio_id = g) then
      raise exception 'Sin permiso para ver las clases de ese socio' using errcode = '42501';
    end if;
    socio := p_socio_id;
  elsif not es_equipo then
    select count(*), min(s.id::text)::uuid into cant, socio from public.socios s
     where s.id in (select privado.mis_socios()) and s.gimnasio_id = g;
    if cant = 0 then raise exception 'Sin permiso para ver las clases de este gimnasio' using errcode = '42501'; end if;
    if cant > 1 then raise exception 'Tu cuenta tiene varios socios: elegí para quién'; end if;
  end if;

  select * into cfg from public.configuracion_gimnasio where gimnasio_id = g;
  if cfg.modo_clases = 'ninguno' then raise exception 'Este gimnasio no tiene clases'; end if;
  hoy := privado.dia_local(now(), zona);
  if es_equipo then
    if p_dia not between hoy - 60 and hoy + 60 then raise exception 'Se pueden ver clases de hasta 60 días antes o después'; end if;
  elsif p_dia not between hoy - 1 and hoy + cfg.reserva_dias_anticipacion then
    raise exception 'Podés ver las clases de los próximos % días', cfg.reserva_dias_anticipacion;
  end if;

  perform privado.materializar_dia(p_sede_id, p_dia);
  return query
    select c.id, a.nombre, a.emoji, a.color, c.inicio, c.fin, e.nombre, c.cupo,
           (select count(*)::int from public.reservas r where r.clase_id = c.id and r.estado = 'confirmada'),
           (select count(*)::int from public.reservas r where r.clase_id = c.id and r.estado = 'espera'),
           c.cancelada_en is not null, c.cancelada_motivo,
           mr.estado,
           case when mr.estado = 'espera' then
             (select count(*)::int + 1 from public.reservas r2 where r2.clase_id = c.id and r2.estado = 'espera' and r2.creado_en < mr.creado_en)
           end,
           case when es_equipo then c.profe_id end
      from public.clases c
      join public.actividades a on a.id = c.actividad_id
      left join public.equipo e on e.id = c.profe_id
      left join lateral (select r.estado, r.creado_en from public.reservas r
                          where r.clase_id = c.id and r.socio_id = socio and r.estado <> 'cancelada') mr on true
     where c.sede_id = p_sede_id
       and c.inicio >= (p_dia::timestamp) at time zone zona
       and c.inicio < ((p_dia + 1)::timestamp) at time zone zona
     order by c.inicio, a.nombre;
end $$;
revoke all on function public.clases_del_dia(uuid, date, uuid) from public, anon, authenticated;
grant execute on function public.clases_del_dia(uuid, date, uuid) to authenticated, service_role;

create or replace function public.avisos_app_socio(p_socio_id uuid, p_momento timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios; zona text; manana date; res jsonb := '[]'::jsonb; dias int;
begin
  select * into s from public.socios x where x.id = p_socio_id and x.id in (select privado.mis_socios());
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = s.gimnasio_id;
  manana := (p_momento at time zone zona)::date + 1;
  if s.aviso_clase_1h then
    res := res || coalesce((
      select jsonb_agg(jsonb_build_object('tipo', 'clase_pronto', 'clase_id', c.id, 'inicio', c.inicio,
               'texto', 'Tu clase de ' || a.nombre || ' empieza a las ' || to_char(c.inicio at time zone zona, 'HH24:MI') || '.') order by c.inicio)
        from public.reservas r join public.clases c on c.id = r.clase_id join public.actividades a on a.id = c.actividad_id
       where r.socio_id = s.id and r.estado = 'confirmada' and c.cancelada_en is null
         and c.inicio > p_momento and c.inicio <= p_momento + interval '1 hour'), '[]'::jsonb);
  end if;
  res := res || coalesce((
    select jsonb_agg(jsonb_build_object('tipo', 'evento_manana', 'evento_id', e.id, 'inicio', e.inicio,
             'texto', 'Mañana: ' || p.nombre || '.') order by e.inicio)
      from public.evento_inscripciones i join public.eventos e on e.id = i.evento_id and e.gimnasio_id = i.gimnasio_id
      join public.productos p on p.id = e.producto_id and p.gimnasio_id = e.gimnasio_id
     where i.socio_id = s.id and i.cancelada_en is null and e.cerrado_en is null
       and (e.inicio at time zone zona)::date = manana), '[]'::jsonb);
  -- Aviso de vencimiento (llave 'aviso_vencimiento', apagada por defecto): cuota que vence en 3 días o menos. Lo calcula la fecha guardada
  -- (cubierto_hasta, mantenida por trigger), sin cron; solo avisa.
  if s.cubierto_hasta is not null and s.cubierto_hasta > p_momento and s.dado_de_baja_en is null
     and exists (select 1 from public.funciones_nuevas_gimnasio f where f.gimnasio_id = s.gimnasio_id and f.clave = 'aviso_vencimiento' and f.activa) then
    dias := ((s.cubierto_hasta at time zone zona)::date - (p_momento at time zone zona)::date);
    if dias <= 3 then
      res := res || jsonb_build_array(jsonb_build_object('tipo', 'vence_pronto', 'dias', dias, 'hasta', s.cubierto_hasta,
        'texto', case when dias <= 0 then 'Tu cuota vence hoy.' when dias = 1 then 'Te queda 1 día de cuota.' else 'Te quedan ' || dias || ' días de cuota.' end));
    end if;
  end if;
  return res;
end $$;
revoke all on function public.avisos_app_socio(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.avisos_app_socio(uuid, timestamptz) to authenticated, service_role;

do $v$
declare f text;
begin
  if jsonb_array_length(privado.funciones_nuevas_catalogo()) <> 10 then raise exception 'Verificación: el catálogo no tiene las 10 claves'; end if;
  if not exists (select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where c ->> 'clave' = 'aviso_vencimiento' and coalesce(c ->> 'novedad', '') <> '') then
    raise exception 'Verificación: falta aviso_vencimiento en el catálogo';
  end if;
  foreach f in array array['public.clases_del_dia(uuid, date, uuid)', 'public.avisos_app_socio(uuid, timestamp with time zone)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
    if not has_function_privilege('authenticated', f, 'execute') then raise exception 'Verificación: authenticated no puede ejecutar %', f; end if;
  end loop;
  if not exists (select 1 from information_schema.parameters where specific_schema = 'public' and specific_name like 'clases_del_dia%' and parameter_name = 'profe_id') then
    raise exception 'Verificación: clases_del_dia no devuelve profe_id';
  end if;
end $v$;
