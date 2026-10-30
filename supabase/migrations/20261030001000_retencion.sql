-- ═══════════════════════════════════════════════════════════════════
-- 0010 · Retención: el socio que deja de venir es el que el mes que
-- viene no paga. Cinco listas accionables, calculadas por lotes (todo el
-- gimnasio en una consulta, no socio por socio), cada socio con el
-- porqué escrito, el mensaje de WhatsApp armado y quién le escribió.
--
-- Cada socio aparece en UNA lista, con esta prioridad:
--   se_fue     → se dio de baja, o dejó de pagar hace más de N días
--   vencido    → venció hace poco y no renovó
--   por_vencer → vence dentro de los días de aviso
--   nuevo      → se anotó hace menos de 4 semanas y faltó la última semana
--   no_viene   → está al día pero no viene hace N días
-- Congelados y suspendidos no aparecen: no están en riesgo, están en pausa.
-- Socios que solo compran packs o pases todavía no aparecen (v1.5).
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('privado.via_membresia(uuid,timestamptz,uuid,text,public.configuracion_gimnasio)') is null then
    raise exception 'Guarda: falta la migración 0006';
  end if;
end $$;

-- ── Reglas por gimnasio ────────────────────────────────────────────
alter table public.configuracion_gimnasio add column if not exists retencion_dias_ausencia int not null default 14
  check (retencion_dias_ausencia between 3 and 90);
alter table public.configuracion_gimnasio add column if not exists retencion_dias_nuevo int not null default 28
  check (retencion_dias_nuevo between 7 and 90);
alter table public.configuracion_gimnasio add column if not exists retencion_dias_vencido int not null default 30
  check (retencion_dias_vencido between 1 and 120);
alter table public.configuracion_gimnasio add column if not exists retencion_dias_se_fue int not null default 90
  check (retencion_dias_se_fue between 7 and 365);

-- ── Plantillas de mensaje (editables) ──────────────────────────────
-- Variables: {nombre} {gimnasio} {vence} {dias} {monto}
create table if not exists public.plantillas_mensaje (
  gimnasio_id  uuid not null references public.gimnasios(id),
  clave        text not null check (clave in ('no_viene', 'por_vencer', 'vencido', 'se_fue', 'nuevo')),
  texto        text not null check (length(trim(texto)) between 1 and 1000),
  actualizado_en timestamptz not null default now(),
  primary key (gimnasio_id, clave)
);
select privado.politicas_estandar('public.plantillas_mensaje', null, array['dueno', 'encargado']);

create or replace function privado.crear_plantillas(p_gimnasio_id uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.plantillas_mensaje (gimnasio_id, clave, texto) values
    (p_gimnasio_id, 'no_viene',   'Hola {nombre}! Te extrañamos en {gimnasio} 💪 Hace {dias} días que no venís. ¿Todo bien? Si querés te ayudamos a armar un horario que te quede cómodo.'),
    (p_gimnasio_id, 'por_vencer', 'Hola {nombre}! Te recordamos que tu plan en {gimnasio} vence el {vence}. Podés renovarlo cuando vengas o por transferencia 🙌'),
    (p_gimnasio_id, 'vencido',    'Hola {nombre}! Tu plan en {gimnasio} venció el {vence}. Para seguir entrenando son {monto}. ¿Te esperamos esta semana?'),
    (p_gimnasio_id, 'se_fue',     'Hola {nombre}! ¿Cómo andás? En {gimnasio} nos encantaría volver a verte. Si querés retomar, escribinos y vemos juntos qué plan te conviene.'),
    (p_gimnasio_id, 'nuevo',      'Hola {nombre}! ¿Cómo te fue en tus primeras semanas en {gimnasio}? Si necesitás ayuda con la rutina o los horarios, decinos 🙂')
  on conflict do nothing
$$;
revoke all on function privado.crear_plantillas(uuid) from public;

create or replace function privado.al_crear_gimnasio_plantillas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform privado.crear_plantillas(new.id); return null; end $$;
revoke all on function privado.al_crear_gimnasio_plantillas() from public;
drop trigger if exists gimnasios_crear_plantillas on public.gimnasios;
create trigger gimnasios_crear_plantillas after insert on public.gimnasios
  for each row execute function privado.al_crear_gimnasio_plantillas();

do $$
declare g uuid;
begin
  for g in select id from public.gimnasios loop perform privado.crear_plantillas(g); end loop;
end $$;

-- ── Contactos: "ya le escribió Caro hace 2 días" ───────────────────
create table if not exists public.contactos_retencion (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  socio_id     uuid not null,
  lista        text check (lista in ('no_viene', 'por_vencer', 'vencido', 'se_fue', 'nuevo')),
  canal        text not null default 'whatsapp' check (canal in ('whatsapp', 'llamada', 'en_persona', 'otro')),
  resultado    text not null default 'enviado' check (resultado in ('enviado', 'vuelve', 'no_contesta', 'se_va', 'otro')),
  nota         text check (nota is null or length(nota) <= 500),
  creado_en    timestamptz not null default now(),
  creado_por   uuid not null,
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id)
);
create index if not exists contactos_socio on public.contactos_retencion (gimnasio_id, socio_id, creado_en desc);
select privado.politicas_estandar('public.contactos_retencion', array['dueno', 'encargado'], '{}');

