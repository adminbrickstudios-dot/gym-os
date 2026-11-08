#!/usr/bin/env node
// BASE-11 pasos 7 y 8 · El profe no ve plata y un segundo gimnasio no ve nada del primero (y al revés).
//   node scripts/e2e/base-aislamiento.mjs     (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO(), GB = GIMNASIO("demo-box");
const b = await navegador();
try {
  // ── 7 · El profe: sin plata ──
  const pr = await pagina(b, COMPU);
  pr.setDefaultNavigationTimeout(120000);
  await entrar(pr, "profe@ejemplo.invalid");
  for (const ruta of ["/panel/caja", "/panel/vender", "/panel/planes", "/panel/resumen", "/panel/retencion"]) {
    await pr.goto(`${G}${ruta}`);
    await pr.locator("main, body").first().waitFor({ timeout: 30000 });
    const t = await pr.locator("main").first().innerText().catch(() => "");
    chequear(/No tenés acceso|acceso a esta pantalla|apagada/i.test(t) && !/\$\s?\d/.test(t), `el profe en ${ruta}: sin acceso y sin plata`, `el profe ve ${ruta}: ${t.replace(/\s+/g, " ").slice(0, 100)}`);
  }
  await pr.goto(`${G}/panel`);
  await pr.locator("h1").first().waitFor({ timeout: 30000 });
  chequear(!/\$\s?\d/.test(await pr.locator("main").innerText()), "el inicio del profe no muestra ningún monto", "el inicio del profe muestra plata");

  // ── 8 · Dos gimnasios: cada dueño ve lo suyo ──
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios?q=Testigo`);
  await d.locator("main ul a[href^='/panel/socios/']").first().waitFor({ timeout: 60000 });
  chequear((await d.locator("main").innerText()).includes("Testigo"), "la dueña del demo ve a sus socios (los testigos)", "no ve sus socios");
  const x = await pagina(b, COMPU);
  x.setDefaultNavigationTimeout(120000);
  await entrar(x, "box@ejemplo.invalid", undefined, GB);
  await x.goto(`${GB}/panel/socios?q=Testigo`);
  await x.locator("h1").first().waitFor({ timeout: 60000 });
  chequear(await x.locator("main ul a[href^='/panel/socios/']").count() === 0, "la dueña del otro gimnasio no ve a los socios del demo", "ve socios del otro gimnasio");
  // La dueña del demo, parada en la dirección del otro gimnasio, no tiene panel ahí.
  const c = await pagina(b, COMPU);
  c.setDefaultNavigationTimeout(120000);
  await c.goto(`${GB}/ingresar`);
  await c.fill("input[type=email]", "duena@ejemplo.invalid"); await c.fill("input[type=password]", "demo-gymos"); await c.click("button[type=submit]");
  await c.waitForTimeout(5000);
  chequear(!/\/panel/.test(c.url()) || /No tenés acceso/.test(await c.locator("body").innerText()), "la dueña del demo no entra al panel del otro gimnasio", `entró: ${c.url()}`);
  for (const [q, p] of [["profe", pr], ["dueña", d], ["otra dueña", x]]) if (p.errores.length) falla(`${q}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
