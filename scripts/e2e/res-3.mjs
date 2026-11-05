#!/usr/bin/env node
// RES-3 · Gastos y ganancia: la dueña agrega un gasto, la ganancia baja lo
// mismo, lo quita y vuelve; el encargado no ve los gastos (hay sueldos).
//   npm run e2e:res-3            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const pesos = (t) => Number(t.replace(/[^\d,−-]/g, "").replace(",", ".").replace("−", "-"));
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/resultado`);
  const gan = d.locator("[data-ganancia]");
  await gan.waitFor({ timeout: 60000 });
  const leer = async () => { const t = await gan.innerText(); return (/pérdida/.test(t) ? -1 : 1) * Math.abs(pesos(t.split(" de ")[0])); };
  const antes = await leer();
  const antesTxt = (await gan.innerText()).split(" ")[0];
  const detalle = `Prueba e2e ${Date.now() % 100000}`;
  await d.locator("[data-gastos] select").selectOption("otros");
  await d.getByLabel("Detalle (opcional)").fill(detalle);
  await d.getByLabel("Monto").fill("1.234,50");
  await d.locator("[data-gastos] button[type=submit]").click();
  const fila = d.locator("[data-gastos] li", { hasText: detalle });
  await fila.waitFor({ timeout: 30000 });
  await d.waitForFunction((a) => { const t = document.querySelector("[data-ganancia]")?.textContent ?? ""; return !t.startsWith(a); }, antesTxt, { timeout: 30000 });
  const despues = await leer();
  chequear(Math.abs((antes - despues) - 1234.5) < 0.01, `gasto “${detalle}” de $1.234,50: la ganancia baja lo mismo`, `${antes} → ${despues}`);
  await fila.getByRole("button", { name: /Quitar/ }).click();
  await fila.waitFor({ state: "detached", timeout: 30000 });
  let vuelta = await leer();
  for (let i = 0; i < 20 && Math.abs(vuelta - antes) >= 0.01; i++) { await d.waitForTimeout(500); vuelta = await leer(); }
  chequear(Math.abs(vuelta - antes) < 0.01, "“Quitar” lo saca y la ganancia vuelve a la de antes (en la base queda anulado)", `${antes} → ${vuelta}`);
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  const e = await pagina(b, CELU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel/resultado`);
  await e.locator("[data-resultado-cobrado]").waitFor({ timeout: 60000 });
  chequear(await e.locator("[data-gastos]").count() === 0, "el encargado ve el Resultado pero no los gastos", "el encargado ve gastos");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
