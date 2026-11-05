#!/usr/bin/env node
// SOC-2 · Ficha en pestañas: Resumen, Pagos, Asistencia (calendario del mes,
// mes anterior, racha) y Notas; recepción no ve Pagos; celular sin desborde.
//   npm run e2e:soc-2            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  // Un socio que viene seguido: el primero de la lista de "al día" con entradas.
  await p.goto(`${G}/panel/socios`);
  const fila = p.locator('main a[href^="/panel/socios/"]', { hasText: "Al día" }).first();
  await fila.waitFor({ timeout: 30000 });
  const ficha = new URL(await fila.getAttribute("href"), G).toString();
  await p.goto(ficha);
  await p.locator("h1").waitFor();
  const tabs = await p.locator('nav, [role="tablist"]').locator("a.pestana").allInnerTexts();
  chequear(tabs.map((t) => t.replace(/\W/g, "")).join(",") === "Resumen,Pagos,Asistencia,Notas", `pestañas: ${tabs.join(" · ")}`, `pestañas: ${tabs.join(" | ")}`);
  chequear(await p.locator("main", { hasText: "Últimas entradas" }).count() > 0, "Resumen: plan, contacto y últimas entradas", "Resumen incompleto");

  await p.locator('a.pestana:has-text("Pagos")').click();
  await p.waitForURL(/pestana=pagos/);
  await p.locator("main h2", { hasText: "Pagos" }).waitFor({ timeout: 30000 });
  ok(`Pagos: ${await p.locator("main li.tarjeta").count()} pagos`);

  await p.locator('a.pestana:has-text("Asistencia")').click();
  await p.waitForURL(/pestana=asistencia/);
  const asis = p.locator("[data-asistencia]");
  await asis.waitFor({ timeout: 30000 });
  const veces = Number(await asis.getAttribute("data-asistencia"));
  const marcados = await p.locator("[data-vino]").count();
  chequear(marcados === veces, `Asistencia: ${veces} veces este mes, ${marcados} días marcados en el calendario`, `dice ${veces} y marca ${marcados}`);
  await capturar(p, "soc2-compu-asistencia");
  await p.locator('a[aria-label="Mes anterior"]').click();
  await p.waitForURL(/mes=\d{4}-\d{2}/);
  await p.locator("[data-asistencia]").waitFor();
  ok(`◀ mes anterior: ${await p.locator("[data-asistencia]").getAttribute("data-asistencia")} veces`);

  await p.locator('a.pestana:has-text("Notas")').click();
  await p.locator("[data-notas]").waitFor({ timeout: 30000 });
  chequear(await p.locator('[data-notas] a:has-text("nota")').count() === 1, "Notas: la nota y el botón para escribirla", "Notas sin botón");
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
  await p.context().close();

  const r = await pagina(b, CELU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${ficha}?pestana=asistencia`);
  await r.locator("[data-asistencia]").waitFor({ timeout: 30000 });
  chequear(await r.locator('a.pestana:has-text("Pagos")').count() === 0, "recepción: sin la pestaña Pagos", "recepción ve Pagos");
  const ancho = await r.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular: asistencia sin desborde (${ancho}px)`, `celular: mide ${ancho}px`);
  await capturar(r, "soc2-celu-asistencia");
  await r.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
