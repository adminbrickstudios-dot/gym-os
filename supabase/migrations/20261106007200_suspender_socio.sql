-- VD-46B · Suspender o expulsar a un socio, con motivo y fecha de revisión (docs/v2/14-SITUACIONES.md, caso 37).
-- La tabla suspensiones y su lectura (privado.bloqueo_persona, vía 0 de calcular_acceso) ya existían; faltaba
-- quien la escribiera. Ahora:
--   suspender_socio(socio, motivo, tipo, hasta, revisar_el)   dueño y encargado (suspensión y expulsión);
--                                                            la recepción solo suspende (nunca expulsa)
--   levantar_suspension(suspension, motivo)                   SOLO dueño o encargado, con motivo
--   revisar_suspension(suspension, revisar_el)                dueño o encargado: "la revisé, sigue" y fija otra fecha
--   suspension_socio(socio)                                   para la ficha: la vigente, el historial y qué puede hacer cada rol
-- La suspensión bloquea a la PERSONA por todas las vías (puerta, QR, kiosco, clases) porque calcular_acceso la lee primero;
-- además no entra como invitado de otro: privado.validar_invitado rechaza un DNI suspendido.
-- Control: moderacion_control (suspensiones, levantamientos) y un aviso en la campana cuando se vence la fecha de revisión
-- (privado.avisos_moderacion es el gancho que suman las demás piezas de moderación: cortesías, bajas, devoluciones).
-- Nada se calcula aparte: una suspensión es un hecho (quién, cuándo, por qué, hasta cuándo se revisa).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.suspensiones') is null then raise exception 'Guarda: falta suspensiones'; end if;
  if to_regprocedure('privado.bloqueo_persona(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.bloqueo_persona'; end if;
  if to_regprocedure('privado.exigir_rol(uuid, text[], uuid)') is null then raise exception 'Guarda: falta privado.exigir_rol'; end if;
  if to_regprocedure('privado.exigir_resultado(uuid)') is null then raise exception 'Guarda: falta privado.exigir_resultado'; end if;
  if to_regprocedure('privado.con_leidos(uuid, jsonb)') is null then raise exception 'Guarda: falta privado.con_leidos'; end if;
  if to_regprocedure('privado.validar_invitado(uuid, uuid, text, text, date)') is null then raise exception 'Guarda: falta privado.validar_invitado'; end if;
  if to_regprocedure('public.campana_control(uuid)') is null then raise exception 'Guarda: falta campana_control (VD-10)'; end if;
end $$;

-- ── La suspensión pasa a tener tipo, fecha de revisión y motivo del levantamiento ──
alter table public.suspensiones add column if not exists tipo text not null default 'suspension' check (tipo in ('suspension', 'expulsion'));
alter table public.suspensiones add column if not exists revisar_en timestamptz;
alter table public.suspensiones add column if not exists levantada_motivo text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'suspensiones_expulsion_sin_fin' and conrelid = 'public.suspensiones'::regclass) then
    alter table public.suspensiones add constraint suspensiones_expulsion_sin_fin check (tipo <> 'expulsion' or hasta is null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suspensiones_levantada_completa' and conrelid = 'public.suspensiones'::regclass) then
    alter table public.suspensiones add constraint suspensiones_levantada_completa
      check ((levantada_en is null) = (levantada_por is null) and (levantada_en is null or length(trim(coalesce(levantada_motivo, ''))) > 0)) not valid;
  end if;
end $$;
create index if not exists suspensiones_vigentes on public.suspensiones (gimnasio_id, socio_id) where levantada_en is null;
create index if not exists suspensiones_control on public.suspensiones (gimnasio_id, creado_en desc);
create index if not exists suspensiones_levantadas_control on public.suspensiones (gimnasio_id, levantada_en desc) where levantada_en is not null;

-- Lo único que se puede cambiar de una suspensión: levantarla (con quién y por qué) y mover la fecha de revisión.
drop trigger if exists suspensiones_inmutable on public.suspensiones;
create trigger suspensiones_inmutable before update or delete on public.suspensiones
  for each row execute function privado.hecho_inmutable('levantada_en', 'levantada_por', 'levantada_motivo', 'revisar_en');

-- ── Vía 0: el texto dice si es suspensión o expulsión (copia de 0006; el motivo sigue siendo 'suspendido') ──
create or replace function privado.bloqueo_persona(p_socio_id uuid, p_momento timestamptz)
returns public.veredicto_acceso
language plpgsql stable set search_path = '' as $$
declare v public.veredicto_acceso; s record;
begin
  select * into s from public.suspensiones x
   where x.socio_id = p_socio_id and x.desde <= p_momento
     and (x.hasta is null or x.hasta > p_momento)
     and (x.levantada_en is null or x.levantada_en > p_momento)
   order by x.desde desc limit 1;
  if not found then return null; end if;
  v.puede := false; v.color := 'rojo'; v.via := 'ninguna'; v.motivo := 'suspendido';
  v.texto := case when s.tipo = 'expulsion' then 'Expulsado · ' else 'Suspendido · ' end || s.motivo; v.consume := 'nada';
  return v;
end $$;

-- ── Un suspendido tampoco entra de invitado (copia de 0053 + el DNI suspendido) ──
create or replace function privado.validar_invitado(p_gimnasio_id uuid, p_socio_id uuid, p_nombre text, p_dni text, p_hoy date) returns void
language plpgsql stable set search_path = '' as $$
declare lim int; zona text; ini timestamptz; fin timestamptz; n int; v public.veredicto_acceso;
begin
  select c.invitados_por_mes, g.zona_horaria into lim, zona from public.configuracion_gimnasio c join public.gimnasios g on g.id = c.gimnasio_id where c.gimnasio_id = p_gimnasio_id;
  if lim = 0 then raise exception 'Este gimnasio no recibe invitados.' using errcode = '22023'; end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 then raise exception 'Poné el nombre y apellido del invitado.' using errcode = '22023'; end if;
  if coalesce(p_dni, '') !~ '^[0-9]{6,9}$' then raise exception 'Poné el DNI del invitado, sin puntos (nunca se anota anónimo).' using errcode = '22023'; end if;
  if exists (select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dni = p_dni and s.dado_de_baja_en is null) then
    raise exception 'Ese DNI es de un socio: buscalo en Entrada.' using errcode = '22023';
  end if;
  -- VD-46B: la suspensión es de la persona, también si viene de invitada (aunque la ficha esté dada de baja).
  if exists (select 1 from public.suspensiones x join public.socios so on so.id = x.socio_id
              where x.gimnasio_id = p_gimnasio_id and so.dni = p_dni and x.desde <= now()
                and (x.hasta is null or x.hasta > now()) and x.levantada_en is null) then
    raise exception 'Esa persona no puede entrar: está suspendida o expulsada.' using errcode = '22023';
  end if;
  v := privado.calcular_acceso(p_socio_id, now(), null);
  if not v.puede then raise exception 'Invita un socio que puede entrar hoy (%).', v.texto using errcode = '22023'; end if;
  ini := privado.medianoche(date_trunc('month', p_hoy)::date, zona);
  fin := privado.medianoche((date_trunc('month', p_hoy) + interval '1 month')::date, zona);
  select count(*) into n from public.invitados i where i.socio_id = p_socio_id and i.anulado_en is null and i.para_el_dia >= ini and i.para_el_dia < fin;
  if n >= lim then raise exception 'Ya invitó a % este mes (el límite es %).', n, lim using errcode = '22023'; end if;
  select count(*) into n from public.invitados i where i.gimnasio_id = p_gimnasio_id and i.dni = p_dni and i.anulado_en is null and i.para_el_dia >= ini and i.para_el_dia < fin;
  if n >= lim then raise exception 'Esa persona ya vino invitada % veces este mes (el límite es %): que se haga socia.', n, lim using errcode = '22023'; end if;
end $$;
revoke all on function privado.validar_invitado(uuid, uuid, text, text, date) from public, anon, authenticated;

-- ── Suspender / expulsar ────────────────────────────────────────────
-- Plata y permisos, lo más prudente: la recepción suspende (por ejemplo hasta que se calmen las cosas, con motivo y una
-- fecha de revisión que ve el dueño), pero expulsar y levantar es del dueño o el encargado.
create or replace function public.suspender_socio(
  p_socio_id uuid, p_motivo text, p_tipo text default 'suspension', p_hasta date default null, p_revisar_el date default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare so public.socios; zona text; hoy date; v_motivo text := trim(coalesce(p_motivo, '')); v_hasta timestamptz; v_revisar timestamptz; sid uuid;
begin
  select * into so from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_tipo is null or p_tipo not in ('suspension', 'expulsion') then raise exception 'El tipo es suspensión o expulsión.' using errcode = '22023'; end if;
  perform privado.exigir_rol(so.gimnasio_id, case when p_tipo = 'expulsion' then array['dueno', 'encargado'] else array['dueno', 'encargado', 'recepcion'] end);
  if length(v_motivo) < 3 then raise exception 'Escribí el motivo: queda anotado con tu nombre.' using errcode = '22023'; end if;
  if length(v_motivo) > 300 then raise exception 'El motivo: hasta 300 letras.' using errcode = '22023'; end if;
  if so.dado_de_baja_en is not null then raise exception 'Ya está dado de baja: no hay nada que suspender.' using errcode = '22023'; end if;
  if p_tipo = 'expulsion' and p_hasta is not null then raise exception 'Una expulsión no tiene fecha de fin: se levanta cuando el dueño lo decide.' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = so.gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  if p_hasta is not null then
    if p_hasta <= hoy then raise exception 'La suspensión termina mañana o más adelante.' using errcode = '22023'; end if;
    if p_hasta > hoy + 365 then raise exception 'Una suspensión de más de un año es una expulsión.' using errcode = '22023'; end if;
    v_hasta := privado.medianoche(p_hasta, zona);
  end if;
  -- La fecha de revisión: la que se elija, o cuando termina, o en 30 días. Nunca pasada ni a más de un año.
  if p_revisar_el is not null and (p_revisar_el <= hoy or p_revisar_el > hoy + 365) then
    raise exception 'La fecha de revisión es mañana o más adelante, hasta dentro de un año.' using errcode = '22023';
  end if;
  v_revisar := privado.medianoche(coalesce(p_revisar_el, p_hasta, hoy + 30), zona);
  if exists (select 1 from public.suspensiones x where x.socio_id = so.id and x.levantada_en is null and (x.hasta is null or x.hasta > now())) then
    raise exception 'Ya está suspendido: levantá la suspensión vigente antes de cargar otra.' using errcode = '22023';
  end if;
  insert into public.suspensiones (gimnasio_id, socio_id, desde, hasta, motivo, tipo, revisar_en, creado_por)
  values (so.gimnasio_id, so.id, now(), v_hasta, v_motivo, p_tipo, v_revisar, auth.uid()) returning id into sid;
  return sid;
end $$;

create or replace function public.levantar_suspension(p_suspension_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.suspensiones; v_motivo text := trim(coalesce(p_motivo, '')); n int;
begin
  select * into s from public.suspensiones where id = p_suspension_id for update;
  if not found then raise exception 'Sin permiso o suspensión inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(s.gimnasio_id, array['dueno', 'encargado']);
  if length(v_motivo) < 3 then raise exception 'Escribí por qué se levanta: queda anotado con tu nombre.' using errcode = '22023'; end if;
  if s.levantada_en is not null then raise exception 'Esa suspensión ya estaba levantada.' using errcode = '22023'; end if;
  update public.suspensiones set levantada_en = now(), levantada_por = auth.uid(), levantada_motivo = left(v_motivo, 300)
   where id = s.id and levantada_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo levantar la suspensión'; end if;
end $$;

create or replace function public.revisar_suspension(p_suspension_id uuid, p_revisar_el date) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.suspensiones; zona text; hoy date; n int;
begin
  select * into s from public.suspensiones where id = p_suspension_id for update;
  if not found then raise exception 'Sin permiso o suspensión inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(s.gimnasio_id, array['dueno', 'encargado']);
  if s.levantada_en is not null then raise exception 'Esa suspensión ya estaba levantada.' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = s.gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  if p_revisar_el is null or p_revisar_el <= hoy or p_revisar_el > hoy + 365 then
    raise exception 'La próxima revisión es mañana o más adelante, hasta dentro de un año.' using errcode = '22023';
  end if;
  update public.suspensiones set revisar_en = privado.medianoche(p_revisar_el, zona) where id = s.id and levantada_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo mover la fecha de revisión'; end if;
end $$;

-- Para la ficha: la suspensión vigente (si hay), las anteriores y qué puede hacer quien mira.
create or replace function public.suspension_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; e public.equipo; vigente jsonb; hist jsonb;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']);
  select jsonb_build_object('id', x.id, 'tipo', x.tipo, 'motivo', x.motivo, 'desde', x.desde, 'hasta', x.hasta, 'revisar_en', x.revisar_en,
           'por', q.nombre, 'revision_vencida', x.revisar_en is not null and x.revisar_en <= now())
    into vigente
    from public.suspensiones x left join public.equipo q on q.gimnasio_id = x.gimnasio_id and q.usuario_id = x.creado_por
   where x.socio_id = p_socio_id and x.levantada_en is null and x.desde <= now() and (x.hasta is null or x.hasta > now())
   order by x.desde desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'tipo', h.tipo, 'motivo', h.motivo, 'desde', h.desde, 'hasta', h.hasta,
           'levantada_en', h.levantada_en, 'levantada_motivo', h.levantada_motivo, 'por', h.por) order by h.desde desc), '[]'::jsonb)
    into hist
    from (select x.*, q.nombre as por from public.suspensiones x left join public.equipo q on q.gimnasio_id = x.gimnasio_id and q.usuario_id = x.creado_por
           where x.socio_id = p_socio_id and x.id is distinct from (vigente ->> 'id')::uuid order by x.desde desc limit 5) h;
  return jsonb_build_object('vigente', vigente, 'historial', hist,
    'puede_suspender', true, 'puede_expulsar', e.rol in ('dueno', 'encargado'), 'puede_levantar', e.rol in ('dueno', 'encargado'));
