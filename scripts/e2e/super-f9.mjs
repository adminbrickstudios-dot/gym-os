#!/usr/bin/env node
// Fase 9 del super admin, con sesión real del admin demo:
//  F9.1  /admin/plantillas: guardar una plantilla de la plataforma, "Se actualizaron N gimnasios", y restaurar por defecto
//  F9.4/6  /admin muestra alertas, límites por plan y tablas que crecen; /admin/registro pagina de a 50
//  ESC-06  GET /api/salud responde 200 sin datos sensibles
//  F2    "Ver como este socio" (solo lectura) y casilla "el dueño me pidió tocar plata" al entrar como soporte
//   node scripts/e2e/super-f9.mjs        (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { PLATAFORMA as B, aparece, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url });
await db.connect();
const q = async (sql, params) => (await db.query(sql, params)).rows;

const b = await navegador();
const p = await pagina(b);
p.setDefaultTimeout(30000);
const abrir = async (ruta) => { await p.goto(`${B}${ruta}`); await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {}); };
const TEXTO = `Entrená con nosotros ${Date.now().toString().slice(-5)}`;

try {
  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  chequear(p.url().endsWith("/admin"), "el admin entra al super admin", `cayó en ${p.url()}`);

  // ── ESC-06: el chequeo de salud (pública, sin secretos) ──
  const r = await p.request.get(`${B}/api/salud`);
  const cuerpo = await r.text();
  chequear(r.status() === 200, "/api/salud responde 200", `/api/salud respondió ${r.status()}: ${cuerpo.slice(0, 120)}`);
  chequear(!/eyJ|service_role|sb_secret/.test(cuerpo), "/api/salud no muestra ninguna clave", "/api/salud muestra algo con pinta de clave");

  // ── F9.1: plantillas globales ──
  await abrir("/admin/plantillas");
  const bloque = p.locator('[data-plantilla="landing.bajada:plataforma"]');
  chequear(await aparece(bloque, 20000), "la pantalla de plantillas muestra el texto de la bajada", "no apareció la plantilla de la bajada");
  await bloque.locator("input").fill(TEXTO);
  await bloque.locator("[data-guardar-plantilla]").click();
  chequear(await aparece(p.getByText(/Se actualizaron \d+ gimnasios?/), 30000), "guardar dice a cuántos gimnasios llegó el cambio", "no apareció 'Se actualizaron N gimnasios'");
  chequear((await q(`select 1 from public.plantillas_texto where clave = 'landing.bajada' and tipo is null and valor = $1`, [TEXTO])).length === 1, "la plantilla quedó en la base", "la plantilla no quedó guardada");
  await bloque.locator("[data-restaurar-plantilla]").click();
  await p.waitForFunction(() => !document.querySelector('[data-plantilla="landing.bajada:plataforma"] [data-restaurar-plantilla]'), null, { timeout: 30000 }).catch(() => {});
  chequear((await q(`select 1 from public.plantillas_texto where clave = 'landing.bajada' and tipo is null and valor = $1`, [TEXTO])).length === 0, "Restaurar por defecto la saca de la base", "la plantilla sigue guardada después de restaurar");
  await capturar(p, "f9-plantillas", true);

  // ── F9.4 / F9.6: alertas, límites y tablas que crecen en el tablero ──
  await abrir("/admin");
  chequear(await aparece(p.locator("[data-escala]"), 30000), "el tablero muestra el bloque de escala", "el tablero no muestra el bloque de escala");
  chequear(await p.locator("[data-tablas-crecen]").count() === 1, "se ven las tablas que crecen", "no se ven las tablas que crecen");
  chequear(await p.locator("[data-limites]").count() === 1, "se ven los límites por plan", "no se ven los límites por plan");

  // ── ESC-05: el registro de BRIK pagina de a 50 ──
  const admin = (await q(`select usuario_id from public.administradores_plataforma limit 1`))[0].usuario_id;
  for (let i = 0; i < 55; i++) await q(`insert into public.registro_brik (usuario_id, accion, creado_en) values ($1, 'e2e_pagina', now() - ($2 || ' seconds')::interval)`, [admin, String(i + 1)]);
  await abrir("/admin/registro");
  const filas = await p.locator("li, tr").count();
  chequear(filas >= 40 && filas < 120, `el registro muestra una página (${filas} filas), no todo`, `el registro muestra ${filas} filas`);
  chequear(await aparece(p.getByText(/Ver más antiguos/), 15000), "hay 'Ver más antiguos'", "no apareció 'Ver más antiguos'");

  // ── F2: ver como este socio y la casilla de plata ──
  const socio = (await q(`select s.id, s.gimnasio_id from public.socios s limit 1`))[0];
  await abrir(`/admin/ver-socio?g=${socio.gimnasio_id}&s=${socio.id}`);
  chequear(await aparece(p.locator("[data-ver-socio]"), 20000), "'Ver como este socio' abre y muestra su estado", "no abrió 'Ver como este socio'");
  chequear((await q(`select 1 from public.registro_brik where accion = 'ver_como_socio' and gimnasio_id = $1`, [socio.gimnasio_id])).length >= 1, "ver como socio quedó en el registro de BRIK", "no quedó registrado");
  await abrir(`/admin/${socio.gimnasio_id}`);
  await p.locator("[data-entrar-soporte]").first().click();
  chequear(await aparece(p.locator("[data-plata-soporte]"), 15000), "al entrar como soporte se ofrece la casilla de plata (apagada por defecto)", "no apareció la casilla de plata");
  chequear(!(await p.locator("[data-plata-soporte]").isChecked()), "la casilla de plata viene sin tildar", "la casilla de plata viene tildada");

  if (p.errores.length) falla(`errores en la página: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${e.message.split("\n")[0]}`);
  await capturar(p, "ROTA-super-f9", true).catch(() => {});
} finally {
  await q(`delete from public.plantillas_texto where clave = 'landing.bajada' and tipo is null and valor = $1`, [TEXTO]).catch(() => {});
  await db.end().catch(() => {});
}
await b.close();
resultado();
