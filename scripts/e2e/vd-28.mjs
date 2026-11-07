#!/usr/bin/env node
// VD-28 · Navegación con memoria y Volver al origen.
//  1) Socios filtrado (Vencidos) y con scroll → ficha → "← Volver a Socios" vuelve con el filtro y el scroll.
//  2) Socios filtrado → ficha → Cobrar → al terminar vuelve a Socios con el filtro, el scroll y el aviso.
//  3) Vencen hoy → ficha → Volver vuelve a la misma pestaña; una ficha abierta directo ofrece "← Socios" de siempre.
//  4) Celular 390 px: ficha desde Socios con "Volver a Socios", sin desbordes.
//   node scripts/e2e/vd-28.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const BAJA = { width: 1440, height: 520 };   // una ventana baja: hasta una lista corta tiene scroll

/** Un link a una ficha que se vea en pantalla ahora (el último visible: lejos del tope si la lista está scrolleada). */
async function ultimaFichaVisible(p) {
  const hrefs = await p.evaluate(() => [...document.querySelectorAll("[data-lista] a[href^='/panel/socios/']")]
    .filter((a) => { const r = a.getBoundingClientRect(); return r.top > 120 && r.bottom < window.innerHeight - 20; })
    .map((a) => a.getAttribute("href")));
  return hrefs.at(-1) ?? null;
}

