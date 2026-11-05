#!/usr/bin/env node
// RES-2 · Exportar el mes para el contador: Ventas, Pagos y Caja bajan como
// CSV para Excel; la recepción recibe "no se pudo", nunca un archivo vacío.
//   npm run e2e:res-2            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/resultado`);
  await d.locator("[data-exportar]").waitFor({ timeout: 60000 });
  const [descarga] = await Promise.all([d.waitForEvent("download"), d.locator("[data-exportar] a", { hasText: "Ventas" }).click()]);
  chequear(/^ventas-.+-\d{4}-\d{2}\.csv$/.test(descarga.suggestedFilename()), `“🧾 Ventas” baja ${descarga.suggestedFilename()}`, descarga.suggestedFilename());
  for (const [que, titulo] of [["ventas", "Fecha;Venta;Socio;Detalle;Bruto"], ["pagos", "Fecha;Venta;Socio;Medio;Monto"], ["caja", "Fecha;Caja;Movimiento;Monto"]]) {
    const href = await d.locator("[data-exportar] a").nth(["ventas", "pagos", "caja"].indexOf(que)).getAttribute("href");
    const r = await d.request.get(`${G}${href}`);
    const txt = await r.text();
    chequear(r.ok() && /text\/csv/.test(r.headers()["content-type"]) && txt.replace(/^﻿/, "").startsWith(titulo),
      `${que}: CSV con ${txt.trim().split("\n").length - 1} filas`, `${r.status()} ${txt.slice(0, 80)}`);
  }
  const rec = await pagina(b, COMPU);
  await entrar(rec, "recepcion@ejemplo.invalid");
  const mes = new Date().toISOString().slice(0, 7);
  const r = await rec.request.get(`${G}/panel/resultado/exportar?que=pagos&mes=${mes}`);
  chequear(r.status() === 403 && /No se pudo exportar/.test(await r.text()), "la recepción: 403 “No se pudo exportar…”", `${r.status()}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
