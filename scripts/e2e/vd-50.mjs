#!/usr/bin/env node
// VD-50 · Doble cobro (D29). Dos personas del equipo (dos sesiones) con la hoja Cobrar abierta sobre la misma cuota:
// la primera cobra; la segunda, al cobrar, se frena con "Ana ya cobró esta cuota hace N s" y solo sigue con
// "Cobrar igual (con motivo)" y un motivo escrito (queda en la venta). "Cancelar" cierra sin cobrar. Abrir la hoja
// después del cobro avisa de entrada. El dueño apaga el aviso en Configuración → Cobros (0 minutos) y se vuelve a cobrar sin preguntar.
//   node scripts/e2e/vd-50.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";
process.env.HORA_NAVEGADOR = "mediodia";   // F8.2: no depende de la hora del día

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();

/** Una persona nueva con plan y sin pagar; devuelve su id. */
async function moroso(p, nombre) {
  await p.goto(`${G}/panel/socios/nuevo`);
  await p.locator('input[name="nombre"]').fill(nombre);
  await elegirPlan(p, 0);
  await p.locator('button:has-text("Solo dar de alta")').click();
  await p.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
  return new URL(p.url()).pathname.split("/").pop();
}
/** Abre la hoja Cobrar de esa persona (Ctrl+K "cobrar …") y elige transferencia (no necesita caja). */
async function abrirCobrar(p, nombre) {
  await p.goto(`${G}/panel/socios`);
  await p.locator('main ul a[href^="/panel/socios/"]').first().waitFor({ timeout: 30000 });
  await p.keyboard.press("Control+k");
  await p.locator('input[placeholder*="cobrar"]').fill(`cobrar ${nombre}`);
  await p.locator("[data-buscador-cobrar]").first().waitFor({ timeout: 30000 });
  await p.keyboard.press("Enter");
  await p.locator("[data-cobrar] [data-cobrar-confirmar]").waitFor({ timeout: 30000 });
  await p.locator('[data-cobrar-medio="transferencia"]').click();
}
const confirmar = (p) => p.locator("[data-cobrar-confirmar]");
const cobrado = (p) => p.locator("[data-cobrar-hecho]");

const db = new pg.Client({ connectionString: url });
await db.connect();
const ventas = async (socio) => (await db.query(
  `select v.id, v.estado, v.doble_cobro_motivo, v.doble_cobro_de, e.nombre as quien
     from public.ventas v left join public.equipo e on e.id = v.creado_por
    where v.socio_id = $1 and v.estado <> 'anulada' order by v.creado_en`, [socio])).rows;
