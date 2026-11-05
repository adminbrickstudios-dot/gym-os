-- 0126 · Documentos para firmar (COM-6).
-- El gimnasio carga sus textos (reglamento, deslinde de responsabilidad,
-- autorización del responsable para menores), cada uno con versión: editar
-- un texto publica una versión nueva y la anterior queda para lo ya firmado.
-- El socio firma con su nombre y un tilde, en la app o en recepción; se
-- guarda qué versión, cuándo, cómo y quién lo registró. En la Entrada,
-- "falta firmar" es un aviso: NO cambia quién entra (como el apto, 0044).
-- Nunca datos de salud: la firma guarda nombre, fecha y versión, nada más.
--   documentos_panel(gimnasio)                        dueño y encargado
--   guardar_documento(gimnasio, clave, titulo, texto)  dueño: versión nueva
--   archivar_documento(gimnasio, clave)                dueño: deja de pedirse
--   documentos_socio(socio)                            equipo o el socio: pendientes y firmados
--   firmar_documento(documento, socio, nombre)         recepción o el socio

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.es_menor(date, date)') is null then raise exception 'Guarda: falta privado.es_menor'; end if;
  if to_regprocedure('public.apto_socio(uuid)') is null then raise exception 'Guarda: falta la migración 0044'; end if;
end $$;

create table if not exists public.documentos (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  clave        text not null check (clave in ('reglamento', 'deslinde', 'menores')),
  version      int not null check (version >= 1),
  titulo       text not null check (length(trim(titulo)) between 3 and 80),
  texto        text not null check (length(trim(texto)) between 20 and 8000),
  activo       boolean not null default true,
  creado_por   uuid not null,
  creado_en    timestamptz not null default now(),
  unique (gimnasio_id, id),
  unique (gimnasio_id, clave, version),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id)
);
create unique index if not exists documentos_vigente on public.documentos (gimnasio_id, clave) where activo;
select privado.politicas_estandar('public.documentos', array['dueno', 'encargado', 'recepcion'], null, false);
revoke all on table public.documentos from anon;
revoke truncate, references, trigger on public.documentos from authenticated;

create table if not exists public.firmas_documento (
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
create index if not exists firmas_por_socio on public.firmas_documento (socio_id);
select privado.politicas_estandar('public.firmas_documento', array['dueno', 'encargado', 'recepcion'], null, true);
revoke all on table public.firmas_documento from anon;
revoke truncate, references, trigger on public.firmas_documento from authenticated;

create or replace function public.documentos_panel(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado']);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'documento_id', d.id, 'clave', d.clave, 'version', d.version, 'titulo', d.titulo, 'texto', d.texto, 'creado_en', d.creado_en,
      'firmas', (select count(*) from public.firmas_documento f where f.documento_id = d.id)) order by array_position(array['reglamento', 'deslinde', 'menores'], d.clave))
    from public.documentos d where d.gimnasio_id = p_gimnasio_id and d.activo), '[]');
end $$;

