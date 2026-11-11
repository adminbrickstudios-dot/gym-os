#!/usr/bin/env node
// H3b · El camino del socio completo (docs/base/SOCIO-FLUJO.md, LISTO SI), en el celular (390 px).
//   1. Landing → "Quiero ser socio" → elegir plan → DNI con el aviso → cuenta creada → "Listo" → perfil. Ningún "No encontramos esta página".
//   2. Con un DNI ya usado, avisa y ofrece entrar (y no crea otro socio).
//   3. Sin pagar la app dice "No podés entrar"; la recepción aprueba el pago y la misma pantalla da "Podés entrar".
//   4. Cerrar el navegador y volver a abrir la landing: la saluda y ofrece "Ir a mi perfil"; /ingresar no muestra el login.
//      "Cerrar sesión" vuelve a la landing del gimnasio.
//   5. Con "Quiero ser socio" apagado: el botón no aparece y el link directo dice que hoy no se puede, con el WhatsApp.
//   6. Un socio ya cargado (recepción) reclama su ficha con DNI y celular: ve su ficha y NO se crea otro socio; con datos que no
//      coinciden no entra.
//   7. Un menor: el formulario pide al adulto responsable.
//   node scripts/e2e/socio-flujo.mjs      (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, esperarAntiRobot, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() }); await db.connect();
await db.query(`insert into public.reglamentos (gimnasio_id, version, texto) select g.id, 1, 'Reglamento de prueba del gimnasio demo para el e2e del camino del socio.' from public.gimnasios g where g.slug = 'demo' and not exists (select 1 from public.reglamentos r where r.gimnasio_id = g.id)`);
const b = await navegador();
const s = Date.now().toString().slice(-6);
const DNI = `41${s}`, TEL = `000 ${s}5`, MAIL = `flujo${s}@ejemplo.invalid`, CLAVE = "clave-de-prueba-1";
const DNI_CARGADO = `40${s}`, TEL_CARGADO = `000 ${s}6`, MAIL_CARGADO = `cargado${s}@ejemplo.invalid`;   // característica 000: ficticio
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const sociosConDni = async (dni) => (await db.query(`select count(*)::int n from public.socios x join public.gimnasios g on g.id = x.gimnasio_id where g.slug = 'demo' and x.dni = $1`, [dni])).rows[0].n;
const sinPagina404 = async (p) => !/No encontramos esta página/.test(await p.locator("body").innerText());
try {
  // ── La dueña deja el registro abierto (así se revalida la página) ──
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/ayuda/carteles/anotate`);
  const controles = d.locator("[data-qr-alta-controles]");
  await controles.waitFor({ timeout: 60000 });
  const poner = async (abierto) => {
    if (((await controles.getAttribute("data-abierto")) === "si") !== abierto) {
      await controles.locator("[data-registro-abierto]").first().click();
      await d.waitForFunction((a) => document.querySelector("[data-qr-alta-controles]")?.getAttribute("data-abierto") === (a ? "si" : "no"), abierto, { timeout: 30000 });
    }
  };
  await poner(true);

  // ── 1. Landing → Quiero ser socio → Listo → perfil ──
  const v = await pagina(b, CELU);
  v.setDefaultNavigationTimeout(120000);
  await v.goto(G);
  const quiero = v.locator("[data-quiero-ser-socio]").first();
  chequear(await aparece(quiero, 60000), "la landing muestra “Quiero ser socio”", "la landing no muestra “Quiero ser socio”");
  chequear(await aparece(v.locator("[data-ya-soy-socio]"), 5000), "y “Ya soy socio, entrar”", "falta “Ya soy socio, entrar”");
  await quiero.click();
  const form = v.locator("[data-form-alta]");
  await form.waitFor({ timeout: 60000 });
  chequear(await sinPagina404(v), "“Quiero ser socio” abre el formulario, no un 404", "“Quiero ser socio” dio “No encontramos esta página”");
  await form.locator("[data-plan]").first().click();
  chequear(/con este DNI vas a entrar al gimnasio todos los días/.test(await form.locator("[data-aviso-dni]").innerText()), "el DNI lleva el aviso: “con este DNI vas a entrar todos los días”", "falta el aviso del DNI");
  chequear(await form.locator('input[name="dni"]').evaluate((x) => x.required && x.pattern === "[0-9]{7,8}"), "el DNI es obligatorio, de 7 u 8 cifras", "el DNI no es obligatorio o no valida cifras");
  await form.locator('input[name="nombre"]').fill("Julián");
  await form.locator('input[name="apellido"]').fill(`Flujo${s}`);
  await form.locator('input[name="dni"]').fill(DNI);
  await form.locator('input[name="telefono"]').fill(TEL);
  await form.locator('input[name="fecha_nacimiento"]').fill("1990-05-01");
  await form.locator('input[name="email"]').fill(MAIL);
  await form.locator('input[name="contrasena"]').fill(CLAVE);
  await form.locator('input[name="acepto"]').check();
  await form.locator('label:has-text("Transferencia")').click();
  await esperarAntiRobot(form);
  await form.locator('button[type="submit"]').click();
  const listo = v.locator("[data-alta-lista]");
  await listo.waitFor({ timeout: 30000 });
  const textoListo = await listo.innerText();
  chequear(/¡Listo, Julián! Ya tenés tu cuenta en/.test(textoListo) && v.locator("[data-tu-dni]").first() && /Tu DNI para entrar: \d{1,2}\.\d{3}\.\d{3}/.test(textoListo), "“¡Listo, Julián!” con “Tu DNI para entrar” y el DNI con puntos", `Listo dice: ${textoListo.slice(0, 160)}`);
  await capturar(v, "socio-flujo-celu-listo", true);
  await v.locator("[data-ir-a-mi-perfil]").click();
  await v.waitForURL(/\/app/, { timeout: 60000 });
  chequear(await aparece(v.getByText("Hola, Julián"), 60000), "“Ir a mi perfil” abre la app con la sesión abierta: “Hola, Julián”", "no abre la app con la sesión abierta");
  const ficha = (await db.query(`select x.id, x.usuario_id from public.socios x join public.gimnasios g on g.id = x.gimnasio_id where g.slug = 'demo' and x.dni = $1`, [DNI])).rows;
  chequear(ficha.length === 1 && !!ficha[0].usuario_id, "en la base: una sola ficha con ese DNI, vinculada a su cuenta", `fichas con ese DNI: ${ficha.length}`);

  // ── 3. Sin pagar: rojo con el motivo; la recepción aprueba el pago y entra ──
  const estado = v.locator("section", { hasText: /No podés entrar|Podés entrar/ }).first();
  await estado.waitFor({ timeout: 30000 });
  chequear(/No podés entrar/.test(await estado.innerText()), "sin pagar: la app dice “No podés entrar” (D26, nunca entra gratis)", `sin pagar la app dice: ${(await estado.innerText()).slice(0, 80)}`);
  chequear(await aparece(v.locator("[data-tu-dni-inicio], [data-mi-qr], [data-qr]"), 10000), "el Inicio muestra cómo entra: su DNI o su QR", "el Inicio no muestra el DNI ni el QR");
  await capturar(v, "socio-flujo-celu-inicio-sin-pagar", true);
  const pagar = v.locator("section", { hasText: "Pagar por transferencia" });
  await pagar.waitFor({ timeout: 60000 });
  await pagar.locator('input[type="file"]').setInputFiles({ name: "comprobante.png", mimeType: "image/png", buffer: PNG });
  await v.getByText(/el gimnasio lo (revisa|está revisando)/).first().waitFor({ timeout: 30000 });
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/transferencias`);
  const mia = r.locator("li", { hasText: `Flujo${s}` }).first();
  await mia.waitFor({ timeout: 60000 });
  await mia.locator('button:has-text("Aprobar")').click();
  await r.locator("li", { hasText: `Julián Flujo${s}` }).filter({ has: r.locator('button:has-text("Aprobar")') }).waitFor({ state: "detached", timeout: 30000 });
  await r.goto(`${G}/panel/entrada?socio=${ficha[0].id}`);
  await r.locator('[data-veredicto="verde"]').waitFor({ timeout: 60000 });
  ok("la recepción aprueba el pago: la misma entrada da verde");
  await v.goto(`${G}/app`);
  chequear(await aparece(v.getByText("Podés entrar", { exact: true }), 60000), "y la app del socio dice “Podés entrar”", "la app no dice “Podés entrar” después de pagar");

  // ── 2. Un DNI ya usado: avisa y ofrece entrar, sin duplicar ──
  const w = await pagina(b, CELU);
  await w.goto(`${G}/hacete-socio`);
  const f2 = w.locator("[data-form-alta]");
  await f2.waitFor({ timeout: 60000 });
  await f2.locator("[data-plan]").first().click();
  await f2.locator('input[name="nombre"]').fill("Otro");
  await f2.locator('input[name="apellido"]').fill("Repetido");
  await f2.locator('input[name="dni"]').fill(DNI);
  await f2.locator('input[name="telefono"]').fill(`000 ${s}7`);
  await f2.locator('input[name="fecha_nacimiento"]').fill("1991-01-01");
  await f2.locator('input[name="email"]').fill(`otro${s}@ejemplo.invalid`);
  await f2.locator('input[name="contrasena"]').fill(CLAVE);
  await f2.locator('input[name="acepto"]').check();
  await f2.locator('label:has(input[value="mostrador"])').click();
  await esperarAntiRobot(f2);
  await f2.locator('button[type="submit"]').click();
  const ya = w.locator("[data-alta-ya-socio]");
  await ya.waitFor({ timeout: 30000 });
  chequear(/Ese DNI ya es socio de/.test(await ya.innerText()) && await ya.locator("[data-entrar-ya-socio]").count() === 1, "con un DNI ya usado: “Ese DNI ya es socio de …” con el link para entrar", `dice: ${(await ya.innerText()).slice(0, 80)}`);
  chequear(await sociosConDni(DNI) === 1, "y no se crea otro socio con ese DNI", "se duplicó el socio");
  await w.context().close();

  // ── 4. Sesión con memoria: cerrar el navegador y volver ──
  const guardado = await v.context().storageState();
  await v.context().close();
  const m = await pagina(b, CELU, { storageState: guardado });
  m.setDefaultNavigationTimeout(120000);
  await m.goto(G);
  chequear(await aparece(m.locator("[data-saludo-sesion]"), 60000) && /Hola, Julián/.test(await m.locator("[data-saludo-sesion]").innerText()), "al volver, la landing lo saluda: “Hola, Julián”", "la landing no lo saluda");
  chequear(await m.locator("[data-ir-a-mi-perfil]").count() > 0 && await m.locator("[data-ya-soy-socio]").count() === 0, "ofrece “Ir a mi perfil” y no pide entrar de nuevo", "la landing sigue pidiendo entrar");
  await m.goto(`${G}/ingresar?modo=socio`);
  await m.waitForURL(/\/app/, { timeout: 60000 });
  chequear(await m.locator("input[type=password]").count() === 0, "con la sesión abierta, /ingresar no muestra el login: va a su perfil", "/ingresar mostró el login con la sesión abierta");
  await m.goto(G);
  await m.locator("[data-cerrar-sesion]").first().click();
  await m.waitForURL((u) => u.pathname === "/", { timeout: 60000 });
  chequear(await aparece(m.locator("[data-ya-soy-socio]"), 60000), "“Cerrar sesión” vuelve a la landing del gimnasio, ya sin sesión", `“Cerrar sesión” terminó en ${m.url()}`);
  await m.context().close();

  // ── 6. Un socio ya cargado reclama su ficha, sin duplicar ──
  await db.query(
    `insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, email, fecha_nacimiento, origen)
     select g.id, 'Marcela', $1, $2, privado.telefono_normalizado($3, 'Celular'), null, date '1988-02-03', 'manual' from public.gimnasios g where g.slug = 'demo'`,
    [`Cargada${s}`, DNI_CARGADO, TEL_CARGADO]);
  const c = await pagina(b, CELU);
  c.setDefaultNavigationTimeout(120000);
  await c.goto(`${G}/ingresar?modo=socio`);
  await c.locator("[data-primera-vez]").click();
  const rec = c.locator("[data-reclamar-form]");
  await rec.waitFor({ timeout: 60000 });
  await rec.locator('input[name="dni"]').fill(DNI_CARGADO);
  await rec.locator('input[name="telefono"]').fill(`000 ${s}9`);   // celular que no coincide
  await rec.locator('input[name="email"]').fill(MAIL_CARGADO);
  await rec.locator('input[name="contrasena"]').fill(CLAVE);
  await esperarAntiRobot(rec);
  await rec.locator('button[type="submit"]').click();
  const malo = c.locator('[data-reclamar-form] [role="alert"], [data-reclamar-form] .mensaje-error').first();
  chequear(await aparece(malo, 30000) && /revise tus datos/.test(await malo.innerText()), "con un celular que no coincide: “Pedile a la recepción que revise tus datos”", "con datos que no coinciden no avisó");
  await rec.locator('input[name="telefono"]').fill(TEL_CARGADO);
  await rec.locator('input[name="contrasena"]').fill(CLAVE);
  await esperarAntiRobot(rec);
  await rec.locator('button[type="submit"]').click();
  await c.waitForURL(/\/app/, { timeout: 60000 });
  chequear(await aparece(c.getByText("Hola, Marcela"), 60000), "con DNI y celular que coinciden: reclama su ficha y entra a la app: “Hola, Marcela”", "no pudo reclamar su ficha");
  chequear(await sociosConDni(DNI_CARGADO) === 1, "y sigue habiendo una sola ficha con ese DNI", "se creó un socio de más");
  const reclamada = (await db.query(`select x.usuario_id from public.socios x join public.gimnasios g on g.id = x.gimnasio_id where g.slug = 'demo' and x.dni = $1`, [DNI_CARGADO])).rows[0];
  chequear(!!reclamada?.usuario_id, "la ficha quedó vinculada a su cuenta", "la ficha no quedó vinculada");
  await c.context().close();

  // ── 7. Menores: pide al adulto responsable ──
  const n = await pagina(b, CELU);
  await n.goto(`${G}/hacete-socio`);
  const f3 = n.locator("[data-form-alta]");
  await f3.waitFor({ timeout: 60000 });
  chequear(await f3.locator("[data-adulto-responsable]").count() === 0, "mayor de edad: no pide adulto responsable", "pide adulto responsable a un mayor");
  await f3.locator('input[name="fecha_nacimiento"]').fill(`${new Date().getFullYear() - 14}-06-10`);
  chequear(await aparece(f3.locator("[data-adulto-responsable]"), 10000), "menor de 18: pide nombre y celular del adulto responsable", "con un menor no pide al adulto responsable");
  await n.context().close();

  // ── 5. Con "Quiero ser socio" apagado ──
  await poner(false);
  const o = await pagina(b, CELU);
  o.setDefaultNavigationTimeout(120000);
  await o.goto(G);
  await o.locator("[data-ya-soy-socio]").first().waitFor({ timeout: 60000 });
  chequear(await o.locator("[data-quiero-ser-socio]").count() === 0, "apagado: el botón “Quiero ser socio” no aparece", "apagado: el botón sigue");
  await o.goto(`${G}/hacete-socio`);
  const cerrada = o.locator("[data-alta-cerrada]");
  chequear(await aparece(cerrada, 30000) && /no te podés anotar/.test(await cerrada.innerText()) && await o.locator("[data-whatsapp-gimnasio]").count() === 1, "apagado: el link directo dice que hoy no se puede y da el WhatsApp", "apagado: el link directo no lo dice");
  await o.context().close();
  await poner(true);

  for (const [nombre, pag] of [["dueña", d], ["celular", v], ["recepción", r]]) if (pag.errores.length) falla(`${nombre}: ${pag.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await db.end();
await b.close();
resultado();
