-- Paneles completos (19/11) · Alta en el kiosco para quien llega sin cuenta: cuando la tablet no encuentra el DNI, muestra un QR a "Hacete socio" del gimnasio.
-- Para eso la tablet pregunta (con su token, como todo lo suyo) cuál es el slug del gimnasio SOLO si el gimnasio tiene las altas online prendidas
-- (configuracion_gimnasio.altas_online, apagada por defecto): con las altas apagadas contesta null y la tablet no muestra nada. No devuelve ningún dato de socios.
do $g$ begin
  if to_regprocedure('privado.tablet_del_token(text)') is null then raise exception 'Guarda: falta privado.tablet_del_token'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'altas_online') then
    raise exception 'Guarda: falta configuracion_gimnasio.altas_online';
  end if;
end $g$;

create or replace function public.kiosco_alta(p_token text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare d public.dispositivos;
begin
  d := privado.tablet_del_token(p_token);   -- token malo: error, como el resto de la tablet
  return (select gi.slug from public.gimnasios gi join public.configuracion_gimnasio c on c.gimnasio_id = gi.id
           where gi.id = d.gimnasio_id and c.altas_online);
end $$;
revoke all on function public.kiosco_alta(text) from public, anon, authenticated;
grant execute on function public.kiosco_alta(text) to anon, authenticated, service_role;

do $v$ begin
  if not exists (select 1 from pg_proc where oid = 'public.kiosco_alta(text)'::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: kiosco_alta sin search_path vacío'; end if;
end $v$;
