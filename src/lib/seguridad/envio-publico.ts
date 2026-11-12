import { textoDeBase } from "@/lib/errores-humanos";
import "server-only";
import { headers } from "next/headers";

/** Segundos mínimos entre abrir el formulario y mandarlo (D49). */
export const ESPERA_MINIMA_SEG = 3;

/**
 * BASE-8 · D49: lo primero que hace un formulario público (sin sesión) antes de tocar la base.
 *  1. Campo trampa: el formulario trae un campo "sitio" escondido que una persona no ve. Si viene lleno es un robot:
 *     se responde "listo" como si hubiera funcionado (que no sepa que lo frenamos) y no se hace nada.
 *  2. Tiempo mínimo: el campo "segundos" (CampoAntiRobot) cuenta cuánto estuvo abierta la página; menos de 3 segundos
 *     o sin el campo no es una persona. Acá sí se contesta con un error (una persona con autocompletar que va muy
 *     rápido toca de nuevo y pasa) y NO cuenta para el tope.
 *  3. Tope por conexión (10 por hora) y por persona (3 por hora, el DNI o el mail van como hash): lo decide la base.
 * Devuelve { robot: true } (hay que fingir éxito), { error } (mostrar el texto) o {} (seguir).
 */
export async function frenarEnvioPublico(form: FormData, formulario: "alta_online" | "consulta" | "prueba" | "otro", clave: string | null): Promise<{ robot?: true; error?: string }> {
  if (String(form.get("sitio") ?? "").trim()) return { robot: true };
  const segundos = Number(form.get("segundos"));
  if (!Number.isFinite(segundos) || segundos < ESPERA_MINIMA_SEG) return { error: "Mandaste el formulario muy rápido. Esperá unos segundos y tocá de nuevo el botón." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const { clienteServicio } = await import("@/lib/supabase/servicio");
  const { error } = await clienteServicio().rpc("registrar_envio_publico", { p_formulario: formulario, p_ip: ip, p_clave: clave });
  return error ? { error: textoDeBase(error, "No pudimos enviar el formulario ahora. Probá de nuevo en un rato.") } : {};
}
