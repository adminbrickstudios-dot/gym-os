#!/usr/bin/env node
// Fase P (P4 a P7) del super admin, con sesión real del admin demo:
//  P4  crear un gimnasio con dirección normalizada (sin tildes) y reservada, plan de Base, y "Probar acceso" automático al terminar
//  P5  tarjeta Accesos lista para wa.me (panel, mail, contraseña, web) con copiar
//  P6  "Probar acceso" por usuario, en verde, amarillo o rojo, con "Arreglar" (confirmar la cuenta, activar)
//  P7  desactivar y activar, cambiar rol, mover de gimnasio, y "Entrar como" con la barra "Estás viendo como … de …" y Salir
//   node scripts/e2e/super-p.mjs        (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, PLATAFORMA as B, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url });
await db.connect();
const q = async (sql, params) => (await db.query(sql, params)).rows;

const s = Date.now().toString().slice(-5);
const NOMBRE = `Ñandú Fuerte ${s}`;
const SLUG = `nandu-fuerte-${s}`;
const MAIL_DUENO = `pdueno${s}@ejemplo.invalid`;
const MAIL_REC = `prec${s}@ejemplo.invalid`;
const DESTINO = `[e2e] Destino ${s}`;

const b = await navegador();
const p = await pagina(b);
p.setDefaultTimeout(30000);
const abrir = async (ruta) => { await p.goto(`${B}${ruta}`); await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {}); };
async function ver(nombre) {
  await p.setViewportSize(CELU);
  await p.waitForFunction((w) => window.innerWidth === w, CELU.width);
  await capturar(p, `p-${nombre}-celu`, true);
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width + 4, `celular: ${nombre} sin desborde (${ancho}px)`, `celular: ${nombre} mide ${ancho}px`);
  await p.setViewportSize(COMPU);
  await capturar(p, `p-${nombre}-compu`, true);
}
const esperarBase = async (sql, params) => { for (let i = 0; i < 40; i++) { if ((await q(sql, params)).length) return true; await new Promise((r) => setTimeout(r, 500)); } return false; };

