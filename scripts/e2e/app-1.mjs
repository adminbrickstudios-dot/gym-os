#!/usr/bin/env node
// APP-1 · Instalable: en un iPhone (sin instalar) la app explica cómo
// agregarla al inicio; "Ahora no" la esconde y no vuelve.
//   npm run e2e:app-1            (con scripts/local/levantar.sh corriendo)
import { devices } from "playwright";
import { CELU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const { userAgent, isMobile, hasTouch } = devices["iPhone 13"];
  const s = await pagina(b, CELU, { userAgent, isMobile, hasTouch });
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  const aviso = s.locator('[data-instalar="iphone"]');
  await aviso.waitFor({ timeout: 60000 });
  chequear(/Compartir.+Agregar a inicio/.test(await aviso.innerText()), "en iPhone: “tocá Compartir y después Agregar a inicio”", await aviso.innerText());
  await aviso.getByRole("button", { name: "No mostrar más" }).click();
  await aviso.waitFor({ state: "detached", timeout: 10000 });
  await s.reload();
  await s.locator("main").waitFor({ timeout: 60000 });
  await s.waitForTimeout(1500);
  chequear(await s.locator("[data-instalar]").count() === 0, "“Ahora no”: no vuelve a aparecer", "volvió a aparecer");
  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
