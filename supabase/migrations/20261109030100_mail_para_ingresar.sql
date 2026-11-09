-- ═══════════════════════════════════════════════════════════════════
-- F1.2 · BASE-2 / BASE-10 — error con nombre al ingresar con mail.
-- "Ese mail no tiene cuenta en Gimnasio X": solo el servidor puede
-- preguntarlo, después de una contraseña mala y con el tope de intentos
-- fallidos (BASE-8) ya aplicado. Es del servidor: el navegador no puede
-- averiguar quién tiene cuenta.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('privado.es_servicio()') is null then raise exception 'Guarda: falta privado.es_servicio'; end if;
  if to_regprocedure('public.ingreso_permitido(text, text)') is null then raise exception 'Guarda: falta ingreso_permitido (BASE-8)'; end if;
end $$;

create or replace function public.mail_para_ingresar(p_gimnasio_id uuid, p_email text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare mail text := lower(trim(coalesce(p_email, ''))); v_nombre text; v_existe boolean;
begin
  if not privado.es_servicio() then raise exception 'Solo el servidor' using errcode = '42501'; end if;
  select g.nombre into v_nombre from public.gimnasios g where g.id = p_gimnasio_id;
  if v_nombre is null then return jsonb_build_object('gimnasio', null, 'existe', null); end if;
  v_existe := mail <> '' and (
    exists (select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null and lower(s.email) = mail)
    or exists (select 1 from public.equipo e join auth.users u on u.id = e.usuario_id
                where e.gimnasio_id = p_gimnasio_id and e.activo and lower(u.email) = mail));
  return jsonb_build_object('gimnasio', v_nombre, 'existe', v_existe);
end $$;

revoke all on function public.mail_para_ingresar(uuid, text) from public, anon, authenticated;
grant execute on function public.mail_para_ingresar(uuid, text) to service_role;

do $v$ begin
  if has_function_privilege('anon', 'public.mail_para_ingresar(uuid, text)', 'execute') or has_function_privilege('authenticated', 'public.mail_para_ingresar(uuid, text)', 'execute') then
    raise exception 'F1.2: mail_para_ingresar quedó ejecutable desde el navegador';
  end if;
  if not has_function_privilege('service_role', 'public.mail_para_ingresar(uuid, text)', 'execute') then
    raise exception 'F1.2: mail_para_ingresar no es ejecutable por el servidor';
  end if;
end $v$;
