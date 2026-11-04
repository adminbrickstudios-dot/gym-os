-- ═══════════════════════════════════════════════════════════════════
-- 0025 · Mensajes editables con vista previa (CFG-5).
--
-- Las plantillas de retención (0010) pasan a ser "los mensajes del
-- gimnasio", editables desde Configuración, con tres nuevos (cumpleaños,
-- bienvenida, comprobante rechazado) para la bandeja de avisos.
--
--   privado.mensajes_catalogo()   qué mensajes hay, cuándo se usan, qué
--                                 variables aceptan y su texto original
--   privado.armar_mensaje()       reemplaza {variables}: una sola función
--   privado.retencion_con()       el cálculo de retención, con plantillas
--                                 opcionales sin guardar (para la vista previa);
--                                 privado.retencion queda como envoltorio
--   mensajes_panel / guardar_mensaje / restaurar_mensaje / vista_previa_mensaje
--
-- Variables: {nombre} {gimnasio} {plan} {vence} {dias} {debe} ({monto}
-- sigue andando: es lo mismo que {debe}, para los textos ya guardados).
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('privado.retencion(uuid,timestamptz)') is null then raise exception 'Guarda: falta la migración 0010'; end if;
  if to_regclass('public.plantillas_mensaje') is null then raise exception 'Guarda: falta la migración 0010'; end if;
  if to_regprocedure('privado.calcular_acceso(uuid,timestamptz,uuid)') is null then raise exception 'Guarda: falta la migración 0006'; end if;
end $$;

-- ── Catálogo ────────────────────────────────────────────────────────
create or replace function privado.mensajes_catalogo() returns jsonb
language sql immutable set search_path = '' as $$
  select '[
    {"clave": "por_vencer", "titulo": "Vence pronto", "emoji": "⏰", "cuando": "A los que se les termina la cuota en los próximos días.",
     "usado_en": ["Retención", "Vencen hoy"], "variables": ["nombre", "gimnasio", "plan", "vence", "dias", "debe"],
     "original": "Hola {nombre}! Te recordamos que tu plan en {gimnasio} vence el {vence}. Podés renovarlo cuando vengas o por transferencia 🙌"},
    {"clave": "vencido", "titulo": "Venció", "emoji": "⛔", "cuando": "A los que se les terminó la cuota y no renovaron.",
     "usado_en": ["Retención"], "variables": ["nombre", "gimnasio", "plan", "vence", "dias", "debe", "monto"],
     "original": "Hola {nombre}! Tu plan en {gimnasio} venció el {vence}. Para seguir entrenando son {monto}. ¿Te esperamos esta semana?"},
    {"clave": "no_viene", "titulo": "No viene", "emoji": "👀", "cuando": "A los que pagan pero hace días que no vienen.",
     "usado_en": ["Retención"], "variables": ["nombre", "gimnasio", "plan", "dias"],
     "original": "Hola {nombre}! Te extrañamos en {gimnasio} 💪 Hace {dias} días que no venís. ¿Todo bien? Si querés te ayudamos a armar un horario que te quede cómodo."},
    {"clave": "nuevo", "titulo": "Nuevo que no viene", "emoji": "🌱", "cuando": "A los recién anotados que todavía no agarraron ritmo.",
     "usado_en": ["Retención"], "variables": ["nombre", "gimnasio", "plan", "dias"],
     "original": "Hola {nombre}! ¿Cómo te fue en tus primeras semanas en {gimnasio}? Si necesitás ayuda con la rutina o los horarios, decinos 🙂"},
    {"clave": "se_fue", "titulo": "Se fue", "emoji": "👋", "cuando": "A los que dejaron de pagar hace tiempo o se dieron de baja.",
     "usado_en": ["Retención"], "variables": ["nombre", "gimnasio", "plan", "dias"],
     "original": "Hola {nombre}! ¿Cómo andás? En {gimnasio} nos encantaría volver a verte. Si querés retomar, escribinos y vemos juntos qué plan te conviene."},
    {"clave": "bienvenida", "titulo": "Bienvenida", "emoji": "🎉", "cuando": "Al socio que se acaba de anotar.",
     "usado_en": [], "variables": ["nombre", "gimnasio", "plan", "vence"],
     "original": "¡Bienvenido/a a {gimnasio}, {nombre}! 💪 Tu plan {plan} ya está activo. Cualquier cosa, escribinos por acá."},
    {"clave": "cumpleanos", "titulo": "Cumpleaños", "emoji": "🎂", "cuando": "El día del cumpleaños del socio.",
     "usado_en": [], "variables": ["nombre", "gimnasio"],
     "original": "¡Feliz cumpleaños, {nombre}! 🎂 Todo el equipo de {gimnasio} te desea un gran año. ¡Te esperamos para festejarlo entrenando!"},
    {"clave": "comprobante_rechazado", "titulo": "Comprobante rechazado", "emoji": "🧾", "cuando": "Cuando no se puede aprobar una transferencia que mandó el socio.",
     "usado_en": [], "variables": ["nombre", "gimnasio", "plan", "debe"],
     "original": "Hola {nombre}, no pudimos aprobar el comprobante que mandaste en {gimnasio}. ¿Nos mandás otro, o pasás por recepción? Son {debe}."}
  ]'::jsonb
