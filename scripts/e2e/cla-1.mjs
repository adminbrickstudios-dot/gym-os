#!/usr/bin/env node
// CLA-1 · Faltas: la dueña elige "no puede reservar por unos días"; el socio
// lo ve en la app antes de reservar; con una falta (simulada en la base) ve
// el porqué y no puede reservar. Al final la regla vuelve a "no pasa nada".
//   npm run e2e:cla-1            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const b = await navegador();
const [{ gimnasio_id: gim, socio_id: socio }] = (await db.query(`select s.gimnasio_id, s.id as socio_id from public.socios s join public.gimnasios g on g.id = s.gimnasio_id
  where g.slug = 'demo' and s.nombre = 'Testigo' and s.apellido = 'Al Día'`)).rows;
let clase;
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/configuracion?pestana=clases`);
  const f = d.locator("[data-faltas]");
  await f.waitFor({ timeout: 60000 });
  await f.getByRole("button", { name: /No puede reservar/ }).click();
  await f.getByLabel(/Días sin poder reservar/).fill("2");
  const guardar = d.locator('[data-pie="clases"] button.boton-principal');
  if (await guardar.isEnabled()) {
    await guardar.click();
    await d.locator('[data-pie="clases"] [data-sin-guardar]').waitFor({ state: "detached", timeout: 30000 });
  }
  const [{ falta_politica: pol, falta_bloqueo_dias: dias }] = (await db.query(`select falta_politica, falta_bloqueo_dias from public.configuracion_gimnasio where gimnasio_id = $1`, [gim])).rows;
  chequear(pol === "bloquear" && dias === 2, "en la base: bloquear, 2 días", `${pol} ${dias}`);
  ok("Configuración → Clases: “No puede reservar por 2 días” guardado");

  // Una falta de hoy, después de prender la regla.
  const act = (await db.query(`select id from public.actividades where gimnasio_id = $1 limit 1`, [gim])).rows[0].id;
  const sede = (await db.query(`select id from public.sedes where gimnasio_id = $1 and es_principal`, [gim])).rows[0].id;
  clase = (await db.query(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin) values ($1,$2,$3, now() - interval '50 minutes', now() - interval '5 minutes') returning id`, [gim, sede, act])).rows[0].id;
  await db.query(`update public.configuracion_gimnasio set falta_politica_desde = now() - interval '1 hour' where gimnasio_id = $1`, [gim]);
  await db.query(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [gim, clase, socio]);

  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app/clases`);
  await s.locator("[data-reglas-reservas]").waitFor({ timeout: 60000 });
  chequear(/no podés reservar por 2 días/.test(await s.locator("[data-reglas-reservas]").innerText()), "la app avisa la regla antes de reservar", await s.locator("[data-reglas-reservas]").innerText());
  const aviso = s.locator("[data-bloqueo-reservas]");
  chequear(await aviso.count() === 1 && /faltaste a .+ sin cancelar/.test(await aviso.innerText()), `con una falta: “${await aviso.innerText().catch(() => "")}”`, "sin aviso de bloqueo");
  await capturar(s, "cla1-celu-bloqueo");
  const reservar = s.getByRole("button", { name: /^Reservar$|Anotarme en espera/ }).first();
  if (await reservar.count()) {
    await reservar.click();
    await s.getByRole("alert").filter({ hasText: /No podés reservar hasta/ }).first().waitFor({ timeout: 30000 });
    ok("tocar Reservar: lo frena la base con el mismo motivo");
  }
  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
  await d.goto(`${G}/panel/socios/${socio}?pestana=asistencia`);
  await d.locator("[data-faltas-socio]").waitFor({ timeout: 60000 });
  ok("en la ficha (Asistencia): “🙈 Reservó y no vino”");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  if (clase) { await db.query(`delete from public.reservas where clase_id = $1`, [clase]); await db.query(`delete from public.clases where id = $1`, [clase]); }
  await db.query(`update public.configuracion_gimnasio set falta_politica = 'nada' where gimnasio_id = $1`, [gim]);
  await db.end();
}
await b.close();
resultado();
