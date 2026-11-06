#!/usr/bin/env node
// VD-46F · "Pagué ayer por transferencia": el socio vencido que ya subió el comprobante muestra, en la Entrada,
// un chip "Subió un comprobante hace X por $monto" que lleva a Transferencias. Es informativo: el veredicto
// (rojo, "Dejar pasar igual") no cambia. Al aprobarse/borrarse el pendiente, el chip desaparece.
//   node scripts/e2e/vd-46f.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const NOMBRE = "Testigo Vencida";
const [{ gimnasio_id: g, sede_id: sede, id: socio }] = (await db.query(
  `select s.gimnasio_id, (select id from public.sedes x where x.gimnasio_id = s.gimnasio_id order by x.id limit 1) as sede_id, s.id
     from public.socios s join public.gimnasios gi on gi.id = s.gimnasio_id
    where gi.slug = 'demo' and s.nombre = 'Testigo' and s.apellido = 'Vencida' limit 1`)).rows;
let venta = null;
async function limpiar() {
  if (!venta) return;
  await db.query(`delete from public.pagos where venta_id = $1`, [venta]);
  await db.query(`delete from public.venta_items where venta_id = $1`, [venta]);
  await db.query(`delete from public.ventas where id = $1`, [venta]);
  venta = null;
}
async function abrir(p) {
  await p.goto(`${G}/panel/entrada`);
  await p.locator('input[aria-label="Buscar socio"]').fill(NOMBRE);
  await p.locator("button.fila", { hasText: NOMBRE }).first().click();
  await p.locator("[data-veredicto]").waitFor({ timeout: 30000 });
}

try {
  await limpiar();
  const d = await pagina(b, COMPU);
  await entrar(d, "recepcion@ejemplo.invalid");

  // Sin transferencia pendiente: sin chip.
  await abrir(d);
  chequear(await d.locator('[data-chip="transferencia_pendiente"]').count() === 0, "sin comprobante pendiente no hay chip", "hay chip sin pendiente");

  // Subió un comprobante hace 3 horas.
  venta = (await db.query(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen) values ($1,$2,$3,'app') returning id`, [g, sede, socio])).rows[0].id;
  await db.query(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, comprobante_path, creado_en)
                  values ($1,$2,'transferencia', 25000, 'pendiente', $3, now() - interval '3 hours')`, [g, venta, `${g}/${socio}/vd46f-${Date.now()}.jpg`]);
  await abrir(d);
  const chip = d.locator('[data-chip="transferencia_pendiente"]');
  await chip.waitFor({ timeout: 30000 });
  const texto = await chip.innerText();
  chequear(/hace 3 horas/.test(texto) && /25\.000/.test(texto), `el chip dice cuánto y hace cuánto: “${texto.trim()}”`, `texto inesperado: ${texto}`);
  chequear(await d.locator("[data-veredicto] button:has-text('Dejar pasar igual')").count() === 1, "informativo: el rojo y “Dejar pasar igual” no cambian", "cambió el veredicto");
  await capturar(d, "vd46f-compu-chip");

  // Celular: sin desborde.
  const c = await pagina(b, CELU);
  await entrar(c, "recepcion@ejemplo.invalid");
  await abrir(c);
  await c.locator('[data-chip="transferencia_pendiente"]').waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular 390 px: sin desborde (${ancho}px)`, `desborda: ${ancho}px`);
  await capturar(c, "vd46f-celu-chip");

  // El chip lleva a Transferencias, donde está el comprobante.
  await chip.locator("a").click();
  await d.waitForURL(/\/panel\/transferencias/, { timeout: 30000 });
  await d.getByText("Testigo Vencida").first().waitFor({ timeout: 30000 });
  ok("el chip lleva a Transferencias y ahí está el comprobante");

  // Sin pendiente otra vez: el chip se va.
  await limpiar();
  await abrir(d);
  chequear(await d.locator('[data-chip="transferencia_pendiente"]').count() === 0, "sin pendiente el chip desaparece (nada guardado)", "el chip quedó");
} finally {
  await limpiar();
  await db.end();
  await b.close();
}
resultado();
