-- 0072 · Bandeja de avisos del día (AVI-1, decisión D12).
-- A quién escribirle hoy, con el mensaje de Configuración → Mensajes ya
-- escrito y el WhatsApp a un toque. Se calcula al abrirla (sin cron):
--   vence pronto · venció hace poco (hasta 3 días) · no viene · cumple años ·
--   comprobante rechazado (últimos 3 días)
-- "Avisado ✓" queda anotado (avisos_enviados) con a qué se refiere ese aviso
-- (el vencimiento, el último día que vino, el año del cumpleaños, el pago):
-- el mismo aviso no vuelve a aparecer; uno nuevo sí. Lo avisado hoy se ve con ✓.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.retencion(uuid, timestamptz)') is null then raise exception 'Guarda: falta privado.retencion (0025)'; end if;
  if to_regprocedure('public.operador_actual(uuid)') is null then raise exception 'Guarda: falta la migración 0071'; end if;
end $$;

create table if not exists public.avisos_enviados (
  id           uuid primary key default gen_random_uuid(),
  gimnasio_id  uuid not null references public.gimnasios(id),
  socio_id     uuid not null,
  clave        text not null check (clave in ('por_vencer', 'vencido', 'no_viene', 'cumpleanos', 'comprobante_rechazado')),
  referencia   text not null check (length(referencia) between 1 and 64),
  creado_en    timestamptz not null default now(),
  creado_por   uuid not null,
  unique (gimnasio_id, id),
  unique (gimnasio_id, socio_id, clave, referencia),
  foreign key (gimnasio_id, socio_id) references public.socios (gimnasio_id, id),
  foreign key (gimnasio_id, creado_por) references public.equipo (gimnasio_id, id)
);
select privado.politicas_estandar('public.avisos_enviados', array['dueno', 'encargado', 'recepcion'], null);
revoke all on table public.avisos_enviados from anon;

create or replace function public.bandeja_avisos(p_gimnasio_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare zona text; hoy date; gim text; plantilla text;
begin
  perform privado.exigir_equipo(p_gimnasio_id, array['dueno', 'encargado', 'recepcion']);
  select g.zona_horaria, g.nombre into zona, gim from public.gimnasios g where g.id = p_gimnasio_id;
  hoy := privado.dia_local(now(), zona);
  select coalesce(p.texto, (select m ->> 'original' from jsonb_array_elements(privado.mensajes_catalogo()) m where m ->> 'clave' = 'comprobante_rechazado'))
    into plantilla from public.plantillas_mensaje p where p.gimnasio_id = p_gimnasio_id and p.clave = 'comprobante_rechazado';
  return coalesce((
    with candidatos as (
      -- De Retención: misma cuenta, mismo mensaje.
      select r.socio_id, r.nombre, r.telefono, r.lista as clave, r.texto as motivo, r.mensaje,
             case r.lista when 'no_viene' then coalesce(privado.dia_local(r.ultimo_ingreso, zona)::text, 'nunca')
                          else coalesce(privado.dia_local(r.vence_en, zona)::text, hoy::text) end as referencia
        from privado.retencion(p_gimnasio_id, now()) r
       where r.lista in ('por_vencer', 'no_viene') or (r.lista = 'vencido' and r.dias between 1 and 3)
      union all
      select (c ->> 'socio_id')::uuid, c ->> 'nombre', c ->> 'telefono', 'cumpleanos', 'Cumple ' || (c ->> 'cumple') || ' hoy', c ->> 'mensaje',
             extract(year from hoy)::text
        from jsonb_array_elements(public.cumplen_hoy(p_gimnasio_id, now())) c
      union all
      select s.id, trim(s.nombre || ' ' || s.apellido), privado.celular_aviso(s.telefono, s.responsable_telefono, s.fecha_nacimiento, hoy),
             'comprobante_rechazado', 'Le rechazaron el comprobante: ' || p.rechazado_motivo,
             privado.armar_mensaje(plantilla, privado.variables_socio(s.id, now())), p.id::text
        from public.pagos p join public.ventas v on v.id = p.venta_id join public.socios s on s.id = v.socio_id
       where p.gimnasio_id = p_gimnasio_id and p.estado = 'rechazado' and p.rechazado_en > now() - interval '3 days'
         and s.dado_de_baja_en is null
    )
    select jsonb_agg(jsonb_build_object('socio_id', c.socio_id, 'nombre', c.nombre, 'telefono', c.telefono, 'clave', c.clave,
             'motivo', c.motivo, 'mensaje', c.mensaje, 'referencia', c.referencia,
             'avisado_en', a.creado_en, 'avisado_por', (select q.nombre from public.equipo q where q.id = a.creado_por))
             order by (a.id is not null), array_position(array['por_vencer', 'vencido', 'comprobante_rechazado', 'cumpleanos', 'no_viene'], c.clave), c.nombre)
      from candidatos c
      left join public.avisos_enviados a on a.gimnasio_id = p_gimnasio_id and a.socio_id = c.socio_id and a.clave = c.clave and a.referencia = c.referencia
     -- Lo avisado otro día no vuelve; lo avisado hoy se ve con ✓.
     where a.id is null or privado.dia_local(a.creado_en, zona) = hoy
  ), '[]'::jsonb);
end $$;

-- Avisado ✓. Repetirlo no suma una fila nueva.
create or replace function public.marcar_avisado(p_socio_id uuid, p_clave text, p_referencia text) returns void
language plpgsql security definer set search_path = '' as $$
declare g uuid; e public.equipo;
begin
  select gimnasio_id into g from public.socios where id = p_socio_id;
  if g is null then raise exception 'Sin permiso o socio inexistente' using errcode = '42501'; end if;
  e := privado.exigir_equipo(g, array['dueno', 'encargado', 'recepcion']);
  if p_clave is null or p_clave not in ('por_vencer', 'vencido', 'no_viene', 'cumpleanos', 'comprobante_rechazado') then
    raise exception 'Aviso desconocido' using errcode = '22023';
  end if;
  insert into public.avisos_enviados (gimnasio_id, socio_id, clave, referencia, creado_por)
  values (g, p_socio_id, p_clave, left(coalesce(nullif(trim(p_referencia), ''), 'sin'), 64), e.id)
  on conflict (gimnasio_id, socio_id, clave, referencia) do nothing;
end $$;

revoke all on function public.bandeja_avisos(uuid), public.marcar_avisado(uuid, text, text) from public, anon, authenticated;
grant execute on function public.bandeja_avisos(uuid), public.marcar_avisado(uuid, text, text) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare f text;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.avisos_enviados'::regclass) then raise exception 'Verificación: avisos_enviados sin RLS'; end if;
  foreach f in array array['public.bandeja_avisos(uuid)', 'public.marcar_avisado(uuid, text, text)'] loop
    if not exists (select 1 from pg_proc where oid = f::regprocedure and 'search_path=""' = any (proconfig)) then
      raise exception 'Verificación: % sin search_path vacío', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then raise exception 'Verificación: anon puede ejecutar %', f; end if;
  end loop;
end $$;
