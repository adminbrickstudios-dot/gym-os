-- ═══════════════════════════════════════════════════════════════════
-- 0005 · ¿Este socio puede entrar hoy?
-- Dispositivos, ingresos, el veredicto y las funciones que lo calculan.
--
-- Regla 1: el estado se CALCULA, nunca se guarda.
-- Regla 2: la respuesta siempre dice POR QUÉ.
--
-- Una función chica por vía, todas devuelven el mismo tipo:
--   privado.bloqueo_persona · privado.via_membresia
--   privado.via_pase        · privado.via_pack
-- privado.calcular_acceso las combina en orden fijo:
--   1. bloqueo de la persona → rojo y termina
--   2. la primera vía que deja entrar: membresía (no consume),
--      pase de hoy, pack (plata del socio: se toca último)
--   3. si ninguna deja: el motivo más útil (membresía > pack > pase > gris)
--   4. lo que dijeron las otras vías va a "avisos"
--   5. modo avisar sin bloquear: deja pasar y conserva color y motivo
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.coberturas') is null then raise exception 'Guarda: falta la migración 0004'; end if;
end $$;

-- ── Dispositivos (tablet kiosco, lector) ───────────────────────────
-- Usan un token revocable, no la sesión de una persona.
create table if not exists public.dispositivos (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  sede_id      uuid not null,
  nombre       text not null,
  tipo         text not null check (tipo in ('kiosco', 'lector', 'qr_pared')),
  ultimo_uso   timestamptz,
  revocado_en  timestamptz,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id)
);
select privado.politicas_estandar('public.dispositivos', array['dueno','encargado'], '{}');

-- El hash del token vive aparte, en una tabla cerrada: RLS activa y
-- ninguna política. Solo el servidor (service role) la lee.
create table if not exists public.dispositivos_tokens (
  gimnasio_id     uuid not null references public.gimnasios(id),
  dispositivo_id  uuid not null,
  token_hash      text not null unique,
  creado_en       timestamptz not null default now(),
  primary key (gimnasio_id, dispositivo_id),
  foreign key (gimnasio_id, dispositivo_id) references public.dispositivos (gimnasio_id, id)
);
alter table public.dispositivos_tokens enable row level security;

-- ── Ingresos ───────────────────────────────────────────────────────
-- Cada intento queda registrado, también los rechazados: "le dijimos que
-- no a 12 personas esta semana" es un dato del negocio. La foto de la
-- decisión (color, motivo, texto) es un hecho histórico, no un estado.
create table if not exists public.ingresos (
  id               uuid primary key default gen_random_uuid(),
  gimnasio_id      uuid not null references public.gimnasios(id),
  sede_id          uuid not null,
  socio_id         uuid not null,
  momento          timestamptz not null default now(),
  via_acceso       text not null check (via_acceso in ('recepcion', 'qr_socio', 'qr_pared', 'kiosco', 'nfc', 'molinete')),
  resultado        text not null check (resultado in ('entro', 'entro_modo_aviso', 'forzado', 'rechazado')),
  via_habilitante  text check (via_habilitante in ('membresia', 'pase', 'pack')),
  color            text not null check (color in ('verde', 'amarillo', 'naranja', 'rojo', 'gris')),
  motivo           text not null,
  texto            text not null,
  forzado_motivo   text,
  registrado_por   uuid,
  dispositivo_id   uuid,
  anulado_en       timestamptz,
  anulado_por      uuid,
  anulado_motivo   text,
  creado_en        timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, registrado_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, anulado_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, dispositivo_id) references public.dispositivos (gimnasio_id, id),
  check (resultado <> 'forzado' or length(trim(coalesce(forzado_motivo, ''))) > 0),
  check ((anulado_en is null) = (anulado_motivo is null))
);
create index if not exists ingresos_socio on public.ingresos (gimnasio_id, socio_id, momento desc);
create index if not exists ingresos_sede_momento on public.ingresos (gimnasio_id, sede_id, momento);
select privado.politicas_estandar('public.ingresos', array['dueno','encargado','recepcion'], '{}', true);
drop trigger if exists ingresos_inmutable on public.ingresos;
create trigger ingresos_inmutable before update or delete on public.ingresos
  for each row execute function privado.hecho_inmutable('anulado_en', 'anulado_por', 'anulado_motivo');

