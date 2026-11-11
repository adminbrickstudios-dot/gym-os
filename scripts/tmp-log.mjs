import fs from "node:fs";
const t = fs.readFileSync("C:/Users/consu/proyectos/gym-os/.local/run-42740123784.log", "utf8").split("\n");
const quitar = (l) => l.replace(/^Pantallas \(e2e y barrido\)\tPantallas \(e2e, cada recorrido aunque falle otro\)\t\S+Z /, "");
let grupo = null;
const out = {};
for (const l0 of t) {
  const l = quitar(l0);
  const m = l.match(/^##\[group\](scripts\/e2e\/[\w-]+\.mjs)/);
  if (m) { grupo = m[1].replace("scripts/e2e/", "").replace(".mjs", ""); out[grupo] = []; continue; }
  if (!grupo) continue;
  if (/^##\[endgroup\]/.test(l)) { continue; }
  if (/✗|\[pantalla |Error|TypeError|##\[error\]|##\[warning\]falló/.test(l)) out[grupo].push(l.slice(0, 330));
}
const quiero = process.argv.slice(2);
for (const [g, ls] of Object.entries(out)) {
  if (quiero.length && !quiero.includes(g)) continue;
  console.log(`\n=== ${g} (${ls.length})`);
  for (const x of ls.slice(0, 8)) console.log("  " + x);
}
