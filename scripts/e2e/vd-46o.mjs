#!/usr/bin/env node
// VD-46O · Reactivar ex socios: la lista “Se fueron” con filtro por motivo de baja y antigüedad, y el seguimiento
// de cuántos volvieron a pagar. La recepción también la ve. El celular no se desborda.
//   node scripts/e2e/vd-46o.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/retencion?lista=se_fue`);
  await d.locator("[data-ex-socios]").waitFor({ timeout: 30000 });
  ok("la lista Se fueron abre con sus filtros");
  chequear(await d.locator("[data-seguimiento-ex]").isVisible(), "muestra el seguimiento de cuántos volvieron a pagar", "falta el seguimiento");
  chequear((await d.locator("[data-filtro-antiguedad] a").count()) === 4, "hay filtro por antigüedad", "falta el filtro por antigüedad");

  // Filtrar por antigüedad deja la selección marcada en la dirección.
  await d.locator('[data-filtro-antiguedad] a:has-text("Más de un año")').click();
  await d.waitForURL(/antig=mas_12/, { timeout: 30000 });
  await d.locator('[data-filtro-antiguedad] a[aria-current="page"]:has-text("Más de un año")').waitFor({ timeout: 30000 });
  ok("filtrar por antigüedad queda en la dirección y marcado");

  // Filtrar por motivo (si hay alguno): se conserva la antigüedad.
  const motivos = d.locator("[data-filtro-motivo] a").filter({ hasNotText: "Todos los motivos" });
  if ((await motivos.count()) > 0) {
    await motivos.first().click();
    await d.waitForURL(/motivo=/, { timeout: 30000 });
    chequear(/antig=mas_12/.test(d.url()), "filtrar por motivo conserva la antigüedad", `se perdió la antigüedad: ${d.url()}`);
  } else {
    ok("sin ex socios de más de un año en el gimnasio demo: no hay motivos para filtrar");
  }
  await d.locator("[data-ex-socios]").waitFor({ timeout: 30000 });

  // La recepción también la ve (sin plata).
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/retencion?lista=se_fue`);
  await r.locator("[data-ex-socios]").waitFor({ timeout: 30000 });
  ok("la recepción también ve Se fueron");

  // Celular.
  const m = await pagina(b, CELU);
  await entrar(m, "duena@ejemplo.invalid");
  await m.goto(`${G}/panel/retencion?lista=se_fue`);
  await m.locator("[data-ex-socios]").waitFor({ timeout: 30000 });
  const ancho = await m.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= 391, "celular 390 px sin desborde", `desborda: ${ancho}px`);
  await capturar(m, "vd46o-celu-se-fueron");
  for (const p of [d, r, m]) chequear(p.errores.length === 0, "sin errores de página", p.errores.join(" | "));
} finally {
  await b.close();
}
resultado();
