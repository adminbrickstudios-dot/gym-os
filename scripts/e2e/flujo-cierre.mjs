#!/usr/bin/env node
// R3 / F8.2 · Que cada flujo CIERRE, de una compu a las otras:
//   1. Lo cobrado aparece en la caja, en la ficha (Pagos), en Resultado y en la app del socio (de "No podés entrar" a "Cubierto hasta").
//   2. Lo editado se ve al toque en la página pública (sin esperar ni limpiar nada).
//   3. Lo que cambia en una compu aparece en las otras: la caja de la dueña, abierta en otra compu, muestra el cobro de la recepción sin recargar
//      (FLUIDEZ 14 y 20: la caja se vuelve a pedir sola cada 30 s), y el celular del socio lo ve al volver a la pantalla.
// Usa a "Testigo Vencida" (el socio con cuota vencida del demo, con login socio-vencido@ejemplo.invalid): como CAMBIA su estado, va al final
// de la cadena y no se repite en la misma base.
//   node scripts/e2e/flujo-cierre.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const [vencida] = (await db.query(`select id, nombre || ' ' || apellido as nombre from public.socios where gimnasio_id = $1 and nombre = 'Testigo' and apellido = 'Vencida'`, [gim])).rows;
const b = await navegador();
const pesos = (n) => `$${Number(n).toLocaleString("es-AR")}`;
const numero = (t) => { const m = String(t).match(/\$\s*([\d.]+)(?:,(\d{2}))?/); return m ? Number(m[1].replace(/\./g, "") + (m[2] ? `.${m[2]}` : "")) : NaN; };
const totalCaja = (p) => p.locator("[data-medio]").evaluateAll((es) => es.reduce((s, e) => s + Number(e.getAttribute("data-total") ?? 0), 0));
const cobrado = async (p) => { await p.locator("[data-resultado-cobrado]").waitFor({ timeout: 60000 }); return numero(await p.locator("[data-resultado-cobrado]").innerText()); };
try {
  if (!vencida) throw new Error("no está el socio Testigo Vencida en el demo");

  // ── Antes: cada pantalla tal como está ──
  const dueña = await pagina(b, COMPU);                         // la compu de la dueña: Resultado y la caja
  await entrar(dueña, "duena@ejemplo.invalid");
  await dueña.goto(`${G}/panel/resultado`);
  const cobradoAntes = await cobrado(dueña);
  const cajaDueña = await pagina(b, COMPU);                     // otra compu de la dueña, con la caja abierta
  await entrar(cajaDueña, "duena@ejemplo.invalid");
  await cajaDueña.goto(`${G}/panel/caja`);
  await cajaDueña.locator("main h1").waitFor({ timeout: 60000 });
  const cajaAntes = await totalCaja(cajaDueña);
  const socio = await pagina(b, CELU);                          // el celular del socio
  await entrar(socio, "socio-vencido@ejemplo.invalid");
  await socio.goto(`${G}/app`);
  await socio.getByText("No podés entrar").first().waitFor({ timeout: 60000 });
  const bien = socio.locator("[data-bienvenida]");
  if (await bien.count()) { await bien.locator("[data-bienvenida-saltear], [data-bienvenida-listo]").first().click(); await bien.waitFor({ state: "detached", timeout: 30000 }); }
  chequear(await socio.locator("[data-cubierto-hasta]").count() === 0, "antes: el socio ve “No podés entrar” y no tiene cobertura", "el socio ya tenía cobertura");
  ok(`antes: Resultado cobrado ${cobradoAntes}, caja ${cajaAntes}`);

  // ── La recepción cobra desde la ficha (Cobrar → Cobrar) ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios/${vencida.id}`);
  await r.locator('main a:has-text("Cobrar")').first().click();
  await r.locator("[data-cobrar] [data-cobrar-confirmar]").waitFor({ timeout: 30000 });
  const t0 = Date.now();
  await r.locator("[data-cobrar-confirmar]").click();
  const hecho = r.locator("[data-cobrar-hecho]");
  const error = r.locator('[data-cobrar] [role="alert"]');
  await Promise.race([hecho.waitFor({ timeout: 30000 }), error.waitFor({ timeout: 30000 }).then(async () => { throw new Error(`al cobrar: ${await error.innerText()}`); })]);
  ok(`la recepción cobró desde la ficha (${Date.now() - t0} ms)`);
  const [pago] = (await db.query(`select p.monto from public.pagos p join public.ventas v on v.id = p.venta_id where v.socio_id = $1 and p.estado = 'aprobado' order by p.creado_en desc limit 1`, [vencida.id])).rows;
  const monto = Number(pago.monto);
  ok(`en la base: pago aprobado de ${pesos(monto)}`);

  // ── Ficha del socio: el pago está en Pagos (lo ve la dueña) ──
  await dueña.goto(`${G}/panel/socios/${vencida.id}?pestana=pagos`);
  await dueña.locator("main h1").first().waitFor({ timeout: 60000 });
  chequear((await dueña.locator("main").innerText()).includes(pesos(monto)), `ficha → Pagos: aparece el cobro de ${pesos(monto)}`, `la ficha no muestra ${pesos(monto)}`);

  // ── Resultado: suma lo cobrado ──
  await dueña.goto(`${G}/panel/resultado`);
  const cobradoDespues = await cobrado(dueña);
  chequear(cobradoDespues - cobradoAntes >= monto - 0.01, `Resultado: lo cobrado pasó de ${cobradoAntes} a ${cobradoDespues} (+${pesos(monto)})`, `Resultado no sumó el cobro: ${cobradoAntes} → ${cobradoDespues}`);

  // ── Caja: otra compu, SIN recargar, lo muestra sola (se vuelve a pedir cada 30 s) ──
  let cajaDespues = cajaAntes;
  const limite = Date.now() + 50000;
  while (Date.now() < limite) { cajaDespues = await totalCaja(cajaDueña); if (cajaDespues - cajaAntes >= monto - 0.01) break; await cajaDueña.waitForTimeout(2000); }
  chequear(cajaDespues - cajaAntes >= monto - 0.01, `otra compu: la caja de la dueña mostró el cobro sola, sin recargar (${cajaAntes} → ${cajaDespues})`, `la caja de la otra compu no se enteró en 50 s (${cajaAntes} → ${cajaDespues})`);
  await cajaDueña.goto(`${G}/panel/caja`);
  await cajaDueña.locator("[data-medio]").first().waitFor({ timeout: 60000 });
  chequear(await cajaDueña.locator("[data-cobro]").count() > 0 || (await totalCaja(cajaDueña)) >= monto, "la caja, recargada, tiene el cobro del turno", "la caja recargada no tiene el cobro");

  // ── App del socio: al volver a la pantalla ya está al día ──
  await socio.reload();
  await socio.locator("[data-cubierto-hasta]").waitFor({ timeout: 60000 });
  chequear(await socio.getByText("No podés entrar").count() === 0, `app del socio: “${(await socio.locator("[data-cubierto-hasta]").innerText()).trim()}” y ya no dice “No podés entrar”`, "el socio sigue sin poder entrar");
  await capturar(socio, "flujo-cierre-celu-socio");

  // ── Lo editado se ve al toque en la página pública ──
  const s = Date.now().toString().slice(-6);
  const edit = await pagina(b, COMPU);
  await entrar(edit, "duena@ejemplo.invalid");
  await edit.goto(`${G}/panel/pagina`);
  await edit.locator('[data-editor-pagina][data-listo="true"]').waitFor({ timeout: 60000 });
  const sec = edit.locator('[data-seccion="probar"]');
  const texto = `Cierre de flujo ${s}: la primera clase es sin cargo.`;
  await sec.locator("textarea").fill(texto);
  const visible = sec.locator("label", { hasText: "Se muestra en la página" }).locator("input");
  if (!(await visible.isChecked())) await visible.check();
  const pie = edit.locator("[data-pie-pagina]");
  const n0 = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await edit.waitForFunction((n) => Number(document.querySelector("[data-pie-pagina]")?.getAttribute("data-respuestas")) > n, n0, { timeout: 30000 });
  if (await edit.locator('[data-estado-pagina="borrador"]').count()) {
    await edit.locator('button:has-text("Mostrar mi página")').click();
    await edit.locator('[data-estado-pagina="publicada"]').waitFor({ timeout: 30000 });
  }
  const visita = await pagina(b, CELU);                         // alguien que abre la página recién guardada: una sola carga, sin esperar
  await visita.goto(`${G}/`);
  chequear(await visita.getByText(texto).count() > 0, "página pública: el texto recién guardado se ve en la primera carga", "la página pública no muestra lo recién guardado (¿caché?)");
  await capturar(visita, "flujo-cierre-celu-pagina");

  for (const [q, p] of [["recepción", r], ["dueña", dueña], ["caja", cajaDueña], ["socio", socio], ["visita", visita]]) if (p.errores.length) falla(`${q}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await db.end();
await b.close();
resultado();
