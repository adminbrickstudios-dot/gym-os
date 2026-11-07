-- VD-51 · Prueba gratis (D31). La da la recepción desde la Entrada o la reserva el Interesado desde la página.
--   configuracion_gimnasio.prueba_gratis   'no' (por defecto) | 'dia' | 'clase'. Lo cambia solo el dueño: regala entradas.
--   pruebas_gratis                         un HECHO por DNI y gimnasio: quién la dio, cuándo, para qué día o clase. Nunca un estado.
--   privado.via_prueba                     la cuarta vía del cálculo de la puerta: verde "En prueba" dentro de la ventana de la prueba;
--                                          después, rojo "Ya usó su prueba gratis el 12/10 · Hacete socio". Se calcula, no se guarda.
--   privado.calcular_acceso                (misma firma; copia de 20261106007700) suma la vía de prueba con la prioridad MÁS BAJA:
--                                          quien tiene membresía, pase o pack entra por eso, y la prueba no cambia nada de su plan.
--   privado.guia_entrada                   (misma firma; copia de 20261106007501) "En prueba" deja de ser la situación provisoria de VD-2b
--                                          (primera vez con un pase) y pasa a ser la definitiva: es la prueba gratis real.
--   dar_prueba_gratis / prueba_por_dni / anular_prueba_gratis / config_prueba_gratis / guardar_prueba_gratis   (panel)
--   clases_para_probar / reservar_prueba_publica                                                              (página, sin sesión)
-- Cuenta como ENTRADA (queda en ingresos, vía "prueba") pero NO como socio activo (no hay cobertura, plan, pack ni pase: no suma a
-- "Socios activos", ni a Retención, ni a cobros) y no consume nada de ningún plan.
-- Decisiones prudentes: la prueba es solo para quien nunca fue socio (sin suscripción, pack, pase ni pago); una vez por DNI y gimnasio;
-- la reserva desde la página no da entrada hasta que la recepción lo deja pasar y respeta el cupo de la clase.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.prospectos') is null or to_regclass('public.clases') is null or to_regclass('public.reservas') is null then raise exception 'Guarda: faltan prospectos, clases o reservas'; end if;
  if to_regprocedure('privado.calcular_acceso(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta calcular_acceso'; end if;
  if pg_get_functiondef('privado.calcular_acceso(uuid, timestamptz, uuid)'::regprocedure) not like '%cubierto_por_titular%' then raise exception 'Guarda: calcular_acceso vigente sin el plan familiar (VD-46G)'; end if;
  if pg_get_functiondef('privado.guia_entrada(uuid, timestamptz, uuid)'::regprocedure) not like '%emergencia_activa%' then raise exception 'Guarda: guia_entrada vigente sin la emergencia (VD-46M)'; end if;
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null or to_regprocedure('public.guardar_socio(uuid, uuid, jsonb)') is null then raise exception 'Guarda: faltan exigir_equipo o guardar_socio'; end if;
  if to_regprocedure('privado.telefono_normalizado(text, text)') is null or to_regprocedure('privado.fecha_corta(timestamptz, text)') is null then raise exception 'Guarda: faltan telefono_normalizado o fecha_corta'; end if;
  if to_regprocedure('privado.registrar_ingreso(uuid, uuid, text, uuid, uuid, text, timestamptz)') is null then raise exception 'Guarda: falta registrar_ingreso'; end if;
end $$;

-- ── La configuración: arranca apagada, la cambia solo el dueño ──────
alter table public.configuracion_gimnasio add column if not exists prueba_gratis text not null default 'no';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_gimnasio_prueba_gratis_check') then
    alter table public.configuracion_gimnasio add constraint configuracion_gimnasio_prueba_gratis_check check (prueba_gratis in ('no', 'dia', 'clase'));
  end if;
end $$;

-- La entrada por prueba se anota con su propia vía (no es membresía, ni pase, ni pack).
alter table public.ingresos drop constraint if exists ingresos_via_habilitante_check;
alter table public.ingresos add constraint ingresos_via_habilitante_check check (via_habilitante in ('membresia', 'pase', 'pack', 'prueba'));

-- ── El hecho: la prueba ─────────────────────────────────────────────
create table if not exists public.pruebas_gratis (
  id              uuid primary key default gen_random_uuid(),
  gimnasio_id     uuid not null references public.gimnasios(id),
  dni             text not null check (dni ~ '^[0-9]{6,9}$'),
  nombre          text not null check (length(trim(nombre)) between 1 and 120),
  telefono        text check (telefono is null or telefono ~ '^\+[0-9]{8,15}$'),
  modo            text not null check (modo in ('dia', 'clase')),
  sede_id         uuid not null,
  clase_id        uuid,
  desde           timestamptz not null,
  hasta           timestamptz not null,
  origen          text not null check (origen in ('entrada', 'pagina')),
  socio_id        uuid,
  prospecto_id    uuid,
  dada_por        uuid,
  creado_en       timestamptz not null default now(),
  anulada_en      timestamptz,
  anulada_por     uuid,
  anulada_motivo  text,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, sede_id) references public.sedes (gimnasio_id, id),
  foreign key (gimnasio_id, clase_id) references public.clases (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, prospecto_id) references public.prospectos (gimnasio_id, id),
  foreign key (gimnasio_id, dada_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, anulada_por) references public.equipo (gimnasio_id, id),
  check (hasta > desde),
  check (modo <> 'clase' or clase_id is not null),
  check (origen <> 'entrada' or dada_por is not null),
  check ((anulada_en is null) = (anulada_motivo is null) and (anulada_en is null) = (anulada_por is null))
);
-- Una sola vez por DNI y gimnasio: la anulada (se la dio por error) no cuenta.
create unique index if not exists pruebas_gratis_un_dni on public.pruebas_gratis (gimnasio_id, dni) where anulada_en is null;
create index if not exists pruebas_gratis_socio on public.pruebas_gratis (gimnasio_id, socio_id) where socio_id is not null;
create index if not exists pruebas_gratis_clase on public.pruebas_gratis (gimnasio_id, clase_id) where clase_id is not null;
-- Las lee el equipo de la puerta; se escribe únicamente con las funciones de abajo.
select privado.politicas_estandar('public.pruebas_gratis', array['dueno', 'encargado', 'recepcion'], '{}');
revoke all on table public.pruebas_gratis from anon;
revoke insert, update, delete, truncate, references, trigger on public.pruebas_gratis from authenticated;
-- Un hecho no se borra ni se corrige: se anula, o se le asocia el socio cuando llega.
drop trigger if exists pruebas_gratis_inmutable on public.pruebas_gratis;
create trigger pruebas_gratis_inmutable before update or delete on public.pruebas_gratis
  for each row execute function privado.hecho_inmutable('socio_id', 'anulada_en', 'anulada_por', 'anulada_motivo');

