#!/usr/bin/env node
// D83 punto 7 · El camino del socio de punta a punta, como en Temple Gym (altas con plan APAGADAS, QR del socio prendido), en el gimnasio demo:
//   1. La portada ofrece "Crear mi cuenta" (principal) y "Ya soy socio, entrar". Lleva a /hacete-socio: sin planes ni medio de pago; DNI con su aviso.
//   2. Cuenta creada: sesión abierta y su app SIN PAGAR: botones grandes (Pagá tu plan, Mi QR, …), QR bloqueado, "No podés entrar".
//   3. Memoria: con la sesión abierta, la dirección del gimnasio lo lleva directo a su app; "Ver la página del gimnasio" vuelve a la portada.
//   4. Recepción: la primera vez la ventana ofrece "Clase de prueba" como botón principal y "Dar el alta y cobrar" como segundo; la prueba lo deja entrar.
//      Días después (se simula en la base): "Dar el alta y cobrar" es el principal y dice "Ya usó su clase de prueba el DD/MM".
//   5. Se cobra: la app del socio (abierta sin recargar) activa su QR sola y dice "Podés entrar".
//   6. Entra en verde por DNI (ventana de la recepción) y por QR (lector de la recepción).
//   node scripts/e2e/camino-socio.mjs      (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, esperarAntiRobot, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() }); await db.connect();
const demo = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows[0].id;
// Como Temple Gym: página publicada, altas con plan apagadas, "Crear mi cuenta" prendido, clase de prueba (por día) prendida y sin reglamento cargado por el e2e.
await db.query(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [demo]);
await db.query(`update public.configuracion_gimnasio set altas_online = false, crear_cuenta_visible = true, prueba_gratis = 'dia' where gimnasio_id = $1`, [demo]);
const b = await navegador();
const s = Date.now().toString().slice(-6);
const DNI = `42${s}`, TEL = `000 ${s}8`, MAIL = `camino${s}@ejemplo.invalid`, CLAVE = "clave-de-prueba-1";
const NOMBRE = "Camila", APELLIDO = `Camino${s}`;

async function prenderQr(p, prender) {
  await p.goto(`${G}/panel/configuracion?pestana=reglas`);
  await p.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 });
  const sw = p.locator("[data-accesos] label", { hasText: "QR del socio" }).locator("input");
  await sw.waitFor({ timeout: 30000 });
  if ((await sw.isChecked()) === prender) return;
  await sw.click();
  const pie = p.locator('[data-pie="reglas"]'); const n = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await p.waitForFunction((n) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > n, n, { timeout: 30000 });
}
async function abrirVentana(r, dni) {
  await r.goto(`${G}/panel/socios`);   // la ventana grande sale desde la barrita de cualquier pantalla del panel
  await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
  await r.locator("body").click({ position: { x: 5, y: 5 } });
  await r.locator("[data-boton-ventana]").click();
  await r.locator("[data-ventana-campo]").fill(dni);
  await r.keyboard.press("Enter");
  await r.locator("[data-ventana-veredicto]").waitFor({ timeout: 30000 });
}

