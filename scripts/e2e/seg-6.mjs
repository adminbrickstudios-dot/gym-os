#!/usr/bin/env node
// SEG-6 · Datos personales: el socio descarga sus datos desde "Mi membresía";
// la dueña borra los de un ex socio (escribiendo BORRAR) y la ficha queda como
// "Socio borrado".
//   npm run e2e:seg-6            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const [{ id: ex }] = (await db.query(`insert into public.socios (gimnasio_id, nombre, apellido, dni, dado_de_baja_en, motivo_baja) values ($1,'Ex','Socio E2e', $2, now(), 'mudanza') returning id`,
  [gim, String(Date.now()).slice(-8)])).rows;
const b = await navegador();
try {
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app/cuenta`);
  const [descarga] = await Promise.all([s.waitForEvent("download", { timeout: 60000 }), s.locator("[data-mis-datos]").click()]);
  const datos = JSON.parse(readFileSync(await descarga.path(), "utf8"));
  chequear(datos.socio?.apellido === "Al Día" && Array.isArray(datos.pagos) && Array.isArray(datos.entradas),
    `el socio baja mis-datos.json (sus datos, ${datos.pagos?.length} pagos, ${datos.entradas?.length} entradas)`, JSON.stringify(datos).slice(0, 200));

  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios/${ex}`);
  await d.getByRole("button", { name: /Borrar sus datos personales/ }).click();
  await d.getByLabel("Escribí BORRAR para confirmar").fill("BORRAR");
  await d.getByRole("button", { name: "Borrar sus datos" }).click();
  await d.getByText(/borrado #\d+/).first().waitFor({ timeout: 30000 });
  const [x] = (await db.query(`select dni from public.socios where id = $1`, [ex])).rows;
  chequear(x.dni === null, "la dueña borra los datos del ex socio: la ficha queda “Socio borrado #N” y sin DNI", JSON.stringify(x));
  for (const p of [s, d]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.end();
}
await b.close();
resultado();
