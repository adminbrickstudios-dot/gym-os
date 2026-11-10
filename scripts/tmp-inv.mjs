import fs from "node:fs";
import path from "node:path";
const cuenta = new Map();
let total = 0;
const recorrer = (d) => {
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) recorrer(p);
    else if (p.endsWith(".tsx") && !/\.test\./.test(p)) {
      const t = fs.readFileSync(p, "utf8");
      for (const m of t.matchAll(/\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}️?)*/gu)) { cuenta.set(m[0], (cuenta.get(m[0]) ?? 0) + 1); total++; }
    }
  }
};
for (const d of process.argv.slice(2)) recorrer(d);
console.log(total, cuenta.size);
console.log([...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([e, n]) => `${e}${n}`).join(" "));
