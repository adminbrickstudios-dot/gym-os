-- VD-46N · "No escribirle" por socio (docs/v2/14-SITUACIONES.md, caso 69).
-- Hay socios que pidieron que no les escriban. La marca es un hecho del socio (cuándo, quién y por qué) y las
-- listas de aviso masivo la respetan: bandeja de avisos, Retención, cumpleaños y "avisar a la clase". NO afecta
-- a "Vencen para cobrar" (vencen_pestanas): a ese socio se le sigue cobrando, en persona o en el mostrador.
--
-- Cambios, copiando la definición VIGENTE de cada función:
--   privado.retencion_con (7700) · public.retencion (9000) · public.bandeja_avisos (13000)
--   public.cumplen_hoy (4700) · public.avisar_clase (12300)
-- Permisos (lo prudente): marcar puede la recepción (es quien escucha el pedido); sacar la marca solo dueño y
-- encargado (reabre el contacto con alguien que lo pidió). Cada cambio queda en la marca vigente; sacar la
-- marca deja el hecho en no_escribirle_historial (inmutable).

-- ── Guarda de entrada ──────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.retencion_con(uuid, timestamptz, jsonb, boolean)') is null then raise exception 'Guarda: falta privado.retencion_con (7700, plan familiar)'; end if;
  if to_regprocedure('public.retencion(uuid)') is null then raise exception 'Guarda: falta public.retencion'; end if;
  if to_regprocedure('public.bandeja_avisos(uuid)') is null then raise exception 'Guarda: falta public.bandeja_avisos'; end if;
  if to_regprocedure('public.cumplen_hoy(uuid, timestamptz)') is null then raise exception 'Guarda: falta public.cumplen_hoy'; end if;
  if to_regprocedure('public.avisar_clase(uuid, text)') is null then raise exception 'Guarda: falta public.avisar_clase'; end if;
  if to_regprocedure('public.lista_clase(uuid)') is null then raise exception 'Guarda: falta public.lista_clase'; end if;
end $$;

-- ── La marca (nullable: nadie está marcado de origen, no hay nada que rellenar) ──
alter table public.socios add column if not exists no_escribirle_en timestamptz;
alter table public.socios add column if not exists no_escribirle_motivo text;
alter table public.socios add column if not exists no_escribirle_por uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'socios_no_escribirle_por_fk') then
    alter table public.socios add constraint socios_no_escribirle_por_fk
      foreign key (gimnasio_id, no_escribirle_por) references public.equipo (gimnasio_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'socios_no_escribirle_coherente') then
    alter table public.socios add constraint socios_no_escribirle_coherente
      check ((no_escribirle_en is null) = (no_escribirle_motivo is null));
  end if;
end $$;
create index if not exists socios_no_escribirle on public.socios (gimnasio_id) where no_escribirle_en is not null;

-- Cuando se saca la marca queda el hecho (no se cambia ni se borra).
create table if not exists public.no_escribirle_historial (
  id            uuid primary key default gen_random_uuid(),
  gimnasio_id   uuid not null references public.gimnasios(id),
  socio_id      uuid not null,
  marcado_en    timestamptz not null,
  marcado_por   uuid,
  motivo        text not null,
  levantado_en  timestamptz not null default now(),
  levantado_por uuid not null,
  motivo_levantar text not null check (length(trim(motivo_levantar)) between 3 and 300),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, marcado_por) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, levantado_por) references public.equipo (gimnasio_id, id)
);
create index if not exists no_escribirle_historial_socio on public.no_escribirle_historial (gimnasio_id, socio_id, levantado_en desc);
alter table public.no_escribirle_historial enable row level security;
create or replace function privado.no_escribirle_historial_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'El historial de "no escribirle" queda escrito: no se cambia ni se borra' using errcode = 'check_violation';
end $$;
revoke all on function privado.no_escribirle_historial_inmutable() from public;
drop trigger if exists no_escribirle_historial_inmutable on public.no_escribirle_historial;
create trigger no_escribirle_historial_inmutable before update or delete on public.no_escribirle_historial
  for each row execute function privado.no_escribirle_historial_inmutable();
drop policy if exists no_escribirle_historial_lee on public.no_escribirle_historial;
create policy no_escribirle_historial_lee on public.no_escribirle_historial for select to authenticated
  using (exists (select 1 from public.equipo e where e.gimnasio_id = no_escribirle_historial.gimnasio_id and e.usuario_id = auth.uid() and e.activo and e.rol in ('dueno', 'encargado')));
