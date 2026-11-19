#!/usr/bin/env node
// Paneles completos · "Clase ajena" del profe por profe_id y no por el nombre: otro integrante del equipo con el MISMO nombre que el profe
// (Diego) da una clase hoy; para el profe tiene que verse como ajena (sin abrirse). Su propia clase se abre. En el demo; deja todo como estaba.
//   node scripts/e2e/clase-ajena-profe-id.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ g, sede, act, profe }] = (await db.query(`
  select g.id g, (select id from public.sedes where gimnasio_id = g.id order by id limit 1) sede,
         (select id from public.actividades where gimnasio_id = g.id order by id limit 1) act,
         (select id from public.equipo where gimnasio_id = g.id and rol = 'profe' and nombre = 'Diego') profe
    from public.gimnasios g where g.slug = 'demo'`)).rows;
const [{ otro, nombreOtro }] = (await db.query(`select id otro, nombre "nombreOtro" from public.equipo where gimnasio_id = $1 and rol = 'recepcion' order by id limit 1`, [g])).rows;
const b = await navegador();
let propia, ajena;
try {
  await db.query(`update public.equipo set nombre = 'Diego' where id = $1`, [otro]);   // mismo nombre que el profe
  const mk = async (profeId, desde) => (await db.query(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, profe_id, cupo)
    values ($1,$2,$3, now() + $4::interval, now() + $4::interval + interval '1 hour', $5, 10) returning id`, [g, sede, act, desde, profeId])).rows[0].id;
  propia = await mk(profe, "0 minutes");
  ajena = await mk(otro, "5 minutes");
  const p = await pagina(b, CELU);
  await entrar(p, "profe@ejemplo.invalid");
  await p.goto(`${G}/panel/clases`);
  await p.locator("main ul li").first().waitFor({ timeout: 60000 });
  const hayAjenas = await p.locator("[data-clase-ajena]").count();
  chequear(hayAjenas >= 1, `la clase del otro Diego se ve como ajena (${hayAjenas})`, "con el mismo nombre, la clase ajena se abre como si fuera del profe");
  const enlaces = await p.locator(`main a[href*="/panel/clases/${propia}"]`).count();
  const enlacesAjena = await p.locator(`main a[href*="/panel/clases/${ajena}"]`).count();
  chequear(enlaces >= 1, "su propia clase se abre", "su propia clase no se abre");
  chequear(enlacesAjena === 0, "la clase ajena no tiene enlace", "la clase ajena tiene enlace");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  for (const id of [propia, ajena]) if (id) await db.query(`delete from public.clases where id = $1`, [id]).catch(() => {});
  await db.query(`update public.equipo set nombre = $2 where id = $1`, [otro, nombreOtro]);
  await db.end();
}
await b.close();
resultado();
