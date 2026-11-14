#!/usr/bin/env node
// L1 · Cómo queda la página de Temple Gym con el diseño nuevo, en un clon [demo] LOCAL armado con lo que Temple Gym muestra hoy en su página pública
// (nombre, colores, frase, 4 planes, sin dirección, sin WhatsApp, altas apagadas: leído con la función pública `landing_publica`, solo lectura).
// No toca ni un dato de Temple Gym: solo saca capturas de un gimnasio de la base local.
//   node scripts/e2e/clon-temple-l1.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, chequear, falla, navegador, pagina, resultado, PUERTO } from "./comun.mjs";

const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url });
await db.connect();
const slug = `clon-${Date.now() % 1000000}`;
const host = `a-${slug}.localhost`;
const DIR = `http://${host}:${PUERTO}`;
const CELU = { width: 390, height: 844 };

const [{ id: gim }] = (await db.query(`insert into public.gimnasios (slug, nombre) values ($1, 'templegym') returning id`, [slug])).rows;
await db.query(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'subdominio') on conflict do nothing`, [gim, host]);
await db.query(`update public.configuracion_gimnasio set color_acento = '#16a34a', color_fondo = '#faf7f0' where gimnasio_id = $1`, [gim]);
for (const [nombre, precio] of [["Mensual libre", 39000], ["Pase diario", 11000], ["plan 3 dias", 29000], ["plan 4 dias", 34000]]) {
  const [{ id }] = (await db.query(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1, 'membresia', $2, 1, 'continua') returning id`, [gim, nombre])).rows;
  await db.query(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1, $2, $3, '2020-01-01T00:00:00Z')`, [gim, id, precio]);
}
const b = await navegador();
try {
  const p = await pagina(b, CELU);
  await p.goto(`${DIR}/`);
  await p.locator("[data-primer-pantallazo]").waitFor({ timeout: 60000 });
  chequear((await p.locator("h1").first().innerText()).trim() === "templegym", "Temple Gym (clon): el nombre es el título", "el título no es el nombre");
  chequear(await p.locator("[data-ya-soy-socio]").count() === 1 && await p.locator("[data-quiero-ser-socio]").count() === 0, "Temple Gym (clon): con las altas apagadas solo “Ya soy socio, entrar”", "los botones no son los esperados");
  await p.screenshot({ path: ".local/capturas/clon-temple-celu.png" }).catch(() => {});
  await p.screenshot({ path: ".local/capturas/clon-temple-celu-completa.png", fullPage: true }).catch(() => {});
  const c = await pagina(b, COMPU);
  await c.goto(`${DIR}/`);
  await c.locator("[data-primer-pantallazo]").waitFor({ timeout: 60000 });
  await c.screenshot({ path: ".local/capturas/clon-temple-compu.png" }).catch(() => {});
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.stack : e.message.split("\n")[0]}`);
}
await db.query(`delete from public.dominios_gimnasio where host = $1`, [host]).catch(() => {});
await db.end();
await b.close();
resultado();