try {
  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  chequear(p.url().endsWith("/admin"), "el admin entra al super admin", `cayó en ${p.url()}`);
  await q(`insert into public.gimnasios (slug, nombre) values ($1, $2)`, [`e2e-destino-${s}`, DESTINO]);

  // ── P4: la dirección reservada y la normalizada ──
  await abrir("/admin");
  await p.locator("select[name=tipo]").selectOption("");
  await p.getByRole("button", { name: /Siguiente/ }).click();
  await p.fill("input[name=nombre]", "Admin");
  await p.getByRole("button", { name: /Siguiente/ }).click();
  await p.fill("input[name=dueno]", "Alguien");
  await p.click('button:has-text("Crear gimnasio")');
  chequear(await aparece(p.getByText(/dirección de la plataforma/), 30000), "una dirección reservada (“admin”) se rechaza con palabras", "no se rechazó la dirección reservada");
  chequear((await q(`select 1 from public.gimnasios where slug = 'admin'`)).length === 0, "y no se creó nada", "se creó un gimnasio con la dirección reservada");

  // ── P4 y P5: crear con tildes y mayúsculas, con plan de Base, y la tarjeta Accesos ──
  await abrir("/admin");
  await p.locator("select[name=tipo]").selectOption("musculacion");
  await p.getByRole("button", { name: /Siguiente/ }).click();
  await p.fill("input[name=nombre]", NOMBRE);
  const planOpc = p.locator("[data-plan-brik] option").nth(1);
  if (await planOpc.count()) await p.locator("[data-plan-brik]").selectOption({ index: 1 });
  await p.getByRole("button", { name: /Siguiente/ }).click();
  await p.fill("input[name=dueno]", "Dueño Fuerte");
  await p.fill("input[name=email]", ` ${MAIL_DUENO.toUpperCase()} `);
  await p.click('button:has-text("Crear gimnasio")');
  await p.locator("[data-alta-gimnasio] [data-accesos]").waitFor({ timeout: 60000 });
  const g = (await q(`select id, slug from public.gimnasios where nombre = $1`, [NOMBRE]))[0];
  chequear(g?.slug === SLUG, `la dirección salió sin tildes ni mayúsculas (${g?.slug})`, `la dirección quedó ${g?.slug}`);
  const clave = (await p.locator("[data-accesos] strong.numero").first().innerText()).trim();
  const eq = (await q(`select u.email, u.email_confirmed_at from public.equipo e join auth.users u on u.id = e.usuario_id where e.gimnasio_id = $1 and e.rol = 'dueno'`, [g.id]))[0];
  chequear(eq?.email === MAIL_DUENO && !!eq.email_confirmed_at, "el mail se guardó limpio (minúsculas, sin espacios) y la cuenta ya está confirmada", `cuenta: ${JSON.stringify(eq)}`);
  chequear((await q(`select 1 from public.landing_gimnasio where gimnasio_id = $1 and publicada`, [g.id])).length === 1, "la landing quedó publicada", "la landing no está publicada");
  const acc = p.locator("[data-accesos]");
  const textoAcc = await acc.innerText();
  chequear(textoAcc.includes(MAIL_DUENO) && textoAcc.includes(clave), "Accesos: el mail y la contraseña a la vista", "Accesos no muestra mail y contraseña");
  chequear(/\/dueno|\/ingresar/.test(await acc.locator("[data-acceso-panel]").innerText()), "Accesos: el link del panel", "falta el link del panel");
  chequear((await acc.locator("[data-acceso-web]").innerText()).includes(SLUG), "Accesos: el link de la web del gimnasio", "falta el link de la web");
  const wa = decodeURIComponent((await acc.locator("[data-accesos-wa]").getAttribute("href")) ?? "");
  chequear(wa.startsWith("https://wa.me/") && wa.includes(clave) && wa.includes(MAIL_DUENO) && wa.includes(SLUG), "Accesos: el mensaje de WhatsApp lleva panel, mail, contraseña y web", `el link de WhatsApp: ${wa.slice(0, 120)}`);
  chequear(await aparece(acc.locator("[data-copiar-accesos]")), "Accesos: botón para copiar todo", "falta copiar");
  const prueba = p.locator("[data-prueba-alta]");
  chequear(await aparece(prueba), "al terminar corre “Probar acceso” solo", "no corrió la prueba al terminar");
  chequear((await prueba.getAttribute("data-ok")) === "si", "la prueba del gimnasio nuevo da todo en verde", `la prueba dio: ${(await prueba.innerText()).replace(/\s+/g, " ").slice(0, 300)}`);
  chequear((await q(`select 1 from public.gimnasios where id = $1 and plataforma_plan_id is not null`, [g.id])).length === (await p.locator("[data-plan-brik] option").count() > 1 ? 1 : 0), "el plan de Base elegido se asignó", "el plan de Base no se asignó");
  await ver("alta");

  // ── P6: probar acceso del dueño y de una persona sin cuenta; arreglar ──
  await abrir(`/admin/${g.id}`);
  const fila = (nombre) => p.locator("#equipo li", { hasText: nombre });
  const dueno = fila("Dueño Fuerte");
  await dueno.locator("[data-probar-acceso]").click();
  const pd = dueno.locator("[data-prueba-persona]");
  chequear(await aparece(pd) && (await pd.getAttribute("data-ok")) === "si", "probar acceso del dueño: todo en verde", "la prueba del dueño no dio verde");
  chequear((await pd.locator('[data-paso-prueba="ingreso"]').getAttribute("data-estado")) === "aviso", "“Todavía no entró” sale en amarillo, no en rojo", "el último ingreso no está en amarillo");
  const form = 'form:has-text("Sumar a alguien")';
  await p.fill(`${form} input[name=nombre]`, "Recepción P");
  await p.selectOption(`${form} select[name=rol]`, "recepcion");
  await p.click(`${form} button:has-text("Sumar")`);
  await fila("Recepción P").waitFor();
  await fila("Recepción P").locator("[data-probar-acceso]").click();
  const pr = fila("Recepción P").locator("[data-prueba-persona]");
  chequear(await aparece(pr) && (await pr.getAttribute("data-ok")) === "no", "sin cuenta: la prueba da rojo", "la persona sin cuenta no da rojo");
  chequear((await pr.locator('[data-paso-prueba="cuenta"]').getAttribute("data-estado")) === "falta" && /Dar acceso/.test(await pr.innerText()), "el rojo dice qué hacer: “Dar acceso”", "el rojo no dice que hay que dar acceso");
  // Con cuenta pero sin confirmar: el botón Arreglar la confirma.
  await fila("Recepción P").locator('button:has-text("Dar acceso")').click();
  await fila("Recepción P").locator("input[name=email]").fill(MAIL_REC);
  await fila("Recepción P").locator('button:has-text("Dar acceso")').click();
  await fila("Recepción P").locator("strong.numero").waitFor();
  await q(`update auth.users set email_confirmed_at = null where email = $1`, [MAIL_REC]);
  await abrir(`/admin/${g.id}`);
  await fila("Recepción P").locator("[data-probar-acceso]").click();
  const pr2 = fila("Recepción P").locator("[data-prueba-persona]");
  chequear(await aparece(pr2.locator('[data-arreglar="confirmar"]')), "cuenta sin confirmar: rojo con botón “Arreglar”", "no ofrece Arreglar la cuenta sin confirmar");
  await pr2.locator('[data-arreglar="confirmar"]').click();
  chequear(await esperarBase(`select 1 from auth.users where email = $1 and email_confirmed_at is not null`, [MAIL_REC]), "Arreglar confirmó la cuenta en la base", "la cuenta sigue sin confirmar");
  await p.waitForFunction(() => document.querySelector("[data-prueba-persona]")?.getAttribute("data-ok") !== null);
  chequear((await fila("Recepción P").locator("[data-prueba-persona]").getAttribute("data-ok")) === "si", "y la prueba vuelve a correr y da verde", "la prueba no quedó en verde");

  // ── P7: desactivar y activar (con Arreglar), cambiar rol y mover ──
  const rec = fila("Recepción P");
  await rec.getByRole("button", { name: "Más acciones" }).click();
  await rec.locator("[data-estado-persona]").click();
  chequear(await esperarBase(`select 1 from public.equipo where gimnasio_id = $1 and nombre = 'Recepción P' and not activo`, [g.id]), "desactivar a una persona", "no se desactivó");
  await abrir(`/admin/${g.id}`);
  await fila("Recepción P").locator("[data-probar-acceso]").click();
  await fila("Recepción P").locator('[data-arreglar="activar"]').click();
  chequear(await esperarBase(`select 1 from public.equipo where gimnasio_id = $1 and nombre = 'Recepción P' and activo`, [g.id]), "“Arreglar” la reactiva", "Arreglar no la reactivó");
  await abrir(`/admin/${g.id}`);
  await dueno.getByRole("button", { name: "Más acciones" }).click();
  await dueno.locator("[data-estado-persona]").click();
  chequear(await aparece(dueno.locator("[role=alert]")) && /único dueño/.test(await dueno.locator("[role=alert]").innerText()), "no deja al gimnasio sin dueño", "dejó al gimnasio sin dueño");
  await abrir(`/admin/${g.id}`);
  const rec2 = fila("Recepción P");
  await rec2.getByRole("button", { name: "Más acciones" }).click();
  await rec2.locator("[data-rol-persona]").selectOption("profe");
  await rec2.locator("[data-cambiar-rol]").click();
  chequear(await esperarBase(`select 1 from public.equipo where gimnasio_id = $1 and nombre = 'Recepción P' and rol = 'profe'`, [g.id]), "cambiar el rol a profe", "el rol no cambió");
  await abrir(`/admin/${g.id}`);
  const rec3 = fila("Recepción P");
  await rec3.getByRole("button", { name: "Más acciones" }).click();
  await rec3.locator("[data-mover-destino]").selectOption({ label: DESTINO });
  await rec3.locator("[data-mover]").click();
  chequear(await esperarBase(`select 1 from public.equipo e join public.gimnasios gi on gi.id = e.gimnasio_id where gi.nombre = $1 and e.nombre = 'Recepción P' and e.activo`, [DESTINO]), "mover a otro gimnasio: aparece activa en el destino", "no apareció en el gimnasio de destino");
  chequear(await esperarBase(`select 1 from public.equipo where gimnasio_id = $1 and nombre = 'Recepción P' and not activo`, [g.id]), "y queda desactivada en el origen (su historial se queda)", "no quedó desactivada en el origen");
  await abrir(`/admin/${g.id}`);
  await ver("ficha-gestion");

  // ── P7: Entrar como, con la barra ──
  await p.locator("#entrar [data-entrar-soporte]").click();
  const fs = p.locator("#entrar [data-motivo-soporte]");
  await fs.locator("input[name=motivo]").fill("e2e: ver como la recepción");
  await fs.locator("select[name=rol]").selectOption("recepcion");
  await fs.locator("button:not([type=button])").click();
  await p.waitForURL(/\/panel/, { timeout: 60000 });
  const viendo = p.locator("[data-soporte-viendo]");
  chequear(await aparece(viendo) && /Estás viendo como recepción de/.test(await viendo.innerText()) && (await viendo.innerText()).includes(NOMBRE), "la barra dice “Estás viendo como recepción de <gimnasio>”", `la barra dice: ${(await viendo.innerText().catch(() => "")).slice(0, 120)}`);
  chequear(await aparece(p.locator("[data-soporte-banner] button:has-text('Salir')")), "la barra tiene el botón Salir", "falta Salir en la barra");
  await capturar(p, "p-barra-soporte-compu", true);
  await p.locator("[data-soporte-banner] button:has-text('Salir')").click();
  await p.waitForURL(/\/admin/, { timeout: 60000 });
  ok("Salir vuelve al super admin");
  chequear((await q(`select 1 from public.registro_brik where gimnasio_id = $1 and accion = 'entrar_como_soporte'`, [g.id])).length >= 1, "“Entrar como” quedó en el registro de BRIK", "no quedó registrado");

  if (p.errores.length) falla(`errores en la página: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${e.message.split("\n")[0]}`);
  await capturar(p, "ROTA-super-p", true).catch(() => {});
} finally {
  await db.end().catch(() => {});
}
await b.close();
resultado();
