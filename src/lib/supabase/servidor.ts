import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";

export const COOKIE_OPERADOR = "gymos_operador";

/**
 * CAJ-3: si en esta compu alguien puso su PIN, cada llamada lleva su token
 * (firmado por la base) para que quede anotado quién operó. Uno vencido no se
 * manda (la base lo rechazaría y trabaría todo el panel): queda la sesión sola.
 */
function encabezadoOperador(valor: string | undefined): Record<string, string> {
  const partes = valor?.split(".");
  if (!valor || partes?.length !== 3 || Number(partes[1]) * 1000 < Date.now() + 60_000) return {};
  return { "x-gymos-operador": valor };
}

// Cliente de Supabase para Server Components, Server Actions y Route
// Handlers. @supabase/ssr en todo el flujo de auth: guarda la sesión (y el
// verificador PKCE) en cookies, que el servidor sí puede leer.
export async function crearClienteServidor(operadorPuntual?: string) {
  const almacen = await cookies();
  // VD-33b: auth anota el dispositivo con el User-Agent que le llega; que sea el del navegador, no el del servidor.
  const agente = (await headers()).get("user-agent");
  // VD-8: `operadorPuntual` = el token de alguien que puso su PIN SOLO para esta llamada (el dueño que autoriza
  // un "dejar pasar"); le gana a la cookie de esta compu y no se guarda en ningún lado.
  const operador = operadorPuntual ? encabezadoOperador(operadorPuntual) : encabezadoOperador(almacen.get(COOKIE_OPERADOR)?.value);
  return createServerClient(supabaseUrl(), supabaseAnon(), {
    global: { headers: { ...operador, ...(agente ? { "User-Agent": agente } : {}) } },
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          // Llamado desde un Server Component: las cookies se renuevan en el middleware de sesión.
        }
      },
    },
  });
}

/** El gimnasio que resolvió el middleware para este host. Sin gimnasio, error. */
export async function gimnasioActual(): Promise<{ id: string; slug: string; host: string }> {
  const h = await headers();
  const id = h.get("x-gimnasio-id");
  const slug = h.get("x-gimnasio-slug");
  const host = h.get("x-gimnasio-host");
  if (h.get("x-gymos-contexto") !== "gimnasio" || !id || !slug || !host) {
    throw new Error("Esta pantalla es de un gimnasio y el host no resolvió a ninguno.");
  }
  return { id, slug, host };
}
