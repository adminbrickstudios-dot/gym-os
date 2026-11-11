-- C6 · La compu compartida de la recepción: cierre por inactividad, por gimnasio (Configuración → Entrada).
-- cerrar_por_inactividad_min: 0 = apagado (por defecto); si no, entre 5 y 480 minutos sin tocar nada.
-- Solo vale para la sesión de recepción (quien no es recepción nunca se cierra solo). Aditiva e idempotente:
-- una columna con default y create or replace de las dos funciones de config, con las mismas firmas.
do $g$ begin
  if to_regclass('public.configuracion_entrada') is null then raise exception 'C6: falta configuracion_entrada'; end if;
  if pg_get_functiondef('public.config_entrada(uuid)'::regprocedure) not like '%resultado_entrada%' then raise exception 'C6: falta la versión de BASE-3 de config_entrada'; end if;
end $g$;

alter table public.configuracion_entrada add column if not exists cerrar_por_inactividad_min integer not null default 0;
do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_entrada_inactividad_ck') then
    alter table public.configuracion_entrada add constraint configuracion_entrada_inactividad_ck
      check (cerrar_por_inactividad_min = 0 or cerrar_por_inactividad_min between 5 and 480);
  end if;
end $c$;

create or replace function public.config_entrada(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.configuracion_entrada;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  select * into c from public.configuracion_entrada where gimnasio_id = p_gimnasio_id;
  if not found then
    return jsonb_build_object('abrir_al_tipear', true, 'barra_fija', false, 'anotar_solo_en_verde', false, 'cerrar_sola_seg', 4,
                              'resultado_entrada', 'aviso', 'cerrar_por_inactividad_min', 0);
  end if;
  return jsonb_build_object('abrir_al_tipear', c.abrir_al_tipear, 'barra_fija', c.barra_fija,
                            'anotar_solo_en_verde', c.anotar_solo_en_verde, 'cerrar_sola_seg', c.cerrar_sola_seg,
                            'resultado_entrada', c.resultado_entrada, 'cerrar_por_inactividad_min', c.cerrar_por_inactividad_min);
end $$;

create or replace function public.guardar_config_entrada(p_gimnasio_id uuid, p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare desconocidos text[]; c public.configuracion_entrada; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos' using errcode = '22023'; end if;
  select array_agg(k) into desconocidos from jsonb_object_keys(p_datos) k
   where k not in ('abrir_al_tipear', 'barra_fija', 'anotar_solo_en_verde', 'cerrar_sola_seg', 'resultado_entrada', 'cerrar_por_inactividad_min');
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
  if p_datos ? 'resultado_entrada' then
    if jsonb_typeof(p_datos -> 'resultado_entrada') is distinct from 'string' or (p_datos ->> 'resultado_entrada') not in ('aviso', 'ventana') then
      raise exception 'Mostrar el resultado: elegí aviso en la esquina o ventana grande.' using errcode = '22023';
    end if;
    c.resultado_entrada := p_datos ->> 'resultado_entrada';
  end if;
  if p_datos ? 'cerrar_por_inactividad_min' then
    if jsonb_typeof(p_datos -> 'cerrar_por_inactividad_min') is distinct from 'number'
       or (p_datos ->> 'cerrar_por_inactividad_min')::numeric <> trunc((p_datos ->> 'cerrar_por_inactividad_min')::numeric)
       or not ((p_datos ->> 'cerrar_por_inactividad_min')::numeric = 0 or (p_datos ->> 'cerrar_por_inactividad_min')::numeric between 5 and 480) then
      raise exception 'Cierre por inactividad: 0 para que no se cierre, o entre 5 y 480 minutos.' using errcode = '22023';
    end if;
    c.cerrar_por_inactividad_min := (p_datos ->> 'cerrar_por_inactividad_min')::int;
  end if;
  update public.configuracion_entrada x set abrir_al_tipear = c.abrir_al_tipear, barra_fija = c.barra_fija,
         anotar_solo_en_verde = c.anotar_solo_en_verde, cerrar_sola_seg = c.cerrar_sola_seg, resultado_entrada = c.resultado_entrada,
         cerrar_por_inactividad_min = c.cerrar_por_inactividad_min, actualizado_en = now()
   where x.gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la configuración de la Entrada.'; end if;
  return public.config_entrada(p_gimnasio_id);
end $$;

revoke all on function public.config_entrada(uuid), public.guardar_config_entrada(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.config_entrada(uuid), public.guardar_config_entrada(uuid, jsonb) to authenticated, service_role;

do $v$ begin
  if pg_get_functiondef('public.config_entrada(uuid)'::regprocedure) not like '%cerrar_por_inactividad_min%' then raise exception 'C6: config_entrada sin cerrar_por_inactividad_min'; end if;
  if pg_get_functiondef('public.guardar_config_entrada(uuid, jsonb)'::regprocedure) not like '%cerrar_por_inactividad_min%' then raise exception 'C6: guardar_config_entrada sin cerrar_por_inactividad_min'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_entrada' and column_name = 'cerrar_por_inactividad_min') then
    raise exception 'C6: falta la columna cerrar_por_inactividad_min';
  end if;
end $v$;
