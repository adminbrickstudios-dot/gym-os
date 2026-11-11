#!/usr/bin/env node
// VD-49 · Efectivo sin caja (D32). Cobrar en efectivo sin turno abierto ofrece "Abrir mi turno" con el fondo en la
// MISMA hoja, sin perder lo cargado; transferencia y tarjeta cobran sin caja; el efectivo cae en la caja de quien
// cobra (la dueña lo ve en Caja); un turno abierto de ayer (sin contar) no recibe plata: se abre otro y se sigue.
//   node scripts/e2e/vd-49.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const plata = (n) => Number(n).toLocaleString("es-AR");

/** Una persona nueva con plan y sin pagar. */
async function moroso(p, nombre) {
  await p.goto(`${G}/panel/socios/nuevo`);
  await p.locator('input[name="nombre"]').fill(nombre);
  await elegirPlan(p, 0);
  await p.locator('button:has-text("Solo dar de alta")').click();
  await p.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
}
/** Ctrl+K "cobrar …" abre la hoja Cobrar de esa persona. */
async function abrirCobrar(p, nombre) {
  await p.goto(`${G}/panel/socios`);
  await p.locator('main ul a[href^="/panel/socios/"]').first().waitFor({ timeout: 30000 });
  await p.keyboard.press("Control+k");
  await p.locator('input[placeholder*="cobrar"]').fill(`cobrar ${nombre}`);
  await p.locator("[data-buscador-cobrar]").first().waitFor({ timeout: 30000 });
  await p.keyboard.press("Enter");
  await p.locator("[data-cobrar] [data-cobrar-confirmar]").waitFor({ timeout: 30000 });
}
const medio = (p, m) => p.locator(`[data-cobrar-medio="${m}"]`);
const panelTurno = (p) => p.locator('[data-cobrar-sin-caja="abrir"]');
const cerrarTurnoDe = async (p) => {
  await p.goto(`${G}/panel/caja`);
  await p.locator("main h1").waitFor();
  if (await p.locator('button:has-text("Cerrar caja")').count()) {
    await p.locator('button:has-text("Cerrar caja")').first().click();
    await p.locator('input[placeholder="$ contado"]').fill("0");
    await p.locator('button:has-text("Cerrar con este monto")').click();
    await p.locator('button:has-text("Listo")').click();
  }
};

