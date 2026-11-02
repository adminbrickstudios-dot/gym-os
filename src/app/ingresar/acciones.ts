"use server";
import { headers } from "next/headers";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { MiSesion } from "@/lib/panel/servidor";

// La acción devuelve a dónde ir y el navegador navega. Redirigiendo dentro de
// la acción, Next renderiza el destino en el mismo POST, sin los encabezados
// del gimnasio que pone el middleware para esa ruta.
export type EstadoIngreso = { error?: string; email?: string; destino?: string };

/** Solo rutas internas: un "siguiente" que apunta afuera se ignora (y se dice en el código, no en silencio). */
function destinoSeguro(siguiente: string | null, porDefecto: string) {
  if (siguiente && /^\/(?!\/)[\w\-/?=&%.]*$/.test(siguiente)) return siguiente;
  return porDefecto;
}

export async function ingresar(_: EstadoIngreso, form: FormData): Promise<EstadoIngreso> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const contrasena = String(form.get("contrasena") ?? "");
  if (!email || !contrasena) return { error: "Escribí tu mail y tu contraseña", email };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: contrasena });
  if (error) {
    return { error: /invalid/i.test(error.message) ? "El mail o la contraseña no son correctos" : `No pudimos iniciar sesión: ${error.message}`, email };
  }

  const { data: sesion, error: errSesion } = await supabase.rpc("mi_sesion");
  if (errSesion) return { error: `Entraste, pero no pudimos leer tu cuenta: ${errSesion.message}`, email };
  const yo = sesion as MiSesion;

  const h = await headers();
  const gimnasioId = h.get("x-gimnasio-id");
  const siguiente = String(form.get("siguiente") ?? "") || null;

  if (h.get("x-gymos-contexto") === "plataforma") {
    if (yo.es_admin) return { destino: destinoSeguro(siguiente, "/admin") };
    await supabase.auth.signOut();
    return { error: "Esta es la entrada de BRIK. Entrá desde la dirección de tu gimnasio.", email };
  }
  if (yo.equipo.some((e) => e.gimnasio_id === gimnasioId)) return { destino: destinoSeguro(siguiente, "/panel") };
  if (yo.socios.some((s) => s.gimnasio_id === gimnasioId)) return { destino: "/app" };
  await supabase.auth.signOut();
  return { error: "Tu usuario no es de este gimnasio. Revisá la dirección o pedile acceso al dueño.", email };
}
