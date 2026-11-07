#!/usr/bin/env node
// VD-58 · Turnos con personal trainer: la dueña arma un pack y carga horarios de un PT; el socio (con su pack, que el cobro de Vender deja)
// reserva desde la app, ve que le baja una sesión y cancela (se la devuelven); la recepción ve la reserva y puede reservar por otro socio
// pero no toca los packs; el PT marca "se dio" cuando empezó. Celular sin desborde. Con la sección apagada no abre.
//   npm run e2e:vd-58            (con scripts/local/levantar.sh corriendo)
// NO se ejecutó al escribirlo. El cobro del pack lo prueba la base (supabase/pruebas/turnos-pt.test.mjs, con public.vender); acá la venta
// confirmada se deja por SQL, como queda después de Cobrar.
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, entrarSocio, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const PACK = `Pack PT ${s5}`;
const TEL = "+5490000100003";            // caso testigo "Vence Hoy" (el teléfono es base + posición, desde 1)
const SIN = /apagad|No tenés acceso|Tu rol no tiene acceso|Sin permiso/i;
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url });
await db.connect();

/** "2026-11-20T10:00" a N días de hoy, en la hora de Buenos Aires (la del gimnasio demo). */
function enDias(n, hhmm) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  const base = new Date(`${f.format(new Date())}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + n);
  return `${base.toISOString().slice(0, 10)}T${hhmm}`;
}
async function seccion(p, prendida) {
  await p.goto(`${G}/panel/configuracion?pestana=secciones`);
  await p.locator('fieldset[data-pestana-activa="secciones"]').waitFor({ timeout: 30000 });
  await p.waitForTimeout(800);
  const sw = p.locator("fieldset[data-pestana-activa] label").filter({ hasText: /^\S+ Personal trainer/ }).locator('input[role="switch"]');
  if ((await sw.isChecked()) === prendida) return;
  await (prendida ? sw.check() : sw.uncheck());
  const pie = p.locator('[data-pie="secciones"]');
  const antes = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await p.waitForFunction((n) => Number(document.querySelector('[data-pie="secciones"]')?.getAttribute("data-respuestas")) > n, antes, { timeout: 30000 });
}
async function ventaDelPack() {
  const { rows: [s] } = await db.query(`select s.id, s.gimnasio_id from public.socios s join public.gimnasios g on g.id = s.gimnasio_id where g.slug = 'demo' and s.apellido = 'Vence Hoy' limit 1`);
  const { rows: [pk] } = await db.query(`select id, nombre from public.productos where gimnasio_id = $1 and pt_sesiones is not null and nombre = $2`, [s.gimnasio_id, PACK]);
  const { rows: [sede] } = await db.query(`select id from public.sedes where gimnasio_id = $1 order by es_principal desc limit 1`, [s.gimnasio_id]);
  const { rows: [eq] } = await db.query(`select id from public.equipo where gimnasio_id = $1 and rol = 'recepcion' limit 1`, [s.gimnasio_id]);
  // Corridas anteriores dejaron packs a este socio: se anulan para que el saldo sea solo el de este pack (la reserva gasta primero el más viejo).
  await db.query(`update public.ventas set estado = 'anulada', anulada_en = now(), anulada_motivo = 'limpieza e2e', anulada_por = $2 where socio_id = $1 and estado = 'confirmada' and id in (select it.venta_id from public.venta_items it join public.productos p on p.id = it.producto_id where p.pt_sesiones is not null)`, [s.id, eq.id]);
  const { rows: [v] } = await db.query(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, creado_por, confirmada_en) values ($1,$2,$3,'confirmada','recepcion',$4, now()) returning id`, [s.gimnasio_id, sede.id, s.id, eq.id]);
  await db.query(`insert into public.venta_items (gimnasio_id, venta_id, tipo, producto_id, descripcion, cantidad, precio_unitario) values ($1,$2,'producto',$3,$4,1,90000)`, [s.gimnasio_id, v.id, pk.id, pk.nombre]);
}

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await seccion(d, true);
  await d.goto(`${G}/panel/pt`);
  await d.locator("[data-pt]").waitFor({ timeout: 30000 });

  // El pack (sale en Vender como cualquier producto).
  await d.locator("[data-packs-pt] summary").click();
  await d.locator("[data-pack-nombre]").fill(PACK);
  await d.locator("[data-pack-precio]").fill("90000");
  await d.locator("[data-pack-sesiones]").fill("3");
  await d.locator("[data-guardar-pack]").click();
  await d.locator(`[data-pack]:has-text("${PACK}")`).waitFor({ timeout: 30000 });
  ok("la dueña arma un pack de 3 sesiones");

  // Horarios del profe demo, tres días desde hoy.
  const { rows: [pt] } = await db.query(`select e.id from public.equipo e join public.gimnasios g on g.id = e.gimnasio_id where g.slug = 'demo' and e.rol = 'profe' and e.activo order by e.id limit 1`);
  await d.locator("[data-cargar-horarios] summary").click();
  if (pt && await d.locator("[data-franja-pt]").count()) await d.locator("[data-franja-pt]").selectOption(pt.id);
  await d.locator("[data-franja-inicio]").fill(enDias(3, "10:00"));
  await d.locator("[data-franja-semanas]").selectOption("1");
  await d.locator("[data-cargar-franja]").click();
  await d.locator(`[data-dia-pt="${enDias(3, "10:00").slice(0, 10)}"]`).waitFor({ timeout: 30000 });
  ok("se carga un horario de atención del PT");
  await d.locator("[data-cargar-franja]").click();
  await d.locator(".mensaje-error, [role=alert]").first().waitFor({ timeout: 30000 });
  ok("cargar el mismo horario otra vez se frena (un PT no se pisa)");

  await ventaDelPack();

  // El socio reserva, ve la cuenta y cancela.
  const s = await pagina(b, CELU);
  await entrarSocio(s, TEL);
  await s.goto(`${G}/app/pt`);
  await s.locator("[data-mi-pt]").waitFor({ timeout: 30000 });
  chequear(await s.locator('[data-pack-restantes="3"]').count() === 1, "el socio ve que le quedan 3 sesiones", "no ve el saldo del pack");
  await s.locator("[data-reservar-franja]").first().click();
  await s.locator("[data-mi-sesion]").first().waitFor({ timeout: 30000 });
  await s.reload();
  chequear(await s.locator('[data-pack-restantes="2"]').count() === 1, "reservar gasta una sesión: le quedan 2", "no bajó el saldo");
  chequear(await s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "celular: sin desborde", "la app del socio desborda");
  await capturar(s, "vd58-app-celu");

  // La recepción ve la reserva; no ve los packs; con un socio sin pack, ofrece cobrar uno.
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/pt`);
  await r.locator("[data-pt]").waitFor({ timeout: 30000 });
  chequear(await r.locator("[data-franja-socio]").count() >= 1, "la recepción ve quién reservó", "la recepción no ve la reserva");
  chequear(await r.locator("[data-packs-pt]").count() === 0, "la recepción no ve los packs ni los precios", "la recepción ve la configuración de packs");
  await r.locator("[data-reservar-por-socio] summary").click();
  await r.locator("[data-pt-buscar-socio]").fill("Al Día");
  await r.locator("[data-pt-elegir-socio]").first().click();
  await r.locator("[data-cobrar-abrir]").first().waitFor({ timeout: 30000 });
  ok("un socio sin pack: la recepción ofrece cobrar uno (con la hoja Cobrar de siempre)");

  // El socio cancela con antelación.
  await s.locator("[data-cancelar-mi-sesion]").first().click();
  await s.locator("[data-sin-turnos]").waitFor({ timeout: 30000 });
  await s.reload();
  chequear(await s.locator('[data-pack-restantes="3"]').count() === 1, "cancelar con antelación devuelve la sesión: vuelve a tener 3", "no se devolvió la sesión");

  // Vuelve a reservar y el PT marca que se dio (se adelanta la franja a hoy para que ya haya empezado).
  await s.locator("[data-reservar-franja]").first().click();
  await s.locator("[data-mi-sesion]").first().waitFor({ timeout: 30000 });
  await db.query("alter table public.pt_franjas disable trigger pt_franja_inmutable");
  await db.query(`update public.pt_franjas set inicio = now() - interval '2 hours', fin = now() - interval '1 hour' where id in (select franja_id from public.sesiones_pt where estado = 'reservada' and socio_id in (select id from public.socios where apellido = 'Vence Hoy'))`);
  await db.query("alter table public.pt_franjas enable trigger pt_franja_inmutable");
  const { rows: [uPt] } = await db.query(`select u.email from public.equipo e join auth.users u on u.id = e.usuario_id join public.gimnasios g on g.id = e.gimnasio_id where g.slug = 'demo' and e.rol = 'profe' and e.activo limit 1`);
  const p = await pagina(b, COMPU);
  await entrar(p, uPt?.email ?? "profe@ejemplo.invalid");
  await p.goto(`${G}/panel/pt`);
  await p.locator("[data-marcar-dictada]").first().waitFor({ timeout: 30000 });
  await p.locator("[data-marcar-dictada]").first().click();
  await p.locator('[data-pildora-franja="dictada"]').first().waitFor({ timeout: 30000 });
  ok("el PT marca que se dio la sesión: queda como dictada");
  chequear(await p.locator("[data-packs-pt]").count() === 0, "el PT no ve la configuración de packs", "el PT ve la configuración de packs");
  await capturar(p, "vd58-pt-compu");

  // Celular del panel y sección apagada.
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/pt`);
  await c.locator("[data-pt]").waitFor({ timeout: 30000 });
  chequear(await c.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "celular: el panel de PT no desborda", "el panel de PT desborda");
  await capturar(c, "vd58-panel-celu");
  await seccion(d, false);
  await d.goto(`${G}/panel/pt`);
  chequear(SIN.test(await d.locator("body").innerText()) || await d.locator("[data-pt]").count() === 0, "con la sección apagada, PT no abre", "PT abre con la sección apagada");
  await s.goto(`${G}/app/yo`);
  chequear(await s.locator('[data-yo-fila="pt"]').count() === 0, "y el socio no ve “Mi personal trainer” en la app", "el socio ve PT con la sección apagada");
  await seccion(d, true);
  if (d.errores.length) falla(`errores: ${d.errores.join(" | ")}`);
} catch (e) { falla(`se cortó: ${e.message.split("\n")[0]}`); }
finally { await db.end(); await b.close(); resultado(); }