-- Claves que en 0004 quedaron pendientes porque ingresos no existía.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pases_diarios_ingreso_fk') then
    alter table public.pases_diarios add constraint pases_diarios_ingreso_fk
      foreign key (gimnasio_id, usado_en_ingreso_id) references public.ingresos (gimnasio_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'consumos_pack_ingreso_fk') then
    alter table public.consumos_pack add constraint consumos_pack_ingreso_fk
      foreign key (gimnasio_id, ingreso_id) references public.ingresos (gimnasio_id, id);
  end if;
end $$;

-- ── El veredicto ───────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'public' and t.typname = 'veredicto_acceso') then
    create type public.veredicto_acceso as (
      puede             boolean,
      color             text,        -- verde | amarillo | naranja | rojo | gris
      via               text,        -- membresia | pase | pack | ninguna
      motivo            text,        -- código estable
      texto             text,        -- lo que lee la recepción
      vence_en          timestamptz,
      tolerancia_usada  int,
      tolerancia_total  int,
      para_regularizar  numeric(12,2),
      pack_restantes    int,
      consume           text,        -- nada | pase | pack
      consume_id        uuid,
      avisos            text[],
      modo_aviso        boolean
    );
  end if;
end $$;

-- Fin de la cadena de coberturas contiguas que contiene p_momento.
-- null si p_momento no está cubierto.
create or replace function privado.fin_cadena(p_suscripcion_id uuid, p_momento timestamptz) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare fin timestamptz; siguiente timestamptz;
begin
  select max(c.hasta) into fin from public.coberturas c
   where c.suscripcion_id = p_suscripcion_id and c.anulada_en is null
     and c.desde <= p_momento and c.hasta > p_momento;
  if fin is null then return null; end if;
  loop
    select max(c.hasta) into siguiente from public.coberturas c
     where c.suscripcion_id = p_suscripcion_id and c.anulada_en is null
       and c.desde <= fin and c.hasta > fin;
    exit when siguiente is null;
    fin := siguiente;
  end loop;
  return fin;
end $$;

-- ── Vía 0: bloqueo de la persona ───────────────────────────────────
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
  v.texto := 'Suspendido · ' || s.motivo; v.consume := 'nada';
  return v;
end $$;

-- ── Vía 1: membresía ───────────────────────────────────────────────
create or replace function privado.via_membresia(
  p_socio_id uuid, p_momento timestamptz, p_sede_id uuid, p_zona text, p_cfg public.configuracion_gimnasio
) returns public.veredicto_acceso
language plpgsql stable set search_path = '' as $$
declare
  v public.veredicto_acceso;
  s public.suscripciones; pl public.planes; cg public.congelamientos;
  hoy date := privado.dia_local(p_momento, p_zona);
  fin timestamptz; ultimo timestamptz; t timestamptz;
  hora time; vino int; dias int; tol int; usados int; periodos int; precio numeric;
