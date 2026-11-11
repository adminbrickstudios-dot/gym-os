-- Carril B · Super admin, fase 2 (F2.1 a F2.5 de RECTA-FINAL).
--   * registro_brik: lo que hace cada usuario de BRIK. Solo se agrega, nadie lo borra ni lo edita.
--   * Entrar como soporte con ROL (dueño, recepción o profe) y motivo: admin_entrar_gimnasio(gimnasio, motivo, rol).
--   * Buscar a cualquiera en todos los gimnasios, con motivo y registro: admin_buscar_persona.
--   * Lista de gimnasios con filtros y favoritos: admin_lista_gimnasios, admin_marcar_favorito.
--   * Tablero con "necesitan atención": admin_tablero.
--   * Ficha: admin_ficha_extra (integraciones, errores, registro), admin_cambiar_dueno,
--     admin_guardar_modulos, admin_cambiar_slug.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.admin_entrar_gimnasio(uuid, text)') is null then raise exception 'Guarda: falta admin_entrar_gimnasio(uuid, text)'; end if;
  if to_regprocedure('public.admin_salud_v2()') is null then raise exception 'Guarda: falta admin_salud_v2'; end if;
  if to_regprocedure('privado.estado_abono(uuid)') is null then raise exception 'Guarda: falta privado.estado_abono'; end if;
  if to_regprocedure('privado.hecho_inmutable()') is null then raise exception 'Guarda: falta privado.hecho_inmutable'; end if;
  if to_regprocedure('privado.cerrar_soportes_vencidos(uuid)') is null then raise exception 'Guarda: falta privado.cerrar_soportes_vencidos'; end if;
end $$;

-- ── Registro de lo que hace BRIK (solo se agrega) ───────────────────
create table if not exists public.registro_brik (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references auth.users(id),
  accion       text not null check (length(accion) between 2 and 80),
  gimnasio_id  uuid references public.gimnasios(id),
  detalle      jsonb not null default '{}'::jsonb,
  creado_en    timestamptz not null default now()
);
create index if not exists registro_brik_por_gimnasio on public.registro_brik (gimnasio_id, creado_en desc);
create index if not exists registro_brik_por_fecha on public.registro_brik (creado_en desc);
alter table public.registro_brik enable row level security;
revoke all on table public.registro_brik from anon, authenticated;
drop trigger if exists registro_brik_inmutable on public.registro_brik;
create trigger registro_brik_inmutable before update or delete on public.registro_brik
  for each row execute function privado.hecho_inmutable('_ninguna'); -- con un argumento: sin argumentos la función no frena el UPDATE

create or replace function privado.registrar_brik(p_accion text, p_gimnasio_id uuid, p_detalle jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.registro_brik (usuario_id, accion, gimnasio_id, detalle) values (auth.uid(), p_accion, p_gimnasio_id, coalesce(p_detalle, '{}'::jsonb));
end $$;
revoke all on function privado.registrar_brik(text, uuid, jsonb) from public;

-- Favoritos de cada usuario de BRIK (arriba en la lista).
create table if not exists public.favoritos_brik (
  usuario_id   uuid not null references auth.users(id),
  gimnasio_id  uuid not null references public.gimnasios(id),
  creado_en    timestamptz not null default now(),
  primary key (usuario_id, gimnasio_id)
);
alter table public.favoritos_brik enable row level security;
revoke all on table public.favoritos_brik from anon, authenticated;

-- ── Soporte con rol ─────────────────────────────────────────────────
alter table public.soportes_gimnasio add column if not exists rol text not null default 'dueno';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'soportes_gimnasio_rol_valido') then
    alter table public.soportes_gimnasio add constraint soportes_gimnasio_rol_valido check (rol in ('dueno', 'recepcion', 'profe'));
  end if;
end $$;

