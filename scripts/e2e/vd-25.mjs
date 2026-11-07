#!/usr/bin/env node
// VD-25 · Página del gimnasio rediseñada: la dueña prende "+N socios" y carga las reseñas → el visitante,
// en el celular (390 px, sin desbordes), ve la prueba social arriba, "abierto ahora" coherente, "¿Primera
// vez?", planes con precio, horarios, probar y el pie con la reseña → "Quiero probar" crea un Interesado
// que la recepción ve en Prospectos. En la compu: WhatsApp flotante.
//   node scripts/e2e/vd-25.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, PANTALLA_ROTA, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s = Date.now().toString().slice(-6);
const NOMBRE = `Vero Social${s}`;
const TEL = `000 ${s.slice(0, 3)} ${s.slice(3)}7`;   // característica 000: ficticio
try {
  // ── Dueña: confianza en la portada, y la página publicada ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/pagina`);
  const panel = d.locator("[data-prueba-social-panel]");
  await panel.waitFor({ timeout: 60000 });
  const casilla = panel.locator('input[type="checkbox"]');
  if (!(await casilla.isChecked())) await casilla.check();
  await panel.locator('input[aria-label="Puntaje en Google"]').fill("9");
  await panel.locator('input[aria-label="Cantidad de reseñas"]').fill("120");
  await panel.locator('button:has-text("Guardar")').click();
  await panel.locator('[role="alert"]').waitFor({ timeout: 30000 });
  chequear(/puntaje va de 1 a 5/.test(await panel.locator('[role="alert"]').innerText()), "puntaje 9 → la base dice “el puntaje va de 1 a 5”", "no avisó el puntaje fuera de rango");
  await panel.locator('input[aria-label="Puntaje en Google"]').fill("4,8");
  await panel.locator('button:has-text("Guardar")').click();
  await panel.getByText("Guardado.").waitFor({ timeout: 30000 });
  ok("dueña: “+N socios” prendido y reseñas 4,8 · 120 guardadas");
  await d.locator('[data-editor-pagina][data-listo="true"]').waitFor({ timeout: 60000 });
  if (await d.locator('[data-estado-pagina="borrador"]').count()) {
    await d.locator('button:has-text("Publicar mi página")').click();
    await d.locator('[data-estado-pagina="publicada"]').waitFor({ timeout: 30000 });
  }

  // ── Visitante en el celular ──
  const v = await pagina(b, CELU);
  await v.goto(`${G}/`);
  await v.locator("h1").first().waitFor({ timeout: 30000 });
  chequear(!PANTALLA_ROTA.test(await v.locator("body").innerText()), "la página abre sin errores", "la página muestra un error");
  const senales = v.locator("[data-prueba-social]");
  chequear(await aparece(senales, 15000), "arriba: la prueba social", "no aparece la prueba social en la portada");
  const resena = senales.locator("[data-resenas]");
  chequear(await resena.count() === 1 && /4,8/.test(await resena.innerText()) && /120 reseñas/.test(await resena.innerText()), `reseñas: “${(await resena.innerText().catch(() => "")).replace(/\s+/g, " ")}”`, "falta el puntaje o la cantidad de reseñas");
  chequear(await senales.locator("[data-socios]").count() === 1 && /\+\d/.test(await senales.locator("[data-socios]").innerText()), `socios: “${(await senales.locator("[data-socios]").innerText().catch(() => "")).trim()}”`, "falta “+N socios”");
  // "Abierto ahora" coherente: la píldora dice lo mismo que su estado.
  const pildora = v.locator("[data-abierto]").first();
  if (await pildora.count()) {
    const abierto = (await pildora.getAttribute("data-abierto")) === "true";
    const texto = await pildora.innerText();
    chequear(abierto ? /abierto/i.test(texto) : /cerrado|abre/i.test(texto), `“${texto.trim()}” coincide con el estado (${abierto ? "abierto" : "cerrado"})`, `“${texto.trim()}” no coincide con data-abierto=${abierto}`);
  } else ok("el gimnasio demo no tiene horarios cargados: no hay “abierto ahora” (nada que contradecir)");
  chequear(await v.locator("[data-como-empezar] li").count() >= 2, "“¿Primera vez? Empezá acá” con al menos 2 pasos", "falta el bloque para el que nunca vino");
  for (const id of ["planes", "probar"]) chequear(await v.locator(`#${id}`).count() > 0, `sección #${id} en la página`, `falta la sección #${id}`);
  const titulos = await v.locator("main h2").count();
  chequear(titulos >= 4, `${titulos} secciones con título`, `solo ${titulos} secciones`);
  const ancho = await v.evaluate(() => ({ doc: document.documentElement.scrollWidth, vent: window.innerWidth }));
  chequear(ancho.doc <= ancho.vent, `celular 390 px sin desborde (${ancho.doc}/${ancho.vent})`, `la página se desborda: ${ancho.doc} > ${ancho.vent}`);
  await capturar(v, "vd25-celu-portada");
  await capturar(v, "vd25-celu-completa", true);

  // Quiero probar → Interesado
  await v.locator('a[href="#probar"]').first().click();
  await v.waitForTimeout(400);
  const f = v.locator("[data-form-probar]");
  await f.locator('input[name="nombre"]').fill(NOMBRE);
  await f.locator('input[name="telefono"]').fill(TEL);
  await f.locator('input[name="interes"]').fill("Funcional");
  await f.locator('button[type="submit"]').click();
  await v.locator("[data-probar-listo]").waitFor({ timeout: 30000 });
  ok("“Quiero probar” dejó los datos");
  if (v.errores.length) falla(`visitante: ${v.errores.join(" | ")}`);
  await v.context().close();

  // ── Compu: WhatsApp flotante y sin desborde ──
  const c = await pagina(b, COMPU);
  await c.goto(`${G}/`);
  await c.locator("h1").first().waitFor({ timeout: 30000 });
  const hayWa = await c.locator("[data-whatsapp-flotante]").count();
  ok(hayWa ? "compu: WhatsApp flotante" : "este gimnasio no cargó WhatsApp: sin botón flotante");
  chequear(await c.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "compu sin desborde", "la página se desborda en la compu");
  await capturar(c, "vd25-compu-portada");
  await c.context().close();

  // ── Recepción: el Interesado ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/prospectos`);
  await r.locator("[data-prospectos]").waitFor({ timeout: 60000 });
  chequear(await r.locator("[data-prospecto]", { hasText: NOMBRE }).count() === 1, "recepción ve al interesado de la página en Prospectos", "no aparece el interesado");
  await r.context().close();
  await d.context().close();
} finally {
  await b.close();
}
resultado();
