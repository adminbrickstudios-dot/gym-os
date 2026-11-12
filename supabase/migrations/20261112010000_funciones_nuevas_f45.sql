-- ═══════════════════════════════════════════════════════════════════
-- F4/F5 · Interruptor por gimnasio para las funciones nuevas (apagadas por defecto) y el pedido de horarios pico.
--   configuracion_gimnasio.funciones_nuevas   lista de claves prendidas (vacía por defecto: todo apagado)
--   funciones_nuevas_gimnasio(gimnasio)       [equipo] lee la lista
--   guardar_funcion_nueva(gimnasio, clave, si) [dueño] prende o apaga una clave de la lista blanca
--   ingresos_por_hora_y_dia(gimnasio, semanas) [dueño, encargado] entradas por día de la semana y hora (solo lectura)
-- Claves de hoy: borrador_alta (FA-17), panel_pago (FA-1), horarios_pico (detalle 68).
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: falta privado.exigir_equipo'; end if;
  if to_regclass('public.configuracion_gimnasio') is null then raise exception 'Guarda: falta configuracion_gimnasio'; end if;
  if to_regclass('public.ingresos') is null then raise exception 'Guarda: falta ingresos'; end if;
end $$;

alter table public.configuracion_gimnasio add column if not exists funciones_nuevas text[] not null default '{}';

create or replace function public.funciones_nuevas_gimnasio(p_gimnasio_id uuid) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare lista text[];
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  select c.funciones_nuevas into lista from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  return coalesce(lista, '{}');
end $$;

create or replace function public.guardar_funcion_nueva(p_gimnasio_id uuid, p_clave text, p_si boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_clave is null or p_clave not in ('borrador_alta', 'panel_pago', 'horarios_pico') then
    raise exception 'Esa función no existe' using errcode = '22023';
  end if;
  update public.configuracion_gimnasio
     set funciones_nuevas = case when coalesce(p_si, false)
           then (select coalesce(array_agg(distinct x order by x), '{}') from unnest(funciones_nuevas || array[p_clave]) x)
           else array_remove(funciones_nuevas, p_clave) end
   where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la configuración'; end if;
end $$;

create or replace function public.ingresos_por_hora_y_dia(p_gimnasio_id uuid, p_semanas int default 8) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; sem int := least(greatest(coalesce(p_semanas, 8), 1), 26); celdas jsonb;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  -- Filas = lunes (1) a domingo (7); columnas = hora 0 a 23 en la hora del gimnasio.
  select jsonb_agg(fila order by d) into celdas from (
    select d, (select jsonb_agg(coalesce(x.n, 0) order by h) from generate_series(0, 23) h
                 left join (select extract(hour from i.momento at time zone zona)::int hora, count(*) n
                              from public.ingresos i
                             where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado'
                               and i.momento >= now() - make_interval(weeks => sem)
                               and extract(isodow from i.momento at time zone zona)::int = d
                             group by 1) x on x.hora = h) fila
      from generate_series(1, 7) d) t;
  return jsonb_build_object('semanas', sem, 'celdas', celdas);
end $$;

revoke all on function public.funciones_nuevas_gimnasio(uuid), public.guardar_funcion_nueva(uuid, text, boolean), public.ingresos_por_hora_y_dia(uuid, int) from public, anon, authenticated;
grant execute on function public.funciones_nuevas_gimnasio(uuid), public.guardar_funcion_nueva(uuid, text, boolean), public.ingresos_por_hora_y_dia(uuid, int) to authenticated, service_role;

do $$
begin
  if (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'funciones_nuevas') <> '''{}''::text[]' then
    raise exception 'Verificación: las funciones nuevas no quedaron apagadas por defecto';
  end if;
  if exists (select 1 from public.configuracion_gimnasio where funciones_nuevas <> '{}') then
    raise exception 'Verificación: algún gimnasio quedó con una función nueva prendida';
  end if;
end $$;
