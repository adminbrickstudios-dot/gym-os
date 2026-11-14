-- E8 (14/11) · Lo que el panel pide al abrir cada pantalla, en UN viaje: los números del menú (pendientes_panel), la campana
-- (campana_panel) y lo de MercadoPago (avisos_pagos_mp). Antes eran tres pedidos del navegador, uno por cada pieza.
-- Cada pieza corre con los permisos de quien pregunta, como siempre. pendientes y campana: un error corta todo (permiso denegado
-- es error, nunca una lista vacía); lo de MercadoPago es solo de dueño y encargado y, si no corresponde o falla, va null (como antes:
-- ese pedido ya estaba envuelto en un try y no rompía la campana).
do $g$ begin
  if to_regprocedure('public.pendientes_panel(uuid)') is null then raise exception 'Guarda: falta pendientes_panel'; end if;
  if to_regprocedure('public.campana_panel(uuid)') is null then raise exception 'Guarda: falta campana_panel'; end if;
  if to_regprocedure('public.avisos_pagos_mp(uuid)') is null then raise exception 'Guarda: falta avisos_pagos_mp'; end if;
end $g$;

create or replace function public.panel_vivo(p_gimnasio_id uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare r jsonb;
begin
  r := jsonb_build_object(
    'pendientes', to_jsonb(public.pendientes_panel(p_gimnasio_id)),
    'campana', to_jsonb(public.campana_panel(p_gimnasio_id)));
  begin r := r || jsonb_build_object('mp', to_jsonb(public.avisos_pagos_mp(p_gimnasio_id)));
  exception when others then r := r || jsonb_build_object('mp', null); end;
  return r;
end $$;
revoke all on function public.panel_vivo(uuid) from public, anon, authenticated;
grant execute on function public.panel_vivo(uuid) to authenticated, service_role;

do $v$ begin
  if to_regprocedure('public.panel_vivo(uuid)') is null then raise exception 'Verificación: falta panel_vivo'; end if;
  if has_function_privilege('anon', 'public.panel_vivo(uuid)', 'execute') then raise exception 'Verificación: anon puede ejecutar panel_vivo'; end if;
  if not has_function_privilege('authenticated', 'public.panel_vivo(uuid)', 'execute') then raise exception 'Verificación: authenticated no puede ejecutar panel_vivo'; end if;
end $v$;
