#!/usr/bin/env node
// REV-1 · Segunda pasada: un día entero como recepción, en el orden de
// docs/producto/10-DIA-A-DIA-Y-CASOS-RAROS.md ("Un día, minuto a minuto"):
// llega y abre la caja → Entrada con foco → un vencido "paga a la tarde" →
// un curioso queda como prospecto con WhatsApp → sale plata para el
// proveedor → mira Transferencias → un socio pide la baja (le ofrece pausa;
// no se confirma) → cierra la caja a ciegas → la dueña ve el día en Inicio.
// Lo que el documento pide y el sistema no tiene se escribe como "ℹ️ falta".
//   npm run e2e:rev-1            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, CELU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const s = Date.now().toString().slice(-5);
const falta = (m) => console.log(`ℹ️ falta: ${m}`);
// La página del demo publicada (el WhatsApp al prospecto la lleva solo si lo está); al final queda como estaba.
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const [{ publicada }] = (await db.query(`select l.publicada from public.landing_gimnasio l join public.gimnasios g on g.id = l.gimnasio_id where g.slug = 'demo'`)).rows;
await db.query(`update public.landing_gimnasio set publicada = true where gimnasio_id = (select id from public.gimnasios where slug = 'demo')`);
const b = await navegador();
try {
  // 6:55 · Llega y abre la caja (si quedó una abierta, primero la cierra).
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.locator("h1").first().waitFor({ timeout: 60000 });
  await r.goto(`${G}/panel/caja`);
  await r.locator("main h1").waitFor({ timeout: 60000 });
  if (await r.locator('button:has-text("Cerrar caja")').count()) {
    await r.locator('button:has-text("Cerrar caja")').first().click();
    await r.locator('input[placeholder="$ contado"]').fill("0");
    await r.locator('button:has-text("Cerrar con este monto")').click();
    await r.locator('button:has-text("Listo")').click();
    ok("6:55 · había una caja abierta de antes: la cierra primero");
  }
  await r.locator('input[placeholder="$ 0"]').first().fill("10.000");
  await r.locator('button:has-text("Abrir caja")').first().click();
  if (!(await aparece(r.locator('button:has-text("Sale plata")'), 30000))) throw new Error(`al abrir la caja: ${(await r.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 300)}`);
  chequear(await r.getByText("Tiene que haber").count() === 0, "6:55 · abre la caja con $10.000 de fondo (no ve cuánto tiene que haber)", "la recepción ve lo esperado");

  // 7:00 · Entrada con el buscador listo.
  await r.goto(`${G}/panel/entrada`);
  const buscar = r.locator('input[aria-label="Buscar socio"]');
  await buscar.waitFor({ timeout: 60000 });
  chequear(await buscar.evaluate((e) => e === document.activeElement), "7:00 · Entrada abre con el foco en el buscador (lector listo)", "el buscador no tiene el foco");

  // 7:10 · Un vencido "paga a la tarde".
  await buscar.fill("Testigo Sin Pago");
  await r.locator("button.fila", { hasText: "Testigo Sin Pago" }).first().click();
  const ver = r.locator("[data-veredicto]");
  await ver.waitFor({ timeout: 30000 });
  chequear(/rojo/.test(await ver.getAttribute("data-veredicto")) && /no pag/i.test(await ver.innerText()), "7:10 · el vencido sale en rojo con el motivo", `veredicto: ${(await ver.innerText()).slice(0, 80)}`);
  await ver.locator('button:has-text("Dejar pasar igual")').click();
  await r.locator("[data-dejar-pasar]").waitFor({ timeout: 15000 });
  await r.locator('input[aria-label="Motivo para dejar pasar"]').fill("Paga a la tarde");
  const dejar = r.locator('[data-dejar-pasar] button.boton-peligro');
  if (await dejar.isDisabled()) ok("7:10 · llegó al tope del día: no puede dejarlo pasar (lo autoriza la dueña)");
  else {
    await dejar.click();
    if (await aparece(r.locator('[data-hecho="forzado"]'), 30000)) ok("7:10 · lo deja pasar con motivo “Paga a la tarde” (cuenta para el tope)");
    else {
      const t = (await r.locator("[data-dejar-pasar]").innerText().catch(() => "")).replace(/\s+/g, " ");
      chequear(/tope|autoriz/i.test(t), `7:10 · llegó al tope del día: “${t.slice(0, 120)}”`, `no lo dejó pasar: ${t.slice(0, 200)}`);
    }
  }
  falta("7:10 · “le prometió pagar” en la bandeja de la tarde: la dueña lo ve en Inicio (dejados pasar), pero nada le recuerda a la tarde cobrarle");

  // 9:30 · Alguien pregunta precios: prospecto en 10 segundos.
  await r.goto(`${G}/panel/prospectos`);
  await r.locator('button:has-text("Anotar uno que preguntó")').click();
  const form = r.locator("[data-form-prospecto]");
  await form.locator('input[name="nombre"]').fill(`Curioso ${s}`);
  await form.locator('input[name="telefono"]').fill(`000 6${s}1`);
  await form.locator('button:has-text("Anotar")').click();
  const fila = r.locator("li", { hasText: `Curioso ${s}` }).first();
  await fila.waitFor({ timeout: 30000 });
  const wa = await fila.locator('a[href*="wa.me"]').first().getAttribute("href").catch(() => null);
  chequear(!!wa, "9:30 · anota al que preguntó (nombre y celular) y tiene el WhatsApp armado", "el prospecto no tiene WhatsApp");
  if (wa) chequear(/https?:\/\/\S+/.test(decodeURIComponent(wa).split("?text=")[1] ?? ""), "9:30 · y el mensaje lleva el link de la página (REV-1b)", `el WhatsApp no lleva la página: ${decodeURIComponent(wa)}`);

  // 10:00 · Pase de prueba gratis (una vez por DNI).
  falta("10:00 · pase de prueba gratis una vez por DNI: hoy se vende un pase diario o se lo anota como prospecto “vino a probar”");

  // 15:00 · Proveedor de agua.
  await r.goto(`${G}/panel/caja`);
  await r.locator('button:has-text("Sale plata")').click();
  await r.locator('input[placeholder="$"]').fill("3.000");
  await r.locator('input[placeholder^="Motivo"]').fill(`Proveedor agua ${s}`);
  await r.locator('button:has-text("Anotar")').click();
  await r.locator('button:has-text("Sale plata")').waitFor({ timeout: 30000 });
  ok("15:00 · retiro de $3.000 con motivo “Proveedor agua”");
  falta("15:00 · foto del ticket en el retiro y que el stock suba con la compra al proveedor");

  // 19:00 · Transferencias.
  await r.goto(`${G}/panel/transferencias`);
  await r.locator("main h1").waitFor({ timeout: 60000 });
  chequear(!(await aparece(r.getByText(/No tenés acceso/), 2000)), "19:00 · abre Transferencias para aprobar en un toque", "la recepción no puede abrir Transferencias");

  // 21:00 · Un socio pide la baja: le ofrece pausa (no se confirma).
  await r.goto(`${G}/panel/entrada`);
  await r.locator('input[aria-label="Buscar socio"]').fill("Testigo Al Dia");
  await r.locator("button.fila", { hasText: /Testigo Al D[ií]a/ }).first().click();
  const ficha = await r.locator('a:has-text("Ver ficha")').first().getAttribute("href", { timeout: 30000 }).catch(() => null);
  if (ficha) {
    await r.goto(`${G}${ficha}`);
    const baja = r.locator('button:has-text("Dar de baja")').first();
    if (await aparece(baja, 30000)) {
      await baja.click();
      // Primero el motivo; después (si tiene membresía) "¿le ofreciste una pausa?" (RET-3, lo prueba su e2e).
      // Acá no se toca ningún motivo: con algunos la baja es inmediata y este socio es un caso testigo.
      chequear(await aparece(r.getByText("¿Por qué se va?"), 10000), "21:00 · la baja empieza preguntando por qué se va (y después ofrece la pausa)", "la baja no pregunta el motivo");
      await r.locator('button:has-text("Cancelar")').last().click();
    } else ok("21:00 · la recepción no da bajas: lo pide el socio desde la app o lo hace la dueña");
  } else falla("21:00 · desde la Entrada no se llega a la ficha del socio");

  // 22:00 · Cierre a ciegas.
  await r.goto(`${G}/panel/caja`);
  await r.locator('button:has-text("Cerrar caja")').click();
  await r.locator('input[placeholder="$ contado"]').fill("7.000");
  await r.locator('button:has-text("Cerrar con este monto")').click();
  await r.locator('button:has-text("Listo")').waitFor({ timeout: 30000 });
  const cierre = (await r.locator("main").innerText()).replace(/\s+/g, " ");
  chequear(/Cerró justo|cierra justo|\$0|sin diferencia/i.test(cierre) || !/Faltan|Sobran/.test(cierre), "22:00 · cierra con $7.000 contados ($10.000 − $3.000): cierra justo", `cierre: ${cierre.slice(0, 200)}`);
  const compartir = await r.locator("a[data-compartir-cierre]").getAttribute("href").catch(() => null);
  chequear(!!compartir, "22:00 · el cierre se puede mandar por WhatsApp", "el cierre no se puede compartir");
  await r.locator('button:has-text("Listo")').click();
  await capturar(r, "rev1-compu-cierre");
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);

  // 12:00 / 22:00 · La dueña mira el celular.
  const d = await pagina(b, CELU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.locator("h1").first().waitFor({ timeout: 60000 });
  const inicio = (await d.locator("main").innerText()).replace(/\s+/g, " ");
  chequear(/Testigo Sin Pago/.test(inicio), "la dueña ve en Inicio a quién dejaron pasar hoy", "Inicio no muestra a quién dejaron pasar");
  await d.goto(`${G}/panel/caja/historial`);
  const turno = d.locator("[data-turnos] > li", { hasText: `Proveedor agua ${s}` });
  chequear(await aparece(turno, 30000), "la dueña ve el turno de Ana con el retiro y lo contado", "la dueña no ve el turno de hoy");
  await capturar(d, "rev1-celu-duena");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.landing_gimnasio set publicada = $1 where gimnasio_id = (select id from public.gimnasios where slug = 'demo')`, [publicada]);
  await db.end();
}
await b.close();
resultado();
