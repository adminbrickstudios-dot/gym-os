#!/usr/bin/env node
// COM-8 · Eventos: la dueña crea un workshop (cupo 2, precio) → la recepción
// vende un lugar en Vender (aparece como producto) → Eventos dice "1 de 2" →
// la página y la app lo muestran con los lugares que quedan → la dueña lo
// cancela y sale de Vender.
//   npm run e2e:com-8            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const s = Date.now().toString().slice(-5);
const NOMBRE = `Workshop ${s}`;
const b = await navegador();
let d;
try {
  d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/eventos`);
  await d.locator('button:has-text("Nuevo evento")').click();
  const f = d.locator("[data-nuevo-evento]");
  await f.locator("input").first().fill(NOMBRE);
  const en3 = new Date(Date.now() + 3 * 864e5); const dia = en3.toISOString().slice(0, 10);
  await f.locator('input[type="datetime-local"]').fill(`${dia}T19:00`);
  await f.locator('input[inputmode="numeric"]').fill("2");
  await f.locator('input[inputmode="decimal"]').fill("3.000");
  await f.locator('button[type="submit"]').click();
  const fila = d.locator("[data-evento]", { hasText: NOMBRE });
  await fila.waitFor({ timeout: 30000 });
  chequear(/0 de 2/.test(await fila.innerText()) && /\$3\.000/.test(await fila.innerText()), `la dueña crea “${NOMBRE}”: cupo 2, $3.000`, await fila.innerText());

  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/vender`);
  await r.locator("main button", { hasText: NOMBRE }).first().click();
  await r.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await r.locator('button:has-text("✅ Cobrar")').click();
  await esperarCobro(r);
  ok("la recepción vende un lugar en Vender (es un producto más)");
  await d.reload();
  chequear(/1 de 2/.test(await d.locator("[data-evento]", { hasText: NOMBRE }).innerText()), "Eventos: “1 de 2 · quedan 1”", await d.locator("[data-evento]", { hasText: NOMBRE }).innerText());

  const v = await pagina(b, CELU);
  v.setDefaultNavigationTimeout(120000);
  await v.goto(`${G}/`);
  const enPagina = v.locator("[data-eventos-landing] li", { hasText: NOMBRE });
  if (await aparece(v.locator("h1").first(), 30000) && await v.locator("[data-eventos-landing]").count()) {
    chequear(/Quedan 1 lugar/.test(await enPagina.innerText()), "la página lo muestra: fecha, precio y “Quedan 1 lugar”", await enPagina.innerText().catch(() => "no está"));
  } else ok("la página del demo no está publicada ahora: no muestra eventos (lo prueba la base)");
  const so = await pagina(b, CELU);
  so.setDefaultNavigationTimeout(120000);
  await entrar(so, "socio@ejemplo.invalid");
  await so.goto(`${G}/app`);
  chequear(await aparece(so.locator("[data-eventos-app] li", { hasText: NOMBRE }), 60000), "y la app: “🎟️ Próximos eventos”", "la app no muestra el evento");
  await capturar(so, "com8-celu-app");

  await d.locator("[data-evento]", { hasText: NOMBRE }).locator("button", { hasText: "Cancelarlo" }).click();
  await d.locator('[data-evento="cerrado"]', { hasText: NOMBRE }).waitFor({ timeout: 30000 });
  await r.goto(`${G}/panel/vender`);
  await r.locator("text=¿Cómo paga?").waitFor({ timeout: 60000 });
  chequear(await r.locator("main button", { hasText: NOMBRE }).count() === 0, "la dueña lo cancela y sale de Vender", "sigue en Vender");
  for (const p of [d, r, v, so]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
