-- 0096 · Novedades del gimnasio en la app (APP-6).
-- El dueño o el encargado publican un aviso corto ("El lunes 24 abrimos a las
-- 10") con hasta qué día se muestra; los socios lo ven arriba en la app.
-- Vencido o quitado, no se ve. Sin foto por ahora (anotado en el inventario).
--   novedades_panel(gimnasio)              las vigentes y las próximas (equipo)
--   publicar_novedad(gimnasio, texto, hasta)
--   quitar_novedad(novedad)
--   novedades_socio(socio)                 las vigentes, para la app

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.faltas_pack(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta la migración 0095'; end if;
end $$;

create table if not exists public.novedades_gimnasio (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  texto        text not null check (length(trim(texto)) between 3 and 280),
  desde        timestamptz not null default now(),
  hasta        timestamptz not null,
  creado_por   uuid not null,
  creado_en    timestamptz not null default now(),
  quitado_en   timestamptz,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id),
  check (hasta > desde)
);
create index if not exists novedades_vigentes on public.novedades_gimnasio (gimnasio_id, hasta) where quitado_en is null;
select privado.politicas_estandar('public.novedades_gimnasio', array['dueno', 'encargado', 'recepcion'], null, false);
revoke all on table public.novedades_gimnasio from anon;
revoke truncate, references, trigger on public.novedades_gimnasio from authenticated;

create or replace function public.novedades_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  return coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'texto', n.texto, 'hasta', privado.dia_local(n.hasta, zona) - 1,
            'por', e.nombre, 'creado_en', n.creado_en) order by n.creado_en desc)
    from public.novedades_gimnasio n join public.equipo e on e.id = n.creado_por
   where n.gimnasio_id = p_gimnasio_id and n.quitado_en is null and n.hasta > now()), '[]'::jsonb);
end $$;

create or replace function public.publicar_novedad(p_gimnasio_id uuid, p_texto text, p_hasta date) returns uuid
language plpgsql security definer set search_path = '' as $$
declare eid uuid; zona text; hoy date; v_texto text := trim(coalesce(p_texto, '')); nid uuid;
begin
  eid := privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado']);
  select zona_horaria into zona from public.gimnasios where id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  if length(v_texto) < 3 then raise exception 'Escribí la novedad' using errcode = '22023'; end if;
  if length(v_texto) > 280 then raise exception 'La novedad: hasta 280 letras.' using errcode = '22023'; end if;
  if p_hasta is null or p_hasta < hoy then raise exception 'Elegí hasta qué día se muestra (hoy o más adelante)' using errcode = '22023'; end if;
  if p_hasta > hoy + 60 then raise exception 'Se muestra hasta 60 días' using errcode = '22023'; end if;
  if (select count(*) from public.novedades_gimnasio where gimnasio_id = p_gimnasio_id and quitado_en is null and hasta > now()) >= 3 then
    raise exception 'Ya hay 3 novedades en la app: quitá una antes' using errcode = '22023';
  end if;
  insert into public.novedades_gimnasio (gimnasio_id, texto, hasta, creado_por)
  values (p_gimnasio_id, v_texto, privado.medianoche(p_hasta + 1, zona), eid) returning id into nid;
  return nid;
end $$;

create or replace function public.quitar_novedad(p_novedad_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; n int;
begin
  select gimnasio_id into g from public.novedades_gimnasio where id = p_novedad_id;
  if g is null then raise exception 'Sin permiso o novedad inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(g, array['dueno', 'encargado']);
  update public.novedades_gimnasio set quitado_en = now() where id = p_novedad_id and quitado_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Esa novedad ya no estaba' using errcode = '22023'; end if;
end $$;

create or replace function public.novedades_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select gimnasio_id into g from public.socios where id = p_socio_id;
  return coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'texto', n.texto) order by n.creado_en desc)
    from public.novedades_gimnasio n where n.gimnasio_id = g and n.quitado_en is null and n.desde <= now() and n.hasta > now()), '[]'::jsonb);
end $$;

revoke all on function public.novedades_panel(uuid), public.publicar_novedad(uuid, text, date), public.quitar_novedad(uuid), public.novedades_socio(uuid)
  from public, anon, authenticated;
grant execute on function public.novedades_panel(uuid), public.publicar_novedad(uuid, text, date), public.quitar_novedad(uuid), public.novedades_socio(uuid)
  to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.novedades_gimnasio'::regclass) then raise exception 'Verificación: novedades_gimnasio sin RLS'; end if;
  foreach f in array array['public.novedades_panel(uuid)', 'public.publicar_novedad(uuid, text, date)', 'public.quitar_novedad(uuid)', 'public.novedades_socio(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
