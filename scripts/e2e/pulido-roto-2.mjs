#!/usr/bin/env node
// H7 · Las pruebas propias de lo que quedó 🟡 en PULIDO.md, pantalla por pantalla y con sesión real (todo en el demo):
//   1. Una búsqueda vieja no pisa a la nueva (Entrada y Vender), y en Vender un error de la búsqueda no se dice "No está".
//   2. El error al anotar una entrada sale DENTRO del veredicto (una sola vez) y el veredicto vuelve a estar a mano.
//   3. El rojo y sus botones tienen ícono (nada de emojis crudos ni botones vacíos).
//   4. Cobrar no se cierra mientras "Cobrando…" (Esc, la X ni tocar afuera) y sí después.
//   5. "Abrir mi turno" en Vender no pierde el carrito.
//   6. La caja: sus botones con ícono y sin emojis crudos.
//   7. La hora del cierre que se manda por WhatsApp sale en la zona del gimnasio (el navegador corre en Tokio).
//   node scripts/e2e/pulido-roto-2.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const EMOJI = /\p{Extended_Pictographic}/u;
const esAccion = (rq) => rq.method() === "POST" && !!rq.headers()["next-action"];

/** Frena (ms) las acciones del servidor cuyo cuerpo cumple `cuando`; el resto pasa. */
async function demorar(p, cuando, ms) {
  await p.route(/\/panel\//, async (route) => {
    const rq = route.request();
    if (esAccion(rq) && cuando(rq.postData() ?? "")) await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}
/** Corta (aborta) las acciones del servidor que cumplen `cuando`. */
async function cortar(p, cuando) {
  await p.route(/\/panel\//, async (route) => {
    const rq = route.request();
    if (esAccion(rq) && cuando(rq.postData() ?? "")) await route.abort("failed"); else await route.continue();
  });
}
const cerrarTurno = async (p) => {
  await p.goto(`${G}/panel/caja`);
  await p.locator("main h1").waitFor({ timeout: 60000 });
  if (await p.locator('button:has-text("Cerrar caja")').count()) {
    await p.locator('button:has-text("Cerrar caja")').first().click();
    await p.locator('input[placeholder="$ contado"]').fill("0");
    await p.locator('button:has-text("Cerrar con este monto")').click();
    await p.locator("[data-compartir-cierre]").waitFor({ timeout: 30000 });
    await p.locator('button:has-text("Listo")').click();
  }
};
/** Una persona nueva con plan y sin pagar (para cobrarle en la hoja). */
async function moroso(p, nombre) {
  await p.goto(`${G}/panel/socios/nuevo`);
  await p.locator('input[name="nombre"]').fill(nombre);
  await elegirPlan(p, 0);
  await p.locator('button:has-text("Solo dar de alta")').click();
  await p.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
}

