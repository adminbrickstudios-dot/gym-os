// VD-47X · Ningún dato de permisos, plata o socios pasa por un caché compartido (unstable_cache / "use cache").
// Un caché es igual para todos los que preguntan: lo que depende de quién sos tiene que salir de la base, con tu sesión.
// Lo único cacheado es información pública de la landing (landing_publica, medicion_publica), igual para cualquiera.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..");
const PERMITIDOS = new Set(["lib/landing.ts"]);
const RPC_PUBLICOS = new Set(["landing_publica", "medicion_publica"]);

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

describe("caché compartido", () => {
  const usos = archivos(RAIZ).flatMap((p) => {
    const txt = readFileSync(p, "utf8");
    return /unstable_cache|["']use cache["']|\bcacheLife\b|\bcacheTag\b/.test(txt) ? [{ ruta: relative(RAIZ, p).replace(/\\/g, "/"), txt }] : [];
  }).filter((u) => !u.ruta.endsWith("cache-prohibido.test.ts"));

  it("solo la landing pública lo usa", () => {
    expect(usos.map((u) => u.ruta).filter((r) => !PERMITIDOS.has(r))).toEqual([]);
  });

  it("lo cacheado en la landing son solo las funciones públicas de la base", () => {
    for (const u of usos) {
      const dentro = [...u.txt.matchAll(/unstable_cache\(\s*async[\s\S]*?\},\s*\[/g)].map((m) => m[0]);
      expect(dentro.length).toBeGreaterThan(0);
      for (const bloque of dentro) {
        const rpcs = [...bloque.matchAll(/\.rpc\("([a-z_]+)"/g)].map((m) => m[1]);
        expect(rpcs.length).toBeGreaterThan(0);
        for (const r of rpcs) expect(RPC_PUBLICOS.has(r), `${r} no es público`).toBe(true);
        expect(bloque).not.toMatch(/cookies\(|headers\(|auth\./);
      }
    }
  });
});
