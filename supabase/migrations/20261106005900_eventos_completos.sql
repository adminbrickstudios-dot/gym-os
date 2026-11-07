-- VD-19 · Eventos completos (docs/v2/03-DUENO.md §9).
-- Sobre COM-8 (el evento es un producto con stock = cupo; quien paga en Vender queda anotado):
--   · flyer (la foto del producto), lugar, responsable, fin, varias fechas (ciclo),
--     precio general y precio de socio, borrador / publicado / lleno / terminado / cancelado;
--   · inscripción desde la app (socio) y desde la página (no socio) = una RESERVA que se paga en
--     recepción (en Vender); cuando el socio paga, la venta reemplaza a la reserva sin contar doble;
--   · lista de espera DERIVADA (nada que se guarde ni que dependa de un cron): las reservas se
--     ordenan por llegada y entran mientras haya lugar; si alguien cancela, la siguiente sube sola;
--   · check-in el día del evento (la ventana de Entrada lo ofrece al reconocer al socio) y el
--     resumen de quiénes asistieron al cerrar.
-- Plata: el producto vende al precio GENERAL; el precio de socio se muestra y se acuerda en la reserva
-- (la recepción lo aplica con el descuento de Vender). No se toca vender ni registrar_ingreso.
--   inscribirse_evento(socio, evento)  cancelar_inscripcion_evento(socio, evento)  (socio, desde la app)
--   inscribirse_evento_publico(host, evento, nombre, dni, telefono)                (página, sin sesión)
--   evento_marcar_presente / evento_quitar_presente / eventos_del_dia_socio        (equipo)
--   publicar_evento(evento)  crear_evento(...) con más datos  cerrar_evento(evento) con motivo

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.eventos') is null then raise exception 'Guarda: falta eventos (COM-8)'; end if;
  if to_regprocedure('privado.evento_json(public.eventos, boolean)') is null then raise exception 'Guarda: falta privado.evento_json'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
end $$;

-- ── Columnas nuevas (aditivas) ──────────────────────────────────────
alter table public.eventos add column if not exists fin timestamptz;
alter table public.eventos add column if not exists fechas_extra timestamptz[] not null default '{}';
alter table public.eventos add column if not exists lugar text check (lugar is null or length(lugar) <= 120);
alter table public.eventos add column if not exists responsable text check (responsable is null or length(responsable) <= 80);
alter table public.eventos add column if not exists precio_socio numeric(12,2) check (precio_socio is null or precio_socio >= 0);
alter table public.eventos add column if not exists lista_espera boolean not null default true;
alter table public.eventos add column if not exists borrador boolean not null default false;
alter table public.eventos add column if not exists cerrado_motivo text check (cerrado_motivo is null or cerrado_motivo in ('terminado', 'cancelado'));
-- Los que ya estaban cerrados: terminado si ya pasó, cancelado si no.
update public.eventos set cerrado_motivo = case when inicio < cerrado_en then 'terminado' else 'cancelado' end
 where cerrado_en is not null and cerrado_motivo is null;

-- ── Inscripciones (reservas desde la app o la página) ───────────────
create table if not exists public.evento_inscripciones (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  evento_id     uuid not null,
  socio_id      uuid,
  nombre        text not null check (length(trim(nombre)) between 3 and 80),
  dni           text check (dni is null or dni ~ '^[0-9]{6,9}$'),
  telefono      text check (telefono is null or telefono ~ '^\+[0-9]{8,15}$'),
  precio        numeric(12,2) not null default 0 check (precio >= 0),
  origen        text not null check (origen in ('app', 'pagina')),
  cancelada_en  timestamptz,
  -- clock_timestamp y no now(): el orden de llegada (la lista de espera) no puede empatar dentro de una misma transacción.
  creado_en     timestamptz not null default clock_timestamp(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, evento_id) references public.eventos (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  check (socio_id is not null or dni is not null)
);
create unique index if not exists evento_inscripciones_socio on public.evento_inscripciones (gimnasio_id, evento_id, socio_id) where socio_id is not null and cancelada_en is null;
create unique index if not exists evento_inscripciones_dni on public.evento_inscripciones (gimnasio_id, evento_id, dni) where dni is not null and cancelada_en is null;
create index if not exists evento_inscripciones_evento on public.evento_inscripciones (gimnasio_id, evento_id, creado_en);
select privado.politicas_estandar('public.evento_inscripciones', array['dueno', 'encargado', 'recepcion'], null, false);
revoke all on table public.evento_inscripciones from anon;
revoke truncate, references, trigger on public.evento_inscripciones from authenticated;

-- ── Asistencia (check-in el día del evento) ─────────────────────────
create table if not exists public.evento_asistencias (
  id             uuid primary key default gen_random_uuid(),
  gimnasio_id    uuid not null references public.gimnasios(id),
  evento_id      uuid not null,
  socio_id       uuid,
  inscripcion_id uuid,
  dia            date not null,
  momento        timestamptz not null default now(),
  creado_por     uuid not null,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, evento_id) references public.eventos (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, inscripcion_id) references public.evento_inscripciones (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id),
  check (socio_id is not null or inscripcion_id is not null)
);
create unique index if not exists evento_asistencias_socio on public.evento_asistencias (gimnasio_id, evento_id, socio_id, dia) where socio_id is not null;
create unique index if not exists evento_asistencias_inscripcion on public.evento_asistencias (gimnasio_id, evento_id, inscripcion_id, dia) where socio_id is null;
create index if not exists evento_asistencias_evento on public.evento_asistencias (gimnasio_id, evento_id);
select privado.politicas_estandar('public.evento_asistencias', array['dueno', 'encargado', 'recepcion'], null, false);
revoke all on table public.evento_asistencias from anon;
revoke truncate, references, trigger on public.evento_asistencias from authenticated;

