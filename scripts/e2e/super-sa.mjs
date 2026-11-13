#!/usr/bin/env node
// Super admin · F2.10 y F2.11 con sesión real del admin demo (admin@ejemplo.invalid, rol Principal):
//  F2.10  la ficha del gimnasio (Datos) carga CUIT y razón social: un CUIT con dígito verificador malo avisa y no deja guardar;
//         uno bueno se guarda con 11 cifras, se ve con guiones al recargar y queda en el registro de BRIK.
//  F2.11  la ficha lista las sesiones abiertas del equipo; "Cerrar todas" pide motivo y confirmación, las corta y queda en el registro.
// Las sesiones se siembran directo en la base local (auth.sessions) para no depender de cuántas abrió otro recorrido.
//   node scripts/e2e/super-sa.mjs        (con scripts/local/levantar.sh corriendo; se corre en GitHub Actions)
// ESCRITO, NO EJECUTADO por quien lo escribió (en esta compu no hay base ni app): hay que correrlo en Actions.
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, PLATAFORMA as B, aparece, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const q = async (sql, p) => (await db.query(sql, p)).rows;
const [gim] = await q(`select id, nombre from public.gimnasios where slug = 'demo'`);
if (!gim) throw new Error("falta el gimnasio demo");
const [recep] = await q(`select usuario_id, nombre from public.equipo where gimnasio_id = $1 and rol = 'recepcion' and activo and not es_soporte and usuario_id is not null limit 1`, [gim.id]);
if (!recep) throw new Error("el demo no tiene recepción con cuenta");

const b = await navegador();
const p = await pagina(b);
p.setDefaultTimeout(30000);
const abrir = async (ruta) => { await p.goto(`${B}${ruta}`); await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {}); };
async function esperarBase(sql, params, que = (r) => r.length > 0) {
  for (let i = 0; i < 40; i++) { if (que(await q(sql, params))) return true; await new Promise((r) => setTimeout(r, 500)); }
  return false;
}
async function ver(nombre) {
  await p.setViewportSize(CELU);
  await p.waitForFunction((w) => window.innerWidth === w, CELU.width);
  await capturar(p, `sa-${nombre}-celu`, true);
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width + 4, `celular: ${nombre} sin desborde (${ancho}px)`, `celular: ${nombre} mide ${ancho}px y se desborda`);
  await p.setViewportSize(COMPU);
  await capturar(p, `sa-${nombre}-compu`, true);
}

try {
  await q(`delete from public.datos_fiscales_gimnasio where gimnasio_id = $1`, [gim.id]);
  await q(`delete from auth.sessions where user_id = $1`, [recep.usuario_id]);
  await q(`insert into auth.sessions (user_id, user_agent) values ($1, 'Chrome e2e mostrador'), ($1, 'Safari e2e celular')`, [recep.usuario_id]);

  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  await abrir(`/admin/${gim.id}`);

  // ── F2.10 ──
  const fiscal = p.locator("[data-datos-fiscales]");
  chequear(await aparece(fiscal, 30000), "la ficha tiene CUIT y razón social en Datos", "la ficha no muestra CUIT y razón social");
  await fiscal.locator("[data-cuit]").fill("20-12345678-5");
  await fiscal.locator("[data-razon-social]").fill("Demo Fiscal SRL");
  chequear(await aparece(fiscal.locator("[data-cuit-aviso]"), 5000), "un CUIT con dígito verificador malo avisa en palabras", "el CUIT malo no avisó");
  chequear(await fiscal.locator("[data-guardar-fiscales]").isDisabled(), "y no deja guardar", "dejó guardar un CUIT inválido");
  await fiscal.locator("[data-cuit]").fill("20-12345678-6");
  chequear(await fiscal.locator("[data-cuit-aviso]").count() === 0, "con el CUIT bueno el aviso se va", "el aviso no se fue con el CUIT bueno");
  await fiscal.locator("[data-guardar-fiscales]").click();
  chequear(await aparece(fiscal.locator("[data-fiscales-guardado]"), 20000), "guardar dice 'Guardado.'", "no apareció el cartel de guardado");
  chequear(await esperarBase(`select 1 from public.datos_fiscales_gimnasio where gimnasio_id = $1 and cuit = '20123456786' and razon_social = 'Demo Fiscal SRL'`, [gim.id]),
    "en la base quedó el CUIT con 11 cifras y la razón social", "la base no tiene los datos fiscales");
  chequear((await q(`select 1 from public.registro_brik where gimnasio_id = $1 and accion = 'guardar_datos_fiscales'`, [gim.id])).length >= 1,
    "quedó en el registro de BRIK", "no quedó en el registro de BRIK");
  await abrir(`/admin/${gim.id}`);
  chequear((await p.locator("[data-cuit]").inputValue()) === "20-12345678-6", "al recargar el CUIT se ve con guiones", "al recargar el CUIT no se ve con guiones");
  chequear(await aparece(p.locator("[data-fiscales-quien]"), 10000), "se ve quién lo cambió y cuándo", "no se ve quién cambió los datos");
  await ver("fiscales");

  // ── F2.11 ──
  const sesiones = p.locator("[data-ficha-sesiones]");
  chequear(await aparece(sesiones.locator("[data-sesion-persona]"), 20000), "la ficha lista las personas del equipo con sus sesiones", "la ficha no lista las sesiones del equipo");
  const fila = sesiones.locator(`[data-sesion-persona]:has-text("${recep.nombre}")`);
  chequear((await fila.getAttribute("data-sesiones")) === "2", "la recepción figura con 2 sesiones abiertas", "la recepción no figura con 2 sesiones");
  await ver("sesiones");
  chequear(await sesiones.locator("[data-cerrar-sesiones]").isDisabled(), "sin motivo, 'Cerrar todas' está deshabilitado", "'Cerrar todas' se puede apretar sin motivo");
  await sesiones.locator("[data-motivo-sesiones]").fill("Se fue mal la recepcionista (e2e)");
  await sesiones.locator("[data-cerrar-sesiones]").click();
  await p.locator("[data-confirmar-ok]").click();
  chequear(await aparece(sesiones.locator("[data-sesiones-cerradas]"), 20000), "cerrar dice cuántas sesiones se cortaron", "no apareció el resultado de cerrar las sesiones");
  chequear(await esperarBase(`select 1 where not exists (select 1 from auth.sessions where user_id = $1)`, [recep.usuario_id]), "las sesiones de la recepción ya no existen en la base", "las sesiones de la recepción siguen abiertas");
  chequear(await esperarBase(`select 1 from public.registro_brik where gimnasio_id = $1 and accion = 'cerrar_sesiones' and detalle ->> 'motivo' = 'Se fue mal la recepcionista (e2e)'`, [gim.id]),
    "queda en el registro de BRIK con su motivo", "no quedó en el registro de BRIK");
  await abrir(`/admin/${gim.id}`);
  chequear(await fila.getAttribute("data-sesiones") === "0", "al recargar la recepción figura sin sesiones", "al recargar la recepción sigue con sesiones");

  if (p.errores.length) falla(`errores en la página: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${e.message.split("\n")[0]}`);
  await capturar(p, "ROTA-super-sa", true).catch(() => {});
} finally {
  await q(`delete from public.datos_fiscales_gimnasio where gimnasio_id = $1`, [gim.id]).catch(() => {});
  await db.end().catch(() => {});
}
await b.close();
resultado();
