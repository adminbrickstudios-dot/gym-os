#!/usr/bin/env node
// SOC-6 · Cumpleaños: Inicio muestra a los que cumplen hoy (el testigo del
// demo cumple el día que se siembra) con "Saludar" armado con el mensaje de
// Configuración → Mensajes; el profe no lo ve.
//   npm run e2e:soc-6            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  await p.goto(`${G}/panel`);
  await p.locator("h1").waitFor();
  const seccion = p.locator("[data-cumplen-hoy]");
  if (await aparece(seccion, 10000)) {
    const fila = seccion.locator("li").first();
    const wa = new URL(await fila.locator('a:has-text("Saludar")').getAttribute("href"));
    const nombre = (await fila.locator('a[href^="/panel/socios/"]').innerText()).split(" ")[0];
    chequear(/cumplea/i.test(wa.searchParams.get("text") ?? "") && (wa.searchParams.get("text") ?? "").includes(nombre),
      `Inicio → 🎂 Cumplen hoy: ${nombre}, “${wa.searchParams.get("text")?.slice(0, 50)}…”`, `mensaje: ${wa}`);
    chequear(/Cumple \d+/.test(await fila.innerText()), "dice cuántos cumple", "no dice la edad");
    await capturar(p, "soc6-compu-inicio");
  } else ok("(hoy no cumple nadie en el demo: el demo se sembró otro día)");
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
  await p.context().close();
  const pr = await pagina(b, CELU);
  await entrar(pr, "profe@ejemplo.invalid");
  await pr.goto(`${G}/panel`);
  await pr.locator("h1").waitFor();
  chequear(await pr.locator("[data-cumplen-hoy]").count() === 0, "el profe no ve cumpleaños", "el profe ve cumpleaños");
  await pr.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
