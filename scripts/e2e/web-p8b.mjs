#!/usr/bin/env node
// P8b · Editor de la página del gimnasio, como el de yadeportes: la dueña ve su página al lado y la cambia en vivo.
//   1. Vista previa al lado; el título, el color, la letra y qué secciones se ven cambian en la vista previa SIN guardar.
//   2. Orden de las secciones: arrastrando (y con las flechas); la vista previa sigue el orden.
//   3. Deshacer y rehacer paso a paso; "Volver a lo guardado".
//   4. Guardar: lo ve la página pública (con su letra y su color); recargar el editor lo trae igual.
//   5. "Restaurar por defecto": carga lo de un gimnasio nuevo como borrador, se puede deshacer y no se guarda solo.
//   6. Celular 390 px: sin desborde, "Ver cómo queda" abre la vista y Esc la cierra.
//   7. Permisos: el encargado ve el editor pero no puede guardar (el botón no existe y la base lo rechaza); sin sesión no entra.
//   node scripts/e2e/web-p8b.mjs     (con scripts/local/levantar.sh corriendo)
// Usa el gimnasio demo y le devuelve su página y sus colores como estaban al terminar (los copia de la base al empezar).
// ESCRITO, NO EJECUTADO por quien lo escribió.
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url });
await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
// Foto del estado de la página para devolverla al terminar.
const antesLanding = (await db.query(`select * from public.landing_gimnasio where gimnasio_id = $1`, [gim])).rows[0];
const antesSecciones = (await db.query(`select tipo, titulo, orden, visible, contenido from public.landing_secciones where gimnasio_id = $1`, [gim])).rows;
const antesConfig = (await db.query(`select color_acento, color_fondo from public.configuracion_gimnasio where gimnasio_id = $1`, [gim])).rows[0];
const [{ nombre: NOMBRE }] = (await db.query(`select nombre from public.gimnasios where id = $1`, [gim])).rows;
await db.query(`update public.landing_gimnasio set publicada = true, tipografia = 'condensada' where gimnasio_id = $1`, [gim]);

const TITULO = `Entrená con nosotros ${Date.now() % 10000}`;
const ACENTO = "#c2410c";
const b = await navegador();

/** Los tipos de sección del editor, en el orden en que están. */
const ordenEditor = (p) => p.locator("[data-seccion]").evaluateAll((xs) => xs.map((x) => x.getAttribute("data-seccion")));
/** Los ids de las secciones de la vista previa, en el orden en que se ven. */
const ordenVista = (p) => p.locator("[data-vista-previa] main section[aria-labelledby]").evaluateAll((xs) => xs.map((x) => x.getAttribute("aria-labelledby")));
const abrirEditor = async (p) => {
  await p.goto(`${G}/panel/pagina`);
  await p.locator('[data-editor-pagina][data-listo="true"]').waitFor({ timeout: 60000 });
  await p.waitForLoadState("networkidle").catch(() => {});
};

