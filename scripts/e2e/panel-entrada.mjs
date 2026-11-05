#!/usr/bin/env node
// AUD-4 · Entrada, botón por botón: buscar (Enter elige, Esc limpia, "darlo
// de alta" si no está), anotar y deshacer, anular desde "Hoy" con motivo,
// cobrar y dejar pasar (con quién), una pausa en curso ("volvió antes"),
// el aviso del apto y el celular.
//   npm run e2e:entrada          (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const hoyMenos = (n) => new Date(Date.now() - n * 864e5).toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
async function primero(p, estado) {
  await p.goto(`${G}/panel/socios?estado=${estado}`);
  const a = p.locator('main ul a[href^="/panel/socios/"]').first();
  await a.waitFor({ timeout: 30000 });
  return { href: await a.getAttribute("href"), nombre: (await a.locator(".font-semibold").first().innerText()).replace(/#\d+/, "").trim() };
}
try {
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  const verde = await primero(r, "al_dia"), rojo = await primero(r, "vencidos");
  await r.goto(`${G}/panel/entrada`);
  const buscar = r.locator('input[aria-label="Buscar socio"]');
  await buscar.waitFor({ timeout: 30000 });
  chequear(await buscar.evaluate((e) => e === document.activeElement), "el buscador arranca con foco", "el buscador no tiene foco");
  await buscar.fill("zzqqxx");
  await r.getByText("Darlo de alta").waitFor({ timeout: 15000 });
  ok("si no lo encuentra, ofrece darlo de alta");
  await buscar.press("Escape");
  chequear(await buscar.inputValue() === "", "Esc limpia la búsqueda", "Esc no limpió");

  // ── Anotar y deshacer ──
  const hoyAntes = Number(await r.locator("[data-hoy]").getAttribute("data-hoy"));
  await buscar.fill(verde.nombre);
  await r.locator("button.fila", { hasText: verde.nombre }).first().waitFor({ timeout: 15000 });
  await buscar.press("Enter");
  await r.locator('section[aria-live] button:has-text("Anotar entrada")').click();
  const hecho = r.locator("[data-hecho]");
  await hecho.waitFor({ timeout: 30000 });
  chequear(new RegExp(`Entró ${verde.nombre}`).test(await hecho.innerText()), `Enter elige y anota: “Entró ${verde.nombre}”`, `dice: ${await hecho.innerText()}`);
  await hecho.locator('button:has-text("Deshacer")').click();
  await hecho.waitFor({ state: "detached", timeout: 30000 });
  await r.reload(); await r.locator("[data-hoy]").waitFor();
  chequear(Number(await r.locator("[data-hoy]").getAttribute("data-hoy")) === hoyAntes, "↩️ Deshacer la saca de “Hoy”", "Deshacer no la sacó");

  // ── Anular desde Hoy ──
  await buscar.fill(verde.nombre);
  await r.locator("button.fila", { hasText: verde.nombre }).first().click();
  await r.locator('section[aria-live] button:has-text("Anotar entrada")').click();
  await r.locator("[data-hecho]").waitFor({ timeout: 30000 });
  await r.reload(); await r.locator("[data-hoy]").waitFor();
  await r.locator(`button[aria-label="Anular la entrada de ${verde.nombre}"]`).first().click();
  await r.locator('input[aria-label="Por qué se anula la entrada"]').fill("Prueba: se anotó dos veces");
  await r.locator('[data-hoy] button:has-text("Anular")').click();
  await r.waitForFunction((n) => Number(document.querySelector("[data-hoy]")?.getAttribute("data-hoy")) === n, hoyAntes, { timeout: 30000 });
  ok("“⋯ Anular” en Hoy, con motivo, la saca");

  // ── Rojo: cobrar y dejar pasar ──
  await buscar.fill(rojo.nombre);
  await r.locator("button.fila", { hasText: rojo.nombre }).first().click();
  const ver = r.locator("section[aria-live]");
  await ver.waitFor({ timeout: 30000 });
  chequear(/\/panel\/vender\?socio=/.test(await ver.locator('a:has-text("Cobrar")').getAttribute("href")), `rojo (${rojo.nombre}): “Cobrar” lleva a Vender con el socio`, "Cobrar no lleva a Vender");
  await capturar(r, "aud4-compu-rojo");
  await ver.locator('button:has-text("Dejar pasar igual")').click();
  await r.locator('input[placeholder^="¿Por qué lo dejás pasar"]').fill("Prueba: paga mañana");
  await r.locator('button.boton-peligro:has-text("Dejar pasar")').click();
  await r.locator('[data-hecho="forzado"]').waitFor({ timeout: 30000 });
  await r.reload();
  const forzado = r.locator('[data-ingreso="forzado"]').first();
  await forzado.waitFor({ timeout: 30000 });
  chequear(/Lo dejaron pasar \(Ana\)/.test(await forzado.innerText()), "“Hoy” dice quién lo dejó pasar", `dice: ${await forzado.innerText()}`);
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);

  // ── Pausa en curso: volvió antes ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  const pausa = await primero(d, "al_dia");
  await d.goto(`${G}${pausa.href}`);
  const card = d.locator("[data-pausas]");
  await card.waitFor({ timeout: 30000 });
  if (!(await d.locator('[data-pausa="en_curso"]').count())) {
    await card.locator('button:has-text("Pausar la membresía")').click();
    await d.locator('input[aria-label="Desde"]').fill(hoyMenos(2));
    await d.locator('input[aria-label="Vuelve el"]').fill(hoyMenos(-5));
    await d.locator('[data-form-pausa] button[type="submit"]').click();
    await d.locator('[data-pausa="en_curso"]').waitFor({ timeout: 30000 });
  }
  await r.goto(`${G}/panel/entrada`);
  await buscar.fill(pausa.nombre);
  await r.locator("button.fila", { hasText: pausa.nombre }).first().click();
  await ver.waitFor({ timeout: 30000 });
  chequear(/Congelada/.test(await ver.innerText()) && await ver.locator('a:has-text("Cobrar")').count() === 0, "en pausa: no ofrece cobrar", `en pausa dice: ${(await ver.innerText()).slice(0, 80)}`);
  await ver.locator('button:has-text("Volvió antes")').click();
  await r.locator('section[aria-live] button:has-text("Anotar entrada")').waitFor({ timeout: 30000 });
  ok("“🏃 Volvió antes” termina la pausa y ya puede entrar");
  await r.locator('section[aria-live] button:has-text("Otro socio")').click();

  // ── Apto: si el gimnasio lo pide, avisa (no frena) ──
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 }); await d.waitForTimeout(800);
  const sw = d.locator('fieldset[data-pestana-activa] label', { hasText: "Pedir apto físico" }).locator("input");
  const guardar = async () => { const pie = d.locator('[data-pie="reglas"]'); const n = Number(await pie.getAttribute("data-respuestas"));
    await pie.locator('button:has-text("Guardar")').click(); await d.waitForFunction((n) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > n, n, { timeout: 30000 }); };
  if (!(await sw.isChecked())) { await sw.click(); await guardar(); }
  await buscar.fill(verde.nombre);
  await r.locator("button.fila", { hasText: verde.nombre }).first().click();
  await r.locator("[data-aviso-apto]").waitFor({ timeout: 30000 });
  chequear(await r.locator('section[aria-live] button:has-text("Anotar entrada")').count() === 1, "apto pedido y no presentado: avisa, y deja anotar", "el apto frena la entrada");
  await r.locator('section[aria-live] button:has-text("Otro socio")').click();
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 }); await d.waitForTimeout(800);
  await sw.click(); await guardar();
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
  await d.context().close();
  await r.context().close();

  // ── Celular ──
  const c = await pagina(b, CELU);
  await entrar(c, "recepcion@ejemplo.invalid");
  await c.goto(`${G}/panel/entrada`);
  await c.locator('input[aria-label="Buscar socio"]').fill(rojo.nombre);
  await c.locator("button.fila", { hasText: rojo.nombre }).first().click();
  await c.locator("section[aria-live]").waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular sin desborde con el veredicto (${ancho}px)`, `mide ${ancho}px`);
  await capturar(c, "aud4-celu-rojo");
  if (c.errores.length) falla(`celular: ${c.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
