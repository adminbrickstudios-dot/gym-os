-- VD-2 · Todas las situaciones del veredicto, con lo que hay que decirle y su botón.
-- El color, el motivo y el texto de la puerta siguen saliendo de calcular_acceso
-- (no se toca el acceso). Esta función le suma, para CADA situación, lo que la
-- recepción necesita para actuar: cuánto le falta, la frase de "decile…", el botón
-- principal (y el segundo si corresponde) y los avisos en chips. Así la pantalla
-- no decide nada: muestra lo que dice la base.
--   privado.guia_entrada(socio, momento, sede)   con momento fijo (las pruebas)
--   public.guia_entrada(socio, sede)             el mostrador: dueño, encargado, recepción

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.calcular_acceso(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta privado.calcular_acceso'; end if;
  if to_regprocedure('privado.deuda_socio(uuid)') is null then raise exception 'Guarda: falta privado.deuda_socio'; end if;
  if to_regprocedure('privado.documentos_de(public.socios)') is null then raise exception 'Guarda: falta privado.documentos_de'; end if;
  if to_regprocedure('privado.agenda(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.agenda'; end if;
  if to_regprocedure('privado.es_menor(date, date)') is null then raise exception 'Guarda: falta privado.es_menor'; end if;
end $$;

create or replace function privado.guia_entrada(p_socio_id uuid, p_momento timestamptz, p_sede_id uuid default null)
returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  so public.socios; zona text; v public.veredicto_acceso; hoy date; ult date;
  boton text; segundo text; decile text; falta text; solo_encargado boolean := false;
  chips jsonb := '[]'; dias int; previas int; mes int; deuda numeric; titulos text; ag jsonb; sede jsonb; prom record;
  pesos text; etiquetas jsonb := jsonb_build_object(
    'anotar', '✅ Anotar entrada', 'cobrar', '💵 Cobrar', 'cobrar_pack', '💵 Cobrar un pack', 'dejar_pasar', '🤝 Dejar pasar',
    'volver_antes', '🏃 Volvió antes: terminar la pausa', 'volver_alta', '↩️ Volver a dar de alta', 'ficha', '👤 Ver ficha');
begin
  select * into so from public.socios where id = p_socio_id;
  if not found then raise exception 'Socio inexistente: %', p_socio_id using errcode = 'P0002'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = so.gimnasio_id;
  v := privado.calcular_acceso(p_socio_id, p_momento, p_sede_id);
  hoy := privado.dia_local(p_momento, zona);
  if v.vence_en is not null and v.motivo <> 'todavia_no_arranca' then ult := privado.dia_local(v.vence_en - interval '1 microsecond', zona); end if;
  pesos := case when v.para_regularizar is not null then privado.formato_pesos(v.para_regularizar) end;

  -- Cuánto le falta (o cuánto hace que venció).
  if v.motivo in ('al_dia', 'por_vencer') and ult is not null then
    dias := ult - hoy;
    falta := case dias when 0 then 'Vence hoy' when 1 then 'Vence mañana (el ' || to_char(ult, 'DD/MM') || ')'
                  else 'Vence en ' || dias || ' días (el ' || to_char(ult, 'DD/MM') || ')' end;
  elsif v.motivo in ('en_tolerancia', 'vencida') and ult is not null then
    dias := hoy - ult;
    falta := case dias when 1 then 'Venció ayer (el ' || to_char(ult, 'DD/MM') || ')'
                  else 'Venció hace ' || dias || ' días (el ' || to_char(ult, 'DD/MM') || ')' end;
  elsif v.motivo in ('pack', 'pack_reingreso') and v.pack_restantes is not null then
    falta := 'Le quedan ' || v.pack_restantes || case v.pack_restantes when 1 then ' clase' else ' clases' end;
  end if;

  -- El botón principal y lo que hay que decirle, según la situación.
  case v.motivo
    when 'al_dia' then
      boton := 'anotar'; decile := 'Todo en orden: anotale la entrada.';
    when 'por_vencer' then
      if dias = 0 then
        boton := 'cobrar'; segundo := 'anotar'; decile := 'Vence hoy: cobrale la cuota antes de que se vaya.';
      else
        boton := 'anotar'; segundo := 'cobrar';
        decile := case dias when 1 then 'Decile que mañana vence: que vuelva a pagar.' else 'Decile que en ' || dias || ' días vuelve a pagar.' end;
      end if;
    when 'en_tolerancia' then
      boton := 'cobrar'; segundo := 'anotar';
      decile := case when v.tolerancia_total - v.tolerancia_usada <= 0 then 'Hoy es su último día de gracia: cobrale la cuota.'
                     else 'Le quedan ' || (v.tolerancia_total - v.tolerancia_usada) || case v.tolerancia_total - v.tolerancia_usada when 1 then ' día' else ' días' end
                          || ' de gracia: cobrale la cuota, igual puede pasar.' end;
    when 'vencida' then
      boton := 'cobrar';
      decile := case when pesos is not null then 'Cobrale ' || pesos || ' antes de pasar.' else 'Cobrale la cuota antes de pasar (el plan no tiene precio cargado).' end;
    when 'sin_pago' then
      boton := 'cobrar';
      decile := 'Todavía no pagó nada: cobrale el primer pago' || coalesce(' (' || pesos || ')', '') || ' antes de pasar.';
    when 'todavia_no_arranca' then
      boton := 'dejar_pasar'; decile := 'Ya pagó, pero su plan todavía no empezó: si corresponde, dejalo pasar.';
    when 'congelada' then
      boton := 'volver_antes'; decile := 'Está en pausa: si volvió antes, terminá la pausa y entra.';
    when 'suspendido' then
      boton := 'dejar_pasar'; solo_encargado := true; decile := 'Está suspendido: lo resuelve el dueño o el encargado.';
    when 'se_fue' then
      boton := 'volver_alta'; solo_encargado := false; decile := 'Se dio de baja: si quiere volver, dalo de alta de nuevo.';
    when 'sin_plan' then
      boton := 'cobrar'; decile := 'No tiene un plan activo: ofrecele uno y cobrale.';
    when 'pack_agotado', 'pack_vencido' then
      boton := 'cobrar_pack'; decile := 'Se quedó sin clases: cobrale un pack nuevo.';
    when 'pack', 'pack_reingreso' then
      boton := 'anotar'; decile := 'Entra con su pack. ' || coalesce(falta, '');
    when 'pase_de_hoy', 'pase_reingreso' then
      boton := 'anotar'; decile := 'Tiene el pase de hoy: anotale la entrada.';
    when 'pase_usado' then
      boton := 'cobrar'; decile := 'Ya usó el pase de hoy: si quiere volver a entrar, cobrale otro.';
    when 'fuera_de_franja' then
      boton := 'dejar_pasar'; segundo := 'cobrar'; decile := 'Está fuera del horario de su plan: dejalo pasar si corresponde, o cobrale un plan que lo incluya.';
    when 'tope_semanal' then
      boton := 'dejar_pasar'; decile := 'Ya usó las veces de la semana que incluye su plan: dejalo pasar si corresponde.';
    when 'fuera_de_sede' then
      boton := 'dejar_pasar'; decile := 'Su plan es de otra sede: dejalo pasar si corresponde.';
    else
      boton := case when v.puede then 'anotar' else 'ficha' end;
      decile := case when v.puede then 'Anotale la entrada.' else 'Miralo en la ficha para ver qué pasa.' end;
  end case;

  -- Modo aviso (primera semana): el sistema habría bloqueado pero deja pasar; se anota y se regulariza.
  if v.modo_aviso then
    boton := 'anotar'; segundo := 'cobrar';
    decile := 'Es la primera semana del sistema: hoy pasa igual. Aprovechá y regularizalo' || coalesce(' (' || pesos || ')', '') || '.';
  end if;

  -- Una deuda a cuenta no lo deja afuera: se avisa y se puede cobrar.
  deuda := privado.deuda_socio(p_socio_id);
  if deuda > 0 then
    chips := chips || jsonb_build_object('clave', 'debe', 'emoji', '💳', 'texto', 'Debe ' || privado.formato_pesos(deuda) || ' a cuenta');
    if v.puede and boton = 'anotar' then
      segundo := 'cobrar';
      decile := 'Debe ' || privado.formato_pesos(deuda) || ' a cuenta: cobrale o anotalo igual.';
    end if;
  end if;

  -- Chips.
  select count(*)::int into previas from public.ingresos i
   where i.socio_id = p_socio_id and i.anulado_en is null and i.resultado <> 'rechazado' and i.momento < p_momento;
  select count(*)::int into mes from public.ingresos i
   where i.socio_id = p_socio_id and i.anulado_en is null and i.resultado <> 'rechazado' and i.momento < p_momento
     and i.momento >= privado.medianoche(date_trunc('month', hoy)::date, zona);
  if v.puede and previas = 0 then
    chips := chips || jsonb_build_object('clave', 'primer_dia', 'emoji', '🎉', 'texto', 'Es su primer día: dale la bienvenida');
  end if;
  if v.puede and previas > 0 and (previas + 1) % 100 = 0 then
    chips := chips || jsonb_build_object('clave', 'entradas_redondas', 'emoji', '⭐', 'texto', 'Es su entrada número ' || (previas + 1));
  end if;
  if so.fecha_nacimiento is not null and to_char(so.fecha_nacimiento, 'MMDD') = to_char(hoy, 'MMDD') then
    chips := chips || jsonb_build_object('clave', 'cumple', 'emoji', '🎂', 'texto', 'Cumple años hoy');
  end if;
  select string_agg(d ->> 'titulo', ', ') into titulos from jsonb_array_elements(privado.documentos_de(so) -> 'pendientes') d;
  if titulos is not null then
    chips := chips || jsonb_build_object('clave', 'firmar', 'emoji', '✍️', 'texto', 'Falta firmar: ' || titulos);
  end if;
  if privado.es_menor(so.fecha_nacimiento, hoy) then
    if nullif(trim(coalesce(so.responsable_nombre, '')), '') is null or so.responsable_telefono is null then
      chips := chips || jsonb_build_object('clave', 'menor_sin_responsable', 'emoji', '🧒', 'texto', 'Es menor y falta cargar al adulto responsable');
    else
      chips := chips || jsonb_build_object('clave', 'menor', 'emoji', '🧒', 'texto', 'Menor · responsable: ' || so.responsable_nombre);
    end if;
  end if;
  -- Ayer o hoy lo dejaron pasar con una promesa y sigue sin estar al día.
  select i.momento as momento, i.forzado_motivo as motivo into prom from public.ingresos i
   where i.socio_id = p_socio_id and i.resultado = 'forzado' and i.anulado_en is null
     and i.momento >= privado.medianoche(hoy - 1, zona) and i.momento < p_momento
   order by i.momento desc limit 1;
  if found and (not v.puede or v.modo_aviso) then
    chips := chips || jsonb_build_object('clave', 'prometio', 'emoji', '💬',
      'texto', case when privado.dia_local(prom.momento, zona) = hoy then 'Hoy lo dejaron pasar: ' else 'Ayer lo dejaron pasar: ' end || prom.motivo);
  end if;
  -- Con el gimnasio cerrado (feriado o fuera de horario) no se bloquea nada: se avisa.
  ag := privado.agenda(so.gimnasio_id, p_momento);
  select s into sede from jsonb_array_elements(ag -> 'sedes') s
   where p_sede_id is null or (s ->> 'sede_id')::uuid = p_sede_id limit 1;
  if sede is not null and (sede ->> 'texto') is not null and not (sede ->> 'abierto')::boolean then
    chips := chips || jsonb_build_object('clave', 'cerrado', 'emoji', '🔒', 'texto', 'El gimnasio está cerrado ahora: ' || (sede ->> 'texto'));
  end if;

  return jsonb_build_object(
    'situacion', v.motivo, 'color', v.color, 'puede', v.puede,
    'boton', boton, 'boton_texto', etiquetas ->> boton,
    'segundo', segundo, 'segundo_texto', etiquetas ->> segundo,
    'solo_encargado', solo_encargado, 'decile', trim(decile), 'falta', falta,
    'entradas_mes', mes, 'chips', chips);
end $$;
revoke all on function privado.guia_entrada(uuid, timestamptz, uuid) from public, anon, authenticated;

create or replace function public.guia_entrada(p_socio_id uuid, p_sede_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null or not (privado.es_servicio() or g in (select privado.mis_gimnasios(array['dueno', 'encargado', 'recepcion']))) then
    raise exception 'Sin permiso o socio inexistente' using errcode = '42501';
  end if;
  return privado.guia_entrada(p_socio_id, now(), p_sede_id);
end $$;
revoke all on function public.guia_entrada(uuid, uuid) from public, anon, authenticated;
grant execute on function public.guia_entrada(uuid, uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if has_function_privilege('anon', 'public.guia_entrada(uuid, uuid)', 'execute') then raise exception 'Verificación: anon puede ejecutar guia_entrada'; end if;
  if has_function_privilege('authenticated', 'privado.guia_entrada(uuid, timestamptz, uuid)', 'execute') then raise exception 'Verificación: privado.guia_entrada quedó expuesta'; end if;
  if not exists (select 1 from pg_proc where oid = 'public.guia_entrada(uuid, uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: guia_entrada sin search_path vacío';
  end if;
end $$;
