#!/usr/bin/env node
// Cierre para vender (Mateo, 25/11) · ALTA DE CERO: lo que va a pasar con cada gimnasio nuevo, de punta a punta y con sesiones reales.
//   1. /super → alta del gimnasio con la función única (plantilla, planes y configuración; nace en Pista con Semáforo).
//   2. El dueño recibe su acceso y entra.
//   3. Le pone precio al plan e importa 50 socios de un CSV típico con vista previa (columnas en otro orden, DNI con puntos,
//      celulares sin el 9, fechas dd/mm/aaaa).
//   4. El primer cobro, la primera entrada en la puerta (verde) y la primera entrada de un socio que debe (rojo).
//   5. Un socio crea su cuenta por el QR del cartel ("Anotate acá").
// Cuenta los pasos que haría una persona (clics, campos, archivos) con un tiempo estimado por paso, y falla si pasan de 15 minutos.
//   node scripts/e2e/alta-de-cero.mjs      (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, PLATAFORMA as B, aparece, capturar, chequear, entrar, esperarAntiRobot, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { altaGimnasio } from "./alta-gimnasio.mjs";

// ── Los pasos humanos: lo que tardaría una persona (sin contar lo que tarda la app en responder) ──
const humano = { pasos: 0, segundos: 0 };
const clic = (n = 1) => { humano.pasos += n; humano.segundos += 3 * n; };
const tipear = (texto) => { humano.pasos += 1; humano.segundos += 4 + String(texto).length * 0.35; };
const elegirArchivo = () => { humano.pasos += 1; humano.segundos += 20; };
const leer = (s) => { humano.segundos += s; };   // mirar la pantalla antes de decidir

const s = Date.now().toString().slice(-5);
const NOMBRE = `Alta Cero ${s}`, SLUG = `alta-cero-${s}`, MAIL = `alta${s}@ejemplo.invalid`;
const G = GIMNASIO(SLUG);
const PRECIO = "25.000";