-- ── La vía de prueba (se calcula de los horarios de la prueba) ──────
create or replace function privado.via_prueba(p_socio_id uuid, p_momento timestamptz, p_sede_id uuid, p_zona text)
returns public.veredicto_acceso
language plpgsql stable set search_path = '' as $$
declare v public.veredicto_acceso; pr public.pruebas_gratis; hora_ini text; dia_txt text;
begin
  select x.* into pr from public.pruebas_gratis x where x.socio_id = p_socio_id and x.anulada_en is null order by x.desde desc limit 1;
  if pr.id is null then return null; end if;
  v.via := 'prueba'; v.consume := 'nada'; v.puede := false;
  dia_txt := privado.fecha_corta(pr.hasta - interval '1 minute', p_zona);
  if p_momento >= pr.desde and p_momento < pr.hasta then
    if p_sede_id is not null and pr.sede_id <> p_sede_id then
      v.color := 'rojo'; v.motivo := 'prueba_fuera_de_sede'; v.texto := 'Su prueba gratis es en otra sede';
    else
      v.puede := true; v.color := 'verde'; v.motivo := 'en_prueba'; v.vence_en := pr.hasta;
      select to_char(c.inicio at time zone p_zona, 'HH24:MI') into hora_ini from public.clases c where c.id = pr.clase_id;
      v.texto := case when pr.modo = 'clase' then 'En prueba gratis · clase de las ' || coalesce(hora_ini, '?') else 'En prueba gratis · hoy' end;
    end if;
  elsif p_momento < pr.desde then
    v.color := 'rojo'; v.motivo := 'prueba_fuera_de_hora'; v.vence_en := pr.hasta;
    v.texto := case when pr.modo = 'clase'
      then 'Su prueba gratis es la clase del ' || dia_txt || ' (entra desde las ' || to_char(pr.desde at time zone p_zona, 'HH24:MI') || ')'
      else 'Su prueba gratis es el ' || dia_txt end;
  else
    v.color := 'rojo'; v.motivo := 'prueba_usada'; v.vence_en := pr.hasta;
    v.texto := 'Ya usó su prueba gratis el ' || dia_txt || ' · Hacete socio';
  end if;
  return v;
end $$;
revoke all on function privado.via_prueba(uuid, timestamptz, uuid, text) from public, anon, authenticated;

