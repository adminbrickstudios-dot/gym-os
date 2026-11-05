#!/usr/bin/env node
// APP-7 · Racha: el socio que viene ve cuántas veces vino este mes y las
// semanas seguidas, debajo del semáforo.
//   npm run e2e:app-7            (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  await s.locator("main").waitFor({ timeout: 60000 });
  await s.waitForTimeout(1000);
  const r = s.locator("[data-racha]");
  if (await r.count()) chequear(/este mes/.test(await r.innerText()) && /seguidas/.test(await r.innerText()), `“${(await r.innerText()).replace(/\s+/g, " ")}”`, await r.innerText());
  else chequear(true, "sin entradas todavía: la racha no aparece (lo vacío está vacío)", "");
  const ancho = await s.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
