-- VD-46R · Al cumplir 18: el socio firma por sí mismo y aparece la tarea (casi nadie piensa 6, docs/v2/14).
--
-- Lo que un menor firmó (reglamento, deslinde) lo firmó un adulto en su nombre. Al cumplir 18 esa firma
-- ya no alcanza: tiene que firmar él. No se guarda "cumplió 18" ni un estado: se calcula con la fecha de
-- nacimiento y la fecha de cada firma (una firma anterior a su cumpleaños 18 fue "como menor").
--
--   firmas_propias_documento     la firma que hace él después de los 18 (la anterior queda de constancia)
--   privado.documentos_de        ahora también pide, a quien cumplió 18, volver a firmar lo que firmó de menor
--                                (copia de 12600 + la regla; el pendiente trae motivo = 'cumplio_18')
--   firmar_documento             copia de 12600: si es la firma propia, la guarda en su tabla
--   firmas_propias_pendientes    quiénes cumplieron 18 y todavía no firmaron ellos (dueño, encargado, recepción)
--   Para hacer hoy               una automática más, "mayores_de_edad" (catálogo de 5000): como hizo 7202, se parchan las
--                                funciones vigentes con guarda, sin reescribirlas
-- Sin cron: la tarea aparece sola porque se calcula al abrir Para hacer hoy. Se apaga/asigna como las demás (tareas_auto).
-- No se cambia la categoría ni el precio del plan al cumplir 18: hoy los planes no tienen edad (ver el reporte).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.documentos_de(public.socios)') is null then raise exception 'Guarda: falta privado.documentos_de (COM-6)'; end if;
  if to_regprocedure('public.firmar_documento(uuid, uuid, text)') is null then raise exception 'Guarda: falta firmar_documento (COM-6)'; end if;
  if to_regprocedure('privado.es_menor(date, date)') is null then raise exception 'Guarda: falta privado.es_menor'; end if;
  if to_regprocedure('privado.para_hacer_hoy_con(uuid, jsonb)') is null then raise exception 'Guarda: falta privado.para_hacer_hoy_con (VD-30)'; end if;
  if to_regprocedure('privado.catalogo_tareas_auto()') is null then raise exception 'Guarda: falta privado.catalogo_tareas_auto'; end if;
  if to_regprocedure('privado.medianoche(date, text)') is null then raise exception 'Guarda: falta privado.medianoche'; end if;
end $$;

-- ── La firma propia ─────────────────────────────────────────────────
create table if not exists public.firmas_propias_documento (
  id              uuid primary key default gen_random_uuid(),
  gimnasio_id     uuid not null references public.gimnasios(id),
  documento_id    uuid not null,
  socio_id        uuid not null,
  nombre          text not null check (length(trim(nombre)) between 3 and 120),
  via             text not null check (via in ('app', 'recepcion')),
  registrado_por  uuid,
  firmado_en      timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, documento_id, socio_id),
  foreign key (gimnasio_id, documento_id) references public.documentos (gimnasio_id, id),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, registrado_por) references public.equipo (gimnasio_id, id)
);
create index if not exists firmas_propias_por_socio on public.firmas_propias_documento (socio_id);
select privado.politicas_estandar('public.firmas_propias_documento', array['dueno', 'encargado', 'recepcion'], null, true);
revoke all on table public.firmas_propias_documento from anon;
revoke truncate, references, trigger on public.firmas_propias_documento from authenticated;

-- El momento en que cumplió 18 (medianoche local de su cumpleaños), o null si no hay fecha de nacimiento.
create or replace function privado.cumplio_18_en(p_nacimiento date, p_zona text) returns timestamptz
language sql stable set search_path = '' as $$
  select case when p_nacimiento is null then null else privado.medianoche((p_nacimiento + interval '18 years')::date, p_zona) end
$$;
revoke all on function privado.cumplio_18_en(date, text) from public, anon, authenticated;

-- ¿Le falta la firma propia de ese documento? (firmó de menor, ya es mayor, y no firmó él)
create or replace function privado.debe_firma_propia(p_gimnasio_id uuid, p_socio_id uuid, p_documento_id uuid, p_mayoria timestamptz) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_mayoria is not null and p_mayoria <= now()
     and exists (select 1 from public.firmas_documento f where f.gimnasio_id = p_gimnasio_id and f.documento_id = p_documento_id and f.socio_id = p_socio_id and f.firmado_en < p_mayoria)
     and not exists (select 1 from public.firmas_propias_documento fp where fp.gimnasio_id = p_gimnasio_id and fp.documento_id = p_documento_id and fp.socio_id = p_socio_id)
