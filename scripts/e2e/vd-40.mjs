#!/usr/bin/env node
// VD-40 · Super admin v2: el alta de un gimnasio en 3 pasos con vista previa; la salud de cada
// gimnasio con colores y el orden "los que necesitan atención"; entrar como soporte pide el MOTIVO,
// se ve el marco y el cartel, y el dueño lo ve en su Control; el mensaje de ayuda del dueño llega a
// BRIK con contexto (pantalla y último error); la entrada de soporte vence a los 60 minutos.
//   node scripts/e2e/vd-40.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, PLATAFORMA as B, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const s = Date.now().toString().slice(-5);
const NOMBRE = `Vd40 ${s}`;
const MAIL = `vd40${s}@ejemplo.invalid`;
const MOTIVO = `Me pidió ayuda con los planes ${s}`;
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  p.setDefaultNavigationTimeout(120000);
  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  await p.locator("[data-metricas]").waitFor({ timeout: 60000 });
  ok("el super admin abre su tablero con los números de la plataforma");
  chequear(await p.locator("[data-metrica]").count() >= 5, "métricas: gimnasios, activos, cobrado a BRIK, abonos y nuevos", "faltan métricas");

  // ── 1. Alta en 3 pasos, con vista previa ──
  const alta = p.locator("[data-alta-gimnasio]");
  chequear(await alta.locator('[data-alta-paso="1"]').isVisible() && !(await alta.locator('[data-alta-paso="2"]').isVisible()), "alta: arranca en el paso 1 (tipo)", "no arranca en el paso 1");
  await alta.locator("select[name=tipo]").selectOption("box");
  await alta.getByRole("button", { name: /Siguiente/ }).click();
  await alta.locator('[data-alta-paso="2"]').waitFor({ state: "visible" });
  await p.fill("input[name=nombre]", NOMBRE);
  await p.locator("input[name=color_acento]").fill("#ff0000");
  await p.locator("input[name=color_fondo]").fill("#fff7e6");
  const previa = alta.locator("[data-vista-previa]");
  const estilos = await previa.evaluate((e) => ({ fondo: getComputedStyle(e).backgroundColor, texto: e.innerText }));
  chequear(estilos.fondo === "rgb(255, 247, 230)" && estilos.texto.includes(NOMBRE), `paso 2: la vista previa muestra el nombre y el fondo elegido`, `vista previa rota: ${JSON.stringify(estilos)}`);
  chequear((await previa.locator("span").first().evaluate((e) => getComputedStyle(e).backgroundColor)) === "rgb(255, 0, 0)", "la vista previa usa el color principal", "no cambió el color de la vista previa");
  await capturar(p, "vd40-compu-alta-paso2");
  await alta.getByRole("button", { name: /Siguiente/ }).click();
  await alta.locator('[data-alta-paso="3"]').waitFor({ state: "visible" });
  await alta.getByRole("button", { name: /Atrás/ }).click();
  chequear((await p.inputValue("input[name=nombre]")) === NOMBRE, "volver atrás no pierde lo escrito", "se perdió el nombre al volver");
  await alta.getByRole("button", { name: /Siguiente/ }).click();
  await p.fill("input[name=dueno]", "Dueña Vd40");
  await p.fill("input[name=email]", MAIL);
  await p.fill("input[name=celular]", "+54 9 000 123 4567");
  await p.click('button:has-text("Crear gimnasio")');
  await alta.locator("strong.numero").first().waitFor({ timeout: 60000 });
  const clave = (await alta.locator("strong.numero").first().innerText()).trim();
  const bienvenida = await alta.locator("[data-bienvenida] textarea").inputValue();
  chequear(bienvenida.includes(clave) && bienvenida.includes(MAIL), "paso 3: sale el mensaje de bienvenida con el mail y la contraseña", `mensaje sin datos: ${bienvenida.slice(0, 80)}`);
  chequear((await alta.locator("[data-whatsapp]").getAttribute("href"))?.startsWith("https://wa.me/549000") ?? false, "con el celular, queda el link de WhatsApp listo", "sin link de WhatsApp");
  const [{ id: gid, slug, color_acento }] = (await db.query(
    `select g.id, g.slug, c.color_acento from public.gimnasios g join public.configuracion_gimnasio c on c.gimnasio_id = g.id where g.nombre = $1`, [NOMBRE])).rows;
  chequear(color_acento === "#ff0000", "el color elegido quedó guardado en la marca del gimnasio", `color guardado: ${color_acento}`);

  // ── 2. Entrar como soporte: el motivo es obligatorio ──
  // La lista de gimnasios vive en /admin/gimnasios (con buscador): se busca el nuevo por su nombre.
  await p.goto(`${B}/admin/gimnasios?q=${encodeURIComponent(NOMBRE)}`);
  const miFila = p.locator("[data-gimnasio-fila]", { hasText: NOMBRE }).first();
  await miFila.waitFor({ timeout: 60000 });
  await miFila.locator("[data-entrar-soporte]").click();
  await miFila.locator("input[name=motivo]").fill("ab");
  await miFila.locator('button:has-text("Entrar como soporte")').click();
  await p.waitForTimeout(1500);
  chequear(!/\/panel/.test(p.url()), "motivo muy corto: no deja entrar", "entró sin un motivo válido");
  if (!(await miFila.locator("input[name=motivo]").count())) await miFila.locator("[data-entrar-soporte]").click();
  await miFila.locator("input[name=motivo]").fill(MOTIVO);
  await miFila.locator('button:has-text("Entrar como soporte")').click();
  await p.waitForURL(/\/panel/, { timeout: 60000 });
  await p.locator("[data-soporte-banner]").waitFor({ timeout: 60000 });
  const cartel = await p.locator("[data-soporte-banner]").innerText();
  chequear(cartel.includes(MOTIVO) && cartel.includes(NOMBRE) && (await p.locator("[data-soporte-marco]").count()) === 1, "adentro: marco de color y cartel con el gimnasio, el motivo y la salida", `cartel: ${cartel.slice(0, 100)}`);
  chequear(!(await p.locator("[data-ayuda-brik]").count()), "el soporte no ve “¿Necesitás ayuda?”", "Soporte BRIK ve el botón de ayuda");
  await capturar(p, "vd40-compu-soporte");
  const [fila] = (await db.query(`select motivo, vence_en - entro_en as dura from public.soportes_gimnasio where gimnasio_id = $1`, [gid])).rows;
  chequear(fila?.motivo === MOTIVO && fila.dura.hours === 1, "quedó escrito: quién, motivo, cuándo, vence a la hora", `registro: ${JSON.stringify(fila)}`);

  // ── 3. El dueño lo ve en su Control y le escribe a BRIK ──
  const G = GIMNASIO(slug);
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, MAIL, clave, G);
  await d.goto(`${G}/panel/control`);
  const seccion = d.locator("[data-soporte-brik]");
  await seccion.waitFor({ timeout: 60000 });
  chequear((await seccion.innerText()).includes(MOTIVO), "el dueño ve en su Control “BRIK entró a ayudarte” con el motivo", `Control sin el motivo: ${(await seccion.innerText()).slice(0, 100)}`);
  await capturar(d, "vd40-compu-dueno-control");

  await d.locator("[data-ayuda-brik] button:has-text('Necesitás ayuda')").click();
  await d.evaluate(() => { setTimeout(() => { throw new Error("e2e: no se pudo guardar el plan"); }, 0); });
  await d.waitForTimeout(500);
  await d.locator("[data-ayuda-brik] textarea").fill(`No me deja cargar el plan nuevo ${s}`);
  await d.locator("[data-ayuda-brik] button:has-text('Enviar a BRIK')").click();
  await d.locator("[data-ayuda-enviada]").waitFor({ timeout: 30000 });
  ok("el dueño le manda un mensaje a BRIK desde “¿Necesitás ayuda?”");
  d.errores.length = 0; // el error de arriba lo provocó la prueba

  // ── 4. Llega a BRIK con contexto ──
  await p.goto(`${B}/admin`);
  const ayuda = p.locator("[data-ayuda]", { hasText: `No me deja cargar el plan nuevo ${s}` });
  await ayuda.waitFor({ timeout: 60000 });
  const ctx = await ayuda.locator("[data-ayuda-contexto]").innerText();
  chequear(ctx.includes("/panel/control") && ctx.includes("no se pudo guardar el plan") && ctx.includes(MAIL) && (await ayuda.innerText()).includes(NOMBRE),
    "la ayuda llega con gimnasio, quién, pantalla y último error", `sin contexto: ${ctx}`);
  chequear(Number(await p.locator("[data-ayudas-cantidad]").innerText()) >= 1, "el tablero muestra la cantidad de pedidos sin responder", "sin cantidad de pedidos");

  // ── 5. Salud con colores y orden ──
  await db.query(`insert into public.plataforma_planes (nombre, precio_mensual) values ($1, 1000)`, [`Plan vd40 ${s}`]);
  await db.query(`update public.gimnasios set plataforma_plan_id = (select id from public.plataforma_planes where nombre = $1), plataforma_desde = current_date - 40 where id = $2`, [`Plan vd40 ${s}`, gid]);
  await p.goto(`${B}/admin`);
  const colores = await p.locator("li[data-gimnasio-color]").evaluateAll((l) => l.map((e) => e.getAttribute("data-gimnasio-color")));
  const rango = { rojo: 0, amarillo: 1, verde: 2, demo: 3 };
  chequear(colores.length >= 2 && colores.every((c, i) => i === 0 || rango[colores[i - 1]] <= rango[c]), `la lista va de los que necesitan atención a los que no (${colores.join(" > ")})`, `orden roto: ${colores.join(",")}`);
  const mia = p.locator("li", { hasText: NOMBRE }).first();
  chequear((await mia.getAttribute("data-gimnasio-color")) === "rojo" && (await mia.locator("[data-motivos]").innerText()).includes("Abono a BRIK vencido"), "abono vencido: el gimnasio está en rojo y dice por qué", "no quedó en rojo con el motivo");
  chequear(colores[0] === "rojo", "el rojo va primero", `primero va ${colores[0]}`);
  await capturar(p, "vd40-compu-salud", true);
  await p.locator('[data-filtro="atencion"]').click();
  await p.waitForURL(/filtro=atencion/);
  const filtrados = await p.locator("li[data-gimnasio-color]").evaluateAll((l) => l.map((e) => e.getAttribute("data-gimnasio-color")));
  chequear(filtrados.length > 0 && filtrados.every((c) => c === "rojo" || c === "amarillo"), "filtro “Necesitan atención”: solo rojos y amarillos", `el filtro dejó pasar: ${filtrados.join(",")}`);

  // ── 6. La entrada de soporte vence a los 60 minutos ──
  await db.query(`alter table public.soportes_gimnasio disable trigger soportes_gimnasio_inmutable`);
  await db.query(`update public.soportes_gimnasio set vence_en = now() - interval '1 minute' where gimnasio_id = $1 and salio_en is null`, [gid]);
  await db.query(`alter table public.soportes_gimnasio enable trigger soportes_gimnasio_inmutable`);
  await p.goto(`${B}/panel`);
  await p.waitForURL(/\/admin/, { timeout: 60000 });
  chequear(/Terminó tu entrada/.test(await p.locator("main").innerText()), "pasados los 60 minutos, el soporte vuelve al super admin con un aviso", "no venció la entrada de soporte");

  // ── 7. La ficha: registro de soporte y notas ──
  await p.goto(`${B}/admin/${gid}`);
  const reg = p.locator("[data-admin-soportes]");
  await reg.waitFor({ timeout: 60000 });
  chequear((await reg.innerText()).includes(MOTIVO) && (await reg.innerText()).includes("admin@ejemplo.invalid"), "ficha: quién entró, por qué y cuándo", "la ficha no muestra la entrada de soporte");
  chequear(await p.locator("[data-ficha-salud] [data-color]").first().isVisible() && (await p.locator("[data-uso-semanal] > div").count()) === 4, "ficha: cómo viene y el uso de las últimas 4 semanas", "falta salud o uso semanal");
  await p.locator("[data-notas-brik] input").fill(`Llamar el lunes por el abono ${s}`);
  await p.locator("[data-notas-brik] button:has-text('Agregar nota')").click();
  await p.getByText(`Llamar el lunes por el abono ${s}`).first().waitFor({ timeout: 30000 });
  ok("notas internas de BRIK");

  // Pedido resuelto: sale de pendientes.
  await p.goto(`${B}/admin`);
  await p.locator("[data-ayuda]", { hasText: `No me deja cargar el plan nuevo ${s}` }).locator('button:has-text("Ya lo resolví")').click();
  await p.locator("[data-ayuda]", { hasText: `No me deja cargar el plan nuevo ${s}` }).waitFor({ state: "detached", timeout: 30000 });
  ok("“Ya lo resolví” saca el pedido de pendientes");

  // ── 8. Celular ──
  const c = await pagina(b, CELU);
  c.setDefaultNavigationTimeout(120000);
  await entrar(c, "admin@ejemplo.invalid", undefined, B);
  for (const ruta of ["/admin", `/admin/${gid}`]) {
    await c.goto(`${B}${ruta}`);
    await c.locator("main h1").first().waitFor({ timeout: 60000 });
    const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
    chequear(ancho <= CELU.width, `celular ${ruta.replace(gid, "<id>")}: sin desborde`, `celular ${ruta}: ancho ${ancho}`);
  }
  await capturar(c, "vd40-celu-admin", true);
  if (p.errores.length) falla(p.errores.join(" | "));
  if (d.errores.length) falla(d.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
await db.end();
resultado();
