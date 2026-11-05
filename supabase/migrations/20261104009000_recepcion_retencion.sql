-- 0090 · La recepción anota contactos de retención (RET-2, decisión D2 ✅).
-- La recepción es la que habla con el socio: ve las listas de Retención y
-- anota "le escribí / dice que vuelve". No ve la plata: ni la plata en riesgo
-- ni cuánto paga cada uno (el texto de cada fila es el mismo que en la
-- Entrada, que ya ve). El tablero (altas, bajas) sigue siendo de dueño y encargado.
-- Copias de 0010: retencion, retencion_resumen, registrar_contacto (mismas firmas).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.motivos_baja_mes(uuid, date)') is null then raise exception 'Guarda: falta la migración 0089'; end if;
  if to_regprocedure('privado.retencion(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.retencion'; end if;
end $$;

create or replace function public.retencion(p_gimnasio_id uuid)
returns table (
  socio_id uuid, nombre text, telefono text, lista text, texto text, dias int,
  vence_en timestamptz, monto_mensual numeric, debe numeric, ultimo_ingreso timestamptz,
  visitas_por_semana numeric, ultimo_contacto_en timestamptz, ultimo_contacto_por text,
  ultimo_contacto_resultado text, mensaje text
)
language plpgsql stable security definer set search_path = '' as $$
declare eid uuid; ve_plata boolean;
begin
  eid := privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select e.rol in ('dueno', 'encargado') into ve_plata from public.equipo e where e.id = eid;
  return query select r.socio_id, r.nombre, r.telefono, r.lista, r.texto, r.dias, r.vence_en,
                      case when ve_plata then r.monto_mensual end, r.debe, r.ultimo_ingreso, r.visitas_por_semana,
                      r.ultimo_contacto_en, r.ultimo_contacto_por, r.ultimo_contacto_resultado, r.mensaje
                 from privado.retencion(p_gimnasio_id, now()) r;
end $$;

create or replace function public.retencion_resumen(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare eid uuid; ve_plata boolean; r jsonb;
begin
  eid := privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select e.rol in ('dueno', 'encargado') into ve_plata from public.equipo e where e.id = eid;
  r := privado.retencion_resumen(p_gimnasio_id, now());
  return case when ve_plata then r else r || jsonb_build_object('plata_en_riesgo', null) end;
end $$;

create or replace function public.registrar_contacto(p_socio_id uuid, p_lista text, p_canal text default 'whatsapp',
                                                     p_resultado text default 'enviado', p_nota text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid; cid uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion']);
  insert into public.contactos_retencion (gimnasio_id, socio_id, lista, canal, resultado, nota, creado_por)
  values (g, p_socio_id, p_lista, p_canal, p_resultado, nullif(trim(coalesce(p_nota, '')), ''), eid)
  returning id into cid;
  return cid;
end $$;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.retencion(uuid)', 'public.retencion_resumen(uuid)', 'public.registrar_contacto(uuid, text, text, text, text)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
