-- Carril B · Super admin, fase 2 (tercera parte).
--   SA-8  Novedades para ciertos gimnasios (plan, ciudad, módulo), historial "qué hay de nuevo" y aviso de mantenimiento.
--   SA-7  Prueba gratis (días), descuentos por gimnasio con motivo y fecha de fin, link de pago de BRIK.
--   SA-9  Estado de la plataforma (migraciones, base), uso por gimnasio y funciones a prueba por gimnasio.
--   SA-6  Papelera (30 días), clonar la configuración de otro gimnasio y borrado definitivo = anonimizar.
--   Webhooks: leer un evento fallido para reprocesarlo a pedido (el reproceso corre en el servidor, sin tocar la ruta del webhook).
-- Parte de las definiciones vigentes: privado.estado_abono (0110) y novedades_dueno (0109) no tienen parches posteriores.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.exigir_brik(text[])') is null then raise exception 'Guarda: falta privado.exigir_brik (migración 020200)'; end if;
  if to_regprocedure('public.admin_publicar_novedad(text,text,text)') is null
     and to_regprocedure('public.admin_publicar_novedad(text,text,text,text,text,text)') is null then raise exception 'Guarda: falta admin_publicar_novedad'; end if;
  if to_regprocedure('privado.estado_abono(uuid)') is null then raise exception 'Guarda: falta privado.estado_abono'; end if;
  if to_regclass('public.plataforma_ajustes') is null then raise exception 'Guarda: falta plataforma_ajustes (migración 020200)'; end if;
end $$;

-- ── Columnas y tablas nuevas ────────────────────────────────────────
alter table public.novedades_plataforma add column if not exists para_plan text;
alter table public.novedades_plataforma add column if not exists para_ciudad text;
alter table public.novedades_plataforma add column if not exists para_modulo text;
alter table public.gimnasios add column if not exists prueba_dias int not null default 14;
alter table public.gimnasios add column if not exists borrado_en timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gimnasios_prueba_dias_rango') then
    alter table public.gimnasios add constraint gimnasios_prueba_dias_rango check (prueba_dias between 0 and 90);
  end if;
end $$;

create table if not exists public.avisos_mantenimiento (
  id            uuid primary key default gen_random_uuid(),
  desde         timestamptz not null,
  hasta         timestamptz not null,
  texto         text not null check (length(btrim(texto)) between 5 and 200),
  creado_por    uuid not null references auth.users(id),
  creado_en     timestamptz not null default now(),
  cancelado_en  timestamptz,
  check (hasta > desde)
);
alter table public.avisos_mantenimiento enable row level security;
revoke all on table public.avisos_mantenimiento from anon, authenticated;

create table if not exists public.descuentos_brik (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  porcentaje   numeric(5,2) not null check (porcentaje > 0 and porcentaje <= 100),
  motivo       text not null check (length(btrim(motivo)) between 5 and 200),
  hasta        date not null,
  creado_por   uuid not null references auth.users(id),
  creado_en    timestamptz not null default now(),
  quitado_en   timestamptz
);
create index if not exists descuentos_brik_por_gimnasio on public.descuentos_brik (gimnasio_id, hasta desc);
alter table public.descuentos_brik enable row level security;
revoke all on table public.descuentos_brik from anon, authenticated;

create table if not exists public.funciones_prueba (
  clave        text not null check (clave ~ '^[a-z0-9_]{2,40}$'),
  gimnasio_id  uuid not null references public.gimnasios(id),
  creado_en    timestamptz not null default now(),
  primary key (clave, gimnasio_id)
);
alter table public.funciones_prueba enable row level security;
revoke all on table public.funciones_prueba from anon, authenticated;

