-- 1201 · VD-12b/c/d + VD-23b · Inicio en vivo, lo cobrado para la recepción y la meta del socio.
--   numeros_inicio(gimnasio, sede)        (se reemplaza, misma firma)
--       VD-12c: la recepción ve "Cobrado hoy" solo si el dueño prendió recepcion_ve_cobrado (EQU-1, por defecto no)
--       VD-12d: los 8 números llevan su mini gráfico de 7 días (el último es hoy y coincide con el número)
--   ultimas_entradas(gimnasio, limite)    VD-12b: las últimas entradas de hoy, con el ⛔ y si corresponde cobrar
--   para_hacer_hoy(gimnasio)              VD-12b: lo que hay que hacer hoy, calculado (nada se guarda)
--   meta_visitas_panel / guardar_meta_visitas   VD-23b: la meta de visitas del mes que ve el socio (dueño)

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$ begin
  if to_regprocedure('public.numeros_inicio(uuid,uuid)') is null then raise exception 'Guarda: falta numeros_inicio (1200)'; end if;
  if to_regprocedure('public.prometieron_pagar(uuid)') is null then raise exception 'Guarda: falta prometieron_pagar'; end if;
  if to_regprocedure('public.cajas_olvidadas(uuid)') is null then raise exception 'Guarda: falta cajas_olvidadas'; end if;
  if to_regprocedure('privado.calcular_acceso(uuid,timestamptz,uuid)') is null then raise exception 'Guarda: falta calcular_acceso'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'recepcion_ve_cobrado') then
    raise exception 'Guarda: falta recepcion_ve_cobrado (EQU-1)';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'meta_visitas_mes') then
    raise exception 'Guarda: falta meta_visitas_mes (VD-23)';
  end if;
end $$;

-- ── Los números, con permiso de la recepción y mini gráfico en todos ─
create or replace function public.numeros_inicio(p_gimnasio_id uuid, p_sede_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; c public.configuracion_gimnasio; zona text; hoy date; desde timestamptz; hasta timestamptz;
  sede uuid; ve_plata boolean; hay_clases boolean; corrido interval;
  todos text[] := array['adentro','entraron','cobrado','a_cobrar','activos','altas_mes','bajas_mes','ocupacion'];
  claves text[] := '{}'; k text; v numeric; serie jsonb; salida jsonb := '[]'::jsonb; disponibles jsonb := '[]'::jsonb;
  mes timestamptz;
  etiq jsonb := jsonb_build_object(
    'adentro', '🏋️|Adentro (aprox.)', 'entraron', '🚪|Entraron hoy', 'cobrado', '💵|Cobrado hoy', 'a_cobrar', '⏰|A cobrar hoy',
    'activos', '✅|Socios activos', 'altas_mes', '🆕|Altas del mes', 'bajas_mes', '👋|Bajas del mes', 'ocupacion', '🗓️|Ocupación de clases (%)');
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  sede := coalesce(p_sede_id, e.sede_id);
  if e.sede_id is not null and sede <> e.sede_id then raise exception 'Sin permiso para esa sede' using errcode = '42501'; end if;
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = p_gimnasio_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  desde := privado.medianoche(hoy, zona);
  hasta := privado.medianoche(hoy + 1, zona);
  mes := privado.medianoche(date_trunc('month', hoy)::date, zona);
  corrido := now() - desde;
  -- La plata del día: dueño y encargado siempre; la recepción solo si el dueño lo prendió (EQU-1).
  ve_plata := e.rol in ('dueno', 'encargado') or (e.rol = 'recepcion' and c.recepcion_ve_cobrado);
  hay_clases := c.modo_clases <> 'ninguno' and not ('clases' = any (c.secciones_apagadas));

  foreach k in array todos loop
    if (k = 'cobrado' and not ve_plata) or (k = 'ocupacion' and not hay_clases) then continue; end if;
    disponibles := disponibles || jsonb_build_array(jsonb_build_object('clave', k, 'etiqueta', split_part(etiq ->> k, '|', 2), 'emoji', split_part(etiq ->> k, '|', 1)));
  end loop;

  foreach k in array c.numeros_inicio loop
    if exists (select 1 from jsonb_array_elements(disponibles) d where d ->> 'clave' = k) then claves := claves || k; end if;
  end loop;
  if cardinality(claves) = 0 then
    foreach k in array case when ve_plata then array['adentro','entraron','cobrado','a_cobrar'] else array['adentro','entraron','a_cobrar','activos'] end loop
      if exists (select 1 from jsonb_array_elements(disponibles) d where d ->> 'clave' = k) then claves := claves || k; end if;
    end loop;
  end if;

  foreach k in array claves loop
    serie := null; v := 0;
    if k = 'adentro' then
      select count(distinct i.socio_id) into v from public.ingresos i
       where i.gimnasio_id = p_gimnasio_id and i.momento >= greatest(desde, now() - interval '2 hours') and i.momento <= now()
         and i.anulado_en is null and i.resultado <> 'rechazado' and (sede is null or i.sede_id = sede);
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
      select count(*) filter (where r.lista = 'por_vencer' and r.dias = 0) into v from privado.retencion(p_gimnasio_id, now()) r;
      -- a cuántos les vencía la cobertura en cada uno de los últimos 7 días
      select jsonb_agg(coalesce(x.n, 0) order by g.dia) into serie
        from (select (hoy - s)::date as dia from generate_series(0, 6) s) g
        left join lateral (select count(distinct cb.socio_id) as n from public.coberturas cb
           where cb.gimnasio_id = p_gimnasio_id and cb.anulada_en is null
             and cb.hasta > privado.medianoche(g.dia, zona) and cb.hasta <= privado.medianoche(g.dia + 1, zona)) x on true;
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
      'clave', k, 'emoji', split_part(etiq ->> k, '|', 1), 'etiqueta', split_part(etiq ->> k, '|', 2),
      'valor', coalesce(v, 0), 'formato', case when k = 'cobrado' then 'pesos' when k = 'ocupacion' then 'porcentaje' end,
      'serie', serie)));
  end loop;

  return jsonb_build_object('numeros', salida, 'elegidos', to_jsonb(c.numeros_inicio), 'disponibles', disponibles);
