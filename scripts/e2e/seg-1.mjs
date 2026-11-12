#!/usr/bin/env node
// SEG-1 · Límite de códigos: el mismo celular pide el código 6 veces; la sexta
// dice "Pediste muchos códigos: esperá una hora".
//   npm run e2e:seg-1            (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, chequear, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const TEL = `000 ${String(Date.now()).slice(-7)}`;
const b = await navegador();
try {
  const p = await pagina(b, CELU);
  let ultimo = "";
  for (let i = 0; i < 6; i++) {
    await p.goto(`${G}/ingresar?modo=socio`);
    // D43: lo primero es mail y contraseña; el código por celular está en la vía "Celular".
    if (!(await p.locator("input[name=telefono]").count())) await p.getByRole("button", { name: /Celular/ }).click();
    await p.fill("input[name=telefono]", TEL);
    await p.click('button:has-text("código")');
    // Ojo: Next pone su propio role=alert (el anunciador de rutas) fuera de <main>.
    await p.locator('main input[name=codigo], main [role="alert"]').first().waitFor({ timeout: 30000 });
    ultimo = await p.locator("main").innerText();
  }
  chequear(/Pediste muchos códigos/.test(ultimo), "el sexto pedido del mismo celular: “Pediste muchos códigos: esperá una hora”", ultimo.slice(0, 200));
  if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
