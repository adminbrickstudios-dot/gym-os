#!/usr/bin/env node
// Medir tiempos (VD-47): abre las pantallas clave con cada rol contra la app local
// (scripts/local/levantar.sh) y anota cuánto tarda hasta ver contenido.
//   npm run medir            (con levantar.sh corriendo)
// Imprime una tabla markdown. NO corta: si algo pasa del presupuesto, avisa
// (1 s en compu, 1,5 s en celular) y sale con 0.
import { CELU, COMPU, GIMNASIO, entrar, entrarSocio, navegador, pagina } from "../e2e/comun.mjs";

const PRESUPUESTO = { compu: 1000, celu: 1500 };
const PANTALLAS = ["/panel", "/panel/entrada", "/panel/socios", "/panel/vencen-hoy", "/panel/caja", "/panel/vender", "/panel/clases",
  "/panel/retencion", "/panel/transferencias", "/panel/planes", "/panel/configuracion", "/panel/pagina", "/panel/resumen", "/panel/tareas"];
const ROLES = process.env.MEDIR_ROLES ? process.env.MEDIR_ROLES.split(",") : ["duena", "encargado", "recepcion", "profe"];
const TAMANOS = [["compu", COMPU], ["celu", CELU]].filter(([t]) => !process.env.MEDIR_SOLO_COMPU || t === "compu");

/** Tiempo (ms) desde pedir la dirección hasta que hay un título o texto visible en <main>/<body>. */
async function medir(p, url) {
  const t0 = Date.now();
  const r = await p.goto(url, { waitUntil: "commit", timeout: 60000 }).catch(() => null);
  await p.waitForFunction(() => {
    const m = document.querySelector("main") ?? document.body;
    return m && !m.querySelector('[aria-busy="true"]') && (m.innerText ?? "").trim().length > 20;
  }, null, { timeout: 30000 }).catch(() => {});
  return { ms: Date.now() - t0, estado: r?.status() ?? 0 };
}

const filas = [];
const b = await navegador();
try {
  for (const [tam, viewport] of TAMANOS) {
    for (const rol of ROLES) {
      const p = await pagina(b, viewport);
      try {
        await entrar(p, `${rol}@ejemplo.invalid`);
        // Primera vuelta en frío (compila / calienta), segunda es la que se anota.
        for (const ruta of PANTALLAS) {
          await medir(p, `${GIMNASIO()}${ruta}`);
          const { ms, estado } = await medir(p, `${GIMNASIO()}${ruta}`);
          filas.push({ rol, tam, ruta, ms, estado });
        }
      } catch (e) {
        console.log(`(${rol} · ${tam}: ${String(e.message).split("\n")[0]})`);
      }
      await p.context().close();
    }
    // App del socio.
    const s = await pagina(b, viewport);
    try {
      await entrarSocio(s, "+5490000100002");
      for (const ruta of ["/app", "/app/clases"]) {
        await medir(s, `${GIMNASIO()}${ruta}`);
        const { ms, estado } = await medir(s, `${GIMNASIO()}${ruta}`);
        filas.push({ rol: "socio", tam, ruta, ms, estado });
      }
    } catch (e) {
      console.log(`(socio · ${tam}: ${String(e.message).split("\n")[0]})`);
    }
    await s.context().close();
  }
} finally {
  await b.close();
}

console.log("\n| Rol | Tamaño | Pantalla | ms hasta ver contenido | Estado | Presupuesto |");
console.log("|---|---|---|---:|---:|---|");
let pasadas = 0;
for (const f of filas) {
  const pasa = f.ms <= PRESUPUESTO[f.tam];
  if (!pasa) pasadas++;
  console.log(`| ${f.rol} | ${f.tam} | ${f.ruta} | ${f.ms} | ${f.estado} | ${pasa ? "ok" : "PASADO"} |`);
}
const mediana = (xs) => xs.length ? xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0;
for (const tam of ["compu", "celu"]) console.log(`\nMediana ${tam}: ${mediana(filas.filter((f) => f.tam === tam).map((f) => f.ms))} ms`);
console.log(pasadas ? `\nAVISO: ${pasadas} de ${filas.length} medidas pasan del presupuesto (no corta).` : `\nTodas las ${filas.length} medidas dentro del presupuesto.`);
process.exitCode = 0;
