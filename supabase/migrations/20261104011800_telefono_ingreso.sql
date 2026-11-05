-- 0118 · El celular con el que entra el socio se normaliza igual que en su ficha.
-- El ingreso con código armaba el +549… con su propia regla (en TypeScript) y
-- no siempre coincidía con privado.telefono_normalizado, que es la que usan el
-- alta, la importación y la página: un socio importado con "000 …" (o un
-- número de 10 cifras con 15 después de la característica) no podía entrar.
-- Ahora el servidor le pregunta a la base. Solo para el servidor (service_role).

-- ── Guarda de entrada ───────────────────────────────────────────────
do $$
begin
  if to_regprocedure('privado.telefono_normalizado(text, text)') is null then raise exception 'Guarda: falta privado.telefono_normalizado'; end if;
end $$;

create or replace function public.telefono_para_ingresar(p_texto text) returns text
language sql immutable security definer set search_path = '' as $$
  select privado.telefono_normalizado(p_texto, 'El celular')
$$;
revoke all on function public.telefono_para_ingresar(text) from public, anon, authenticated;
grant execute on function public.telefono_para_ingresar(text) to service_role;

-- ── Verificación ────────────────────────────────────────────────────
do $$
begin
  if public.telefono_para_ingresar('000 8330311') <> '+5490008330311'
     or public.telefono_para_ingresar('0387 15 555-1234') <> '+5493875551234'
     or public.telefono_para_ingresar('+54 9 11 1234 5678') <> '+5491112345678' then
    raise exception 'Verificación: telefono_para_ingresar no normaliza como la ficha';
  end if;
  if has_function_privilege('authenticated', 'public.telefono_para_ingresar(text)', 'execute')
     or has_function_privilege('anon', 'public.telefono_para_ingresar(text)', 'execute') then
    raise exception 'Verificación: telefono_para_ingresar quedó abierta';
  end if;
end $$;
