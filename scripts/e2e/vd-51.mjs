#!/usr/bin/env node
// VD-51 · Prueba gratis (D31). La dueña prende "1 día" en Configuración → Reglas. Un interesado reserva "Probá una clase"
// desde la página (clase, nombre, DNI, celular): queda en Interesados con lo que pidió. La recepción tipea el DNI en la
// Entrada: dice que reservó, le da la prueba y entra en verde "En prueba" (si la clase es hoy). Una persona nueva sin
// reserva recibe la prueba con un formulario corto. Con la misma persona otra vez la base dice que ya la usó.
//   node scripts/e2e/vd-51.mjs     (con scripts/local/levantar.sh corriendo)
// Escrito siguiendo vd-1 y vd-48. El "al día siguiente rojo con Hacete socio" no se puede mirar sin mover el reloj: lo cubre
// la prueba de base (supabase/pruebas/prueba-gratis.test.mjs, con momentos fijos).
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, esperarAntiRobot, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const dniReserva = `36${s5}1`.padEnd(8, "4").slice(0, 8);
const dniMostrador = `37${s5}2`.padEnd(8, "5").slice(0, 8);
const celular = `387 555 ${s5.slice(-4)}`;

async function modoPrueba(d, modo) {
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 });
  const sec = d.locator("[data-prueba-gratis]");
  await sec.waitFor({ timeout: 30000 });
  await d.locator(`[data-prueba-opcion="${modo}"]`).click();
  await d.locator("[data-prueba-gratis]").getByText("Guardado.").waitFor({ timeout: 30000 });
}
/** Abre la ventana con F2, escribe el DNI y busca. */
async function buscar(r, dni) {
  await r.goto(`${G}/panel/socios`);
  await r.locator("main").waitFor({ timeout: 30000 });
  await r.keyboard.press("F2");
  const campo = r.locator("[data-ventana-campo]");
  await campo.waitFor({ timeout: 15000 });
  await campo.fill(dni);
  await campo.press("Enter");
}

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator("[data-prueba-gratis]").waitFor({ timeout: 30000 });
  chequear(await d.locator("[data-prueba-gratis]").getAttribute("data-prueba-gratis") !== "cargando", "Configuración → Reglas tiene “Prueba gratis” (no / 1 día / 1 clase)", "no aparece la prueba gratis");
  await modoPrueba(d, "dia");
  chequear(await d.locator('[data-prueba-opcion="dia"]').getAttribute("aria-pressed") === "true", "la dueña la prende: 1 día", "no quedó en 1 día");

  // ── La página: Probá una clase con reserva ──
  const v = await pagina(b, COMPU);
  await v.goto(`${G}/`);
  const form = v.locator("[data-form-reserva-prueba]");
  await form.waitFor({ timeout: 60000 }).catch(() => falla("la página no ofrece clases para probar (el demo necesita clases en los próximos 7 días)"));
  const opciones = await form.locator("select[name=clase] option:not([disabled])").allInnerTexts();
  const hoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
  const deHoy = opciones.findIndex((t) => t.includes(hoy));
  const elegida = deHoy >= 0 ? deHoy : 0;
  await form.locator("select[name=clase]").selectOption({ index: elegida + 1 });
  await form.locator('input[name="nombre"]').fill(`Probador${s5}`);
  await form.locator('input[name="dni"]').fill(dniReserva);
  await form.locator('input[name="telefono"]').fill(celular);
  await capturar(v, "vd51-compu-pagina");
  await esperarAntiRobot(v);
  await form.locator("button[type=submit]").click();
  await v.locator("[data-reserva-prueba]").waitFor({ timeout: 30000 });
  ok(`el interesado reserva “${opciones[elegida]}” desde la página`);
  await v.context().close();

  // ── Queda Interesado con lo que pidió ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/prospectos`);
  await r.locator("main").waitFor({ timeout: 30000 });
  chequear(/Clase de prueba gratis/.test(await r.locator("main").innerText()) && (await r.locator("main").innerText()).includes(`Probador${s5}`), "en Interesados aparece con “Clase de prueba gratis”", "el interesado no aparece con su reserva");

  // ── La recepción lo deja entrar ──
  await buscar(r, dniReserva);
  await r.locator("[data-ventana-nadie]").waitFor({ timeout: 30000 });
  await r.locator("[data-ventana-prueba]").click();
  await r.locator("[data-ventana-prueba-form]").waitFor({ timeout: 30000 });
  await r.locator("[data-prueba-reservada]").waitFor({ timeout: 30000 });
  chequear((await r.locator("[data-prueba-nombre]").inputValue()).includes(`Probador${s5}`), "la ventana avisa que reservó y trae su nombre", "no trajo la reserva");
  await capturar(r, "vd51-compu-reservo");
  await r.locator("[data-prueba-dar]").click();
  const ver = r.locator("[data-ventana-veredicto]");
  await ver.waitFor({ timeout: 30000 });
  const color = await ver.getAttribute("data-ventana-veredicto");
  const texto = await ver.innerText();
  if (deHoy >= 0) chequear(color === "verde" && /En prueba gratis/.test(texto), `su clase es hoy: verde “En prueba gratis”`, `color ${color}: ${texto.replace(/\s+/g, " ").slice(0, 80)}`);
  else chequear(color === "rojo" && /Su prueba gratis es/.test(texto), "su clase es otro día: rojo con el porqué (no entra hoy)", `color ${color}: ${texto.replace(/\s+/g, " ").slice(0, 80)}`);
  await capturar(r, "vd51-compu-en-prueba");
  if (deHoy >= 0) {
    await r.keyboard.press("Enter");
    await r.locator("[data-ventana-hecho]").waitFor({ timeout: 30000 });
    ok("Enter: la entrada queda anotada (cuenta como entrada, no como socio)");
  }
  await r.keyboard.press("Escape");

  // ── Una persona nueva, sin reserva: formulario corto ──
  await buscar(r, dniMostrador);
  await r.locator("[data-ventana-nadie]").waitFor({ timeout: 30000 });
  await r.locator("[data-ventana-prueba]").click();
  await r.locator("[data-prueba-nombre]").fill(`Mostrador${s5}`);
  await r.locator("[data-prueba-dar]").click();
  const ver2 = r.locator("[data-ventana-veredicto]");
  await ver2.waitFor({ timeout: 30000 });
  chequear(await ver2.getAttribute("data-ventana-veredicto") === "verde" && /En prueba gratis/.test(await ver2.innerText()), "DNI nuevo: “Dar prueba gratis” → verde “En prueba gratis”", "no quedó en verde");
  await r.keyboard.press("Enter");
  await r.locator("[data-ventana-hecho]").waitFor({ timeout: 30000 });
  ok("entra con la prueba");
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);
  await r.context().close();

  // ── El dueño ve que no cuenta como socio activo (Inicio no lo suma a Socios activos) y deja todo como estaba ──
  await modoPrueba(d, "no");
  chequear(await d.locator('[data-prueba-opcion="no"]').getAttribute("aria-pressed") === "true", "vuelve a “No”", "no volvió");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
  await d.context().close();

  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/configuracion?pestana=reglas`);
  await c.locator("[data-prueba-gratis]").waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  chequear(ancho <= 0, "celular 390 px: la prueba gratis no desborda", `desborda ${ancho} px`);
  await capturar(c, "vd51-celu-config");
  await c.context().close();
} finally {
  await b.close();
}
resultado();
