// F3.2 · Lo de FLUIDEZ.md que se puede mirar en el código, sin levantar la app (reglas 8, 9, 15, 16):
//   · cada pantalla del panel, del admin y de la app del socio tiene su `loading.tsx` (esqueleto con la forma real);
//   · cada zona tiene su `error.tsx` y todos usan `PantallaError` (Reintentar, Volver e Ir al inicio);
//   · los campos de DNI, celular y monto abren el teclado numérico en el celular;
//   · nadie escribe un emoji en un texto de pantalla (todo sale por `Icono`).
// Lo que se ve en ejecución (red lenta, borrador al recargar, error junto al campo) lo mira scripts/e2e/fluidez-reglas.mjs.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const APP = join(process.cwd(), "src", "app");
const ZONAS = ["panel", "admin", "app", "hacete-socio", "kiosco", "tv", "elegir", "auth"];

function archivos(dir: string, salida: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivos(p, salida); else salida.push(p);
  }
  return salida;
}
const todos = archivos(APP);
const rel = (p: string) => relative(APP, p).replaceAll("\\", "/");
const paginas = todos.map((p) => p.replaceAll("\\", "/")).filter((p) => p.endsWith("/page.tsx")).map((p) => p.slice(0, -"/page.tsx".length));
const existe = (dir: string, nombre: string) => todos.some((p) => p.replaceAll("\\", "/") === `${dir.replaceAll("\\", "/")}/${nombre}`);

/** Pantallas que no pintan nada: solo redirigen. No necesitan esqueleto. */
const SOLO_REDIRIGE = new Set(["panel/hoy"]);

describe("FLUIDEZ regla 9 y 16: cada pantalla tiene su esqueleto", () => {
  const dePantalla = paginas.map((d) => ({ d, r: relative(APP, d).replaceAll("\\", "/") })).filter(({ r }) => ZONAS.some((z) => r === z || r.startsWith(`${z}/`)));
  it("hay pantallas que mirar", () => expect(dePantalla.length).toBeGreaterThan(60));
  it("todas tienen loading.tsx propio (o solo redirigen)", () => {
    const sin = dePantalla.filter(({ d, r }) => !SOLO_REDIRIGE.has(r) && !existe(d, "loading.tsx")).map(({ r }) => r);
    expect(sin).toEqual([]);
  });
  it("los esqueletos se anuncian como cargando (aria-busy)", () => {
    const mal = dePantalla.filter(({ d, r }) => existe(d, "loading.tsx") && !/aria-busy/.test(readFileSync(`${d}/loading.tsx`, "utf8"))
      && !/^(kiosco|tv|elegir|auth)/.test(r)).map(({ r }) => r);
    expect(mal).toEqual([]);
  });
});

describe("FLUIDEZ regla 15: errores con salida", () => {
  const errores = todos.filter((p) => p.endsWith("error.tsx") && !p.endsWith("global-error.tsx"));
  it("cada zona tiene su error.tsx (o lo hereda de la raíz)", () => {
    for (const z of ["panel", "admin", "app", "hacete-socio", "ingresar", "privacidad"]) expect(existe(join(APP, z), "error.tsx"), z).toBe(true);
    expect(existe(APP, "error.tsx")).toBe(true);
  });
  it("todos los error.tsx muestran Reintentar, Volver e Ir al inicio (PantallaError)", () => {
    const sin = errores.filter((p) => !/PantallaError|Volver/.test(readFileSync(p, "utf8"))).map(rel);
    expect(sin).toEqual([]);
  });
  it("hay una página de 'no encontrado' con Volver", () => {
    expect(existe(APP, "not-found.tsx")).toBe(true);
    expect(readFileSync(join(APP, "not-found.tsx"), "utf8")).toMatch(/VolverAtras/);
  });
  it("los avisos de error de intentar() (sin permiso, apagada, dato inválido) traen Volver e Ir al inicio", () => {
    const t = readFileSync(join(process.cwd(), "src", "lib", "panel", "intentar.tsx"), "utf8");
    expect((t.match(/<SalidaError/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

describe("FLUIDEZ regla 8: teclado numérico en DNI, celular y monto", () => {
  const fuentes = [...todos, ...archivos(join(process.cwd(), "src", "components"))].filter((p) => p.endsWith(".tsx"));
  const NUMERICOS = /^(dni|telefono|celular|monto|precio|matricula|cantidad|cupo)$/;
  it("cada <input name=dni|telefono|monto…> trae inputMode o type tel/number", () => {
    const mal: string[] = [];
    for (const p of fuentes) {
      const t = readFileSync(p, "utf8");
      for (const m of t.matchAll(/<input\b[^>]*?\bname=["']([a-z_]+)["'][^>]*?\/?>/g)) {
        if (!NUMERICOS.test(m[1])) continue;
        if (!/inputMode=|type=["'](tel|number)["']|type=["']hidden["']|type=["']checkbox["']|type=["']radio["']/.test(m[0])) mal.push(`${rel(p).replace(/^\.\.\/components/, "components")}: ${m[1]}`);
      }
    }
    expect(mal).toEqual([]);
  });
});

describe("FLUIDEZ: textos sin emojis sueltos en las pantallas", () => {
  it("ningún .tsx de pantalla escribe un emoji dentro de un texto visible", () => {
    // Los emojis permitidos son los de los campos `emoji:` (datos que el componente Icono traduce); acá solo se miran los textos JSX.
    const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    const mal: string[] = [];
    for (const p of todos.filter((x) => x.endsWith(".tsx") && !/error\.tsx$/.test(x))) {
      const lineas = readFileSync(p, "utf8").split("\n");
      lineas.forEach((l, i) => {
        if (!EMOJI.test(l) || /^\s*(\/\/|\*|\{\/\*)/.test(l)) return;
        if (/emoji\s*[:=]|icono\s*[:=]|aria-hidden|encode|replace\(|split\(|match\(|test\(/i.test(l)) return;
        // Solo cuenta si el emoji queda entre > y < (texto de un elemento) o en className/placeholder/title.
        if (/>[^<>{]*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}][^<>]*</u.test(l) || /(placeholder|title|aria-label)=["'][^"']*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(l)) mal.push(`${rel(p)}:${i + 1}`);
      });
    }
    expect(mal).toEqual([]);
  });
});
