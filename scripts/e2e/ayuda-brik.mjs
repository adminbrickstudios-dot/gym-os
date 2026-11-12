#!/usr/bin/env node
// H6 · Canal de errores de Temple Gym: el botón "¿Necesitás ayuda?" del dueño y de la recepción arma un link
// de WhatsApp a BRIK (wa.me) con la pantalla, quién escribe (nombre y rol) y el último error visible.
// El número sale de los datos (plataforma_contacto), nunca del código; sin número no hay botón de WhatsApp.
// Un reporte de prueba llega con su contexto (el link y, para el dueño, el pedido guardado en la base).
//   node scripts/e2e/ayuda-brik.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const s = Date.now().toString().slice(-6);
const NUMERO = `+54900055${s.slice(-4)}`;
const DIGITOS = NUMERO.replace(/\D/g, "");
const ERROR = `e2e: no se pudo guardar el plan ${s}`;
const [{ whatsapp: original }] = (await db.query(`select whatsapp from public.plataforma_contacto where id`)).rows;
const poner = (w) => db.query(`update public.plataforma_contacto set whatsapp = $1 where id`, [w]);
const G = GIMNASIO("demo");
const b = await navegador();
try {
  await poner(NUMERO);

  // ── 1. El dueño: el link lleva la pantalla, quién es y el último error ──
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid", undefined, G);
  await d.goto(`${G}/panel/control`);
  const caja = d.locator("[data-ayuda-brik]");
  await caja.waitFor({ timeout: 60000 });
  await d.evaluate((m) => { setTimeout(() => { throw new Error(m); }, 0); }, ERROR);
  await d.waitForTimeout(500);
  const wa = caja.locator("[data-ayuda-whatsapp]");
  await wa.waitFor({ timeout: 30000 });
  const href = await wa.getAttribute("href");
  const texto = decodeURIComponent((href ?? "").split("text=")[1] ?? "");
  chequear(href?.startsWith(`https://wa.me/${DIGITOS}?text=`) ?? false, "dueño: el link va al número que cargó BRIK (de los datos)", `link: ${href}`);
  chequear(texto.includes("Pantalla: /panel/control") && texto.includes("Quién: Sofía (dueño)") && texto.includes(ERROR),
    "dueño: el link lleva la pantalla, nombre y rol, y el último error", `texto del link: ${texto}`);
  chequear(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(texto) && !/@/.test(texto), "el link no lleva ids ni mails (sin datos personales)", `el texto lleva datos: ${texto}`);
  await capturar(d, "ayuda-brik-compu-dueno");

  // El pedido guardado en la base (VD-40) sigue andando y también llega con su contexto.
  await caja.locator("button:has-text('Necesitás ayuda')").click();
  await caja.locator("textarea").fill(`Reporte de prueba H6 ${s}`);
  await caja.locator("button:has-text('Enviar a BRIK')").click();
  await caja.locator("[data-ayuda-enviada]").waitFor({ timeout: 30000 });
  const [fila] = (await db.query(`select a.pantalla, a.ultimo_error from public.ayudas_brik a where a.mensaje = $1`, [`Reporte de prueba H6 ${s}`])).rows;
  chequear(fila?.pantalla === "/panel/control" && (fila?.ultimo_error ?? "").includes(ERROR), "el reporte guardado llega a BRIK con pantalla y último error", `fila: ${JSON.stringify(fila)}`);
  d.errores.length = 0;   // el error de arriba lo provocó la prueba

  // ── 2. Recepción: solo el WhatsApp (el pedido guardado es del dueño y el encargado) ──
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid", undefined, G);
  await r.goto(`${G}/panel/vencen-hoy`);
  const cajaR = r.locator("[data-ayuda-brik]");
  await cajaR.waitFor({ timeout: 60000 });
  const hrefR = await cajaR.locator("[data-ayuda-whatsapp]").getAttribute("href");
  const textoR = decodeURIComponent((hrefR ?? "").split("text=")[1] ?? "");
  chequear(textoR.includes("Quién: Ana (recepción)") && textoR.includes("Pantalla: /panel/vencen-hoy") && (hrefR ?? "").includes(`/${DIGITOS}?`),
    "recepción: el botón existe y lleva pantalla, nombre y rol", `texto: ${textoR}`);
  chequear((await cajaR.locator("button").count()) === 0, "recepción: no tiene el formulario del pedido guardado (no cambió quién puede qué)", "la recepción ve el formulario");
  await capturar(r, "ayuda-brik-compu-recepcion");

  // ── 3. La profe no lo ve ──
  const pr = await pagina(b, COMPU);
  pr.setDefaultNavigationTimeout(120000);
  await entrar(pr, "profe@ejemplo.invalid", undefined, G);
  await pr.goto(`${G}/panel`);
  await pr.locator("main").first().waitFor({ timeout: 60000 });
  chequear((await pr.locator("[data-ayuda-brik]").count()) === 0, "la profe no ve el botón de ayuda", "la profe ve el botón de ayuda");

  // ── 4. Sin número cargado: no hay WhatsApp (nunca un número inventado) ──
  await poner(null);
  await d.goto(`${G}/panel/control`);
  await caja.locator("button:has-text('Necesitás ayuda')").waitFor({ timeout: 60000 });
  chequear((await caja.locator("[data-ayuda-whatsapp]").count()) === 0, "dueño sin número cargado: el botón de WhatsApp no aparece (el pedido guardado sí)", "apareció un WhatsApp sin número");
  await r.goto(`${G}/panel/vencen-hoy`);
  await r.locator("main").first().waitFor({ timeout: 60000 });
  chequear((await r.locator("[data-ayuda-brik]").count()) === 0, "recepción sin número cargado: no se muestra nada", "la recepción ve un botón sin número");

  // ── 5. Celular ──
  await poner(NUMERO);
  const c = await pagina(b, CELU);
  c.setDefaultNavigationTimeout(120000);
  await entrar(c, "recepcion@ejemplo.invalid", undefined, G);
  await c.goto(`${G}/panel/vencen-hoy`);
  await c.locator("[data-ayuda-whatsapp]").waitFor({ timeout: 60000 });
  chequear((await c.evaluate(() => document.documentElement.scrollWidth)) <= CELU.width, "celular: sin desborde con el botón de ayuda", "celular: hay desborde");
  await capturar(c, "ayuda-brik-celu-recepcion");
  for (const x of [d, r, pr, c]) if (x.errores.length) falla(x.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await poner(original).catch(() => {});
}
await b.close();
await db.end();
resultado();
