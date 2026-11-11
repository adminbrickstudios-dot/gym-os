#!/usr/bin/env node
// VD-46R · Al cumplir 18: la automática “Cumplieron 18” existe entre las tareas que se pueden prender/asignar,
// Documentos abre bien (con la lista de los que tienen que firmar ellos, si hay), y el celular no desborda.
// (La firma propia, el antes y el después de los 18, lo prueba la base: firma-propia.test.mjs.)
//   node scripts/e2e/vd-46r.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
// F1.9: un error que nadie atrapó deja de colgar el recorrido sin ✗: se escribe qué esperaba y cuándo, y se corta con código 1.
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const G = GIMNASIO();
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/tareas`);
  await d.locator("main").waitFor({ timeout: 30000 });
  await d.getByText(/Cumplieron 18/).first().waitFor({ timeout: 30000 });
  ok("Tareas: la automática “Cumplieron 18: tienen que firmar ellos” se puede prender, apagar o asignar");

  await d.goto(`${G}/panel/documentos`);
  await d.locator("main").waitFor({ timeout: 30000 });
  const hay = await d.locator("[data-firmas-propias]").count();
  ok(hay ? "Documentos: lista a los que cumplieron 18 y tienen que firmar ellos" : "Documentos: nadie tiene pendiente la firma propia (no se muestra la lista)");
  chequear(await d.getByText("No tenés acceso").count() === 0, "Documentos abre para la dueña", "sin acceso");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  const c = await pagina(b, CELU);
  await entrar(c, "encargado@ejemplo.invalid");
  await c.goto(`${G}/panel/documentos`);
  await c.locator("main").waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  await capturar(c, "vd46r-celu");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