const db = new pg.Client({ connectionString: url });
await db.connect();
try {
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await cerrarTurnoDe(r);                       // sin turno de otra prueba

  const nombre1 = `SinCaja${s5}`;
  await moroso(r, nombre1);

  // ── 1. Efectivo sin turno: "Abrir mi turno" en la misma hoja ──
  await abrirCobrar(r, nombre1);
  chequear(await r.locator("[data-cobrar-linea=cuota]").count() === 1, "la hoja trae la cuota", "no trae la cuota");
  chequear(await medio(r, "efectivo").getAttribute("aria-pressed") !== "true", "sin turno la hoja no arranca en efectivo (se elige y ofrece abrir el turno)", "arrancó en efectivo sin turno");
  await medio(r, "transferencia").click();
  chequear(await panelTurno(r).count() === 0 && await r.locator("[data-cobrar-confirmar]").isEnabled(), "con transferencia no pide caja y se puede cobrar", "la transferencia pide caja");
  await medio(r, "efectivo").click();
  await panelTurno(r).waitFor({ timeout: 10000 });
  chequear(await r.locator("[data-cobrar-confirmar]").isDisabled(), "efectivo sin turno: Cobrar queda apagado hasta abrir el turno", "se puede cobrar sin turno");
  chequear(await r.locator("[data-cobrar-linea=cuota]").count() === 1, "…y lo cargado sigue ahí", "se perdió la cuota");
  await capturar(r, "vd49-compu-abrir-turno");

  // Celular (390 px): la oferta entra sin desbordar.
  await r.setViewportSize(CELU);
  const ancho = await r.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `la hoja con “Abrir mi turno” en celular sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  const alto = await r.locator("[data-abrir-turno]").evaluate((e) => e.getBoundingClientRect().height);
  chequear(alto >= 44, `el botón “Abrir mi turno” mide ${Math.round(alto)} px (mínimo 44)`, `botón de ${Math.round(alto)} px`);
  await capturar(r, "vd49-celu-abrir-turno");
  await r.setViewportSize(COMPU);

  // El fondo, con el aviso si no coincide con lo que dejó el turno anterior (si dejó algo).
  await r.locator('input[aria-label="Fondo del turno"]').fill("1.000");
  await r.locator("[data-abrir-turno]").click();
  await panelTurno(r).waitFor({ state: "detached", timeout: 30000 });
  await r.locator("[data-cobrar-caja]").waitFor({ timeout: 10000 });
  chequear(await r.locator("[data-cobrar-linea=cuota]").count() === 1 && await r.locator("[data-cobrar-confirmar]").isEnabled(),
    "abrí el turno en la misma hoja: sigue la cuota y Cobrar queda a mano", "al abrir el turno se perdió lo cargado o no se habilitó");
  chequear(/queda en tu caja/.test(await r.locator("[data-cobrar-caja]").innerText()), "dice que el efectivo queda en mi caja", await r.locator("[data-cobrar-caja]").innerText());
  await r.locator("[data-cobrar-confirmar]").click();
  const hecho = r.locator("[data-cobrar-hecho]");
  await hecho.waitFor({ timeout: 30000 });
  const total1 = Number(await hecho.getAttribute("data-total"));
  ok(`cobró ${plata(total1)} en efectivo desde la misma hoja`);
  await capturar(r, "vd49-compu-cobrado");
  await r.keyboard.press("Escape");

  // ── 2. La caja muestra el cobro (la dueña ve lo esperado: fondo + efectivo) ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/caja`);
  await d.getByText("Tiene que haber").first().waitFor({ timeout: 30000 });
  const esperado = `$${plata(1000 + total1)}`;
  const txt = await d.locator("main").innerText();
  chequear(txt.includes(esperado), `Caja: tiene que haber ${esperado} (fondo $1.000 + el cobro de ${plata(total1)})`, `Caja no muestra ${esperado}: ${txt.replace(/\s+/g, " ").slice(0, 400)}`);
  await capturar(d, "vd49-compu-caja-con-cobro");

  // ── 3. Un turno que quedó abierto de ayer no recibe plata: se abre otro en la hoja y se sigue ──
  await db.query(`update public.turnos_caja t set abierto_en = abierto_en - interval '1 day'
                    from public.equipo e where e.id = t.abierto_por and t.cerrado_en is null and e.nombre like 'Ana%'`);
  const nombre2 = `SinCajaB${s5}`;
  await moroso(r, nombre2);
  await abrirCobrar(r, nombre2);
  await medio(r, "efectivo").click();
  await panelTurno(r).waitFor({ timeout: 10000 });
  chequear(/otro día/.test(await panelTurno(r).innerText()), "con el turno de ayer sin contar, la hoja avisa y ofrece abrir uno nuevo", await panelTurno(r).innerText());
  await r.locator('input[aria-label="Fondo del turno"]').fill("500");
  await r.locator("[data-abrir-turno]").click();
  await panelTurno(r).waitFor({ state: "detached", timeout: 30000 });
  // VD-50: si la base avisa que esa cuota ya se cobró hace segundos, la prueba sigue con motivo (cobra dos veces a propósito).
  if (await r.locator("[data-cobrar-doble-igual]").waitFor({ timeout: 3000 }).then(() => true, () => false)) {
    await r.locator("[data-cobrar-doble-igual]").click();
    await r.locator("[data-cobrar-doble-motivo]").fill("Otro cobro, a propósito (prueba)");
  }
  // Si Cobrar no se habilita se dice qué hay en la hoja (en vez de esperar 30 s a ciegas).
  await r.waitForFunction(() => { const b = document.querySelector("[data-cobrar-confirmar]"); return !!b && !b.disabled; }, null, { timeout: 10000 }).catch(async () => {
    const hoja = await r.locator("[data-cobrar]").first().innerText().catch(() => "(sin hoja)");
    throw new Error(`Cobrar sigue apagado tras abrir el turno nuevo. Hoja: ${hoja.replace(/\s+/g, " ").slice(0, 700)}`);
  });
  await r.locator("[data-cobrar-confirmar]").click();
  await r.locator("[data-cobrar-hecho]").waitFor({ timeout: 30000 });
  const total2 = Number(await r.locator("[data-cobrar-hecho]").getAttribute("data-total"));
  const { rows } = await db.query(`select t.sin_contar, t.monto_contado, t.cerrado_en is not null as cerrada,
      (select count(*)::int from public.pagos p where p.turno_caja_id = t.id) as pagos
    from public.turnos_caja t join public.equipo e on e.id = t.abierto_por
    where e.nombre like 'Ana%' order by t.abierto_en desc limit 30`);
  const vieja = rows.find((x) => x.sin_contar);
  chequear(!!vieja && vieja.cerrada && vieja.monto_contado === null && vieja.pagos === 1,
    "el turno de ayer quedó cerrado sin contar y con su único cobro: el de ahora entró en el turno nuevo", JSON.stringify(rows));
  ok(`segundo cobro (${plata(total2)}) en el turno nuevo`);
  await r.keyboard.press("Escape");

  // Se deja todo como estaba: el turno viejo lo cuenta el dueño (se marca revisado) y el nuevo se cierra.
  await db.query(`update public.turnos_caja set revisado_en = now(), revisado_por = abierto_por, revisado_nota = 'e2e vd-49'
                   where sin_contar and monto_contado is null and revisado_en is null`);
  await cerrarTurnoDe(r);

  for (const [quien, p] of [["recepción", r], ["dueña", d]]) if (p.errores.length) falla(`${quien}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(e.stack ?? String(e));
} finally {
  await db.end().catch(() => {});
  await b.close();
}
resultado();