begin
  select * into s from public.suscripciones x
   where x.socio_id = p_socio_id and x.inicio <= p_momento and (x.baja_en is null or x.baja_en > p_momento)
   order by x.inicio desc limit 1;
  if not found then return null; end if;
  select * into pl from public.planes where id = s.plan_id;
  v.via := 'membresia'; v.consume := 'nada';

  select * into cg from public.congelamientos c
   where c.suscripcion_id = s.id and c.anulado_en is null
     and c.desde <= p_momento and coalesce(c.hasta_real, c.hasta_prevista) > p_momento
   order by c.desde desc limit 1;
  if found then
    v.puede := false; v.color := 'rojo'; v.motivo := 'congelada';
    v.texto := 'Congelada · vuelve el ' || privado.fecha_corta(coalesce(cg.hasta_real, cg.hasta_prevista), p_zona);
    return v;
  end if;

  if p_sede_id is not null and not pl.todas_las_sedes
     and not exists (select 1 from public.plan_sedes ps where ps.plan_id = pl.id and ps.sede_id = p_sede_id) then
    v.puede := false; v.color := 'rojo'; v.motivo := 'fuera_de_sede';
    v.texto := pl.nombre || ' no incluye esta sede';
    return v;
  end if;

  fin := privado.fin_cadena(s.id, p_momento);

  if fin is not null then
    v.vence_en := fin;

    if pl.hora_desde is not null then
      hora := (p_momento at time zone p_zona)::time;
      if hora < pl.hora_desde or hora >= pl.hora_hasta then
        v.puede := false; v.color := 'rojo'; v.motivo := 'fuera_de_franja';
        v.texto := pl.nombre || ' es de ' || to_char(pl.hora_desde, 'HH24:MI') || ' a ' || to_char(pl.hora_hasta, 'HH24:MI');
        return v;
      end if;
    end if;

    if pl.max_ingresos_semana is not null then
      -- días distintos de esta semana (lunes a domingo, hora local), sin contar hoy
      select count(distinct privado.dia_local(i.momento, p_zona)) into vino
        from public.ingresos i
       where i.socio_id = p_socio_id and i.anulado_en is null and i.via_habilitante = 'membresia'
         and i.resultado in ('entro', 'entro_modo_aviso', 'forzado')
         and i.momento >= privado.medianoche(date_trunc('week', hoy::timestamp)::date, p_zona)
         and i.momento < privado.medianoche(hoy, p_zona);
      if vino >= pl.max_ingresos_semana then
        v.puede := false; v.color := 'rojo'; v.motivo := 'tope_semanal';
        v.texto := 'Ya vino ' || vino || ' veces esta semana · ' || pl.nombre || ' es de ' || pl.max_ingresos_semana;
        return v;
      end if;
    end if;

    dias := privado.dia_local(fin - interval '1 microsecond', p_zona) - hoy;  -- 0 = hoy es el último día
    v.puede := true;
    if dias <= p_cfg.dias_aviso then
      v.color := 'amarillo'; v.motivo := 'por_vencer';
      v.texto := case dias when 0 then 'Vence hoy' when 1 then 'Vence mañana'
                 else 'Vence en ' || dias || ' días (' || privado.ultimo_dia(fin, p_zona) || ')' end
                 || ' · avisale';
    else
      v.color := 'verde'; v.motivo := 'al_dia';
      v.texto := 'Al día · ' || pl.nombre || ' · vence el ' || privado.ultimo_dia(fin, p_zona);
    end if;
    return v;
  end if;

  -- No está cubierto hoy.
  select max(c.hasta) into ultimo from public.coberturas c
   where c.suscripcion_id = s.id and c.anulada_en is null and c.hasta <= p_momento;
  precio := privado.precio_base(pl.id, p_momento);

  if ultimo is null then
    v.puede := false; v.color := 'rojo'; v.motivo := 'sin_pago';
    v.para_regularizar := precio;
    v.texto := 'Todavía no pagó ' || pl.nombre
               || coalesce(' · son ' || privado.formato_pesos(precio), '');
    return v;
  end if;

  tol := coalesce(pl.tolerancia_dias, p_cfg.tolerancia_dias);
  usados := hoy - privado.dia_local(ultimo, p_zona) + 1;
  v.vence_en := ultimo;
  if usados <= tol then
    v.puede := true; v.color := 'naranja'; v.motivo := 'en_tolerancia';
    v.tolerancia_usada := usados; v.tolerancia_total := tol;
    v.texto := 'Venció el ' || privado.ultimo_dia(ultimo, p_zona)
               || ' · dentro de tolerancia (' || usados || ' de ' || tol || ' días)';
    return v;
  end if;

  -- Vencida: cuánto tiene que pagar hoy para quedar al día.
  if pl.renovacion = 'desde_pago'
     or (pl.reinicio_tras_dias is not null and hoy - privado.dia_local(ultimo, p_zona) >= pl.reinicio_tras_dias) then
    periodos := 1;
  else
    periodos := 0; t := ultimo;
    while t <= p_momento loop
      periodos := periodos + 1;
      t := privado.medianoche((privado.dia_local(t, p_zona) + make_interval(months => pl.duracion_meses))::date, p_zona);
    end loop;
  end if;
  v.puede := false; v.color := 'rojo'; v.motivo := 'vencida';
  v.para_regularizar := precio * periodos;
  v.texto := 'Venció el ' || privado.ultimo_dia(ultimo, p_zona)
             || coalesce(' · debe ' || privado.formato_pesos(precio * periodos), ' · el plan no tiene precio cargado');
  return v;
end $$;