-- ── Ayudas ──────────────────────────────────────────────────────────
create or replace function privado.evento_fechas(ev public.eventos) returns timestamptz[]
language sql immutable set search_path = '' as $$
  select array(select f from unnest(array[ev.inicio] || ev.fechas_extra) f order by f)
$$;

-- La última fecha del evento: mientras no pasó, se ve y se puede anotar.
create or replace function privado.evento_ultima(ev public.eventos) returns timestamptz
language sql immutable set search_path = '' as $$
  select greatest(ev.inicio, coalesce((select max(f) from unnest(ev.fechas_extra) f), ev.inicio))
$$;

-- Quiénes están anotados (ventas + reservas), quiénes esperan y cuántos lugares quedan. Todo derivado.
create or replace function privado.evento_gente(ev public.eventos) returns jsonb
language sql stable security definer set search_path = '' as $$
  with venta as (
    select v.id as vid, v.socio_id, vi.cantidad, v.creado_en
      from public.venta_items vi join public.ventas v on v.id = vi.venta_id
     where vi.producto_id = ev.producto_id and vi.tipo = 'producto' and v.estado <> 'anulada'),
  tot as (select coalesce(sum(cantidad), 0)::int as vendidos from venta),
  reserva as (
    select i.id, i.socio_id, i.nombre, i.dni, i.telefono, i.precio, i.origen, i.creado_en,
           row_number() over (order by i.creado_en, i.id) as rn
      from public.evento_inscripciones i
     where i.evento_id = ev.id and i.cancelada_en is null
       and (i.socio_id is null or not exists (select 1 from venta w where w.socio_id = i.socio_id))),
  lug as (select greatest(ev.cupo - (select vendidos from tot), 0) as n),
  todos as (
    select ('v:' || w.vid::text) as clave, coalesce(trim(s.nombre || ' ' || s.apellido), 'Sin socio (venta suelta)') as nombre, w.cantidad,
           w.socio_id, null::uuid as inscripcion_id, true as pago, s.telefono, s.dni, 'recepcion'::text as origen, null::numeric as precio,
           w.creado_en, 0::bigint as rn, false as espera
      from venta w left join public.socios s on s.id = w.socio_id
    union all
    select 'i:' || r.id::text, r.nombre, 1, r.socio_id, r.id, (r.precio = 0), coalesce(r.telefono, s.telefono), coalesce(r.dni, s.dni), r.origen, r.precio,
           r.creado_en, r.rn, (r.rn > (select n from lug))
      from reserva r left join public.socios s on s.id = r.socio_id),
  marcados as (
    select t.*, exists (select 1 from public.evento_asistencias a where a.evento_id = ev.id
                         and ((t.socio_id is not null and a.socio_id = t.socio_id) or (t.socio_id is null and a.inscripcion_id = t.inscripcion_id))) as presente
      from todos t)
  select jsonb_build_object(
    'vendidos', (select vendidos from tot),
    'reservados', (select count(*) from reserva),
    'quedan', greatest(ev.cupo - (select vendidos from tot) - (select count(*) from reserva), 0),
    'anotados', coalesce((select jsonb_agg(jsonb_build_object('clave', m.clave, 'nombre', m.nombre, 'cantidad', m.cantidad, 'socio_id', m.socio_id,
        'inscripcion_id', m.inscripcion_id, 'pago', m.pago, 'telefono', m.telefono, 'dni', m.dni, 'origen', m.origen, 'precio', m.precio, 'presente', m.presente) order by m.creado_en, m.clave)
        from marcados m where not m.espera), '[]'::jsonb),
    'espera', coalesce((select jsonb_agg(jsonb_build_object('clave', m.clave, 'nombre', m.nombre, 'socio_id', m.socio_id, 'inscripcion_id', m.inscripcion_id,
        'telefono', m.telefono, 'dni', m.dni, 'origen', m.origen, 'posicion', m.rn - (select n from lug)) order by m.rn)
        from marcados m where m.espera), '[]'::jsonb))
