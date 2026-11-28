-- Pase 2.0 · organización, Parte 5 (26/11 · socios.png y ficha-socio.png): las columnas "Última vez" y "Este mes" de Socios y "Su historia" de la ficha.
-- EXPANDIR: dos lecturas nuevas (calculadas, nada guardado), con la llave exigida y en el lote de lecturas.
--   numeros_fila_socio(socio)       última vez y veces este mes de UN socio: el lote la llama una vez por fila de buscar_socios (mismo viaje)
--   historia_socio(gimnasio, socio) la línea de tiempo: pagos, entradas, avisos, reservas y congelamientos (los últimos 30)

do $g$ begin
  if to_regprocedure('privado.exigir_organizacion(uuid, text[])') is null then raise exception 'Guarda: falta 20261126100000 (exigir_organizacion)'; end if;
  if to_regprocedure('privado.entradas_socio(uuid, timestamptz, timestamptz)') is null then raise exception 'Guarda: falta privado.entradas_socio'; end if;
end $g$;

create or replace function public.numeros_fila_socio(p_socio_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare gid uuid; zona text; ini_mes timestamptz;
begin
  select s.gimnasio_id, g.zona_horaria into gid, zona from public.socios s join public.gimnasios g on g.id = s.gimnasio_id where s.id = p_socio_id;
  if gid is null then raise exception 'No existe ese socio' using errcode = 'P0002'; end if;
  perform privado.exigir_organizacion(gid);
  ini_mes := privado.medianoche(date_trunc('month', now() at time zone zona)::date, zona);
  return jsonb_build_object(
    'ultima_vez', (select max(m) from privado.entradas_socio(p_socio_id, now() - interval '2 years', now()) m),
    'veces_mes', (select count(distinct (m at time zone zona)::date) from privado.entradas_socio(p_socio_id, ini_mes, now()) m));
end $$;

create or replace function public.historia_socio(p_gimnasio_id uuid, p_socio_id uuid, p_limite int default 30)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare filas jsonb;
begin
  perform privado.exigir_organizacion(p_gimnasio_id);
  if not exists (select 1 from public.socios s where s.id = p_socio_id and s.gimnasio_id = p_gimnasio_id) then
    raise exception 'Ese socio no es de este gimnasio' using errcode = '42501';
  end if;
  with todo as (
    select 'pago' tipo, coalesce(p.aprobado_en, p.creado_en) en, 'Pagó ' || p.medio detalle, p.monto monto
      from public.pagos p join public.ventas v on v.id = p.venta_id
     where v.socio_id = p_socio_id and p.estado = 'aprobado' and v.estado <> 'anulada'
    union all
    select 'entrada', i.momento, case i.resultado when 'rechazado' then 'No pudo entrar' when 'forzado' then 'Lo dejaron pasar' else 'Entró' end, null
      from public.ingresos i where i.socio_id = p_socio_id and i.anulado_en is null
    union all
    select 'aviso', a.creado_en, 'Se le avisó (' || replace(a.clave, '_', ' ') || ')', null from public.avisos_enviados a where a.socio_id = p_socio_id
    union all
    select 'reserva', c.inicio, case r.estado when 'cancelada' then 'Canceló una clase' when 'espera' then 'En espera de una clase' else 'Reservó una clase' end, null
      from public.reservas r join public.clases c on c.id = r.clase_id where r.socio_id = p_socio_id
    union all
    select 'congelamiento', k.desde, 'Congeló hasta el ' || to_char(coalesce(k.hasta_real, k.hasta_prevista), 'DD/MM'), null
      from public.congelamientos k where k.socio_id = p_socio_id and k.anulado_en is null
  )
  select coalesce(jsonb_agg(jsonb_build_object('tipo', t.tipo, 'en', t.en, 'detalle', t.detalle, 'monto', t.monto) order by t.en desc), '[]'::jsonb)
    into filas from (select * from todo where en <= now() order by en desc limit least(greatest(coalesce(p_limite, 30), 1), 100)) t;
  return filas;
end $$;

revoke all on function public.numeros_fila_socio(uuid), public.historia_socio(uuid, uuid, int) from public, anon;
grant execute on function public.numeros_fila_socio(uuid), public.historia_socio(uuid, uuid, int) to authenticated, service_role;

do $lote$
declare def text;
begin
  def := pg_get_functiondef('public.lote_lecturas(jsonb)'::regprocedure);
  if position('''numeros_fila_socio''' in def) = 0 then
    if position('''funciones_nuevas_activas'']' in def) = 0 then raise exception 'Guarda: la lista de lote_lecturas no termina como se esperaba (falta 20261126100000)'; end if;
    def := replace(def, '''funciones_nuevas_activas'']', '''funciones_nuevas_activas'',''numeros_fila_socio'',''historia_socio'']');
    execute def;
  end if;
end $lote$;

do $v$
declare f text;
begin
  foreach f in array array['public.numeros_fila_socio(uuid)', 'public.historia_socio(uuid, uuid, integer)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
    if not has_function_privilege('authenticated', f, 'execute') then raise exception 'Verificación: authenticated no puede ejecutar %', f; end if;
  end loop;
  if position('''historia_socio''' in pg_get_functiondef('public.lote_lecturas(jsonb)'::regprocedure)) = 0 then raise exception 'Verificación: faltan las lecturas nuevas en lote_lecturas'; end if;
end $v$;