-- ── La puerta: copia de privado.calcular_acceso (20261106007700) con la prueba ──
create or replace function privado.calcular_acceso(p_socio_id uuid, p_momento timestamptz, p_sede_id uuid default null)
returns public.veredicto_acceso
language plpgsql stable set search_path = '' as $$
declare
  so public.socios; zona text; cfg public.configuracion_gimnasio;
  v public.veredicto_acceso; vb public.veredicto_acceso;
  vm public.veredicto_acceso; vp public.veredicto_acceso; vk public.veredicto_acceso; vq public.veredicto_acceso;
  avisos text[] := '{}'; hoy date; de_baja boolean; deuda numeric;
  tit uuid; tipo_plan text; st public.socios; vt public.veredicto_acceso; nom text; etq text; expl text;
begin
  select * into so from public.socios where id = p_socio_id;
  if not found then raise exception 'Socio inexistente: %', p_socio_id using errcode = 'P0002'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = so.gimnasio_id;
  select * into cfg from public.configuracion_gimnasio where gimnasio_id = so.gimnasio_id;
  hoy := privado.dia_local(p_momento, zona);
  de_baja := so.dado_de_baja_en is not null and so.dado_de_baja_en <= p_momento;

  vb := privado.bloqueo_persona(p_socio_id, p_momento);
  if vb.color is not null then
    v := vb;
  else
    if not de_baja then vm := privado.via_membresia(p_socio_id, p_momento, p_sede_id, zona, cfg); end if;
    vp := privado.via_pase(p_socio_id, p_momento, p_sede_id, cfg);
    vk := privado.via_pack(p_socio_id, p_momento, p_sede_id, zona, cfg);
    -- VD-51: la prueba gratis es la vía de menor prioridad; quien tiene membresía, pase o pack entra por eso.
    if not de_baja then vq := privado.via_prueba(p_socio_id, p_momento, p_sede_id, zona); end if;

    if    coalesce(vm.puede, false) then v := vm;
    elsif coalesce(vp.puede, false) then v := vp;
    elsif coalesce(vk.puede, false) then v := vk;
    elsif coalesce(vq.puede, false) then v := vq;
    elsif vm.color is not null then v := vm;
    elsif vk.color is not null then v := vk;
    elsif vp.color is not null then v := vp;
    elsif vq.color is not null then v := vq;
    else
      v.puede := false; v.color := 'gris'; v.via := 'ninguna'; v.consume := 'nada';
      if de_baja then
        v.motivo := 'se_fue'; v.texto := 'Se dio de baja el ' || privado.fecha_corta(so.dado_de_baja_en, zona);
      else
        v.motivo := 'sin_plan'; v.texto := 'Sin plan activo';
      end if;
    end if;

    if vm.color is not null and vm.motivo is distinct from v.motivo and vm.color <> 'verde' then avisos := array_append(avisos, vm.texto); end if;
    if vk.color is not null and vk.motivo is distinct from v.motivo and vk.color <> 'verde' then avisos := array_append(avisos, vk.texto); end if;
    if vp.color is not null and vp.motivo is distinct from v.motivo and vp.color <> 'verde' then avisos := array_append(avisos, vp.texto); end if;
    if de_baja and v.motivo <> 'se_fue' then
      avisos := array_append(avisos, 'Se dio de baja el ' || privado.fecha_corta(so.dado_de_baja_en, zona));
    end if;

    -- VD-46G: sin cobertura propia, un miembro de un grupo con titular entra con la del titular.
    -- Quien tiene la suya (membresía, pase o pack) entra con la propia; una pausa propia (congelada) tampoco se pisa.
    if cfg.plan_familiar_activo and so.grupo_familiar_id is not null and not de_baja
       and not coalesce(v.puede, false) and v.motivo is distinct from 'congelada' then
      select gf.titular_id, gf.tipo into tit, tipo_plan from public.grupos_familiares gf where gf.id = so.grupo_familiar_id;
      if tit is not null and tit <> p_socio_id then
        select * into st from public.socios where id = tit;
        nom := trim(st.nombre || ' ' || st.apellido);
        etq := case tipo_plan when 'corporativo' then 'plan corporativo' else 'plan familiar' end;
        if st.dado_de_baja_en is not null and st.dado_de_baja_en <= p_momento then
          expl := 'Plan individual pendiente · ' || nom || ' (titular del ' || etq || ') se dio de baja el ' || privado.fecha_corta(st.dado_de_baja_en, zona);
          if v.motivo = 'sin_plan' then
            v.color := 'rojo'; v.motivo := 'plan_individual_pendiente'; v.texto := expl;
          else
            avisos := array_append(avisos, expl);
          end if;
        else
          vt := privado.via_membresia(tit, p_momento, p_sede_id, zona, cfg);
          if coalesce(vt.puede, false) then
            v := vt; v.motivo := 'cubierto_por_titular'; v.consume := 'nada';
            v.texto := 'Cubierto por ' || nom || ' · ' || replace(vt.texto, ' · avisale', ' · avisale a ' || nom);
          elsif vt.motivo in ('fuera_de_franja', 'tope_semanal', 'fuera_de_sede') then
            -- Los límites del plan se miden con las visitas de quien los usa; las del titular no cuentan para el miembro.
            v.puede := true; v.color := 'verde'; v.via := 'membresia'; v.consume := 'nada'; v.motivo := 'cubierto_por_titular';
            v.vence_en := vt.vence_en; v.texto := 'Cubierto por ' || nom;
          else
            expl := 'El ' || etq || ' de ' || nom || ' ' || case
              when vt.motivo = 'vencida' then 'venció el ' || privado.ultimo_dia(vt.vence_en, zona)
              when vt.motivo = 'sin_pago' then 'todavía no está pago'
              when vt.motivo = 'congelada' then 'está congelado'
              when vt.motivo = 'todavia_no_arranca' then 'todavía no empezó'
              when vt.texto is null then 'no tiene una membresía activa'
              else '· ' || vt.texto end;
            if v.motivo = 'sin_plan' then
              v.color := 'rojo'; v.motivo := 'titular_vencido'; v.texto := expl;
            else
              avisos := array_append(avisos, expl);
            end if;
          end if;
        end if;
      end if;
    end if;
  end if;

  if so.fecha_nacimiento is not null and to_char(so.fecha_nacimiento, 'MMDD') = to_char(hoy, 'MMDD') then
    avisos := array_append(avisos, 'Cumple años hoy');
  end if;

  -- D5: si debe algo a cuenta, se avisa; si puede entrar, pasa a amarillo (no lo deja afuera).
  deuda := privado.deuda_socio(p_socio_id);
  if deuda > 0 then
    avisos := array_append(avisos, 'Debe ' || privado.formato_pesos(deuda) || ' a cuenta');
    if v.puede and v.color = 'verde' then v.color := 'amarillo'; end if;
  end if;

  -- Modo aviso: la primera semana nadie queda afuera por un dato mal
  -- importado. La suspensión no es un dato importado: es una decisión.
  v.modo_aviso := false;
  if not v.puede and v.motivo <> 'suspendido'
     and cfg.avisar_sin_bloquear_hasta is not null and cfg.avisar_sin_bloquear_hasta > p_momento then
    v.puede := true; v.modo_aviso := true;
    avisos := array_prepend('Modo aviso: el sistema habría bloqueado, pero deja pasar'::text, avisos);
  end if;
  v.avisos := avisos;
  v.consume := coalesce(v.consume, 'nada');
  return v;
