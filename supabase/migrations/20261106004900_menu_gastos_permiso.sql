-- VD-11 · Menú nuevo: el encargado sin permiso no ve "Gastos".
-- panel_gimnasio ya apagaba "resultado" para el encargado sin permiso (EQU-1);
-- ahora apaga también "gastos" si el dueño no le prendió encargado_ve_gastos
-- (VD-41b), y manda ese permiso con los demás. La base exige el permiso igual
-- (privado.exigir_gastos): esto solo saca la sección del menú, de Ctrl+K, de
-- los accesos rápidos y de la entrada por dirección.
-- Misma firma que antes: se reemplaza, no hay dos versiones.

do $$
begin
  if to_regprocedure('public.panel_gimnasio(uuid)') is null then
    raise exception 'Falta public.panel_gimnasio(uuid)';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'encargado_ve_gastos') then
    raise exception 'Falta configuracion_gimnasio.encargado_ve_gastos (VD-41)';
  end if;
end $$;

create or replace function public.panel_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; g public.gimnasios; c public.configuracion_gimnasio; apagadas text[];
begin
  e := privado.exigir_equipo(p_gimnasio_id);
  select * into g from public.gimnasios where id = p_gimnasio_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  apagadas := c.secciones_apagadas;
  if c.modo_clases = 'ninguno' then apagadas := apagadas || array['clases']; end if;
  -- EQU-1: para el encargado sin permiso, el Resultado no existe (ni en el menú ni entrando por la dirección).
  if e.rol = 'encargado' and not c.encargado_ve_resultado then apagadas := apagadas || array['resultado']; end if;
  -- VD-41b: lo mismo con los Gastos (apagado de origen: hay sueldos).
  if e.rol = 'encargado' and not coalesce(c.encargado_ve_gastos, false) then apagadas := apagadas || array['gastos']; end if;
  return jsonb_build_object(
    'gimnasio', jsonb_build_object('id', g.id, 'slug', g.slug, 'nombre', g.nombre, 'zona_horaria', g.zona_horaria),
    'marca', jsonb_build_object('logo_path', c.logo_path, 'favicon_path', c.favicon_path,
                                'color_acento', c.color_acento, 'color_fondo', c.color_fondo),
    'yo', jsonb_build_object('equipo_id', e.id, 'nombre', e.nombre, 'rol', e.rol, 'sede_id', e.sede_id,
                             'accesos', e.preferencias -> 'accesos'),
    'secciones_apagadas', to_jsonb(apagadas),
    'modo_clases', c.modo_clases,
    'permisos', jsonb_build_object('recepcion_ve_cobrado', c.recepcion_ve_cobrado, 'recepcion_vende_productos', c.recepcion_vende_productos,
                                   'profe_ve_telefono', c.profe_ve_telefono, 'encargado_ve_resultado', c.encargado_ve_resultado,
                                   'encargado_ve_gastos', coalesce(c.encargado_ve_gastos, false)),
    'cobra', jsonb_build_object('membresia', c.cobra_membresia, 'pase', c.cobra_pase, 'pack', c.cobra_pack),
    'sedes', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre, 'es_principal', s.es_principal)
                                        order by s.es_principal desc, s.nombre)
                         from public.sedes s
                        where s.gimnasio_id = g.id and s.activa and (e.sede_id is null or s.id = e.sede_id)), '[]'::jsonb)
  );
end $$;

revoke execute on function public.panel_gimnasio(uuid) from public;
grant execute on function public.panel_gimnasio(uuid) to authenticated;

do $$
begin
  if pg_get_functiondef('public.panel_gimnasio(uuid)'::regprocedure) not like '%encargado_ve_gastos%' then
    raise exception 'panel_gimnasio no quedó con el permiso de gastos';
  end if;
  if has_function_privilege('anon', 'public.panel_gimnasio(uuid)', 'execute') then
    raise exception 'panel_gimnasio no debe poder ejecutarla anon';
  end if;
end $$;