-- ── SA-7 · Estado del abono con prueba gratis y descuento ───────────
-- Igual que la 0110, con la prueba de cada gimnasio (prueba_dias) y el descuento vigente. El estado se sigue calculando.
create or replace function privado.estado_abono(p_gimnasio_id uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare g public.gimnasios; pl public.plataforma_planes; hoy date; hasta date; estado text; pago_hasta date; d public.descuentos_brik;
begin
  select * into g from public.gimnasios where id = p_gimnasio_id;
  if g.plataforma_plan_id is null or g.es_demo then return jsonb_build_object('estado', 'sin_abono'); end if;
  select * into pl from public.plataforma_planes where id = g.plataforma_plan_id;
  hoy := privado.dia_local(now(), g.zona_horaria);
  pago_hasta := (select max(p.cubre_hasta) from public.plataforma_pagos p where p.gimnasio_id = g.id and p.anulado_en is null);
  hasta := coalesce(pago_hasta, coalesce(g.plataforma_desde, hoy) + g.prueba_dias);
  estado := case when hoy > hasta then 'vencido' when hoy > hasta - 7 then 'por_vencer' else 'al_dia' end;
  select * into d from public.descuentos_brik x where x.gimnasio_id = g.id and x.quitado_en is null and x.hasta >= hoy order by x.hasta desc limit 1;
  return jsonb_build_object('estado', estado, 'plan', pl.nombre, 'precio_mensual', pl.precio_mensual, 'pagado_hasta', hasta, 'dias', hasta - hoy,
    'en_prueba', pago_hasta is null,
    'descuento', case when d.id is null then null else jsonb_build_object('porcentaje', d.porcentaje, 'motivo', d.motivo, 'hasta', d.hasta) end,
    'precio_con_descuento', case when d.id is null then pl.precio_mensual else round(pl.precio_mensual * (100 - d.porcentaje) / 100, 2) end);
end $$;
revoke all on function privado.estado_abono(uuid) from public;

create or replace function public.admin_guardar_prueba(p_gimnasio_id uuid, p_dias int) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  if p_dias is null or p_dias not between 0 and 90 then raise exception 'La prueba gratis: de 0 a 90 días' using errcode = '22023'; end if;
  update public.gimnasios set prueba_dias = p_dias where id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  perform privado.registrar_brik('guardar_prueba', p_gimnasio_id, jsonb_build_object('dias', p_dias));
end $$;

create or replace function public.admin_guardar_descuento(p_gimnasio_id uuid, p_porcentaje numeric, p_motivo text, p_hasta date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  if not exists (select 1 from public.gimnasios where id = p_gimnasio_id) then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  if p_porcentaje is null or p_porcentaje <= 0 or p_porcentaje > 100 then raise exception 'El descuento: mayor a 0 y hasta 100 por ciento' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escribí el motivo del descuento (al menos 5 letras)' using errcode = '22023'; end if;
  if p_hasta is null or p_hasta < current_date then raise exception 'La fecha de fin tiene que ser de hoy en adelante' using errcode = '22023'; end if;
  update public.descuentos_brik set quitado_en = now() where gimnasio_id = p_gimnasio_id and quitado_en is null;
  insert into public.descuentos_brik (gimnasio_id, porcentaje, motivo, hasta, creado_por) values (p_gimnasio_id, round(p_porcentaje, 2), btrim(p_motivo), p_hasta, auth.uid()) returning descuentos_brik.id into v_id;
  perform privado.registrar_brik('guardar_descuento', p_gimnasio_id, jsonb_build_object('porcentaje', p_porcentaje, 'motivo', btrim(p_motivo), 'hasta', p_hasta));
  return v_id;
end $$;

create or replace function public.admin_quitar_descuento(p_gimnasio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  update public.descuentos_brik set quitado_en = now() where gimnasio_id = p_gimnasio_id and quitado_en is null;
  get diagnostics n = row_count;
  if n < 1 then raise exception 'Ese gimnasio no tiene descuento' using errcode = 'P0002'; end if;
  perform privado.registrar_brik('quitar_descuento', p_gimnasio_id, '{}'::jsonb);
end $$;

-- El link de pago de BRIK que va en el recordatorio por WhatsApp (https). Vacío lo borra.
create or replace function public.admin_guardar_link_pago(p_link text) returns void
language plpgsql security definer set search_path = '' as $$
declare l text := nullif(btrim(coalesce(p_link, '')), '');
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  if l is not null and (l !~ '^https://\S+$' or length(l) > 300) then raise exception 'El link tiene que empezar con https://' using errcode = '22023'; end if;
  if l is null then delete from public.plataforma_ajustes where clave = 'link_pago';
  else insert into public.plataforma_ajustes (clave, valor) values ('link_pago', to_jsonb(l)) on conflict (clave) do update set valor = excluded.valor; end if;
  perform privado.registrar_brik('guardar_link_pago', null, '{}'::jsonb);
end $$;

create or replace function public.admin_link_pago() returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  return (select p.valor #>> '{}' from public.plataforma_ajustes p where p.clave = 'link_pago');
end $$;

-- ── SA-8 · Novedades para ciertos gimnasios ─────────────────────────
-- ¿Le toca esta novedad a este gimnasio? Sin filtros, a todos.
create or replace function privado.novedad_alcanza(p_novedad public.novedades_plataforma, p_gimnasio_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select (p_novedad.para_plan is null or lower(coalesce(privado.estado_abono(p_gimnasio_id) ->> 'plan', '')) = lower(p_novedad.para_plan))
     and (p_novedad.para_ciudad is null or lower(coalesce((select c.ciudad from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id), '')) = lower(p_novedad.para_ciudad))
     and (p_novedad.para_modulo is null or not exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id and p_novedad.para_modulo = any (c.secciones_apagadas)))
$$;
revoke all on function privado.novedad_alcanza(public.novedades_plataforma, uuid) from public;

drop function if exists public.admin_publicar_novedad(text, text, text);
create or replace function public.admin_publicar_novedad(p_titulo text, p_texto text, p_link text default null,
                                                         p_plan text default null, p_ciudad text default null, p_modulo text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare t text := trim(coalesce(p_titulo, '')); x text := trim(coalesce(p_texto, '')); l text := nullif(trim(coalesce(p_link, '')), ''); nid uuid;
        pl text := nullif(btrim(coalesce(p_plan, '')), ''); ci text := nullif(btrim(coalesce(p_ciudad, '')), ''); mo text := nullif(btrim(coalesce(p_modulo, '')), '');
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  if length(t) not between 3 and 80 then raise exception 'El título: de 3 a 80 letras' using errcode = '22023'; end if;
  if length(x) not between 3 and 400 then raise exception 'El texto: de 3 a 400 letras' using errcode = '22023'; end if;
  if l is not null and (l !~ '^https://\S+$' or length(l) > 300) then raise exception 'El link tiene que empezar con https://' using errcode = '22023'; end if;
  if mo is not null and not (array[mo] <@ privado.secciones_validas()) then raise exception 'Ese módulo no existe' using errcode = '22023'; end if;
  insert into public.novedades_plataforma (titulo, texto, link, creado_por, para_plan, para_ciudad, para_modulo) values (t, x, l, auth.uid(), pl, ci, mo) returning id into nid;
  perform privado.registrar_brik('publicar_novedad', null, jsonb_build_object('titulo', t, 'plan', pl, 'ciudad', ci, 'modulo', mo));
  return nid;
end $$;

-- A quién llega y cuántos la cerraron (la "vieron" y la descartaron).
create or replace function public.admin_novedades() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'titulo', n.titulo, 'texto', n.texto, 'link', n.link, 'creado_en', n.creado_en,
            'para_plan', n.para_plan, 'para_ciudad', n.para_ciudad, 'para_modulo', n.para_modulo,
            'alcanza', (select count(*)::int from public.gimnasios g where not g.es_demo and g.baja_en is null and privado.novedad_alcanza(n, g.id)),
            'cerraron', (select count(*) from public.novedades_plataforma_cerradas c where c.novedad_id = n.id)) order by n.creado_en desc)
    from public.novedades_plataforma n where n.retirada_en is null), '[]'::jsonb);
end $$;

create or replace function public.novedades_dueno(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'titulo', n.titulo, 'texto', n.texto, 'link', n.link) order by n.creado_en desc)
    from public.novedades_plataforma n
   where n.retirada_en is null and privado.novedad_alcanza(n, p_gimnasio_id)
     and not exists (select 1 from public.novedades_plataforma_cerradas c where c.novedad_id = n.id and c.gimnasio_id = p_gimnasio_id and c.equipo_id = e.id)), '[]'::jsonb);
