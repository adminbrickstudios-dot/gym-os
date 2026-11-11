#!/usr/bin/env node
// H3 · El QR de registro directo: /g/<slug>/hacete-socio tiene que andar siempre, desde la dirección de la plataforma.
//   1. Abre la dirección del QR (PLATAFORMA/g/demo/hacete-socio) en el celular: se queda en esa dirección (no rebota a /hacete-socio),
//      muestra el formulario del gimnasio demo, se anota, y la recepción lo ve en Prospectos.
//   2. /g/demo/privacidad se queda en su dirección y muestra la política del gimnasio.
//   3. Desde /g/demo (la página del gimnasio en la plataforma), "Quiero ser socio" lleva al formulario: nunca "No encontramos esta página".
//   4. /g/demo/ingresar?modo=socio sigue andando con la marca del gimnasio.
//   5. Un gimnasio que no existe en /g/<slug>/hacete-socio dice que no lo encuentra (404 con la dirección escrita).
//   node scripts/e2e/hacete-socio-directo.mjs      (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, PLATAFORMA, aparece, capturar, chequear, entrar, esperarAntiRobot, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() }); await db.connect();
// El gimnasio demo: reglamento (si no tiene), registro abierto y página publicada.
await db.query(`insert into public.reglamentos (gimnasio_id, version, texto) select g.id, 1, 'Reglamento de prueba del gimnasio demo para el e2e del registro directo.' from public.gimnasios g where g.slug = 'demo' and not exists (select 1 from public.reglamentos r where r.gimnasio_id = g.id)`);
await db.query(`update public.configuracion_gimnasio set altas_online = true where gimnasio_id = (select id from public.gimnasios where slug = 'demo')`);
await db.query(`update public.landing_gimnasio set publicada = true where gimnasio_id = (select id from public.gimnasios where slug = 'demo')`);
const b = await navegador();
const s = Date.now().toString().slice(-6);
const DNI = `43${s}`;
const TEL = `000 ${s}4`;   // característica 000: ficticio
const DIRECTA = `${PLATAFORMA}/g/demo/hacete-socio`;
try {
  // ── 1. La dirección del QR, en el celular ──
  const v = await pagina(b, CELU);
  const respuesta = await v.goto(DIRECTA);
  chequear(respuesta?.status() === 200, "la dirección del QR responde 200", `la dirección del QR respondió ${respuesta?.status()}`);
  const form = v.locator("[data-form-alta]");
  await form.waitFor({ timeout: 60000 });
  chequear(new URL(v.url()).pathname === "/g/demo/hacete-socio", "se queda en /g/demo/hacete-socio (no rebota a /hacete-socio)", `terminó en ${v.url()}`);
  chequear(await v.locator("[data-alta-cerrada]").count() === 0 && !/No encontramos esta página/.test(await v.locator("body").innerText()), "abre el formulario del gimnasio, no un 404", "no abre el formulario");
  await form.locator("[data-plan]").first().click();
  await form.locator('input[name="nombre"]').fill("Lucía");
  await form.locator('input[name="apellido"]').fill(`Directo${s}`);
  await form.locator('input[name="dni"]').fill(DNI);
  await form.locator('input[name="telefono"]').fill(TEL);
  await form.locator('input[name="fecha_nacimiento"]').fill("1992-03-04");
  await form.locator('input[name="email"]').fill(`directo${s}@ejemplo.invalid`);
  await form.locator('input[name="contrasena"]').fill("clave-de-prueba-1");
  await form.locator('input[name="acepto"]').check();
  await form.locator('label:has(input[value="mostrador"])').click();
  await esperarAntiRobot(form);
  await form.locator('button[type="submit"]').click();
  const listo = v.locator("[data-alta-lista]");
  await listo.waitFor({ timeout: 30000 });
  chequear(/¡Listo, Lucía!/.test(await listo.innerText()), "se anota desde la dirección del QR: “¡Listo, Lucía!”", `la pantalla final dice: ${(await listo.innerText()).slice(0, 80)}`);
  await capturar(v, "hacete-socio-directo-celu-listo", true);

  // ── La recepción lo ve en el panel ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/prospectos`);
  await r.locator('[data-filtro="socio"]').click();
  chequear(await aparece(r.locator("[data-prospecto]", { hasText: `Directo${s}` }), 30000), "la recepción lo ve en el panel (Prospectos → Se hicieron socios)", "no aparece en el panel");
  await r.context().close();

  // ── 2. Privacidad en la dirección de la plataforma ──
  const p = await pagina(b, CELU);
  await p.goto(`${PLATAFORMA}/g/demo/privacidad`);
  chequear(new URL(p.url()).pathname === "/g/demo/privacidad" && !/No encontramos esta página/.test(await p.locator("body").innerText()), "/g/demo/privacidad se queda en su dirección y abre la política", `privacidad terminó en ${p.url()}`);

  // ── 3. Desde la página del gimnasio en la plataforma, "Quiero ser socio" lleva al formulario ──
  await p.goto(`${PLATAFORMA}/g/demo`);
  const boton = p.locator("[data-quiero-ser-socio]").first();
  chequear(await aparece(boton, 30000), "la página del gimnasio muestra “Quiero ser socio” (altas online prendidas)", "no aparece “Quiero ser socio”");
  await boton.click();
  chequear(await aparece(p.locator("[data-form-alta]"), 60000), "“Quiero ser socio” abre el formulario del gimnasio", `“Quiero ser socio” terminó en ${p.url()}: ${(await p.locator("body").innerText()).slice(0, 80)}`);
  chequear(!/No encontramos esta página/.test(await p.locator("body").innerText()), "ningún “No encontramos esta página”", "salió “No encontramos esta página”");

  // ── 4. El ingreso del socio, con la marca del gimnasio ──
  await p.goto(`${PLATAFORMA}/g/demo/ingresar?modo=socio`);
  chequear(await aparece(p.locator("[data-marca-ingreso]"), 30000), "/g/demo/ingresar?modo=socio muestra la marca del gimnasio", "el ingreso no muestra la marca");
  await p.goto(`${PLATAFORMA}/ingresar?modo=socio`);
  chequear(await aparece(p.locator("[data-marca-ingreso]"), 30000), "con el gimnasio ya elegido, /ingresar?modo=socio de la plataforma sigue en el gimnasio", "el ingreso de la plataforma perdió el gimnasio");

  // ── 5. Un gimnasio que no existe ──
  const nada = await p.goto(`${PLATAFORMA}/g/no-existe-${s}/hacete-socio`);
  chequear(nada?.status() === 404, "un gimnasio que no existe da 404 (con la dirección escrita)", `un gimnasio inexistente respondió ${nada?.status()}`);

  for (const [n, pag] of [["celular", v], ["página", p]]) if (pag.errores.length) falla(`${n}: ${pag.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await db.end();
await b.close();
resultado();
