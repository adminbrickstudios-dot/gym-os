#!/usr/bin/env node
// VD-46K · Reemplazar al profe en UNA sola clase, con motivo: la dueña pone a otro profe en la clase de hoy;
// el profe anterior deja de ver la lista; el nuevo la ve; las otras clases no cambian; queda el historial.
//   node scripts/e2e/vd-46k.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
let clase, otra, nuevoProfe;
try {
  const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
  const act = (await db.query(`select id from public.actividades where gimnasio_id = $1 limit 1`, [gim])).rows[0].id;
  const sede = (await db.query(`select id from public.sedes where gimnasio_id = $1 and es_principal`, [gim])).rows[0].id;
  const diego = (await db.query(`select e.id from public.equipo e join auth.users u on u.id = e.usuario_id where e.gimnasio_id = $1 and u.email = 'profe@ejemplo.invalid'`, [gim])).rows[0].id;
  nuevoProfe = (await db.query(`insert into public.equipo (gimnasio_id, nombre, rol) values ($1, $2, 'profe') returning id`, [gim, `Reemplazo ${s5}`])).rows[0].id;
  const nueva = async (desde, hasta) => (await db.query(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, profe_id)
    values ($1,$2,$3, now() + $4::interval, now() + $5::interval, $6) returning id`, [gim, sede, act, desde, hasta, diego])).rows[0].id;
  clase = await nueva("-10 minutes", "50 minutes");
  otra = await nueva("1 day", "1 day 1 hour");

  const p = await pagina(b, COMPU);
  await entrar(p, "profe@ejemplo.invalid");
  await p.goto(`${G}/panel/clases/${clase}`);
  await p.locator("h1").waitFor({ timeout: 30000 });
  chequear(await p.locator("[data-reemplazar-profe]").count() === 0, "el profe no ve el cambio de profe", "el profe ve el cambio de profe");

  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/clases/${clase}`);
  await d.locator("[data-reemplazo-abrir]").click();
  await d.locator("[data-reemplazo-profe]").selectOption({ label: `Reemplazo ${s5}` });
  await d.locator("[data-reemplazo-motivo]").fill("operado de rodilla");
  chequear(await d.locator("[data-reemplazo-guardar]").isDisabled(), "un dato de salud en el motivo frena el cambio", "dejó guardar un dato de salud");
  await d.locator("[data-reemplazo-motivo]").fill(`Diego no puede venir ${s5}`);
  await d.locator("[data-reemplazo-guardar]").click();
  await d.locator("[data-reemplazo-listo]").waitFor({ timeout: 30000 });
  const [{ profe_id: en }] = (await db.query(`select profe_id from public.clases where id = $1`, [clase])).rows;
  chequear(en === nuevoProfe, "la clase quedó con el profe nuevo", "la clase no cambió de profe");
  const [{ profe_id: enOtra }] = (await db.query(`select profe_id from public.clases where id = $1`, [otra])).rows;
  chequear(enOtra === diego, "la otra clase de Diego no cambió", "se cambió otra clase");
  chequear(await d.locator(`[data-reemplazos] li:has-text("Diego no puede venir ${s5}")`).count() === 1, "queda el historial con el motivo", "sin historial");

  // Diego ya no ve la lista de esa clase.
  await p.goto(`${G}/panel/clases/${clase}`);
  const bloqueado = await p.getByText(/Solo podés ver la lista de tus clases/).first().waitFor({ timeout: 30000 }).then(() => true, () => false);
  chequear(bloqueado, "el profe anterior ya no ve la lista de esa clase", "el profe anterior sigue viendo la lista");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.end();   // los reemplazos quedan escritos (la base no los borra): es dato de prueba del demo local
}
await b.close();
resultado();
