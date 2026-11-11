#!/usr/bin/env node
// COM-9 · Cupones: la dueña crea VERANO (20%, Plan Full) desde Planes →
// en Vender escribe el código y el descuento se carga en la cuota con el
// motivo "Cupón …"; un producto no se toca → cobra y el uso queda anotado →
// Cupones dice "1 uso · trajo 1 socio" y el Resultado lo muestra.
//   npm run e2e:com-9            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, aparece, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const s5 = Date.now().toString().slice(-5);
const CODIGO = `VERANO${s5}`;
const [{ id: socio }] = (await db.query(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1, 'Cupon', $2) returning id`, [gim, `Prueba${s5}`])).rows;
await db.query(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio)
  select $1, $2, p.id, now() - interval '1 day' from public.planes p where p.gimnasio_id = $1 and p.nombre = 'Plan Full'`, [gim, socio]);
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/planes`);
  await d.locator("[data-ir-cupones]").click();
  await d.waitForURL(/\/panel\/cupones/, { timeout: 60000 });
  await d.locator('button:has-text("Nuevo cupón")').click();
  const f = d.locator("[data-nuevo-cupon]");
  await f.locator("input").first().fill(CODIGO);
  await f.locator('input[inputmode="decimal"]').fill("20");
  await f.locator("label", { hasText: "Plan Full" }).locator("input").check();
  await f.locator('button[type="submit"]').click();
  await d.locator(`[data-cupon-fila="${CODIGO}"]`).waitFor({ timeout: 30000 });
  ok(`desde Planes → 🏷️ Cupones: crea ${CODIGO} (20%, Plan Full)`);

  await d.goto(`${G}/panel/vender?socio=${socio}&cuota=1`);
  await d.getByText(/^Cuota /).first().waitFor({ timeout: 60000 });
  await d.locator("main button", { hasText: "Agua 500 ml" }).first().click().catch(() => {});
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await d.locator('input[aria-label="Código de cupón"]').fill(CODIGO.toLowerCase());
  await d.locator('[data-cupon] button:has-text("Aplicar")').click();
  await d.locator("[data-cupon]").getByText(/20% en 1 línea/).waitFor({ timeout: 30000 });
  const carrito = (await d.locator("[data-carrito]").innerText()).replace(/\s+/g, " ");
  chequear(carrito.includes(`Cupón ${CODIGO}`) || await d.locator(`input[value="Cupón ${CODIGO}"]`).count() > 0, "el cupón carga el descuento en la cuota (motivo “Cupón …”), no en el agua", carrito.slice(0, 200));
  await d.locator('button:has-text("Cobrar")').click();
  await esperarCobro(d);
  chequear(await aparece(d.locator("[data-uso-cupon]", { hasText: "anotado" }), 15000), "cobra y el uso queda anotado", await d.locator("[data-uso-cupon]").innerText().catch(() => "sin mensaje"));
  await capturar(d, "com9-compu-vender");

  await d.goto(`${G}/panel/cupones`);
  const fila = d.locator(`[data-cupon-fila="${CODIGO}"]`);
  chequear(/1 uso/.test(await fila.innerText()) && /trajo 1 socio/.test(await fila.innerText()), "Cupones: “1 uso · trajo 1 socio”", await fila.innerText());
  await d.goto(`${G}/panel/resultado`);
  chequear(await aparece(d.locator("[data-cupones-resultado]", { hasText: CODIGO }), 60000), "y el Resultado lo muestra", "el Resultado no muestra el cupón");
  if (d.errores.length) falla(d.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.socios set dado_de_baja_en = now(), motivo_baja = 'otro' where id = $1`, [socio]).catch(() => {});
  await db.query(`update public.cupones set activo = false where gimnasio_id = $1 and codigo = $2`, [gim, CODIGO]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
