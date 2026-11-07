// Cuenta cuántas acciones del servidor quedan colgadas en "Sumando…" (VD-64).
// Uso, con la app levantada: node scripts/diag/accion-colgada.mjs 50
import { PLATAFORMA as B, entrar, navegador, pagina, COMPU } from "../e2e/comun.mjs";
const N = Number(process.argv[2] ?? 50);
const b = await navegador(); const p = await pagina(b, COMPU);
await entrar(p, "admin@ejemplo.invalid", undefined, B);
await p.goto(`${B}/admin`);
await p.locator('a:has-text("Equipo, claves")').first().click();
let colgadas = 0;
for (let i = 0; i < N; i++) {
  const d = `diag-${Date.now()}-${i}.vercel.app`;
  await p.fill("input[name=host]", d);
  await p.click('form:has-text("Sumar una dirección") button:has-text("Sumar")');
  try { await p.locator("li", { hasText: d }).waitFor({ timeout: 15000 }); }
  catch { colgadas++; await p.reload(); }
}
console.log(`colgadas ${colgadas} de ${N}`);
await b.close();
process.exit(colgadas ? 1 : 0);
