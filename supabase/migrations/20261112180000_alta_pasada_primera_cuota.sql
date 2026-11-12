-- H2b · Alta con fecha pasada y la primera cuota cobrada hoy (caso real de Temple Gym, 12/11).
-- Antes: un socio dado de alta "desde el 2/11" sin pagos cargados, cobrado el 12/11 desde Cobrar, quedaba cubierto
-- 12/11 → 12/12 ("cubierto hasta 11/12"): proximo_periodo, sin coberturas previas, arrancaba en greatest(hoy, inicio).
-- Ahora: si la membresía se cargó con una fecha de inicio anterior al día en que se creó (eso solo lo hacen el alta en el
-- pasado y las importaciones; asignar_plan y cambiar_plan ponen inicio = el momento), la primera cuota cubre desde ese
-- inicio, mientras ese primer período todavía no haya terminado. Si ya terminó, cubre desde hoy, como siempre (no se
-- cobra un mes vencido). Los planes de día fijo no cambian. Tampoco cambia nada para quien ya tiene coberturas.
-- Copia de privado.proximo_periodo (20261106004000) con ese único cambio, marcado "H2b". Prueba:
-- supabase/pruebas/alta-pasada-cobro-hoy.test.mjs (momentos de la puerta fijos).
-- Solo reemplaza una función: no toca filas. Las coberturas ya cobradas mal no se corrigen solas (se anulan y se
-- vuelven a cobrar desde el panel, a mano).

do $$
begin
  if to_regprocedure('privado.proximo_periodo(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.proximo_periodo'; end if;
  if to_regprocedure('privado.regla_vencimiento(uuid)') is null then raise exception 'Guarda: falta privado.regla_vencimiento'; end if;
  if to_regprocedure('privado.sumar_meses_ancla(date, integer, integer)') is null then raise exception 'Guarda: falta privado.sumar_meses_ancla'; end if;
end $$;

create or replace function privado.proximo_periodo(
  p_suscripcion_id uuid, p_momento timestamptz,
  out p_desde timestamptz, out p_hasta timestamptz, out p_ancla int,
  out p_parcial boolean, out p_modo text, out p_dias int, out p_dias_ciclo int, out p_factor numeric, out p_redondeo numeric
)
language plpgsql stable set search_path = '' as $$
declare
  s public.suscripciones; pl public.planes; rg record; zona text; hoy date;
  futuro timestamptz; ultimo timestamptz; ref timestamptz; inicio date; ult record; pe record; entrada boolean := false;
begin
  select * into s from public.suscripciones where id = p_suscripcion_id;
  if not found then raise exception 'Suscripción inexistente' using errcode = 'P0002'; end if;
  select * into pl from public.planes where id = s.plan_id;
  select * into rg from privado.regla_vencimiento(s.plan_id);
  select g.zona_horaria into zona from public.gimnasios g where g.id = s.gimnasio_id;
  hoy := privado.dia_local(p_momento, zona);
  p_parcial := false; p_factor := 1; p_redondeo := rg.p_redondeo;

  select max(c.hasta) into futuro from public.coberturas c
   where c.suscripcion_id = s.id and c.anulada_en is null and c.hasta > p_momento;

  if futuro is not null then
    inicio := privado.dia_local(futuro, zona); ref := futuro;
  else
    select max(c.hasta) into ultimo from public.coberturas c
     where c.suscripcion_id = s.id and c.anulada_en is null and c.hasta <= p_momento;
    if ultimo is null then
      inicio := greatest(hoy, privado.dia_local(s.inicio, zona));
      entrada := rg.p_renovacion = 'dia_fijo';
      -- H2b: membresía cargada con inicio anterior a su creación (alta en el pasado / importación): la primera cuota
      -- cubre desde ese inicio si el primer período todavía no terminó.
      if rg.p_renovacion <> 'dia_fijo'
         and privado.dia_local(s.inicio, zona) < least(hoy, privado.dia_local(s.creado_en, zona))
         and privado.sumar_meses_ancla(privado.dia_local(s.inicio, zona), pl.duracion_meses,
                                       extract(day from privado.dia_local(s.inicio, zona))::int) > hoy then
        inicio := privado.dia_local(s.inicio, zona);
      end if;
    elsif pl.reinicio_tras_dias is not null and hoy - privado.dia_local(ultimo, zona) >= pl.reinicio_tras_dias then
      inicio := hoy;
      entrada := rg.p_renovacion = 'dia_fijo';
    elsif rg.p_renovacion = 'desde_pago' then
      inicio := hoy;
    elsif rg.p_renovacion = 'dia_fijo' then
      inicio := greatest(privado.ultimo_dia_x(hoy, rg.p_dia_fijo), privado.dia_local(ultimo, zona));
    else
      inicio := privado.dia_local(ultimo, zona); ref := ultimo;
    end if;
    if entrada then
      if rg.p_primera = 'completo' then
        inicio := privado.ultimo_dia_x(inicio, rg.p_dia_fijo);
      else
        select * into pe from privado.periodo_entrada(rg.p_dia_fijo, rg.p_primera, pl.duracion_meses, inicio);
        if pe.p_parcial then
          p_desde := privado.medianoche(pe.p_desde, zona);
          p_hasta := privado.medianoche(pe.p_hasta, zona);
          p_ancla := rg.p_dia_fijo;
          p_parcial := true; p_modo := rg.p_primera; p_dias := pe.p_dias; p_dias_ciclo := pe.p_dias_ciclo; p_factor := pe.p_factor;
          return;
        end if;
      end if;
    end if;
  end if;

  if ref is not null then
    -- Mantener el ancla de la última cuota si la cadena termina justo ahí;
    -- si terminó corrida (días devueltos), el ancla pasa a ser ese día.
    select c.hasta, c.ancla_dia into ult from public.coberturas c
     where c.suscripcion_id = s.id and c.anulada_en is null and c.origen <> 'compensacion' and c.hasta <= ref
     order by c.hasta desc limit 1;
    if found and ult.hasta = ref and ult.ancla_dia is not null then
      p_ancla := ult.ancla_dia;
    else
      p_ancla := extract(day from inicio)::int;
    end if;
  elsif rg.p_renovacion = 'dia_fijo' then
    p_ancla := rg.p_dia_fijo;
  else
    p_ancla := extract(day from inicio)::int;
  end if;

  p_desde := privado.medianoche(inicio, zona);
  p_hasta := privado.medianoche(privado.sumar_meses_ancla(inicio, pl.duracion_meses, p_ancla), zona);
  if p_hasta <= p_desde then
    p_hasta := privado.medianoche(privado.sumar_meses_ancla(inicio, pl.duracion_meses + 1, p_ancla), zona);
  end if;
end $$;
revoke all on function privado.proximo_periodo(uuid, timestamptz) from public, anon, authenticated;

-- Verificación: la función nueva quedó (con el cambio H2b) y sigue cerrada para los roles de la API.
do $$
begin
  if position('H2b' in pg_get_functiondef('privado.proximo_periodo(uuid, timestamptz)'::regprocedure)) = 0 then
    raise exception 'Verificación: privado.proximo_periodo no tiene el cambio H2b';
  end if;
  if has_function_privilege('authenticated', 'privado.proximo_periodo(uuid, timestamptz)', 'execute')
     or has_function_privilege('anon', 'privado.proximo_periodo(uuid, timestamptz)', 'execute') then
    raise exception 'Verificación: privado.proximo_periodo quedó ejecutable por la API';
  end if;
end $$;
