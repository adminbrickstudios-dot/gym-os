#!/usr/bin/env node
// VD-39 · Cambio de plan y compra de pases desde la app (D28): el socio entra a Yo → "Cambiar de plan
// o comprar un pase", elige un plan más caro, ve los días que le quedan a favor (los calcula la base),
// paga por transferencia → hasta que la recepción aprueba, su plan NO cambia → al aprobar, cambia, los
// días a favor pasan al plan nuevo y entra. También compra un pase del día. Con las compras apagadas
// por la dueña, la fila desaparece.
//   node scripts/e2e/vd-39.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, entrarSocio, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const q = async (sql, p) => (await db.query(sql, p)).rows;
const s = Date.now().toString().slice(-6);
const DNI = `45${s}`, TEL = `000 7${s}`;   // característica 000: ficticio
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const b = await navegador();
try {
  // ── Un socio con plan barato, pago hasta dentro de 10 días ──
  const [{ id: g, zona_horaria: zona }] = await q(`select id, zona_horaria from public.gimnasios where slug = 'demo'`);
  const planes = await q(`select id, nombre, privado.precio_para(id, now(), 'transferencia', null, true) as precio from public.planes
                           where gimnasio_id = $1 and tipo = 'membresia' and activo and visible_en_landing and privado.precio_para(id, now(), 'transferencia', null, true) > 0
                           order by 3, nombre`, [g]);
  const viejo = planes[0], nuevo = planes.at(-1);
  if (!viejo || Number(nuevo.precio) <= Number(viejo.precio)) throw new Error("El gimnasio demo necesita dos planes mensuales con distinto precio");
  const [{ id: socio }] = await q(`insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, fecha_nacimiento)
                                   values ($1, 'Cambio', $2, $3, privado.telefono_normalizado($4, 'Celular'), date '1992-04-03') returning id`, [g, `Plan${s}`, DNI, TEL]);
  const [{ id: su }] = await q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - interval '20 days') returning id`, [g, socio, viejo.id]);
  await q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo)
           values ($1,$2,$3, privado.medianoche(privado.dia_local(now(), $4) - 20, $4), privado.medianoche(privado.dia_local(now(), $4) + 10, $4), 'cortesia', 'prueba e2e')`, [g, su, socio, zona]);
  const planActual = async () => (await q(`select pl.nombre from public.suscripciones su join public.planes pl on pl.id = su.plan_id where su.socio_id = $1 and su.baja_en is null`, [socio]))[0]?.nombre;

  // ── La dueña tiene las compras prendidas ──
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/configuracion?pestana=pagina`);
  const compras = d.locator("[data-autoservicio] input[data-compras-app]");
  await compras.waitFor({ timeout: 60000 });
  if (!(await compras.isChecked())) { await compras.setChecked(true); await d.locator('[data-autoservicio] [role="status"]').first().waitFor({ timeout: 30000 }); }
  ok("Configuración: cambiar de plan y comprar pases desde la app, prendido");

  // ── El socio elige un plan más caro ──
  const a = await pagina(b, CELU);
  a.setDefaultNavigationTimeout(120000);
  await entrarSocio(a, TEL);
  await a.goto(`${G}/app/yo`);
  const fila = a.locator('[data-yo-fila="plan"]');
  await fila.waitFor({ timeout: 60000 });
  await fila.click();
  await a.waitForURL(/\/app\/plan/, { timeout: 30000 });
  await a.locator("[data-comprar-plan]").waitFor({ timeout: 60000 });
  chequear(await a.locator(`[data-plan-oferta="${viejo.nombre}"]`).count() === 0, "Mi plan: no ofrece el plan que ya tiene", "ofrece su propio plan");
  await a.locator(`[data-plan-oferta="${nuevo.nombre}"]`).click();
  const dias = a.locator("[data-dias-a-favor]");
  await dias.waitFor({ timeout: 60000 });
  chequear(/10 días a favor/.test((await dias.innerText()).replace(/\s+/g, " ")), `ve los días a favor que calculó la base (“${(await dias.innerText()).replace(/\s+/g, " ").slice(0, 80)}…”)`, `los días a favor dicen: ${await dias.innerText()}`);
  chequear(await a.locator("[data-pago-transferencia]").count() === 1, "puede pagar por transferencia", "no ofrece transferencia");
  await capturar(a, "vd39-celu-cambio", true);
  chequear(await a.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "celular 390 px sin desbordes", "la pantalla desborda en celular");

  // ── Paga por transferencia: hasta que se aprueba, no cambia nada ──
  await a.locator("[data-comprobante-compra]").setInputFiles({ name: "comprobante.png", mimeType: "image/png", buffer: PNG });
  await a.locator("[data-compra-lista]").waitFor({ timeout: 60000 });
  chequear(await planActual() === viejo.nombre, "pidió el cambio y paga: su plan todavía no cambió", `el plan ya es ${await planActual()}`);

  // ── La recepción lo ve y aprueba ──
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/transferencias`);
  const mia = r.locator("li", { hasText: `Plan${s}` }).first();
  await mia.waitFor({ timeout: 60000 });
  chequear(/Cambio a/.test(await mia.innerText()), "la recepción ve qué es: “Cambio a …”", `la fila dice: ${await mia.innerText()}`);
  await mia.locator('button:has-text("Aprobar")').click();
  await r.locator("li", { hasText: `Cambio Plan${s}` }).filter({ has: r.locator('button:has-text("Aprobar")') }).waitFor({ state: "detached", timeout: 30000 });
  chequear(await planActual() === nuevo.nombre, `aprobado: el plan cambió a ${nuevo.nombre}`, `el plan es ${await planActual()}`);
  const cob = await q(`select origen, privado.dia_local(hasta, $2) - privado.dia_local(now(), $2) as dias from public.coberturas where socio_id = $1 and anulada_en is null order by hasta`, [socio, zona]);
  chequear(cob.some((c) => c.origen === "traspaso" && c.dias === 10) && cob.some((c) => c.origen === "pago" && c.dias > 10), "los 10 días a favor pasaron al plan nuevo y se suma lo que pagó", `coberturas: ${JSON.stringify(cob)}`);
  await r.goto(`${G}/panel/entrada?socio=${socio}`);
  await r.locator('[data-veredicto="verde"]').waitFor({ timeout: 60000 });
  ok("la Entrada lo deja pasar con el plan nuevo");

  // ── El socio ve su plan nuevo y compra un pase del día ──
  await a.goto(`${G}/app/plan`);
  await a.locator("[data-comprar-plan]").waitFor({ timeout: 60000 });
  chequear(await a.locator(`[data-plan-oferta="${nuevo.nombre}"]`).count() === 0 && await a.locator(`[data-plan-oferta="${viejo.nombre}"]`).count() === 1, "ahora ofrece el plan anterior y no el que ya tiene", "la lista no se actualizó");
  const pase = a.locator("[data-plan-oferta]", { hasText: "Un día" }).first();
  if (await aparece(pase, 5000)) {
    await pase.click();
    await a.locator("[data-detalle-compra] [data-pago-transferencia]").waitFor({ timeout: 60000 });
    await a.locator("[data-comprobante-compra]").setInputFiles({ name: "comprobante2.png", mimeType: "image/png", buffer: PNG });
    await a.locator("[data-compra-lista]").waitFor({ timeout: 60000 });
    await r.goto(`${G}/panel/transferencias`);
    const fp = r.locator("li", { hasText: `Plan${s}` }).first();
    await fp.waitFor({ timeout: 60000 });
    chequear(/Pase/.test(await fp.innerText()), "compra un pase del día: la recepción lo ve como “Pase …”", `la fila dice: ${await fp.innerText()}`);
    await fp.locator('button:has-text("Aprobar")').click();
    await r.locator("li", { hasText: `Cambio Plan${s}` }).filter({ has: r.locator('button:has-text("Aprobar")') }).waitFor({ state: "detached", timeout: 30000 });
    chequear((await q(`select count(*)::int n from public.pases_diarios where socio_id = $1`, [socio]))[0].n === 1, "aprobado: el pase del día queda cargado y el plan no cambia", "no se cargó el pase");
  } else ok("el gimnasio demo no vende pases del día: nada para comprar");

  // ── Apagadas las compras, la fila desaparece ──
  await compras.setChecked(false);
  await d.locator('[data-autoservicio] [role="status"]').first().waitFor({ timeout: 30000 });
  await a.goto(`${G}/app/yo`);
  await a.locator("[data-yo]").waitFor({ timeout: 60000 });
  chequear(await a.locator('[data-yo-fila="plan"]').count() === 0, "compras apagadas: “Cambiar de plan” ya no aparece en Yo", "la fila sigue con las compras apagadas");
  await compras.setChecked(true);
  await d.locator('[data-autoservicio] [role="status"]').first().waitFor({ timeout: 30000 });

  for (const [n, p] of [["dueña", d], ["socio", a], ["recepción", r]]) if (p.errores.length) falla(`${n}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await db.end();
await b.close();
resultado();
