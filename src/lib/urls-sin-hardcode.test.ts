// PLAT-04: ninguna dirección escrita a mano. Este test FALLA si en `src` aparece un host, "vercel.app", un "/g/<slug>" armado a mano o un link
// absoluto con el host interpolado fuera de `src/lib/urls.ts`. Lo que ya existía queda en EXCEPCIONES (con quién lo arregla): la lista solo puede
// achicarse. Una excepción que ya no hace falta también falla (hay que sacarla), así la lista no se llena de basura.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(process.cwd(), "src");
const PERMITIDOS_SIEMPRE = new Set(["lib/urls.ts", "lib/dominios.ts", "lib/host.ts"]);

/** Servicios externos con dirección fija (no son direcciones de la plataforma). */
const EXTERNOS = [
  "wa.me", "schema.org", "instagram.com", "challenges.cloudflare.com", "api.mercadopago.com", "www.googletagmanager.com",
  "connect.facebook.net", "g.page", "api.vercel.com", "www.w3.org", "github.com", "accounts.google.com", "www.google.com", "supabase.co", "supabase.com",
];

type Regla = { id: string; titulo: string; patron: RegExp };
const REGLAS: Regla[] = [
  { id: "vercel", titulo: "“vercel.app” escrito en el código", patron: /vercel\.app/ },
  { id: "g-slug", titulo: "“/g/<slug>” armado a mano (usá rutaGimnasio o urlGimnasio)", patron: /\/g\/\$\{|["'`]\/g\// },
  { id: "absoluta", titulo: "link absoluto con el host interpolado (usá urlGimnasio, urlPanel, urlIngreso o urlDeHost)", patron: /(https?|\$\{[a-zA-Z.]+\}):\/\/\$\{/ },
  { id: "host", titulo: "host literal en el código (pasalo por lib/urls o agregalo a EXTERNOS si es un servicio de terceros)", patron: /https?:\/\/(?!\$)[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}/g },
];

/** Lo que existía antes de PLAT-04 y le toca a otro carril. "archivo|regla" → quién lo arregla. */
const EXCEPCIONES: Record<string, string> = {
  "lib/panel/direccion-pagina.ts|g-slug": "carril A/D: dirección de la página del gimnasio en Configuración",
  "lib/panel/direccion-pagina.ts|absoluta": "carril A/D: dirección de la página del gimnasio en Configuración",
  "app/elegir/page.tsx|g-slug": "carril C: el elegir gimnasio",
  "proxy.ts|g-slug": "carril A: el proxy reescribe /g/<slug> (es una ruta, no un link)",
  "app/app/Referir.tsx|absoluta": "carril C: link de referido del socio",
  "app/app/acciones.ts|absoluta": "carril C: origen de la app del socio, armado con el host del pedido",
  "app/panel/socios/acciones.ts|absoluta": "carril D: origen del link para crear la contraseña del socio, armado con el host del pedido",
  "app/kiosco/activar/route.ts|absoluta": "carril A/D: redirección del kiosco con el host del pedido",
  "app/tv/activar/route.ts|absoluta": "carril A/D: redirección de la TV con el host del pedido",
  "lib/google.ts|absoluta": "carril C: URL de vuelta de Google con el host del pedido",
};

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return archivos(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}
/** Sin comentarios (de una línea o de bloque): en un comentario se puede nombrar un dominio de ejemplo. */
const sinComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

function hallazgos(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const f of archivos(RAIZ)) {
    const rel = relative(RAIZ, f).split(sep).join("/");
    if (PERMITIDOS_SIEMPRE.has(rel)) continue;
    const texto = sinComentarios(readFileSync(f, "utf8"));
    for (const r of REGLAS) {
      const encontrados = [...texto.matchAll(new RegExp(r.patron.source, r.patron.flags.includes("g") ? r.patron.flags : `${r.patron.flags}g`))]
        .map((m) => m[0]).filter((m) => r.id !== "host" || !EXTERNOS.some((e) => m.includes(`//${e}`) || m.includes(`.${e}`)));
      if (encontrados.length) out.set(`${rel}|${r.id}`, encontrados);
    }
  }
  return out;
}

describe("PLAT-04: ninguna dirección escrita a mano", () => {
  const encontrados = hallazgos();
  it("no hay direcciones escritas a mano nuevas", () => {
    const nuevos = [...encontrados].filter(([clave]) => !(clave in EXCEPCIONES));
    const detalle = nuevos.map(([clave, v]) => `  ${clave.replace("|", "  →  ")}: ${v.slice(0, 3).join(", ")}  (${REGLAS.find((r) => r.id === clave.split("|")[1])?.titulo})`).join("\n");
    expect(nuevos.length, `Direcciones escritas a mano (usá src/lib/urls.ts):\n${detalle}`).toBe(0);
  });
  it("cada excepción sigue haciendo falta (si ya se arregló, se saca de la lista)", () => {
    const sobran = Object.keys(EXCEPCIONES).filter((k) => !encontrados.has(k));
    expect(sobran, `Excepciones que ya no existen: ${sobran.join(", ")}`).toEqual([]);
  });
  it("las carpetas del super admin están limpias, sin excepciones", () => {
    const mias = [...encontrados.keys()].filter((k) => /^(app\/admin|lib\/admin)\//.test(k));
    expect(mias, `Queda una dirección a mano en el super admin: ${mias.join(", ")}`).toEqual([]);
  });
});
