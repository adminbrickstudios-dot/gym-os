-- ═══════════════════════════════════════════════════════════════════
-- 0026 · "Primeros pasos" del dueño en Inicio (ONB-1) y publicar la página.
--
-- El progreso SE CALCULA de los datos (nunca se guarda un "paso hecho"):
-- datos del gimnasio, logo, planes con precio, horarios (y grilla de
-- clases si las usa), cómo le pagan, equipo, socios y página publicada.
-- Lo único que se guarda es si el dueño lo ocultó
-- (configuracion_gimnasio.onboarding_salteado_en, que ya existía).
--
-- publicar_pagina: el dueño publica o vuelve a borrador su página. Sin
-- esto, una página nueva quedaba en "próximamente" para siempre (solo se
-- publicaba desde la base).
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.horarios_apertura') is null then raise exception 'Guarda: falta la migración 0024'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio'
                  and column_name = 'medios_aceptados') then raise exception 'Guarda: falta la migración 0023'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio'
                  and column_name = 'onboarding_salteado_en') then raise exception 'Guarda: falta onboarding_salteado_en'; end if;
end $$;

create or replace function privado.primeros_pasos(p_gimnasio_id uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare c public.configuracion_gimnasio; l public.landing_gimnasio; con_clases boolean;
begin
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  select * into l from public.landing_gimnasio where gimnasio_id = p_gimnasio_id;
  con_clases := c.modo_clases <> 'ninguno';
  return jsonb_build_array(
    jsonb_build_object('clave', 'gimnasio', 'emoji', '🏠', 'titulo', 'Tus datos y dónde queda',
      'ayuda', 'WhatsApp o mail de contacto, y la dirección.', 'href', '/configuracion?pestana=gimnasio',
      'hecho', (l.whatsapp is not null or l.email_contacto is not null)
               and exists (select 1 from public.sedes s where s.gimnasio_id = p_gimnasio_id and s.activa and s.direccion is not null)),
    jsonb_build_object('clave', 'marca', 'emoji', '🎨', 'titulo', 'Tu logo y tus colores',
      'ayuda', 'Para que el panel, la página y la app sean tuyos.', 'href', '/configuracion?pestana=marca',
      'hecho', c.logo_path is not null),
    jsonb_build_object('clave', 'planes', 'emoji', '🏷️', 'titulo', 'Tus planes y precios',
      'ayuda', 'Lo que vendés y cuánto cuesta.', 'href', '/planes',
      'hecho', exists (select 1 from public.planes p where p.gimnasio_id = p_gimnasio_id and p.activo
                         and privado.precio_base(p.id, now()) is not null)),
    jsonb_build_object('clave', 'horarios', 'emoji', '⏰', 'titulo', case when con_clases then 'Horarios y clases' else 'Tus horarios' end,
      'ayuda', case when con_clases then 'Cuándo abrís y la grilla de clases de la semana.' else 'Cuándo abrís cada día.' end,
      'href', case when con_clases and exists (select 1 from public.horarios_apertura h where h.gimnasio_id = p_gimnasio_id)
                   then '/clases/grilla' else '/configuracion?pestana=horarios' end,
      'hecho', exists (select 1 from public.horarios_apertura h where h.gimnasio_id = p_gimnasio_id)
               and (not con_clases or exists (select 1 from public.horarios_clase h where h.gimnasio_id = p_gimnasio_id))),
    jsonb_build_object('clave', 'cobros', 'emoji', '💳', 'titulo', 'Cómo te pagan',
      'ayuda', 'Medios de pago y tu alias para las transferencias.', 'href', '/configuracion?pestana=cobros',
      'hecho', not ('transferencia' = any (c.medios_aceptados)) or c.alias_transferencia is not null or c.cbu is not null),
    jsonb_build_object('clave', 'equipo', 'emoji', '🧑‍🤝‍🧑', 'titulo', 'Tu equipo',
      'ayuda', 'Recepción, profes y encargados, cada uno con su usuario.', 'href', '/equipo',
      'hecho', exists (select 1 from public.equipo e where e.gimnasio_id = p_gimnasio_id and e.activo and e.rol <> 'dueno' and not e.es_soporte)),
    jsonb_build_object('clave', 'socios', 'emoji', '👥', 'titulo', 'Tus socios',
      'ayuda', 'Cargá los que ya tenés.', 'href', '/socios/nuevo',
      'hecho', exists (select 1 from public.socios s where s.gimnasio_id = p_gimnasio_id)),
    jsonb_build_object('clave', 'pagina', 'emoji', '🌐', 'titulo', 'Publicar tu página',
      'ayuda', 'Para que la gente te encuentre y vea tus precios.', 'href', '/configuracion?pestana=pagina',
      'hecho', coalesce(l.publicada, false))
  );
end $$;

create or replace function public.primeros_pasos(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare pasos jsonb;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  pasos := privado.primeros_pasos(p_gimnasio_id);
  return jsonb_build_object(
    'pasos', pasos,
    'hechos', (select count(*) from jsonb_array_elements(pasos) x where (x ->> 'hecho')::boolean),
    'total', jsonb_array_length(pasos),
    'oculto', (select c.onboarding_salteado_en is not null from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id));
end $$;

create or replace function public.ocultar_primeros_pasos(p_gimnasio_id uuid, p_ocultar boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  update public.configuracion_gimnasio set onboarding_salteado_en = case when p_ocultar then now() end, actualizado_en = now()
   where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar'; end if;
end $$;

create or replace function public.publicar_pagina(p_gimnasio_id uuid, p_publicada boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_publicada is null then raise exception 'Datos inválidos'; end if;
  insert into public.landing_gimnasio (gimnasio_id, titulo)
  select g.id, g.nombre from public.gimnasios g where g.id = p_gimnasio_id
  on conflict (gimnasio_id) do nothing;
  update public.landing_gimnasio set publicada = p_publicada where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo cambiar la página'; end if;
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function privado.primeros_pasos(uuid) from public, anon, authenticated;
revoke all on function public.primeros_pasos(uuid), public.ocultar_primeros_pasos(uuid, boolean), public.publicar_pagina(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.primeros_pasos(uuid), public.ocultar_primeros_pasos(uuid, boolean), public.publicar_pagina(uuid, boolean)
  to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'privado' and p.proname = 'primeros_pasos')
               or (s.nspname = 'public' and p.proname in ('primeros_pasos', 'ocultar_primeros_pasos', 'publicar_pagina')) loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
  if exists (select 1 from public.gimnasios g where jsonb_array_length(privado.primeros_pasos(g.id)) <> 8) then
    raise exception 'Verificación: primeros pasos no devuelve los 8 pasos';
  end if;
end $$;
