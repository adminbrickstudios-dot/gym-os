#!/usr/bin/env node
// Configuración botón por botón, con sesión real (AUD-1, en pestañas desde CFG-1).
// Cada pestaña, cada muestra de color, cada interruptor, cada modo de clases y
// cada Guardar; valores imposibles y vacíos; cambios sin guardar; datos del
// gimnasio (teléfono como lo escribe la gente); la página y su link; Caja
// apagada → Vender sin efectivo; encargado de solo lectura; celular sin desborde.
//   npm run e2e:configuracion            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  await p.goto(`${G}/panel/configuracion`);
  const cont = p.locator("fieldset[data-pestana-activa]");
  const ir = async (clave) => { await p.locator(`button[data-pestana="${clave}"]`).click(); await p.locator(`fieldset[data-pestana-activa="${clave}"]`).waitFor({ state: "attached" }); };
  const pie = (clave) => p.locator(`[data-pie="${clave}"]`);
  const guardarDe = (clave) => pie(clave).locator('button:has-text("Guardar")');
  const mensajeDe = async (clave) => (await pie(clave).locator(".mensaje").first().innerText({ timeout: 15000 })).replace(/\s+/g, " ").trim();
  // Cada respuesta (del navegador o de la base) suma uno en data-respuestas: se espera la nueva.
  const guardar = async (clave) => {
    const antes = Number(await pie(clave).getAttribute("data-respuestas"));
    await guardarDe(clave).click();
    await p.waitForFunction(([sel, n]) => Number(document.querySelector(sel)?.getAttribute("data-respuestas")) > n,
      [`[data-pie="${clave}"]`, antes], { timeout: 30000 });
  };
  const switchDe = (texto) => cont.locator("label", { hasText: texto }).locator('input[role="switch"]');
  await cont.waitFor({ timeout: 30000 });
  await capturar(p, "cfg1-compu-gimnasio", true);

  // ── Pestañas: todas abren, y sin cambios ningún Guardar está activo ──
  const claves = ["gimnasio", "marca", "pagina", "cobros", "reglas", "horarios", "mensajes", "clases", "secciones", "direccion", "cambios"];
  let abren = 0, activos = 0;
  for (const k of claves) {
    await ir(k); abren++;
    if (await pie(k).count() && await guardarDe(k).isEnabled()) activos++;
  }
  chequear(abren === claves.length, `las ${claves.length} pestañas abren`, `abrieron ${abren} de ${claves.length}`);
  chequear(activos === 0, "sin cambios, ningún Guardar está activo", `${activos} Guardar activos sin cambios`);
  await p.goto(`${G}/panel/configuracion?pestana=cobros`);
  await p.locator('fieldset[data-pestana-activa="cobros"]').waitFor({ timeout: 30000 });
  ok("?pestana=cobros abre directo en Cobros (link compartible)");

  // ── Gimnasio: datos de contacto y sede ──
  await ir("gimnasio");
  const wa = cont.locator("label", { hasText: "WhatsApp" }).locator("input");
  const ig = cont.locator("label", { hasText: "Instagram" }).locator("input");
  const dir = cont.locator('[data-sede="0"] label', { hasText: "Dirección" }).locator("input");
  const [waOrig, igOrig, dirOrig] = [await wa.inputValue(), await ig.inputValue(), await dir.inputValue()];
  await wa.fill("123"); await guardar("gimnasio");
  let m = await mensajeDe("gimnasio");
  chequear(/WhatsApp: escribilo con característica/.test(m), `WhatsApp 123 → “${m}”`, `WhatsApp 123 dio “${m}”`);
  await wa.fill("11 1234-5678"); await ig.fill("https://instagram.com/gym.demo.ok/"); await dir.fill("Calle Ficticia 123, Ciudad");
  await guardar("gimnasio");
  chequear(/Guardado/.test(await mensajeDe("gimnasio")), "Gimnasio válido → Guardado", "Gimnasio válido no se guardó");
  chequear(await wa.inputValue() === "+5491112345678" && await ig.inputValue() === "gym.demo.ok",
    "el teléfono y el Instagram quedan como los guarda la base", `quedó WhatsApp=${await wa.inputValue()} Instagram=${await ig.inputValue()}`);
  await p.reload(); await p.locator('fieldset[data-pestana-activa="gimnasio"]').waitFor();
  chequear(await dir.inputValue() === "Calle Ficticia 123, Ciudad", "la dirección sigue después de recargar", "la dirección no quedó guardada");
  await wa.fill(waOrig); await ig.fill(igOrig); await dir.fill(dirOrig); await guardar("gimnasio");

  // ── Marca: cada muestra; guardar cambia el panel ──
  await ir("marca");
  // Las muestras incluyen fondos: se guarda el fondo de antes para dejarlo igual.
  const fondoOrig = await cont.locator('input[aria-label="Otro fondo"]').inputValue();
  const acentos = cont.locator('button[aria-label^="#"]');
  const n = await acentos.count();
  let elegidos = 0;
  for (let i = 0; i < n; i++) { await acentos.nth(i).click(); if ((await acentos.nth(i).getAttribute("aria-pressed")) === "true") elegidos++; }
  chequear(elegidos === n, `las ${n} muestras de color se eligen`, `${n - elegidos} muestras no se marcan`);
  await cont.locator('input[aria-label="Otro fondo"]').fill(fondoOrig);
  await cont.locator('button[aria-label="#3b82f6"]').click(); await guardar("marca");
  await p.reload(); await p.locator('fieldset[data-pestana-activa="marca"]').waitFor();
  const acento = await p.evaluate(() => getComputedStyle(document.querySelector("[style*='--acento']") ?? document.body).getPropertyValue("--acento").trim().toLowerCase());
  chequear(acento === "#3b82f6", "guardar azul cambia el color del panel", `el panel quedó con ${acento}`);
  await cont.locator('button[aria-label="#2fbf5b"]').click(); await guardar("marca");

  // ── Cambios sin guardar: aviso en la pestaña y al salir ──
  await ir("reglas");
  const tol = cont.locator("input").nth(0);
  const tolOrig = await tol.inputValue();
  await tol.fill("9");
  chequear(await aparece(pie("reglas").locator("[data-sin-guardar]")), "Reglas avisa “Cambios sin guardar”", "Reglas no avisa");
  await ir("cobros");
  chequear(await p.locator('button[data-pestana="reglas"] [aria-label="cambios sin guardar"]').count() === 1,
    "la pestaña Reglas queda marcada con • al irse a otra", "la pestaña Reglas no marca los cambios");
  const frena = await p.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  chequear(frena, "irse con cambios sin guardar pregunta antes", "irse con cambios sin guardar no avisa");
  await ir("reglas");
  chequear(await tol.inputValue() === "9", "volver a la pestaña mantiene lo escrito", "se perdió lo escrito al cambiar de pestaña");

  // ── Reglas: fuera de rango, vacío y válido ──
  await tol.fill("999"); await guardar("reglas");
  m = await mensajeDe("reglas");
  chequear(/entre 0 y 60/.test(m), `tolerancia 999 → “${m}”`, `tolerancia 999 dio “${m}”`);
  await tol.fill(""); await guardar("reglas");
  m = await mensajeDe("reglas");
  chequear(/no puede quedar vacío/.test(m), `tolerancia vacía → “${m}”`, `tolerancia vacía dio “${m}”`);
  const desc = cont.locator("input").nth(2);
  const descOrig = await desc.inputValue();
  await tol.fill("4"); await desc.fill("150"); await guardar("reglas");
  m = await mensajeDe("reglas");
  chequear(/entre 0 y 100/.test(m), `descuento 150 → “${m}”`, `descuento 150 dio “${m}”`);
  await desc.fill(descOrig); await guardar("reglas");
  chequear(/Guardado/.test(await mensajeDe("reglas")), "Reglas válidas → Guardado", "Reglas válidas no se guardaron");
  await p.reload(); await p.locator('fieldset[data-pestana-activa="reglas"]').waitFor();
  chequear(await cont.locator("input").nth(0).inputValue() === "4", "tolerancia 4 sigue después de recargar", "la tolerancia no quedó guardada");
  await cont.locator("input").nth(0).fill(tolOrig); await guardar("reglas");

  // ── Cobros: no se apaga todo; alias y CBU raros ──
  await ir("cobros");
  for (const t of ["Membresía", "Pase diario", "Packs"]) await switchDe(t).uncheck();
  await guardar("cobros");
  m = await mensajeDe("cobros");
  chequear(/al menos una forma de cobrar/.test(m), `apagar todo el cobro → “${m}”`, `apagar todo el cobro dio “${m}”`);
  for (const t of ["Membresía", "Pase diario", "Packs"]) await switchDe(t).check();
  const alias = cont.locator("label", { hasText: "Alias" }).locator("input");
  const cbu = cont.locator("label", { hasText: "CBU" }).locator("input");
  const [aliasOrig, cbuOrig] = [await alias.inputValue(), await cbu.inputValue()];
  await alias.fill("alias con espacios"); await guardar("cobros");
  m = await mensajeDe("cobros");
  chequear(/6 a 20/.test(m), `alias con espacios → “${m}”`, `alias con espacios dio “${m}”`);
  await alias.fill("gym.demo-ok"); await cbu.fill("123"); await guardar("cobros");
  m = await mensajeDe("cobros");
  chequear(/22 números.*tiene 3/.test(m), `CBU 123 → “${m}”`, `CBU 123 dio “${m}”`);
  await alias.fill(aliasOrig); await cbu.fill(cbuOrig);
  chequear(!(await guardarDe("cobros").isEnabled()), "volver a lo guardado apaga Guardar", "Guardar sigue activo sin cambios reales");

  // ── Clases: cada modo; apagadas desaparecen de la pestaña y del menú ──
  await ir("clases");
  await cont.locator("button", { hasText: "Sin reserva" }).click();
  chequear(await cont.locator("input").count() === 0, "sin reserva no pide días ni horas", "sin reserva muestra campos de reserva");
  await cont.locator("button", { hasText: "Con reserva" }).click();
  chequear(await cont.locator("input").count() === 2, "con reserva pide anticipación y cancelación", "con reserva no muestra sus dos campos");
  await ir("secciones");
  await switchDe("Clases").uncheck();
  chequear(await p.locator('button[data-pestana="clases"]').count() === 0, "apagar Clases saca su pestaña", "la pestaña Clases sigue");
  await guardar("secciones");
  await p.goto(`${G}/panel`);
  chequear(!/Clases/.test(await p.locator("nav").first().innerText()), "sin clases, el menú no muestra Clases", "el menú sigue mostrando Clases");
  await p.goto(`${G}/panel/configuracion?pestana=clases`);
  await p.locator('fieldset[data-pestana-activa="secciones"]').waitFor({ timeout: 30000 });
  ok("?pestana=clases con clases apagadas abre Secciones");
  await switchDe("Clases").check(); await guardar("secciones");
  chequear(await p.locator('button[data-pestana="clases"]').count() === 1, "prender Clases devuelve su pestaña", "no volvió la pestaña Clases");

  // ── Secciones: cada interruptor; Caja apagada → Vender sin efectivo ──
  const sw = cont.locator('input[role="switch"]');
  const nSw = await sw.count();
  let andan = 0;
  for (let i = 0; i < nSw; i++) {
    const antes = await sw.nth(i).isChecked();
    await sw.nth(i).click();
    if ((await sw.nth(i).isChecked()) !== antes) andan++;
    await sw.nth(i).click();
  }
  chequear(andan === nSw, `los ${nSw} interruptores de Secciones prenden y apagan`, `${nSw - andan} interruptores no responden`);
  chequear(!(await guardarDe("secciones").isEnabled()), "ida y vuelta en Secciones no deja cambios", "Secciones quedó con cambios tras ida y vuelta");
  await switchDe("Caja").uncheck(); await guardar("secciones");
  await p.goto(`${G}/panel/vender`);
  await p.locator("text=¿Cómo paga?").waitFor({ timeout: 30000 });
  const hayEfectivo = await p.locator('button:has-text("Efectivo")').count();
  const pideCaja = await p.locator("text=/abrí la caja|Abrir caja/i").count();
  chequear(hayEfectivo === 0 && pideCaja === 0, "con Caja apagada, Vender no ofrece efectivo ni manda a abrir caja", `Vender con Caja apagada: efectivo=${hayEfectivo}, pide caja=${pideCaja}`);
  await p.goto(`${G}/panel/configuracion?pestana=secciones`);
  await switchDe("Caja").check(); await guardar("secciones");
  await p.goto(`${G}/panel/vender`);
  await p.locator("text=¿Cómo paga?").waitFor({ timeout: 30000 });
  chequear(await p.locator('button:has-text("Efectivo")').count() > 0, "con Caja prendida vuelve el efectivo", "con Caja prendida no aparece el efectivo");

  // ── Página y Dirección ──
  await p.goto(`${G}/panel/configuracion?pestana=pagina`);
  const link = (await p.locator("[data-direccion-pagina]").innerText({ timeout: 30000 })).trim();
  chequear(link.startsWith(G), `la página está en ${link}`, `la dirección de la página es ${link} (esperaba ${G}/)`);
  const ver = await p.locator('a:has-text("Ver mi página")').getAttribute("href");
  const wsp = await p.locator('a:has-text("Mandar por WhatsApp")').getAttribute("href");
  chequear(ver === link && wsp?.startsWith("https://wa.me/?text=") && decodeURIComponent(wsp).includes(link),
    "“Ver mi página” y “Mandar por WhatsApp” llevan al link", `ver=${ver} whatsapp=${wsp}`);
  const vista = await p.context().newPage();
  const r = await vista.goto(link);
  chequear(r.status() < 400, "la página del gimnasio abre", `la página dio ${r.status()}`);
  await vista.close();
  await capturar(p, "cfg1-compu-pagina");
  await ir("direccion");
  chequear(/demo\.localhost/.test(await cont.innerText()), "Dirección lista la dirección del gimnasio", "Dirección no muestra demo.localhost");
  await p.locator('a.pestana:has-text("Equipo")').click();
  await p.waitForURL(/\/panel\/equipo/, { timeout: 30000 });
  ok("la pestaña Equipo lleva a Equipo");
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
  await p.context().close();

  // ── Encargado: ve, no cambia ──
  const e = await pagina(b, COMPU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel/configuracion`);
  await e.locator("text=Solo el dueño cambia la configuración").waitFor({ timeout: 30000 });
  let todoBien = true;
  for (const k of ["gimnasio", "cobros", "reglas", "secciones"]) {
    await e.locator(`button[data-pestana="${k}"]`).click();
    await e.locator(`fieldset[data-pestana-activa="${k}"]`).waitFor();
    const guardarVisible = await e.locator('button:has-text("Guardar")').count();
    const tocable = await e.locator("fieldset[data-pestana-activa] input").first().isEnabled();
    const bloqueado = await e.locator("fieldset[data-pestana-activa][disabled]").count();
    if (guardarVisible || !bloqueado || tocable) todoBien = false;
  }
  chequear(todoBien, "encargado: recorre las pestañas sin Guardar y sin poder tocar", "encargado: puede tocar o ve Guardar");
  if (e.errores.length) falla(`encargado: ${e.errores.join(" | ")}`);
  await e.context().close();

  // ── Celular ──
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/configuracion`);
  await c.locator("fieldset[data-pestana-activa]").waitFor({ timeout: 30000 });
  let anchoMax = 0;
  for (const k of claves) {
    await c.locator(`button[data-pestana="${k}"]`).click();
    await c.locator(`fieldset[data-pestana-activa="${k}"]`).waitFor({ state: "attached" });
    anchoMax = Math.max(anchoMax, await c.evaluate(() => document.documentElement.scrollWidth));
  }
  chequear(anchoMax <= CELU.width, `celular: ninguna pestaña desborda (${anchoMax}px)`, `celular: una pestaña mide ${anchoMax}px`);
  await c.locator('button[data-pestana="gimnasio"]').click();
  await capturar(c, "cfg1-celu-gimnasio", true);
  await c.locator('button[data-pestana="reglas"]').click();
  await c.locator("fieldset[data-pestana-activa] input").first().fill("");
  await c.locator('[data-pie="reglas"] button:has-text("Guardar")').click();
  await c.waitForTimeout(400);
  await capturar(c, "cfg1-celu-reglas-error", true);
  if (c.errores.length) falla(`celular: ${c.errores.join(" | ")}`);
  await c.context().close();
  ok("Configuración recorrida pestaña por pestaña");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
