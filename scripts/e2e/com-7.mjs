#!/usr/bin/env node
// COM-7 · Kiosco con habituales: la dueña los prende (vienen apagados) y
// autoriza una tablet; un socio que vino 3 días a esta hora aparece con su
// nombre e inicial; toca su nombre, pone los últimos 3 números del DNI y
// entra; con números equivocados, no. Al final se apaga de nuevo.
//   npm run e2e:com-7            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const TABLET = { width: 820, height: 1180 };
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const [{ id: gim, sede }] = (await db.query(`select g.id, (select s.id from public.sedes s where s.gimnasio_id = g.id and s.es_principal) sede from public.gimnasios g where g.slug = 'demo'`)).rows;
const s5 = Date.now().toString().slice(-5);
const DNI = `37${s5}4`;
// Un socio al día (Plan Full con cobertura) que viene a esta hora.
const [{ id: socio }] = (await db.query(`insert into public.socios (gimnasio_id, nombre, apellido, dni) values ($1, 'Habitual', $2, $3) returning id`, [gim, `Zeta${s5}`, DNI])).rows;
const [{ id: su }] = (await db.query(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio)
  select $1, $2, p.id, now() - interval '30 days' from public.planes p where p.gimnasio_id = $1 and p.nombre = 'Plan Full' returning id`, [gim, socio])).rows;
await db.query(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
  values ($1, $2, $3, now() - interval '10 days', now() + interval '20 days', 'cortesia', 'com-7')`, [gim, su, socio]);
for (const d of [1, 2, 3]) await db.query(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto)
  values ($1, $2, $3, now() - make_interval(days => $4), 'recepcion', 'entro', 'verde', 'al_dia', 'Al día')`, [gim, sede, socio, d]);
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 }); await d.waitForTimeout(500);
  const pie = d.locator('[data-pie="reglas"]');
  const guardar = async () => { const k = Number(await pie.getAttribute("data-respuestas")); await pie.locator('button:has-text("Guardar")').click();
    await d.waitForFunction((k) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > k, k, { timeout: 30000 }); };
  const tablet = d.locator("[data-accesos] label", { hasText: "Tablet en la puerta" }).locator("input");
  if (!(await tablet.isChecked())) { await tablet.click(); await guardar(); }
  const habituales = d.locator("label", { hasText: "Los habituales de esta hora" }).locator("input");
  if (!(await habituales.isChecked())) { await habituales.click(); await guardar(); }
  await d.locator('button:has-text("Autorizar una tablet")').click();
  const link = await d.locator("[data-link-tablet]").getAttribute("data-link-tablet", { timeout: 30000 });

  const t = await pagina(b, TABLET);
  t.setDefaultNavigationTimeout(120000);
  await t.goto(link);
  await t.locator('[data-kiosco="listo"]').waitFor({ timeout: 60000 });
  const boton = t.locator("[data-habituales] button", { hasText: `Habitual Z.` });
  chequear(await aparece(boton, 30000), "la tablet muestra a los habituales de esta hora: “Habitual Z.”", "no aparece el habitual");
  await capturar(t, "com7-tablet-habituales");
  await boton.first().click();
  for (const n of "999") await t.locator(`[aria-label="Teclado"] button:has-text("${n}")`).first().click();
  await t.locator('button[aria-label="Entrar"]').click();
  const res = t.locator("[data-kiosco-resultado]");
  await res.waitFor({ timeout: 30000 });
  chequear(await res.getAttribute("data-kiosco-resultado") === "error", "con otros números: “Probá de nuevo” (no entra)", `dio: ${await res.innerText()}`);
  await t.locator('[data-kiosco="listo"]').waitFor({ timeout: 15000 });
  await t.locator("[data-habituales] button", { hasText: "Habitual Z." }).first().click();
  for (const n of DNI.slice(-3)) await t.locator(`[aria-label="Teclado"] button:has-text("${n}")`).first().click();
  await t.locator('button[aria-label="Entrar"]').click();
  await res.waitFor({ timeout: 30000 });
  chequear(await res.getAttribute("data-kiosco-resultado") === "entro" && /¡Pasá, Habitual!/.test(await res.innerText()), "toca su nombre y los últimos 3 del DNI: “¡Pasá, Habitual!”", `dio: ${await res.innerText()}`);
  for (const p of [d, t]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.configuracion_gimnasio set kiosco_habituales = false where gimnasio_id = $1`, [gim]).catch(() => {});
  await db.query(`update public.socios set dado_de_baja_en = now(), motivo_baja = 'otro' where id = $1`, [socio]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
