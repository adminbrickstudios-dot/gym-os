-- 0053 · Invitados (INV-1).
-- Un socio al día puede traer a alguien: la recepción lo anota (nombre, DNI y
-- quién lo invita) o el socio lo invita desde la app para ese día y la
-- recepción confirma que entró. Nunca anónimo. Límite por mes (calendario,
-- hora del gimnasio): por socio que invita y por DNI invitado (así nadie
-- entrena gratis rotando de anfitrión). 0 = el gimnasio no recibe invitados.
-- No cuenta como entrada del socio ni cobra nada. Sale en Inicio del dueño.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.leer_llavero(uuid, text)') is null then raise exception 'Guarda: falta la migración 0052'; end if;
end $$;

alter table public.configuracion_gimnasio add column if not exists invitados_por_mes int;
update public.configuracion_gimnasio set invitados_por_mes = 2 where invitados_por_mes is null;
alter table public.configuracion_gimnasio alter column invitados_por_mes set default 2;
alter table public.configuracion_gimnasio alter column invitados_por_mes set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_invitados_rango') then
    alter table public.configuracion_gimnasio add constraint configuracion_invitados_rango check (invitados_por_mes between 0 and 10);
  end if;
end $$;

create table if not exists public.invitados (
  id             uuid primary key default gen_random_uuid(),
  gimnasio_id    uuid not null references public.gimnasios(id),
  sede_id        uuid,
  socio_id       uuid not null,
  nombre         text not null check (length(trim(nombre)) between 2 and 80),
  dni            text not null check (dni ~ '^[0-9]{6,9}$'),
  para_el_dia    timestamptz not null,           -- medianoche local del día de la invitación
  entro_en       timestamptz,
  creado_en      timestamptz not null default now(),
  creado_por     uuid references auth.users(id),
  desde_la_app   boolean not null default false,
  anulado_en     timestamptz,
  anulado_motivo text,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  check ((anulado_en is null) = (anulado_motivo is null))
);
create index if not exists invitados_dia on public.invitados (gimnasio_id, para_el_dia);
create index if not exists invitados_socio on public.invitados (socio_id, para_el_dia);
create index if not exists invitados_dni on public.invitados (gimnasio_id, dni, para_el_dia);
select privado.politicas_estandar('public.invitados', array['dueno', 'encargado', 'recepcion'], null);
revoke all on table public.invitados from anon;

-- ¿Puede este socio invitar a este DNI hoy? Si no, dice por qué.
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

-- La recepción lo anota y entra ya.
create or replace function public.registrar_invitado(p_gimnasio_id uuid, p_sede_id uuid, p_socio_id uuid, p_nombre text, p_dni text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare zona text; hoy date; d text := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g'); iid uuid;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado', 'recepcion'], p_sede_id);
  if not exists (select 1 from public.socios s where s.id = p_socio_id and s.gimnasio_id = p_gimnasio_id) then
    raise exception 'Elegí al socio que lo invita.' using errcode = '22023';
  end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  perform privado.validar_invitado(p_gimnasio_id, p_socio_id, p_nombre, d, hoy);
  insert into public.invitados (gimnasio_id, sede_id, socio_id, nombre, dni, para_el_dia, entro_en, creado_por)
  values (p_gimnasio_id, p_sede_id, p_socio_id, trim(p_nombre), d, privado.medianoche(hoy, zona), now(), auth.uid()) returning id into iid;
  return iid;
end $$;

-- El socio lo invita desde la app, para hoy.
create or replace function public.invitar(p_gimnasio_id uuid, p_socio_id uuid, p_nombre text, p_dni text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare zona text; hoy date; d text := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g'); iid uuid;
begin
  if auth.uid() is null or not exists (select 1 from public.socios s where s.id = p_socio_id and s.gimnasio_id = p_gimnasio_id
                                           and s.usuario_id = auth.uid() and s.dado_de_baja_en is null) then
    raise exception 'Sin permiso para ese socio' using errcode = '42501';
  end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  perform privado.validar_invitado(p_gimnasio_id, p_socio_id, p_nombre, d, hoy);
  insert into public.invitados (gimnasio_id, socio_id, nombre, dni, para_el_dia, creado_por, desde_la_app)
  values (p_gimnasio_id, p_socio_id, trim(p_nombre), d, privado.medianoche(hoy, zona), auth.uid(), true) returning id into iid;
  return iid;
end $$;

-- La recepción confirma que entró el invitado de la app.
create or replace function public.confirmar_invitado(p_invitado_id uuid, p_sede_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare i public.invitados; zona text; n int;
begin
  select * into i from public.invitados where id = p_invitado_id;
  if i.id is null then raise exception 'Sin permiso o invitado inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(i.gimnasio_id, array['dueno', 'encargado', 'recepcion'], p_sede_id);
  select g.zona_horaria into zona from public.gimnasios g where g.id = i.gimnasio_id;
  if i.para_el_dia <> privado.medianoche(privado.dia_local(now(), zona), zona) then raise exception 'Esa invitación era para otro día.' using errcode = '22023'; end if;
  update public.invitados set entro_en = now(), sede_id = p_sede_id where id = i.id and entro_en is null and anulado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese invitado ya entró o la invitación se anuló.'; end if;
end $$;

create or replace function public.anular_invitado(p_invitado_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare i public.invitados; n int;
begin
  select * into i from public.invitados where id = p_invitado_id;
  if i.id is null then raise exception 'Sin permiso o invitado inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(i.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'El motivo es obligatorio.' using errcode = '22023'; end if;
  update public.invitados set anulado_en = now(), anulado_motivo = trim(p_motivo) where id = i.id and anulado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ya estaba anulado.'; end if;
end $$;

-- Los de hoy (Entrada e Inicio).
create or replace function public.invitados_de_hoy(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; ini timestamptz;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  ini := privado.medianoche(privado.dia_local(now(), zona), zona);
  return coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'nombre', i.nombre, 'dni', i.dni, 'socio_id', s.id,
      'socio', trim(s.nombre || ' ' || s.apellido), 'entro_en', i.entro_en, 'desde_la_app', i.desde_la_app) order by i.entro_en desc nulls first, i.creado_en)
    from public.invitados i join public.socios s on s.id = i.socio_id
   where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.para_el_dia = ini), '[]');