const db = new pg.Client({ connectionString: url });
await db.connect();
try {
  const [{ zona }] = (await db.query(`select zona_horaria as zona from public.gimnasios where slug = 'demo'`)).rows;
  const tel = async (apellido) => (await db.query(`select regexp_replace(s.telefono, '\\D', '', 'g') as t from public.socios s join public.gimnasios g on g.id = s.gimnasio_id
                                                   where g.slug = 'demo' and s.nombre = 'Testigo' and s.apellido = $1`, [apellido])).rows[0].t;
  const [telPack, telCumple, telSin, telAl, telPor] = await Promise.all(["Con Pack", "Cumpleañero", "Sin Pago", "Al Día", "Por Vencer"].map(tel));

  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");

  // ── 1a. Entrada: la búsqueda vieja (lenta) no pisa a la nueva ──
  await r.goto(`${G}/panel/entrada`);
  const buscar = r.locator('input[aria-label="Buscar socio"]');
  await buscar.waitFor({ timeout: 60000 });
  // (se busca por el celular entero: la búsqueda por nombre es tolerante y trae a todos los “Testigo”)
  await demorar(r, (c) => c.includes(telPack), 4000);
  await buscar.fill(telPack);
  await r.waitForTimeout(700);                    // el pedido lento ya salió
  await buscar.fill(telCumple);
  await r.locator("ul button.fila", { hasText: "Cumpleañero" }).first().waitFor({ timeout: 30000 });
  await r.waitForTimeout(5000);                   // y ahora llega el viejo
  let filas = (await r.locator("ul button.fila").allInnerTexts()).join(" | ");
  chequear(/Cumpleañero/.test(filas) && !/Con Pack/.test(filas), "Entrada: la respuesta vieja (Con Pack) llegó tarde y no pisó la lista de la nueva (Cumpleañero)", `la lista quedó: ${filas.slice(0, 160)}`);
  await r.unroute(/\/panel\//);

  // ── 2 y 3. El veredicto: el rojo con sus íconos, y el error de anotar adentro ──
  await buscar.fill(telSin);
  await r.locator("ul button.fila", { hasText: "Sin Pago" }).first().click();
  const ver = r.locator("[data-veredicto]");
  await ver.waitFor({ timeout: 30000 });
  chequear(await ver.getAttribute("data-veredicto") === "rojo", "Testigo Sin Pago da el veredicto rojo", `dio ${await ver.getAttribute("data-veredicto")}`);
  const textoRojo = await ver.innerText();
  chequear(!EMOJI.test(textoRojo), "el rojo no tiene emojis crudos (solo íconos)", `emoji en el rojo: ${(textoRojo.match(EMOJI) ?? []).join(" ")}`);
  chequear(await ver.locator("p.text-7xl svg").count() === 1, "el rojo tiene su ícono grande", "el ícono grande del rojo está vacío");
  const sinIcono = await ver.locator("button, a.boton").evaluateAll((els) => els.filter((e) => !e.querySelector("svg") && !(e.textContent ?? "").trim()).length);
  const botonesRojo = await ver.locator("button, a.boton").count();
  chequear(botonesRojo > 0 && sinIcono === 0, `los ${botonesRojo} botones del rojo dicen algo (ninguno vacío)`, `${sinIcono} botones vacíos en el rojo`);
  const conIcono = await ver.locator("button.boton:has-text('Otro socio') svg, a.boton:has-text('Ver ficha') svg").count();
  chequear(conIcono === 2, "“Otro socio” y “Ver ficha” llevan ícono", `íconos: ${conIcono} de 2`);
  await r.keyboard.press("Escape");
  await ver.waitFor({ state: "detached", timeout: 10000 });

  await buscar.fill(telAl);
  await r.locator("ul button.fila", { hasText: "Al Día" }).first().click();
  await ver.waitFor({ timeout: 30000 });
  chequear(await ver.getAttribute("data-veredicto") === "verde", "Testigo Al Día da el veredicto verde", `dio ${await ver.getAttribute("data-veredicto")}`);
  await cortar(r, () => true);                    // se corta la conexión con el servidor justo al anotar
  await ver.locator('button:has-text("Anotar entrada")').click();
  const err = ver.locator("[data-veredicto-error]");
  await err.waitFor({ timeout: 30000 });
  chequear(/se cortó la conexión/.test(await err.innerText()), "al anotar con la conexión cortada, el error sale dentro del veredicto", `dice: ${(await err.innerText()).slice(0, 100)}`);
  chequear(await ver.locator('[role="alert"], .mensaje-error').count() <= 1 && await ver.getByText("se cortó la conexión").count() === 1, "…una sola vez (no repetido arriba y abajo)", `se repite ${await ver.getByText("se cortó la conexión").count()} veces`);
  chequear(await ver.locator('button:has-text("Anotar entrada")').isEnabled(), "…y el veredicto sigue a mano para volver a probar", "el botón de anotar quedó apagado");
  await r.unroute(/\/panel\//);
  await r.keyboard.press("Escape");
  await ver.waitFor({ state: "detached", timeout: 10000 });

  // ── 4. Cobrar no se cierra mientras cobra ──
  const nombre = `H7Cobro${s5}`;
  await moroso(r, nombre);
  await r.goto(`${G}/panel/socios`);
  await r.locator('main ul a[href^="/panel/socios/"]').first().waitFor({ timeout: 30000 });
  await r.keyboard.press("Control+k");
  await r.locator('input[placeholder*="cobrar"]').fill(`cobrar ${nombre}`);
  await r.locator("[data-buscador-cobrar]").first().waitFor({ timeout: 30000 });
  await r.keyboard.press("Enter");
  const hoja = r.locator("[data-cobrar]");
  await hoja.locator("[data-cobrar-confirmar]").waitFor({ timeout: 30000 });
  await r.locator('[data-cobrar-medio="transferencia"]').click();
  await demorar(r, () => true, 6000);             // el cobro tarda 6 segundos en volver
  await r.locator("[data-cobrar-confirmar]").click();
  await r.getByText("Cobrando…").first().waitFor({ timeout: 10000 });
  await r.keyboard.press("Escape");
  await r.waitForTimeout(400);
  chequear(await hoja.count() === 1, "mientras “Cobrando…”, Esc no cierra la hoja", "Esc cerró la hoja a mitad del cobro");
  await r.locator("[data-cerrar-hoja]").click();
  await r.waitForTimeout(400);
  chequear(await hoja.count() === 1, "…la X tampoco", "la X cerró la hoja a mitad del cobro");
  await r.mouse.click(8, 8);
  await r.waitForTimeout(400);
  chequear(await hoja.count() === 1, "…ni tocar afuera", "tocar afuera cerró la hoja a mitad del cobro");
  await r.locator("[data-cobrar-hecho]").waitFor({ timeout: 40000 });
  ok("el cobro terminó y se ve “Cobrado” (no se perdió el resultado)");
  await r.unroute(/\/panel\//);
  await r.keyboard.press("Escape");
  await hoja.waitFor({ state: "detached", timeout: 10000 });
  ok("ya cobrado, Esc cierra la hoja");
  if (r.errores.length) falla(`Cobrar: ${r.errores.join(" | ")}`);
  await r.context().close();

  // ── 5, 6 y 7. Vender y la caja, con el navegador corriendo en Tokio (la hora del cierre sale en la zona del gimnasio) ──
  const k = await pagina(b, COMPU, { timezoneId: "Asia/Tokyo", locale: "es-AR" });
  await entrar(k, "recepcion@ejemplo.invalid");
  await cerrarTurno(k);                            // sin turno abierto de otra prueba

  await k.goto(`${G}/panel/vender`);
  const carrito = k.locator("[data-carrito]");
  const campo = k.locator('input[aria-label="Buscar socio"]');
  await campo.waitFor({ timeout: 60000 });

  // 1b. Vender: la búsqueda vieja no pisa a la nueva; un error de la búsqueda no se dice “No está”.
  await demorar(k, (c) => c.includes(telPack), 4000);
  await campo.fill(telPack);
  await k.waitForTimeout(700);
  await campo.fill(telCumple);
  await k.locator("button.fila", { hasText: "Cumpleañero" }).first().waitFor({ timeout: 30000 });
  await k.waitForTimeout(5000);
  filas = (await k.locator("button.fila").allInnerTexts()).join(" | ");
  chequear(/Cumpleañero/.test(filas) && !/Con Pack/.test(filas), "Vender: la respuesta vieja llegó tarde y no pisó la lista", `la lista quedó: ${filas.slice(0, 160)}`);
  await k.unroute(/\/panel\//);
  await cortar(k, () => true);
  await campo.fill(telPor);
  await k.locator('[role="alert"]:has-text("No se pudo buscar")').waitFor({ timeout: 30000 });
  chequear(await k.getByText("No está.").count() === 0, "Vender: si la búsqueda falla dice “No se pudo buscar…”, no “No está”", "dijo “No está” con la búsqueda caída");
  await k.unroute(/\/panel\//);
  await campo.fill("");
  await k.locator("button.fila").first().waitFor({ state: "detached", timeout: 10000 }).catch(() => {});

  // 5. Abrir mi turno en Vender, con el carrito armado.
  await k.locator("main button", { hasText: "Agua 500 ml" }).click();
  await k.locator('button[aria-pressed]:has-text("Efectivo")').click();
  const oferta = k.locator('[data-cobrar-sin-caja="abrir"]');
  await oferta.waitFor({ timeout: 30000 });
  chequear(/Agua 500 ml/.test(await carrito.innerText()), "sin turno, el carrito sigue con el Agua y ofrece “Abrir mi turno”", "el carrito perdió el Agua al elegir efectivo");
  await k.locator('input[aria-label="Fondo del turno"]').fill("1.000");
  await k.locator("[data-abrir-turno]").click();
  await oferta.waitFor({ state: "detached", timeout: 30000 });
  chequear(new URL(k.url()).pathname === "/panel/vender" && /Agua 500 ml/.test(await carrito.innerText()), "al abrir el turno seguís en Vender con el Agua en el carrito", `la pantalla quedó en ${k.url()} y el carrito: ${(await carrito.innerText()).slice(0, 80)}`);
  chequear(await k.locator("aside[data-carrito] > button.boton-principal, [data-carrito] button.boton-principal").last().isEnabled(), "…y Cobrar queda a mano", "Cobrar quedó apagado después de abrir el turno");

  // 6. La caja abierta: botones con ícono y sin emojis crudos.
  await k.goto(`${G}/panel/caja`);
  await k.locator('button:has-text("Entra plata")').waitFor({ timeout: 60000 });
  const botonesCaja = ["Entra plata", "Sale plata", "Cerrar caja"];
  for (const t of botonesCaja) chequear(await k.locator(`button:has-text("${t}") svg`).count() === 1, `la caja: “${t}” lleva ícono`, `“${t}” está sin ícono`);
  const textoCaja = await k.locator("main").innerText();
  chequear(!EMOJI.test(textoCaja), "la caja no muestra emojis crudos", `emoji en la caja: ${(textoCaja.match(EMOJI) ?? []).join(" ")}`);
  await k.locator('button:has-text("Entra plata")').click();
  await k.locator('input[placeholder="$"]').fill("500");
  await k.locator('input[placeholder^="Motivo"]').fill("Cambio (prueba)");
  await k.locator('button:has-text("Anotar")').click();
  await k.locator('button:has-text("Sale plata")').first().waitFor({ timeout: 30000 });
  await k.locator('button:has-text("Sale plata")').first().click();
  await k.locator('input[placeholder="$"]').fill("200");
  await k.locator('input[placeholder^="Motivo"]').fill("Limpieza (prueba)");
  await k.locator('button:has-text("Anotar")').click();
  await k.locator('button:has-text("Entra plata")').waitFor({ timeout: 30000 });
  const movs = await k.locator("main").innerText();
  chequear(!EMOJI.test(movs) && /\+\s?\$\s?500|Entró|Cambio \(prueba\)/.test(movs) && /Limpieza \(prueba\)/.test(movs), "las entradas y salidas de plata se anotan sin emojis crudos", `texto: ${movs.slice(0, 200)}`);

  // 7. Cerrar y mandar el cierre por WhatsApp: la hora sale en la zona del gimnasio, no en la del navegador (Tokio).
  await k.locator('button:has-text("Cerrar caja")').first().click();
  await k.locator('input[placeholder="$ contado"]').fill("0");
  await k.locator('button:has-text("Cerrar con este monto")').click();
  const link = k.locator("[data-compartir-cierre]");
  await link.waitFor({ timeout: 30000 });
  const texto = decodeURIComponent(((await link.getAttribute("href")) ?? "").replace(/^.*[?&]text=/, "")).replace(/\+/g, " ");
  const m = texto.match(/ de (\d\d):(\d\d) a (\d\d):(\d\d)/);
  const hm = (d, tz) => new Intl.DateTimeFormat("es-AR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  const ahora = new Date();
  const enGimnasio = hm(ahora, zona), enTokio = hm(ahora, "Asia/Tokyo");
  const min = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const cerca = (a, c) => Math.min(Math.abs(a - c), 1440 - Math.abs(a - c)) <= 3;
  chequear(!!m && cerca(min(`${m[3]}:${m[4]}`), min(enGimnasio)), `el cierre por WhatsApp dice que cerró a las ${m?.[3]}:${m?.[4]} (hora de ${zona}: ${enGimnasio})`, `el texto no trae la hora o es otra: “${texto.slice(0, 90)}” (gimnasio ${enGimnasio}, navegador ${enTokio})`);
  chequear(!!m && !cerca(min(`${m[3]}:${m[4]}`), min(enTokio)) || zona === "Asia/Tokyo", "…y no la del navegador (Tokio)", `la hora es la de la compu (${enTokio})`);
  chequear(!!m && cerca(min(`${m[1]}:${m[2]}`), min(enGimnasio)), "la hora de apertura del turno también sale en la zona del gimnasio", `apertura ${m?.[1]}:${m?.[2]} (gimnasio ${enGimnasio})`);
  await k.locator('button:has-text("Listo")').click();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.stack : e.message.split("\n")[0]}`);
}
await db.end();
await b.close();
resultado();
