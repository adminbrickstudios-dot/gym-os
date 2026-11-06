#!/usr/bin/env node
// VD-2b · El veredicto de la Entrada muestra el chip "Tiene clase hoy a las HH:MM" cuando el socio
// reservó una clase para hoy (la reserva se crea directo en la base, como hace cla-1).
//   node scripts/e2e/vd-2b.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const b = await navegador();
const [{ gimnasio_id: gim, socio_id: socio }] = (await db.query(`select s.gimnasio_id, s.id as socio_id from public.socios s join public.gimnasios g on g.id = s.gimnasio_id
  where g.slug = 'demo' and s.nombre = 'Testigo' and s.apellido = 'Al Día'`)).rows;
let clase;
try {
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios`);
  await r.locator('main ul a[href^="/panel/socios/"]').first().waitFor({ timeout: 30000 });

  // Sin reserva de hoy: no hay chip.
  await r.keyboard.press("F2");
  await r.locator("[data-ventana-campo]").fill("Testigo Al");
  await r.locator("button.fila", { hasText: "Al Día" }).first().click();
  await r.locator("[data-ventana-veredicto]").waitFor({ timeout: 30000 });
  chequear(await r.locator('[data-chip="clase_hoy"]').count() === 0, "sin reserva de hoy no aparece “Tiene clase hoy”", "aparece el chip sin reserva");
  await r.keyboard.press("Escape");

  // Con una reserva de hoy: el chip dice a qué hora.
  const act = (await db.query(`select id from public.actividades where gimnasio_id = $1 limit 1`, [gim])).rows[0].id;
  const sede = (await db.query(`select id from public.sedes where gimnasio_id = $1 and es_principal`, [gim])).rows[0].id;
  clase = (await db.query(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin) values ($1,$2,$3, now() - interval '5 minutes', now() + interval '55 minutes') returning id`, [gim, sede, act])).rows[0].id;
  await db.query(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [gim, clase, socio]);
  await r.keyboard.press("F2");
  await r.locator("[data-ventana-campo]").fill("Testigo Al");
  await r.locator("button.fila", { hasText: "Al Día" }).first().click();
  const chip = r.locator('[data-chip="clase_hoy"]');
  await chip.waitFor({ timeout: 30000 });
  chequear(/Tiene clase hoy a las \d{2}:\d{2}/.test(await chip.innerText()), `con una reserva de hoy el veredicto dice “${(await chip.innerText()).trim()}”`, "el chip no dice la hora");
  await capturar(r, "vd2b-compu-clase-hoy");
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  if (clase) { await db.query(`delete from public.reservas where clase_id = $1`, [clase]); await db.query(`delete from public.clases where id = $1`, [clase]); }
  await db.end();
}
await b.close();
resultado();