$$;

-- Reemplaza cada {clave} por su valor. Lo que no viene en p_vars queda igual.
create or replace function privado.armar_mensaje(p_texto text, p_vars jsonb) returns text
language plpgsql immutable set search_path = '' as $$
declare r text := p_texto; k text;
begin
  if r is null then return null; end if;
  for k in select jsonb_object_keys(coalesce(p_vars, '{}')) loop
    r := replace(r, '{' || k || '}', coalesce(p_vars ->> k, ''));
  end loop;
  return r;
end $$;

-- Las variables de un socio cualquiera (para los mensajes que no son de retención).
create or replace function privado.variables_socio(p_socio_id uuid, p_momento timestamptz) returns jsonb
language plpgsql stable set search_path = '' as $$
declare s public.socios; g public.gimnasios; v public.veredicto_acceso; plan text; precio numeric;
begin
  select * into s from public.socios where id = p_socio_id;
  select * into g from public.gimnasios where id = s.gimnasio_id;
  v := privado.calcular_acceso(s.id, p_momento, null);
  select p.nombre, privado.precio_base(p.id, p_momento) into plan, precio
    from public.suscripciones x join public.planes p on p.id = x.plan_id
   where x.socio_id = s.id and x.baja_en is null limit 1;
  return jsonb_build_object(
    'nombre', s.nombre, 'gimnasio', g.nombre, 'plan', coalesce(plan, 'tu plan'),
    'vence', coalesce(privado.ultimo_dia(v.vence_en, g.zona_horaria), 'hace poco'),
    'dias', '',
    'debe', coalesce(privado.formato_pesos(coalesce(v.para_regularizar, precio)), 'la cuota'),
    'monto', coalesce(privado.formato_pesos(coalesce(v.para_regularizar, precio)), 'la cuota'));
end $$;

-- ── Tabla: claves nuevas ────────────────────────────────────────────
alter table public.plantillas_mensaje drop constraint if exists plantillas_mensaje_clave_check;
alter table public.plantillas_mensaje add constraint plantillas_mensaje_clave_check
  check (clave in ('no_viene', 'por_vencer', 'vencido', 'se_fue', 'nuevo', 'bienvenida', 'cumpleanos', 'comprobante_rechazado'));

