#!/usr/bin/env node
// VD-30 · Tabla antes / después a partir de dos .json que escribe explain.mjs (--json).
//   node scripts/medir/comparar.mjs antes.json despues.json
// Las dos mediciones salen de la MISMA corrida (misma máquina, misma base): comparar corridas distintas no sirve,
// los runners de GitHub varían hasta el doble entre una y otra.
import { readFileSync } from "node:fs";

const [a, d] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, "utf8")));
const antes = new Map(a.filas.map((f) => [f.nombre, f]));
const celda = (f) => (!f ? "—" : f.error ? "error" : f.ms.toFixed(1));
console.log(`Antes / después de la migración de velocidad · ${d.socios} socios, ${d.gimnasios} gimnasios\n`);
console.log("| función | antes (ms) | después (ms) | presupuesto | |", "\n|---|---:|---:|---:|---|");
for (const f of d.filas) {
  const x = antes.get(f.nombre);
  const pasa = !f.error && f.ms <= f.presupuesto;
  const mejora = x && !x.error && !f.error ? ` ${(x.ms / f.ms).toFixed(1)}×` : "";
  console.log(`| ${f.nombre} | ${celda(x)} | ${celda(f)} | ${f.presupuesto} | ${f.error ? "ERROR" : pasa ? "ok" : "PASADO"}${mejora} |`);
}