-- ── Vía 2: pase diario ─────────────────────────────────────────────
create or replace function privado.via_pase(
  p_socio_id uuid, p_momento timestamptz, p_sede_id uuid, p_cfg public.configuracion_gimnasio
) returns public.veredicto_acceso
language plpgsql stable set search_path = '' as $$
declare v public.veredicto_acceso; pa public.pases_diarios;
begin
  select * into pa from public.pases_diarios x
   where x.socio_id = p_socio_id and x.anulado_en is null
     and x.desde <= p_momento and x.hasta > p_momento
     and (x.sede_id is null or p_sede_id is null or x.sede_id = p_sede_id)
   order by (x.usado_en_ingreso_id is not null), x.desde limit 1;
  if not found then return null; end if;
  v.via := 'pase';
  if pa.usado_en_ingreso_id is null then
    v.puede := true; v.color := 'verde'; v.motivo := 'pase_de_hoy'; v.texto := 'Pase diario de hoy';
    v.consume := 'pase'; v.consume_id := pa.id;
  elsif not p_cfg.reingreso_mismo_dia_consume then
    v.puede := true; v.color := 'verde'; v.motivo := 'pase_reingreso'; v.texto := 'Pase diario de hoy · reingreso';
    v.consume := 'nada';
  else
    v.puede := false; v.color := 'rojo'; v.motivo := 'pase_usado'; v.texto := 'Ya usó el pase de hoy';
    v.consume := 'nada';
  end if;
  return v;
end $$;

-- ── Vía 3: pack ────────────────────────────────────────────────────
create or replace function privado.via_pack(
  p_socio_id uuid, p_momento timestamptz, p_zona text, p_cfg public.configuracion_gimnasio
) returns public.veredicto_acceso
language plpgsql stable set search_path = '' as $$
declare
  v public.veredicto_acceso; pk record; ultimo record; consumio_hoy boolean;
begin
  select p.*, pl.consume_en,
         p.cantidad - (select count(*) from public.consumos_pack c where c.pack_id = p.id and c.anulado_en is null) as restantes
    into pk
    from public.packs p join public.planes pl on pl.id = p.plan_id
   where p.socio_id = p_socio_id and p.anulado_en is null
     and p.desde <= p_momento and (p.vence_en is null or p.vence_en > p_momento)
     and p.cantidad > (select count(*) from public.consumos_pack c where c.pack_id = p.id and c.anulado_en is null)
   order by p.vence_en nulls last, p.desde
   limit 1;

  if not found then
    select p.*, p.cantidad - (select count(*) from public.consumos_pack c where c.pack_id = p.id and c.anulado_en is null) as restantes
      into ultimo
      from public.packs p
     where p.socio_id = p_socio_id and p.anulado_en is null and p.desde <= p_momento
     order by p.desde desc limit 1;
    if not found then return null; end if;
    v.puede := false; v.color := 'rojo'; v.via := 'pack'; v.consume := 'nada'; v.pack_restantes := greatest(ultimo.restantes, 0);
    if ultimo.vence_en is not null and ultimo.vence_en <= p_momento and ultimo.restantes > 0 then
      v.motivo := 'pack_vencido';
      v.texto := 'El pack venció el ' || privado.ultimo_dia(ultimo.vence_en, p_zona) || ' con ' || ultimo.restantes || ' clases sin usar';
    else
      v.motivo := 'pack_agotado';
      v.texto := 'Usó las ' || ultimo.cantidad || ' clases del pack';
    end if;
    return v;
  end if;

  v.via := 'pack'; v.puede := true; v.color := 'verde';
  if pk.consume_en = 'asistencia' then
    v.motivo := 'pack'; v.consume := 'nada'; v.pack_restantes := pk.restantes;
    v.texto := 'Tiene pack · le quedan ' || pk.restantes || ' · se descuenta en la clase';
    return v;
  end if;

  select exists (
    select 1 from public.consumos_pack c
     where c.socio_id = p_socio_id and c.anulado_en is null and c.ingreso_id is not null
       and privado.dia_local(c.momento, p_zona) = privado.dia_local(p_momento, p_zona)
  ) into consumio_hoy;

  if consumio_hoy and not p_cfg.reingreso_mismo_dia_consume then
    v.motivo := 'pack_reingreso'; v.consume := 'nada'; v.pack_restantes := pk.restantes;
    v.texto := 'Reingreso de hoy · el pack no se descuenta · le quedan ' || pk.restantes;
  else
    v.motivo := 'pack'; v.consume := 'pack'; v.consume_id := pk.id; v.pack_restantes := pk.restantes - 1;
    v.texto := 'Entra con el pack · le quedan ' || (pk.restantes - 1);
  end if;
  return v;
