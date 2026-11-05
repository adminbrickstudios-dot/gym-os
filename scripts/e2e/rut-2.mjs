#!/usr/bin/env node
// RUT-2 · Rutina del socio: el profe asigna una rutina a “Testigo Al Día”
// buscándolo por nombre; el socio la ve en su app (“💪 Mi rutina”), anota
// 60 kg × 10 y le queda como “Última”. Al final se le quita y se archiva.
//   npm run e2e:rut-2            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const N = Date.now() % 100000;
const [{ id: ej }] = (await db.query(`insert into public.ejercicios (gimnasio_id, nombre, grupo) values ($1,$2,'piernas') returning id`, [gim, `Prensa e2e ${N}`])).rows;
const [{ id: rut }] = (await db.query(`insert into public.rutinas (gimnasio_id, nombre) values ($1,$2) returning id`, [gim, `Rutina app e2e ${N}`])).rows;
await db.query(`insert into public.rutina_ejercicios (gimnasio_id, rutina_id, dia, orden, ejercicio_id, series, repeticiones) values ($1,$2,1,1,$3,4,'10')`, [gim, rut, ej]);
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "profe@ejemplo.invalid");
  await p.goto(`${G}/panel/rutinas/editar?id=${rut}`);
  const asig = p.locator("[data-asignar-rutina]");
  await asig.waitFor({ timeout: 60000 });
  await asig.getByLabel("Buscar socio para asignar").fill("Testigo Al");
  const fila = asig.locator("li", { hasText: "Testigo Al Día" }).first();
  await fila.waitFor({ timeout: 30000 });
  await fila.getByRole("button", { name: "Asignar" }).click();
  await fila.getByText("✓ Asignada").waitFor({ timeout: 30000 });
  ok("el profe busca al socio y le asigna la rutina");

  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  await s.locator("[data-link-rutina]").click();
  await s.waitForURL(/\/app\/rutina/, { timeout: 30000 });
  const item = s.locator("li", { hasText: `Prensa e2e ${N}` });
  await item.waitFor({ timeout: 60000 });
  await item.getByRole("button", { name: /Anotar/ }).click();
  await item.getByLabel("Kilos").fill("60");
  await item.getByLabel("Repeticiones").fill("10");
  await item.getByRole("button", { name: "Guardar" }).click();
  await item.locator("[data-ultimo]").waitFor({ timeout: 30000 });
  chequear(/60 kg × 10/.test(await item.locator("[data-ultimo]").innerText()), "el socio anota 60 kg × 10 y le queda como “Última”", await item.locator("[data-ultimo]").innerText());
  const ancho = await s.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `Mi rutina en el celular sin desborde (${ancho}px)`, `desborda ${ancho}`);
  for (const x of [p, s]) if (x.errores.length) falla(x.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.rutinas_socio set quitada_en = now() where rutina_id = $1 and quitada_en is null`, [rut]);
  await db.query(`update public.rutinas set activa = false where id = $1`, [rut]);
  await db.query(`update public.ejercicios set activo = false where id = $1`, [ej]);
  await db.end();
}
await b.close();
resultado();
