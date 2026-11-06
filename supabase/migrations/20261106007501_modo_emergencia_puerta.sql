-- VD-46M · Modo emergencia de la puerta (situaciones 8 y 63: molinete roto o en "libre", corte de luz).
--   emergencias_puerta                 una fila por emergencia: sede, motivo, quién la activó, cuándo vence (se calcula: sin cron)
--   ingresos.emergencia_id             marca las entradas del rato (para listarlas al cerrar)
--   configuracion_gimnasio.emergencia_puerta_habilitada   arranca APAGADO; lo prende solo el dueño
--   privado.emergencia_activa          ¿hay una emergencia en esta sede en este momento? (iniciada, no cerrada, no vencida)
--   privado.registrar_ingreso          (misma firma; copia de 20261106004200 con el reingreso por visita y el anti-préstamo)
--                                      en emergencia deja pasar al que no podía: resultado 'entro_modo_aviso', color real guardado,
--                                      forzado_motivo 'Emergencia de la puerta' y la emergencia atada. Lo que ve la puerta: amarillo, "pasá".
--                                      NO abre a suspendidos ni dados de baja ni pisa un "dejar pasar" a mano con motivo.
--   privado.guia_entrada               (misma firma; copia de 20261106007500) chip de emergencia y botón Anotar en vez de Cobrar
--   public.estado_emergencia_puerta / habilitar / activar / cerrar / entradas_de_emergencia / historial / kiosco_emergencia
-- Nada se guarda como estado: "activa" sale de los horarios. Una emergencia vence sola a las horas elegidas (1 a 12).

