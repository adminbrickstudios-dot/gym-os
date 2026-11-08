#!/usr/bin/env node
// VD-29 · Ctrl+K con acciones: "cobrar <nombre>" abre Cobrar con esa persona; "entrada <dni>" abre la ventana
// de Entrada con ese DNI; "nuevo socio", "abrir turno" y "vender" llevan a su pantalla; "tarea …" anota una
// tarea para hoy sin salir; los resultados van agrupados (Acciones · Socios · Pantallas) con el primero marcado
// y flechas/Enter/Esc; la recepción no ve acciones de dueño (cargar un gasto); en el celular (390 px) no desborda.
//   node scripts/e2e/vd-29.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const dni = `9${s5}${s5.slice(0, 2)}`;   // 8 cifras, único por corrida

const dialogo = (p) => p.locator('[role=dialog][aria-label=Buscar]');
const abrirBuscador = async (p) => { await p.keyboard.press("Control+k"); await dialogo(p).waitFor({ timeout: 15000 }); };
const escribir = async (p, t) => { const c = dialogo(p).locator("input"); await c.fill(""); await c.fill(t); };
const cerrar = async (p) => { await p.keyboard.press("Escape"); await dialogo(p).waitFor({ state: "detached", timeout: 5000 }).catch(() => {}); };
const accion = (p, verbo) => dialogo(p).locator(`[data-buscador-accion="${verbo}"]`);

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");

  // Un socio nuevo con DNI y plan, sin pagar (para cobrarle y para la Entrada).
  const nombre = `Cobrame${s5}`;
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(nombre);
  await d.locator('input[name="dni"]').fill(dni);
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Solo dar de alta")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
  const socioId = new URL(d.url()).pathname.split("/").pop();

  // ── El campo vacío enseña qué se puede escribir ──
  await d.goto(`${G}/panel`);
  await d.locator("main h1").first().waitFor({ timeout: 60000 });
  await abrirBuscador(d);
  chequear(await dialogo(d).locator("[data-buscador-ejemplos] button").count() >= 3, "campo vacío: ejemplos de lo que se puede escribir (clicables)", "sin ejemplos");

  // ── "cobrar <nombre>": Acciones primero, la primera marcada, Enter abre Cobrar con esa persona ──
  await escribir(d, `cobrar ${nombre}`);
  await accion(d, "cobrar").first().waitFor({ timeout: 30000 });
  chequear(await dialogo(d).getByText("Acciones", { exact: true }).count() === 1, "el resultado está agrupado: título “Acciones”", "falta el título Acciones");
  chequear(await accion(d, "cobrar").first().evaluate((e) => e.hasAttribute("data-fila-marcada")), "la primera acción viene preseleccionada", "la primera no está marcada");
  chequear((await accion(d, "cobrar").first().innerText()).includes(nombre), `la acción dice “Cobrar a ${nombre}”`, "la acción no nombra a la persona");
  await capturar(d, "vd29-compu-cobrar");
  await d.keyboard.press("Enter");
  await d.locator("[data-cobrar-socio]").waitFor({ timeout: 30000 });
  chequear((await d.locator("[data-cobrar-socio]").innerText()).includes(nombre), `Enter abre Cobrar con ${nombre}`, "Cobrar no abrió con esa persona");
  await d.keyboard.press("Escape");
  await d.locator("[data-cobrar]").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});

  // Con verbos en castellano y sinónimos: "cobrale a …" también.
  await abrirBuscador(d);
  await escribir(d, `cobrale a ${nombre}`);
  chequear(await accion(d, "cobrar").first().waitFor({ timeout: 30000 }).then(() => true, () => false), "sinónimo: “cobrale a …” también ofrece Cobrar", "“cobrale a” no ofrece Cobrar");
  await cerrar(d);

  // ── "entrada <dni>": la ventana de Entrada con ese DNI ──
  await d.goto(`${G}/panel`);   // en la pantalla Entrada la acción usa la Puerta de esa pantalla; la ventana se abre desde cualquier otra
  await d.waitForFunction(() => document.documentElement.dataset.ventanaEntrada === "si", null, { timeout: 30000 });
  await abrirBuscador(d);
  await escribir(d, `entrada ${dni}`);
  await accion(d, "entrada").first().waitFor({ timeout: 15000 });
  chequear((await accion(d, "entrada").first().innerText()).includes(dni), "“entrada <dni>” ofrece abrir la Entrada con ese DNI", "no nombra el DNI");
  await d.keyboard.press("Enter");
  await d.locator("[data-ventana-entrada]").waitFor({ timeout: 30000 });
  await d.locator("[data-ventana-veredicto]").waitFor({ timeout: 30000 });
  chequear((await d.locator("[data-ventana-entrada]").innerText()).includes(nombre), `la ventana de Entrada abre con ${nombre} (por su DNI)`, "la ventana no resolvió el DNI");
  await d.keyboard.press("Escape");
  await d.locator("[data-ventana-entrada]").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});

  // ── "ficha <nombre>" ──
  await abrirBuscador(d);
  await escribir(d, `ficha ${nombre}`);
  await accion(d, "ficha").first().waitFor({ timeout: 30000 });
  await d.keyboard.press("Enter");
  await d.waitForURL(new RegExp(`/panel/socios/${socioId}$`), { timeout: 30000 });
  chequear(true, "“ficha <nombre>” abre la ficha", "");

  // ── "nuevo socio", "abrir turno", "vender" ──
  for (const [texto, verbo, ruta] of [["nuevo socio", "nuevo_socio", "/panel/socios/nuevo"], ["abrir turno", "abrir_turno", "/panel/caja"], ["cerrar turno", "cerrar_turno", "/panel/caja"], ["vender", "vender", "/panel/vender"]]) {
    await d.goto(`${G}/panel`);
    await d.locator("main h1").first().waitFor({ timeout: 60000 });
    await abrirBuscador(d);
    await escribir(d, texto);
    await accion(d, verbo).first().waitFor({ timeout: 15000 });
    await d.keyboard.press("Enter");
    await d.waitForURL(new RegExp(`${ruta}(\\?|$)`), { timeout: 30000 }).then(() => chequear(true, `“${texto}” + Enter lleva a ${ruta}`, ""), () => falla(`“${texto}” + Enter no llevó a ${ruta} (${d.url()})`));
  }

  // ── Flechas: baja a la pantalla, sube a la acción; Esc cierra ──
  await d.goto(`${G}/panel`);
  await d.locator("main h1").first().waitFor({ timeout: 60000 });
  await abrirBuscador(d);
  await escribir(d, "vender");
  await accion(d, "vender").first().waitFor({ timeout: 15000 });
  await d.keyboard.press("ArrowDown");
  chequear(await dialogo(d).locator("[data-fila-marcada]").evaluate((e) => !e.hasAttribute("data-buscador-accion")), "flecha abajo marca la fila de abajo (la pantalla)", "la flecha no movió la marca");
  await d.keyboard.press("ArrowUp");
  chequear(await accion(d, "vender").first().evaluate((e) => e.hasAttribute("data-fila-marcada")), "flecha arriba vuelve a la acción", "la flecha arriba no volvió");
  chequear(await dialogo(d).getByText("Pantallas", { exact: true }).count() === 1, "las pantallas van en su grupo “Pantallas”", "falta el título Pantallas");
  await cerrar(d);
  chequear(await dialogo(d).count() === 0, "Esc cierra", "Esc no cerró");

  // ── "tarea …": una tarea para hoy sin salir de donde estás ──
  const que = `Reponer agua ${s5}`;
  await abrirBuscador(d);
  await escribir(d, `tarea ${que}`);
  await accion(d, "tarea").first().waitFor({ timeout: 15000 });
  await d.keyboard.press("Enter");
  await dialogo(d).locator("[data-buscador-tarea-ok]").waitFor({ timeout: 30000 });
  chequear(true, "“tarea …” anota la tarea y avisa sin cerrar", "");
  await cerrar(d);
  await d.goto(`${G}/panel/tareas`);
  chequear(await d.getByText(que).first().waitFor({ timeout: 30000 }).then(() => true, () => false), "la tarea aparece en Para hacer hoy", "la tarea no está en Para hacer hoy");

  // ── Permisos: el dueño carga gastos; la recepción no ve esa acción ni la pantalla ──
  await d.goto(`${G}/panel`);
  await abrirBuscador(d);
  await escribir(d, "nuevo gasto luz");
  chequear(await accion(d, "gasto").first().waitFor({ timeout: 15000 }).then(() => true, () => false), "el dueño ve “Cargar un gasto”", "el dueño no ve la acción de gastos");
  await cerrar(d);

  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel`);
  await r.locator("main h1").first().waitFor({ timeout: 60000 });
  await abrirBuscador(r);
  await escribir(r, "nuevo gasto luz");
  await r.waitForTimeout(600);
  chequear(await accion(r, "gasto").count() === 0 && await dialogo(r).locator('a[href="/panel/gastos"]').count() === 0, "la recepción NO ve acciones de dueño (gastos)", "la recepción ve la acción o la pantalla de gastos");
  await escribir(r, "nuevo socio");
  chequear(await accion(r, "nuevo_socio").first().waitFor({ timeout: 15000 }).then(() => true, () => false), "la recepción sí ve “Nuevo socio”", "la recepción no ve Nuevo socio");
  await escribir(r, `cobrar ${nombre}`);
  chequear(await accion(r, "cobrar").first().waitFor({ timeout: 30000 }).then(() => true, () => false), "la recepción cobra desde Ctrl+K", "la recepción no puede cobrar desde Ctrl+K");
  await cerrar(r);

  // ── Búsqueda común intacta: un nombre sigue dando Socios + ficha; una pantalla sigue dando su link ──
  await abrirBuscador(d);
  await escribir(d, nombre);
  await dialogo(d).locator(`a[href="/panel/socios/${socioId}"]`).first().waitFor({ timeout: 30000 });
  chequear(await dialogo(d).getByText("Socios", { exact: true }).count() >= 1, "búsqueda común: el socio sigue en su grupo “Socios”", "se perdió el grupo Socios");
  await escribir(d, "caja");
  chequear(await dialogo(d).locator('a[href="/panel/caja"]').count() > 0, "búsqueda común: “caja” sigue llevando a Caja", "“caja” ya no muestra Caja");
  await cerrar(d);

  // ── Celular (390 px): abre con la lupa, no desborda ──
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel`);
  await c.locator("main h1").first().waitFor({ timeout: 60000 });
  await c.locator('button[aria-label="Buscar"]').first().click();
  await dialogo(c).waitFor({ timeout: 15000 });
  await escribir(c, `cobrar ${nombre}`);
  await accion(c, "cobrar").first().waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => ({ doc: document.documentElement.scrollWidth, vista: window.innerWidth }));
  chequear(ancho.doc <= ancho.vista + 1, "celular 390 px: Ctrl+K con acciones no desborda", `desborda: ${ancho.doc} > ${ancho.vista}`);
  const caja = await accion(c, "cobrar").first().boundingBox();
  chequear(!!caja && caja.height >= 44 && caja.x >= 0 && caja.x + caja.width <= 391, "celular: la acción se toca bien (alta y dentro de la pantalla)", `la acción mide ${JSON.stringify(caja)}`);
  await capturar(c, "vd29-celu-cobrar");
  await c.keyboard.press("Enter");
  await c.locator("[data-cobrar-socio]").waitFor({ timeout: 30000 });
  chequear(true, "celular: Enter abre Cobrar con la persona", "");

  for (const p of [d, r, c]) if (p.errores?.length) falla(`errores de consola: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
