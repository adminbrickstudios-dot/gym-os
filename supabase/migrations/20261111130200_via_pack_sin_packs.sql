-- F1.6 · privado.via_pack: salida rápida para quien no tiene ningún pack.
-- NO cambia ningún veredicto: el recorrido de abajo es el de 20261104009500 sin tocar. Si el socio no tiene ni un pack (no anulado y ya empezado),
-- el cuerpo de antes no encontraba nada en el bucle, no marcaba "otra sede" y no encontraba "el último pack": devolvía null. Ahora devuelve null
-- sin armar nada. La condición de la salida es la MISMA de la última consulta de la función (la más amplia de las dos), así que no queda
-- ningún caso fuera.
-- Por qué importa: la mayoría de los socios no tiene packs, y calcular_acceso llama a via_pack por cada socio de las listas por estado
-- (Socios por estado, filtros_socios): con 5.000 socios, 1.100 ms de 3.000 eran de esta función.
-- La prueba supabase/pruebas/via-pack-sin-packs.test.mjs compara la función nueva con la de antes (copia en la prueba), con momentos fijos.

do $g$ begin
  if to_regprocedure('privado.via_pack(uuid, timestamptz, uuid, text, public.configuracion_gimnasio)') is null then raise exception 'Guarda: falta privado.via_pack'; end if;
  if to_regprocedure('privado.faltas_pack(uuid, timestamptz)') is null and to_regprocedure('privado.faltas_pack(uuid, timestamptz, uuid)') is null then
    raise exception 'Guarda: falta privado.faltas_pack';
  end if;
end $g$;

create or replace function privado.via_pack(
  p_socio_id uuid, p_momento timestamptz, p_sede_id uuid, p_zona text, p_cfg public.configuracion_gimnasio
) returns public.veredicto_acceso
language plpgsql stable set search_path = '' as $$
declare
  v public.veredicto_acceso; pk record; ultimo record; consumio_hoy boolean; hay_otra_sede boolean := false;
begin
  -- F1.6: sin ningún pack, no hay nada que mirar (igual que el final de esta función, que devolvía null).
  if not exists (select 1 from public.packs x where x.socio_id = p_socio_id and x.anulado_en is null and x.desde <= p_momento) then
    return null;
  end if;
  -- Packs con clases y vigentes; los que no valen en esta sede se cuentan aparte.
  for pk in
    select p.*, pl.consume_en, pl.todas_las_sedes,
           p.cantidad - (select count(*) from public.consumos_pack c where c.pack_id = p.id and c.anulado_en is null) - privado.faltas_pack(p.id, p_momento) as restantes,
           (p_sede_id is null or pl.todas_las_sedes
            or exists (select 1 from public.plan_sedes ps where ps.plan_id = pl.id and ps.sede_id = p_sede_id)) as vale_aca
      from public.packs p join public.planes pl on pl.id = p.plan_id
     where p.socio_id = p_socio_id and p.anulado_en is null
       and p.desde <= p_momento and (p.vence_en is null or p.vence_en > p_momento)
     order by p.vence_en nulls last, p.desde
  loop
    continue when pk.restantes <= 0;
    if not pk.vale_aca then hay_otra_sede := true; continue; end if;

    v.via := 'pack'; v.puede := true; v.color := 'verde';
    if pk.consume_en = 'asistencia' then
      v.motivo := 'pack'; v.consume := 'nada'; v.pack_restantes := pk.restantes;
      v.texto := 'Tiene pack · le quedan ' || pk.restantes || ' · se descuenta en la clase';
      return v;
    end if;
    select exists (
      select 1 from public.consumos_pack c
       where c.socio_id = p_socio_id and c.anulado_en is null and c.ingreso_id is not null
         and privado.dia_local(c.momento, p_zona) = privado.dia_local(p_momento, p_zona)
    ) into consumio_hoy;
    if consumio_hoy and not p_cfg.reingreso_mismo_dia_consume then
      v.motivo := 'pack_reingreso'; v.consume := 'nada'; v.pack_restantes := pk.restantes;
      v.texto := 'Reingreso de hoy · el pack no se descuenta · le quedan ' || pk.restantes;
    else
      v.motivo := 'pack'; v.consume := 'pack'; v.consume_id := pk.id; v.pack_restantes := pk.restantes - 1;
      v.texto := 'Entra con el pack · le quedan ' || (pk.restantes - 1);
    end if;
    return v;
  end loop;

  v.puede := false; v.color := 'rojo'; v.via := 'pack'; v.consume := 'nada';
  if hay_otra_sede then
    v.motivo := 'fuera_de_sede'; v.texto := 'El pack no incluye esta sede';
    return v;
  end if;

  select p.*, p.cantidad - (select count(*) from public.consumos_pack c where c.pack_id = p.id and c.anulado_en is null) - privado.faltas_pack(p.id, p_momento) as restantes
    into ultimo
    from public.packs p
   where p.socio_id = p_socio_id and p.anulado_en is null and p.desde <= p_momento
   order by p.desde desc limit 1;
  if not found then return null; end if;
  v.pack_restantes := greatest(ultimo.restantes, 0);
  if ultimo.vence_en is not null and ultimo.vence_en <= p_momento and ultimo.restantes > 0 then
    v.motivo := 'pack_vencido';
    v.texto := 'El pack venció el ' || privado.ultimo_dia(ultimo.vence_en, p_zona) || ' con ' || ultimo.restantes || ' clases sin usar';
  else
    v.motivo := 'pack_agotado';
    v.texto := 'Usó las ' || ultimo.cantidad || ' clases del pack';
  end if;
  return v;
end $$;
revoke all on function privado.via_pack(uuid, timestamptz, uuid, text, public.configuracion_gimnasio) from public, anon, authenticated;

do $v$ begin
  if not exists (select 1 from pg_proc where oid = 'privado.via_pack(uuid, timestamptz, uuid, text, public.configuracion_gimnasio)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: via_pack sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'privado.via_pack(uuid, timestamptz, uuid, text, public.configuracion_gimnasio)', 'execute')
     or has_function_privilege('authenticated', 'privado.via_pack(uuid, timestamptz, uuid, text, public.configuracion_gimnasio)', 'execute') then
    raise exception 'Verificación: via_pack ejecutable desde el navegador';
  end if;
  if position('faltas_pack' in pg_get_functiondef('privado.via_pack(uuid, timestamptz, uuid, text, public.configuracion_gimnasio)'::regprocedure)) = 0 then
    raise exception 'Verificación: via_pack no cuenta las faltas del pack';
  end if;
end $v$;