create or replace function public.registrar_contacto(p_socio_id uuid, p_lista text, p_canal text default 'whatsapp',
                                                     p_resultado text default 'enviado', p_nota text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid; cid uuid;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(g, array['dueno', 'encargado']);
  insert into public.contactos_retencion (gimnasio_id, socio_id, lista, canal, resultado, nota, creado_por)
  values (g, p_socio_id, p_lista, p_canal, p_resultado, nullif(trim(coalesce(p_nota, '')), ''), eid)
  returning id into cid;
  return cid;
end $$;

-- ═══ El cálculo ════════════════════════════════════════════════════
create or replace function privado.retencion(p_gimnasio_id uuid, p_momento timestamptz)
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
hoy as (select privado.dia_local(p_momento, g.zona) as d from g),
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
visitas as (
  select i.socio_id, max(i.momento) as ultimo
    from public.ingresos i
   where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado' and i.momento <= p_momento
   group by i.socio_id
),
frecuencia as (
  -- días distintos con ingreso en las 8 semanas anteriores a su última visita
  select i.socio_id, count(distinct privado.dia_local(i.momento, g.zona))::numeric / 8 as por_semana
    from public.ingresos i join visitas v on v.socio_id = i.socio_id, g
   where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado'
     and i.momento > v.ultimo - interval '56 days' and i.momento <= v.ultimo
   group by i.socio_id
),
base as (
  select so.id as socio_id, trim(so.nombre || ' ' || so.apellido) as nombre, so.nombre as nombre_pila, so.telefono,
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
    left join precios pr on pr.plan_id = su.plan_id
    left join visitas v on v.socio_id = so.id
    left join frecuencia f on f.socio_id = so.id
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
           and hoy.d - privado.dia_local(coalesce(b.ultimo_fin, b.primer_inicio), g.zona) > g.retencion_dias_vencido then 'se_fue'
      when b.fin_actual is null and not b.tiene_futuro then 'vencido'
      when b.fin_actual is not null
           and privado.dia_local(b.fin_actual - interval '1 microsecond', g.zona) - hoy.d <= g.dias_aviso then 'por_vencer'
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
    case when c.lista = 'vencido' then privado.via_membresia(c.socio_id, p_momento, null, g.zona, (select cfg.c from cfg)) end as vm,
    case c.lista
      when 'se_fue' then coalesce(c.dado_de_baja_en, c.baja_en, c.ultimo_fin, c.primer_inicio)
      when 'vencido' then c.ultimo_fin
      else c.fin_actual end as vence,
    case
      when c.lista in ('no_viene', 'nuevo') then c.hoy_d - privado.dia_local(coalesce(c.ultimo_ingreso, c.primer_inicio), g.zona)
      when c.lista in ('vencido', 'se_fue') then c.hoy_d - privado.dia_local(coalesce(c.dado_de_baja_en, c.baja_en, c.sin_cubrir_desde), g.zona)
      when c.lista = 'por_vencer' then privado.dia_local(c.fin_actual - interval '1 microsecond', g.zona) - c.hoy_d
    end as dias
    from clasificado c, g
   where c.lista is not null
),
final as (
  select t.*,
    case when t.lista = 'vencido' then
      coalesce((t.vm).para_regularizar,
               (select pr.precio from precios pr where pr.plan_id = t.plan_id) * privado.cuotas_para_cubrir(t.suscripcion_id, p_momento))
    end as debe
    from con_texto t
)
select t.socio_id, t.nombre, t.telefono, t.lista,
  case t.lista
    when 'no_viene' then case when t.ultimo_ingreso is null then 'No vino nunca · se anotó hace ' || t.dias || ' días'
                              else 'No viene hace ' || t.dias || ' días' end
                         || case when t.por_semana >= 0.5 then ' · venía ' || round(t.por_semana) || ' veces por semana' else '' end
    when 'nuevo' then 'Se anotó el ' || privado.fecha_corta(t.primer_inicio, g.zona) || ' · '
                      || case when t.ultimo_ingreso is null then 'todavía no vino' else 'no viene hace ' || t.dias || ' días' end
    when 'por_vencer' then case t.dias when 0 then 'Vence hoy' when 1 then 'Vence mañana'
                                       else 'Vence el ' || privado.ultimo_dia(t.fin_actual, g.zona) end
    when 'vencido' then case when (t.vm).motivo in ('vencida', 'sin_pago') then (t.vm).texto
                             else 'Venció el ' || privado.ultimo_dia(t.ultimo_fin, g.zona)
                                  || coalesce(' · debe ' || privado.formato_pesos(t.debe), '') end
    when 'se_fue' then case when t.dado_de_baja_en is not null
                            then 'Se dio de baja el ' || privado.fecha_corta(t.dado_de_baja_en, g.zona) || coalesce(' · ' || replace(t.motivo_baja, '_', ' '), '')
                            when t.ultimo_fin is null then 'Nunca pagó · se anotó el ' || privado.fecha_corta(t.primer_inicio, g.zona)
                            else 'Dejó de pagar el ' || privado.ultimo_dia(t.ultimo_fin, g.zona) end
  end,
  t.dias, t.vence, t.monto_mensual, t.debe, t.ultimo_ingreso, round(t.por_semana, 1),
  uc.creado_en, uc.quien, uc.resultado,
  replace(replace(replace(replace(replace(pm.texto,
    '{nombre}', t.nombre_pila), '{gimnasio}', g.nombre),
    '{vence}', coalesce(case when t.lista in ('vencido', 'por_vencer') and t.vence is not null then privado.ultimo_dia(t.vence, g.zona) end, 'hace poco')),
    '{dias}', coalesce(t.dias::text, '')),
    '{monto}', coalesce(privado.formato_pesos(coalesce(t.debe, t.monto_mensual)), 'la cuota'))
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
revoke all on function privado.retencion(uuid, timestamptz) from public;

create or replace function public.retencion(p_gimnasio_id uuid)
returns table (
  socio_id uuid, nombre text, telefono text, lista text, texto text, dias int,
  vence_en timestamptz, monto_mensual numeric, debe numeric, ultimo_ingreso timestamptz,
  visitas_por_semana numeric, ultimo_contacto_en timestamptz, ultimo_contacto_por text,
  ultimo_contacto_resultado text, mensaje text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado']);
  return query select * from privado.retencion(p_gimnasio_id, now());
end $$;

-- Arriba de todo: cuántos en cada lista y cuánta plata por mes está en riesgo.
create or replace function privado.retencion_resumen(p_gimnasio_id uuid, p_momento timestamptz) returns jsonb
language sql stable set search_path = '' as $$
  with r as materialized (select * from privado.retencion(p_gimnasio_id, p_momento))
  select jsonb_build_object(
    'plata_en_riesgo', (select coalesce(sum(monto_mensual), 0) from r where lista in ('vencido', 'por_vencer', 'nuevo', 'no_viene')),
    'listas', (select coalesce(jsonb_object_agg(lista, n), '{}'::jsonb) from (select lista, count(*) as n from r group by lista) x)
  )
$$;
revoke all on function privado.retencion_resumen(uuid, timestamptz) from public;

create or replace function public.retencion_resumen(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_rol(p_gimnasio_id, array['dueno', 'encargado']);
  return privado.retencion_resumen(p_gimnasio_id, now());
end $$;

revoke all on function public.retencion(uuid), public.retencion_resumen(uuid), public.registrar_contacto(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.retencion(uuid), public.retencion_resumen(uuid), public.registrar_contacto(uuid, text, text, text, text)
  to authenticated, service_role;

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

do $$
begin
  if exists (select 1 from public.gimnasios g where (select count(*) from public.plantillas_mensaje p where p.gimnasio_id = g.id) <> 5) then
    raise exception 'Verificación: hay gimnasios sin sus 5 plantillas';
  end if;
end $$;
