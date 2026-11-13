#!/usr/bin/env node
// N10 · Cuánto deja un socio y cuánto dura, en Resultado, en el gimnasio DEMO (nunca Temple Gym):
//   APAGADA (por defecto): Resultado no muestra nada de esto.
//   PRENDIDA por la dueña desde Configuración → Funciones nuevas: aparecen los dos números, y coinciden con lo que calcula la base
//   (se le pregunta a `valor_del_socio` con la sesión de la dueña). En el mes anterior no se muestra (es una foto de hoy). Compu y celular.
//   La encargada sin acceso al Resultado no puede ni abrirlo (lo cubre la prueba de base).
//   node scripts/e2e/n-valor.mjs     (con scripts/local/levantar.sh corriendo; se corre en GitHub Actions)
// ESCRITO, NO EJECUTADO por quien lo escribió (en esta compu no hay base ni app): hay que correrlo en Actions.
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const q = async (sql, p) => (await db.query(sql, p)).rows;
const [{ id: gim }] = await q(`select id from public.gimnasios where slug = 'demo'`);
if ((await q(`select es_demo from public.gimnasios where id = $1`, [gim]))[0].es_demo === false) throw new Error("el gimnasio demo no está marcado como demo");
const [duena] = await q(`select e.usuario_id from public.equipo e join auth.users u on u.id = e.usuario_id where e.gimnasio_id = $1 and u.email = 'duena@ejemplo.invalid' limit 1`, [gim]);
if (!duena) throw new Error("falta la dueña del demo");
const digitos = (t) => String(t).replace(/\D/g, "");

/** Lo que la base le contesta a la dueña (sesión simulada con su JWT, dentro de una transacción que se revierte). */
async function laBase() {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: duena.usuario_id, role: "authenticated" })]);
    return (await db.query(`select public.valor_del_socio($1) r`, [gim])).rows[0].r;
  } finally { await db.query("rollback"); }
}

await q(`delete from public.funciones_nuevas_gimnasio where gimnasio_id = $1 and clave = 'valor_del_socio'`, [gim]);
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");

  // ── Apagada ──
  await d.goto(`${G}/panel/resultado`);
  await d.locator("[data-resultado-cobrado]").waitFor({ timeout: 60000 });
  chequear(await d.locator("[data-valor-socio]").count() === 0, "apagada: Resultado no muestra cuánto deja un socio", "apagada: Resultado ya muestra cuánto deja un socio");
  chequear(await d.locator("[data-resultado-cobrado]").count() === 1 && /Recurrente por mes/.test(await d.locator("main").innerText()), "lo de siempre sigue (cobrado, altas, bajas, recurrente)", "falta lo de siempre en Resultado");

  // ── Prenderla desde Configuración ──
  await d.goto(`${G}/panel/configuracion?pestana=funciones`);
  await d.locator('[data-funciones-nuevas="listo"]').waitFor({ timeout: 60000 });
  chequear(await d.locator('[data-funcion="valor_del_socio"]').count() === 1, "la función está en Funciones nuevas", "la función no figura en Funciones nuevas");
  chequear(await d.locator('[data-funcion="valor_del_socio"]').getAttribute("data-activa") === "no", "y viene apagada", "viene prendida de fábrica");
  await d.locator('[data-funcion="valor_del_socio"] input[role="switch"]').click();
  await d.locator('[data-funcion="valor_del_socio"][data-activa="si"]').waitFor({ timeout: 30000 });
  ok_("la dueña la prende");

  // ── Prendida ──
  await d.goto(`${G}/panel/resultado`);
  chequear(await aparece(d.locator("[data-valor-socio]"), 60000), "prendida: aparece 'Cuánto deja un socio'", "prendida: no aparece 'Cuánto deja un socio'");
  const real = await laBase();
  const deja = await d.locator("[data-valor-deja]").innerText();
  const dura = await d.locator("[data-valor-dura]").innerText();
  chequear(real.deja_por_mes === null ? deja.trim() === "—" : digitos(deja).startsWith(String(Math.round(Number(real.deja_por_mes)))),
    `lo que deja por mes (${deja.trim()}) coincide con la base (${real.deja_por_mes})`, `lo que deja por mes (${deja.trim()}) no coincide con la base (${real.deja_por_mes})`);
  chequear(real.dura_meses === null ? dura.trim() === "—" : digitos(dura) === digitos(String(real.dura_meses).replace(".", ",")),
    `cuánto se queda (${dura.trim()}) coincide con la base (${real.dura_meses})`, `cuánto se queda (${dura.trim()}) no coincide con la base (${real.dura_meses})`);
  chequear(/Es plata cobrada|Todavía no hay socios/.test(await d.locator("[data-valor-explicacion]").innerText()), "dice de dónde sale cada número", "falta la explicación de los números");
  await capturar(d, "n-valor-compu", true);
  await d.setViewportSize(CELU);
  await capturar(d, "n-valor-celu", true);
  const ancho = await d.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width + 4, `celular: sin desborde (${ancho}px)`, `celular: mide ${ancho}px y se desborda`);
  await d.setViewportSize(COMPU);

  // ── El mes anterior no lo muestra (es de hoy) ──
  const ahora = new Date(); ahora.setUTCDate(1); ahora.setUTCMonth(ahora.getUTCMonth() - 1);
  await d.goto(`${G}/panel/resultado?mes=${ahora.toISOString().slice(0, 7)}`);
  await d.locator("[data-resultado-cobrado]").waitFor({ timeout: 60000 });
  chequear(await d.locator("[data-valor-socio]").count() === 0, "en el mes anterior no se muestra (es una foto de hoy)", "se muestra en el mes anterior");

  // ── Apagarla de nuevo ──
  await d.goto(`${G}/panel/configuracion?pestana=funciones`);
  await d.locator('[data-funciones-nuevas="listo"]').waitFor({ timeout: 60000 });
  await d.locator('[data-funcion="valor_del_socio"] input[role="switch"]').click();
  await d.locator('[data-funcion="valor_del_socio"][data-activa="no"]').waitFor({ timeout: 30000 });
  await d.goto(`${G}/panel/resultado`);
  await d.locator("[data-resultado-cobrado]").waitFor({ timeout: 60000 });
  chequear(await d.locator("[data-valor-socio]").count() === 0, "apagada otra vez: vuelve a no mostrarse", "apagada otra vez: sigue mostrándose");
  if (d.errores?.length) falla(`errores en la página: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${e.message.split("\n")[0]}`);
} finally {
  await q(`delete from public.funciones_nuevas_gimnasio where gimnasio_id = $1 and clave = 'valor_del_socio'`, [gim]).catch(() => {});
  await db.end().catch(() => {});
}
await b.close();
resultado();

function ok_(m) { chequear(true, m, m); }
