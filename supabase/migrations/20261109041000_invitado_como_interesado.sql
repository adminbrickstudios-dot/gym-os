-- FA-24 (carril D) · El invitado de un socio (el pase ya existe, INV-1) queda como interesado, con quién lo trajo.
-- El invitado se anota con nombre y DNI (sin teléfono), así que para seguirlo hace falta que la recepción escriba su WhatsApp.
--   prospectos.invitado_id                          el invitado del que salió (null = otro origen); uno por invitado
--   invitados_sin_seguimiento(gimnasio)             los invitados de los últimos 30 días que todavía no son interesados
--   invitado_a_interesado(invitado, whatsapp)       lo anota como interesado (origen "referido"), con "Invitado de <socio>"
-- Dueño, encargado y recepción. Aditiva e idempotente; no cambia ninguna función existente.

do $g$ begin
  if to_regclass('public.invitados') is null or to_regclass('public.prospectos') is null then raise exception 'FA-24: faltan invitados o prospectos'; end if;
  if to_regprocedure('privado.telefono_normalizado(text, text)') is null then raise exception 'FA-24: falta privado.telefono_normalizado'; end if;
end $g$;

alter table public.prospectos add column if not exists invitado_id uuid;
do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'prospectos_invitado_fk') then
    alter table public.prospectos add constraint prospectos_invitado_fk foreign key (gimnasio_id, invitado_id) references public.invitados (gimnasio_id, id);
  end if;
end $c$;
create unique index if not exists prospectos_un_invitado on public.prospectos (gimnasio_id, invitado_id) where invitado_id is not null;

create or replace function public.invitados_sin_seguimiento(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return coalesce((
    select jsonb_agg(jsonb_build_object('invitado_id', i.id, 'nombre', i.nombre, 'invito', s.nombre || ' ' || s.apellido, 'socio_id', s.id, 'dia', i.para_el_dia) order by i.para_el_dia desc)
      from public.invitados i join public.socios s on s.id = i.socio_id and s.gimnasio_id = i.gimnasio_id
     where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.para_el_dia > now() - interval '30 days'
       and not exists (select 1 from public.prospectos p where p.gimnasio_id = i.gimnasio_id and p.invitado_id = i.id)), '[]'::jsonb);
end $$;

create or replace function public.invitado_a_interesado(p_invitado_id uuid, p_whatsapp text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare i public.invitados; quien text; tel text; v_id uuid;
begin
  select * into i from public.invitados where id = p_invitado_id;
  if not found then raise exception 'Sin permiso o invitado inexistente' using errcode = '42501'; end if;
  perform privado.exigir_equipo(i.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if i.anulado_en is not null then raise exception 'Esa invitación está anulada' using errcode = '22023'; end if;
  tel := privado.telefono_normalizado(p_whatsapp, 'WhatsApp');
  if tel is null then raise exception 'WhatsApp: escribilo con característica, por ejemplo 387 555 1234.' using errcode = '22023'; end if;
  if exists (select 1 from public.prospectos p where p.gimnasio_id = i.gimnasio_id and p.invitado_id = i.id) then
    raise exception 'Ese invitado ya está como interesado.' using errcode = '22023';
  end if;
  if exists (select 1 from public.prospectos p where p.gimnasio_id = i.gimnasio_id and p.telefono = tel) then
    raise exception 'Ya hay un interesado con ese WhatsApp.' using errcode = '22023';
  end if;
  select s.nombre || ' ' || s.apellido into quien from public.socios s where s.id = i.socio_id;
  insert into public.prospectos (gimnasio_id, nombre, telefono, interes, origen, invitado_id)
  values (i.gimnasio_id, i.nombre, tel, left('Invitado de ' || quien, 200), 'referido', i.id) returning id into v_id;
  return v_id;
end $$;

revoke all on function public.invitados_sin_seguimiento(uuid), public.invitado_a_interesado(uuid, text) from public, anon, authenticated;
grant execute on function public.invitados_sin_seguimiento(uuid), public.invitado_a_interesado(uuid, text) to authenticated, service_role;

do $v$ begin
  if has_function_privilege('anon', 'public.invitado_a_interesado(uuid, text)', 'execute') or has_function_privilege('anon', 'public.invitados_sin_seguimiento(uuid)', 'execute') then
    raise exception 'FA-24: no es para anónimos';
  end if;
end $v$;