$$;
revoke all on function privado.evento_fechas(public.eventos), privado.evento_ultima(public.eventos), privado.evento_gente(public.eventos) from public, anon, authenticated;

-- El evento tal como lo muestra cualquier pantalla. Con p_con_anotados: quiénes, espera y asistentes (solo el panel).
create or replace function privado.evento_json(ev public.eventos, p_con_anotados boolean) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p public.productos; g jsonb; zona text; r jsonb;
begin
  select * into p from public.productos where id = ev.producto_id;
  g := privado.evento_gente(ev);
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = ev.gimnasio_id;
  r := jsonb_build_object('evento_id', ev.id, 'producto_id', ev.producto_id,
         'nombre', regexp_replace(p.nombre, '^🎟️ (.*) · \d\d/\d\d \d\d:\d\d$', '\1'),
         'inicio', ev.inicio, 'fin', ev.fin, 'fechas', to_jsonb(privado.evento_fechas(ev)),
         'precio', p.precio, 'precio_socio', ev.precio_socio, 'descripcion', ev.descripcion, 'cupo', ev.cupo, 'para', ev.para,
         'lugar', ev.lugar, 'responsable', ev.responsable, 'flyer', p.foto_path, 'lista_espera', ev.lista_espera,
         'quedan', (g->>'quedan')::int, 'en_espera', jsonb_array_length(g->'espera'), 'cerrado', ev.cerrado_en is not null,
         'cerrado_motivo', ev.cerrado_motivo, 'borrador', ev.borrador, 'zona', zona);
  if p_con_anotados then
    r := r || jsonb_build_object('anotados', g->'anotados', 'espera', g->'espera',
      'asistieron', (select count(*) from jsonb_array_elements(g->'anotados') a where (a->>'presente')::boolean));
  end if;
  return r;
end $$;
revoke all on function privado.evento_json(public.eventos, boolean) from public, anon, authenticated;

-- ── Crear (la firma crece: la vieja se borra) ───────────────────────
drop function if exists public.crear_evento(uuid, text, timestamptz, int, numeric, text, text);

