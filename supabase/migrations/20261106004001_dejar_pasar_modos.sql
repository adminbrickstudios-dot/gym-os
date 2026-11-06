-- VD-8 · Dejar pasar sin pagar en tres modos (D19, docs/v2/02 §3).
-- Hasta ahora la recepción dejaba pasar con un motivo y un tope por día (D1). Ahora el dueño elige cómo:
--   1 · recepcion_hasta_dias — la recepción decide sola si el socio promete pagar dentro de N días (por defecto 3);
--       más lejos lo autoriza el dueño o el encargado con su PIN.
--   2 · siempre_pin          — siempre lo autoriza el dueño o el encargado (su sesión o su PIN).
--   3 · libre                — la recepción decide; queda anotado y el dueño lo ve.
-- Un gimnasio que nunca lo eligió sigue como hasta ahora (libre, con el tope por día): nada cambia solo.
-- Las reglas solo se aplican cuando lo que impide entrar es una DEUDA (para_regularizar > 0): "sin pagar".
-- Siempre queda un hecho (public.promesas_pago): quién pidió, quién autorizó (si fue con PIN de otro),
-- qué regla regía y "promete pagar el …". El tope por día y "a suspendidos y dados de baja, solo dueño o
-- encargado" (D1) siguen valiendo. El PIN es el de CAJ-3 (encabezado del operador): nunca da más permisos que la sesión.
--   registrar_ingreso(…, p_promete_pagar_el)   la firma cambia: la anterior se borra acá
--   cupo_dejar_pasar, dejados_pasar            suman modo y promesa
--   prometieron_pagar                          suma el día prometido (Inicio, Vencen hoy)
--   privado.guia_entrada                       el chip de la Entrada: "Ayer dijo que pagaba hoy"
--   config_dejar_pasar / guardar_config_dejar_pasar   Configuración → Cobros (solo el dueño escribe)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.registrar_ingreso(uuid, uuid, text, text, uuid)') is null
     and to_regprocedure('public.registrar_ingreso(uuid, uuid, text, text, uuid, date)') is null then raise exception 'Guarda: falta public.registrar_ingreso'; end if;
  if to_regprocedure('privado.puede_dejar_pasar(uuid, uuid, uuid, uuid)') is null then raise exception 'Guarda: falta privado.puede_dejar_pasar (0049)'; end if;
  if to_regprocedure('privado.operador(uuid)') is null then raise exception 'Guarda: falta privado.operador (PIN, 0071)'; end if;
  if to_regprocedure('privado.guia_entrada(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta privado.guia_entrada'; end if;
  if to_regclass('public.cambios_cobro') is null then raise exception 'Guarda: falta public.cambios_cobro (VD-7)'; end if;
  if to_regprocedure('privado.registro_fijo()') is null then raise exception 'Guarda: falta privado.registro_fijo (VD-7)'; end if;
end $$;

-- ── 1 · La regla del gimnasio ───────────────────────────────────────
create table if not exists public.configuracion_dejar_pasar (
  gimnasio_id      uuid primary key references public.gimnasios(id),
  modo             text not null default 'recepcion_hasta_dias' check (modo in ('recepcion_hasta_dias', 'siempre_pin', 'libre')),
  dias_max         int not null default 3 check (dias_max between 0 and 30),
  actualizado_por  uuid,
  actualizado_en   timestamptz not null default now(),
  foreign key (gimnasio_id, actualizado_por) references public.equipo (gimnasio_id, id)
);
select privado.politicas_estandar('public.configuracion_dejar_pasar', null, '{}');
revoke all on table public.configuracion_dejar_pasar from anon;
revoke truncate, references, trigger on public.configuracion_dejar_pasar from authenticated;

-- ── 2 · El hecho: "promete pagar el …" ──────────────────────────────
create table if not exists public.promesas_pago (
  id              uuid primary key default gen_random_uuid(),
  gimnasio_id     uuid not null references public.gimnasios(id),
  ingreso_id      uuid not null,
  socio_id        uuid not null,
  promete_el      date,
  modo            text not null check (modo in ('recepcion_hasta_dias', 'siempre_pin', 'libre')),
  dias_max        int,
  pedido_por      uuid,
  autorizado_por  uuid,
  creado_en       timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, ingreso_id),
  foreign key (gimnasio_id, ingreso_id) references public.ingresos (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, pedido_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, autorizado_por) references public.equipo (gimnasio_id, id)
);
create index if not exists promesas_pago_socio on public.promesas_pago (gimnasio_id, socio_id, creado_en desc);
create index if not exists promesas_pago_dia on public.promesas_pago (gimnasio_id, promete_el);
select privado.politicas_estandar('public.promesas_pago', array['dueno', 'encargado', 'recepcion'], '{}');
revoke all on table public.promesas_pago from anon;
revoke truncate, references, trigger on public.promesas_pago from authenticated;
drop trigger if exists promesas_pago_inmutable on public.promesas_pago;
create trigger promesas_pago_inmutable before update or delete on public.promesas_pago
  for each row execute function privado.registro_fijo();

