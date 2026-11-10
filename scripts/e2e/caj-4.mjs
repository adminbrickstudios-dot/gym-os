#!/usr/bin/env node
// CAJ-4 · Alertas de caja: la recepción saca plata con la foto del ticket y
// cierra con faltante; la dueña ve en Inicio "🔔 Caja" el retiro (con "🧾 Ver
// ticket", que abre la foto) y la diferencia. La recepción no ve alertas.
//   npm run e2e:caj-4            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/caja`);
  await r.locator("main h1").waitFor();
  if (await r.locator('button:has-text("Cerrar caja")').count()) {
    await r.locator('button:has-text("Cerrar caja")').first().click();
    await r.locator('input[placeholder="$ contado"]').fill("0");
    await r.locator('button:has-text("Cerrar con este monto")').click();
    await r.locator('button:has-text("Listo")').click();
  }
  await r.locator('input[placeholder="$ 0"]').first().fill("1.000");
  await r.locator('button:has-text("Abrir caja")').first().click();
  await r.locator('button:has-text("Sale plata")').click();
  await r.locator('input[placeholder="$"]').fill("400");
  await r.locator('input[placeholder^="Motivo"]').fill(`Ferretería ${s5}`);
  const jpg = Buffer.from(await r.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 300; c.height = 400;
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, 300, 400); x.fillStyle = "#000"; x.font = "20px sans-serif"; x.fillText("TICKET $400", 60, 200);
    return c.toDataURL("image/jpeg", 0.8).split(",")[1];
  }), "base64");
  await r.setInputFiles('input[aria-label="Foto del ticket"]', { name: "ticket.jpg", mimeType: "image/jpeg", buffer: jpg });
  await r.locator('button:has-text("Anotar")').click();
  await r.locator('button:has-text("Cerrar caja")').waitFor({ timeout: 30000 });
  await r.locator('button:has-text("Cerrar caja")').click();
  await r.locator('input[placeholder="$ contado"]').fill("550");
  await r.locator('button:has-text("Cerrar con este monto")').click();
  await r.getByText("Faltan $50").waitFor({ timeout: 30000 });
  await r.locator('button:has-text("Listo")').click();
  await r.goto(`${G}/panel`);
  await r.locator("main h1").waitFor();
  chequear(await r.locator("[data-alertas-caja]").count() === 0, "la recepción no ve alertas de caja", "la recepción ve alertas");

  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  const retiro = d.locator('[data-alerta="retiro"]', { hasText: `Ferretería ${s5}` });
  await retiro.waitFor({ timeout: 30000 });
  chequear(/Salieron \$400 del cajón/.test(await retiro.innerText()) && /Ana/.test(await retiro.innerText()), "Inicio → Caja: “Salieron $400 del cajón · Ana · “Ferretería …””", await retiro.innerText());
  const [popup] = await Promise.all([d.waitForEvent("popup"), retiro.locator('button:has-text("Ver ticket")').click()]);
  await popup.waitForURL(/tickets_caja\/.+ticket-[0-9a-f]{32}\.jpg/, { timeout: 30000 });
  ok("🧾 Ver ticket abre la foto (link firmado, bucket privado)");
  await popup.close();
  chequear(await d.locator('[data-alerta="diferencia"]', { hasText: "$50 de menos" }).count() > 0, "y “… cerró con $50 de menos”", "no está la diferencia");
  await capturar(d, "caj4-compu-inicio");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
