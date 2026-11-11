#!/usr/bin/env node
// RUT-1 · Ejercicios y rutinas: el profe suma dos ejercicios, arma una rutina
// de dos días con series y repeticiones, la guarda, la vuelve a abrir y la
// archiva. Al final saca los ejercicios de prueba.
//   npm run e2e:rut-1            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const N = Date.now() % 100000;
const [A, B, R] = [`Sentadilla e2e ${N}`, `Remo e2e ${N}`, `Rutina e2e ${N}`];
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "profe@ejemplo.invalid");
  await p.goto(`${G}/panel/rutinas`);
  const ej = p.locator("[data-ejercicios]");
  await ej.waitFor({ timeout: 60000 });
  for (const [nombre, grupo] of [[A, "piernas"], [B, "espalda"]]) {
    await ej.getByPlaceholder("Sentadilla con barra").fill(nombre);
    await ej.locator("form select").first().selectOption(grupo);   // VD-20: el formulario suma "Equipo" y la biblioteca, filtros
    await ej.getByRole("button", { name: /Sumar/ }).click();
    await ej.locator("li", { hasText: nombre }).waitFor({ timeout: 30000 });
  }
  ok("el profe suma dos ejercicios a la biblioteca");

  await p.getByRole("link", { name: /Nueva rutina/ }).click();
  const ed = p.locator("[data-editor-rutina]");
  await ed.waitFor({ timeout: 60000 });
  await ed.getByPlaceholder("Fuerza 3 días").fill(R);
  await ed.getByLabel("Sumar ejercicio al día 1").selectOption({ label: `${A} · Piernas` });
  await ed.getByLabel("Sumar ejercicio al día 1").selectOption({ label: `${B} · Espalda` });
  await ed.locator('[data-dia="1"]').getByLabel("Repeticiones").first().fill("8-10");
  await ed.getByRole("button", { name: /Sumar día 2/ }).click();
  await ed.getByLabel("Sumar ejercicio al día 2").selectOption({ label: `${B} · Espalda` });
  await ed.getByRole("button", { name: "Guardar rutina" }).click();
  await p.waitForURL(/\/panel\/rutinas$/, { timeout: 30000 });
  const fila = p.locator("[data-rutinas] li", { hasText: R });
  await fila.waitFor({ timeout: 30000 });
  chequear(/2 días · 3 ejercicios/.test(await fila.innerText()), "la rutina queda en la lista: “2 días · 3 ejercicios”", await fila.innerText());

  await fila.click();
  await p.locator("[data-editor-rutina]").waitFor({ timeout: 60000 });
  chequear(await p.locator('[data-dia="1"]').getByLabel("Repeticiones").first().inputValue() === "8-10", "al volver a abrirla, están sus series y repeticiones", "no guardó las repeticiones");
  await p.getByRole("button", { name: /Archivar/ }).click();
  await p.waitForURL(/\/panel\/rutinas$/, { timeout: 30000 });
  await p.locator("[data-rutinas] li", { hasText: R }).waitFor({ state: "detached", timeout: 30000 });
  ok("🗄️ Archivar la saca de la lista");
  for (const n of [A, B]) {
    await p.locator("[data-ejercicios] li", { hasText: n }).getByRole("button", { name: `Sacar ${n}` }).click();
    await p.locator("[data-ejercicios] li", { hasText: n }).waitFor({ state: "detached", timeout: 30000 });
  }
  const c = await pagina(b, CELU);
  await entrar(c, "profe@ejemplo.invalid");
  await c.goto(`${G}/panel/rutinas`);
  await c.locator("[data-ejercicios]").waitFor({ timeout: 60000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `en el celular sin desborde (${ancho}px)`, `desborda ${ancho}`);
  if (p.errores.length) falla(`profe: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
