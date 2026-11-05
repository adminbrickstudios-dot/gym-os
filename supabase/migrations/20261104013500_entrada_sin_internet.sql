-- 0135 · Entrada sin internet (SEG-5).
-- La compu de la recepción que lo prende guarda una copia de quién puede
-- entrar hoy (la calcula la base con calcular_acceso: nada se reimplementa en
-- el navegador). Si se corta internet, la recepción busca en esa copia y
-- anota "entró" solo a los que la copia dice que pueden (sin internet no se
-- deja pasar a nadie más). Al volver, cada entrada anotada se registra con
-- la MISMA función de siempre, en el momento en que pasó: la base vuelve a
-- decidir. Si dice que no podía, queda como rechazada y la pantalla lo
-- muestra (nadie entra gratis en silencio). Reintentar no duplica: cada
-- entrada lleva un id de la compu.
--   copia_entrada(sede)                        mostrador: la copia (válida hasta la medianoche)
--   sincronizar_sin_internet(sede, entradas)   mostrador: registra lo anotado sin internet

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.registrar_ingreso(uuid, uuid, text, uuid, uuid, text, timestamptz)') is null then raise exception 'Guarda: falta privado.registrar_ingreso'; end if;
  if to_regprocedure('privado.calcular_acceso(uuid, timestamptz, uuid)') is null then raise exception 'Guarda: falta privado.calcular_acceso'; end if;
end $$;

-- Lo anotado sin internet: qué id le dio la compu y en qué ingreso terminó (para no duplicar y para saber cuáles fueron así).
create table if not exists public.ingresos_sin_internet (
  id              uuid primary key default gen_random_uuid(),
  gimnasio_id     uuid not null references public.gimnasios(id),
  id_local        uuid not null,
  ingreso_id      uuid not null,
  anotado_en      timestamptz not null,
  sincronizado_en timestamptz not null default now(),
  registrado_por  uuid not null,
  unique (gimnasio_id, id),
  unique (gimnasio_id, id_local),
  foreign key (gimnasio_id, ingreso_id) references public.ingresos (gimnasio_id, id),
  foreign key (gimnasio_id, registrado_por) references public.equipo (gimnasio_id, id)
);
select privado.politicas_estandar('public.ingresos_sin_internet', array['dueno', 'encargado'], null, false);
revoke all on table public.ingresos_sin_internet from anon;
revoke truncate, references, trigger on public.ingresos_sin_internet from authenticated;

create or replace function public.copia_entrada(p_sede_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare g uuid; zona text; m timestamptz := now();
begin
  select s.gimnasio_id into g from public.sedes s where s.id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], p_sede_id);
  select gi.zona_horaria into zona from public.gimnasios gi where gi.id = g;
  return jsonb_build_object(
    'generada_en', m,
    -- Los vencimientos cambian a la medianoche del gimnasio: la copia sirve hasta entonces.
    'valida_hasta', privado.medianoche(privado.dia_local(m, zona) + 1, zona),
    'socios', coalesce((select jsonb_agg(jsonb_build_object('s', s.id, 'n', trim(s.nombre || ' ' || coalesce(s.apellido, '')), 'num', s.numero, 'dni', s.dni,
                                                       'p', v.puede, 'c', v.color, 't', v.texto) order by s.nombre, s.apellido)
       from public.socios s cross join lateral privado.calcular_acceso(s.id, m, p_sede_id) v
      where s.gimnasio_id = g and s.dado_de_baja_en is null), '[]'));
end $$;

create or replace function public.sincronizar_sin_internet(p_sede_id uuid, p_entradas jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare g uuid; eid uuid; x jsonb; v_local uuid; v_socio uuid; v_m timestamptz; ya public.ingresos_sin_internet; r jsonb; i public.ingresos;
        salida jsonb := '[]'; nombre text;
begin
  select s.gimnasio_id into g from public.sedes s where s.id = p_sede_id;
  if g is null then raise exception 'Sin permiso o sede inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(g, array['dueno', 'encargado', 'recepcion'], p_sede_id);
  if jsonb_typeof(p_entradas) <> 'array' then raise exception 'Las entradas van en una lista' using errcode = '22023'; end if;
  if jsonb_array_length(p_entradas) > 500 then raise exception 'Hasta 500 entradas por vez' using errcode = '22023'; end if;
  for x in select * from jsonb_array_elements(p_entradas) loop
    begin
      v_local := (x ->> 'id_local')::uuid; v_socio := (x ->> 'socio_id')::uuid; v_m := (x ->> 'momento')::timestamptz;
    exception when others then
      raise exception 'Una entrada vino mal armada' using errcode = '22023';
    end;
    if v_local is null or v_socio is null or v_m is null then raise exception 'Una entrada vino incompleta' using errcode = '22023'; end if;
    -- Ya sincronizada (un reintento): se devuelve lo mismo.
    select * into ya from public.ingresos_sin_internet where gimnasio_id = g and id_local = v_local;
    if found then
      select * into i from public.ingresos where id = ya.ingreso_id;
      select trim(s.nombre || ' ' || coalesce(s.apellido, '')) into nombre from public.socios s where s.id = i.socio_id;
      salida := salida || jsonb_build_object('id_local', v_local, 'nombre', nombre, 'resultado', i.resultado, 'color', i.color, 'texto', i.texto, 'ya_estaba', true);
      continue;
    end if;
    if not exists (select 1 from public.socios s where s.id = v_socio and s.gimnasio_id = g) then
      raise exception 'Un socio no es de este gimnasio' using errcode = '42501';
    end if;
    if v_m > now() + interval '2 minutes' or v_m < now() - interval '3 days' then
      raise exception 'Una entrada tiene una hora imposible (%): revisá la hora de la compu.', v_m using errcode = '22023';
    end if;
    -- La misma función de siempre, en el momento en que pasó, sin "dejar pasar": la base decide.
    r := privado.registrar_ingreso(v_socio, p_sede_id, 'recepcion', eid, null, null, v_m);
    insert into public.ingresos_sin_internet (gimnasio_id, id_local, ingreso_id, anotado_en, registrado_por)
    values (g, v_local, (r ->> 'ingreso_id')::uuid, v_m, eid);
    select * into i from public.ingresos where id = (r ->> 'ingreso_id')::uuid;
    select trim(s.nombre || ' ' || coalesce(s.apellido, '')) into nombre from public.socios s where s.id = v_socio;
    salida := salida || jsonb_build_object('id_local', v_local, 'nombre', nombre, 'resultado', i.resultado, 'color', i.color, 'texto', i.texto,
                                           'ya_estaba', coalesce((r ->> 'repetido')::boolean, false));
  end loop;
  return salida;
end $$;

revoke all on function public.copia_entrada(uuid), public.sincronizar_sin_internet(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.copia_entrada(uuid), public.sincronizar_sin_internet(uuid, jsonb) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.ingresos_sin_internet'::regclass) then raise exception 'Verificación: ingresos_sin_internet sin RLS'; end if;
  if has_function_privilege('anon', 'public.sincronizar_sin_internet(uuid, jsonb)', 'execute') then raise exception 'Verificación: sincronizar quedó para anon'; end if;
end $$;
