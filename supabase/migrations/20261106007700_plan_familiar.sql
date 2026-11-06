-- VD-46G · Plan familiar y corporativo: el titular paga por los vinculados (docs/v2/14-SITUACIONES.md casos 32 y 33).
-- Hasta acá el grupo familiar (0041) solo vinculaba: cada uno con su plan. Ahora un grupo puede tener TITULAR: sus
-- miembros entran con la cobertura del titular ("Cubierto por X"). Si el titular vence o se da de baja, cada miembro
-- ve el motivo explicado. Los cobros (Vencen, Retención, Para hacer hoy) van al titular, una sola vez.
--
-- ARRANCA APAGADO por gimnasio (configuracion_gimnasio.plan_familiar_activo, con su propio par de funciones; no pasa
-- por guardar_configuracion). Apagado, todo anda exactamente como antes: los titulares guardados se ignoran.
-- Quién arma: solo dueño o encargado (titular, y sumar o sacar gente de un grupo que ya tiene titular). Quién prende: el dueño.
-- Copias (la versión vigente de cada una): privado.calcular_acceso de 20261104006700, privado.retencion_con de 20261106007100,
-- y vincular_familia / sacar_de_familia / familia_socio de 20261104004100.
-- Decisión: el titular cubre con su MEMBRESÍA (no con sus packs ni pases). Una suspensión del titular no alcanza a los
-- miembros (es de la persona); la de un miembro sí lo alcanza. Quien tiene cobertura propia entra con la propia.

-- ── Guarda de entrada ──────────────────────────────────────────────
do $$
begin
  if to_regclass('public.grupos_familiares') is null then raise exception 'Guarda: falta grupos_familiares (0041)'; end if;
  if to_regprocedure('privado.calcular_acceso(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta privado.calcular_acceso'; end if;
  if to_regprocedure('privado.retencion_con(uuid, timestamptz, jsonb, boolean)') is null then raise exception 'Guarda: falta privado.retencion_con (VD-30)'; end if;
  if to_regprocedure('privado.via_membresia(uuid, timestamptz, uuid, text, public.configuracion_gimnasio)') is null then raise exception 'Guarda: falta privado.via_membresia'; end if;
  if position('deuda_socio' in pg_get_functiondef('privado.calcular_acceso(uuid, timestamptz, uuid)'::regprocedure)) = 0 then raise exception 'Guarda: calcular_acceso no es la versión con deuda (0067)'; end if;
  if position('p_liviano' in pg_get_functiondef('privado.retencion_con(uuid, timestamptz, jsonb, boolean)'::regprocedure)) = 0 then raise exception 'Guarda: retencion_con no es la versión VD-30'; end if;
end $$;

-- ── Esquema ────────────────────────────────────────────────────────
alter table public.configuracion_gimnasio add column if not exists plan_familiar_activo boolean not null default false;

alter table public.grupos_familiares add column if not exists titular_id uuid;
alter table public.grupos_familiares add column if not exists tipo text not null default 'familiar';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'grupos_familiares_titular_fk') then
    alter table public.grupos_familiares add constraint grupos_familiares_titular_fk
      foreign key (gimnasio_id, titular_id) references public.socios (gimnasio_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'grupos_familiares_tipo_check') then
    alter table public.grupos_familiares add constraint grupos_familiares_tipo_check check (tipo in ('familiar', 'corporativo'));
  end if;
end $$;

-- ── El interruptor ─────────────────────────────────────────────────
create or replace function privado.plan_familiar_activo(p_gimnasio_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select c.plan_familiar_activo from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id), false)
$$;
revoke all on function privado.plan_familiar_activo(uuid) from public, anon, authenticated;