try {
  const r = await pagina(b, COMPU);     // recepción (Ana)
  const d = await pagina(b, COMPU);     // dueña, otra sesión
  await entrar(r, "recepcion@ejemplo.invalid");
  await entrar(d, "duena@ejemplo.invalid");

  // ── 1. Las dos abren la hoja sobre la misma cuota; la primera cobra ──
  const nombre1 = `Doble${s5}`;
  const socio1 = await moroso(r, nombre1);
  await abrirCobrar(r, nombre1);
  await abrirCobrar(d, nombre1);
  chequear(await d.locator("[data-cobrar-doble]").count() === 0, "al abrir las dos hojas todavía no hay aviso (nadie cobró)", "avisa sin haber cobrado");
  await confirmar(r).click();
  await cobrado(r).waitFor({ timeout: 30000 });
  ok("la recepción cobró la cuota");

  // ── 2. La segunda sesión (pantalla vieja) cobra: la base la frena y la hoja pregunta ──
  await confirmar(d).click();
  const aviso = d.locator("[data-cobrar-doble]");
  await aviso.waitFor({ timeout: 30000 });
  const texto = await aviso.innerText();
  chequear(/Ana ya cobró esta cuota hace \d+ (s|min)/.test(texto), `frena con quién y hace cuánto: “${texto.replace(/\s+/g, " ").slice(0, 110)}…”`, `el aviso dice: ${texto}`);
  chequear(await confirmar(d).isDisabled(), "Cobrar queda apagado hasta confirmar con motivo", "se puede cobrar sin confirmar");
  chequear((await ventas(socio1)).length === 1, "no se cobró de más: una sola venta", `ventas: ${(await ventas(socio1)).length}`);
  await capturar(d, "vd50-compu-aviso");
  // Celular: el aviso entra en 390 px.
  await d.setViewportSize(CELU);
  const ancho = await d.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `el aviso en celular sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  await capturar(d, "vd50-celu-aviso");
  await d.setViewportSize(COMPU);

  // ── 3. "Cobrar igual (con motivo)": sin motivo no avanza; con motivo cobra y queda anotado ──
  await d.locator("[data-cobrar-doble-igual]").click();
  const motivo = d.locator("[data-cobrar-doble-motivo]");
  await motivo.waitFor({ timeout: 10000 });
  chequear(await confirmar(d).isDisabled(), "sin motivo escrito, Cobrar igual sigue apagado", "cobra sin motivo");
  await motivo.fill("Paga también el mes que viene");
  chequear(await confirmar(d).isEnabled(), "con motivo, Cobrar igual se habilita", "no se habilita con motivo");
  await confirmar(d).click();
  await cobrado(d).waitFor({ timeout: 30000 });
  const v = await ventas(socio1);
  chequear(v.length === 2 && v[1].doble_cobro_motivo === "Paga también el mes que viene" && v[1].doble_cobro_de === v[0].id && v[0].quien?.startsWith("Ana"),
    "el cobro igual quedó con su motivo y apunta al cobro anterior (de Ana)", JSON.stringify(v));
  await d.locator("[data-cobrar-volver]").click();

  // ── 4. Cancelar: no cobra y cierra la hoja ──
  const nombre2 = `DobleB${s5}`;
  const socio2 = await moroso(r, nombre2);
  await abrirCobrar(r, nombre2);
  await abrirCobrar(d, nombre2);
  await confirmar(r).click();
  await cobrado(r).waitFor({ timeout: 30000 });
  await confirmar(d).click();
  await d.locator("[data-cobrar-doble]").waitFor({ timeout: 30000 });
  await d.locator("[data-cobrar-doble-cancelar]").click();
  await d.locator("[data-cobrar]").waitFor({ state: "detached", timeout: 10000 });
  chequear((await ventas(socio2)).length === 1, "Cancelar: cierra la hoja y no cobra de más", `ventas: ${(await ventas(socio2)).length}`);

  // ── 5. Una hoja que se abre DESPUÉS del cobro avisa de entrada; lo que no es la cuota no se frena ──
  await abrirCobrar(d, nombre2);
  chequear(await d.locator("[data-cobrar-doble]").count() === 1 && await confirmar(d).isDisabled(), "abrir la hoja justo después del cobro: avisa y frena de entrada", "no avisó al abrir");
  await d.locator("[data-cobrar-linea=cuota] button[aria-label='Uno menos']").click();   // sin la cuota, ya no hay nada que frenar
  chequear(await d.locator("[data-cobrar-doble]").count() === 0, "sin la cuota en el cobro, el aviso desaparece (un producto nunca se frena)", "el aviso sigue sin cuota");
  await d.keyboard.press("Escape");

  // ── 6. El dueño lo apaga en Configuración → Cobros y se cobra sin preguntar; después lo deja como estaba ──
  await d.goto(`${G}/panel/configuracion?pestana=cobros`);
  const tarjeta = d.locator("[data-doble-cobro-config]");
  await tarjeta.waitFor({ timeout: 30000 });
  chequear(/Sofi ya cobró|ya cobró esta cuota/.test(await tarjeta.innerText()), "Configuración → Cobros explica el aviso", await tarjeta.innerText());
  await tarjeta.locator('input[aria-label="Minutos del aviso de doble cobro"]').fill("0");
  await tarjeta.locator('button:has-text("Guardar")').click();
  await tarjeta.getByText(/apagado/i).first().waitFor({ timeout: 30000 });
  await abrirCobrar(d, nombre2);
  chequear(await d.locator("[data-cobrar-doble]").count() === 0 && await confirmar(d).isEnabled(), "con 0 minutos el aviso está apagado", "avisa con el aviso apagado");
  await d.keyboard.press("Escape");
  await d.goto(`${G}/panel/configuracion?pestana=cobros`);
  await tarjeta.locator('input[aria-label="Minutos del aviso de doble cobro"]').fill("2");
  await tarjeta.locator('button:has-text("Guardar")').click();
  await tarjeta.getByText(/Guardado/).first().waitFor({ timeout: 30000 });
  ok("el dueño dejó el aviso en 2 minutos otra vez");

  // El encargado ve el tiempo pero no lo cambia (toca plata: solo el dueño).
  const e = await pagina(b, COMPU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel/configuracion?pestana=cobros`);
  await e.locator("[data-doble-cobro-config]").waitFor({ timeout: 30000 });
  chequear(await e.locator("[data-doble-cobro-config] input:not([disabled])").count() === 0, "el encargado ve el aviso pero no puede cambiar el tiempo", "el encargado puede editar el aviso");

  for (const [quien, p] of [["recepción", r], ["dueña", d], ["encargado", e]]) if (p.errores.length) falla(`${quien}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(e.stack ?? String(e));
} finally {
  await db.end().catch(() => {});
  await b.close();
}
resultado();