create or replace function privado.regla_dejar_pasar(p_gimnasio_id uuid, out p_modo text, out p_dias_max int, out p_configurado boolean)
language plpgsql stable set search_path = '' as $$
declare c public.configuracion_dejar_pasar;
begin
  select * into c from public.configuracion_dejar_pasar where gimnasio_id = p_gimnasio_id;
  if found then p_modo := c.modo; p_dias_max := c.dias_max; p_configurado := true;
  else p_modo := 'libre'; p_dias_max := 3; p_configurado := false; end if;
end $$;
revoke all on function privado.regla_dejar_pasar(uuid) from public, anon, authenticated;

-- ¿Esta persona puede dejar pasar SIN PAGAR con esta promesa? (el rol es el de quien opera: con PIN, el del PIN)
-- Se llama solo cuando ya se sabe que se va a dejar pasar (hay motivo). No reemplaza a puede_dejar_pasar (tope, suspendidos).
create or replace function privado.exigir_promesa(p_gimnasio_id uuid, p_equipo_id uuid, p_socio_id uuid, p_sede_id uuid, p_promete date) returns void
language plpgsql stable set search_path = '' as $$
declare rol text; zona text; hoy date; v public.veredicto_acceso; r record; dias int;
begin
  select e.rol into rol from public.equipo e where e.id = p_equipo_id;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  if p_promete is not null then
    if p_promete < hoy then raise exception 'El día que promete pagar no puede ser anterior a hoy.' using errcode = '22023'; end if;
    if p_promete > hoy + 90 then raise exception 'El día que promete pagar puede ser dentro de hasta 90 días.' using errcode = '22023'; end if;
  end if;
  v := privado.calcular_acceso(p_socio_id, now(), p_sede_id);
  if v.puede or coalesce(v.para_regularizar, 0) <= 0 then return; end if;          -- no es por plata: valen las reglas de siempre
  if rol in ('dueno', 'encargado') then return; end if;
  select * into r from privado.regla_dejar_pasar(p_gimnasio_id);
  if r.p_modo = 'libre' then return; end if;
  if r.p_modo = 'siempre_pin' then
    raise exception 'En este gimnasio dejar pasar sin pagar lo autoriza el dueño o el encargado: que ponga su PIN.' using errcode = '42501';
  end if;
  if p_promete is null then
    raise exception 'Poné qué día promete pagar: la recepción deja pasar si paga dentro de % día%.', r.p_dias_max, case when r.p_dias_max = 1 then '' else 's' end using errcode = '22023';
  end if;
  dias := p_promete - hoy;
  if dias > r.p_dias_max then
    raise exception 'Promete pagar en % día% y la recepción deja pasar hasta %: que lo autorice el dueño o el encargado con su PIN.',
      dias, case when dias = 1 then '' else 's' end, r.p_dias_max using errcode = '42501';
  end if;
end $$;
revoke all on function privado.exigir_promesa(uuid, uuid, uuid, uuid, date) from public, anon, authenticated;

