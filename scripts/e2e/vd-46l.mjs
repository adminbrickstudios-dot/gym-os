#!/usr/bin/env node
// VD-46L · Resultado muestra "Lo que les debés a los socios" (packs con usos + cuotas por adelantado)
// solo en el mes en curso; el celular no desborda; el mes pasado no la muestra.
//   node scripts/e2e/vd-46l.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/resultado`);
  await d.locator("[data-deuda-socios]").waitFor({ timeout: 30000 });
  const texto = await d.locator("[data-deuda-socios]").innerText();
  chequear(/Lo que les debés a los socios/.test(texto), "Resultado: la tarjeta “Lo que les debés a los socios”", texto);
  chequear(/Se valúa a lo que pagó/.test(texto) || /no le debés servicio a nadie/.test(texto), "explica cómo se calcula (o dice que no se debe nada)", texto);
  await capturar(d, "vd46l-compu");
  const previo = new Date(); previo.setMonth(previo.getMonth() - 1);
  await d.goto(`${G}/panel/resultado?mes=${previo.toISOString().slice(0, 7)}`);
  await d.locator("[data-resultado-cobrado]").waitFor({ timeout: 30000 });
  chequear(await d.locator("[data-deuda-socios]").count() === 0, "en un mes pasado no se muestra (es una foto de hoy)", "aparece en el mes pasado");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  const c = await pagina(b, CELU);
  await entrar(c, "encargado@ejemplo.invalid");
  await c.goto(`${G}/panel/resultado`);
  const hay = await c.locator("[data-deuda-socios]").count();
  if (hay) {
    const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
    chequear(ancho <= CELU.width, `celular sin desborde (${ancho}px)`, `desborda: ${ancho}`);
    await capturar(c, "vd46l-celu");
  } else ok("el encargado sin permiso de Resultado no la ve (la base lo exige)");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
