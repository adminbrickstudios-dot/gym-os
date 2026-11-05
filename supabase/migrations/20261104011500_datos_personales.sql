-- 0115 · Datos personales (SEG-6).
-- El socio descarga sus datos desde la app (lo que el gimnasio guarda de él).
-- El dueño, a un socio dado de baja que lo pide, le borra los datos personales:
-- nombre, DNI, contacto, nacimiento, foto, notas del equipo y su prospecto;
-- quedan los pagos y las entradas (la contabilidad) a nombre de "Socio borrado".
-- No se deshace.
--   mis_datos(socio)                     el socio
--   anonimizar_socio(socio, confirmo)    el dueño, solo dados de baja

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.exportar_gimnasio(uuid, text)') is null then raise exception 'Guarda: falta la migración 0113'; end if;
end $$;

alter table public.socios add column if not exists anonimizado_en timestamptz;

create or replace function public.mis_datos(p_socio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.socios;
begin
  if p_socio_id is null or p_socio_id not in (select privado.mis_socios()) then raise exception 'Sin permiso' using errcode = '42501'; end if;
  select * into s from public.socios where id = p_socio_id;
  return jsonb_build_object(
    'gimnasio', (select g.nombre from public.gimnasios g where g.id = s.gimnasio_id),
    'descargado_en', now(),
    'socio', to_jsonb(s) - 'gimnasio_id' - 'foto_path' - 'usuario_id' - 'importacion_id' - 'creado_por' - 'notas',
    'membresias', coalesce((select jsonb_agg(to_jsonb(x) - 'gimnasio_id' order by x.inicio) from public.suscripciones x where x.socio_id = s.id), '[]'::jsonb),
    'coberturas', coalesce((select jsonb_agg(jsonb_build_object('desde', x.desde, 'hasta', x.hasta, 'anulada_en', x.anulada_en) order by x.desde) from public.coberturas x where x.socio_id = s.id), '[]'::jsonb),
    'pagos', coalesce((select jsonb_agg(jsonb_build_object('fecha', p.creado_en, 'medio', p.medio, 'monto', p.monto, 'estado', p.estado) order by p.creado_en)
                        from public.pagos p join public.ventas v on v.id = p.venta_id where v.socio_id = s.id), '[]'::jsonb),
    'entradas', coalesce((select jsonb_agg(jsonb_build_object('momento', i.momento, 'resultado', i.resultado) order by i.momento)
                           from public.ingresos i where i.socio_id = s.id and i.anulado_en is null), '[]'::jsonb),
    'reservas', coalesce((select jsonb_agg(jsonb_build_object('clase', c.inicio, 'estado', r.estado) order by c.inicio)
                           from public.reservas r join public.clases c on c.id = r.clase_id where r.socio_id = s.id), '[]'::jsonb),
    'registros_ejercicio', coalesce((select jsonb_agg(jsonb_build_object('momento', r.momento, 'ejercicio', e.nombre, 'peso', r.peso, 'repeticiones', r.repeticiones) order by r.momento)
                                      from public.registros_ejercicio r join public.ejercicios e on e.id = r.ejercicio_id where r.socio_id = s.id and r.anulado_en is null), '[]'::jsonb));
end $$;

create or replace function public.anonimizar_socio(p_socio_id uuid, p_confirmo text) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.socios; n int;
begin
  select * into s from public.socios where id = p_socio_id for update;
  if not found then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  perform privado.exigir_rol(s.gimnasio_id, array['dueno']);
  if s.dado_de_baja_en is null then raise exception 'Primero dalo de baja: solo se borran los datos de un ex socio' using errcode = '22023'; end if;
  if s.anonimizado_en is not null then raise exception 'Sus datos ya estaban borrados' using errcode = '22023'; end if;
  if coalesce(p_confirmo, '') <> 'BORRAR' then raise exception 'Para confirmar, escribí BORRAR' using errcode = '22023'; end if;
  update public.socios set nombre = 'Socio', apellido = 'borrado #' || numero, dni = null, telefono = null, email = null, fecha_nacimiento = null,
         foto_path = null, usuario_id = null, contacto_emergencia_nombre = null, contacto_emergencia_telefono = null, notas = null,
         responsable_nombre = null, responsable_telefono = null, llavero = null, codigo_referido = null, anonimizado_en = now()
   where id = s.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'No se pudieron borrar los datos'; end if;
  update public.notas_socio set texto = '(borrada)', borrada_en = coalesce(borrada_en, now()) where socio_id = s.id;
  update public.prospectos set nombre = 'Socio borrado', telefono = '+000' || lpad(abs(hashtext(id::text))::text, 10, '0'), interes = null, nota = null where socio_id = s.id;
end $$;

revoke all on function public.mis_datos(uuid), public.anonimizar_socio(uuid, text) from public, anon, authenticated;
grant execute on function public.mis_datos(uuid), public.anonimizar_socio(uuid, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.mis_datos(uuid)', 'public.anonimizar_socio(uuid, text)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then raise exception 'Verificación: % sin search_path vacío', f; end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
