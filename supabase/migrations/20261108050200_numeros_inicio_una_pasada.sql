-- BASE-1 · numeros_inicio sacaba de Retención 4 veces (a cobrar, deben, vencen esta semana, plata en riesgo): con 5.000 socios
-- tardaba 1,8 s. Ahora la recorre UNA vez. Mismos números, misma firma. Aditiva (create or replace).
do $g$ begin
  if to_regprocedure('public.numeros_inicio(uuid, uuid)') is null then raise exception 'BASE-1: falta public.numeros_inicio'; end if;
end $g$;

create or replace function public.numeros_inicio(p_gimnasio_id uuid, p_sede_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; c public.configuracion_gimnasio; zona text; hoy date; desde timestamptz; hasta timestamptz;
  sede uuid; ve_plata boolean; hay_clases boolean; corrido interval;
  todos text[] := array['adentro','entraron','cobrado','a_cobrar','deben','por_vencer','plata_riesgo','activos','altas_mes','bajas_mes','ocupacion'];
  claves text[] := '{}'; k text; v numeric; serie jsonb; salida jsonb := '[]'::jsonb; disponibles jsonb := '[]'::jsonb;
  r_hoy int := 0; r_sem int := 0; r_deben int := 0; r_riesgo numeric := 0; mes timestamptz; salida_modo text := 'no'; horas_visita int := 5; adentro_etiq text := 'Adentro (aprox.)';
  etiq jsonb := jsonb_build_object(
    'adentro', '🏋️|Adentro (aprox.)', 'entraron', '🚪|Entraron hoy', 'cobrado', '💵|Cobrado hoy', 'a_cobrar', '⏰|A cobrar hoy',
    'activos', '✅|Socios activos', 'altas_mes', '🆕|Altas del mes', 'bajas_mes', '👋|Bajas del mes',
    'deben', '🔴|Deben', 'por_vencer', '🟡|Vencen esta semana', 'plata_riesgo', '⚠️|Plata en riesgo', 'ocupacion', '🗓️|Ocupación de clases (%)');
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  sede := coalesce(p_sede_id, e.sede_id);
  if e.sede_id is not null and sede <> e.sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = p_gimnasio_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  -- VD-48: con la salida prendida, "Adentro ahora" cuenta las visitas abiertas (exacto).
  select coalesce(cv.registrar_salida, 'no'), case when coalesce(cv.visita_horas, 5) > 0 then coalesce(cv.visita_horas, 5) else 5 end into salida_modo, horas_visita
    from (select 1) u left join public.configuracion_visita cv on cv.gimnasio_id = p_gimnasio_id;
  if salida_modo <> 'no' then adentro_etiq := 'Adentro ahora'; end if;
  hoy := privado.dia_local(now(), zona);
  desde := privado.medianoche(hoy, zona);
  hasta := privado.medianoche(hoy + 1, zona);
  mes := privado.medianoche(date_trunc('month', hoy)::date, zona);
  corrido := now() - desde;
  -- La plata del día: dueño y encargado siempre; la recepción solo si el dueño lo prendió (EQU-1).
  ve_plata := e.rol in ('dueno', 'encargado') or (e.rol = 'recepcion' and c.recepcion_ve_cobrado);
  hay_clases := c.modo_clases <> 'ninguno' and not ('clases' = any (c.secciones_apagadas));

  foreach k in array todos loop
    if (k = 'cobrado' and not ve_plata) or (k = 'plata_riesgo' and e.rol not in ('dueno', 'encargado')) or (k = 'ocupacion' and not hay_clases) then continue; end if;
    disponibles := disponibles || jsonb_build_array(jsonb_build_object('clave', k, 'etiqueta', case when k = 'adentro' then adentro_etiq else split_part(etiq ->> k, '|', 2) end, 'emoji', split_part(etiq ->> k, '|', 1)));
  end loop;

  foreach k in array c.numeros_inicio loop
    if exists (select 1 from jsonb_array_elements(disponibles) d where d ->> 'clave' = k) then claves := claves || k; end if;
  end loop;
  if cardinality(claves) = 0 then
    foreach k in array case when ve_plata then array['adentro','entraron','cobrado','a_cobrar','por_vencer','deben','plata_riesgo'] else array['adentro','entraron','a_cobrar','por_vencer','deben'] end loop
      if exists (select 1 from jsonb_array_elements(disponibles) d where d ->> 'clave' = k) then claves := claves || k; end if;
    end loop;
  end if;

  -- BASE-1: Retención es lo caro; los 4 números que salen de ahí se sacan de UNA sola pasada.
  if claves && array['a_cobrar', 'deben', 'por_vencer', 'plata_riesgo'] then
    select count(*) filter (where r.lista = 'por_vencer' and r.dias = 0), count(*) filter (where r.lista = 'por_vencer' and r.dias between 1 and 7),
           count(*) filter (where r.lista = 'vencido'), coalesce(sum(r.monto_mensual) filter (where r.lista in ('vencido', 'por_vencer', 'nuevo', 'no_viene')), 0)
      into r_hoy, r_sem, r_deben, r_riesgo from privado.retencion(p_gimnasio_id, now()) r;
  end if;

  foreach k in array claves loop
    serie := null; v := 0;
    if k = 'adentro' then
      if salida_modo = 'no' then
        select count(distinct i.socio_id) into v from public.ingresos i
         where i.gimnasio_id = p_gimnasio_id and i.momento >= greatest(desde, now() - interval '2 hours') and i.momento <= now()
           and i.anulado_en is null and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede);
      else
        v := privado.adentro_ahora(p_gimnasio_id, sede, now());
      end if;
      -- cuántos había adentro a esta misma hora en cada uno de los últimos 7 días
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(distinct i.socio_id) as n from public.ingresos i
           where i.gimnasio_id = p_gimnasio_id and i.anulado_en is null and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede)
             and i.momento >= greatest(privado.medianoche(g.dia, zona), privado.medianoche(g.dia, zona) + corrido - interval '2 hours')
             and i.momento <= privado.medianoche(g.dia, zona) + corrido) x on true;
    elsif k = 'entraron' then
      select count(distinct i.socio_id) into v from public.ingresos i
       where i.gimnasio_id = p_gimnasio_id and i.momento >= desde and i.momento < hasta and i.anulado_en is null
         and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede);
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(distinct i.socio_id) as n from public.ingresos i
           where i.gimnasio_id = p_gimnasio_id and i.momento >= privado.medianoche(g.dia, zona) and i.momento < privado.medianoche(g.dia + 1, zona)
             and i.anulado_en is null and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede)) x on true;
    elsif k = 'cobrado' then
      select coalesce(sum(p.monto), 0) into v from public.pagos p join public.ventas ve on ve.id = p.venta_id
       where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.aprobado_en >= desde and p.aprobado_en < hasta
         and p.medio <> 'cuenta_corriente' and (sede is null or ve.sede_id = sede);
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select sum(p.monto) as n from public.pagos p join public.ventas ve on ve.id = p.venta_id
           where p.gimnasio_id = p_gimnasio_id and p.estado = 'aprobado' and p.medio <> 'cuenta_corriente'
             and p.aprobado_en >= privado.medianoche(g.dia, zona) and p.aprobado_en < privado.medianoche(g.dia + 1, zona)
             and (sede is null or ve.sede_id = sede)) x on true;
    elsif k = 'a_cobrar' then
      v := r_hoy;
      -- a cuántos les vencía la cobertura en cada uno de los últimos 7 días
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(distinct cb.socio_id) as n from public.coberturas cb
           where cb.gimnasio_id = p_gimnasio_id and cb.anulada_en is null
             and cb.hasta > privado.medianoche(g.dia, zona) and cb.hasta <= privado.medianoche(g.dia + 1, zona)) x on true;
    elsif k = 'deben' then
      v := r_deben;
    elsif k = 'por_vencer' then
      v := r_sem;
    elsif k = 'plata_riesgo' then
      v := r_riesgo;
    elsif k = 'activos' then
      select count(distinct cb.socio_id) into v from public.coberturas cb
       where cb.gimnasio_id = p_gimnasio_id and cb.anulada_en is null and cb.desde <= now() and cb.hasta > now();
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(distinct cb.socio_id) as n from public.coberturas cb
           where cb.gimnasio_id = p_gimnasio_id and (cb.anulada_en is null or cb.anulada_en > least(now(), privado.medianoche(g.dia + 1, zona) - interval '1 second'))
             and cb.desde <= least(now(), privado.medianoche(g.dia + 1, zona) - interval '1 second')
             and cb.hasta > least(now(), privado.medianoche(g.dia + 1, zona) - interval '1 second')) x on true;
    elsif k = 'altas_mes' then
      select count(*) into v from public.socios s where s.gimnasio_id = p_gimnasio_id and s.creado_en >= mes;
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(*) as n from public.socios s where s.gimnasio_id = p_gimnasio_id
           and s.creado_en >= privado.medianoche(g.dia, zona) and s.creado_en < privado.medianoche(g.dia + 1, zona)) x on true;
    elsif k = 'bajas_mes' then
      select count(*) into v from public.socios s where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en >= mes;
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(*) as n from public.socios s where s.gimnasio_id = p_gimnasio_id
           and s.dado_de_baja_en >= privado.medianoche(g.dia, zona) and s.dado_de_baja_en < privado.medianoche(g.dia + 1, zona)) x on true;
    elsif k = 'ocupacion' then
      select coalesce(round(100.0 * sum((select count(*) from public.reservas r where r.clase_id = kl.id and r.estado = 'confirmada'))
                            / nullif(sum(kl.cupo), 0)), 0) into v
        from public.clases kl where kl.gimnasio_id = p_gimnasio_id and kl.inicio >= desde and kl.inicio < hasta
         and kl.cancelada_en is null and kl.cupo is not null and (sede is null or kl.sede_id = sede);
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select coalesce(round(100.0 * sum((select count(*) from public.reservas r where r.clase_id = kl.id and r.estado = 'confirmada'))
                                  / nullif(sum(kl.cupo), 0)), 0) as n
           from public.clases kl where kl.gimnasio_id = p_gimnasio_id and kl.inicio >= privado.medianoche(g.dia, zona) and kl.inicio < privado.medianoche(g.dia + 1, zona)
            and kl.cancelada_en is null and kl.cupo is not null and (sede is null or kl.sede_id = sede)) x on true;
    end if;
    -- El último punto es hoy: tiene que coincidir con el número que se ve.
    if serie is not null and jsonb_array_length(serie) = 7 then serie := jsonb_set(serie, '{6}', to_jsonb(coalesce(v, 0))); end if;
    salida := salida || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'clave', k, 'emoji', split_part(etiq ->> k, '|', 1), 'etiqueta', case when k = 'adentro' then adentro_etiq else split_part(etiq ->> k, '|', 2) end,
      'valor', coalesce(v, 0), 'formato', case when k in ('cobrado', 'plata_riesgo') then 'pesos' when k = 'ocupacion' then 'porcentaje' end,
      'serie', serie)));
  end loop;

  return jsonb_build_object('numeros', salida, 'elegidos', to_jsonb(c.numeros_inicio), 'disponibles', disponibles,
                            'adentro_exacto', salida_modo <> 'no');
end $$;

revoke all on function public.numeros_inicio(uuid, uuid) from public, anon, authenticated;
grant execute on function public.numeros_inicio(uuid, uuid) to authenticated, service_role;

do $v$ begin
  if pg_get_functiondef('public.numeros_inicio(uuid, uuid)'::regprocedure) not like '%r_riesgo%' then raise exception 'BASE-1: numeros_inicio sin la pasada única'; end if;
end $v$;