-- La firma vieja se borra: con dos versiones con defaults la llamada queda ambigua.
drop function if exists public.admin_entrar_gimnasio(uuid, text);
create or replace function public.admin_entrar_gimnasio(p_gimnasio_id uuid, p_motivo text, p_rol text default 'dueno') returns text
language plpgsql security definer set search_path = '' as $$
declare v_slug text; e public.equipo; n int; v_motivo text := btrim(coalesce(p_motivo, '')); v_rol text := coalesce(nullif(btrim(p_rol), ''), 'dueno');
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if v_rol not in ('dueno', 'recepcion', 'profe') then raise exception 'Elegí con qué rol entrar: dueño, recepción o profe' using errcode = '22023'; end if;
  if length(v_motivo) < 5 then raise exception 'Escribí el motivo de la entrada (al menos 5 letras): el dueño lo va a ver en su Control' using errcode = '22023'; end if;
  if length(v_motivo) > 300 then raise exception 'El motivo es muy largo (máximo 300 letras)' using errcode = '22023'; end if;
  select g.slug into v_slug from public.gimnasios g where g.id = p_gimnasio_id;
  if not found then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  select * into e from public.equipo where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid();
  if found then
    if not e.es_soporte then
      raise exception 'Tu cuenta es parte del equipo de este gimnasio: entrá con ella, no como soporte';
    end if;
    update public.equipo set activo = true, rol = v_rol where id = e.id;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo activar el acceso de soporte'; end if;
  else
    insert into public.equipo (gimnasio_id, usuario_id, nombre, rol, es_soporte)
    values (p_gimnasio_id, auth.uid(), 'Soporte BRIK', v_rol, true);
  end if;
  update public.soportes_gimnasio set salio_en = now()
   where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and salio_en is null;
  insert into public.soportes_gimnasio (gimnasio_id, usuario_id, motivo, rol) values (p_gimnasio_id, auth.uid(), v_motivo, v_rol);
  perform privado.registrar_brik('entrar_como_soporte', p_gimnasio_id, jsonb_build_object('rol', v_rol, 'motivo', v_motivo));
  return v_slug;
end $$;
revoke execute on function public.admin_entrar_gimnasio(uuid, text, text) from public, anon;
grant execute on function public.admin_entrar_gimnasio(uuid, text, text) to authenticated;

-- El dueño ve con qué rol entró BRIK (sin el mail).
create or replace function public.soportes_del_gimnasio(p_gimnasio_id uuid, p_limite int default 20) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  perform privado.cerrar_soportes_vencidos(p_gimnasio_id);
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'motivo', x.motivo, 'rol', x.rol, 'entro_en', x.entro_en, 'vence_en', x.vence_en,
            'salio_en', x.salio_en, 'en_curso', x.salio_en is null) order by x.entro_en desc)
    from (select * from public.soportes_gimnasio s where s.gimnasio_id = p_gimnasio_id order by s.entro_en desc limit least(greatest(coalesce(p_limite, 20), 1), 100)) x), '[]'::jsonb);
end $$;
revoke execute on function public.soportes_del_gimnasio(uuid, int) from public, anon;
grant execute on function public.soportes_del_gimnasio(uuid, int) to authenticated;

create or replace function public.admin_soportes(p_gimnasio_id uuid, p_limite int default 20) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  perform privado.cerrar_soportes_vencidos(p_gimnasio_id);
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'quien', x.quien, 'motivo', x.motivo, 'rol', x.rol, 'entro_en', x.entro_en,
            'vence_en', x.vence_en, 'salio_en', x.salio_en, 'en_curso', x.salio_en is null) order by x.entro_en desc)
    from (select s.*, coalesce(u.email, 'sin mail') as quien from public.soportes_gimnasio s join auth.users u on u.id = s.usuario_id
           where s.gimnasio_id = p_gimnasio_id order by s.entro_en desc limit least(greatest(coalesce(p_limite, 20), 1), 100)) x), '[]'::jsonb);
end $$;
revoke execute on function public.admin_soportes(uuid, int) from public, anon;
grant execute on function public.admin_soportes(uuid, int) to authenticated;

