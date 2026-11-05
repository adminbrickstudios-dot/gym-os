#!/usr/bin/env node
// ENT-9 · Cobrar desde la Entrada: un socio con plan y sin pagar no entra;
// "💵 Cobrar" abre Vender con su cuota ya en el carrito; se cobra por
// transferencia; "Volver a la entrada" abre su veredicto nuevo y entra.
//   npm run e2e:ent-9            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  // Uno nuevo, con plan y sin pagar.
  await r.goto(`${G}/panel/socios/nuevo`);
  await r.locator('input[name="nombre"]').fill(`Moroso${s5}`);
  await r.locator('select[aria-label="Plan"]').selectOption({ index: 1 });
  await r.locator('button:has-text("Solo dar de alta")').click();
  await r.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });

  await r.goto(`${G}/panel/entrada`);
  await r.locator('input[aria-label="Buscar socio"]').fill(`Moroso${s5}`);
  await r.locator("button.fila", { hasText: `Moroso${s5}` }).first().click();
  const ver = r.locator("[data-veredicto]");
  await ver.waitFor({ timeout: 30000 });
  chequear(await ver.getAttribute("data-veredicto") !== "verde", `sin pagar no entra (${(await ver.innerText()).split("\n").find((x) => /pag|cuota|plan/i.test(x)) ?? ""})`, "entra sin pagar");
  await ver.locator('a:has-text("Cobrar")').click();
  await r.waitForURL(/\/panel\/vender\?socio=.*cuota=1.*desde=entrada/, { timeout: 30000 });
  await r.getByText(/^Cuota /).first().waitFor({ timeout: 30000 });
  ok("“Cobrar” abre Vender con la cuota ya en el carrito");
  await r.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await r.locator('button:has-text("✅ Cobrar")').click();
  const listo = await Promise.race([
    r.locator('main a:has-text("Volver a la entrada")').waitFor({ timeout: 30000 }).then(() => null),
    r.locator('aside [role="alert"]').waitFor({ timeout: 30000 }).then(async () => await r.locator('aside [role="alert"]').innerText()),
  ]);
  if (listo) throw new Error(`al cobrar: ${listo}`);
  await capturar(r, "ent9-compu-cobrado");
  await r.locator('main a:has-text("Volver a la entrada")').click();
  await r.waitForURL(/\/panel\/entrada\?socio=/, { timeout: 30000 });
  const ver2 = r.locator('[data-veredicto="verde"]');
  await ver2.waitFor({ timeout: 30000 });
  ok("“Volver a la entrada” abre su veredicto: ya en verde");
  await r.keyboard.press("Enter");
  await r.locator("[data-hecho]").waitFor({ timeout: 30000 });
  chequear(new RegExp(`Entró Moroso${s5}`).test(await r.locator("[data-hecho]").innerText()), "y entra con Enter", "no entró");
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
