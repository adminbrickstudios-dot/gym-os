#!/usr/bin/env node
// Pase 2.0 · organización, Parte 3 (26/11): el menú de 29 a 12 en cuatro bloques, las pantallas de hoy como pestañas (?pestana=), cada
// dirección vieja a su pestaña, Ctrl K por el nombre viejo, los roles igual, y en el celular Inicio · Entrada · Hoy · Socios · Más.
// Con ORGANIZACION_DEMO=no (la llave apagada, como Temple Gym hoy): el menú de siempre, ninguna dirección vieja se mueve y /panel/bloque/* no existe.
//   node scripts/e2e/organizacion-menu.mjs      (con scripts/local/levantar.sh corriendo; ORGANIZACION_DEMO=si|no igual que levantar.sh)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const LLAVE = (process.env.ORGANIZACION_DEMO ?? "no") === "si";
const camino = (p) => new URL(p.url()).pathname + new URL(p.url()).search;
const ir = async (p, ruta) => { await p.goto(`${G}${ruta}`, { waitUntil: "load", timeout: 90000 }); await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {}); };

const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await ir(d, "/panel");
  if (!LLAVE) {
    // ── Llave apagada: nada cambia ──
    chequear(await d.locator("[data-menu-bloques]").count() === 0, "llave apagada: el menú es el de siempre", "llave apagada: apareció el menú en bloques");
    for (const vieja of ["/panel/avisos", "/panel/vencen-hoy", "/panel/socios", "/panel/retencion", "/panel/gastos", "/panel/configuracion"]) {
      await ir(d, vieja);
      chequear(new URL(d.url()).pathname === vieja, `llave apagada: ${vieja} sigue en su dirección`, `llave apagada: ${vieja} se movió a ${camino(d)}`);
    }
    await ir(d, "/panel/bloque/hoy");
    chequear(new URL(d.url()).pathname === "/panel/tareas", "llave apagada: /panel/bloque/hoy lleva a la pantalla de siempre (Para hacer hoy)", `llave apagada: /panel/bloque/hoy quedó en ${camino(d)}`);
    chequear(await d.locator("[data-boton-fichar-arriba]").count() === 0, "llave apagada: sin el botón Fichar arriba", "llave apagada: apareció el botón Fichar arriba");
  } else {
    // ── Llave prendida: el menú en bloques ──
    const menu = d.locator("aside [data-menu-bloques]");
    await menu.waitFor({ timeout: 20000 });
    const entradas = await menu.locator("[data-bloque-menu]").count();
    chequear(entradas === 12, "la dueña ve 12 entradas en el menú", `la dueña ve ${entradas} entradas (se esperaban 12)`);
    for (const g of ["Hoy", "Socios", "Plata", "Gimnasio"]) chequear(await menu.locator(`[data-grupo="${g}"]`).count() === 1, `bloque ${g}`, `falta el bloque ${g}`);
    chequear(await menu.locator("[data-linea-bloque]").count() === 12, "cada entrada con su línea chica", "falta la línea chica en alguna entrada");
    await capturar(d, "org-compu-menu", true);

    // Pestañas en la dirección, y Atrás vuelve a la anterior.
    await menu.locator('[data-bloque-menu="hoy"]').click();
    await d.waitForURL(/\/panel\/bloque\/hoy/, { timeout: 30000 });
    await d.locator("[data-pestanas-bloque]").waitFor({ timeout: 30000 });
    const pestanas = d.locator("[data-pestanas-bloque] [data-pestana-bloque]");
    chequear(await pestanas.count() >= 4, `Para hacer hoy junta sus pestañas (${await pestanas.count()})`, "Para hacer hoy sin pestañas");
    await d.locator('[data-pestana-bloque="avisos"]').click();
    await d.waitForURL(/pestana=avisos/, { timeout: 30000 });
    chequear(await d.locator('[data-pestana-activa="avisos"]').count() === 1, "la pestaña Avisos de hoy queda en la dirección (?pestana=avisos)", "la pestaña no quedó en la dirección");
    await d.locator('[data-pestana-bloque="transferencias"]').click();
    await d.waitForURL(/pestana=transferencias/, { timeout: 30000 });
    await d.goBack();
    await d.waitForURL(/pestana=avisos/, { timeout: 30000 });
    ok("Atrás vuelve a la pestaña anterior");
    await capturar(d, "org-compu-hoy-avisos", true);

    // Cada dirección vieja a su pestaña, con sus parámetros (la ?pestana= propia viaja como ?sub=).
    const casos = [
      ["/panel/avisos", "/panel/bloque/hoy?pestana=avisos"],
      ["/panel/vencen-hoy?pestana=vencidos", "/panel/bloque/hoy?pestana=vencen_hoy&sub=vencidos"],
      ["/panel/prospectos", "/panel/bloque/socios?pestana=prospectos"],
      ["/panel/retencion", "/panel/bloque/socios?pestana=retencion"],
      ["/panel/gastos", "/panel/bloque/resultado?pestana=gastos"],
      ["/panel/configuracion", "/panel/bloque/ajustes?pestana=configuracion"],
      ["/panel/socios?q=testigo", "/panel/bloque/socios?pestana=socios&q=testigo"],
    ];
    for (const [vieja, nueva] of casos) {
      await ir(d, vieja);
      chequear(camino(d) === nueva, `${vieja} → ${nueva}`, `${vieja} terminó en ${camino(d)} (se esperaba ${nueva})`);
    }
    // Las pantallas de una sola pestaña y las de adentro no se mueven.
    for (const igual of ["/panel/entrada", "/panel/clases", "/panel/caja/historial", "/panel/socios/nuevo"]) {
      await ir(d, igual);
      chequear(new URL(d.url()).pathname === igual, `${igual} no se mueve`, `${igual} se movió a ${camino(d)}`);
    }
    // La pestaña dibuja la pantalla de siempre (no una vacía).
    await ir(d, "/panel/bloque/resultado?pestana=gastos");
    chequear(await d.locator("h1").count() > 0 && !(await d.locator("body").innerText()).match(/Application error|Algo salió mal/), "la pestaña Gastos dibuja la pantalla de Gastos", "la pestaña Gastos quedó rota");

    // Ctrl K encuentra la pantalla por su nombre viejo y lleva a su pestaña.
    await ir(d, "/panel");
    await d.keyboard.press("Control+k");
    const campo = d.locator("[data-buscador-campo]").first();
    await campo.waitFor({ timeout: 10000 });
    await campo.fill("Avisos de hoy");
    await d.keyboard.press("Enter");
    await d.waitForURL(/\/panel\/bloque\/hoy\?pestana=avisos/, { timeout: 30000 }).then(() => ok("Ctrl K: “Avisos de hoy” lleva a su pestaña"), () => falla(`Ctrl K: “Avisos de hoy” terminó en ${camino(d)}`));

    // Roles: la recepción no ve Resultado ni Sueldos; el profe ve Clases y Sala, no Caja.
    const r = await pagina(b, COMPU);
    await entrar(r, "recepcion@ejemplo.invalid");
    await ir(r, "/panel");
    const deRecepcion = await r.locator("aside [data-bloque-menu]").evaluateAll((xs) => xs.map((x) => x.getAttribute("data-bloque-menu")));
    chequear(!deRecepcion.includes("resultado") && !deRecepcion.includes("sueldos") && deRecepcion.includes("caja"), `recepción: ${deRecepcion.join(", ")}`, `recepción ve de más o de menos: ${deRecepcion.join(", ")}`);
    await r.context().close();
    const pr = await pagina(b, COMPU);
    await entrar(pr, "profe@ejemplo.invalid");
    await ir(pr, "/panel");
    const deProfe = await pr.locator("aside [data-bloque-menu]").evaluateAll((xs) => xs.map((x) => x.getAttribute("data-bloque-menu")));
    chequear(deProfe.includes("clases") && !deProfe.includes("caja") && !deProfe.includes("resultado"), `profe: ${deProfe.join(", ")}`, `profe ve de más o de menos: ${deProfe.join(", ")}`);
    await pr.context().close();

    // Celular: Inicio · Entrada · Hoy · Socios · Más, y Más en bloques.
    const c = await pagina(b, CELU);
    await entrar(c, "duena@ejemplo.invalid");
    await ir(c, "/panel");
    const barra = await c.locator('nav[aria-label="Principales"] li a').evaluateAll((xs) => xs.map((x) => x.textContent.trim()));
    chequear(barra.join("|") === "Inicio|Entrada|Hoy|Socios", `celular: ${barra.join(" · ")} · Más`, `celular: la barra es ${barra.join(" · ")}`);
    await c.locator('nav[aria-label="Principales"] button').click();
    const mas = c.locator("[data-mas-bloques]");
    await mas.waitFor({ timeout: 10000 });
    chequear(await mas.locator("[data-bloque-mas]").count() === 12, "Más: los 12 en grilla, por bloque", `Más: ${await mas.locator("[data-bloque-mas]").count()} botones`);
    await capturar(c, "org-celu-mas", true);
    await c.context().close();
  }
  await d.context().close();
} finally {
  await b.close();
}
resultado();
