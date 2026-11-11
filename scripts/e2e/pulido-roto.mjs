#!/usr/bin/env node
// H7 · Los [ROTO] de PULIDO.md que pegan hoy en el gimnasio, pantalla por pantalla y con sesión real:
//   1. Kiosco: el lector USB (la "G" de "GYMOS1." no se borra) y sin internet (dice "Sin conexión: pasá por recepción", no la pantalla de error).
//   2. Mi QR en la app del socio: sin señal no queda un QR vencido a la vista ("Sin señal: decí tu DNI en la recepción") y al volver la señal se renueva.
//   3. "Salir" del socio vuelve al ingreso del socio; con la sesión abierta, /ingresar y /socio no piden la contraseña otra vez.
//   4. "Tu celular o tu mail" abre un teclado con la arroba (type=text + inputMode=email).
//   5. Los avisos de la puerta no tapan el botón de la Entrada ni la barra fija; el botón no queda vacío.
//   6. En el veredicto, una letra suelta ("S") no marca la salida: va al buscador.
//   7. El tema que la persona guardó vale en un dispositivo nuevo (cookie vacía).
//   node scripts/e2e/pulido-roto.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const TABLET = { width: 820, height: 1180 };
const b = await navegador();

async function reglas(d) {
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 }); await d.waitForTimeout(800);
}
async function guardar(d) {
  const pie = d.locator('[data-pie="reglas"]'); const k = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await d.waitForFunction((k) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > k, k, { timeout: 30000 });
}
async function prender(d, texto) {
  await reglas(d);
  const sw = d.locator("[data-accesos] label", { hasText: texto }).locator("input");
  if (!(await sw.isChecked())) { await sw.click(); await guardar(d); }
}

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await prender(d, "Tablet en la puerta");
  await prender(d, "QR del socio");

  // ── 1. Kiosco ──
  await reglas(d);
  await d.locator('button:has-text("Autorizar una tablet")').click();
  const link = await d.locator("[data-link-tablet]").getAttribute("data-link-tablet", { timeout: 30000 });
  const t = await pagina(b, TABLET);
  await t.goto(link);
  await t.locator('[data-kiosco="listo"]').waitFor({ timeout: 60000 });
  const campo = t.locator('input[aria-label="Tu DNI"]');
  await campo.click();
  const lectura = "GYMOS1.0a1b2c3d4e5f.00112233445566778899aabb";
  await t.keyboard.type(lectura, { delay: 4 });   // un lector USB: una tecla cada pocos milisegundos
  chequear(await campo.inputValue() === lectura, "kiosco: el lector USB tipea GYMOS1.… tecla por tecla y la G no se borra", `el campo quedó en “${await campo.inputValue()}”`);
  await campo.fill("");
  await campo.fill("12345678");
  chequear(await campo.inputValue() === "12345678", "kiosco: un DNI sigue siendo solo números", `quedó “${await campo.inputValue()}”`);
  await campo.fill("12ab34");
  chequear(await campo.inputValue() === "1234", "kiosco: las letras sueltas de un DNI se descartan", `quedó “${await campo.inputValue()}”`);

  await campo.fill("12345678");
  await t.context().setOffline(true);
  await campo.press("Enter");
  const res = t.locator("[data-kiosco-resultado]");
  await res.waitFor({ timeout: 30000 });
  const textoOff = (await res.innerText()).replace(/\s+/g, " ");
  chequear(await res.getAttribute("data-kiosco-resultado") === "error" && /Sin conexión: pasá por recepción/.test(textoOff) && !/Application error/i.test(textoOff),
    "kiosco sin internet: dice “Sin conexión: pasá por recepción” (no la pantalla de error)", `dice: ${textoOff.slice(0, 120)}`);
  await t.context().setOffline(false);
  await t.locator('[data-kiosco="listo"]').waitFor({ timeout: 15000 });
  ok("kiosco: al rato vuelve solo al inicio");

  // ── 2. Mi QR sin señal ──
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  const qr = s.locator("[data-mi-qr]");
  await qr.waitFor({ timeout: 30000 });
  chequear(await qr.getAttribute("data-vencido") === "no", "Mi QR: recién abierto está vigente", "arrancó vencido");
  await s.context().setOffline(true);
  await s.waitForFunction(() => document.querySelector("[data-mi-qr]")?.getAttribute("data-vencido") === "si", null, { timeout: 60000 });
  const aviso = (await qr.innerText()).replace(/\s+/g, " ");
  chequear(/Sin señal: decí tu DNI en la recepción/.test(aviso), "Mi QR sin señal: el QR vencido no queda a la vista y dice “Sin señal: decí tu DNI en la recepción”", `dice: ${aviso}`);
  await s.context().setOffline(false);
  await s.waitForFunction(() => document.querySelector("[data-mi-qr]")?.getAttribute("data-vencido") === "no", null, { timeout: 30000 });
  ok("Mi QR: al volver la señal se renueva solo");

  // ── 3. Salir del socio y sesión recordada ──
  await s.goto(`${G}/ingresar?modo=socio`);
  await s.waitForURL((u) => u.pathname === "/app", { timeout: 30000 });
  ok("con la sesión abierta, /ingresar?modo=socio lleva a la app del socio");
  await s.goto(`${G}/socio`);
  await s.waitForURL((u) => u.pathname === "/app", { timeout: 30000 });
  ok("con la sesión abierta, /socio lleva a la app del socio");
  await s.goto(`${G}/app`);
  await s.locator('form[action="/salir"]:has(input[name=a][value=socio]) button').first().click();
  // H3b: el socio vuelve a la página de su gimnasio (no al login del equipo); sin gimnasio conocido, a su ingreso.
  await s.waitForURL((u) => (u.pathname === "/" || u.pathname.startsWith("/g/")) || (u.pathname === "/ingresar" && u.searchParams.get("modo") === "socio"), { timeout: 30000 });
  ok("“Salir” del socio vuelve a la página de su gimnasio (no al login del equipo)");

  // ── 4. El campo "celular o mail" ──
  const nuevo = await pagina(b, CELU);
  await nuevo.goto(`${G}/ingresar?modo=socio`);
  // D43 + H3b: la primera vista es mail y contraseña; el campo de mail es de texto con teclado de mail (se escribe la arroba).
  const mailCampo = nuevo.locator("input[name=email]").first();
  await mailCampo.waitFor({ timeout: 30000 });
  chequear(await mailCampo.getAttribute("type") === "email" || (await mailCampo.getAttribute("type") === "text" && await mailCampo.getAttribute("inputmode") === "email"),
    "el campo de mail: type=text con teclado de mail (se puede escribir la arroba)", `type=${await mailCampo.getAttribute("type")} inputmode=${await mailCampo.getAttribute("inputmode")}`);

  // ── 5 y 6. Avisos y botón de la Entrada, y la letra suelta en el veredicto ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios`);
  const boton = r.locator("[data-boton-ventana]");
  await boton.waitFor({ timeout: 60000 });
  chequear(await boton.locator("svg").count() === 1, "el botón de la Entrada no queda vacío (tiene su ícono)", "el botón no tiene ícono");
  await r.evaluate(() => window.dispatchEvent(new CustomEvent("gymos:aviso-local", { detail: { id: "h7-aviso", color: "rojo", texto: "Prueba de aviso", socioId: "x", nombre: "Prueba", numero: 1, cobrar: true, puede: false, textoSocio: "" } })));
  const avisos = r.locator("[data-avisos-entrada]");
  await avisos.waitFor({ timeout: 10000 });
  const ca = await avisos.boundingBox(), cb = await boton.boundingBox();
  const choca = ca.x < cb.x + cb.width && ca.x + ca.width > cb.x && ca.y < cb.y + cb.height && ca.y + ca.height > cb.y;
  chequear(!choca && ca.y < 200, "los avisos de la puerta salen arriba y no tapan el botón de la Entrada", `avisos en (${Math.round(ca.x)},${Math.round(ca.y)}) ${Math.round(ca.width)}x${Math.round(ca.height)}, botón en (${Math.round(cb.x)},${Math.round(cb.y)})`);
  const barra = r.locator("aside[data-barra-entrada]");   // (el <html> también lleva ese atributo)
  if (await barra.count() && await barra.isVisible()) {
    const bb = await barra.boundingBox();
    chequear(ca.x + ca.width <= bb.x + 1, "con la barra fija, los avisos quedan a su izquierda", `los avisos llegan a ${Math.round(ca.x + ca.width)} y la barra empieza en ${Math.round(bb.x)}`);
  } else ok("sin barra fija a este ancho: nada que tapar a la derecha");
  await avisos.locator('button[aria-label="Cerrar el aviso"]').click();

  await r.goto(`${G}/panel/entrada`);
  const buscar = r.locator('input[aria-label="Buscar socio"]');
  await buscar.fill("Testigo Al");
  const fila = r.locator("ul button.fila").first();
  await fila.waitFor({ timeout: 30000 });
  await fila.click();
  await r.locator("[data-veredicto]").waitFor({ timeout: 30000 });
  await r.keyboard.press("s");
  await r.waitForTimeout(1500);
  chequear(await r.locator("[data-ventana-salida]").count() === 0, "en el veredicto, la letra suelta “S” no marca la salida", "apareció la salida del socio");
  chequear((await buscar.inputValue()).toLowerCase().startsWith("s"), "la “S” va al buscador, como cualquier letra", `el buscador quedó en “${await buscar.inputValue()}”`);
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);

  // ── 7. El tema guardado vale en un dispositivo nuevo ──
  await d.goto(`${G}/panel/cuenta`);
  await d.locator("[data-tema-usuario]").waitFor({ timeout: 60000 });
  await d.locator("label", { hasText: "Oscuro" }).locator("input").click();
  await d.getByText("tu tema quedó guardado").waitFor({ timeout: 30000 });
  const otro = await pagina(b, COMPU);
  await entrar(otro, "duena@ejemplo.invalid");
  await otro.goto(`${G}/panel/caja`);
  let cookie = null;
  for (let i = 0; i < 30 && !cookie; i++) {
    cookie = (await otro.context().cookies(G)).find((c) => c.name === "tema" && c.value === "oscuro");
    if (!cookie) await otro.waitForTimeout(500);
  }
  chequear(!!cookie, "el tema guardado se aplica en un dispositivo nuevo (sin la cookie)", "la cookie del tema no apareció");
  await d.locator("label", { hasText: "Como el gimnasio" }).locator("input").click();
  await d.getByText("tu tema quedó guardado").waitFor({ timeout: 30000 });

  for (const [n, p] of [["dueña", d], ["tablet", t], ["socio", s], ["otro dispositivo", otro]]) if (p.errores.length) falla(`${n}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.stack : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
