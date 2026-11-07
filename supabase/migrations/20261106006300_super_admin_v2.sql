-- 0163 · Super admin v2 (VD-40).
-- Lo que se suma para manejar muchos gimnasios (docs/v2/10-SUPER-ADMIN.md):
--   * Entrar como soporte pide MOTIVO (obligatorio), queda escrito quién, por qué y
--     cuándo, vence a los 60 minutos, y el dueño lo ve en su Control.
--       admin_entrar_gimnasio(gimnasio, motivo) · admin_salir_gimnasio(gimnasio)
--       estado_soporte(gimnasio) · soportes_del_gimnasio(gimnasio, limite) · admin_soportes(gimnasio)
--   * Salud de cada gimnasio con color (verde / amarillo / rojo) y orden "necesitan atención".
--       admin_salud_v2() · admin_uso_semanal(gimnasio) · admin_metricas()
--   * Ayuda del dueño a BRIK, con contexto (gimnasio, quién, pantalla y último error).
--       pedir_ayuda_brik(...) · admin_ayudas(pendientes) · admin_resolver_ayuda(id)
--   * Marca del gimnasio en el alta (colores) y notas internas de BRIK.
--       admin_guardar_marca(gimnasio, acento, fondo) · admin_notas(gimnasio) · admin_agregar_nota(gimnasio, texto)
-- No se redefine linea_de_control, campana*, vender, registrar_ingreso, panel_gimnasio ni landing_*.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.admin_salud_gimnasios()') is null then raise exception 'Guarda: falta la migración 0108 (salud)'; end if;
  if to_regprocedure('public.admin_abonos()') is null then raise exception 'Guarda: falta la migración 0110 (abono)'; end if;
  if to_regprocedure('public.admin_entrar_gimnasio(uuid)') is null
     and to_regprocedure('public.admin_entrar_gimnasio(uuid, text)') is null then raise exception 'Guarda: falta admin_entrar_gimnasio'; end if;
  if to_regprocedure('privado.hecho_inmutable()') is null then raise exception 'Guarda: falta privado.hecho_inmutable'; end if;
end $$;

-- ── Tablas ──────────────────────────────────────────────────────────
-- Cada entrada de soporte a un gimnasio: quién, por qué y cuándo. Solo se cierra (salio_en); no se borra ni se edita.
create table if not exists public.soportes_gimnasio (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  usuario_id   uuid not null references auth.users(id),
  motivo       text not null check (length(btrim(motivo)) between 5 and 300),
  entro_en     timestamptz not null default now(),
  vence_en     timestamptz not null default now() + interval '60 minutes',
  salio_en     timestamptz,
  unique (gimnasio_id, id)
);
create index if not exists soportes_gimnasio_por_gimnasio on public.soportes_gimnasio (gimnasio_id, entro_en desc);
alter table public.soportes_gimnasio enable row level security;
revoke all on table public.soportes_gimnasio from anon, authenticated;
drop trigger if exists soportes_gimnasio_inmutable on public.soportes_gimnasio;
create trigger soportes_gimnasio_inmutable before update or delete on public.soportes_gimnasio
  for each row execute function privado.hecho_inmutable('salio_en');

-- Los pedidos de ayuda del dueño a BRIK, con el contexto de dónde estaba.
create table if not exists public.ayudas_brik (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  equipo_id     uuid not null,
  usuario_id    uuid not null references auth.users(id),
  mensaje       text not null check (length(btrim(mensaje)) between 5 and 1000),
  pantalla      text check (pantalla is null or length(pantalla) <= 200),
  ultimo_error  text check (ultimo_error is null or length(ultimo_error) <= 500),
  creado_en     timestamptz not null default now(),
  resuelta_en   timestamptz,
  resuelta_por  uuid references auth.users(id),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, equipo_id) references public.equipo (gimnasio_id, id),
  check ((resuelta_en is null) = (resuelta_por is null))
);
create index if not exists ayudas_brik_pendientes on public.ayudas_brik (creado_en desc) where resuelta_en is null;
alter table public.ayudas_brik enable row level security;
revoke all on table public.ayudas_brik from anon, authenticated;
drop trigger if exists ayudas_brik_inmutable on public.ayudas_brik;
create trigger ayudas_brik_inmutable before update or delete on public.ayudas_brik
  for each row execute function privado.hecho_inmutable('resuelta_en', 'resuelta_por');

