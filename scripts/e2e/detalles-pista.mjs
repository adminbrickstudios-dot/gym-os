#!/usr/bin/env node
// Auditoría 18/11 · Tres detalles de pantalla (valen para clásico y Pista):
//  1) Celular: el botón redondo de la Entrada no tapa la última fila de la lista (Socios).
//  2) Entrada: el sonido es un interruptor (role=switch) que dice qué hace ("Sonido al anotar") y su estado.
//  3) Pista oscuro: las etiquetas de los formularios (Caja) tienen contraste de 7:1 o más sobre la tarjeta.
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const luz = (rgb) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
const razon = (a, b) => { const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const b = await navegador();
try {
  // 1 · Celular, Socios.
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${GIMNASIO()}/panel/socios`, { waitUntil: "load" });
  const filas = c.locator('main ul a[href^="/panel/socios/"]');
  await filas.first().waitFor({ timeout: 60000 });
  await c.locator("[data-boton-ventana]").waitFor({ timeout: 30000 });
  await c.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await c.waitForTimeout(300);
  const m = await c.evaluate(() => {
    const items = [...document.querySelectorAll('main ul a[href^="/panel/socios/"]')];
    const ultima = items[items.length - 1].getBoundingClientRect();
    const boton = document.querySelector("[data-boton-ventana]").getBoundingClientRect();
    const choca = !(ultima.right <= boton.left || ultima.left >= boton.right || ultima.bottom <= boton.top || ultima.top >= boton.bottom);
    const reserva = parseFloat(getComputedStyle(document.querySelector("main")).paddingBottom); const hace = innerHeight - boton.top;
    return { reserva, hace, choca, ultimaAbajo: Math.round(ultima.bottom), botonArriba: Math.round(boton.top), scrollable: document.documentElement.scrollHeight > innerHeight };
  });
  chequear(m.scrollable && !m.choca && m.reserva >= m.hace, `celular: al final de Socios la última fila (${m.ultimaAbajo}) queda sobre el botón de la Entrada (${m.botonArriba}); el espacio de abajo (${m.reserva}px) cubre el botón (${m.hace}px)`, `celular: el botón de la Entrada tapa la última fila (fila baja a ${m.ultimaAbajo}, botón desde ${m.botonArriba}; espacio de abajo ${m.reserva}px, el botón ocupa ${m.hace}px)`);
  await c.context().close();

  // 2 y 3 · Compu.
  const d = await pagina(b, COMPU);
  await entrar(d, "recepcion@ejemplo.invalid");
  await d.goto(`${GIMNASIO()}/panel/entrada`, { waitUntil: "load" });
  const sw = d.locator("[data-sonido]");
  await sw.waitFor({ timeout: 60000 });
  const info = await sw.evaluate((e) => ({ rol: e.getAttribute("role"), marcado: e.getAttribute("aria-checked"), texto: e.innerText.replace(/\s+/g, " ").trim(), pista: !!e.querySelector("[data-interruptor-pista]") }));
  chequear(info.rol === "switch" && (info.marcado === "true" || info.marcado === "false"), "el sonido es un interruptor (role=switch con su estado)", `no es un interruptor: rol=${info.rol} aria-checked=${info.marcado}`);
  chequear(/sonido al anotar/i.test(info.texto) && /(^|\s)(sí|no)$/i.test(info.texto) && info.pista, `dice qué hace y cómo está: “${info.texto}”`, `no dice qué hace o no tiene interruptor: “${info.texto}”`);
  const antes = await sw.getAttribute("aria-checked");
  await sw.click();
  await d.waitForFunction((a) => document.querySelector("[data-sonido]")?.getAttribute("aria-checked") !== a, antes);
  ok2("al tocarlo cambia de estado");
  await sw.click();

  // Contraste de las etiquetas en Pista oscuro (se prende la llave en la página: es CSS por atributo).
  await d.goto(`${GIMNASIO()}/panel/caja`, { waitUntil: "load" });
  await d.locator("h1").first().waitFor({ timeout: 60000 });
  // Solo se mide donde de verdad hay Pista oscuro (el servidor pone los tokens del tema; falsear el atributo en la página deja los del wrapper claro).
  const enPistaOscuro = await d.evaluate(() => document.documentElement.dataset.modo === "oscuro" && !document.cookie.includes("tema=claro"));
  if (!enPistaOscuro) { ok2("contraste de etiquetas: se mide en la corrida de Pista oscuro (esta no lo es)"); await d.context().close(); await b.close(); resultado(); process.exit(process.exitCode ?? 0); }
  const col = await d.evaluate(() => {
    const e = document.querySelector(".etiqueta, label .etiqueta") ?? document.querySelector("[data-tono] .etiqueta");
    if (!e) return null;
    const lienzo = document.createElement("canvas"); lienzo.width = lienzo.height = 1; const cx = lienzo.getContext("2d", { willReadFrequently: true });
    const num = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const t = e.closest(".tarjeta") ?? e.closest("[data-tono]");
    let f = t, bg = null;
    while (f && !bg) { const v = getComputedStyle(f).backgroundColor; if (!/rgba\(.*, 0\)|transparent/.test(v)) bg = v; f = f.parentElement; }
    return { texto: num(getComputedStyle(e).color), fondo: num(bg ?? "rgb(18,26,34)") };
  });
  if (!col) falla("no encontré ninguna etiqueta en Caja para medir");
  else {
    // Con Pista Semáforo manda el texto suave del diseño (#9AAAB8 sobre la tarjeta, 6,8:1): el pedido de Mateo para Semáforo es 4,5:1 o más. Sin la llave, Pista sigue pidiendo 7:1.
    const minimo = (await d.evaluate(() => document.documentElement.dataset.semaforo === "si")) ? 4.5 : 7;
    const r = razon(col.texto, col.fondo); chequear(r >= minimo, `Pista oscuro: las etiquetas de Caja tienen contraste ${r.toFixed(1)}:1`, `Pista oscuro: contraste ${r.toFixed(1)}:1 (hace falta ${minimo}:1); texto ${col.texto}, fondo ${col.fondo}`);
  }
  await d.context().close();
} catch (e) { falla(`se cortó: ${String(e.message).split("\n")[0]}`); }
finally { await b.close(); }
resultado();
function ok2(m) { chequear(true, m, m); }
