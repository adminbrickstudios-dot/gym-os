-- BASE-5 · Vigencia guardada: socios.cubierto_hasta (D36).
-- Se guarda el FIN de la cobertura de membresía del socio (el último `hasta` de sus coberturas no anuladas), por trigger,
-- en la misma transacción que el hecho que lo mueve (pago, anulación, devolución, cambio de plan: todos pasan por `coberturas`).
-- No se guarda ningún estado ni color: el color sale de comparar esta fecha con el momento, en el momento de mirar. Nada de cron.
-- `estado_acceso` / `calcular_acceso` NO cambian: ningún veredicto se mueve. La columna sirve para las listas de muchos socios.
-- Aditiva e idempotente: columna nullable → función → triggers → backfill → índice → verificación.

-- Guarda de entrada
do $g$ begin
  if to_regclass('public.socios') is null or to_regclass('public.coberturas') is null then
    raise exception 'BASE-5: faltan socios o coberturas';
  end if;
end $g$;

alter table public.socios add column if not exists cubierto_hasta timestamptz;

-- La cuenta: una sola, la usan el trigger, el backfill y el chequeo.
create or replace function privado.calcular_cubierto_hasta(p_socio_id uuid) returns timestamptz
language sql stable set search_path = '' as $$
  select max(c.hasta) from public.coberturas c where c.socio_id = p_socio_id and c.anulada_en is null
$$;
revoke all on function privado.calcular_cubierto_hasta(uuid) from public, anon, authenticated;

create or replace function privado.recalcular_cubierto_hasta(p_socio_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.socios s set cubierto_hasta = privado.calcular_cubierto_hasta(p_socio_id)
   where s.id = p_socio_id and s.cubierto_hasta is distinct from privado.calcular_cubierto_hasta(p_socio_id);
end $$;
revoke all on function privado.recalcular_cubierto_hasta(uuid) from public, anon, authenticated;

create or replace function privado.trg_cubierto_hasta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform privado.recalcular_cubierto_hasta(old.socio_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform privado.recalcular_cubierto_hasta(new.socio_id); end if;
  return null;
end $$;
revoke all on function privado.trg_cubierto_hasta() from public, anon, authenticated;

drop trigger if exists cubierto_hasta_coberturas on public.coberturas;
create trigger cubierto_hasta_coberturas after insert or update or delete on public.coberturas
  for each row execute function privado.trg_cubierto_hasta();

-- Backfill
update public.socios s set cubierto_hasta = privado.calcular_cubierto_hasta(s.id)
 where s.cubierto_hasta is distinct from privado.calcular_cubierto_hasta(s.id);

-- Las listas que miran a muchos socios: los de un gimnasio, por fin de cobertura.
create index if not exists socios_cubierto_hasta_idx on public.socios (gimnasio_id, cubierto_hasta) where dado_de_baja_en is null;

-- Verificación: lo guardado es lo recalculado, para todos.
do $v$ declare malos int; begin
  select count(*) into malos from public.socios s where s.cubierto_hasta is distinct from privado.calcular_cubierto_hasta(s.id);
  if malos > 0 then raise exception 'BASE-5: % socios con cubierto_hasta distinto del recalculado', malos; end if;
  if not exists (select 1 from pg_trigger where tgname = 'cubierto_hasta_coberturas') then raise exception 'BASE-5: falta el trigger'; end if;
end $v$;
