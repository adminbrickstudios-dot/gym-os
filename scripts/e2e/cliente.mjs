#!/usr/bin/env node
// AUD-16 · Como un cliente, de punta a punta, con un gimnasio que no existía:
// el super admin lo crea (tipo box) → el dueño entra, le pone precio al plan,
// carga el alias, arma la grilla, importa socios, publica la página y suma a
// su recepción → un prospecto deja sus datos → la recepción abre la caja,
// cobra una cuota en efectivo, el socio pasa en la Entrada y cierra la caja →
// ese socio reserva desde la app; otro paga por transferencia → el dueño la
// aprueba y ve la plata en Resultado (y su Inicio en el celular).
//   npm run e2e:cliente           (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, PLATAFORMA, GIMNASIO, capturar, chequear, entrar, entrarSocio, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { altaGimnasio } from "./alta-gimnasio.mjs";

const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const s = Date.now().toString().slice(-5);
const NOMBRE = `Cliente ${s}`;
const MAIL_DUENO = `cliente${s}@ejemplo.invalid`;
const MAIL_RECEP = `recep-cliente${s}@ejemplo.invalid`;
const TEL1 = `000 8${s}1`, TEL2 = `000 8${s}2`;   // característica 000: ficticios
const csv = [
  "Apellido;Nombre;DNI;Teléfono;Plan;Pagó hasta",
  `Cliente${s};Uno;72${s}1;${TEL1};Libre mensual;`,
  `Cliente${s};Dos;72${s}2;${TEL2};Libre mensual;`,
].join("\r\n");
// Mañana en la hora del gimnasio, como día de la semana (1 = lunes … 7 = domingo).
const manana = new Date(Date.now() + 864e5);
const diaManana = ((new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(manana) + "T12:00:00Z").getUTCDay() + 6) % 7) + 1;

