#!/usr/bin/env node
// C5 + C6 · La compu de la recepción.
//   C5: un lector USB (teclado que tipea el código de corrido y manda Enter) en el mismo campo de la Entrada: 20 caracteres a 5 ms por tecla
//       + Enter es una lectura; un código que no existe suena el error y deja el campo vacío y con el foco; el doble Enter anota una sola vez;
//       un DNI leído entra por el aviso y el veredicto lo da la base (no se recalcula acá).
//   C6: cambiar de persona con el PIN sin cerrar la sesión del gimnasio (queda anotado quién ingresó), cierre por inactividad con un valor chico
//       (primero suelta a quien atiende, después cierra la sesión) y que el ingreso no guarde la contraseña en la compu compartida.
//   node scripts/e2e/recepcion-lector.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const PIN_ANA = "4827", PIN_OTRA = "5936";

// Dos personas del equipo con PIN: Ana (la de la sesión, recepción) y otra que pueda atender (encargado o recepción).
const [ana] = (await db.query(`select id, nombre from public.equipo where gimnasio_id = $1 and rol = 'recepcion' and activo order by nombre limit 1`, [gim])).rows;
const [otra] = (await db.query(`select id, nombre from public.equipo where gimnasio_id = $1 and rol in ('recepcion', 'encargado') and activo and id <> $2 order by rol desc, nombre limit 1`, [gim, ana.id])).rows;
await db.query(`insert into privado.secretos_operador (gimnasio_id) values ($1) on conflict do nothing`, [gim]);
for (const [e, pin] of [[ana.id, PIN_ANA], [otra.id, PIN_OTRA]]) {
  await db.query(`insert into privado.pines_equipo (equipo_id, gimnasio_id, pin_hash) values ($1,$2, extensions.crypt($3, extensions.gen_salt('bf', 8)))
    on conflict (equipo_id) do update set pin_hash = excluded.pin_hash`, [e, gim, pin]);
}
const config = (min) => db.query(`insert into public.configuracion_entrada (gimnasio_id, resultado_entrada, cerrar_por_inactividad_min) values ($1, 'aviso', $2)
  on conflict (gimnasio_id) do update set resultado_entrada = 'aviso', cerrar_por_inactividad_min = $2`, [gim, min]);
await config(0);
// Socios para leer: se usa el teléfono como DNI, igual que base-ingresos.
const { rows: socios } = await db.query(`select id, telefono as dni, nombre || ' ' || apellido as nombre from public.socios
  where gimnasio_id = $1 and telefono is not null and dado_de_baja_en is null order by (nombre = 'Testigo') desc, numero limit 6`, [gim]);
if (socios.length < 3) { console.error(`faltan socios con teléfono para leer: hay ${socios.length}`); process.exit(1); }

