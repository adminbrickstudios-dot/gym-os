-- N5 · Interruptor por gimnasio para cada función nueva (RECOMENDACIONES: "lo nuevo, primero en el demo").
-- Cada función nueva nace APAGADA para todos los gimnasios. Se prende por gimnasio, solo el dueño, desde
-- Configuración → Funciones nuevas. Un gimnasio con la función apagada no ve nada de ella en ningún panel.
-- El interruptor es un hecho (una fila por gimnasio y función, con quién y cuándo), no una columna suelta:
-- así "Qué hay de nuevo" (N6) sabe desde cuándo está prendida cada una.
--   funciones_nuevas_panel(gimnasio)        dueño y encargado: el catálogo con lo prendido
--   cambiar_funcion_nueva(gimnasio, clave, activa)   solo dueño
--   funciones_nuevas_activas(gimnasio)      cualquiera del equipo: las claves prendidas (para ocultar pantallas)
--   privado.funcion_activa(gimnasio, clave) la pregunta que hacen las demás funciones de la base
-- Aditiva e idempotente.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.exigir_rol(uuid, text[], uuid)') is null then raise exception 'Guarda: falta privado.exigir_rol'; end if;
  if to_regclass('public.historial_configuracion') is null then raise exception 'Guarda: falta historial_configuracion'; end if;
  if to_regclass('public.equipo') is null then raise exception 'Guarda: falta equipo'; end if;
end $$;

-- ── Tabla: una fila por gimnasio y función, apagada hasta que el dueño la prende ──
create table if not exists public.funciones_nuevas_gimnasio (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  clave         text not null check (clave ~ '^[a-z_]{3,40}$'),
  activa        boolean not null default false,
  prendida_en   timestamptz,
  cambiada_en   timestamptz not null default now(),
  cambiada_por  uuid,
  unique (gimnasio_id, id),
  unique (gimnasio_id, clave),
  foreign key (gimnasio_id, cambiada_por) references public.equipo (gimnasio_id, id),
  check (not activa or prendida_en is not null)
);
-- Lectura para dueño y encargado; nadie escribe desde el cliente (solo la función de abajo).
select privado.politicas_estandar('public.funciones_nuevas_gimnasio', array['dueno', 'encargado'], null);
revoke all on table public.funciones_nuevas_gimnasio from anon;
revoke truncate, references, trigger on public.funciones_nuevas_gimnasio from authenticated;

-- ── El catálogo: una sola lista, en la base ─────────────────────────
-- plata: toca cobros; se avisa en la pantalla. Cada clave nueva se suma acá y en el cuerpo de las funciones que la usan.
create or replace function privado.funciones_nuevas_catalogo() returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_array(
    jsonb_build_object('clave', 'origen_altas', 'titulo', 'De dónde vienen los socios nuevos', 'plata', false,
      'explicacion', 'El link de “Quiero ser socio” puede llevar su origen (Instagram, QR del cartel, WhatsApp, recomendado). Cada alta queda con su origen y un reporte cuenta cuántas se hicieron y cuántas pagaron.',
      'novedad', 'Ahora cada socio nuevo queda con el origen del link por el que llegó, y Interesados muestra cuántos vienen de cada lado y cuántos pagaron.'),
    jsonb_build_object('clave', 'resumen_noche', 'titulo', 'Resumen de la noche', 'plata', false,
      'explicacion', 'En Novedades, el dueño ve cuánto se cobró, cuántos entraron, altas, bajas y si la caja quedó cerrada. Se calcula al abrir, con lo que pasó ese día.',
      'novedad', 'En Novedades hay un resumen del día: lo cobrado, las entradas, las altas, las bajas y el estado de la caja.'),
    jsonb_build_object('clave', 'apto_vencimiento', 'titulo', 'Apto físico: aviso antes de que venza', 'plata', false,
      'explicacion', 'Con “Pedir apto físico” prendido, avisa cuántos aptos vencen pronto y, si lo elegís, la entrada avisa o frena a quien no tiene el apto al día. Solo se guarda la fecha, nunca el certificado.',
      'novedad', 'El apto físico ahora avisa antes de vencer y la entrada puede avisar o frenar a quien lo tiene vencido.'),
    jsonb_build_object('clave', 'debito_automatico', 'titulo', 'Débito automático con MercadoPago', 'plata', true,
      'explicacion', 'El socio se adhiere una vez y se le cobra solo cada mes; el aviso de MercadoPago crea el pago. Necesita las credenciales de MercadoPago del gimnasio y todavía no cobra sin ellas.',
      'novedad', 'Los socios se pueden adherir al débito automático; cada cobro mensual lo confirma MercadoPago y queda como un pago más.')
  )
$$;
revoke all on function privado.funciones_nuevas_catalogo() from public, anon, authenticated;

