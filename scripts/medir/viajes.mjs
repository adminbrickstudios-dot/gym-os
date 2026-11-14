#!/usr/bin/env node
// E8 · Cuenta los viajes a la base (líneas "[rpc] nombre Nms" del log de la app) que hace cada pantalla al abrirla.
//   scripts/local/levantar.sh && node scripts/medir/viajes.mjs      (lee .local/app.log)
// Sin prefetch (se abortan los pedidos de precarga: sumarían viajes de otras pantallas). Imprime una tabla
// markdown y marca con ⚠ lo que pasa de 2 viajes. No corta: la tabla es lo que se compara antes / después.
import { readFileSync, statSync } from "node:fs";
import { COMPU, GIMNASIO, entrar, entrarSocio, navegador, pagina } from "../e2e/comun.mjs";

const LOG = process.env.APP_LOG ?? ".local/app.log";
const TOPE = 2;
const PANTALLAS = ["/panel", "/panel/entrada", "/panel/socios", "/panel/vencen-hoy", "/panel/caja", "/panel/vender", "/panel/clases",
  "/panel/retencion", "/panel/transferencias", "/panel/planes", "/panel/configuracion", "/panel/pagina", "/panel/resumen",
  "/panel/tareas", "/panel/mensajes", "/panel/equipo", "/panel/control", "/panel/gastos", "/panel/profes", "/panel/prospectos"];
const ROLES = process.env.MEDIR_ROLES ? process.env.MEDIR_ROLES.split(",") : ["duena", "recepcion"];

const tamano = () => { try { return statSync(LOG).size; } catch { return 0; } };
const desde = (pos) => {
  const t = readFileSync(LOG);
  return t.subarray(pos).toString("utf8").split("\n").filter((l) => l.startsWith("[rpc] ")).map((l) => l.split(" ")[1]);
};
const sinPrecarga = (p) => p.route("**/*", (r) => {
  const h = r.request().headers();
  return h["next-router-prefetch"] || h["purpose"] === "prefetch" ? r.abort() : r.continue();
});

async function viajes(p, url) {
  await p.goto("about:blank");
  const pos = tamano();
  await p.goto(url, { waitUntil: "load", timeout: 60000 }).catch(() => null);
  await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(800);
  const lista = desde(pos);
  return { n: lista.length, nombres: lista };
}

const filas = [];
const b = await navegador();
try {
  for (const rol of ROLES) {
    const p = await pagina(b, COMPU);
    try {
      await entrar(p, `${rol}@ejemplo.invalid`);
      await sinPrecarga(p);
      for (const ruta of PANTALLAS) {
        await viajes(p, `${GIMNASIO()}${ruta}`); // la primera calienta
        const { n, nombres } = await viajes(p, `${GIMNASIO()}${ruta}`);
        filas.push({ rol, ruta, n, nombres });
      }
    } catch (e) {
      console.log(`(${rol}: ${String(e.message).split("\n")[0]})`);
    }
    await p.context().close();
  }
  const s = await pagina(b, COMPU);
  try {
    await entrarSocio(s, "+5490000100002");
    await sinPrecarga(s);
    for (const ruta of ["/app", "/app/clases"]) {
      await viajes(s, `${GIMNASIO()}${ruta}`);
      const { n, nombres } = await viajes(s, `${GIMNASIO()}${ruta}`);
      filas.push({ rol: "socio", ruta, n, nombres });
    }
  } catch (e) {
    console.log(`(socio: ${String(e.message).split("\n")[0]})`);
  }
  await s.context().close();
} finally {
  await b.close();
}

console.log(`| Rol | Pantalla | Viajes | Cuáles |\n|---|---|---|---|`);
for (const f of filas) {
  const cuenta = {};
  for (const x of f.nombres) cuenta[x] = (cuenta[x] ?? 0) + 1;
  const det = Object.entries(cuenta).map(([k, v]) => (v > 1 ? `${k} ×${v}` : k)).join(", ");
  console.log(`| ${f.rol} | ${f.ruta} | ${f.n}${f.n > TOPE ? " ⚠" : ""} | ${det} |`);
}
const pasan = filas.filter((f) => f.n > TOPE);
console.log(`\n${pasan.length} de ${filas.length} pantallas pasan de ${TOPE} viajes.`);
