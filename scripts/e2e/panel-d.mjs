#!/usr/bin/env node
// Carril D · Lo nuevo del panel, con la sesión real de la dueña demo, en compu y en celular (390):
//   FA-9 Socios: elegir varios (WhatsApp, etiqueta, exportar) y columnas · FA-10 tasa de cobro · FA-11 fotos en la lista de la clase
//   FA-21 diferencia de caja por cajero · FA-7 primeros días (avisar sin frenar) · FA-8 cartel de MercadoPago · FA-16 foto del socio
//   (interruptor y confirmar) · alta desde recepción con el link de contraseña · búsqueda tolerante · Datos personales (Ley 25.326).
//   node scripts/e2e/panel-d.mjs     (con scripts/local/levantar.sh corriendo)
// Lo que necesita en la base lo siembra por SQL con marcas únicas (los nombres llevan el sello de la corrida): no toca lo demás.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url });
await db.connect();
const q = async (sql, params) => (await db.query(sql, params)).rows;
const s = Date.now().toString().slice(-6);
const letras = (n) => [...String(n)].map((d) => "abcdefghij"[d]).join("");   // el nombre no lleva números
const SELLO = letras(s);

// ── Siembra ──
const [{ id: g }] = await q(`select id from public.gimnasios where slug = 'demo'`);
const [{ id: sede }] = await q(`select id from public.sedes where gimnasio_id = $1 order by creado_en limit 1`, [g]);
const [{ id: plan }] = await q(`select id from public.planes where gimnasio_id = $1 and tipo = 'membresia' and activo order by orden, creado_en limit 1`, [g]);
const [{ id: actividad }] = await q(`select id from public.actividades where gimnasio_id = $1 limit 1`, [g]);
const [recep] = await q(`select e.id from public.equipo e join auth.users u on u.id = e.usuario_id where e.gimnasio_id = $1 and lower(u.email) = 'recepcion@ejemplo.invalid'`, [g]);
const socio = async (nombre, apellido, extra = {}) => (await q(
  `insert into public.socios (gimnasio_id, nombre, apellido, telefono, foto_path, foto_sin_confirmar_desde, no_escribirle_en, no_escribirle_motivo)
   values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
  [g, nombre, apellido, extra.telefono ?? `+5490003${s}${Math.floor(Math.random() * 90 + 10)}`, extra.foto ?? null, extra.sinConfirmar ?? null, extra.noEscribir ? new Date() : null, extra.noEscribir ? "lo pidió (e2e)" : null]))[0].id;

// Tasa de cobro: uno vencido hace 3 horas que renovó y otro que no.
const renovo = await socio(`Renovo${SELLO}`, "Tasa"), noRenovo = await socio(`Pendiente${SELLO}`, "Tasa");
for (const [id, renueva] of [[renovo, true], [noRenovo, false]]) {
  const [{ id: sus }] = await q(`insert into public.suscripciones (gimnasio_id, socio_id, plan_id, inicio) values ($1,$2,$3, now() - interval '60 days') returning id`, [g, id, plan]);
  const cob = (desde, hasta) => q(`insert into public.coberturas (gimnasio_id, suscripcion_id, socio_id, desde, hasta, origen, motivo) values ($1,$2,$3, now() + $4::interval, now() + $5::interval, 'importacion', 'e2e')`, [g, sus, id, desde, hasta]);
  await cob("-30 days", "-3 hours");
  if (renueva) await cob("-3 hours", "30 days");
}
// Caja: tres cierres de la recepción, uno justo, uno que faltó y uno que sobró.
let [caja] = await q(`select id from public.cajas where gimnasio_id = $1 and sede_id = $2 limit 1`, [g, sede]);
if (!caja) caja = (await q(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Caja') returning id`, [g, sede]))[0];
for (const [esperado, contado] of [[1000, 1000], [2000, 1850], [500, 540]]) {
  await q(`insert into public.turnos_caja (gimnasio_id, caja_id, abierto_por, abierto_en, monto_inicial, cerrado_en, cerrado_por, monto_contado, monto_esperado)
           values ($1,$2,$3, now() - interval '6 hours', 0, now() - interval '2 hours', $3, $4, $5)`, [g, caja.id, recep.id, contado, esperado]);
}
// Clase con dos anotados: uno con foto y otro sin.
const [{ id: clase }] = await q(`insert into public.clases (gimnasio_id, sede_id, actividad_id, inicio, fin) values ($1,$2,$3, now() + interval '3 hours', now() + interval '4 hours') returning id`, [g, sede, actividad]);
const conFoto = await socio(`ConFoto${SELLO}`, "Clase", { foto: `${g}/socios/0123456789abcdef0123456789abcdef.jpg` }), sinFoto = await socio(`SinFoto${SELLO}`, "Clase");
for (const id of [conFoto, sinFoto]) await q(`insert into public.reservas (gimnasio_id, clase_id, socio_id, estado) values ($1,$2,$3,'confirmada')`, [g, clase, id]);
// Foto subida por el socio, sin confirmar.
const subida = await socio(`Subida${SELLO}`, "Foto", { foto: `${g}/socios/fedcba9876543210fedcba9876543210.jpg`, sinConfirmar: new Date() });
// Búsqueda tolerante y "no escribirle" para el WhatsApp en lote.
await socio("Josefina", "González");
const noEscribir = await socio(`NoEscribir${SELLO}`, "Lote", { noEscribir: true });
const escribirA = await socio(`Escribir${SELLO}`, "Lote");
// Pedido de datos de un socio.
await q(`insert into public.pedidos_datos (gimnasio_id, socio_id, tipo, detalle) values ($1,$2,'corregir','Mi teléfono cambió (e2e)')`, [g, escribirA]);

