-- F0.5 · Índice para "quién tiene una cuota pagada por adelantado" (coberturas que empiezan después de ahora).
-- retencion_pendientes (que corre en el menú de CADA pantalla del panel) lo busca por (gimnasio, desde > momento, no anulada): sin un índice que
-- arranque por ese par, recorre la tabla entera de coberturas de todos los gimnasios (EXPLAIN con 5.000 socios: Seq Scan sobre 4.500 filas;
-- con 1.000 gimnasios sería un recorrido de millones). Los índices que había arrancan por socio o por suscripción.
-- Aditiva e idempotente. Parcial (solo las no anuladas): chico y es justo lo que se consulta.

do $g$ begin
  if to_regclass('public.coberturas') is null then raise exception 'Guarda: falta public.coberturas'; end if;
end $g$;

create index if not exists coberturas_por_gimnasio_desde on public.coberturas (gimnasio_id, desde) where anulada_en is null;

do $v$ begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'coberturas' and indexname = 'coberturas_por_gimnasio_desde') then
    raise exception 'Verificación: falta el índice coberturas_por_gimnasio_desde';
  end if;
end $v$;
