-- ═══════════════════════════════════════════════════════════════════
-- FA-15 · Rutina: el socio marca cada serie como hecha.
-- Es un HECHO por serie y por día calendario del gimnasio (como "hice el Día N", VD-20): tocar dos veces no duplica y se
-- puede deshacer el de hoy. Nada guardado como estado: "cuántas series lleva" sale de contar. Pesos y repeticiones siguen
-- en registros_ejercicio ("Anotar"); esto es solo "la hice". Sin datos de salud.
--   marcar_serie_rutina(socio, dia, ejercicio, serie, hecha) · series_hechas_hoy(socio)
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.rutina_dias_hechos') is null then raise exception 'Guarda: falta rutina_dias_hechos (VD-20)'; end if;
  if to_regprocedure('privado.exigir_socio_o_rutinas(uuid)') is null then raise exception 'Guarda: falta privado.exigir_socio_o_rutinas'; end if;
  if to_regprocedure('privado.politicas_estandar(regclass, text[], text[], boolean)') is null then raise exception 'Guarda: falta privado.politicas_estandar'; end if;
end $$;

create table if not exists public.rutina_series_hechas (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  socio_id      uuid not null,
  rutina_id     uuid not null,
  dia           int not null check (dia between 1 and 7),
  ejercicio_id  uuid not null,
  serie         int not null check (serie between 1 and 30),
  fecha         date not null,
  creado_en     timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, socio_id, rutina_id, dia, ejercicio_id, serie, fecha),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, rutina_id) references public.rutinas (gimnasio_id, id),
  foreign key (gimnasio_id, ejercicio_id) references public.ejercicios (gimnasio_id, id)
);
create index if not exists rutina_series_hechas_socio on public.rutina_series_hechas (gimnasio_id, socio_id, fecha desc);
select privado.politicas_estandar('public.rutina_series_hechas', array['dueno', 'encargado', 'profe'], null, true);
revoke all on table public.rutina_series_hechas from anon;
revoke truncate, references, trigger on public.rutina_series_hechas from authenticated;

create or replace function public.marcar_serie_rutina(p_socio_id uuid, p_dia int, p_ejercicio_id uuid, p_serie int, p_hecha boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; rs public.rutinas_socio; zona text; hoy date; v_series int; n int;
begin
  g := privado.exigir_socio_o_rutinas(p_socio_id);
  select * into rs from public.rutinas_socio where socio_id = p_socio_id and quitada_en is null;
  if not found then raise exception 'No tenés una rutina asignada.' using errcode = '22023'; end if;
  select max(x.series) into v_series from public.rutina_ejercicios x where x.rutina_id = rs.rutina_id and x.dia = p_dia and x.ejercicio_id = p_ejercicio_id;
  if v_series is null then raise exception 'Ese ejercicio no está en tu rutina.' using errcode = '22023'; end if;
  if p_serie is null or p_serie < 1 or p_serie > v_series then raise exception 'Esa serie no existe en tu rutina.' using errcode = '22023'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = g;
  hoy := (now() at time zone zona)::date;
  if coalesce(p_hecha, true) then
    insert into public.rutina_series_hechas (gimnasio_id, socio_id, rutina_id, dia, ejercicio_id, serie, fecha)
    values (g, p_socio_id, rs.rutina_id, p_dia, p_ejercicio_id, p_serie, hoy)
    on conflict (gimnasio_id, socio_id, rutina_id, dia, ejercicio_id, serie, fecha) do nothing;
  else
    delete from public.rutina_series_hechas h
     where h.socio_id = p_socio_id and h.rutina_id = rs.rutina_id and h.dia = p_dia and h.ejercicio_id = p_ejercicio_id and h.serie = p_serie and h.fecha = hoy;
  end if;
  select count(*) into n from public.rutina_series_hechas h
   where h.socio_id = p_socio_id and h.rutina_id = rs.rutina_id and h.dia = p_dia and h.ejercicio_id = p_ejercicio_id and h.fecha = hoy;
  return jsonb_build_object('hechas', n, 'de', v_series);
end $$;

create or replace function public.series_hechas_hoy(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare rs public.rutinas_socio; zona text; g uuid;
begin
  g := privado.exigir_socio_o_rutinas(p_socio_id);
  select * into rs from public.rutinas_socio where socio_id = p_socio_id and quitada_en is null;
  if not found then return '[]'::jsonb; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = g;
  return coalesce((select jsonb_agg(jsonb_build_object('dia', h.dia, 'ejercicio_id', h.ejercicio_id, 'serie', h.serie) order by h.dia, h.serie)
                     from public.rutina_series_hechas h
                    where h.socio_id = p_socio_id and h.rutina_id = rs.rutina_id and h.fecha = (now() at time zone zona)::date), '[]'::jsonb);
end $$;

revoke all on function public.marcar_serie_rutina(uuid, int, uuid, int, boolean), public.series_hechas_hoy(uuid) from public, anon, authenticated;
grant execute on function public.marcar_serie_rutina(uuid, int, uuid, int, boolean), public.series_hechas_hoy(uuid) to authenticated, service_role;

do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.rutina_series_hechas'::regclass) then raise exception 'Verificación: rutina_series_hechas sin RLS'; end if;
  foreach f in array array['public.marcar_serie_rutina(uuid, integer, uuid, integer, boolean)', 'public.series_hechas_hoy(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
