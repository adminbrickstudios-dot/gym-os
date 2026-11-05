#!/usr/bin/env node
// APP-6 · Novedades del gimnasio: la dueña publica una en Avisos de hoy; el
// socio la ve arriba en la app; la quita y deja de verse.
//   npm run e2e:app-6            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const TEXTO = `Prueba e2e ${Date.now() % 100000}: el lunes abrimos a las 10`;
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/avisos`);
  const caja = d.locator("[data-novedades-panel]");
  await caja.waitFor({ timeout: 60000 });
  await caja.getByPlaceholder(/abrimos a las 10/).fill(TEXTO);
  await caja.getByRole("button", { name: "Publicar" }).click();
  await caja.locator("[data-novedad]", { hasText: TEXTO }).waitFor({ timeout: 30000 });
  ok("la dueña publica la novedad en 📬 Avisos de hoy");

  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  await s.locator("[data-novedad-app]", { hasText: TEXTO }).waitFor({ timeout: 60000 });
  ok("el socio la ve arriba en la app");

  await caja.locator("[data-novedad]", { hasText: TEXTO }).getByRole("button", { name: "Quitar" }).click();
  await caja.locator("[data-novedad]", { hasText: TEXTO }).waitFor({ state: "detached", timeout: 30000 });
  await s.reload();
  await s.getByText(/Podés entrar|No podés entrar/).first().waitFor({ timeout: 60000 });
  chequear(await s.locator("[data-novedad-app]", { hasText: TEXTO }).count() === 0, "quitada: ya no aparece en la app", "sigue en la app");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
