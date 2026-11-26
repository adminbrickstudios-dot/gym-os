-- Pase 2.0 · organización: ver sin entrar (Mateo, 26/11 · DISENO.md § "Pase 2.0 · Organización", § Datos).
-- EXPANDIR: todo aditivo y compatible con el código anterior. Una llave nueva (apagada en los gimnasios reales, prendida en los [demo]),
-- una función por dato nuevo (todo calculado, nada guardado) y UNA tabla nueva solo para lo que no tiene un hecho propio ("ya lo llamé").
--   numeros_socio          última vez, veces este mes (y el promedio del gimnasio), semanas seguidas, mejor racha, cuándo viene, a qué hora suele venir
--   numeros_socios         última vez y veces este mes de una lista de socios (las columnas nuevas de Socios)
--   volvieron_mes             los que estuvieron 14 días o más sin venir (o con la cobertura vencida) y este mes volvieron a pagar
--   plata_en_juego            vencen hoy + deben + transferencias por aprobar (+ interesados de ayer, sin plata): solo muestra, no mueve plata
--   si_cobras_lo_que_falta    proyección de solo lectura: lo que vence hasta fin de mes y lo que se debe
--   transferencias_a_revisar  cada comprobante con "Debe $X (plan)" y si el monto coincide (decisión de Mateo del 25/11)
--   ocupacion_por_hora        "¿Hay mucha gente?" para el socio: las últimas 4 semanas, mismo día, por hora, sin nombres
--   hecho_hoy                 lo resuelto hoy: lo que sale de un hecho (cobrado, aprobado, avisado, contestado, tarea hecha) más lo tildado a mano
--   tildar_hecho / deshacer_ultimo_hecho   lo que no tiene un hecho propio; deshacer = anular, nunca borrar
-- La plata sale de calcular_acceso (para_regularizar) y del precio vigente del plan (precio_para). Los cumpleaños ya los da cumplen_hoy.
-- Toda función: set search_path = '', revoke de public y grant explícito, y la llave exigida (apagada = error con texto, nunca vacío).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $g$ begin
  if to_regprocedure('privado.funciones_nuevas_catalogo()') is null then raise exception 'Guarda: falta el catálogo de funciones nuevas'; end if;
  if not exists (select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where c ->> 'clave' = 'pista_semaforo') then
    raise exception 'Guarda: falta pista_semaforo en el catálogo (20261124100000)';
  end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null or to_regprocedure('privado.exigir_funcion(uuid, text)') is null
     or to_regprocedure('privado.calcular_acceso(uuid, timestamptz, uuid)') is null
     or to_regprocedure('privado.precio_para(uuid, timestamptz, text, uuid, boolean)') is null
     or to_regprocedure('public.lote_lecturas(jsonb)') is null then
    raise exception 'Guarda: faltan funciones de base (exigir_equipo, exigir_funcion, calcular_acceso, precio_para o lote_lecturas)';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'socios' and column_name = 'cubierto_hasta') then
    raise exception 'Guarda: falta socios.cubierto_hasta (BASE-5)';
  end if;
end $g$;

-- ── 1. La llave en el catálogo (las doce de antes, sin cambios, más pase_2_organizacion) ──
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
      'novedad', 'La app del socio avisa arriba del Inicio cuando le quedan 3 días o menos de cuota.'),
    jsonb_build_object('clave', 'landing_nueva', 'titulo', 'Página del gimnasio nueva, con ilustraciones', 'plata', false,
      'explicacion', 'La página pública del gimnasio pasa al diseño nuevo: arriba el nombre y “Hacete socio”, después planes y precios, clases de la semana, cómo llegar, horarios y WhatsApp, y al final el reglamento y “Ya soy socio”. Con ilustraciones pintadas con el color del gimnasio. Lo que no cargaste no se muestra.',
      'novedad', 'La página del gimnasio tiene un diseño nuevo, con ilustraciones en el color del gimnasio y los planes arriba.'),
    jsonb_build_object('clave', 'pista_semaforo', 'titulo', 'Pista Semáforo: el diseño nuevo de todas las pantallas', 'plata', false,
      'explicacion', 'Con el estilo Pista elegido, todas las pantallas pasan al diseño Semáforo: botones y campos redondeados, el resultado de la puerta grande en verde, amarillo o rojo, emojis en el menú y en los títulos, y en el celular una barra abajo con Inicio, Entrada, Socios, Caja y Más. Cambia solo cómo se ve: las mismas pantallas y las mismas funciones.',
      'novedad', 'Todas las pantallas tienen el diseño Semáforo: el resultado de la puerta en grande, botones redondeados y emojis para encontrar todo más rápido.'),
    jsonb_build_object('clave', 'pase_2_organizacion', 'titulo', 'Pase 2.0: menú en bloques y ver sin entrar', 'plata', false,
      'explicacion', 'El menú baja de 29 entradas a 12, en cuatro bloques (Hoy, Socios, Plata, Gimnasio); lo que se usa junto queda en una pantalla con pestañas. Tocar un socio en cualquier lista abre un panel al costado sin salir de donde estás, y Cobrar se abre encima. El Inicio suma la plata en juego hoy, los que volvieron y los cumpleaños; Para hacer hoy junta cinco pantallas en una lista con su “hecho”. Nada se borra: cada pantalla de antes sigue como pestaña y el buscador la encuentra por su nombre de siempre.',
      'novedad', 'El menú quedó en 12 entradas en cuatro bloques, y tocar un socio en cualquier lista lo abre al costado sin salir de la pantalla.')
  )
$$;
revoke all on function privado.funciones_nuevas_catalogo() from public, anon, authenticated;

-- La clave lleva un número (pase_2_…): se amplía el check de la tabla para aceptar dígitos. Solo amplía (expandir): toda clave de antes sigue valiendo.
do $chk$ begin
  if exists (select 1 from pg_constraint where conname = 'funciones_nuevas_gimnasio_clave_check' and conrelid = 'public.funciones_nuevas_gimnasio'::regclass
              and pg_get_constraintdef(oid) not like '%0-9%') then
    alter table public.funciones_nuevas_gimnasio drop constraint funciones_nuevas_gimnasio_clave_check;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'funciones_nuevas_gimnasio_clave_check' and conrelid = 'public.funciones_nuevas_gimnasio'::regclass) then
    alter table public.funciones_nuevas_gimnasio add constraint funciones_nuevas_gimnasio_clave_check check (clave ~ '^[a-z0-9_]{3,40} (solo donde todavía no hay fila: si alguien la apagó en un demo, queda apagada). Temple Gym no se toca: la prende Mateo.
insert into public.funciones_nuevas_gimnasio (gimnasio_id, clave, activa, prendida_en, cambiada_en)
select g.id, 'pase_2_organizacion', true, now(), now() from public.gimnasios g where g.es_demo
on conflict (gimnasio_id, clave) do nothing;

-- ── 2. Lo tildado a mano (lo que no tiene un hecho propio). Deshacer = anular, no borrar ──
create table if not exists public.hechos_para_hacer (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  dia          date not null,                                                     -- el día local del gimnasio en que se tildó
  referencia   text not null check (referencia ~ '^[a-z_]+:[0-9a-f-]{36}$|^[a-z_]+$'), -- qué se resolvió: "interesado:<id>", "llamar:<socio>", "tarea_auto:<clave>"
  texto        text not null check (length(trim(texto)) between 2 and 160),       -- cómo se lee en "Hecho hoy"
  hecho_en     timestamptz not null default now(),
  hecho_por    uuid not null,
  anulado_en   timestamptz,
  anulado_por  uuid,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, hecho_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, anulado_por) references public.equipo (gimnasio_id, id),
  check ((anulado_en is null) = (anulado_por is null))
);
-- Lo mismo no se tilda dos veces el mismo día (dos toques a la vez: queda uno solo).
create unique index if not exists hechos_para_hacer_uno on public.hechos_para_hacer (gimnasio_id, dia, referencia) where anulado_en is null;
create index if not exists hechos_para_hacer_dia on public.hechos_para_hacer (gimnasio_id, dia, hecho_en desc);
-- RLS en la misma migración: el mostrador lee; nadie escribe directo (solo tildar_hecho / deshacer_ultimo_hecho).
select privado.politicas_estandar('public.hechos_para_hacer', array['dueno', 'encargado', 'recepcion'], null);
revoke all on table public.hechos_para_hacer from anon;

