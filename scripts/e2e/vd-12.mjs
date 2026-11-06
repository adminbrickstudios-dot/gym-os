#!/usr/bin/env node
// VD-12 · Inicio del dueño y de la recepción: botón Entrada grande, 4 números
// configurables con link a su lista (y Volver regresa a Inicio), y todos los
// bloques que Inicio ya tenía. La recepción no ve la plata del día ni elige números.
//   node scripts/e2e/vd-12.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  await d.locator("[data-boton-entrada]").waitFor({ timeout: 30000 });
  ok("la dueña ve el botón Entrada grande");
  await d.locator("[data-numero]").first().waitFor({ timeout: 30000 });
  chequear((await d.locator("[data-numero]").count()) === 4, "la dueña ve 4 números", "no son 4 números");
  chequear((await d.locator('[data-numero="cobrado"]').count()) === 1, "la dueña ve lo cobrado hoy", "falta Cobrado hoy");
  chequear((await d.getByText("Ahora y lo que sigue").count()) === 1, "sigue 'Ahora y lo que sigue'", "se perdió 'Ahora y lo que sigue'");
  await capturar(d, "vd12-compu-duena");

  // Cada número lleva a su lista y Volver regresa a Inicio.
  for (const [clave, ruta] of [["entraron", "/panel/entrada"], ["a_cobrar", "/panel/vencen-hoy"], ["cobrado", "/panel/caja"]]) {
    const n = d.locator(`a[data-numero="${clave}"]`);
    if (!(await n.count())) { ok(`(${clave}: sección apagada en este gimnasio, sin link)`); continue; }
    await n.click();
    await d.waitForURL((u) => u.pathname.startsWith(ruta), { timeout: 30000 });
    ok(`${clave} lleva a ${ruta}`);
    await d.goBack();
    await d.waitForURL((u) => u.pathname === "/panel", { timeout: 30000 });
    await d.locator("[data-numero]").first().waitFor({ timeout: 30000 });
    ok(`Volver desde ${ruta} deja en Inicio`);
  }

  // La dueña elige otros 4 números y quedan guardados (por gimnasio).
  const quiero = ["activos", "altas_mes", "bajas_mes", "a_cobrar"];
  await d.locator("[data-elegir-numeros] summary").click();
  const marcas = d.locator("[data-elegir-numeros] input[type=checkbox]");
  for (let i = 0; i < await marcas.count(); i++) if (await marcas.nth(i).isChecked()) await marcas.nth(i).uncheck();
  const etiquetas = { activos: "Socios activos", altas_mes: "Altas del mes", bajas_mes: "Bajas del mes", a_cobrar: "A cobrar hoy" };
  for (const c of quiero) await d.locator(`[data-elegir-numeros] input[aria-label="${etiquetas[c]}"]`).check();
  await d.locator('[data-elegir-numeros] button:has-text("Guardar")').click();
  await d.locator("[data-elegir-numeros] [role=status]").waitFor({ timeout: 30000 });
  await d.reload();
  await d.locator("[data-numero]").first().waitFor({ timeout: 30000 });
  const claves = await d.locator("[data-numero]").evaluateAll((els) => els.map((e) => e.getAttribute("data-numero")));
  chequear(quiero.every((c) => claves.includes(c)) && claves.length === 4, "los 4 números elegidos quedan guardados", `se ven: ${claves.join(", ")}`);
  // Se deja como estaba (sin elección = los de siempre).
  await d.locator("[data-elegir-numeros] summary").click();
  for (const c of quiero) await d.locator(`[data-elegir-numeros] input[aria-label="${etiquetas[c]}"]`).uncheck();
  await d.locator('[data-elegir-numeros] button:has-text("Guardar")').click();
  await d.locator("[data-elegir-numeros] [role=status]").waitFor({ timeout: 30000 });

  // Recepción: lo suyo, sin la plata del día ni el selector de números.
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel`);
  await r.locator("[data-boton-entrada]").waitFor({ timeout: 30000 });
  await r.locator("[data-numero]").first().waitFor({ timeout: 30000 });
  chequear((await r.locator("[data-numero]").count()) === 4, "la recepción ve 4 números", "la recepción no ve 4 números");
  chequear((await r.locator('[data-numero="cobrado"]').count()) === 0, "la recepción no ve lo cobrado hoy", "la recepción ve la plata del día");
  chequear((await r.locator("[data-elegir-numeros]").count()) === 0, "la recepción no elige los números", "la recepción ve el selector");
  chequear((await r.getByText("Ahora y lo que sigue").count()) === 1, "la recepción ve 'Ahora y lo que sigue'", "falta 'Ahora y lo que sigue' en recepción");
  await capturar(r, "vd12-compu-recepcion");

  // Celular: sin desbordes.
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel`);
  await c.locator("[data-numero]").first().waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  chequear(ancho[0] <= ancho[1], "celular 390 px: Inicio sin desborde horizontal", `desborda: ${ancho[0]} > ${ancho[1]}`);
  await capturar(c, "vd12-celu-duena");
} finally {
  await b.close();
  resultado();
}