do $$
begin
  if to_regprocedure('privado.registrar_ingreso(uuid, uuid, text, uuid, uuid, text, timestamptz)') is null then raise exception 'Guarda: falta privado.registrar_ingreso'; end if;
  if pg_get_functiondef('privado.registrar_ingreso(uuid, uuid, text, uuid, uuid, text, timestamptz)'::regprocedure) not like '%alertas_prestamo%' then raise exception 'Guarda: registrar_ingreso vigente sin el anti-préstamo (VD-3)'; end if;
  if to_regprocedure('privado.guia_entrada(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta privado.guia_entrada'; end if;
  if pg_get_functiondef('privado.guia_entrada(uuid, timestamptz, uuid)'::regprocedure) not like '%transferencia_pendiente%' then raise exception 'Guarda: la guía vigente no tiene el chip de VD-46F'; end if;
  if to_regprocedure('privado.exigir_rol(uuid, text[], uuid)') is null or to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'Guarda: faltan exigir_rol o exigir_equipo'; end if;
  if to_regprocedure('privado.tablet_del_token(text)') is null then raise exception 'Guarda: falta privado.tablet_del_token'; end if;
  if to_regclass('public.ingresos') is null or to_regclass('public.configuracion_gimnasio') is null then raise exception 'Guarda: faltan ingresos o configuracion_gimnasio'; end if;
end $$;

-- ── El flag por gimnasio: arranca apagado ───────────────────────────
alter table public.configuracion_gimnasio add column if not exists emergencia_puerta_habilitada boolean not null default false;

-- ── Las emergencias ─────────────────────────────────────────────────
create table if not exists public.emergencias_puerta (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  sede_id      uuid not null,
  motivo       text not null check (length(trim(motivo)) >= 5),
  iniciada_en  timestamptz not null default now(),
  iniciada_por uuid not null,
  vence_en     timestamptz not null,
  cerrada_en   timestamptz,
  cerrada_por  uuid,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  foreign key (gimnasio_id, iniciada_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, cerrada_por) references public.equipo (gimnasio_id, id),
  check (vence_en > iniciada_en and vence_en <= iniciada_en + interval '12 hours'),
  check ((cerrada_en is null) = (cerrada_por is null) and (cerrada_en is null or cerrada_en >= iniciada_en))
);
create index if not exists emergencias_puerta_sede on public.emergencias_puerta (gimnasio_id, sede_id, iniciada_en desc);
-- Solo el dueño y el encargado la leen; se escribe únicamente por las funciones de abajo.
select privado.politicas_estandar('public.emergencias_puerta', array['dueno', 'encargado'], '{}');
revoke all on table public.emergencias_puerta from anon;
revoke insert, update, delete, truncate, references, trigger on public.emergencias_puerta from authenticated;

alter table public.ingresos add column if not exists emergencia_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ingresos_emergencia_fk') then
    alter table public.ingresos add constraint ingresos_emergencia_fk
      foreign key (gimnasio_id, emergencia_id) references public.emergencias_puerta (gimnasio_id, id);
  end if;
end $$;
create index if not exists ingresos_emergencia on public.ingresos (gimnasio_id, emergencia_id) where emergencia_id is not null;

-- ── ¿Hay una emergencia ahora? (se calcula de los horarios) ─────────
create or replace function privado.emergencia_activa(p_gimnasio_id uuid, p_sede_id uuid, p_momento timestamptz)
returns public.emergencias_puerta
language sql stable set search_path = '' as $$
  select e.* from public.emergencias_puerta e
   where e.gimnasio_id = p_gimnasio_id and (p_sede_id is null or e.sede_id = p_sede_id)
     and e.iniciada_en <= p_momento
     and p_momento < least(e.vence_en, coalesce(e.cerrada_en, 'infinity'::timestamptz))
   order by e.iniciada_en desc limit 1
$$;
revoke all on function privado.emergencia_activa(uuid, uuid, timestamptz) from public, anon, authenticated;

-- ── El registro de la entrada con la emergencia ─────────────────────
create or replace function privado.registrar_ingreso(
  p_socio_id uuid, p_sede_id uuid, p_via_acceso text, p_registrado_por uuid,
  p_dispositivo_id uuid, p_forzar_motivo text, p_momento timestamptz
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  g uuid; m timestamptz; prev public.ingresos; v public.veredicto_acceso; res text; nuevo uuid; n int;
  em public.emergencias_puerta; por_emergencia boolean := false; vv jsonb;
  horas int; minutos_prestamo int; ventana interval; zona text; hace int; texto_repetido text;
  etiquetas constant jsonb := jsonb_build_object('recepcion', 'recepción', 'qr_socio', 'el QR', 'qr_pared', 'el QR de la pared',
                                                 'kiosco', 'la tablet', 'nfc', 'el llavero', 'molinete', 'el molinete');
begin
  perform pg_advisory_xact_lock(hashtextextended('gymos:ingreso:' || p_socio_id::text, 0));
  m := coalesce(p_momento, clock_timestamp());

  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Socio inexistente: %', p_socio_id using errcode = 'P0002'; end if;

  select coalesce(c.visita_horas, 5), coalesce(c.antiprestamo_minutos, 60) into horas, minutos_prestamo
    from (select 1) u left join public.configuracion_visita c on c.gimnasio_id = g;
  -- visita_horas = 0: sin ventana larga, queda solo el doble toque de 60 segundos.
  ventana := case when horas > 0 then horas * interval '1 hour' else interval '60 seconds' end;

  -- Idempotente: dentro de la visita, el mismo socio por cualquier vía devuelve su entrada (no crea otra).
  select * into prev from public.ingresos i
   where i.socio_id = p_socio_id and i.anulado_en is null
     and i.resultado in ('entro', 'entro_modo_aviso', 'forzado')
     and i.momento > m - ventana
   order by i.momento desc limit 1;
  if found then
    select gi.zona_horaria into zona from public.gimnasios gi where gi.id = g;
    hace := greatest(floor(extract(epoch from (m - prev.momento)) / 60)::int, 0);
    -- Otra vía u otro dispositivo y hace pocos minutos: amarillo, y le queda la alerta al dueño.
    if minutos_prestamo > 0 and hace < minutos_prestamo
       and (prev.via_acceso is distinct from p_via_acceso or prev.dispositivo_id is distinct from p_dispositivo_id) then
      insert into public.alertas_prestamo (gimnasio_id, sede_id, socio_id, momento, ingreso_anterior_id, via_anterior, via_nueva,
                                           dispositivo_anterior_id, dispositivo_nuevo_id, minutos)
      values (g, p_sede_id, p_socio_id, m, prev.id, prev.via_acceso, p_via_acceso, prev.dispositivo_id, p_dispositivo_id, hace);
      get diagnostics n = row_count;
      if n <> 1 then raise exception 'No se pudo guardar la alerta de préstamo'; end if;
      return jsonb_build_object('ingreso_id', prev.id, 'repetido', true, 'resultado', prev.resultado,
        'color', 'amarillo', 'motivo', 'posible_prestamo', 'alerta_prestamo', true,
        'entro_a', prev.momento, 'color_entrada', prev.color,
        'texto', 'Ya entró ' || case when hace < 1 then 'hace menos de 1 min' else 'hace ' || hace || ' min' end
                 || ' por ' || coalesce(etiquetas ->> prev.via_acceso, prev.via_acceso) || ': ¿es la misma persona?');
    end if;
    texto_repetido := case when p_via_acceso in ('qr_socio', 'qr_pared', 'kiosco', 'nfc')
                           then 'Ya entraste a las ' || to_char(prev.momento at time zone zona, 'HH24:MI') || ' ✓'
                           else 'Ya entró a las ' || to_char(prev.momento at time zone zona, 'HH24:MI') end;
    return jsonb_build_object('ingreso_id', prev.id, 'repetido', true, 'resultado', prev.resultado,
                              'color', prev.color, 'motivo', prev.motivo, 'texto', texto_repetido,
                              'entro_a', prev.momento);
  end if;

  v := privado.calcular_acceso(p_socio_id, m, p_sede_id);
  -- VD-46M: con la puerta en emergencia en esta sede, quien no podía entrar pasa igual (queda 'entro_modo_aviso' marcado
  -- con la emergencia). No se abre a un suspendido ni a un dado de baja, ni cuando la recepción dejó pasar a mano con motivo.
  em := privado.emergencia_activa(g, p_sede_id, m);
  if v.puede then
    res := case when v.modo_aviso then 'entro_modo_aviso' else 'entro' end;
  elsif em.id is not null and v.motivo not in ('suspendido', 'se_fue') and length(trim(coalesce(p_forzar_motivo, ''))) = 0 then
    res := 'entro_modo_aviso'; por_emergencia := true;
  elsif length(trim(coalesce(p_forzar_motivo, ''))) > 0 then
    res := 'forzado';
  else
    res := 'rechazado';
  end if;

  insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado,
                               via_habilitante, color, motivo, texto, forzado_motivo,
                               registrado_por, dispositivo_id, emergencia_id)
  values (g, p_sede_id, p_socio_id, m, p_via_acceso, res,
          case when v.puede and not v.modo_aviso and v.via <> 'ninguna' then v.via end,
          v.color, v.motivo, v.texto,
          case when res = 'forzado' then trim(p_forzar_motivo) when por_emergencia then 'Emergencia de la puerta' end,
          p_registrado_por, p_dispositivo_id, case when em.id is not null and res <> 'rechazado' then em.id end)
  returning id into nuevo;
  if nuevo is null then raise exception 'No se registró el ingreso'; end if;

  if res in ('entro', 'entro_modo_aviso') and v.consume = 'pase' then
    update public.pases_diarios set usado_en_ingreso_id = nuevo
     where id = v.consume_id and usado_en_ingreso_id is null;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo marcar el pase % como usado', v.consume_id; end if;
  elsif res in ('entro', 'entro_modo_aviso') and v.consume = 'pack' then
    insert into public.consumos_pack (gimnasio_id, pack_id, socio_id, momento, ingreso_id)
    values (g, v.consume_id, p_socio_id, m, nuevo);
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo descontar la clase del pack %', v.consume_id; end if;
  end if;

  if por_emergencia then
    -- Lo que ve la puerta (tablet, QR, ventana): amarillo y "pasá". El color real queda en el ingreso.
    vv := to_jsonb(v) || jsonb_build_object('puede', true, 'color', 'amarillo', 'modo_aviso', true, 'emergencia', true,
            'texto', 'La puerta está en emergencia: pasá. Después pasá por recepción.');
    return jsonb_build_object('ingreso_id', nuevo, 'repetido', false, 'resultado', res, 'emergencia', true, 'veredicto', vv);
  end if;
  return jsonb_build_object('ingreso_id', nuevo, 'repetido', false, 'resultado', res, 'veredicto', to_jsonb(v));
end $$;
revoke all on function privado.registrar_ingreso(uuid, uuid, text, uuid, uuid, text, timestamptz) from public;

-- ── La guía de la Entrada ───────────────────────────────────────────
create or replace function privado.guia_entrada(p_socio_id uuid, p_momento timestamptz, p_sede_id uuid default null)
returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  so public.socios; zona text; v public.veredicto_acceso; hoy date; ult date;
  boton text; segundo text; decile text; falta text; solo_encargado boolean := false;
  chips jsonb := '[]'; dias int; previas int; mes int; deuda numeric; titulos text; ag jsonb; sede jsonb; prom record; em public.emergencias_puerta; en_emergencia boolean := false; transf record; transf_n int; minutos int; hace text;
  clases_hoy int; primera timestamptz; pesos text; etiquetas jsonb := jsonb_build_object(
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

  -- VD-46M: puerta en emergencia en esta sede. Quien no podía entrar se anota igual (queda marcado); no a un suspendido ni a un dado de baja.
  em := privado.emergencia_activa(so.gimnasio_id, p_sede_id, p_momento);
  if em.id is not null then
    if not v.puede and v.motivo not in ('suspendido', 'se_fue') then
      en_emergencia := true; boton := 'anotar'; segundo := null;
      decile := 'EMERGENCIA en la puerta (' || em.motivo || '): anotale la entrada, queda marcada. Cobrale cuando se pueda.';
    end if;
    chips := chips || jsonb_build_object('clave', 'emergencia', 'emoji', '🚨', 'texto', 'Puerta en emergencia hasta las ' || to_char(em.vence_en at time zone zona, 'HH24:MI'));
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
  -- VD-2b: tiene una clase reservada para hoy (confirmada, no cancelada) en esta sede.
  select count(*)::int, min(c.inicio) into clases_hoy, primera
    from public.reservas r join public.clases c on c.id = r.clase_id and c.gimnasio_id = r.gimnasio_id
   where r.socio_id = p_socio_id and r.estado = 'confirmada' and c.cancelada_en is null
     and c.inicio >= privado.medianoche(hoy, zona) and c.inicio < privado.medianoche(hoy + 1, zona)
     and (p_sede_id is null or c.sede_id = p_sede_id);
  if clases_hoy > 0 then
    chips := chips || jsonb_build_object('clave', 'clase_hoy', 'emoji', '🏋️',
      'texto', case when clases_hoy = 1 then 'Tiene clase hoy a las ' else 'Tiene ' || clases_hoy || ' clases hoy, la primera a las ' end
               || to_char(primera at time zone zona, 'HH24:MI'));
  end if;
  -- VD-2b: en prueba = entra con un pase o un pack y es su primera vez. Solo informa (no cambia quién entra);
  -- la definición completa del pase de prueba la decide Mateo (CLA-6 / REV-1c).
  if v.puede and previas = 0 and v.motivo in ('pase_de_hoy', 'pase_reingreso', 'pack', 'pack_reingreso') then
    chips := chips || jsonb_build_object('clave', 'en_prueba', 'emoji', '🧪', 'texto', 'En prueba: es su primera vez con un pase suelto');
  end if;
  -- Ayer o hoy lo dejaron pasar con una promesa y sigue sin estar al día; o prometió pagar para hoy (VD-8):
  -- "Ayer dijo que pagaba hoy". Lo prometido para hoy va primero.
  select i.momento as momento, i.forzado_motivo as motivo, pr.promete_el as promete into prom
    from public.ingresos i left join public.promesas_pago pr on pr.gimnasio_id = i.gimnasio_id and pr.ingreso_id = i.id
   where i.socio_id = p_socio_id and i.resultado = 'forzado' and i.anulado_en is null and i.momento < p_momento
     and (i.momento >= privado.medianoche(hoy - 1, zona) or (pr.promete_el is not null and pr.promete_el between hoy - 7 and hoy))
   order by (pr.promete_el = hoy) desc nulls last, i.momento desc limit 1;
  if found and (not v.puede or v.modo_aviso) then
    chips := chips || jsonb_build_object('clave', 'prometio', 'emoji', '💬',
      'texto', case
        when prom.promete = hoy and privado.dia_local(prom.momento, zona) = hoy - 1 then 'Ayer dijo que pagaba hoy: '
        when prom.promete = hoy and privado.dia_local(prom.momento, zona) = hoy then 'Hoy lo dejaron pasar y promete pagar hoy: '
        when prom.promete = hoy then 'Dijo que pagaba hoy (lo dejaron pasar el ' || to_char(privado.dia_local(prom.momento, zona), 'DD/MM') || '): '
        when prom.promete < hoy then 'Prometió pagar el ' || to_char(prom.promete, 'DD/MM') || ' y no pagó: '
        when privado.dia_local(prom.momento, zona) = hoy then 'Hoy lo dejaron pasar: '
        else 'Ayer lo dejaron pasar: ' end
        || prom.motivo || case when prom.promete > hoy then ' · promete pagar el ' || to_char(prom.promete, 'DD/MM') else '' end);
  end if;
  -- VD-46F: dijo que pagó por transferencia y la recepción todavía no la aprobó. Solo informa: no cambia quién
  -- entra ni el color (la puerta sigue mirando los hechos aprobados). El chip lleva a Transferencias.
  if not v.puede or v.modo_aviso or v.motivo = 'en_tolerancia' then
    select count(*)::int, max(p.creado_en) into transf_n, primera
      from public.pagos p join public.ventas ve on ve.gimnasio_id = p.gimnasio_id and ve.id = p.venta_id
     where ve.socio_id = p_socio_id and p.gimnasio_id = so.gimnasio_id and p.medio = 'transferencia'
       and p.estado = 'pendiente' and p.creado_en <= p_momento;
    if transf_n > 0 then
      select p.monto as monto, p.creado_en as en into transf
        from public.pagos p join public.ventas ve on ve.gimnasio_id = p.gimnasio_id and ve.id = p.venta_id
       where ve.socio_id = p_socio_id and p.gimnasio_id = so.gimnasio_id and p.medio = 'transferencia'
         and p.estado = 'pendiente' and p.creado_en <= p_momento
       order by p.creado_en desc, p.id limit 1;
      minutos := greatest(floor(extract(epoch from (p_momento - transf.en)) / 60)::int, 0);
      hace := case when minutos < 1 then 'hace menos de 1 min' when minutos < 60 then 'hace ' || minutos || ' min'
                   when minutos < 1440 then 'hace ' || (minutos / 60) || case when minutos / 60 = 1 then ' hora' else ' horas' end
                   else 'hace ' || (minutos / 1440) || case when minutos / 1440 = 1 then ' día' else ' días' end end;
      chips := chips || jsonb_build_object('clave', 'transferencia_pendiente', 'emoji', '🧾', 'href', '/transferencias',
        'texto', 'Subió un comprobante ' || hace || ' por ' || privado.formato_pesos(transf.monto)
                 || case when transf_n > 1 then ' (y ' || (transf_n - 1) || ' más)' else '' end
                 || ': falta aprobarlo en Transferencias');
    end if;
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
    'entradas_mes', mes, 'chips', chips, 'emergencia', en_emergencia);
end $$;
revoke all on function privado.guia_entrada(uuid, timestamptz, uuid) from public, anon, authenticated;

-- ── Lo que ve el mostrador ──────────────────────────────────────────
create or replace function public.estado_emergencia_puerta(p_gimnasio_id uuid, p_sede_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; em public.emergencias_puerta; hab boolean;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select coalesce((select c.emergencia_puerta_habilitada from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id), false) into hab;
  em := privado.emergencia_activa(p_gimnasio_id, p_sede_id, now());
  return jsonb_build_object('habilitada', hab, 'puede_activar', hab and e.rol in ('dueno', 'encargado'), 'puede_habilitar', e.rol = 'dueno',
    'activa', case when em.id is null then null else jsonb_build_object(
        'id', em.id, 'sede_id', em.sede_id, 'motivo', em.motivo, 'desde', em.iniciada_en, 'vence_en', em.vence_en,
        'por', (select q.nombre from public.equipo q where q.id = em.iniciada_por),
        'entradas', (select count(*) from public.ingresos i where i.gimnasio_id = em.gimnasio_id and i.emergencia_id = em.id and i.anulado_en is null)) end);
end $$;

-- El dueño la prende o la apaga para su gimnasio. Al apagarla se cierra la que estuviera corriendo.
create or replace function public.habilitar_emergencia_puerta(p_gimnasio_id uuid, p_habilitada boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; n int;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_habilitada is null then raise exception 'Elegí si el modo emergencia queda prendido o apagado.' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set emergencia_puerta_habilitada = p_habilitada where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar la configuración del modo emergencia.'; end if;
  if not p_habilitada then
    update public.emergencias_puerta x set cerrada_en = least(now(), x.vence_en), cerrada_por = e.id
     where x.gimnasio_id = p_gimnasio_id and x.cerrada_en is null and x.iniciada_en <= now() and x.vence_en > now();
  end if;
  return p_habilitada;
end $$;

create or replace function public.activar_emergencia_puerta(p_gimnasio_id uuid, p_sede_id uuid, p_motivo text, p_horas int default 3) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare eid uuid; n int; hab boolean; ahora timestamptz := now();
begin
  eid := privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado'], p_sede_id);
  if p_sede_id is null or not exists (select 1 from public.sedes s where s.id = p_sede_id and s.gimnasio_id = p_gimnasio_id) then
    raise exception 'Elegí la sede donde está la emergencia.' using errcode = '22023';
  end if;
  select coalesce((select c.emergencia_puerta_habilitada from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id), false) into hab;
  if not hab then raise exception 'El modo emergencia está apagado en este gimnasio: el dueño lo prende en Entrada.' using errcode = '42501'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escribí el motivo de la emergencia (por ejemplo: molinete trabado).' using errcode = '22023'; end if;
  if p_horas is null or p_horas < 1 or p_horas > 12 then raise exception 'La emergencia dura de 1 a 12 horas: se corta sola al terminar.' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('gymos:emergencia:' || p_gimnasio_id::text, 0));
  if (privado.emergencia_activa(p_gimnasio_id, p_sede_id, ahora)).id is not null then
    raise exception 'Ya hay una emergencia activa en esta sede.' using errcode = '23505';
  end if;
  insert into public.emergencias_puerta (gimnasio_id, sede_id, motivo, iniciada_en, iniciada_por, vence_en)
  values (p_gimnasio_id, p_sede_id, trim(p_motivo), ahora, eid, ahora + make_interval(hours => p_horas));
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo activar la emergencia.'; end if;
  return public.estado_emergencia_puerta(p_gimnasio_id, p_sede_id);
end $$;

-- Quiénes entraron en una emergencia (activa, cerrada o vencida sola).
create or replace function public.entradas_de_emergencia(p_gimnasio_id uuid, p_emergencia_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if not exists (select 1 from public.emergencias_puerta e where e.id = p_emergencia_id and e.gimnasio_id = p_gimnasio_id) then
    raise exception 'Esa emergencia no existe.' using errcode = 'P0002';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'ingreso_id', i.id, 'momento', i.momento, 'socio_id', s.id, 'socio', trim(s.nombre || ' ' || s.apellido),
      'via', i.via_acceso, 'color', i.color, 'motivo', i.motivo, 'texto', i.texto,
      'no_al_dia', i.forzado_motivo is not null) order by i.momento)
    from public.ingresos i join public.socios s on s.id = i.socio_id and s.gimnasio_id = i.gimnasio_id
   where i.gimnasio_id = p_gimnasio_id and i.emergencia_id = p_emergencia_id and i.anulado_en is null), '[]'::jsonb);