end $$;

-- ── La combinación ─────────────────────────────────────────────────
create or replace function privado.calcular_acceso(p_socio_id uuid, p_momento timestamptz, p_sede_id uuid default null)
returns public.veredicto_acceso
language plpgsql stable set search_path = '' as $$
declare
  so public.socios; zona text; cfg public.configuracion_gimnasio;
  v public.veredicto_acceso; vb public.veredicto_acceso;
  vm public.veredicto_acceso; vp public.veredicto_acceso; vk public.veredicto_acceso;
  avisos text[] := '{}';
  hoy date;
begin
  select * into so from public.socios where id = p_socio_id;
  if not found then raise exception 'Socio inexistente: %', p_socio_id using errcode = 'P0002'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = so.gimnasio_id;
  select * into cfg from public.configuracion_gimnasio where gimnasio_id = so.gimnasio_id;
  hoy := privado.dia_local(p_momento, zona);

  vb := privado.bloqueo_persona(p_socio_id, p_momento);
  if vb.color is not null then
    v := vb;
  else
    vm := privado.via_membresia(p_socio_id, p_momento, p_sede_id, zona, cfg);
    vp := privado.via_pase(p_socio_id, p_momento, p_sede_id, cfg);
    vk := privado.via_pack(p_socio_id, p_momento, zona, cfg);

    if    coalesce(vm.puede, false) then v := vm;
    elsif coalesce(vp.puede, false) then v := vp;
    elsif coalesce(vk.puede, false) then v := vk;
    elsif vm.color is not null then v := vm;
    elsif vk.color is not null then v := vk;
    elsif vp.color is not null then v := vp;
    else
      v.puede := false; v.color := 'gris'; v.via := 'ninguna'; v.consume := 'nada';
      if so.dado_de_baja_en is not null and so.dado_de_baja_en <= p_momento then
        v.motivo := 'se_fue'; v.texto := 'Se dio de baja el ' || privado.fecha_corta(so.dado_de_baja_en, zona);
      else
        v.motivo := 'sin_plan'; v.texto := 'Sin plan activo';
      end if;
    end if;

    -- Lo que dijeron las otras vías, si no era verde.
    if vm.color is not null and vm.motivo is distinct from v.motivo and vm.color <> 'verde' then avisos := array_append(avisos, vm.texto); end if;
    if vk.color is not null and vk.motivo is distinct from v.motivo and vk.color <> 'verde' then avisos := array_append(avisos, vk.texto); end if;
    if vp.color is not null and vp.motivo is distinct from v.motivo and vp.color <> 'verde' then avisos := array_append(avisos, vp.texto); end if;
  end if;

  if so.fecha_nacimiento is not null and to_char(so.fecha_nacimiento, 'MMDD') = to_char(hoy, 'MMDD') then
    avisos := array_append(avisos, 'Cumple años hoy');
  end if;

  v.modo_aviso := false;
  if not v.puede and cfg.avisar_sin_bloquear_hasta is not null and cfg.avisar_sin_bloquear_hasta > p_momento then
    v.puede := true; v.modo_aviso := true;
    avisos := array_prepend('Modo aviso: el sistema habría bloqueado, pero deja pasar'::text, avisos);
  end if;
  v.avisos := avisos;
  v.consume := coalesce(v.consume, 'nada');
  return v;
end $$;

revoke all on function privado.fin_cadena(uuid, timestamptz),
  privado.bloqueo_persona(uuid, timestamptz),
  privado.via_membresia(uuid, timestamptz, uuid, text, public.configuracion_gimnasio),
  privado.via_pase(uuid, timestamptz, uuid, public.configuracion_gimnasio),
  privado.via_pack(uuid, timestamptz, text, public.configuracion_gimnasio),
  privado.calcular_acceso(uuid, timestamptz, uuid) from public;

