#!/usr/bin/env node
// Pase 2.0 · vuelta chica post-clásico (26/11): EL ACENTO "LEGIBLE" DE PISTA LLEGA A LAS PANTALLAS.
// Pista corre el color del gimnasio lo justo para que se lea con 4,5:1 sobre sus superficies (acentoLegible en src/lib/marca.ts), en oscuro
// y en claro. Acá se mira lo que de verdad se pinta: con el acento de Temple Gym (#1AA316, el de su página pública) y uno claro (#FBBF24)
// puestos en el [demo] de la base local, en el panel, la página del gimnasio y la app del socio, el color que usa --acento contra la
// tarjeta, la tarjeta alta y el fondo tiene que dar 4,5:1 o más, en los dos modos (cookie `tema`).
//   node scripts/e2e/acento-legible.mjs      (con scripts/local/levantar.sh corriendo; deja el acento del demo como estaba)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, chequear, entrar, entrarSocio, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ gid, antes }] = (await db.query(`select g.id gid, c.color_acento antes from public.gimnasios g join public.configuracion_gimnasio c on c.gimnasio_id = g.id where g.slug = 'demo'`)).rows;
const ACENTOS = ["#1AA316", "#FBBF24"];
const PANTALLAS = [["duena", "/panel"], ["duena", "/panel/socios"], ["publico", "/"], ["socio", "/app"]];

/** El acento que se pinta y las superficies, medidos con una muestra dentro del envoltorio de la marca (los colores ya resueltos). */
function medir() {
  const el = document.querySelector("[data-tono]");
  if (!el) return null;
  const muestra = document.createElement("span");
  el.appendChild(muestra);
  const leer = (prop) => { muestra.style.color = `var(${prop})`; return getComputedStyle(muestra).color; };
  const r = { acento: leer("--acento"), tarjeta: leer("--tarjeta"), alta: leer("--tarjeta-alta"), fondo: leer("--fondo"), crudo: getComputedStyle(el).getPropertyValue("--acento-pista-oscuro").trim() };
  muestra.remove();
  return r;
}
const rgb = (c) => c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contraste = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const b = await navegador();
try {
  const crudoDePagina = async () => { const p = await pagina(b, COMPU); await p.goto(`${G}/`, { waitUntil: "load", timeout: 90000 }); const m = await p.evaluate(medir); await p.context().close(); return m?.crudo ?? null; };
  for (const acento of ACENTOS) {
    const base = await crudoDePagina();
    const n = await db.query(`update public.configuracion_gimnasio set color_acento = $2 where gimnasio_id = $1`, [gid, acento]);
    if (n.rowCount !== 1) throw new Error("no se pudo poner el acento en el demo");
    ok(`acento del demo: ${acento}`);
    // Se espera a que la página del gimnasio muestre la marca nueva (vence en 60 s) y se anota cómo quedó.
    let nuevo = base;
    for (let i = 0; i < 24 && nuevo === base; i++) { if (i) await new Promise((r) => setTimeout(r, 5000)); nuevo = await crudoDePagina(); }
    if (nuevo === base) { falla(`la página del demo no tomó el acento ${acento} en 2 minutos`); continue; }
    for (const modo of ["oscuro", "claro"]) {
      for (const rol of ["duena", "publico", "socio"]) {
        const p = await pagina(b, COMPU);
        if (rol === "duena") await entrar(p, "duena@ejemplo.invalid");
        else if (rol === "socio") await entrarSocio(p, "+5490000100002");
        await p.context().addCookies([{ name: "tema", value: modo, url: G }]);
        for (const [, ruta] of PANTALLAS.filter(([r]) => r === rol)) {
          // La marca del gimnasio se guarda hasta 60 s: se recarga hasta que la pantalla tenga la marca nueva (la misma que ya muestra la página).
          let m = null;
          for (let i = 0; i < 24 && m?.crudo !== nuevo; i++) {
            if (i) await p.waitForTimeout(5000);
            await p.goto(`${G}${ruta}`, { waitUntil: "load", timeout: 90000 });
            m = await p.evaluate(medir);
          }
          if (m && m.crudo !== nuevo) falla(`${ruta} (${modo}, ${acento}): la pantalla no tomó la marca nueva en 2 minutos`);
          chequear(await p.evaluate(() => document.documentElement.dataset.modo) === modo, `${ruta} abre en modo ${modo}`, `${ruta} no abrió en modo ${modo}`);
          if (!m) { falla(`${ruta} (${modo}, ${acento}): no hay envoltorio de la marca [data-tono]`); continue; }
          const peor = Math.min(contraste(m.acento, m.tarjeta), contraste(m.acento, m.alta), contraste(m.acento, m.fondo));
          chequear(peor >= 4.5, `${ruta} (${modo}, ${acento}): el acento que se pinta (${m.acento}) se lee con ${peor.toFixed(2)}:1 o más`,
            `${ruta} (${modo}, ${acento}): el acento que se pinta (${m.acento}) da ${peor.toFixed(2)}:1 contra tarjeta ${m.tarjeta}, tarjeta alta ${m.alta} o fondo ${m.fondo} (mínimo 4,5:1)`);
        }
        await p.context().close();
      }
    }
  }
} finally {
  await db.query(`update public.configuracion_gimnasio set color_acento = $2 where gimnasio_id = $1`, [gid, antes]);
  await db.end();
  await b.close();
}
resultado();
