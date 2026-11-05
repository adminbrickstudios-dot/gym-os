#!/usr/bin/env node
// CAJ-3 · PIN del equipo (D15): Martín (encargado) elige su PIN en Mi cuenta;
// en la compu de la recepción (sesión de Ana) pone su PIN y vende: la venta
// queda a nombre de Martín. Un PIN equivocado dice cuántos intentos quedan.
// "Salir" vuelve a la sesión sola.
//   npm run e2e:caj-3            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
// Cada corrida prueba un PIN equivocado: se borran los intentos de corridas anteriores (si no, a la sexta bloquea 10 minutos).
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect(); await db.query("delete from privado.intentos_pin"); await db.end();
try {
  const m = await pagina(b, COMPU);
  await entrar(m, "encargado@ejemplo.invalid");
  await m.goto(`${G}/panel/cuenta`);
  await m.locator('input[aria-label="PIN nuevo"]').fill("5823");
  await m.locator('[data-mi-pin] button:has-text("Guardar PIN")').click();
  await m.locator('[data-mi-pin] [role="status"]').waitFor({ timeout: 30000 });
  ok("Martín elige su PIN en Mi cuenta");
  await m.context().close();

  const pc = await pagina(b, COMPU);
  await entrar(pc, "recepcion@ejemplo.invalid");
  await pc.goto(`${G}/panel/vender`);
  await pc.locator('main a:has-text("¿Quién atiende?")').click();
  await pc.waitForURL(/\/panel\/pin/);
  await pc.locator('input[aria-label="PIN"]').fill("5824");
  await pc.locator('[data-teclado-pin] [role="alert"]').waitFor({ timeout: 30000 });
  chequear(/te quedan \d intentos?/.test(await pc.locator('[data-teclado-pin] [role="alert"]').innerText()), "un PIN equivocado dice cuántos intentos quedan", await pc.locator('[data-teclado-pin] [role="alert"]').innerText());
  await pc.locator('input[aria-label="PIN"]').fill("5823");
  await pc.waitForURL(/\/panel\/vender/, { timeout: 30000 });
  await pc.locator('[data-atiende="Martín"]').waitFor({ timeout: 30000 });
  ok("con su PIN vuelve a Vender: “👤 Atiende Martín”");
  await capturar(pc, "caj3-compu-atiende");

  await pc.goto(`${G}/panel/socios?q=${encodeURIComponent("Testigo Al Día")}`);
  const id = (await pc.locator('main ul a[href^="/panel/socios/"]').first().getAttribute("href")).split("/").pop();
  await pc.goto(`${G}/panel/vender?socio=${id}`);
  await pc.locator("main button", { hasText: "Barrita proteica" }).click();
  await pc.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await pc.locator('button:has-text("✅ Cobrar")').click();
  await esperarCobro(pc);
  await pc.goto(`${G}/panel/pin`);
  await pc.locator('[data-opera] button:has-text("Salir")').click();
  await pc.locator("[data-opera]").waitFor({ state: "detached", timeout: 30000 });
  await pc.locator("[data-teclado-pin]").waitFor({ timeout: 30000 });
  chequear(await pc.locator("[data-atiende]").count() === 0, "“Salir”: la compu vuelve a la sesión de Ana", "sigue atendiendo Martín");
  if (pc.errores.length) falla(`pc: ${pc.errores.join(" | ")}`);

  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios/${id}?pestana=pagos`);
  const v = d.locator("[data-ventas] li", { hasText: "Barrita proteica" }).first();
  await v.waitFor({ timeout: 30000 });
  chequear(/cobró Martín/.test(await v.innerText()), "la ficha dice “cobró Martín” (no Ana, que tenía la sesión)", await v.innerText());
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