try {
  const d = await pagina(b, BAJA);
  await entrar(d, "duena@ejemplo.invalid");

  // Un moroso nuevo: queda entre los Vencidos y se puede cobrar.
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Origen${s5}`);
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Solo dar de alta")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
  const idMoroso = new URL(d.url()).pathname.split("/").pop();

  // ── 1 · Filtro + scroll → ficha → Volver ──
  await d.goto(`${G}/panel/socios?estado=vencidos`);
  await d.locator("[data-lista] a[href^='/panel/socios/']").first().waitFor({ timeout: 30000 });
  const alto = await d.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const y0 = Math.min(300, Math.max(0, alto - 40));
  await d.evaluate((y) => window.scrollTo(0, y), y0);
  await d.waitForTimeout(500);
  const y = await d.evaluate(() => Math.round(window.scrollY));
  chequear(y > 0, `la lista de Socios quedó scrolleada (${y} px)`, "no hubo scroll en la lista (¿pocos vencidos en el demo?)");
  const href = await ultimaFichaVisible(d);
  await d.locator(`[data-lista] a[href="${href}"]`).first().click();
  await d.waitForURL(`**${href}`, { timeout: 30000 });
  const volver = d.locator("[data-volver-origen]");
  await volver.waitFor({ timeout: 30000 });
  await d.waitForFunction(() => document.querySelector("[data-volver-origen]")?.getAttribute("data-volver-origen") === "/panel/socios", null, { timeout: 10000 }).catch(() => {});
  chequear(/Volver a Socios/.test(await volver.innerText()), "la ficha ofrece “← Volver a Socios”", `dice “${await volver.innerText()}”`);
  chequear((await volver.getAttribute("href")).includes("estado=vencidos"), "el Volver lleva a Socios con el filtro Vencidos", `lleva a ${await volver.getAttribute("href")}`);
  await capturar(d, "vd28-compu-ficha");
  await volver.click();
  await d.waitForURL(/\/panel\/socios\?.*estado=vencidos/, { timeout: 30000 });
  await d.locator('[data-filtro-estados] [data-estado="vencidos"][aria-current="page"]').waitFor({ timeout: 30000 });
  await d.waitForFunction((esperado) => Math.abs(window.scrollY - esperado) < 120, y, { timeout: 15000 })
    .then(() => ok(`Volver deja la lista donde estaba (scroll ${y} px, filtro Vencidos)`), async () => falla(`el scroll no volvió: estaba en ${y} y quedó en ${await d.evaluate(() => Math.round(window.scrollY))}`));
  await capturar(d, "vd28-compu-volvio");

  // ── 2 · Cobrar desde la ficha vuelve al origen ──
  await d.goto(`${G}/panel/socios?estado=vencidos`);
  await d.locator("[data-lista] a[href^='/panel/socios/']").first().waitFor({ timeout: 30000 });
  const linkMoroso = d.locator(`[data-lista] a[href="/panel/socios/${idMoroso}"]`);
  if (await linkMoroso.count()) await linkMoroso.first().click();
  else await d.locator("[data-lista] a[href^='/panel/socios/']").first().click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
  await d.locator('main a:has-text("Cobrar"), main button:has-text("Cobrar")').first().click();
  await d.locator("[data-cobrar-confirmar]").waitFor({ timeout: 30000 });
  await d.locator('[data-cobrar-medio="transferencia"]').click();
  await d.locator("[data-cobrar-comprobante] input[type=file]").setInputFiles({ name: "comprobante.png", mimeType: "image/png", buffer: PNG });
  await d.locator("[data-cobrar-archivo]").waitFor({ timeout: 10000 });
  await d.locator("[data-cobrar-confirmar]").click();
  const hecho = d.locator("[data-cobrar-hecho]");
  const error = d.locator('[data-cobrar] [role="alert"]');
  await Promise.race([hecho.waitFor({ timeout: 30000 }), error.waitFor({ timeout: 30000 }).then(async () => { throw new Error(`al cobrar: ${await error.innerText()}`); })]);
  await d.locator("[data-cobrar-volver]").click();
  await d.waitForURL(/\/panel\/socios\?.*estado=vencidos/, { timeout: 30000 });
  ok("Cobrar desde la ficha, al terminar, vuelve a Socios con el filtro Vencidos");
  await d.locator("[data-aviso-origen]").waitFor({ timeout: 15000 });
  chequear(/Cobro registrado/.test(await d.locator("[data-aviso-origen]").innerText()), "avisa lo que pasó (“Cobro registrado …”)", "sin aviso de cobro");
  await capturar(d, "vd28-compu-cobrado");

  // ── 3 · Vencen hoy → ficha → Volver; la ficha directa ofrece el link de siempre ──
  await d.goto(`${G}/panel/vencen-hoy?pestana=vencidos`);
  const fichaVencen = d.locator('main a[href^="/panel/socios/"]').first();
  await fichaVencen.waitFor({ timeout: 30000 });
  const hrefV = await fichaVencen.getAttribute("href");
  await fichaVencen.click();
  await d.waitForURL(`**${hrefV}`, { timeout: 30000 });
  await d.waitForFunction(() => document.querySelector("[data-volver-origen]")?.getAttribute("data-volver-origen") === "/panel/vencen-hoy", null, { timeout: 10000 })
    .then(() => ok("la ficha abierta desde Vencen hoy ofrece “← Volver a Vencen hoy”"), () => falla("la ficha desde Vencen hoy no ofrece volver a Vencen hoy"));
  await d.locator("[data-volver-origen]").click();
  await d.waitForURL(/\/panel\/vencen-hoy\?.*pestana=vencidos/, { timeout: 30000 });
  ok("Volver regresa a Vencen hoy, en la misma pestaña");
  await d.goto(`${G}/panel/socios/${idMoroso}`);
  await d.locator("[data-volver-origen]").waitFor({ timeout: 30000 });
  const directo = await d.locator("[data-volver-origen]").innerText();
  chequear(/← Socios/.test(directo) && !/Volver a/.test(directo), "una ficha abierta directo ofrece “← Socios” de siempre", `dice “${directo}”`);
  if (d.errores.length) falla(`compu: ${d.errores.join(" | ")}`);
  await d.context().close();

  // ── 4 · Celular 390 px ──
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/socios`);
  const fichaCelu = c.locator("[data-lista] a[href^='/panel/socios/']").first();
  await fichaCelu.waitFor({ timeout: 30000 });
  const hrefC = await fichaCelu.getAttribute("href");
  await fichaCelu.click();
  await c.waitForURL(`**${hrefC}`, { timeout: 30000 });
  await c.waitForFunction(() => document.querySelector("[data-volver-origen]")?.getAttribute("data-volver-origen") === "/panel/socios", null, { timeout: 10000 }).catch(() => {});
  chequear(/Volver a Socios/.test(await c.locator("[data-volver-origen]").innerText()), "celular: la ficha ofrece “← Volver a Socios”", "celular: sin Volver a Socios");
  chequear(await c.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "celular: sin desborde horizontal", "celular: la ficha desborda");
  await capturar(c, "vd28-celu-ficha");
  await c.locator("[data-volver-origen]").click();
  await c.waitForURL(/\/panel\/socios(\?.*)?$/, { timeout: 30000 });
  ok("celular: Volver regresa a Socios");
  if (c.errores.length) falla(`celular: ${c.errores.join(" | ")}`);
  await c.context().close();
} catch (e) {
  falla(`el recorrido se cortó: ${e.message.split("\n")[0]}`);
} finally {
  await b.close();
}
resultado();