end $$;

-- ── Últimas entradas de hoy (en vivo) ───────────────────────────────
-- Dueño y encargado ven todas las de su alcance; la recepción, las de su sede (si tiene una).
-- "cobrar" = entró o quiso entrar sin estar al día y ahora sigue sin estarlo (si ya pagó, no se ofrece).
create or replace function public.ultimas_entradas(p_gimnasio_id uuid, p_limite int default 8) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.equipo; zona text; desde timestamptz; lim int;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  desde := privado.medianoche(privado.dia_local(now(), zona), zona);
  lim := least(greatest(coalesce(p_limite, 8), 1), 20);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'ingreso_id', x.id, 'socio_id', x.socio_id, 'socio', x.socio, 'momento', x.momento, 'via', x.via_acceso,
             'resultado', x.resultado, 'color', x.color, 'texto', x.texto,
             'cobrar', (x.resultado in ('rechazado', 'forzado') or x.color in ('rojo', 'naranja'))
                       and not coalesce((x.v).puede and (x.v).color = 'verde', false)) order by x.momento desc)
      from (
        select i.id, i.socio_id, trim(s.nombre || ' ' || s.apellido) as socio, i.momento, i.via_acceso, i.resultado, i.color, i.texto,
               privado.calcular_acceso(i.socio_id, now(), null) as v
          from public.ingresos i
          join public.socios s on s.id = i.socio_id
         where i.gimnasio_id = p_gimnasio_id and i.momento >= desde and i.anulado_en is null
           and (e.sede_id is null or i.sede_id = e.sede_id)
         order by i.momento desc
         limit lim
      ) x), '[]'::jsonb);
end $$;