-- Notas internas de BRIK sobre un gimnasio (el dueño no las ve).
create table if not exists public.notas_brik (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  texto        text not null check (length(btrim(texto)) between 1 and 1000),
  autor_id     uuid not null references auth.users(id),
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id)
);
alter table public.notas_brik enable row level security;
revoke all on table public.notas_brik from anon, authenticated;
drop trigger if exists notas_brik_inmutable on public.notas_brik;
create trigger notas_brik_inmutable before update or delete on public.notas_brik
  for each row execute function privado.hecho_inmutable();

-- ── Soporte: cerrar lo vencido ──────────────────────────────────────
-- A los 60 minutos el acceso de soporte se desactiva. No depende de un cron: se cierra cuando alguien
-- mira (el banner del panel, el Control del dueño, el listado del super admin).
create or replace function privado.cerrar_soportes_vencidos(p_gimnasio_id uuid default null) returns void
language plpgsql set search_path = '' as $$
begin
  with v as (
    update public.soportes_gimnasio s set salio_en = s.vence_en
     where s.salio_en is null and s.vence_en <= now() and (p_gimnasio_id is null or s.gimnasio_id = p_gimnasio_id)
    returning s.gimnasio_id, s.usuario_id)
  update public.equipo e set activo = false
    from v where e.gimnasio_id = v.gimnasio_id and e.usuario_id = v.usuario_id and e.es_soporte and e.activo;
end $$;
revoke all on function privado.cerrar_soportes_vencidos(uuid) from public;

-- ── Entrar y salir como soporte (con motivo) ────────────────────────
-- Cambia la firma: la versión sin motivo se borra acá mismo (dos versiones harían ambigua la llamada).
drop function if exists public.admin_entrar_gimnasio(uuid);
create or replace function public.admin_entrar_gimnasio(p_gimnasio_id uuid, p_motivo text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_slug text; e public.equipo; n int; v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if length(v_motivo) < 5 then raise exception 'Escribí el motivo de la entrada (al menos 5 letras): el dueño lo va a ver en su Control' using errcode = '22023'; end if;
  if length(v_motivo) > 300 then raise exception 'El motivo es muy largo (máximo 300 letras)' using errcode = '22023'; end if;
  select g.slug into v_slug from public.gimnasios g where g.id = p_gimnasio_id;
  if not found then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  select * into e from public.equipo where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid();
  if found then
    if not e.activo then
      if not e.es_soporte then
        raise exception 'Tu cuenta está en el equipo de este gimnasio pero desactivada por el dueño';
      end if;
      update public.equipo set activo = true where id = e.id;
      get diagnostics n = row_count;
      if n <> 1 then raise exception 'No se pudo reactivar el acceso de soporte'; end if;
    end if;
  else
    insert into public.equipo (gimnasio_id, usuario_id, nombre, rol, es_soporte)
    values (p_gimnasio_id, auth.uid(), 'Soporte BRIK', 'dueno', true);
  end if;
  -- Una entrada nueva cierra la anterior (si quedó abierta) y deja la suya escrita.
  update public.soportes_gimnasio set salio_en = now()
   where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and salio_en is null;
  insert into public.soportes_gimnasio (gimnasio_id, usuario_id, motivo) values (p_gimnasio_id, auth.uid(), v_motivo);
  return v_slug;
end $$;

create or replace function public.admin_salir_gimnasio(p_gimnasio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  update public.equipo set activo = false
   where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and es_soporte and activo;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No tenías acceso de soporte activo en este gimnasio'; end if;
  update public.soportes_gimnasio set salio_en = now()
   where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and salio_en is null;
end $$;

-- Para el banner: ¿estoy adentro como soporte? ¿por qué motivo? ¿cuánto me queda?
create or replace function public.estado_soporte(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.soportes_gimnasio;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  perform privado.cerrar_soportes_vencidos(p_gimnasio_id);
  select * into s from public.soportes_gimnasio
   where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and salio_en is null
   order by entro_en desc limit 1;
  if not found then return jsonb_build_object('activo', false); end if;
  return jsonb_build_object('activo', true, 'motivo', s.motivo, 'entro_en', s.entro_en, 'vence_en', s.vence_en,
    'minutos', greatest(0, ceil(extract(epoch from (s.vence_en - now())) / 60)::int));
end $$;

-- Lo que ve el dueño en su Control: cuándo entró BRIK y por qué (sin el mail de quien entró).
create or replace function public.soportes_del_gimnasio(p_gimnasio_id uuid, p_limite int default 20) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  perform privado.cerrar_soportes_vencidos(p_gimnasio_id);
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'motivo', x.motivo, 'entro_en', x.entro_en, 'vence_en', x.vence_en,
            'salio_en', x.salio_en, 'en_curso', x.salio_en is null) order by x.entro_en desc)
    from (select * from public.soportes_gimnasio s where s.gimnasio_id = p_gimnasio_id order by s.entro_en desc limit least(greatest(coalesce(p_limite, 20), 1), 100)) x), '[]'::jsonb);
