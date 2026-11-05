#!/usr/bin/env node
// CFG-8 · Historial de cambios de configuración: un cambio aparece en la
// pestaña Cambios con qué, de qué a qué, quién y cuándo; guardar algo que no
// cambia nada no suma filas; el encargado lo lee; BRIK lo ve en el super admin.
//   npm run e2e:cfg-8            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, PLATAFORMA, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  const abrir = async (pestana) => {
    await p.goto(`${G}/panel/configuracion?pestana=${pestana}`);
    await p.locator(`fieldset[data-pestana-activa="${pestana}"]`).waitFor({ state: "attached", timeout: 30000 });
  };
  const pie = (clave) => p.locator(`[data-pie="${clave}"]`);
  const guardar = async (clave) => {
    const antes = Number(await pie(clave).getAttribute("data-respuestas"));
    await pie(clave).locator('button:has-text("Guardar")').click();
    await p.waitForFunction(([sel, n]) => Number(document.querySelector(sel)?.getAttribute("data-respuestas")) > n, [`[data-pie="${clave}"]`, antes], { timeout: 30000 });
    return (await pie(clave).locator(".mensaje").first().innerText()).replace(/\s+/g, " ").trim();
  };
  const filas = async () => {
    await abrir("cambios");
    const lista = p.locator("[data-historial]");
    return (await lista.count()) ? Number(await lista.getAttribute("data-historial")) : 0;
  };

  // ── Un cambio real: Avisar que vence ──
  const antes = await filas();
  await abrir("reglas");
  const aviso = p.locator("fieldset label", { hasText: "Avisar que vence" }).locator("input");
  const original = await aviso.inputValue();
  const nuevo = original === "9" ? "8" : "9";
  await aviso.fill(nuevo);
  chequear(/Guardado/.test(await guardar("reglas")), `Avisar que vence ${original} → ${nuevo}: guardado`, "no se guardó el aviso");
  const despues = await filas();
  const primera = p.locator("[data-cambio]").first();
  const texto = (await primera.innerText()).replace(/\s+/g, " ");
  chequear(despues === Math.min(antes + 1, 100), `una fila más en Cambios (${antes} → ${despues})`, `Cambios pasó de ${antes} a ${despues}`);
  chequear(await primera.getAttribute("data-cambio") === "dias_aviso" && texto.includes(`Avisar que vence (días antes)`) && texto.includes(`${original} → ${nuevo}`),
    `dice qué y de qué a qué: “${texto}”`, `la fila dice “${texto}”`);
  chequear(/Sofía · \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(texto), "dice quién y cuándo (hora del gimnasio)", `quién/cuándo: “${texto}”`);
  await capturar(p, "cfg8-compu-cambios", true);

  // ── Guardar sin cambio real: el WhatsApp escrito de otra forma da el mismo número ──
  await abrir("gimnasio");
  const wa = p.locator("fieldset label", { hasText: "WhatsApp" }).locator("input");
  const waGuardado = await wa.inputValue();
  if (/^\+549\d{10}$/.test(waGuardado)) {
    const conEspacios = `+54 9 ${waGuardado.slice(4, 8)} ${waGuardado.slice(8)}`;
    await wa.fill(conEspacios);
    chequear(/Guardado/.test(await guardar("gimnasio")), `WhatsApp escrito “${conEspacios}” → guardado`, "no guardó el WhatsApp");
    chequear(await wa.inputValue() === waGuardado, "la base lo deja igual que antes", `el WhatsApp quedó ${await wa.inputValue()} (era ${waGuardado})`);
    const otraVez = await filas();
    chequear(otraVez === despues, "guardar algo que no cambia nada no suma filas", `sumó ${otraVez - despues} filas sin cambiar nada`);
  } else ok(`(el WhatsApp guardado es ${waGuardado || "vacío"}: se saltea el guardado sin cambios)`);

  // Se deja como estaba (y eso también queda en el historial).
  await abrir("reglas");
  await aviso.fill(original);
  await guardar("reglas");
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
  await p.context().close();

  // ── Encargado: lo lee ──
  const e = await pagina(b, COMPU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel/configuracion?pestana=cambios`);
  await e.locator("[data-historial]").waitFor({ timeout: 30000 });
  const deEncargado = (await e.locator("[data-cambio]").first().innerText()).replace(/\s+/g, " ");
  chequear(deEncargado.includes(`${nuevo} → ${original}`), "el encargado ve el historial (la vuelta al valor original arriba)", `el encargado ve “${deEncargado}”`);
  await e.context().close();

  // ── BRIK: los últimos cambios en el super admin ──
  const a = await pagina(b, COMPU);
  await entrar(a, "admin@ejemplo.invalid", undefined, PLATAFORMA);
  await a.locator("li", { has: a.locator('a[href="/g/demo"]') }).locator('a[href^="/admin/"]').click();
  await a.locator("[data-admin-cambios]").waitFor({ timeout: 30000 });
  const deAdmin = await a.locator("[data-admin-cambios] [data-cambio]").count();
  chequear(deAdmin > 0 && deAdmin <= 20, `el super admin muestra los últimos ${deAdmin} cambios`, `el super admin muestra ${deAdmin}`);
  await a.context().close();

  // ── Celular ──
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/configuracion?pestana=cambios`);
  await c.locator("[data-historial]").waitFor({ timeout: 30000 });
  const aLaVista = await c.waitForFunction(() => {
    const f = document.querySelector(".pestanas"), el = f?.querySelector('[aria-selected="true"]');
    return f && el && el.offsetLeft - f.offsetLeft >= f.scrollLeft && el.offsetLeft - f.offsetLeft + el.offsetWidth <= f.scrollLeft + f.clientWidth;
  }, null, { timeout: 15000 }).then(() => true, () => false);
  chequear(aLaVista, "celular: la pestaña Cambios queda a la vista en la fila deslizable", "celular: la pestaña activa queda fuera de la pantalla");
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular: Cambios sin desborde (${ancho}px)`, `celular: Cambios mide ${ancho}px`);
  await capturar(c, "cfg8-celu-cambios");
  await c.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
