#!/usr/bin/env node
// VD-38 · Mensajes de los socios al gimnasio (D27): el socio escribe con foto desde Yo → Más →
// "Escribile al gimnasio"; la recepción NO los ve hasta que el dueño lo prende; después ve la bandeja,
// contesta (con una respuesta rápida) y el socio ve la respuesta con su aviso. Celular 390 px sin desbordes.
//   node scripts/e2e/vd-38.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";
// F1.9: un error que nadie atrapó deja de colgar el recorrido sin ✗: se escribe qué esperaba y cuándo, y se corta con código 1.
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
// Punto de partida: la recepción no los ve (el valor por defecto).
await db.query(`delete from public.config_mensajes where gimnasio_id = $1`, [gim]);
const s5 = Date.now().toString().slice(-6);
let rapidaCreada = false;
const TEXTO = `Perdí una botella azul ${s5}`;
// Un PNG de 1x1 (la foto de mentira).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const b = await navegador();
try {
  // 1) El socio escribe, con foto.
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app/yo`);
  const bien = s.locator("[data-bienvenida]");
  if (await bien.count()) { await bien.locator("[data-bienvenida-saltear], [data-bienvenida-listo]").first().click().catch(() => {}); }
  const fila = s.locator('[data-yo-fila="mensajes"]');
  await fila.waitFor({ timeout: 30000 });
  chequear(await fila.innerText().then((t) => /Escribile al gimnasio/.test(t)), "Yo → Más tiene la fila “Escribile al gimnasio”", "falta la fila en Yo");
  await fila.click();
  await s.waitForURL(/\/app\/mensajes/, { timeout: 30000 });
  await s.locator("[data-nuevo-mensaje]").click();
  await s.waitForURL(/\/app\/mensajes\/nuevo/, { timeout: 30000 });
  chequear(await s.locator("[data-aviso-salud]").waitFor({ timeout: 20000 }).then(() => true, () => false), "el formulario avisa que no se cuenten diagnósticos", "falta el aviso de datos de salud");
  await s.locator('[data-motivo="objeto_perdido"]').check({ force: true });
  await s.locator('textarea[name="texto"]').fill(TEXTO);
  await s.locator("[data-foto-mensaje]").setInputFiles({ name: "botella.png", mimeType: "image/png", buffer: PNG });
  chequear((await s.evaluate(() => document.documentElement.scrollWidth)) <= CELU.width, "formulario en celular 390 px: sin desborde", "el formulario desborda en el celular");
  await capturar(s, "vd38-celu-nuevo");
  await s.locator("[data-enviar-mensaje]").click();
  await s.waitForURL(/\/app\/mensajes\/[0-9a-f-]{36}/, { timeout: 60000 });
  await s.getByText(TEXTO).first().waitFor({ timeout: 30000 });
  ok("el socio envía y ve su mensaje en la conversación");
  const foto = s.locator("[data-foto-hilo]");
  await foto.waitFor({ timeout: 30000 });
  chequear(await foto.evaluate((i) => i.complete && i.naturalWidth > 0), "la foto subió y se ve en la conversación", "la foto no se ve");
  chequear((await s.evaluate(() => document.documentElement.scrollWidth)) <= CELU.width, "conversación en celular: sin desborde", "la conversación desborda");
  await capturar(s, "vd38-celu-hilo");
  const hiloId = new URL(s.url()).pathname.split("/").pop();

  // 2) La recepción no los ve mientras el dueño no lo prenda.
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel`);
  chequear((await r.locator('a[href="/panel/mensajes"]').count()) === 0, "sin permiso: “Mensajes” no está en el menú de la recepción", "la recepción ve Mensajes sin permiso");
  await r.goto(`${G}/panel/mensajes`);
  await r.getByText("No tenés acceso a esta pantalla").first().waitFor({ timeout: 30000 });
  ok("sin permiso: entrar por la dirección da error claro (no una bandeja vacía)");

  // 3) El dueño los ve y prende el interruptor para la recepción.
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/mensajes`);
  const item = d.locator("[data-hilo]", { hasText: "Perdí una botella azul" }).first();
  await item.waitFor({ timeout: 30000 });
  chequear((await item.getAttribute("data-sin-responder")) === "1", "la dueña ve el mensaje en la bandeja, sin responder", "no aparece sin responder");
  await d.getByText("La recepción también ve los mensajes").click();
  for (let i = 0; i < 30; i++) {
    const [x] = (await db.query(`select recepcion_ve from public.config_mensajes where gimnasio_id = $1`, [gim])).rows;
    if (x?.recepcion_ve) break;
    await d.waitForTimeout(500);
  }
  const [{ recepcion_ve }] = (await db.query(`select coalesce((select recepcion_ve from public.config_mensajes where gimnasio_id = $1), false) as recepcion_ve`, [gim])).rows;
  chequear(recepcion_ve === true, "la dueña prende que la recepción los vea", "no se guardó el permiso");

  // 4) La recepción ve la bandeja y contesta.
  await r.goto(`${G}/panel`);
  await r.locator('a[href="/panel/mensajes"]').first().waitFor({ timeout: 30000 });
  ok("con permiso: “Mensajes” aparece en el menú de la recepción");
  await r.goto(`${G}/panel/mensajes`);
  const itemR = r.locator("[data-hilo]", { hasText: "Perdí una botella azul" }).first();
  await itemR.waitFor({ timeout: 30000 });
  await capturar(r, "vd38-compu-bandeja");
  await itemR.click();
  await r.locator("[data-hilo-abierto]").waitFor({ timeout: 30000 });
  const fotoR = r.locator("[data-hilo-abierto] [data-foto-hilo]");
  await fotoR.waitFor({ timeout: 30000 });
  chequear(await fotoR.evaluate((i) => i.complete && i.naturalWidth > 0), "la recepción ve la foto del socio", "la recepción no ve la foto");
  // Una respuesta rápida + un toque propio.
  // Las tres de ejemplo solo las siembra la migración en los gimnasios que ya existían: en una base nueva el demo no las tiene.
  const [{ n: hayRapida }] = (await db.query(`select count(*)::int n from public.respuestas_rapidas_mensajes where gimnasio_id = $1 and titulo = 'Objeto encontrado'`, [gim])).rows;
  if (!hayRapida) {
    await db.query(`insert into public.respuestas_rapidas_mensajes (gimnasio_id, titulo, texto, orden) values ($1, 'Objeto encontrado', 'Encontramos lo que perdiste. Pasá por la recepción y te lo damos.', 2)`, [gim]);
    rapidaCreada = true;
    await r.reload();
    await r.locator("[data-responder]").waitFor({ timeout: 30000 });
  }
  const rapida = r.locator("[data-rapidas] button", { hasText: "Objeto encontrado" });
  await rapida.waitFor({ timeout: 15000 });
  await rapida.click();
  chequear((await r.locator("[data-texto-respuesta]").inputValue()).includes("Encontramos lo que perdiste"), "la respuesta rápida se inserta en el texto", "no se insertó la respuesta rápida");
  await r.locator("[data-texto-respuesta]").fill(`${await r.locator("[data-texto-respuesta]").inputValue()} (${s5})`);
  await capturar(r, "vd38-compu-hilo");
  await r.locator("[data-enviar-respuesta]").click();
  await r.locator(`[data-hilo-abierto] [data-autor="equipo"]`, { hasText: s5 }).waitFor({ timeout: 30000 });
  ok("la recepción contesta y la respuesta queda en la conversación");
  const [h] = (await db.query(`select estado, ultimo_autor from public.hilos_socio where id = $1`, [hiloId])).rows;
  chequear(h?.estado === "en_curso" && h?.ultimo_autor === "equipo", "al contestar el estado pasa a “en curso”", `estado raro: ${JSON.stringify(h)}`);
  await r.locator("[data-resolver]").click();
  await r.getByText("Marcado como resuelto").first().waitFor({ timeout: 30000 });
  ok("la recepción lo marca como resuelto");

  // 5) El socio ve la respuesta (con su aviso).
  await s.goto(`${G}/app/yo`);
  const aviso = s.locator('[data-yo-fila="mensajes"]');
  await aviso.waitFor({ timeout: 30000 });
  chequear(/respuesta/.test(await aviso.innerText()), "en Yo aparece el aviso de la respuesta nueva", "no hay aviso de respuesta en Yo");
  await s.goto(`${G}/app/novedades`);
  chequear(await s.locator("[data-novedad-mensajes]").isVisible().catch(() => false), "en Novedades dice que el gimnasio le respondió", "falta el aviso en Novedades");
  await s.goto(`${G}/app/mensajes/${hiloId}`);
  await s.locator('[data-autor="equipo"]', { hasText: s5 }).waitFor({ timeout: 30000 });
  ok("el socio ve la respuesta del gimnasio");
  await capturar(s, "vd38-celu-respuesta");
  // Al abrirla queda leída.
  const [leida] = (await db.query(`select socio_leyo_en >= ultimo_en as leida from public.hilos_socio where id = $1`, [hiloId])).rows;
  chequear(leida?.leida === true, "al abrir la respuesta deja de figurar como nueva", "la respuesta sigue como nueva");

  // 6) La ficha del socio guarda el historial.
  await d.goto(`${G}/panel/socios`);
  const [{ socio_id }] = (await db.query(`select socio_id from public.hilos_socio where id = $1`, [hiloId])).rows;
  await d.goto(`${G}/panel/socios/${socio_id}`);
  await d.locator("[data-historial-mensajes]").waitFor({ timeout: 30000 });
  chequear(await d.locator("[data-historial-mensajes]").getByText(/botella azul|Encontramos lo que perdiste|Objeto perdido/).first().isVisible(), "la ficha del socio muestra el historial de mensajes", "la ficha no muestra el historial");

  // 7) Bandeja en el celular, sin desbordes.
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/mensajes?estado=todos`);
  await c.locator("[data-hilo]").first().waitFor({ timeout: 30000 });
  chequear((await c.evaluate(() => document.documentElement.scrollWidth)) <= CELU.width, "bandeja en celular 390 px: sin desborde", "la bandeja desborda en el celular");
  await capturar(c, "vd38-celu-bandeja");
} finally {
  await db.query(`delete from public.config_mensajes where gimnasio_id = $1`, [gim]).catch(() => {});
  if (rapidaCreada) await db.query(`delete from public.respuestas_rapidas_mensajes where gimnasio_id = $1 and titulo = 'Objeto encontrado'`, [gim]).catch(() => {});
  await db.end();
  await b.close();
}
resultado();
