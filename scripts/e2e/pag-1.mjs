#!/usr/bin/env node
// PAG-1 · Editor de la página: la dueña cambia el título (la vista previa lo
// muestra antes de guardar), oculta una sección, sube otra, agrega una
// pregunta, elige foto de portada; guarda y la página pública lo muestra.
// Errores con dónde; encargado de solo lectura; celular con "Ver cómo queda".
//   npm run e2e:pag-1            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const TITULO = `Entrená con ganas ${Date.now().toString().slice(-4)}`;
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  const abrir = async (x) => { await x.goto(`${G}/panel/pagina`); await x.locator('[data-editor-pagina][data-listo="true"]').waitFor({ timeout: 60000 }); };
  await abrir(p);
  chequear(await p.locator('aside a[href="/panel/pagina"]').count() > 0, "“Tu página” está en el menú y abre", "“Tu página” no está en el menú");
  const pie = p.locator("[data-pie-pagina]");
  const guardar = async () => {
    const n = Number(await pie.getAttribute("data-respuestas"));
    await pie.locator('button:has-text("Guardar")').click();
    await p.waitForFunction((n) => Number(document.querySelector("[data-pie-pagina]")?.getAttribute("data-respuestas")) > n, n, { timeout: 30000 });
    return (await pie.locator(".mensaje").first().innerText().catch(() => "")).replace(/\s+/g, " ");
  };
  const portada = p.locator('[data-bloque="portada"]');
  const vista = p.locator("[data-vista-previa]");
  const original = await portada.locator("label", { hasText: "Título" }).locator("input").inputValue();
  chequear(await pie.locator('button:has-text("Guardar")').isDisabled(), "sin cambios, Guardar está apagado", "Guardar prendido sin cambios");

  // ── Vista previa en vivo ──
  await portada.locator("label", { hasText: "Título" }).locator("input").fill(TITULO);
  await vista.locator("h1", { hasText: TITULO }).waitFor({ timeout: 10000 });
  ok("la vista previa muestra el título nuevo antes de guardar");
  chequear(await aparece(pie.locator("[data-sin-guardar]")), "avisa cambios sin guardar", "no avisa cambios sin guardar");

  // ── Ocultar Profes, subir Preguntas, agregar una pregunta ──
  const sec = (t) => p.locator(`[data-seccion="${t}"]`);
  await sec("equipo").locator("label", { hasText: "Se muestra en la página" }).locator("input").uncheck();
  chequear(!(await vista.locator('h2:has-text("Profes")').count()), "ocultar Profes la saca de la vista previa", "Profes sigue en la vista previa");
  const ordenAntes = await p.locator("[data-seccion]").evaluateAll((xs) => xs.map((x) => x.getAttribute("data-seccion")));
  await sec("preguntas").locator('button[aria-label^="Subir"]').first().click();
  const ordenDespues = await p.locator("[data-seccion]").evaluateAll((xs) => xs.map((x) => x.getAttribute("data-seccion")));
  chequear(ordenDespues.indexOf("preguntas") === ordenAntes.indexOf("preguntas") - 1, "▲ sube Preguntas un lugar", `el orden quedó ${ordenDespues.join(",")}`);
  const nPreg = await sec("preguntas").locator("[data-elemento]").count();
  await sec("preguntas").locator('button:has-text("Agregar pregunta")').click();
  const nueva = sec("preguntas").locator("[data-elemento]").nth(nPreg);
  await nueva.locator("label", { hasText: "Pregunta" }).locator("input").fill("¿Hay estacionamiento?");

  // ── Error con dónde: pregunta sin respuesta ──
  let m = await guardar();
  chequear(/respuesta \d+: no puede quedar vacío/.test(m), `pregunta sin respuesta → “${m}”`, `sin respuesta dio “${m}”`);
  await nueva.locator("label", { hasText: "Respuesta" }).locator("textarea").fill("Sí, en la calle de atrás.");

  // ── Foto de portada (si hay fotos) ──
  const fotos = p.locator('[role="radiogroup"][aria-label="Foto de portada"] [role="radio"]');
  if (await fotos.count() > 1) { await fotos.nth(1).click(); ok("elige una foto de portada de la galería"); }
  else ok("(sin fotos en la galería: la portada dice dónde subirlas)");

  m = await guardar();
  chequear(/Guardado/.test(m), "guardar → “Guardado”", `guardar dio “${m}”`);
  await capturar(p, "pag1-compu-editor");

  // ── La página pública lo muestra ──
  const v = await pagina(b, COMPU);
  await v.goto(`${G}/`);
  await v.locator("h1").first().waitFor({ timeout: 30000 });
  chequear((await v.locator("h1").first().innerText()).includes(TITULO), "la página pública tiene el título nuevo", "la página pública sigue con el título viejo");
  chequear(!(await v.locator('h2:has-text("Profes")').count()), "Profes oculta en la página pública", "Profes sigue en la página pública");
  chequear(await v.locator("summary", { hasText: "¿Hay estacionamiento?" }).count() === 1, "la pregunta nueva está en la página", "falta la pregunta nueva");
  const h2 = await v.locator("main h2").allInnerTexts();
  const iP = h2.findIndex((t) => /Preguntas/.test(t));
  chequear(iP >= 0, `orden en la página: ${h2.map((t) => t.replace(/\s+/g, " ").trim()).join(" · ")}`, "no aparece Preguntas");
  await v.context().close();

  // ── Encargado: solo mira ──
  const e = await pagina(b, COMPU);
  await entrar(e, "encargado@ejemplo.invalid");
  await abrir(e);
  chequear(await e.locator("fieldset[disabled]").count() >= 1 && await e.locator("fieldset:not([disabled]) input, fieldset:not([disabled]) textarea").count() === 0 && await e.locator("[data-pie-pagina]").count() === 0,
    "encargado: ve el editor deshabilitado y sin Guardar", "encargado puede editar");
  await e.context().close();

  // ── Celular: Ver cómo queda ──
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await abrir(c);
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular: editor sin desborde (${ancho}px)`, `celular: el editor mide ${ancho}px`);
  await c.locator('[data-bloque="portada"] label', { hasText: "Título" }).locator("input").fill(`${TITULO}!`);
  await c.locator('button:has-text("Ver cómo queda")').click();
  await c.locator('[role="dialog"] h1', { hasText: `${TITULO}!` }).waitFor({ timeout: 10000 });
  ok("celular: “Ver cómo queda” muestra la página con lo escrito");
  await capturar(c, "pag1-celu-vista");
  await c.locator('button:has-text("Volver a editar")').click();
  await c.locator('button:has-text("Deshacer")').click();
  await c.context().close();

  // ── Dejar todo como estaba ──
  await abrir(p);
  await p.locator('[data-bloque="portada"] label', { hasText: "Título" }).locator("input").fill(original);
  await sec("equipo").locator("label", { hasText: "Se muestra en la página" }).locator("input").check();
  await sec("preguntas").locator('button[aria-label^="Bajar"]').first().click();
  const ult = sec("preguntas").locator("[data-elemento]").last();
  if ((await ult.locator("input").nth(0).inputValue()) === "¿Hay estacionamiento?") await ult.locator('button:has-text("Quitar")').click();
  if (await fotos.count() > 1) await fotos.nth(0).click();
  chequear(/Guardado/.test(await guardar()), "vuelve todo a como estaba", "no pudo volver a como estaba");
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
  await p.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
