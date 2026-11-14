-- E8 (14/11) · Dos viajes menos en TODAS las pantallas del panel: contexto_pantalla ya trae también el estado del gimnasio
-- (pausado, baja, demo vencida: estado_gimnasio_aviso) y el WhatsApp de BRIK para el botón de ayuda
-- (contacto_plataforma_publico). El layout los pedía aparte, uno después del otro.
-- Misma firma, misma seguridad: sin permiso sigue siendo el error de panel_gimnasio, nunca un contexto vacío.
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
  -- E8: lo que el layout pedía aparte. Si fallan, null (el layout ya lo trataba así: nunca tumbar el panel por esto).
  begin r := r || jsonb_build_object('estado_gimnasio', public.estado_gimnasio_aviso(p_gimnasio_id));
  exception when others then r := r || jsonb_build_object('estado_gimnasio', null); end;
  begin r := r || jsonb_build_object('contacto_ayuda', public.contacto_plataforma_publico());
  exception when others then r := r || jsonb_build_object('contacto_ayuda', null); end;
  return r;
end $$;
revoke all on function public.contexto_pantalla(uuid) from public, anon, authenticated;
grant execute on function public.contexto_pantalla(uuid) to authenticated, service_role;

do $v$ begin
  if to_regprocedure('public.contexto_pantalla(uuid)') is null then raise exception 'Verificación: falta contexto_pantalla'; end if;
  if has_function_privilege('anon', 'public.contexto_pantalla(uuid)', 'execute') then raise exception 'Verificación: anon puede ejecutar contexto_pantalla'; end if;
  if not has_function_privilege('authenticated', 'public.contexto_pantalla(uuid)', 'execute') then raise exception 'Verificación: authenticated no puede ejecutar contexto_pantalla'; end if;
end $v$;
