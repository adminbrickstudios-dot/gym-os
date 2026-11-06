#!/usr/bin/env node
// VD-1b · La ventana de Entrada: (1) con F se abre la ficha y su "Volver" regresa a la ventana con el
// mismo socio; (2) el dueño con varias sedes elige en cuál anota (queda en esta compu).
//   node scripts/e2e/vd-1b.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  // ── 1 · F abre la ficha y Volver regresa con el mismo socio ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios`);
  await d.locator('main ul a[href^="/panel/socios/"]').first().waitFor({ timeout: 30000 });
  await d.keyboard.press("F2");
  await d.locator("[data-ventana-campo]").fill("Testigo Al");
  await d.locator("button.fila", { hasText: "Al Día" }).first().click();
  const ver = d.locator("[data-ventana-veredicto]");
  await ver.waitFor({ timeout: 30000 });
  const nombre = (await d.locator("[data-ventana-veredicto] .titular").first().innerText()).trim();
  await d.keyboard.press("f");
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}\?desde=entrada/, { timeout: 30000 });
  ok("F abre la ficha del socio de la ventana");
  const volver = d.locator("[data-volver-entrada]");
  await volver.waitFor({ timeout: 30000 });
  chequear(/Volver a la Entrada/.test(await volver.innerText()), "la ficha ofrece “Volver a la Entrada con …”", "no hay Volver a la Entrada");
  await capturar(d, "vd1b-compu-ficha");
  await volver.click();
  await d.waitForURL(/\/panel\/socios$/, { timeout: 30000 });
  await d.locator("[data-ventana-veredicto]").waitFor({ timeout: 30000 });
  const otra = (await d.locator("[data-ventana-veredicto] .titular").first().innerText()).trim();
  chequear(otra === nombre, `Volver regresa a donde estabas y la ventana se abre con el mismo socio (${nombre})`, `volvió con “${otra}” en vez de “${nombre}”`);
  await capturar(d, "vd1b-compu-volvio");
  await d.keyboard.press("Escape");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
  await d.context().close();

  // ── 2 · El dueño con varias sedes elige la sede de la ventana ──
  const B = GIMNASIO("demo-box");
  const x = await pagina(b, COMPU);
  await entrar(x, "box@ejemplo.invalid", undefined, B);
  await x.goto(`${B}/panel/configuracion`);
  await x.locator("[data-sumar-sede]").waitFor({ timeout: 60000 });
  if (await x.locator("[data-sede]").count() < 2) {
    await x.locator("[data-sumar-sede]").click();
    await x.locator("[data-sumar-sede-form] input").fill("Sucursal VD1b");
    await x.locator('[data-sumar-sede-form] button[type="submit"]').click();
    await x.locator("[data-sede]").nth(1).waitFor({ timeout: 30000 });
  }
  await x.goto(`${B}/panel/socios`);
  await x.locator("main").waitFor({ timeout: 30000 });
  await x.keyboard.press("F2");
  const sedes = x.locator("[data-ventana-sedes] button");
  await sedes.first().waitFor({ timeout: 30000 });
  chequear(await sedes.count() >= 2, `la ventana muestra las ${await sedes.count()} sedes para elegir`, "no aparece el selector de sede");
  const segunda = sedes.nth(1);
  await segunda.click();
  chequear(await segunda.getAttribute("aria-pressed") === "true", "la sede elegida queda marcada", "no quedó marcada");
  await capturar(x, "vd1b-compu-sedes");
  await x.keyboard.press("Escape");
  await x.reload();
  await x.locator("main").waitFor({ timeout: 30000 });
  await x.keyboard.press("F2");
  await x.locator("[data-ventana-sedes] button").first().waitFor({ timeout: 30000 });
  chequear(await x.locator("[data-ventana-sedes] button").nth(1).getAttribute("aria-pressed") === "true", "y se acuerda de la elección en esta compu", "se olvidó de la sede");
  if (x.errores.length) falla(`dueño box: ${x.errores.join(" | ")}`);
  await x.context().close();

  // ── La recepción (sede fija) no ve el selector; el celular sin desbordes ──
  const c = await pagina(b, CELU);
  await entrar(c, "recepcion@ejemplo.invalid");
  await c.goto(`${G}/panel/socios`);
  await c.locator("main").waitFor({ timeout: 30000 });
  await c.locator("[data-boton-ventana]").click();
  await c.locator("[data-ventana-campo]").waitFor({ timeout: 30000 });
  chequear(await c.locator("[data-ventana-sedes]").count() === 0, "la recepción (con su sede) no ve selector de sede", "la recepción ve el selector");
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular sin desborde (${ancho}px)`, `mide ${ancho}px`);
  if (c.errores.length) falla(`recepción celu: ${c.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
