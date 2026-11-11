-- F0.3 · filtros_socios en lote, corrección de 20261111140000: el camino lento (la puerta) se llama SOLO para quien no salió por el camino rápido.
-- Medido: con un LATERAL ... where r.grupo is null, Postgres aplanaba la subconsulta y llamaba a calcular_acceso por cada socio (más lento que antes).
-- Ahora la llamada vive en un CASE (que solo evalúa la rama que corresponde). Mismo resultado (grupo y por_puerta) que 20261111140000;
-- lo prueba filtros-en-lote.test.mjs.
-- Además, el camino rápido ahora resuelve las restricciones del plan (otra sede, franja horaria, tope semanal) por conjuntos, con la misma
-- cuenta que privado.restricciones_plan: si alguna aplica, la puerta da rojo ('vencidos') en la rama cubierta y en la de tolerancia.
-- Antes mandaba esos socios por la puerta; el gimnasio de la prueba de escala tiene a casi todos en un plan con tope semanal.

do $g$ begin
  if to_regprocedure('privado.filtros_socios_grupos(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta filtros_socios_grupos (20261111140000)'; end if;
end $g$;

-- El grupo que da la puerta para un socio (la fuente de verdad sigue siendo calcular_acceso).
create or replace function privado.grupo_de_puerta(p_socio_id uuid, p_momento timestamptz, p_sede_id uuid) returns text
language plpgsql stable set search_path = '' as $$
declare v public.veredicto_acceso;
begin
  v := privado.calcular_acceso(p_socio_id, p_momento, p_sede_id);
  return privado.grupo_estado(v.color, v.motivo);
end $$;
revoke all on function privado.grupo_de_puerta(uuid, timestamptz, uuid) from public, anon, authenticated;

create or replace function privado.filtros_socios_grupos(p_gimnasio_id uuid, p_momento timestamptz, p_sede_id uuid)
returns table (socio_id uuid, creado_en timestamptz, grupo text, por_puerta boolean)
language sql stable set search_path = '' as $$
with
g as materialized (
  select gi.zona_horaria as zona, c.dias_aviso, c.tolerancia_dias as tol_cfg,
         (coalesce(c.plan_familiar_activo, false)) as familiar,
         (c.avisar_sin_bloquear_hasta is not null and c.avisar_sin_bloquear_hasta > p_momento) as modo_aviso
    from public.gimnasios gi join public.configuracion_gimnasio c on c.gimnasio_id = gi.id
   where gi.id = p_gimnasio_id
),
hoy as materialized (select privado.dia_local(p_momento, g.zona) as d from g),
-- Suspendido o expulsado: la puerta da rojo 'suspendido' antes de mirar cualquier otra vía (y el modo aviso tampoco lo deja pasar) → 'vencidos'.
suspendidos as materialized (
  select x.socio_id from public.suspensiones x
   where x.gimnasio_id = p_gimnasio_id and x.desde <= p_momento
     and (x.hasta is null or x.hasta > p_momento) and (x.levantada_en is null or x.levantada_en > p_momento)
),
especiales as materialized (
  select k.socio_id from public.packs k where k.gimnasio_id = p_gimnasio_id and k.anulado_en is null
  union
  select r.socio_id from public.pruebas_gratis r where r.gimnasio_id = p_gimnasio_id and r.anulada_en is null and r.socio_id is not null
  union
  select pa.socio_id from public.pases_diarios pa
   where pa.gimnasio_id = p_gimnasio_id and pa.anulado_en is null and pa.desde <= p_momento and pa.hasta > p_momento
  union
  select v.socio_id from public.ventas v
   where v.gimnasio_id = p_gimnasio_id and v.socio_id is not null
     and (v.id in (select p.venta_id from public.pagos p where p.gimnasio_id = p_gimnasio_id and p.medio = 'cuenta_corriente')
          or v.id in (select vi.venta_id from public.venta_items vi where vi.gimnasio_id = p_gimnasio_id and vi.tipo = 'deuda'))
),
-- Días distintos con ingreso por membresía en la semana en curso, sin contar hoy (la cuenta de restricciones_plan para el tope semanal).
semana as materialized (
  select i.socio_id, count(distinct (i.momento at time zone g.zona)::date) as n
    from public.ingresos i cross join g cross join hoy
   where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.via_habilitante = 'membresia'
     and i.resultado in ('entro', 'entro_modo_aviso', 'forzado')
     and i.momento >= privado.medianoche(date_trunc('week', hoy.d::timestamp)::date, g.zona)
     and i.momento < privado.medianoche(hoy.d, g.zona)
   group by i.socio_id
),
congeladas as materialized (
  select z.suscripcion_id from public.congelamientos z
   where z.gimnasio_id = p_gimnasio_id and z.anulado_en is null
     and z.desde <= p_momento and coalesce(z.hasta_real, z.hasta_prevista) > p_momento
),
con_futuro as materialized (
  select distinct c.suscripcion_id from public.coberturas c
   where c.gimnasio_id = p_gimnasio_id and c.anulada_en is null and c.desde > p_momento
),
base as (
  select so.id, so.creado_en, s.id as suscripcion_id, s.tol, (so.id in (select z.socio_id from suspendidos z)) as suspendido,
         -- restricciones_plan: otra sede, franja horaria o tope semanal dan rojo (en la rama cubierta y en la de tolerancia).
         (s.sede_no or s.franja_no
          or (s.max_semana is not null and coalesce(w.n, 0) >= s.max_semana)) as rojo_plan,
         (g.modo_aviso or (g.familiar and so.grupo_familiar_id is not null)
          or so.id in (select e.socio_id from especiales e)) as especial
    from public.socios so
    cross join g
    left join lateral (
      select su.id,
             (p_sede_id is not null and not pl.todas_las_sedes
              and not exists (select 1 from public.plan_sedes ps where ps.plan_id = pl.id and ps.sede_id = p_sede_id)) as sede_no,
             (pl.hora_desde is not null and ((p_momento at time zone g.zona)::time < pl.hora_desde or (p_momento at time zone g.zona)::time >= pl.hora_hasta)) as franja_no,
             pl.max_ingresos_semana as max_semana,
             coalesce(pl.tolerancia_dias, g.tol_cfg) as tol
        from public.suscripciones su join public.planes pl on pl.id = su.plan_id
       where su.socio_id = so.id and su.inicio <= p_momento and (su.baja_en is null or su.baja_en > p_momento)
       order by su.inicio desc limit 1
    ) s on true
    left join semana w on w.socio_id = so.id
   where so.gimnasio_id = p_gimnasio_id and so.dado_de_baja_en is null
),
rapido as (
  select b.id, b.creado_en,
         case
           when b.suspendido then 'vencidos'
           when b.especial then null
           when b.suscripcion_id is null then 'sin_plan'
           -- Congelada: via_membresia lo mira antes que las coberturas; sin otras vías en juego, la puerta da rojo 'congelada' → 'en_pausa'.
           when b.suscripcion_id in (select c.suscripcion_id from congeladas c) then 'en_pausa'
           when b.suscripcion_id in (select f.suscripcion_id from con_futuro f) then null
           when h.hasta is not null and h.hasta > p_momento then
             case when b.rojo_plan then 'vencidos'
                  when ((h.hasta - interval '1 microsecond') at time zone g.zona)::date - hoy.d <= g.dias_aviso then 'por_vencer' else 'al_dia' end
           when h.hasta is not null and hoy.d - (h.hasta at time zone g.zona)::date + 1 <= b.tol then case when b.rojo_plan then 'vencidos' else 'por_vencer' end
           else 'vencidos'
         end as grupo
    from base b cross join g cross join hoy
    left join lateral (
      select max(c.hasta) as hasta from public.coberturas c
       where c.suscripcion_id = b.suscripcion_id and c.anulada_en is null and not b.especial and not b.suspendido
    ) h on true
)
select r.id, r.creado_en,
       case when r.grupo is null then privado.grupo_de_puerta(r.id, p_momento, p_sede_id) else r.grupo end,
       r.grupo is null
  from rapido r
$$;
revoke all on function privado.filtros_socios_grupos(uuid, timestamptz, uuid) from public, anon, authenticated;

do $v$
begin
  if pg_get_functiondef('privado.filtros_socios_grupos(uuid, timestamptz, uuid)'::regprocedure) not like '%grupo_de_puerta%' then
    raise exception 'Verificación: filtros_socios_grupos no usa grupo_de_puerta';
  end if;
  if pg_get_functiondef('privado.grupo_de_puerta(uuid, timestamptz, uuid)'::regprocedure) not like '%calcular_acceso%' then
    raise exception 'Verificación: grupo_de_puerta no pasa por calcular_acceso';
  end if;
  if not exists (select 1 from pg_proc where oid = 'privado.filtros_socios_grupos(uuid, timestamptz, uuid)'::regprocedure and 'search_path=""' = any (proconfig))
     or not exists (select 1 from pg_proc where oid = 'privado.grupo_de_puerta(uuid, timestamptz, uuid)'::regprocedure and 'search_path=""' = any (proconfig)) then
    raise exception 'Verificación: sin search_path vacío';
  end if;
  if has_function_privilege('anon', 'privado.grupo_de_puerta(uuid, timestamptz, uuid)', 'execute')
     or has_function_privilege('authenticated', 'privado.grupo_de_puerta(uuid, timestamptz, uuid)', 'execute')
     or has_function_privilege('authenticated', 'privado.filtros_socios_grupos(uuid, timestamptz, uuid)', 'execute') then
    raise exception 'Verificación: ejecutable desde el navegador';
  end if;
end $v$;