end $$;

-- "Qué hay de nuevo": todas las novedades que le tocaron, las haya cerrado o no.
create or replace function public.novedades_historial(p_gimnasio_id uuid, p_limite int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'titulo', n.titulo, 'texto', n.texto, 'link', n.link, 'creado_en', n.creado_en) order by n.creado_en desc)
    from (select * from public.novedades_plataforma x where x.retirada_en is null and privado.novedad_alcanza(x, p_gimnasio_id)
           order by x.creado_en desc limit least(greatest(coalesce(p_limite, 30), 1), 100)) n), '[]'::jsonb);
end $$;

-- Aviso de mantenimiento programado: una franja en los paneles con la hora (la pantalla la muestra con mantenimiento_vigente).
create or replace function public.admin_programar_mantenimiento(p_desde timestamptz, p_hasta timestamptz, p_texto text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform privado.exigir_brik(array['principal']);
  if p_desde is null or p_hasta is null or p_hasta <= p_desde then raise exception 'La hora de fin tiene que ser después de la de inicio' using errcode = '22023'; end if;
  if p_hasta < now() then raise exception 'Ese horario ya pasó' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_texto, ''))) < 5 then raise exception 'Escribí qué va a pasar (al menos 5 letras)' using errcode = '22023'; end if;
  insert into public.avisos_mantenimiento (desde, hasta, texto, creado_por) values (p_desde, p_hasta, btrim(p_texto), auth.uid()) returning avisos_mantenimiento.id into v_id;
  perform privado.registrar_brik('programar_mantenimiento', null, jsonb_build_object('desde', p_desde, 'hasta', p_hasta, 'texto', btrim(p_texto)));
  return v_id;
