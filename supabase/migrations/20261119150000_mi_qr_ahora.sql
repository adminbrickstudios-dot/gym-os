-- Paneles completos (19/11) · mi_qr devuelve también 'ahora' (la hora de la base). Con eso el navegador mide cuánto adelanta o atrasa su reloj y no pide
-- un QR nuevo sin parar cuando el celular tiene la hora corrida (cada QR nacía "vencido"). Aditiva: mismas columnas de siempre, una clave más en el json;
-- el código anterior la ignora. Mismos permisos (create or replace conserva los grants).
do $g$ begin
  if to_regprocedure('public.mi_qr(uuid, uuid, timestamptz)') is null then raise exception 'Guarda: falta public.mi_qr'; end if;
end $g$;

create or replace function public.mi_qr(p_gimnasio_id uuid, p_socio_id uuid, p_momento timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.socios; sec bytea; v bigint;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  select * into s from public.socios where id = p_socio_id and gimnasio_id = p_gimnasio_id and usuario_id = auth.uid();
  if s.id is null then raise exception 'Sin permiso para ver ese socio' using errcode = '42501'; end if;
  if s.dado_de_baja_en is not null then raise exception 'Estás dado de baja en este gimnasio.'; end if;
  if not exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id and 'qr_socio' = any (c.accesos_activos)) then
    raise exception 'Este gimnasio no usa QR para entrar.' using errcode = '22023';
  end if;
  insert into privado.credenciales_qr (gimnasio_id, socio_id) values (p_gimnasio_id, s.id) on conflict (gimnasio_id, socio_id) do nothing;
  select c.secreto into sec from privado.credenciales_qr c where c.gimnasio_id = p_gimnasio_id and c.socio_id = s.id;
  v := privado.ventana_qr(p_momento);
  return jsonb_build_object('codigo', 'GYMOS1.' || s.id || '.' || v || '.' || privado.firma_qr(sec, s.id, v),
                            'vence_en', to_timestamp((v + 1) * 30),
                            'ahora', p_momento);
end $$;

do $v$ begin
  if position('''ahora''' in pg_get_functiondef('public.mi_qr(uuid, uuid, timestamptz)'::regprocedure)) = 0 then raise exception 'Verificación: mi_qr no devuelve ahora'; end if;
  if has_function_privilege('anon', 'public.mi_qr(uuid, uuid, timestamptz)', 'execute') then raise exception 'Verificación: anon puede ejecutar mi_qr'; end if;
end $v$;
