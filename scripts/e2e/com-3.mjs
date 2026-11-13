#!/usr/bin/env node
// COM-3 · Avisar a los anotados de una clase: la recepción abre una clase con
// reservas, escribe "{clase} del {dia} arranca tarde", arma un WhatsApp por
// persona (con su nombre) y el aviso queda anotado en la clase.
//   npm run e2e:com-3            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const conReservas = async () => (await db.query(`select c.id, count(r.*)::int n from public.clases c join public.gimnasios g on g.id = c.gimnasio_id and g.slug = 'demo'
  join public.reservas r on r.clase_id = c.id and r.estado <> 'cancelada'
  where c.inicio > now() and c.cancelada_en is null group by c.id order by c.inicio limit 1`)).rows;
let filas = await conReservas();
const b = await navegador();
try {
  if (!filas.length) {
    // Sola en una base nueva (las tandas de Actions arrancan sin lo que dejaban los recorridos de antes): abre las clases de la semana
    // (se arman al mirar la grilla) y anota a un socio en la próxima.
    const a = await pagina(b, COMPU);
    await entrar(a, "recepcion@ejemplo.invalid");
    await a.goto(`${G}/panel/clases`);
    await a.locator("main h1").first().waitFor({ timeout: 60000 });
    const { rows: [prox] } = await db.query(`select c.id, c.gimnasio_id from public.clases c join public.gimnasios g on g.id = c.gimnasio_id and g.slug = 'demo'
      where c.inicio > now() and c.cancelada_en is null order by c.inicio limit 1`);
    if (!prox) throw new Error("el demo no tiene clases futuras con reservas (ni se armaron al abrir Clases)");
    await db.query(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado)
      select $1, $2, s.id, 'confirmada' from public.socios s where s.gimnasio_id = $1 and s.nombre = 'Testigo' and s.apellido = 'Al Día'`, [prox.gimnasio_id, prox.id]);
    await a.context().close();
    filas = await conReservas();
  }
  if (!filas.length) throw new Error("el demo no tiene clases futuras con reservas");
  const [{ id: clase, n }] = filas;
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/clases/${clase}`);
  const caja = r.locator("[data-avisar-clase]");
  await caja.waitFor({ timeout: 60000 });
  await caja.locator('button:has-text("Avisar a todos")').click();
  await caja.locator("textarea").fill("Hola {nombre}! {clase} del {dia} arranca 15 minutos tarde 🙏");
  await caja.locator('button[type="submit"]').click();
  const lista = caja.locator("[data-mensajes-clase]");
  await lista.waitFor({ timeout: 30000 });
  const links = await lista.locator('a[href*="wa.me"]').evaluateAll((xs) => xs.map((x) => decodeURIComponent(x.getAttribute("href"))));
  chequear(Number(await lista.getAttribute("data-mensajes-clase")) >= n && links.every((l) => /\?text=Hola \S+! .+ del \d\d\/\d\d a las \d\d:\d\d arranca 15 minutos tarde/.test(l)),
    `📣 Avisar a todos: ${await lista.getAttribute("data-mensajes-clase")} mensajes, cada uno con su nombre, la clase y el día`, links.slice(0, 2).join(" | "));
  await r.reload();
  chequear(await aparece(r.locator("[data-avisos-previos]"), 30000) && /arranca 15 minutos tarde/.test(await r.locator("[data-avisos-previos]").innerText()),
    "el aviso queda anotado en la clase (quién, cuándo, a cuántos)", "el aviso no quedó anotado");
  await capturar(r, "com3-compu-clase");
  if (r.errores.length) falla(r.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.end();
}
await b.close();
resultado();