$$;
revoke all on function privado.debe_firma_propia(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;

-- ── Qué le toca firmar (copia de 12600 + la firma propia) ───────────
create or replace function privado.documentos_de(p_socio public.socios) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; menor boolean; mayoria timestamptz;
begin
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_socio.gimnasio_id;
  hoy := (now() at time zone zona)::date;
  menor := privado.es_menor(p_socio.fecha_nacimiento, hoy);
  mayoria := case when menor then null else privado.cumplio_18_en(p_socio.fecha_nacimiento, zona) end;
  return jsonb_build_object(
    'pendientes', coalesce((select jsonb_agg(jsonb_build_object('documento_id', d.id, 'clave', d.clave, 'titulo', d.titulo, 'texto', d.texto, 'version', d.version,
                                                                'motivo', case when exists (select 1 from public.firmas_documento f where f.documento_id = d.id and f.socio_id = p_socio.id) then 'cumplio_18' end)
                              order by array_position(array['reglamento', 'deslinde', 'menores'], d.clave))
       from public.documentos d
      where d.gimnasio_id = p_socio.gimnasio_id and d.activo
        and (d.clave <> 'menores' or menor)
        and (not exists (select 1 from public.firmas_documento f where f.documento_id = d.id and f.socio_id = p_socio.id)
             or (d.clave <> 'menores' and privado.debe_firma_propia(p_socio.gimnasio_id, p_socio.id, d.id, mayoria)))), '[]'),
    'firmados', coalesce((select jsonb_agg(x.fila order by x.cuando desc) from (
        select f.firmado_en as cuando,
               jsonb_build_object('titulo', d.titulo, 'version', d.version, 'nombre', f.nombre, 'via', f.via, 'firmado_en', f.firmado_en, 'vigente', d.activo,
                                  'propia', false, 'como_menor', mayoria is not null and f.firmado_en < mayoria) as fila
          from public.firmas_documento f join public.documentos d on d.id = f.documento_id where f.socio_id = p_socio.id
        union all
        select fp.firmado_en,
               jsonb_build_object('titulo', d.titulo, 'version', d.version, 'nombre', fp.nombre, 'via', fp.via, 'firmado_en', fp.firmado_en, 'vigente', d.activo,
                                  'propia', true, 'como_menor', false)
          from public.firmas_propias_documento fp join public.documentos d on d.id = fp.documento_id where fp.socio_id = p_socio.id) x), '[]'));
end $$;
revoke all on function privado.documentos_de(public.socios) from public, anon, authenticated;

-- ── Firmar (copia de 12600 + la firma propia) ───────────────────────
create or replace function public.firmar_documento(p_documento_id uuid, p_socio_id uuid, p_nombre text) returns void
language plpgsql security definer set search_path = '' as $$
declare d public.documentos; s public.socios; e public.equipo; v_via text := 'app'; v_nombre text := trim(coalesce(p_nombre, '')); zona text; mayoria timestamptz;
begin
  select * into s from public.socios where id = p_socio_id;
  select * into d from public.documentos where id = p_documento_id;
  if s.id is null or d.id is null or d.gimnasio_id <> s.gimnasio_id then raise exception 'Sin permiso o documento inexistente' using errcode = '42501'; end if;
  if not (p_socio_id in (select privado.mis_socios())) then
    e := privado.exigir_equipo(s.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
    v_via := 'recepcion';
  end if;
  if not d.activo then raise exception 'Ese texto cambió: firmá la versión nueva.' using errcode = '22023'; end if;
  if length(v_nombre) < 3 then raise exception 'Escribí el nombre y apellido de quien firma.' using errcode = '22023'; end if;
  -- Cumplió 18 y lo firmó un adulto en su nombre: ahora firma él (la anterior queda de constancia).
  select g.zona_horaria into zona from public.gimnasios g where g.id = s.gimnasio_id;
  mayoria := case when privado.es_menor(s.fecha_nacimiento, (now() at time zone zona)::date) then null else privado.cumplio_18_en(s.fecha_nacimiento, zona) end;
  if d.clave <> 'menores' and privado.debe_firma_propia(s.gimnasio_id, s.id, d.id, mayoria) then
    insert into public.firmas_propias_documento (gimnasio_id, documento_id, socio_id, nombre, via, registrado_por)
    values (s.gimnasio_id, d.id, s.id, v_nombre, v_via, e.id)
    on conflict (gimnasio_id, documento_id, socio_id) do nothing;
    return;
  end if;
  insert into public.firmas_documento (gimnasio_id, documento_id, socio_id, nombre, via, registrado_por)
  values (s.gimnasio_id, d.id, s.id, v_nombre, v_via, e.id)
  on conflict (gimnasio_id, documento_id, socio_id) do nothing;
end $$;
revoke all on function public.firmar_documento(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.firmar_documento(uuid, uuid, text) to authenticated, service_role;

-- ── Quiénes cumplieron 18 y no firmaron ellos ───────────────────────
create or replace function privado.firmas_propias_pendientes(p_gimnasio_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('socio_id', x.id, 'nombre', x.nombre, 'cumplio_18', x.cumple, 'documentos', x.n) order by x.cumple desc, x.nombre), '[]'::jsonb)
    from (select s.id, trim(s.nombre || ' ' || s.apellido) as nombre, (s.fecha_nacimiento + interval '18 years')::date as cumple, count(d.id)::int as n
            from public.socios s
            join public.gimnasios g on g.id = s.gimnasio_id
            join public.documentos d on d.gimnasio_id = s.gimnasio_id and d.activo and d.clave <> 'menores'
           where s.gimnasio_id = p_gimnasio_id and s.dado_de_baja_en is null and s.fecha_nacimiento is not null
             and privado.debe_firma_propia(s.gimnasio_id, s.id, d.id, privado.cumplio_18_en(s.fecha_nacimiento, g.zona_horaria))
           group by s.id, s.nombre, s.apellido, s.fecha_nacimiento) x
$$;
revoke all on function privado.firmas_propias_pendientes(uuid) from public, anon, authenticated;

create or replace function public.firmas_propias_pendientes(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  return privado.firmas_propias_pendientes(p_gimnasio_id);
end $$;
revoke all on function public.firmas_propias_pendientes(uuid) from public, anon, authenticated;
grant execute on function public.firmas_propias_pendientes(uuid) to authenticated, service_role;

-- ── Para hacer hoy: la automática "mayores_de_edad" ─────────────────
-- Se parchan las funciones vigentes (otros ítems también las tocan): solo se suma una entrada al catálogo y una rama.
do $$
declare d text; f regprocedure;
  ancla_catalogo constant text := $a$jsonb_build_object('clave', 'clases_espera',$a$;
  entrada constant text := $e$jsonb_build_object('clave', 'mayores_de_edad', 'emoji', '🎓', 'titulo', 'Cumplieron 18: tienen que firmar ellos', 'roles', jsonb_build_array('encargado', 'recepcion'), 'gestion', false, 'dias', null, 'href', ''),
    $e$;
  ancla_rama constant text := $a$    elsif v_clave = 'clases_espera' then$a$;
  rama constant text := $r$    elsif v_clave = 'mayores_de_edad' then
      select count(*), jsonb_agg(jsonb_build_object('socio_id', x ->> 'socio_id', 'nombre', x ->> 'nombre')) into cant, socios
        from jsonb_array_elements(privado.firmas_propias_pendientes(p_gimnasio_id)) x;
      texto := cant || case when cant = 1 then ' cumplió 18: tiene que firmar él mismo' else ' cumplieron 18: tienen que firmar ellos mismos' end;
$r$;
begin
  f := 'privado.catalogo_tareas_auto()'::regprocedure;
  d := pg_get_functiondef(f);
  if position('mayores_de_edad' in d) = 0 then
    if position(ancla_catalogo in d) = 0 then raise exception 'Guarda: el catálogo de tareas automáticas cambió: no encuentro clases_espera'; end if;
    execute replace(d, ancla_catalogo, entrada || ancla_catalogo);
  end if;
  f := 'privado.para_hacer_hoy_con(uuid, jsonb)'::regprocedure;
  d := pg_get_functiondef(f);
  if position('mayores_de_edad' in d) = 0 then
    if position(ancla_rama in d) = 0 then raise exception 'Guarda: para_hacer_hoy_con cambió: no encuentro la rama de clases_espera'; end if;
    execute replace(d, ancla_rama, rama || ancla_rama);
  end if;
end $$;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.firmas_propias_pendientes(uuid)', 'privado.firmas_propias_pendientes(uuid)', 'privado.debe_firma_propia(uuid, uuid, uuid, timestamptz)',
                           'privado.cumplio_18_en(date, text)', 'privado.documentos_de(public.socios)', 'public.firmar_documento(uuid, uuid, text)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
  if not (select relrowsecurity from pg_class where oid = 'public.firmas_propias_documento'::regclass) then raise exception 'Verificación: firmas_propias_documento sin RLS'; end if;
  if position('mayores_de_edad' in pg_get_functiondef('privado.para_hacer_hoy_con(uuid, jsonb)'::regprocedure)) = 0
     or not (privado.catalogo_tareas_auto() @> '[{"clave": "mayores_de_edad"}]'::jsonb) then
    raise exception 'Verificación: la automática mayores_de_edad no quedó enganchada';
  end if;
  if privado.cumplio_18_en('2000-03-10', 'UTC') <> '2018-03-10 00:00:00+00'::timestamptz then raise exception 'Verificación: cumplio_18_en'; end if;
end $$;