const b = await navegador();
try {
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");

  // ── C6 · cambiar de persona con el PIN, sin cerrar la sesión ──
  const ponerPin = async (pin) => {
    await r.goto(`${G}/panel/pin`);
    await r.locator("[data-teclado-pin] input[name=pin]").fill(pin);
    await r.waitForURL((u) => u.pathname === "/panel", { timeout: 30000 });
  };
  await ponerPin(PIN_ANA);
  await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
  chequear((await r.locator("[data-atiende]").first().getAttribute("data-atiende")) === ana.nombre, `con su PIN atiende ${ana.nombre}`, "la barra Atiende no dice quién es");

  // ── C5 · lector USB: DNI a 5 ms por tecla + Enter ──
  const entradasDe = async (socio, desde) => (await db.query(
    `select count(*)::int n from public.ingresos where socio_id = $1 and momento >= $2 and resultado <> 'rechazado'`, [socio, desde])).rows[0].n;
  const leer = async (codigo, { dobleEnter = false } = {}) => {
    await r.keyboard.press("F2");
    const campo = r.locator("[data-ventana-campo]");
    await campo.waitFor({ timeout: 10000 });
    await campo.focus();
    await r.keyboard.type(codigo, { delay: 5 });
    await r.keyboard.press("Enter");
    if (dobleEnter) await r.keyboard.press("Enter");
  };
  const [s1, s2] = socios;
  const t1 = new Date(Date.now() - 1000);
  await leer(s1.dni, { dobleEnter: true });
  await r.locator("[data-aviso-id]").first().waitFor({ timeout: 30000 });
  await r.locator("[data-ventana-entrada]").waitFor({ state: "detached", timeout: 15000 });
  chequear(await entradasDe(s1.id, t1) <= 1, "un DNI leído con doble Enter anota una sola entrada", "el doble Enter anotó dos veces");
  const row = (await db.query(`select registrado_por from public.ingresos where socio_id = $1 and momento >= $2 order by momento desc limit 1`, [s1.id, t1])).rows[0];
  chequear(!row || row.registrado_por === ana.id, `lo que ingresa queda a nombre de quien puso el PIN (${ana.nombre})`, `registrado_por es ${row?.registrado_por}, no ${ana.id}`);

  // Un código de 20 caracteres que no es de nadie: suena el error, el campo queda vacío y con el foco.
  const raro = "ZZ99999999999999999A";
  await r.keyboard.press("F2");
  const campo = r.locator("[data-ventana-campo]");
  await campo.waitFor({ timeout: 10000 });
  await campo.focus();
  await r.keyboard.type(raro, { delay: 5 });
  await r.keyboard.press("Enter");
  await r.locator("text=No encontramos").first().waitFor({ timeout: 15000 });
  chequear(raro.length === 20 && (await campo.inputValue()) === "", "una lectura de 20 caracteres que no es de nadie: error y el campo queda vacío", "el campo conserva el código que no se encontró");
  chequear(await campo.evaluate((el) => document.activeElement === el), "y el foco sigue en el campo", "el foco salió del campo");
  // La lectura siguiente no se pega a la anterior (no pierde ni mezcla caracteres).
  const t2 = new Date(Date.now() - 1000);
  await r.keyboard.type(s2.dni, { delay: 5 });
  await r.keyboard.press("Enter");
  await r.locator("[data-aviso-id]").nth(1).waitFor({ timeout: 30000 }).catch(() => {});
  chequear(await entradasDe(s2.id, t2) === 1 || (await r.locator("[data-aviso-id]").count()) >= 2, "la lectura siguiente entra completa, sin restos de la anterior", "la lectura siguiente no entró");
  await r.keyboard.press("Escape");

  // Tipeo humano (120 ms por tecla) no se toma como lectura: busca y deja elegir como siempre.
  await r.keyboard.press("F2");
  await campo.waitFor({ timeout: 10000 });
  await campo.focus();
  await r.keyboard.type(s2.dni.slice(0, 4), { delay: 120 });
  chequear((await campo.inputValue()).replace(/\./g, "") === s2.dni.slice(0, 4), "tipeando a mano, el campo conserva lo escrito (no es una lectura)", "el campo perdió lo tipeado a mano");
  await r.keyboard.press("Escape");

  // ── C6 · cambiar de persona: sin cerrar la sesión del gimnasio ──
  await r.locator("[data-cambiar-persona]").first().click();
  await r.waitForURL((u) => u.pathname === "/panel/pin", { timeout: 30000 });
  await r.locator("[data-teclado-pin] input[name=pin]").fill(PIN_OTRA);
  await r.waitForURL((u) => u.pathname === "/panel", { timeout: 30000 });
  chequear((await r.locator("[data-atiende]").first().getAttribute("data-atiende")) === otra.nombre, `al cambiar de persona atiende ${otra.nombre} sin pasar por el ingreso`, "no cambió quién atiende");
  const t3 = new Date(Date.now() - 1000);
  await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
  await leer(socios[2].dni);
  await r.locator("[data-aviso-id]").first().waitFor({ timeout: 30000 });
  const row3 = (await db.query(`select registrado_por from public.ingresos where socio_id = $1 and momento >= $2 order by momento desc limit 1`, [socios[2].id, t3])).rows[0];
  chequear(!row3 || row3.registrado_por === otra.id, `el siguiente ingreso queda a nombre de ${otra.nombre}`, `registrado_por es ${row3?.registrado_por}, no ${otra.id}`);

  // ── C6 · cierre por inactividad con un valor chico (6 s en esta compu; el gimnasio dice 5 minutos y la compu solo puede acortarlo) ──
  await config(5);
  await r.evaluate(() => localStorage.setItem("gymos.entrada.inactividad-seg", "6"));
  await r.goto(`${G}/panel`);
  await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
  await r.locator("[data-cierre-inactividad]").waitFor({ timeout: 15000 });
  chequear(true, "antes de cerrar avisa cuántos segundos faltan", "");
  await r.waitForURL((u) => u.pathname === "/panel/pin", { timeout: 20000 });
  chequear(await r.locator("[data-atiende]").count() === 0, "sin uso, primero suelta a quien atiende y vuelve a pedir el PIN (la sesión del gimnasio sigue)", "la persona sigue atendiendo");
  await r.waitForURL((u) => u.pathname.startsWith("/ingresar"), { timeout: 30000 });
  chequear(true, "sin nadie que ponga el PIN, cierra la sesión del gimnasio", "");
  chequear(await r.locator("text=cerró por falta de uso").count() === 1, "el ingreso explica por qué", "el ingreso no dice que fue por falta de uso");

  // ── C6 · la contraseña no se guarda en la compu compartida ──
  await r.waitForSelector("[data-compartida]", { timeout: 10000 });
  const campoClave = r.locator("input[name=contrasena]");
  chequear((await campoClave.getAttribute("type")) === "text" && (await campoClave.getAttribute("autocomplete")) === "off",
    "en la compu compartida la contraseña no es un campo de contraseña y el navegador no la ofrece guardar", "el campo de la contraseña sigue siendo guardable");
  chequear(await r.locator("[data-compu-compartida] input[type=checkbox]").isChecked(), "la compu quedó marcada como compartida", "no quedó marcada");
} catch (e) {
  falla(`el e2e se cortó: ${e.message}`);
} finally {
  await config(0).catch(() => {});
  await db.query(`delete from privado.pines_equipo where equipo_id = any($1::uuid[])`, [[ana.id, otra.id]]).catch(() => {});
  await b.close().catch(() => {});
  await db.end().catch(() => {});
  resultado();
}