end $$;

-- Lo que ve BRIK: quién entró (mail), por qué y cuándo.
create or replace function public.admin_soportes(p_gimnasio_id uuid, p_limite int default 20) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  perform privado.cerrar_soportes_vencidos(p_gimnasio_id);
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'quien', x.quien, 'motivo', x.motivo, 'entro_en', x.entro_en,
            'vence_en', x.vence_en, 'salio_en', x.salio_en, 'en_curso', x.salio_en is null) order by x.entro_en desc)
    from (select s.*, coalesce(u.email, 'sin mail') as quien from public.soportes_gimnasio s join auth.users u on u.id = s.usuario_id
           where s.gimnasio_id = p_gimnasio_id order by s.entro_en desc limit least(greatest(coalesce(p_limite, 20), 1), 100)) x), '[]'::jsonb);
end $$;

-- ── Salud de cada gimnasio, con color y orden ───────────────────────
-- rojo: abono vencido, suspendido, o con socios y nadie entró en 7 días.
-- amarillo: el equipo no entra hace 3+ días, el alta sin terminar, el abono por vencer, ayuda sin responder.
-- verde: todo lo demás. El demo va al final. Se calcula en el momento: no se guarda ningún "estado".
create or replace function public.admin_salud_v2() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r record; res jsonb := '{}'::jsonb; rojos text[]; amarillos text[]; color text; abono text; dias int; orden int;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  for r in
    select g.id, g.es_demo, g.creado_en, g.suspension_manual_en is not null as suspendido,
           (select max(u.last_sign_in_at) from public.equipo e join auth.users u on u.id = e.usuario_id
             where e.gimnasio_id = g.id and e.activo and not e.es_soporte) as ultimo,
           (select count(*)::int from public.socios s where s.gimnasio_id = g.id and s.dado_de_baja_en is null) as socios,
           (select count(*)::int from public.ventas v where v.gimnasio_id = g.id and v.estado = 'confirmada' and v.anulada_en is null and v.confirmada_en > now() - interval '7 days') as ventas,
           (select count(*)::int from public.ingresos i where i.gimnasio_id = g.id and i.anulado_en is null and i.resultado <> 'rechazado' and i.momento > now() - interval '7 days') as entradas,
           not exists (select 1 from public.equipo e where e.gimnasio_id = g.id and e.rol = 'dueno' and e.activo and not e.es_soporte and e.usuario_id is not null) as sin_dueno,
           (select count(*)::int from public.ayudas_brik a where a.gimnasio_id = g.id and a.resuelta_en is null) as ayudas
      from public.gimnasios g
  loop
    rojos := '{}'; amarillos := '{}';
    abono := privado.estado_abono(r.id) ->> 'estado';
    dias := case when r.ultimo is null then null else floor(extract(epoch from (now() - r.ultimo)) / 86400)::int end;
    if not r.es_demo then
      if abono = 'vencido' then rojos := array_append(rojos, 'Abono a BRIK vencido'::text); end if;
      if r.suspendido then rojos := array_append(rojos, 'Suspendido'::text); end if;
      if r.socios > 0 and r.entradas = 0 and r.creado_en < now() - interval '7 days' then rojos := array_append(rojos, 'Nadie entró en 7 días'::text); end if;
      if r.socios = 0 or r.sin_dueno then
        amarillos := array_append(amarillos, (case when r.sin_dueno then 'Alta sin terminar: el dueño no tiene acceso' else 'Alta sin terminar: todavía no tiene socios' end)::text);
      end if;
      if r.creado_en < now() - interval '3 days' and (r.ultimo is null or r.ultimo < now() - interval '3 days') and not r.sin_dueno then
        amarillos := array_append(amarillos, ('El equipo no entra al panel hace ' || coalesce(dias::text, 'mucho') || ' días')::text); end if;
      if abono = 'por_vencer' then amarillos := array_append(amarillos, 'El abono a BRIK está por vencer'::text); end if;
      if r.ayudas > 0 then amarillos := array_append(amarillos, (case when r.ayudas = 1 then 'Pidió ayuda y está sin responder' else r.ayudas::text || ' pedidos de ayuda sin responder' end)::text); end if;
    end if;
    color := case when r.es_demo then 'verde' when cardinality(rojos) > 0 then 'rojo' when cardinality(amarillos) > 0 then 'amarillo' else 'verde' end;
    orden := case when r.es_demo then 3 when color = 'rojo' then 0 when color = 'amarillo' then 1 else 2 end;
    res := res || jsonb_build_object(r.id::text, jsonb_build_object(
      'color', color, 'orden', orden, 'puntaje', cardinality(rojos) * 10 + cardinality(amarillos),
      'motivos', to_jsonb(rojos || amarillos),
      'ultimo_acceso_equipo', r.ultimo, 'ventas_7_dias', r.ventas, 'entradas_7_dias', r.entradas, 'ayudas_pendientes', r.ayudas,
      'abono', abono));
  end loop;
  return res;
