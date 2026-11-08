#!/usr/bin/env node
// VD-44 · Equipo con foto, clases y horario: la dueña le sube la foto al profe, le marca qué clase da y
// su horario, lo tilda y prende "mostrar al equipo". Apagado, el socio no ve al profe en su clase;
// prendido, ve "Profe: Diego" con su foto. La clase de prueba y los datos se crean y se borran.
//   node scripts/e2e/vd-44.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { api, CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim, zona }] = (await db.query(`select id, zona_horaria as zona from public.gimnasios where slug = 'demo'`)).rows;
const [{ id: diego }] = (await db.query(`select id from public.equipo where gimnasio_id = $1 and nombre = 'Diego' and rol = 'profe'`, [gim])).rows;
const act = (await db.query(`select id, nombre from public.actividades where gimnasio_id = $1 and activa order by nombre limit 1`, [gim])).rows[0];
const sede = (await db.query(`select id from public.sedes where gimnasio_id = $1 and es_principal`, [gim])).rows[0].id;
const [{ id: clase, dia }] = (await db.query(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo, profe_id) values ($1,$2,$3, now() + interval '26 hours', now() + interval '27 hours', 10, $4)
  returning id, to_char((inicio at time zone $5)::date, 'YYYY-MM-DD') as dia`, [gim, sede, act.id, diego, zona])).rows;
const limpiar = async () => {
  for (const t of ["equipo_horario_trabajo", "equipo_actividades", "equipo_perfil", "equipo_ajustes"]) await db.query(`delete from public.${t} where gimnasio_id = $1`, [gim]);
};
await limpiar();
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/equipo`);
  const ficha = d.locator('[data-perfil="Diego"]');
  await ficha.waitFor({ timeout: 60000 });
  await ficha.getByRole("button", { name: "Editar" }).click();
  await ficha.locator('input[aria-label="Foto de Diego"]').setInputFiles({ name: "diego.png", mimeType: "image/png", buffer: PNG });
  await ficha.locator("[data-foto-equipo]").waitFor({ timeout: 60000 });
  ok("la dueña le sube la foto a Diego y se ve en su ficha");
  await ficha.locator(`[data-actividad="${act.nombre}"]`).check({ force: true });
  await ficha.getByRole("button", { name: "Sumar franja" }).click();
  await ficha.locator('[data-franja] input[aria-label="Desde"]').fill("09:00");
  await ficha.locator('[data-franja] input[aria-label="Hasta"]').fill("13:00");
  await ficha.locator("[data-mostrar-persona]").check();
  await ficha.getByRole("button", { name: "Guardar", exact: true }).click();
  await ficha.getByRole("status").waitFor({ timeout: 30000 });
  const [{ n }] = (await db.query(`select (select count(*) from public.equipo_actividades where equipo_id = $1) + (select count(*) from public.equipo_horario_trabajo where equipo_id = $1) as n`, [diego])).rows;
  chequear(Number(n) === 2, "se guardan la clase que da y su horario de trabajo", `hay ${n} filas`);
  await capturar(d, "vd44-compu-equipo");

  // Apagado: el socio no ve al profe con su foto (ni la foto sin permiso).
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app/clases?dia=${dia}`);
  await s.locator("main h1, h1").first().waitFor({ timeout: 60000 });
  await s.waitForLoadState("networkidle").catch(() => {});
  chequear((await s.locator("[data-profe-clase]").count()) === 0, "con la opción apagada, el socio no ve al profe con foto", "aparece el profe");
  const sin = await api(s.context(), "GET", `/foto-equipo/${diego}`);
  chequear(sin.status() === 204, "la foto sin permiso no se sirve (204)", `devolvió ${sin.status()}`);

  // Prendido.
  await d.locator("[data-mostrar-equipo]").check();
  for (let i = 0; i < 40; i++) {
    if ((await db.query(`select 1 from public.equipo_ajustes where gimnasio_id = $1 and mostrar_en_pagina_y_app`, [gim])).rowCount) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  await s.goto(`${G}/app/clases?dia=${dia}`);
  const profe = s.locator('[data-profe-clase="Diego"]').first();
  await profe.waitFor({ timeout: 60000 });
  chequear((await profe.innerText()).includes("Profe: Diego"), "prendido, el socio ve “Profe: Diego” en la clase", await profe.innerText());
  const img = profe.locator("img");
  await img.waitFor({ timeout: 30000 });
  await s.waitForFunction((el) => el.complete && el.naturalWidth > 0, await img.elementHandle(), { timeout: 30000 });
  ok("…con su foto");
  await capturar(s, "vd44-celu-clase-con-profe");
  const ancho = await s.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= 391, "celular 390 px sin desborde", `scrollWidth ${ancho}`);

  // La página pública (si el gimnasio la tiene publicada).
  const [{ publicada }] = (await db.query(`select coalesce(bool_or(publicada), false) as publicada from public.landing_gimnasio where gimnasio_id = $1`, [gim])).rows;
  if (publicada) {
    const p = await pagina(b, COMPU);
    await p.goto(G, { waitUntil: "domcontentloaded" });
    const hay = await aparece(p.locator('[data-persona-equipo="Diego"]'), 60000);
    chequear(hay, "la página del gimnasio muestra a Diego", "no aparece en la página (la cache de la landing tarda hasta 60 s)");
  } else ok("la página no está publicada en el demo: se probó en las pruebas de la base");

  // Destildar lo oculta al instante.
  await ficha.locator("[data-mostrar-persona]").uncheck();
  await ficha.getByRole("button", { name: "Guardar", exact: true }).click();
  for (let i = 0; i < 40; i++) {
    if ((await db.query(`select 1 from public.equipo_perfil where equipo_id = $1 and not mostrar`, [diego])).rowCount) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  await s.goto(`${G}/app/clases?dia=${dia}`);
  await s.locator("h1").first().waitFor({ timeout: 60000 });
  await s.waitForLoadState("networkidle").catch(() => {});
  chequear((await s.locator("[data-profe-clase]").count()) === 0, "destildado, deja de verse al instante", "sigue apareciendo");
  for (const p of [d, s]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await limpiar();
  await db.query(`delete from public.clases where id = $1`, [clase]);
  await db.end();
}
await b.close();
resultado();
