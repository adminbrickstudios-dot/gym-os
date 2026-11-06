import "server-only";
import { cookies, headers } from "next/headers";
import { CAMPO_TOKEN, COOKIE_PASE, VIGENCIA_PASE_MS, crearPase, paseValido, turnstileActivo, verificarToken } from "@/lib/turnstile";

/**
 * VD-33c: antes de mandar un código, el desafío anti-robot. null = puede seguir; texto = el error para mostrar.
 * Sin las variables de Turnstile no hace nada. Con ellas, o hay un pase vigente para ESE destino (ya resolvió el
 * desafío hace un rato: reenviar el código no pide otro) o el token del formulario tiene que verificar con Cloudflare.
 */
export async function exigirDesafio(form: FormData, destino: string): Promise<string | null> {
  if (!turnstileActivo()) return null;
  const secreto = process.env.TURNSTILE_SECRET_KEY!;
  const almacen = await cookies();
  if (paseValido(almacen.get(COOKIE_PASE)?.value, secreto, destino)) return null;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const r = await verificarToken(String(form.get(CAMPO_TOKEN) ?? ""), ip, secreto);
  if (!r.ok) return r.error;
  almacen.set(COOKIE_PASE, crearPase(secreto, destino), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/ingresar", maxAge: VIGENCIA_PASE_MS / 1000 });
  return null;
}