end $$;

-- Uso de las últimas 4 semanas (entradas, ventas y socios nuevos), para la ficha.
create or replace function public.admin_uso_semanal(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('desde', w.d,
      'entradas', (select count(*)::int from public.ingresos i where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado'
                    and i.momento >= w.d::timestamptz and i.momento < (w.d + 7)::timestamptz),
      'ventas', (select count(*)::int from public.ventas v where v.gimnasio_id = p_gimnasio_id and v.estado = 'confirmada' and v.anulada_en is null
                  and v.confirmada_en >= w.d::timestamptz and v.confirmada_en < (w.d + 7)::timestamptz),
      'socios_nuevos', (select count(*)::int from public.socios s where s.gimnasio_id = p_gimnasio_id
                         and s.creado_en >= w.d::timestamptz and s.creado_en < (w.d + 7)::timestamptz)) order by w.d desc)
    from (select (date_trunc('week', now())::date - 7 * k) as d from generate_series(0, 3) k) w), '[]'::jsonb);
end $$;

-- ── Métricas de la plataforma ───────────────────────────────────────
create or replace function public.admin_metricas() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  select jsonb_build_object(
    'gimnasios', (select count(*)::int from public.gimnasios g where not g.es_demo),
    'activos_hoy', (select count(distinct e.gimnasio_id)::int from public.equipo e join public.gimnasios g on g.id = e.gimnasio_id
                     join auth.users u on u.id = e.usuario_id
                    where not g.es_demo and e.activo and not e.es_soporte and u.last_sign_in_at > now() - interval '24 hours'),
    'cobrado_mes', coalesce((select sum(p.monto) from public.plataforma_pagos p where p.anulado_en is null and p.creado_en >= date_trunc('month', now())), 0),
    'por_vencer', (select count(*)::int from public.gimnasios g where privado.estado_abono(g.id) ->> 'estado' = 'por_vencer'),
    'vencidos', (select count(*)::int from public.gimnasios g where privado.estado_abono(g.id) ->> 'estado' = 'vencido'),
    'nuevos_30_dias', (select count(*)::int from public.gimnasios g where not g.es_demo and g.creado_en > now() - interval '30 days'),
    'suspendidos', (select count(*)::int from public.gimnasios g where not g.es_demo and g.suspension_manual_en is not null),
    'ayudas_pendientes', (select count(*)::int from public.ayudas_brik a where a.resuelta_en is null),
    'entradas_por_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', d.dia, 'entradas',
          (select count(*)::int from public.ingresos i join public.gimnasios g on g.id = i.gimnasio_id
            where not g.es_demo and i.anulado_en is null and i.resultado <> 'rechazado'
              and (i.momento at time zone 'America/Argentina/Buenos_Aires')::date = d.dia)) order by d.dia)
          from (select (now() at time zone 'America/Argentina/Buenos_Aires')::date - k as dia from generate_series(0, 13) k) d), '[]'::jsonb),
    'abonos_por_mes', coalesce((select jsonb_agg(jsonb_build_object('mes', to_char(m.mes, 'YYYY-MM'),
          'monto', coalesce((select sum(p.monto) from public.plataforma_pagos p where p.anulado_en is null
                              and p.creado_en >= m.mes and p.creado_en < m.mes + interval '1 month'), 0)) order by m.mes)
          from (select (date_trunc('month', now()) - make_interval(months => k)) as mes from generate_series(0, 5) k) m), '[]'::jsonb)
  ) into r;
  return r;
