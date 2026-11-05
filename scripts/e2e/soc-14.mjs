#!/usr/bin/env node
// SOC-14 · La ficha dice cómo llegó: el del mostrador dice quién lo dio de
// alta; el que se anotó desde la página (de reg-1) dice qué reglamento
// aceptó y se puede ver el texto de esa versión.
//   npm run e2e:soc-14           (con scripts/local/levantar.sh corriendo; después de e2e:reg-1)
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s = Date.now().toString().slice(-5);
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "recepcion@ejemplo.invalid");
  await p.goto(`${G}/panel/socios/nuevo`);
  await p.locator('input[name="nombre"]').fill(`Mostrador${s}`);
  await p.locator('button:has-text("Dar de alta")').first().click();
  await p.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}/, { timeout: 30000 });
  const o = p.locator("[data-origen]");
  await o.waitFor({ timeout: 30000 });
  chequear(/Lo dio de alta Ana en el mostrador el \d+\/\d+/.test(await o.innerText()), `mostrador: “${(await o.innerText()).trim()}”`, `dice: ${await o.innerText()}`);

  await p.goto(`${G}/panel/socios?q=Online`);
  const fila = p.locator('main ul a[href^="/panel/socios/"]').first();
  if (!(await fila.count())) throw new Error("no hay socios anotados desde la página: corré antes e2e:reg-1");
  await fila.click();
  await p.locator('[data-origen="alta_web"]').waitFor({ timeout: 30000 });
  const t = await p.locator("[data-origen]").innerText();
  chequear(/Se anotó solo desde la página/.test(t) && /Aceptó el reglamento \(versión \d+\)/.test(t), "alta online: cómo llegó y qué versión del reglamento aceptó", `dice: ${t}`);
  await p.locator('a:has-text("Ver lo que aceptó")').click();
  await p.locator("[data-texto-reglamento]").waitFor({ timeout: 30000 });
  chequear((await p.locator("[data-texto-reglamento]").innerText()).length > 20, "“Ver lo que aceptó” muestra el texto de esa versión", "no muestra el texto");
  if (p.errores.length) falla(`recepción: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
