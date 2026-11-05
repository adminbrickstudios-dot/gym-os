-- 0038 · Cumpleaños (SOC-6): los socios activos que cumplen hoy (en la
-- fecha del gimnasio; el 29/2 se festeja el 28/2 los años no bisiestos),
-- con el WhatsApp armado con el mensaje "Cumpleaños" de Configuración.

-- ── Guarda de entrada ───────────────────────────────────────────────
drop function if exists public.cumplen_hoy(uuid);
do $$
begin
  if to_regprocedure('privado.armar_mensaje(text, jsonb)') is null then raise exception 'Guarda: faltan los mensajes (0025)'; end if;
  if to_regprocedure('privado.dia_local(timestamptz, text)') is null then raise exception 'Guarda: falta privado.dia_local'; end if;
end $$;

create or replace function public.cumplen_hoy(p_gimnasio_id uuid, p_momento timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; plantilla text; gim text; bisiesto boolean;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.zona_horaria, g.nombre into zona, gim from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(coalesce(p_momento, now()), zona);
  bisiesto := extract(day from (make_date(extract(year from hoy)::int, 3, 1) - 1)) = 29;
  select coalesce(p.texto, (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = 'cumpleanos'))
    into plantilla from public.plantillas_mensaje p where p.gimnasio_id = p_gimnasio_id and p.clave = 'cumpleanos';
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'socio_id', s.id, 'nombre', trim(s.nombre || ' ' || s.apellido), 'telefono', s.telefono,
      'cumple', extract(year from hoy)::int - extract(year from s.fecha_nacimiento)::int,
      'mensaje', privado.armar_mensaje(plantilla, jsonb_build_object('nombre', s.nombre, 'gimnasio', gim)))
      order by s.nombre), '[]')
    from public.socios s
   where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null and s.fecha_nacimiento is not null
     and (   (extract(month from s.fecha_nacimiento) = extract(month from hoy) and extract(day from s.fecha_nacimiento) = extract(day from hoy))
          or (not bisiesto and extract(month from s.fecha_nacimiento) = 2 and extract(day from s.fecha_nacimiento) = 29
              and extract(month from hoy) = 2 and extract(day from hoy) = 28)));
end $$;

revoke all on function public.cumplen_hoy(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.cumplen_hoy(uuid, timestamptz) to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.cumplen_hoy(uuid, timestamptz)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: cumplen_hoy sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.cumplen_hoy(uuid, timestamptz)', 'execute') then raise exception 'Verificación: anon ve cumpleaños'; end if;
end $$;
