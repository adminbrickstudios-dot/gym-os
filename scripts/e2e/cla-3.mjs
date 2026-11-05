#!/usr/bin/env node
// CLA-3 · Cancelar una clase avisando: la recepción la cancela con motivo;
// el anotado aparece en "Avisos de hoy" con el mensaje "Clase cancelada" ya
// escrito y en la campana de su app. La clase de prueba se crea y se borra.
//   npm run e2e:cla-3            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ gimnasio_id: gim, socio_id: socio }] = (await db.query(`select s.gimnasio_id, s.id as socio_id from public.socios s join public.gimnasios g on g.id = s.gimnasio_id
  where g.slug = 'demo' and s.nombre = 'Testigo' and s.apellido = 'Al Día'`)).rows;
const act = (await db.query(`select id from public.actividades where gimnasio_id = $1 and activa limit 1`, [gim])).rows[0].id;
const sede = (await db.query(`select id from public.sedes where gimnasio_id = $1 and es_principal`, [gim])).rows[0].id;
const clase = (await db.query(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, cupo) values ($1,$2,$3, now() + interval '2 days', now() + interval '2 days 1 hour', 10) returning id`, [gim, sede, act])).rows[0].id;
await db.query(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [gim, clase, socio]);
const b = await navegador();
try {
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/clases/${clase}`);
  await r.locator("main h1").waitFor({ timeout: 60000 });
  await r.getByRole("button", { name: /Cancelar esta clase/ }).click();
  await r.getByPlaceholder(/el profe está enfermo/).fill("Se corta la luz (e2e)");
  await r.getByRole("button", { name: "Cancelar la clase" }).click();
  await r.getByText(/Cancelada: Se corta la luz/).first().waitFor({ timeout: 30000 });
  ok("la recepción cancela la clase con motivo");
  await r.goto(`${G}/panel/avisos`);
  const grupo = r.locator('[data-grupo-avisos="clase_cancelada"]');
  await grupo.waitFor({ timeout: 60000 });
  const fila = grupo.locator("li", { hasText: "Testigo Al Día" }).first();
  chequear(/se canceló .+ \(Se corta la luz \(e2e\)\)/.test(await fila.innerText()), "Avisos de hoy → ❌ Clase cancelada: “Testigo Al Día”, con el mensaje ya escrito", await fila.innerText());
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);

  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app/novedades`);
  await s.getByText(/Se canceló .+ del \d\d\/\d\d/).first().waitFor({ timeout: 60000 });
  ok("el socio lo ve en 🔔 Novedades de su app");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`delete from public.avisos_enviados where referencia = $1`, [clase]);
  await db.query(`delete from public.envios_push where referencia = $1`, [clase]).catch(() => {});
  await db.query(`delete from public.avisos_pendientes where clase_id = $1`, [clase]);
  await db.query(`delete from public.reservas where clase_id = $1`, [clase]);
  await db.query(`delete from public.clases where id = $1`, [clase]);
  await db.end();
}
await b.close();
resultado();
