#!/usr/bin/env node
// COM-2 · El primer mes del socio nuevo: uno que se anotó hace 8 días y vino
// una vez → la ficha dice "Día 9 de 30 · 1 entrada (meta 8)", Avisos de hoy
// tiene "🌱 Primera semana" con su WhatsApp, y Retención lo pone En riesgo.
// La meta se cambia en Configuración → Reglas.
//   npm run e2e:com-2            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const [{ id: gim, sede }] = (await db.query(`select g.id, (select s.id from public.sedes s where s.gimnasio_id = g.id and s.es_principal) sede from public.gimnasios g where g.slug = 'demo'`)).rows;
const s5 = Date.now().toString().slice(-5);
const [{ id: socio }] = (await db.query(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1, 'Nuevita', $2) returning id`, [gim, `Mes${s5}`])).rows;
const [{ id: su }] = (await db.query(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio)
  select $1, $2, p.id, now() - interval '8 days' from public.planes p where p.gimnasio_id = $1 and p.nombre = 'Plan Full' returning id`, [gim, socio])).rows;
await db.query(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
  values ($1, $2, $3, now() - interval '8 days', now() + interval '22 days', 'cortesia', 'com-2')`, [gim, su, socio]);
await db.query(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto)
  values ($1, $2, $3, now() - interval '7 days', 'recepcion', 'entro', 'verde', 'al_dia', 'Al día')`, [gim, sede, socio]);
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios/${socio}`);
  const pm = d.locator("[data-primer-mes]");
  chequear(await aparece(pm, 60000) && /Día 9 de 30 · 1 entrada \(meta \d+\)/.test(await pm.innerText()), `la ficha: “${(await pm.innerText().catch(() => "")).trim()}”`, `la ficha no muestra el primer mes: ${await pm.innerText().catch(() => "nada")}`);
  chequear(/Primera semana: vino 1 vez/.test(await d.locator("[data-riesgo-ficha]").innerText().catch(() => "")), "y avisa el riesgo: “Primera semana: vino 1 vez”", "la ficha no marca la primera semana floja");
  await capturar(d, "com2-compu-ficha");

  await d.goto(`${G}/panel/avisos`);
  await d.locator("main h1").waitFor({ timeout: 60000 });
  const grupo = d.locator('[data-grupo-avisos="primera_semana"]');
  chequear(await aparece(grupo.getByText(`Nuevita Mes${s5}`), 30000) && await grupo.locator('a[href*="wa.me"]').count() > 0,
    "Avisos de hoy: “🌱 Primera semana” con su WhatsApp", "no aparece en Avisos de hoy");

  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 });
  const campo = d.locator("fieldset[data-pestana-activa] label", { hasText: "Meta del primer mes" }).locator("input");
  const antes = await campo.inputValue();
  await campo.fill("12");
  const pie = d.locator('[data-pie="reglas"]'); const k = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await d.waitForFunction((k) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > k, k, { timeout: 30000 });
  await d.goto(`${G}/panel/socios/${socio}`);
  chequear(/meta 12/.test(await d.locator("[data-primer-mes]").innerText()), "la meta se cambia en Configuración → Reglas (12) y la ficha la usa", "la meta no cambió");
  await db.query(`update public.configuracion_gimnasio set meta_primer_mes = $2 where gimnasio_id = $1`, [gim, Number(antes) || 8]);
  if (d.errores.length) falla(d.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.socios set dado_de_baja_en = now(), motivo_baja = 'otro' where id = $1`, [socio]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