const b = await navegador();
const paginas = [];
// Con el servidor de desarrollo, la primera vez que se abre una pantalla se compila: más tiempo para navegar.
const nueva = async (tam) => { const p = await pagina(b, tam); p.setDefaultNavigationTimeout(120000); paginas.push(p); return p; };
try {
  // ── 1. BRIK crea el gimnasio ──
  const a = await nueva(COMPU);
  await entrar(a, "admin@ejemplo.invalid", undefined, PLATAFORMA);
  await altaGimnasio(a, { nombre: NOMBRE, dueno: "Dueño Cliente", email: MAIL_DUENO, tipo: "box" });
  await a.locator("strong.numero").first().waitFor({ timeout: 60000 });
  const claveDueno = (await a.locator("strong.numero").first().innerText()).trim();
  const gim = (await a.locator("a[data-alta-equipo]").getAttribute("href")).split("/").pop();
  const [{ slug }] = (await db.query(`select slug from public.gimnasios where id = $1`, [gim])).rows;
  const G = GIMNASIO(slug);
  ok(`BRIK crea “${NOMBRE}” (tipo box) en ${slug}.localhost con la contraseña del dueño`);

  // ── 2. El dueño entra y ve los primeros pasos ──
  const d = await nueva(COMPU);
  await entrar(d, MAIL_DUENO, claveDueno, G);
  const pasos = d.locator("[data-primeros-pasos]");
  await pasos.waitFor({ timeout: 60000 });
  const hechos0 = Number(await pasos.getAttribute("data-primeros-pasos"));
  ok(`el dueño entra a su panel: primeros pasos ${hechos0} de 8`);

  // Precio del plan que trajo la plantilla.
  await d.goto(`${G}/panel/planes`);
  const plan = d.locator('li[data-plan="Libre mensual"]');
  await plan.waitFor({ timeout: 60000 });
  await plan.locator('button:has-text("💲 Precios")').click();
  await plan.locator('input[aria-label="Precio general"]').fill("30.000");
  await plan.locator('button:has-text("Guardar precios")').click();
  await plan.getByText("$30.000").first().waitFor({ timeout: 30000 });
  ok("le pone precio al plan de la plantilla: Libre mensual $30.000");

  // Alias para transferencias.
  await d.goto(`${G}/panel/configuracion?pestana=cobros`);
  const cobros = d.locator('fieldset[data-pestana-activa="cobros"]');
  await cobros.waitFor({ timeout: 60000 });
  await cobros.locator("label", { hasText: "Alias" }).locator("input").fill(`cliente.${s}.mp`);
  const pie = d.locator('[data-pie="cobros"]');
  const n0 = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await d.waitForFunction((n) => Number(document.querySelector('[data-pie="cobros"]')?.getAttribute("data-respuestas")) > n, n0, { timeout: 30000 });
  const msjCobros = (await pie.locator(".mensaje").first().innerText()).replace(/\s+/g, " ");
  chequear(/Guardado/.test(msjCobros), "carga el alias para transferencias", `al guardar el alias: ${msjCobros}`);

  // Grilla: CrossFit mañana a las 19.
  await d.goto(`${G}/panel/clases/grilla`);
  const formH = d.locator("form", { hasText: "Agregar a la grilla" });
  await formH.waitFor({ timeout: 60000 });
  const crossfit = await formH.locator("select").first().locator("option", { hasText: "CrossFit" }).getAttribute("value");
  await formH.locator("select").first().selectOption(crossfit);
  await formH.locator("select").nth(1).selectOption(String(diaManana));
  await formH.locator('input[type="time"]').fill("19:00");
  await formH.getByRole("button", { name: /Agregar/ }).click();
  await d.locator("li", { hasText: "CrossFit" }).filter({ hasText: "19:00" }).first().waitFor({ timeout: 30000 });
  ok("arma la grilla: CrossFit mañana a las 19");

  // Importa socios.
  await d.goto(`${G}/panel/socios/importar`);
  await d.locator("[data-importador]").waitFor({ timeout: 60000 });
  await d.setInputFiles('input[aria-label="Elegir archivo"]', { name: "socios.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
  await d.locator('button:has-text("Revisar")').click();
  const rev = d.locator("[data-revision]");
  await rev.waitFor({ timeout: 30000 });
  await rev.locator('button:has-text("Importar 2 socios")').click();
  await d.locator("[data-importados]").waitFor({ timeout: 60000 });
  const socios = (await db.query(`select id, nombre from public.socios where gimnasio_id = $1 and apellido = $2 order by nombre desc`, [gim, `Cliente${s}`])).rows;
  const [uno, dos] = [socios.find((x) => x.nombre === "Uno")?.id, socios.find((x) => x.nombre === "Dos")?.id];
  chequear(uno && dos, "importa 2 socios con su plan (sin pagar)", `quedaron ${socios.length} socios`);

  // Publica la página.
  await d.goto(`${G}/panel/pagina`);
  const estado = d.locator("[data-estado-pagina]");
  await estado.waitFor({ timeout: 60000 });
  // Un clic antes de que la página termine de cargar no hace nada: se espera y, si no cambió, se vuelve a tocar.
  await d.waitForLoadState("networkidle").catch(() => {});
  for (let i = 0; i < 3 && await estado.locator('button:has-text("Publicar mi página")').count(); i++) {
    await estado.locator('button:has-text("Publicar mi página")').click();
    await d.locator('[data-estado-pagina="publicada"], [data-estado-pagina] [role="alert"]').first().waitFor({ timeout: 15000 }).catch(() => {});
  }
  if (await estado.locator('[role="alert"]').count()) throw new Error(`al publicar: ${await estado.locator('[role="alert"]').innerText()}`);
  await d.locator('[data-estado-pagina="publicada"]').waitFor({ timeout: 30000 });
  ok("publica su página");

  // Suma a su recepción con acceso.
  await d.goto(`${G}/panel/equipo`);
  const formE = d.locator("form", { hasText: "Sumar a alguien" });
  await formE.waitFor({ timeout: 60000 });
  await formE.locator("input[name=nombre]").fill("Recepción Cliente");
  await formE.locator("select[name=rol]").selectOption("recepcion");
  await formE.getByRole("button", { name: /Sumar al equipo/ }).click();
  const filaR = d.locator("li", { hasText: "Recepción Cliente" }).first();
  await filaR.waitFor({ timeout: 30000 });
  await filaR.locator('button:has-text("Dar acceso")').click();
  await filaR.locator("input[name=email]").fill(MAIL_RECEP);
  await filaR.locator('button:has-text("Dar acceso")').click();
  await filaR.locator("strong.numero").waitFor({ timeout: 30000 });
  const claveRecep = (await filaR.locator("strong.numero").innerText()).trim();
  ok("suma a la recepción y le da acceso con su mail");

  await d.goto(`${G}/panel`);
  await pasos.waitFor({ timeout: 60000 }).catch(() => {});
  const hechos1 = await pasos.count() ? Number(await pasos.getAttribute("data-primeros-pasos")) : 8;
  chequear(hechos1 > hechos0, `primeros pasos: de ${hechos0} a ${hechos1} de 8 (se calculan solos)`, `los primeros pasos siguen en ${hechos1}`);

  // ── 3. Un prospecto deja sus datos en la página ──
  const v = await nueva(CELU);
  await v.goto(`${G}/#probar`);
  const probar = v.locator("[data-form-probar]");
  await probar.waitFor({ timeout: 60000 });
  await probar.locator("input[name=nombre]").fill(`Prospecto ${s}`);
  await probar.locator("input[name=telefono]").fill(`000 9${s}9`);
  await probar.getByRole("button", { name: /Quiero probar/ }).click();
  await v.locator("[data-probar-listo]").waitFor({ timeout: 30000 });
  await d.goto(`${G}/panel/prospectos`);
  await d.locator("li", { hasText: `Prospecto ${s}` }).first().waitFor({ timeout: 60000 });
  ok("un visitante deja sus datos en la página y el dueño lo ve en Prospectos");

  // ── 4. La recepción: caja, cobro en efectivo, entrada, cierre ──
  const r = await nueva(COMPU);
  await entrar(r, MAIL_RECEP, claveRecep, G);
  await r.goto(`${G}/panel/caja`);
  await r.locator('input[placeholder="$ 0"]').first().fill("5.000");
  await r.locator('button:has-text("Abrir caja")').first().click();
  await r.locator('button:has-text("Cerrar caja")').waitFor({ timeout: 30000 });
  await r.goto(`${G}/panel/vender?socio=${uno}&cuota=1`);
  await r.getByText("Cuota Libre mensual").first().waitFor({ timeout: 60000 });
  chequear(/\$30\.000/.test(await r.locator("main").innerText()), "la recepción abre la caja y la cuota sale $30.000", "la cuota no sale $30.000");
  await r.locator('button[aria-pressed]:has-text("Efectivo")').click();
  await r.locator('button:has-text("✅ Cobrar")').click();
  await esperarCobro(r);
  await r.goto(`${G}/panel/entrada?socio=${uno}`);
  await r.locator('[data-veredicto="verde"]').waitFor({ timeout: 60000 });
  ok("cobra en efectivo y en la Entrada el socio está al día (verde)");
  await r.goto(`${G}/panel/caja`);
  await r.locator('button:has-text("Cerrar caja")').click();
  await r.locator('input[placeholder="$ contado"]').fill("35.000");
  await r.locator('button:has-text("Cerrar con este monto")').click();
  await r.locator('button:has-text("Listo")').waitFor({ timeout: 30000 });
  const cierre = await r.locator("main").innerText();
  chequear(!/Faltan|Sobran/.test(cierre), "cierra la caja con $35.000 contados: cierra justo", `al cerrar: ${cierre.slice(0, 200)}`);
  await r.locator('button:has-text("Listo")').click();

  // ── 5. Los socios en la app ──
  const s1 = await nueva(CELU);
  await entrarSocio(s1, TEL1, G);
  await s1.goto(`${G}/app/clases?dia=${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(manana)}`);
  const reservar = s1.getByRole("button", { name: /^Reservar$/ }).first();
  await reservar.waitFor({ timeout: 60000 });
  await reservar.click();
  await s1.getByText("✅ Reservada").first().waitFor({ timeout: 30000 });
  ok("el socio que pagó entra a la app con su celular y reserva CrossFit de mañana");

  const s2 = await nueva(CELU);
  await entrarSocio(s2, TEL2, G);
  const pagar = s2.locator("section", { hasText: "Pagar por transferencia" });
  await pagar.waitFor({ timeout: 60000 });
  chequear((await pagar.innerText()).includes(`cliente.${s}.mp`), "el otro socio ve el alias del gimnasio para transferir", await pagar.innerText());
  await pagar.locator('input[type="file"]').setInputFiles({ name: "comprobante.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64") });
  await s2.getByText(/el gimnasio lo (revisa|está revisando)/).first().waitFor({ timeout: 30000 });  // el aviso, o la app ya re-pintada con "Informaste…"
  ok("sube el comprobante: “el gimnasio lo revisa y te habilita”");

  // ── 6. El dueño aprueba y ve la plata ──
  await d.goto(`${G}/panel/transferencias`);
  await d.locator('button:has-text("✅ Aprobar")').first().click();
  await d.getByText("Aprobada").first().waitFor({ timeout: 30000 });
  await d.goto(`${G}/panel/entrada?socio=${dos}`);
  await d.locator('[data-veredicto="verde"]').waitFor({ timeout: 60000 });
  ok("el dueño aprueba la transferencia y el socio queda al día");
  await d.goto(`${G}/panel/resultado`);
  await d.locator("main h1").waitFor({ timeout: 60000 });
  chequear(/\$60\.000/.test(await d.locator("main").innerText()), "Resultado: $60.000 del mes (efectivo y transferencia)", (await d.locator("main").innerText()).slice(0, 300));
  await capturar(d, "cliente-compu-resultado");

  // Abre otra sede (REV-2a): con su caja, sin tocar nada de la primera.
  await d.goto(`${G}/panel/configuracion`);
  await d.locator("[data-sumar-sede]").click();
  await d.locator("[data-sumar-sede-form] input").fill("Sucursal Norte");
  await d.locator('[data-sumar-sede-form] button[type="submit"]').click();
  await d.locator("[data-sede]").nth(1).waitFor({ timeout: 30000 });
  const [{ n: cajas }] = (await db.query(`select count(*)::int n from public.cajas where gimnasio_id = $1`, [gim])).rows;
  chequear(cajas === 2, "abre otra sede desde Configuración y la sede trae su caja", `quedaron ${cajas} cajas`);

  const dc = await nueva(CELU);
  await entrar(dc, MAIL_DUENO, claveDueno, G);
  await dc.locator("h1").first().waitFor({ timeout: 60000 });
  const ancho = await dc.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width + 1, "el dueño abre su Inicio en el celular sin nada desbordado", `Inicio se desborda: ${ancho}px`);
  await capturar(dc, "cliente-celu-inicio");

  for (const p of paginas) if (p.errores.length) falla(`errores en ${p.url()}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
  for (const [i, p] of paginas.entries()) await capturar(p, `ROTA-cliente-${i}`, true).catch(() => {});
} finally {
  await db.end();
}
await b.close();
resultado();
