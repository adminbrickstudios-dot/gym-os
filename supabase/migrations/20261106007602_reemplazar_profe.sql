-- VD-46K · Reemplazar al profe en UNA sola clase, con motivo (docs/v2/14-SITUACIONES.md, caso 50).
-- "Falta el profe": el dueño o el encargado pone a otro en esa clase puntual. La grilla no se toca:
-- cambia clases.profe_id de esa fecha y nada más. El permiso del profe sale de clases.profe_id
-- (lista_clase, tomar_asistencia, anular_asistencia), así que el anterior deja de poder marcar
-- presentes ahí y el nuevo empieza a poder, sin tocar esas funciones.
--
--   reemplazos_profe   cada reemplazo, escrito y sin borrarse: quién, cuándo, de quién a quién y por qué
--   reemplazar_profe(clase, profe, motivo) · reemplazos_clase(clase)
--
-- Permisos: solo dueño y encargado (es un tema de liquidación del profe). No se tocan vender,
-- registrar_ingreso ni las funciones de asistencia. Ojo: editar un horario de la grilla reescribe el profe
-- de las clases futuras (editar_horario): un reemplazo puntual puede perderse si se edita ese horario.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.exigir_rol(uuid, text[], uuid)') is null then raise exception 'Guarda: falta privado.exigir_rol'; end if;
  if to_regclass('public.clases') is null or to_regclass('public.equipo') is null then raise exception 'Guarda: faltan clases o equipo'; end if;
end $$;

create table if not exists public.reemplazos_profe (
  id                 uuid primary key default gen_random_uuid(),
  gimnasio_id        uuid not null references public.gimnasios(id),
  clase_id           uuid not null,
  profe_anterior_id  uuid,
  profe_nuevo_id     uuid not null,
  motivo             text not null check (length(trim(motivo)) between 3 and 300),
  hecho_por          uuid not null,
  creado_en          timestamptz not null default now(),
  unique (gimnasio_id, id),
  foreign key (gimnasio_id, clase_id) references public.clases (gimnasio_id, id),
  foreign key (gimnasio_id, profe_anterior_id) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, profe_nuevo_id) references public.equipo (gimnasio_id, id),
  foreign key (gimnasio_id, hecho_por) references public.equipo (gimnasio_id, id),
  check (profe_anterior_id is distinct from profe_nuevo_id)
);
create index if not exists reemplazos_profe_clase on public.reemplazos_profe (gimnasio_id, clase_id, creado_en);
alter table public.reemplazos_profe enable row level security;

-- Un reemplazo, una vez hecho, queda escrito: no se cambia ni se borra (otro reemplazo lo reemplaza).
create or replace function privado.reemplazo_profe_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Los reemplazos de profe quedan escritos: si hay que cambiar de nuevo, se hace otro reemplazo' using errcode = 'check_violation';
end $$;
revoke all on function privado.reemplazo_profe_inmutable() from public;
drop trigger if exists reemplazo_profe_inmutable on public.reemplazos_profe;
create trigger reemplazo_profe_inmutable before update or delete on public.reemplazos_profe
  for each row execute function privado.reemplazo_profe_inmutable();

drop policy if exists reemplazos_profe_lee on public.reemplazos_profe;
create policy reemplazos_profe_lee on public.reemplazos_profe for select to authenticated
  using (exists (select 1 from public.equipo e where e.gimnasio_id = reemplazos_profe.gimnasio_id and e.usuario_id = auth.uid() and e.activo and e.rol in ('dueno', 'encargado')));
revoke all on table public.reemplazos_profe from anon, authenticated;
grant select on table public.reemplazos_profe to authenticated;

