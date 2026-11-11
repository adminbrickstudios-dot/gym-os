import fs from "node:fs";
const t = fs.readFileSync("C:/Users/consu/proyectos/gym-os/.local/run-42740123784.log", "utf8").split("\n");
const quitar = (l) => l.replace(/^Pantallas \(e2e y barrido\)\tPantallas \(e2e, cada recorrido aunque falle otro\)\t\S+Z /, "");
const quiero = process.argv[2];
let dentro = false, buf = [];
for (const l0 of t) {
  const l = quitar(l0);
  const m = l.match(/^##\[group\](scripts\/e2e\/([\w-]+)\.mjs)/);
  if (m) { dentro = m[2] === quiero; continue; }
  if (dentro) { if (/^##\[endgroup\]/.test(l)) break; buf.push(l.slice(0, 260)); }
}
const i = buf.findIndex((x) => /✗/.test(x));
console.log(buf.slice(Math.max(0, i - 6), i + 3).join("\n"));
console.log("--- total líneas del grupo:", buf.length);
