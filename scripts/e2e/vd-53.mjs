#!/usr/bin/env node
// VD-53 · Fichaje del equipo con PIN: el dueño lo prende en Horas del equipo; la recepción ficha entrada y salida desde
// el Inicio y con su PIN; una entrada olvidada queda "sin salida" y el dueño la corrige con motivo; el profe no ve las horas de todos.
//   npm run e2e:vd-53            (con scripts/local/levantar.sh corriendo; una corrida por base nueva)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const b = await navegador();
const [{ g, ana, diego }] = (await db.query(`select g.id g,
  (select id from public.equipo where gimnasio_id = g.id and rol = 'recepcion' and activo order by nombre limit 1) ana,
  (select id from public.equipo where gimnasio_id = g.id and rol = 'profe' and activo order by nombre limit 1) diego
  from public.gimnasios g where g.slug = 'demo'`)).rows;
// El PIN de la recepción (la base guarda solo el hash).
await db.query(`insert into privado.secretos_operador (gimnasio_id) values ($1) on conflict do nothing`, [g]);
await db.query(`insert into privado.pines_equipo (equipo_id, gimnasio_id, pin_hash) values ($1,$2, extensions.crypt('4827', extensions.gen_salt('bf', 8)))
  on conflict (equipo_id) do update set pin_hash = excluded.pin_hash`, [ana, g]);
const SIN = /No tenés acceso|Tu rol no tiene acceso|Sin permiso|no tiene acceso|apagada/i;
try {
  // ── Apagado por defecto: la recepción no ve el botón ──
  const rc = await pagina(b, COMPU);
  await entrar(rc, "recepcion@ejemplo.invalid");
  await rc.goto(`${G}/panel`);
  await rc.locator("h1").waitFor({ timeout: 30000 });
  chequear(await rc.locator("[data-fichaje]").count() === 0, "gimnasio sin fichaje: el Inicio de la recepción no tiene el botón", "el botón de fichar aparece con el fichaje apagado");

  // ── El dueño lo prende ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/horas`);
  const cfg = d.locator("[data-config-fichaje]");
  await cfg.waitFor({ timeout: 30000 });
  await cfg.locator("input[role=switch]").check();
  await cfg.getByText("Guardado.").waitFor({ timeout: 30000 });
  ok("el dueño prende el fichaje en Horas del equipo");

  // ── La recepción ficha entrada y salida desde el Inicio ──
  await rc.goto(`${G}/panel`);
  const entrar_ = rc.locator("[data-fichar=entrada]");
  await entrar_.waitFor({ timeout: 30000 });
  await entrar_.click();
  await rc.getByText(/Entrada fichada a las/).waitFor({ timeout: 30000 });
  await rc.locator("[data-fichar=salida]").waitFor({ timeout: 30000 });
  ok("la recepción ficha la entrada y el botón pasa a “Fichar salida”");
  await rc.locator("[data-fichar=salida]").click();
  await rc.getByText(/Salida fichada a las/).waitFor({ timeout: 30000 });
  ok("ficha la salida y dice cuánto duró el turno");

  // ── Con su PIN, desde Fichar y mis horas ──
  await rc.goto(`${G}/panel/fichar`);
  await rc.locator("[data-fichar-pin]").waitFor({ timeout: 30000 });
  await rc.locator("[data-fichar-pin] input[name=pin]").fill("0001");
  await rc.locator("[data-fichar-con-pin]").click();
  await rc.locator("[role=alert]", { hasText: "PIN equivocado" }).waitFor({ timeout: 30000 });
  ok("un PIN equivocado se dice, sin romper nada");
  await rc.locator("[data-fichar-pin] input[name=pin]").fill("4827");
  await rc.locator("[data-fichar-con-pin]").click();
  await rc.getByText(/Entrada fichada a las .*Ana/).waitFor({ timeout: 30000 });
  ok("con el PIN correcto ficha a nombre de quien lo puso");
  chequear(await rc.locator("[data-mis-horas] [data-turno-estado]").count() >= 2, "Mis horas lista los turnos del mes", "Mis horas no lista los turnos");

  // ── Un profe que se olvidó de fichar la salida (anteayer) ──
  await db.query(`insert into public.fichajes (gimnasio_id, equipo_id, entrada_en) values ($1,$2, now() - interval '2 days')`, [g, diego]);
  await d.goto(`${G}/panel/horas`);
  const fila = d.locator("[data-persona]", { hasText: "Diego" });
  await fila.waitFor({ timeout: 30000 });
  chequear(await fila.locator("[data-sin-salida]").count() === 1, "Diego figura con 1 turno sin salida", "la entrada olvidada no figura como sin salida");
  await fila.locator("[data-ver-turnos]").click();
  const turno = fila.locator("[data-turno-estado=sin_salida]");
  await turno.waitFor({ timeout: 30000 });
  await turno.locator("[data-corregir]").click();
  await turno.locator("[data-corr-guardar]").click();
  await turno.locator("[role=alert]").waitFor({ timeout: 30000 });
  ok("corregir sin motivo: la base lo frena");
  // Salida 8 horas después de la entrada, hora del gimnasio (el campo ya trae la entrada).
  const ent = await turno.locator("[data-corr-entrada]").inputValue();
  const sal = new Date(new Date(ent + ":00Z").getTime() + 8 * 3600 * 1000).toISOString().slice(0, 16);
  await turno.locator("[data-corr-salida]").fill(sal);
  await turno.locator("[data-corr-motivo]").fill("Se olvidó de fichar la salida");
  await turno.locator("[data-corr-guardar]").click();
  await fila.locator("[data-turno-estado=cerrado]").waitFor({ timeout: 30000 });
  await fila.locator("[data-horas]").filter({ hasText: "8 h" }).waitFor({ timeout: 30000 });
  chequear((await fila.innerText()).includes("Se olvidó de fichar la salida"), "la corrección suma 8 h y queda anotada con su motivo", "la corrección no queda anotada");
  await capturar(d, "vd53-compu-horas", true);

  // ── Quién ve qué ──
  const pr = await pagina(b, COMPU);
  await entrar(pr, "profe@ejemplo.invalid");
  await pr.goto(`${G}/panel/horas`);
  chequear(SIN.test(await pr.locator("main").innerText()), "el profe no abre las horas de todos", "el profe pudo abrir /panel/horas");
  await rc.goto(`${G}/panel/horas`);
  chequear(SIN.test(await rc.locator("main").innerText()), "la recepción no abre las horas de todos", "la recepción pudo abrir /panel/horas");
  await pr.goto(`${G}/panel/fichar`);
  await pr.locator("[data-mis-horas]").waitFor({ timeout: 30000 });
  chequear((await pr.locator("[data-mis-horas]").innerText()).includes("sin salida") || (await pr.locator("[data-mis-horas] [data-turno-estado]").count()) >= 1, "el profe ve sus propios turnos", "el profe no ve lo suyo");

  // ── Celular ──
  const cel = await pagina(b, CELU);
  await entrar(cel, "recepcion@ejemplo.invalid");
  await cel.goto(`${G}/panel/fichar`);
  await cel.locator("[data-mis-horas]").waitFor({ timeout: 30000 });
  chequear(await cel.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "celular: Fichar sin desborde", "celular: Fichar se desborda");
  await capturar(cel, "vd53-celu-fichar", true);
} catch (e) { falla(`se cortó: ${e.message.split("\n")[0]}`); }
finally { await b.close(); await db.end(); resultado(); }
