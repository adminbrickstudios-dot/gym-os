import "server-only";
import { cookies } from "next/headers";
import { rpc } from "@/lib/panel/servidor";
import type { EstadoAyudas } from "@/components/ui/AyudaPantalla";

/**
 * VD-31: lo que esta persona ya vio, de la base. Devuelve null (sin globos) si la base no responde: la ayuda
 * nunca bloquea una pantalla. Solo en un entorno de prueba (PERMITIR_SIN_AYUDA=1) la cookie
 * gymos_sin_ayuda=1 apaga todos los globos, para que los e2e viejos no tropiecen con ellos.
 */
export async function ayudasDeUsuario(): Promise<EstadoAyudas | null> {
  if (process.env.PERMITIR_SIN_AYUDA === "1" && (await cookies()).get("gymos_sin_ayuda")?.value === "1") return null;
  return rpc<EstadoAyudas>("ayudas_vistas", undefined, { lectura: true }).catch(() => null);
}
