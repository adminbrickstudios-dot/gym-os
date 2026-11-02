-- ═══════════════════════════════════════════════════════════════════
-- 0012 · Estilo oscuro por defecto.
--
-- Gym OS pasa a ser oscuro, modo gimnasio: un gimnasio nuevo nace con
-- fondo grafito y el verde de la acción principal pensado para fondo
-- oscuro. Cada gimnasio los puede cambiar (siguen siendo datos); la
-- interfaz deriva superficies y textos del fondo, así que un fondo
-- claro elegido a mano también se ve bien.
--
-- Solo cambia el valor por defecto: los gimnasios que ya existen
-- conservan sus colores.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'color_fondo') then
    raise exception 'Guarda: falta configuracion_gimnasio.color_fondo (migración 0001)';
  end if;
end $$;

alter table public.configuracion_gimnasio alter column color_fondo set default '#14161b';
alter table public.configuracion_gimnasio alter column color_acento set default '#2fbf5b';

do $$
begin
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'color_fondo') not like '%#14161b%' then
    raise exception 'Verificación: el fondo por defecto no quedó en #14161b';
  end if;
  if (select column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'color_acento') not like '%#2fbf5b%' then
    raise exception 'Verificación: el acento por defecto no quedó en #2fbf5b';
  end if;
end $$;
