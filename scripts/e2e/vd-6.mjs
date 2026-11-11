#!/usr/bin/env node
// VD-6 · Alta rápida desde la Entrada y alta completa en Socios.
//  1) Recepción, desde Socios: un DNI que no existe → "Darlo de alta" en la misma ventana (datos → plan →
//     cobro → entra), sin salir de la pantalla de origen.
//  2) Un error no borra nada (DNI repetido: se queda con todo lo escrito).
//  3) Alta completa en Socios: 4 pasos en una pantalla (datos, plan con tarjetas y primer pago, cobro en la
//     hoja, listo con bienvenida); un Interesado con ese celular se ofrece.
//  4) Celular sin desbordes.
//   node scripts/e2e/vd-6.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";
// F1.9: un error que nadie atrapó deja de colgar el recorrido sin ✗: se escribe qué esperaba y cuándo, y se corta con código 1.
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const dniNuevo = `38${s5}1`.padEnd(8, "4").slice(0, 8);
const cel = (n) => `000 555 ${s5.slice(-3)}${n}`;   // 10 números con característica 000: obviamente ficticio

try {
  // ── 1 · Alta rápida en la Entrada ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios`);
  await r.locator('main ul a[href^="/panel/socios/"]').first().waitFor({ timeout: 30000 });
  await r.keyboard.press("F2");
  await r.locator("[data-ventana-campo]").fill(dniNuevo);
  await r.keyboard.press("Enter");
  await r.locator("[data-ventana-nadie]").waitFor({ timeout: 30000 });
  chequear(/No hay nadie con el DNI/.test(await r.locator("[data-ventana-nadie]").innerText()), "DNI que no existe: “No hay nadie con el DNI …”", "no dice que no hay nadie");
  await r.locator("[data-ventana-alta]").click();
  const form = r.locator("[data-ventana-alta-form]");
  await form.waitFor({ timeout: 30000 });
  chequear(await form.getAttribute("data-alta-paso") === "datos", "el alta rápida se abre en la misma ventana, en Datos", "no abrió el alta");
  chequear(new RegExp(dniNuevo.replace(/\B(?=(\d{3})+(?!\d))/g, "\\.?")).test(await form.innerText()), "con el DNI ya puesto", "no muestra el DNI");
  await r.locator("[data-alta-nombre]").fill(`Rapido${s5}`);
  await r.locator("[data-alta-apellido]").fill("Prueba");
  await r.locator("[data-alta-celular]").fill(cel(1));
  await capturar(r, "vd6-compu-alta-datos");
  await r.locator("[data-alta-siguiente]").click();
  await r.locator("[data-plan-tarjeta]").first().waitFor({ timeout: 30000 }).catch(async (e) => {
    const f = await r.locator("[data-ventana-alta-form]").evaluateAll((l) => l.map((x) => `paso=${x.getAttribute("data-alta-paso")}: ${x.innerText.replace(/\s+/g, " ").slice(0, 400)}`)).catch(() => []);
    throw new Error(`${e.message.split("\n")[0]} | alta: ${f.join(" || ") || "(sin formulario)"}`);
  });
  await elegirPlan(r, 0);
  chequear(await r.locator("[data-primer-pago]").count() === 1, "el plan con tarjetas muestra su primer pago (lo calcula la base)", "no hay primer pago");
  await capturar(r, "vd6-compu-alta-plan");
  await r.locator("[data-alta-cobrar]").click();
  await r.locator('[data-cobrar] [data-cobrar-confirmar]').waitFor({ timeout: 30000 });
  chequear(await r.locator("[data-cobrar-linea=cuota]").count() === 1, "Guardar y cobrar abre la hoja Cobrar con la cuota del plan", "la hoja no trae la cuota");
  // Efectivo: una transferencia queda pendiente de aprobación y el veredicto no sería verde. Si no hay turno de caja, se abre acá mismo.
  await r.locator("[data-cobrar-medio]", { hasText: "Efectivo" }).click();
  if (await r.locator("[data-abrir-turno]").waitFor({ timeout: 3000 }).then(() => true, () => false)) {
    await r.locator('input[aria-label="Fondo del turno"]').fill("1000");
    await r.locator("[data-abrir-turno]").click();
    await r.locator("[data-cobrar-caja]").waitFor({ timeout: 30000 });
  }
  await r.locator("[data-cobrar-confirmar]").click();
  await r.locator('[data-ventana-veredicto="verde"]').waitFor({ timeout: 30000 }).catch(async (e) => {
    const hojas = await r.locator("dialog[open], [role=dialog], [data-cobrar], [data-ventana-veredicto], [data-cobrar-hecho]").evaluateAll((l) => l.map((x) => `${x.tagName}${[...x.attributes].filter((a) => a.name.startsWith("data-")).map((a) => ` ${a.name}=${a.value}`).join("")}: ${x.innerText.replace(/\s+/g, " ").slice(0, 300)}`));
    throw new Error(`${e.message.split("\n")[0]} | en pantalla: ${hojas.join(" || ") || "(sin hoja ni ventana)"}`);
  });
  chequear(await r.locator("[data-ventana-cobrado]").count() === 1, "cobrado: vuelve a la ventana con el veredicto en verde", "no volvió con el cobro");
  await r.waitForFunction(() => document.activeElement?.hasAttribute("data-ventana-anotar"), null, { timeout: 10000 });
  await r.keyboard.press("Enter");
  await r.locator('[data-ventana-hecho="entro"]').waitFor({ timeout: 30000 });
  chequear(new URL(r.url()).pathname === "/panel/socios", "DNI nuevo → alta → cobro → entró, sin salir de la pantalla de origen", `terminó en ${r.url()}`);
  await capturar(r, "vd6-compu-entro");
  await r.keyboard.press("Escape");
  await r.locator("[data-ventana-campo]").waitFor({ state: "hidden", timeout: 10000 });   // F2 abre y cierra: se espera a que la ventana esté cerrada

  // ── 2 · Lo escrito no se pierde: sin nombre no se guarda, un celular roto no rompe y Esc vuelve con el DNI ──
  await r.keyboard.press("F2");
  const otroDni = `37${s5}2`.padEnd(8, "5").slice(0, 8);
  await r.waitForFunction(() => document.activeElement?.hasAttribute("data-ventana-campo"), null, { timeout: 10000 });   // abierta y con el foco en el campo antes de escribir
  await r.locator("[data-ventana-campo]").fill(otroDni);
  await r.keyboard.press("Enter");
  await r.locator("[data-ventana-nadie]").waitFor({ timeout: 30000 }).catch(async (e) => {
    const v = await r.locator("[data-ventana-campo], [data-ventana-hecho], [data-ventana-veredicto], [role=alert]").evaluateAll((l) => l.map((x) => `${x.tagName}: ${(x.value ?? x.innerText ?? "").toString().replace(/\s+/g, " ").slice(0, 200)}`)).catch(() => []);
    throw new Error(`${e.message.split("\n")[0]} | ventana: ${v.join(" || ") || "(cerrada)"}`);
  });
  await r.keyboard.press("a");
  await r.locator("[data-ventana-alta-form]").waitFor({ timeout: 30000 });
  await r.locator("[data-alta-nombre]").fill("");
  chequear(await r.locator("[data-alta-solo]").isDisabled(), "sin nombre no se puede guardar (el botón espera)", "deja guardar sin nombre");
  await r.locator("[data-alta-nombre]").fill(`Texto${s5}`);
  await r.locator("[data-alta-celular]").fill("12");   // celular a medio escribir: no rompe
  await r.locator("[data-alta-celular]").blur();
  chequear(await r.locator("[data-interesado-ofrecido]").count() === 0, "un celular a medio escribir no ofrece a nadie ni da error", "ofreció a alguien con un celular roto");
  await r.keyboard.press("Escape");
  await r.locator("[data-ventana-campo]").waitFor({ timeout: 10000 });
  chequear((await r.locator("[data-ventana-campo]").inputValue()).replace(/\./g, "") === otroDni, "Esc vuelve a la búsqueda con el DNI puesto (no se pierde)", "perdió el DNI");
  await r.keyboard.press("Escape");
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);
  await r.context().close();

  // ── 3 · Alta completa en Socios: 4 pasos, con un Interesado ofrecido ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/prospectos`);
  await d.locator("main").waitFor({ timeout: 30000 });
  await d.locator('button:has-text("Anotar uno que preguntó")').click();
  await d.locator('[data-form-prospecto] input[name="nombre"]').fill(`Interesado${s5}`);
  await d.locator('[data-form-prospecto] input[name="telefono"]').fill(cel(3));
  await d.locator('[data-form-prospecto] button[type="submit"]').click();
  await d.getByText(`Interesado${s5}`).first().waitFor({ timeout: 30000 });
  ok("un Interesado anotado con su celular");

  await d.goto(`${G}/panel/socios/nuevo`);
  chequear(await d.locator("[data-pasos-alta]").getAttribute("data-pasos-alta") === "1", "el alta completa muestra los 4 pasos, en el 1 (Datos)", "no hay pasos");
  await d.locator('input[name="nombre"]').fill(`Completo${s5}`);
  await d.locator('input[name="telefono"]').fill(cel(3));
  await d.locator('input[name="telefono"]').blur();
  await d.locator("[data-interesado-ofrecido]").waitFor({ timeout: 30000 });
  ok(`el Interesado con ese celular se ofrece: “${(await d.locator("[data-interesado-ofrecido]").innerText()).split("\n")[0].slice(0, 60)}”`);
  await d.getByRole("button", { name: "Sí, es esa persona" }).click();
  await elegirPlan(d, 0);
  chequear(await d.locator("[data-pasos-alta]").getAttribute("data-pasos-alta") === "2", "al elegir plan el paso pasa a 2 (Plan) y muestra el primer pago", "no avanzó el paso");
  chequear(await d.locator("[data-primer-pago]").count() === 1, "primer pago visible (cuota + matrícula + total)", "no hay primer pago");
  await capturar(d, "vd6-compu-alta-completa");
  await d.locator('button:has-text("Dar de alta y cobrar")').click();
  await d.locator('[data-cobrar] [data-cobrar-confirmar]').waitFor({ timeout: 30000 }).catch(async (e) => {
    const hoja = await d.evaluate(() => `hoja montada=${document.documentElement.dataset.cobrarHoja ?? "no"}; [data-cobrar]=${document.querySelector("[data-cobrar]")?.innerText.replace(/\s+/g, " ").slice(0, 300) ?? "(no está)"}; alertas=${[...document.querySelectorAll("[role=alert]")].map((x) => x.innerText).join(" / ")}`);
    throw new Error(`${e.message.split("\n")[0]} | URL ${d.url()} | ${hoja}`);
  });
  chequear(new URL(d.url()).pathname === "/panel/socios/nuevo", "cobro embebido: la hoja se abre sobre el alta, sin ir a Vender", `fue a ${d.url()}`);
  await d.locator("[data-cobrar-medio]", { hasText: "Transferencia" }).click();
  await d.locator("[data-cobrar-confirmar]").click();
  await d.locator("[data-alta-paso=listo]").waitFor({ timeout: 30000 });
  chequear(await d.locator("[data-pasos-alta]").getAttribute("data-pasos-alta") === "4", "listo con bienvenida: paso 4", "no llegó al paso 4");
  await capturar(d, "vd6-compu-alta-lista");
  // La hoja de cobrar tiene su propio "Listo"; se cierra para ver la bienvenida.
  const cerrar = d.locator('[data-cobrar] [data-cobrar-volver]');
  if (await cerrar.count()) await cerrar.first().click();
  await d.locator("[data-alta-ficha]").waitFor({ timeout: 30000 });
  await d.locator("[data-alta-ficha]").click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}/, { timeout: 30000 });
  await d.getByText(`Completo${s5}`).first().waitFor({ timeout: 30000 });
  ok("la ficha del socio nuevo (marcado como “se hizo socio” al venir de un Interesado)");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
  await d.context().close();

  // ── 4 · Celular ──
  const c = await pagina(b, CELU);
  await entrar(c, "recepcion@ejemplo.invalid");
  await c.goto(`${G}/panel/socios/nuevo`);
  await c.locator('input[name="nombre"]').waitFor({ timeout: 30000 });
  await elegirPlan(c, 0);
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `alta completa en celular sin desborde (${ancho}px)`, `mide ${ancho}px`);
  await capturar(c, "vd6-celu-alta");
  await c.goto(`${G}/panel/socios`);
  await c.locator("main").waitFor({ timeout: 30000 });
  await c.locator("[data-boton-ventana]").click();
  await c.locator("[data-ventana-campo]").fill(`36${s5}9`.padEnd(8, "6").slice(0, 8));
  await c.keyboard.press("Enter");
  await c.locator("[data-ventana-alta]").click();
  await c.locator("[data-alta-nombre]").fill("Celu");
  await c.locator("[data-alta-siguiente]").click();
  await c.locator("[data-plan-tarjeta]").first().waitFor({ timeout: 30000 });
  const ancho2 = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho2 <= CELU.width, `alta rápida en celular sin desborde (${ancho2}px)`, `mide ${ancho2}px`);
  await capturar(c, "vd6-celu-alta-rapida");
  if (c.errores.length) falla(`recepción celu: ${c.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
