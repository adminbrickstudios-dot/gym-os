-- E8 (14/11, 2.ª tanda) · lote_lecturas con más pantallas: Retención, Socios, Vender y Tu página. Misma función, misma seguridad (lista cerrada de
-- lecturas, cada una con los permisos de quien pregunta); solo se suman nombres a la lista. La anterior (20261114110000) no se toca.
do $g$ begin
  if to_regprocedure('public.lote_lecturas(jsonb)') is null then raise exception 'Guarda: falta lote_lecturas (20261114110000)'; end if;
end $g$;

create or replace function public.lote_lecturas(p_llamadas jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  permitidas constant text[] := array[
    -- Configuración
    'configuracion_panel','datos_gimnasio_panel','horarios_apertura_panel','cierres_panel','mensajes_panel','historial_configuracion',
    'tablets_panel','estado_pagos_online','config_turnos_fijos','encuestas_panel','config_entrada','meta_visitas_panel','reglas_vencimiento',
    'config_dejar_pasar','config_cobro','config_caja','autoservicio_panel','plan_familiar_estado','reglas_beneficios','cambios_restaurables',
    -- Planes
    'planes_gimnasio','productos_mostrador','matriculas_planes','stock_productos','convenios_gimnasio','ajustes_planes','servicios_gimnasio',
    'lista_precios_plan','actividades_gimnasio','actividades_por_plan',
    -- Inicio
    'panel_inicio','numeros_inicio','primeros_pasos','cumplen_hoy','pedidos_pausa_pendientes','dejados_pasar','invitados_de_hoy',
    'pedidos_anulacion_pendientes','productos_gimnasio','alertas_caja','cajas_olvidadas','pedidos_baja_pendientes','novedades_dueno',
    'tareas_panel','para_hacer_hoy','ultimas_entradas','mi_fichaje','maquinas_fuera_de_servicio','lockers_vencen_semana',
    -- Entrada
    'ingresos_del_dia','formas_de_entrada','mi_turno_caja','estado_emergencia_puerta','historial_emergencias_puerta','ficha_socio',
    -- Retención
    'retencion_resumen','retencion','socios_con_etiqueta','tablero_retencion','riesgo_baja','retencion_numeros','retencion_periodo','etiquetas_gimnasio',
    -- Socios
    'buscar_socios','filtros_socios','autoaltas_web','prospectos_panel',
    -- Vender
    'precios_venta','caja_para_cobrar',
    -- Tu página
    'pagina_panel','altas_panel','medicion_panel','prueba_social_panel'];
  resultados jsonb[] := '{}';
  it jsonb; f text; args text; sql text; res jsonb; conjunto boolean; tolerante boolean;
  cada jsonb; fuente jsonb; el jsonb; acum jsonb; n int := 0;
begin
  if jsonb_typeof(p_llamadas) is distinct from 'array' or jsonb_array_length(p_llamadas) > 40 then
    raise exception 'Lote de lecturas inválido' using errcode = '22023';
  end if;
  for it in select e from jsonb_array_elements(p_llamadas) e loop
    f := it ->> 'f';
    if f is null or not (f = any (permitidas)) then
      raise exception 'Esa lectura no se puede pedir en lote: %', coalesce(f, '(sin nombre)') using errcode = '42501';
    end if;
    tolerante := coalesce((it ->> 't')::boolean, false);
    select coalesce(bool_or(p.proretset), false) into conjunto from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = f;
    cada := it -> 'cada';
    begin
      if cada is null then
        select string_agg(format('%I => %L', k, v), ', ') into args
          from jsonb_each_text(coalesce(it -> 'a', '{}'::jsonb)) as x(k, v) where k ~ '^p_[a-z_]+$';
        if conjunto then sql := format('select coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) from public.%I(%s) r', f, coalesce(args, ''));
        else sql := format('select to_jsonb(public.%I(%s))', f, coalesce(args, '')); end if;
        execute sql into res;
      else
        -- una llamada por cada elemento de una lectura anterior del mismo lote
        if (cada ->> 'i')::int >= n or (cada ->> 'arg') !~ '^p_[a-z_]+$' then raise exception 'Lote de lecturas inválido' using errcode = '22023'; end if;
        fuente := to_jsonb(resultados[(cada ->> 'i')::int + 1]);
        acum := '{}'::jsonb;
        for el in select e from jsonb_array_elements(coalesce(fuente, '[]'::jsonb)) e loop
          sql := format('select to_jsonb(public.%I(%I => %L))', f, cada ->> 'arg', el ->> (cada ->> 'campo'));
          execute sql into res;
          acum := acum || jsonb_build_object(el ->> (cada ->> 'campo'), res);
        end loop;
        res := acum;
      end if;
    exception when others then
      if tolerante then res := null; else raise; end if;
    end;
    resultados := resultados || to_jsonb(res);
    n := n + 1;
  end loop;
  return to_jsonb(resultados);
end $$;
revoke all on function public.lote_lecturas(jsonb) from public, anon;
grant execute on function public.lote_lecturas(jsonb) to authenticated, service_role;

do $v$ begin
  if to_regprocedure('public.lote_lecturas(jsonb)') is null then raise exception 'Verificación: falta lote_lecturas'; end if;
  if has_function_privilege('anon', 'public.lote_lecturas(jsonb)', 'execute') then raise exception 'Verificación: anon puede ejecutar lote_lecturas'; end if;
  if not has_function_privilege('authenticated', 'public.lote_lecturas(jsonb)', 'execute') then raise exception 'Verificación: authenticated no puede ejecutar lote_lecturas'; end if;
end $v$;