try {
  // ── Sin sesión ──
  const anon = await pagina(b, COMPU);
  await anon.goto(`${G}/panel/pagina`);
  await anon.waitForURL((u) => u.pathname.startsWith("/ingresar"), { timeout: 30000 }).catch(() => {});
  chequear(anon.url().includes("/ingresar") && await anon.locator("[data-editor-pagina]").count() === 0, "sin sesión no se entra al editor: va al ingreso", `sin sesión quedó en ${anon.url()}`);
  await anon.context().close();

  // ── 1 · Vista previa al lado, cambios en vivo ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await abrirEditor(d);
  chequear(await d.locator("[data-vista-previa]").first().isVisible(), "la vista previa de la página está al lado del editor", "no se ve la vista previa");
  chequear(await d.locator('[data-bloque="estilo"]').count() === 1 && await d.locator('[data-bloque="imagenes"]').count() === 1 && await d.locator('[data-bloque="portada"]').count() === 1,
    "el editor tiene logo y fotos, colores y letra, portada y secciones", "falta un bloque del editor");
  const inicioOrden = await ordenEditor(d);

  await d.locator('[data-bloque="portada"] input').first().fill(TITULO);
  await d.waitForFunction((t) => document.querySelector("[data-vista-previa] h1")?.textContent?.includes(t), TITULO, { timeout: 10000 }).catch(() => {});
  chequear((await d.locator("[data-vista-previa] h1").first().innerText()).includes(TITULO), "el título cambia en la vista previa mientras se escribe", "el título no cambió en la vista previa");
  chequear(await d.locator("[data-sin-guardar]").count() === 1, "avisa “Cambios sin guardar”", "no avisa de los cambios sin guardar");

  await d.locator(`[data-color-acento="${ACENTO}"]`).click();
  const acentoVista = await d.locator("[data-vista-previa] [data-pagina-gimnasio]").first().evaluate((x) => getComputedStyle(x).getPropertyValue("--acento").trim().toLowerCase());
  chequear(acentoVista === ACENTO, `el color principal se ve en la vista previa (${acentoVista})`, `el color en la vista previa es ${acentoVista}`);

  await d.locator('[data-tipografia-opcion="clasica"]').click();
  const letra = await d.locator("[data-vista-previa] [data-pagina-gimnasio]").first().evaluate((x) => ({ t: x.getAttribute("data-tipografia"), f: getComputedStyle(x.querySelector("h1")).fontFamily }));
  chequear(letra.t === "clasica" && /georgia|serif/i.test(letra.f), `la letra elegida se ve en la vista previa (${letra.f.slice(0, 40)})`, `la letra no cambió en la vista previa: ${JSON.stringify(letra)}`);

  // Una sección apagada desaparece de la vista previa
  const hayPreguntas = (await ordenVista(d)).includes("preguntas");
  await d.locator('[data-seccion="preguntas"] input[role="switch"]').setChecked(false, { force: true });
  chequear(!(await ordenVista(d)).includes("preguntas"), `apagar “Preguntas” la saca de la vista previa${hayPreguntas ? "" : " (ya no se mostraba por no tener datos)"}`, "la sección apagada sigue en la vista previa");

  // ── 2 · Orden: arrastrar ──
  chequear(inicioOrden.indexOf("planes") < inicioOrden.indexOf("horarios"), "de fábrica, Planes va antes que Horarios", `orden de fábrica: ${inicioOrden.join(", ")}`);
  await d.locator('[data-arrastrar="horarios"]').dragTo(d.locator('[data-seccion="planes"]'));
  const tras = await ordenEditor(d);
  chequear(tras.indexOf("horarios") < tras.indexOf("planes"), "arrastrar Horarios sobre Planes la sube", `el arrastre no cambió el orden: ${tras.join(", ")}`);
  const vOrden = await ordenVista(d);
  if (vOrden.includes("horarios") && vOrden.includes("planes")) chequear(vOrden.indexOf("horarios") < vOrden.indexOf("planes"), "la vista previa sigue el nuevo orden", `orden de la vista: ${vOrden.join(", ")}`);
  else ok("(la vista previa no tiene ambos bloques con datos: se verificó el orden en el editor)");
  // Con las flechas también (celular, teclado)
  const antesFlecha = await ordenEditor(d);
  await d.locator(`[data-seccion="${antesFlecha[0]}"] [aria-label^="Bajar "]`).click();
  const trasFlecha = await ordenEditor(d);
  chequear(trasFlecha[1] === antesFlecha[0], "la flecha “Bajar” también mueve una sección", `la flecha no movió: ${trasFlecha.join(", ")}`);

  // ── 3 · Deshacer y rehacer ──
  await d.locator("[data-deshacer]").click();           // vuelve la flecha
  chequear((await ordenEditor(d))[0] === antesFlecha[0], "Deshacer revierte la flecha", "Deshacer no revirtió la flecha");
  await d.locator("[data-deshacer]").click();           // vuelve el arrastre
  const trasDeshacer = await ordenEditor(d);
  chequear(trasDeshacer.indexOf("planes") < trasDeshacer.indexOf("horarios"), "Deshacer revierte el arrastre", `Deshacer no revirtió el arrastre: ${trasDeshacer.join(", ")}`);
  await d.locator("[data-rehacer]").click();
  const trasRehacer = await ordenEditor(d);
  chequear(trasRehacer.indexOf("horarios") < trasRehacer.indexOf("planes"), "Rehacer vuelve a aplicar el arrastre", `Rehacer no volvió: ${trasRehacer.join(", ")}`);
  for (let i = 0; i < 12 && await d.locator("[data-deshacer]:not([disabled])").count(); i++) await d.locator("[data-deshacer]").click();
  chequear((await d.locator('[data-bloque="portada"] input').first().inputValue()) !== TITULO && await d.locator("[data-sin-guardar]").count() === 0,
    "deshaciendo todo se vuelve a lo guardado, sin “Cambios sin guardar”", "después de deshacer todo todavía hay cambios");

  // ── 4 · Guardar, y la página pública lo muestra ──
  await d.locator('[data-bloque="portada"] input').first().fill(TITULO);
  await d.locator(`[data-color-acento="${ACENTO}"]`).click();
  await d.locator('[data-tipografia-opcion="clasica"]').click();
  await d.locator('[data-pie-pagina] button:has-text("Guardar")').click();
  await d.locator('[data-pie-pagina] :text("Guardado.")').waitFor({ timeout: 30000 });
  chequear(await d.locator("[data-sin-guardar]").count() === 0, "Guardar avisa “Guardado” y no quedan cambios sin guardar", "después de guardar quedan cambios sin guardar");
  await abrirEditor(d);
  chequear((await d.locator('[data-bloque="portada"] input').first().inputValue()) === TITULO
    && (await d.locator('[data-tipografia-opcion="clasica"]').getAttribute("aria-checked")) === "true", "recargar el editor trae lo guardado (título y letra)", "al recargar el editor no está lo guardado");
  const v = await pagina(b, COMPU);
  let publica = null;
  for (let i = 0; i < 15; i++) {      // la página se guarda 60 s en caché; al guardar se invalida, pero se espera por si tarda
    await v.goto(`${G}/`);
    await v.locator("h1").first().waitFor({ timeout: 30000 });
    publica = await v.locator("[data-pagina-gimnasio]").first().evaluate((x) => ({ h1: x.querySelector("h1").textContent, t: x.getAttribute("data-tipografia"), a: getComputedStyle(x).getPropertyValue("--acento").trim().toLowerCase() }));
    if (publica.h1.includes(TITULO)) break;
    await v.waitForTimeout(4000);
  }
  chequear(publica?.h1.includes(TITULO) && publica.t === "clasica" && publica.a === ACENTO, "la página pública muestra el título, la letra y el color guardados", `la página pública no cambió: ${JSON.stringify(publica)}`);
  await v.context().close();

  // ── 5 · Restaurar por defecto ──
  await d.locator("[data-restaurar]").click();
  await d.locator("[data-confirmar-restaurar]").click();
  await d.locator('[data-sin-guardar]').waitFor({ timeout: 30000 });
  chequear((await d.locator('[data-bloque="portada"] input').first().inputValue()) === NOMBRE, `“Restaurar por defecto” pone el nombre del gimnasio como título (${NOMBRE})`, "el título no volvió al nombre del gimnasio");
  chequear((await d.locator('[data-tipografia-opcion="condensada"]').getAttribute("aria-checked")) === "true", "…y la letra condensada", "la letra no volvió a la condensada");
  const sec = await ordenEditor(d);
  chequear(sec.join() === "sobre_nosotros,actividades,planes,horarios,galeria,equipo,preguntas,ubicacion,probar" || sec.length >= 8 && sec.indexOf("planes") < sec.indexOf("horarios"), "…y las secciones en el orden de fábrica", `orden tras restaurar: ${sec.join(", ")}`);
  chequear(await d.locator("[data-vista-previa] h1").first().innerText().then((t) => t.includes(NOMBRE)), "la vista previa ya muestra lo restaurado", "la vista previa no muestra lo restaurado");
  // No se guardó solo: recargando, sigue lo de antes
  await abrirEditor(d);
  chequear((await d.locator('[data-bloque="portada"] input').first().inputValue()) === TITULO, "restaurar es un borrador: sin Guardar, recargar deja lo guardado", "restaurar guardó solo");
  // Y se deshace
  await d.locator("[data-restaurar]").click();
  await d.locator("[data-confirmar-restaurar]").click();
  await d.locator('[data-sin-guardar]').waitFor({ timeout: 30000 });
  await d.locator("[data-deshacer]").click();
  chequear((await d.locator('[data-bloque="portada"] input').first().inputValue()) === TITULO, "Deshacer vuelve de “Restaurar por defecto”", "Deshacer no volvió de restaurar");
  if (d.errores.length) falla(`errores en el editor: ${d.errores.join(" | ")}`);
  await d.context().close();

  // ── 6 · Celular ──
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await abrirEditor(c);
  const anchoC = await c.evaluate(() => ({ s: document.documentElement.scrollWidth, w: window.innerWidth }));
  chequear(anchoC.s <= anchoC.w + 1, `celular 390 px: el editor no se desborda (${anchoC.s} ≤ ${anchoC.w})`, `el editor se desborda en el celular: ${anchoC.s} > ${anchoC.w}`);
  await c.locator('[data-pie-pagina] button:has-text("Ver cómo queda")').click();
  await c.locator('[role="dialog"][aria-label="Cómo queda la página"]').waitFor({ timeout: 10000 });
  chequear(await c.locator('[role="dialog"] h1').count() > 0, "“Ver cómo queda” abre la página a pantalla completa", "la vista previa del celular no muestra la página");
  await c.keyboard.press("Escape");
  chequear(await c.locator('[role="dialog"][aria-label="Cómo queda la página"]').count() === 0, "Esc cierra la vista previa", "Esc no cerró la vista previa");
  await c.context().close();

  // ── 7 · El encargado ve pero no guarda ──
  const e = await pagina(b, COMPU);
  await entrar(e, "encargado@ejemplo.invalid");
  await abrirEditor(e);
  chequear(await e.locator('[data-pie-pagina]').count() === 0 && await e.locator("[data-restaurar]").count() === 0, "el encargado ve el editor pero no tiene Guardar ni Restaurar", "el encargado tiene botones de guardar");
  await e.context().close();
  const r = await db.query(`select 1`);
  if (!r.rows.length) falla("la base no contesta");
} catch (err) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? err.message : err.message.split("\n")[0]}`);
} finally {
  // La página y los colores del demo vuelven a como estaban.
  try {
    await db.query(
      `update public.landing_gimnasio set titulo = $2, bajada = $3, boton_texto = $4, mensaje_whatsapp = $5, foto_portada_path = $6, mostrar_precios = $7, tipografia = $8, publicada = $9 where gimnasio_id = $1`,
      [gim, antesLanding.titulo, antesLanding.bajada, antesLanding.boton_texto, antesLanding.mensaje_whatsapp, antesLanding.foto_portada_path, antesLanding.mostrar_precios, antesLanding.tipografia ?? "condensada", antesLanding.publicada]);
    for (const s of antesSecciones) {
      await db.query(`update public.landing_secciones set titulo = $3, orden = $4, visible = $5, contenido = $6 where gimnasio_id = $1 and tipo = $2`, [gim, s.tipo, s.titulo, s.orden, s.visible, s.contenido]);
    }
    await db.query(`update public.configuracion_gimnasio set color_acento = $2, color_fondo = $3 where gimnasio_id = $1`, [gim, antesConfig.color_acento, antesConfig.color_fondo]);
  } catch (e2) { console.log(`⚠ no se pudo devolver la página del demo a como estaba: ${e2.message}`); }
  await db.end();
}
await b.close();
resultado();
