-- 0099 · Invitá a un amigo (REF-1).
-- Cada socio tiene un código (se crea la primera vez que abre "Invitá a un
-- amigo"); su link lleva a "Probá una clase" de la página con ?ref=código y el
-- pedido entra a Prospectos como "referido de X". Un código ajeno no cuenta y
-- no frena el pedido. El premio y el pase de prueba quedan para REF-2 (decide
-- Mateo: tocan quién entra y plata).
--   mi_link_referido(socio) → { codigo, host, invitados, socios }
-- Copias: quiero_probar (0031, con p_ref; se borra la firma vieja) y
-- prospectos_panel (0031, con quién lo refirió).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.vincular_socios_por_email(uuid, uuid)') is null then raise exception 'Guarda: falta la migración 0098'; end if;
end $$;

alter table public.socios add column if not exists codigo_referido text check (codigo_referido is null or codigo_referido ~ '^[A-Z0-9]{6}$');
create unique index if not exists socios_codigo_referido on public.socios (gimnasio_id, codigo_referido) where codigo_referido is not null;
alter table public.prospectos add column if not exists referido_por uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'prospectos_referido_por_fk') then
    alter table public.prospectos add constraint prospectos_referido_por_fk foreign key (gimnasio_id, referido_por) references public.socios (gimnasio_id, id);
  end if;
end $$;

drop function if exists public.quiero_probar(text, text, text, text);

create or replace function public.quiero_probar(p_host text, p_nombre text, p_telefono text, p_interes text default null, p_ref text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; tel text; ref uuid; nom text := trim(coalesce(p_nombre, '')); v_interes text := nullif(trim(coalesce(p_interes, '')), '');
begin
  select d.gimnasio_id into g from public.dominios_gimnasio d
    join public.landing_gimnasio l on l.gimnasio_id = d.gimnasio_id and l.publicada
    join public.landing_secciones s on s.gimnasio_id = d.gimnasio_id and s.tipo = 'probar' and s.visible
   where d.host = lower(p_host);
  if g is null then raise exception 'Este gimnasio no está recibiendo pedidos desde la página.'; end if;
  -- REF-1: el link de un socio ("?ref=código"); un código que no es de este gimnasio no cuenta (y no frena el pedido).
  if nullif(trim(coalesce(p_ref, '')), '') is not null then
    select s.id into ref from public.socios s where s.gimnasio_id = g and s.codigo_referido = upper(trim(p_ref)) and s.dado_de_baja_en is null;
  end if;
  if length(nom) = 0 then raise exception 'Escribí tu nombre.'; end if;
  if length(nom) > 80 then raise exception 'El nombre es muy largo (hasta 80 letras).'; end if;
  if v_interes is not null and length(v_interes) > 200 then raise exception 'Lo que te interesa: hasta 200 letras.'; end if;
  begin
    tel := privado.telefono_normalizado(p_telefono, 'WhatsApp');
  exception when others then
    raise exception 'Revisá el WhatsApp: con característica, por ejemplo 387 555 1234.';
  end;
  if tel is null then raise exception 'Dejanos tu WhatsApp para escribirte.'; end if;
  -- El mismo celular no se duplica: se actualiza su pedido y vuelve a "nuevo" si ya se había cerrado sin éxito.
  if exists (select 1 from public.prospectos p where p.gimnasio_id = g and p.telefono = tel) then
    update public.prospectos p set nombre = nom, interes = coalesce(v_interes, p.interes), actualizado_en = now(),
      referido_por = coalesce(p.referido_por, ref), origen = case when p.referido_por is null and ref is not null then 'referido' else p.origen end,
      estado = case when p.estado = 'no' then 'nuevo' else p.estado end
     where p.gimnasio_id = g and p.telefono = tel;
    return jsonb_build_object('ok', true, 'repetido', true);
  end if;
  if (select count(*) from public.prospectos p where p.gimnasio_id = g and p.origen in ('pagina', 'referido')
        and p.creado_en > now() - interval '1 hour') >= 30 then
    raise exception 'Recibimos muchos pedidos en este momento. Probá en un rato o escribinos por WhatsApp.';
  end if;
  insert into public.prospectos (gimnasio_id, nombre, telefono, interes, origen, referido_por)
  values (g, nom, tel, v_interes, case when ref is null then 'pagina' else 'referido' end, ref);
  return jsonb_build_object('ok', true, 'repetido', false);
end $$;

create or replace function public.prospectos_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare plantilla text; gim text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.nombre into gim from public.gimnasios g where g.id = p_gimnasio_id;
  select coalesce(p.texto, (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = 'prospecto'))
    into plantilla from public.plantillas_mensaje p where p.gimnasio_id = p_gimnasio_id and p.clave = 'prospecto';
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'nombre', p.nombre, 'telefono', p.telefono, 'interes', p.interes, 'origen', p.origen, 'estado', p.estado,
      'nota', p.nota, 'socio_id', p.socio_id, 'creado_en', p.creado_en, 'actualizado_en', p.actualizado_en,
      'referido_por', (select trim(r.nombre || ' ' || r.apellido) from public.socios r where r.id = p.referido_por), 'referido_por_id', p.referido_por,
      'mensaje', privado.armar_mensaje(plantilla, jsonb_build_object('nombre', split_part(p.nombre, ' ', 1), 'gimnasio', gim)))
      order by (p.estado = 'nuevo') desc, p.creado_en desc), '[]')
    from public.prospectos p where p.gimnasio_id = p_gimnasio_id);
