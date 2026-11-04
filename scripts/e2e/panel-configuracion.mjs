#!/usr/bin/env node
// AUD-1 · Configuración botón por botón, con sesión real.
// Cada muestra de color, cada interruptor, cada modo de clases y cada Guardar;
// valores imposibles y vacíos; cambios sin guardar; Caja apagada → Vender sin
// efectivo; encargado de solo lectura; celular sin desborde.
//   npm run e2e:configuracion            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  await p.goto(`${G}/panel/configuracion`);
  const bloque = (id) => p.locator(`section[data-bloque="${id}"]`);
  const guardarDe = (id) => bloque(id).locator('button:has-text("Guardar")');
  const mensajeDe = async (id) => (await bloque(id).locator(".mensaje").first().innerText({ timeout: 15000 })).replace(/\s+/g, " ").trim();
  // Cada respuesta (del navegador o de la base) suma uno en data-respuestas: se espera la nueva.
  const guardar = async (id) => {
    const antes = Number(await bloque(id).getAttribute("data-respuestas"));
    await guardarDe(id).click();
    await p.waitForFunction(([sel, n]) => Number(document.querySelector(sel)?.getAttribute("data-respuestas")) > n,
      [`section[data-bloque="${id}"]`, antes], { timeout: 30000 });
  };
  const switchDe = (id, texto) => bloque(id).locator("label", { hasText: texto }).locator('input[role="switch"]');
  await bloque("marca").waitFor({ timeout: 30000 });
  await capturar(p, "aud1-compu-configuracion", true);

  // Sin cambios, ningún Guardar está activo.
  let activos = 0;
  for (const id of ["marca", "cobro", "clases", "reglas", "transferencias", "secciones"]) if (await guardarDe(id).isEnabled()) activos++;
  chequear(activos === 0, "sin cambios, los 6 Guardar están apagados", `${activos} Guardar activos sin cambios`);

  // ── Reglas: fuera de rango, vacío y válido ──
  const tol = bloque("reglas").locator("input").nth(0);
  const tolOriginal = await tol.inputValue();
  await tol.fill("999"); await guardar("reglas");
  let m = await mensajeDe("reglas");
  chequear(/entre 0 y 60/.test(m), `tolerancia 999 → “${m}”`, `tolerancia 999 dio “${m}”`);
  await tol.fill(""); await guardar("reglas");
  m = await mensajeDe("reglas");
  chequear(/no puede quedar vacío/.test(m), `tolerancia vacía → “${m}”`, `tolerancia vacía dio “${m}”`);
  const desc = bloque("reglas").locator("input").nth(2);
  const descOriginal = await desc.inputValue();
  await tol.fill("4"); await desc.fill("150"); await guardar("reglas");
  m = await mensajeDe("reglas");
  chequear(/entre 0 y 100/.test(m), `descuento 150 → “${m}”`, `descuento 150 dio “${m}”`);
  await desc.fill(descOriginal); await guardar("reglas");
  chequear(/Guardado/.test(await mensajeDe("reglas")), "Reglas válidas → Guardado", "Reglas válidas no se guardaron");
  await p.reload(); await bloque("reglas").waitFor();
  chequear(await bloque("reglas").locator("input").nth(0).inputValue() === "4", "tolerancia 4 sigue después de recargar", "la tolerancia no quedó guardada");
  await bloque("reglas").locator("input").nth(0).fill(tolOriginal); await guardar("reglas");

  // ── Transferencias: alias y CBU raros ──
  const tr = bloque("transferencias").locator("input");
  const aliasOriginal = await tr.nth(0).inputValue();
  const cbuOriginal = await tr.nth(1).inputValue();
  await tr.nth(0).fill("alias con espacios"); await guardar("transferencias");
  m = await mensajeDe("transferencias");
  chequear(/6 a 20/.test(m), `alias con espacios → “${m}”`, `alias con espacios dio “${m}”`);
  await tr.nth(0).fill("gym.demo-ok"); await tr.nth(1).fill("123"); await guardar("transferencias");
  m = await mensajeDe("transferencias");
  chequear(/22 números.*tiene 3/.test(m), `CBU 123 → “${m}”`, `CBU 123 dio “${m}”`);
  await tr.nth(0).fill(aliasOriginal); await tr.nth(1).fill(cbuOriginal);
  chequear(!(await guardarDe("transferencias").isEnabled()), "volver a los valores guardados apaga Guardar", "Guardar sigue activo sin cambios reales");

  // ── Cambios sin guardar ──
  const nombre = bloque("marca").locator("input").first();
  const nombreOriginal = await nombre.inputValue();
  await nombre.fill(`${nombreOriginal} X`);
  chequear(await bloque("marca").locator("[data-sin-guardar]").isVisible(), "Marca avisa “Cambios sin guardar”", "Marca no avisa que hay cambios sin guardar");
  chequear(!(await guardarDe("reglas").isEnabled()), "el Guardar de otro bloque no se prende con el cambio de Marca", "Reglas se prendió por un cambio de Marca");
  const frena = await p.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  chequear(frena, "irse con cambios sin guardar pregunta antes", "irse con cambios sin guardar no avisa");
  await nombre.fill(nombreOriginal);
  chequear(!(await bloque("marca").locator("[data-sin-guardar]").isVisible()), "volver al nombre original saca el aviso", "el aviso sigue con el nombre original");

  // ── Colores: cada muestra se puede elegir; guardar cambia el panel ──
  const acentos = bloque("marca").locator('button[aria-label^="#"]');
  const nAcentos = await acentos.count();
  let elegidos = 0;
  for (let i = 0; i < nAcentos; i++) { await acentos.nth(i).click(); if ((await acentos.nth(i).getAttribute("aria-pressed")) === "true") elegidos++; }
  chequear(elegidos === nAcentos, `las ${nAcentos} muestras de color se eligen`, `${nAcentos - elegidos} muestras no se marcan`);
  await bloque("marca").locator('button[aria-label="#3b82f6"]').click();
  await guardar("marca");
  await p.reload(); await bloque("marca").waitFor();
  const acento = await p.evaluate(() => getComputedStyle(document.querySelector("[style*='--acento']") ?? document.body).getPropertyValue("--acento").trim().toLowerCase());
  chequear(acento === "#3b82f6", "guardar azul cambia el color del panel", `el panel quedó con ${acento}`);
  await bloque("marca").locator('button[aria-label="#2fbf5b"]').click(); await guardar("marca");

  // ── Qué cobrás: no se puede apagar todo ──
  for (const t of ["Membresía", "Pase diario", "Packs"]) await switchDe("cobro", t).uncheck();
  await guardar("cobro");
  m = await mensajeDe("cobro");
  chequear(/al menos una forma de cobrar/.test(m), `apagar todo el cobro → “${m}”`, `apagar todo el cobro dio “${m}”`);
  for (const t of ["Membresía", "Pase diario", "Packs"]) await switchDe("cobro", t).check();
  chequear(!(await guardarDe("cobro").isEnabled()), "volver a prender todo deja Qué cobrás sin cambios", "Qué cobrás quedó con cambios");

  // ── Clases: cada modo; sin clases desaparece del menú ──
  const modo = (t) => bloque("clases").locator("button", { hasText: t });
  await modo("Sin reserva").click();
  chequear(await bloque("clases").locator("input").count() === 0, "sin reserva no pide días ni horas", "sin reserva muestra campos de reserva");
  await modo("Con reserva").click();
  chequear(await bloque("clases").locator("input").count() === 2, "con reserva pide anticipación y cancelación", "con reserva no muestra sus dos campos");
  await modo("No damos clases").click(); await guardar("clases");
  await p.goto(`${G}/panel`);
  const menu = await p.locator("nav").first().innerText();
  chequear(!/Clases/.test(menu), "sin clases, el menú no muestra Clases", "el menú sigue mostrando Clases");
  await p.goto(`${G}/panel/configuracion`); await modo("Con reserva").click(); await guardar("clases");

  // ── Secciones: cada interruptor; Caja apagada → Vender sin efectivo ──
  const sw = bloque("secciones").locator('input[role="switch"]');
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
  await switchDe("secciones", "Caja").uncheck(); await guardar("secciones");
  await p.goto(`${G}/panel/vender`);
  await p.locator("text=¿Cómo paga?").waitFor({ timeout: 30000 });
  const hayEfectivo = await p.locator('button:has-text("Efectivo")').count();
  const pideCaja = await p.locator("text=/abrí la caja|Abrir caja/i").count();
  chequear(hayEfectivo === 0 && pideCaja === 0, "con Caja apagada, Vender no ofrece efectivo ni manda a abrir caja", `Vender con Caja apagada: efectivo=${hayEfectivo}, pide caja=${pideCaja}`);
  await capturar(p, "aud1-compu-vender-sin-caja");
  await p.goto(`${G}/panel/configuracion`);
  await switchDe("secciones", "Caja").check(); await guardar("secciones");
  await p.goto(`${G}/panel/vender`);
  await p.locator("text=¿Cómo paga?").waitFor({ timeout: 30000 });
  chequear(await p.locator('button:has-text("Efectivo")').count() > 0, "con Caja prendida vuelve el efectivo", "con Caja prendida no aparece el efectivo");
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
  await p.context().close();

  // ── Encargado: ve, no cambia ──
  const e = await pagina(b, COMPU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel/configuracion`);
  await e.locator("text=Solo el dueño cambia la configuración").waitFor({ timeout: 30000 });
  const botones = await e.locator('button:has-text("Guardar")').count();
  const deshabilitado = (await e.locator("fieldset[disabled]").count()) > 0
    && await e.locator('section[data-bloque="reglas"] input').first().isDisabled()
    && await e.locator('section[data-bloque="secciones"] input[role="switch"]').first().isDisabled();
  chequear(botones === 0 && deshabilitado, "encargado: ve la configuración sin Guardar y sin poder tocar", `encargado: ${botones} Guardar, fieldset deshabilitado=${deshabilitado}`);
  if (e.errores.length) falla(`encargado: ${e.errores.join(" | ")}`);
  await e.context().close();

  // ── Celular ──
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/configuracion`);
  await c.locator('section[data-bloque="secciones"]').waitFor({ timeout: 30000 });
  await c.locator('section[data-bloque="reglas"] input').first().fill("");
  await c.locator('section[data-bloque="reglas"] button:has-text("Guardar")').click();
  await c.waitForTimeout(400);
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular: sin desborde (${ancho}px)`, `celular: la página mide ${ancho}px`);
  await capturar(c, "aud1-celu-configuracion", true);
  if (c.errores.length) falla(`celular: ${c.errores.join(" | ")}`);
  await c.context().close();
  ok("Configuración recorrida botón por botón");
} catch (e) {
  falla(`se cortó: ${e.message.split("\n")[0]}`);
}
await b.close();
resultado();
