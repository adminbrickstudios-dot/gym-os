#!/usr/bin/env node
// AUD-7 · Vencen hoy botón por botón: la lista con el porqué, WhatsApp armado y
// "💵 Cobrar" que abre Vender con la cuota; la dueña además "Dice que vuelve";
// sin nadie hoy, lleva a Retención.
//   npm run e2e:vencen            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/vencen-hoy`);
  await r.locator("main h1").waitFor({ timeout: 60000 });
  const filas = r.locator("main div.space-y-3 > ul > li");
  if (await filas.count() === 0) {
    chequear(await r.getByText("Hoy no vence nadie").count() > 0, "sin vencimientos hoy: “Hoy no vence nadie” y el camino a Retención", "vacío sin texto");
  } else {
    chequear(/se les? termina la cuota hoy/.test(await r.locator("main").innerText()), "dice cuántos vencen hoy", "no dice cuántos");
    const f = filas.first();
    chequear(await f.locator('a:has-text("Cobrar")').count() === 1, "cada fila tiene “Cobrar”", "no hay Cobrar");
    chequear(await f.locator('button:has-text("Dice que vuelve")').count() === 1, "la recepción también anota “Dice que vuelve” (D2)", "la recepción no puede anotar");
    await f.locator('a:has-text("Cobrar")').click();
    await r.locator("[data-cobrar-linea=cuota]").waitFor({ timeout: 30000 });
    ok("“💵 Cobrar” abre la hoja Cobrar con su cuota ya elegida (VD-5)");
  }
  const d = await pagina(b, CELU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/vencen-hoy`);
  await d.locator("main h1").waitFor({ timeout: 60000 });
  const ancho = await d.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `la dueña en el celular, sin desborde (${ancho}px)`, `desborda: ${ancho}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
