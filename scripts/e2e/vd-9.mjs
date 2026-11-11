#!/usr/bin/env node
// VD-9 · Caja por turno que se cierra sola (D20), sin cron.
// La recepción abre su turno desde la Entrada, cobra en efectivo, cierra contando billetes con un
// faltante y ve el reporte (FALTAN $500). La dueña ve el cierre del día. Después un turno queda
// abierto "de ayer": figura sin contar, la dueña lo cuenta desde Caja → Para revisar.
//   node scripts/e2e/vd-9.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
// F1.9: un error que nadie atrapó deja de colgar el recorrido sin ✗: se escribe qué esperaba y cuándo, y se corta con código 1.
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const G = GIMNASIO();
const b = await navegador();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
try {
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");

  // Si quedó un turno de otra prueba, se cierra primero.
  await r.goto(`${G}/panel/caja`);
  await r.locator("main h1").waitFor();
  if (await r.locator('button:has-text("Cerrar caja")').count()) {
    await r.locator('button:has-text("Cerrar caja")').first().click();
    await r.locator('input[placeholder="$ contado"]').fill("0");
    await r.locator('button:has-text("Cerrar con este monto")').click();
    await r.locator('button:has-text("Listo")').click();
  }

  // ── Abrir mi turno desde la Entrada.
  await r.goto(`${G}/panel/entrada`);
  await r.locator('[data-mi-turno="cerrado"]').waitFor({ timeout: 30000 });
  await r.locator('[data-mi-turno="cerrado"] button:has-text("Abrir mi turno")').click();
  await r.locator('input[aria-label="Fondo del turno"]').fill("1.000");
  await r.locator('button:has-text("Abrir turno")').click();
  await r.locator('[data-mi-turno="abierto"]').waitFor({ timeout: 30000 });
  chequear(/Tu turno/.test(await r.locator('[data-mi-turno="abierto"]').innerText()), "Entrada: “Tu turno: … desde las …” con “Cerrar mi turno”", await r.locator('[data-mi-turno="abierto"]').innerText());

  // ── Cobrar en efectivo (el efectivo cae en mi turno).
  await r.goto(`${G}/panel/vender`);
  await r.locator("main button", { hasText: "Agua 500 ml" }).click();
  await r.locator('button[aria-pressed]:has-text("Efectivo")').click();
  await r.locator('button:has-text("Cobrar")').click();
  await esperarCobro(r);
  ok("cobré un agua en efectivo ($1.500) en mi turno");

  // ── Cerrar con la calculadora de billetes y un faltante.
  await r.goto(`${G}/panel/caja`);
  await r.locator('button:has-text("Cerrar caja")').click();
  await r.locator('button:has-text("Contar billetes")').click();
  await r.locator('input[aria-label="Billetes de $1.000"]').fill("2");
  chequear(/Suman \$2\.000/.test(await r.locator("[data-billetes]").innerText()), "la calculadora suma: 2 × $1.000 = $2.000", await r.locator("[data-billetes]").innerText());
  await r.locator('button:has-text("Cerrar con este monto")').click();
  await r.getByText("Faltan $500").waitFor({ timeout: 30000 });
  ok("cierre con faltante: “Faltan $500” (tenía que haber $2.500)");
  await r.locator("a[data-ver-reporte]").click();
  await r.waitForURL(/\/panel\/caja\/reporte\?turno=/);
  const turnoUrl = r.url();
  await r.locator("[data-sobra-falta]").waitFor({ timeout: 30000 });
  const grande = await r.locator("[data-sobra-falta]").innerText();
  chequear(/FALTAN \$500/.test(grande) && (await r.locator('[data-veredicto="falta"]').count()) === 1, "reporte del turno: FALTAN $500 en grande", grande);
  chequear(/2 × \$1\.000/.test(await r.locator("[data-billetes-contados]").innerText()), "el reporte guarda cómo se contó (2 × $1.000)", "sin billetes");
  const link = decodeURIComponent(await r.locator("a[data-compartir-cierre]").getAttribute("href"));
  chequear(/Faltaron \$500/.test(link), "se manda por WhatsApp con la falta escrita", link);
  const celu = await pagina(b, CELU);
  await entrar(celu, "recepcion@ejemplo.invalid");
  await celu.goto(turnoUrl);
  await celu.locator("[data-sobra-falta]").waitFor({ timeout: 30000 });
  const ancho = await celu.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `reporte en celular sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  await capturar(celu, "vd9-celu-reporte");

  // ── La dueña ve el cierre del día (Z).
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/caja`);
  await d.locator('main a:has-text("Cierre del día")').click();
  await d.waitForURL(/\/panel\/caja\/reporte/);
  await d.locator("[data-reporte-dia]").waitFor({ timeout: 30000 });
  const fila = d.locator("[data-turnos-dia] li", { hasText: "Ana" }).filter({ hasText: "FALTAN $500" });
  chequear((await fila.count()) >= 1, "Cierre del día: el turno de Ana con FALTAN $500", await d.locator("[data-turnos-dia]").innerText());
  await capturar(d, "vd9-compu-cierre-dia");

  // ── Un turno que queda abierto de ayer: figura sin contar.
  await r.goto(`${G}/panel/entrada`);
  await r.locator('[data-mi-turno="cerrado"] button:has-text("Abrir mi turno")').click();
  await r.locator('input[aria-label="Fondo del turno"]').fill("700");
  await r.locator('button:has-text("Abrir turno")').click();
  await r.locator('[data-mi-turno="abierto"]').waitFor({ timeout: 30000 });
  const db = new pg.Client({ connectionString: url }); await db.connect();
  await db.query(`update public.turnos_caja t set abierto_en = abierto_en - interval '1 day'
                    from public.equipo e where e.id = t.abierto_por and t.cerrado_en is null and e.nombre like 'Ana%'`);
  await db.end();
  await r.goto(`${G}/panel/entrada`);
  await r.locator('[data-mi-turno="abierto"]').waitFor({ timeout: 30000 });
  chequear(/otro día/.test(await r.locator('[data-mi-turno="abierto"]').innerText()), "Entrada: “tu turno quedó abierto de otro día: no se puede cobrar en él”", await r.locator('[data-mi-turno="abierto"]').innerText());
  await r.goto(`${G}/panel/caja`);
  await r.locator("[data-sin-contar]").waitFor({ timeout: 30000 });
  ok("Caja de la recepción: figura sin contar, con la salida de abrir turno nuevo");

  await d.goto(`${G}/panel/caja`);
  const fila2 = d.locator("[data-caja-para-revisar]", { hasText: "la abrió Ana" }).first();
  await fila2.waitFor({ timeout: 30000 });
  chequear(/Sin contar/.test(await fila2.innerText()) && /\$700/.test(await fila2.innerText()), "la dueña la ve en “Para revisar” con lo que tenía que haber ($700)", await fila2.innerText());
  await capturar(d, "vd9-compu-para-revisar");
  await fila2.locator('button:has-text("Contar ahora")').click();
  await fila2.locator('input[aria-label="Plata contada"]').fill("650");
  await fila2.locator('button:has-text("Anotar lo que conté")').click();
  await d.locator("[data-revisada]").getByText("Faltaban $50").waitFor({ timeout: 30000 });
  ok("la dueña la cuenta después: “Faltaban $50”");
  await d.locator("[data-revisada] button:has-text('Listo')").click();
  await d.locator("[data-para-revisar]").waitFor({ state: "detached", timeout: 30000 });
  ok("contada, sale de Para revisar");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
