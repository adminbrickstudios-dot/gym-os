#!/usr/bin/env node
// AVI-6 · El resumen del dueño: hoy, ayer y las semanas, comparado con el
// período anterior; llega como aviso en la campana; la recepción no lo ve.
//   npm run e2e:avi-6            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  await d.getByRole("link", { name: /Resumen de hoy/ }).click();
  await d.waitForURL(/\/panel\/resumen$/, { timeout: 30000 });
  await d.locator("[data-resumen-numeros]").waitFor({ timeout: 60000 });
  const texto = await d.locator("main").innerText();
  chequear(/Cobrado/.test(texto) && /Entradas/.test(texto) && /Altas/.test(texto) && /Bajas/.test(texto), "Inicio → “📊 Resumen de hoy”: cobrado, entradas, altas y bajas", texto.slice(0, 200));
  await d.getByRole("link", { name: "Semana pasada" }).click();
  await d.waitForURL(/semana=\d{4}-\d{2}-\d{2}/, { timeout: 30000 });
  await d.getByText(/Semana del \d{2}\/\d{2} al \d{2}\/\d{2}/).first().waitFor({ timeout: 30000 });
  chequear(/contra la semana anterior|igual que la semana anterior|nuevo|socios distintos/.test(await d.locator("main").innerText()), "“Semana pasada”: siete días, comparados con la semana anterior", "sin comparación");
  await d.goto(`${G}/panel/campana`);
  await d.locator("main h1").waitFor({ timeout: 60000 });
  const aviso = d.locator('a[href^="/panel/resumen?dia="]').first();
  chequear(await aviso.count() === 1, "la campana trae “📊 Resumen de ayer/hoy”", "no está en la campana");
  chequear(await d.locator('a[href^="/panel/resumen?semana="]').count() === 1, "y el de la semana pasada", "falta el de la semana");
  await aviso.click();
  await d.waitForURL(/\/panel\/resumen\?dia=/, { timeout: 30000 });
  await d.locator("[data-resumen-numeros]").waitFor({ timeout: 60000 });
  ok("tocarlo abre ese día");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  const c = await pagina(b, CELU);
  await entrar(c, "encargado@ejemplo.invalid");
  await c.goto(`${G}/panel/resumen`);
  await c.locator("[data-resumen-numeros]").waitFor({ timeout: 60000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `el encargado en el celular, sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  await capturar(c, "avi6-celu-resumen", true);

  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/resumen`);
  await r.locator("main").waitFor({ timeout: 60000 });
  chequear(/acceso|permiso/i.test(await r.locator("main").innerText()), "la recepción no lo ve", "la recepción lo ve");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
