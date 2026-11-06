#!/usr/bin/env node
// VD-33b · Mi cuenta: cambiar la contraseña con la actual (una equivocada no pasa), ver dónde está abierta la
// cuenta y cerrar las demás sesiones. Para el equipo (panel) y para el socio (app). Cambia la contraseña de
// un usuario de prueba y se la devuelve al final.
//   node scripts/e2e/vd-33b.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado, CLAVE_DEMO } from "./comun.mjs";

const G = GIMNASIO();
const MAIL = "recepcion@ejemplo.invalid";
const NUEVA = "clave-nueva-33b";
const b = await navegador();
let cambiada = false;
try {
  // ── Equipo: dos sesiones de la misma cuenta ──
  const a = await pagina(b, COMPU);
  const otra = await pagina(b, COMPU);
  await entrar(a, MAIL);
  await entrar(otra, MAIL);

  await a.goto(`${G}/panel/cuenta`);
  const seccion = a.locator("[data-sesiones]");
  await seccion.waitFor({ timeout: 30000 });
  chequear((await seccion.locator("[data-sesion]").count()) >= 2, "ve las sesiones abiertas (al menos esta y la otra)", "no lista las dos sesiones");
  chequear((await seccion.locator('[data-sesion="actual"]').count()) === 1, "una sola está marcada como “este dispositivo”", "la sesión actual no está marcada");

  // Contraseña actual equivocada: no cambia.
  const form = a.locator("form", { has: a.getByLabel("Contraseña nueva") });
  await form.getByLabel("Contraseña actual").fill("no-es-la-clave");
  await form.getByLabel("Contraseña nueva").fill(NUEVA);
  await form.getByLabel("Repetir la contraseña").fill(NUEVA);
  await form.getByRole("button", { name: "Guardar" }).click();
  await a.getByText("La contraseña actual no es correcta").waitFor({ timeout: 30000 });
  ok("con la contraseña actual equivocada no la cambia");

  // Con la correcta: cambia.
  await form.getByLabel("Contraseña actual").fill(CLAVE_DEMO);
  await form.getByRole("button", { name: "Guardar" }).click();
  await a.getByText("Contraseña cambiada").waitFor({ timeout: 30000 });
  cambiada = true;
  ok("con la contraseña actual correcta la cambia");

  // Cerrar las demás: queda solo esta, y la otra ya no puede seguir.
  await a.locator("[data-cerrar-otras]").click();
  await a.locator("[data-sin-otras]").waitFor({ timeout: 30000 });
  chequear((await a.locator("[data-sesion]").count()) === 1, "cerró las demás: queda solo esta sesión", "siguen otras sesiones abiertas");
  await a.reload();
  chequear((await a.locator("[data-sesion]").count()) === 1, "al recargar sigue habiendo una sola", "reaparecieron sesiones");

  // Volver a entrar con la contraseña nueva (y no con la vieja).
  const nueva = await pagina(b, COMPU);
  await entrar(nueva, MAIL, NUEVA);
  await nueva.goto(`${G}/panel/cuenta`);
  await nueva.locator("[data-sesiones]").waitFor({ timeout: 30000 });
  ok("vuelve a entrar con la contraseña nueva");
  const vieja = await pagina(b, COMPU);
  await vieja.goto(`${G}/ingresar`);
  await vieja.fill("input[type=email]", MAIL);
  await vieja.fill("input[type=password]", CLAVE_DEMO);
  await vieja.click("button[type=submit]");
  await vieja.getByText("El mail o la contraseña no son correctos").waitFor({ timeout: 30000 });
  ok("la contraseña vieja ya no entra");

  // Devolver la contraseña de prueba.
  const f2 = nueva.locator("form", { has: nueva.getByLabel("Contraseña nueva") });
  await f2.getByLabel("Contraseña actual").fill(NUEVA);
  await f2.getByLabel("Contraseña nueva").fill(CLAVE_DEMO);
  await f2.getByLabel("Repetir la contraseña").fill(CLAVE_DEMO);
  await f2.getByRole("button", { name: "Guardar" }).click();
  await nueva.getByText("Contraseña cambiada").waitFor({ timeout: 30000 });
  cambiada = false;
  ok("devuelve la contraseña de prueba");
  for (const p of [a, nueva]) if (p.errores.length) falla(`equipo: ${p.errores.join(" | ")}`);

  // ── Celular 390 px: sin desbordes ──
  const c = await pagina(b, CELU);
  await entrar(c, MAIL);
  await c.goto(`${G}/panel/cuenta`);
  await c.locator("[data-sesiones]").waitFor({ timeout: 30000 });
  const desborde = await c.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  chequear(!desborde, "en el celular no se desborda", "en el celular hay scroll horizontal");

  // ── Socio: ve sus sesiones en Mi membresía ──
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid", CLAVE_DEMO, G);
  await s.goto(`${G}/app/cuenta`);
  await s.locator("[data-sesiones]").waitFor({ timeout: 60000 });
  chequear((await s.locator('[data-sesion="actual"]').count()) === 1, "el socio ve sus sesiones, con la actual marcada", "el socio no ve su sesión actual");
  await s.locator("[data-crear-contrasena]").getByLabel("Contraseña actual").waitFor({ timeout: 10000 });
  ok("el socio con contraseña tiene que escribir la actual para cambiarla");
  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  if (cambiada) console.log(`⚠ quedó la contraseña ${NUEVA} en ${MAIL}`);
}
await b.close();
resultado();
