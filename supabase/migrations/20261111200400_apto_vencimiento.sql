-- N2 · Apto físico como FECHA de vencimiento: aviso antes de que venza y, si el gimnasio lo elige, la entrada avisa o frena.
-- Función nueva, APAGADA por defecto: interruptor "apto_vencimiento" (N5) más "Pedir apto físico" más el modo de la entrada.
-- NUNCA se guarda el certificado ni datos de salud: solo "vale hasta" (aptos_fisicos, desde 0044).
-- El veredicto lo calcula SOLO privado.calcular_acceso: acá se copia la versión de 20261107005100 (prueba gratis) con un bloque
-- nuevo que no corre si la función está apagada. La prueba (supabase/pruebas/n2-apto.test.mjs) compara viejo contra nuevo
-- con momentos fijos para todos los socios testigo.
--   configuracion_gimnasio.apto_en_entrada   'nada' (por defecto) | 'avisa' | 'frena'
--   configuracion_gimnasio.apto_aviso_dias   1 a 60 (por defecto 15): desde cuándo avisa que vence
--   apto_config(gimnasio) / guardar_apto_config(gimnasio, modo, dias)   dueño y encargado ven; solo dueño guarda
--   aptos_por_vencer(gimnasio)               equipo: quién vence pronto, quién ya venció
-- Aditiva e idempotente.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.funcion_activa(uuid, text)') is null then raise exception 'Guarda: falta N5 (funciones nuevas)'; end if;
  if to_regclass('public.aptos_fisicos') is null then raise exception 'Guarda: falta la migración 0044 (apto físico)'; end if;
  if to_regprocedure('privado.via_prueba(uuid, timestamptz, uuid, text)') is null then raise exception 'Guarda: falta 20261107005100 (prueba gratis)'; end if;
end $$;