-- ── SA-5 · Buscar a cualquiera en todos los gimnasios ───────────────
-- Pide motivo y deja registro. Devuelve solo nombre, gimnasio y rol (nunca el DNI, mail ni teléfono).
create or replace function public.admin_buscar_persona(p_q text, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_q text := btrim(coalesce(p_q, '')); v_motivo text := btrim(coalesce(p_motivo, '')); v_digitos text; v_res jsonb;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if length(v_q) < 4 then raise exception 'Escribí al menos 4 caracteres: mail, DNI o teléfono' using errcode = '22023'; end if;
  if length(v_motivo) < 5 then raise exception 'Escribí el motivo de la búsqueda (al menos 5 letras): queda registrado' using errcode = '22023'; end if;
  v_digitos := regexp_replace(v_q, '[^0-9]', '', 'g');
  select coalesce(jsonb_agg(x order by x ->> 'nombre'), '[]'::jsonb) into v_res from (
    select jsonb_build_object('tipo', 'socio', 'rol', 'socio', 'nombre', btrim(s.nombre || ' ' || s.apellido), 'gimnasio_id', g.id, 'gimnasio', g.nombre, 'slug', g.slug,
                              'persona_id', s.id, 'baja', s.dado_de_baja_en is not null) as x
      from public.socios s join public.gimnasios g on g.id = s.gimnasio_id
     where (position('@' in v_q) > 0 and lower(s.email) = lower(v_q))
        or (length(v_digitos) >= 6 and (s.dni = v_digitos or right(regexp_replace(coalesce(s.telefono, ''), '[^0-9]', '', 'g'), length(v_digitos)) = v_digitos))
    union all
    select jsonb_build_object('tipo', 'equipo', 'rol', e.rol, 'nombre', e.nombre, 'gimnasio_id', g.id, 'gimnasio', g.nombre, 'slug', g.slug,
                              'persona_id', e.id, 'baja', not e.activo)
      from public.equipo e join public.gimnasios g on g.id = e.gimnasio_id join auth.users u on u.id = e.usuario_id
     where not e.es_soporte and position('@' in v_q) > 0 and lower(u.email) = lower(v_q)
     limit 30
  ) t;
  -- Se guarda qué se buscó (no el resultado): quién, cuándo, por qué y cuántos encontró.
  perform privado.registrar_brik('buscar_persona', null, jsonb_build_object('busqueda', v_q, 'motivo', v_motivo, 'encontrados', jsonb_array_length(v_res)));
  return v_res;
end $$;
revoke execute on function public.admin_buscar_persona(text, text) from public, anon;
grant execute on function public.admin_buscar_persona(text, text) to authenticated;

-- ── SA-2 · La lista de gimnasios con filtros ────────────────────────
create or replace function public.admin_marcar_favorito(p_gimnasio_id uuid, p_favorito boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if not exists (select 1 from public.gimnasios where id = p_gimnasio_id) then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  if coalesce(p_favorito, true) then
    insert into public.favoritos_brik (usuario_id, gimnasio_id) values (auth.uid(), p_gimnasio_id) on conflict do nothing;
  else
    delete from public.favoritos_brik where usuario_id = auth.uid() and gimnasio_id = p_gimnasio_id;
  end if;
end $$;
revoke execute on function public.admin_marcar_favorito(uuid, boolean) from public, anon;
grant execute on function public.admin_marcar_favorito(uuid, boolean) to authenticated;

-- Filtros (todos opcionales): texto (nombre, slug, dominio, dueño, mail o teléfono del dueño), salud, abono, plan, alta desde/hasta.
create or replace function public.admin_lista_gimnasios(p_q text default null, p_salud text default null, p_abono text default null,
                                                       p_plan text default null, p_alta_desde date default null, p_alta_hasta date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare salud jsonb; v_q text := lower(btrim(coalesce(p_q, ''))); v_res jsonb;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if p_salud is not null and p_salud not in ('verde', 'amarillo', 'rojo') then raise exception 'Salud: verde, amarillo o rojo' using errcode = '22023'; end if;
  if p_abono is not null and p_abono not in ('al_dia', 'por_vencer', 'vencido', 'sin_abono') then raise exception 'Abono: al_dia, por_vencer, vencido o sin_abono' using errcode = '22023'; end if;
  salud := public.admin_salud_v2();
  select coalesce(jsonb_agg(f.fila order by f.favorito desc, f.orden, f.nombre), '[]'::jsonb) into v_res from (
    select r.nombre, r.favorito, coalesce((salud -> r.id::text ->> 'orden')::int, 2) as orden,
           jsonb_build_object('gimnasio_id', r.id, 'slug', r.slug, 'nombre', r.nombre, 'es_demo', r.es_demo, 'alta', r.creado_en, 'favorito', r.favorito,
             'suspendido', r.suspendido, 'socios_activos', r.socios, 'entradas_hoy', r.entradas_hoy, 'ultimo_uso', r.ultimo_uso,
             'abono', r.abono -> 'estado', 'plan', r.abono -> 'plan', 'color', salud -> r.id::text -> 'color', 'motivos', salud -> r.id::text -> 'motivos',
             'dueno', r.dueno, 'dueno_telefono', r.dueno_telefono, 'hosts', r.hosts) as fila
      from (
        select g.id, g.slug, g.nombre, g.es_demo, g.creado_en, g.suspension_manual_en is not null as suspendido,
               exists (select 1 from public.favoritos_brik f where f.usuario_id = auth.uid() and f.gimnasio_id = g.id) as favorito,
               (select count(*)::int from public.socios s where s.gimnasio_id = g.id and s.dado_de_baja_en is null) as socios,
               (select count(*)::int from public.ingresos i where i.gimnasio_id = g.id and i.anulado_en is null and i.resultado <> 'rechazado'
                   and privado.dia_local(i.momento, g.zona_horaria) = privado.dia_local(now(), g.zona_horaria)) as entradas_hoy,
               (select max(u.last_sign_in_at) from public.equipo e join auth.users u on u.id = e.usuario_id
                 where e.gimnasio_id = g.id and e.activo and not e.es_soporte) as ultimo_uso,
               privado.estado_abono(g.id) as abono,
               (select e.nombre from public.equipo e where e.gimnasio_id = g.id and e.rol = 'dueno' and e.activo and not e.es_soporte order by e.creado_en limit 1) as dueno,
               (select u.email from public.equipo e join auth.users u on u.id = e.usuario_id where e.gimnasio_id = g.id and e.rol = 'dueno' and e.activo and not e.es_soporte order by e.creado_en limit 1) as dueno_mail,
               (select u.phone from public.equipo e join auth.users u on u.id = e.usuario_id where e.gimnasio_id = g.id and e.rol = 'dueno' and e.activo and not e.es_soporte order by e.creado_en limit 1) as dueno_telefono,
               array(select d.host from public.dominios_gimnasio d where d.gimnasio_id = g.id order by d.tipo desc, d.host) as hosts
          from public.gimnasios g
      ) r
     where (v_q = '' or lower(r.nombre || ' ' || r.slug || ' ' || coalesce(r.dueno, '') || ' ' || coalesce(r.dueno_mail, '') || ' ' || coalesce(r.dueno_telefono, '') || ' ' || array_to_string(r.hosts, ' ')) like '%' || v_q || '%')
       and (p_salud is null or salud -> r.id::text ->> 'color' = p_salud)
       and (p_abono is null or r.abono ->> 'estado' = p_abono)
       and (p_plan is null or lower(r.abono ->> 'plan') = lower(p_plan))
       and (p_alta_desde is null or r.creado_en >= p_alta_desde::timestamptz)
       and (p_alta_hasta is null or r.creado_en < (p_alta_hasta + 1)::timestamptz)
  ) f;
  return v_res;
end $$;
revoke execute on function public.admin_lista_gimnasios(text, text, text, text, date, date) from public, anon;
grant execute on function public.admin_lista_gimnasios(text, text, text, text, date, date) to authenticated;

-- ── SA-1 · El tablero ───────────────────────────────────────────────
-- Cada número lleva a su lista (clave "lista": filtro que entiende /admin/gimnasios).
create or replace function public.admin_tablero() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare salud jsonb; m jsonb; atencion jsonb; vivo jsonb; hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  salud := public.admin_salud_v2();
  m := public.admin_metricas();
  select coalesce(jsonb_agg(a order by (a ->> 'orden')::int, a ->> 'nombre'), '[]'::jsonb) into atencion from (
    -- los motivos de salud (abono vencido, nadie entró, alta sin terminar, etc.)
    select jsonb_build_object('gimnasio_id', g.id, 'nombre', g.nombre, 'tipo', 'salud', 'motivo', mot.m, 'orden', (salud -> g.id::text ->> 'orden')::int,
             'boton', case when mot.m like 'Abono%' or mot.m like 'El abono%' then 'Ver el abono' when mot.m like 'Alta sin terminar%' then 'Terminar el alta' when mot.m like 'Pidió%' or mot.m like '%pedidos de ayuda%' then 'Responder' else 'Abrir la ficha' end) as a
      from public.gimnasios g, jsonb_array_elements_text(salud -> g.id::text -> 'motivos') mot(m)
     where not g.es_demo
    union all
    select jsonb_build_object('gimnasio_id', g.id, 'nombre', g.nombre, 'tipo', 'webhooks', 'orden', 0, 'boton', 'Ver integraciones',
             'motivo', c.n || (case when c.n = 1 then ' aviso de MercadoPago falló' else ' avisos de MercadoPago fallaron' end) || ' en 24 h')
      from public.gimnasios g join lateral (select count(*)::int n from public.eventos_webhook w where w.gimnasio_id = g.id and w.error is not null and w.procesado_en is null
                                              and w.recibido_en > now() - interval '24 hours') c on c.n > 0
     where not g.es_demo
    union all
    select jsonb_build_object('gimnasio_id', g.id, 'nombre', g.nombre, 'tipo', 'caja', 'orden', 1, 'boton', 'Abrir la ficha',
             'motivo', 'Hay una caja sin cerrar hace ' || c.dias || ' días')
      from public.gimnasios g join lateral (select (max(extract(day from now() - t.abierto_en)))::int dias from public.turnos_caja t
                                              where t.gimnasio_id = g.id and t.cerrado_en is null and t.abierto_en < now() - interval '2 days') c on c.dias is not null
     where not g.es_demo
  ) x;
  select coalesce(jsonb_agg(v order by v ->> 'cuando' desc), '[]'::jsonb) into vivo from (
    select * from (
      select jsonb_build_object('tipo', 'gimnasio_nuevo', 'texto', 'Gimnasio nuevo: ' || g.nombre, 'cuando', g.creado_en, 'gimnasio_id', g.id) v
        from public.gimnasios g where not g.es_demo and g.creado_en > now() - interval '7 days'
      union all
      select jsonb_build_object('tipo', 'ayuda', 'texto', 'Ayuda nueva de ' || g.nombre, 'cuando', a.creado_en, 'gimnasio_id', g.id)
        from public.ayudas_brik a join public.gimnasios g on g.id = a.gimnasio_id where a.creado_en > now() - interval '7 days'
      union all
      select jsonb_build_object('tipo', 'primer_cobro', 'texto', 'Primer cobro de ' || g.nombre, 'cuando', p.primero, 'gimnasio_id', g.id)
        from public.gimnasios g join lateral (select min(v.confirmada_en) primero from public.ventas v where v.gimnasio_id = g.id and v.estado = 'confirmada' and v.anulada_en is null) p
          on p.primero > now() - interval '7 days'
       where not g.es_demo
    ) u order by u.v ->> 'cuando' desc limit 15
  ) z;
  return jsonb_build_object(
    'numeros', jsonb_build_object(
      'activos_hoy', jsonb_build_object('valor', m -> 'activos_hoy', 'lista', 'activos'),
      'entradas_hoy', jsonb_build_object('valor', (select count(*)::int from public.ingresos i join public.gimnasios g on g.id = i.gimnasio_id
                                                      where not g.es_demo and i.anulado_en is null and i.resultado <> 'rechazado'
                                                        and (i.momento at time zone 'America/Argentina/Buenos_Aires')::date = hoy), 'lista', 'activos'),
      'cobrado_hoy', jsonb_build_object('valor', coalesce((select sum(p.monto) from public.pagos p join public.gimnasios g on g.id = p.gimnasio_id
                                                             where not g.es_demo and p.estado = 'aprobado'
                                                               and (p.aprobado_en at time zone 'America/Argentina/Buenos_Aires')::date = hoy), 0), 'lista', 'activos'),
      'ingreso_mensual_brik', jsonb_build_object('valor', m -> 'cobrado_mes', 'lista', 'al_dia'),
      'abonos_por_vencer', jsonb_build_object('valor', m -> 'por_vencer', 'lista', 'por_vencer'),
      'abonos_vencidos', jsonb_build_object('valor', m -> 'vencidos', 'lista', 'vencido'),
      'ayudas_sin_responder', jsonb_build_object('valor', m -> 'ayudas_pendientes', 'lista', 'ayudas')),
    'necesitan_atencion', atencion,
    'actividad', vivo);
end $$;
revoke execute on function public.admin_tablero() from public, anon;
grant execute on function public.admin_tablero() to authenticated;

-- ── SA-3 · La ficha: lo que faltaba ─────────────────────────────────
-- Integraciones (webhooks fallidos, sin mostrar claves), errores y registro de ese gimnasio.
create or replace function public.admin_ficha_extra(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g public.gimnasios; c public.configuracion_gimnasio;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  select * into g from public.gimnasios where id = p_gimnasio_id;
  if not found then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  return jsonb_build_object(
    'zona_horaria', g.zona_horaria,
    'secciones_apagadas', to_jsonb(coalesce(c.secciones_apagadas, '{}'::text[])),
    'secciones_validas', to_jsonb(privado.secciones_validas()),
    'ultimo_webhook', (select max(w.recibido_en) from public.eventos_webhook w where w.gimnasio_id = p_gimnasio_id),
    'webhooks_fallidos', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'tipo', w.tipo, 'recibido_en', w.recibido_en, 'intentos', w.intentos, 'error', left(w.error, 200)) order by w.recibido_en desc)
        from (select * from public.eventos_webhook w2 where w2.gimnasio_id = p_gimnasio_id and w2.error is not null and w2.procesado_en is null order by w2.recibido_en desc limit 20) w), '[]'::jsonb),
    'registro', coalesce((select jsonb_agg(jsonb_build_object('accion', r.accion, 'quien', coalesce(u.email, 'sin mail'), 'detalle', r.detalle, 'cuando', r.creado_en) order by r.creado_en desc)
        from (select * from public.registro_brik r2 where r2.gimnasio_id = p_gimnasio_id order by r2.creado_en desc limit 50) r left join auth.users u on u.id = r.usuario_id), '[]'::jsonb));