-- ── 3. Lo que el panel exige: equipo del mostrador + la llave ──
create or replace function privado.exigir_organizacion(p_gimnasio_id uuid, p_roles text[] default array['dueno', 'encargado', 'recepcion'])
returns public.equipo
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, p_roles);
  perform privado.exigir_funcion(p_gimnasio_id, 'pase_2_organizacion');
  return e;
end $$;
revoke all on function privado.exigir_organizacion(uuid, text[]) from public, anon, authenticated;

-- Las entradas que cuentan (las que dejaron entrar, sin anular).
create or replace function privado.entradas_socio(p_socio_id uuid, p_desde timestamptz, p_hasta timestamptz)
returns setof timestamptz
language sql stable set search_path = '' as $$
  select i.momento from public.ingresos i
   where i.socio_id = p_socio_id and i.momento >= p_desde and i.momento < p_hasta
     and i.resultado in ('entro', 'entro_modo_aviso', 'forzado') and i.anulado_en is null
$$;
revoke all on function privado.entradas_socio(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- Semanas seguidas (lunes a domingo, en la hora local) con al menos una entrada, contando hacia atrás desde la semana de p_momento.
-- La semana en curso sin entradas todavía no corta la racha: se cuenta desde la anterior.
create or replace function privado.racha_semanas(p_socio_id uuid, p_momento timestamptz, p_zona text)
returns jsonb
language plpgsql stable set search_path = '' as $$
declare semanas date[]; actual date; esperada date; seguidas int := 0; mejor int := 0; corrida int := 0; anterior date; s date;
begin
  select coalesce(array_agg(distinct date_trunc('week', m at time zone p_zona)::date order by date_trunc('week', m at time zone p_zona)::date desc), '{}')
    into semanas from privado.entradas_socio(p_socio_id, p_momento - interval '2 years', p_momento) m;
  actual := date_trunc('week', p_momento at time zone p_zona)::date;
  esperada := case when actual = any (semanas) then actual else actual - 7 end;
  foreach s in array semanas loop
    exit when s <> esperada;
    seguidas := seguidas + 1; esperada := esperada - 7;
  end loop;
  foreach s in array semanas loop
    corrida := case when anterior is not null and s = anterior - 7 then corrida + 1 else 1 end;
    mejor := greatest(mejor, corrida); anterior := s;
  end loop;
  return jsonb_build_object('semanas_seguidas', seguidas, 'mejor_racha', mejor);
end $$;
revoke all on function privado.racha_semanas(uuid, timestamptz, text) from public, anon, authenticated;

-- ── 4. Asistencia de un socio (panel lateral y ficha) ──
create or replace function public.numeros_socio(p_gimnasio_id uuid, p_socio_id uuid, p_momento timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; ini_mes timestamptz; ultima timestamptz; veces int; promedio numeric; racha jsonb; dias jsonb; hora int;
begin
  perform privado.exigir_organizacion(p_gimnasio_id);
  if not exists (select 1 from public.socios s where s.id = p_socio_id and s.gimnasio_id = p_gimnasio_id) then
    raise exception 'Ese socio no es de este gimnasio' using errcode = '42501';
  end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  ini_mes := privado.medianoche(date_trunc('month', p_momento at time zone zona)::date, zona);
  select max(m) into ultima from privado.entradas_socio(p_socio_id, p_momento - interval '2 years', p_momento) m;
  select count(distinct (m at time zone zona)::date) into veces from privado.entradas_socio(p_socio_id, ini_mes, p_momento) m;
  -- El promedio del gimnasio: días que vino este mes cada socio que vino al menos una vez.
  select round(avg(x.n), 1) into promedio from (
    select count(distinct (i.momento at time zone zona)::date) n from public.ingresos i
     where i.gimnasio_id = p_gimnasio_id and i.momento >= ini_mes and i.momento < p_momento
       and i.resultado in ('entro', 'entro_modo_aviso', 'forzado') and i.anulado_en is null
     group by i.socio_id) x;
  racha := privado.racha_semanas(p_socio_id, p_momento, zona);
  -- Cuándo viene: días distintos por día de la semana (1 = lunes) en las últimas 12 semanas; y la hora en que más veces entró.
  select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'veces', d.veces) order by d.dia), '[]'::jsonb) into dias from (
    select extract(isodow from (m at time zone zona))::int dia, count(distinct (m at time zone zona)::date)::int veces
      from privado.entradas_socio(p_socio_id, p_momento - interval '12 weeks', p_momento) m group by 1) d;
  select extract(hour from (m at time zone zona))::int into hora
    from privado.entradas_socio(p_socio_id, p_momento - interval '12 weeks', p_momento) m group by 1 order by count(*) desc, 1 limit 1;
  return jsonb_build_object('ultima_vez', ultima, 'veces_mes', veces, 'promedio_gimnasio_mes', coalesce(promedio, 0),
    'semanas_seguidas', racha -> 'semanas_seguidas', 'mejor_racha', racha -> 'mejor_racha', 'cuando_viene', dias, 'hora_habitual', hora);
end $$;

-- ── 5. Última vez y veces este mes de una lista de socios (columnas de Socios) ──
create or replace function public.numeros_socios(p_gimnasio_id uuid, p_socio_ids uuid[], p_momento timestamptz default now())
returns table (socio_id uuid, ultima_vez timestamptz, veces_mes int)
language plpgsql stable security definer set search_path = '' as $$
declare zona text; ini_mes timestamptz;
begin
  perform privado.exigir_organizacion(p_gimnasio_id);
  if cardinality(coalesce(p_socio_ids, '{}')) > 200 then raise exception 'Hasta 200 socios por pedido' using errcode = '22023'; end if;
  if exists (select 1 from unnest(coalesce(p_socio_ids, '{}')) x(id) where not exists (select 1 from public.socios s where s.id = x.id and s.gimnasio_id = p_gimnasio_id)) then
    raise exception 'Hay socios que no son de este gimnasio' using errcode = '42501';
  end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  ini_mes := privado.medianoche(date_trunc('month', p_momento at time zone zona)::date, zona);
  return query
    select x.id,
           (select max(i.momento) from public.ingresos i where i.gimnasio_id = p_gimnasio_id and i.socio_id = x.id and i.momento < p_momento
               and i.resultado in ('entro', 'entro_modo_aviso', 'forzado') and i.anulado_en is null),
           (select count(distinct (i.momento at time zone zona)::date)::int from public.ingresos i where i.gimnasio_id = p_gimnasio_id and i.socio_id = x.id
               and i.momento >= ini_mes and i.momento < p_momento and i.resultado in ('entro', 'entro_modo_aviso', 'forzado') and i.anulado_en is null)
      from unnest(coalesce(p_socio_ids, '{}')) x(id);
end $$;

