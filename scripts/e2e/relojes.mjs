#!/usr/bin/env node
// Cacería (Mateo, 16/11) · Los relojes que preguntan solos. Cuántos pedidos al servidor hace una recepción QUIETA (sin tocar nada) en un minuto,
// con la pestaña a la vista y con la pestaña escondida (que no debería preguntar nada). Los números salen en la corrida; el tope es lo medido y no sube.
//   node scripts/e2e/relojes.mjs      (con scripts/local/levantar.sh corriendo; en modo compilado los números son los reales)
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const MINUTO = 62000;
const TOPE_A_LA_VISTA = Number(process.env.TOPE_RELOJES_VISTA ?? 14);   // pedidos por minuto, recepción quieta con la pestaña a la vista
const TOPE_ESCONDIDA = Number(process.env.TOPE_RELOJES_ESCONDIDA ?? 1);   // con la pestaña escondida
const b = await navegador();
try {
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel`);
  await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
  await r.waitForLoadState("networkidle").catch(() => {});
  const pedidos = [];
  r.on("request", (q) => {
    const u = new URL(q.url());
    if (u.origin !== new URL(G).origin) return;
    if (/^\/_next\/(static|image)|\.(png|jpg|svg|woff2?|ico|css|js|map)$/.test(u.pathname)) return;
    pedidos.push(`${q.method()} ${u.pathname}${u.search.includes("_rsc") ? " (_rsc)" : ""}`);
  });
  await r.waitForTimeout(MINUTO);
  const cuenta = (lista) => Object.entries(lista.reduce((c, x) => ({ ...c, [x]: (c[x] ?? 0) + 1 }), {})).map(([k, v]) => `${k} ×${v}`).join(", ");
  console.log(`A LA VISTA · ${pedidos.length} pedidos en ${MINUTO / 1000} s: ${cuenta(pedidos)}`);
  chequear(pedidos.length <= TOPE_A_LA_VISTA, `recepción quieta con la pestaña a la vista: ${pedidos.length} pedidos por minuto (tope ${TOPE_A_LA_VISTA})`, `recepción quieta: ${pedidos.length} pedidos por minuto, el tope es ${TOPE_A_LA_VISTA}: ${cuenta(pedidos)}`);

  // Pestaña escondida: lo que se pregunta solo se calla.
  await r.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  const antes = pedidos.length;
  await r.waitForTimeout(MINUTO);
  const escondida = pedidos.slice(antes);
  console.log(`ESCONDIDA · ${escondida.length} pedidos en ${MINUTO / 1000} s: ${cuenta(escondida)}`);
  chequear(escondida.length <= TOPE_ESCONDIDA, `pestaña escondida: ${escondida.length} pedidos por minuto (tope ${TOPE_ESCONDIDA})`, `pestaña escondida: ${escondida.length} pedidos por minuto, el tope es ${TOPE_ESCONDIDA}: ${cuenta(escondida)}`);
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.stack : e.message.split("\n")[0]}`);
}
await b.close();
ok("fin de la medición de relojes");
resultado();