create or replace function public.plan_familiar_estado(p_gimnasio_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return privado.plan_familiar_activo(p_gimnasio_id);
end $$;

create or replace function public.guardar_plan_familiar(p_gimnasio_id uuid, p_activo boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_activo is null then raise exception 'Elegí si el plan familiar está prendido o apagado.' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set plan_familiar_activo = p_activo, actualizado_en = now() where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar: el gimnasio no tiene configuración'; end if;
end $$;

-- ── La puerta: copia de privado.calcular_acceso (0067) con la cobertura del titular ──
create or replace function privado.calcular_acceso(p_socio_id uuid, p_momento timestamptz, p_sede_id uuid default null)
returns public.veredicto_acceso
language plpgsql stable set search_path = '' as $$
declare
  so public.socios; zona text; cfg public.configuracion_gimnasio;
  v public.veredicto_acceso; vb public.veredicto_acceso;
  vm public.veredicto_acceso; vp public.veredicto_acceso; vk public.veredicto_acceso;
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

    if    coalesce(vm.puede, false) then v := vm;
    elsif coalesce(vp.puede, false) then v := vp;
    elsif coalesce(vk.puede, false) then v := vk;
    elsif vm.color is not null then v := vm;
    elsif vk.color is not null then v := vk;
    elsif vp.color is not null then v := vp;
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

-- ── Retención: copia de privado.retencion_con (VD-30) con el titular ──
create or replace function privado.retencion_con(p_gimnasio_id uuid, p_momento timestamptz, p_plantillas jsonb, p_liviano boolean default false)
returns table (
  socio_id uuid, nombre text, telefono text, lista text, texto text, dias int,
  vence_en timestamptz, monto_mensual numeric, debe numeric, ultimo_ingreso timestamptz,
  visitas_por_semana numeric, ultimo_contacto_en timestamptz, ultimo_contacto_por text,
  ultimo_contacto_resultado text, mensaje text
)
language sql stable set search_path = '' as $$
with
g as (select gi.id, gi.nombre, gi.zona_horaria as zona, c.* from public.gimnasios gi
       join public.configuracion_gimnasio c on c.gimnasio_id = gi.id where gi.id = p_gimnasio_id),
cfg as (select c from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id),
hoy as (select ((p_momento) at time zone g.zona)::date as d from g),
-- La membresía que importa de cada socio: la activa, o la última si se cerró hace poco.
sus as (
  select distinct on (s.socio_id) s.*
    from public.suscripciones s, g
   where s.gimnasio_id = g.id and s.inicio <= p_momento
     and (s.baja_en is null or s.baja_en > p_momento - make_interval(days => g.retencion_dias_se_fue))
   order by s.socio_id, (s.baja_en is null) desc, s.inicio desc
),
-- Desde cuándo es socio: su primera membresía (un cambio de plan no lo hace "nuevo").
antiguedad as (
  select s.socio_id, min(s.inicio) as primer_inicio from public.suscripciones s
   where s.gimnasio_id = p_gimnasio_id group by s.socio_id
),
-- Islas de coberturas contiguas POR SOCIO, sumando todas sus membresías
-- (lo pagado en el plan viejo cuenta para ver desde cuándo debe).
cob as (
  select c.socio_id, c.desde, c.hasta,
         max(c.hasta) over (partition by c.socio_id order by c.desde, c.hasta
                            rows between unbounded preceding and 1 preceding) as hasta_previo
    from public.coberturas c
   where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null and c.socio_id in (select s.socio_id from sus s)
),
islas_marcadas as (
  select *, sum(case when hasta_previo is null or desde > hasta_previo then 1 else 0 end)
              over (partition by socio_id order by desde, hasta) as isla
    from cob
),
islas as (
  select socio_id, min(desde) as desde, max(hasta) as hasta from islas_marcadas group by socio_id, isla
),
estado as (
  select s.socio_id,
         max(i.hasta) filter (where i.desde <= p_momento and i.hasta > p_momento) as fin_actual,
         max(i.hasta) filter (where i.hasta <= p_momento) as ultimo_fin,
         coalesce(bool_or(i.desde > p_momento), false) as tiene_futuro
    from sus s left join islas i on i.socio_id = s.socio_id
   group by s.socio_id
),
precios as (
  select p.id as plan_id, privado.precio_base(p.id, p_momento) as precio
    from public.planes p where p.gimnasio_id = p_gimnasio_id and p.tipo = 'membresia'
),
base as (
  select so.id as socio_id, trim(so.nombre || ' ' || so.apellido) as nombre, so.nombre as nombre_pila,
         -- Un menor (D10): se le escribe al responsable.
         case when coalesce(so.fecha_nacimiento > (((p_momento) at time zone (select zona from g))::date - interval '18 years')::date, false) then so.responsable_telefono else so.telefono end as telefono,
         -- VD-46G: con el plan familiar prendido, el cobro de los vinculados va al titular (una sola vez).
         (coalesce((select g3.plan_familiar_activo from g g3), false) and gf.titular_id is not null and gf.titular_id <> so.id) as vinculado,
         case when coalesce((select g3.plan_familiar_activo from g g3), false) and gf.titular_id = so.id
              then (select count(*) from public.socios m where m.grupo_familiar_id = gf.id and m.id <> so.id and m.dado_de_baja_en is null)::int end as vinculados,
         so.dado_de_baja_en, so.motivo_baja, su.id as suscripcion_id, su.baja_en, su.plan_id,
         an.primer_inicio, e.fin_actual, e.ultimo_fin, e.tiene_futuro, v.ultimo as ultimo_ingreso, f.por_semana,
         round(pr.precio / pl.duracion_meses, 2) as monto_mensual,
         exists (select 1 from public.congelamientos c where c.suscripcion_id = su.id and c.anulado_en is null
                  and c.desde <= p_momento and coalesce(c.hasta_real, c.hasta_prevista) > p_momento) as congelado,
         exists (select 1 from public.suspensiones x where x.socio_id = so.id and x.desde <= p_momento
                  and (x.hasta is null or x.hasta > p_momento) and (x.levantada_en is null or x.levantada_en > p_momento)) as suspendido
    from public.socios so
    join sus su on su.socio_id = so.id
    join antiguedad an on an.socio_id = so.id
    join estado e on e.socio_id = so.id
    join public.planes pl on pl.id = su.plan_id
    left join public.grupos_familiares gf on gf.id = so.grupo_familiar_id
    left join precios pr on pr.plan_id = su.plan_id
    -- VD-30: la última visita y la frecuencia, socio por socio por el índice de ingresos (gimnasio, socio, momento).
    -- Antes eran dos CTE que se recorrían enteros por cada socio (8 millones de comparaciones con 3.000 socios).
    left join lateral (
      select max(i.momento) as ultimo from public.ingresos i
       where i.gimnasio_id = p_gimnasio_id and i.socio_id = so.id and i.anulado_en is null
         and i.resultado <> 'rechazado' and i.momento <= p_momento
    ) v on true
    left join lateral (
      -- días distintos con ingreso en las 8 semanas anteriores a su última visita (el día local escrito acá:
      -- privado.dia_local no se puede expandir y era la quinta parte del tiempo)
      select case when count(*) = 0 then null
                  else count(distinct (i.momento at time zone (select g2.zona from g g2))::date)::numeric / 8 end as por_semana
        from public.ingresos i
       where v.ultimo is not null and i.gimnasio_id = p_gimnasio_id and i.socio_id = so.id and i.anulado_en is null
         and i.resultado <> 'rechazado' and i.momento > v.ultimo - interval '56 days' and i.momento <= v.ultimo
    ) f on true
   where so.gimnasio_id = p_gimnasio_id
),
clasificado as (
  select b.*, hoy.d as hoy_d,
    -- desde cuándo no está cubierto: el fin de lo último que pagó, o su alta si nunca pagó
    coalesce(b.ultimo_fin, b.primer_inicio) as sin_cubrir_desde,
    case
      when b.suspendido or b.congelado then null
      when b.dado_de_baja_en is not null and b.dado_de_baja_en <= p_momento then 'se_fue'
      when b.baja_en is not null and b.baja_en <= p_momento then 'se_fue'
      when b.fin_actual is null and not b.tiene_futuro
           and hoy.d - ((coalesce(b.ultimo_fin, b.primer_inicio)) at time zone g.zona)::date > g.retencion_dias_vencido then 'se_fue'
      when b.fin_actual is null and not b.tiene_futuro then 'vencido'
      when b.fin_actual is not null
           and ((b.fin_actual - interval '1 microsecond') at time zone g.zona)::date - hoy.d <= g.dias_aviso then 'por_vencer'
      when b.fin_actual is not null and b.primer_inicio > p_momento - make_interval(days => g.retencion_dias_nuevo)
           and coalesce(b.ultimo_ingreso, b.primer_inicio) <= p_momento - interval '7 days' then 'nuevo'
      when b.fin_actual is not null
           and coalesce(b.ultimo_ingreso, b.primer_inicio) <= p_momento - make_interval(days => g.retencion_dias_ausencia) then 'no_viene'
    end as lista
    from base b, g, hoy
),
-- materialized: sin esto Postgres copia via_membresia en cada (vm).campo y
-- la llama varias veces por socio (1,3 s → 0,5 s con 3.000 socios).
con_texto as materialized (
  select c.*,
    -- Vencidos: el texto y la deuda salen de la misma función que usa la puerta.
    case when c.lista = 'vencido' and not p_liviano then privado.via_membresia(c.socio_id, p_momento, null, g.zona, (select cfg.c from cfg)) end as vm,
    case c.lista
      when 'se_fue' then coalesce(c.dado_de_baja_en, c.baja_en, c.ultimo_fin, c.primer_inicio)
      when 'vencido' then c.ultimo_fin
      else c.fin_actual end as vence,
    case
      when c.lista in ('no_viene', 'nuevo') then c.hoy_d - ((coalesce(c.ultimo_ingreso, c.primer_inicio)) at time zone g.zona)::date
      when c.lista in ('vencido', 'se_fue') then c.hoy_d - ((coalesce(c.dado_de_baja_en, c.baja_en, c.sin_cubrir_desde)) at time zone g.zona)::date
      when c.lista = 'por_vencer' then ((c.fin_actual - interval '1 microsecond') at time zone g.zona)::date - c.hoy_d
    end as dias
    from clasificado c, g
   where c.lista is not null and not (c.vinculado and c.lista in ('vencido', 'por_vencer'))
),
final as materialized (
  select t.*,
    case when t.lista = 'vencido' and not p_liviano then
      coalesce((t.vm).para_regularizar,
               (select pr.precio from precios pr where pr.plan_id = t.plan_id) * privado.cuotas_para_cubrir(t.suscripcion_id, p_momento))
    end as debe
    from con_texto t
)
select t.socio_id, t.nombre, t.telefono, t.lista,
  (case t.lista
    when 'no_viene' then case when t.ultimo_ingreso is null then 'No vino nunca · se anotó hace ' || t.dias || ' días'
                              else 'No viene hace ' || t.dias || ' días' end
                         || case when t.por_semana >= 0.5 then ' · venía ' || round(t.por_semana) || ' veces por semana' else '' end
    when 'nuevo' then 'Se anotó el ' || to_char((t.primer_inicio) at time zone g.zona, 'DD/MM') || ' · '
                      || case when t.ultimo_ingreso is null then 'todavía no vino' else 'no viene hace ' || t.dias || ' días' end
    when 'por_vencer' then case t.dias when 0 then 'Vence hoy' when 1 then 'Vence mañana'
                                       else 'Vence el ' || privado.ultimo_dia(t.fin_actual, g.zona) end
    when 'vencido' then case when (t.vm).motivo in ('vencida', 'sin_pago') then (t.vm).texto
                             else 'Venció el ' || privado.ultimo_dia(t.ultimo_fin, g.zona)
                                  || coalesce(' · debe ' || privado.formato_pesos(t.debe), '') end
    when 'se_fue' then case when t.dado_de_baja_en is not null
                            then 'Se dio de baja el ' || to_char((t.dado_de_baja_en) at time zone g.zona, 'DD/MM') || coalesce(' · ' || replace(t.motivo_baja, '_', ' '), '')
                            when t.ultimo_fin is null then 'Nunca pagó · se anotó el ' || to_char((t.primer_inicio) at time zone g.zona, 'DD/MM')
                            else 'Dejó de pagar el ' || privado.ultimo_dia(t.ultimo_fin, g.zona) end
  end)
  || case when t.vinculados > 0 and t.lista in ('vencido', 'por_vencer')
          then ' · paga por ' || t.vinculados || case t.vinculados when 1 then ' vinculado' else ' vinculados' end else '' end,
  t.dias, t.vence, t.monto_mensual, t.debe, t.ultimo_ingreso, round(t.por_semana, 1),
  uc.creado_en, uc.quien, uc.resultado,
  privado.armar_mensaje(coalesce(p_plantillas ->> t.lista, pm.texto), jsonb_build_object(
    'nombre', t.nombre_pila, 'gimnasio', g.nombre,
    'plan', (select pl2.nombre from public.planes pl2 where pl2.id = t.plan_id),
    'vence', coalesce(case when t.lista in ('vencido', 'por_vencer') and t.vence is not null then privado.ultimo_dia(t.vence, g.zona) end, 'hace poco'),
    'dias', coalesce(t.dias::text, ''),
    'monto', coalesce(privado.formato_pesos(coalesce(t.debe, t.monto_mensual)), 'la cuota'),
    'debe', coalesce(privado.formato_pesos(coalesce(t.debe, t.monto_mensual)), 'la cuota')))
from final t
cross join g
left join public.plantillas_mensaje pm on pm.gimnasio_id = g.id and pm.clave = t.lista
left join lateral (
  select cr.creado_en, e.nombre as quien, cr.resultado from public.contactos_retencion cr
    join public.equipo e on e.id = cr.creado_por
   where cr.socio_id = t.socio_id order by cr.creado_en desc limit 1
) uc on true
order by array_position(array['vencido', 'por_vencer', 'nuevo', 'no_viene', 'se_fue'], t.lista),
         case when t.lista = 'por_vencer' then t.dias else -t.dias end, t.nombre
$$;

-- ── Armar el grupo: titular, y quién puede tocar un grupo con titular ──
-- Dueño o encargado. Con el interruptor apagado no se puede armar (así no queda nada a medias).
create or replace function public.fijar_titular_familia(p_socio_id uuid, p_titular_id uuid, p_tipo text default 'familiar') returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; grupo uuid; tg uuid; baja timestamptz; n int;
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado']);
  if not privado.plan_familiar_activo(g) then raise exception 'Prendé primero el plan familiar en Configuración.' using errcode = '22023'; end if;
  if p_tipo is null or p_tipo not in ('familiar', 'corporativo') then raise exception 'El plan es familiar o corporativo.' using errcode = '22023'; end if;
  select s.grupo_familiar_id into grupo from public.socios s where s.id = p_socio_id;
  if grupo is null then raise exception 'Primero vinculá a las personas en la ficha (Familia).' using errcode = '22023'; end if;
  select s.grupo_familiar_id, s.dado_de_baja_en into tg, baja from public.socios s where s.id = p_titular_id and s.gimnasio_id = g;
  if not found or tg is distinct from grupo then raise exception 'El titular tiene que ser parte del mismo grupo.' using errcode = '22023'; end if;
  if baja is not null and baja <= now() then raise exception 'Esa persona está dada de baja: no puede ser la titular.' using errcode = '22023'; end if;
  update public.grupos_familiares set titular_id = p_titular_id, tipo = p_tipo where id = grupo and gimnasio_id = g;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar el titular.'; end if;
end $$;

create or replace function public.quitar_titular_familia(p_socio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; grupo uuid; n int;
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado']);
  select s.grupo_familiar_id into grupo from public.socios s where s.id = p_socio_id;
  if grupo is null then raise exception 'No está en ninguna familia.' using errcode = '22023'; end if;
  update public.grupos_familiares set titular_id = null where id = grupo and gimnasio_id = g and titular_id is not null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese grupo no tiene titular.' using errcode = '22023'; end if;
end $$;

-- Cómo está este socio respecto del plan familiar (para la ficha).
create or replace function public.plan_familiar_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; grupo uuid; gf public.grupos_familiares; t public.socios;
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  select s.grupo_familiar_id into grupo from public.socios s where s.id = p_socio_id;
  if grupo is not null then select * into gf from public.grupos_familiares x where x.id = grupo; end if;
  if gf.titular_id is not null then select * into t from public.socios s where s.id = gf.titular_id; end if;
  return jsonb_build_object(
    'activo', privado.plan_familiar_activo(g), 'en_grupo', grupo is not null,
    'titular_id', gf.titular_id, 'titular_nombre', case when t.id is not null then trim(t.nombre || ' ' || t.apellido) end,
    'tipo', gf.tipo, 'es_titular', coalesce(gf.titular_id = p_socio_id, false),
    'vinculados', case when gf.titular_id = p_socio_id then (select count(*) from public.socios m where m.grupo_familiar_id = grupo and m.id <> p_socio_id and m.dado_de_baja_en is null) end);
end $$;

-- Copias de 0041: igual que antes, más (1) un grupo con titular solo lo toca dueño o encargado (sumar a alguien es regalarle el
-- plan; sacar a alguien es quitárselo) y (2) quien sale del grupo no queda como titular.
create or replace function public.vincular_familia(p_socio_id uuid, p_otro_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; a uuid; b uuid; grupo uuid; ta uuid; tb uuid;
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  if p_socio_id = p_otro_id then raise exception 'Elegí a otra persona.'; end if;
  select s.grupo_familiar_id into a from public.socios s where s.id = p_socio_id;
  select s.grupo_familiar_id into b from public.socios s where s.id = p_otro_id and s.gimnasio_id = g;
  if not found then raise exception 'Ese socio no es de este gimnasio.'; end if;
  select x.titular_id into ta from public.grupos_familiares x where x.id = a;
  select x.titular_id into tb from public.grupos_familiares x where x.id = b;
  if ta is not null or tb is not null then perform privado.exigir_equipo(g, array['dueno', 'encargado']); end if;
  grupo := coalesce(a, b);
  if grupo is null then insert into public.grupos_familiares (gimnasio_id) values (g) returning id into grupo; end if;
  update public.socios set grupo_familiar_id = grupo
   where gimnasio_id = g and (id in (p_socio_id, p_otro_id) or (b is not null and grupo_familiar_id = b) or (a is not null and grupo_familiar_id = a));
  if (select count(*) from public.socios where grupo_familiar_id = grupo) > 12 then raise exception 'Una familia de hasta 12 personas.'; end if;
end $$;

create or replace function public.sacar_de_familia(p_socio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; grupo uuid; tit uuid;
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  select s.grupo_familiar_id into grupo from public.socios s where s.id = p_socio_id;
  if grupo is null then raise exception 'No está en ninguna familia.'; end if;
  select x.titular_id into tit from public.grupos_familiares x where x.id = grupo;
  if tit is not null then perform privado.exigir_equipo(g, array['dueno', 'encargado']); end if;
  update public.socios set grupo_familiar_id = null where id = p_socio_id;
  if tit = p_socio_id then update public.grupos_familiares set titular_id = null where id = grupo; end if;
  -- Una familia de uno ya no es familia.
  if (select count(*) from public.socios where grupo_familiar_id = grupo) = 1 then
    update public.socios set grupo_familiar_id = null where grupo_familiar_id = grupo;
    update public.grupos_familiares set titular_id = null where id = grupo;
  end if;
end $$;

create or replace function public.familia_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; grupo uuid;
begin
  g := privado.gimnasio_del_socio(p_socio_id, array['dueno', 'encargado', 'recepcion']);
  select s.grupo_familiar_id into grupo from public.socios s where s.id = p_socio_id;
  if grupo is null then return '[]'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('socio_id', s.id, 'numero', s.numero, 'nombre', trim(s.nombre || ' ' || s.apellido),
            'color', v.color, 'texto', v.texto, 'es_titular', coalesce(gf.titular_id = s.id, false)) order by s.nombre), '[]')
    from public.socios s join public.grupos_familiares gf on gf.id = s.grupo_familiar_id
    cross join lateral privado.calcular_acceso(s.id, now(), null) v
   where s.gimnasio_id = g and s.grupo_familiar_id = grupo and s.id <> p_socio_id);
end $$;

revoke all on function privado.calcular_acceso(uuid, timestamptz, uuid), privado.retencion_con(uuid, timestamptz, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.plan_familiar_estado(uuid), public.guardar_plan_familiar(uuid, boolean), public.fijar_titular_familia(uuid, uuid, text),
  public.quitar_titular_familia(uuid), public.plan_familiar_socio(uuid), public.vincular_familia(uuid, uuid), public.sacar_de_familia(uuid),
  public.familia_socio(uuid) from public, anon, authenticated;
grant execute on function public.plan_familiar_estado(uuid), public.guardar_plan_familiar(uuid, boolean), public.fijar_titular_familia(uuid, uuid, text),
  public.quitar_titular_familia(uuid), public.plan_familiar_socio(uuid), public.vincular_familia(uuid, uuid), public.sacar_de_familia(uuid),
  public.familia_socio(uuid) to authenticated, service_role;

-- ── Verificación ───────────────────────────────────────────────────
do $$
declare r record;
begin
  if position('plan_familiar_activo' in pg_get_functiondef('privado.calcular_acceso(uuid, timestamptz, uuid)'::regprocedure)) = 0
     or position('deuda_socio' in pg_get_functiondef('privado.calcular_acceso(uuid, timestamptz, uuid)'::regprocedure)) = 0 then
    raise exception 'Verificación: calcular_acceso perdió algo';
  end if;
  if position('vinculados' in pg_get_functiondef('privado.retencion_con(uuid, timestamptz, jsonb, boolean)'::regprocedure)) = 0 then
    raise exception 'Verificación: retencion_con sin el titular';
  end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p where p.pronamespace = 'public'::regnamespace
            and p.proname in ('plan_familiar_estado', 'guardar_plan_familiar', 'fijar_titular_familia', 'quitar_titular_familia', 'plan_familiar_socio', 'vincular_familia', 'sacar_de_familia', 'familia_socio') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
end $$;
