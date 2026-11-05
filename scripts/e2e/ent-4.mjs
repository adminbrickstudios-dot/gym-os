#!/usr/bin/env node
// ENT-4 · Dejar pasar (D1): la recepción elige un motivo frecuente, ve
// cuántos le quedan y no pasa del tope que pone la dueña; a un suspendido no
// lo puede dejar pasar; la dueña ve en Inicio a quién dejaron pasar y por qué.
//   npm run e2e:ent-4            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
async function tope(d, n) {
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 60000 }); await d.waitForTimeout(500);
  const campo = d.locator("fieldset[data-pestana-activa] label", { hasText: "Dejar pasar: tope" }).locator("input");
  await campo.fill(String(n));
  const pie = d.locator('[data-pie="reglas"]'); const k = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await d.waitForFunction((k) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > k, k, { timeout: 30000 });
}
async function abrirDejarPasar(r, nombre) {
  await r.goto(`${G}/panel/entrada`);
  await r.locator('input[aria-label="Buscar socio"]').fill(nombre);
  await r.locator("button.fila", { hasText: nombre }).first().click();
  await r.locator("[data-veredicto]").waitFor({ timeout: 30000 });
}
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await tope(d, 50);
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await abrirDejarPasar(r, "Testigo Sin Pago");
  await r.locator('[data-veredicto] button:has-text("Dejar pasar igual")').click();
  const cupo = r.locator("[data-cupo]");
  await cupo.waitFor({ timeout: 15000 });
  const usados = 50 - Number(await cupo.getAttribute("data-cupo"));
  await tope(d, usados + 1);                                          // le queda uno
  ok(`la dueña pone el tope en ${usados + 1} (Ana ya dejó pasar a ${usados} hoy)`);

  await abrirDejarPasar(r, "Testigo Sin Pago");
  await r.locator('[data-veredicto] button:has-text("Dejar pasar igual")').click();
  await r.locator('[data-cupo="1"]').waitFor({ timeout: 15000 });
  chequear(/Te queda 1 de/.test(await r.locator("[data-cupo]").innerText()), "dice cuántos le quedan hoy", "no dice cuántos quedan");
  await r.locator('[data-dejar-pasar] button:has-text("Paga mañana")').click();
  chequear(await r.locator('input[aria-label="Motivo para dejar pasar"]').inputValue() === "Paga mañana", "un toque elige un motivo frecuente", "el motivo no se completó");
  await capturar(r, "ent4-compu-dejar-pasar");
  await r.locator('[data-dejar-pasar] button.boton-peligro').click();
  await r.locator('[data-hecho="forzado"]').waitFor({ timeout: 30000 });
  ok("deja pasar con el motivo");

  await abrirDejarPasar(r, "Testigo Vencida");
  await r.locator('[data-veredicto] button:has-text("Dejar pasar igual")').click();
  await r.locator('[data-cupo="0"]').waitFor({ timeout: 15000 });
  chequear(await r.locator('[data-dejar-pasar] button.boton-peligro').isDisabled(), "llegó al tope: el botón se apaga y dice que lo autorice el dueño", "deja pasar sobre el tope");
  await r.keyboard.press("Escape");

  await abrirDejarPasar(r, "Testigo Suspendido");
  chequear(await r.locator('[data-veredicto] button:has-text("Dejar pasar igual")').count() === 0 && /lo deja pasar el dueño o el encargado/.test(await r.locator("[data-veredicto]").innerText()),
    "a un suspendido la recepción no lo puede dejar pasar", "la recepción puede dejar pasar a un suspendido");
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);

  await d.goto(`${G}/panel`);
  const lista = d.locator("[data-dejados-pasar]");
  await lista.waitFor({ timeout: 30000 });
  chequear(/Testigo Sin Pago[\s\S]*Ana: “Paga mañana”/.test(await lista.innerText()), "la dueña ve en Inicio a quién dejaron pasar, quién y por qué", `Inicio dice: ${(await lista.innerText()).slice(0, 120)}`);
  await tope(d, 5);
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