end $$;

-- ── Control: lo que se suspendió y se levantó, y el gancho de avisos de moderación ──
-- moderacion_control junta, en una sola lista, las piezas de moderación (suspensiones, cortesías, bajas, devoluciones).
-- Cada pieza nueva la reemplaza copiando la anterior y sumando la suya.
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
      ) b order by b.en desc, b.clave desc limit lim
    ) u left join public.socios s on s.id = u.socio_id;
  return jsonb_build_object('items', filas);
end $$;

create or replace function privado.avisos_moderacion(p_gimnasio_id uuid, p_zona text) returns jsonb
language plpgsql stable set search_path = '' as $$
declare items jsonb := '[]'::jsonb;
begin
  -- Suspensiones y expulsiones cuya fecha de revisión ya llegó: alguien tiene que decidir si siguen.
  items := items || coalesce((select jsonb_agg(jsonb_build_object(
             'clave', 'revisar_suspension:' || x.id::text || ':' || to_char(x.revisar_en at time zone p_zona, 'YYYYMMDD'), 'emoji', '🚫',
             'titulo', 'Revisar ' || case when x.tipo = 'expulsion' then 'la expulsión' else 'la suspensión' end || ' de ' || trim(s.nombre || ' ' || s.apellido),
             'detalle', x.motivo, 'href', '/socios/' || s.id, 'en', x.revisar_en))
           from public.suspensiones x join public.socios s on s.id = x.socio_id
          where x.gimnasio_id = p_gimnasio_id and x.levantada_en is null and (x.hasta is null or x.hasta > now())
            and x.revisar_en is not null and x.revisar_en <= now()), '[]'::jsonb);
  return items;
