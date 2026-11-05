#!/usr/bin/env node
// CAJ-5 · Caja olvidada: la recepción abre la caja y "pasa la noche" (la prueba
// corre la apertura un día para atrás en la base local); al otro día Inicio le
// avisa, la Caja dice que quedó abierta, y no puede abrir otra hasta cerrarla.
// La dueña también lo ve.
//   npm run e2e:caj-5            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
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
  await r.locator('input[placeholder="$ 0"]').first().fill("0");
  await r.locator('button:has-text("Abrir caja")').first().click();
  await r.locator('button:has-text("Cerrar caja")').waitFor({ timeout: 30000 });
  // Pasa la noche: la apertura queda en ayer (el único hecho que cambia la prueba).
  const db = new pg.Client({ connectionString: url }); await db.connect();
  await db.query(`update public.turnos_caja t set abierto_en = abierto_en - interval '1 day'
                   from public.equipo e where e.id = t.abierto_por and t.cerrado_en is null and e.nombre like 'Ana%'`);
  await db.end();

  await r.goto(`${G}/panel`);
  const aviso = r.locator("[data-cajas-olvidadas] li").first();
  await aviso.waitFor({ timeout: 30000 });
  chequear(/quedó abierta/.test(await aviso.innerText()) && /la abriste vos/.test(await aviso.innerText()), "Inicio de la recepción: “⏰ Caja principal quedó abierta · la abriste vos”", await aviso.innerText());
  await aviso.locator("a").click();
  await r.waitForURL(/\/panel\/caja/);
  await r.locator("[data-olvidada]").waitFor({ timeout: 30000 });
  ok("Caja: “⏰ Esta caja quedó abierta. Contá la plata y cerrala…”");
  await capturar(r, "caj5-compu-caja");

  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  await d.locator("[data-cajas-olvidadas] li", { hasText: "la abrió Ana" }).waitFor({ timeout: 30000 });
  ok("la dueña también la ve (“la abrió Ana”)");

  await r.locator('button:has-text("Cerrar caja")').click();
  await r.locator('input[placeholder="$ contado"]').fill("0");
  await r.locator('button:has-text("Cerrar con este monto")').click();
  await r.locator('button:has-text("Listo")').click();
  await r.goto(`${G}/panel`);
  await r.locator("main h1").waitFor();
  chequear(await r.locator("[data-cajas-olvidadas]").count() === 0, "cerrada, el aviso desaparece", "sigue el aviso");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
