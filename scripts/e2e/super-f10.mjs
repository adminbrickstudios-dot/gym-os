#!/usr/bin/env node
// Cierre de F2 con sesión real:
//  F2.6  gimnasio pausado / dado de baja / demo vencida: el panel muestra una pantalla clara (con "Hablar con BRIK" si hay WhatsApp)
//  F2.9  franja de mantenimiento programado arriba del panel
//  F2.7  "Copias de sus datos" en la ficha del gimnasio
//  F2.8  /admin/seguridad muestra dónde está abierta mi cuenta
//   node scripts/e2e/super-f10.mjs        (con scripts/local/levantar.sh corriendo; se corre en GitHub Actions)
// ESCRITO, NO EJECUTADO por quien lo escribió. Todo lo que cambia lo deja como estaba.
import { execSync } from "node:child_process";
import pg from "pg";
import { GIMNASIO, PLATAFORMA as B, aparece, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const q = async (sql, p) => (await db.query(sql, p)).rows;
const SLUG = "demo-box";
const [gim] = await q(`select id, es_demo, demo_hasta from public.gimnasios where slug = $1`, [SLUG]);
const [contacto] = await q(`select whatsapp from public.plataforma_contacto where id`);

const b = await navegador();
const p = await pagina(b);
p.setDefaultTimeout(30000);
const abrir = async (url) => { await p.goto(url); await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {}); };

try {
  if (!contacto?.whatsapp) await q(`update public.plataforma_contacto set whatsapp = '+5490001112223' where id`);
  await entrar(p, "box@ejemplo.invalid", undefined, GIMNASIO(SLUG));
  await abrir(`${GIMNASIO(SLUG)}/panel`);
  chequear(await p.locator("[data-estado-gimnasio]").count() === 0, "gimnasio normal: el panel abre", "el panel normal muestra la pantalla de estado");

  // F2.6: pausado
  await q(`update public.gimnasios set suspension_manual_en = now(), suspension_manual_motivo = 'e2e' where id = $1`, [gim.id]);
  await abrir(`${GIMNASIO(SLUG)}/panel`);
  chequear(await aparece(p.locator('[data-estado-gimnasio="pausado"]'), 20000), "pausado: pantalla 'Este gimnasio está pausado'", "no apareció la pantalla de pausado");
  chequear(await p.locator("[data-hablar-brik]").count() === 1, "con el WhatsApp de BRIK cargado, ofrece 'Hablar con BRIK'", "falta el botón para hablar con BRIK");
  await capturar(p, "f10-pausado", true);
  await q(`update public.gimnasios set suspension_manual_en = null, suspension_manual_motivo = null where id = $1`, [gim.id]);

  // F2.6: dado de baja
  await q(`update public.gimnasios set baja_en = now() where id = $1`, [gim.id]);
  await abrir(`${GIMNASIO(SLUG)}/panel`);
  chequear(await aparece(p.locator('[data-estado-gimnasio="baja"]'), 20000), "dado de baja: pantalla de baja", "no apareció la pantalla de baja");
  await q(`update public.gimnasios set baja_en = null where id = $1`, [gim.id]);

  // F2.6: demo vencida (panel y portada neutral en la landing)
  await q(`update public.gimnasios set es_demo = true, demo_hasta = now() - interval '1 day' where id = $1`, [gim.id]);
  await abrir(`${GIMNASIO(SLUG)}/panel`);
  chequear(await aparece(p.locator('[data-estado-gimnasio="demo_vencida"]'), 20000), "demo vencida: pantalla 'Esta demo venció'", "no apareció la pantalla de demo vencida");
  await q(`update public.gimnasios set es_demo = $2, demo_hasta = $3 where id = $1`, [gim.id, gim.es_demo, gim.demo_hasta]);

  // F2.9: mantenimiento
  await q(`insert into public.avisos_mantenimiento (desde, hasta, texto, creado_por) values (now() + interval '1 hour', now() + interval '2 hours', 'Prueba e2e de mantenimiento', (select usuario_id from public.administradores_plataforma limit 1))`).catch(async () =>
    q(`insert into public.avisos_mantenimiento (desde, hasta, texto) values (now() + interval '1 hour', now() + interval '2 hours', 'Prueba e2e de mantenimiento')`));
  // El aviso se cargó directo en la base (no por la acción del super admin, que invalida la caché al instante): la franja puede tardar hasta 60 s.
  const franja = p.locator("[data-mantenimiento]");
  let aparecio = false;
  for (let i = 0; i < 8 && !aparecio; i++) {
    await abrir(`${GIMNASIO(SLUG)}/panel`);
    aparecio = await aparece(franja, 5000);
    if (!aparecio) await new Promise((r) => setTimeout(r, 10000));
  }
  chequear(aparecio, "la franja de mantenimiento aparece arriba del panel", "no apareció la franja de mantenimiento ni recargando durante 80 s");
  await q(`delete from public.avisos_mantenimiento where texto = 'Prueba e2e de mantenimiento'`);

  // F2.7 y F2.8: super admin
  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  await abrir(`${B}/admin/${gim.id}`);
  chequear(await aparece(p.locator("[data-estado-copias]"), 30000), "la ficha muestra 'Copias de sus datos'", "la ficha no muestra el estado de copias");
  await abrir(`${B}/admin/seguridad`);
  chequear(await aparece(p.locator("[data-sesiones]"), 30000), "seguridad muestra dónde está abierta mi cuenta", "seguridad no muestra las sesiones");
  chequear((await q(`select 1 from public.huellas_brik`)).length >= 1, "el equipo desde el que entró quedó anotado", "no se anotó el equipo de BRIK");

  if (p.errores.length) falla(`errores en la página: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${e.message.split("\n")[0]}`);
  await capturar(p, "ROTA-super-f10", true).catch(() => {});
} finally {
  await q(`update public.gimnasios set suspension_manual_en = null, suspension_manual_motivo = null, baja_en = null, es_demo = $2, demo_hasta = $3 where id = $1`, [gim.id, gim.es_demo, gim.demo_hasta]).catch(() => {});
  await q(`delete from public.avisos_mantenimiento where texto = 'Prueba e2e de mantenimiento'`).catch(() => {});
  if (!contacto?.whatsapp) await q(`update public.plataforma_contacto set whatsapp = null where id`).catch(() => {});
  await db.end().catch(() => {});
}
await b.close();
resultado();
