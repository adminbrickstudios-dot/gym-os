-- E8 · Dos viajes menos por pantalla del panel.
-- El layout del panel pedía, después de contexto_pantalla y EN FILA, estado_gimnasio_aviso (¿pausado, dado de baja, demo vencida?)
-- y contacto_plataforma_publico (el WhatsApp de ayuda). Ahora contexto_pantalla los trae en la misma llamada.
-- Cada pieza sigue siendo la función de siempre, con su permiso y sus reglas; esta no calcula nada propio. Si una pieza falla
-- queda en null (el layout ya la trataba así: `.catch(() => null)`). La firma no cambia (create or replace: no queda otra versión).
-- Ningún resultado cambia: supabase/pruebas/contexto-pantalla.test.mjs compara cada campo nuevo contra su función.

do $g$ begin
  if to_regprocedure('public.contexto_pantalla(uuid)') is null then raise exception 'Guarda: falta contexto_pantalla'; end if;
  if to_regprocedure('public.estado_gimnasio_aviso(uuid)') is null then raise exception 'Guarda: falta estado_gimnasio_aviso'; end if;
  if to_regprocedure('public.contacto_plataforma_publico()') is null then raise exception 'Guarda: falta contacto_plataforma_publico'; end if;
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
  -- E8: pausado / baja / demo vencida (todos los roles) y el WhatsApp de ayuda (dueño, encargado y recepción).
  begin r := r || jsonb_build_object('estado_gimnasio', public.estado_gimnasio_aviso(p_gimnasio_id));
  exception when others then r := r || jsonb_build_object('estado_gimnasio', null); end;
  if rol in ('dueno', 'encargado', 'recepcion') then
    begin r := r || jsonb_build_object('contacto_plataforma', public.contacto_plataforma_publico());
    exception when others then r := r || jsonb_build_object('contacto_plataforma', null); end;
  end if;
  return r;
end $$;
revoke all on function public.contexto_pantalla(uuid) from public, anon, authenticated;
grant execute on function public.contexto_pantalla(uuid) to authenticated, service_role;

do $v$
declare def text := pg_get_functiondef('public.contexto_pantalla(uuid)'::regprocedure);
begin
  if has_function_privilege('anon', 'public.contexto_pantalla(uuid)', 'execute') then raise exception 'Verificación: anon puede ejecutar contexto_pantalla'; end if;
  if position('estado_gimnasio_aviso' in def) = 0 or position('contacto_plataforma_publico' in def) = 0 then raise exception 'Verificación: contexto_pantalla no trae el estado ni el contacto'; end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'contexto_pantalla') <> 1 then
    raise exception 'Verificación: hay más de una contexto_pantalla';
  end if;
end $v$;
