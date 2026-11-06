// VD-33c · Desafío anti-robot (Cloudflare Turnstile) antes de mandar un código (que cuesta un SMS).
// Detrás de variables de entorno: sin NEXT_PUBLIC_TURNSTILE_SITE_KEY y TURNSTILE_SECRET_KEY todo sigue
// exactamente igual que antes (no se pide ni se verifica nada). Con las dos, un código no sale si el
// desafío no se resolvió, y la verificación la hace el servidor contra Cloudflare (nunca el navegador).
import crypto from "node:crypto";

export const URL_VERIFICACION = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const CAMPO_TOKEN = "cf-turnstile-response";
/** Cuánto vale haber resuelto el desafío para reenviar el código al mismo destino (el token de Cloudflare es de un solo uso). */
export const VIGENCIA_PASE_MS = 10 * 60_000;
export const COOKIE_PASE = "gymos_desafio";

export const turnstileActivo = (env: NodeJS.ProcessEnv = process.env) =>
  !!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !!env.TURNSTILE_SECRET_KEY;

export type ResultadoDesafio = { ok: true } | { ok: false; error: string };

/** Pregunta a Cloudflare si el token es bueno. Si no se puede preguntar, NO pasa (el código cuesta plata). */
export async function verificarToken(
  token: string, ip: string | null, secreto: string, pedir: typeof fetch = fetch,
): Promise<ResultadoDesafio> {
  if (!token) return { ok: false, error: "Resolvé el desafío de seguridad para recibir el código." };
  try {
    const cuerpo = new URLSearchParams({ secret: secreto, response: token });
    if (ip) cuerpo.set("remoteip", ip);
    const r = await pedir(URL_VERIFICACION, { method: "POST", body: cuerpo, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { ok: false, error: "No pudimos verificar el desafío ahora. Probá de nuevo en un rato." };
    const j = (await r.json()) as { success?: boolean };
    return j.success ? { ok: true } : { ok: false, error: "No pudimos comprobar que sos una persona. Probá de nuevo." };
  } catch {
    return { ok: false, error: "No pudimos verificar el desafío ahora. Probá de nuevo en un rato." };
  }
}

// El pase: cookie firmada "destino + vencimiento" que se da al resolver el desafío, para que "Reenviar el código"
// no pida otro desafío (el token ya se gastó). Firmada con la clave secreta: no se puede armar a mano.
const firma = (secreto: string, destino: string, vence: number) =>
  crypto.createHmac("sha256", secreto).update(`${destino}|${vence}`).digest("base64url");

export function crearPase(secreto: string, destino: string, ahora = Date.now()): string {
  const vence = ahora + VIGENCIA_PASE_MS;
  return `${vence}.${firma(secreto, destino, vence)}`;
}

export function paseValido(pase: string | undefined, secreto: string, destino: string, ahora = Date.now()): boolean {
  const [venceTxt, f] = (pase ?? "").split(".");
  const vence = Number(venceTxt);
  if (!f || !Number.isFinite(vence) || vence < ahora) return false;
  const esperada = firma(secreto, destino, vence);
  return esperada.length === f.length && crypto.timingSafeEqual(Buffer.from(esperada), Buffer.from(f));
}
