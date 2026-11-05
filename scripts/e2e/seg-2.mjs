#!/usr/bin/env node
// SEG-2 · Exportar todo: la dueña descarga el zip desde Configuración y trae
// un CSV por tabla (socios con sus filas); la recepción recibe 403.
//   npm run e2e:seg-2            (con scripts/local/levantar.sh corriendo)
import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/configuracion?pestana=gimnasio`);
  await d.locator("[data-exportar-todo]").waitFor({ timeout: 60000 });
  const [descarga] = await Promise.all([d.waitForEvent("download", { timeout: 120000 }), d.getByRole("link", { name: /Descargar todos los datos/ }).click()]);
  const zip = unzipSync(new Uint8Array(readFileSync(await descarga.path())));
  const socios = strFromU8(zip["socios.csv"] ?? new Uint8Array()).replace(/^﻿/, "").trim().split("\r\n");
  chequear(/^demo-datos-\d{4}-\d{2}-\d{2}\.zip$/.test(descarga.suggestedFilename()) && Object.keys(zip).length >= 20 && socios.length > 100,
    `la dueña baja ${descarga.suggestedFilename()}: ${Object.keys(zip).length} CSV, socios.csv con ${socios.length - 1} filas`, `${descarga.suggestedFilename()} · ${Object.keys(zip).length} · ${socios.length}`);
  chequear(!/foto_path|gimnasio_id/.test(socios[0]), "sin columnas internas (rutas de archivos, gimnasio_id)", socios[0]);

  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel`);
  const st = await r.evaluate(async (u) => (await fetch(u)).status, `${G}/panel/exportar`);
  chequear(st === 403, "la recepción: 403 “No se pudo exportar”", String(st));
  if (d.errores.length) falla(d.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