-- ── Registrar un ingreso ───────────────────────────────────────────
create or replace function privado.registrar_ingreso(
  p_socio_id uuid, p_sede_id uuid, p_via_acceso text, p_registrado_por uuid,
  p_dispositivo_id uuid, p_forzar_motivo text, p_momento timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  g uuid; prev public.ingresos; v public.veredicto_acceso; res text; nuevo uuid; n int;
begin
  -- Un lock por socio: dos lectores de QR al mismo tiempo no descuentan dos clases.
  perform pg_advisory_xact_lock(hashtextextended('gymos:ingreso:' || p_socio_id::text, 0));

  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Socio inexistente: %', p_socio_id using errcode = 'P0002'; end if;

  -- Idempotente: un doble toque dentro de 60 segundos devuelve el mismo ingreso.
  select * into prev from public.ingresos i
   where i.socio_id = p_socio_id and i.anulado_en is null
     and i.resultado in ('entro', 'entro_modo_aviso', 'forzado')
     and i.momento > p_momento - interval '60 seconds' and i.momento <= p_momento
   order by i.momento desc limit 1;
  if found then
    return jsonb_build_object('ingreso_id', prev.id, 'repetido', true, 'resultado', prev.resultado,
                              'color', prev.color, 'motivo', prev.motivo, 'texto', prev.texto);
  end if;

  v := privado.calcular_acceso(p_socio_id, p_momento, p_sede_id);

  if v.puede then
    res := case when v.modo_aviso then 'entro_modo_aviso' else 'entro' end;
  elsif length(trim(coalesce(p_forzar_motivo, ''))) > 0 then
    res := 'forzado';
  else
    res := 'rechazado';
  end if;

  insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado,
                               via_habilitante, color, motivo, texto, forzado_motivo,
                               registrado_por, dispositivo_id)
  values (g, p_sede_id, p_socio_id, p_momento, p_via_acceso, res,
          case when v.puede and not v.modo_aviso and v.via <> 'ninguna' then v.via end,
          v.color, v.motivo, v.texto,
          case when res = 'forzado' then trim(p_forzar_motivo) end,
          p_registrado_por, p_dispositivo_id)
  returning id into nuevo;
  if nuevo is null then raise exception 'No se registró el ingreso'; end if;

  if res in ('entro', 'entro_modo_aviso') and v.consume = 'pase' then
    update public.pases_diarios set usado_en_ingreso_id = nuevo
     where id = v.consume_id and usado_en_ingreso_id is null;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo marcar el pase % como usado', v.consume_id; end if;
  elsif res in ('entro', 'entro_modo_aviso') and v.consume = 'pack' then
    insert into public.consumos_pack (gimnasio_id, pack_id, socio_id, momento, ingreso_id)
    values (g, v.consume_id, p_socio_id, p_momento, nuevo);
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo descontar la clase del pack %', v.consume_id; end if;
  end if;

  return jsonb_build_object('ingreso_id', nuevo, 'repetido', false, 'resultado', res, 'veredicto', to_jsonb(v));
end $$;
revoke all on function privado.registrar_ingreso(uuid, uuid, text, uuid, uuid, text, timestamptz) from public;

-- ── Anular un ingreso (registrado al socio equivocado) ─────────────
create or replace function privado.anular_ingreso(p_ingreso_id uuid, p_motivo text, p_anulado_por uuid, p_sin_limite boolean)
returns void
language plpgsql set search_path = '' as $$
declare i public.ingresos; n int;
begin
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'El motivo es obligatorio'; end if;
  select * into i from public.ingresos where id = p_ingreso_id for update;
  if not found then raise exception 'Ingreso inexistente' using errcode = 'P0002'; end if;
  if i.anulado_en is not null then raise exception 'El ingreso ya estaba anulado'; end if;
  if not p_sin_limite and i.momento < now() - interval '5 minutes' then
    raise exception 'Pasaron más de 5 minutos: lo anula el dueño o el encargado' using errcode = '42501';
  end if;
  update public.ingresos set anulado_en = now(), anulado_por = p_anulado_por, anulado_motivo = trim(p_motivo)
   where id = p_ingreso_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se anuló el ingreso'; end if;
  update public.consumos_pack set anulado_en = now() where ingreso_id = p_ingreso_id and anulado_en is null;
  update public.pases_diarios set usado_en_ingreso_id = null where usado_en_ingreso_id = p_ingreso_id;
end $$;
revoke all on function privado.anular_ingreso(uuid, text, uuid, boolean) from public;

