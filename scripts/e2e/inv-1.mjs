#!/usr/bin/env node
// INV-1 · Invitados: la recepción anota un invitado (nombre, DNI y el socio
// que lo invita) y pasa; sin DNI no; un socio no puede ser "invitado"; el
// socio invita desde su app y la recepción confirma; la dueña lo ve en Inicio.
//   npm run e2e:inv-1            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const dni = (n) => `3${n}${s5}${n}`.slice(0, 8);
async function limite(d, n) {
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 }); await d.waitForTimeout(500);
  await d.locator("fieldset[data-pestana-activa] label", { hasText: "Invitados por socio por mes" }).locator("input").fill(String(n));
  const pie = d.locator('[data-pie="reglas"]'); const k = Number(await pie.getAttribute("data-respuestas"));
  if (await pie.locator('button:has-text("Guardar")').isDisabled()) return;   // ya estaba así
  await pie.locator('button:has-text("Guardar")').click();
  await d.waitForFunction((k) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > k, k, { timeout: 30000 });
}
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await limite(d, 10);                                   // la base usada todo el día ya puede tener invitados
  ok("la dueña sube el límite de invitados (para la prueba)");

  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/entrada`);
  const form = r.locator("[data-form-invitado]");
  await r.locator('button:has-text("➕ Invitado")').click();
  await form.locator('input[aria-label="Nombre del invitado"]').fill(`Pedro Amigo${s5}`);
  await form.locator('input[aria-label="Socio que invita"]').fill("Testigo Al Día");
  await form.locator("button.fila", { hasText: "Testigo Al Día" }).first().click();
  chequear(await form.locator('input[aria-label="DNI del invitado"]').getAttribute("required") !== null, "el DNI es obligatorio (nunca anónimo; la base también lo exige)", "el DNI no es obligatorio");
  await form.locator('input[aria-label="DNI del invitado"]').fill(dni(1));
  await form.locator('button:has-text("Anotar y que pase")').click();
  await r.locator('[data-invitado="entro"]', { hasText: `Pedro Amigo${s5}` }).waitFor({ timeout: 30000 });
  ok("con nombre, DNI y quién lo invita, pasa");
  await capturar(r, "inv1-compu-entrada");

  // El socio invita desde la app
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  await s.locator('button:has-text("Invitar a alguien hoy")').click();
  await s.locator('input[aria-label="Nombre de tu invitado"]').fill(`Laura Amiga${s5}`);
  await s.locator('input[aria-label="DNI de tu invitado"]').fill(dni(2));
  await s.locator('button:has-text("Invitar para hoy")').click();
  await s.getByText(`Laura Amiga${s5}: que diga tu nombre en recepción`).waitFor({ timeout: 30000 });
  ok("el socio invita desde la app");
  await capturar(s, "inv1-celu-app");
  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);

  await r.reload();
  const laura = r.locator('[data-invitado="espera"]', { hasText: `Laura Amiga${s5}` });
  await laura.waitFor({ timeout: 30000 });
  await laura.locator('button:has-text("Entró")').click();
  await r.locator('[data-invitado="entro"]', { hasText: `Laura Amiga${s5}` }).waitFor({ timeout: 30000 });
  ok("la recepción lo ve esperando y confirma que entró");
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);

  await d.goto(`${G}/panel`);
  const hoy = d.locator("[data-invitados-hoy]");
  await hoy.waitFor({ timeout: 30000 });
  chequear(new RegExp(`Pedro Amigo${s5}`).test(await hoy.innerText()) && new RegExp(`Laura Amiga${s5}`).test(await hoy.innerText()), "la dueña ve los invitados de hoy en Inicio", `Inicio: ${(await hoy.innerText()).slice(0, 100)}`);
  await limite(d, 2);
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
