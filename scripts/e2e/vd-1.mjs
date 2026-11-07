#!/usr/bin/env node
// VD-1 · La ventana de Entrada flotante, en todas las pantallas: desde Socios se
// tipea un DNI de verde → Enter → Enter → entra y el foco vuelve adonde estaba;
// un campo de texto con foco no la abre; con la barra fija prendida en esta compu
// (desde Caja); en el celular con el botón; un "lector" (teclas rápidas + Enter)
// con un QR de socio entra por QR; Configuración → Entrada existe.
//   node scripts/e2e/vd-1.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan, hojaDeAlta, irAVender } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const dni = `39${s5}0`.slice(0, 8).padEnd(8, "7");   // 8 números, distinto en cada corrida

async function prenderQr(p) {
  await p.goto(`${G}/panel/configuracion?pestana=reglas`);
  await p.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 }); await p.waitForTimeout(800);
  const sw = p.locator("[data-accesos] label", { hasText: "QR del socio" }).locator("input");
  if (await sw.isChecked()) return;
  await sw.click();
  const pie = p.locator('[data-pie="reglas"]'); const n = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await p.waitForFunction((n) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > n, n, { timeout: 30000 });
}

try {
  // ── Una persona nueva, con su DNI, al día (alta y cobro como lo hace la dueña) ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Ventana${s5}`);
  await d.locator('input[name="dni"]').fill(dni);
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Dar de alta y cobrar")').click();
  // VD-5b: "Dar de alta y cobrar" abre la hoja Cobrar sobre el alta; después se sigue en Vender con el socio.
  await irAVender(d, await hojaDeAlta(d));
  await d.getByText(/^Cuota /).first().waitFor({ timeout: 30000 });
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await d.locator('button:has-text("✅ Cobrar")').click();
  await esperarCobro(d);
  ok(`una persona nueva al día con el DNI ${dni}`);

  // ── Configuración → Entrada ──
  await d.goto(`${G}/panel/configuracion?pestana=entrada`);
  await d.locator("[data-config-entrada]").waitFor({ timeout: 30000 });
  chequear(await d.locator("[data-entrada-en-esta-compu]").count() === 1, "Configuración → Entrada: por gimnasio y “en esta compu”", "falta la pestaña Entrada");

  // ── Desde Socios: DNI → Enter → Enter ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios`);
  const enlace = r.locator('main ul a[href^="/panel/socios/"]').first();
  await enlace.waitFor({ timeout: 30000 });
  const href = await enlace.getAttribute("href");
  await enlace.focus();
  await r.keyboard.type(dni);
  const campo = r.locator("[data-ventana-campo]");
  await campo.waitFor({ timeout: 10000 });
  chequear((await campo.inputValue()).replace(/\./g, "") === dni, "tipear el DNI abre la ventana con el número escrito", `el campo dice ${await campo.inputValue()}`);
  chequear((await campo.inputValue()).includes("."), "el DNI se ve con puntos", "sin puntos");
  await capturar(r, "vd1-compu-escribir");
  await r.keyboard.press("Enter");
  const ver = r.locator("[data-ventana-veredicto]");
  await ver.waitFor({ timeout: 30000 });
  chequear(await ver.getAttribute("data-ventana-veredicto") === "verde", "Enter: el veredicto es verde", `color ${await ver.getAttribute("data-ventana-veredicto")}`);
  await capturar(r, "vd1-compu-veredicto");
  await r.keyboard.press("Enter");
  await r.locator("[data-ventana-hecho]").waitFor({ timeout: 30000 });
  ok("Enter otra vez: la entrada queda anotada");
  await r.locator("[data-ventana-entrada]").waitFor({ state: "detached", timeout: 15000 });
  chequear(r.url().includes("/panel/socios") && !r.url().includes(href.split("/").pop()), "se cerró sola y sigue en Socios", `quedó en ${r.url()}`);
  const foco = await r.evaluate(() => document.activeElement?.getAttribute("href"));
  chequear(foco === href, "el foco volvió exactamente adonde estaba", `el foco quedó en ${foco}`);

  // Esc también vuelve.
  await enlace.focus();
  await r.keyboard.type("12");
  await campo.waitFor({ timeout: 10000 });
  await r.keyboard.press("Escape");
  await campo.waitFor({ state: "detached", timeout: 10000 });
  chequear(await r.evaluate(() => document.activeElement?.getAttribute("href")) === href, "Esc cierra y devuelve el foco", "Esc no devolvió el foco");

  // ── Un campo de texto con foco no abre la ventana ──
  const buscador = r.locator("main input:not([type=hidden])").first();
  if (await buscador.count()) {
    await buscador.focus();
    await r.keyboard.type("123");
    await r.waitForTimeout(500);
    chequear(await campo.count() === 0, "escribiendo en un campo no se abre la ventana", "se abrió con el foco en un campo");
    await buscador.fill("");
  } else falla("Socios no tiene un campo para probar el foco");

  // ── Botón redondo y F2 ──
  await r.locator("body").click({ position: { x: 5, y: 5 } });
  await r.locator("[data-boton-ventana]").click();
  await campo.waitFor({ timeout: 10000 });
  ok("el botón redondo abre la ventana");
  await r.keyboard.press("Escape");
  await campo.waitFor({ state: "detached", timeout: 10000 });
  await r.keyboard.press("F2");
  await campo.waitFor({ timeout: 10000 });
  ok("F2 abre la ventana");
  await r.keyboard.press("Escape");

  // ── Un número que no existe ──
  await r.keyboard.press("F2");
  await campo.waitFor({ timeout: 10000 });
  await campo.fill("99999991");
  await r.keyboard.press("Enter");
  await r.locator("[data-ventana-nadie]").waitFor({ timeout: 15000 });
  chequear((await r.locator("[data-ventana-nadie]").innerText()).includes("No hay nadie con el DNI 99.999.991"), "DNI inexistente: “No hay nadie con el DNI …” y darlo de alta", "texto de DNI inexistente");
  await r.keyboard.press("Escape");

  // ── Inicio: el botón grande abre la ventana ──
  await r.goto(`${G}/panel`);
  await r.locator("[data-boton-entrada]").click();
  await campo.waitFor({ timeout: 10000 });
  chequear(r.url().replace(/\/$/, "").endsWith("/panel"), "Inicio: el botón grande abre la ventana sin salir de Inicio", `fue a ${r.url()}`);
  await r.keyboard.press("Escape");

  // ── Barra fija, prendida solo en esta compu, desde Caja ──
  // La recepción no abre Configuración: la barra "en esta compu" la deja puesta quien configuró esa compu (queda en el navegador).
  await r.evaluate(() => localStorage.setItem("gymos.entrada.en-esta-compu", JSON.stringify({ barra_fija: true })));
  await r.goto(`${G}/panel/caja`);
  const barra = r.locator("aside[data-barra-entrada]");
  await barra.waitFor({ timeout: 30000 });
  ok("barra fija: aparece a la derecha en Caja");
  await r.locator("[data-barra-dni]").fill(dni);
  await r.locator("[data-barra-dni]").press("Enter");
  await ver.waitFor({ timeout: 30000 });
  chequear(await ver.getAttribute("data-ventana-veredicto") !== null, "con la barra, el veredicto aparece flotando encima", "no apareció el veredicto");
  await capturar(r, "vd1-compu-barra");
  await r.keyboard.press("Escape");
  await r.evaluate(() => localStorage.removeItem("gymos.entrada.en-esta-compu"));

  // ── Lector USB: teclas rápidas + Enter con el QR de un socio ──
  await prenderQr(d);
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  let codigo = null;
  for (let i = 0; i < 20 && !codigo; i++) {
    await s.goto(`${G}/app`);
    codigo = await s.locator("[data-mi-qr]").getAttribute("data-codigo", { timeout: 20000 }).catch(() => null);
  }
  if (codigo) {
    await r.goto(`${G}/panel/socios`);
    await r.locator('main ul a[href^="/panel/socios/"]').first().waitFor({ timeout: 30000 });
    await r.locator("body").click({ position: { x: 5, y: 5 } });
    await r.keyboard.type(codigo, { delay: 5 });
    await r.keyboard.press("Enter");
    const entro = await Promise.race([
      r.locator("[data-ventana-hecho]").waitFor({ timeout: 30000 }).then(() => "hecho"),
      r.locator("[data-ventana-veredicto]").waitFor({ timeout: 30000 }).then(() => "veredicto"),
    ]).catch(() => "nada");
    chequear(entro === "hecho" || entro === "veredicto", `un lector con un QR abre la ventana y lo lee (${entro})`, "el lector no abrió la ventana");
    await r.keyboard.press("Escape");
  } else falla("no se pudo leer el QR de la app del socio");

  // ── Celular ──
  const c = await pagina(b, CELU);
  await entrar(c, "recepcion@ejemplo.invalid");
  await c.goto(`${G}/panel/socios`);
  const boton = c.locator("[data-boton-ventana]");
  await boton.waitFor({ timeout: 30000 });
  await boton.click();
  await c.locator("[data-ventana-campo]").waitFor({ timeout: 10000 });
  await c.locator("[data-ventana-campo]").fill(dni);
  await c.keyboard.press("Enter");
  await c.locator("[data-ventana-veredicto]").waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  chequear(ancho[0] <= ancho[1], "celular: el botón abre la ventana y no hay desborde", `ancho ${ancho[0]} > ${ancho[1]}`);
  await capturar(c, "vd1-celu-veredicto");
  chequear(await c.locator("[data-ventana-anotar]").isVisible(), "celular: se ve el botón de anotar", "no se ve Anotar");

  if (r.errores.length) falla(`errores en la página: ${r.errores.join(" | ")}`);
} finally {
  await b.close();
}
resultado();
