#!/usr/bin/env node
// VEH-1 · "Avisar a todos": uno tras otro, cada toque abre su WhatsApp con el
// mensaje y lo deja avisado ✓ (en la bandeja y en Vencen hoy).
//   npm run e2e:veh-1            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const r = await pagina(b, COMPU);
  await entrar(r, "encargado@ejemplo.invalid");
  await r.goto(`${G}/panel/avisos`);
  await r.locator("main h1").waitFor({ timeout: 60000 });
  const boton = r.locator("[data-tanda]").first();
  if (await boton.count() === 0) {
    ok("ningún grupo con dos o más para avisar: no aparece “Avisar a todos” (nada que probar hoy)");
  } else {
    const n = Number((await boton.innerText()).match(/\((\d+)\)/)[1]);
    await boton.click();
    const caja = r.locator("[data-tanda-abierta]");
    await caja.getByText(`1 de ${n}`).waitFor({ timeout: 10000 });
    const nombre = (await caja.locator("p.font-semibold").innerText()).trim();
    const wa = await caja.locator('a:has-text("Abrir WhatsApp")').getAttribute("href");
    chequear(/^https:\/\/wa\.me\/\d+\?text=/.test(wa), `abre con “1 de ${n}” y el WhatsApp de ${nombre} con su mensaje`, wa);
    const [ventana] = await Promise.all([r.context().waitForEvent("page"), caja.locator('a:has-text("Abrir WhatsApp")').click()]);
    await ventana.close().catch(() => {});
    await caja.getByText(`2 de ${n}`).waitFor({ timeout: 10000 });
    ok("un toque: se abrió su WhatsApp y pasó al siguiente");
    await caja.getByRole("button", { name: "Saltear" }).click();
    if (n > 2) await caja.getByText(`3 de ${n}`).waitFor({ timeout: 10000 });
    await caja.getByRole("button", { name: "Terminar" }).click();
    const hecho = r.locator('[data-avisado="si"]', { hasText: nombre }).first();
    await hecho.waitFor({ timeout: 30000 });
    chequear(/Avisado por Martín/.test(await hecho.innerText()), `${nombre} quedó “✓ Avisado por Martín”`, await hecho.innerText());
  }
  await r.goto(`${G}/panel/vencen-hoy`);
  await r.locator("main h1").waitFor({ timeout: 60000 });
  ok(`Vencen hoy abre con la bandeja al lado (${await r.locator("[data-tanda]").count() ? "con" : "sin"} “Avisar a todos”)`);
  if (r.errores.length) falla(`encargado: ${r.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