end $$;
revoke execute on function public.admin_ficha_extra(uuid) from public, anon;
grant execute on function public.admin_ficha_extra(uuid) to authenticated;

-- Cambiar quién es el dueño: el nuevo pasa a dueño y el anterior queda como encargado (nadie pierde el acceso).
create or replace function public.admin_cambiar_dueno(p_gimnasio_id uuid, p_equipo_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare nuevo public.equipo; n int;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  select * into nuevo from public.equipo where id = p_equipo_id and gimnasio_id = p_gimnasio_id;
  if not found then raise exception 'Esa persona no es del equipo de este gimnasio' using errcode = 'P0002'; end if;
  if nuevo.es_soporte then raise exception 'Esa cuenta es de BRIK: no puede ser la dueña' using errcode = '22023'; end if;
  if not nuevo.activo then raise exception 'Esa persona está desactivada: activala primero' using errcode = '22023'; end if;
  if nuevo.rol = 'dueno' then raise exception 'Ya es el dueño' using errcode = '22023'; end if;
  update public.equipo set rol = 'encargado' where gimnasio_id = p_gimnasio_id and rol = 'dueno' and not es_soporte and id <> p_equipo_id;
  update public.equipo set rol = 'dueno' where id = p_equipo_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo cambiar el dueño'; end if;
  perform privado.registrar_brik('cambiar_dueno', p_gimnasio_id, jsonb_build_object('equipo_id', p_equipo_id, 'nombre', nuevo.nombre));
end $$;
revoke execute on function public.admin_cambiar_dueno(uuid, uuid) from public, anon;
grant execute on function public.admin_cambiar_dueno(uuid, uuid) to authenticated;

-- Prender y apagar secciones (Clases, Caja, etc.) de un gimnasio.
create or replace function public.admin_guardar_modulos(p_gimnasio_id uuid, p_apagadas text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare n int; v text[] := coalesce(p_apagadas, '{}'::text[]);
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if not (v <@ privado.secciones_validas()) then raise exception 'Hay una sección que no existe' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set secciones_apagadas = v where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar: el gimnasio no tiene configuración' using errcode = 'P0002'; end if;
  perform privado.registrar_brik('guardar_modulos', p_gimnasio_id, jsonb_build_object('apagadas', to_jsonb(v)));
end $$;
revoke execute on function public.admin_guardar_modulos(uuid, text[]) from public, anon;
grant execute on function public.admin_guardar_modulos(uuid, text[]) to authenticated;

-- Cambiar el slug (cambia los links: el aviso va en la pantalla).
create or replace function public.admin_cambiar_slug(p_gimnasio_id uuid, p_slug text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := lower(btrim(coalesce(p_slug, ''))); n int; viejo text;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  if v !~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$' then raise exception 'El slug: letras minúsculas, números y guiones (hasta 40)' using errcode = '22023'; end if;
  select slug into viejo from public.gimnasios where id = p_gimnasio_id;
  if not found then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  if exists (select 1 from public.gimnasios where slug = v and id <> p_gimnasio_id) then raise exception 'Ese slug ya lo usa otro gimnasio' using errcode = '23505'; end if;
  update public.gimnasios set slug = v where id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo cambiar el slug'; end if;
  perform privado.registrar_brik('cambiar_slug', p_gimnasio_id, jsonb_build_object('de', viejo, 'a', v));
end $$;
revoke execute on function public.admin_cambiar_slug(uuid, text) from public, anon;
grant execute on function public.admin_cambiar_slug(uuid, text) to authenticated;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['admin_buscar_persona(text,text)', 'admin_lista_gimnasios(text,text,text,text,date,date)', 'admin_tablero()', 'admin_ficha_extra(uuid)',
                           'admin_cambiar_dueno(uuid,uuid)', 'admin_guardar_modulos(uuid,text[])', 'admin_cambiar_slug(uuid,text)', 'admin_marcar_favorito(uuid,boolean)',
                           'admin_entrar_gimnasio(uuid,text,text)'] loop
    if to_regprocedure('public.' || f) is null then raise exception 'Falta public.%', f; end if;
  end loop;
  if to_regprocedure('public.admin_entrar_gimnasio(uuid,text)') is not null then raise exception 'Quedó la firma vieja de admin_entrar_gimnasio'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.registro_brik'::regclass) then raise exception 'registro_brik sin RLS'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.favoritos_brik'::regclass) then raise exception 'favoritos_brik sin RLS'; end if;
end $$;
