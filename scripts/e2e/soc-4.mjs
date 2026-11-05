#!/usr/bin/env node
// SOC-4 · Exportar socios: la dueña descarga el CSV con el mismo filtro de la
// lista (abre en Excel: punto y coma y acentos); recepción no puede.
//   npm run e2e:soc-4            (con scripts/local/levantar.sh corriendo)
import { readFileSync } from "node:fs";
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  await p.goto(`${G}/panel/socios?q=Agustina`);
  const filas = p.locator('main ul a[href^="/panel/socios/"]');
  await filas.first().waitFor({ timeout: 30000 });
  const enLista = await filas.count();
  const [descarga] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), p.locator('main a:visible:has-text("Exportar")').click()]);
  const texto = readFileSync(await descarga.path(), "utf8");
  const lineas = texto.trim().split(/\r\n/);
  chequear(texto.startsWith("﻿") && lineas[0].replace("﻿", "").startsWith("Número;Nombre;Apellido;DNI;Celular"), `CSV para Excel: ${descarga.suggestedFilename()}`, `encabezado: ${lineas[0]}`);
  chequear(lineas.length - 1 === enLista, `con el mismo filtro que la lista: ${enLista} socios`, `el CSV tiene ${lineas.length - 1} y la lista ${enLista}`);
  chequear(lineas.slice(1).every((l) => /Agustina/.test(l)), "todas las filas son de la búsqueda", "hay filas que no son de la búsqueda");
  await p.context().close();

  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios`);
  await r.locator("main").waitFor();
  chequear(await r.locator('main a:has-text("Exportar")').count() === 0, "recepción: no ve “Exportar”", "recepción ve Exportar");
  const resp = await r.goto(`${G}/panel/socios/exportar`);
  chequear(resp.status() === 403 && /Sin permiso/.test(await r.locator("body").innerText()), "recepción: la dirección directa dice “Sin permiso” (no un archivo vacío)", `recepción: ${resp.status()}`);
  await r.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
