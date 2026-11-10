-- FA-22 (carril D) · Alertas por patrón en las entradas. Solo AVISA al dueño y al encargado: no frena ninguna entrada ni cambia ningún permiso.
--   1) "dos sedes": el mismo socio entró en dos sedes distintas con pocos minutos de diferencia (hasta 20): puede haber prestado su acceso.
--   2) "muchas entradas": en un día entró 4 veces o más y al menos el triple de su promedio por día de visita de los 30 días anteriores.
-- Se calcula al consultar, de los hechos (ingresos no anulados que dejaron pasar). Sin cron, sin guardar nada. Aditiva e idempotente.
--   alertas_patron_entradas(gimnasio, dias default 14)   dueño y encargado

do $g$ begin
  if to_regprocedure('privado.exigir_equipo(uuid, text[])') is null then raise exception 'FA-22: falta privado.exigir_equipo'; end if;
  if to_regclass('public.ingresos') is null then raise exception 'FA-22: falta ingresos'; end if;
end $g$;

create or replace function public.alertas_patron_entradas(p_gimnasio_id uuid, p_dias int default 14) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; dos jsonb; muchas jsonb;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  if p_dias is null or p_dias < 1 or p_dias > 90 then raise exception 'Los días van de 1 a 90' using errcode = '22023'; end if;
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;

  select coalesce(jsonb_agg(jsonb_build_object('socio_id', x.socio_id, 'nombre', x.nombre, 'sede_a', x.sede_a, 'sede_b', x.sede_b,
                                               'minutos', x.minutos, 'momento', x.momento) order by x.momento desc), '[]'::jsonb) into dos
    from (select distinct on (b.id) a.socio_id, s.nombre || ' ' || s.apellido as nombre, sa.nombre as sede_a, sb.nombre as sede_b,
                 round(extract(epoch from (b.momento - a.momento)) / 60)::int as minutos, b.momento
            from public.ingresos a
            join public.ingresos b on b.gimnasio_id = a.gimnasio_id and b.socio_id = a.socio_id and b.sede_id <> a.sede_id
                                  and b.momento > a.momento and b.momento <= a.momento + interval '20 minutes'
            join public.socios s on s.id = a.socio_id and s.gimnasio_id = a.gimnasio_id
            join public.sedes sa on sa.id = a.sede_id join public.sedes sb on sb.id = b.sede_id
           where a.gimnasio_id = p_gimnasio_id and a.anulado_en is null and b.anulado_en is null
             and a.resultado <> 'rechazado' and b.resultado <> 'rechazado'
             and a.momento > now() - make_interval(days => p_dias) order by b.id, a.momento desc) x;

  with dia as (
    select i.socio_id, (i.momento at time zone zona)::date as dia, count(*) as n
      from public.ingresos i
     where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado'
       and i.momento > now() - make_interval(days => p_dias + 30)
     group by 1, 2),
  promedio as (
    select d.socio_id, avg(d.n) as prom
      from dia d where d.dia < (now() - make_interval(days => p_dias))::date group by 1)
  select coalesce(jsonb_agg(jsonb_build_object('socio_id', d.socio_id, 'nombre', s.nombre || ' ' || s.apellido, 'dia', d.dia, 'entradas', d.n,
                                               'promedio', round(coalesce(p.prom, 1), 1)) order by d.dia desc, d.n desc), '[]'::jsonb) into muchas
    from dia d join public.socios s on s.id = d.socio_id and s.gimnasio_id = p_gimnasio_id
    left join promedio p on p.socio_id = d.socio_id
   where d.dia >= (now() - make_interval(days => p_dias))::date and d.n >= 4 and d.n >= 3 * coalesce(p.prom, 1);

  return jsonb_build_object('dos_sedes', dos, 'muchas_entradas', muchas);
end $$;

revoke all on function public.alertas_patron_entradas(uuid, int) from public, anon, authenticated;
grant execute on function public.alertas_patron_entradas(uuid, int) to authenticated, service_role;

do $v$ begin
  if has_function_privilege('anon', 'public.alertas_patron_entradas(uuid, int)', 'execute') then raise exception 'FA-22: no es para anónimos'; end if;
end $v$;