create or replace function public.guardar_documento(p_gimnasio_id uuid, p_clave text, p_titulo text, p_texto text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.equipo; actual public.documentos; v_id uuid; t text := trim(coalesce(p_texto, '')); ti text := trim(coalesce(p_titulo, ''));
begin
  e := privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  if p_clave is null or p_clave not in ('reglamento', 'deslinde', 'menores') then raise exception 'Documento desconocido' using errcode = '22023'; end if;
  if length(ti) < 3 or length(ti) > 80 then raise exception 'El título tiene que tener entre 3 y 80 letras.' using errcode = '22023'; end if;
  if length(t) < 20 then raise exception 'El texto es muy corto: escribí lo que el socio tiene que aceptar.' using errcode = '22023'; end if;
  if length(t) > 8000 then raise exception 'El texto puede tener hasta 8.000 letras.' using errcode = '22023'; end if;
  select * into actual from public.documentos where gimnasio_id = p_gimnasio_id and clave = p_clave and activo for update;
  if found and actual.texto = t and actual.titulo = ti then return actual.id; end if;   -- nada cambió: misma versión
  update public.documentos set activo = false where gimnasio_id = p_gimnasio_id and clave = p_clave and activo;
  insert into public.documentos (gimnasio_id, clave, version, titulo, texto, creado_por)
  values (p_gimnasio_id, p_clave,
          coalesce((select max(d.version) from public.documentos d where d.gimnasio_id = p_gimnasio_id and d.clave = p_clave), 0) + 1,
          ti, t, e.id)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.archivar_documento(p_gimnasio_id uuid, p_clave text) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno']);
  update public.documentos set activo = false where gimnasio_id = p_gimnasio_id and clave = p_clave and activo;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Ese documento no está publicado' using errcode = '22023'; end if;
end $$;

-- Qué le toca firmar a un socio: los vigentes que no firmó en esa versión
-- (el de menores, solo si es menor). Lo ve el equipo del gimnasio o el socio.
create or replace function privado.documentos_de(p_socio public.socios) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'pendientes', coalesce((select jsonb_agg(jsonb_build_object('documento_id', d.id, 'clave', d.clave, 'titulo', d.titulo, 'texto', d.texto, 'version', d.version)
                              order by array_position(array['reglamento', 'deslinde', 'menores'], d.clave))
       from public.documentos d
      where d.gimnasio_id = p_socio.gimnasio_id and d.activo
        and (d.clave <> 'menores' or privado.es_menor(p_socio.fecha_nacimiento, (now() at time zone (select g.zona_horaria from public.gimnasios g where g.id = p_socio.gimnasio_id))::date))
        and not exists (select 1 from public.firmas_documento f where f.documento_id = d.id and f.socio_id = p_socio.id)), '[]'),
    'firmados', coalesce((select jsonb_agg(jsonb_build_object('titulo', d.titulo, 'version', d.version, 'nombre', f.nombre, 'via', f.via, 'firmado_en', f.firmado_en,
                                                              'vigente', d.activo) order by f.firmado_en desc)
       from public.firmas_documento f join public.documentos d on d.id = f.documento_id where f.socio_id = p_socio.id), '[]'))
$$;
revoke all on function privado.documentos_de(public.socios) from public, anon, authenticated;

create or replace function public.documentos_socio(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios;
begin
  select * into s from public.socios where id = p_socio_id;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  if not (p_socio_id in (select privado.mis_socios())) then
    perform privado.exigir_equipo(s.gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  end if;
  return privado.documentos_de(s);
end $$;

create or replace function public.firmar_documento(p_documento_id uuid, p_socio_id uuid, p_nombre text) returns void
language plpgsql security definer set search_path = '' as $$
declare d public.documentos; s public.socios; e public.equipo; v_via text := 'app'; v_nombre text := trim(coalesce(p_nombre, ''));
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
  insert into public.firmas_documento (gimnasio_id, documento_id, socio_id, nombre, via, registrado_por)
  values (s.gimnasio_id, d.id, s.id, v_nombre, v_via, e.id)
  on conflict (gimnasio_id, documento_id, socio_id) do nothing;
end $$;

revoke all on function public.documentos_panel(uuid), public.guardar_documento(uuid, text, text, text), public.archivar_documento(uuid, text),
  public.documentos_socio(uuid), public.firmar_documento(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.documentos_panel(uuid), public.guardar_documento(uuid, text, text, text), public.archivar_documento(uuid, text),
  public.documentos_socio(uuid), public.firmar_documento(uuid, uuid, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.documentos'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.firmas_documento'::regclass) then
    raise exception 'Verificación: tablas sin RLS';
  end if;
  if has_function_privilege('anon', 'public.firmar_documento(uuid, uuid, text)', 'execute') then raise exception 'Verificación: firmar quedó para anon'; end if;
end $$;
