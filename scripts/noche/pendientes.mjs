#!/usr/bin/env node
// Lee la COLA de docs/HOJA-DE-RUTA.md y dice qué se puede hacer.
//   node scripts/noche/pendientes.mjs              resumen (hechos, pendientes, trabados, esperan decisión)
//   node scripts/noche/pendientes.mjs --siguiente  el próximo ítem: "ID · título", o "NADA"
//   node scripts/noche/pendientes.mjs --cuantos    cuántos se pueden hacer ahora
// Se puede: 🟢, o 🟡 Dn con ✅ de Mateo en la tabla de decisiones. Un [~] (vuelta
// cortada) va primero. 🔌 nunca: necesita una cuenta que conecta Mateo.
import { readFileSync } from "node:fs";

const texto = readFileSync(new URL("../../docs/HOJA-DE-RUTA.md", import.meta.url), "utf8");
const aprobadas = new Set();
for (const m of texto.matchAll(/^\|\s*(D\d+)\s*\|.*\|\s*([^|]*?)\s*\|\s*$/gm)) {
  if (m[2].includes("✅")) aprobadas.add(m[1]);
}
const cola = texto.slice(texto.indexOf("## COLA"), texto.indexOf("## Detalle por panel"));
const items = [...cola.matchAll(/^- \[(.)\] ([A-Z]+-\d+) · ([^·]+?) · (.+)$/gm)].map((m) => ({
  marca: m[1], id: m[2], tipo: m[3].trim(), titulo: m[4].trim(),
}));
const sePuede = (i) => {
  if (i.tipo.startsWith("🟢")) return true;
  const d = /🟡\s*(D\d+)/.exec(i.tipo);
  return !!d && aprobadas.has(d[1]);
};
const enCurso = items.filter((i) => i.marca === "~");
const listos = items.filter((i) => i.marca === " " && sePuede(i));
const arg = process.argv[2];

if (arg === "--siguiente") {
  const s = enCurso[0] ?? listos[0];
  console.log(s ? `${s.id} · ${s.titulo}` : "NADA");
} else if (arg === "--cuantos") {
  console.log(enCurso.length + listos.length);
} else {
  const cuenta = (f) => items.filter(f).length;
  console.log(`Hechos: ${cuenta((i) => i.marca === "x")} · Para hacer ya: ${enCurso.length + listos.length} · Trabados: ${cuenta((i) => i.marca === "!")}`);
  console.log(`Esperan tu decisión: ${cuenta((i) => i.marca === " " && i.tipo.startsWith("🟡") && !sePuede(i))} · Necesitan una cuenta externa: ${cuenta((i) => i.marca === " " && i.tipo.startsWith("🔌"))}`);
  console.log(`Decisiones aprobadas: ${[...aprobadas].join(", ") || "ninguna"}`);
  const s = enCurso[0] ?? listos[0];
  if (s) console.log(`Próximo: ${s.id} · ${s.titulo}`);
  for (const t of items.filter((i) => i.marca === "!")) console.log(`  [!] ${t.id} · ${t.titulo}`);
}