const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  p.setDefaultNavigationTimeout(120000);
  await entrar(p, "duena@ejemplo.invalid");

  // ── FA-9 · Socios: elegir varios ──
  await p.goto(`${G}/panel/socios?q=${encodeURIComponent(`Lote`)}`);
  await p.locator("[data-lista-socios]").waitFor({ timeout: 60000 });
  chequear(await p.locator("[data-elegir]").count() === 0, "Socios: sin “Elegir varios” no hay casillas", "hay casillas sin haber pedido elegir");
  await p.locator("[data-elegir-varios]").click();
  await p.locator(`[data-elegir="${noEscribir}"]`).check();
  await p.locator(`[data-elegir="${escribirA}"]`).check();
  const barra = p.locator("[data-barra-seleccion]");
  chequear(await aparece(barra) && await barra.getAttribute("data-barra-seleccion") === "2", "elegir dos socios muestra la barra con “2 elegidos”", "la barra no muestra 2 elegidos");
  await p.locator('[data-accion="whatsapp"]').click();
  const wa = p.locator("[data-panel-whatsapp]");
  await wa.waitFor({ timeout: 15000 });
  await wa.locator("textarea").fill("Hola {nombre}, te escribimos del gimnasio.");
  await p.waitForFunction(() => document.querySelectorAll("[data-wa-socio]").length === 1, null, { timeout: 15000 }).catch(() => {});
  const links = await p.locator("[data-wa-socio]").evaluateAll((as) => as.map((a) => ({ href: a.getAttribute("href"), texto: a.textContent })));
  chequear(links.length === 1 && /Escribir/.test(links[0].texto) && /^https:\/\/wa\.me\/\d+\?text=/.test(links[0].href) && decodeURIComponent(links[0].href).includes(`Hola Escribir${SELLO}`),
    "WhatsApp en lote: un chat con el mensaje armado con el nombre, y sin el marcado “no escribirle”", `WhatsApp en lote: ${JSON.stringify(links)}`);
  chequear(/no escribirle/.test(await wa.innerText()), "avisa cuántos quedaron afuera por la marca “no escribirle”", "no avisa de los que tienen la marca");
  await capturar(p, "paneld-compu-socios-lote");
  await p.locator('[data-accion="etiqueta"]').click();
  const form = p.locator("[data-panel-etiqueta]");
  await form.locator("input").fill(`Lote${SELLO}`);
  await form.locator('button[type="submit"]').click();
  await p.locator("[data-barra-seleccion] .mensaje", { hasText: /Listo/ }).waitFor({ timeout: 30000 });
  ok("etiqueta en lote: “Listo: … puesta a 2 socios”");
  await p.goto(`${G}/panel/socios?q=${encodeURIComponent("Lote")}`);
  const etiquetaPuesta = await q(`select count(*)::int n from public.socio_etiquetas se join public.etiquetas e on e.id = se.etiqueta_id where e.gimnasio_id = $1 and e.nombre = $2`, [g, `Lote${SELLO}`]);
  chequear(etiquetaPuesta[0].n === 2, "la etiqueta quedó en los dos socios (verificado en la base)", `la etiqueta quedó en ${etiquetaPuesta[0].n}`);
  await p.locator("[data-elegir-varios]").click();
  await p.locator("[data-elegir-todos]").check();
  const [descarga] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), p.locator('[data-accion="exportar"]').click()]);
  const csv = readFileSync(await descarga.path(), "utf8");
  chequear(/^﻿Nombre;/.test(csv) && csv.includes(`Escribir${SELLO}`) && csv.trim().split(/\r?\n/).length >= 3, "exportar: baja un Excel con los elegidos", `exportar: ${csv.slice(0, 120)}`);
  // Columnas a elección: prender DNI y Teléfono y recordarlas.
  await p.locator("[data-columnas-menu]").click();
  await p.locator("label", { hasText: "Teléfono" }).locator("input").check();
  chequear(await aparece(p.locator("[data-lista-socios]").getByText("+54900", { exact: false })), "columnas: al prender Teléfono se ve en cada fila", "no se ve el teléfono al prender la columna");
  await p.reload();
  await p.locator("[data-lista-socios]").waitFor({ timeout: 60000 });
  chequear(await aparece(p.locator("[data-lista-socios]").getByText("+54900", { exact: false })), "las columnas elegidas se recuerdan al volver", "las columnas no se recordaron");
  await p.evaluate(() => localStorage.removeItem("base.socios.columnas"));

  // ── Búsqueda tolerante ──
  await p.goto(`${G}/panel/socios?q=gonzales`);
  await p.locator("[data-lista-socios]").waitFor({ timeout: 60000 });
  chequear((await p.locator("[data-lista-socios] ul").innerText()).includes("González"), "buscar “gonzales” (con error) encuentra a González", "“gonzales” no encontró a González");

  // ── FA-10 · Tasa de cobro ──
  await p.goto(`${G}/panel/resultado`);
  const tasa = p.locator("[data-tasa-cobro]");
  await tasa.waitFor({ timeout: 60000 });
  chequear(/\d+(,\d)?%/.test(await tasa.innerText()), "Resultado: muestra la tasa de cobro del mes", "Resultado no muestra la tasa de cobro");
  await tasa.locator("[data-tasa-pendientes] summary").click();
  chequear((await tasa.locator("[data-tasa-pendientes]").innerText()).includes(`Pendiente${SELLO}`) && !(await tasa.locator("[data-tasa-pendientes]").innerText()).includes(`Renovo${SELLO}`),
    "la lista de “faltan renovar” trae al que no renovó y no al que sí", "la lista de pendientes de la tasa de cobro no es la esperada");
  await capturar(p, "paneld-compu-tasa-cobro");

  // ── FA-11 · Fotos en la lista de la clase ──
  await p.goto(`${G}/panel/clases/${clase}`);
  await p.locator("h1").waitFor({ timeout: 60000 });
  const fotos = await p.locator("[data-foto-anotado]").evaluateAll((els) => els.map((e) => e.getAttribute("data-foto-anotado")));
  chequear(fotos.length >= 2 && fotos.includes("si") && fotos.includes("no"), "clase: cada anotado tiene su foto (o sus iniciales si no la tiene)", `fotos de la clase: ${fotos.join(",")}`);
  await capturar(p, "paneld-compu-clase-fotos");

  // ── FA-21 · Diferencia de caja por cajero ──
  await p.goto(`${G}/panel/caja/historial`);
  const cajeros = p.locator("[data-diferencia-cajeros]");
  await cajeros.waitFor({ timeout: 60000 });
  const ana = (await cajeros.locator("[data-cajero]").first().innerText()).replace(/\s+/g, " ");
  chequear(/turnos/.test(ana) && /(Faltaron|Sobraron|Justo)/.test(ana), `historial de caja: diferencia acumulada por cajero (“${ana.slice(0, 80)}”)`, `diferencia por cajero: ${ana}`);
  await capturar(p, "paneld-compu-caja-cajeros");

  // ── FA-7 y FA-8 y FA-16 · Configuración ──
  await p.goto(`${G}/panel/configuracion?pestana=reglas`);
  const sinBloquear = p.locator("[data-avisar-sin-bloquear]");
  await sinBloquear.waitFor({ timeout: 60000 });
  await p.waitForFunction(() => document.querySelector("[data-avisar-sin-bloquear]")?.getAttribute("data-avisar-sin-bloquear") !== "cargando", null, { timeout: 30000 });
  await sinBloquear.locator('[data-sin-bloquear-dias="14"]').click();
  await p.waitForFunction(() => document.querySelector("[data-avisar-sin-bloquear]")?.getAttribute("data-avisar-sin-bloquear") === "si", null, { timeout: 30000 });
  chequear(/Prendido hasta el/.test(await sinBloquear.innerText()), "primeros días: 14 días prende “avisar sin frenar” con su fecha", "primeros días no mostró la fecha");
  await capturar(p, "paneld-compu-primeros-dias");
  await sinBloquear.locator('[data-sin-bloquear-dias="0"]').click();
  await p.waitForFunction(() => document.querySelector("[data-avisar-sin-bloquear]")?.getAttribute("data-avisar-sin-bloquear") === "no", null, { timeout: 30000 });
  ok("primeros días: 0 lo apaga y la entrada vuelve a frenar");

  const foto = p.locator("[data-foto-socio]");
  await p.waitForFunction(() => document.querySelector("[data-foto-socio]")?.getAttribute("data-foto-socio") !== "cargando", null, { timeout: 30000 });
  const antes = await foto.getAttribute("data-foto-socio");
  await foto.locator('input[type="checkbox"]').click();
  await p.waitForFunction((a) => document.querySelector("[data-foto-socio]")?.getAttribute("data-foto-socio") !== a, antes, { timeout: 30000 });
  const despues = await foto.getAttribute("data-foto-socio");
  chequear(despues !== antes, `foto del socio: el interruptor pasa de “${antes}” a “${despues}”`, "el interruptor de la foto no cambió");
  const enBase = (await q(`select foto_socio_permitida f from public.configuracion_gimnasio where gimnasio_id = $1`, [g]))[0].f;
  chequear(enBase === (despues === "si"), "y quedó guardado en la base", "el interruptor de la foto no quedó en la base");
  if (despues === "si") { await foto.locator('input[type="checkbox"]').click(); await p.waitForFunction(() => document.querySelector("[data-foto-socio]")?.getAttribute("data-foto-socio") === "no", null, { timeout: 30000 }); }

  await p.goto(`${G}/panel/configuracion?pestana=cobros`);
  const mp = p.locator("[data-mercadopago]");
  await mp.waitFor({ timeout: 60000 });
  chequear(/Nunca pasa por Base ni por BRIK/.test(await mp.locator("[data-mp-plata-directa]").innerText()), "MercadoPago: dice que la plata va directo a la cuenta del gimnasio", "falta el cartel de la plata directa en MercadoPago");
  await capturar(p, "paneld-compu-mercadopago");

  // ── FA-16 · Ficha con foto nueva subida por el socio ──
  await p.goto(`${G}/panel/socios/${subida}`);
  const marca = p.locator("[data-foto-sin-confirmar]");
  await marca.waitFor({ timeout: 60000 });
  chequear(/subida por el socio/i.test(await marca.innerText()), "ficha: “Foto nueva, subida por el socio”", "la ficha no marca la foto nueva");
  await capturar(p, "paneld-compu-ficha-foto-nueva");
  await marca.locator("button", { hasText: "Confirmar la foto" }).click();
  await marca.waitFor({ state: "detached", timeout: 30000 });
  const pendiente = (await q(`select foto_sin_confirmar_desde d from public.socios where id = $1`, [subida]))[0].d;
  chequear(pendiente === null, "confirmar la foto saca la marca (y queda en la base)", "la foto sigue sin confirmar en la base");

  // ── Alta desde recepción con el link de contraseña ──
  const mail = `alta${s}@ejemplo.invalid`;
  await p.goto(`${G}/panel/socios/nuevo`);
  await p.locator('input[name="nombre"]').waitFor({ timeout: 60000 });
  await p.locator('input[name="nombre"]').fill(`Enlace${SELLO}`);
  await p.locator('input[name="apellido"]').fill("Contraseña");
  await p.locator('input[name="dni"]').fill(`46${s}1`);
  await p.locator('input[name="telefono"]').fill(`000 15 ${s.slice(0, 2)}-${s.slice(2)}6`);
  await p.locator('input[name="email"]').fill(mail);
  await p.locator('button:has-text("Dar de alta")').click();
  const link = p.locator("[data-link-contrasena]");
  await link.waitFor({ timeout: 60000 });
  const valor = await link.locator("input").inputValue();
  chequear(/\/ingresar\/recuperar\?nueva=1/.test(valor) && valor.includes(encodeURIComponent(mail)), "alta con mail: muestra el link para que el socio cree su contraseña", `link de contraseña: ${valor}`);
  chequear((await link.locator("[data-wa-link]").getAttribute("href"))?.startsWith("https://wa.me/") === true, "y el botón de WhatsApp (wa.me)", "falta el link de WhatsApp");
  chequear(await link.locator("[data-copiar-link]").count() === 1, "y copiar el mensaje", "falta copiar el mensaje");
  await capturar(p, "paneld-compu-alta-link");

  // ── Datos personales (Ley 25.326) ──
  await p.goto(`${G}/panel/datos-personales`);
  await p.locator("[data-politica]").waitFor({ timeout: 60000 });
  await p.locator("button", { hasText: "Usar el texto modelo" }).click();
  await p.locator("button", { hasText: "Guardar y publicar" }).click();
  await p.locator("[data-politica] .mensaje", { hasText: /Política publicada/ }).waitFor({ timeout: 30000 });
  const guardada = (await q(`select politica_privacidad p from public.configuracion_gimnasio where gimnasio_id = $1`, [g]))[0].p;
  chequear(/Ley 25.326/.test(guardada ?? ""), "Datos personales: la política de privacidad se publica (verificado en la base)", "la política no quedó guardada");
  const pedido = p.locator('[data-pedido="corregir"]', { hasText: `Escribir${SELLO}` });
  await pedido.waitFor({ timeout: 30000 });
  chequear((await pedido.innerText()).includes(`Escribir${SELLO}`), "y muestra el pedido del socio de corregir su dato", "no muestra el pedido del socio");
  await capturar(p, "paneld-compu-datos-personales");
  await pedido.locator('input[aria-label="Qué se hizo"]').fill("Se corrigió el teléfono (e2e)");
  await pedido.locator("button", { hasText: "Marcar resuelto" }).click();
  await pedido.waitFor({ state: "detached", timeout: 30000 });
  chequear((await q(`select resuelto_en from public.pedidos_datos where socio_id = $1`, [escribirA]))[0].resuelto_en !== null, "marcar resuelto lo cierra (y queda en la base)", "el pedido no quedó resuelto");
  const reales = (l) => l.filter((e) => !/\/foto\?v=/.test(e));   // las fotos sembradas no están en el almacenamiento: su ruta responde 502
  if (reales(p.errores).length) falla(`errores de página (compu): ${reales(p.errores).join(" | ")}`);

  // ── Celular (390) ──
  const c = await pagina(b, CELU);
  c.setDefaultNavigationTimeout(120000);
  await entrar(c, "duena@ejemplo.invalid");
  for (const [ruta, espera, nombre] of [
    ["/panel/socios?q=Lote", "[data-lista-socios]", "socios-lote"],
    ["/panel/resultado", "[data-tasa-cobro]", "tasa-cobro"],
    [`/panel/clases/${clase}`, "[data-foto-anotado]", "clase-fotos"],
    ["/panel/caja/historial", "[data-diferencia-cajeros]", "caja-cajeros"],
    ["/panel/configuracion?pestana=reglas", "[data-avisar-sin-bloquear]", "primeros-dias"],
    ["/panel/configuracion?pestana=cobros", "[data-mercadopago]", "mercadopago"],
    [`/panel/socios/${subida}`, "h1", "ficha"],
    ["/panel/datos-personales", "[data-politica]", "datos-personales"],
  ]) {
    await c.goto(`${G}${ruta}`);
    await c.locator(espera).first().waitFor({ timeout: 60000 });
    if (ruta.startsWith("/panel/socios?q=Lote")) { await c.locator("[data-elegir-varios]").click(); await c.locator("[data-elegir-todos]").check(); await c.locator('[data-accion="whatsapp"]').click(); await c.locator("[data-panel-whatsapp]").waitFor({ timeout: 15000 }); }
    chequear(await c.evaluate(() => document.documentElement.scrollWidth) <= 391, `celular: ${nombre} sin desborde`, `celular: ${nombre} se desborda (${await c.evaluate(() => document.documentElement.scrollWidth)} px)`);
    await capturar(c, `paneld-celu-${nombre}`);
  }
  if (reales(c.errores).length) falla(`errores de página (celular): ${reales(c.errores).join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.stack : e.message.split("\n")[0]}`);
}
await b.close();
await db.end();
resultado();
