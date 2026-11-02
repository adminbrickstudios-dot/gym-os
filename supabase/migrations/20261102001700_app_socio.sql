-- ═══════════════════════════════════════════════════════════════════
-- 0017 · La app del socio.
--
--   mi_socio: todo lo que ve el socio en su app, en una llamada: si
--     puede entrar y por qué (la misma función que la puerta), su plan,
--     packs, próximas reservas, cómo pagar por transferencia y si tiene
--     un comprobante esperando aprobación. Una cuenta con varios socios
--     (familia) elige a cuál mirar.
--   vincular_socios_por_telefono: lo llama el servidor después de que
--     el socio verificó su teléfono con un código. Vincula su cuenta a
--     los socios de ESE gimnasio con ese teléfono y sin cuenta todavía.
--     Solo el servidor: un usuario no se puede vincular a un socio.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('privado.calcular_acceso(uuid,timestamptz,uuid)') is null then raise exception 'Guarda: falta la migración 0006'; end if;
  if to_regclass('public.reservas') is null then raise exception 'Guarda: falta la migración 0011'; end if;
end $$;

create or replace function public.mi_socio(p_gimnasio_id uuid, p_socio_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.socios; c public.configuracion_gimnasio; v public.veredicto_acceso; sus public.suscripciones; pl public.planes;
        mios jsonb;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('socio_id', x.id, 'nombre', trim(x.nombre || ' ' || x.apellido)) order by x.nombre), '[]'::jsonb)
    into mios from public.socios x where x.gimnasio_id = p_gimnasio_id and x.usuario_id = auth.uid() and x.dado_de_baja_en is null;
  if jsonb_array_length(mios) = 0 then
    raise exception 'Tu cuenta no es de ningún socio de este gimnasio' using errcode = '42501';
  end if;
  if p_socio_id is null then
    if jsonb_array_length(mios) > 1 then
      return jsonb_build_object('elegir', true, 'socios', mios);
    end if;
    select * into s from public.socios where id = (mios -> 0 ->> 'socio_id')::uuid;
  else
    select * into s from public.socios where id = p_socio_id and gimnasio_id = p_gimnasio_id and usuario_id = auth.uid();
    if not found then raise exception 'Sin permiso para ver ese socio' using errcode = '42501'; end if;
  end if;

  select * into c from public.configuracion_gimnasio where gimnasio_id = p_gimnasio_id;
  v := privado.calcular_acceso(s.id, now(), null);
  select * into sus from public.suscripciones where socio_id = s.id and baja_en is null;
  if found then select * into pl from public.planes where id = sus.plan_id; end if;

  return jsonb_build_object(
    'elegir', false,
    'socios', mios,
    'socio', jsonb_build_object('socio_id', s.id, 'nombre', s.nombre, 'apellido', s.apellido, 'numero', s.numero),
    -- Mismo veredicto que la puerta; sin la indicación para la recepción ("· avisale").
    'acceso', to_jsonb(v) || jsonb_build_object('texto', replace(v.texto, ' · avisale', '')),
    'plan', case when pl.id is not null then jsonb_build_object('nombre', pl.nombre,
              'precio_transferencia', privado.precio_para(pl.id, now(), 'transferencia', null, true)) end,
    'packs', coalesce((select jsonb_agg(jsonb_build_object('plan', p2.nombre, 'cantidad', pk.cantidad, 'vence_en', pk.vence_en,
                         'usadas', (select count(*) from public.consumos_pack cp where cp.pack_id = pk.id and cp.anulado_en is null)))
                        from public.packs pk join public.planes p2 on p2.id = pk.plan_id
                       where pk.socio_id = s.id and pk.anulado_en is null and (pk.vence_en is null or pk.vence_en > now())), '[]'::jsonb),
    'reservas', coalesce((select jsonb_agg(jsonb_build_object('reserva_id', r.id, 'clase_id', k.id, 'actividad', a.nombre, 'emoji', a.emoji,
                            'inicio', k.inicio, 'estado', r.estado,
                            'posicion', case when r.estado = 'espera' then (select count(*) from public.reservas r2
                                          where r2.clase_id = r.clase_id and r2.estado = 'espera' and r2.creado_en <= r.creado_en) end)
                            order by k.inicio)
                           from public.reservas r join public.clases k on k.id = r.clase_id join public.actividades a on a.id = k.actividad_id
                          where r.socio_id = s.id and r.estado in ('confirmada', 'espera') and k.inicio > now() and k.cancelada_en is null), '[]'::jsonb),
    'transferencia', case when c.alias_transferencia is not null or c.cbu is not null then
                       jsonb_build_object('alias', c.alias_transferencia, 'cbu', c.cbu, 'titular', c.titular_cuenta) end,
    'pendiente', (select jsonb_build_object('monto', p.monto, 'informado_en', p.creado_en)
                    from public.pagos p join public.ventas ve on ve.id = p.venta_id
                   where ve.socio_id = s.id and p.estado = 'pendiente' and p.comprobante_path is not null
                   order by p.creado_en desc limit 1),
    'modo_clases', c.modo_clases,
    'zona', (select gi.zona_horaria from public.gimnasios gi where gi.id = p_gimnasio_id),
    'sedes', coalesce((select jsonb_agg(jsonb_build_object('sede_id', se.id, 'nombre', se.nombre) order by se.es_principal desc, se.nombre)
                         from public.sedes se where se.gimnasio_id = p_gimnasio_id and se.activa), '[]'::jsonb)
  );
end $$;

create or replace function public.vincular_socios_por_telefono(p_gimnasio_id uuid, p_usuario_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare tel text; n int;
begin
  if not privado.es_servicio() then raise exception 'Solo el servidor vincula socios' using errcode = '42501'; end if;
  select u.phone into tel from auth.users u where u.id = p_usuario_id and u.phone_confirmed_at is not null;
  if tel is null then raise exception 'El teléfono de esa cuenta no está verificado'; end if;
  tel := '+' || regexp_replace(tel, '\D', '', 'g');
  update public.socios set usuario_id = p_usuario_id
   where gimnasio_id = p_gimnasio_id and usuario_id is null and dado_de_baja_en is null and telefono = tel;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.mi_socio(uuid, uuid), public.vincular_socios_por_telefono(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mi_socio(uuid, uuid) to authenticated, service_role;
grant execute on function public.vincular_socios_por_telefono(uuid, uuid) to service_role;

do $$
begin
  if has_function_privilege('authenticated', 'public.vincular_socios_por_telefono(uuid, uuid)', 'execute') then
    raise exception 'Verificación: un usuario puede vincularse solo a un socio';
  end if;
end $$;
