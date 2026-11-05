#!/usr/bin/env node
// PAG-3 (y el LISTO SI de PAG-1 a PAG-3): la dueña edita el texto de "Probá
// una clase" y publica → un visitante en el celular toca "Probá una clase",
// deja sus datos (y repite: no se duplica) → aparece en Prospectos con el
// WhatsApp armado → recepción le escribe, vino, "Hacerlo socio" → alta con sus
// datos → queda en "Se hicieron socios" con su ficha.
//   npm run e2e:pag-3            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s = Date.now().toString().slice(-6);
const NOMBRE = `Lucía Prueba${s}`;
const TEL = `000 ${s.slice(0, 3)} ${s.slice(3)}9`;   // característica 000: ficticio
try {
  // ── Dueña: texto de la sección y página publicada ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/pagina`);
  await d.locator('[data-editor-pagina][data-listo="true"]').waitFor({ timeout: 60000 });
  const sec = d.locator('[data-seccion="probar"]');
  chequear(await sec.count() === 1, "el editor tiene la sección “Probá una clase”", "falta la sección en el editor");
  const texto = `La primera clase es sin cargo ${s}.`;
  await sec.locator("textarea").fill(texto);
  const visible = sec.locator("label", { hasText: "Se muestra en la página" }).locator("input");
  if (!(await visible.isChecked())) await visible.check();
  const pie = d.locator("[data-pie-pagina]");
  const n0 = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await d.waitForFunction((n) => Number(document.querySelector("[data-pie-pagina]")?.getAttribute("data-respuestas")) > n, n0, { timeout: 30000 });
  if (await d.locator('[data-estado-pagina="borrador"]').count()) {
    await d.locator('button:has-text("Publicar mi página")').click();
    await d.locator('[data-estado-pagina="publicada"]').waitFor({ timeout: 30000 });
  }
  ok("dueña: texto de “Probá una clase” guardado y página publicada");

  // ── Visitante en el celular ──
  const v = await pagina(b, CELU);
  await v.goto(`${G}/`);
  await v.locator("h1").first().waitFor({ timeout: 30000 });
  await v.locator('a[href="#probar"]').first().click();
  await v.waitForTimeout(500);
  const formV = v.locator("[data-form-probar]");
  chequear(await formV.isVisible() && (await v.locator("body").innerText()).includes(texto), "el botón “Probá una clase” lleva al formulario con el texto del dueño", "no llega al formulario");
  await formV.locator('input[name="nombre"]').fill(NOMBRE);
  await formV.locator('input[name="telefono"]').fill("123");
  await formV.locator('button[type="submit"]').click();
  await formV.locator('[role="alert"]').waitFor({ timeout: 30000 });
  chequear(/WhatsApp/.test(await formV.locator('[role="alert"]').innerText()), `WhatsApp mal escrito → “${(await formV.locator('[role="alert"]').innerText()).trim()}”`, "no avisa el WhatsApp mal escrito");
  chequear(await formV.locator('input[name="nombre"]').inputValue() === NOMBRE, "el error no borra lo que escribió", "se borró el nombre");
  await formV.locator('input[name="telefono"]').fill(TEL);
  await formV.locator('input[name="interes"]').fill("Funcional a la tarde");
  await formV.locator('button[type="submit"]').click();
  await v.locator("[data-probar-listo]").waitFor({ timeout: 30000 });
  ok(`visitante: “${(await v.locator("[data-probar-listo]").innerText()).replace(/\s+/g, " ").trim()}”`);
  await capturar(v, "pag3-celu-listo");
  // Repite: no se duplica.
  await v.reload(); await v.locator("[data-form-probar]").waitFor();
  await v.locator('[data-form-probar] input[name="nombre"]').fill(NOMBRE);
  await v.locator('[data-form-probar] input[name="telefono"]').fill(`+54 9 ${TEL}`);
  await v.locator('[data-form-probar] button[type="submit"]').click();
  await v.locator("[data-probar-listo]").waitFor({ timeout: 30000 });
  if (v.errores.length) falla(`visitante: ${v.errores.join(" | ")}`);
  await v.context().close();
  await d.context().close();

  // ── Recepción: Prospectos ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/prospectos`);
  await r.locator("[data-prospectos]").waitFor({ timeout: 60000 });
  chequear(await r.locator('aside a[href="/panel/prospectos"]').count() > 0, "recepción tiene Prospectos en el menú", "Prospectos no está en el menú de recepción");
  const fila = r.locator("[data-prospecto]", { hasText: NOMBRE });
  chequear(await fila.count() === 1, "el pedido aparece una sola vez en Nuevos", `aparece ${await fila.count()} veces`);
  chequear((await fila.innerText()).includes("Funcional a la tarde") && (await fila.innerText()).includes("Página"), "con lo que le interesa y que vino de la página", "le falta el interés o el origen");
  const wa = new URL(await fila.locator('a:has-text("Escribirle")').getAttribute("href"));
  chequear(/^\/549000\d+$/.test(wa.pathname) && /^Hola Lucía!/.test(wa.searchParams.get("text") ?? ""), `WhatsApp armado: “${wa.searchParams.get("text")}”`, `WhatsApp: ${wa}`);
  await fila.locator('button:has-text("Vino a probar")').click();
  await r.locator('[data-filtro="vino"]').click();
  await r.locator("[data-prospecto]", { hasText: NOMBRE }).waitFor({ timeout: 30000 });
  ok("“Vino a probar” lo pasa a Vinieron");
  await capturar(r, "pag3-compu-prospectos");

  // ── Hacerlo socio ──
  await r.locator("[data-prospecto]", { hasText: NOMBRE }).locator('a:has-text("Hacerlo socio")').click();
  await r.waitForURL(/\/panel\/socios\/nuevo\?prospecto=/, { timeout: 30000 });
  await r.locator('input[name="nombre"]').waitFor();
  chequear(await r.locator('input[name="nombre"]').inputValue() === "Lucía" && /Prueba/.test(await r.locator('input[name="apellido"]').inputValue())
    && /^\+549000/.test(await r.locator('input[name="telefono"]').inputValue()), "el alta arranca con su nombre, apellido y WhatsApp", "el alta no trae los datos");
  await r.locator('button:has-text("Dar de alta")').click();
  await r.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}/, { timeout: 90000 });
  ok("se da de alta y abre su ficha");
  await r.goto(`${G}/panel/prospectos`);
  await r.locator('[data-filtro="socio"]').click();
  const comoSocio = r.locator("[data-prospecto]", { hasText: NOMBRE });
  await comoSocio.waitFor({ timeout: 30000 });
  chequear(await comoSocio.locator('a:has-text("Ver ficha")').count() === 1, "queda en “Se hicieron socios” con link a su ficha", "no quedó como socio");
  // Anotar uno a mano.
  await r.locator('button:has-text("Anotar uno que preguntó")').click();
  const f = r.locator("[data-form-prospecto]");
  await f.locator('input[name="nombre"]').fill(`Mostrador ${s}`);
  await f.locator('input[name="telefono"]').fill(`000 ${s.slice(0, 3)} ${s.slice(3)}8`);
  await f.locator('button:has-text("Anotar")').click();
  await r.locator('[data-filtro="nuevo"][aria-selected="true"]').waitFor({ timeout: 30000 });
  chequear(await aparece(r.locator("[data-prospecto]", { hasText: `Mostrador ${s}` }), 15000), "recepción anota uno que preguntó en el mostrador", "no aparece el anotado a mano");
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);
  await r.context().close();

  // ── Profe: no ve Prospectos ──
  const pr = await pagina(b, CELU);
  await entrar(pr, "profe@ejemplo.invalid");
  await pr.goto(`${G}/panel/prospectos`);
  await pr.locator("main").waitFor();
  chequear(!(await pr.locator("[data-prospectos]").count()), "el profe no ve Prospectos", "el profe ve Prospectos");
  await pr.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
