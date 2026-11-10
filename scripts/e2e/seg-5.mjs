#!/usr/bin/env node
// SEG-5 · Entrada sin internet: la recepción guarda la copia en su compu →
// se corta internet → busca en la copia: al que puede le anota "entró"; al
// que no, no hay botón → vuelve internet y se registra solo, con la base
// decidiendo. Deja anulado lo que anotó.
//   npm run e2e:seg-5            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const b = await navegador();
let elegido = null;
try {
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/entrada`);
  await r.locator("[data-prender-copia]").click();
  const linea = r.locator("[data-copia]");
  await r.waitForFunction(() => Number(document.querySelector("[data-copia]")?.getAttribute("data-copia") ?? 0) > 0, null, { timeout: 90000 });
  const n = await linea.getAttribute("data-copia");
  ok(`la recepción guarda la copia en su compu: “📴 Copia para cuando se corte internet · ${n} socios”`);
  // De la copia: uno que puede y uno que no, con nombre único.
  const copia = await r.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith("gymos.sin-internet.copia."));
    return JSON.parse(localStorage.getItem(k));
  });
  const unico = (s) => copia.socios.filter((x) => x.n === s.n).length === 1;
  elegido = copia.socios.find((x) => x.p && unico(x));
  const noPuede = copia.socios.find((x) => !x.p && unico(x));

  await r.context().setOffline(true);
  const panel = r.locator("[data-sin-internet-panel]");
  chequear(await aparece(panel, 30000), "se corta internet: la Entrada muestra “📴 Sin internet” con la copia", "no se dio cuenta de que no hay internet");
  const buscar = panel.locator('input[aria-label="Buscar en la copia"]');
  await buscar.fill(elegido.n);
  await panel.locator(`[data-copia-socio="${elegido.n}"] button`, { hasText: "Entró" }).click();
  chequear(await aparece(panel.locator('[data-cola="1"]'), 10000), `busca a ${elegido.n} (puede): “Entró” y queda esperando a internet`, await panel.innerText());
  if (noPuede) {
    await buscar.fill(noPuede.n);
    const fila = panel.locator(`[data-copia-socio="${noPuede.n}"]`);
    await fila.waitFor({ timeout: 10000 });
    chequear(await fila.locator("button").count() === 0 && /no se deja pasar/.test(await fila.innerText()), `a ${noPuede.n} (${noPuede.t}) no hay botón: “sin internet no se deja pasar…”`, await fila.innerText());
  }
  await capturar(r, "seg5-sin-internet");

  await r.context().setOffline(false);
  const listo = r.locator("[data-sincronizado]");
  chequear(await aparece(listo, 60000) && /Se registraron/.test(await listo.innerText()), "vuelve internet: “Se registraron las entradas anotadas sin internet”", await r.locator("main").innerText().then((t) => t.slice(0, 300)));
  const [fila] = (await db.query(`select i.resultado, i.via_acceso from public.ingresos_sin_internet x join public.ingresos i on i.id = x.ingreso_id
    where i.socio_id = $1 order by x.sincronizado_en desc limit 1`, [elegido.s])).rows;
  chequear(fila && fila.resultado !== "rechazado", `en la base: ${elegido.n} entró (${fila?.resultado}), registrado por la función de siempre`, JSON.stringify(fila));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  if (elegido) await db.query(`select privado.anular_ingreso(x.ingreso_id, 'Prueba e2e sin internet', null, true)
    from public.ingresos_sin_internet x join public.ingresos i on i.id = x.ingreso_id where i.socio_id = $1 and i.anulado_en is null and i.resultado <> 'rechazado'`, [elegido.s]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
