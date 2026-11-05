#!/usr/bin/env node
// SOC-1 · Importar socios: un CSV con errores (se marcan por fila y quedan
// afuera), importar lo válido, el que pagó entra hasta su fecha, deshacer;
// un Excel (.xlsx) con nombre y apellido en una columna y fechas del Excel;
// recepción no importa.
//   npm run e2e:soc-1            (con scripts/local/levantar.sh corriendo)
import { join } from "node:path";
import { COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s = Date.now().toString().slice(-5);
const csv = [
  "Apellido;Nombre;DNI;Teléfono;Plan;Pagó hasta",
  `Importado${s};Uno;71${s}1;000 7${s}1;Plan Full;31/12/2030`,
  `Importado${s};Dos;71${s}2;000 7${s}2;plan full;`,
  `Importado${s};Tres;12;000 7${s}3;Plan Full;31/12/2030`,
  `Importado${s};Cuatro;71${s}4;000 7${s}4;Plan Inventado;31/12/2030`,
].join("\r\n");

try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  await p.goto(`${G}/panel/socios`);
  await p.locator('main a:has-text("Importar")').click();
  await p.waitForURL(/\/panel\/socios\/importar/, { timeout: 30000 });
  const imp = p.locator("[data-importador]");
  await imp.waitFor({ timeout: 60000 });
  ok("“📥 Importar” desde Socios abre el importador");

  // ── CSV ──
  await p.setInputFiles('input[aria-label="Elegir archivo"]', { name: "socios.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
  await p.locator("[data-columnas]").waitFor({ timeout: 15000 });
  const elegidas = await p.locator("[data-columnas] select").evaluateAll((xs) => xs.map((x) => x.value));
  chequear(elegidas.join(",") === "apellido,nombre,dni,telefono,plan,vence", `adivina las columnas: ${elegidas.join(", ")}`, `columnas: ${elegidas.join(", ")}`);
  await p.locator('button:has-text("Revisar")').click();
  const rev = p.locator("[data-revision]");
  await rev.waitFor({ timeout: 30000 });
  chequear(await rev.getAttribute("data-validas") === "2" && await rev.getAttribute("data-con-error") === "2", "revisión: 2 listos y 2 con algo para corregir", `revisión: ${await rev.getAttribute("data-validas")} / ${await rev.getAttribute("data-con-error")}`);
  const errores = (await rev.locator("[data-fila-error]").allInnerTexts()).join(" | ").replace(/\s+/g, " ");
  chequear(/Fila 4 .*DNI “12”/.test(errores) && /Fila 5 .*Plan “Plan Inventado”: no existe/.test(errores), `cada error con su fila: ${errores.slice(0, 120)}…`, `errores: ${errores}`);
  await capturar(p, "soc1-compu-revision");
  await rev.locator('button:has-text("Importar 2 socios")').click();
  await p.locator("[data-importados]").waitFor({ timeout: 60000 });
  chequear(await p.locator("[data-importados]").getAttribute("data-importados") === "2", "importa los 2 válidos (los otros quedan afuera)", "no importó 2");

  // El que pagó hasta 2030 entra; el que no tiene fecha queda sin pagar.
  await p.goto(`${G}/panel/socios?q=Importado${s}`);
  const filas = p.locator('main a[href^="/panel/socios/"]:not([href$="/nuevo"]):not([href$="/importar"])');
  await filas.first().waitFor({ timeout: 30000 });
  const textos = (await filas.allInnerTexts()).map((x) => x.replace(/\s+/g, " "));
  chequear(textos.length === 2 && textos.some((x) => /Uno/.test(x) && !/no pagó|Venció|Sin plan/i.test(x)) && textos.some((x) => /Dos/.test(x) && /pag|plan/i.test(x)),
    `en Socios: ${textos.join(" | ")}`, `en Socios: ${textos.join(" | ")}`);

  // ── Deshacer ──
  await p.goto(`${G}/panel/socios/importar`);
  await p.locator('[data-importacion="activa"] button:has-text("Deshacer")').first().click();
  await p.locator('[data-importacion="deshecha"]').first().waitFor({ timeout: 30000 });
  await p.goto(`${G}/panel/socios?q=Importado${s}`);
  chequear(await aparece(p.locator("main", { hasText: `Nadie con` })), "deshacer: ya no están", "deshacer: siguen en Socios");

  // ── Excel ──
  await p.goto(`${G}/panel/socios/importar`);
  await p.locator("[data-importador]").waitFor();
  await p.setInputFiles('input[aria-label="Elegir archivo"]', join(process.cwd(), "scripts", "e2e", "archivos", "socios-ejemplo.xlsx"));
  await p.locator("[data-columnas]").waitFor({ timeout: 15000 });
  const ex = await p.locator("[data-columnas] select").evaluateAll((xs) => xs.map((x) => x.value));
  chequear(ex.join(",") === "nombre,dni,telefono,plan,vence,", `Excel: ${ex.map((x) => x || "no importar").join(", ")}`, `Excel columnas: ${ex.join(",")}`);
  await p.locator('button:has-text("Revisar")').click();
  await p.locator("[data-revision]").waitFor({ timeout: 30000 });
  const vex = await p.locator("[data-revision]").getAttribute("data-validas");
  if (vex === "3") {
    await p.locator('[data-revision] button:has-text("Importar 3 socios")').click();
    await p.locator('[data-importados="3"]').waitFor({ timeout: 60000 });
    ok("Excel: 3 socios importados (nombre y apellido separados, fechas del Excel)");
    await p.locator('[data-importacion="activa"] button:has-text("Deshacer")').first().click();
    await p.locator('[data-importacion="deshecha"]').first().waitFor({ timeout: 30000 });
    ok("y se deshace");
  } else falla(`Excel: ${vex} válidos (${(await p.locator("[data-fila-error]").allInnerTexts()).join(" | ")})`);
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
  await p.context().close();

  // ── Recepción ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios`);
  await r.locator("main").waitFor();
  chequear(await r.locator('main a:has-text("Importar")').count() === 0, "recepción: no ve “Importar”", "recepción ve Importar");
  await r.goto(`${G}/panel/socios/importar`);
  chequear(!(await r.locator("[data-importador]").count()), "recepción: el importador dice sin permiso", "recepción abre el importador");
  await r.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