end $$;

-- ── Ayuda del dueño a BRIK, con contexto ────────────────────────────
create or replace function public.pedir_ayuda_brik(p_gimnasio_id uuid, p_mensaje text, p_pantalla text default null, p_error text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; v_id uuid; v_msg text := btrim(coalesce(p_mensaje, ''));
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if e.es_soporte then raise exception 'Soporte BRIK no se pide ayuda a sí mismo' using errcode = '42501'; end if;
  if length(v_msg) < 5 then raise exception 'Contanos qué necesitás (al menos 5 letras)' using errcode = '22023'; end if;
  if length(v_msg) > 1000 then raise exception 'El mensaje es muy largo (máximo 1000 letras)' using errcode = '22023'; end if;
  if (select count(*) from public.ayudas_brik a where a.usuario_id = auth.uid() and a.creado_en > now() - interval '1 hour') >= 5 then
    raise exception 'Ya mandaste varios pedidos en la última hora: BRIK los está viendo' using errcode = '53400';
  end if;
  insert into public.ayudas_brik (gimnasio_id, equipo_id, usuario_id, mensaje, pantalla, ultimo_error)
  values (p_gimnasio_id, e.id, auth.uid(), v_msg, left(nullif(btrim(coalesce(p_pantalla, '')), ''), 200), left(nullif(btrim(coalesce(p_error, '')), ''), 500))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_ayudas(p_pendientes boolean default true) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'gimnasio_id', x.gimnasio_id, 'gimnasio', x.gimnasio, 'slug', x.slug,
            'quien', x.quien, 'rol', x.rol, 'mail', x.mail, 'mensaje', x.mensaje, 'pantalla', x.pantalla, 'ultimo_error', x.ultimo_error,
            'creado_en', x.creado_en, 'resuelta_en', x.resuelta_en) order by x.creado_en desc)
    from (select a.*, g.nombre as gimnasio, g.slug, e.nombre as quien, e.rol, u.email as mail
            from public.ayudas_brik a join public.gimnasios g on g.id = a.gimnasio_id
            join public.equipo e on e.gimnasio_id = a.gimnasio_id and e.id = a.equipo_id
            join auth.users u on u.id = a.usuario_id
           where (not coalesce(p_pendientes, true)) or a.resuelta_en is null
           order by a.creado_en desc limit 100) x), '[]'::jsonb);
end $$;