revoke all on table public.no_escribirle_historial from anon, authenticated;
grant select on table public.no_escribirle_historial to authenticated;

-- ── Marcar / sacar la marca ──────────────────────────────────────────
create or replace function public.marcar_no_escribirle(p_socio_id uuid, p_marcar boolean, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.socios; e public.equipo; m text := trim(coalesce(p_motivo, '')); n int;
begin
  select * into s from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if p_marcar then
    e := privado.exigir_equipo(s.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  else
    e := privado.exigir_equipo(s.gimnasio_id, array['dueno', 'encargado']);
  end if;
  if length(m) < 3 then raise exception 'Escribí el motivo (por ejemplo: lo pidió en la recepción)' using errcode = '22023'; end if;
  if length(m) > 300 then raise exception 'El motivo es muy largo: hasta 300 letras' using errcode = '22023'; end if;
  if p_marcar then
    if s.no_escribirle_en is not null then raise exception 'Ese socio ya tiene la marca de no escribirle' using errcode = '22023'; end if;
    update public.socios set no_escribirle_en = now(), no_escribirle_motivo = m, no_escribirle_por = e.id where id = s.id;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo marcar al socio'; end if;
  else
    if s.no_escribirle_en is null then raise exception 'Ese socio no tiene la marca de no escribirle' using errcode = '22023'; end if;
    insert into public.no_escribirle_historial (gimnasio_id, socio_id, marcado_en, marcado_por, motivo, levantado_por, motivo_levantar)
    values (s.gimnasio_id, s.id, s.no_escribirle_en, s.no_escribirle_por, s.no_escribirle_motivo, e.id, m);
    update public.socios set no_escribirle_en = null, no_escribirle_motivo = null, no_escribirle_por = null where id = s.id;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'No se pudo sacar la marca'; end if;
  end if;
  return jsonb_build_object('socio_id', s.id, 'marcado', p_marcar);
end $$;

-- Lo que muestra la ficha: la marca vigente y, para dueño y encargado, cuántas veces se sacó.
create or replace function public.no_escribirle_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios; e public.equipo; gestion boolean;
begin
  select * into s from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(s.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  gestion := e.rol in ('dueno', 'encargado');
  return jsonb_build_object(
    'marcado', s.no_escribirle_en is not null,
    'desde', s.no_escribirle_en,
    'motivo', s.no_escribirle_motivo,
    'por', (select q.nombre from public.equipo q where q.id = s.no_escribirle_por),
    'puede_sacar', gestion,
    'veces_sacada', case when gestion then (select count(*) from public.no_escribirle_historial h where h.socio_id = s.id) end);
end $$;

-- ── Las listas de aviso masivo, sin ese socio ────────────────────────
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
         so.dado_de_baja_en, so.motivo_baja, so.no_escribirle_en is not null as no_escribir, su.id as suscripcion_id, su.baja_en, su.plan_id,
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
     -- VD-46N: el que pidió que no le escriban no entra en las listas de re-enganche; sí sigue en vencidos y por vencer (se le cobra)
     and not (c.no_escribir and c.lista in ('nuevo', 'no_viene', 'se_fue'))
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
-- La firma no cambia (cuatro argumentos): create or replace alcanza.
revoke all on function privado.retencion_con(uuid, timestamptz, jsonb, boolean) from public, anon, authenticated;

create or replace function public.retencion(p_gimnasio_id uuid)
returns table (
  socio_id uuid, nombre text, telefono text, lista text, texto text, dias int,
  vence_en timestamptz, monto_mensual numeric, debe numeric, ultimo_ingreso timestamptz,
  visitas_por_semana numeric, ultimo_contacto_en timestamptz, ultimo_contacto_por text,
  ultimo_contacto_resultado text, mensaje text
)
language plpgsql stable security definer set search_path = '' as $$
declare eid uuid; ve_plata boolean;
begin
  eid := privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select e.rol in ('dueno', 'encargado') into ve_plata from public.equipo e where e.id = eid;
  return query select r.socio_id, r.nombre, r.telefono, r.lista, r.texto, r.dias, r.vence_en,
                      case when ve_plata then r.monto_mensual end, r.debe, r.ultimo_ingreso, r.visitas_por_semana,
                      r.ultimo_contacto_en, r.ultimo_contacto_por, r.ultimo_contacto_resultado, r.mensaje
                 from privado.retencion(p_gimnasio_id, now()) r
                where not exists (select 1 from public.socios sx where sx.id = r.socio_id and sx.no_escribirle_en is not null);   -- VD-46N
end $$;

create or replace function public.bandeja_avisos(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; gim text; plantilla text; plantilla_cc text; meta int; link text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.zona_horaria, g.nombre into zona, gim from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  select c.meta_primer_mes, c.link_resena into meta, link from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id;
  select coalesce(p.texto, (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = 'comprobante_rechazado'))
    into plantilla from public.plantillas_mensaje p where p.gimnasio_id = p_gimnasio_id and p.clave = 'comprobante_rechazado';
  select coalesce(p.texto, (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = 'clase_cancelada'))
    into plantilla_cc from public.plantillas_mensaje p where p.gimnasio_id = p_gimnasio_id and p.clave = 'clase_cancelada';
  return coalesce((
    with candidatos as (
      -- De Retención: misma cuenta, mismo mensaje.
      select r.socio_id, r.nombre, r.telefono, r.lista as clave, r.texto as motivo, r.mensaje,
             case r.lista when 'no_viene' then coalesce(privado.dia_local(r.ultimo_ingreso, zona)::text, 'nunca')
                          else coalesce(privado.dia_local(r.vence_en, zona)::text, hoy::text) end as referencia
        from privado.retencion(p_gimnasio_id, now()) r
       where r.lista in ('por_vencer', 'no_viene') or (r.lista = 'vencido' and r.dias between 1 and 3)
      union all
      select (c ->> 'socio_id')::uuid, c ->> 'nombre', c ->> 'telefono', 'cumpleanos', 'Cumple ' || (c ->> 'cumple') || ' hoy', c ->> 'mensaje',
             extract(year from hoy)::text
        from jsonb_array_elements(public.cumplen_hoy(p_gimnasio_id, now())) c
      union all
      select s.id, trim(s.nombre || ' ' || s.apellido), privado.celular_aviso(s.telefono, s.responsable_telefono, s.fecha_nacimiento, hoy),
             'comprobante_rechazado', 'Le rechazaron el comprobante: ' || p.rechazado_motivo,
             privado.armar_mensaje(plantilla, privado.variables_socio(s.id, now())), p.id::text
        from public.pagos p join public.ventas v on v.id = p.venta_id join public.socios s on s.id = v.socio_id
       where p.gimnasio_id = p_gimnasio_id and p.estado = 'rechazado' and p.rechazado_en > now() - interval '3 days'
         and s.dado_de_baja_en is null
      union all
      -- CLA-3: los anotados de una clase cancelada (en los últimos 2 días, si la clase no pasó hace más de un día).
      select s.id, trim(s.nombre || ' ' || s.apellido), privado.celular_aviso(s.telefono, s.responsable_telefono, s.fecha_nacimiento, hoy),
             'clase_cancelada', 'Se canceló ' || a.nombre || ' del ' || to_char(c.inicio at time zone zona, 'DD/MM HH24:MI') || coalesce(': ' || c.cancelada_motivo, ''),
             privado.armar_mensaje(plantilla_cc, privado.variables_socio(s.id, now()) || jsonb_build_object('clase', a.nombre,
               'dia', to_char(c.inicio at time zone zona, 'DD/MM') || ' a las ' || to_char(c.inicio at time zone zona, 'HH24:MI'),
               'motivo', coalesce(c.cancelada_motivo, 'se canceló'))),
             c.id::text
        from public.reservas r join public.clases c on c.id = r.clase_id join public.actividades a on a.id = c.actividad_id
        join public.socios s on s.id = r.socio_id
       where r.gimnasio_id = p_gimnasio_id and r.cancelada_por = 'clase_cancelada' and c.cancelada_en > now() - interval '2 days'
         and c.inicio > now() - interval '1 day' and s.dado_de_baja_en is null
      union all
      -- COM-2: el primer mes del socio nuevo. Bienvenida (días 1 y 2), primera semana (7 a 9) y primer mes (30 a 33).
      select n.socio_id, n.nombre, n.telefono, n.clave,
             case n.clave when 'bienvenida' then 'Se anotó el ' || to_char(n.primer_dia, 'DD/MM')
                          when 'primera_semana' then 'Primera semana: vino ' || n.entradas || (case when n.entradas = 1 then ' vez' else ' veces' end)
                          else 'Primer mes: vino ' || n.entradas || (case when n.entradas = 1 then ' vez' else ' veces' end) || ' (la meta era ' || meta || ')' end,
             privado.armar_mensaje(coalesce(
               (select p.texto from public.plantillas_mensaje p where p.gimnasio_id = p_gimnasio_id and p.clave = n.clave),
               (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = n.clave)),
               privado.variables_socio(n.socio_id, now()) || jsonb_build_object('entradas', n.entradas || case when n.entradas = 1 then ' vez' else ' veces' end, 'meta', meta::text)),
             n.primer_dia::text
        from (
          select s.id as socio_id, trim(s.nombre || ' ' || s.apellido) as nombre,
                 privado.celular_aviso(s.telefono, s.responsable_telefono, s.fecha_nacimiento, hoy) as telefono,
                 pm.primer_dia,
                 case when hoy - pm.primer_dia between 0 and 1 then 'bienvenida'
                      when hoy - pm.primer_dia between 7 and 9 then 'primera_semana'
                      when hoy - pm.primer_dia between 30 and 33 then 'primer_mes' end as clave,
                 (select count(distinct (i.momento at time zone zona)::date) from public.ingresos i
                   where i.socio_id = s.id and i.anulado_en is null and i.resultado <> 'rechazado') as entradas
            from public.socios s
            join (select su.socio_id, min((su.inicio at time zone zona)::date) as primer_dia from public.suscripciones su
                   where su.gimnasio_id = p_gimnasio_id group by su.socio_id) pm on pm.socio_id = s.id
           where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null and hoy - pm.primer_dia between 0 and 33
        ) n
       where n.clave is not null
      union all
      -- COM-10: el que llegó a su entrada 10 en los últimos 3 días: pedirle la reseña (si el gimnasio cargó su link).
      select s.id, trim(s.nombre || ' ' || s.apellido), privado.celular_aviso(s.telefono, s.responsable_telefono, s.fecha_nacimiento, hoy),
             'resena', 'Llegó a su entrada 10',
             privado.armar_mensaje(coalesce(
               (select p.texto from public.plantillas_mensaje p where p.gimnasio_id = p_gimnasio_id and p.clave = 'resena'),
               (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = 'resena')),
               privado.variables_socio(s.id, now()) || jsonb_build_object('link', link)),
             'entrada-10'
        from public.socios s
       where link is not null and s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null
         and (select (array_agg(x.dia order by x.dia))[10] from (
                select distinct (i.momento at time zone zona)::date as dia from public.ingresos i
                 where i.socio_id = s.id and i.anulado_en is null and i.resultado <> 'rechazado') x) between hoy - 3 and hoy
    )
    select jsonb_agg(jsonb_build_object('socio_id', c.socio_id, 'nombre', c.nombre, 'telefono', c.telefono, 'clave', c.clave,
             'motivo', c.motivo, 'mensaje', c.mensaje, 'referencia', c.referencia,
             'avisado_en', a.creado_en, 'avisado_por', (select q.nombre from public.equipo q where q.id = a.creado_por))
             order by (a.id is not null), array_position(array['clase_cancelada', 'por_vencer', 'vencido', 'comprobante_rechazado', 'bienvenida', 'primera_semana', 'primer_mes', 'resena', 'cumpleanos', 'no_viene'], c.clave), c.nombre)
      from candidatos c
      join public.socios sx on sx.id = c.socio_id and sx.no_escribirle_en is null   -- VD-46N: ningún aviso masivo al que pidió que no le escriban
      left join public.avisos_enviados a on a.gimnasio_id = p_gimnasio_id and a.socio_id = c.socio_id and a.clave = c.clave and a.referencia = c.referencia
     -- Lo avisado otro día no vuelve; lo avisado hoy se ve con ✓.
     where a.id is null or privado.dia_local(a.creado_en, zona) = hoy
  ), '[]'::jsonb);
end $$;

create or replace function public.cumplen_hoy(p_gimnasio_id uuid, p_momento timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; plantilla text; gim text; bisiesto boolean;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.zona_horaria, g.nombre into zona, gim from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(coalesce(p_momento, now()), zona);
  bisiesto := extract(day from (make_date(extract(year from hoy)::int, 3, 1) - 1)) = 29;
  select coalesce(p.texto, (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = 'cumpleanos'))
    into plantilla from public.plantillas_mensaje p where p.gimnasio_id = p_gimnasio_id and p.clave = 'cumpleanos';
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'socio_id', s.id, 'nombre', trim(s.nombre || ' ' || s.apellido), 'telefono', privado.celular_aviso(s.telefono, s.responsable_telefono, s.fecha_nacimiento, hoy),
      'cumple', extract(year from hoy)::int - extract(year from s.fecha_nacimiento)::int,
      'mensaje', privado.armar_mensaje(plantilla, jsonb_build_object('nombre', s.nombre, 'gimnasio', gim)))
      order by s.nombre), '[]')
    from public.socios s
   where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null and s.fecha_nacimiento is not null
     and s.no_escribirle_en is null   -- VD-46N
     and (   (extract(month from s.fecha_nacimiento) = extract(month from hoy) and extract(day from s.fecha_nacimiento) = extract(day from hoy))
          or (not bisiesto and extract(month from s.fecha_nacimiento) = 2 and extract(day from s.fecha_nacimiento) = 29
              and extract(month from hoy) = 2 and extract(day from hoy) = 28)));
end $$;

create or replace function public.avisar_clase(p_clase_id uuid, p_texto text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.clases; eid uuid; zona text; gim text; act text; dia text; t text := trim(coalesce(p_texto, '')); v_id uuid; r jsonb;
begin
  select * into c from public.clases where id = p_clase_id;
  if not found then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  eid := privado.equipo_de_clase(c);
  if t = '' then raise exception 'Escribí qué les querés avisar.' using errcode = '22023'; end if;
  if length(t) > 500 then raise exception 'El aviso puede tener hasta 500 letras.' using errcode = '22023'; end if;
  select g.zona_horaria, g.nombre into zona, gim from public.gimnasios g where g.id = c.gimnasio_id;
  select a.nombre into act from public.actividades a where a.id = c.actividad_id;
  dia := to_char(c.inicio at time zone zona, 'DD/MM') || ' a las ' || to_char(c.inicio at time zone zona, 'HH24:MI');
  -- La lista y los teléfonos, tal como los ve quien avisa.
  select coalesce(jsonb_agg(jsonb_build_object('socio_id', l.socio_id, 'nombre', l.nombre, 'telefono', l.telefono,
           'mensaje', privado.armar_mensaje(t, jsonb_build_object('nombre', split_part(l.nombre, ' ', 1), 'clase', coalesce(act, 'la clase'),
                                                                  'dia', dia, 'gimnasio', gim))) order by l.nombre), '[]')
    into r from public.lista_clase(c.id) l
   where not exists (select 1 from public.socios sx where sx.id = l.socio_id and sx.no_escribirle_en is not null);   -- VD-46N: ese socio no recibe avisos
  insert into public.avisos_clase (gimnasio_id, clase_id, texto, personas, creado_por)
  values (c.gimnasio_id, c.id, t, jsonb_array_length(r), eid) returning id into v_id;
  return jsonb_build_object('aviso_id', v_id, 'mensajes', r);
end $$;

revoke all on function public.marcar_no_escribirle(uuid, boolean, text), public.no_escribirle_socio(uuid),
  public.retencion(uuid), public.bandeja_avisos(uuid), public.cumplen_hoy(uuid, timestamptz), public.avisar_clase(uuid, text)
  from public, anon, authenticated;
grant execute on function public.marcar_no_escribirle(uuid, boolean, text), public.no_escribirle_socio(uuid),
  public.retencion(uuid), public.bandeja_avisos(uuid), public.cumplen_hoy(uuid, timestamptz), public.avisar_clase(uuid, text)
  to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.marcar_no_escribirle(uuid, boolean, text)', 'public.no_escribirle_socio(uuid)', 'public.retencion(uuid)',
                           'public.bandeja_avisos(uuid)', 'public.cumplen_hoy(uuid, timestamptz)', 'public.avisar_clase(uuid, text)',
                           'privado.retencion_con(uuid, timestamptz, jsonb, boolean)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if not (select relrowsecurity from pg_class where oid = 'public.no_escribirle_historial'::regclass) then raise exception 'Verificación: historial sin RLS'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'socios' and column_name = 'no_escribirle_en') then
    raise exception 'Verificación: falta socios.no_escribirle_en';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'privado' and p.proname = 'retencion_con') <> 1 then
    raise exception 'Verificación: hay más de una firma de privado.retencion_con';
  end if;
end $$;
