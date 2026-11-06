-- 4701 · VD-47X · Índices que le faltaban a las pantallas principales.
-- Salen de leer las funciones de Socios (buscar_socios, filtros_socios), Retención / Vencen hoy
-- (privado.retencion_con) y del Inicio (entraron / cobrado hoy), no de adivinar. Todos empiezan por
-- gimnasio_id (todo se consulta dentro de un gimnasio) y sólo ayudan: ningún resultado cambia.
-- scripts/medir/explain.mjs corre explain analyze de esas funciones contra el demo para confirmarlo.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.socios') is null or to_regclass('public.suscripciones') is null
     or to_regclass('public.ventas') is null or to_regclass('public.ingresos') is null then
    raise exception 'Guarda: faltan tablas base (socios, suscripciones, ventas, ingresos)';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'suscripciones_socio_inicio') then
    raise exception 'Guarda: falta la migración 0117 (índices de acceso)';
  end if;
end $$;

-- Socios: la lista sale ordenada por (de baja, nombre, apellido) y corta en 60. Con este índice
-- Postgres recorre en orden y se detiene, en vez de ordenar a todos los socios del gimnasio.
create index if not exists socios_orden_lista on public.socios (gimnasio_id, (dado_de_baja_en is not null), nombre, apellido);
-- Socios: "Nuevos (30 días)" y el contador del mismo nombre.
create index if not exists socios_por_alta on public.socios (gimnasio_id, creado_en desc);
-- Socios: el contador y la lista de "Dados de baja" (son pocos: el índice es chico).
create index if not exists socios_dados_de_baja on public.socios (gimnasio_id, nombre, apellido) where dado_de_baja_en is not null;
-- Socios: las píldoras por plan cuentan membresías vigentes por plan.
create index if not exists suscripciones_vigentes_por_plan on public.suscripciones (gimnasio_id, plan_id, socio_id) where baja_en is null;
-- Retención / Vencen hoy: la membresía que importa de cada socio (distinct on socio_id, inicio desc) dentro del gimnasio.
create index if not exists suscripciones_gimnasio_socio_inicio on public.suscripciones (gimnasio_id, socio_id, inicio desc);
-- Inicio: "Cobrado hoy" y los gráficos de 7 días recorren las ventas por fecha dentro del gimnasio.
create index if not exists ventas_por_fecha on public.ventas (gimnasio_id, creado_en desc);
-- Inicio: "Entraron hoy" recorre los ingresos por momento (el índice por sede tiene la sede en el medio).
create index if not exists ingresos_por_momento on public.ingresos (gimnasio_id, momento desc);

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare faltan text;
begin
  select string_agg(n, ', ') into faltan
    from unnest(array['socios_orden_lista', 'socios_por_alta', 'socios_dados_de_baja', 'suscripciones_vigentes_por_plan',
                      'suscripciones_gimnasio_socio_inicio', 'ventas_por_fecha', 'ingresos_por_momento']) n
   where not exists (select 1 from pg_index i join pg_class c on c.oid = i.indexrelid
                      where c.relname = n and c.relnamespace = 'public'::regnamespace and i.indisvalid);
  if faltan is not null then raise exception 'Verificación: faltan índices (%)', faltan; end if;
end $$;
