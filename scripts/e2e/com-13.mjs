#!/usr/bin/env node
// COM-13 · Grados: la dueña entra por Clases → 🥋 Grados y arma dos grados en
// una actividad (Blanco sin requisitos, Amarillo con 1 clase) → el socio con
// clases en esa actividad aparece "listo para rendir" → el profe le da el
// Blanco → la app del socio dice su grado. Deja todo como estaba.
//   npm run e2e:com-13           (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const s = Date.now().toString().slice(-4);
const BLANCO = `Blanco ${s}`, AMARILLO = `Amarillo ${s}`;
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const [{ id: socio, nombre }] = (await db.query(`select s.id, trim(s.nombre || ' ' || coalesce(s.apellido, '')) nombre from public.socios s join auth.users u on u.id = s.usuario_id
  where s.gimnasio_id = $1 and u.email = 'socio@ejemplo.invalid'`, [gim])).rows;
// Una actividad sin grados con una clase que ya pasó: el socio fue.
let [clase] = (await db.query(`select c.id, c.actividad_id, a.nombre actividad from public.clases c join public.actividades a on a.id = c.actividad_id
 where c.gimnasio_id = $1 and c.inicio < now() - interval '2 hours' and c.cancelada_en is null and a.activa
   and not exists (select 1 from public.grados g where g.actividad_id = a.id and g.activo)
 order by c.inicio desc limit 1`, [gim])).rows;
// De madrugada todavía no pasó ninguna clase del día: se crea una de hace 3 horas en una actividad sin grados.
let claseCreada = null;
if (!clase) {
  const [act] = (await db.query(`select a.id, a.nombre from public.actividades a where a.gimnasio_id = $1 and a.activa and not exists (select 1 from public.grados g where g.actividad_id = a.id and g.activo) order by a.nombre limit 1`, [gim])).rows;
  const [sede] = (await db.query(`select id from public.sedes where gimnasio_id = $1 order by creado_en limit 1`, [gim])).rows;
  if (act) {
    const [{ id }] = (await db.query(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin) values ($1,$2,$3, now() - interval '3 hours', now() - interval '2 hours') returning id`, [gim, sede.id, act.id])).rows;
    claseCreada = id;
    clase = { id, actividad_id: act.id, actividad: act.nombre };
  }
}
if (!clase) { console.log("❌ no hay una clase pasada en el demo"); process.exit(1); }
const ya = (await db.query(`select 1 from public.asistencias where clase_id = $1 and socio_id = $2 and anulada_en is null`, [clase.id, socio])).rowCount;
const [asis] = ya ? [] : (await db.query(`insert into public.asistencias (gimnasio_id, clase_id, socio_id) values ($1,$2,$3) returning id`, [gim, clase.id, socio])).rows;
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/clases`);
  await d.locator("[data-ir-grados]").click();
  await d.waitForURL(/\/panel\/grados/, { timeout: 60000 });
  const sec = d.locator(`[data-grados-actividad="${clase.actividad}"]`);
  await sec.locator("button", { hasText: "Armar los grados" }).click();
  const crear = async (nombreGrado, orden, clases) => {
    const f = sec.locator("[data-editor-grado]");
    await f.locator('input[aria-label="Orden"]').fill(String(orden));
    await f.locator('input[aria-label="Nombre del grado"]').fill(nombreGrado);
    await f.locator('input[aria-label="Clases mínimas"]').fill(String(clases));
    await f.locator('button[type="submit"]').click();
    await sec.locator(`[data-grado="${nombreGrado}"]`).waitFor({ timeout: 30000 });
  };
  await crear(BLANCO, 1, 0);
  await sec.locator("button", { hasText: "Otro grado" }).click();
  await crear(AMARILLO, 2, 1);
  chequear(/Pide 1 clases/.test(await sec.locator(`[data-grado="${AMARILLO}"]`).innerText()), `la dueña arma los grados de ${clase.actividad}: ${BLANCO} y ${AMARILLO} (1 clase)`, await sec.innerText());
  await d.reload();
  const listo = d.locator(`[data-listo-rendir="${nombre}"]`, { hasText: clase.actividad });
  chequear(await aparece(listo, 30000), `${nombre} aparece “listo para rendir”: sin grado → ${BLANCO}`, "no aparece en listos para rendir");

  const p = await pagina(b, CELU);
  p.setDefaultNavigationTimeout(120000);
  await entrar(p, "profe@ejemplo.invalid");
  await p.goto(`${G}/panel/grados`);
  const fila = p.locator(`[data-listo-rendir="${nombre}"]`, { hasText: clase.actividad });
  await fila.locator("button", { hasText: `Rindió: ${BLANCO}` }).click();
  // Tras rendir, la fila muestra el grado nuevo o sale de la lista de los listos (los dos están bien): lo que cuenta es que el grado quedó (lo mira la app del socio, abajo).
  const quedoGrado = await Promise.race([aparece(fila.getByText(`${BLANCO}`), 30000), fila.waitFor({ state: "detached", timeout: 30000 }).then(() => true, () => false)]);
  chequear(quedoGrado, `el profe, en el celular, toca “Rindió: ${BLANCO}”`, "después de tocar “Rindió” la fila no cambió ni salió de la lista");
  await capturar(p, "com13-celu-profe");

  const so = await pagina(b, CELU);
  so.setDefaultNavigationTimeout(120000);
  await entrar(so, "socio@ejemplo.invalid");
  await so.goto(`${G}/app`);
  const app = so.locator("[data-grados-app]");
  chequear(await aparece(app, 60000) && (await app.innerText()).includes(`${clase.actividad}: ${BLANCO}`) && (await app.innerText()).includes(`Para ${AMARILLO}`),
    `la app del socio: “Tu grado · ${clase.actividad}: ${BLANCO}” y lo que le falta para ${AMARILLO}`, await app.innerText().catch(() => "no está"));
  for (const x of [d, p, so]) if (x.errores.length) falla(x.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.grados_socio gs set anulado_en = now(), anulado_motivo = 'Prueba e2e' from public.grados g
    where g.id = gs.grado_id and g.gimnasio_id = $1 and g.nombre in ($2, $3) and gs.anulado_en is null`, [gim, BLANCO, AMARILLO]).catch(() => {});
  await db.query(`update public.grados set activo = false where gimnasio_id = $1 and nombre in ($2, $3)`, [gim, BLANCO, AMARILLO]).catch(() => {});
  if (asis) await db.query(`update public.asistencias set anulada_en = now(), anulada_motivo = 'Prueba e2e' where id = $1`, [asis.id]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