-- ── Reemplazar ──────────────────────────────────────────────────────
create or replace function public.reemplazar_profe(p_clase_id uuid, p_profe_id uuid, p_motivo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.clases; eid uuid; nuevo public.equipo; m text := trim(coalesce(p_motivo, '')); n int; anterior uuid;
begin
  select * into c from public.clases where id = p_clase_id for update;
  if not found then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  eid := privado.exigir_rol(c.gimnasio_id, array['dueno', 'encargado'], c.sede_id);
  if c.cancelada_en is not null then raise exception 'La clase está cancelada: no hay a quién reemplazar' using errcode = '22023'; end if;
  if now() >= c.fin then raise exception 'La clase ya terminó: no se puede cambiar el profe' using errcode = '22023'; end if;
  if length(m) < 3 then raise exception 'Escribí el motivo del reemplazo (por ejemplo: está enfermo)' using errcode = '22023'; end if;
  if length(m) > 300 then raise exception 'El motivo es muy largo: hasta 300 letras' using errcode = '22023'; end if;
  select * into nuevo from public.equipo where id = p_profe_id and gimnasio_id = c.gimnasio_id;
  if not found or not nuevo.activo then raise exception 'Ese profe no existe o no está activo' using errcode = '22023'; end if;
  if nuevo.rol <> 'profe' then raise exception 'El reemplazo tiene que ser alguien con rol de profe' using errcode = '22023'; end if;
  if nuevo.sede_id is not null and nuevo.sede_id <> c.sede_id then raise exception 'Ese profe es de otra sede' using errcode = '22023'; end if;
  if c.profe_id is not distinct from nuevo.id then raise exception 'Ese profe ya da esta clase' using errcode = '22023'; end if;
  anterior := c.profe_id;
  update public.clases set profe_id = nuevo.id where id = c.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudo cambiar el profe de la clase'; end if;
  insert into public.reemplazos_profe (gimnasio_id, clase_id, profe_anterior_id, profe_nuevo_id, motivo, hecho_por)
  values (c.gimnasio_id, c.id, anterior, nuevo.id, m, eid);
  return jsonb_build_object('clase_id', c.id, 'profe_id', nuevo.id, 'profe', nuevo.nombre, 'anterior_id', anterior);
end $$;

-- ── Historial de una clase ──────────────────────────────────────────
create or replace function public.reemplazos_clase(p_clase_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.clases;
begin
  select * into c from public.clases where id = p_clase_id;
  if not found then raise exception 'Sin permiso o clase inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(c.gimnasio_id, array['dueno', 'encargado'], c.sede_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', r.id, 'creado_en', r.creado_en, 'motivo', r.motivo,
             'anterior', a.nombre, 'nuevo', n.nombre, 'por', h.nombre) order by r.creado_en desc)
      from public.reemplazos_profe r
      left join public.equipo a on a.gimnasio_id = r.gimnasio_id and a.id = r.profe_anterior_id
      join public.equipo n on n.gimnasio_id = r.gimnasio_id and n.id = r.profe_nuevo_id
      join public.equipo h on h.gimnasio_id = r.gimnasio_id and h.id = r.hecho_por
     where r.gimnasio_id = c.gimnasio_id and r.clase_id = c.id
  ), '[]'::jsonb);
end $$;

revoke all on function public.reemplazar_profe(uuid, uuid, text), public.reemplazos_clase(uuid) from public, anon, authenticated;
grant execute on function public.reemplazar_profe(uuid, uuid, text), public.reemplazos_clase(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.reemplazos_profe'::regclass) then raise exception 'Verificación: reemplazos_profe sin RLS'; end if;
  if has_table_privilege('authenticated', 'public.reemplazos_profe', 'insert') or has_table_privilege('authenticated', 'public.reemplazos_profe', 'update')
     or has_table_privilege('authenticated', 'public.reemplazos_profe', 'delete') or has_table_privilege('anon', 'public.reemplazos_profe', 'select') then
    raise exception 'Verificación: permisos de más sobre reemplazos_profe';
  end if;
  foreach f in array array['public.reemplazar_profe(uuid, uuid, text)', 'public.reemplazos_clase(uuid)', 'privado.reemplazo_profe_inmutable()'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