-- ── 6. Volvieron este mes ──
create or replace function public.volvieron_mes(p_gimnasio_id uuid, p_momento timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; ini_mes timestamptz; filas jsonb;
begin
  perform privado.exigir_organizacion(p_gimnasio_id);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  ini_mes := privado.medianoche(date_trunc('month', p_momento at time zone zona)::date, zona);
  with primer_pago as (
    select v.socio_id, min(p.aprobado_en) as pago
      from public.pagos p join public.ventas v on v.id = p.venta_id
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and v.estado <> 'anulada' and v.socio_id is not null
       and p.aprobado_en >= ini_mes and p.aprobado_en < p_momento
     group by v.socio_id
  ), volvieron as (
    select pp.socio_id, pp.pago,
           (select max(m) from privado.entradas_socio(pp.socio_id, pp.pago - interval '2 years', pp.pago) m) as ultima,
           -- ¿tenía cobertura un rato antes de pagar? (sin cobertura = vencido)
           exists (select 1 from public.coberturas c where c.socio_id = pp.socio_id and c.anulada_en is null
                     and c.desde <= pp.pago - interval '1 minute' and c.hasta > pp.pago - interval '1 minute') as cubierto
      from primer_pago pp
  )
  select coalesce(jsonb_agg(jsonb_build_object('socio_id', s.id, 'nombre', trim(s.nombre || ' ' || s.apellido),
           'escrito', exists (select 1 from public.avisos_enviados a where a.socio_id = s.id and a.creado_en between vu.pago - interval '30 days' and vu.pago))
           order by vu.pago desc), '[]'::jsonb)
    into filas
    from volvieron vu join public.socios s on s.id = vu.socio_id
   where vu.ultima is not null and (vu.ultima <= vu.pago - interval '14 days' or not vu.cubierto);
  return jsonb_build_object('cantidad', jsonb_array_length(filas), 'socios', filas);
end $$;

-- ── 7. La plata de un socio: lo que pide la puerta para regularizar o, si no, el precio vigente de su plan ──
create or replace function privado.monto_socio(p_socio_id uuid, p_momento timestamptz)
returns table (monto numeric, plan text)
language sql stable set search_path = '' as $$
  select coalesce(nullif((privado.calcular_acceso(p_socio_id, p_momento)).para_regularizar, 0),
                  privado.precio_para(su.plan_id, p_momento, 'efectivo', null, true), 0)::numeric(12,2),
         pl.nombre
    from public.suscripciones su join public.planes pl on pl.id = su.plan_id
   where su.socio_id = p_socio_id and su.baja_en is null
   order by su.inicio desc limit 1
$$;
revoke all on function privado.monto_socio(uuid, timestamptz) from public, anon, authenticated;

-- Los que vencen entre p_desde y p_hasta y los que deben (vencidos hace menos de 30 días, con su plan activo), con su monto.
create or replace function privado.cobros_pendientes(p_gimnasio_id uuid, p_momento timestamptz, p_desde timestamptz, p_hasta timestamptz)
returns table (socio_id uuid, nombre text, telefono text, que text, vence timestamptz, monto numeric, plan text)
language sql stable set search_path = '' as $$
  select s.id, trim(s.nombre || ' ' || s.apellido), s.telefono,
         case when s.cubierto_hasta >= p_desde then 'vence' else 'debe' end, s.cubierto_hasta, m.monto, m.plan
    from public.socios s
    cross join lateral privado.monto_socio(s.id, p_momento) m
   where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null and s.cubierto_hasta is not null
     and ((s.cubierto_hasta >= p_desde and s.cubierto_hasta < p_hasta)
       or (s.cubierto_hasta < p_desde and s.cubierto_hasta >= p_desde - interval '30 days'))
$$;
revoke all on function privado.cobros_pendientes(uuid, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;

-- ── 8. Plata en juego hoy (Inicio y Para hacer hoy) ──
create or replace function public.plata_en_juego(p_gimnasio_id uuid, p_momento timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; zona text; hoy date; desde timestamptz; hasta timestamptz; filas jsonb; transf jsonb; interesados int;
begin
  e := privado.exigir_organizacion(p_gimnasio_id);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(p_momento, zona);
  desde := privado.medianoche(hoy, zona); hasta := privado.medianoche(hoy + 1, zona);
  select coalesce(jsonb_agg(jsonb_build_object('socio_id', c.socio_id, 'nombre', c.nombre, 'telefono', c.telefono, 'que', c.que, 'monto', c.monto, 'plan', c.plan)
           order by c.monto desc nulls last, c.nombre), '[]'::jsonb)
    into filas from privado.cobros_pendientes(p_gimnasio_id, p_momento, desde, hasta) c;
  select jsonb_build_object('cantidad', count(*), 'monto', coalesce(sum(p.monto), 0)) into transf
    from public.pagos p join public.ventas v on v.id = p.venta_id
   where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.medio = 'transferencia' and p.comprobante_path is not null
     and (e.sede_id is null or v.sede_id = e.sede_id);
  -- Interesados de ayer: no tienen plata (no se suman al total), solo se cuentan.
  select count(*) into interesados from public.prospectos x
   where x.gimnasio_id = p_gimnasio_id and x.estado in ('nuevo', 'vino') and x.creado_en >= privado.medianoche(hoy - 1, zona) and x.creado_en < desde;
  return jsonb_build_object(
    'vencen_hoy', jsonb_build_object('cantidad', (select count(*) from jsonb_array_elements(filas) x where x ->> 'que' = 'vence'),
                                     'monto', (select coalesce(sum((x ->> 'monto')::numeric), 0) from jsonb_array_elements(filas) x where x ->> 'que' = 'vence')),
    'deben', jsonb_build_object('cantidad', (select count(*) from jsonb_array_elements(filas) x where x ->> 'que' = 'debe'),
                                'monto', (select coalesce(sum((x ->> 'monto')::numeric), 0) from jsonb_array_elements(filas) x where x ->> 'que' = 'debe')),
    'transferencias', transf,
    'interesados', jsonb_build_object('cantidad', interesados),
    'total', (select coalesce(sum((x ->> 'monto')::numeric), 0) from jsonb_array_elements(filas) x) + (transf ->> 'monto')::numeric,
    'socios', filas);
end $$;

-- ── 9. Si cobrás lo que falta (Resultado del mes, solo lectura) ──
create or replace function public.si_cobras_lo_que_falta(p_gimnasio_id uuid, p_momento timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; desde timestamptz; fin_mes timestamptz; vence numeric; debe numeric; nv int; nd int;
begin
  perform privado.exigir_resultado(p_gimnasio_id);
  perform privado.exigir_funcion(p_gimnasio_id, 'pase_2_organizacion');
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(p_momento, zona);
  desde := privado.medianoche(hoy, zona);
  fin_mes := privado.medianoche((date_trunc('month', hoy) + interval '1 month')::date, zona);
  select coalesce(sum(c.monto) filter (where c.que = 'vence'), 0), coalesce(sum(c.monto) filter (where c.que = 'debe'), 0),
         count(*) filter (where c.que = 'vence'), count(*) filter (where c.que = 'debe')
    into vence, debe, nv, nd from privado.cobros_pendientes(p_gimnasio_id, p_momento, desde, fin_mes) c;
  return jsonb_build_object('vence_hasta_fin_de_mes', jsonb_build_object('cantidad', nv, 'monto', vence),
                            'se_debe', jsonb_build_object('cantidad', nd, 'monto', debe), 'total', vence + debe);
end $$;

-- ── 10. Transferencias a revisar: "Debe $X (plan)" y si el comprobante coincide ──
create or replace function public.transferencias_a_revisar(p_gimnasio_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_organizacion(p_gimnasio_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object('pago_id', p.id, 'socio_id', s.id, 'nombre', trim(s.nombre || ' ' || s.apellido), 'telefono', s.telefono,
             'comprobante', p.monto, 'debe', t.total, 'plan', t.que, 'coincide', p.monto = t.total, 'mandado_en', p.creado_en) order by p.creado_en)
      from public.pagos p join public.ventas v on v.id = p.venta_id join public.socios s on s.id = v.socio_id
      cross join lateral (select coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0)::numeric(12,2) total,
                                 string_agg(i.descripcion, ' + ' order by i.id) que
                            from public.venta_items i where i.venta_id = v.id) t
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.medio = 'transferencia' and p.comprobante_path is not null
       and (e.sede_id is null or v.sede_id = e.sede_id)), '[]'::jsonb);
end $$;

-- ── 11. ¿Hay mucha gente? (app del socio; sin nombres) ──
create or replace function public.ocupacion_por_hora(p_gimnasio_id uuid, p_socio_id uuid, p_momento timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; horas jsonb;
begin
  if not exists (select 1 from public.socios s where s.id = p_socio_id and s.gimnasio_id = p_gimnasio_id and s.usuario_id = auth.uid() and s.dado_de_baja_en is null) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  perform privado.exigir_funcion(p_gimnasio_id, 'pase_2_organizacion');
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(p_momento, zona);
  -- El mismo día de la semana de las últimas 4 semanas: entradas por hora, en promedio.
  select coalesce(jsonb_agg(jsonb_build_object('hora', h.hora, 'promedio', h.promedio) order by h.hora), '[]'::jsonb) into horas from (
    select extract(hour from (i.momento at time zone zona))::int hora, round(count(*) / 4.0, 1) promedio
      from public.ingresos i
     where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado in ('entro', 'entro_modo_aviso', 'forzado')
       and i.momento >= privado.medianoche(hoy - 28, zona) and i.momento < privado.medianoche(hoy, zona)
       and extract(isodow from (i.momento at time zone zona)) = extract(isodow from hoy)
     group by 1) h;
  return jsonb_build_object('dia', extract(isodow from hoy)::int, 'hora_actual', extract(hour from (p_momento at time zone zona))::int, 'horas', horas,
    'racha', privado.racha_semanas(p_socio_id, p_momento, zona));
end $$;

-- ── 12. Hecho hoy: lo que sale de un hecho + lo tildado a mano ──
create or replace function public.hecho_hoy(p_gimnasio_id uuid, p_momento timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; zona text; hoy date; desde timestamptz; hasta timestamptz; filas jsonb;
begin
  e := privado.exigir_organizacion(p_gimnasio_id);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(p_momento, zona);
  desde := privado.medianoche(hoy, zona); hasta := least(privado.medianoche(hoy + 1, zona), p_momento + interval '1 second');
  with todo as (
    -- Cobrado (en el mostrador) y aprobado (transferencia): el pago.
    select 'pago:' || p.id::text ref, case when p.medio = 'transferencia' then 'Aprobada: ' else 'Cobrado a ' end || trim(s.nombre || ' ' || s.apellido) texto,
           coalesce(p.aprobado_en, p.creado_en) en, coalesce(p.aprobado_por, p.creado_por) quien, false manual
      from public.pagos p join public.ventas v on v.id = p.venta_id join public.socios s on s.id = v.socio_id
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and v.estado <> 'anulada'
       and coalesce(p.aprobado_en, p.creado_en) >= desde and coalesce(p.aprobado_en, p.creado_en) < hasta
       and coalesce(p.aprobado_por, p.creado_por) is not null
    union all
    select 'aviso:' || a.id::text, 'Avisado: ' || trim(s.nombre || ' ' || s.apellido), a.creado_en, a.creado_por, false
      from public.avisos_enviados a join public.socios s on s.id = a.socio_id
     where a.gimnasio_id = p_gimnasio_id and a.creado_en >= desde and a.creado_en < hasta
    union all
    select 'mensaje:' || m.id::text, 'Contestado: ' || trim(s.nombre || ' ' || s.apellido), m.creado_en, m.equipo_id, false
      from public.mensajes_socio m join public.hilos_socio h on h.id = m.hilo_id join public.socios s on s.id = h.socio_id
     where m.gimnasio_id = p_gimnasio_id and m.autor = 'equipo' and m.creado_en >= desde and m.creado_en < hasta
    union all
    select 'tarea:' || t.id::text, 'Tarea: ' || t.que, t.hecha_en, t.hecha_por, false
      from public.tareas t where t.gimnasio_id = p_gimnasio_id and t.hecha_en >= desde and t.hecha_en < hasta
    union all
    select h.referencia, h.texto, h.hecho_en, h.hecho_por, true
      from public.hechos_para_hacer h where h.gimnasio_id = p_gimnasio_id and h.dia = hoy and h.anulado_en is null and h.hecho_en < hasta
  )
  select coalesce(jsonb_agg(jsonb_build_object('referencia', t.ref, 'texto', t.texto, 'en', t.en, 'quien', q.nombre, 'manual', t.manual,
           'puedo_deshacer', t.manual and t.quien = e.id) order by t.en desc), '[]'::jsonb)
    into filas from todo t left join public.equipo q on q.id = t.quien;
  return jsonb_build_object('cantidad', jsonb_array_length(filas), 'hechos', filas);
end $$;

create or replace function public.tildar_hecho(p_gimnasio_id uuid, p_referencia text, p_texto text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; zona text; hoy date; nuevo uuid;
begin
  e := privado.exigir_organizacion(p_gimnasio_id);
  if p_referencia is null or p_referencia !~ '^[a-z_]+:[0-9a-f-]{36}$|^[a-z_]+$' then raise exception 'Referencia inválida' using errcode = '22023'; end if;
  if p_referencia ~ '^(pago|aviso|mensaje|tarea):' then
    raise exception 'Eso se tilda solo cuando pasa (el cobro, el aviso, la respuesta o la tarea)' using errcode = '22023';
  end if;
  if p_texto is null or length(trim(p_texto)) not between 2 and 160 then raise exception 'Falta qué se hizo' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  insert into public.hechos_para_hacer (gimnasio_id, dia, referencia, texto, hecho_por)
  values (p_gimnasio_id, hoy, p_referencia, trim(p_texto), e.id)
  on conflict (gimnasio_id, dia, referencia) where anulado_en is null do nothing
  returning id into nuevo;
  if nuevo is null then raise exception 'Ya está tildado hoy' using errcode = '23505'; end if;
  return nuevo;
end $$;

-- Deshacer el último que tildé yo hoy: se anula (queda en la base, con quién y cuándo).
create or replace function public.deshacer_ultimo_hecho(p_gimnasio_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; zona text; hoy date; cual uuid; n int;
begin
  e := privado.exigir_organizacion(p_gimnasio_id);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  select h.id into cual from public.hechos_para_hacer h
   where h.gimnasio_id = p_gimnasio_id and h.dia = hoy and h.hecho_por = e.id and h.anulado_en is null
   order by h.hecho_en desc limit 1 for update;
  if cual is null then raise exception 'No hay nada tuyo para deshacer hoy' using errcode = 'P0002'; end if;
  update public.hechos_para_hacer set anulado_en = now(), anulado_por = e.id where id = cual and anulado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo deshacer: ya estaba deshecho' using errcode = '40001'; end if;
  return cual;
end $$;

-- ── 13. Permisos: solo con sesión (el equipo o el socio, según cada función) ──
revoke all on function public.numeros_socio(uuid, uuid, timestamptz), public.numeros_socios(uuid, uuid[], timestamptz),
  public.volvieron_mes(uuid, timestamptz), public.plata_en_juego(uuid, timestamptz), public.si_cobras_lo_que_falta(uuid, timestamptz),
  public.transferencias_a_revisar(uuid), public.ocupacion_por_hora(uuid, uuid, timestamptz), public.hecho_hoy(uuid, timestamptz),
  public.tildar_hecho(uuid, text, text), public.deshacer_ultimo_hecho(uuid) from public, anon;
grant execute on function public.numeros_socio(uuid, uuid, timestamptz), public.numeros_socios(uuid, uuid[], timestamptz),
  public.volvieron_mes(uuid, timestamptz), public.plata_en_juego(uuid, timestamptz), public.si_cobras_lo_que_falta(uuid, timestamptz),
  public.transferencias_a_revisar(uuid), public.ocupacion_por_hora(uuid, uuid, timestamptz), public.hecho_hoy(uuid, timestamptz),
  public.tildar_hecho(uuid, text, text), public.deshacer_ultimo_hecho(uuid) to authenticated, service_role;

-- ── 14. El lote suma las lecturas nuevas (misma función, misma seguridad: lista cerrada) ──
do $lote$
declare def text;
begin
  def := pg_get_functiondef('public.lote_lecturas(jsonb)'::regprocedure);
  if position('''plata_en_juego''' in def) = 0 then
    if position('''clases_del_dia'']' in def) = 0 then raise exception 'Guarda: la lista de lote_lecturas no termina como se esperaba (falta 20261125100000)'; end if;
    def := replace(def, '''clases_del_dia'']', '''clases_del_dia'',''numeros_socio'',''numeros_socios'',''volvieron_mes'',''plata_en_juego'',''si_cobras_lo_que_falta'',''transferencias_a_revisar'',''ocupacion_por_hora'',''hecho_hoy'',''funciones_nuevas_activas'']');
    execute def;
  end if;
end $lote$;

-- ── Verificación ────────────────────────────────────────────────────
do $v$
declare f text;
begin
  if not exists (select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where c ->> 'clave' = 'pase_2_organizacion' and coalesce(c ->> 'novedad', '') <> '') then
    raise exception 'Verificación: falta pase_2_organizacion en el catálogo';
  end if;
  if jsonb_array_length(privado.funciones_nuevas_catalogo()) <> 13 then raise exception 'Verificación: el catálogo no tiene las 13 claves'; end if;
  if exists (select 1 from public.funciones_nuevas_gimnasio x join public.gimnasios g on g.id = x.gimnasio_id
              where not g.es_demo and x.clave = 'pase_2_organizacion' and x.activa) then
    raise exception 'Verificación: pase_2_organizacion quedó prendida en un gimnasio real';
  end if;
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public.hechos_para_hacer'::regclass) then raise exception 'Verificación: hechos_para_hacer sin RLS'; end if;
  foreach f in array array['public.numeros_socio(uuid, uuid, timestamptz)', 'public.numeros_socios(uuid, uuid[], timestamptz)',
      'public.volvieron_mes(uuid, timestamptz)', 'public.plata_en_juego(uuid, timestamptz)', 'public.si_cobras_lo_que_falta(uuid, timestamptz)',
      'public.transferencias_a_revisar(uuid)', 'public.ocupacion_por_hora(uuid, uuid, timestamptz)', 'public.hecho_hoy(uuid, timestamptz)',
      'public.tildar_hecho(uuid, text, text)', 'public.deshacer_ultimo_hecho(uuid)', 'privado.exigir_organizacion(uuid, text[])',
      'privado.entradas_socio(uuid, timestamptz, timestamptz)', 'privado.racha_semanas(uuid, timestamptz, text)', 'privado.monto_socio(uuid, timestamptz)',
      'privado.cobros_pendientes(uuid, timestamptz, timestamptz, timestamptz)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
    if has_function_privilege('authenticated', f, 'execute') <> (f like 'public.%') then raise exception 'Verificación: permisos de %', f; end if;
  end loop;
  if position('''plata_en_juego''' in pg_get_functiondef('public.lote_lecturas(jsonb)'::regprocedure)) = 0 then raise exception 'Verificación: faltan las lecturas nuevas en lote_lecturas'; end if;
end $v$;
);
  end if;
end $chk$;

-- Prendida en los [demo] (solo donde todavía no hay fila: si alguien la apagó en un demo, queda apagada). Temple Gym no se toca: la prende Mateo.
insert into public.funciones_nuevas_gimnasio (gimnasio_id, clave, activa, prendida_en, cambiada_en)
select g.id, 'pase_2_organizacion', true, now(), now() from public.gimnasios g where g.es_demo
on conflict (gimnasio_id, clave) do nothing;

-- ── 2. Lo tildado a mano (lo que no tiene un hecho propio). Deshacer = anular, no borrar ──
create table if not exists public.hechos_para_hacer (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  dia          date not null,                                                     -- el día local del gimnasio en que se tildó
  referencia   text not null check (referencia ~ '^[a-z_]+:[0-9a-f-]{36}$|^[a-z_]+$'), -- qué se resolvió: "interesado:<id>", "llamar:<socio>", "tarea_auto:<clave>"
  texto        text not null check (length(trim(texto)) between 2 and 160),       -- cómo se lee en "Hecho hoy"
  hecho_en     timestamptz not null default now(),
  hecho_por    uuid not null,
  anulado_en   timestamptz,
  anulado_por  uuid,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, hecho_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, anulado_por) references public.equipo (gimnasio_id, id),
  check ((anulado_en is null) = (anulado_por is null))
);
-- Lo mismo no se tilda dos veces el mismo día (dos toques a la vez: queda uno solo).
create unique index if not exists hechos_para_hacer_uno on public.hechos_para_hacer (gimnasio_id, dia, referencia) where anulado_en is null;
create index if not exists hechos_para_hacer_dia on public.hechos_para_hacer (gimnasio_id, dia, hecho_en desc);
-- RLS en la misma migración: el mostrador lee; nadie escribe directo (solo tildar_hecho / deshacer_ultimo_hecho).
select privado.politicas_estandar('public.hechos_para_hacer', array['dueno', 'encargado', 'recepcion'], null);
revoke all on table public.hechos_para_hacer from anon;

-- ── 3. Lo que el panel exige: equipo del mostrador + la llave ──
create or replace function privado.exigir_organizacion(p_gimnasio_id uuid, p_roles text[] default array['dueno', 'encargado', 'recepcion'])
returns public.equipo
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, p_roles);
  perform privado.exigir_funcion(p_gimnasio_id, 'pase_2_organizacion');
  return e;
end $$;
revoke all on function privado.exigir_organizacion(uuid, text[]) from public, anon, authenticated;

-- Las entradas que cuentan (las que dejaron entrar, sin anular).
create or replace function privado.entradas_socio(p_socio_id uuid, p_desde timestamptz, p_hasta timestamptz)
returns setof timestamptz
language sql stable set search_path = '' as $$
  select i.momento from public.ingresos i
   where i.socio_id = p_socio_id and i.momento >= p_desde and i.momento < p_hasta
     and i.resultado in ('entro', 'entro_modo_aviso', 'forzado') and i.anulado_en is null
$$;
revoke all on function privado.entradas_socio(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- Semanas seguidas (lunes a domingo, en la hora local) con al menos una entrada, contando hacia atrás desde la semana de p_momento.
-- La semana en curso sin entradas todavía no corta la racha: se cuenta desde la anterior.
create or replace function privado.racha_semanas(p_socio_id uuid, p_momento timestamptz, p_zona text)
returns jsonb
language plpgsql stable set search_path = '' as $$
declare semanas date[]; actual date; esperada date; seguidas int := 0; mejor int := 0; corrida int := 0; anterior date; s date;
begin
  select coalesce(array_agg(distinct date_trunc('week', m at time zone p_zona)::date order by date_trunc('week', m at time zone p_zona)::date desc), '{}')
    into semanas from privado.entradas_socio(p_socio_id, p_momento - interval '2 years', p_momento) m;
  actual := date_trunc('week', p_momento at time zone p_zona)::date;
  esperada := case when actual = any (semanas) then actual else actual - 7 end;
  foreach s in array semanas loop
    exit when s <> esperada;
    seguidas := seguidas + 1; esperada := esperada - 7;
  end loop;
  foreach s in array semanas loop
    corrida := case when anterior is not null and s = anterior - 7 then corrida + 1 else 1 end;
    mejor := greatest(mejor, corrida); anterior := s;
  end loop;
  return jsonb_build_object('semanas_seguidas', seguidas, 'mejor_racha', mejor);
end $$;
revoke all on function privado.racha_semanas(uuid, timestamptz, text) from public, anon, authenticated;

-- ── 4. Asistencia de un socio (panel lateral y ficha) ──
create or replace function public.numeros_socio(p_gimnasio_id uuid, p_socio_id uuid, p_momento timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; ini_mes timestamptz; ultima timestamptz; veces int; promedio numeric; racha jsonb; dias jsonb; hora int;
begin
  perform privado.exigir_organizacion(p_gimnasio_id);
  if not exists (select 1 from public.socios s where s.id = p_socio_id and s.gimnasio_id = p_gimnasio_id) then
    raise exception 'Ese socio no es de este gimnasio' using errcode = '42501';
  end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  ini_mes := privado.medianoche(date_trunc('month', p_momento at time zone zona)::date, zona);
  select max(m) into ultima from privado.entradas_socio(p_socio_id, p_momento - interval '2 years', p_momento) m;
  select count(distinct (m at time zone zona)::date) into veces from privado.entradas_socio(p_socio_id, ini_mes, p_momento) m;
  -- El promedio del gimnasio: días que vino este mes cada socio que vino al menos una vez.
  select round(avg(x.n), 1) into promedio from (
    select count(distinct (i.momento at time zone zona)::date) n from public.ingresos i
     where i.gimnasio_id = p_gimnasio_id and i.momento >= ini_mes and i.momento < p_momento
       and i.resultado in ('entro', 'entro_modo_aviso', 'forzado') and i.anulado_en is null
     group by i.socio_id) x;
  racha := privado.racha_semanas(p_socio_id, p_momento, zona);
  -- Cuándo viene: días distintos por día de la semana (1 = lunes) en las últimas 12 semanas; y la hora en que más veces entró.
  select coalesce(jsonb_agg(jsonb_build_object('dia', d.dia, 'veces', d.veces) order by d.dia), '[]'::jsonb) into dias from (
    select extract(isodow from (m at time zone zona))::int dia, count(distinct (m at time zone zona)::date)::int veces
      from privado.entradas_socio(p_socio_id, p_momento - interval '12 weeks', p_momento) m group by 1) d;
  select extract(hour from (m at time zone zona))::int into hora
    from privado.entradas_socio(p_socio_id, p_momento - interval '12 weeks', p_momento) m group by 1 order by count(*) desc, 1 limit 1;
  return jsonb_build_object('ultima_vez', ultima, 'veces_mes', veces, 'promedio_gimnasio_mes', coalesce(promedio, 0),
    'semanas_seguidas', racha -> 'semanas_seguidas', 'mejor_racha', racha -> 'mejor_racha', 'cuando_viene', dias, 'hora_habitual', hora);
end $$;

-- ── 5. Última vez y veces este mes de una lista de socios (columnas de Socios) ──
create or replace function public.numeros_socios(p_gimnasio_id uuid, p_socio_ids uuid[], p_momento timestamptz default now())
returns table (socio_id uuid, ultima_vez timestamptz, veces_mes int)
language plpgsql stable security definer set search_path = '' as $$
declare zona text; ini_mes timestamptz;
begin
  perform privado.exigir_organizacion(p_gimnasio_id);
  if cardinality(coalesce(p_socio_ids, '{}')) > 200 then raise exception 'Hasta 200 socios por pedido' using errcode = '22023'; end if;
  if exists (select 1 from unnest(coalesce(p_socio_ids, '{}')) x(id) where not exists (select 1 from public.socios s where s.id = x.id and s.gimnasio_id = p_gimnasio_id)) then
    raise exception 'Hay socios que no son de este gimnasio' using errcode = '42501';
  end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  ini_mes := privado.medianoche(date_trunc('month', p_momento at time zone zona)::date, zona);
  return query
    select x.id,
           (select max(i.momento) from public.ingresos i where i.gimnasio_id = p_gimnasio_id and i.socio_id = x.id and i.momento < p_momento
               and i.resultado in ('entro', 'entro_modo_aviso', 'forzado') and i.anulado_en is null),
           (select count(distinct (i.momento at time zone zona)::date)::int from public.ingresos i where i.gimnasio_id = p_gimnasio_id and i.socio_id = x.id
               and i.momento >= ini_mes and i.momento < p_momento and i.resultado in ('entro', 'entro_modo_aviso', 'forzado') and i.anulado_en is null)
      from unnest(coalesce(p_socio_ids, '{}')) x(id);
end $$;

-- ── 6. Volvieron este mes ──
create or replace function public.volvieron_mes(p_gimnasio_id uuid, p_momento timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; ini_mes timestamptz; filas jsonb;
begin
  perform privado.exigir_organizacion(p_gimnasio_id);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  ini_mes := privado.medianoche(date_trunc('month', p_momento at time zone zona)::date, zona);
  with primer_pago as (
    select v.socio_id, min(p.aprobado_en) as pago
      from public.pagos p join public.ventas v on v.id = p.venta_id
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and v.estado <> 'anulada' and v.socio_id is not null
       and p.aprobado_en >= ini_mes and p.aprobado_en < p_momento
     group by v.socio_id
  ), volvieron as (
    select pp.socio_id, pp.pago,
           (select max(m) from privado.entradas_socio(pp.socio_id, pp.pago - interval '2 years', pp.pago) m) as ultima,
           -- ¿tenía cobertura un rato antes de pagar? (sin cobertura = vencido)
           exists (select 1 from public.coberturas c where c.socio_id = pp.socio_id and c.anulada_en is null
                     and c.desde <= pp.pago - interval '1 minute' and c.hasta > pp.pago - interval '1 minute') as cubierto
      from primer_pago pp
  )
  select coalesce(jsonb_agg(jsonb_build_object('socio_id', s.id, 'nombre', trim(s.nombre || ' ' || s.apellido),
           'escrito', exists (select 1 from public.avisos_enviados a where a.socio_id = s.id and a.creado_en between vu.pago - interval '30 days' and vu.pago))
           order by vu.pago desc), '[]'::jsonb)
    into filas
    from volvieron vu join public.socios s on s.id = vu.socio_id
   where vu.ultima is not null and (vu.ultima <= vu.pago - interval '14 days' or not vu.cubierto);
  return jsonb_build_object('cantidad', jsonb_array_length(filas), 'socios', filas);
end $$;

-- ── 7. La plata de un socio: lo que pide la puerta para regularizar o, si no, el precio vigente de su plan ──
create or replace function privado.monto_socio(p_socio_id uuid, p_momento timestamptz)
returns table (monto numeric, plan text)
language sql stable set search_path = '' as $$
  select coalesce(nullif((privado.calcular_acceso(p_socio_id, p_momento)).para_regularizar, 0),
                  privado.precio_para(su.plan_id, p_momento, 'efectivo', null, true), 0)::numeric(12,2),
         pl.nombre
    from public.suscripciones su join public.planes pl on pl.id = su.plan_id
   where su.socio_id = p_socio_id and su.baja_en is null
   order by su.inicio desc limit 1
$$;
revoke all on function privado.monto_socio(uuid, timestamptz) from public, anon, authenticated;

-- Los que vencen entre p_desde y p_hasta y los que deben (vencidos hace menos de 30 días, con su plan activo), con su monto.
create or replace function privado.cobros_pendientes(p_gimnasio_id uuid, p_momento timestamptz, p_desde timestamptz, p_hasta timestamptz)
returns table (socio_id uuid, nombre text, telefono text, que text, vence timestamptz, monto numeric, plan text)
language sql stable set search_path = '' as $$
  select s.id, trim(s.nombre || ' ' || s.apellido), s.telefono,
         case when s.cubierto_hasta >= p_desde then 'vence' else 'debe' end, s.cubierto_hasta, m.monto, m.plan
    from public.socios s
    cross join lateral privado.monto_socio(s.id, p_momento) m
   where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null and s.cubierto_hasta is not null
     and ((s.cubierto_hasta >= p_desde and s.cubierto_hasta < p_hasta)
       or (s.cubierto_hasta < p_desde and s.cubierto_hasta >= p_desde - interval '30 days'))
$$;
revoke all on function privado.cobros_pendientes(uuid, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;

-- ── 8. Plata en juego hoy (Inicio y Para hacer hoy) ──
create or replace function public.plata_en_juego(p_gimnasio_id uuid, p_momento timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; zona text; hoy date; desde timestamptz; hasta timestamptz; filas jsonb; transf jsonb; interesados int;
begin
  e := privado.exigir_organizacion(p_gimnasio_id);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(p_momento, zona);
  desde := privado.medianoche(hoy, zona); hasta := privado.medianoche(hoy + 1, zona);
  select coalesce(jsonb_agg(jsonb_build_object('socio_id', c.socio_id, 'nombre', c.nombre, 'telefono', c.telefono, 'que', c.que, 'monto', c.monto, 'plan', c.plan)
           order by c.monto desc nulls last, c.nombre), '[]'::jsonb)
    into filas from privado.cobros_pendientes(p_gimnasio_id, p_momento, desde, hasta) c;
  select jsonb_build_object('cantidad', count(*), 'monto', coalesce(sum(p.monto), 0)) into transf
    from public.pagos p join public.ventas v on v.id = p.venta_id
   where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.medio = 'transferencia' and p.comprobante_path is not null
     and (e.sede_id is null or v.sede_id = e.sede_id);
  -- Interesados de ayer: no tienen plata (no se suman al total), solo se cuentan.
  select count(*) into interesados from public.prospectos x
   where x.gimnasio_id = p_gimnasio_id and x.estado in ('nuevo', 'vino') and x.creado_en >= privado.medianoche(hoy - 1, zona) and x.creado_en < desde;
  return jsonb_build_object(
    'vencen_hoy', jsonb_build_object('cantidad', (select count(*) from jsonb_array_elements(filas) x where x ->> 'que' = 'vence'),
                                     'monto', (select coalesce(sum((x ->> 'monto')::numeric), 0) from jsonb_array_elements(filas) x where x ->> 'que' = 'vence')),
    'deben', jsonb_build_object('cantidad', (select count(*) from jsonb_array_elements(filas) x where x ->> 'que' = 'debe'),
                                'monto', (select coalesce(sum((x ->> 'monto')::numeric), 0) from jsonb_array_elements(filas) x where x ->> 'que' = 'debe')),
    'transferencias', transf,
    'interesados', jsonb_build_object('cantidad', interesados),
    'total', (select coalesce(sum((x ->> 'monto')::numeric), 0) from jsonb_array_elements(filas) x) + (transf ->> 'monto')::numeric,
    'socios', filas);
end $$;

-- ── 9. Si cobrás lo que falta (Resultado del mes, solo lectura) ──
create or replace function public.si_cobras_lo_que_falta(p_gimnasio_id uuid, p_momento timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; desde timestamptz; fin_mes timestamptz; vence numeric; debe numeric; nv int; nd int;
begin
  perform privado.exigir_resultado(p_gimnasio_id);
  perform privado.exigir_funcion(p_gimnasio_id, 'pase_2_organizacion');
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(p_momento, zona);
  desde := privado.medianoche(hoy, zona);
  fin_mes := privado.medianoche((date_trunc('month', hoy) + interval '1 month')::date, zona);
  select coalesce(sum(c.monto) filter (where c.que = 'vence'), 0), coalesce(sum(c.monto) filter (where c.que = 'debe'), 0),
         count(*) filter (where c.que = 'vence'), count(*) filter (where c.que = 'debe')
    into vence, debe, nv, nd from privado.cobros_pendientes(p_gimnasio_id, p_momento, desde, fin_mes) c;
  return jsonb_build_object('vence_hasta_fin_de_mes', jsonb_build_object('cantidad', nv, 'monto', vence),
                            'se_debe', jsonb_build_object('cantidad', nd, 'monto', debe), 'total', vence + debe);
end $$;

-- ── 10. Transferencias a revisar: "Debe $X (plan)" y si el comprobante coincide ──
create or replace function public.transferencias_a_revisar(p_gimnasio_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_organizacion(p_gimnasio_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object('pago_id', p.id, 'socio_id', s.id, 'nombre', trim(s.nombre || ' ' || s.apellido), 'telefono', s.telefono,
             'comprobante', p.monto, 'debe', t.total, 'plan', t.que, 'coincide', p.monto = t.total, 'mandado_en', p.creado_en) order by p.creado_en)
      from public.pagos p join public.ventas v on v.id = p.venta_id join public.socios s on s.id = v.socio_id
      cross join lateral (select coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0)::numeric(12,2) total,
                                 string_agg(i.descripcion, ' + ' order by i.id) que
                            from public.venta_items i where i.venta_id = v.id) t
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.medio = 'transferencia' and p.comprobante_path is not null
       and (e.sede_id is null or v.sede_id = e.sede_id)), '[]'::jsonb);
end $$;

-- ── 11. ¿Hay mucha gente? (app del socio; sin nombres) ──
create or replace function public.ocupacion_por_hora(p_gimnasio_id uuid, p_socio_id uuid, p_momento timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; horas jsonb;
begin
  if not exists (select 1 from public.socios s where s.id = p_socio_id and s.gimnasio_id = p_gimnasio_id and s.usuario_id = auth.uid() and s.dado_de_baja_en is null) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  perform privado.exigir_funcion(p_gimnasio_id, 'pase_2_organizacion');
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(p_momento, zona);
  -- El mismo día de la semana de las últimas 4 semanas: entradas por hora, en promedio.
  select coalesce(jsonb_agg(jsonb_build_object('hora', h.hora, 'promedio', h.promedio) order by h.hora), '[]'::jsonb) into horas from (
    select extract(hour from (i.momento at time zone zona))::int hora, round(count(*) / 4.0, 1) promedio
      from public.ingresos i
     where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado in ('entro', 'entro_modo_aviso', 'forzado')
       and i.momento >= privado.medianoche(hoy - 28, zona) and i.momento < privado.medianoche(hoy, zona)
       and extract(isodow from (i.momento at time zone zona)) = extract(isodow from hoy)
     group by 1) h;
  return jsonb_build_object('dia', extract(isodow from hoy)::int, 'hora_actual', extract(hour from (p_momento at time zone zona))::int, 'horas', horas,
    'racha', privado.racha_semanas(p_socio_id, p_momento, zona));
end $$;

-- ── 12. Hecho hoy: lo que sale de un hecho + lo tildado a mano ──
create or replace function public.hecho_hoy(p_gimnasio_id uuid, p_momento timestamptz default now())
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; zona text; hoy date; desde timestamptz; hasta timestamptz; filas jsonb;
begin
  e := privado.exigir_organizacion(p_gimnasio_id);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(p_momento, zona);
  desde := privado.medianoche(hoy, zona); hasta := least(privado.medianoche(hoy + 1, zona), p_momento + interval '1 second');
  with todo as (
    -- Cobrado (en el mostrador) y aprobado (transferencia): el pago.
    select 'pago:' || p.id::text ref, case when p.medio = 'transferencia' then 'Aprobada: ' else 'Cobrado a ' end || trim(s.nombre || ' ' || s.apellido) texto,
           coalesce(p.aprobado_en, p.creado_en) en, coalesce(p.aprobado_por, p.creado_por) quien, false manual
      from public.pagos p join public.ventas v on v.id = p.venta_id join public.socios s on s.id = v.socio_id
     where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and v.estado <> 'anulada'
       and coalesce(p.aprobado_en, p.creado_en) >= desde and coalesce(p.aprobado_en, p.creado_en) < hasta
       and coalesce(p.aprobado_por, p.creado_por) is not null
    union all
    select 'aviso:' || a.id::text, 'Avisado: ' || trim(s.nombre || ' ' || s.apellido), a.creado_en, a.creado_por, false
      from public.avisos_enviados a join public.socios s on s.id = a.socio_id
     where a.gimnasio_id = p_gimnasio_id and a.creado_en >= desde and a.creado_en < hasta
    union all
    select 'mensaje:' || m.id::text, 'Contestado: ' || trim(s.nombre || ' ' || s.apellido), m.creado_en, m.equipo_id, false
      from public.mensajes_socio m join public.hilos_socio h on h.id = m.hilo_id join public.socios s on s.id = h.socio_id
     where m.gimnasio_id = p_gimnasio_id and m.autor = 'equipo' and m.creado_en >= desde and m.creado_en < hasta
    union all
    select 'tarea:' || t.id::text, 'Tarea: ' || t.que, t.hecha_en, t.hecha_por, false
      from public.tareas t where t.gimnasio_id = p_gimnasio_id and t.hecha_en >= desde and t.hecha_en < hasta
    union all
    select h.referencia, h.texto, h.hecho_en, h.hecho_por, true
      from public.hechos_para_hacer h where h.gimnasio_id = p_gimnasio_id and h.dia = hoy and h.anulado_en is null and h.hecho_en < hasta
  )
  select coalesce(jsonb_agg(jsonb_build_object('referencia', t.ref, 'texto', t.texto, 'en', t.en, 'quien', q.nombre, 'manual', t.manual,
           'puedo_deshacer', t.manual and t.quien = e.id) order by t.en desc), '[]'::jsonb)
    into filas from todo t left join public.equipo q on q.id = t.quien;
  return jsonb_build_object('cantidad', jsonb_array_length(filas), 'hechos', filas);
end $$;

create or replace function public.tildar_hecho(p_gimnasio_id uuid, p_referencia text, p_texto text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; zona text; hoy date; nuevo uuid;
begin
  e := privado.exigir_organizacion(p_gimnasio_id);
  if p_referencia is null or p_referencia !~ '^[a-z_]+:[0-9a-f-]{36}$|^[a-z_]+$' then raise exception 'Referencia inválida' using errcode = '22023'; end if;
  if p_referencia ~ '^(pago|aviso|mensaje|tarea):' then
    raise exception 'Eso se tilda solo cuando pasa (el cobro, el aviso, la respuesta o la tarea)' using errcode = '22023';
  end if;
  if p_texto is null or length(trim(p_texto)) not between 2 and 160 then raise exception 'Falta qué se hizo' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  insert into public.hechos_para_hacer (gimnasio_id, dia, referencia, texto, hecho_por)
  values (p_gimnasio_id, hoy, p_referencia, trim(p_texto), e.id)
  on conflict (gimnasio_id, dia, referencia) where anulado_en is null do nothing
  returning id into nuevo;
  if nuevo is null then raise exception 'Ya está tildado hoy' using errcode = '23505'; end if;
  return nuevo;
end $$;

-- Deshacer el último que tildé yo hoy: se anula (queda en la base, con quién y cuándo).
create or replace function public.deshacer_ultimo_hecho(p_gimnasio_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; zona text; hoy date; cual uuid; n int;
begin
  e := privado.exigir_organizacion(p_gimnasio_id);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  select h.id into cual from public.hechos_para_hacer h
   where h.gimnasio_id = p_gimnasio_id and h.dia = hoy and h.hecho_por = e.id and h.anulado_en is null
   order by h.hecho_en desc limit 1 for update;
  if cual is null then raise exception 'No hay nada tuyo para deshacer hoy' using errcode = 'P0002'; end if;
  update public.hechos_para_hacer set anulado_en = now(), anulado_por = e.id where id = cual and anulado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo deshacer: ya estaba deshecho' using errcode = '40001'; end if;
  return cual;
end $$;

-- ── 13. Permisos: solo con sesión (el equipo o el socio, según cada función) ──
revoke all on function public.numeros_socio(uuid, uuid, timestamptz), public.numeros_socios(uuid, uuid[], timestamptz),
  public.volvieron_mes(uuid, timestamptz), public.plata_en_juego(uuid, timestamptz), public.si_cobras_lo_que_falta(uuid, timestamptz),
  public.transferencias_a_revisar(uuid), public.ocupacion_por_hora(uuid, uuid, timestamptz), public.hecho_hoy(uuid, timestamptz),
  public.tildar_hecho(uuid, text, text), public.deshacer_ultimo_hecho(uuid) from public, anon;
grant execute on function public.numeros_socio(uuid, uuid, timestamptz), public.numeros_socios(uuid, uuid[], timestamptz),
  public.volvieron_mes(uuid, timestamptz), public.plata_en_juego(uuid, timestamptz), public.si_cobras_lo_que_falta(uuid, timestamptz),
  public.transferencias_a_revisar(uuid), public.ocupacion_por_hora(uuid, uuid, timestamptz), public.hecho_hoy(uuid, timestamptz),
  public.tildar_hecho(uuid, text, text), public.deshacer_ultimo_hecho(uuid) to authenticated, service_role;

-- ── 14. El lote suma las lecturas nuevas (misma función, misma seguridad: lista cerrada) ──
do $lote$
declare def text;
begin
  def := pg_get_functiondef('public.lote_lecturas(jsonb)'::regprocedure);
  if position('''plata_en_juego''' in def) = 0 then
    if position('''clases_del_dia'']' in def) = 0 then raise exception 'Guarda: la lista de lote_lecturas no termina como se esperaba (falta 20261125100000)'; end if;
    def := replace(def, '''clases_del_dia'']', '''clases_del_dia'',''numeros_socio'',''numeros_socios'',''volvieron_mes'',''plata_en_juego'',''si_cobras_lo_que_falta'',''transferencias_a_revisar'',''ocupacion_por_hora'',''hecho_hoy'',''funciones_nuevas_activas'']');
    execute def;
  end if;
end $lote$;

-- ── Verificación ────────────────────────────────────────────────────
do $v$
declare f text;
begin
  if not exists (select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where c ->> 'clave' = 'pase_2_organizacion' and coalesce(c ->> 'novedad', '') <> '') then
    raise exception 'Verificación: falta pase_2_organizacion en el catálogo';
  end if;
  if jsonb_array_length(privado.funciones_nuevas_catalogo()) <> 13 then raise exception 'Verificación: el catálogo no tiene las 13 claves'; end if;
  if exists (select 1 from public.funciones_nuevas_gimnasio x join public.gimnasios g on g.id = x.gimnasio_id
              where not g.es_demo and x.clave = 'pase_2_organizacion' and x.activa) then
    raise exception 'Verificación: pase_2_organizacion quedó prendida en un gimnasio real';
  end if;
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public.hechos_para_hacer'::regclass) then raise exception 'Verificación: hechos_para_hacer sin RLS'; end if;
  foreach f in array array['public.numeros_socio(uuid, uuid, timestamptz)', 'public.numeros_socios(uuid, uuid[], timestamptz)',
      'public.volvieron_mes(uuid, timestamptz)', 'public.plata_en_juego(uuid, timestamptz)', 'public.si_cobras_lo_que_falta(uuid, timestamptz)',
      'public.transferencias_a_revisar(uuid)', 'public.ocupacion_por_hora(uuid, uuid, timestamptz)', 'public.hecho_hoy(uuid, timestamptz)',
      'public.tildar_hecho(uuid, text, text)', 'public.deshacer_ultimo_hecho(uuid)', 'privado.exigir_organizacion(uuid, text[])',
      'privado.entradas_socio(uuid, timestamptz, timestamptz)', 'privado.racha_semanas(uuid, timestamptz, text)', 'privado.monto_socio(uuid, timestamptz)',
      'privado.cobros_pendientes(uuid, timestamptz, timestamptz, timestamptz)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
    if has_function_privilege('authenticated', f, 'execute') <> (f like 'public.%') then raise exception 'Verificación: permisos de %', f; end if;
  end loop;
  if position('''plata_en_juego''' in pg_get_functiondef('public.lote_lecturas(jsonb)'::regprocedure)) = 0 then raise exception 'Verificación: faltan las lecturas nuevas en lote_lecturas'; end if;
end $v$;
