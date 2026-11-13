-- E3 · Los avisos de la puerta al instante: Supabase Realtime por gimnasio.
-- El panel escucha los cambios de `ingresos` y `alertas_prestamo` (filtrados por su gimnasio) y, cuando llega uno, pide lo nuevo con
-- `entradas_desde` (la función de siempre). Realtime respeta la seguridad por filas (RLS) con la sesión de quien mira: cada persona solo
-- recibe lo que su rol ya puede leer de su gimnasio. Esta migración solo agrega las dos tablas a la publicación de Realtime; no cambia
-- ninguna política ni ninguna fila. Si el proyecto no tiene publicación `supabase_realtime` (base local de prueba), no hace nada.

do $$
begin
  if to_regclass('public.ingresos') is null then raise exception 'Guarda: falta public.ingresos'; end if;
  if to_regclass('public.alertas_prestamo') is null then raise exception 'Guarda: falta public.alertas_prestamo'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.ingresos'::regclass) then raise exception 'Guarda: ingresos sin RLS'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.alertas_prestamo'::regclass) then raise exception 'Guarda: alertas_prestamo sin RLS'; end if;
end $$;

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['ingresos', 'alertas_prestamo'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- Verificación: si hay publicación, las dos tablas están.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['ingresos', 'alertas_prestamo'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        raise exception 'Verificación: % no quedó en la publicación supabase_realtime', t;
      end if;
    end loop;
  end if;
end $$;
