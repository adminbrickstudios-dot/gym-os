-- VD-1 · La ventana de Entrada flotante: cómo se comporta en cada gimnasio.
-- Una fila por gimnasio (si no hay fila, valen los valores por defecto del
-- doc v2/01 §1). "En esta compu" no pasa por acá: se guarda en el navegador.
--   config_entrada(gimnasio)                 equipo del gimnasio: cómo se comporta
--   guardar_config_entrada(gimnasio, datos)  solo el dueño y el encargado

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.gimnasios') is null then raise exception 'Guarda: falta public.gimnasios'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
  if to_regprocedure('privado.politicas_estandar(regclass, text[], text[], boolean)') is null then raise exception 'Guarda: falta privado.politicas_estandar'; end if;
end $$;

create table if not exists public.configuracion_entrada (
  gimnasio_id           uuid primary key references public.gimnasios(id),
  abrir_al_tipear       boolean not null default true,
  barra_fija            boolean not null default false,
  anotar_solo_en_verde  boolean not null default false,
  cerrar_sola_seg       int not null default 4 check (cerrar_sola_seg in (0, 3, 4, 6)),   -- 0 = no se cierra sola
  actualizado_en        timestamptz not null default now()
);
-- Lectura: todo el equipo del gimnasio; se escribe solo por la función.
select privado.politicas_estandar('public.configuracion_entrada', null, '{}');
revoke all on table public.configuracion_entrada from anon;
revoke truncate, references, trigger on public.configuracion_entrada from authenticated;

create or replace function public.config_entrada(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.configuracion_entrada;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  select * into c from public.configuracion_entrada where gimnasio_id = p_gimnasio_id;
  if not found then
    return jsonb_build_object('abrir_al_tipear', true, 'barra_fija', false, 'anotar_solo_en_verde', false, 'cerrar_sola_seg', 4);
  end if;
  return jsonb_build_object('abrir_al_tipear', c.abrir_al_tipear, 'barra_fija', c.barra_fija,
                            'anotar_solo_en_verde', c.anotar_solo_en_verde, 'cerrar_sola_seg', c.cerrar_sola_seg);
end $$;

create or replace function public.guardar_config_entrada(p_gimnasio_id uuid, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare desconocidos text[]; c public.configuracion_entrada; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos' using errcode = '22023'; end if;
  select array_agg(k) into desconocidos from jsonb_object_keys(p_datos) k
   where k not in ('abrir_al_tipear', 'barra_fija', 'anotar_solo_en_verde', 'cerrar_sola_seg');
  if desconocidos is not null then raise exception 'Campos que no se pueden cambiar acá: %', array_to_string(desconocidos, ', ') using errcode = '22023'; end if;
  insert into public.configuracion_entrada (gimnasio_id) values (p_gimnasio_id) on conflict (gimnasio_id) do nothing;
  select * into c from public.configuracion_entrada where gimnasio_id = p_gimnasio_id;
  if p_datos ? 'abrir_al_tipear' then
    if jsonb_typeof(p_datos -> 'abrir_al_tipear') is distinct from 'boolean' then raise exception 'Abrir al tipear: elegí sí o no.' using errcode = '22023'; end if;
    c.abrir_al_tipear := (p_datos ->> 'abrir_al_tipear')::boolean;
  end if;
  if p_datos ? 'barra_fija' then
    if jsonb_typeof(p_datos -> 'barra_fija') is distinct from 'boolean' then raise exception 'Barra fija: elegí sí o no.' using errcode = '22023'; end if;
    c.barra_fija := (p_datos ->> 'barra_fija')::boolean;
  end if;
  if p_datos ? 'anotar_solo_en_verde' then
    if jsonb_typeof(p_datos -> 'anotar_solo_en_verde') is distinct from 'boolean' then raise exception 'Anotar solo en verde: elegí sí o no.' using errcode = '22023'; end if;
    c.anotar_solo_en_verde := (p_datos ->> 'anotar_solo_en_verde')::boolean;
  end if;
  if p_datos ? 'cerrar_sola_seg' then
    if jsonb_typeof(p_datos -> 'cerrar_sola_seg') is distinct from 'number' or (p_datos ->> 'cerrar_sola_seg')::numeric not in (0, 3, 4, 6) then
      raise exception 'Cerrar sola: elegí 3 segundos, 4, 6 o que no se cierre.' using errcode = '22023';
    end if;
    c.cerrar_sola_seg := (p_datos ->> 'cerrar_sola_seg')::int;
  end if;
  update public.configuracion_entrada x set abrir_al_tipear = c.abrir_al_tipear, barra_fija = c.barra_fija,
         anotar_solo_en_verde = c.anotar_solo_en_verde, cerrar_sola_seg = c.cerrar_sola_seg, actualizado_en = now()
   where x.gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la configuración de la Entrada.'; end if;
  return public.config_entrada(p_gimnasio_id);
end $$;

revoke all on function public.config_entrada(uuid), public.guardar_config_entrada(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.config_entrada(uuid), public.guardar_config_entrada(uuid, jsonb) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.configuracion_entrada'::regclass) then raise exception 'Verificación: configuracion_entrada sin RLS'; end if;
  if has_function_privilege('anon', 'public.guardar_config_entrada(uuid, jsonb)', 'execute') then raise exception 'Verificación: anon puede guardar la config de la Entrada'; end if;
  if has_function_privilege('anon', 'public.config_entrada(uuid)', 'execute') then raise exception 'Verificación: anon puede leer la config de la Entrada'; end if;
end $$;
