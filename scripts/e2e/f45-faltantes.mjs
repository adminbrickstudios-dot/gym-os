#!/usr/bin/env node
// F5.1 · Lo de FALTANTES.md que existe en el código, abierto con sesión real en el gimnasio demo:
//   FA-7 avisar sin bloquear (Configuración), FA-8 texto de MercadoPago, FA-9 elegir varios en Socios, FA-10 tasa de cobro,
//   FA-16 interruptor de la foto del socio, FA-20 /estado, FA-21 diferencia por cajero, FA-14 Mi año y FA-18 transiciones (app del socio).
// No cambia ningún dato del demo (solo mira, y prende y apaga el modo "elegir varios" de la pantalla).
//   node scripts/e2e/f45-faltantes.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, PLATAFORMA, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const tiene = async (d, selector, t = 30000) => d.locator(selector).first().waitFor({ timeout: t }).then(() => true, () => false);

try {
  // FA-20: página pública de estado, sin sesión y sin datos de nadie, en el host de la plataforma y en el de un gimnasio.
  const pub = await pagina(b, COMPU);
  for (const [donde, base] of [["la plataforma", PLATAFORMA], ["un gimnasio", G]]) {
    await pub.goto(`${base}/estado`);
    const hay = await tiene(pub, "[data-estado]");
    chequear(hay, `/estado abre en ${donde}`, `/estado no abre en ${donde} (${pub.url()})`);
    if (hay) {
      chequear(await pub.locator('[data-estado="ok"]').count() === 1, `/estado en ${donde}: la base responde`, `/estado en ${donde} dice que la base falla`);
      const txt = await pub.locator("main").innerText();
      chequear(!/@|Demo Gym|ejemplo/i.test(txt), `/estado en ${donde} no muestra datos de nadie`, `/estado muestra algo de más: ${txt.slice(0, 160)}`);
    }
  }

  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");

  // FA-7, FA-16: Configuración → Reglas.
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 });
  chequear(await tiene(d, '[data-opcion="avisar-sin-bloquear"]'), "FA-7: Configuración tiene “avisar sin bloquear” los primeros días", "FA-7: falta la tarjeta en Configuración");
  chequear(await tiene(d, '[data-opcion="foto-socio"] [data-foto-socio]'), "FA-16: Configuración tiene el interruptor de la foto desde la app", "FA-16: falta el interruptor de la foto");
  chequear(await d.locator('[data-opcion="foto-socio"]').innerText().then((t) => /Dejar que el socio suba su foto/.test(t)), "FA-16: dice “Dejar que el socio suba su foto”", "FA-16: texto distinto");

  // FA-8: MercadoPago dice que la plata no pasa por Base.
  await d.goto(`${G}/panel/configuracion?pestana=cobros`);
  await d.locator('fieldset[data-pestana-activa="cobros"]').waitFor({ timeout: 60000 });
  const mp = await d.locator("[data-mp-plata-directa]").first().innerText().catch(() => "");
  chequear(/Nunca pasa por Base ni por BRIK/.test(mp), "FA-8: la tarjeta de MercadoPago dice que la plata va directo al gimnasio", `FA-8: dice “${mp}”`);

  // FA-9: Socios, elegir varios.
  await d.goto(`${G}/panel/socios`);
  await d.locator("[data-lista-socios]").waitFor({ timeout: 60000 });
  await d.locator("[data-elegir-varios]").click();
  chequear(await tiene(d, "[data-elegir-todos]", 10000), "FA-9: “Elegir varios” prende las casillas", "FA-9: no aparecieron las casillas");
  await d.locator("[data-elegir]").first().click().catch(() => {});
  chequear(await tiene(d, "[data-barra-seleccion]", 10000), "FA-9: con un socio elegido aparece la barra de acciones", "FA-9: no apareció la barra de acciones");
  chequear(await d.locator("[data-barra-seleccion] [data-accion]").count() >= 2, "FA-9: la barra ofrece acciones (WhatsApp, etiqueta, exportar)", "FA-9: la barra no tiene acciones");
  chequear(await d.locator("[data-columnas-menu]").count() >= 1, "FA-9: columnas a elección", "FA-9: falta el menú de columnas");

  // FA-10: tasa de cobro en Resultado.
  await d.goto(`${G}/panel/resultado`);
  chequear(await tiene(d, "[data-tasa-cobro]", 60000), "FA-10: Resultado muestra la tasa de cobro", "FA-10: falta la tasa de cobro en Resultado");

  // FA-21: diferencia por cajero (aparece si hubo cierres de turno en 90 días: se mira la pantalla y que no falle).
  await d.goto(`${G}/panel/caja/historial`);
  await d.locator("main h1").first().waitFor({ timeout: 60000 });
  const cajeros = await d.locator("[data-diferencia-cajeros]").count();
  ok(`FA-21: Turnos de caja abre${cajeros ? " con “Diferencia por cajero”" : " (el demo no tiene cierres: la sección no se dibuja)"}`);
  chequear(d.errores.length === 0, "dueño: sin errores de página ni 5xx", d.errores.join(" | "));

  // FA-14 y FA-18: app del socio, en el celular.
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  const nav = s.locator("nav[data-nav-socio]");
  await nav.waitFor({ timeout: 60000 });
  const vt = await nav.evaluate((el) => getComputedStyle(el).getPropertyValue("view-transition-name"));
  chequear(vt === "nav-socio", "FA-18: la barra de la app tiene su nombre de transición", `FA-18: view-transition-name = “${vt}”`);
  const reducido = await s.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  chequear(!reducido, "FA-18: con movimiento normal las transiciones se declaran", "FA-18: el navegador de prueba pide reducir movimiento");
  await s.goto(`${G}/app/resumen`);
  chequear(await tiene(s, "[data-mi-anio]", 60000), "FA-14: Mi año abre", "FA-14: Mi año no abrió");
  const ins = await s.locator("[data-insignia]").count();
  chequear(ins >= 3, `FA-14: muestra las insignias (${ins}) con su avance`, `FA-14: pocas insignias (${ins})`);
  chequear(await s.locator("[data-resumen-anio]").count() === 1, "FA-14: muestra el resumen del año", "FA-14: falta el resumen del año");
  chequear(s.errores.length === 0, "socio: sin errores de página ni 5xx", s.errores.join(" | "));
} catch (e) { console.error(e); process.exitCode = 1; }
finally { await b.close(); resultado(); }
