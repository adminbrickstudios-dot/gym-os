import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";

// Cliente de Supabase para Server Components, Server Actions y Route
// Handlers. @supabase/ssr en todo el flujo de auth: guarda la sesión (y el
// verificador PKCE) en cookies, que el servidor sí puede leer.
export async function crearClienteServidor() {
  const almacen = await cookies();
  return createServerClient(supabaseUrl(), supabaseAnon(), {
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
