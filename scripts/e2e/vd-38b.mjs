#!/usr/bin/env node
// VD-38b · El contador de Mensajes en el menú del panel: llega un mensaje de un socio y el menú de la dueña
// muestra el número en "Mensajes" (neutro, no rojo); al contestar, el número baja sin recargar a mano.
//   node scripts/e2e/vd-38b.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const s5 = Date.now().toString().slice(-6);
const TEXTO = `Consulta del contador ${s5}`;
const numero = async (p) => {
  const n = p.locator('aside [data-pendiente="mensajes"]');
  return (await n.count()) ? Number(await n.getAttribute("data-numero")) : 0;
};

const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  await d.locator("aside").waitFor({ timeout: 60000 });
  await d.waitForTimeout(1500);   // los números del menú se piden después de abrir
  const antes = await numero(d);
  ok(`antes: Mensajes lleva ${antes}`);

  // Un socio escribe.
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app/mensajes/nuevo`);
  await s.locator('[data-motivo="consulta"]').check({ force: true });
  await s.locator('textarea[name="texto"]').fill(TEXTO);
  await s.locator("[data-enviar-mensaje]").click();
  await s.waitForURL(/\/app\/mensajes\/[0-9a-f-]{36}/, { timeout: 60000 });
  ok("el socio envía su mensaje");
  const hiloId = new URL(s.url()).pathname.split("/").pop();

  // El menú de la dueña lo cuenta (al abrir cualquier pantalla del panel).
  await d.goto(`${G}/panel`);
  await d.locator(`aside [data-pendiente="mensajes"]`).first().waitFor({ timeout: 30000 });
  const despues = await numero(d);
  chequear(despues === antes + 1, `llegó un mensaje: Mensajes pasa de ${antes} a ${despues}`, `el contador no subió (${antes} → ${despues})`);
  chequear((await d.locator('aside [data-pendiente="mensajes"]').getAttribute("data-rojo")) === "no", "el número de Mensajes es neutro (no se pierde nada hoy)", "Mensajes está en rojo");
  await capturar(d, "vd38b-compu-menu");

  // Contesta: el número baja.
  await d.goto(`${G}/panel/mensajes`);
  await d.locator("[data-hilo]", { hasText: TEXTO }).first().click();
  await d.locator("[data-hilo-abierto]").waitFor({ timeout: 30000 });
  await d.locator("[data-texto-respuesta]").fill(`Gracias por escribir (${s5})`);
  await d.locator("[data-enviar-respuesta]").click();
  await d.locator(`[data-hilo-abierto] [data-autor="equipo"]`, { hasText: s5 }).waitFor({ timeout: 30000 });
  ok("la dueña contesta");
  let ahora = despues;
  for (let i = 0; i < 20 && ahora !== antes; i++) { await d.waitForTimeout(500); ahora = await numero(d); }
  chequear(ahora === antes, `al contestar baja solo: ${ahora}`, `el contador no bajó (${ahora}, esperaba ${antes})`);
  const [h] = (await db.query(`select estado from public.hilos_socio where id = $1`, [hiloId])).rows;
  chequear(h?.estado === "en_curso", "el hilo quedó en curso", `estado raro: ${JSON.stringify(h)}`);

  // Celular: el menú tiene el punto y no desborda.
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel`);
  chequear((await c.evaluate(() => document.documentElement.scrollWidth)) <= CELU.width, "panel en celular 390 px: sin desborde", "el panel desborda en el celular");
  if (d.errores.length) falla(`panel: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.end();   // el hilo queda contestado: no suma al contador
  await b.close();
}
resultado();
