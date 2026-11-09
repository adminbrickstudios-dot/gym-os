-- BASE-1 / F1.6 / F0.3 · Quienes cuentan o listan Retención piden solo las listas que usan (privado.retencion_listas y
-- privado.retencion_pendientes, que se apoyan en socios.cubierto_hasta). Ningún número cambia.
--   pendientes_panel · para_hacer_hoy_con · vencen_hoy · vencen_pestanas · panel_inicio · numeros_inicio
-- REGLA (LECCIONES): estas funciones las parchan otras migraciones (tareas nuevas de Para hacer hoy, avisos de 24 h, etc.). Por eso acá
-- NO se copia ninguna definición: se parte de la VIGENTE (pg_get_functiondef) y se cambia solo la línea de donde salen las filas,
-- con guarda: si el texto a cambiar no está exactamente una vez, la migración falla en vez de pisar nada.
-- Las firmas no cambian.

do $g$ begin
  if to_regprocedure('privado.retencion_listas(uuid, timestamptz, text[], boolean)') is null then raise exception 'Guarda: falta privado.retencion_listas'; end if;
  if to_regprocedure('privado.retencion_pendientes(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.retencion_pendientes'; end if;
end $g$;

do $p$
declare
  parches jsonb := jsonb_build_array(
    jsonb_build_object('f', 'public.pendientes_panel(uuid)',
      'de', $a$from privado.retencion_liviana(p_gimnasio_id, now()) r2 where r2.lista in ('por_vencer', 'no_viene', 'nuevo')$a$,
      'a',  $a$from privado.retencion_pendientes(p_gimnasio_id, now()) r2 where r2.lista in ('por_vencer', 'no_viene', 'nuevo')$a$),
    jsonb_build_object('f', 'privado.para_hacer_hoy_con(uuid, jsonb)',
      'de', $a$from privado.retencion_liviana(p_gimnasio_id, now()) r where r.lista in ('por_vencer', 'no_viene', 'nuevo')$a$,
      'a',  $a$from privado.retencion_pendientes(p_gimnasio_id, now()) r where r.lista in ('por_vencer', 'no_viene', 'nuevo')$a$),
    jsonb_build_object('f', 'public.vencen_hoy(uuid)',
      'de', $a$from privado.retencion(p_gimnasio_id, now()) r
   where r.lista = 'por_vencer'$a$,
      'a',  $a$from privado.retencion_listas(p_gimnasio_id, now(), array['por_vencer']) r
   where r.lista = 'por_vencer'$a$),
    jsonb_build_object('f', 'public.vencen_pestanas(uuid)',
      'de', $a$from privado.retencion(p_gimnasio_id, now()) t
     where t.lista in ('vencido', 'por_vencer')$a$,
      'a',  $a$from privado.retencion_listas(p_gimnasio_id, now(), array['vencido', 'por_vencer']) t
     where t.lista in ('vencido', 'por_vencer')$a$),
    jsonb_build_object('f', 'public.panel_inicio(uuid, uuid)',
      'de', $a$from privado.retencion(p_gimnasio_id, now()) r;$a$,
      'a',  $a$from privado.retencion_listas(p_gimnasio_id, now(), array['por_vencer'], true) r;$a$),
    jsonb_build_object('f', 'public.numeros_inicio(uuid, uuid)',
      'de', $a$from privado.retencion(p_gimnasio_id, now()) r;$a$,
      'a',  $a$from privado.retencion_listas(p_gimnasio_id, now(), array['por_vencer', 'vencido', 'nuevo', 'no_viene'], true) r;$a$));
  x jsonb; def text; nuevo text; veces int;
begin
  for x in select * from jsonb_array_elements(parches) loop
    def := pg_get_functiondef((x ->> 'f')::regprocedure);
    veces := (length(def) - length(replace(def, x ->> 'de', ''))) / greatest(length(x ->> 'de'), 1);
    if veces <> 1 then raise exception 'F1.6: en % el texto a cambiar aparece % veces (tiene que ser 1); la función cambió y hay que revisar este parche', x ->> 'f', veces; end if;
    nuevo := replace(def, x ->> 'de', x ->> 'a');
    execute nuevo;
  end loop;
end $p$;

do $v$
declare f text;
begin
  foreach f in array array['public.pendientes_panel(uuid)', 'privado.para_hacer_hoy_con(uuid, jsonb)', 'public.vencen_hoy(uuid)', 'public.vencen_pestanas(uuid)',
                           'public.panel_inicio(uuid, uuid)', 'public.numeros_inicio(uuid, uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
    if pg_get_functiondef(f::regprocedure) not like '%retencion_listas%' and pg_get_functiondef(f::regprocedure) not like '%retencion_pendientes%' then
      raise exception 'Verificación: % no usa la consulta nueva', f;
    end if;
  end loop;
end $v$;