-- Cada gimnasio, nuevo o existente, tiene todos los mensajes con su texto original.
create or replace function privado.crear_plantillas(p_gimnasio_id uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.plantillas_mensaje (gimnasio_id, clave, texto)
  select p_gimnasio_id, m ->> 'clave', m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m
  on conflict do nothing
$$;
do $$
declare g uuid;
begin
  for g in select id from public.gimnasios loop perform privado.crear_plantillas(g); end loop;
end $$;

-- ── Retención con plantillas opcionales (misma cuenta, una sola fuente) ──
create or replace function privado.retencion_con(p_gimnasio_id uuid, p_momento timestamptz, p_plantillas jsonb)
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
revoke all on function privado.retencion_con(uuid, timestamptz, jsonb) from public;

create or replace function privado.retencion(p_gimnasio_id uuid, p_momento timestamptz)
returns table (
  socio_id uuid, nombre text, telefono text, lista text, texto text, dias int,
  vence_en timestamptz, monto_mensual numeric, debe numeric, ultimo_ingreso timestamptz,
  visitas_por_semana numeric, ultimo_contacto_en timestamptz, ultimo_contacto_por text,
  ultimo_contacto_resultado text, mensaje text
)
language sql stable set search_path = '' as $$
  select * from privado.retencion_con(p_gimnasio_id, p_momento, null)
$$;

-- ── Panel ───────────────────────────────────────────────────────────
create or replace function public.mensajes_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return (select jsonb_agg(m || jsonb_build_object('texto', coalesce(p.texto, m ->> 'original'),
                                                   'modificado', coalesce(p.texto, m ->> 'original') <> m ->> 'original')
                           order by o)
            from jsonb_array_elements(privado.mensajes_catalogo()) with ordinality x(m, o)
            left join public.plantillas_mensaje p on p.gimnasio_id = p_gimnasio_id and p.clave = m ->> 'clave');
end $$;

-- Valida el texto de un mensaje: largo y variables que existen para ese mensaje.
create or replace function privado.validar_mensaje(p_clave text, p_texto text) returns text
language plpgsql immutable set search_path = '' as $$
declare m jsonb; t text := trim(coalesce(p_texto, '')); malas text;
begin
  select x into m from jsonb_array_elements(privado.mensajes_catalogo()) x where x ->> 'clave' = p_clave;
  if m is null then raise exception 'Mensaje desconocido' using errcode = '22023'; end if;
  if t = '' then raise exception 'El mensaje no puede quedar vacío. Para volver al de antes, tocá “Volver al original”.' using errcode = '22023'; end if;
  if length(t) > 1000 then raise exception 'El mensaje puede tener hasta 1000 letras (tiene %).', length(t) using errcode = '22023'; end if;
  select string_agg(distinct '{' || v[1] || '}', ', ') into malas
    from regexp_matches(t, '\{([^{}]*)\}', 'g') v
   where not (m -> 'variables') ? v[1];
  if malas is not null then
    raise exception 'En este mensaje no se puede usar %. Podés usar: %.', malas,
      (select string_agg('{' || x || '}', ' ') from jsonb_array_elements_text(m -> 'variables') x) using errcode = '22023';
  end if;
  return t;
end $$;

create or replace function public.guardar_mensaje(p_gimnasio_id uuid, p_clave text, p_texto text) returns void
language plpgsql security definer set search_path = '' as $$
declare t text; n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  t := privado.validar_mensaje(p_clave, p_texto);
  insert into public.plantillas_mensaje (gimnasio_id, clave, texto) values (p_gimnasio_id, p_clave, t)
  on conflict (gimnasio_id, clave) do update set texto = excluded.texto, actualizado_en = now();
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar el mensaje'; end if;
end $$;

create or replace function public.restaurar_mensaje(p_gimnasio_id uuid, p_clave text) returns text
language plpgsql security definer set search_path = '' as $$
declare original text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  select x ->> 'original' into original from jsonb_array_elements(privado.mensajes_catalogo()) x where x ->> 'clave' = p_clave;
  if original is null then raise exception 'Mensaje desconocido' using errcode = '22023'; end if;
  perform public.guardar_mensaje(p_gimnasio_id, p_clave, original);
  return original;
end $$;

-- Cómo queda el texto (sin guardar) con un socio real. Para los mensajes de
-- retención, un socio que hoy está en esa lista, armado por la misma cuenta
-- que Retención; si no hay nadie en la lista, cualquier socio con plan.
create or replace function public.vista_previa_mensaje(p_gimnasio_id uuid, p_clave text, p_texto text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t text; r record; sid uuid;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  t := privado.validar_mensaje(p_clave, p_texto);
  if p_clave in ('no_viene', 'por_vencer', 'vencido', 'se_fue', 'nuevo') then
    select x.socio_id, x.nombre, x.texto, x.mensaje into r
      from privado.retencion_con(p_gimnasio_id, now(), jsonb_build_object(p_clave, t)) x
     where x.lista = p_clave limit 1;
    if found then
      return jsonb_build_object('socio', r.nombre, 'situacion', r.texto, 'texto', r.mensaje, 'de_la_lista', true);
    end if;
  end if;
  select s.id into sid from public.socios s
    join public.suscripciones x on x.socio_id = s.id and x.baja_en is null
   where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null
   order by s.numero limit 1;
  if sid is null then
    select s.id into sid from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null order by s.numero limit 1;
  end if;
  if sid is null then
    return jsonb_build_object('socio', null, 'situacion', null, 'de_la_lista', false,
      'texto', privado.armar_mensaje(t, jsonb_build_object('nombre', 'Sofía', 'gimnasio', (select g.nombre from public.gimnasios g where g.id = p_gimnasio_id),
                                                           'plan', 'Mensual', 'vence', 'el 10/12', 'dias', '7', 'debe', '$25.000', 'monto', '$25.000')));
  end if;
  return jsonb_build_object('socio', (select trim(s.nombre || ' ' || s.apellido) from public.socios s where s.id = sid),
                            'situacion', null, 'de_la_lista', false,
                            'texto', privado.armar_mensaje(t, privado.variables_socio(sid, now())));
end $$;

-- ── Permisos ────────────────────────────────────────────────────────
revoke all on function privado.mensajes_catalogo(), privado.armar_mensaje(text, jsonb), privado.variables_socio(uuid, timestamptz),
  privado.validar_mensaje(text, text), privado.crear_plantillas(uuid), privado.retencion(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.mensajes_panel(uuid), public.guardar_mensaje(uuid, text, text), public.restaurar_mensaje(uuid, text),
  public.vista_previa_mensaje(uuid, text, text) from public, anon, authenticated;
grant execute on function public.mensajes_panel(uuid), public.guardar_mensaje(uuid, text, text), public.restaurar_mensaje(uuid, text),
  public.vista_previa_mensaje(uuid, text, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record; faltan int;
begin
  select count(*) into faltan from public.gimnasios g
   where (select count(*) from public.plantillas_mensaje p where p.gimnasio_id = g.id) <> jsonb_array_length(privado.mensajes_catalogo());
  if faltan > 0 then raise exception 'Verificación: % gimnasios sin todos sus mensajes', faltan; end if;
  if privado.armar_mensaje('Hola {nombre}, {x}', '{"nombre": "Ana"}') <> 'Hola Ana, {x}' then
    raise exception 'Verificación: armar_mensaje no reemplaza bien';
  end if;
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'privado' and p.proname in ('mensajes_catalogo', 'armar_mensaje', 'variables_socio', 'validar_mensaje', 'retencion_con', 'retencion'))
               or (s.nspname = 'public' and p.proname in ('mensajes_panel', 'guardar_mensaje', 'restaurar_mensaje', 'vista_previa_mensaje')) loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if has_function_privilege('anon', r.oid, 'execute') then raise exception 'Verificación: anon puede ejecutar %', r.proname; end if;
  end loop;
end $$;