create or replace function public.crear_evento(p_gimnasio_id uuid, p_nombre text, p_inicio timestamptz, p_cupo int, p_precio numeric,
    p_descripcion text default null, p_para text default 'todos', p_fin timestamptz default null, p_fechas_extra timestamptz[] default '{}',
    p_lugar text default null, p_responsable text default null, p_precio_socio numeric default null, p_borrador boolean default false,
    p_lista_espera boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; v_nombre text := trim(coalesce(p_nombre, '')); v_prod uuid; v_id uuid; zona text; f timestamptz;
        v_extra timestamptz[] := coalesce(p_fechas_extra, '{}');
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if length(v_nombre) < 3 or length(v_nombre) > 60 then raise exception 'El nombre del evento tiene que tener entre 3 y 60 letras.' using errcode = '22023'; end if;
  if p_inicio is null or p_inicio < now() then raise exception 'Elegí un día y una hora que todavía no pasaron.' using errcode = '22023'; end if;
  if p_cupo is null or p_cupo < 1 or p_cupo > 1000 then raise exception 'El cupo va de 1 a 1.000 lugares.' using errcode = '22023'; end if;
  if p_precio is null or p_precio < 0 or p_precio > 10000000 then raise exception 'El precio no es válido (0 si es gratis).' using errcode = '22023'; end if;
  if p_precio_socio is not null and (p_precio_socio < 0 or p_precio_socio > p_precio) then
    raise exception 'El precio de socio no puede ser más caro que el general.' using errcode = '22023'; end if;
  if p_para not in ('todos', 'socios') then raise exception 'Para quién: todos o solo socios.' using errcode = '22023'; end if;
  if length(coalesce(p_descripcion, '')) > 300 then raise exception 'La descripción puede tener hasta 300 letras.' using errcode = '22023'; end if;
  if length(coalesce(p_lugar, '')) > 120 then raise exception 'El lugar puede tener hasta 120 letras.' using errcode = '22023'; end if;
  if length(coalesce(p_responsable, '')) > 80 then raise exception 'El responsable puede tener hasta 80 letras.' using errcode = '22023'; end if;
  if p_fin is not null and p_fin <= p_inicio then raise exception 'El fin tiene que ser después del comienzo.' using errcode = '22023'; end if;
  if cardinality(v_extra) > 20 then raise exception 'Hasta 20 fechas más por evento.' using errcode = '22023'; end if;
  foreach f in array v_extra loop
    if f is null or f <= p_inicio then raise exception 'Las otras fechas tienen que ser después de la primera.' using errcode = '22023'; end if;
  end loop;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  -- El producto lleva la fecha en el nombre: en Vender, en el ticket y en el Resultado se sabe qué evento fue.
  insert into public.productos (gimnasio_id, nombre, precio, activo, controla_stock, stock_minimo)
  values (p_gimnasio_id, '🎟️ ' || v_nombre || ' · ' || to_char(p_inicio at time zone zona, 'DD/MM HH24:MI'), round(p_precio, 2), not coalesce(p_borrador, false), true, 0)
  returning id into v_prod;
  insert into public.movimientos_stock (gimnasio_id, producto_id, cantidad, tipo, motivo, creado_por)
  values (p_gimnasio_id, v_prod, p_cupo, 'entrada', 'Cupo del evento', e.id);
  insert into public.eventos (gimnasio_id, producto_id, inicio, descripcion, cupo, para, creado_por, fin, fechas_extra, lugar, responsable, precio_socio, borrador, lista_espera)
  values (p_gimnasio_id, v_prod, p_inicio, nullif(trim(coalesce(p_descripcion, '')), ''), p_cupo, p_para, e.id, p_fin,
          (select coalesce(array_agg(x order by x), '{}') from unnest(v_extra) x),
          nullif(trim(coalesce(p_lugar, '')), ''), nullif(trim(coalesce(p_responsable, '')), ''),
          case when p_precio_socio is null then null else round(p_precio_socio, 2) end, coalesce(p_borrador, false), coalesce(p_lista_espera, true))
  returning id into v_id;
  return v_id;
end $$;

-- Un borrador no se ve ni se vende hasta que se publica.
create or replace function public.publicar_evento(p_evento_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare ev public.eventos; n int;
begin
  select * into ev from public.eventos where id = p_evento_id;
  if not found then raise exception 'Sin permiso o evento inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(ev.gimnasio_id, array['dueno', 'encargado']);
  if ev.cerrado_en is not null then raise exception 'Ese evento ya está cerrado' using errcode = '22023'; end if;
  update public.eventos set borrador = false where id = ev.id and borrador;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese evento ya estaba publicado' using errcode = '22023'; end if;
  update public.productos set activo = true where id = ev.producto_id and gimnasio_id = ev.gimnasio_id;
end $$;

-- Cerrar: si ya pasó la última fecha es "terminado" (queda el resumen de asistentes); si no, "cancelado" (la app avisa).
create or replace function public.cerrar_evento(p_evento_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare ev public.eventos; n int;
begin
  select * into ev from public.eventos where id = p_evento_id;
  if not found then raise exception 'Sin permiso o evento inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(ev.gimnasio_id, array['dueno', 'encargado']);
  update public.eventos set cerrado_en = now(),
         cerrado_motivo = case when privado.evento_ultima(ev) <= now() or exists (select 1 from public.evento_asistencias a where a.evento_id = ev.id) then 'terminado' else 'cancelado' end
   where id = ev.id and cerrado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese evento ya estaba cerrado' using errcode = '22023'; end if;
  update public.productos set activo = false where id = ev.producto_id;
end $$;

-- ── Lecturas ────────────────────────────────────────────────────────
create or replace function public.eventos_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return coalesce((select jsonb_agg(privado.evento_json(ev, true)
      order by (ev.cerrado_en is null and privado.evento_ultima(ev) > now() - interval '1 day') desc, ev.inicio)
    from public.eventos ev where ev.gimnasio_id = p_gimnasio_id and (ev.cerrado_en is null or ev.cerrado_en > now() - interval '30 days')), '[]');
end $$;

create or replace function public.eventos_publicos(p_host text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select d.gimnasio_id into g from public.dominios_gimnasio d where d.host = lower(p_host);
  if g is null then return '[]'; end if;
  if not exists (select 1 from public.landing_gimnasio l where l.gimnasio_id = g and l.publicada) then return '[]'; end if;
  return coalesce((select jsonb_agg(privado.evento_json(ev, false) order by ev.inicio)
    from public.eventos ev where ev.gimnasio_id = g and ev.cerrado_en is null and not ev.borrador and privado.evento_ultima(ev) > now()), '[]');
end $$;

create or replace function public.eventos_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.socios where id = p_socio_id;
  return coalesce((
    select jsonb_agg(x.j order by x.orden) from (
      select privado.evento_json(ev, false) || jsonb_build_object(
               'anotado', exists (select 1 from jsonb_array_elements(privado.evento_gente(ev)->'anotados') a where a->>'socio_id' = s.id::text),
               'en_espera_pos', (select (w->>'posicion')::int from jsonb_array_elements(privado.evento_gente(ev)->'espera') w where w->>'socio_id' = s.id::text limit 1),
               'puede_cancelar', exists (select 1 from public.evento_inscripciones i where i.evento_id = ev.id and i.socio_id = s.id and i.cancelada_en is null)
                 and not exists (select 1 from public.venta_items vi join public.ventas v on v.id = vi.venta_id
                                  where vi.producto_id = ev.producto_id and vi.tipo = 'producto' and v.estado <> 'anulada' and v.socio_id = s.id),
               'mi_precio', coalesce(ev.precio_socio, (select pr.precio from public.productos pr where pr.id = ev.producto_id)),
               'cuando_cerca', (select case when d = (now() at time zone gi.zona_horaria)::date then 'hoy'
                                            when d = (now() at time zone gi.zona_horaria)::date + 1 then 'manana' end
                                  from unnest(privado.evento_fechas(ev)) f, public.gimnasios gi, lateral (select (f at time zone gi.zona_horaria)::date as d) dd
                                 where gi.id = ev.gimnasio_id and (f at time zone gi.zona_horaria)::date between (now() at time zone gi.zona_horaria)::date and (now() at time zone gi.zona_horaria)::date + 1
                                 order by f limit 1),
               'cancelado', false) as j, ev.inicio as orden
        from public.eventos ev
       where ev.gimnasio_id = s.gimnasio_id and ev.cerrado_en is null and not ev.borrador and privado.evento_ultima(ev) > now()
      union all
      -- Se cancelaron hace poco y yo estaba anotado: la app lo avisa una semana.
      select privado.evento_json(ev, false) || jsonb_build_object('anotado', false, 'cancelado', true), ev.inicio
        from public.eventos ev
       where ev.gimnasio_id = s.gimnasio_id and ev.cerrado_motivo = 'cancelado' and ev.cerrado_en > now() - interval '7 days'
         and exists (select 1 from public.evento_inscripciones i where i.evento_id = ev.id and i.socio_id = s.id)
    ) x), '[]');
end $$;

-- ── Anotarse ────────────────────────────────────────────────────────
-- Desde la app. Una reserva por socio y evento; si no hay lugar queda en la lista de espera (si el evento la tiene).
-- Se bloquea la fila del evento: dos celulares a la vez nunca se llevan el mismo último lugar.
create or replace function public.inscribirse_evento(p_socio_id uuid, p_evento_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.socios; ev public.eventos; p public.productos; g jsonb; v_precio numeric; mi jsonb;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.socios where id = p_socio_id;
  if s.dado_de_baja_en is not null then raise exception 'Tu cuenta está dada de baja: hablá con recepción.' using errcode = '22023'; end if;
  select * into ev from public.eventos where id = p_evento_id and gimnasio_id = s.gimnasio_id for update;
  if not found then raise exception 'Ese evento no existe.' using errcode = '22023'; end if;
  if ev.cerrado_en is not null or ev.borrador then raise exception 'Ese evento ya no está abierto.' using errcode = '22023'; end if;
  if privado.evento_ultima(ev) <= now() then raise exception 'Ese evento ya pasó.' using errcode = '22023'; end if;
  select * into p from public.productos where id = ev.producto_id;
  g := privado.evento_gente(ev);
  -- Ya anotado (por la app o pagando en recepción): se devuelve cómo está, sin repetir.
  if not exists (select 1 from jsonb_array_elements(g->'anotados') a where a->>'socio_id' = s.id::text)
     and not exists (select 1 from jsonb_array_elements(g->'espera') a where a->>'socio_id' = s.id::text) then
    if (g->>'quedan')::int = 0 and not ev.lista_espera then raise exception 'Se llenó y este evento no tiene lista de espera.' using errcode = '22023'; end if;
    v_precio := coalesce(ev.precio_socio, p.precio);
    insert into public.evento_inscripciones (gimnasio_id, evento_id, socio_id, nombre, dni, telefono, precio, origen)
    values (s.gimnasio_id, ev.id, s.id, trim(s.nombre || ' ' || s.apellido), s.dni, s.telefono, round(v_precio, 2), 'app');
    g := privado.evento_gente(ev);
  end if;
  select a into mi from jsonb_array_elements(g->'anotados') a where a->>'socio_id' = s.id::text limit 1;
  if mi is not null then
    return jsonb_build_object('estado', 'anotado', 'precio', coalesce(ev.precio_socio, p.precio), 'pago', (mi->>'pago')::boolean, 'quedan', (g->>'quedan')::int);
  end if;
  select a into mi from jsonb_array_elements(g->'espera') a where a->>'socio_id' = s.id::text limit 1;
  return jsonb_build_object('estado', 'espera', 'posicion', (mi->>'posicion')::int, 'precio', coalesce(ev.precio_socio, p.precio), 'pago', false, 'quedan', 0);
end $$;

create or replace function public.cancelar_inscripcion_evento(p_socio_id uuid, p_evento_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.socios; ev public.eventos; n int;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.socios where id = p_socio_id;
  select * into ev from public.eventos where id = p_evento_id and gimnasio_id = s.gimnasio_id for update;
  if not found then raise exception 'Ese evento no existe.' using errcode = '22023'; end if;
  if exists (select 1 from public.venta_items vi join public.ventas v on v.id = vi.venta_id
              where vi.producto_id = ev.producto_id and vi.tipo = 'producto' and v.estado <> 'anulada' and v.socio_id = s.id) then
    raise exception 'Ya pagaste este lugar: pedile la baja a recepción.' using errcode = '22023';
  end if;
  update public.evento_inscripciones set cancelada_en = now()
   where evento_id = ev.id and socio_id = s.id and cancelada_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No estabas anotado en ese evento.' using errcode = '22023'; end if;
end $$;

-- Desde la página, sin sesión: nombre, DNI (para el check-in) y teléfono (para avisarle). Solo eventos para todos.
-- Si el DNI es de un socio del gimnasio, la reserva queda a su nombre y con el precio de socio.
create or replace function public.inscribirse_evento_publico(p_host text, p_evento_id uuid, p_nombre text, p_dni text, p_telefono text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; ev public.eventos; p public.productos; v_nombre text := trim(coalesce(p_nombre, '')); v_dni text := regexp_replace(coalesce(p_dni, ''), '[^0-9]', '', 'g');
        v_tel text := regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g'); s public.socios; gen jsonb; mi jsonb; v_precio numeric;
begin
  select d.gimnasio_id into g from public.dominios_gimnasio d where d.host = lower(coalesce(p_host, ''));
  if g is null or not exists (select 1 from public.landing_gimnasio l where l.gimnasio_id = g and l.publicada) then
    raise exception 'Esta página no está disponible.' using errcode = '22023'; end if;
  if length(v_nombre) < 3 or length(v_nombre) > 80 then raise exception 'Escribí tu nombre y apellido.' using errcode = '22023'; end if;
  if v_dni !~ '^[0-9]{6,9}$' then raise exception 'El DNI son solo números (entre 6 y 9).' using errcode = '22023'; end if;
  if v_tel !~ '^\+[0-9]{8,15}$' then raise exception 'Escribí tu teléfono con el código de país, por ejemplo +54 9 11 2345 6789.' using errcode = '22023'; end if;
  select * into ev from public.eventos where id = p_evento_id and gimnasio_id = g for update;
  if not found or ev.cerrado_en is not null or ev.borrador or privado.evento_ultima(ev) <= now() then
    raise exception 'Ese evento ya no está abierto.' using errcode = '22023'; end if;
  if ev.para = 'socios' then raise exception 'Ese evento es solo para socios: anotate desde la app.' using errcode = '22023'; end if;
  select * into p from public.productos where id = ev.producto_id;
  select * into s from public.socios where gimnasio_id = g and dni = v_dni and dado_de_baja_en is null;
  gen := privado.evento_gente(ev);
  if not exists (select 1 from jsonb_array_elements(gen->'anotados') a where a->>'dni' = v_dni)
     and not exists (select 1 from jsonb_array_elements(gen->'espera') a where a->>'dni' = v_dni) then
    if (gen->>'quedan')::int = 0 and not ev.lista_espera then raise exception 'Se llenó y este evento no tiene lista de espera.' using errcode = '22023'; end if;
    -- Tope contra el que anota a medio barrio: la espera no pasa de la mitad del cupo (mínimo 10).
    if (gen->>'quedan')::int = 0 and jsonb_array_length(gen->'espera') >= greatest(10, ev.cupo / 2) then
      raise exception 'La lista de espera está completa.' using errcode = '22023'; end if;
    v_precio := case when s.id is not null then coalesce(ev.precio_socio, p.precio) else p.precio end;
    insert into public.evento_inscripciones (gimnasio_id, evento_id, socio_id, nombre, dni, telefono, precio, origen)
    values (g, ev.id, s.id, v_nombre, v_dni, v_tel, round(v_precio, 2), 'pagina');
    gen := privado.evento_gente(ev);
  end if;
  select a into mi from jsonb_array_elements(gen->'anotados') a where a->>'dni' = v_dni limit 1;
  if mi is not null then return jsonb_build_object('estado', 'anotado', 'precio', coalesce((mi->>'precio')::numeric, p.precio)); end if;
  select a into mi from jsonb_array_elements(gen->'espera') a where a->>'dni' = v_dni limit 1;
  return jsonb_build_object('estado', 'espera', 'posicion', (mi->>'posicion')::int, 'precio', p.precio);
end $$;

-- ── Check-in el día del evento ──────────────────────────────────────
-- Hoy (en la hora del gimnasio) tiene que ser un día del evento, y la persona tiene que tener lugar (no en espera).
create or replace function public.evento_marcar_presente(p_evento_id uuid, p_socio_id uuid default null, p_inscripcion_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ev public.eventos; e public.equipo; zona text; hoy date; ins public.evento_inscripciones; v_socio uuid := p_socio_id; gen jsonb; n int;
begin
  select * into ev from public.eventos where id = p_evento_id;
  if not found then raise exception 'Sin permiso o evento inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(ev.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if p_socio_id is null and p_inscripcion_id is null then raise exception 'Falta decir quién es.' using errcode = '22023'; end if;
  if ev.cerrado_en is not null or ev.borrador then raise exception 'Ese evento ya no está abierto.' using errcode = '22023'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = ev.gimnasio_id;
  hoy := (now() at time zone zona)::date;
  if not exists (select 1 from unnest(privado.evento_fechas(ev)) f where (f at time zone zona)::date = hoy) then
    raise exception 'Hoy no es un día de este evento.' using errcode = '22023'; end if;
  if p_inscripcion_id is not null then
    select * into ins from public.evento_inscripciones where id = p_inscripcion_id and evento_id = ev.id and cancelada_en is null;
    if not found then raise exception 'Esa reserva no existe o se canceló.' using errcode = '22023'; end if;
    v_socio := coalesce(v_socio, ins.socio_id);
  end if;
  gen := privado.evento_gente(ev);
  if exists (select 1 from jsonb_array_elements(gen->'espera') a where (v_socio is not null and a->>'socio_id' = v_socio::text) or (p_inscripcion_id is not null and a->>'inscripcion_id' = p_inscripcion_id::text)) then
    raise exception 'Está en la lista de espera: todavía no tiene lugar.' using errcode = '22023'; end if;
  if not exists (select 1 from jsonb_array_elements(gen->'anotados') a where (v_socio is not null and a->>'socio_id' = v_socio::text) or (p_inscripcion_id is not null and a->>'inscripcion_id' = p_inscripcion_id::text)) then
    raise exception 'No está anotado en este evento.' using errcode = '22023'; end if;
  insert into public.evento_asistencias (gimnasio_id, evento_id, socio_id, inscripcion_id, dia, creado_por)
  values (ev.gimnasio_id, ev.id, v_socio, case when v_socio is null then p_inscripcion_id end, hoy, e.id)
  on conflict do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('ya_estaba', n = 0, 'asistieron', (select count(distinct coalesce(a.socio_id, a.inscripcion_id)) from public.evento_asistencias a where a.evento_id = ev.id));
end $$;

create or replace function public.evento_quitar_presente(p_evento_id uuid, p_socio_id uuid default null, p_inscripcion_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare ev public.eventos; zona text; n int;
begin
  select * into ev from public.eventos where id = p_evento_id;
  if not found then raise exception 'Sin permiso o evento inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(ev.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = ev.gimnasio_id;
  delete from public.evento_asistencias a where a.evento_id = ev.id and a.dia = (now() at time zone zona)::date
     and ((p_socio_id is not null and a.socio_id = p_socio_id) or (p_inscripcion_id is not null and a.inscripcion_id = p_inscripcion_id));
  get diagnostics n = row_count;
  if n = 0 then raise exception 'No tenía la presencia de hoy anotada.' using errcode = '22023'; end if;
end $$;

-- Para la ventana de Entrada: ¿este socio está anotado en algo que pasa hoy?
create or replace function public.eventos_del_dia_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios; zona text; hoy date;
begin
  select * into s from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(s.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = s.gimnasio_id;
  hoy := (now() at time zone zona)::date;
  return coalesce((
    select jsonb_agg(jsonb_build_object('evento_id', ev.id,
        'nombre', regexp_replace(pr.nombre, '^🎟️ (.*) · \d\d/\d\d \d\d:\d\d$', '\1'),
        'espera', (x.gente->'anotados') is not null and not exists (select 1 from jsonb_array_elements(x.gente->'anotados') a where a->>'socio_id' = s.id::text),
        'presente', exists (select 1 from public.evento_asistencias a where a.evento_id = ev.id and a.socio_id = s.id and a.dia = hoy),
        'inscripcion_id', (select i.id from public.evento_inscripciones i where i.evento_id = ev.id and i.socio_id = s.id and i.cancelada_en is null limit 1)))
      from public.eventos ev
      join public.productos pr on pr.id = ev.producto_id
      cross join lateral (select privado.evento_gente(ev) as gente) x
     where ev.gimnasio_id = s.gimnasio_id and ev.cerrado_en is null and not ev.borrador
       and exists (select 1 from unnest(privado.evento_fechas(ev)) f where (f at time zone zona)::date = hoy)
       and (exists (select 1 from jsonb_array_elements(x.gente->'anotados') a where a->>'socio_id' = s.id::text)
         or exists (select 1 from jsonb_array_elements(x.gente->'espera') a where a->>'socio_id' = s.id::text))), '[]');
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.crear_evento(uuid, text, timestamptz, int, numeric, text, text, timestamptz, timestamptz[], text, text, numeric, boolean, boolean),
  public.publicar_evento(uuid), public.cerrar_evento(uuid), public.eventos_panel(uuid), public.eventos_publicos(text), public.eventos_socio(uuid),
  public.inscribirse_evento(uuid, uuid), public.cancelar_inscripcion_evento(uuid, uuid), public.inscribirse_evento_publico(text, uuid, text, text, text),
  public.evento_marcar_presente(uuid, uuid, uuid), public.evento_quitar_presente(uuid, uuid, uuid), public.eventos_del_dia_socio(uuid)
  from public, anon, authenticated;
grant execute on function public.crear_evento(uuid, text, timestamptz, int, numeric, text, text, timestamptz, timestamptz[], text, text, numeric, boolean, boolean),
  public.publicar_evento(uuid), public.cerrar_evento(uuid), public.eventos_panel(uuid), public.eventos_socio(uuid),
  public.inscribirse_evento(uuid, uuid), public.cancelar_inscripcion_evento(uuid, uuid),
  public.evento_marcar_presente(uuid, uuid, uuid), public.evento_quitar_presente(uuid, uuid, uuid), public.eventos_del_dia_socio(uuid)
  to authenticated, service_role;
grant execute on function public.eventos_publicos(text), public.inscribirse_evento_publico(text, uuid, text, text, text) to anon, authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['public.evento_inscripciones', 'public.evento_asistencias'] loop
    if not (select relrowsecurity from pg_class where oid = t::regclass) then raise exception 'Verificación: % sin RLS', t; end if;
  end loop;
  if has_function_privilege('anon', 'public.inscribirse_evento(uuid, uuid)', 'execute') then raise exception 'Verificación: inscribirse_evento quedó para anon'; end if;
  if has_function_privilege('anon', 'public.evento_marcar_presente(uuid, uuid, uuid)', 'execute') then raise exception 'Verificación: evento_marcar_presente quedó para anon'; end if;
  if not has_function_privilege('anon', 'public.inscribirse_evento_publico(text, uuid, text, text, text)', 'execute') then raise exception 'Verificación: la página no puede anotar'; end if;
  if to_regprocedure('public.crear_evento(uuid, text, timestamptz, int, numeric, text, text)') is not null then raise exception 'Verificación: quedó la crear_evento vieja'; end if;
  if exists (select 1 from public.eventos where cerrado_en is not null and cerrado_motivo is null) then raise exception 'Verificación: eventos cerrados sin motivo'; end if;
end $$;