end $$;

-- Cerrarla a mano: devuelve la lista de quiénes entraron.
create or replace function public.cerrar_emergencia_puerta(p_gimnasio_id uuid, p_emergencia_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare eid uuid; em public.emergencias_puerta; n int;
begin
  select * into em from public.emergencias_puerta e where e.id = p_emergencia_id and e.gimnasio_id = p_gimnasio_id;
  if not found then
    perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
    raise exception 'Esa emergencia no existe.' using errcode = 'P0002';
  end if;
  eid := privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado'], em.sede_id);
  update public.emergencias_puerta x set cerrada_en = least(now(), x.vence_en), cerrada_por = eid
   where x.id = p_emergencia_id and x.gimnasio_id = p_gimnasio_id and x.cerrada_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Esa emergencia ya estaba cerrada.' using errcode = '23505'; end if;
  return jsonb_build_object('emergencia_id', p_emergencia_id, 'entradas', public.entradas_de_emergencia(p_gimnasio_id, p_emergencia_id));
end $$;

-- Las últimas emergencias del gimnasio, con cuántos entraron (y cuántos no estaban al día).
create or replace function public.historial_emergencias_puerta(p_gimnasio_id uuid, p_limite int default 20) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if p_limite is null or p_limite < 1 or p_limite > 100 then raise exception 'Pedí entre 1 y 100 emergencias.' using errcode = '22023'; end if;
  return coalesce((select jsonb_agg(t.f order by t.desde desc) from (
    select e.iniciada_en as desde, jsonb_build_object(
      'id', e.id, 'sede', sd.nombre, 'sede_id', e.sede_id, 'motivo', e.motivo, 'desde', e.iniciada_en,
      'hasta', least(e.vence_en, coalesce(e.cerrada_en, e.vence_en)),
      'estado', case when e.cerrada_en is not null then 'cerrada' when now() >= e.vence_en then 'vencida' else 'activa' end,
      'por', q.nombre, 'cerro', c.nombre,
      'entradas', (select count(*) from public.ingresos i where i.gimnasio_id = e.gimnasio_id and i.emergencia_id = e.id and i.anulado_en is null),
      'no_al_dia', (select count(*) from public.ingresos i where i.gimnasio_id = e.gimnasio_id and i.emergencia_id = e.id and i.anulado_en is null and i.forzado_motivo is not null)) as f
      from public.emergencias_puerta e
      join public.sedes sd on sd.id = e.sede_id
      left join public.equipo q on q.id = e.iniciada_por
      left join public.equipo c on c.id = e.cerrada_por
     where e.gimnasio_id = p_gimnasio_id
     order by e.iniciada_en desc limit p_limite) t), '[]'::jsonb);
end $$;

-- La tablet de la puerta (sin sesión: la autoriza su token) pregunta si hay emergencia, para mostrar el cartel rojo.
create or replace function public.kiosco_emergencia(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d public.dispositivos; em public.emergencias_puerta;
begin
  d := privado.tablet_del_token(p_token);
  em := privado.emergencia_activa(d.gimnasio_id, d.sede_id, now());
  return jsonb_build_object('activa', em.id is not null, 'vence_en', em.vence_en);
end $$;

-- kiosco_ultimo (copia de 20261104005100, misma firma): lo que entró por la emergencia se ve amarillo y "pasá", no el rojo real.
create or replace function public.kiosco_ultimo(p_token text, p_desde timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d public.dispositivos;
begin
  d := privado.tablet_del_token(p_token);
  return (select jsonb_build_object('ingreso_id', i.id, 'momento', i.momento, 'nombre', s.nombre, 'resultado', i.resultado,
                                    'color', case when i.emergencia_id is not null and i.forzado_motivo is not null then 'amarillo' else i.color end,
                                    'texto', case when i.emergencia_id is not null and i.forzado_motivo is not null
                                                  then 'La puerta está en emergencia: pasá. Después pasá por recepción.'
                                                  else regexp_replace(replace(i.texto, ' · avisale', ''), ' · debe [^·]*', '', 'g') end)
            from public.ingresos i join public.socios s on s.id = i.socio_id
           where i.dispositivo_id = d.id and i.via_acceso = 'qr_pared' and i.anulado_en is null and i.momento > p_desde
           order by i.momento desc limit 1);
end $$;
revoke all on function public.kiosco_ultimo(text, timestamptz) from public, anon, authenticated;
grant execute on function public.kiosco_ultimo(text, timestamptz) to anon, authenticated, service_role;

revoke all on function public.estado_emergencia_puerta(uuid, uuid), public.habilitar_emergencia_puerta(uuid, boolean), public.activar_emergencia_puerta(uuid, uuid, text, int),
  public.entradas_de_emergencia(uuid, uuid), public.cerrar_emergencia_puerta(uuid, uuid), public.historial_emergencias_puerta(uuid, int),
  public.kiosco_emergencia(text) from public, anon, authenticated;
grant execute on function public.estado_emergencia_puerta(uuid, uuid), public.habilitar_emergencia_puerta(uuid, boolean), public.activar_emergencia_puerta(uuid, uuid, text, int),
  public.entradas_de_emergencia(uuid, uuid), public.cerrar_emergencia_puerta(uuid, uuid), public.historial_emergencias_puerta(uuid, int) to authenticated, service_role;
grant execute on function public.kiosco_emergencia(text) to anon, authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record; ri text := pg_get_functiondef('privado.registrar_ingreso(uuid, uuid, text, uuid, uuid, text, timestamptz)'::regprocedure);
  gu text := pg_get_functiondef('privado.guia_entrada(uuid, timestamptz, uuid)'::regprocedure);
begin
  if not (select relrowsecurity from pg_class where oid = 'public.emergencias_puerta'::regclass) then raise exception 'Verificación: emergencias_puerta sin RLS'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'emergencia_puerta_habilitada' and column_default = 'false') then
    raise exception 'Verificación: el modo emergencia no arranca apagado';
  end if;
  if has_table_privilege('authenticated', 'public.emergencias_puerta', 'insert') or has_table_privilege('authenticated', 'public.emergencias_puerta', 'update') then raise exception 'Verificación: emergencias_puerta se escribe directo'; end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'public' and p.proname in ('estado_emergencia_puerta', 'habilitar_emergencia_puerta', 'activar_emergencia_puerta', 'entradas_de_emergencia', 'cerrar_emergencia_puerta', 'historial_emergencias_puerta', 'kiosco_emergencia', 'kiosco_ultimo'))
               or (s.nspname = 'privado' and p.proname in ('emergencia_activa', 'registrar_ingreso', 'guia_entrada')) loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if r.proname not in ('kiosco_emergencia', 'kiosco_ultimo') and has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
    if r.proname in ('emergencia_activa', 'registrar_ingreso', 'guia_entrada') and has_function_privilege('authenticated', r.oid, 'execute') then raise exception 'Verificación: privado.% quedó expuesta', r.proname; end if;
  end loop;
  if ri not like '%emergencia_activa%' or ri not like '%configuracion_visita%' or ri not like '%alertas_prestamo%' or ri not like '%60 seconds%' then raise exception 'Verificación: registrar_ingreso perdió el reingreso, el anti-préstamo o la emergencia'; end if;
  if gu not like '%emergencia_activa%' or gu not like '%transferencia_pendiente%' or gu not like '%promesas_pago%' or gu not like '%clase_hoy%' then raise exception 'Verificación: la guía perdió chips'; end if;
end $$;
