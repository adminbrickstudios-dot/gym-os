#!/usr/bin/env node
// Recorrido del super admin y de las claves, con sesiones reales:
// crear gimnasio con dueño → entrar como soporte → contraseña nueva → sumar y
// dar acceso → direcciones → el dueño entra y maneja su equipo → página del
// demo por /g/demo → el socio entra a la app desde la plataforma.
//   npm run e2e:admin             (con scripts/local/levantar.sh corriendo)
import { PLATAFORMA as B, capturar, chequear, entrar, entrarSocio, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const b = await navegador();
const p = await pagina(b);
const fila = (texto) => p.locator("li", { hasText: texto });
const clave = async (texto) => (await fila(texto).locator("strong.numero").innerText()).trim();
try {
  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  chequear(p.url().endsWith("/admin"), "el admin entra al super admin", `el admin cayó en ${p.url()}`);
  ok(`estado de la plataforma: ${await p.locator("details summary").first().innerText()}`);

  const s = Date.now().toString().slice(-5);
  await p.fill("input[name=nombre]", `Olympo ${s}`);
  await p.fill("input[name=dueno]", "Dueño Olympo");
  await p.fill("input[name=email]", `olympo${s}@ejemplo.invalid`);
  await p.click('button:has-text("Crear gimnasio")');
  await p.locator("strong.numero").first().waitFor({ timeout: 30000 });
  const clave1 = (await p.locator("strong.numero").first().innerText()).trim();
  ok(`gimnasio creado, contraseña provisoria ${clave1}`);
  await capturar(p, "admin-creado", true);

  await p.click('button:has-text("Entrar al panel")');
  await p.waitForURL(/\/panel/, { timeout: 60000 });
  const saludo = await p.locator("h1").first().innerText();
  chequear(/Soporte BRIK/.test(saludo), `panel del gimnasio nuevo: "${saludo}"`, `no saluda a Soporte BRIK: ${saludo}`);

  await p.goto(`${B}/admin`);
  await fila(`Olympo ${s}`).locator('a:has-text("Equipo, claves")').click();
  await p.waitForURL(/\/admin\/[0-9a-f-]{36}/);
  await fila("Dueño Olympo").locator('button:has-text("Nueva contraseña")').click();
  await fila("Dueño Olympo").locator("strong.numero").waitFor({ timeout: 30000 });
  const clave2 = await clave("Dueño Olympo");
  chequear(clave2 !== clave1, `contraseña nueva del dueño: ${clave2}`, "la contraseña nueva es igual a la vieja");

  const form = 'form:has-text("Sumar a alguien")';
  await p.fill(`${form} input[name=nombre]`, "Recepción Prueba");
  await p.selectOption(`${form} select[name=rol]`, "recepcion");
  await p.click(`${form} button:has-text("Sumar")`);
  await fila("Recepción Prueba").waitFor({ timeout: 30000 });
  await fila("Recepción Prueba").locator('button:has-text("Dar acceso")').click();
  await fila("Recepción Prueba").locator("input[name=email]").fill(`recep${s}@ejemplo.invalid`);
  await fila("Recepción Prueba").locator('button:has-text("Dar acceso")').click();
  await fila("Recepción Prueba").locator("strong.numero").waitFor({ timeout: 30000 });
  ok(`acceso para recepción: ${await clave("Recepción Prueba")}`);

  await p.fill("input[name=host]", `https://olympo-${s}.vercel.app/`);
  await p.click('form:has-text("Sumar una dirección") button:has-text("Sumar")');
  await fila(`olympo-${s}.vercel.app`).waitFor({ timeout: 30000 });
  ok("dirección propia sumada, limpia");
  await capturar(p, "admin-detalle", true);
  await fila(`olympo-${s}.vercel.app`).locator('button:has-text("Quitar")').click();
  await fila(`olympo-${s}.vercel.app`).waitFor({ state: "detached", timeout: 30000 });
  ok("dirección propia quitada");

  await p.context().clearCookies();
  await p.goto(`${B}/ingresar`);
  await p.fill("input[type=email]", `olympo${s}@ejemplo.invalid`);
  await p.fill("input[type=password]", clave1);
  await p.click("button[type=submit]");
  await p.locator("p[role=alert]", { hasText: "no son correctos" }).waitFor({ timeout: 30000 });
  ok("la contraseña vieja ya no sirve");
  await entrar(p, `olympo${s}@ejemplo.invalid`, clave2, B);
  await p.waitForURL(/\/panel/, { timeout: 60000 });
  ok(`el dueño entra a su panel: "${await p.locator("h1").first().innerText()}"`);
  await p.goto(`${B}/panel/equipo`);
  chequear((await fila("Soporte BRIK").count()), "el dueño ve a Soporte BRIK en su equipo", "el dueño no ve a Soporte BRIK");
  await fila("Recepción Prueba").locator('button:has-text("Nueva contraseña")').click();
  await fila("Recepción Prueba").locator("strong.numero").waitFor({ timeout: 30000 });
  ok("el dueño le genera contraseña nueva a su recepción");
  chequear(!(await fila("Soporte BRIK").locator('button:has-text("Nueva contraseña")').count()),
    "sin botón de contraseña para Soporte BRIK", "el dueño puede cambiarle la contraseña a Soporte BRIK");

  await p.context().clearCookies();
  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  await fila("Gimnasio Demo").locator('button:has-text("Entrar al panel")').click();
  await p.waitForURL(/\/panel/, { timeout: 60000 });
  ok(`admin dentro del demo: "${await p.locator("h1").first().innerText()}"`);

  await p.context().clearCookies();
  await p.goto(`${B}/g/demo`);
  await p.locator('a:has-text("Soy socio")').first().waitFor({ timeout: 30000 });
  ok("página del demo desde la plataforma, con “Soy socio”");
  await entrarSocio(p, "+5490000100002", B);
  ok("el socio entra a la app desde la plataforma");
  const r = await p.goto(`${B}/g/no-existe-xyz`);
  chequear(r.status() === 404, "/g/no-existe → 404", `/g/no-existe dio ${r.status()}`);
  if (p.errores.length) falla(`errores en la página: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${e.message.split("\n")[0]}`);
  await capturar(p, "ROTA-admin", true).catch(() => {});
}
await b.close();
resultado();
