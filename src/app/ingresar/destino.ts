import { cookies, headers } from "next/headers";
import { COOKIE_GIMNASIO, OPCIONES_COOKIE_GIMNASIO } from "@/lib/cookie-gimnasio";
import type { crearClienteServidor } from "@/lib/supabase/servidor";
import type { MiSesion } from "@/lib/panel/servidor";

// Lo que comparten el ingreso con contraseña y "olvidé mi contraseña": a dónde
// va la persona una vez que tiene sesión. No es una acción del servidor (no se
// puede llamar desde el navegador): la usan las acciones de este directorio.

/** Solo rutas internas: un "siguiente" que apunta afuera se ignora (y se dice en el código, no en silencio). */
export function destinoSeguro(siguiente: string | null, porDefecto: string) {
  if (siguiente && /^\/(?!\/)[\w\-/?=&%.]*$/.test(siguiente)) return siguiente;
  return porDefecto;
}

/** Recuerda en qué gimnasio trabaja la persona cuando entra desde la dirección de la plataforma. */
export async function elegirGimnasio(slug: string) {
  (await cookies()).set(COOKIE_GIMNASIO, slug, OPCIONES_COOKIE_GIMNASIO);
}

/** true cuando el servicio de cuentas no respondió (no es un error de la cuenta: no revela nada de nadie). */
export function sinConexion(e: { message?: string; status?: number; name?: string } | null | undefined) {
  return !!e && (e.status === 0 || e.status === undefined || /fetch|network|ECONN|timeout/i.test(`${e.name ?? ""} ${e.message ?? ""}`));
}
export const TEXTO_SIN_CONEXION = "No pudimos conectarnos. Revisá tu internet y probá de nuevo.";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;
export type Destino = { destino?: string; error?: string };

/** Con la sesión ya iniciada: a dónde va según quién es y desde qué dirección entró. Si no corresponde, cierra la sesión. */
export async function destinoTrasEntrar(supabase: Cliente, siguiente: string | null): Promise<Destino> {
  const { data: sesion, error: errSesion } = await supabase.rpc("mi_sesion");
  if (errSesion) return { error: `Entraste, pero no pudimos leer tu cuenta: ${errSesion.message}` };
  const yo = sesion as MiSesion;

  const h = await headers();
  const gimnasioId = h.get("x-gimnasio-id");
  if (h.get("x-gymos-contexto") === "plataforma") {
    // Desde la dirección de Gym OS: el admin va al super admin; el equipo de
    // un gimnasio, a su panel (el gimnasio queda en una cookie; los permisos
    // los valida la base en cada pantalla).
    if (yo.es_admin && !siguiente?.startsWith("/panel")) return { destino: destinoSeguro(siguiente, "/admin") };
    if (yo.equipo.length === 1) {
      await elegirGimnasio(yo.equipo[0].slug);
      return { destino: "/panel" };
    }
    if (yo.equipo.length > 1) return { destino: "/elegir" };
    if (yo.es_admin) return { destino: "/admin" };
    await supabase.auth.signOut();
    return {
      error: yo.socios.length
        ? "Sos socio: entrá desde la app de tu gimnasio."
        : "Tu cuenta no tiene ningún gimnasio. Pedile acceso al dueño.",
    };
  }
  if (yo.equipo.some((e) => e.gimnasio_id === gimnasioId)) return { destino: destinoSeguro(siguiente, "/panel") };
  if (yo.socios.some((s) => s.gimnasio_id === gimnasioId)) return { destino: "/app" };
  await supabase.auth.signOut();
  return { error: "Tu usuario no es de este gimnasio. Revisá la dirección o pedile acceso al dueño." };
}