end $$;

-- Lo que ve el socio en su app.
create or replace function public.mis_invitados(p_gimnasio_id uuid, p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; lim int; ini timestamptz;
begin
  if auth.uid() is null or not exists (select 1 from public.socios s where s.id = p_socio_id and s.gimnasio_id = p_gimnasio_id and s.usuario_id = auth.uid()) then
    raise exception 'Sin permiso para ese socio' using errcode = '42501';
  end if;
  select g.zona_horaria, c.invitados_por_mes into zona, lim from public.gimnasios g join public.configuracion_gimnasio c on c.gimnasio_id = g.id where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  ini := privado.medianoche(date_trunc('month', hoy)::date, zona);
  return jsonb_build_object('limite', lim,
    'usados', (select count(*) from public.invitados i where i.socio_id = p_socio_id and i.anulado_en is null and i.para_el_dia >= ini),
    'hoy', coalesce((select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'entro', i.entro_en is not null) order by i.creado_en)
                       from public.invitados i where i.socio_id = p_socio_id and i.anulado_en is null and i.para_el_dia = privado.medianoche(hoy, zona)), '[]'));
end $$;

-- ── Configuración: el límite con el resto de las reglas ─────────────
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
    'pausa_dias_por_anio', c.pausa_dias_por_anio, 'pide_apto', c.pide_apto, 'tope_dejar_pasar', c.tope_dejar_pasar, 'invitados_por_mes', c.invitados_por_mes);
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
  v_tol int; v_aviso int; v_aus int; v_nuevo int; v_venc int; v_fue int; v_res int; v_canc int; v_pausa int; v_apto boolean; v_tope int; v_invitados int;
  v_acento text; v_fondo text; v_reingreso boolean; v_medios text[]; v_banco text; v_secciones_final text[]; v_medios_final text[];
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos'; end if;
  select array_agg(k) into desconocidos from jsonb_object_keys(p_datos) k
   where k not in ('nombre', 'color_acento', 'color_fondo', 'cobra_membresia', 'cobra_pase', 'cobra_pack', 'modo_clases',
                   'accesos_activos', 'tolerancia_dias', 'dias_aviso', 'reingreso_mismo_dia_consume', 'secciones_apagadas',
                   'alias_transferencia', 'cbu', 'titular_cuenta', 'descuento_max_recepcion', 'retencion_dias_ausencia',
                   'retencion_dias_nuevo', 'retencion_dias_vencido', 'retencion_dias_se_fue', 'reserva_dias_anticipacion',
                   'cancelacion_horas_limite', 'medios_aceptados', 'banco_transferencia', 'pausa_dias_por_anio', 'pide_apto', 'tope_dejar_pasar', 'invitados_por_mes');
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
  if p_datos ? 'pide_apto' then
    if jsonb_typeof(p_datos -> 'pide_apto') is distinct from 'boolean' then raise exception 'Pedir apto físico: elegí sí o no.' using errcode = '22023'; end if;
    v_apto := (p_datos ->> 'pide_apto')::boolean;
  end if;
  v_invitados := privado.config_entero(p_datos, 'invitados_por_mes', 0, 10, 'Invitados por socio por mes');
  v_tope := privado.config_entero(p_datos, 'tope_dejar_pasar', 0, 50, 'Dejar pasar: tope por día de la recepción');
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
    pide_apto = coalesce(v_apto, c.pide_apto),
    tope_dejar_pasar = coalesce(v_tope, c.tope_dejar_pasar),
    invitados_por_mes = coalesce(v_invitados, c.invitados_por_mes),
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
      'pausa_dias_por_anio', 'Pausa: máximo de días por año', 'pide_apto', 'Pedir apto físico', 'tope_dejar_pasar', 'Dejar pasar: tope por día de la recepción', 'invitados_por_mes', 'Invitados por socio por mes') ->> p_campo, p_campo)
  end
$$;
revoke all on function privado.etiqueta_campo(text) from public, anon, authenticated;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.registrar_invitado(uuid, uuid, uuid, text, text), public.invitar(uuid, uuid, text, text),
  public.confirmar_invitado(uuid, uuid), public.anular_invitado(uuid, text), public.invitados_de_hoy(uuid), public.mis_invitados(uuid, uuid),
  public.configuracion_panel(uuid), public.guardar_configuracion(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_invitado(uuid, uuid, uuid, text, text), public.invitar(uuid, uuid, text, text),
  public.confirmar_invitado(uuid, uuid), public.anular_invitado(uuid, text), public.invitados_de_hoy(uuid), public.mis_invitados(uuid, uuid),
  public.configuracion_panel(uuid), public.guardar_configuracion(uuid, jsonb) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.invitados'::regclass) then raise exception 'Verificación: invitados sin RLS'; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invitados' and cmd <> 'SELECT') then
    raise exception 'Verificación: invitados se puede escribir desde el cliente';
  end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'public' and p.proname in ('registrar_invitado', 'invitar', 'confirmar_invitado', 'anular_invitado', 'invitados_de_hoy',
                                                          'mis_invitados', 'configuracion_panel', 'guardar_configuracion'))
               or (s.nspname = 'privado' and p.proname = 'validar_invitado') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
end $$;