-- ── Congelar con compensación ──────────────────────────────────────
-- Los días cubiertos que caen dentro del congelamiento se devuelven al
-- final de la cadena (o al volver, lo que sea más tarde). Queda una
-- cobertura con origen 'congelamiento': auditable, y el cálculo sigue
-- siendo "¿hay una cobertura que contenga este momento?".
create or replace function privado.compensar(p_suscripcion_id uuid, p_desde timestamptz, p_hasta timestamptz,
                                             p_zona text, out p_inicio timestamptz, out p_dias int)
language plpgsql stable set search_path = '' as $$
declare fin timestamptz;
begin
  fin := privado.fin_cadena(p_suscripcion_id, p_desde);
  if fin is null then p_dias := 0; return; end if;
  p_dias := privado.dia_local(least(fin, p_hasta), p_zona) - privado.dia_local(p_desde, p_zona);
  p_inicio := greatest(fin, p_hasta);
end $$;
revoke all on function privado.compensar(uuid, timestamptz, timestamptz, text) from public;

create or replace function privado.congelar(p_suscripcion_id uuid, p_desde date, p_hasta date,
                                            p_categoria text, p_nota text, p_usuario uuid)
returns uuid
language plpgsql set search_path = '' as $$
declare s public.suscripciones; zona text; d timestamptz; h timestamptz; cid uuid; comp record;
begin
  select * into s from public.suscripciones where id = p_suscripcion_id for update;
  if not found or s.baja_en is not null then raise exception 'Suscripción inexistente o dada de baja'; end if;
  if p_hasta <= p_desde then raise exception 'La fecha de vuelta tiene que ser posterior a la de inicio'; end if;
  select zona_horaria into zona from public.gimnasios where id = s.gimnasio_id;
  d := privado.medianoche(p_desde, zona); h := privado.medianoche(p_hasta, zona);
  if exists (select 1 from public.congelamientos c where c.suscripcion_id = s.id and c.anulado_en is null
              and c.desde < h and coalesce(c.hasta_real, c.hasta_prevista) > d) then
    raise exception 'Ya hay un congelamiento en esas fechas';
  end if;
  insert into public.congelamientos (gimnasio_id, suscripcion_id, socio_id, desde, hasta_prevista, categoria, nota, creado_por)
  values (s.gimnasio_id, s.id, s.socio_id, d, h, p_categoria, p_nota, p_usuario) returning id into cid;
  select * into comp from privado.compensar(s.id, d, h, zona);
  if comp.p_dias > 0 then
    insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, congelamiento_id, motivo, creado_por)
    values (s.gimnasio_id, s.id, s.socio_id, comp.p_inicio,
            privado.medianoche(privado.dia_local(comp.p_inicio, zona) + comp.p_dias, zona),
            'congelamiento', cid, 'Días devueltos por congelamiento', p_usuario);
  end if;
  return cid;
end $$;
revoke all on function privado.congelar(uuid, date, date, text, text, uuid) from public;

-- ── Aplicar un cierre del gimnasio ─────────────────────────────────
create or replace function privado.aplicar_cierre(p_cierre_id uuid, p_usuario uuid) returns int
language plpgsql set search_path = '' as $$
declare c public.cierres; zona text; s record; comp record; n int := 0;
begin
  select * into c from public.cierres where id = p_cierre_id for update;
  if not found then raise exception 'Cierre inexistente' using errcode = 'P0002'; end if;
  if c.aplicado_en is not null then raise exception 'El cierre ya se aplicó el %', c.aplicado_en; end if;
  if c.sede_id is not null then
    raise exception 'Los cierres de una sola sede todavía no compensan: hace falta decidir qué planes alcanza';
  end if;
  select zona_horaria into zona from public.gimnasios where id = c.gimnasio_id;
  if c.compensa then
    for s in select x.* from public.suscripciones x
              where x.gimnasio_id = c.gimnasio_id and x.inicio < c.hasta
                and (x.baja_en is null or x.baja_en > c.desde)
    loop
      select * into comp from privado.compensar(s.id, greatest(c.desde, s.inicio), c.hasta, zona);
      if comp.p_dias > 0 then
        insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, cierre_id, motivo, creado_por)
        values (c.gimnasio_id, s.id, s.socio_id, comp.p_inicio,
                privado.medianoche(privado.dia_local(comp.p_inicio, zona) + comp.p_dias, zona),
                'cierre', c.id, 'Días devueltos por cierre: ' || c.motivo, p_usuario);
        n := n + 1;
      end if;
    end loop;
  end if;
  update public.cierres set aplicado_en = now() where id = c.id;
  return n;
