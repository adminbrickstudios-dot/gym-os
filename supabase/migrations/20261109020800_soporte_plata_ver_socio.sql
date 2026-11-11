-- F2 (restricción de plata del soporte) + "ver la app como este socio".
-- 1) El soporte de BRIK que entra a un gimnasio NO puede cargar, cambiar ni borrar plata (ventas, pagos, movimientos y turnos de caja)
--    salvo que, al entrar, se haya marcado que el dueño lo pidió. Queda escrito en el motivo (el dueño lo ve en su Control) y en el registro de BRIK.
--    No cambia quién cobra en el gimnasio: dueño, recepción y profe siguen igual; solo se frena la cuenta de soporte.
-- 2) admin_ver_socio: lectura de lo que vería el socio (acceso con motivo, cobertura, últimos pagos e ingresos). Solo lectura.
-- Parte de pg_get_functiondef de admin_entrar_gimnasio (versión 20261109020200): se le suma un parámetro y la firma vieja se borra.

do $guarda$
begin
  if to_regprocedure('public.admin_entrar_gimnasio(uuid,text,text)') is null and to_regprocedure('public.admin_entrar_gimnasio(uuid,text,text,boolean)') is null then raise exception 'Falta admin_entrar_gimnasio'; end if;
  if to_regclass('public.soportes_gimnasio') is null then raise exception 'Falta soportes_gimnasio'; end if;
  if to_regprocedure('public.estado_acceso(uuid,uuid)') is null then raise exception 'Falta estado_acceso(uuid,uuid)'; end if;
end $guarda$;

alter table public.soportes_gimnasio add column if not exists plata_autorizada boolean not null default false;

