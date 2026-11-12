#!/usr/bin/env node
// SEG-1 · F1.7 · Límite de códigos: el mismo celular pide el código 6 veces; la sexta dice "Pediste muchos códigos: esperá una hora".
// Lo mismo con "Olvidé mi contraseña": el mismo mail pide el código 6 veces y el sexto pedido lo frena (BASE-8).
//   npm run e2e:seg-1            (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, chequear, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const TEL = `000 ${String(Date.now()).slice(-7)}`;
const MAIL = `tope-${Date.now() % 1000000}@ejemplo.invalid`;
const b = await navegador();
try {
  const p = await pagina(b, CELU);
  let ultimo = "";
  for (let i = 0; i < 6; i++) {
    await p.goto(`${G}/ingresar?modo=socio`);
    // Desde BASE-2 lo primero es mail y contraseña: el código por celular está en la vía "Celular".
    if (!(await p.locator("input[name=telefono]").count())) await p.getByRole("button", { name: /Celular/ }).click();
    await p.fill("input[name=telefono]", TEL);
    await p.click('button:has-text("código")');
    // Ojo: Next pone su propio role=alert (el anunciador de rutas) fuera de <main>.
    await p.locator('main input[name=codigo], main [role="alert"]').first().waitFor({ timeout: 30000 });
    ultimo = await p.locator("main").innerText();
  }
  chequear(/Pediste muchos códigos/.test(ultimo), "el sexto pedido del mismo celular: “Pediste muchos códigos: esperá una hora”", ultimo.slice(0, 200));

  // "Olvidé mi contraseña": el mismo mail, 6 pedidos.
  let ultimoMail = "";
  for (let i = 0; i < 6; i++) {
    await p.goto(`${G}/ingresar/recuperar`);
    await p.fill("input[name=email]", MAIL);
    await p.click('button:has-text("Mandame el código")');
    await p.locator('main input[name=codigo], main [role="alert"]').first().waitFor({ timeout: 30000 });
    ultimoMail = await p.locator("main").innerText();
  }
  chequear(/Pediste muchos códigos/.test(ultimoMail), "“Olvidé mi contraseña”: el sexto pedido del mismo mail lo frena (“Pediste muchos códigos”)", ultimoMail.slice(0, 200));
  if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
