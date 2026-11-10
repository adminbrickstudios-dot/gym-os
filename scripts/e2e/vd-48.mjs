#!/usr/bin/env node
// VD-48 · Salida opcional (D30). La dueña prende "Registrar la salida" en Configuración → Entrada; la recepción
// anota a un socio (DNI → Enter → Enter) y al irse escribe DNI + S: "Chau …, estuviste …"; una segunda salida sin
// entrada abierta no rompe nada ("No tenía entrada abierta"); con "obligatoria", entrar de nuevo sin haber salido
// avisa y ofrece marcar la salida; en la tablet, "Me voy". Inicio dice "Adentro ahora" (exacto) con la salida prendida.
//   node scripts/e2e/vd-48.mjs     (con scripts/local/levantar.sh corriendo)
// Escrito siguiendo vd-1 y ent-3; el QR de la pared ("Me voy" en la app) usa la cámara y se prueba en la base
// (salir_por_qr_pared en supabase/pruebas/salida-opcional.test.mjs).
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan, hojaDeAlta, irAVender } from "./alta.mjs";

const G = GIMNASIO();
const TABLET = { width: 820, height: 1180 };
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const dni = `38${s5}0`.slice(0, 8).padEnd(8, "6");   // 8 números, distinto en cada corrida

async function salida(d, modo) {
  await d.goto(`${G}/panel/configuracion?pestana=entrada`);
  await d.locator("[data-config-visita]").waitFor({ timeout: 30000 });
  await d.locator(`[data-salida="${modo}"]`).click();
  await d.locator("[data-config-visita] button:has-text('Guardar')").click();
  await d.locator("[data-config-visita]").getByText("Guardado.").waitFor({ timeout: 30000 });
}
async function reglas(d) {
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 }); await d.waitForTimeout(500);
}
async function guardarReglas(d) {
  const pie = d.locator('[data-pie="reglas"]'); const k = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await d.waitForFunction((k) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > k, k, { timeout: 30000 });
}
/** Con la ventana de Entrada: tipear el DNI desde Socios, Enter (veredicto) y Enter (anota). */
async function anotar(r) {
  await r.goto(`${G}/panel/socios`);
  const enlace = r.locator('main ul a[href^="/panel/socios/"]').first();
  await enlace.waitFor({ timeout: 30000 });
  await enlace.focus();
  await r.keyboard.type(dni);
  await r.locator("[data-ventana-campo]").waitFor({ timeout: 10000 });
  await r.keyboard.press("Enter");
  await r.locator("[data-ventana-veredicto]").waitFor({ timeout: 30000 });
  await r.keyboard.press("Enter");
  await r.locator("[data-ventana-hecho]").waitFor({ timeout: 30000 });
}
/** DNI + S: la salida. Espera un momento a que la ventana sepa si el gimnasio registra la salida. */
async function irse(r) {
  await r.goto(`${G}/panel/socios`);
  const enlace = r.locator('main ul a[href^="/panel/socios/"]').first();
  await enlace.waitFor({ timeout: 30000 });
  await enlace.focus();
  await r.keyboard.type(dni);
  const campo = r.locator("[data-ventana-campo]");
  await campo.waitFor({ timeout: 10000 });
  await r.waitForTimeout(1200);
  await r.keyboard.press("s");
  const res = r.locator("[data-ventana-salida]");
  await res.waitFor({ timeout: 30000 });
  return res;
}

