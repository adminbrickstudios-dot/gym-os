#!/usr/bin/env node
// VD-46T · Un descuento con un motivo de la lista del gimnasio se cobra (la base ahora también lo valida).
// Regresión de punta a punta: lo que elige la pantalla tiene que pasar la validación de la base.
//   node scripts/e2e/vd-46t.mjs     (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, esperarCobro, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Motivo${s5}`);
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Solo dar de alta")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}/, { timeout: 30000 });
  const id = new URL(d.url()).pathname.split("/").pop();
  ok(`socio con plan creado (${id.slice(0, 8)})`);

  await d.goto(`${G}/panel/vender?socio=${id}&cuota=1`);
  await d.getByText(/^Cuota /).first().waitFor({ timeout: 30000 });
  await d.locator('button:has-text("🏷️ Descuento")').first().click();
  await d.locator('input[aria-label="Monto del descuento"]').fill("100");
  await d.waitForFunction(() => document.querySelectorAll("select[data-motivo-descuento] option").length > 2, null, { timeout: 30000 });
  await d.locator("select[data-motivo-descuento]").selectOption({ index: 1 });
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await d.locator('button:has-text("✅ Cobrar")').click();
  await esperarCobro(d);
  ok("un descuento con motivo de la lista se cobra (la base lo acepta)");
  chequear(d.errores.length === 0, "sin errores de página", d.errores.join(" | "));
} finally {
  await b.close();
}
resultado();
