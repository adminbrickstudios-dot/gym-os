#!/usr/bin/env node
// AUD-9 · Clases botón por botón: los días, una clase con su lista, "Presente"
// desde la búsqueda (recepción), el profe sin buscar socios; la grilla: agregar
// actividad, agregar horario y sacarlo con confirmación en pantalla (sin el
// diálogo del navegador). Celular sin desborde.
//   npm run e2e:clases            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const r = await pagina(b, COMPU);
  r.on("dialog", (d) => { falla(`apareció un diálogo del navegador: ${d.message()}`); d.dismiss(); });
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/clases`);
  await r.locator("main h1").waitFor({ timeout: 60000 });
  const dias = r.locator('nav[aria-label="Día"] a');
  chequear(await dias.count() === 7, "7 días para elegir, desde hoy", `${await dias.count()} días`);
  await dias.nth(1).click();
  await r.waitForURL(/dia=\d{4}-\d{2}-\d{2}/, { timeout: 30000 });
  ok("“Mañana” cambia el día");
  await r.goto(`${G}/panel/clases`);
  const clase = r.locator('main ul a[href^="/panel/clases/"]').filter({ hasNotText: "Cancelada" }).first();
  if (await clase.count() === 0) {
    chequear(await r.getByText("No hay clases este día").count() === 1, "sin clases hoy: lo dice y manda a la grilla", "vacío sin texto");
  } else {
    await clase.click();
    await r.waitForURL(/\/panel\/clases\/[0-9a-f-]{36}$/, { timeout: 30000 });
    await r.locator("main h1").waitFor({ timeout: 60000 });
    await r.getByLabel("Buscar socio para la clase").fill("Agustina");
    const fila = r.locator("main section li").first();
    await fila.waitFor({ timeout: 30000 });
    const nombre = (await fila.locator("span.font-semibold").innerText()).trim();
    await fila.getByRole("button", { name: "Presente" }).click();
    // O queda ✅, o la base dice por qué no (fuera del horario de la clase, no puede tomarla, ya estaba).
    const presente = r.locator("main ul li", { hasText: nombre }).getByText("✅ Presente").first();
    const aviso = r.locator('main [role="alert"]').first();
    await presente.or(aviso).waitFor({ timeout: 30000 });
    if (await presente.isVisible()) {
      ok(`buscar “Agustina” → Presente: ${nombre} queda ✅ en la lista`);
      // CLA-7: deshacerlo, con motivo.
      const filaLista = r.locator("main ul li", { hasText: nombre }).first();
      await filaLista.getByRole("button", { name: /Deshacer el presente/ }).click();
      await filaLista.getByRole("textbox").fill("Lo marqué por error (e2e)");
      await filaLista.getByRole("button", { name: "Deshacer" }).click();
      await r.locator("main ul li", { hasText: nombre }).getByText("✅ Presente").first().waitFor({ state: "detached", timeout: 30000 });
      ok("↩️ Deshacer con motivo: el presente se va (y si gastó una clase del pack, vuelve)");
    }
    else chequear(/una hora antes|No puede tomar la clase|Ya tiene el presente/.test(await aviso.innerText()), `Presente fuera de regla: la base dice por qué (“${await aviso.innerText()}”)`, await aviso.innerText());
  }
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);

  const d = await pagina(b, COMPU);
  d.on("dialog", (x) => { falla(`apareció un diálogo del navegador: ${x.message()}`); x.dismiss(); });
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/clases`);
  await d.getByRole("link", { name: /Armar la grilla/ }).click();
  await d.waitForURL(/\/panel\/clases\/grilla$/, { timeout: 30000 });
  await d.locator("main h1").waitFor({ timeout: 60000 });
  if (await d.getByText("Prueba e2e", { exact: false }).count() === 0) {
    await d.getByLabel("Emoji").fill("🧪");
    await d.getByLabel("Nombre de la actividad").fill("Prueba e2e");
    await d.getByRole("button", { name: /Agregar actividad/ }).click();
    await d.locator(".pildora", { hasText: "Prueba e2e" }).waitFor({ timeout: 30000 });
  }
  ok("➕ Agregar actividad: “🧪 Prueba e2e”");
  const form = d.locator("form", { hasText: "Agregar a la grilla" });
  await form.locator("select").first().selectOption({ label: "🧪 Prueba e2e" });
  await form.locator("select").nth(1).selectOption("7");
  await form.locator('input[type="time"]').fill("23:15");
  await form.getByRole("button", { name: /Agregar/ }).click();
  const horario = d.locator("li", { hasText: "Prueba e2e" }).filter({ hasText: "23:15" });
  await horario.waitFor({ timeout: 30000 });
  ok("➕ Agregar a la grilla: domingo 23:15");
  // CLA-8: editarlo en el lugar (hora y cupo).
  await horario.getByRole("button", { name: /^Editar/ }).click();
  const ed = d.locator("[data-editar-horario]");
  await ed.locator('input[type="time"]').fill("23:30");
  await ed.getByPlaceholder("Sin cupo").fill("7");
  await ed.getByRole("button", { name: "Guardar" }).click();
  const editado = d.locator("li", { hasText: "Prueba e2e" }).filter({ hasText: "23:30" });
  await editado.waitFor({ timeout: 30000 });
  chequear(/cupo 7/.test(await editado.innerText()), "Editar: pasa a las 23:30 con cupo 7, sin sacarlo", await editado.innerText());
  await editado.getByRole("button", { name: /^Sacar/ }).click();
  await editado.getByRole("button", { name: "Sí, sacar" }).click();
  await editado.waitFor({ state: "detached", timeout: 30000 });
  ok("Sacar → “Sí, sacar” en pantalla (sin diálogo del navegador): ya no está");
  const ocup = d.locator("[data-ocupacion] li");
  ok(await ocup.count() ? `📊 Ocupación de las últimas 4 semanas (${await ocup.count()} horarios, ej: “${(await ocup.first().innerText()).replace(/\s+/g, " ")}”)` : "sin clases pasadas todavía: la ocupación no aparece (lo vacío está vacío)");

  const p = await pagina(b, CELU);
  await entrar(p, "profe@ejemplo.invalid");
  await p.goto(`${G}/panel/clases`);
  await p.locator("main h1").waitFor({ timeout: 60000 });
  chequear(await p.getByRole("link", { name: /Armar la grilla/ }).count() === 0, "el profe ve sus clases, sin “Armar la grilla”", "el profe ve la grilla");
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  await capturar(p, "aud9-celu-profe");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
