-- Pase 2.0 · organización (26/11): el marco del panel sabe si la llave pase_2_organizacion está prendida SIN un viaje más a la base.
-- contexto_pantalla (el viaje que ya hace cada pantalla) suma el campo 'organizacion' (true/false). EXPANDIR: el código anterior no lo lee.

do $g$ begin
  if to_regprocedure('public.contexto_pantalla(uuid)') is null then raise exception 'Guarda: falta contexto_pantalla'; end if;
  if to_regprocedure('privado.funcion_activa(uuid, text)') is null then raise exception 'Guarda: falta privado.funcion_activa'; end if;
  if not exists (select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where c ->> 'clave' = 'pase_2_organizacion') then
    raise exception 'Guarda: falta la llave pase_2_organizacion (20261126100000)';
  end if;
end $g$;

do $ctx$
declare def text; ancla constant text := 'r := jsonb_build_object(''panel'', panel);';
begin
  def := pg_get_functiondef('public.contexto_pantalla(uuid)'::regprocedure);
  if position('''organizacion''' in def) = 0 then
    if position(ancla in def) = 0 then raise exception 'Guarda: contexto_pantalla no arma la respuesta como se esperaba'; end if;
    def := replace(def, ancla, ancla || '
  -- Pase 2.0 · organización: la llave del menú en bloques y ver sin entrar.
  r := r || jsonb_build_object(''organizacion'', privado.funcion_activa(p_gimnasio_id, ''pase_2_organizacion''));');
    execute def;
  end if;
end $ctx$;

do $v$ begin
  if position('''organizacion''' in pg_get_functiondef('public.contexto_pantalla(uuid)'::regprocedure)) = 0 then raise exception 'Verificación: contexto_pantalla sin organizacion'; end if;
  if not exists (select 1 from pg_proc where oid = 'public.contexto_pantalla(uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: contexto_pantalla sin search_path vacío'; end if;
  if has_function_privilege('anon', 'public.contexto_pantalla(uuid)', 'execute') then raise exception 'Verificación: anon puede ejecutar contexto_pantalla'; end if;
  if not has_function_privilege('authenticated', 'public.contexto_pantalla(uuid)', 'execute') then raise exception 'Verificación: authenticated no puede ejecutar contexto_pantalla'; end if;
end $v$;
