-- 0051 · QR en la tablet: el socio lo escanea con su app (ENT-6, A4).
-- La tablet autorizada (0050) muestra un código que cambia cada 30 segundos:
--   GYMOSP1.<dispositivo_id>.<ventana>.<firma>
-- firmado con un secreto de esa tablet (derivado del hash de su token, que
-- nunca sale de la base). El socio lo escanea desde su app: la base valida el
-- código (su gimnasio, tablet no revocada, ventana actual o anterior) y anota
-- la entrada con el mismo cálculo de siempre (forma "qr_pared"). La tablet
-- muestra quién acaba de entrar por ella. Solo con "qr_pared" prendida.

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.kiosco_entrar(text, text)') is null then raise exception 'Guarda: falta la migración 0050'; end if;
end $$;

create or replace function privado.secreto_tablet(p_dispositivo_id uuid) returns bytea
language sql stable security definer set search_path = '' as $$
  select extensions.digest(decode(t.token_hash, 'hex') || 'qr-pared'::bytea, 'sha256')
    from public.dispositivos_tokens t where t.dispositivo_id = p_dispositivo_id
$$;
revoke all on function privado.secreto_tablet(uuid) from public, anon, authenticated;

-- El código que muestra la tablet.
create or replace function public.kiosco_qr(p_token text, p_momento timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d public.dispositivos; v bigint;
begin
  d := privado.tablet_del_token(p_token);
  if not exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = d.gimnasio_id and 'qr_pared' = any (c.accesos_activos)) then
    raise exception 'El QR en la tablet está apagado en este gimnasio.' using errcode = '22023';
  end if;
  v := privado.ventana_qr(p_momento);
  return jsonb_build_object('codigo', 'GYMOSP1.' || d.id || '.' || v || '.' || privado.firma_qr(privado.secreto_tablet(d.id), d.id, v),
                            'vence_en', to_timestamp((v + 1) * 30));
end $$;

-- Lo último que entró por esta tablet (para mostrarlo en la puerta).
create or replace function public.kiosco_ultimo(p_token text, p_desde timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d public.dispositivos;
begin
  d := privado.tablet_del_token(p_token);
  return (select jsonb_build_object('ingreso_id', i.id, 'momento', i.momento, 'nombre', s.nombre, 'resultado', i.resultado, 'color', i.color,
                                    'texto', regexp_replace(replace(i.texto, ' · avisale', ''), ' · debe [^·]*', '', 'g'))
            from public.ingresos i join public.socios s on s.id = i.socio_id
           where i.dispositivo_id = d.id and i.via_acceso = 'qr_pared' and i.anulado_en is null and i.momento > p_desde
           order by i.momento desc limit 1);
end $$;

-- El socio escanea el código de la tablet desde su app.
create or replace function public.entrar_por_qr_pared(p_gimnasio_id uuid, p_socio_id uuid, p_codigo text, p_momento timestamptz default now())
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.socios; m text[]; did uuid; v bigint; actual bigint; d public.dispositivos; r jsonb;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '42501'; end if;
  select * into s from public.socios where id = p_socio_id and gimnasio_id = p_gimnasio_id and usuario_id = auth.uid() and dado_de_baja_en is null;
  if s.id is null then raise exception 'Sin permiso para ese socio' using errcode = '42501'; end if;
  m := regexp_match(trim(coalesce(p_codigo, '')), '^GYMOSP1\.([0-9a-f-]{36})\.([0-9]{1,12})\.([0-9a-f]{24})$');
  if m is null then raise exception 'Ese no es el QR de la entrada: buscá el de la tablet.' using errcode = '22023'; end if;
  did := m[1]::uuid; v := m[2]::bigint;
  select * into d from public.dispositivos where id = did;
  if d.id is null or d.gimnasio_id <> p_gimnasio_id then raise exception 'Ese QR es de otro gimnasio.' using errcode = '22023'; end if;
  if d.revocado_en is not null then raise exception 'Esa tablet ya no está habilitada: pasá por recepción.' using errcode = '22023'; end if;
  if not exists (select 1 from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id and 'qr_pared' = any (c.accesos_activos)) then
    raise exception 'El QR en la tablet está apagado: pasá por recepción.' using errcode = '22023';
  end if;
  actual := privado.ventana_qr(p_momento);
  if v not in (actual, actual - 1) then raise exception 'El QR cambió: escanealo de nuevo.' using errcode = '22023'; end if;
  if privado.firma_qr(privado.secreto_tablet(d.id), d.id, v) <> m[3] then raise exception 'El QR no es válido.' using errcode = '22023'; end if;
  update public.dispositivos set ultimo_uso = now() where id = d.id;
  r := privado.registrar_ingreso(s.id, d.sede_id, 'qr_pared', null, d.id, null, null);
  return jsonb_build_object('resultado', r ->> 'resultado', 'repetido', (r ->> 'repetido')::boolean,
    'color', coalesce(r #>> '{veredicto,color}', r ->> 'color'),
    'texto', replace(coalesce(r #>> '{veredicto,texto}', r ->> 'texto'), ' · avisale', ''));
end $$;

-- kiosco_estado (0050), misma firma: dice si la tablet muestra el QR.
create or replace function public.kiosco_estado(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d public.dispositivos; c public.configuracion_gimnasio;
begin
  d := privado.tablet_del_token(p_token);
  select * into c from public.configuracion_gimnasio where gimnasio_id = d.gimnasio_id;
  return jsonb_build_object('tablet', d.nombre, 'sede', (select s.nombre from public.sedes s where s.id = d.sede_id),
    'gimnasio', (select g.nombre from public.gimnasios g where g.id = d.gimnasio_id),
    'con_qr', 'qr_socio' = any (c.accesos_activos), 'qr_pared', 'qr_pared' = any (c.accesos_activos));
end $$;
revoke all on function public.kiosco_estado(text) from public, anon, authenticated;
grant execute on function public.kiosco_estado(text) to anon, authenticated, service_role;

-- ¿El gimnasio usa el QR en la tablet? (para mostrar el botón en la app)
create or replace function public.usa_qr_pared(p_gimnasio_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select 'qr_pared' = any (c.accesos_activos) from public.configuracion_gimnasio c where c.gimnasio_id = p_gimnasio_id), false)
$$;

revoke all on function public.kiosco_qr(text, timestamptz), public.kiosco_ultimo(text, timestamptz),
  public.entrar_por_qr_pared(uuid, uuid, text, timestamptz), public.usa_qr_pared(uuid) from public, anon, authenticated;
grant execute on function public.kiosco_qr(text, timestamptz), public.kiosco_ultimo(text, timestamptz) to anon, authenticated, service_role;
grant execute on function public.entrar_por_qr_pared(uuid, uuid, text, timestamptz), public.usa_qr_pared(uuid) to authenticated, service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where (s.nspname = 'public' and p.proname in ('kiosco_qr', 'kiosco_ultimo', 'entrar_por_qr_pared', 'usa_qr_pared'))
               or (s.nspname = 'privado' and p.proname = 'secreto_tablet') loop
    if r.proconfig is null or not ('search_path=""' = any (r.proconfig)) then raise exception 'Verificación: % sin search_path vacío', r.proname; end if;
    if r.proname not in ('kiosco_qr', 'kiosco_ultimo') and has_function_privilege('anon', r.oid, 'execute') then
      raise exception 'Verificación: anon puede ejecutar %', r.proname;
    end if;
  end loop;
end $$;
