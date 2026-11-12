-- Carril F9 · F9.2 (EDIT-D04) y F9.3 (WEB-06).
--   1. Funciones nuevas por gimnasio, APAGADAS por defecto (los demos las tienen prendidas): tabla funciones_gimnasio.
--   2. Restaurar un cambio de Configuración desde "Cambios": el dueño vuelve un valor al que tenía antes. Lo que toca
--      plata (CBU, alias, medios de pago, descuentos, qué se cobra) o la puerta (formas de entrada, días de gracia) NO se
--      restaura desde acá: se cambia a mano en su pantalla (ver PREGUNTAS.md). Restaurar también deja su fila en el historial.
--   3. Términos y condiciones por gimnasio: texto propio, publicado solo si el dueño lo decide (apagado por defecto).
-- Aditiva: no cambia ninguna función existente.

do $$
begin
  if to_regclass('public.historial_configuracion') is null then raise exception 'Guarda: falta historial_configuracion'; end if;
  if to_regclass('public.configuracion_gimnasio') is null then raise exception 'Guarda: falta configuracion_gimnasio'; end if;
  if to_regclass('public.plantillas_mensaje') is null then raise exception 'Guarda: falta plantillas_mensaje'; end if;
  if to_regprocedure('privado.exigir_brik(text[])') is null then raise exception 'Guarda: falta privado.exigir_brik'; end if;
  if to_regprocedure('privado.registrar_brik(text, uuid, jsonb)') is null then raise exception 'Guarda: falta privado.registrar_brik'; end if;
  if to_regprocedure('privado.valor_legible(text, jsonb)') is null then raise exception 'Guarda: falta privado.valor_legible'; end if;
end $$;

-- ── 1 · Funciones nuevas por gimnasio ───────────────────────────────
create table if not exists public.funciones_gimnasio (
  gimnasio_id    uuid not null references public.gimnasios(id),
  clave          text not null check (clave in ('restaurar_cambios')),
  activa         boolean not null default false,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid,
  primary key (gimnasio_id, clave)
);
select privado.politicas_estandar('public.funciones_gimnasio', array['dueno', 'encargado'], null);
revoke all on table public.funciones_gimnasio from anon;

-- Prendida si el gimnasio la prendió, o si es demo.
create or replace function privado.funcion_nueva(p_gimnasio_id uuid, p_clave text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select f.activa from public.funciones_gimnasio f where f.gimnasio_id = p_gimnasio_id and f.clave = p_clave), false)
      or exists (select 1 from public.gimnasios g where g.id = p_gimnasio_id and g.es_demo)
$$;

-- Solo BRIK (principal) la prende o apaga.
create or replace function public.admin_funcion_gimnasio(p_gimnasio_id uuid, p_clave text, p_activa boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_brik(array['principal']);
  if p_activa is null then raise exception 'Falta decir si se prende o se apaga' using errcode = '22023'; end if;
  insert into public.funciones_gimnasio (gimnasio_id, clave, activa, actualizado_por) values (p_gimnasio_id, p_clave, p_activa, auth.uid())
  on conflict (gimnasio_id, clave) do update set activa = excluded.activa, actualizado_en = now(), actualizado_por = auth.uid();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la función'; end if;
  perform privado.registrar_brik('funcion_gimnasio', p_gimnasio_id, jsonb_build_object('clave', p_clave, 'activa', p_activa));
end $$;

create or replace function public.funciones_del_gimnasio(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.soy_admin_plataforma() then perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']); end if;
  return jsonb_build_object('restaurar_cambios', privado.funcion_nueva(p_gimnasio_id, 'restaurar_cambios'));
end $$;

-- ── 2 · Restaurar un cambio de Configuración ────────────────────────
-- Qué campos se pueden volver atrás desde el historial (lo que no toca plata ni la puerta).
create or replace function privado.campo_restaurable(p_campo text) returns boolean
language sql immutable set search_path = '' as $$
  select p_campo in ('nombre', 'color_acento', 'color_fondo', 'secciones_apagadas', 'dias_aviso', 'retencion_dias_ausencia', 'retencion_dias_nuevo',
                     'retencion_dias_vencido', 'retencion_dias_se_fue', 'reserva_dias_anticipacion', 'cancelacion_horas_limite', 'modo_clases',
                     'pagina.publicada', 'pagina.whatsapp', 'pagina.instagram', 'pagina.email_contacto')
      or p_campo like 'mensaje.%'
$$;

-- El valor que tiene hoy ese campo (jsonb), para saber si el cambio del historial es el último.
create or replace function privado.valor_actual_campo(p_gimnasio_id uuid, p_campo text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  if p_campo = 'nombre' then
    select to_jsonb(g.nombre) into v from public.gimnasios g where g.id = p_gimnasio_id;
  elsif p_campo like 'pagina.%' then
    select to_jsonb(l) -> substr(p_campo, 8) into v from public.landing_gimnasio l where l.gimnasio_id = p_gimnasio_id;
  elsif p_campo like 'mensaje.%' then
    select to_jsonb(m.texto) into v from public.plantillas_mensaje m where m.gimnasio_id = p_gimnasio_id and m.clave = substr(p_campo, 9);
  else
    select to_jsonb(c) -> p_campo into v from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  end if;
  return v;
end $$;

-- Para la pestaña Cambios: qué filas del historial se pueden restaurar ahora (dueño, con la función prendida).
create or replace function public.cambios_restaurables(p_gimnasio_id uuid, p_limite int default 100) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if not privado.funcion_nueva(p_gimnasio_id, 'restaurar_cambios') then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'campo', h.campo, 'cuando', h.cambiado_en)
                   order by h.cambiado_en desc, h.campo)
            from (select * from public.historial_configuracion x where x.gimnasio_id = p_gimnasio_id
                   order by x.cambiado_en desc limit least(greatest(coalesce(p_limite, 100), 1), 500)) h
           where privado.campo_restaurable(h.campo)
             and h.cambiado_en = (select max(y.cambiado_en) from public.historial_configuracion y where y.gimnasio_id = h.gimnasio_id and y.campo = h.campo)
             and privado.valor_actual_campo(h.gimnasio_id, h.campo) is not distinct from h.despues
             and h.antes is distinct from h.despues), '[]'::jsonb);
