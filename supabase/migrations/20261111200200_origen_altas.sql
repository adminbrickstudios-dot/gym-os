-- N4 · De dónde vienen los socios nuevos (función nueva, apagada por defecto: interruptor "origen_altas", ver N5).
-- El link de "Quiero ser socio" puede llevar su origen (?o=instagram | qr | whatsapp | recomendado). Cuando alguien se anota por
-- ese link, el servidor deja un hecho: ese socio llegó por ese canal. Interesados muestra cuántos vienen de cada lado y cuántos
-- pagaron (los que tienen cobertura: socios.cubierto_hasta). No guarda nada del visitante: solo el canal y el socio que se anotó.
--   anotar_origen_alta(socio, canal)      lo llama el propio socio recién anotado (con su sesión); apagada: no anota nada
--   origen_altas_reporte(gimnasio, dias)  dueño, encargado y recepción; apagada: error claro
--   origen_alta_socio(socio)              el canal de un socio, para su ficha (null si no hay o está apagada)
-- Aditiva e idempotente.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.funcion_activa(uuid, text)') is null then raise exception 'Guarda: falta N5 (funciones nuevas)'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'socios' and column_name = 'cubierto_hasta') then
    raise exception 'Guarda: falta socios.cubierto_hasta';
  end if;
end $$;

create table if not exists public.origenes_alta (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  socio_id     uuid not null,
  canal        text not null check (canal in ('instagram', 'qr_cartel', 'whatsapp', 'recomendado')),
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, socio_id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id)
);
create index if not exists origenes_alta_gimnasio on public.origenes_alta (gimnasio_id, creado_en desc);
select privado.politicas_estandar('public.origenes_alta', array['dueno', 'encargado', 'recepcion'], null);
revoke all on table public.origenes_alta from anon;
revoke truncate, references, trigger on public.origenes_alta from authenticated;

-- ── El socio recién anotado deja su origen (una sola vez, el mismo día) ──
create or replace function public.anotar_origen_alta(p_socio_id uuid, p_canal text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare so public.socios; c text; n int;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into so from public.socios where id = p_socio_id;
  -- Apagada: no se anota nada (el socio no tiene por qué enterarse).
  if not privado.funcion_activa(so.gimnasio_id, 'origen_altas') then return false; end if;
  c := case lower(trim(coalesce(p_canal, ''))) when 'instagram' then 'instagram' when 'qr' then 'qr_cartel' when 'qr_cartel' then 'qr_cartel'
        when 'whatsapp' then 'whatsapp' when 'recomendado' then 'recomendado' else null end;
  if c is null then return false; end if;   -- un link con otro texto no es un error del socio: simplemente no cuenta
  if so.origen is distinct from 'alta_web' or so.creado_en < now() - interval '1 day' then return false; end if;
  insert into public.origenes_alta (gimnasio_id, socio_id, canal) values (so.gimnasio_id, so.id, c) on conflict (gimnasio_id, socio_id) do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- ── El reporte simple: cuántas altas por canal y cuántas pagaron ────
create or replace function public.origen_altas_reporte(p_gimnasio_id uuid, p_dias int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare desde timestamptz; zona text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  perform privado.exigir_funcion(p_gimnasio_id, 'origen_altas');
  if p_dias is null or p_dias < 1 or p_dias > 365 then raise exception 'Elegí entre 1 y 365 días' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  desde := privado.medianoche(privado.dia_local(now(), zona) - (p_dias - 1), zona);
  return jsonb_build_object(
    'dias', p_dias, 'desde', desde,
    'total', (select count(*) from public.origenes_alta o where o.gimnasio_id = p_gimnasio_id and o.creado_en >= desde),
    'canales', coalesce((
      select jsonb_agg(jsonb_build_object('canal', k.canal,
               'altas', (select count(*) from public.origenes_alta o where o.gimnasio_id = p_gimnasio_id and o.canal = k.canal and o.creado_en >= desde),
               'pagaron', (select count(*) from public.origenes_alta o join public.socios s on s.gimnasio_id = o.gimnasio_id and s.id = o.socio_id
                            where o.gimnasio_id = p_gimnasio_id and o.canal = k.canal and o.creado_en >= desde and s.cubierto_hasta is not null))
             order by k.orden)
        from (values ('instagram', 1), ('qr_cartel', 2), ('whatsapp', 3), ('recomendado', 4)) as k(canal, orden)), '[]'::jsonb),
    -- Los que se anotaron solos en el mismo período pero por un link sin origen (la página, un link viejo).
    'sin_origen', (select count(*) from public.socios s
                    where s.gimnasio_id = p_gimnasio_id and s.origen = 'alta_web' and s.creado_en >= desde
                      and not exists (select 1 from public.origenes_alta o where o.gimnasio_id = s.gimnasio_id and o.socio_id = s.id)),
    'ultimas', coalesce((
      select jsonb_agg(jsonb_build_object('socio_id', x.socio_id, 'nombre', x.nombre, 'canal', x.canal, 'creado_en', x.creado_en, 'pago', x.pago) order by x.creado_en desc)
        from (select o.socio_id, trim(s.nombre || ' ' || s.apellido) as nombre, o.canal, o.creado_en, s.cubierto_hasta is not null as pago
                from public.origenes_alta o join public.socios s on s.gimnasio_id = o.gimnasio_id and s.id = o.socio_id
               where o.gimnasio_id = p_gimnasio_id and o.creado_en >= desde order by o.creado_en desc limit 10) x), '[]'::jsonb));
end $$;

-- ── Para la ficha del socio ─────────────────────────────────────────
create or replace function public.origen_alta_socio(p_socio_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  if not privado.funcion_activa(g, 'origen_altas') then return null; end if;
  return (select o.canal from public.origenes_alta o where o.gimnasio_id = g and o.socio_id = p_socio_id);
end $$;

revoke all on function public.anotar_origen_alta(uuid, text), public.origen_altas_reporte(uuid, int), public.origen_alta_socio(uuid) from public, anon, authenticated;
grant execute on function public.anotar_origen_alta(uuid, text), public.origen_altas_reporte(uuid, int), public.origen_alta_socio(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.anotar_origen_alta(uuid, text)', 'public.origen_altas_reporte(uuid, int)', 'public.origen_alta_socio(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if not (select relrowsecurity from pg_class where oid = 'public.origenes_alta'::regclass) then raise exception 'Verificación: origenes_alta sin RLS'; end if;
end $$;