end $$;

-- ── campana_control: copia de VD-10 + los avisos de moderación ──
create or replace function public.campana_control(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; items jsonb := '[]'::jsonb; zona text;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  perform privado.exigir_resultado(p_gimnasio_id);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;

  -- Un cobro cargado con una fecha que no es la de hoy (de otros, últimos 7 días).
  items := items || coalesce((select jsonb_agg(jsonb_build_object(
             'clave', 'otro_dia:' || v.id::text, 'emoji', '📅',
             'titulo', 'Cobro cargado con fecha del ' || to_char(v.confirmada_en at time zone zona, 'DD/MM') || ': ' || privado.formato_pesos(t.total),
             'detalle', concat_ws(' · ', q.nombre, v.otro_dia_motivo),
             'href', '/control?tipos=otro_dia', 'en', v.registrada_en))
           from public.ventas v
           left join public.equipo q on q.id = v.creado_por
           cross join lateral (select coalesce(sum(i.cantidad * i.precio_unitario - i.descuento), 0) as total
                                 from public.venta_items i where i.venta_id = v.id) t
          where v.gimnasio_id = p_gimnasio_id and v.otro_dia_motivo is not null
            and v.registrada_en > now() - interval '7 days' and v.creado_por is distinct from e.id), '[]'::jsonb);

  -- Anti-préstamo: alguien que ya había entrado volvió por otra vía en pocos minutos.
  items := items || coalesce((select jsonb_agg(jsonb_build_object(
             'clave', 'prestamo:' || a.id::text, 'emoji', '🪪',
             'titulo', 'Posible préstamo de entrada: ' || trim(s.nombre || ' ' || s.apellido),
             'detalle', 'Volvió a entrar a los ' || a.minutos || ' min por otra vía',
             'href', '/control?tipos=prestamo', 'en', a.momento))
           from public.alertas_prestamo a join public.socios s on s.id = a.socio_id
          where a.gimnasio_id = p_gimnasio_id and a.momento > now() - interval '7 days'), '[]'::jsonb);

  -- VD-46: suspensiones por revisar, cortesías repetidas, bajas sin responder, devoluciones.
  items := items || privado.avisos_moderacion(p_gimnasio_id, zona);

  return privado.con_leidos(p_gimnasio_id, items);
end $$;

revoke all on function privado.avisos_moderacion(uuid, text) from public, anon, authenticated;
revoke all on function public.suspender_socio(uuid, text, text, date, date), public.levantar_suspension(uuid, text), public.revisar_suspension(uuid, date),
  public.suspension_socio(uuid), public.moderacion_control(uuid, date, date, int), public.campana_control(uuid) from public, anon, authenticated;
grant execute on function public.suspender_socio(uuid, text, text, date, date), public.levantar_suspension(uuid, text), public.revisar_suspension(uuid, date),
  public.suspension_socio(uuid), public.moderacion_control(uuid, date, date, int), public.campana_control(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.suspender_socio(uuid, text, text, date, date)', 'public.levantar_suspension(uuid, text)', 'public.revisar_suspension(uuid, date)',
                           'public.suspension_socio(uuid)', 'public.moderacion_control(uuid, date, date, int)', 'public.campana_control(uuid)',
                           'privado.avisos_moderacion(uuid, text)', 'privado.bloqueo_persona(uuid, timestamptz)', 'privado.validar_invitado(uuid, uuid, text, text, date)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if not (select relrowsecurity from pg_class where oid = 'public.suspensiones'::regclass) then raise exception 'Verificación: suspensiones sin RLS'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'suspensiones' and column_name = 'revisar_en') then
    raise exception 'Verificación: falta suspensiones.revisar_en';
  end if;
end $$;
