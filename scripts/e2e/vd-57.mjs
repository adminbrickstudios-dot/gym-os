#!/usr/bin/env node
// VD-57 · Día cerrado suma al vencimiento (regla del gimnasio): en Configuración → Reglas el dueño elige "No suma días" /
// "Suma los días cerrados"; al cargar un cierre el equipo ve primero "esto corre el vencimiento de N socios N días" (o "no corre
// ningún vencimiento") y confirma; el vencimiento del socio testigo se corre de verdad; la recepción no ve la regla.
//   npm run e2e:vd-57            (con scripts/local/levantar.sh corriendo; una corrida por base nueva)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const b = await navegador();
const [{ g, socio }] = (await db.query(`select g.id g,
  (select s.id from public.socios s join auth.users u on u.id = s.usuario_id where s.gimnasio_id = g.id and u.email = 'socio@ejemplo.invalid') socio
  from public.gimnasios g where g.slug = 'demo'`)).rows;
// Un feriado dentro de 20 a 22 días (3 días), lejos de otros cierres.
const dia = async (n) => (await db.query(`select to_char((now() at time zone 'America/Argentina/Buenos_Aires')::date + $1::int, 'YYYY-MM-DD') d`, [n])).rows[0].d;
const [desde, hasta] = [await dia(20), await dia(22)];
const vence = async () => (await db.query(`select max(c.hasta) h from public.coberturas c where c.socio_id = $1 and c.anulada_en is null`, [socio])).rows[0].h?.toISOString();
const cargarCierre = async (d, motivo) => {
  await d.goto(`${G}/panel/configuracion?pestana=horarios`);
  const cierres = d.locator("[data-cierres]");
  await cierres.waitFor({ timeout: 30000 });
  await d.locator('[data-cierres][data-listo="true"]').waitFor({ timeout: 30000 });
  await cierres.locator('label:has-text("Desde") input').fill(desde);
  await cierres.locator('label:has-text("Hasta") input').fill(hasta);
  await cierres.locator('label:has-text("Motivo") input').fill(motivo);
  await cierres.locator("[data-revisar-cierre]").click();
  const previo = cierres.locator("[data-previo-cierre]");
  await previo.waitFor({ timeout: 30000 });
  return { cierres, previo };
};
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");

  // ── Por defecto: no suma ──
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  const regla = d.locator("[data-regla-cierres]");
  await regla.waitFor({ timeout: 30000 });
  await d.locator('[data-regla-cierres="no-suma"]').waitFor({ timeout: 30000 });
  ok("la regla de días cerrados arranca en “No suma días”");
  // El socio testigo tiene que estar cubierto en los días del cierre: se le suma una cortesía de 40 días desde hoy (si no, la regla no tiene a quién correr).
  await db.query(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
    select su.gimnasio_id, su.id, su.socio_id, privado.medianoche(((now() at time zone $2)::date), $2), privado.medianoche(((now() at time zone $2)::date) + 40, $2), 'cortesia', 'e2e vd-57'
      from public.suscripciones su where su.socio_id = $1 and su.baja_en is null limit 1`, [socio, "America/Argentina/Buenos_Aires"]);
  const antes = await vence();
  let { cierres, previo } = await cargarCierre(d, "Feriado e2e 1");
  chequear((await previo.locator("[data-previo-texto]").innerText()).includes("no corre ningún vencimiento"), "con “no suma” el aviso dice que no corre ningún vencimiento", "el aviso no dice que no corre vencimientos");
  await cierres.locator("[data-confirmar-cierre]").click();
  await cierres.locator(".mensaje", { hasText: "Listo: cerrado" }).waitFor({ timeout: 30000 });
  chequear(await vence() === antes, "cargar el cierre no movió el vencimiento del socio", "el vencimiento se movió con la regla en no suma");
  // Anular ese cierre para probar el siguiente en las mismas fechas.
  await cierres.locator(`[data-cierre-panel="${desde}"] button:has-text("Anular")`).click();
  await cierres.locator('input[aria-label="Motivo de la anulación"]').fill("prueba");
  await cierres.locator('button:has-text("Anular cierre")').click();
  await cierres.locator(".mensaje", { hasText: "Cierre anulado" }).waitFor({ timeout: 30000 });

  // ── El dueño cambia la regla ──
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('[data-regla-opcion="suma"]').click();
  await d.locator('[data-regla-cierres="suma"]').waitFor({ timeout: 30000 });
  ok("el dueño elige “Suma los días cerrados”");
  await capturar(d, "vd57-compu-regla", true);

  // ── Con la regla en suma: el aviso cuenta a cuántos y el vencimiento se corre 3 días ──
  ({ cierres, previo } = await cargarCierre(d, "Feriado e2e 2"));
  const aviso = (await previo.locator("[data-previo-texto]").innerText()).replace(/\s+/g, " ");
  chequear(/corre el vencimiento de \d+ socios? 3 días/.test(aviso), `el aviso previo dice “${aviso}”`, `el aviso previo dice “${aviso}” (se esperaba “corre el vencimiento de N socios 3 días”)`);
  await capturar(d, "vd57-compu-aviso", true);
  await cierres.locator("[data-confirmar-cierre]").click();
  await cierres.locator(".mensaje", { hasText: "Listo: cerrado" }).waitFor({ timeout: 30000 });
  const despues = await vence();
  chequear(despues != null && antes != null && new Date(despues).getTime() > new Date(antes).getTime(), "con “suma” el vencimiento del socio se corrió", "con la regla en suma el vencimiento no se movió");
  chequear(await cierres.locator(`[data-cierre-panel="${desde}"]`, { hasText: "Devuelve los días" }).count() === 1, "el cierre figura “Devuelve los días”", "el cierre no figura como que devuelve días");
  await cierres.locator(`[data-cierre-panel="${desde}"] button:has-text("Anular")`).click();
  await cierres.locator('input[aria-label="Motivo de la anulación"]').fill("fin de la prueba");
  await cierres.locator('button:has-text("Anular cierre")').click();
  await cierres.locator(".mensaje", { hasText: "Cierre anulado" }).waitFor({ timeout: 30000 });
  chequear(await vence() === antes, "anular el cierre devuelve el vencimiento original", "anular el cierre no devolvió el vencimiento");
  // Dejar la regla como estaba.
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('[data-regla-opcion="no-suma"]').click();
  await d.locator('[data-regla-cierres="no-suma"]').waitFor({ timeout: 30000 });

  // ── Quién la ve ──
  const rc = await pagina(b, COMPU);
  await entrar(rc, "recepcion@ejemplo.invalid");
  await rc.goto(`${G}/panel/configuracion`);
  chequear(/No tenés acceso|Tu rol no tiene acceso|Sin permiso|no tiene acceso/i.test(await rc.locator("main").innerText()), "la recepción no abre Configuración", "la recepción pudo abrir Configuración");

  // ── Celular ──
  const cel = await pagina(b, CELU);
  await entrar(cel, "duena@ejemplo.invalid");
  await cel.goto(`${G}/panel/configuracion?pestana=reglas`);
  await cel.locator("[data-regla-cierres]").waitFor({ timeout: 30000 });
  chequear(await cel.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "celular: la regla sin desborde", "celular: la regla se desborda");
  await capturar(cel, "vd57-celu-regla", true);
  void g;
} catch (e) { falla(`se cortó: ${e.message.split("\n")[0]}`); }
finally { await b.close(); await db.end(); resultado(); }
