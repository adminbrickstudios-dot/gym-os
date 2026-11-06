#!/usr/bin/env node
// VD-46Q · Perdonar una falta con motivo: el socio que faltó queda bloqueado para reservar; la dueña perdona la
// falta desde la lista de la clase (motivo obligatorio, sin datos de salud) y el bloqueo se va; queda en la ficha.
// La recepción no ve el botón.
//   node scripts/e2e/vd-46q.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
let gim, politicaAntes, desdeAntes;
try {
  const g = (await db.query(`select s.gimnasio_id, s.id as socio_id from public.socios s join public.gimnasios g on g.id = s.gimnasio_id
    where g.slug = 'demo' and s.nombre = 'Testigo' and s.apellido = 'Al Día'`)).rows[0];
  gim = g.gimnasio_id; const socio = g.socio_id;
  ({ falta_politica: politicaAntes, falta_politica_desde: desdeAntes } = (await db.query(`select falta_politica, falta_politica_desde from public.configuracion_gimnasio where gimnasio_id = $1`, [gim])).rows[0]);
  const act = (await db.query(`select id from public.actividades where gimnasio_id = $1 limit 1`, [gim])).rows[0].id;
  const sede = (await db.query(`select id from public.sedes where gimnasio_id = $1 and es_principal`, [gim])).rows[0].id;
  await db.query(`update public.configuracion_gimnasio set falta_politica = 'bloquear', falta_bloqueo_dias = 2 where gimnasio_id = $1`, [gim]);
  await db.query(`update public.configuracion_gimnasio set falta_politica_desde = now() - interval '1 day' where gimnasio_id = $1`, [gim]);
  const clase = (await db.query(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin) values ($1,$2,$3, now() - interval '50 minutes', now() - interval '5 minutes') returning id`, [gim, sede, act])).rows[0].id;
  await db.query(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [gim, clase, socio]);

  // La recepción: ve la clase pero no el botón.
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/clases/${clase}`);
  await r.locator("h1").waitFor({ timeout: 30000 });
  chequear(await r.locator("[data-perdonar-falta]").count() === 0, "la recepción no ve “Perdonar falta”", "la recepción ve “Perdonar falta”");

  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios/${socio}?pestana=asistencia`);
  await d.locator("[data-bloqueo-reservas]").waitFor({ timeout: 60000 });
  chequear(true, "en la ficha: el socio está bloqueado para reservar", "");

  await d.goto(`${G}/panel/clases/${clase}`);
  await d.locator("[data-perdonar-falta]").first().click();
  await d.locator("input[aria-label^='Motivo para perdonar']").fill("me duele la rodilla");
  chequear(await d.locator("[data-confirmar-perdon]").isDisabled(), "un dato de salud en el motivo frena el perdón", "dejó perdonar con un dato de salud");
  await d.locator("input[aria-label^='Motivo para perdonar']").fill(`Avisó por teléfono ${s5}`);
  await d.locator("[data-confirmar-perdon]").click();
  await d.locator("[data-falta-perdonada]").first().waitFor({ timeout: 30000 });
  chequear(true, "la lista muestra “Falta perdonada” con el motivo", "");

  await d.goto(`${G}/panel/socios/${socio}?pestana=asistencia`);
  await d.locator(`[data-faltas-perdonadas] li:has-text("Avisó por teléfono ${s5}")`).waitFor({ timeout: 60000 });
  chequear(await d.locator("[data-bloqueo-reservas]").count() === 0, "el bloqueo de reservas se fue y el perdón queda en la ficha", "sigue el bloqueo");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  if (gim) await db.query(`update public.configuracion_gimnasio set falta_politica = $2, falta_politica_desde = $3 where gimnasio_id = $1`, [gim, politicaAntes ?? "nada", desdeAntes]);
  await db.end();
}
await b.close();
resultado();
