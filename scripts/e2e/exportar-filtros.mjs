#!/usr/bin/env node
// H7 · Exportar socios con los filtros de la lista (estado, plan, bajas) y sin el tope de 100 filas. El botón de Socios baja lo que se
// filtró; sin filtro, a todos. La dueña, en el demo (300 socios), con sesión real. Los números esperados salen de la base y de las píldoras.
//   node scripts/e2e/exportar-filtros.mjs     (con scripts/local/levantar.sh corriendo)
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, aparece, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const uno = async (sql, args = []) => Number((await db.query(sql, args)).rows[0].n);
const GIM = `(select id from public.gimnasios where slug = 'demo')`;

/** Baja el archivo del botón “Exportar” de la pantalla de Socios y devuelve {lineas (sin el encabezado), nombre, texto}. */
async function bajar(p) {
  const boton = p.locator("main a[data-exportar]:visible");
  const [descarga] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), boton.click()]);
  const texto = readFileSync(await descarga.path(), "utf8");
  const lineas = texto.trim().split(/\r\n/);
  return { encabezado: lineas[0].replace("﻿", ""), lineas: lineas.slice(1), nombre: descarga.suggestedFilename(), texto };
}
const cuenta = async (loc) => Number(/(\d+)\s*$/.exec((await loc.innerText()).trim())?.[1] ?? NaN);

try {
  const p = await pagina(b, COMPU);
  p.setDefaultNavigationTimeout(120000);
  await entrar(p, "duena@ejemplo.invalid");

  // ── Sin filtro: todos los socios (más de 100) ──
  const total = await uno(`select count(*) n from public.socios where gimnasio_id = ${GIM}`);
  await p.goto(`${G}/panel/socios`);
  await p.locator('main ul a[href^="/panel/socios/"]').first().waitFor({ timeout: 60000 });
  chequear((await p.locator("main a[data-exportar]:visible").innerText()).trim() === "Exportar", "sin filtro el botón dice “Exportar”", `dice: ${await p.locator("main a[data-exportar]:visible").innerText()}`);
  let r = await bajar(p);
  chequear(r.encabezado.startsWith("Número;Nombre;Apellido;DNI;Celular"), "el archivo trae el encabezado de siempre", `encabezado: ${r.encabezado}`);
  chequear(total > 100 && r.lineas.length === total, `sin filtro: ${r.lineas.length} filas = todos los socios (${total}), sin el tope de 100`, `el archivo tiene ${r.lineas.length} filas y hay ${total} socios`);

  // ── Por estado: lo que dice la píldora ──
  await p.goto(`${G}/panel/socios?estado=vencidos`);
  const pildora = p.locator('[data-filtro-estados] [data-estado="vencidos"]');
  chequear(await aparece(pildora, 60000), "la píldora “Vencidos” está", "no hay píldora de vencidos en el demo");
  const vencidos = await cuenta(pildora);
  chequear((await p.locator("main a[data-exportar]:visible").innerText()).includes("filtrado"), "con un filtro el botón dice “Exportar lo filtrado”", `dice: ${await p.locator("main a[data-exportar]:visible").innerText()}`);
  r = await bajar(p);
  chequear(vencidos > 0 && r.lineas.length === vencidos, `vencidos: ${r.lineas.length} filas = la píldora (${vencidos})`, `vencidos: el archivo tiene ${r.lineas.length} y la píldora dice ${vencidos}`);
  chequear(r.lineas.every((l) => !/;Al día;/i.test(l)), "ninguna fila de vencidos dice “Al día”", "hay filas “Al día” en el archivo de vencidos");

  await p.goto(`${G}/panel/socios?estado=al_dia`);
  const alDia = await cuenta(p.locator('[data-filtro-estados] [data-estado="al_dia"]'));
  r = await bajar(p);
  chequear(alDia > 0 && r.lineas.length === alDia, `al día: ${r.lineas.length} filas = la píldora (${alDia})`, `al día: el archivo tiene ${r.lineas.length} y la píldora dice ${alDia}`);

  // ── Dados de baja ──
  const bajas = await uno(`select count(*) n from public.socios where gimnasio_id = ${GIM} and dado_de_baja_en is not null`);
  if (bajas > 0) {
    await p.goto(`${G}/panel/socios?estado=bajas`);
    await p.locator('main ul a[href^="/panel/socios/"]').first().waitFor({ timeout: 60000 });
    r = await bajar(p);
    chequear(r.lineas.length === bajas, `dados de baja: ${r.lineas.length} filas = ${bajas}`, `dados de baja: el archivo tiene ${r.lineas.length} y hay ${bajas}`);
  } else console.log("· el demo no tiene dados de baja: ese filtro se prueba en la base (exportar-filtros.test.mjs)");

  // ── Por plan ──
  await p.goto(`${G}/panel/socios`);
  const plan = p.locator("[data-filtro-etiquetas] [data-plan]").first();
  if (await aparece(plan, 30000)) {
    const planId = await plan.getAttribute("data-plan");
    const enPlan = await uno(`select count(distinct s.id) n from public.socios s join public.suscripciones su on su.socio_id = s.id
                               where s.gimnasio_id = ${GIM} and su.baja_en is null and su.plan_id = $1`, [planId]);
    await p.goto(`${G}/panel/socios?plan=${planId}`);
    await p.locator('main ul a[href^="/panel/socios/"]').first().waitFor({ timeout: 60000 });
    r = await bajar(p);
    chequear(enPlan > 0 && r.lineas.length === enPlan, `por plan: ${r.lineas.length} filas = los socios de ese plan (${enPlan})`, `por plan: el archivo tiene ${r.lineas.length} y la base cuenta ${enPlan}`);
    // Plan y estado juntos: un subconjunto del plan.
    await p.goto(`${G}/panel/socios?plan=${planId}&estado=al_dia`);
    await p.locator('main ul a[href^="/panel/socios/"]').first().waitFor({ timeout: 60000 }).catch(() => {});
    if (await p.locator("main a[data-exportar]:visible").count()) {
      const j = await bajar(p);
      chequear(j.lineas.length > 0 && j.lineas.length <= enPlan, `plan y estado juntos: ${j.lineas.length} filas (de las ${enPlan} del plan)`, `plan y estado: ${j.lineas.length} filas contra ${enPlan} del plan`);
    }
  } else console.log("· el demo tiene un solo plan: el filtro por plan se prueba en la base");

  // ── Búsqueda de texto junto con un estado ──
  await p.goto(`${G}/panel/socios?q=Testigo&estado=vencidos`);
  await p.locator('main ul a[href^="/panel/socios/"]').first().waitFor({ timeout: 60000 });
  r = await bajar(p);
  chequear(r.lineas.length > 0 && r.lineas.every((l) => /Testigo/.test(l)), `texto y estado juntos: ${r.lineas.length} filas, todas de “Testigo”`, "el archivo mezcla otras personas o está vacío");
  chequear(/^socios-demo-\d{4}-\d{2}-\d{2}\.csv$/.test(r.nombre), `el archivo se llama ${r.nombre}`, `nombre raro: ${r.nombre}`);
  if (p.errores.length) falla(`Socios: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.stack : e.message.split("\n")[0]}`);
}
await db.end();
await b.close();
resultado();