-- ── 3 · registrar_ingreso con la promesa (copia de la 0049 + lo de abajo) ──
drop function if exists public.registrar_ingreso(uuid, uuid, text, text, uuid);
create or replace function public.registrar_ingreso(
  p_socio_id uuid, p_sede_id uuid, p_via_acceso text default 'recepcion',
  p_forzar_motivo text default null, p_dispositivo_id uuid default null, p_promete_pagar_el date default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid; r jsonb; pedido uuid; regla record; n int; humano boolean := false;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if privado.es_servicio() then
    eid := null;   -- kiosco o QR: el servidor validó el dispositivo antes de llamar
    if p_dispositivo_id is not null and not exists (
         select 1 from public.dispositivos d
          where d.id = p_dispositivo_id and d.gimnasio_id = g and d.sede_id = p_sede_id and d.revocado_en is null) then
      raise exception 'Dispositivo revocado o de otra sede' using errcode = '42501';
    end if;
    if p_promete_pagar_el is not null then raise exception 'Una promesa de pago la anota una persona del equipo' using errcode = '42501'; end if;
  else
    eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], p_sede_id);
    if p_dispositivo_id is not null then raise exception 'Un dispositivo solo registra desde el servidor' using errcode = '42501'; end if;
    humano := true;
    if length(trim(coalesce(p_forzar_motivo, ''))) > 0 then
      -- D1: tope por día; a suspendidos y dados de baja, solo dueño o encargado.
      perform privado.puede_dejar_pasar(g, eid, p_socio_id, p_sede_id);
      -- D19: según el modo del gimnasio, la promesa y el PIN.
      perform privado.exigir_promesa(g, eid, p_socio_id, p_sede_id, p_promete_pagar_el);
    elsif p_promete_pagar_el is not null then
      raise exception 'El día que promete pagar va con el motivo de dejarlo pasar' using errcode = '22023';
    end if;
  end if;
  r := privado.registrar_ingreso(p_socio_id, p_sede_id, p_via_acceso, eid, p_dispositivo_id, p_forzar_motivo, null);

  -- El hecho: quién lo pidió (la sesión), quién lo autorizó (el del PIN, si es otro) y qué regla regía.
  if humano and r ->> 'resultado' = 'forzado' and not coalesce((r ->> 'repetido')::boolean, false) then
    select e.id into pedido from public.equipo e where e.gimnasio_id = g and e.usuario_id = auth.uid() and e.activo
     order by e.creado_en limit 1;
    select * into regla from privado.regla_dejar_pasar(g);
    insert into public.promesas_pago (gimnasio_id, ingreso_id, socio_id, promete_el, modo, dias_max, pedido_por, autorizado_por)
    values (g, (r ->> 'ingreso_id')::uuid, p_socio_id, p_promete_pagar_el, regla.p_modo, regla.p_dias_max,
            coalesce(pedido, eid), case when pedido is not null and pedido <> eid then eid end);
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo anotar la promesa de pago'; end if;
  end if;
  return r;
end $$;

