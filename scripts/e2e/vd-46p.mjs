#!/usr/bin/env node
// VD-46P · Resultado por sede: si el gimnasio tiene más de una, cada sede muestra lo que se cobró, lo que se usó
// y lo que le toca repartir; lo repartido suma igual que lo cobrado; con una sola sede no aparece. Celular sin desborde.
//   node scripts/e2e/vd-46p.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const pesos = (s) => Number(s.replace(/[^\d,]/g, "").replace(",", "."));
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/resultado`);
  await d.locator("[data-resultado-cobrado]").waitFor({ timeout: 30000 });
  const seccion = d.locator("[data-por-sede]");
  if (await seccion.count()) {
    const sedes = await seccion.locator("[data-sede]").count();
    chequear(sedes >= 2, `Por sede: ${sedes} sedes con su cobrado, su uso y lo que les toca`, `hay ${sedes}`);
    const texto = await seccion.innerText();
    chequear(/Se cobró/.test(texto) && /Se usó/.test(texto) && /Para repartir/.test(texto), "cada sede dice dónde se cobró, dónde se usó y cuánto le toca", texto);
    const m = texto.match(/Lo repartido suma (\$[\d.,]+), igual que lo cobrado \((\$[\d.,]+)\)/);
    chequear(!!m && pesos(m[1]) === pesos(m[2]), "lo repartido suma igual que lo cobrado", m ? `${m[1]} vs ${m[2]}` : texto);
    await capturar(d, "vd46p-compu");
  } else ok("gimnasio de una sola sede: la sección Por sede no aparece");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/resultado`);
  await c.locator("[data-resultado-cobrado]").waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  await capturar(c, "vd46p-celu");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