-- ── Para hacer hoy: calculado, no guardado ──────────────────────────
-- [{ clave, emoji, texto, cantidad, href }]; el href es relativo al panel y la pantalla
-- lo oculta si esa sección está apagada o el rol no la ve. Solo entra lo que hay para hacer (cantidad > 0).
create or replace function public.para_hacer_hoy(p_gimnasio_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  e public.equipo; c public.configuracion_gimnasio; sede uuid; salida jsonb := '[]'::jsonb;
  vencen int; prometieron int; aprobar int; cajas int; ausentes int;
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  sede := e.sede_id;
  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;

  select count(*) filter (where r.lista = 'por_vencer' and r.dias = 0),
         count(*) filter (where r.lista = 'no_viene')
    into vencen, ausentes from privado.retencion(p_gimnasio_id, now()) r;
  prometieron := jsonb_array_length(public.prometieron_pagar(p_gimnasio_id));
  select count(*) into aprobar from public.pagos p join public.ventas v on v.id = p.venta_id
   where p.gimnasio_id = p_gimnasio_id and p.estado = 'pendiente' and p.medio = 'transferencia'
     and p.comprobante_path is not null and (sede is null or v.sede_id = sede);
  cajas := jsonb_array_length(public.cajas_olvidadas(p_gimnasio_id));

  if vencen > 0 then
    salida := salida || jsonb_build_array(jsonb_build_object('clave', 'vencen_hoy', 'emoji', '⏰', 'cantidad', vencen, 'href', '/vencen-hoy',
      'texto', 'Cobrarle a ' || vencen || case when vencen = 1 then ' que vence hoy' else ' que vencen hoy' end));
  end if;
  if prometieron > 0 then
    salida := salida || jsonb_build_array(jsonb_build_object('clave', 'prometieron', 'emoji', '🤝', 'cantidad', prometieron, 'href', '/vencen-hoy',
      'texto', prometieron || case when prometieron = 1 then ' prometió pagar' else ' prometieron pagar' end));
  end if;
  if aprobar > 0 then
    salida := salida || jsonb_build_array(jsonb_build_object('clave', 'transferencias', 'emoji', '🧾', 'cantidad', aprobar, 'href', '/transferencias',
      'texto', 'Aprobar ' || aprobar || case when aprobar = 1 then ' transferencia' else ' transferencias' end));
  end if;
  if cajas > 0 then
    salida := salida || jsonb_build_array(jsonb_build_object('clave', 'caja_abierta', 'emoji', '💵', 'cantidad', cajas, 'href', '/caja',
      'texto', case when cajas = 1 then 'Cerrar la caja que quedó abierta' else 'Cerrar las ' || cajas || ' cajas que quedaron abiertas' end));
  end if;
  if ausentes > 0 and e.rol in ('dueno', 'encargado') then
    salida := salida || jsonb_build_array(jsonb_build_object('clave', 'no_vienen', 'emoji', '👋', 'cantidad', ausentes, 'href', '/retencion',
      'texto', ausentes || case when ausentes = 1 then ' no viene' else ' no vienen' end || ' hace ' || c.retencion_dias_ausencia || ' días o más'));
  end if;
  return salida;
end $$;

-- ── La meta de visitas del mes (la que ve el socio en su Inicio) ────
create or replace function public.meta_visitas_panel(p_gimnasio_id uuid) returns int
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return (select meta_visitas_mes from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id);
end $$;

create or replace function public.guardar_meta_visitas(p_gimnasio_id uuid, p_meta int) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_meta is null or p_meta not between 1 and 31 then raise exception 'La meta es un número de visitas entre 1 y 31.' using errcode = '22023'; end if;
  update public.configuracion_gimnasio set meta_visitas_mes = p_meta, actualizado_en = now() where gimnasio_id = p_gimnasio_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo guardar: el gimnasio no tiene configuración'; end if;
end $$;

revoke all on function public.numeros_inicio(uuid, uuid), public.ultimas_entradas(uuid, int), public.para_hacer_hoy(uuid),
  public.meta_visitas_panel(uuid), public.guardar_meta_visitas(uuid, int) from public, anon, authenticated;
grant execute on function public.numeros_inicio(uuid, uuid), public.ultimas_entradas(uuid, int), public.para_hacer_hoy(uuid),
  public.meta_visitas_panel(uuid), public.guardar_meta_visitas(uuid, int) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.numeros_inicio(uuid, uuid)', 'public.ultimas_entradas(uuid, int)', 'public.para_hacer_hoy(uuid)',
                           'public.meta_visitas_panel(uuid)', 'public.guardar_meta_visitas(uuid, int)'] loop
    if to_regprocedure(f) is null then raise exception 'Verificación: falta %', f; end if;
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'configuracion_gimnasio' and column_name = 'recepcion_ve_cobrado') is distinct from 'false' then
    raise exception 'Verificación: recepcion_ve_cobrado tiene que venir apagado';
  end if;
end $$;
