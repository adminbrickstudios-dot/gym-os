-- 0131 · Píxel de Meta y Google Analytics en la página (COM-11).
-- El dueño pega los IDs (nunca código libre: solo dígitos para el píxel y
-- G-XXXX para Analytics) y la página publicada carga los scripts con esos
-- IDs. La sin publicar no carga nada.
--   medicion_panel(gimnasio)               dueño y encargado
--   guardar_medicion(gimnasio, pixel, ga)  dueño
--   medicion_publica(host)                 la página (sin sesión), solo publicada

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.landing_gimnasio') is null then raise exception 'Guarda: falta landing_gimnasio'; end if;
  if to_regclass('public.dominios_gimnasio') is null then raise exception 'Guarda: falta dominios_gimnasio'; end if;
end $$;

alter table public.landing_gimnasio add column if not exists pixel_meta text;
alter table public.landing_gimnasio add column if not exists google_analytics text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'landing_gimnasio_pixel_meta_check') then
    alter table public.landing_gimnasio add constraint landing_gimnasio_pixel_meta_check check (pixel_meta is null or pixel_meta ~ '^[0-9]{10,20}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'landing_gimnasio_google_analytics_check') then
    alter table public.landing_gimnasio add constraint landing_gimnasio_google_analytics_check check (google_analytics is null or google_analytics ~ '^G-[A-Z0-9]{4,16}$');
  end if;
end $$;

create or replace function public.medicion_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare l public.landing_gimnasio;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select * into l from public.landing_gimnasio where gimnasio_id = p_gimnasio_id;
  return jsonb_build_object('pixel_meta', l.pixel_meta, 'google_analytics', l.google_analytics, 'publicada', coalesce(l.publicada, false));
end $$;

create or replace function public.guardar_medicion(p_gimnasio_id uuid, p_pixel_meta text, p_google_analytics text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_px text := nullif(regexp_replace(coalesce(p_pixel_meta, ''), '\s', '', 'g'), '');
        v_ga text := nullif(upper(regexp_replace(coalesce(p_google_analytics, ''), '\s', '', 'g')), ''); n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if v_px is not null and v_px !~ '^[0-9]{10,20}$' then
    raise exception 'El ID del píxel de Meta son solo números (de 10 a 20). Lo encontrás en el Administrador de eventos.' using errcode = '22023';
  end if;
  if v_ga is not null and v_ga !~ '^G-[A-Z0-9]{4,16}$' then
    raise exception 'El ID de Google Analytics empieza con G- (ej: G-AB12CD34EF). Lo encontrás en Administrar → Flujos de datos.' using errcode = '22023';
  end if;
  update public.landing_gimnasio set pixel_meta = v_px, google_analytics = v_ga, actualizado_en = now() where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Primero armá la página (Tu página → Guardar).' using errcode = '22023'; end if;
  return public.medicion_panel(p_gimnasio_id);
end $$;

create or replace function public.medicion_publica(p_host text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('pixel_meta', l.pixel_meta, 'google_analytics', l.google_analytics)
    from public.dominios_gimnasio d join public.landing_gimnasio l on l.gimnasio_id = d.gimnasio_id
   where d.host = lower(p_host) and l.publicada), '{}'::jsonb)
$$;

revoke all on function public.medicion_panel(uuid), public.guardar_medicion(uuid, text, text), public.medicion_publica(text) from public, anon, authenticated;
grant execute on function public.medicion_panel(uuid), public.guardar_medicion(uuid, text, text) to authenticated, service_role;
grant execute on function public.medicion_publica(text) to anon, authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'landing_gimnasio' and column_name = 'pixel_meta') then
    raise exception 'Verificación: falta pixel_meta';
  end if;
  if has_function_privilege('anon', 'public.guardar_medicion(uuid, text, text)', 'execute') then raise exception 'Verificación: guardar_medicion quedó para anon'; end if;
end $$;
