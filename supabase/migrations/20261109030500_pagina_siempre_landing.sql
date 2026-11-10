-- U4 · La página del gimnasio es SIEMPRE su landing: desde que se crea se ve publicada, con lo que tenga (las secciones sin datos no se
-- muestran). Antes cada gimnasio nacía "sin publicar" y la gente veía "Estamos armando nuestra página".
-- Lo que sigue siendo cierto: "Ocultar mi página" (publicada = false) deja solo una portada con la marca y los botones, y no se indexa.
--  1) landing_gimnasio.publicada nace en true (create or replace del default; el resto de la tabla no cambia);
--  2) los gimnasios que quedaron sin publicar solo por nacer así pasan a publicados: no hay forma de distinguir a quien la ocultó a
--     propósito (la opción "Ocultar" no existía como tal), y ningún gimnasio real se creó todavía; se deja constancia en el historial
--     de configuración por el trigger de siempre;
--  3) todo gimnasio tiene su fila de página (si falta, se crea con la misma función de siempre).

do $g$ begin
  if to_regclass('public.landing_gimnasio') is null then raise exception 'Guarda: falta landing_gimnasio'; end if;
  if to_regprocedure('privado.crear_landing(uuid)') is null then raise exception 'Guarda: falta privado.crear_landing'; end if;
end $g$;

alter table public.landing_gimnasio alter column publicada set default true;

do $b$
declare g record;
begin
  for g in select gi.id from public.gimnasios gi where not exists (select 1 from public.landing_gimnasio l where l.gimnasio_id = gi.id) loop
    perform privado.crear_landing(g.id);
  end loop;
end $b$;

update public.landing_gimnasio set publicada = true where not publicada;

do $v$ begin
  if (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'landing_gimnasio' and column_name = 'publicada') <> 'true' then
    raise exception 'U4: publicada no nace en true';
  end if;
  if exists (select 1 from public.landing_gimnasio where not publicada) then raise exception 'U4: quedaron páginas sin publicar'; end if;
  if exists (select 1 from public.gimnasios gi where not exists (select 1 from public.landing_gimnasio l where l.gimnasio_id = gi.id)) then
    raise exception 'U4: hay gimnasios sin fila de página';
  end if;
end $v$;
