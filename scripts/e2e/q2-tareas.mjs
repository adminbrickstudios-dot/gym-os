#!/usr/bin/env node
// Q2 · Tareas: la dueña anota una tarea que se repite todos los días, la edita (texto y corta la repetición),
// y la borra con confirmación; el celular tiene Editar y Borrar a mano.
//   node scripts/e2e/q2-tareas.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const G = GIMNASIO();
const s = Date.now().toString().slice(-6);
const QUE = `Reponer papel Q2 ${s}`;
const QUE2 = `Reponer papel y jabón Q2 ${s}`;
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/tareas`);
  await d.getByRole("button", { name: /Nueva tarea/ }).click();
  const form = d.locator("[data-nueva-tarea]");
  await form.waitFor({ timeout: 60000 });
  await form.locator("input").first().fill(QUE);
  await form.locator("[data-repite]").selectOption("diaria");
  await form.locator('button[type="submit"]').click();
  await form.getByText("Tarea anotada").waitFor({ timeout: 30000 });
  const fila = d.locator("[data-tarea] , [data-editar-tarea]").filter({ hasText: QUE });
  chequear(await aparece(fila, 60000) && /todos los días/.test(await fila.first().innerText()), "la tarea aparece y dice “todos los días”", "la tarea no aparece con su repetición");

  // Editar: cambia el texto y corta la repetición.
  await fila.first().getByRole("button", { name: /Editar/ }).click();
  const ed = d.locator("[data-editar-tarea]");
  await ed.waitFor({ timeout: 30000 });
  await ed.locator("[data-editar-que]").fill(QUE2);
  await ed.locator("[data-editar-repite]").selectOption("");
  await ed.locator("[data-guardar-tarea]").click();
  const editada = d.locator("[data-tarea]", { hasText: QUE2 });
  chequear(await aparece(editada, 60000), "editar: la tarea queda con el texto nuevo", "no aparece el texto editado");
  chequear(!/todos los días/.test(await editada.first().innerText()), "editar: sin repetición ya no dice “todos los días”", "sigue diciendo que se repite");
  await d.reload();
  chequear(await aparece(d.locator("[data-tarea]", { hasText: QUE2 }), 60000), "lo editado se ve también al recargar", "al recargar no está la edición");

  // Borrar: pide confirmación, "No" la deja; "Sí, borrar" la saca.
  const f2 = d.locator("[data-tarea]", { hasText: QUE2 }).first();
  await f2.getByRole("button", { name: /Borrar/ }).click();
  await f2.getByRole("button", { name: "No", exact: true }).click();
  chequear(await f2.getByRole("button", { name: /Borrar/ }).isVisible(), "borrar: “No” la deja como estaba", "“No” no cerró la confirmación");
  await f2.getByRole("button", { name: /Borrar/ }).click();
  await f2.locator("[data-confirmar-borrar]").click();
  await d.locator("[data-tarea]", { hasText: QUE2 }).first().waitFor({ state: "detached", timeout: 60000 });
  ok("borrar: “Sí, borrar” la saca de la lista");

  // Celular: Editar y Borrar a mano, sin desbordes.
  const QUE3 = `Revisar extintores Q2 ${s}`;
  await d.getByRole("button", { name: /Nueva tarea/ }).click().catch(() => {});
  const form2 = d.locator("[data-nueva-tarea]");
  await form2.locator("input").first().fill(QUE3);
  await form2.locator('button[type="submit"]').click();
  await form2.getByText("Tarea anotada").waitFor({ timeout: 30000 });
  const c = await pagina(b, CELU);
  c.setDefaultNavigationTimeout(120000);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/tareas`);
  const fc = c.locator("[data-tarea]", { hasText: QUE3 }).first();
  await fc.waitFor({ timeout: 60000 });
  chequear(await fc.locator("[data-editar]").isVisible() && await fc.locator("[data-borrar]").isVisible(), "celular: Editar y Borrar a la vista", "faltan Editar o Borrar");
  const w = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(w <= CELU.width + 1, "celular: Tareas sin desbordes", `se desborda: ${w}px`);
  await capturar(c, "q2-tareas-celu");
  await fc.locator("[data-borrar]").click();
  await fc.locator("[data-confirmar-borrar]").click();
  await c.locator("[data-tarea]", { hasText: QUE3 }).first().waitFor({ state: "detached", timeout: 60000 });
  ok("celular: borrar la tarea de prueba");
  for (const p of [d, c]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
