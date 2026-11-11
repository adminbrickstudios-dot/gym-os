-- F0.2 · Un solo viaje para el contexto de toda pantalla del panel.
-- Antes: panel_gimnasio, ver_mensajes_equipo, config_fichaje, estado_abono_panel, config_entrada y formas_de_entrada eran
-- seis viajes a la base (3 en fila). Ahora la base los junta en una sola llamada. Cada pieza sigue siendo la función de siempre
-- (con su permiso y sus reglas): esta no calcula nada propio. Solo lo que la pantalla no necesita para su rol se omite.
-- Si panel_gimnasio falla (sin permiso), falla igual y con su mensaje. Las piezas accesorias que fallen quedan en null (la pantalla
-- ya las trataba así: abono y entrada nunca frenan el panel).

do $g$ begin
  if to_regprocedure('public.panel_gimnasio(uuid)') is null then raise exception 'Guarda: falta panel_gimnasio'; end if;
  if to_regprocedure('public.ver_mensajes_equipo(uuid)') is null then raise exception 'Guarda: falta ver_mensajes_equipo'; end if;
  if to_regprocedure('public.config_fichaje(uuid)') is null then raise exception 'Guarda: falta config_fichaje'; end if;
  if to_regprocedure('public.estado_abono_panel(uuid)') is null then raise exception 'Guarda: falta estado_abono_panel'; end if;
  if to_regprocedure('public.config_entrada(uuid)') is null then raise exception 'Guarda: falta config_entrada'; end if;
  if to_regprocedure('public.formas_de_entrada(uuid)') is null then raise exception 'Guarda: falta formas_de_entrada'; end if;
end $g$;

create or replace function public.contexto_pantalla(p_gimnasio_id uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare
  panel jsonb; rol text; r jsonb;
begin
  panel := public.panel_gimnasio(p_gimnasio_id);   -- sin permiso: el error de siempre
  rol := panel -> 'yo' ->> 'rol';
  r := jsonb_build_object('panel', panel);
  if rol = 'recepcion' then
    begin r := r || jsonb_build_object('ver_mensajes', public.ver_mensajes_equipo(p_gimnasio_id));
    exception when others then r := r || jsonb_build_object('ver_mensajes', false); end;
  end if;
  if rol <> 'dueno' then
    begin r := r || jsonb_build_object('fichaje_usa', coalesce((public.config_fichaje(p_gimnasio_id) ->> 'usa')::boolean, false));
    exception when others then r := r || jsonb_build_object('fichaje_usa', false); end;
  end if;
  begin r := r || jsonb_build_object('abono', public.estado_abono_panel(p_gimnasio_id));
  exception when others then r := r || jsonb_build_object('abono', null); end;
  if rol <> 'profe' then
    begin r := r || jsonb_build_object('config_entrada', public.config_entrada(p_gimnasio_id));
    exception when others then r := r || jsonb_build_object('config_entrada', null); end;
    begin r := r || jsonb_build_object('formas_entrada', to_jsonb(public.formas_de_entrada(p_gimnasio_id)));
    exception when others then r := r || jsonb_build_object('formas_entrada', null); end;
  end if;
  return r;
end $$;
revoke all on function public.contexto_pantalla(uuid) from public, anon, authenticated;
grant execute on function public.contexto_pantalla(uuid) to authenticated, service_role;

do $v$ begin
  if to_regprocedure('public.contexto_pantalla(uuid)') is null then raise exception 'Verificación: falta contexto_pantalla'; end if;
  if has_function_privilege('anon', 'public.contexto_pantalla(uuid)', 'execute') then raise exception 'Verificación: anon puede ejecutar contexto_pantalla'; end if;
end $v$;
