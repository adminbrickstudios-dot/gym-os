#!/usr/bin/env node
// CLA-4 · WOD: la dueña escribe qué se hace en la clase; el anotado lo ve en
// su app debajo de la reserva. La clase de prueba se crea y se borra.
//   npm run e2e:cla-4            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ gimnasio_id: gim, socio_id: socio, zona }] = (await db.query(`select s.gimnasio_id, s.id as socio_id, g.zona_horaria as zona from public.socios s join public.gimnasios g on g.id = s.gimnasio_id
  where g.slug = 'demo' and s.nombre = 'Testigo' and s.apellido = 'Al Día'`)).rows;
const act = (await db.query(`select id from public.actividades where gimnasio_id = $1 and activa limit 1`, [gim])).rows[0].id;
const sede = (await db.query(`select id from public.sedes where gimnasio_id = $1 and es_principal`, [gim])).rows[0].id;
const [{ id: clase, dia }] = (await db.query(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo) values ($1,$2,$3, now() + interval '26 hours', now() + interval '27 hours', 10)
  returning id, to_char((inicio at time zone $4)::date, 'YYYY-MM-DD') as dia`, [gim, sede, act, zona])).rows;
await db.query(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [gim, clase, socio]);
const WOD = "Calentamiento 10′ · 5 rondas: 10 burpees, 15 sentadillas";
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/clases/${clase}`);
  const w = d.locator("[data-wod]");
  await w.waitFor({ timeout: 60000 });
  await w.getByLabel("WOD de la clase").fill(WOD);
  await w.getByRole("button", { name: "Guardar WOD" }).click();
  await w.getByRole("status").waitFor({ timeout: 30000 });
  ok("la dueña escribe el WOD en la clase");
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app/clases?dia=${dia}`);
  const visto = s.locator("[data-wod-socio]").first();
  await visto.waitFor({ timeout: 60000 });
  chequear((await visto.innerText()).includes("5 rondas"), "el anotado lo ve en su app, debajo de la reserva", await visto.innerText());
  if (d.errores.length + s.errores.length) falla(`${[...d.errores, ...s.errores].join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`delete from public.reservas where clase_id = $1`, [clase]);
  await db.query(`delete from public.clases where id = $1`, [clase]);
  await db.end();
}
await b.close();
resultado();
