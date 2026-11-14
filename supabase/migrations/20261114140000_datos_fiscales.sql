-- F2.10 (SA-3 Datos) · CUIT y razón social de cada gimnasio, para la factura de BRIK. Los carga y cambia el super admin (rol Principal o
-- Ventas), con el CUIT validado (11 cifras y dígito verificador) y con registro de quién lo cambió y qué había antes (registro_brik).
-- No cambia nada de lo que ve el gimnasio ni la plata: son datos del cliente para facturarle.
do $g$ begin
  if to_regclass('public.configuracion_gimnasio') is null then raise exception 'Guarda: falta configuracion_gimnasio'; end if;
  if to_regprocedure('privado.exigir_brik(text[])') is null then raise exception 'Guarda: falta privado.exigir_brik'; end if;
  if to_regprocedure('privado.registrar_brik(text, uuid, jsonb)') is null then raise exception 'Guarda: falta privado.registrar_brik'; end if;
end $g$;

alter table public.configuracion_gimnasio add column if not exists cuit_facturacion text;
alter table public.configuracion_gimnasio add column if not exists razon_social text;

do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_cuit_formato') then
    alter table public.configuracion_gimnasio add constraint configuracion_cuit_formato check (cuit_facturacion is null or cuit_facturacion ~ '^[0-9]{11}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'configuracion_razon_social_largo') then
    alter table public.configuracion_gimnasio add constraint configuracion_razon_social_largo check (razon_social is null or char_length(razon_social) between 2 and 120);
  end if;
end $c$;

-- El dígito verificador del CUIT/CUIL: pesos 5,4,3,2,7,6,5,4,3,2 sobre las primeras 10 cifras; resto = 11 - (suma mod 11); 11 → 0; 10 no existe.
create or replace function privado.cuit_valido(p_cuit text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare pesos int[] := array[5,4,3,2,7,6,5,4,3,2]; suma int := 0; resto int; dv int;
begin
  if p_cuit is null or p_cuit !~ '^[0-9]{11}$' then return false; end if;
  for i in 1..10 loop suma := suma + substr(p_cuit, i, 1)::int * pesos[i]; end loop;
  resto := 11 - (suma % 11);
  dv := case resto when 11 then 0 else resto end;
  if dv = 10 then return false; end if;
  return dv = substr(p_cuit, 11, 1)::int;
end $$;
revoke all on function privado.cuit_valido(text) from public;

create or replace function public.admin_guardar_datos_fiscales(p_gimnasio_id uuid, p_cuit text, p_razon_social text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  cuit text := nullif(regexp_replace(coalesce(p_cuit, ''), '[^0-9]', '', 'g'), '');
  razon text := nullif(btrim(coalesce(p_razon_social, '')), '');
  antes public.configuracion_gimnasio; n int;
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  if (cuit is null and btrim(coalesce(p_cuit, '')) <> '') or (cuit is not null and not privado.cuit_valido(cuit)) then
    raise exception 'El CUIT no es válido: revisá las 11 cifras (la última es el dígito verificador)' using errcode = '22023';
  end if;
  if razon is not null and char_length(razon) not between 2 and 120 then
    raise exception 'La razón social tiene que tener entre 2 y 120 letras' using errcode = '22023';
  end if;
  select * into antes from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  if not found then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  update public.configuracion_gimnasio set cuit_facturacion = cuit, razon_social = razon where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar: el gimnasio no existe' using errcode = 'P0002'; end if;
  perform privado.registrar_brik('guardar_datos_fiscales', p_gimnasio_id, jsonb_build_object(
    'cuit_antes', antes.cuit_facturacion, 'cuit', cuit, 'razon_social_antes', antes.razon_social, 'razon_social', razon));
end $$;
revoke execute on function public.admin_guardar_datos_fiscales(uuid, text, text) from public, anon;
grant execute on function public.admin_guardar_datos_fiscales(uuid, text, text) to authenticated;

-- Lo que muestra la pestaña Datos: lo guardado y quién lo cambió por última vez.
create or replace function public.admin_datos_fiscales(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.configuracion_gimnasio; r record;
begin
  if not privado.soy_admin_plataforma() then raise exception 'Solo para administradores de la plataforma' using errcode = '42501'; end if;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  if not found then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  select u.email, rb.creado_en into r
    from public.registro_brik rb left join auth.users u on u.id = rb.usuario_id
   where rb.gimnasio_id = p_gimnasio_id and rb.accion = 'guardar_datos_fiscales'
   order by rb.creado_en desc limit 1;
  return jsonb_build_object('cuit', c.cuit_facturacion, 'razon_social', c.razon_social, 'cambiado_por', r.email, 'cambiado_en', r.creado_en);
end $$;
revoke execute on function public.admin_datos_fiscales(uuid) from public, anon;
grant execute on function public.admin_datos_fiscales(uuid) to authenticated;

do $v$ begin
  if not privado.cuit_valido('20123456786') then raise exception 'Verificación: el CUIT de ejemplo 20-12345678-6 tendría que ser válido'; end if;
  if privado.cuit_valido('20123456787') or privado.cuit_valido('2012345678') or privado.cuit_valido('abc') then raise exception 'Verificación: acepta un CUIT inválido'; end if;
  if has_function_privilege('anon', 'public.admin_guardar_datos_fiscales(uuid, text, text)', 'execute') then raise exception 'Verificación: anon puede guardar datos fiscales'; end if;
  if has_function_privilege('anon', 'public.admin_datos_fiscales(uuid)', 'execute') then raise exception 'Verificación: anon puede leer datos fiscales'; end if;
end $v$;
