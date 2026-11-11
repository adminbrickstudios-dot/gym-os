#!/usr/bin/env node
// REV-6 · Segunda pasada: intentar romperlo. Doble clic en Cobrar, dos
// personas cobrando la cuota del mismo socio a la vez, sin internet, datos
// raros en el alta y en la búsqueda, y un rol pidiendo lo que no le toca por
// la dirección. Contra "Lo que puede salir mal" de 10-DIA-A-DIA-Y-CASOS-RAROS.md.
// Lo que pasa y no debería se escribe como "ℹ️ falta" (si toca plata, no se
// arregla acá: se reporta).
//   npm run e2e:rev-6            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, aparece, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const s = Date.now().toString().slice(-5);
const falta = (m) => console.log(`ℹ️ falta: ${m}`);
const ventasDesde = async (desde, socio = null) => Number((await db.query(
  `select count(*) n from public.ventas where gimnasio_id = $1 and creado_en >= $2 and anulada_en is null and ($3::uuid is null or socio_id = $3)`, [gim, desde, socio])).rows[0].n);
const b = await navegador();
const paginas = [];
const nueva = async () => { const p = await pagina(b, COMPU); p.setDefaultNavigationTimeout(120000); paginas.push(p); return p; };
try {
  const r = await nueva();
  await entrar(r, "recepcion@ejemplo.invalid");

  // ── Doble clic en Cobrar ──
  await r.goto(`${G}/panel/vender`);
  await r.locator("main button", { hasText: "Agua 500 ml" }).click();
  await r.locator('button[aria-pressed]:has-text("Transferencia")').click();
  const antes = new Date((await db.query("select now() n")).rows[0].n);
  await r.locator('button:has-text("Cobrar")').dblclick();
  await esperarCobro(r);
  await r.waitForTimeout(2000);
  const hechas = await ventasDesde(antes);
  chequear(hechas === 1, "doble clic en “✅ Cobrar”: una sola venta", `doble clic: ${hechas} ventas`);

  // ── Dos personas cobran la cuota del mismo socio a la vez ──
  const d = await nueva();
  await entrar(d, "duena@ejemplo.invalid");
  // Un socio nuevo con su plan y sin pagar (no se toca ningún caso testigo).
  const [{ id: socio }] = (await db.query(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1, 'Doble', $2) returning id`, [gim, `Cobro${s}`])).rows;
  await db.query(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio)
                  select $1, $2, p.id, now() - interval '40 days' from public.planes p where p.gimnasio_id = $1 and p.nombre = 'Plan Full'`, [gim, socio]);
  for (const p of [r, d]) {
    await p.goto(`${G}/panel/vender?socio=${socio}&cuota=1`);
    await p.getByText(/^Cuota /).first().waitFor({ timeout: 60000 });
    await p.locator('button[aria-pressed]:has-text("Transferencia")').click();
  }
  const antes2 = new Date((await db.query("select now() n")).rows[0].n);
  await Promise.all([r.locator('button:has-text("Cobrar")').click(), d.locator('button:has-text("Cobrar")').click()]);
  await r.waitForTimeout(4000);
  const cuotas = await ventasDesde(antes2, socio);
  if (cuotas === 1) ok("dos personas cobran la misma cuota a la vez: entra una; la otra ve que ya se cobró");
  else {
    falta(`dos personas cobran la cuota del mismo socio a la vez: quedan ${cuotas} ventas (cubre ${cuotas} meses). El documento pide que la segunda vea “ya se cobró hace 10 s”. Toca plata: no lo arreglo, va al bloque 18`);
  }

  // ── Sin internet ──
  await r.goto(`${G}/panel/entrada`);
  await r.locator('input[aria-label="Buscar socio"]').waitFor({ timeout: 60000 });
  await r.context().setOffline(true);
  const sin = await aparece(r.locator("[data-sin-conexion]"), 10000);
  await r.context().setOffline(false);
  const vuelve = !(await aparece(r.locator("[data-sin-conexion]"), 1000)) || await r.locator("[data-sin-conexion]").waitFor({ state: "detached", timeout: 10000 }).then(() => true, () => false);
  chequear(sin && vuelve, "sin internet: la pantalla dice “📡 Sin conexión” y se va sola cuando vuelve", `sin conexión: aviso ${sin}, se fue ${vuelve}`);

  // ── Datos raros ──
  await d.goto(`${G}/panel/socios/nuevo`);
  const f = d.locator("form", { has: d.locator('input[name="dni"]') });
  await f.locator('input[name="nombre"]').fill("🦄 Ñandú");
  await f.locator('input[name="apellido"]').fill(`O'Brien-${s}`);
  await f.locator('input[name="dni"]').fill("abc123");
  await f.locator('input[name="telefono"]').fill("12");
  await f.locator('button[type="submit"]').first().click();   // sin plan: "✅ Dar de alta"
  const error = d.locator('main [role="alert"]').first();
  chequear(await aparece(error, 30000) && !/\/panel\/socios\/[0-9a-f-]{36}$/.test(d.url()), `DNI con letras y celular corto: no da de alta y dice qué arreglar (“${(await error.innerText().catch(() => "")).slice(0, 90)}”)`, "dio de alta con datos inválidos");
  await f.locator('input[name="dni"]').fill(`9${s}1`);
  await f.locator('input[name="telefono"]').fill(`000 4${s}1`);
  await f.locator('button[type="submit"]').first().click();   // sin plan: "✅ Dar de alta"
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 60000 });
  chequear(/Ñandú/.test(await d.locator("main h1").innerText()), "con emoji, eñe y apóstrofo en el nombre: se da de alta y se ve igual", await d.locator("main h1").innerText());
  for (const raro of ["'; drop table socios; --", "%_\\", "🦄"]) {
    await d.goto(`${G}/panel/socios?q=${encodeURIComponent(raro)}`);
    await d.locator("main h1").waitFor({ timeout: 60000 });
  }
  chequear(!d.errores.length, "buscar texto raro (comillas, %, _, \\, emoji) no rompe nada", d.errores.join(" | "));

  // ── Un rol pide por la dirección lo que no le toca ──
  const bajada = await r.evaluate(async (u) => { const x = await fetch(u); return { status: x.status, tipo: x.headers.get("content-type") ?? "" }; }, `${G}/panel/exportar`);
  chequear(!/zip/.test(bajada.tipo), `la recepción pide /panel/exportar por la dirección: no baja nada (HTTP ${bajada.status})`, `la recepción bajó el zip (${bajada.tipo})`);
  await r.goto(`${G}/panel/configuracion`);
  chequear(await aparece(r.getByText(/No tenés acceso|Tu rol no tiene acceso|no tiene acceso/i), 30000), "y Configuración por la dirección: “no tenés acceso”", "la recepción abre Configuración");
  await capturar(d, "rev6-compu-datos-raros");
  for (const p of paginas) if (p.errores.length) falla(`errores en ${p.url()}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
  for (const [i, p] of paginas.entries()) await capturar(p, `ROTA-rev6-${i}`, true).catch(() => {});
} finally {
  // Los socios que creó esta prueba quedan dados de baja (no ensucian las listas del demo).
  await db.query(`update public.socios set dado_de_baja_en = now(), motivo_baja = 'otro'
                   where gimnasio_id = $1 and dado_de_baja_en is null and (apellido = $2 or apellido = $3)`, [gim, `Cobro${s}`, `O'Brien-${s}`]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
