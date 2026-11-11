import "server-only";
import { headers } from "next/headers";

/**
 * BASE-8 · D49: lo primero que hace un formulario público (sin sesión) antes de tocar la base.
 *  1. Campo trampa: el formulario trae un campo "sitio" escondido que una persona no ve. Si viene lleno es un robot:
 *     se responde "listo" como si hubiera funcionado (que no sepa que lo frenamos) y no se hace nada.
 *  2. Tope por conexión (10 por hora) y por persona (3 por hora, el DNI o el mail van como hash): lo decide la base.
 * Devuelve { robot: true } (hay que fingir éxito), { error } (mostrar el texto) o {} (seguir).
 */
export async function frenarEnvioPublico(form: FormData, formulario: "alta_online" | "consulta" | "prueba" | "otro", clave: string | null): Promise<{ robot?: true; error?: string }> {
  if (String(form.get("sitio") ?? "").trim()) return { robot: true };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const { clienteServicio } = await import("@/lib/supabase/servicio");
  const { error } = await clienteServicio().rpc("registrar_envio_publico", { p_formulario: formulario, p_ip: ip, p_clave: clave });
  return error ? { error: error.message } : {};
}
