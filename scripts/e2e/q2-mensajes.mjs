#!/usr/bin/env node
// Q2 · Mensajes: con más de 100 conversaciones, la bandeja muestra las primeras 100 y "Ver 100 más" trae el resto.
// Se siembran 105 hilos resueltos (con su marca) y se borran al terminar. Compu y celular.
//   node scripts/e2e/q2-mensajes.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const MARCA = `Q2 ver más ${Date.now().toString().slice(-6)}`;
const limpiar = async () => {
  await db.query(`delete from public.mensajes_socio where gimnasio_id = $1 and texto like $2`, [gim, `${MARCA}%`]);
  await db.query(`delete from public.hilos_socio h where h.gimnasio_id = $1 and not exists (select 1 from public.mensajes_socio m where m.hilo_id = h.id) and h.motivo = 'otro' and h.estado = 'resuelto' and h.ultimo_en < now() - interval '3 years'`, [gim]);
};
const b = await navegador();
try {
  const [{ n: antes }] = (await db.query(`select count(*)::int n from public.hilos_socio where gimnasio_id = $1 and estado = 'resuelto'`, [gim])).rows;
  const socios = (await db.query(`select id from public.socios where gimnasio_id = $1 order by id limit 105`, [gim])).rows;
  if (socios.length < 105) throw new Error(`el demo tiene ${socios.length} socios, hacen falta 105`);
  // Hilos de hace 3 años (para limpiar con certeza sin tocar otros) y resueltos: no mueven los "abiertos" de otros recorridos.
  for (const [i, s] of socios.entries()) {
    const [{ id }] = (await db.query(
      `insert into public.hilos_socio (gimnasio_id, socio_id, motivo, estado, creado_en, ultimo_en, ultimo_autor, resuelto_en)
       values ($1, $2, 'otro', 'resuelto', now() - interval '3 years' - ($3 || ' minutes')::interval, now() - interval '3 years' - ($3 || ' minutes')::interval, 'equipo', now() - interval '3 years') returning id`, [gim, s.id, String(i)])).rows;
    await db.query(`insert into public.mensajes_socio (gimnasio_id, hilo_id, autor, texto, creado_en) values ($1, $2, 'socio', $3, now() - interval '3 years')`, [gim, id, `${MARCA} ${i}`]);
  }
  const total = antes + 105;
  ok(`sembrados 105 hilos resueltos (${total} resueltos en total)`);

  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/mensajes?estado=resuelto`);
  await d.locator("[data-bandeja-mensajes]").waitFor({ timeout: 60000 });
  const filas = () => d.locator("[data-hilo]").count();
  chequear(await filas() === 100, "la bandeja muestra 100 conversaciones y avisa cuántas hay", `muestra ${await filas()}`);
  const aviso = await d.locator("[data-bandeja-recortada]").innerText();
  chequear(new RegExp(`100 de ${total}`).test(aviso), `dice “Se ven 100 de ${total}”`, `dice: ${aviso}`);
  await d.locator("[data-ver-mas-mensajes]").click();
  await d.waitForURL(/[?&]n=200/, { timeout: 60000 });
  await d.locator("[data-bandeja-mensajes]").waitFor({ timeout: 60000 });
  chequear(await filas() === Math.min(200, total), `“Ver 100 más” trae las que faltan (${Math.min(200, total)})`, `muestra ${await filas()}`);
  if (total <= 200) chequear(await d.locator("[data-ver-mas-mensajes]").count() === 0, "ya no ofrece más cuando se ven todas", "sigue ofreciendo más");

  const c = await pagina(b, CELU);
  c.setDefaultNavigationTimeout(120000);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/mensajes?estado=resuelto`);
  await c.locator("[data-bandeja-mensajes]").waitFor({ timeout: 60000 });
  const w = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(w <= CELU.width + 1, "celular: la bandeja con “Ver 100 más” sin desbordes", `se desborda: ${w}px`);
  chequear(await c.locator("[data-ver-mas-mensajes]").isVisible(), "celular: “Ver 100 más” a la vista", "no se ve el botón");
  await capturar(c, "q2-mensajes-celu");
  for (const p of [d, c]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await limpiar().catch((e) => console.log(`aviso: no se pudo limpiar: ${e.message}`));
// Los hilos sembrados: se borran por su mensaje (marca) y luego los hilos huérfanos sembrados.
await db.end();
await b.close();
resultado();