// La recepción trabaja con la ventana grande (F2): se deja como estaba al terminar.
const resultadoAntes = (await db.query(`select resultado_entrada r from public.configuracion_entrada where gimnasio_id = $1`, [demo])).rows[0]?.r ?? "avisos";
await db.query(`update public.configuracion_entrada set resultado_entrada = 'ventana' where gimnasio_id = $1`, [demo]);
let prendioQr = false, d = null;
try {
  d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await prenderQr(d, true); prendioQr = true;

  // ── 1. La portada y "Crear mi cuenta" ──
  const v = await pagina(b, CELU);
  v.setDefaultNavigationTimeout(120000);
  await v.goto(G);
  const crear = v.locator("[data-crear-cuenta]").first();
  chequear(await aparece(crear, 60000), "la portada ofrece “Crear mi cuenta” aunque las altas con plan estén apagadas", "la portada no ofrece “Crear mi cuenta”");
  chequear(/Crear mi cuenta/.test(await crear.innerText()) && (await crear.getAttribute("class")).includes("boton-principal"), "…es el botón principal", "“Crear mi cuenta” no es el botón principal");
  chequear(await aparece(v.locator("[data-ya-soy-socio]"), 5000), "y “Ya soy socio, entrar” sigue debajo", "falta “Ya soy socio, entrar”");
  await capturar(v, "camino-socio-portada");
  await crear.click();
  const form = v.locator("[data-form-alta]");
  await form.waitFor({ timeout: 60000 });
  chequear(new URL(v.url()).pathname === "/hacete-socio", "lleva a /hacete-socio (la dirección del QR impreso)", `terminó en ${v.url()}`);
  chequear(await form.locator("[data-plan]").count() === 0 && await form.locator("#paso-pago").count() === 0, "sin planes ni cómo pagar: solo se crea la cuenta", "el formulario ofrece plan o medio de pago con las altas apagadas");
  chequear(/con este DNI vas a entrar al gimnasio todos los días/.test(await form.locator("[data-aviso-dni]").innerText()), "el DNI lleva su aviso", "falta el aviso del DNI");
  await form.locator('input[name="nombre"]').fill(NOMBRE);
  await form.locator('input[name="apellido"]').fill(APELLIDO);
  await form.locator('input[name="dni"]').fill(DNI);
  await form.locator('input[name="telefono"]').fill(TEL);
  await form.locator('input[name="fecha_nacimiento"]').fill("1993-04-05");
  await form.locator('input[name="email"]').fill(MAIL);
  await form.locator('input[name="contrasena"]').fill(CLAVE);
  if (await form.locator('input[name="acepto"]').count()) await form.locator('input[name="acepto"]').check();
  await esperarAntiRobot(form);
  await form.locator('button[type="submit"]').click();
  const listo = v.locator("[data-alta-lista]");
  await listo.waitFor({ timeout: 30000 });
  chequear(new RegExp(`¡Listo, ${NOMBRE}!`).test(await listo.innerText()) && /Tu DNI para entrar/.test(await listo.innerText()), "“¡Listo!” con su DNI para entrar", `dice: ${(await listo.innerText()).slice(0, 80)}`);
  await v.locator("[data-ir-a-mi-perfil]").click();

  // ── 2. Su app, sin pagar ──
  await v.waitForURL(/\/app/, { timeout: 60000 });
  const botones = v.locator("[data-botones-inicio]");
  await botones.waitFor({ timeout: 60000 });
  chequear(await botones.getAttribute("data-modo-botones") === "sin-pagar", "el Inicio de la app es el de quien todavía no pagó", "el Inicio no es el de sin pagar");
  const n = await botones.locator("[data-boton-inicio]").count();
  chequear(n >= 4 && n <= 6, `4 a 6 botones grandes (hay ${n})`, `hay ${n} botones en el Inicio`);
  for (const k of ["pagar", "qr", "perfil"]) chequear(await botones.locator(`[data-boton-inicio="${k}"]`).count() === 1, `el botón “${k}” está`, `falta el botón “${k}”`);
  chequear(await aparece(v.locator("[data-paga-tu-plan]"), 15000) && await aparece(v.locator("[data-qr-bloqueado]"), 15000), "“Pagá tu plan” y el QR bloqueado están a la vista", "falta “Pagá tu plan” o el QR bloqueado");
  chequear(await v.getByText("No podés entrar").count() > 0, "sin pagar la app dice “No podés entrar” (nunca entra gratis)", "sin pagar no dice “No podés entrar”");
  const ancho = await v.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= 391, "celular 390 px sin desborde", `scrollWidth ${ancho}`);
  await capturar(v, "camino-socio-app-sin-pagar", true);
  const socioId = (await db.query(`select id from public.socios where gimnasio_id = $1 and dni = $2`, [demo, DNI])).rows[0]?.id;
  chequear(!!socioId, "en la base: una ficha vinculada a su cuenta, sin plan", "no se creó la ficha");

  // ── 3. Memoria ──
  await v.goto(G);
  await v.waitForURL(/\/app/, { timeout: 60000 });
  ok("con la sesión abierta, la dirección del gimnasio lo lleva directo a su app");
  const ver = v.locator("[data-ver-pagina-gimnasio]");
  chequear(await aparece(ver, 30000), "en la app hay “Ver la página del gimnasio”", "falta “Ver la página del gimnasio”");
  await ver.click();
  await v.waitForURL(/pagina=1/, { timeout: 60000 });
  chequear(await aparece(v.locator("[data-primer-pantallazo]"), 60000) && await aparece(v.locator("[data-ir-a-mi-perfil]"), 15000), "…y muestra la portada (saludo y “Ir a mi perfil”)", "no muestra la portada");
  await v.goto(`${G}/app`);   // se queda en su app, abierta sin recargar más
  await v.locator("[data-qr-bloqueado]").waitFor({ timeout: 60000 });

  // ── 4. Recepción: primera vez → Clase de prueba ──
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await abrirVentana(r, DNI);
  const prueba = r.locator("[data-ventana-prueba]");
  chequear(await aparece(prueba, 15000) && await prueba.getAttribute("data-prueba-principal") !== null, "primera vez: “Clase de prueba” es el botón principal", "primera vez: no está “Clase de prueba” como principal");
  chequear(/Dar el alta y cobrar/.test(await r.locator("[data-ventana-cobrar]").innerText()) && !(await r.locator("[data-ventana-cobrar]").getAttribute("class")).includes("boton-principal"), "…y “Dar el alta y cobrar” es el segundo", "“Dar el alta y cobrar” no es el segundo botón");
  await capturar(r, "camino-socio-recepcion-primera-vez");
  await prueba.click();
  await r.locator('[data-ventana-veredicto="verde"]').waitFor({ timeout: 30000 });
  ok("la clase de prueba lo deja entrar: veredicto verde");
  await r.keyboard.press("Escape");

  // ── Días después: la prueba ya se usó (se simula en la base) ──
  const recep = (await db.query(`select e.id from public.equipo e where e.gimnasio_id = $1 and e.rol = 'recepcion' limit 1`, [demo])).rows[0].id;
  await db.query(`update public.pruebas_gratis set anulada_en = now(), anulada_por = $3, anulada_motivo = 'e2e: simula que pasaron días' where gimnasio_id = $1 and socio_id = $2 and anulada_en is null`, [demo, socioId, recep]);   // los registros no se borran: se anulan
  await db.query(`insert into public.pruebas_gratis (gimnasio_id, dni, nombre, modo, sede_id, desde, hasta, origen, socio_id, dada_por)
                  select $1, $2, $3, 'dia', (select id from public.sedes where gimnasio_id = $1 limit 1), now() - interval '3 days', now() - interval '2 days', 'entrada', $4,
                         (select e.id from public.equipo e where e.gimnasio_id = $1 and e.rol = 'recepcion' limit 1)`, [demo, DNI, NOMBRE, socioId]);
  await abrirVentana(r, DNI);
  chequear(await aparece(r.locator("[data-prueba-usada]"), 15000) && /Ya usó su clase de prueba el \d{2}\/\d{2}/.test(await r.locator("[data-prueba-usada]").innerText()), "segunda vez: dice “Ya usó su clase de prueba el DD/MM”", "no dice cuándo usó la prueba");
  chequear(await r.locator("[data-ventana-prueba]").count() === 0 && (await r.locator("[data-ventana-cobrar]").getAttribute("class")).includes("boton-principal"), "…y “Dar el alta y cobrar” pasa a ser el principal", "“Dar el alta y cobrar” no es el principal la segunda vez");
  await capturar(r, "camino-socio-recepcion-segunda-vez");

  // ── 5. Se cobra: el QR del socio se activa solo ──
  await r.locator("[data-ventana-cobrar]").click();
  const eleccion = r.locator("[data-elegir-plan-socio]");
  await eleccion.waitFor({ timeout: 30000 });
  chequear(await aparece(eleccion.locator("[data-plan-tarjeta]"), 30000), "“Dar el alta y cobrar” pide elegir el plan (tarjetas con el primer pago)", "no ofrece planes para elegir");
  await eleccion.locator("[data-plan-tarjeta]").first().click();
  await eleccion.locator("[data-elegir-plan-cobrar]").click();
  const hoja = r.locator("[data-cobrar]");
  await r.locator('[data-cobrar][data-estado="listo"]').waitFor({ timeout: 60000 });
  await hoja.locator('[data-cobrar-medio="transferencia"]').click();   // sin turno de caja abierto no se cobra en efectivo
  await capturar(r, "camino-socio-hoja-cobrar");
  await hoja.locator("[data-cobrar-confirmar]").click();
  await r.locator("[data-ventana-cobrado]").waitFor({ timeout: 30000 });
  ok("la recepción cobra el plan");
  chequear(await aparece(v.locator("[data-mi-qr]"), 90000), "la app del socio, sin recargar, activa su QR sola", "el QR no se activó solo después de pagar");
  chequear(await aparece(v.getByText("Podés entrar", { exact: true }), 30000), "y dice “Podés entrar”", "la app no dice “Podés entrar”");
  await capturar(v, "camino-socio-app-pagando", true);
  const pagando = v.locator("[data-botones-inicio]");
  chequear(await pagando.getAttribute("data-modo-botones") === "pagando", "el Inicio pasa al de quien está pagando (Mi QR, Reservar, Mis pagos…)", "el Inicio no cambió al de pagando");

  // ── 6. Entra en verde: por DNI y por QR ──
  await abrirVentana(r, DNI);
  chequear(await r.locator('[data-ventana-veredicto="verde"]').count() === 1, "por DNI: la ventana da verde", "por DNI no da verde");
  await r.locator("[data-ventana-anotar]").click();
  ok("por DNI: se anota la entrada");
  await r.keyboard.press("Escape");
  const codigo = await v.locator("[data-mi-qr]").getAttribute("data-codigo");
  await r.goto(`${G}/panel/entrada`);
  const buscar = r.locator('input[aria-label="Buscar socio"]');
  await buscar.fill(codigo); await buscar.press("Enter");
  const hecho = r.locator("[data-hecho]");
  const respuesta = await Promise.race([hecho.waitFor({ timeout: 30000 }).then(() => "hecho"), r.getByText(/ya se usó|ya entró|repetid/i).first().waitFor({ timeout: 30000 }).then(() => "repetido")]);
  chequear(respuesta === "hecho" || respuesta === "repetido", "por QR: el lector lo reconoce (entra en verde)", "por QR no lo reconoce");
  for (const [q, p] of [["dueña", d], ["celular", v], ["recepción", r]]) if (p.errores.length) falla(`${q}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.stack : e.message.split("\n")[0]}`);
} finally {
  try { if (prendioQr && d) await prenderQr(d, false); } catch { /* deja el QR como estaba */ }
  await db.query(`update public.configuracion_entrada set resultado_entrada = $2 where gimnasio_id = $1`, [demo, resultadoAntes]);
  await db.end();
}
await b.close();
resultado();

