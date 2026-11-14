#!/usr/bin/env node
// F2.11 (SA-10) · Sesiones abiertas del equipo de un gimnasio y "Cerrar todas" (sesión real del admin demo, rol Principal):
//   1. La ficha lista las sesiones abiertas del equipo (la de la recepción que acaba de entrar) con mail, dispositivo y última actividad.
//   2. "Cerrar todas" pide un motivo de 10 letras como mínimo y confirmación; las corta y queda en el registro de BRIK.
//   3. Después la lista queda vacía. Celular sin desborde.
//   node scripts/e2e/super-sesiones.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, PLATAFORMA as B, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url });
await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const b = await navegador();
try {
  // La recepción entra (abre una sesión del equipo).
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  const p = await pagina(b, COMPU);
  p.setDefaultTimeout(30000);
  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  await p.goto(`${B}/admin/${gim}`);
  const sec = p.locator("[data-ficha-sesiones]");
  await sec.waitFor({ timeout: 60000 });
  const lista = sec.locator("[data-sesion]");
  const antes = await lista.count();
  chequear(antes >= 1, `la ficha lista las sesiones abiertas del equipo (${antes})`, "la ficha no lista ninguna sesión");
  chequear(/recepcion@ejemplo\.invalid/.test(await sec.innerText()), "…entre ellas la de la recepción, con su mail", "no aparece la sesión de la recepción");
  await capturar(p, "sesiones-compu");

  const cerrar = sec.locator('button:has-text("Cerrar todas")');
  chequear(await cerrar.isDisabled(), "sin motivo, “Cerrar todas” está apagado", "se puede cerrar sin motivo");
  await sec.locator("[data-motivo-sesiones]").fill("corto");
  chequear(await cerrar.isDisabled(), "con un motivo de 5 letras, sigue apagado (hacen falta 10)", "se habilitó con un motivo corto");
  await sec.locator("[data-motivo-sesiones]").fill("Se fue una empleada y no devolvió la compu");
  await cerrar.click();
  await p.locator('[role="dialog"] button:has-text("Cerrar todas"), dialog button:has-text("Cerrar todas")').last().click();
  await sec.locator("[data-sesiones-cerradas]").waitFor({ timeout: 20000 });
  ok("Cerrar todas, con motivo y confirmación");
  const [{ n }] = (await db.query(`select count(*)::int n from auth.sessions s join public.equipo e on e.usuario_id = s.user_id where e.gimnasio_id = $1 and e.activo and not e.es_soporte
                                   and not exists (select 1 from public.administradores_plataforma a where a.usuario_id = s.user_id)`, [gim])).rows;
  chequear(n === 0, "en la base no queda ninguna sesión del equipo", `quedan ${n} sesiones`);
  const [reg] = (await db.query(`select detalle from public.registro_brik where gimnasio_id = $1 and accion = 'cerrar_sesiones_gimnasio' order by creado_en desc limit 1`, [gim])).rows;
  chequear(!!reg && /empleada/.test(reg.detalle.motivo) && reg.detalle.sesiones >= 1, "queda en el registro de BRIK con el motivo y cuántas se cerraron", `registro: ${JSON.stringify(reg?.detalle)}`);
  await p.reload();
  await p.locator("[data-ficha-sesiones]").waitFor({ timeout: 60000 });
  chequear(/Nadie del equipo tiene una sesión abierta/.test(await p.locator("[data-ficha-sesiones]").innerText()), "la lista queda vacía y lo dice", "la lista no quedó vacía");
  await p.setViewportSize(CELU);
  chequear(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "celular: sin desborde", "la ficha desborda en el celular");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.stack : e.message.split("\n")[0]}`);
}
await db.end();
await b.close();
resultado();