end $$;

create or replace function public.admin_cancelar_mantenimiento(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_brik(array['principal']);
  update public.avisos_mantenimiento set cancelado_en = now() where id = p_id and cancelado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese aviso no existe o ya estaba cancelado' using errcode = 'P0002'; end if;
  perform privado.registrar_brik('cancelar_mantenimiento', null, jsonb_build_object('id', p_id));
end $$;

create or replace function public.admin_mantenimientos() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'desde', m.desde, 'hasta', m.hasta, 'texto', m.texto) order by m.desde)
    from public.avisos_mantenimiento m where m.cancelado_en is null and m.hasta > now()), '[]'::jsonb);
end $$;

-- Lo que ven todos los paneles: el aviso vigente o el que viene en las próximas 48 horas. Sin datos de nadie, por eso lo ve cualquiera.
create or replace function public.mantenimiento_vigente() returns jsonb
language sql stable security definer set search_path = '' as $$
  select (select jsonb_build_object('desde', m.desde, 'hasta', m.hasta, 'texto', m.texto, 'ahora', m.desde <= now())
            from public.avisos_mantenimiento m where m.cancelado_en is null and m.hasta > now() and m.desde < now() + interval '48 hours'
           order by m.desde limit 1)
$$;

-- ── SA-9 · Plataforma ───────────────────────────────────────────────
create or replace function public.admin_plataforma_estado() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  select jsonb_build_object(
    'migraciones', (select count(*)::int from supabase_migrations.schema_migrations),
    'ultima_migracion', (select m.version || ' ' || coalesce(m.name, '') from supabase_migrations.schema_migrations m order by m.version desc limit 1),
    'tamano_base_mb', (select round(pg_database_size(current_database()) / 1048576.0)::int),
    'hora_base', now()) into r;
  return r;
end $$;

-- Uso por gimnasio: para ver quién se acerca a los límites del plan.
create or replace function public.admin_uso_gimnasios() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  return coalesce((select jsonb_agg(jsonb_build_object('gimnasio_id', g.id, 'nombre', g.nombre,
      'socios', (select count(*)::int from public.socios s where s.gimnasio_id = g.id and s.dado_de_baja_en is null),
      'fotos', (select count(*)::int from public.socios s where s.gimnasio_id = g.id and s.foto_path is not null),
      'ingresos_30_dias', (select count(*)::int from public.ingresos i where i.gimnasio_id = g.id and i.momento > now() - interval '30 days' and i.anulado_en is null and i.resultado <> 'rechazado'),
      'sedes', (select count(*)::int from public.sedes d where d.gimnasio_id = g.id)) order by g.nombre)
    from public.gimnasios g where not g.es_demo and g.baja_en is null), '[]'::jsonb);
end $$;

-- Funciones a prueba: prender una función nueva solo en un gimnasio. La función de la app pregunta con funcion_prendida.
create or replace function public.admin_prender_funcion(p_gimnasio_id uuid, p_clave text, p_prendida boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare c text := lower(btrim(coalesce(p_clave, '')));
begin
  perform privado.exigir_brik(array['principal']);
  if c !~ '^[a-z0-9_]{2,40}$' then raise exception 'La clave: letras minúsculas, números y guion bajo' using errcode = '22023'; end if;
  if not exists (select 1 from public.gimnasios where id = p_gimnasio_id) then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  if coalesce(p_prendida, true) then insert into public.funciones_prueba (clave, gimnasio_id) values (c, p_gimnasio_id) on conflict do nothing;
  else delete from public.funciones_prueba where clave = c and gimnasio_id = p_gimnasio_id; end if;
  perform privado.registrar_brik('prender_funcion', p_gimnasio_id, jsonb_build_object('clave', c, 'prendida', coalesce(p_prendida, true)));
end $$;

create or replace function public.admin_funciones_prueba() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'lectura']);
  return coalesce((select jsonb_agg(jsonb_build_object('clave', f.clave, 'gimnasio_id', f.gimnasio_id, 'gimnasio', g.nombre) order by f.clave, g.nombre)
    from public.funciones_prueba f join public.gimnasios g on g.id = f.gimnasio_id), '[]'::jsonb);
