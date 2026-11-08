-- BASE-6 · D37: claro por defecto. Un gimnasio nuevo arranca con el fondo claro de Base; el que ya eligió el suyo no se toca.
-- Aditiva: solo cambia el valor por defecto de la columna (las filas existentes quedan como están).
do $g$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'color_fondo') then
    raise exception 'BASE-6: falta configuracion_gimnasio.color_fondo';
  end if;
end $g$;

alter table public.configuracion_gimnasio alter column color_fondo set default '#F4F5F6';

do $v$ begin
  if (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'color_fondo') not like '%F4F5F6%' then
    raise exception 'BASE-6: el fondo por defecto no quedó en claro';
  end if;
end $v$;