end $$;
revoke all on function privado.aplicar_cierre(uuid, uuid) from public;

-- ═══ API pública (con chequeo de permisos) ═════════════════════════

-- Quién llama: devuelve el id de equipo si tiene alguno de los roles.
create or replace function privado.exigir_rol(p_gimnasio_id uuid, p_roles text[]) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare eid uuid;
begin
  select e.id into eid from public.equipo e
   where e.gimnasio_id = p_gimnasio_id and e.usuario_id = auth.uid() and e.activo and e.rol = any (p_roles);
  if eid is null then
    raise exception 'Sin permiso para esta acción en este gimnasio' using errcode = '42501';
  end if;
  return eid;
end $$;
revoke all on function privado.exigir_rol(uuid, text[]) from public;

create or replace function public.estado_acceso(p_socio_id uuid, p_sede_id uuid default null)
returns public.veredicto_acceso
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null or not (
       privado.es_servicio()
    or g in (select privado.mis_gimnasios(array['dueno', 'encargado', 'recepcion']))
    or p_socio_id in (select privado.mis_socios())
  ) then
    raise exception 'Sin permiso o socio inexistente' using errcode = '42501';
  end if;
  return privado.calcular_acceso(p_socio_id, now(), p_sede_id);
end $$;

create or replace function public.registrar_ingreso(
  p_socio_id uuid, p_sede_id uuid, p_via_acceso text default 'recepcion',
  p_forzar_motivo text default null, p_dispositivo_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if privado.es_servicio() then
    eid := null;   -- kiosco o QR: el servidor validó el dispositivo antes de llamar
  else
    eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion']);
    if p_dispositivo_id is not null then raise exception 'Un dispositivo solo registra desde el servidor' using errcode = '42501'; end if;
  end if;
  return privado.registrar_ingreso(p_socio_id, p_sede_id, p_via_acceso, eid, p_dispositivo_id, p_forzar_motivo, now());
end $$;

create or replace function public.anular_ingreso(p_ingreso_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid; rol text;
begin
  select gimnasio_id into g from public.ingresos where id = p_ingreso_id;
  if g is null then raise exception 'Sin permiso o ingreso inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion']);
  select e.rol into rol from public.equipo e where e.id = eid;
  perform privado.anular_ingreso(p_ingreso_id, p_motivo, eid, rol in ('dueno', 'encargado'));
end $$;

create or replace function public.congelar(p_suscripcion_id uuid, p_desde date, p_hasta date,
                                           p_categoria text, p_nota text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.suscripciones where id = p_suscripcion_id;
  if g is null then raise exception 'Sin permiso o suscripción inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion']);
  return privado.congelar(p_suscripcion_id, p_desde, p_hasta, p_categoria, p_nota, auth.uid());
end $$;

create or replace function public.aplicar_cierre(p_cierre_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.cierres where id = p_cierre_id;
  if g is null then raise exception 'Sin permiso o cierre inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(g, array['dueno', 'encargado']);
  return privado.aplicar_cierre(p_cierre_id, auth.uid());
end $$;

revoke all on function public.estado_acceso(uuid, uuid),
  public.registrar_ingreso(uuid, uuid, text, text, uuid),
  public.anular_ingreso(uuid, text),
  public.congelar(uuid, date, date, text, text),
  public.aplicar_cierre(uuid) from public, anon, authenticated;
grant execute on function public.estado_acceso(uuid, uuid),
  public.registrar_ingreso(uuid, uuid, text, text, uuid),
  public.anular_ingreso(uuid, text),
  public.congelar(uuid, date, date, text, text),
  public.aplicar_cierre(uuid) to authenticated, service_role;

-- ── Verificación final ─────────────────────────────────────────────
do $$
declare faltan text;
begin
  select string_agg(c.relname, ', ') into faltan from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relname in ('dispositivos', 'dispositivos_tokens', 'ingresos') and not c.relrowsecurity;
  if faltan is not null then raise exception 'Verificación: tablas sin RLS: %', faltan; end if;
  if has_function_privilege('anon', 'public.registrar_ingreso(uuid, uuid, text, text, uuid)', 'execute') then
    raise exception 'Verificación: anon puede registrar ingresos';
  end if;
end $$;
