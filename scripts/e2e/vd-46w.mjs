#!/usr/bin/env node
// VD-46W · La baja sigue andando con el cierre de pausas pendientes y la campana (avisos de MercadoPago) abre sin errores.
// (El rechazo de pausas y el cobro tardío de MercadoPago se prueban en la base: supabase/pruebas/vd-46w-baja-pausas-mp.test.mjs.)
//   node scripts/e2e/vd-46w.mjs     (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`BajaW${s5}`);
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Solo dar de alta")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}/, { timeout: 30000 });
  await d.locator('button:has-text("👋 Dar de baja")').click();
  await d.locator('button:has-text("Se mudó")').click();
  await d.locator("[data-constancia-baja]").waitFor({ timeout: 30000 });
  ok("la baja se da y deja su constancia");
  await d.goto(`${G}/panel/campana`);
  await d.waitForLoadState("networkidle");
  chequear(!(await d.getByText(/Application error|Algo salió mal/i).count()), "la campana abre con los avisos de MercadoPago", "la campana se rompió");
  chequear(d.errores.length === 0, "sin errores de página", d.errores.join(" | "));
} finally {
  await b.close();
}
resultado();