end $$;

create or replace function public.restaurar_cambio_configuracion(p_gimnasio_id uuid, p_cambio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h public.historial_configuracion; n int; col text; ant jsonb; txt text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if not privado.funcion_nueva(p_gimnasio_id, 'restaurar_cambios') then
    raise exception 'Restaurar cambios todavía no está disponible en tu gimnasio' using errcode = '42501';
  end if;
  select * into h from public.historial_configuracion where id = p_cambio_id and gimnasio_id = p_gimnasio_id;
  if not found then raise exception 'No existe ese cambio en tu gimnasio' using errcode = '22023'; end if;
  if not privado.campo_restaurable(h.campo) then
    raise exception 'Este dato no se restaura desde acá: cambialo a mano en su pantalla' using errcode = '22023';
  end if;
  if privado.valor_actual_campo(p_gimnasio_id, h.campo) is distinct from h.despues
     or exists (select 1 from public.historial_configuracion y where y.gimnasio_id = h.gimnasio_id and y.campo = h.campo and y.cambiado_en > h.cambiado_en) then
    raise exception 'Ese dato ya cambió después: restaurá el cambio más nuevo' using errcode = '22023';
  end if;
  ant := h.antes;
  if h.campo = 'nombre' then
    txt := btrim(coalesce(ant #>> '{}', ''));
    if length(txt) < 1 then raise exception 'El nombre anterior estaba vacío' using errcode = '22023'; end if;
    update public.gimnasios set nombre = txt where id = p_gimnasio_id;
  elsif h.campo like 'pagina.%' then
    col := substr(h.campo, 8);
    if col not in ('publicada', 'whatsapp', 'instagram', 'email_contacto') then raise exception 'Dato desconocido' using errcode = '22023'; end if;
    execute format('update public.landing_gimnasio set %I = (jsonb_populate_record(null::public.landing_gimnasio, jsonb_build_object(%L, $1))).%I where gimnasio_id = $2', col, col, col)
      using ant, p_gimnasio_id;
  elsif h.campo like 'mensaje.%' then
    if jsonb_typeof(ant) is distinct from 'string' then raise exception 'El mensaje anterior estaba vacío' using errcode = '22023'; end if;
    update public.plantillas_mensaje set texto = ant #>> '{}' where gimnasio_id = p_gimnasio_id and clave = substr(h.campo, 9);
  else
    col := h.campo;
    execute format('update public.configuracion_gimnasio set %I = (jsonb_populate_record(null::public.configuracion_gimnasio, jsonb_build_object(%L, $1))).%I where gimnasio_id = $2', col, col, col)
      using ant, p_gimnasio_id;
  end if;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo restaurar: no se tocó ninguna fila'; end if;
  return jsonb_build_object('campo', h.campo, 'etiqueta', privado.etiqueta_campo(h.campo), 'valor', privado.valor_legible(h.campo, ant));
end $$;

-- ── 3 · Términos y condiciones por gimnasio (WEB-06) ────────────────
create table if not exists public.terminos_gimnasio (
  gimnasio_id    uuid primary key references public.gimnasios(id),
  texto          text check (texto is null or length(texto) <= 20000),
  publicado      boolean not null default false,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid
);
select privado.politicas_estandar('public.terminos_gimnasio', array['dueno', 'encargado'], null);
revoke all on table public.terminos_gimnasio from anon;

create or replace function public.terminos_propios(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return coalesce((select jsonb_build_object('texto', t.texto, 'publicado', t.publicado, 'actualizado_en', t.actualizado_en)
                     from public.terminos_gimnasio t where t.gimnasio_id = p_gimnasio_id),
                  jsonb_build_object('texto', null, 'publicado', false, 'actualizado_en', null));
end $$;

create or replace function public.guardar_terminos(p_gimnasio_id uuid, p_texto text, p_publicado boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare t text := nullif(btrim(coalesce(p_texto, '')), ''); n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_publicado is null then raise exception 'Falta decir si se publica o no' using errcode = '22023'; end if;
  if t is not null and length(t) < 50 then raise exception 'Los términos son muy cortos: contá las reglas del gimnasio, los pagos y las bajas.' using errcode = '22023'; end if;
  if t is not null and length(t) > 20000 then raise exception 'Los términos son muy largos (hasta 20.000 letras).' using errcode = '22023'; end if;
  if p_publicado and t is null then raise exception 'Para publicar, escribí o cargá el texto de los términos.' using errcode = '22023'; end if;
  insert into public.terminos_gimnasio (gimnasio_id, texto, publicado, actualizado_por) values (p_gimnasio_id, t, p_publicado, auth.uid())
  on conflict (gimnasio_id) do update set texto = excluded.texto, publicado = excluded.publicado, actualizado_en = now(), actualizado_por = auth.uid();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudieron guardar los términos'; end if;
end $$;

-- Pública: solo si el dueño los publicó. Si no, null y la página dice que no existe.
create or replace function public.terminos_publicos(p_host text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('gimnasio', g.nombre, 'texto', t.texto, 'actualizada_en', t.actualizado_en)
    from public.dominios_gimnasio d
    join public.gimnasios g on g.id = d.gimnasio_id
    join public.terminos_gimnasio t on t.gimnasio_id = d.gimnasio_id
   where d.host = lower(p_host) and t.publicado and t.texto is not null
$$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function privado.funcion_nueva(uuid, text), privado.campo_restaurable(text), privado.valor_actual_campo(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_funcion_gimnasio(uuid, text, boolean), public.funciones_del_gimnasio(uuid), public.cambios_restaurables(uuid, int),
  public.restaurar_cambio_configuracion(uuid, uuid), public.terminos_propios(uuid), public.guardar_terminos(uuid, text, boolean), public.terminos_publicos(text)
  from public, anon, authenticated;
grant execute on function public.admin_funcion_gimnasio(uuid, text, boolean), public.funciones_del_gimnasio(uuid), public.cambios_restaurables(uuid, int),
  public.restaurar_cambio_configuracion(uuid, uuid), public.terminos_propios(uuid), public.guardar_terminos(uuid, text, boolean) to authenticated, service_role;
grant execute on function public.terminos_publicos(text) to anon, authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $v$
declare f text;
begin
  foreach f in array array['public.funciones_gimnasio', 'public.terminos_gimnasio'] loop
    if not (select relrowsecurity from pg_class where oid = f::regclass) then raise exception 'F9: % sin RLS', f; end if;
  end loop;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('funciones_gimnasio', 'terminos_gimnasio') and cmd <> 'SELECT') then
    raise exception 'F9: funciones_gimnasio y terminos_gimnasio no se escriben desde el cliente';
  end if;
  if has_function_privilege('anon', 'public.restaurar_cambio_configuracion(uuid, uuid)', 'execute') then raise exception 'F9: restaurar no es para anónimos'; end if;
  if not has_function_privilege('anon', 'public.terminos_publicos(text)', 'execute') then raise exception 'F9: los términos publicados son públicos'; end if;
  if (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'funciones_gimnasio' and column_name = 'activa') <> 'false'
     or (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'terminos_gimnasio' and column_name = 'publicado') <> 'false' then
    raise exception 'F9: las funciones nuevas y los términos arrancan apagados';
  end if;
end $v$;
