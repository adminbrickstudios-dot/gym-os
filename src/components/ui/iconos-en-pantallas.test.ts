import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { esIcono } from "./Icono";

/**
 * Z2 · Íconos de una vez. Lee todo `src/` y falla si:
 *  - un `<Icono nombre="…">` o un `icono="…"` / `emoji: "…"` apunta a un nombre que no existe,
 *  - hay un ícono vacío (`icono=""`, `emoji: ""`, `<Icono nombre="" />`, `cond ? "" : <Icono …>`),
 *  - queda un emoji crudo o un glifo de texto (✓ ✕ ＋ ✗) en el código de las pantallas.
 * Los comentarios no cuentan. Los textos de WhatsApp y de push (no se pueden dibujar con SVG) están en la lista de excepciones.
 */
const raiz = join(__dirname, "..", "..", "..");
const src = join(raiz, "src");

const SIN_EMOJI_PROPIO = new Set([
  "src/components/ui/Icono.tsx",   // la tabla emoji → ícono necesita nombrarlos
  "src/lib/caja.ts",               // texto de WhatsApp del cierre de caja
  "src/lib/recibo.ts",             // texto de WhatsApp del recibo
  "src/app/push-acciones.ts",      // título de la notificación push de prueba
]);
// El formulario de "Nueva actividad" guarda lo que escribe el dueño en un campo `emoji` (dato suyo, vacío al empezar).
const CAMPO_DEL_DUENO = new Set(["src/app/panel/clases/grilla/Grilla.tsx"]);

function archivos(dir: string, salida: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== "node_modules" && n !== "tipos") archivos(p, salida); }
    else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) salida.push(p);
  }
  return salida;
}
const quitarComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[\s;{(,])\/\/.*$/gm, "$1");
const todos = archivos(src).map((f) => ({ rel: relative(raiz, f).split(sep).join("/"), texto: quitarComentarios(readFileSync(f, "utf8")) }));
const EMOJI = /\p{Extended_Pictographic}|[✓✕＋✗]/u;

describe("Z2 · íconos de las pantallas", () => {
  it("hay archivos que mirar", () => { expect(todos.length).toBeGreaterThan(300); });

  it("todo <Icono nombre=\"…\"> con nombre escrito existe y no está vacío", () => {
    const mal: string[] = [];
    for (const { rel, texto } of todos) {
      for (const m of texto.matchAll(/<Icono\s+nombre="([^"]*)"/g)) if (!m[1] || !esIcono(m[1])) mal.push(`${rel}: <Icono nombre="${m[1]}">`);
    }
    expect(mal).toEqual([]);
  });

  it("los props icono=\"…\" y los datos emoji/icono: \"…\" nombran un ícono que existe (ninguno vacío)", () => {
    const mal: string[] = [];
    for (const { rel, texto } of todos) {
      if (SIN_EMOJI_PROPIO.has(rel) || CAMPO_DEL_DUENO.has(rel)) continue;
      for (const m of texto.matchAll(/\b(?:icono|emoji)=\{?"([^"]*)"/g)) if (!m[1] || !esIcono(m[1])) mal.push(`${rel}: ${m[0]}`);
      for (const m of texto.matchAll(/\b(?:icono|emoji):\s*"([^"]*)"/g)) if (!m[1] || !esIcono(m[1])) mal.push(`${rel}: ${m[0]}`);
    }
    expect(mal).toEqual([]);
  });

  it("ningún ícono se arma con una rama vacía (cond ? \"\" : …)", () => {
    const mal: string[] = [];
    for (const { rel, texto } of todos) {
      for (const m of texto.matchAll(/(?:icono|emoji|nombre)=\{[^{}]*\?\s*""\s*:|(?:icono|emoji|nombre)=\{[^{}]*:\s*""\s*\}/g)) mal.push(`${rel}: ${m[0]}`);
    }
    expect(mal).toEqual([]);
  });

  it("no queda un emoji crudo ni un ✓ ✕ ＋ de texto en el código (salvo WhatsApp y push)", () => {
    const mal: string[] = [];
    for (const { rel, texto } of todos) {
      if (SIN_EMOJI_PROPIO.has(rel)) continue;
      texto.split("\n").forEach((l, i) => { if (EMOJI.test(l)) mal.push(`${rel}:${i + 1}: ${l.trim().slice(0, 90)}`); });
    }
    expect(mal).toEqual([]);
  });
});
