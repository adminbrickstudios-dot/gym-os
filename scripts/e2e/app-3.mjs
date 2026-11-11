#!/usr/bin/env node
// APP-3 · Historial: desde la app, "Mis pagos y cuándo vine" muestra los
// pagos y las entradas del socio.
//   npm run e2e:app-3            (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  await s.goto(`${G}/app/yo`);
  await s.locator("[data-yo-fila=historial]").click();
  await s.waitForURL(/\/app\/historial/, { timeout: 30000 });
  await s.locator("[data-historial-pagos]").waitFor({ timeout: 60000 });
  const pagos = await s.locator("[data-historial-pagos]").innerText();
  const vino = await s.locator("[data-historial-entradas]").innerText();
  chequear(/\$/.test(pagos) || /Todavía no hay pagos/.test(pagos), `pagos: ${pagos.split("\n").slice(1, 3).join(" · ")}`, pagos);
  chequear(/Entrada||Todavía no hay entradas/.test(vino), "y cuándo vino", vino);
  const ancho = await s.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