end $$;
revoke all on function privado.calcular_acceso(uuid, timestamptz, uuid) from public, anon, authenticated;

-- ── La guía de la Entrada: "En prueba" definitiva ───────────────────
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
    when 'en_prueba' then
      boton := 'anotar'; decile := 'Está en su prueba gratis: anotale la entrada. Si le gusta, ofrecele un plan.';
    when 'prueba_usada' then
      boton := 'cobrar'; decile := 'Ya usó su prueba gratis: decile que se haga socio, ofrecele un plan y cobrale.';
    when 'prueba_fuera_de_hora', 'prueba_fuera_de_sede' then
      boton := 'dejar_pasar'; decile := 'Su prueba gratis es para otro momento o sede: dejalo pasar si corresponde.';
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
  -- VD-51: en prueba = hoy entra con su prueba gratis (la da la recepción o la reservó desde la página). Es la situación
  -- definitiva: reemplaza a la provisoria de VD-2b (la primera entrada con un pase suelto), que no era una prueba de verdad.
  if v.motivo = 'en_prueba' then
    chips := chips || jsonb_build_object('clave', 'en_prueba', 'emoji', '🧪', 'texto', 'En prueba gratis: es su prueba, sin plan');
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

-- ── Configuración (panel) ───────────────────────────────────────────
create or replace function public.config_prueba_gratis(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare m text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select c.prueba_gratis into m from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  return jsonb_build_object('modo', coalesce(m, 'no'));
end $$;

-- Regala entradas: solo el dueño la prende o la apaga.
create or replace function public.guardar_prueba_gratis(p_gimnasio_id uuid, p_modo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_modo is null or p_modo not in ('no', 'dia', 'clase') then raise exception 'Prueba gratis: elegí no, 1 día o 1 clase.' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set prueba_gratis = p_modo, actualizado_en = now() where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar: el gimnasio no tiene configuración'; end if;
  return public.config_prueba_gratis(p_gimnasio_id);
end $$;

-- ¿Ya hay una prueba para este DNI? (la reservó desde la página, o ya la usó). Para que la Entrada lo diga antes de pedir datos.
create or replace function public.prueba_por_dni(p_gimnasio_id uuid, p_dni text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_dni text := nullif(regexp_replace(coalesce(p_dni, ''), '\D', '', 'g'), ''); pr public.pruebas_gratis; zona text; m text; hora text; clase_txt text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select c.prueba_gratis into m from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  select x.* into pr from public.pruebas_gratis x where x.gimnasio_id = p_gimnasio_id and x.dni = v_dni and x.anulada_en is null;
  if pr.id is null then return jsonb_build_object('modo', coalesce(m, 'no'), 'existe', false); end if;
  select a.nombre || ' · ' || to_char(c.inicio at time zone zona, 'DD/MM HH24:MI') into clase_txt
    from public.clases c join public.actividades a on a.id = c.actividad_id where c.id = pr.clase_id;
  return jsonb_build_object('modo', coalesce(m, 'no'), 'existe', true, 'nombre', pr.nombre, 'telefono', pr.telefono,
    'reservada', pr.origen = 'pagina' and pr.socio_id is null, 'usada', pr.socio_id is not null or pr.hasta <= now(),
    'dia', privado.fecha_corta(pr.hasta - interval '1 minute', zona), 'clase', clase_txt);
end $$;

-- La recepción da la prueba (DNI nuevo, Interesado, o quien reservó desde la página) o se la da a un socio que nunca tuvo plan.
-- Crea al socio sin plan si hace falta, todo en un solo paso: si algo falla, no queda nada a medias.
create or replace function public.dar_prueba_gratis(
  p_gimnasio_id uuid, p_sede_id uuid, p_dni text default null, p_nombre text default null, p_apellido text default null,
  p_telefono text default null, p_clase_id uuid default null, p_socio_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  eid uuid; modo text; zona text; v_dni text; so public.socios; pr public.pruebas_gratis; tel text; sid uuid; pid uuid;
  cl public.clases; d1 timestamptz; d2 timestamptz; ahora timestamptz := now(); nom text; n int; nuevo uuid; numero int;
begin
  eid := privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado', 'recepcion'], p_sede_id);
  if not exists (select 1 from public.sedes s where s.id = p_sede_id and s.gimnasio_id = p_gimnasio_id) then raise exception 'Sede inválida' using errcode = '22023'; end if;
  select c.prueba_gratis into modo from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  if coalesce(modo, 'no') = 'no' then raise exception 'Este gimnasio no da prueba gratis. El dueño la prende en Configuración → Planes.' using errcode = '42501'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;

  -- ¿Quién es? Un socio que ya está (sin plan) o un DNI nuevo.
  if p_socio_id is not null then
    select * into so from public.socios s where s.id = p_socio_id and s.gimnasio_id = p_gimnasio_id;
    if so.id is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
    v_dni := so.dni;
    if v_dni is null then raise exception 'Para darle la prueba gratis cargale primero el DNI en su ficha.' using errcode = '22023'; end if;
  else
    v_dni := nullif(regexp_replace(coalesce(p_dni, ''), '\D', '', 'g'), '');
    if v_dni is null or v_dni !~ '^[0-9]{6,9}$' then raise exception 'El DNI tiene que tener entre 6 y 9 números.' using errcode = '22023'; end if;
    select * into so from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dni = v_dni;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('gymos:prueba:' || p_gimnasio_id::text || ':' || v_dni, 0));

  -- Quien ya es o fue socio no es para la prueba (D31: es para quien todavía no vino).
  if so.id is not null and (
       so.dado_de_baja_en is not null
    or exists (select 1 from public.suscripciones x where x.socio_id = so.id)
    or exists (select 1 from public.packs x where x.socio_id = so.id)
    or exists (select 1 from public.pases_diarios x where x.socio_id = so.id)
    or exists (select 1 from public.ventas x where x.socio_id = so.id)) then
    raise exception 'Ya es o fue socio: la prueba gratis es para quien todavía no vino.' using errcode = '22023';
  end if;

  -- Una vez por DNI y gimnasio.
  select x.* into pr from public.pruebas_gratis x where x.gimnasio_id = p_gimnasio_id and x.dni = v_dni and x.anulada_en is null;
  if pr.id is not null and (pr.socio_id is not null or pr.hasta <= ahora or pr.origen <> 'pagina') then
    raise exception 'Ya usó su prueba gratis el % · Hacete socio.', privado.fecha_corta(pr.hasta - interval '1 minute', zona) using errcode = '22023';
  end if;

  -- Quién entra: el socio que ya está, o se lo da de alta sin plan.
  tel := privado.telefono_normalizado(coalesce(p_telefono, pr.telefono), 'WhatsApp');
  nom := trim(coalesce(nullif(trim(coalesce(p_nombre, '')), ''), pr.nombre, ''));
  if so.id is null then
    if length(nom) = 0 then raise exception 'Escribí el nombre.' using errcode = '22023'; end if;
    sid := public.guardar_socio(p_gimnasio_id, null, jsonb_build_object('nombre', nom, 'apellido', trim(coalesce(p_apellido, '')), 'dni', v_dni, 'telefono', tel));
    select s.numero into numero from public.socios s where s.id = sid;
  else
    sid := so.id; numero := so.numero;
    if length(nom) = 0 then nom := so.nombre; end if;
  end if;

  if pr.id is not null then
    -- Había reservado desde la página: ahora llegó. Se le asocia el socio; la ventana de su prueba es la de la reserva.
    update public.pruebas_gratis set socio_id = sid where id = pr.id and socio_id is null;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo asociar la prueba al socio.'; end if;
    nuevo := pr.id;
  else
    -- La ventana de la prueba: el día de hoy, o la clase (la que se pide o la que empieza ahora).
    if modo = 'dia' then
      d1 := privado.medianoche(privado.dia_local(ahora, zona), zona); d2 := privado.medianoche(privado.dia_local(ahora, zona) + 1, zona);
    else
      if p_clase_id is not null then
        select * into cl from public.clases c where c.id = p_clase_id and c.gimnasio_id = p_gimnasio_id and c.sede_id = p_sede_id and c.cancelada_en is null;
      else
        select * into cl from public.clases c
         where c.gimnasio_id = p_gimnasio_id and c.sede_id = p_sede_id and c.cancelada_en is null
           and c.inicio between ahora - interval '45 minutes' and ahora + interval '90 minutes'
         order by abs(extract(epoch from (c.inicio - ahora))) limit 1;
      end if;
      if cl.id is null then raise exception 'La prueba es de 1 clase y ahora no hay ninguna clase empezando en esta sede.' using errcode = '22023'; end if;
      d1 := cl.inicio - interval '60 minutes'; d2 := cl.fin;
    end if;
    insert into public.pruebas_gratis (gimnasio_id, dni, nombre, telefono, modo, sede_id, clase_id, desde, hasta, origen, socio_id, dada_por)
    values (p_gimnasio_id, v_dni, nom, tel, modo, p_sede_id, cl.id, d1, d2, 'entrada', sid, eid)
    returning id into nuevo;
    if nuevo is null then raise exception 'No se pudo registrar la prueba gratis.'; end if;
  end if;

  -- El Interesado con ese DNI o celular ya vino: queda atado al socio.
  update public.prospectos p set estado = 'socio', socio_id = sid, actualizado_en = now()
   where p.gimnasio_id = p_gimnasio_id and p.estado <> 'socio' and (p.dni = v_dni or (tel is not null and p.telefono = tel));
  return jsonb_build_object('prueba_id', nuevo, 'socio_id', sid, 'numero', numero, 'nombre', nom);
end $$;

-- Dada por error: el dueño la anula con un motivo y el DNI vuelve a poder tener la prueba. Nada se borra.
create or replace function public.anular_prueba_gratis(p_prueba_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid; n int;
begin
  select x.gimnasio_id into g from public.pruebas_gratis x where x.id = p_prueba_id;
  if g is null then raise exception 'Sin permiso o prueba inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(g, array['dueno'], null);
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Contá por qué se anula (al menos 5 letras).' using errcode = '22023'; end if;
  update public.pruebas_gratis set anulada_en = now(), anulada_por = eid, anulada_motivo = trim(p_motivo) where id = p_prueba_id and anulada_en is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Esa prueba ya estaba anulada.'; end if;
end $$;

-- ── La página: "Probá una clase" con reserva ────────────────────────
-- Las clases que se pueden probar (próximos 7 días, con lugar). Sin sesión; solo si el gimnasio da la prueba y tiene la página publicada.
create or replace function public.clases_para_probar(p_host text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; zona text;
begin
  select d.gimnasio_id into g from public.dominios_gimnasio d
    join public.landing_gimnasio l on l.gimnasio_id = d.gimnasio_id and l.publicada
    join public.landing_secciones s on s.gimnasio_id = d.gimnasio_id and s.tipo = 'probar' and s.visible
    join public.configuracion_gimnasio c on c.gimnasio_id = d.gimnasio_id and c.prueba_gratis <> 'no'
   where d.host = lower(p_host);
  if g is null then return '[]'::jsonb; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = g;
  return coalesce((
    select jsonb_agg(jsonb_build_object('clase_id', x.id, 'inicio', x.inicio, 'actividad', x.actividad, 'sede', x.sede,
             'texto', x.actividad || ' · ' || to_char(x.inicio at time zone zona, 'DD/MM HH24:MI')) order by x.inicio)
      from (
        select c.id, c.inicio, a.nombre as actividad, s.nombre as sede,
               c.cupo, (select count(*) from public.reservas r where r.clase_id = c.id and r.estado = 'confirmada')
                     + (select count(*) from public.pruebas_gratis pg where pg.clase_id = c.id and pg.anulada_en is null) as ocupados
          from public.clases c
          join public.actividades a on a.id = c.actividad_id
          join public.sedes s on s.id = c.sede_id
         where c.gimnasio_id = g and c.cancelada_en is null and c.inicio > now() + interval '30 minutes' and c.inicio < now() + interval '7 days'
         order by c.inicio limit 40
      ) x
     where x.cupo is null or x.ocupados < x.cupo), '[]'::jsonb);
end $$;

-- Deja el pedido: queda Interesado con la reserva (no con entrada: eso lo decide la recepción cuando llega).
create or replace function public.reservar_prueba_publica(p_host text, p_clase_id uuid, p_nombre text, p_dni text, p_telefono text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  g uuid; modo text; zona text; v_dni text := nullif(regexp_replace(coalesce(p_dni, ''), '\D', '', 'g'), ''); tel text; nom text := trim(coalesce(p_nombre, ''));
  cl public.clases; ocupados int; pid uuid; texto text; interes text;
begin
  select d.gimnasio_id, c.prueba_gratis into g, modo from public.dominios_gimnasio d
    join public.landing_gimnasio l on l.gimnasio_id = d.gimnasio_id and l.publicada
    join public.landing_secciones s on s.gimnasio_id = d.gimnasio_id and s.tipo = 'probar' and s.visible
    join public.configuracion_gimnasio c on c.gimnasio_id = d.gimnasio_id
   where d.host = lower(p_host);
  if g is null then raise exception 'Este gimnasio no está recibiendo pedidos desde la página.'; end if;
  if modo = 'no' then raise exception 'Este gimnasio no da clase de prueba gratis desde la página.'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = g;
  if length(nom) = 0 then raise exception 'Escribí tu nombre.'; end if;
  if length(nom) > 80 then raise exception 'El nombre es muy largo (hasta 80 letras).'; end if;
  if v_dni is null or v_dni !~ '^[0-9]{6,9}$' then raise exception 'Escribí tu DNI, sin puntos (de 6 a 9 números).'; end if;
  begin
    tel := privado.telefono_normalizado(p_telefono, 'WhatsApp');
  exception when others then
    raise exception 'Revisá el WhatsApp: con característica, por ejemplo 387 555 1234.';
  end;
  if tel is null then raise exception 'Dejanos tu WhatsApp para escribirte.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('gymos:prueba:' || g::text || ':' || v_dni, 0));

  select * into cl from public.clases c where c.id = p_clase_id and c.gimnasio_id = g and c.cancelada_en is null
     and c.inicio > now() + interval '30 minutes' and c.inicio < now() + interval '7 days';
  if cl.id is null then raise exception 'Esa clase ya no está disponible: elegí otra.'; end if;
  select (select count(*) from public.reservas r where r.clase_id = cl.id and r.estado = 'confirmada')
       + (select count(*) from public.pruebas_gratis pg where pg.clase_id = cl.id and pg.anulada_en is null) into ocupados;
  if cl.cupo is not null and ocupados >= cl.cupo then raise exception 'Esa clase está completa: elegí otra.'; end if;

  if exists (select 1 from public.socios s where s.gimnasio_id = g and s.dni = v_dni) then
    raise exception 'Ese DNI ya está registrado en el gimnasio: pasá por recepción.';
  end if;
  if exists (select 1 from public.pruebas_gratis x where x.gimnasio_id = g and x.dni = v_dni and x.anulada_en is null) then
    raise exception 'Con ese DNI ya se pidió la prueba gratis.';
  end if;
  if (select count(*) from public.pruebas_gratis x where x.gimnasio_id = g and x.origen = 'pagina' and x.creado_en > now() - interval '1 hour') >= 30 then
    raise exception 'Recibimos muchos pedidos en este momento. Probá en un rato o escribinos por WhatsApp.';
  end if;

  select a.nombre || ' · ' || to_char(cl.inicio at time zone zona, 'DD/MM HH24:MI') into texto from public.actividades a where a.id = cl.actividad_id;
  interes := 'Clase de prueba gratis: ' || texto;
  -- Queda Interesado (por celular o por DNI) con lo que pidió.
  select p.id into pid from public.prospectos p where p.gimnasio_id = g and (p.telefono = tel or p.dni = v_dni) order by (p.telefono = tel) desc limit 1;
  if pid is not null then
    update public.prospectos p set nombre = nom, interes = left(interes, 200), actualizado_en = now(),
           dni = coalesce(p.dni, case when not exists (select 1 from public.prospectos q where q.gimnasio_id = g and q.dni = v_dni and q.id <> p.id) then v_dni end),
           estado = case when p.estado in ('no') then 'nuevo' else p.estado end
     where p.id = pid;
  else
    insert into public.prospectos (gimnasio_id, nombre, telefono, interes, origen, dni) values (g, nom, tel, left(interes, 200), 'pagina', v_dni) returning id into pid;
  end if;

  insert into public.pruebas_gratis (gimnasio_id, dni, nombre, telefono, modo, sede_id, clase_id, desde, hasta, origen, prospecto_id)
  values (g, v_dni, nom, tel, modo, cl.sede_id, cl.id,
          case when modo = 'dia' then privado.medianoche(privado.dia_local(cl.inicio, zona), zona) else cl.inicio - interval '60 minutes' end,
          case when modo = 'dia' then privado.medianoche(privado.dia_local(cl.inicio, zona) + 1, zona) else cl.fin end,
          'pagina', pid);
  return jsonb_build_object('ok', true, 'clase', texto);
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.config_prueba_gratis(uuid), public.guardar_prueba_gratis(uuid, text), public.prueba_por_dni(uuid, text),
  public.dar_prueba_gratis(uuid, uuid, text, text, text, text, uuid, uuid), public.anular_prueba_gratis(uuid, text),
  public.clases_para_probar(text), public.reservar_prueba_publica(text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.config_prueba_gratis(uuid), public.guardar_prueba_gratis(uuid, text), public.prueba_por_dni(uuid, text),
  public.dar_prueba_gratis(uuid, uuid, text, text, text, text, uuid, uuid), public.anular_prueba_gratis(uuid, text) to authenticated, service_role;
grant execute on function public.clases_para_probar(text), public.reservar_prueba_publica(text, uuid, text, text, text) to anon, authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.pruebas_gratis'::regclass) then raise exception 'Verificación: pruebas_gratis sin RLS'; end if;
  if has_table_privilege('anon', 'public.pruebas_gratis', 'select') then raise exception 'Verificación: anon lee las pruebas'; end if;
  if has_table_privilege('authenticated', 'public.pruebas_gratis', 'insert') or has_table_privilege('authenticated', 'public.pruebas_gratis', 'update') then
    raise exception 'Verificación: se pueden escribir pruebas directo';
  end if;
  foreach f in array array['public.config_prueba_gratis(uuid)', 'public.guardar_prueba_gratis(uuid, text)', 'public.prueba_por_dni(uuid, text)',
                           'public.dar_prueba_gratis(uuid, uuid, text, text, text, text, uuid, uuid)', 'public.anular_prueba_gratis(uuid, text)'] loop
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon ejecuta %', f; end if;
  end loop;
  if has_function_privilege('authenticated', 'privado.via_prueba(uuid, timestamptz, uuid, text)', 'execute') then raise exception 'Verificación: authenticated ejecuta via_prueba'; end if;
  if position('via_prueba' in pg_get_functiondef('privado.calcular_acceso(uuid, timestamptz, uuid)'::regprocedure)) = 0 then raise exception 'Verificación: calcular_acceso no usa la prueba'; end if;
  if position('cubierto_por_titular' in pg_get_functiondef('privado.calcular_acceso(uuid, timestamptz, uuid)'::regprocedure)) = 0 then raise exception 'Verificación: calcular_acceso perdió el plan familiar'; end if;
  if position('en_prueba' in pg_get_functiondef('privado.guia_entrada(uuid, timestamptz, uuid)'::regprocedure)) = 0 then raise exception 'Verificación: guia_entrada sin En prueba'; end if;
  if position('primera vez con un pase' in pg_get_functiondef('privado.guia_entrada(uuid, timestamptz, uuid)'::regprocedure)) > 0 then raise exception 'Verificación: quedó la situación provisoria En prueba'; end if;
  if position('emergencia_activa' in pg_get_functiondef('privado.guia_entrada(uuid, timestamptz, uuid)'::regprocedure)) = 0 then raise exception 'Verificación: guia_entrada perdió la emergencia'; end if;
end $$;