end $$;

create or replace function public.mi_link_referido(p_socio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.socios; cod text; host text; intento int := 0;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.socios where id = p_socio_id;
  -- Solo si la página recibe pedidos ("Probá una clase" a la vista): si no, el link no llevaría a ningún lado.
  select d.host into host from public.dominios_gimnasio d
    join public.landing_gimnasio l on l.gimnasio_id = d.gimnasio_id and l.publicada
    join public.landing_secciones x on x.gimnasio_id = d.gimnasio_id and x.tipo = 'probar' and x.visible
   where d.gimnasio_id = s.gimnasio_id order by (d.tipo = 'propio' and d.verificado_en is not null) desc, d.creado_en limit 1;
  if host is null then return null; end if;
  cod := s.codigo_referido;
  while cod is null loop
    intento := intento + 1;
    cod := upper(substr(translate(encode(extensions.gen_random_bytes(8), 'base64'), '+/=0O1I', ''), 1, 6));
    if length(cod) < 6 or exists (select 1 from public.socios x where x.gimnasio_id = s.gimnasio_id and x.codigo_referido = cod) then
      cod := null; if intento > 10 then raise exception 'No se pudo armar el link'; end if; continue;
    end if;
    update public.socios set codigo_referido = cod where id = s.id and codigo_referido is null;
  end loop;
  return jsonb_build_object('codigo', cod, 'host', host,
    'invitados', (select count(*) from public.prospectos p where p.referido_por = s.id),
    'socios', (select count(*) from public.prospectos p where p.referido_por = s.id and p.socio_id is not null));
end $$;

revoke all on function public.quiero_probar(text, text, text, text, text), public.prospectos_panel(uuid), public.mi_link_referido(uuid) from public, anon, authenticated;
grant execute on function public.quiero_probar(text, text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.prospectos_panel(uuid), public.mi_link_referido(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if to_regprocedure('public.quiero_probar(text, text, text, text)') is not null then raise exception 'Verificación: quedó la firma vieja de quiero_probar'; end if;
  foreach f in array array['public.quiero_probar(text, text, text, text, text)', 'public.prospectos_panel(uuid)', 'public.mi_link_referido(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
  end loop;
  if has_function_privilege('anon', 'public.mi_link_referido(uuid)', 'execute') then raise exception 'Verificación: anon puede pedir links'; end if;
end $$;
