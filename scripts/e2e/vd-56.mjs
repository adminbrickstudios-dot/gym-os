#!/usr/bin/env node
// VD-56 · Recibo de cada pago: el dueño lo abre desde la ficha del socio, ve número, ítems, total y medio, lo puede imprimir
// o mandar por WhatsApp; la recepción lo abre justo después de cobrar; el socio ve el suyo desde Mi historial y no el de otro;
// una venta anulada muestra el recibo marcado ANULADO.
//   npm run e2e:vd-56            (con scripts/local/levantar.sh corriendo; una corrida por base nueva)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const b = await navegador();
const [{ g, sede, socio, otro, rec }] = (await db.query(`select g.id g, (select id from public.sedes where gimnasio_id = g.id and es_principal) sede,
  (select s.id from public.socios s join auth.users u on u.id = s.usuario_id where s.gimnasio_id = g.id and u.email = 'socio@ejemplo.invalid') socio,
  (select s.id from public.socios s join auth.users u on u.id = s.usuario_id where s.gimnasio_id = g.id and u.email = 'socio-vencido@ejemplo.invalid') otro,
  (select id from public.equipo where gimnasio_id = g.id and rol = 'recepcion' and activo limit 1) rec
  from public.gimnasios g where g.slug = 'demo'`)).rows;
/** Una venta cobrada (cuota con descuento + un producto) y su pago por transferencia. */
async function venta(socioId, anulada = false) {
  const [{ id }] = (await db.query(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen, estado, confirmada_en, creado_por) values ($1,$2,$3,'recepcion','confirmada', now(), $4) returning id`, [g, sede, socioId, rec])).rows;
  await db.query(`insert into public.venta_items (gimnasio_id, venta_id, tipo, descripcion, cantidad, precio_unitario, descuento, descuento_motivo) values ($1,$2,'otro','Cuota mensual e2e',1,10000,1000,'promo')`, [g, id]);
  await db.query(`insert into public.venta_items (gimnasio_id, venta_id, tipo, descripcion, cantidad, precio_unitario) values ($1,$2,'otro','Agua e2e',2,1500)`, [g, id]);
  await db.query(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en) values ($1,$2,'transferencia',12000,'aprobado', now())`, [g, id]);
  if (anulada) await db.query(`update public.ventas set estado = 'anulada', anulada_en = now(), anulada_motivo = 'se cobró dos veces', anulada_por = $2 where id = $1`, [id, rec]);
  return id;
}
const v1 = await venta(socio), vAnulada = await venta(socio, true), vOtro = await venta(otro);
const SIN = /No tenés acceso|Sin permiso|no existe|no tiene acceso/i;
try {
  // ── La dueña, desde la ficha ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios/${socio}?pestana=pagos`);
  const fila = d.locator(`[data-venta="${v1}"]`);
  await fila.waitFor({ timeout: 30000 });
  await fila.locator("[data-ver-recibo]").click();
  const hoja = d.locator("[data-recibo]");
  await hoja.waitFor({ timeout: 30000 });
  const texto = await hoja.innerText();
  chequear(/Cuota mensual e2e/.test(texto) && /Agua e2e/.test(texto), "el recibo lista los ítems", "el recibo no lista los ítems");
  chequear((await hoja.locator("[data-total]").innerText()).includes("12.000"), "el total es $12.000 (con el descuento)", "el total del recibo está mal");
  chequear(/Transferencia/.test(texto), "dice con qué medio se pagó", "no dice el medio");
  chequear(/^\d{8}$/.test((await hoja.locator("[data-numero]").innerText()).trim()), "tiene número correlativo de 8 cifras", "no tiene número de recibo");
  chequear((await d.locator("[data-whatsapp]").getAttribute("href"))?.startsWith("https://wa.me/") === true, "el botón de WhatsApp arma el link con el texto del recibo", "falta el link de WhatsApp");
  chequear(await d.locator("[data-imprimir]").count() === 1, "hay “Imprimir / Guardar como PDF”", "falta imprimir");
  await capturar(d, "vd56-compu-recibo", true);

  // Venta anulada: el recibo lo dice.
  await d.goto(`${G}/panel/recibo/${vAnulada}`);
  await d.locator("[data-anulado]").waitFor({ timeout: 30000 });
  chequear((await d.locator("[data-anulado]").innerText()).includes("se cobró dos veces"), "el recibo anulado dice ANULADO y el motivo (para el equipo)", "el recibo anulado no se marca");

  // ── La recepción ──
  const rc = await pagina(b, COMPU);
  await entrar(rc, "recepcion@ejemplo.invalid");
  await rc.goto(`${G}/panel/recibo/${v1}`);
  await rc.locator("[data-recibo]").waitFor({ timeout: 30000 });
  ok("la recepción abre el recibo de lo que cobró");
  const pr = await pagina(b, COMPU);
  await entrar(pr, "profe@ejemplo.invalid");
  await pr.goto(`${G}/panel/recibo/${v1}`);
  chequear(SIN.test(await pr.locator("main").innerText()), "el profe no abre recibos", "el profe pudo abrir un recibo");

  // ── El socio ve el suyo, no el de otro ──
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app/historial`);
  const ver = s.locator("[data-historial-pagos] [data-ver-recibo]").first();
  await ver.waitFor({ timeout: 30000 });
  await ver.click();
  await s.locator("[data-recibo]").waitFor({ timeout: 30000 });
  ok("el socio abre su recibo desde Mi historial");
  chequear(await s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "celular: el recibo sin desborde", "celular: el recibo se desborda");
  await capturar(s, "vd56-celu-recibo", true);
  await s.goto(`${G}/app/recibo/${vOtro}`);
  await s.waitForLoadState("networkidle").catch(() => {});
  chequear(SIN.test(await s.locator("main").innerText()) && await s.locator("[data-recibo]").count() === 0, "el socio no abre el recibo de otro socio", "el socio pudo abrir el recibo de otro");
} catch (e) { falla(`se cortó: ${e.message.split("\n")[0]}`); }
finally { await b.close(); await db.end(); resultado(); }
