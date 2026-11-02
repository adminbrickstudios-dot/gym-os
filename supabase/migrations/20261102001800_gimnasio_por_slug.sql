-- ═══════════════════════════════════════════════════════════════════
-- 0018 · Entrar al panel desde la dirección de la plataforma.
--
-- El dueño (y su equipo) puede entrar desde la dirección de Gym OS,
-- sin que su gimnasio tenga dominio propio todavía. El gimnasio elegido
-- viaja en una cookie con su slug; esta función lo resuelve igual que
-- gimnasio_por_host resuelve una dirección. Elegir un gimnasio no da
-- ningún permiso: cada pantalla valida en la base que la persona sea de
-- su equipo (exigir_equipo).
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.gimnasio_por_host(text)') is null then raise exception 'Guarda: falta la migración 0001'; end if;
end $$;

create or replace function public.gimnasio_por_slug(p_slug text)
returns table (gimnasio_id uuid, slug text, nombre text, zona_horaria text,
               logo_path text, favicon_path text, color_acento text, color_fondo text)
language sql stable security definer set search_path = '' as $$
  select g.id, g.slug, g.nombre, g.zona_horaria, c.logo_path, c.favicon_path, c.color_acento, c.color_fondo
    from public.gimnasios g
    join public.configuracion_gimnasio c on c.gimnasio_id = g.id
   where g.slug = lower(p_slug)
$$;
revoke all on function public.gimnasio_por_slug(text) from public, anon, authenticated;
grant execute on function public.gimnasio_por_slug(text) to anon, authenticated, service_role;

do $$
begin
  if not has_function_privilege('anon', 'public.gimnasio_por_slug(text)', 'execute') then
    raise exception 'Verificación: el middleware (anon) no puede resolver el gimnasio por slug';
  end if;
end $$;