end $$;

create or replace function public.funcion_prendida(p_gimnasio_id uuid, p_clave text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.funciones_prueba f where f.gimnasio_id = p_gimnasio_id and f.clave = p_clave)
     and (privado.soy_admin_plataforma() or exists (select 1 from public.equipo e where e.gimnasio_id = p_gimnasio_id and e.usuario_id = auth.uid() and e.activo))
$$;

-- ── Papelera: lo que se quitó en los últimos 30 días ────────────────
create or replace function public.admin_papelera(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'soporte']);
  return jsonb_build_object(
    'socios', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nombre', btrim(s.nombre || ' ' || s.apellido), 'numero', s.numero, 'baja', s.dado_de_baja_en) order by s.dado_de_baja_en desc)
        from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en > now() - interval '30 days' and s.nombre <> 'Socio borrado'), '[]'::jsonb),
    'planes', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'tipo', p.tipo) order by p.nombre)
        from public.planes p where p.gimnasio_id = p_gimnasio_id and not p.activo), '[]'::jsonb));
end $$;

create or replace function public.admin_restaurar_socio(p_gimnasio_id uuid, p_socio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_brik(array['principal', 'soporte']);
  update public.socios set dado_de_baja_en = null, motivo_baja = null
   where id = p_socio_id and gimnasio_id = p_gimnasio_id and dado_de_baja_en > now() - interval '30 days' and nombre <> 'Socio borrado';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese socio no está en la papelera (o pasaron más de 30 días)' using errcode = 'P0002'; end if;
  perform privado.registrar_brik('restaurar_socio', p_gimnasio_id, jsonb_build_object('socio_id', p_socio_id));
end $$;

create or replace function public.admin_restaurar_plan(p_gimnasio_id uuid, p_plan_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_brik(array['principal', 'soporte']);
  update public.planes set activo = true where id = p_plan_id and gimnasio_id = p_gimnasio_id and not activo;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese plan no está archivado' using errcode = 'P0002'; end if;
  perform privado.registrar_brik('restaurar_plan', p_gimnasio_id, jsonb_build_object('plan_id', p_plan_id));
end $$;

-- ── Clonar la configuración de otro gimnasio (sin socios ni plata) ──
-- Copia los planes activos con su precio de hoy, las actividades y lo prendido o apagado. Solo a un gimnasio sin planes.
create or replace function public.admin_clonar_configuracion(p_origen uuid, p_destino uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.planes; nuevo uuid; monto numeric; n_planes int := 0; n_act int := 0; o public.configuracion_gimnasio; a record;
begin
  perform privado.exigir_brik(array['principal']);
  if p_origen = p_destino then raise exception 'El origen y el destino son el mismo gimnasio' using errcode = '22023'; end if;
  select * into o from public.configuracion_gimnasio where gimnasio_id = p_origen;
  if not found then raise exception 'El gimnasio de origen no existe' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.configuracion_gimnasio where gimnasio_id = p_destino) then raise exception 'El gimnasio de destino no existe' using errcode = 'P0002'; end if;
  if exists (select 1 from public.planes where gimnasio_id = p_destino) then raise exception 'El destino ya tiene planes: la copia es solo para un gimnasio recién creado' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set modo_clases = o.modo_clases, cobra_membresia = o.cobra_membresia, cobra_pase = o.cobra_pase, cobra_pack = o.cobra_pack,
         turnos_fijos = o.turnos_fijos, secciones_apagadas = o.secciones_apagadas, tolerancia_dias = o.tolerancia_dias, dias_aviso = o.dias_aviso
   where gimnasio_id = p_destino;
  for a in select * from public.actividades where gimnasio_id = p_origen loop
    insert into public.actividades (gimnasio_id, nombre, emoji) values (p_destino, a.nombre, a.emoji);
    n_act := n_act + 1;
  end loop;
  for p in select * from public.planes where gimnasio_id = p_origen and activo order by orden, nombre loop
    nuevo := gen_random_uuid();
    insert into public.planes select (jsonb_populate_record(null::public.planes, to_jsonb(p) || jsonb_build_object('id', nuevo, 'gimnasio_id', p_destino, 'creado_en', now()))).*;
    select pr.monto into monto from public.precios_plan pr where pr.plan_id = p.id and pr.gimnasio_id = p_origen and pr.sede_id is null and pr.vigente_desde <= now()
      order by pr.vigente_desde desc limit 1;
    if monto is not null then
      insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde, creado_por) values (p_destino, nuevo, monto, now(), auth.uid());
    end if;
    n_planes := n_planes + 1;
  end loop;
  perform privado.registrar_brik('clonar_configuracion', p_destino, jsonb_build_object('origen', p_origen, 'planes', n_planes, 'actividades', n_act));
  return jsonb_build_object('planes', n_planes, 'actividades', n_act);
end $$;

-- ── Borrado definitivo = anonimizar (decidido por defecto) ──────────
-- Solo el principal, después de 30 días de baja y escribiendo el nombre del gimnasio. Los hechos de plata se quedan
-- (la plata tiene que cuadrar); se borran los datos personales y el gimnasio queda como "Gimnasio borrado".
create or replace function public.admin_borrar_definitivo(p_gimnasio_id uuid, p_nombre text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g public.gimnasios; n_socios int; n_equipo int;
begin
  perform privado.exigir_brik(array['principal']);
  select * into g from public.gimnasios where id = p_gimnasio_id;
  if not found then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  if g.borrado_en is not null then raise exception 'Ese gimnasio ya fue borrado' using errcode = '22023'; end if;
  if g.baja_en is null or g.baja_en > now() - interval '30 days' then raise exception 'Primero tiene que estar dado de baja hace más de 30 días' using errcode = '22023'; end if;
  if btrim(coalesce(p_nombre, '')) <> g.nombre then raise exception 'Escribí el nombre del gimnasio exactamente como figura: %', g.nombre using errcode = '22023'; end if;
  update public.socios set nombre = 'Socio borrado', apellido = '', dni = null, telefono = null, email = null, fecha_nacimiento = null, foto_path = null, usuario_id = null,
         contacto_emergencia_nombre = null, contacto_emergencia_telefono = null, notas = null,
         dado_de_baja_en = coalesce(dado_de_baja_en, now()), motivo_baja = coalesce(motivo_baja, 'otro')
   where gimnasio_id = p_gimnasio_id;
  get diagnostics n_socios = row_count;
  update public.equipo set activo = false, nombre = 'Equipo borrado', usuario_id = null where gimnasio_id = p_gimnasio_id;
  get diagnostics n_equipo = row_count;
  delete from public.dominios_gimnasio where gimnasio_id = p_gimnasio_id;
  update public.landing_gimnasio set publicada = false where gimnasio_id = p_gimnasio_id;
  update public.gimnasios set nombre = 'Gimnasio borrado', slug = 'borrado-' || substr(md5(id::text), 1, 12), borrado_en = now() where id = p_gimnasio_id;
  perform privado.registrar_brik('borrar_definitivo', p_gimnasio_id, jsonb_build_object('nombre', g.nombre, 'socios', n_socios, 'equipo', n_equipo));
  return jsonb_build_object('socios', n_socios, 'equipo', n_equipo);
end $$;

-- ── Webhooks fallidos: leer uno para reprocesarlo a pedido ──────────
-- El reproceso corre en el servidor (clave de servicio) con la misma lógica idempotente del webhook (por pago y estado).
create or replace function public.admin_evento_webhook(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare w public.eventos_webhook;
begin
  perform privado.exigir_brik(array['principal', 'soporte']);
  select * into w from public.eventos_webhook where id = p_id;
  if not found then raise exception 'Ese aviso no existe' using errcode = 'P0002'; end if;
  if w.origen <> 'mp_cobros' or w.gimnasio_id is null then raise exception 'Solo se reprocesan los cobros de MercadoPago de un gimnasio' using errcode = '22023'; end if;
  if w.error is null or w.procesado_en is not null then raise exception 'Ese aviso no está fallido' using errcode = '22023'; end if;
  perform privado.registrar_brik('reprocesar_webhook', w.gimnasio_id, jsonb_build_object('evento_id', w.id, 'id_externo', w.id_externo));
  return jsonb_build_object('evento_id', w.id, 'gimnasio_id', w.gimnasio_id, 'id_externo', w.id_externo, 'payload', w.payload);
end $$;

-- ── Permisos de lo nuevo ────────────────────────────────────────────
revoke execute on function public.admin_guardar_prueba(uuid, int), public.admin_guardar_descuento(uuid, numeric, text, date), public.admin_quitar_descuento(uuid),
  public.admin_guardar_link_pago(text), public.admin_link_pago(),
  public.admin_publicar_novedad(text, text, text, text, text, text), public.admin_novedades(), public.novedades_dueno(uuid), public.novedades_historial(uuid, int),
  public.admin_programar_mantenimiento(timestamptz, timestamptz, text), public.admin_cancelar_mantenimiento(uuid), public.admin_mantenimientos(), public.mantenimiento_vigente(),
  public.admin_plataforma_estado(), public.admin_uso_gimnasios(), public.admin_prender_funcion(uuid, text, boolean), public.admin_funciones_prueba(), public.funcion_prendida(uuid, text),
  public.admin_papelera(uuid), public.admin_restaurar_socio(uuid, uuid), public.admin_restaurar_plan(uuid, uuid), public.admin_clonar_configuracion(uuid, uuid),
  public.admin_borrar_definitivo(uuid, text), public.admin_evento_webhook(uuid) from public, anon;
grant execute on function public.admin_guardar_prueba(uuid, int), public.admin_guardar_descuento(uuid, numeric, text, date), public.admin_quitar_descuento(uuid),
  public.admin_guardar_link_pago(text), public.admin_link_pago(),
  public.admin_publicar_novedad(text, text, text, text, text, text), public.admin_novedades(), public.novedades_dueno(uuid), public.novedades_historial(uuid, int),
  public.admin_programar_mantenimiento(timestamptz, timestamptz, text), public.admin_cancelar_mantenimiento(uuid), public.admin_mantenimientos(),
  public.admin_plataforma_estado(), public.admin_uso_gimnasios(), public.admin_prender_funcion(uuid, text, boolean), public.admin_funciones_prueba(), public.funcion_prendida(uuid, text),
  public.admin_papelera(uuid), public.admin_restaurar_socio(uuid, uuid), public.admin_restaurar_plan(uuid, uuid), public.admin_clonar_configuracion(uuid, uuid),
  public.admin_borrar_definitivo(uuid, text), public.admin_evento_webhook(uuid) to authenticated;
-- El aviso de mantenimiento lo ve cualquier panel (también la pantalla de ingreso).
grant execute on function public.mantenimiento_vigente() to anon, authenticated;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['admin_guardar_prueba(uuid,integer)', 'admin_guardar_descuento(uuid,numeric,text,date)', 'admin_quitar_descuento(uuid)', 'admin_guardar_link_pago(text)',
      'admin_link_pago()', 'admin_publicar_novedad(text,text,text,text,text,text)', 'novedades_historial(uuid,integer)', 'admin_programar_mantenimiento(timestamp with time zone,timestamp with time zone,text)',
      'admin_cancelar_mantenimiento(uuid)', 'admin_mantenimientos()', 'mantenimiento_vigente()', 'admin_plataforma_estado()', 'admin_uso_gimnasios()', 'admin_prender_funcion(uuid,text,boolean)',
      'admin_funciones_prueba()', 'funcion_prendida(uuid,text)', 'admin_papelera(uuid)', 'admin_restaurar_socio(uuid,uuid)', 'admin_restaurar_plan(uuid,uuid)',
      'admin_clonar_configuracion(uuid,uuid)', 'admin_borrar_definitivo(uuid,text)', 'admin_evento_webhook(uuid)'] loop
    if to_regprocedure('public.' || f) is null then raise exception 'Falta public.%', f; end if;
  end loop;
  if to_regprocedure('public.admin_publicar_novedad(text,text,text)') is not null then raise exception 'Quedó la firma vieja de admin_publicar_novedad'; end if;
  if has_function_privilege('anon', 'public.admin_papelera(uuid)', 'execute') then raise exception 'anon puede ejecutar admin_papelera'; end if;
  foreach f in array array['avisos_mantenimiento', 'descuentos_brik', 'funciones_prueba'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || f)::regclass) then raise exception '% sin RLS', f; end if;
  end loop;
end $$;
