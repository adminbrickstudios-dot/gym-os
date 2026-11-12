#!/usr/bin/env node
// REV-3 · Segunda pasada: un mes como socio, de la página a la renovación.
// Se anota online eligiendo un plan y transferencia → entra a la app con su
// celular → sube el comprobante → se lo rechazan con motivo (lo ve y sube
// otro) → se lo aprueban → la Entrada lo deja pasar → reserva una clase →
// renueva en el mostrador y la Entrada corre el vencimiento un mes.
// Contra "Socios: lo raro que pasa" de 10-DIA-A-DIA-Y-CASOS-RAROS.md.
//   npm run e2e:rev-3            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, entrarSocio, esperarCobro, falla, navegador, ok, pagina, resultado, esperarAntiRobot } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const s = Date.now().toString().slice(-6);
const DNI = `43${s}`, TEL = `000 5${s}`;   // característica 000: ficticio
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const manana = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(Date.now() + 864e5));
const b = await navegador();
const paginas = [];
const nueva = async (tam) => { const p = await pagina(b, tam); p.setDefaultNavigationTimeout(120000); paginas.push(p); return p; };
try {
  // ── La dueña tiene las altas online prendidas ──
  const d = await nueva(COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/pagina`);
  const altas = d.locator("[data-altas]");
  await altas.waitFor({ timeout: 60000 });
  const llave = altas.locator('input[role="switch"]');
  if (!(await llave.isChecked())) {
    if (!(await altas.locator("textarea").inputValue()).trim()) await altas.locator("textarea").fill("1. Traé toalla.\n2. La cuota se paga del 1 al 10.");
    await llave.check();
    const n = Number(await altas.getAttribute("data-respuestas"));
    await altas.locator('button:has-text("Guardar")').click();
    await d.waitForFunction((n) => Number(document.querySelector("[data-altas]")?.getAttribute("data-respuestas")) > n, n, { timeout: 30000 });
  }
  ok("la dueña tiene prendidas las altas online");

  // ── Día 1: se anota desde la página ──
  const v = await nueva(CELU);
  await v.goto(`${G}/hacete-socio`);
  const form = v.locator("[data-form-alta]");
  await form.waitFor({ timeout: 60000 });
  await form.locator("[data-plan]").first().click();
  await form.locator('input[name="nombre"]').fill("Sofía");
  await form.locator('input[name="apellido"]').fill(`Rev${s}`);
  await form.locator('input[name="dni"]').fill(DNI);
  await form.locator('input[name="telefono"]').fill(TEL);
  await form.locator('input[name="fecha_nacimiento"]').fill("1990-05-01");
  await form.locator('input[name="email"]').fill(`rev${s}@ejemplo.invalid`);
  await form.locator('input[name="contrasena"]').fill("clave-de-prueba-1");
  await form.locator('input[name="acepto"]').check();
  await form.locator('label:has-text("Transferencia")').click();
  await esperarAntiRobot(form);
  await form.locator('button[type="submit"]').click();
  await v.locator('[data-alta-lista="transferencia"]').waitFor({ timeout: 30000 });
  const [{ id: socio }] = (await db.query(`select s.id from public.socios s join public.gimnasios g on g.id = s.gimnasio_id where g.slug = 'demo' and s.dni = $1`, [DNI])).rows;
  ok("día 1: se anota online con transferencia y ve el alias");

  // ── Entra a la app y sube el comprobante ──
  const a = await nueva(CELU);
  await entrarSocio(a, TEL);
  const pagar = a.locator("section", { hasText: "Pagar por transferencia" });
  await pagar.waitFor({ timeout: 60000 });
  await pagar.locator('input[type="file"]').setInputFiles({ name: "comprobante.png", mimeType: "image/png", buffer: PNG });
  await a.getByText(/el gimnasio lo (revisa|está revisando)/).first().waitFor({ timeout: 30000 });  // el aviso, o la app ya re-pintada con "Informaste…"
  ok("entra a la app con su celular y sube el comprobante");

  // ── Se lo rechazan con motivo ──
  await d.goto(`${G}/panel/transferencias`);
  const mia = d.locator("li", { hasText: `Rev${s}` }).first();
  await mia.waitFor({ timeout: 60000 });
  await mia.locator('button:has-text("Rechazar")').first().click();
  await mia.locator('input[placeholder^="Motivo"]').fill("El monto no coincide");
  await mia.locator('button[type="submit"]:has-text("Rechazar")').click();
  // Al rechazar, la fila dice "✕ Rechazada" y la lista se vuelve a pedir: puede irse antes de verla. Vale que ya no esté pendiente.
  await d.locator("li", { hasText: `Sofía Rev${s}` }).filter({ has: d.locator('button:has-text("Aprobar")') }).waitFor({ state: "detached", timeout: 30000 });
  await a.goto(`${G}/app/historial`);
  chequear(await aparece(a.getByText(/rechazado: El monto no coincide/i), 60000), "le rechazan la transferencia: en la app ve “rechazado: El monto no coincide”", "el socio no ve el motivo del rechazo");
  await a.goto(`${G}/app`);
  const otra = a.locator("section", { hasText: "Pagar por transferencia" });
  chequear(await aparece(otra, 60000), "y la app le vuelve a ofrecer subir otro comprobante", "no puede subir otro");
  await otra.locator('input[type="file"]').setInputFiles({ name: "comprobante2.png", mimeType: "image/png", buffer: PNG });
  await a.getByText(/el gimnasio lo (revisa|está revisando)/).first().waitFor({ timeout: 30000 });

  // ── Se lo aprueban y entra ──
  await d.goto(`${G}/panel/transferencias`);
  const segunda = d.locator("li", { hasText: `Rev${s}` }).first();
  await segunda.waitFor({ timeout: 60000 });
  await segunda.locator('button:has-text("Aprobar")').click();
  await d.locator("li", { hasText: `Sofía Rev${s}` }).filter({ has: d.locator('button:has-text("Aprobar")') }).waitFor({ state: "detached", timeout: 30000 });
  await d.goto(`${G}/panel/entrada?socio=${socio}`);
  const ver = d.locator('[data-veredicto="verde"]');
  await ver.waitFor({ timeout: 60000 });
  const vence1 = /(\d{2}\/\d{2})/.exec(await ver.innerText())?.[1];
  ok(`aprobado el segundo comprobante: la Entrada lo deja pasar (vence el ${vence1})`);

  // ── Reserva una clase ──
  await a.goto(`${G}/app/clases?dia=${manana}`);
  await a.locator("main h1").waitFor({ timeout: 60000 });
  const reservar = a.getByRole("button", { name: /^Reservar$/ }).first();
  if (await aparece(reservar, 15000)) {
    await reservar.click();
    const r = await Promise.race([
      a.getByText("Reservada").first().waitFor({ timeout: 30000 }).then(() => "ok"),
      a.locator('main [role="alert"]').first().waitFor({ timeout: 30000 }).then(async () => await a.locator('main [role="alert"]').first().innerText()),
    ]);
    chequear(r === "ok" || /no cubre|tu plan/i.test(r), r === "ok" ? "reserva una clase de mañana desde la app" : `reservar: la base dice por qué no (“${r}”)`, `al reservar: ${r}`);
  } else ok("mañana no hay clases con reserva en el demo: nada para reservar");

  // ── Renueva en el mostrador ──
  const r = await nueva(COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/vender?socio=${socio}&cuota=1`);
  await r.getByText(/^Cuota /).first().waitFor({ timeout: 60000 });
  await r.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await r.locator('button:has-text("Cobrar")').click();
  await esperarCobro(r);
  await r.goto(`${G}/panel/entrada?socio=${socio}`);
  const ver2 = r.locator('[data-veredicto="verde"]');
  await ver2.waitFor({ timeout: 60000 });
  const vence2 = /(\d{2}\/\d{2})/.exec(await ver2.innerText())?.[1];
  chequear(vence2 && vence2 !== vence1, `renueva en el mostrador: el vencimiento pasa del ${vence1} al ${vence2}`, `después de renovar dice ${await ver2.innerText()}`);
  await capturar(a, "rev3-celu-app");

  for (const p of paginas) if (p.errores.length) falla(`errores en ${p.url()}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
  for (const [i, p] of paginas.entries()) await capturar(p, `ROTA-rev3-${i}`, true).catch(() => {});
} finally {
  await db.end();
}
await b.close();
resultado();
