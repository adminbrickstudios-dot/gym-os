#!/usr/bin/env node
// VD-52 · Liquidación de profes: el dueño ve el mes de cada profe (clases dictadas y presentes), le pone la regla,
// registra un pago, y el profe ve SU mes en Mi cuenta. La recepción no entra. Corregir una asistencia recalcula.
//   npm run e2e:vd-52            (con scripts/local/levantar.sh corriendo; una corrida por base nueva)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const b = await navegador();
const [{ g, sede, act, profe, duena }] = (await db.query(`select g.id g, (select id from public.sedes where gimnasio_id = g.id and es_principal) sede,
  (select id from public.actividades where gimnasio_id = g.id limit 1) act,
  (select id from public.equipo where gimnasio_id = g.id and rol = 'profe' and activo limit 1) profe,
  (select id from public.equipo where gimnasio_id = g.id and rol = 'dueno' limit 1) duena
  from public.gimnasios g where g.slug = 'demo'`)).rows;
const mesPasado = (await db.query(`select to_char(date_trunc('month', now() - interval '1 month'), 'YYYY-MM') m`)).rows[0].m;
// Dos clases del mes pasado de ese profe (3 y 2 presentes) y una cancelada que no cuenta.
const clase = async (dia, presentes, cancelada = false) => {
  const [{ id }] = (await db.query(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin, profe_id, cancelada_en, cancelada_motivo)
    values ($1,$2,$3, ($4::date + $5::int + time '19:00') at time zone 'America/Argentina/Buenos_Aires', ($4::date + $5::int + time '20:00') at time zone 'America/Argentina/Buenos_Aires', $6, $7, $8) returning id`,
    [g, sede, act, `${mesPasado}-01`, dia - 1, profe, cancelada ? new Date() : null, cancelada ? "feriado" : null])).rows;
  const socios = (await db.query(`select id from public.socios where gimnasio_id = $1 order by id limit $2`, [g, presentes])).rows;
  for (const s of socios) await db.query(`insert into public.asistencias (gimnasio_id, clase_id, socio_id) values ($1,$2,$3)`, [g, id, s.id]);
  return id;
};
await clase(3, 3);
const c2 = await clase(10, 2);
await clase(12, 4, true);
const asist = (await db.query(`select id from public.asistencias where clase_id = $1 limit 1`, [c2])).rows[0].id;
const pesos = (t) => Number(t.replace(/[^\d,]/g, "").replace(",", "."));
const SIN = /No tenés acceso|Tu rol no tiene acceso|Sin permiso|no tiene acceso/i;
try {
  // ── El dueño ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/profes?mes=${mesPasado}`);
  const tarjeta = d.locator("[data-profe]", { hasText: "Diego" });
  await tarjeta.waitFor({ timeout: 30000 });
  chequear(await tarjeta.locator("[data-sin-regla]").count() === 1, "Diego aparece sin regla de pago y con aviso", "Diego no avisa que le falta la regla");
  chequear((await tarjeta.innerText()).includes("Dio 2 clases"), "cuenta 2 clases (la cancelada no)", "no cuenta bien las clases");
  await tarjeta.locator("[data-abrir-regla]").click();
  await tarjeta.locator("select[name=modo]").selectOption("por_presente");
  await tarjeta.locator("input[name=monto]").fill("1000");
  await tarjeta.locator("[data-form-regla] button[type=submit]").click();
  await tarjeta.locator("[data-dato=total]").filter({ hasText: "5.000" }).waitFor({ timeout: 30000 });
  ok("regla “$1.000 por alumno presente”: 3 + 2 presentes = $5.000 en el mes");
  await capturar(d, "vd52-compu-liquidacion", true);

  // Corregir una asistencia recalcula el mes (sin tocar nada de la liquidación).
  await db.query(`update public.asistencias set anulada_en = now(), anulada_motivo = 'vino a otra clase', anulada_por = $2 where id = $1`, [asist, duena]);
  await d.goto(`${G}/panel/profes?mes=${mesPasado}`);
  await d.locator("[data-profe=Diego] [data-dato=total]").filter({ hasText: "4.000" }).waitFor({ timeout: 30000 });
  ok("corregir una asistencia recalcula: $4.000");

  // Pagar en transferencia.
  const t2 = d.locator("[data-profe]", { hasText: "Diego" });
  await t2.locator("[data-abrir-pagar]").click();
  await t2.locator("[data-panel-pagar] input[name=monto]").fill("1500");
  await t2.locator("[data-panel-pagar] input[name=nota]").fill("alias diego.mp");
  await t2.locator("[data-panel-pagar] button[type=submit]").click();
  await t2.locator("[data-dato=pagado]").filter({ hasText: "1.500" }).waitFor({ timeout: 30000 });
  chequear(pesos(await t2.locator("[data-dato=pendiente]").innerText()) === 2500, "pagó $1.500: faltan $2.500", "después de pagar no quedan $2.500");
  // No se puede pagar más de lo que falta.
  await t2.locator("[data-abrir-pagar]").click();
  await t2.locator("[data-panel-pagar] input[name=monto]").fill("9999");
  await t2.locator("[data-panel-pagar] button[type=submit]").click();
  await t2.locator("[role=alert]", { hasText: "más de lo que falta" }).waitFor({ timeout: 30000 });
  ok("pagar de más: la base lo frena con el motivo");
  await t2.locator("[data-abrir-detalle]").click();
  await t2.locator("[data-panel-detalle]").waitFor({ timeout: 30000 });
  chequear((await t2.locator("[data-panel-detalle]").innerText()).includes("alias diego.mp"), "el detalle muestra el pago con su nota", "el detalle no muestra el pago");

  // ── El profe ve lo suyo ──
  const pr = await pagina(b, COMPU);
  await entrar(pr, "profe@ejemplo.invalid");
  await pr.goto(`${G}/panel/cuenta`);
  const mi = pr.locator("[data-mi-liquidacion]");
  await mi.waitFor({ timeout: 30000 });
  ok(`Mi cuenta muestra “${(await mi.locator("h2").innerText()).trim()}”`);
  await pr.goto(`${G}/panel/profes`);
  chequear(SIN.test(await pr.locator("main").innerText()), "el profe no abre la liquidación de todos", "el profe pudo abrir /panel/profes");
  const cel = await pagina(b, CELU);
  await entrar(cel, "profe@ejemplo.invalid");
  await cel.goto(`${G}/panel/cuenta`);
  await cel.locator("[data-mi-liquidacion]").waitFor({ timeout: 30000 });
  chequear(await cel.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "celular: Mi liquidación sin desborde", "celular: Mi liquidación se desborda");
  await capturar(cel, "vd52-celu-mi-liquidacion", true);

  // ── La recepción no ve la liquidación ──
  const rc = await pagina(b, COMPU);
  await entrar(rc, "recepcion@ejemplo.invalid");
  await rc.goto(`${G}/panel/profes`);
  chequear(SIN.test(await rc.locator("main").innerText()), "la recepción no abre la liquidación", "la recepción pudo abrir /panel/profes");
  await d.setViewportSize(CELU);
  await d.goto(`${G}/panel/profes?mes=${mesPasado}`);
  await d.locator("[data-profe]").first().waitFor({ timeout: 30000 });
  chequear(await d.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "celular: la liquidación sin desborde", "celular: la liquidación se desborda");
  await capturar(d, "vd52-celu-liquidacion", true);
} catch (e) { falla(`se cortó: ${e.message.split("\n")[0]}`); }
finally { await b.close(); await db.end(); resultado(); }
