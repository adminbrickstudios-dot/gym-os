#!/usr/bin/env node
// Q3 · FA-24: en Socios → Interesados, "Invitados para seguir" lista a los que vinieron con un socio y todavía no son
// interesados; con su WhatsApp quedan anotados como interesados (con quién los trajo) y salen de esa lista.
// El invitado se siembra por SQL con sello propio y se borra al terminar. Compu y celular.
//   node scripts/e2e/q3-invitado.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const q = async (sql, p) => (await db.query(sql, p)).rows;
const [{ id: gim }] = await q(`select id from public.gimnasios where slug = 'demo'`);
const [{ id: sede }] = await q(`select id from public.sedes where gimnasio_id = $1 and es_principal`, [gim]);
const [{ id: socio }] = await q(`select id from public.socios where gimnasio_id = $1 order by id limit 1`, [gim]);
const s = Date.now().toString().slice(-6);
const letras = (n) => [...String(n)].map((d) => "abcdefghij"[d]).join("");
const NOMBRE = `Invitado${letras(s)} Prueba`;
const TEL = `387 555 ${s.slice(-4)}`;
let invitado = null;
const b = await navegador();
try {
  invitado = (await q(
    `insert into public.invitados (gimnasio_id, sede_id, socio_id, nombre, dni, para_el_dia, entro_en) values ($1,$2,$3,$4,$5, now() - interval '1 day', now() - interval '1 day') returning id`,
    [gim, sede, socio, NOMBRE, `3${s}0`.slice(0, 8)]))[0].id;

  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios?vista=interesados`);
  const fila = d.locator(`[data-invitado="${invitado}"]`);
  await fila.waitFor({ timeout: 60000 });
  chequear(/invitado de/.test(await fila.innerText()), `Invitados para seguir: ${NOMBRE} aparece con quién lo trajo`, "no dice quién lo invitó");

  // Un WhatsApp mal escrito se rechaza con su motivo.
  await fila.locator("input").fill("123");
  await fila.getByRole("button", { name: /Anotar como interesado/ }).click();
  await fila.getByText(/WhatsApp: escribilo con característica/).waitFor({ timeout: 30000 });
  ok_("un WhatsApp sin característica se rechaza y dice cómo escribirlo");

  await fila.locator("input").fill(TEL);
  await fila.getByRole("button", { name: /Anotar como interesado/ }).click();
  await d.locator(`[data-invitado="${invitado}"]`).waitFor({ state: "detached", timeout: 60000 });
  chequear(true, "con su WhatsApp, el invitado sale de la lista de “para seguir”", "");
  const [p] = await q(`select nombre, telefono, invitado_id from public.prospectos where gimnasio_id = $1 and invitado_id = $2`, [gim, invitado]);
  chequear(!!p && p.nombre.includes(NOMBRE.split(" ")[0]) && !!p.telefono, `quedó como interesado en la base (${p?.nombre}, ${p?.telefono})`, "no quedó el interesado en la base");
  await d.reload();
  await d.locator("main h1").waitFor({ timeout: 60000 });
  chequear(await d.locator(`[data-invitado="${invitado}"]`).count() === 0, "al recargar no vuelve a la lista", "el invitado vuelve a la lista");
  chequear((await d.locator("main").innerText()).includes(NOMBRE.split(" ")[0]), "y aparece entre los interesados", "no aparece entre los interesados");

  // Celular: el invitado de prueba ya no está; se siembra otro para ver la tarjeta en 390 px.
  const invitado2 = (await q(
    `insert into public.invitados (gimnasio_id, sede_id, socio_id, nombre, dni, para_el_dia, entro_en) values ($1,$2,$3,$4,$5, now() - interval '2 days', now() - interval '2 days') returning id`,
    [gim, sede, socio, `${NOMBRE}2`, `4${s}0`.slice(0, 8)]))[0].id;
  const c = await pagina(b, CELU);
  c.setDefaultNavigationTimeout(120000);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/socios?vista=interesados`);
  await c.locator(`[data-invitado="${invitado2}"]`).waitFor({ timeout: 60000 });
  const w = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(w <= CELU.width + 1, "celular: Invitados para seguir sin desbordes", `se desborda: ${w}px`);
  await capturar(c, "q3-invitado-celu");
  await q(`delete from public.invitados where id = $1`, [invitado2]);
  for (const p2 of [d, c]) if (p2.errores.length) falla(p2.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await q(`delete from public.prospectos where gimnasio_id = $1 and invitado_id = $2`, [gim, invitado]).catch((e) => console.log(`aviso: ${e.message}`));
await q(`delete from public.invitados where id = $1`, [invitado]).catch((e) => console.log(`aviso: ${e.message}`));
await db.end();
await b.close();
resultado();

function ok_(m) { chequear(true, m, ""); }
