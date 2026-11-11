-- VD-26B · Avisar a BRIK de cada pedido de demo (en las alertas del super admin: se ve el cartel apenas entra uno sin atender)
-- y un interruptor propio de "plan público" (qué planes de BRIK se muestran en la web de Base). Parte de las definiciones de 20261109020700.

do $guarda$
begin
  if to_regprocedure('public.admin_alertas()') is null then raise exception 'Falta admin_alertas'; end if;
  if to_regprocedure('public.admin_planes_con_limites()') is null then raise exception 'Falta admin_planes_con_limites'; end if;
  if to_regprocedure('public.planes_brik_publicos()') is null then raise exception 'Falta planes_brik_publicos'; end if;
end $guarda$;

alter table public.plataforma_planes add column if not exists publico boolean not null default true;

create or replace function public.planes_brik_publicos() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('nombre', p.nombre, 'precio_mensual', p.precio_mensual) order by p.precio_mensual, p.nombre), '[]'::jsonb)
    from public.plataforma_planes p where p.activo and p.publico;
$$;

create or replace function public.admin_planes_con_limites() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'activo', p.activo, 'publico', p.publico, 'max_socios', p.max_socios, 'max_sedes', p.max_sedes,
            'gimnasios', (select count(*)::int from public.gimnasios g where g.plataforma_plan_id = p.id)) order by p.activo desc, p.precio_mensual)
    from public.plataforma_planes p), '[]'::jsonb);
end $$;

create or replace function public.admin_plan_publico(p_plan_id uuid, p_publico boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_brik(array['principal', 'ventas']);
  update public.plataforma_planes set publico = coalesce(p_publico, true) where id = p_plan_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'El plan no existe' using errcode = 'P0002'; end if;
  perform privado.registrar_brik('plan_publico', null, jsonb_build_object('plan_id', p_plan_id, 'publico', coalesce(p_publico, true)));
end $$;
revoke execute on function public.admin_plan_publico(uuid, boolean) from public, anon;
grant execute on function public.admin_plan_publico(uuid, boolean) to authenticated;

create or replace function public.admin_alertas() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare a jsonb := '[]'::jsonb; n int; viejo timestamptz;
begin
  perform privado.exigir_brik(array['principal', 'soporte', 'ventas', 'lectura']);
  select count(*)::int into n from public.errores_app where creado_en > now() - interval '1 hour';
  if n >= 20 then a := a || jsonb_build_array(jsonb_build_object('clave', 'errores_hora', 'nivel', 'rojo', 'texto', n || ' errores en la última hora'));
  elsif n >= 5 then a := a || jsonb_build_array(jsonb_build_object('clave', 'errores_hora', 'nivel', 'amarillo', 'texto', n || ' errores en la última hora')); end if;
  select count(*)::int into n from public.eventos_webhook where error is not null and procesado_en is null and recibido_en > now() - interval '24 hours';
  if n > 0 then a := a || jsonb_build_array(jsonb_build_object('clave', 'webhooks_fallidos', 'nivel', 'rojo', 'texto', n || ' avisos de MercadoPago fallidos en 24 h')); end if;
  select count(*)::int into n from public.gimnasios g where not g.es_demo and g.baja_en is null and privado.estado_abono(g.id) ->> 'estado' = 'vencido';
  if n > 0 then a := a || jsonb_build_array(jsonb_build_object('clave', 'abonos_vencidos', 'nivel', 'amarillo', 'texto', n || ' abonos a BRIK vencidos')); end if;
  select count(*)::int into n from jsonb_array_elements(public.admin_limites_gimnasios()) x where x ->> 'estado' in ('cerca', 'pasado');
  if n > 0 then a := a || jsonb_build_array(jsonb_build_object('clave', 'limites', 'nivel', 'amarillo', 'texto', n || ' gimnasios cerca o por encima del límite de su plan')); end if;
  select count(*)::int into n from jsonb_array_elements(public.admin_tamano_tablas()) x where (x ->> 'partir')::boolean;
  if n > 0 then a := a || jsonb_build_array(jsonb_build_object('clave', 'tablas_grandes', 'nivel', 'amarillo', 'texto', n || ' tablas ya conviene partirlas por mes')); end if;
  -- VD-26B: pedidos de demo que nadie atendió. Rojo si el más viejo lleva más de un día esperando.
  select count(*)::int, min(creado_en) into n, viejo from public.pedidos_demo_brik where atendido_en is null;
  if n > 0 then a := a || jsonb_build_array(jsonb_build_object('clave', 'pedidos_demo', 'nivel', case when viejo < now() - interval '24 hours' then 'rojo' else 'amarillo' end,
    'texto', n || (case when n = 1 then ' pedido de demo sin atender' else ' pedidos de demo sin atender' end)));
  end if;
  return jsonb_build_object('alertas', a, 'hay_rojas', exists (select 1 from jsonb_array_elements(a) x where x ->> 'nivel' = 'rojo'), 'hora', now());
end $$;

do $verif$
begin
  if to_regprocedure('public.admin_plan_publico(uuid,boolean)') is null then raise exception 'Falta admin_plan_publico'; end if;
  if not exists (select 1 from information_schema.columns where table_name = 'plataforma_planes' and column_name = 'publico') then raise exception 'Falta plataforma_planes.publico'; end if;
end $verif$;