create or replace function public.admin_resolver_ayuda(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  update public.ayudas_brik set resuelta_en = now(), resuelta_por = auth.uid() where id = p_id and resuelta_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese pedido de ayuda ya estaba resuelto o no existe' using errcode = '22023'; end if;
end $$;

-- ── Marca en el alta y notas internas ───────────────────────────────
create or replace function public.admin_guardar_marca(p_gimnasio_id uuid, p_acento text, p_fondo text) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if p_acento !~ '^#[0-9a-fA-F]{6}$' or p_fondo !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Los colores tienen que ser como #16a34a' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set color_acento = lower(p_acento), color_fondo = lower(p_fondo) where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'El gimnasio no tiene configuración' using errcode = 'P0002'; end if;
end $$;

create or replace function public.admin_notas(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'texto', n.texto, 'autor', coalesce(u.email, 'sin mail'), 'creado_en', n.creado_en) order by n.creado_en desc)
    from public.notas_brik n join auth.users u on u.id = n.autor_id where n.gimnasio_id = p_gimnasio_id), '[]'::jsonb);
end $$;

create or replace function public.admin_agregar_nota(p_gimnasio_id uuid, p_texto text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if not exists (select 1 from public.gimnasios g where g.id = p_gimnasio_id) then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  if length(btrim(coalesce(p_texto, ''))) < 1 then raise exception 'Escribí la nota' using errcode = '22023'; end if;
  insert into public.notas_brik (gimnasio_id, texto, autor_id) values (p_gimnasio_id, btrim(p_texto), auth.uid()) returning id into v_id;
  return v_id;
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.admin_entrar_gimnasio(uuid, text), public.admin_salir_gimnasio(uuid), public.estado_soporte(uuid),
  public.soportes_del_gimnasio(uuid, int), public.admin_soportes(uuid, int), public.admin_salud_v2(), public.admin_uso_semanal(uuid),
  public.admin_metricas(), public.pedir_ayuda_brik(uuid, text, text, text), public.admin_ayudas(boolean), public.admin_resolver_ayuda(uuid),
  public.admin_guardar_marca(uuid, text, text), public.admin_notas(uuid), public.admin_agregar_nota(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_entrar_gimnasio(uuid, text), public.admin_salir_gimnasio(uuid), public.estado_soporte(uuid),
  public.soportes_del_gimnasio(uuid, int), public.admin_soportes(uuid, int), public.admin_salud_v2(), public.admin_uso_semanal(uuid),
  public.admin_metricas(), public.pedir_ayuda_brik(uuid, text, text, text), public.admin_ayudas(boolean), public.admin_resolver_ayuda(uuid),
  public.admin_guardar_marca(uuid, text, text), public.admin_notas(uuid), public.admin_agregar_nota(uuid, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text; t text;
begin
  foreach t in array array['soportes_gimnasio', 'ayudas_brik', 'notas_brik'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then raise exception 'Verificación: % sin RLS', t; end if;
    if has_table_privilege('authenticated', 'public.' || t, 'select') or has_table_privilege('anon', 'public.' || t, 'select') then
      raise exception 'Verificación: % se puede leer directo', t; end if;
  end loop;
  foreach f in array array['public.admin_entrar_gimnasio(uuid, text)', 'public.admin_salir_gimnasio(uuid)', 'public.estado_soporte(uuid)',
      'public.soportes_del_gimnasio(uuid, int)', 'public.admin_soportes(uuid, int)', 'public.admin_salud_v2()', 'public.admin_uso_semanal(uuid)',
      'public.admin_metricas()', 'public.pedir_ayuda_brik(uuid, text, text, text)', 'public.admin_ayudas(boolean)', 'public.admin_resolver_ayuda(uuid)',
      'public.admin_guardar_marca(uuid, text, text)', 'public.admin_notas(uuid)', 'public.admin_agregar_nota(uuid, text)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if to_regprocedure('public.admin_entrar_gimnasio(uuid)') is not null then raise exception 'Verificación: quedó la entrada de soporte sin motivo'; end if;
end $$;
