#!/usr/bin/env node
// EQU-1 · Permisos por gimnasio (D4): la dueña apaga "la recepción vende
// productos" y "el encargado ve el Resultado" desde Equipo; la recepción ya no
// ve productos en Vender y el encargado no tiene Resultado. Al final vuelven.
//   npm run e2e:equ-1            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const leer = async () => (await db.query(`select recepcion_vende_productos v, encargado_ve_resultado r from public.configuracion_gimnasio where gimnasio_id = $1`, [gim])).rows[0];
const esperar = async (cond) => { for (let i = 0; i < 40; i++) { if (cond(await leer())) return true; await new Promise((r) => setTimeout(r, 500)); } return false; };
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/equipo`);
  const caja = d.locator("[data-permisos]");
  await caja.waitFor({ timeout: 60000 });
  await caja.locator('[data-permiso="recepcion_vende_productos"]').uncheck();
  await caja.locator('[data-permiso="encargado_ve_resultado"]').uncheck();
  chequear(await esperar((x) => !x.v && !x.r), "Equipo → 🔐 la dueña apaga “la recepción vende productos” y “el encargado ve el Resultado” (se guarda al tocar)", JSON.stringify(await leer()));

  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/vender`);
  await r.locator("main h1").waitFor({ timeout: 60000 });
  await r.waitForLoadState("networkidle").catch(() => {});
  chequear(await r.getByText("").count() === 0, "la recepción: en Vender no aparecen productos", "aparecen productos");

  const e = await pagina(b, COMPU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel/resultado`);
  await e.getByText(/apagada|no le dio acceso/).first().waitFor({ timeout: 60000 });
  chequear(await e.locator('nav a[href$="/resultado"]').count() === 0, "el encargado: Resultado no está en el menú y entrando por la dirección dice que no", "sigue en el menú");
  for (const p of [d, r]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (err) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? err.message : err.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.configuracion_gimnasio set recepcion_vende_productos = true, encargado_ve_resultado = true where gimnasio_id = $1`, [gim]);
  await db.end();
}
ok("los permisos vuelven a como estaban");
await b.close();
resultado();
