#!/usr/bin/env node
// COM-5 · Retención en números: en Retención y en Resultado, el neto del mes,
// cuántos de los que entraron hace 3 meses siguen y cuántos vienen poco; cada
// número abre la lista con nombres. La recepción no lo ve.
//   npm run e2e:com-5            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/retencion`);
  const caja = d.locator("[data-retencion-numeros]");
  await caja.waitFor({ timeout: 60000 });
  const textos = (await caja.locator("summary").allInnerTexts()).map((x) => x.replace(/\s+/g, " "));
  chequear(textos.length === 3 && /Neto del mes/.test(textos[0]) && /siguen al día|Nadie se anotó/.test(textos[1]) && /menos de 4 días/.test(textos[2]),
    `Retención en números: ${textos.map((x) => x.slice(0, 50)).join(" | ")}`, textos.join(" | "));
  await caja.locator('[data-numero="pocas"] summary').click();
  const n = await caja.locator('[data-numero="pocas"] li').count();
  chequear(n > 0 ? await caja.locator('[data-numero="pocas"] li a').count() > 0 : true, `tocar el número abre la lista con nombres (${n})`, "la lista no tiene nombres");
  await capturar(d, "com5-compu-retencion");
  await d.goto(`${G}/panel/resultado`);
  chequear(await aparece(d.locator("[data-retencion-numeros]"), 60000), "y en Resultado (mes en curso), en “Socios”", "Resultado no muestra los números");
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/retencion`);
  await r.locator("main h1").waitFor({ timeout: 60000 });
  chequear(await r.locator("[data-retencion-numeros]").count() === 0, "la recepción no los ve (D2)", "la recepción ve los números");
  for (const p of [d, r]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
