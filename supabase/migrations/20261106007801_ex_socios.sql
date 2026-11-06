-- VD-46O · Reactivar ex socios (docs/v2/14-SITUACIONES.md, caso 80).
-- La lista "Se fueron" de Retención, con filtro por motivo de baja y por antigüedad, y el seguimiento de
-- cuántos de los que se contactaron volvieron a pagar. Todo se CALCULA de hechos que ya existen:
--   quién se fue         privado.retencion (lista se_fue; ya deja afuera a quien tiene "no escribirle", VD-46N)
--   motivo de baja       socios.motivo_baja (sin baja formal: "sin_baja", dejó de pagar y se fue)
--   antigüedad           de su primera membresía hasta que se fue
--   se contactó          contactos_retencion con lista = 'se_fue' (el mismo botón de siempre)
--   volvió a pagar       una cobertura de origen 'pago' no anulada, creada DESPUÉS de su primer contacto
-- Permisos: los mismos que Retención (dueño, encargado y recepción). No muestra plata.

-- ── Guarda de entrada ──────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.retencion(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.retencion'; end if;
  if to_regclass('public.contactos_retencion') is null then raise exception 'Guarda: falta contactos_retencion'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'socios' and column_name = 'no_escribirle_en') then
    raise exception 'Guarda: falta la migración 7800 (no escribirle)';
  end if;
end $$;

create index if not exists contactos_retencion_lista on public.contactos_retencion (gimnasio_id, lista, creado_en desc);

create or replace function public.ex_socios(p_gimnasio_id uuid, p_motivo text default null, p_antiguedad text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  if p_motivo is not null and p_motivo not in ('precio', 'horario', 'mudanza', 'otro_gimnasio', 'sin_tiempo', 'insatisfecho', 'otro', 'sin_baja') then
    raise exception 'Motivo de baja desconocido' using errcode = '22023';
  end if;
  if p_antiguedad is not null and p_antiguedad not in ('menos_3', 'de_3_a_12', 'mas_12') then
    raise exception 'Antigüedad desconocida' using errcode = '22023';
  end if;
  with fue as materialized (
    select t.socio_id, t.nombre, t.telefono, t.texto, t.vence_en, t.mensaje,
           t.ultimo_contacto_en, t.ultimo_contacto_por, t.ultimo_contacto_resultado,
           coalesce(s.motivo_baja, 'sin_baja') as motivo,
           (extract(year from age(t.vence_en, pm.primero)) * 12 + extract(month from age(t.vence_en, pm.primero)))::int as meses
      from privado.retencion(p_gimnasio_id, now()) t
      join public.socios s on s.id = t.socio_id
      join lateral (select min(su.inicio) as primero from public.suscripciones su where su.socio_id = t.socio_id) pm on pm.primero is not null
     where t.lista = 'se_fue'
  ),
  por_antiguedad as materialized (
    select * from fue
     where p_antiguedad is null
        or (p_antiguedad = 'menos_3' and meses < 3)
        or (p_antiguedad = 'de_3_a_12' and meses >= 3 and meses < 12)
        or (p_antiguedad = 'mas_12' and meses >= 12)
  ),
  elegidas as materialized (
    select * from por_antiguedad where p_motivo is null or motivo = p_motivo
  ),
  primer_contacto as (
    select c.socio_id, min(c.creado_en) as primero
      from public.contactos_retencion c
     where c.gimnasio_id = p_gimnasio_id and c.lista = 'se_fue' and c.creado_en > now() - interval '180 days'
     group by c.socio_id
  )
  select jsonb_build_object(
    'total', (select count(*) from elegidas),
    'filas', coalesce((select jsonb_agg(jsonb_build_object(
               'socio_id', e.socio_id, 'nombre', e.nombre, 'telefono', e.telefono, 'texto', e.texto, 'mensaje', e.mensaje,
               'motivo', e.motivo, 'meses', e.meses, 'se_fue_en', e.vence_en,
               'ultimo_contacto_en', e.ultimo_contacto_en, 'ultimo_contacto_por', e.ultimo_contacto_por,
               'ultimo_contacto_resultado', e.ultimo_contacto_resultado)
               order by (e.ultimo_contacto_en is not null), e.vence_en desc, e.nombre)
               from (select * from elegidas order by (ultimo_contacto_en is not null), vence_en desc, nombre limit 500) e), '[]'::jsonb),
    'motivos', coalesce((select jsonb_agg(jsonb_build_object('motivo', m.motivo, 'cantidad', m.n) order by m.n desc, m.motivo)
                           from (select motivo, count(*) as n from por_antiguedad group by motivo) m), '[]'::jsonb),
    'antiguedad', jsonb_build_object(
      'menos_3', (select count(*) from fue where meses < 3),
      'de_3_a_12', (select count(*) from fue where meses >= 3 and meses < 12),
      'mas_12', (select count(*) from fue where meses >= 12)),
    'seguimiento', jsonb_build_object(
      'dias', 180,
      'contactados', (select count(*) from primer_contacto),
      'volvieron', (select count(*) from primer_contacto pc
                     where exists (select 1 from public.coberturas cb
                                    where cb.gimnasio_id = p_gimnasio_id and cb.socio_id = pc.socio_id and cb.origen = 'pago'
                                      and cb.anulada_en is null and cb.creado_en > pc.primero)))
  ) into r;
  return r;
end $$;
revoke all on function public.ex_socios(uuid, text, text) from public, anon, authenticated;
grant execute on function public.ex_socios(uuid, text, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where oid = 'public.ex_socios(uuid, text, text)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: ex_socios sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'public.ex_socios(uuid, text, text)', 'execute') then raise exception 'Verificación: ex_socios quedó para anon'; end if;
end $$;
