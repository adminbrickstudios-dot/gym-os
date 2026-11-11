import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { CAPTURAS, GUIAS, MAXIMO_PASOS, guiasDeRolPanel, pasosVisibles } from "./guias";
import { SECCIONES, seccionesPara } from "./panel/secciones";

const EMOJI = /\p{Extended_Pictographic}/u;
const FRASES_DE_IA = /experiencia [uú]nica|siguiente nivel|sin complicaciones|potenci[aá]|soluci[oó]n integral|revolucion|de la mejor manera/i;

test("cada guía tiene entre 1 y 10 pasos, con id único", () => {
  for (const g of GUIAS) {
    expect(g.pasos.length, g.rol).toBeGreaterThan(0);
    expect(g.pasos.length, g.rol).toBeLessThanOrEqual(MAXIMO_PASOS);
    expect(new Set(g.pasos.map((p) => p.id)).size, g.rol).toBe(g.pasos.length);
  }
});

test("los textos no llevan emojis ni frases de IA", () => {
  for (const g of GUIAS) for (const t of [g.titulo, g.paraQuien, g.bajada, ...g.pasos.flatMap((p) => [p.titulo, p.texto])]) {
    expect(EMOJI.test(t), t).toBe(false);
    expect(FRASES_DE_IA.test(t), t).toBe(false);
  }
});

test("toda captura pedida está en la lista que usa el script, y es del mismo rol", () => {
  const lista = new Map(CAPTURAS.map((c) => [c.archivo, c]));
  expect(lista.size).toBe(CAPTURAS.length);
  for (const g of GUIAS) for (const p of g.pasos) if (p.captura) {
    expect(lista.get(p.captura), `${g.rol}/${p.id}`).toBeTruthy();
    expect(lista.get(p.captura)!.rol).toBe(g.rol);
  }
  // y la inversa: no se sacan capturas que ningún paso usa
  const usadas = new Set(GUIAS.flatMap((g) => g.pasos.map((p) => p.captura)));
  for (const c of CAPTURAS) expect(usadas.has(c.archivo), c.archivo).toBe(true);
});

test("la captura de un paso del panel abre una ruta que existe en el panel o en la ayuda", () => {
  const rutas = new Set(SECCIONES.map((s) => s.ruta.split("?")[0]));
  for (const c of CAPTURAS.filter((x) => x.rol !== "socio")) {
    const r = c.ruta.split("?")[0];
    const existe = rutas.has(r) || r === "/panel/socios/nuevo" || r === "/panel/ayuda/carteles";
    expect(existe, c.ruta).toBe(true);
    expect(existsSync(join(process.cwd(), "src/app", r, "page.tsx")), c.ruta).toBe(true);
  }
  for (const c of CAPTURAS.filter((x) => x.rol === "socio")) {
    expect(existsSync(join(process.cwd(), "src/app", c.ruta.split("?")[0], "page.tsx")), c.ruta).toBe(true);
  }
});

test("los destinos y las secciones de los pasos existen", () => {
  const claves = new Set(SECCIONES.map((s) => s.clave));
  for (const g of GUIAS) for (const p of g.pasos) {
    if (p.seccion) expect(claves.has(p.seccion), `${g.rol}/${p.id}: sección ${p.seccion}`).toBe(true);
    if (p.destino) expect(existsSync(join(process.cwd(), "src/app", p.destino.ruta.split("?")[0], "page.tsx")), p.destino.ruta).toBe(true);
  }
});

test("una sección apagada saca el paso; sin links no hay botones", () => {
  const rec = GUIAS.find((g) => g.rol === "recepcion")!;
  const todas = new Set(seccionesPara("recepcion", []).map((s) => s.clave));
  const sinCaja = new Set(seccionesPara("recepcion", ["caja"]).map((s) => s.clave));
  expect(pasosVisibles(rec, todas, true).map((p) => p.id)).toContain("caja-abrir");
  expect(pasosVisibles(rec, sinCaja, true).map((p) => p.id)).not.toContain("caja-abrir");
  expect(pasosVisibles(rec, sinCaja, true).map((p) => p.id)).not.toContain("caja-cerrar");
  expect(pasosVisibles(rec, todas, false).every((p) => !p.destino)).toBe(true);
});

test("cada guía tiene sus pasos con todas las secciones prendidas para el rol que la usa", () => {
  const rolPanel = { recepcion: "recepcion", dueno: "dueno", profe: "profe", socio: "dueno" } as const;
  for (const g of GUIAS) {
    const v = new Set(seccionesPara(rolPanel[g.rol], []).map((s) => s.clave));
    expect(pasosVisibles(g, v, true).length, g.rol).toBe(g.pasos.length);
  }
});

test("quién abre qué guía", () => {
  expect(guiasDeRolPanel("dueno")).toEqual(["recepcion", "dueno", "profe", "socio"]);
  expect(guiasDeRolPanel("recepcion")).toEqual(["recepcion", "socio"]);
  expect(guiasDeRolPanel("profe")).toEqual(["profe"]);
});