-- ── Columnas: nullable → relleno → not null ─────────────────────────
alter table public.configuracion_gimnasio add column if not exists apto_en_entrada text;
alter table public.configuracion_gimnasio add column if not exists apto_aviso_dias int;
update public.configuracion_gimnasio set apto_en_entrada = 'nada' where apto_en_entrada is null;
update public.configuracion_gimnasio set apto_aviso_dias = 15 where apto_aviso_dias is null;
alter table public.configuracion_gimnasio alter column apto_en_entrada set default 'nada';
alter table public.configuracion_gimnasio alter column apto_aviso_dias set default 15;
alter table public.configuracion_gimnasio alter column apto_en_entrada set not null;
alter table public.configuracion_gimnasio alter column apto_aviso_dias set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'configuracion_apto_en_entrada_valido') then
    alter table public.configuracion_gimnasio add constraint configuracion_apto_en_entrada_valido check (apto_en_entrada in ('nada', 'avisa', 'frena'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'configuracion_apto_aviso_dias_valido') then
    alter table public.configuracion_gimnasio add constraint configuracion_apto_aviso_dias_valido check (apto_aviso_dias between 1 and 60);
  end if;
end $$;

-- ── La puerta ───────────────────────────────────────────────────────
create or replace function privado.calcular_acceso(p_socio_id uuid, p_momento timestamptz, p_sede_id uuid default null)
returns public.veredicto_acceso
language plpgsql stable set search_path = '' as $$
declare
  so public.socios; zona text; cfg public.configuracion_gimnasio;
  v public.veredicto_acceso; vb public.veredicto_acceso;
  vm public.veredicto_acceso; vp public.veredicto_acceso; vk public.veredicto_acceso; vq public.veredicto_acceso;
  avisos text[] := '{}'; hoy date; de_baja boolean; deuda numeric;
  apto_hasta timestamptz; apto_txt text; apto_mal boolean; apto_pronto boolean;
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

  -- N2: apto físico en la entrada (función nueva "apto_vencimiento", APAGADA por defecto). Solo si el gimnasio pide apto, eligió
  -- que la entrada avise o frene y prendió la función; si no, esta parte no corre y el veredicto es el de siempre.
  -- Solo mira la fecha de vencimiento del apto (nunca el certificado ni datos de salud).
  if v.puede and not de_baja and cfg.pide_apto and cfg.apto_en_entrada <> 'nada'
     and privado.funcion_activa(so.gimnasio_id, 'apto_vencimiento') then
    select max(a.vale_hasta) into apto_hasta from public.aptos_fisicos a where a.socio_id = p_socio_id and a.anulado_en is null;
    apto_mal := apto_hasta is null or apto_hasta <= p_momento;
    apto_pronto := not apto_mal and apto_hasta <= p_momento + make_interval(days => cfg.apto_aviso_dias);
    if apto_mal then
      apto_txt := case when apto_hasta is null then 'Apto físico: no presentó el apto'
                       else 'Apto físico vencido el ' || privado.fecha_corta(apto_hasta - interval '1 microsecond', zona) end;
      if cfg.apto_en_entrada = 'frena' then
        v.puede := false; v.color := 'rojo'; v.motivo := 'apto_vencido'; v.texto := apto_txt;
        v.consume := 'nada'; v.consume_id := null;
      else
        avisos := array_append(avisos, apto_txt);
        if v.color = 'verde' then v.color := 'amarillo'; end if;
      end if;
    elsif apto_pronto then
      avisos := array_append(avisos, 'Apto físico: vence el ' || privado.fecha_corta(apto_hasta - interval '1 microsecond', zona));
      if v.color = 'verde' then v.color := 'amarillo'; end if;
    end if;
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

-- ── Configuración del apto en la entrada ────────────────────────────
create or replace function public.apto_config(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.configuracion_gimnasio;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  return jsonb_build_object('activa', privado.funcion_activa(p_gimnasio_id, 'apto_vencimiento'), 'pide_apto', c.pide_apto,
                            'modo', c.apto_en_entrada, 'dias', c.apto_aviso_dias);
end $$;

create or replace function public.guardar_apto_config(p_gimnasio_id uuid, p_modo text, p_dias int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pide boolean; n int;
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno']);
  perform privado.exigir_funcion(p_gimnasio_id, 'apto_vencimiento');
  if p_modo is null or p_modo not in ('nada', 'avisa', 'frena') then raise exception 'Elegí qué hace la entrada: nada, avisar o frenar' using errcode = '22023'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 60 then raise exception 'Elegí entre 1 y 60 días de aviso' using errcode = '22023'; end if;
  select c.pide_apto into pide from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  if p_modo <> 'nada' and not pide then raise exception 'Primero prendé “Pedir apto físico” en Configuración → Reglas' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set apto_en_entrada = p_modo, apto_aviso_dias = p_dias where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar'; end if;
  return jsonb_build_object('modo', p_modo, 'dias', p_dias);
end $$;

-- El último apto de cada socio con cuota al día y sin baja.
create or replace function privado.aptos_ultimos(p_gimnasio_id uuid) returns table (socio_id uuid, nombre text, vale_hasta timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.id, trim(s.nombre || ' ' || s.apellido), (select max(a.vale_hasta) from public.aptos_fisicos a
                                                      where a.gimnasio_id = s.gimnasio_id and a.socio_id = s.id and a.anulado_en is null)
    from public.socios s
   where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null and s.cubierto_hasta > now()
     and exists (select 1 from public.aptos_fisicos a where a.gimnasio_id = s.gimnasio_id and a.socio_id = s.id and a.anulado_en is null)
$$;
revoke all on function privado.aptos_ultimos(uuid) from public, anon, authenticated;

-- ── Quién vence pronto y quién ya venció (socios con cuota al día, sin baja) ──
create or replace function public.aptos_por_vencer(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.configuracion_gimnasio; zona text; lim timestamptz;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  perform privado.exigir_funcion(p_gimnasio_id, 'apto_vencimiento');
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  if not c.pide_apto then raise exception 'Este gimnasio no pide apto físico (Configuración → Reglas)' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  lim := now() + make_interval(days => c.apto_aviso_dias);
  return jsonb_build_object(
    'dias', c.apto_aviso_dias,
    'por_vencer', coalesce((select jsonb_agg(jsonb_build_object('socio_id', x.socio_id, 'nombre', x.nombre, 'vence', privado.dia_local(x.vale_hasta, zona) - 1) order by x.vale_hasta)
                              from (select u.socio_id, u.nombre, u.vale_hasta from privado.aptos_ultimos(p_gimnasio_id) u where u.vale_hasta > now() and u.vale_hasta <= lim order by u.vale_hasta limit 50) x), '[]'::jsonb),
    'vencidos', coalesce((select jsonb_agg(jsonb_build_object('socio_id', x.socio_id, 'nombre', x.nombre, 'vence', privado.dia_local(x.vale_hasta, zona) - 1) order by x.vale_hasta desc)
                            from (select u.socio_id, u.nombre, u.vale_hasta from privado.aptos_ultimos(p_gimnasio_id) u where u.vale_hasta <= now() order by u.vale_hasta desc limit 50) x), '[]'::jsonb),
    'sin_apto', (select count(*) from public.socios s
                  where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null and s.cubierto_hasta > now()
                    and not exists (select 1 from public.aptos_fisicos a where a.gimnasio_id = s.gimnasio_id and a.socio_id = s.id and a.anulado_en is null)));
end $$;

revoke all on function public.apto_config(uuid), public.guardar_apto_config(uuid, text, int), public.aptos_por_vencer(uuid) from public, anon, authenticated;
grant execute on function public.apto_config(uuid), public.guardar_apto_config(uuid, text, int), public.aptos_por_vencer(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['privado.calcular_acceso(uuid, timestamptz, uuid)', 'public.apto_config(uuid)', 'public.guardar_apto_config(uuid, text, int)',
                           'public.aptos_por_vencer(uuid)', 'privado.aptos_ultimos(uuid)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if exists (select 1 from public.configuracion_gimnasio c where c.apto_en_entrada is null or c.apto_aviso_dias is null) then raise exception 'Verificación: quedó una configuración sin los datos del apto'; end if;
end $$;
