#!/usr/bin/env node
// VD-14 · Vencen y cobrar con pestañas y totales: Vencen hoy / Vencidos / Por vencer / Prometieron pagar,
// cada una con su cuenta (igual a las filas que muestra), "$X a cobrar hoy · $Y vencido" arriba; la recepción
// ve cantidades y no la plata de la cuota; con día fijo la pantalla dice "día N de M". La regla del gimnasio
// vuelve a como estaba al final.
//   node scripts/e2e/vd-14.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const hoy = new Date();
const dHoy = hoy.getDate();
// Con día fijo: si hoy ya pasó el 28 (tope del día fijo) la pantalla dice que "ya pasó".
const X = Math.min(28, Math.max(dHoy, 10));

async function abrir(d, pestana) {
  await d.goto(`${G}/panel/vencen-hoy${pestana ? `?pestana=${pestana}` : ""}`);
  await d.locator("[data-pestanas]").waitFor({ timeout: 60000 });
}
async function irACobros(d) {
  await d.goto(`${G}/panel/configuracion?pestana=cobros`);
  await d.locator("[data-reglas-vencimiento]").waitFor({ timeout: 60000 });
}
let anterior = 1;
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");

  // ── 1 · Las cuatro pestañas, cada cuenta es la de sus filas, y los totales arriba ──
  await abrir(d);
  const claves = await d.locator("[data-pestanas] [data-pestana]").evaluateAll((l) => l.map((x) => x.getAttribute("data-pestana")));
  chequear(claves.join() === "hoy,vencidos,por_vencer,prometieron,cobrar", "las cinco pestañas: Vencen hoy, Vencidos, Por vencer, Prometieron pagar, Tengo que cobrar", `pestañas: ${claves.join()}`);
  const totales = await d.locator("[data-totales]").innerText();
  chequear(/\$[\d.,]+ a cobrar hoy/.test(totales) && /\$[\d.,]+ vencido/.test(totales), `arriba: “${totales.replace(/\s+/g, " ")}”`, `los totales dicen: ${totales}`);
  for (const c of ["hoy", "vencidos", "por_vencer"]) {
    await abrir(d, c === "hoy" ? null : c);
    const cuenta = Number((await d.locator(`[data-pestana="${c}"] [data-cuenta]`).innerText()).trim());
    const filas = await d.locator(`[data-lista-vencen="${c}"] > li`).count();
    chequear(cuenta === filas, `${c}: la cuenta de la pestaña (${cuenta}) es la de sus filas`, `${c}: la pestaña dice ${cuenta} y hay ${filas} filas`);
    if (c === "vencidos" && filas > 0) {
      const f = d.locator(`[data-lista-vencen="vencidos"] > li`).first();
      if (await f.locator('a:has-text("Cobrar"), button:has-text("Cobrar")').count()) {
        await f.locator('a:has-text("Cobrar"), button:has-text("Cobrar")').first().click();
        await d.locator("[data-cobrar-linea=cuota]").waitFor({ timeout: 30000 });
        ok("Cobrar en un vencido abre la hoja Cobrar con su cuota (VD-5)");
        await d.keyboard.press("Escape");
      }
    }
  }
  await abrir(d, "prometieron");
  chequear(await d.locator("[data-prometieron], main :text('Nadie prometió pagar')").count() > 0, "Prometieron pagar muestra a quienes dejaron pasar o invita a usarlo", "la pestaña está en blanco");
  await capturar(d, "vd14-compu-pestanas");

  // ── 2 · Con día fijo, el período de pago ──
  await irACobros(d);
  let sec = d.locator("[data-reglas-vencimiento]");
  anterior = await sec.locator('input[name="renovacion"]').evaluateAll((l) => l.findIndex((x) => x.checked));
  await sec.locator('input[name="renovacion"]').nth(2).check();
  await sec.locator("[data-dia-fijo] input[type=number]").first().fill(String(X));
  await sec.locator("button.boton-principal", { hasText: "Guardar" }).click();
  await sec.getByText("Guardado. Vale para los cobros nuevos").waitFor({ timeout: 30000 });
  await abrir(d);
  const modo = await d.locator("[data-modo-cobro]").innerText();
  chequear(modo === `Período de pago, día ${dHoy} de ${X}` || (dHoy > X && /ya pasó/.test(modo)), `con día fijo dice: “${modo}”`, `el modo dice: ${modo}`);

  // ── 3 · La recepción: cantidades, sin la plata de la cuota ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await abrir(r);
  const tr = await r.locator("[data-totales]").innerText();
  chequear(/vencen? hoy/.test(tr) && !/a cobrar hoy/.test(tr) && !/por vencer/i.test(tr), `la recepción ve cantidades: “${tr.replace(/\s+/g, " ")}”`, `la recepción ve: ${tr}`);

  // ── 4 · Celular ──
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await abrir(c);
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= 392, `celular: sin desborde (${ancho}px)`, `celular: desborda (${ancho}px)`);
  await capturar(c, "vd14-celu-pestanas");

  // ── Se devuelve la regla como estaba ──
  await irACobros(d);
  sec = d.locator("[data-reglas-vencimiento]");
  await sec.locator('input[name="renovacion"]').nth(Math.max(anterior, 0)).check();
  await sec.locator("button.boton-principal", { hasText: "Guardar" }).click();
  await sec.getByText("Guardado. Vale para los cobros nuevos").waitFor({ timeout: 30000 });
  ok("la regla del gimnasio vuelve a como estaba");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
