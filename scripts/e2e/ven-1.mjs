#!/usr/bin/env node
// VEN-1 · Comprobante de pago por WhatsApp: se le cobra un agua a un socio y
// "🧾 Mandar comprobante por WhatsApp" abre su chat con el texto armado (el
// mensaje editable de Configuración → Mensajes).
//   npm run e2e:ven-1            (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, capturar, chequear, entrar, esperarCobro, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const r = await pagina(b, CELU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios?q=${encodeURIComponent("Testigo Al Día")}`);
  const id = (await r.locator('main ul a[href^="/panel/socios/"]').first().getAttribute("href")).split("/").pop();
  await r.goto(`${G}/panel/vender?socio=${id}`);
  await r.locator("main button", { hasText: "Agua 500 ml" }).click();
  await r.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await r.locator('button:has-text("✅ Cobrar")').click();
  await esperarCobro(r);
  const a = r.locator("a[data-comprobante]");
  await a.waitFor({ timeout: 30000 });
  const href = decodeURIComponent(await a.getAttribute("href"));
  chequear(/^https:\/\/wa\.me\/549000\d+\?text=Hola Testigo! Recibimos tu pago de \$1\.500 en .+ \(Agua 500 ml, \d\d\/\d\d\)\./.test(href), "“🧾 Mandar comprobante” abre su WhatsApp con el texto armado", href);
  await capturar(r, "ven1-celu-comprobante");
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
