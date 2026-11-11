#!/usr/bin/env node
// VD-37 · Pendientes (números del menú) y centro de notificaciones: el menú trae sus números de la base,
// cobrarle a uno que vence hoy baja el número de "Vencen y cobrar" sin recargar, el rojo es solo de lo que
// se pierde hoy, Inicio nunca lleva número, cada rol ve solo los suyos, la campana agrupa por día,
// "Marcar todo como leído" la deja en cero y las preferencias sacan un tipo de MI campana.
//   node scripts/e2e/vd-37.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, PANTALLA_ROTA, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
// F1.9: un error que nadie atrapó deja de colgar el recorrido sin ✗: se escribe qué esperaba y cuándo, y se corta con código 1.
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const G = GIMNASIO();
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const b = await navegador();

/** Espera a que el menú lateral muestre ese número para una sección (0 = sin número). */
const esperarNumero = (p, clave, n, ms = 30000) => p.waitForFunction(([c, esperado]) => {
  const el = document.querySelector(`aside [data-pendiente="${c}"]`);
  return (el ? Number(el.getAttribute("data-numero")) : 0) === esperado;
}, [clave, n], { timeout: ms });

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");

  // ── 1 · El número de Vencen y cobrar es el de la pestaña "Vencen hoy" ──
  await d.goto(`${G}/panel/vencen-hoy`);
  await d.locator("[data-pestanas]").waitFor({ timeout: 60000 });
  const cuenta = Number((await d.locator('[data-pestana="hoy"] [data-cuenta]').innerText()).trim());
  chequear(cuenta > 0, `hay ${cuenta} que vencen hoy en el demo`, "el demo no tiene a nadie que venza hoy: no se puede probar el cobro");
  await esperarNumero(d, "vencen_hoy", cuenta);
  ok(`el menú dice ${cuenta} en “Vencen y cobrar”, igual que la pestaña (lo calcula la base)`);

  // ── 2 · La regla del rojo y Inicio sin número ──
  chequear(await d.locator('aside [data-pendiente="vencen_hoy"]').getAttribute("data-rojo") === "si", "Vencen y cobrar va en rojo: se pierde si no se cobra hoy", "Vencen no está en rojo");
  const neutros = await d.locator('aside [data-pendiente][data-rojo="no"]').count();
  const rojosMal = await d.locator('aside [data-pendiente="tareas"][data-rojo="si"], aside [data-pendiente="prospectos"][data-rojo="si"], aside [data-pendiente="control"][data-rojo="si"]').count();
  chequear(rojosMal === 0, `lo informativo (${neutros} números) es neutro, no rojo`, "Para hacer hoy, Interesados o Control salieron en rojo");
  chequear(await d.locator('aside a[href="/panel"] [data-pendiente]').count() === 0, "Inicio nunca lleva número", "Inicio tiene número");
  await capturar(d, "vd37-compu-menu");

  // ── 3 · Cobrarle a uno baja el número, sin recargar ──
  const fila = d.locator('[data-lista-vencen="hoy"] > li').first();
  await fila.locator('a:has-text("Cobrar"), button:has-text("Cobrar")').first().click();
  await d.locator("[data-cobrar-linea=cuota]").waitFor({ timeout: 30000 });
  await d.locator('[data-cobrar-medio="transferencia"]').click();
  await d.locator("[data-cobrar-comprobante] input[type=file]").setInputFiles({ name: "comprobante.png", mimeType: "image/png", buffer: PNG });
  await d.locator("[data-cobrar-archivo]").waitFor({ timeout: 10000 });
  await d.locator("[data-cobrar-confirmar]").click();
  const error = d.locator('[data-cobrar] [role="alert"]');
  await Promise.race([
    d.locator("[data-cobrar-hecho]").waitFor({ timeout: 30000 }),
    error.waitFor({ timeout: 30000 }).then(async () => { throw new Error(`al cobrar: ${await error.innerText()}`); }),
  ]);
  await esperarNumero(d, "vencen_hoy", cuenta - 1);
  ok(`cobrar a uno bajó “Vencen y cobrar” de ${cuenta} a ${cuenta - 1}, sin recargar la página`);
  await d.locator("[data-cobrar-volver]").click();
  await d.goto(`${G}/panel/vencen-hoy`);
  await d.locator("[data-pestanas]").waitFor({ timeout: 60000 });
  const despues = Number((await d.locator('[data-pestana="hoy"] [data-cuenta]').innerText()).trim());
  chequear(despues === cuenta - 1, `la pestaña también dice ${despues}: el número y la lista son la misma cuenta`, `la pestaña dice ${despues} y se esperaba ${cuenta - 1}`);
  await esperarNumero(d, "vencen_hoy", despues);

  // ── 4 · Cada rol ve lo suyo ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/vencen-hoy`);
  await r.locator("[data-pestanas]").waitFor({ timeout: 60000 });
  await esperarNumero(r, "vencen_hoy", despues);
  chequear(await r.locator('aside [data-pendiente="control"], aside [data-pendiente="socios"]').count() === 0, "la recepción no ve los números de Control ni de pedidos de socios", "la recepción ve números de gestión");
  ok(`la recepción ve el mismo ${despues} en Vencen y cobrar`);

  // ── 5 · Celular: el menú con números, sin desbordes ──
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel`);
  await c.locator('nav[aria-label="Principales"]').waitFor({ timeout: 30000 });
  await c.locator('button:has-text("Menú")').click();
  await c.locator('[role="dialog"][aria-label="Menú"]').waitFor({ timeout: 10000 });
  chequear(await c.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "celular 390 px: el menú con números no desborda", "desborda a lo ancho");
  await capturar(c, "vd37-celu-menu");

  // ── 6 · La campana: agrupada por día, marcar todo leído, preferencias ──
  let probadoMarcar = false;
  for (const [quien, mail] of [["la dueña", "duena@ejemplo.invalid"], ["la recepción", "recepcion@ejemplo.invalid"], ["el profe", "profe@ejemplo.invalid"]]) {
    const p = await pagina(b, COMPU);
    await entrar(p, mail);
    await p.goto(`${G}/panel/campana`);
    await p.locator("main h1").waitFor({ timeout: 60000 });
    chequear(!PANTALLA_ROTA.test(await p.locator("body").innerText()), `${quien}: Novedades abre`, `${quien}: Novedades rota`);
    const grupos = await p.locator("[data-grupos-dia] section[data-dia]").count();
    const filas = await p.locator("[data-grupos-dia] li[data-novedad]").count();
    if (filas) ok(`${quien}: ${filas} avisos en ${grupos} día${grupos === 1 ? "" : "s"} (Hoy / Ayer / fecha)`);
    if (!probadoMarcar && await p.locator("[data-marcar-todo]").count()) {
      await p.locator("[data-marcar-todo]").click();
      await p.waitForFunction(() => document.querySelectorAll('[data-novedad="nueva"]').length === 0, null, { timeout: 30000 });
      await p.waitForFunction(() => document.querySelector("a[data-campana]")?.getAttribute("data-campana") === "0" || !document.querySelector("a[data-campana]")?.getAttribute("data-campana"), null, { timeout: 30000 });
      ok(`${quien}: “Marcar todo como leído” deja la campana en cero`);
      probadoMarcar = true;
    }
    // Preferencias: apagar un tipo y volver a prenderlo.
    const caja = p.locator("[data-preferencias-avisos] summary");
    await caja.click();
    const primero = p.locator("[data-preferencias] input[data-pref]").first();
    await primero.waitFor({ timeout: 10000 });
    const tipo = await primero.getAttribute("data-pref");
    await primero.uncheck();
    await p.getByText("Guardado.").waitFor({ timeout: 30000 });
    await p.reload();
    await p.locator("[data-preferencias-avisos] summary").click();
    chequear(!(await p.locator(`[data-pref="${tipo}"]`).isChecked()), `${quien}: apagó “${tipo}” y quedó guardado`, `${quien}: la preferencia no se guardó`);
    chequear(await p.locator(`[data-novedad][data-tipo="${tipo}"]`).count() === 0, `${quien}: sin avisos de “${tipo}” en su campana`, `${quien}: siguen apareciendo avisos de ${tipo}`);
    await p.locator(`[data-pref="${tipo}"]`).check();
    await p.getByText("Guardado.").waitFor({ timeout: 30000 });
    ok(`${quien}: lo volvió a prender`);
    if (p.errores.length) falla(`${quien}: ${p.errores.join(" | ")}`);
    if (quien === "la dueña") await capturar(p, "vd37-compu-campana");
  }
  if (!probadoMarcar) ok("nadie tenía avisos sin leer: “Marcar todo” no se mostró (correcto, no hay nada que marcar)");

  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} finally {
  await b.close();
}
resultado();
