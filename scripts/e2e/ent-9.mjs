#!/usr/bin/env node
// ENT-9 · Cobrar desde la Entrada: un socio con plan y sin pagar no entra;
// "💵 Cobrar" abre Vender con su cuota ya en el carrito; se cobra por
// transferencia; "Volver a la entrada" abre su veredicto nuevo y entra.
//   npm run e2e:ent-9            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  // Uno nuevo, con plan y sin pagar.
  await r.goto(`${G}/panel/socios/nuevo`);
  await r.locator('input[name="nombre"]').fill(`Moroso${s5}`);
  await elegirPlan(r, 0);
  await r.locator('button:has-text("Solo dar de alta")').click();
  await r.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });

  await r.goto(`${G}/panel/entrada`);
  await r.locator('input[aria-label="Buscar socio"]').fill(`Moroso${s5}`);
  await r.locator("button.fila", { hasText: `Moroso${s5}` }).first().click();
  const ver = r.locator("[data-veredicto]");
  await ver.waitFor({ timeout: 30000 });
  chequear(await ver.getAttribute("data-veredicto") !== "verde", `sin pagar no entra (${(await ver.innerText()).split("\n").find((x) => /pag|cuota|plan/i.test(x)) ?? ""})`, "entra sin pagar");
  // VD-5b: "Cobrar" abre la hoja Cobrar sobre la Entrada (ya no navega a Vender); al cobrar vuelve con el veredicto nuevo.
  await ver.locator('a:has-text("Cobrar")').click();
  await r.locator('[data-cobrar] [data-cobrar-confirmar]').waitFor({ timeout: 30000 });
  chequear(await r.locator("[data-cobrar-linea=cuota]").count() === 1, "“Cobrar” abre la hoja con la cuota ya en el carrito", "la hoja no trae la cuota");
  chequear(new URL(r.url()).pathname === "/panel/entrada", "y sigue en la Entrada (no navegó a Vender)", `fue a ${r.url()}`);
  await r.locator('[data-cobrar-medio]', { hasText: "Transferencia" }).click();
  await capturar(r, "ent9-compu-cobrar");
  await r.locator('[data-cobrar-confirmar]').click();
  const ver2 = r.locator('[data-veredicto="verde"]');
  await ver2.waitFor({ timeout: 30000 });
  ok("al cobrar vuelve a la Entrada con su veredicto: ya en verde");
  // Tras cobrar, el foco vuelve a la Entrada un instante después del veredicto: un Enter apenas se ve el verde se pierde. El Enter se prueba en ent-1; acá se toca el botón.
  await r.getByRole("button", { name: /Anotar entrada/ }).click();
  await r.locator("[data-hecho]").waitFor({ timeout: 30000 });
  chequear(new RegExp(`Entró Moroso${s5}`).test(await r.locator("[data-hecho]").innerText()), "y entra con “Anotar entrada”", "no entró");
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
