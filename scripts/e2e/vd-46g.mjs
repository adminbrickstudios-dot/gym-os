#!/usr/bin/env node
// VD-46G · Plan familiar: arranca apagado, el dueño lo prende en Configuración, arma un grupo con titular desde la
// ficha, el miembro ve quién paga, y todo vuelve a como estaba. Celular sin desbordes.
//   node scripts/e2e/vd-46g.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");

  // Configuración → Reglas: arranca apagado y se prende.
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  const seccion = d.locator("[data-plan-familiar-config]");
  await seccion.waitFor({ timeout: 30000 });
  chequear((await seccion.getAttribute("data-plan-familiar-config")) === "apagado", "el plan familiar arranca apagado", "no arranca apagado");
  await seccion.locator('input[role="switch"]').click();
  await d.locator('[data-plan-familiar-config="prendido"]').waitFor({ timeout: 30000 });
  ok("el dueño lo prende desde Configuración");

  // Dos socios cualquiera: se vinculan y uno paga por el grupo.
  await d.goto(`${G}/panel/socios`);
  await d.locator('a[href^="/panel/socios/"]').first().waitFor({ timeout: 30000 });
  const filas = await d.locator('a[href^="/panel/socios/"]').evaluateAll((as) =>
    as.map((a) => ({ href: a.getAttribute("href"), texto: a.innerText.split("\n")[0].trim() }))
      .filter((x) => /\/panel\/socios\/[0-9a-f-]{36}$/.test(x.href) && x.texto));
  const [a, c] = [filas[0], filas.find((x) => x.href !== filas[0].href)];
  await d.goto(`${G}${a.href}`);
  const familia = d.locator("[data-familia]");
  await familia.waitFor({ timeout: 30000 });
  if (!(await d.locator("[data-plan-familiar]").count())) {
    await familia.getByLabel("Sumar a la familia").fill(c.texto.split(" ")[0]);
    await familia.locator("ul li button.fila").first().click();
  }
  await d.locator("[data-plan-familiar]").waitFor({ timeout: 30000 });
  if ((await d.locator("[data-plan-familiar]").getAttribute("data-plan-familiar")) === "sin-titular") {
    await d.locator("[data-titular-yo]").click();
  }
  await d.locator('[data-plan-familiar="titular"]').waitFor({ timeout: 30000 });
  ok("desde la ficha se elige quién paga: el titular ve que paga por los demás");
  await capturar(d, "vd46g-compu-titular");

  // El otro miembro (en el celular) ve quién paga y sin desbordes.
  const m = await pagina(b, CELU);
  await entrar(m, "duena@ejemplo.invalid");
  const idTitular = a.href.split("/").pop();
  await m.goto(`${G}/panel/socios/${idTitular}`);
  const hermano = m.locator("[data-familia] ul li a").first();
  await hermano.waitFor({ timeout: 30000 });
  await m.goto(`${G}${await hermano.getAttribute("href")}`);
  await m.locator('[data-plan-familiar="miembro"]').waitFor({ timeout: 30000 });
  chequear((await m.locator("[data-plan-familiar]").innerText()).includes("Paga "), "el miembro ve quién paga", "el miembro no ve al titular");
  chequear(await m.locator("[data-familia] .pildora", { hasText: "Titular" }).first().isVisible(), "el titular se marca en la lista", "no se marca al titular");
  chequear(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "celular 390 px sin desbordes", "desborde horizontal en el celular");
  await capturar(m, "vd46g-celu-miembro");

  // Se deja todo como estaba.
  await d.goto(`${G}${a.href}`);
  await d.locator("[data-quitar-titular]").click();
  await d.locator('[data-plan-familiar="sin-titular"]').waitFor({ timeout: 30000 });
  ok("el titular se saca");
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('[data-plan-familiar-config="prendido"] input[role="switch"]').click();
  await d.locator('[data-plan-familiar-config="apagado"]').waitFor({ timeout: 30000 });
  ok("el dueño lo apaga");
} finally {
  await b.close();
}
resultado();
