#!/usr/bin/env node
// Q3 · FA-22: en Control, "Entradas para mirar" avisa (sin frenar a nadie) cuando un socio entró en dos sedes con
// pocos minutos de diferencia, y cuando entró muchas más veces de las normales en un día. Se siembran una segunda sede
// y dos socios de prueba por SQL, y se borran al terminar. Compu y celular.
//   node scripts/e2e/q3-patrones.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const q = async (sql, p) => (await db.query(sql, p)).rows;
const [{ id: gim }] = await q(`select id from public.gimnasios where slug = 'demo'`);
const [{ id: sede1 }] = await q(`select id from public.sedes where gimnasio_id = $1 and es_principal`, [gim]);
const s = Date.now().toString().slice(-6);
const letras = (n) => [...String(n)].map((d) => "abcdefghij"[d]).join("");
const SELLO = letras(s);
const NOMBRE_DOBLE = `Doble${SELLO}`, NOMBRE_MUCHAS = `Muchas${SELLO}`;
let sede2 = null, doble = null, muchas = null;
const ing = (socio, sede, minutosAtras) => q(
  `insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto)
   values ($1,$2,$3, now() - ($4 || ' minutes')::interval, 'recepcion', 'entro', 'verde', 'al_dia', 'Pasá')`, [gim, sede, socio, String(minutosAtras)]);
const limpiar = async () => {
  for (const id of [doble, muchas]) if (id) await q(`delete from public.ingresos where socio_id = $1`, [id]);
  for (const id of [doble, muchas]) if (id) await q(`delete from public.socios where id = $1`, [id]);
  if (sede2) await q(`delete from public.sedes where id = $1`, [sede2]);
};
const b = await navegador();
try {
  sede2 = (await q(`insert into public.sedes (gimnasio_id, nombre) values ($1, $2) returning id`, [gim, `Sede Norte ${SELLO}`]))[0].id;
  doble = (await q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,$2,'Prueba','+5490000555001') returning id`, [gim, NOMBRE_DOBLE]))[0].id;
  muchas = (await q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,$2,'Prueba','+5490000555002') returning id`, [gim, NOMBRE_MUCHAS]))[0].id;
  // Doble: la sede principal y, 10 minutos después, la otra (hace unas horas). Muchas: 5 entradas en la misma media hora (hace ~30 h).
  await ing(doble, sede1, 190);
  await ing(doble, sede2, 180);
  for (const m of [1800, 1795, 1790, 1785, 1780]) await ing(muchas, sede1, m);

  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/control`);
  const caja = d.locator("[data-alertas-patron]");
  await caja.waitFor({ timeout: 60000 });
  const fila2 = d.locator('[data-patron="dos_sedes"]', { hasText: NOMBRE_DOBLE });
  await fila2.waitFor({ timeout: 30000 });
  const t2 = await fila2.innerText();
  chequear(/10 minutos/.test(t2) && /Sede Norte/.test(t2), `dos sedes: “${t2.replace(/\n/g, " ")}”`, `dos sedes dice: ${t2}`);
  const filaM = d.locator('[data-patron="muchas_entradas"]', { hasText: NOMBRE_MUCHAS });
  await filaM.waitFor({ timeout: 30000 });
  chequear(/entró 5 veces/.test(await filaM.innerText()), `muchas entradas: “${(await filaM.innerText()).replace(/\n/g, " ")}”`, `muchas entradas dice: ${await filaM.innerText()}`);
  chequear(/no frenan a nadie/.test(await caja.innerText()), "es solo un aviso: dice que no frena a nadie", "falta aclarar que no frena a nadie");
  const href = await fila2.locator("a").first().getAttribute("href");
  chequear(/\/panel\/socios\//.test(href ?? ""), "el nombre lleva a la ficha del socio", `el link va a ${href}`);

  const c = await pagina(b, CELU);
  c.setDefaultNavigationTimeout(120000);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/control`);
  await c.locator("[data-alertas-patron]").waitFor({ timeout: 60000 });
  const w = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(w <= CELU.width + 1, "celular: Control con las alertas sin desbordes", `se desborda: ${w}px`);
  await capturar(c, "q3-patrones-celu");

  // Sin sesión de dueño no se ve: la recepción no recibe estas alertas (la base las pide solo al dueño y al encargado).
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/control`).catch(() => {});
  chequear(await r.locator("[data-alertas-patron]").count() === 0, "la recepción no ve las alertas por patrón", "la recepción ve las alertas por patrón");
  for (const p of [d, c]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await limpiar().catch((e) => console.log(`aviso: no se pudo limpiar: ${e.message}`));
await db.end();
await b.close();
resultado();