try {
  // ── Una persona nueva, con su DNI, al día ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Salida${s5}`);
  await d.locator('input[name="dni"]').fill(dni);
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Dar de alta y cobrar")').click();
  await irAVender(d, await hojaDeAlta(d));
  await d.getByText(/^Cuota /).first().waitFor({ timeout: 30000 });
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await d.locator('button:has-text("Cobrar")').click();
  await esperarCobro(d);
  ok(`una persona nueva al día con el DNI ${dni}`);

  // ── Configuración → Entrada: Registrar la salida, apagada por defecto, con su explicación ──
  await d.goto(`${G}/panel/configuracion?pestana=entrada`);
  await d.locator("[data-config-visita]").waitFor({ timeout: 30000 });
  chequear(await d.locator("[data-registrar-salida]").getAttribute("data-registrar-salida") === "no", "Registrar la salida arranca en “No”", "no arranca apagada");
  chequear((await d.locator("[data-registrar-salida]").innerText()).length > 60, "cada opción lleva su explicación", "sin explicación");
  await salida(d, "opcional");
  await d.reload();
  await d.locator("[data-registrar-salida]").waitFor({ timeout: 30000 });
  chequear(await d.locator("[data-registrar-salida]").getAttribute("data-registrar-salida") === "opcional", "queda guardado: Opcional", "no se guardó");

  // ── Recepción: DNI → entra → DNI + S → "Chau, estuviste …" ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await anotar(r);
  ok("DNI → Enter → Enter: la entrada queda anotada");
  await r.locator("[data-ventana-entrada]").waitFor({ state: "detached", timeout: 15000 });
  const res = await irse(r);
  const texto = await res.innerText();
  chequear(await res.getAttribute("data-ventana-salida") === "registrada" && /Chau .*, estuviste (menos de 1 min|\d+ (min|h))/.test(texto), `DNI + S: “${texto.replace(/\s+/g, " ").slice(0, 60)}”`, `la salida dice: ${texto}`);
  await capturar(r, "vd48-compu-chau");

  // ── Una salida más, sin entrada abierta: no rompe nada ──
  await r.locator("[data-ventana-entrada]").waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
  const otra = await irse(r);
  const t2 = await otra.innerText();
  chequear(await otra.getAttribute("data-ventana-salida") === "sin-entrada" && /No tenía entrada abierta/.test(t2), "una salida sin entrada abierta dice “No tenía entrada abierta” (sin error)", `dice: ${t2}`);
  await capturar(r, "vd48-compu-sin-entrada");

  // ── Inicio: "Adentro ahora" (exacto) ──
  await r.goto(`${G}/panel`);
  await r.locator("main").waitFor({ timeout: 30000 });
  chequear(/Adentro ahora/.test(await r.locator("main").innerText()), "Inicio: con la salida prendida el número dice “Adentro ahora”", "Inicio no dice Adentro ahora");

  // ── Obligatoria: entrar de nuevo sin haber salido avisa y ofrece marcar la salida ──
  await salida(d, "obligatoria");
  await anotar(r);   // vuelve a entrar después de haber salido: reingreso (no gasta nada)
  await r.locator("[data-ventana-entrada]").waitFor({ state: "detached", timeout: 15000 });
  await anotar(r);   // y de nuevo, sin haber salido: aviso
  const hecho = r.locator("[data-ventana-hecho]");
  const dice = await hecho.innerText();
  chequear(/no marcó la salida: ¿se va\?/.test(dice), `obligatoria: “${dice.replace(/\s+/g, " ").slice(0, 70)}”`, `no avisó: ${dice}`);
  await capturar(r, "vd48-compu-obligatoria");
  await r.locator("[data-ventana-salida-boton]").click();
  await r.locator('[data-ventana-salida="registrada"]').waitFor({ timeout: 30000 });
  ok("el aviso ofrece “Marcar salida” y la marca");
  if (r.errores.length) falla(`compu: ${r.errores.join(" | ")}`);
  await r.context().close();

  // ── La tablet: "Me voy" ──
  await salida(d, "opcional");
  await reglas(d);
  const sw = d.locator("[data-accesos] label", { hasText: "Tablet en la puerta" }).locator("input");
  if (!(await sw.isChecked())) { await sw.click(); await guardarReglas(d); }
  await d.locator('button:has-text("Autorizar una tablet")').click();
  const link = await d.locator("[data-link-tablet]").getAttribute("data-link-tablet", { timeout: 30000 });
  const t = await pagina(b, TABLET);
  await t.goto(link);
  await t.locator('[data-kiosco="listo"]').waitFor({ timeout: 60000 });
  await t.locator('input[aria-label="Tu DNI"]').fill(dni);
  await t.locator('input[aria-label="Tu DNI"]').press("Enter");
  await t.locator("[data-kiosco-resultado]").waitFor({ timeout: 30000 });
  await t.locator('[data-kiosco="listo"]').waitFor({ timeout: 15000 });
  await t.locator('input[aria-label="Tu DNI"]').fill(dni);
  await t.locator("[data-kiosco-me-voy]").click();
  const k = t.locator("[data-kiosco-resultado]");
  await k.waitFor({ timeout: 30000 });
  const kt = await k.innerText();
  chequear(await k.getAttribute("data-kiosco-resultado") === "salio" && /Chau .*, estuviste/.test(kt), `tablet: “Me voy” dice “${kt.replace(/\s+/g, " ").slice(0, 60)}”`, `la tablet dice: ${kt}`);
  await capturar(t, "vd48-tablet-me-voy");
  await t.locator('[data-kiosco="listo"]').waitFor({ timeout: 15000 });
  await t.locator('input[aria-label="Tu DNI"]').fill("99999999");
  await t.locator("[data-kiosco-me-voy]").click();
  await k.waitFor({ timeout: 30000 });
  chequear(await k.getAttribute("data-kiosco-resultado") === "sin-entrada" && !/Chau/.test(await k.innerText()), "un DNI que no entró (o no existe) contesta lo mismo, sin nombre", "revela algo de más");
  await t.context().close();

  // ── Dejar todo como estaba ──
  await salida(d, "no");
  chequear(await d.locator("[data-registrar-salida]").getAttribute("data-registrar-salida") === "no", "vuelve a “No”", "no volvió");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
  await d.context().close();

  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/configuracion?pestana=entrada`);
  await c.locator("[data-registrar-salida]").waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  chequear(ancho <= 0, "celular 390 px: Registrar la salida no desborda", `desborda ${ancho} px`);
  await capturar(c, "vd48-celu-config");
  await c.context().close();
} finally {
  await b.close();
}
resultado();