-- ── La pregunta que hacen las demás funciones ───────────────────────
create or replace function privado.funcion_activa(p_gimnasio_id uuid, p_clave text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select f.activa from public.funciones_nuevas_gimnasio f where f.gimnasio_id = p_gimnasio_id and f.clave = p_clave), false)
$$;
revoke all on function privado.funcion_activa(uuid, text) from public, anon, authenticated;

-- Falla con un texto claro si la función está apagada (para las funciones de la base que no deben andar apagadas).
create or replace function privado.exigir_funcion(p_gimnasio_id uuid, p_clave text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.funcion_activa(p_gimnasio_id, p_clave) then
    raise exception 'Esta función no está prendida en tu gimnasio (Configuración → Funciones nuevas).' using errcode = '22023';
  end if;
end $$;
revoke all on function privado.exigir_funcion(uuid, text) from public, anon, authenticated;

-- ── Pantalla: el catálogo con lo prendido ───────────────────────────
create or replace function public.funciones_nuevas_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'clave', c ->> 'clave', 'titulo', c ->> 'titulo', 'explicacion', c ->> 'explicacion', 'plata', (c ->> 'plata')::boolean,
             'activa', coalesce(f.activa, false), 'prendida_en', case when coalesce(f.activa, false) then f.prendida_en end,
             'prendida_dia', case when coalesce(f.activa, false) then privado.dia_local(f.prendida_en, zona) end)
           order by o.n)
      from jsonb_array_elements(privado.funciones_nuevas_catalogo()) with ordinality as o(c, n)
      left join public.funciones_nuevas_gimnasio f on f.gimnasio_id = p_gimnasio_id and f.clave = o.c ->> 'clave'), '[]'::jsonb);
end $$;

-- ── Prender y apagar: solo el dueño; deja el cambio escrito ─────────
create or replace function public.cambiar_funcion_nueva(p_gimnasio_id uuid, p_clave text, p_activa boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare eid uuid; antes boolean; n int;
begin
  eid := privado.exigir_rol(p_gimnasio_id, array['dueno']);
  if p_activa is null then raise exception 'Elegí prendida o apagada' using errcode = '22023'; end if;
  if not exists (select 1 from jsonb_array_elements(privado.funciones_nuevas_catalogo()) c where c ->> 'clave' = p_clave) then
    raise exception 'Esa función no existe' using errcode = '22023';
  end if;
  antes := privado.funcion_activa(p_gimnasio_id, p_clave);
  insert into public.funciones_nuevas_gimnasio (gimnasio_id, clave, activa, prendida_en, cambiada_en, cambiada_por)
  values (p_gimnasio_id, p_clave, p_activa, case when p_activa then now() end, now(), eid)
  on conflict (gimnasio_id, clave) do update
     set activa = excluded.activa,
         prendida_en = case when excluded.activa and not public.funciones_nuevas_gimnasio.activa then now()
                            when excluded.activa then public.funciones_nuevas_gimnasio.prendida_en end,
         cambiada_en = now(), cambiada_por = excluded.cambiada_por;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar'; end if;
  if antes is distinct from p_activa then
    insert into public.historial_configuracion (gimnasio_id, campo, antes, despues, equipo_id, usuario_id)
    values (p_gimnasio_id, 'funcion_nueva.' || p_clave, to_jsonb(antes), to_jsonb(p_activa), eid, auth.uid());
  end if;
  return jsonb_build_object('clave', p_clave, 'activa', p_activa);
end $$;

-- ── Para ocultar pantallas: las claves prendidas, para quien sea del equipo ──
create or replace function public.funciones_nuevas_activas(p_gimnasio_id uuid) returns text[]
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion', 'profe']);
  return coalesce((select array_agg(f.clave order by f.clave) from public.funciones_nuevas_gimnasio f where f.gimnasio_id = p_gimnasio_id and f.activa), '{}');
end $$;

revoke all on function public.funciones_nuevas_panel(uuid), public.cambiar_funcion_nueva(uuid, text, boolean), public.funciones_nuevas_activas(uuid) from public, anon, authenticated;
grant execute on function public.funciones_nuevas_panel(uuid), public.cambiar_funcion_nueva(uuid, text, boolean), public.funciones_nuevas_activas(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.funciones_nuevas_panel(uuid)', 'public.cambiar_funcion_nueva(uuid, text, boolean)', 'public.funciones_nuevas_activas(uuid)',
                           'privado.funcion_activa(uuid, text)', 'privado.exigir_funcion(uuid, text)', 'privado.funciones_nuevas_catalogo()'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
  end loop;
  foreach f in array array['public.funciones_nuevas_panel(uuid)', 'public.cambiar_funcion_nueva(uuid, text, boolean)', 'public.funciones_nuevas_activas(uuid)',
                           'privado.funcion_activa(uuid, text)', 'privado.exigir_funcion(uuid, text)'] loop
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if not (select relrowsecurity from pg_class where oid = 'public.funciones_nuevas_gimnasio'::regclass) then raise exception 'Verificación: funciones_nuevas_gimnasio sin RLS'; end if;
end $$;
