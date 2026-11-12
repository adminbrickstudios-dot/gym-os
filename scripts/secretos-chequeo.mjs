// D4 / SEG-02: el repo es público. Ninguna clave ni secreto puede estar escrito en un archivo versionado.
// buscarSecretos(texto) devuelve los hallazgos (nombre del patrón, sin copiar la clave). Lo usa scripts/chequeos.mjs,
// que además prueba que el detector detecta (con claves inventadas armadas en el momento, para no dejarlas escritas acá).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PATRONES = [
  ["JWT de Supabase (anon o service_role) escrito en el código", /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/],
  ["clave nueva de Supabase (sb_secret_)", /\bsb_secret_[A-Za-z0-9_-]{16,}/],
  ["token personal de Supabase (sbp_)", /\bsbp_[0-9a-f]{30,}/],
  ["clave privada (BEGIN … PRIVATE KEY)", /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/],
  ["access token de MercadoPago (APP_USR-…)", /\bAPP_USR-[0-9]{6,}-[0-9]{6}-[0-9a-f]{20,}/],
  ["clave secreta de Stripe o similar (sk_live_)", /\bsk_live_[A-Za-z0-9]{16,}/],
  ["token de GitHub", /\b(?:ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{30,}/],
  ["clave de AWS", /\bAKIA[0-9A-Z]{16}\b/],
  ["token de Vercel o de Slack", /\b(?:xox[abprs]-[0-9A-Za-z-]{20,}|vcp_[A-Za-z0-9]{20,})/],
  // Cadena de conexión con contraseña real: usuario:contraseña@host donde la contraseña no es un marcador.
  ["cadena de conexión con contraseña escrita", /\bpostgres(?:ql)?:\/\/[^\s:@/'"`]+:(?!\$|\{|<|%|x{2,}|\*{2,}|pass(?:word)?\b|contrasena\b|tu[-_]|clave\b|secret\b|postgres\b|local\b|\.{2,}|\[)[^\s@/'"`]{8,}@(?!localhost|127\.0\.0\.1|\[)/i],
];
const SIN_MIRAR = /(^|\/)(package-lock\.json|node_modules\/|\.next\/|capturas\/|public\/.*\.(png|jpg|jpeg|webp|gif|ico|svg|woff2?)$)|\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|zip|gz|enc)$/i;

/** Hallazgos de un texto: [nombre, línea]. */
export function buscarSecretos(texto) {
  const r = [];
  const lineas = texto.split("\n");
  lineas.forEach((l, i) => {
    for (const [nombre, re] of PATRONES) if (re.test(l)) r.push([nombre, i + 1]);
  });
  return r;
}

/** Recorre los archivos versionados (git ls-files) y devuelve "archivo:línea: qué" por cada hallazgo, sin copiar la clave. */
export function secretosEnElRepo(raiz) {
  const g = spawnSync("git", ["ls-files", "-z"], { cwd: raiz, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (g.status !== 0) return ["no se pudo listar los archivos con git ls-files"];
  const problemas = [];
  for (const f of g.stdout.split("\0").filter(Boolean)) {
    if (SIN_MIRAR.test(f)) continue;
    // Un archivo .env con valores no se versiona nunca (el ejemplo, sin valores, sí).
    if (/(^|\/)\.env(\.[a-z]+)?$/i.test(f) && !/\.(example|ejemplo)$/i.test(f)) { problemas.push(`${f}: archivo .env versionado`); continue; }
    let t;
    try { t = readFileSync(join(raiz, f), "utf8"); } catch { continue; }
    if (t.includes("\0")) continue;
    for (const [nombre, linea] of buscarSecretos(t)) problemas.push(`${f}:${linea}: ${nombre}`);
  }
  return problemas;
}
