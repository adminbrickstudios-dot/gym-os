#!/usr/bin/env node
// CAJ-1 · Historial de turnos: la recepción abre, saca plata con motivo y
// cierra con faltante; la dueña ve el turno en "🗂️ Turnos anteriores" con quién,
// lo esperado, lo contado, "Faltaron $…" y el retiro. La recepción no lo ve.
//   npm run e2e:caj-1            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

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
  await r.locator('input[placeholder="$ 0"]').first().fill("2.000");
  await r.locator('button:has-text("Abrir caja")').first().click();
  await r.locator('button:has-text("Sale plata")').click();
  await r.locator('input[placeholder="$"]').fill("500");
  await r.locator('input[placeholder^="Motivo"]').fill(`Proveedor ${s5}`);
  await r.locator('button:has-text("Anotar")').click();
  await r.locator('button:has-text("Cerrar caja")').waitFor({ timeout: 30000 });
  await r.locator('button:has-text("Cerrar caja")').click();
  await r.locator('input[placeholder="$ contado"]').fill("1.400");
  await r.locator('button:has-text("Cerrar con este monto")').click();
  await r.getByText("Faltan $100").waitFor({ timeout: 30000 });
  const link = decodeURIComponent(await r.locator("a[data-compartir-cierre]").getAttribute("href"));
  chequear(/^https:\/\/wa\.me\/\?text=Cierre de caja/.test(link) && /Faltaron \$100/.test(link), "CAJ-2: “Mandar el cierre por WhatsApp” con el cierre escrito", link);
  await r.locator('button:has-text("Listo")').click();
  chequear(await r.locator('main a:has-text("Turnos anteriores")').count() === 0, "la recepción no ve “Turnos anteriores”", "la recepción lo ve");
  await r.goto(`${G}/panel/caja/historial`);
  chequear(await r.getByText("No tenés acceso").count() > 0, "y por la dirección: “No tenés acceso”", "la recepción abre el historial");

  const d = await pagina(b, CELU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/caja`);
  await d.locator('main a:has-text("Turnos anteriores")').click();
  await d.waitForURL(/\/panel\/caja\/historial/);
  const turno = d.locator("[data-turnos] > li", { hasText: `Proveedor ${s5}` });
  await turno.waitFor({ timeout: 30000 });
  const t = (await turno.innerText()).replace(/\n/g, " ");
  chequear(/Faltaron \$100/.test(t) && /Abrió Ana · cerró Ana/.test(t) && /\$1\.500/.test(t) && /\$1\.400/.test(t) && /\$500/.test(t),
    "la dueña ve el turno: abrió y cerró Ana, tenía que haber $1.500, contó $1.400, faltaron $100, retiro de $500 con motivo", t);
  const comp = decodeURIComponent(await turno.locator("a[data-compartir-cierre]").getAttribute("href"));
  chequear(/Abrió Ana · cerró Ana/.test(comp) && /Salió \$500/.test(comp), "CAJ-2: cada turno cerrado se comparte desde el historial", comp);
  const ancho = await d.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  await capturar(d, "caj1-celu-historial");
  ok("historial de turnos");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
