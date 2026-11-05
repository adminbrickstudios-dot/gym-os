-- 0112 · Límite de pedidos de código (SEG-1).
-- Antes de mandar un código por SMS o mail, el servidor pregunta acá: hasta 5
-- por destino (celular o mail) y 20 por IP en una hora. El destino se guarda
-- como hash (no se guarda el celular ni el mail) y se borra a las 24 h, en el
-- mismo pedido (sin cron). Tabla de la plataforma: sin gimnasio_id (el pedido
-- llega antes de saber de qué socio es), va a la lista de excepciones.
--   registrar_pedido_codigo(destino, ip)   solo el servidor

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.solo_lectura(uuid)') is null then raise exception 'Guarda: falta la migración 0111'; end if;
end $$;

create table if not exists public.pedidos_codigo (
  id            uuid primary key default gen_random_uuid(),
  destino_hash  text not null check (length(destino_hash) = 64),
  ip            text check (ip is null or length(ip) <= 64),
  creado_en     timestamptz not null default now()
);
create index if not exists pedidos_codigo_destino on public.pedidos_codigo (destino_hash, creado_en);
create index if not exists pedidos_codigo_ip on public.pedidos_codigo (ip, creado_en);
alter table public.pedidos_codigo enable row level security;
revoke all on table public.pedidos_codigo from anon, authenticated;

create or replace function public.registrar_pedido_codigo(p_destino text, p_ip text) returns void
language plpgsql security definer set search_path = '' as $$
declare h text; v_ip text := nullif(left(trim(coalesce(p_ip, '')), 64), '');
begin
  if not privado.es_servicio() then raise exception 'Solo el servidor' using errcode = '42501'; end if;
  if length(trim(coalesce(p_destino, ''))) < 5 then raise exception 'Destino inválido' using errcode = '22023'; end if;
  h := encode(extensions.digest(lower(trim(p_destino)), 'sha256'), 'hex');
  delete from public.pedidos_codigo where creado_en < now() - interval '24 hours';
  if (select count(*) from public.pedidos_codigo where destino_hash = h and creado_en > now() - interval '1 hour') >= 5 then
    raise exception 'Pediste muchos códigos: esperá una hora y probá de nuevo.' using errcode = 'P0001';
  end if;
  if v_ip is not null and (select count(*) from public.pedidos_codigo where ip = v_ip and creado_en > now() - interval '1 hour') >= 20 then
    raise exception 'Hay muchos pedidos desde esta conexión: esperá un rato y probá de nuevo.' using errcode = 'P0001';
  end if;
  insert into public.pedidos_codigo (destino_hash, ip) values (h, v_ip);
end $$;

revoke all on function public.registrar_pedido_codigo(text, text) from public, anon, authenticated;
grant execute on function public.registrar_pedido_codigo(text, text) to service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.pedidos_codigo'::regclass) then raise exception 'Verificación: pedidos_codigo sin RLS'; end if;
  if has_function_privilege('authenticated', 'public.registrar_pedido_codigo(text, text)', 'execute')
     or has_function_privilege('anon', 'public.registrar_pedido_codigo(text, text)', 'execute') then
    raise exception 'Verificación: registrar_pedido_codigo solo es del servidor';
  end if;
end $$;