-- ¿Quien actúa es soporte de BRIK en este gimnasio, sin permiso de plata vigente?
create or replace function privado.soporte_sin_plata(p_gimnasio uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and exists (select 1 from public.equipo e where e.gimnasio_id = p_gimnasio and e.usuario_id = auth.uid() and e.es_soporte)
    and not exists (select 1 from public.soportes_gimnasio s
                    where s.gimnasio_id = p_gimnasio and s.usuario_id = auth.uid() and s.salio_en is null and s.vence_en > now() and s.plata_autorizada);
$$;
revoke execute on function privado.soporte_sin_plata(uuid) from public, anon, authenticated;

create or replace function privado.frenar_plata_soporte()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_gim uuid := case when tg_op = 'DELETE' then old.gimnasio_id else new.gimnasio_id end;
begin
  if privado.soporte_sin_plata(v_gim) then
    raise exception 'El soporte de BRIK no puede cargar ni cambiar plata en este gimnasio, salvo que el dueño lo haya pedido (se marca al entrar)' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke execute on function privado.frenar_plata_soporte() from public, anon, authenticated;

do $trg$
declare t text;
begin
  foreach t in array array['ventas', 'pagos', 'movimientos_caja', 'turnos_caja'] loop
    if to_regclass('public.' || t) is null then raise exception 'Falta la tabla %', t; end if;
    execute format('drop trigger if exists frenar_plata_soporte on public.%I', t);
    execute format('create trigger frenar_plata_soporte before insert or update or delete on public.%I for each row execute function privado.frenar_plata_soporte()', t);
  end loop;
end $trg$;

-- Entrar como soporte: parámetro opcional "el dueño pidió tocar plata". La firma vieja se borra: dos versiones con defaults hacen ambigua la llamada.
drop function if exists public.admin_entrar_gimnasio(uuid, text, text);
create or replace function public.admin_entrar_gimnasio(p_gimnasio_id uuid, p_motivo text, p_rol text default 'dueno', p_plata boolean default false)
returns text language plpgsql security definer set search_path = '' as $$
declare v_slug text; e public.equipo; n int; v_motivo text := btrim(coalesce(p_motivo, '')); v_rol text := coalesce(nullif(btrim(p_rol), ''), 'dueno'); v_plata boolean := coalesce(p_plata, false);
begin
  perform privado.exigir_brik(array['principal', 'soporte']);
  if v_rol not in ('dueno', 'recepcion', 'profe') then raise exception 'Elegí con qué rol entrar: dueño, recepción o profe' using errcode = '22023'; end if;
  if length(v_motivo) < 5 then raise exception 'Escribí el motivo de la entrada (al menos 5 letras): el dueño lo va a ver en su Control' using errcode = '22023'; end if;
  if length(v_motivo) > 250 then raise exception 'El motivo es muy largo (máximo 250 letras)' using errcode = '22023'; end if;
  select g.slug into v_slug from public.gimnasios g where g.id = p_gimnasio_id;
  if not found then raise exception 'El gimnasio no existe' using errcode = 'P0002'; end if;
  select * into e from public.equipo where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid();
  if found then
    if not e.es_soporte then raise exception 'Tu cuenta es parte del equipo de este gimnasio: entrá con ella, no como soporte'; end if;
    update public.equipo set activo = true, rol = v_rol where id = e.id;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo activar el acceso de soporte'; end if;
  else
    insert into public.equipo (gimnasio_id, usuario_id, nombre, rol, es_soporte) values (p_gimnasio_id, auth.uid(), 'Soporte BRIK', v_rol, true);
  end if;
  update public.soportes_gimnasio set salio_en = now() where gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and salio_en is null;
  insert into public.soportes_gimnasio (gimnasio_id, usuario_id, motivo, rol, plata_autorizada)
    values (p_gimnasio_id, auth.uid(), case when v_plata then v_motivo || ' (el dueño pidió tocar plata)' else v_motivo end, v_rol, v_plata);
  perform privado.registrar_brik('entrar_como_soporte', p_gimnasio_id, jsonb_build_object('rol', v_rol, 'motivo', v_motivo, 'plata', v_plata));
  return v_slug;
end $$;
revoke execute on function public.admin_entrar_gimnasio(uuid, text, text, boolean) from public, anon;
grant execute on function public.admin_entrar_gimnasio(uuid, text, text, boolean) to authenticated;

-- "Ver la app como este socio": solo lectura. No entra a su cuenta ni cambia nada; queda en el registro de BRIK.
create or replace function public.admin_ver_socio(p_gimnasio_id uuid, p_socio_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_socio public.socios; v_est jsonb; v_pagos jsonb; v_ing jsonb;
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'lectura']);
  select * into v_socio from public.socios where id = p_socio_id and gimnasio_id = p_gimnasio_id;
  if not found then raise exception 'El socio no existe en ese gimnasio' using errcode = 'P0002'; end if;
  v_est := to_jsonb(privado.calcular_acceso(p_socio_id, now(), null));
  select coalesce(jsonb_agg(x order by x.creado_en desc), '[]'::jsonb) into v_pagos
    from (select p.creado_en, p.monto, p.medio, p.estado from public.pagos p join public.ventas v on v.id = p.venta_id and v.gimnasio_id = p.gimnasio_id
          where p.gimnasio_id = p_gimnasio_id and v.socio_id = p_socio_id order by p.creado_en desc limit 5) x;
  select coalesce(jsonb_agg(x order by x.momento desc), '[]'::jsonb) into v_ing
    from (select i.momento from public.ingresos i where i.gimnasio_id = p_gimnasio_id and i.socio_id = p_socio_id order by i.momento desc limit 10) x;
  perform privado.registrar_brik('ver_como_socio', p_gimnasio_id, jsonb_build_object('socio_id', p_socio_id));
  return jsonb_build_object('nombre', btrim(coalesce(v_socio.nombre, '') || ' ' || coalesce(v_socio.apellido, '')), 'cubierto_hasta', v_socio.cubierto_hasta,
                            'acceso', v_est, 'ultimos_pagos', v_pagos, 'ultimos_ingresos', v_ing);
end $$;
revoke execute on function public.admin_ver_socio(uuid, uuid) from public, anon;
grant execute on function public.admin_ver_socio(uuid, uuid) to authenticated;

do $verif$
begin
  if (select count(*) from pg_trigger where tgname = 'frenar_plata_soporte' and not tgisinternal) <> 4 then raise exception 'Faltan triggers frenar_plata_soporte'; end if;
  if to_regprocedure('public.admin_entrar_gimnasio(uuid,text,text)') is not null then raise exception 'Quedó la firma vieja de admin_entrar_gimnasio'; end if;
  if to_regprocedure('public.admin_entrar_gimnasio(uuid,text,text,boolean)') is null then raise exception 'Falta admin_entrar_gimnasio nueva'; end if;
  if to_regprocedure('public.admin_ver_socio(uuid,uuid)') is null then raise exception 'Falta admin_ver_socio'; end if;
end $verif$;
