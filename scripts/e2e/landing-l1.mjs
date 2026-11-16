#!/usr/bin/env node
// L1 (Mateo, 14/11) · La página del gimnasio en UNA pantalla del celular.
//   1. Con las altas prendidas, en 390×844 y SIN scroll se ven: el nombre, "Quiero ser socio", "Ya soy socio, entrar" y los 3 datos
//      (dirección, horario de hoy, WhatsApp).
//   2. Con las altas apagadas no aparece "Quiero ser socio": en su lugar va "Escribinos por WhatsApp".
//   3. Lo que ya no va por defecto no aparece: "¿Primera vez? Empezá acá"; lo de abajo (planes, horarios) sigue si el dueño lo tiene.
//   4. En la compu también se ve completo y sin desbordes.
//   node scripts/e2e/landing-l1.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, chequear, falla, navegador, ok, pagina, resultado, PUERTO } from "./comun.mjs";

const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url });
await db.connect();
const s = Date.now().toString().slice(-6);
const hostA = `l1a${s}.localhost`, hostB = `l1b${s}.localhost`;
const DIR = (h) => `http://${h}:${PUERTO}`;
const CELU_L1 = { width: 390, height: 844 };

const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
for (const h of [hostA, hostB]) await db.query(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'subdominio') on conflict do nothing`, [gim, h]);
const [{ id: sede }] = (await db.query(`select id from public.sedes where gimnasio_id = $1 order by es_principal desc limit 1`, [gim])).rows;
await db.query(`update public.sedes set direccion = coalesce(direccion, 'Calle Ficticia 123, Salta') where id = $1`, [sede]);
// D83: "altas apagadas" = cerrado del todo: las altas con plan y la llave de Crear mi cuenta.
const altas = (v) => db.query(`update public.configuracion_gimnasio set altas_online = $2, crear_cuenta_visible = $2 where gimnasio_id = $1`, [gim, v]);

/** ¿El elemento está entero dentro de la primera pantalla (sin scrollear)? */
const enPantalla = (p, sel) => p.locator(sel).first().evaluate((el, alto) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= alto;
}, CELU_L1.height).catch(() => false);

const b = await navegador();
try {
  // ── 1 · Altas prendidas ──
  await altas(true);
  const p = await pagina(b, CELU_L1);
  await p.goto(`${DIR(hostA)}/`);
  await p.locator("[data-primer-pantallazo]").waitFor({ timeout: 60000 });
  for (const [sel, nombre] of [["[data-nombre-gimnasio]", "el nombre del gimnasio"], ["[data-quiero-ser-socio]", "“Quiero ser socio”"], ["[data-ya-soy-socio]", "“Ya soy socio, entrar”"],
    ["[data-dato-direccion]", "la dirección"], ["[data-dato-horario]", "el horario de hoy"], ["[data-dato-whatsapp]", "el WhatsApp"]]) {
    chequear(await enPantalla(p, sel), `en el primer pantallazo del celular (390×844) se ve ${nombre}`, `${nombre} no está entero en la primera pantalla`);
  }
  const maps = await p.locator("[data-dato-direccion]").getAttribute("href");
  chequear(/google\.com\/maps|maps/.test(maps ?? ""), "la dirección es un link a Maps", `la dirección apunta a ${maps}`);
  const wa = await p.locator("[data-dato-whatsapp]").getAttribute("href");
  chequear((wa ?? "").startsWith("https://wa.me/"), "el WhatsApp es un link wa.me", `el WhatsApp apunta a ${wa}`);
  chequear(await p.locator("[data-como-empezar]").count() === 0, "“¿Primera vez? Empezá acá” ya no va por defecto", "sigue apareciendo “Empezá acá”");
  chequear(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "celular: sin desborde horizontal", "la portada desborda");
  await p.screenshot({ path: ".local/capturas/l1-celu-altas-prendidas.png" }).catch(() => {});
  await p.screenshot({ path: ".local/capturas/l1-celu-completa.png", fullPage: true }).catch(() => {});
  await p.context().close();

  // ── 2 · Altas apagadas ──
  await altas(false);
  const q = await pagina(b, CELU_L1);
  await q.goto(`${DIR(hostB)}/`);
  await q.locator("[data-primer-pantallazo]").waitFor({ timeout: 60000 });
  chequear(await q.locator("[data-quiero-ser-socio]").count() === 0, "con las altas apagadas no aparece “Quiero ser socio”", "aparece “Quiero ser socio” con las altas apagadas");
  chequear(await enPantalla(q, "[data-escribinos-whatsapp]"), "…y en su lugar va “Escribinos por WhatsApp”", "falta “Escribinos por WhatsApp”");
  chequear(await enPantalla(q, "[data-ya-soy-socio]"), "“Ya soy socio, entrar” sigue a la vista", "falta “Ya soy socio, entrar”");
  await q.screenshot({ path: ".local/capturas/l1-celu-altas-apagadas.png" }).catch(() => {});
  await q.context().close();

  // ── 3 · Compu ──
  await altas(true);
  const c = await pagina(b, COMPU);
  await c.goto(`${DIR(hostA)}/`);
  await c.locator("[data-primer-pantallazo]").waitFor({ timeout: 60000 });
  chequear(await c.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "compu: sin desborde horizontal", "la portada desborda en la compu");
  chequear(await c.locator("footer a[href=\"/ingresar\"]").count() > 0, "“Soy del equipo” sigue chico al pie", "falta “Soy del equipo”");
  await c.screenshot({ path: ".local/capturas/l1-compu.png" }).catch(() => {});
  await c.context().close();
  ok("capturas guardadas");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.stack : e.message.split("\n")[0]}`);
}
await db.query(`delete from public.dominios_gimnasio where host in ($1, $2)`, [hostA, hostB]).catch(() => {});
await db.end();
await b.close();
resultado();