-- ── Lo que ve la pantalla antes de dejar pasar ──────────────────────
create or replace function public.cupo_dejar_pasar(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; tope int; regla record;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select c.tope_dejar_pasar into tope from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  select * into regla from privado.regla_dejar_pasar(p_gimnasio_id);
  return jsonb_build_object('sin_tope', e.rol in ('dueno', 'encargado'), 'tope', tope, 'usados', privado.dejados_hoy(p_gimnasio_id, e.id),
                            'modo', regla.p_modo, 'dias_max', regla.p_dias_max,
                            'hay_pines', exists (select 1 from privado.pines_equipo pe join public.equipo q on q.id = pe.equipo_id where pe.gimnasio_id = p_gimnasio_id and q.activo and q.rol in ('dueno', 'encargado')));
end $$;

-- ── El resumen del dueño: a quién dejaron pasar hoy (con la promesa) ─
create or replace function public.dejados_pasar(p_gimnasio_id uuid, p_dia date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; dia date;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  dia := coalesce(p_dia, privado.dia_local(now(), zona));
  return coalesce((select jsonb_agg(jsonb_build_object(
      'ingreso_id', i.id, 'momento', i.momento, 'socio_id', s.id, 'socio', trim(s.nombre || ' ' || s.apellido),
      'por', coalesce(qp.nombre, q.nombre), 'motivo', i.forzado_motivo, 'porque_no', i.texto,
      'promete_el', pr.promete_el, 'autorizo', a.nombre) order by i.momento desc)
    from public.ingresos i join public.socios s on s.id = i.socio_id left join public.equipo q on q.id = i.registrado_por
    left join public.promesas_pago pr on pr.gimnasio_id = i.gimnasio_id and pr.ingreso_id = i.id
    left join public.equipo qp on qp.id = pr.pedido_por
    left join public.equipo a on a.id = pr.autorizado_por
   where i.gimnasio_id = p_gimnasio_id and i.resultado = 'forzado' and i.anulado_en is null
     and i.momento >= privado.medianoche(dia, zona) and i.momento < privado.medianoche(dia + 1, zona)), '[]');
end $$;

-- ── "Prometieron pagar": ayer y hoy, y los que prometieron para hoy (hasta 7 días atrás) ─
-- Sigue calculándose del cálculo de la puerta (sin estado guardado): sale solo cuando pagan.
create or replace function public.prometieron_pagar(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; zona text; desde timestamptz; hoy date;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  desde := privado.medianoche(hoy - 1, zona);   -- ayer y hoy
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'socio_id', x.socio_id, 'socio', x.socio, 'momento', x.momento, 'motivo', x.motivo, 'por', x.por,
             'texto', (x.v).texto, 'telefono', x.telefono, 'promete_el', x.promete_el, 'autorizo', x.autorizo)
           order by (x.promete_el = hoy) desc nulls last, x.momento desc)
      from (
        select distinct on (i.socio_id) i.socio_id, trim(s.nombre || ' ' || s.apellido) as socio, i.momento,
               i.forzado_motivo as motivo, coalesce(qp.nombre, q.nombre) as por, s.telefono, pr.promete_el, a.nombre as autorizo,
               privado.calcular_acceso(i.socio_id, now(), null) as v
          from public.ingresos i
          join public.socios s on s.id = i.socio_id
          left join public.equipo q on q.id = i.registrado_por
          left join public.promesas_pago pr on pr.gimnasio_id = i.gimnasio_id and pr.ingreso_id = i.id
          left join public.equipo qp on qp.id = pr.pedido_por
          left join public.equipo a on a.id = pr.autorizado_por
         where i.gimnasio_id = p_gimnasio_id and i.resultado = 'forzado' and i.anulado_en is null
           and (i.momento >= desde or (pr.promete_el is not null and pr.promete_el between hoy - 7 and hoy))
           and s.dado_de_baja_en is null
           and (e.rol <> 'recepcion' or i.registrado_por = e.id or pr.pedido_por = e.id)
         order by i.socio_id, i.momento desc
      ) x
     where not coalesce((x.v).puede, false) or (x.v).modo_aviso), '[]');
end $$;

-- ── La guía de la Entrada: copia de la 20261106003802 con el chip de la promesa ──
create or replace function privado.guia_entrada(p_socio_id uuid, p_momento timestamptz, p_sede_id uuid default null)
returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  so public.socios; zona text; v public.veredicto_acceso; hoy date; ult date;
  boton text; segundo text; decile text; falta text; solo_encargado boolean := false;
  chips jsonb := '[]'; dias int; previas int; mes int; deuda numeric; titulos text; ag jsonb; sede jsonb; prom record;
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