// 50 socios como los exporta otro sistema: columnas en otro orden, DNI con puntos, celulares sin el 9, fechas dd/mm/aaaa.
// Los primeros 40 pagaron hasta dentro de 20 días (al día); los últimos 10, hasta hace 20 días (deben: fuera de la tolerancia). Todo ficticio (000, @ejemplo.invalid).
const dia = (n) => { const d = new Date(Date.now() + n * 864e5); return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`; };
const dniDe = (i) => `4${s}${String(i).padStart(2, "0")}`.slice(0, 8);
const conPuntos = (d) => d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const filasCsv = Array.from({ length: 50 }, (_, i) => [
  `+54 000 ${String(4000000 + Number(s) * 50 + i).slice(-7)}`,         // celular con +54 y sin el 9
  `Socio${i} Importado${s}`, conPuntos(dniDe(i)), "Mensual libre", i < 40 ? dia(20) : dia(-20), dia(-60),
]);
const CSV = ["Celular;Nombre y apellido;Documento;Plan;Vence;Fecha de alta", ...filasCsv.map((f) => f.join(";"))].join("\r\n");
const AL_DIA = dniDe(0), DEBE = dniDe(45);

const inicio = Date.now();
const b = await navegador();
try {
  // ── 1. /super: el alta ──
  const a = await pagina(b, COMPU);
  await entrar(a, "admin@ejemplo.invalid", undefined, B);
  await a.goto(`${B}/admin`);
  clic(); leer(5);
  await altaGimnasio(a, { nombre: NOMBRE, dueno: "Dueña Cero", email: MAIL, celular: "000 555 0100", tipo: "musculacion", acento: "#16a34a", fondo: "#0e151c" });
  tipear(NOMBRE); tipear("#16a34a"); tipear("#0e151c"); tipear("Dueña Cero"); tipear(MAIL); tipear("000 555 0100"); clic(4);
  await a.locator("strong.numero").first().waitFor({ timeout: 60000 });
  const clave = (await a.locator("strong.numero").first().innerText()).trim();
  ok(`1. /super: ${NOMBRE} creado con la plantilla, la marca y el dueño (contraseña provisoria)`);
  leer(10);   // copiar el acceso y mandarlo por WhatsApp
  clic();
  await capturar(a, "alta-cero-1-super", true);
  {
    const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() }); await db.connect();
    const { rows: [g] } = await db.query(`select g.id, g.origen, c.estilo, (select f.activa from public.funciones_nuevas_gimnasio f where f.gimnasio_id = g.id and f.clave = 'pista_semaforo') semaforo,
        (select count(*)::int from public.planes p where p.gimnasio_id = g.id) planes from public.gimnasios g join public.configuracion_gimnasio c on c.gimnasio_id = g.id where g.slug = $1`, [SLUG]);
    chequear(g && g.estilo === "pista" && g.semaforo === true && g.planes > 0 && g.origen === "alta_super",
      `nace en Pista con Semáforo, con ${g?.planes} planes de la plantilla y origen ${g?.origen}`, `quedó: ${JSON.stringify(g)}`);
    // El cartel "Anotate acá" pide un reglamento escrito (lo escribe el dueño en Configuración): se deja uno de prueba para el paso 5.
    await db.query(`insert into public.reglamentos (gimnasio_id, version, texto) select $1, 1, 'Reglamento de prueba del alta de cero: respetá los horarios y cuidá las máquinas.' where not exists (select 1 from public.reglamentos where gimnasio_id = $1)`, [g.id]);
    await db.end();
  }
  await a.context().close();

  // ── 2. El dueño entra ──
  const d = await pagina(b, COMPU);
  await entrar(d, MAIL, clave, B);
  tipear(MAIL); tipear(clave); clic();
  await d.waitForURL(/\/panel/, { timeout: 60000 });
  const html = d.locator("html");
  chequear(await html.getAttribute("data-estilo") === "pista" && await html.getAttribute("data-semaforo") === "si", "2. el dueño entra a su panel, en Pista Semáforo", `el panel salió con estilo=${await html.getAttribute("data-estilo")} semaforo=${await html.getAttribute("data-semaforo")}`);
  const base = new URL(d.url()).origin;
  await capturar(d, "alta-cero-2-panel", true);

  // ── 3. El precio del plan y los 50 socios ──
  await d.goto(`${base}/panel/planes`);
  clic();
  const plan = d.locator('li[data-plan="Mensual libre"]');
  await plan.waitFor({ timeout: 60000 });
  await plan.locator('button:has-text("Precios")').click(); clic();
  await plan.locator('input[aria-label="Precio general"]').fill(PRECIO); tipear(PRECIO);
  await plan.locator('button:has-text("Guardar precios")').click(); clic();
  await aparece(plan.locator(`text=$${PRECIO}`), 30000);
  ok(`3. el plan Mensual libre a $${PRECIO}`);

  await d.goto(`${base}/panel/socios/importar`);
  clic(2);
  await d.locator('input[type=file][aria-label="Elegir archivo"]').setInputFiles({ name: "socios.csv", mimeType: "text/csv", buffer: Buffer.from(CSV, "utf8") });
  elegirArchivo();
  await d.locator("[data-columnas]").waitFor({ timeout: 30000 });
  leer(15);   // mirar que cada columna quedó en su campo
  const elegidos = await d.locator("[data-columnas] select").evaluateAll((l) => l.map((x) => x.value));
  chequear(JSON.stringify(elegidos) === JSON.stringify(["telefono", "nombre", "dni", "plan", "vence", "alta"]),
    "las columnas en otro orden caen solas en su campo", `quedaron: ${elegidos.join(", ")}`);
  await d.locator('button:has-text("Revisar")').click(); clic();
  const rev = d.locator("[data-revision]");
  await rev.waitFor({ timeout: 60000 });
  leer(15);
  chequear(await rev.getAttribute("data-validas") === "50" && await rev.getAttribute("data-con-error") === "0", "la vista previa: 50 listos, ninguno con error (DNI con puntos, +54 sin el 9, dd/mm/aaaa)",
    `vista previa: ${await rev.getAttribute("data-validas")} listos, ${await rev.getAttribute("data-con-error")} con error · ${(await rev.innerText()).slice(0, 300)}`);
  chequear(/\+549/.test(await rev.locator("[data-vista-previa]").innerText()), "los celulares quedan con el 9", "los celulares quedaron sin el 9");
  await rev.locator('button:has-text("Importar 50 socios")').click(); clic();
  await d.locator("[data-importados]").waitFor({ timeout: 120000 });
  chequear(await d.locator("[data-importados]").getAttribute("data-importados") === "50", "entraron los 50", `entraron ${await d.locator("[data-importados]").getAttribute("data-importados")}`);
  await capturar(d, "alta-cero-3-importar", true);

  // ── 4. El primer cobro (a uno que debe), la primera entrada verde y la primera roja ──
  const buscarYVer = async (dni) => {
    await d.goto(`${base}/panel/entrada?q=${dni}`);
    clic(); tipear(dni);
    const ventana = d.locator("[data-ventana-veredicto]:not([data-ventana-veredicto=cargando]), [data-veredicto]");
    if (!(await aparece(ventana, 20000))) {
      const fila = d.locator("button.fila").first();
      if (await aparece(fila, 20000)) { await fila.click(); clic(); }
    }
    await ventana.first().waitFor({ timeout: 30000 });
    return ventana.first();
  };
  // El que debe: rojo, NO PASA.
  let v = await buscarYVer(DEBE);
  const colorDebe = (await v.getAttribute("data-ventana-veredicto")) ?? (await v.getAttribute("data-veredicto"));
  const palabra = async () => (await d.locator("[data-franja-palabra]").count()) ? (await d.locator("[data-franja-palabra]").first().textContent())?.trim() : "(Entrada sin ventana)";
  chequear(colorDebe === "rojo", `4. la primera entrada de un socio que debe: rojo (${await palabra()})`, `salió ${colorDebe}: ${(await v.innerText()).slice(0, 160)}`);
  await capturar(d, "alta-cero-4-rojo", true);
  // Lo cobra ahí mismo: el primer cobro del gimnasio (transferencia: no hace falta abrir la caja).
  await v.locator("[data-ventana-cobrar], a:has-text('Cobrar')").first().click(); clic();
  await d.getByText(/^Cuota /).first().waitFor({ timeout: 30000 });
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click(); clic();
  await d.locator('button:has-text("Cobrar")').last().click(); clic();
  // Cobrado desde la puerta: la hoja Cobrar dice "Cobrado $…" y el veredicto pasa a verde (en Vender, esperarCobro).
  const cobrado = await Promise.race([
    d.getByText(/Cobrado $/).first().waitFor({ timeout: 30000 }).then(() => true),
    d.waitForFunction(() => document.querySelector("[data-veredicto], [data-ventana-veredicto]")?.matches("[data-veredicto=verde], [data-ventana-veredicto=verde]"), null, { timeout: 30000 }).then(() => true),
  ]).catch(() => false);
  if (!cobrado) await esperarCobro(d);
  ok(`el primer cobro: la cuota de $${PRECIO} al que debía`);
  leer(5);
  // El al día: verde, PASA, y se anota.
  v = await buscarYVer(AL_DIA);
  const colorAlDia = (await v.getAttribute("data-ventana-veredicto")) ?? (await v.getAttribute("data-veredicto"));
  chequear(colorAlDia === "verde", `la primera entrada en la puerta: verde (${await palabra()})`, `salió ${colorAlDia}: ${(await v.innerText()).slice(0, 160)}`);
  await d.locator("[data-ventana-anotar], button:has-text('Anotar entrada')").first().click(); clic();
  chequear(await aparece(d.locator("[data-ventana-hecho], [data-entrada-anotada], :text('Entró')"), 30000), "la entrada queda anotada", "no se anotó la entrada");
  await capturar(d, "alta-cero-4-verde", true);

  // ── 5. Un socio crea su cuenta por el QR del cartel ──
  await d.goto(`${base}/panel/ayuda/carteles/anotate`);
  clic(2);
  const controles = d.locator("[data-qr-alta-controles]");
  await controles.waitFor({ timeout: 60000 });
  if ((await controles.getAttribute("data-abierto")) !== "si") {
    await controles.locator("[data-registro-abierto]").first().click(); clic();
    await d.waitForFunction(() => document.querySelector("[data-qr-alta-controles]")?.getAttribute("data-abierto") === "si", null, { timeout: 30000 });
  }
  const link = (await controles.locator("[data-link-anotate]").innerText()).trim();
  leer(10);   // imprimir el cartel y pegarlo
  const c = await pagina(b, CELU);
  await c.goto(link.replace(/^https?:\/\/[^/]+/, G));
  const form = c.locator("[data-form-alta]");
  chequear(await aparece(form, 60000), "5. el QR del cartel abre el formulario en el celular", "el QR no abre el formulario");
  const dniNuevo = `43${s}9`;
  // Sin plan sugerido en el cartel, el socio elige el suyo (el primero).
  const planes = form.locator("[data-plan] input");
  if (await planes.count() && !(await planes.first().isChecked())) { await form.locator("[data-plan]").first().click(); clic(); }
  await form.locator('input[name="nombre"]').fill("Nueva"); tipear("Nueva");
  await form.locator('input[name="apellido"]').fill(`Qr${s}`); tipear(`Qr${s}`);
  await form.locator('input[name="dni"]').fill(dniNuevo); tipear(dniNuevo);
  await form.locator('input[name="telefono"]').fill(`000 ${s}17`); tipear(`000 ${s}17`);
  if (await form.locator('input[name="fecha_nacimiento"]').count()) { await form.locator('input[name="fecha_nacimiento"]').fill("1995-04-10"); tipear("10/04/1995"); }
  await form.locator('input[name="email"]').fill(`nueva${s}@ejemplo.invalid`); tipear(`nueva${s}@ejemplo.invalid`);
  await form.locator('input[name="contrasena"]').fill("clave-de-prueba-1"); tipear("clave-de-prueba-1");
  await form.locator('input[name="acepto"]').check(); clic();
  if (await form.locator('label:has(input[value="mostrador"])').count()) { await form.locator('label:has(input[value="mostrador"])').click(); clic(); }
  await esperarAntiRobot(form);
  await form.locator('button[type="submit"]').click(); clic();
  chequear(await aparece(c.locator("[data-alta-lista]"), 30000), "el socio creó su cuenta por el QR", `el alta no terminó: ${(await c.locator("main").innerText()).slice(0, 200)}`);
  await capturar(c, "alta-cero-5-qr", true);
  if (c.errores.length) falla(`celular: ${c.errores.join(" | ")}`);
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  const min = humano.segundos / 60;
  chequear(min < 15, `alta de cero: ${humano.pasos} pasos humanos, unos ${min.toFixed(1)} minutos de una persona (tope 15); la prueba tardó ${((Date.now() - inicio) / 60000).toFixed(1)} min`,
    `alta de cero: ${humano.pasos} pasos, ${min.toFixed(1)} minutos de una persona (más de 15)`);
  console.log(`ALTA_DE_CERO pasos=${humano.pasos} minutos_humanos=${min.toFixed(1)} minutos_prueba=${((Date.now() - inicio) / 60000).toFixed(1)}`);
} catch (e) {
  falla(`se cortó: ${e.message}`);
} finally {
  await b.close();
}
resultado();