-- ── 4 · Configuración → Cobros → "Dejar pasar sin pagar" ────────────
create or replace function public.config_dejar_pasar(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare regla record; tope int; ult jsonb;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select * into regla from privado.regla_dejar_pasar(p_gimnasio_id);
  select c.tope_dejar_pasar into tope from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  select jsonb_build_object('detalle', x.detalle, 'por', q.nombre, 'cuando', x.cambiado_en) into ult
    from public.cambios_cobro x left join public.equipo q on q.id = x.equipo_id
   where x.gimnasio_id = p_gimnasio_id and x.tema = 'dejar_pasar' order by x.cambiado_en desc limit 1;
  return jsonb_build_object('configurado', regla.p_configurado, 'modo', regla.p_modo, 'dias_max', regla.p_dias_max, 'tope_por_dia', tope, 'ultimo_cambio', ult);
end $$;

create or replace function public.guardar_config_dejar_pasar(p_gimnasio_id uuid, p_modo text, p_dias_max int default 3) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; antes record; n int;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_modo is null or p_modo not in ('recepcion_hasta_dias', 'siempre_pin', 'libre') then
    raise exception 'Dejar pasar sin pagar: elegí la recepción hasta N días, siempre con PIN, o libre con registro.' using errcode = '22023';
  end if;
  if p_dias_max is null or p_dias_max not between 0 and 30 then
    raise exception 'Hasta cuántos días decide la recepción: un número entre 0 y 30.' using errcode = '22023';
  end if;
  select * into antes from privado.regla_dejar_pasar(p_gimnasio_id);
  insert into public.configuracion_dejar_pasar (gimnasio_id, modo, dias_max, actualizado_por, actualizado_en)
  values (p_gimnasio_id, p_modo, p_dias_max, e.id, now())
  on conflict (gimnasio_id) do update set modo = excluded.modo, dias_max = excluded.dias_max, actualizado_por = excluded.actualizado_por, actualizado_en = now();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar cómo se deja pasar sin pagar.'; end if;
  if not antes.p_configurado or antes.p_modo <> p_modo or antes.p_dias_max <> p_dias_max then
    insert into public.cambios_cobro (gimnasio_id, tema, detalle, antes, despues, equipo_id, usuario_id)
    values (p_gimnasio_id, 'dejar_pasar', 'Cómo se deja pasar sin pagar',
            case when antes.p_configurado then jsonb_build_object('modo', antes.p_modo, 'dias_max', antes.p_dias_max) end,
            jsonb_build_object('modo', p_modo, 'dias_max', p_dias_max), e.id, auth.uid());
  end if;
  return public.config_dejar_pasar(p_gimnasio_id);
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function public.registrar_ingreso(uuid, uuid, text, text, uuid, date), public.cupo_dejar_pasar(uuid), public.dejados_pasar(uuid, date),
  public.prometieron_pagar(uuid), public.config_dejar_pasar(uuid), public.guardar_config_dejar_pasar(uuid, text, int) from public, anon, authenticated;
grant execute on function public.registrar_ingreso(uuid, uuid, text, text, uuid, date), public.cupo_dejar_pasar(uuid), public.dejados_pasar(uuid, date),
  public.prometieron_pagar(uuid), public.config_dejar_pasar(uuid), public.guardar_config_dejar_pasar(uuid, text, int) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record; nom text;
begin
  foreach nom in array array['configuracion_dejar_pasar', 'promesas_pago'] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || nom)::regclass) then raise exception 'Verificación: % sin RLS', nom; end if;
  end loop;
  if to_regprocedure('public.registrar_ingreso(uuid, uuid, text, text, uuid)') is not null then raise exception 'Verificación: quedó la registrar_ingreso vieja'; end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'public' and p.proname in ('registrar_ingreso', 'cupo_dejar_pasar', 'dejados_pasar', 'prometieron_pagar', 'config_dejar_pasar', 'guardar_config_dejar_pasar'))
               or (s.nspname = 'privado' and p.proname in ('regla_dejar_pasar', 'exigir_promesa', 'guia_entrada')) loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
  if pg_get_functiondef('privado.guia_entrada(uuid, timestamptz, uuid)'::regprocedure) not like '%promesas_pago%' then raise exception 'Verificación: falta la promesa en la guía'; end if;
  if pg_get_functiondef('privado.guia_entrada(uuid, timestamptz, uuid)'::regprocedure) not like '%clase_hoy%' then raise exception 'Verificación: la guía perdió el chip clase_hoy'; end if;
end $$;
