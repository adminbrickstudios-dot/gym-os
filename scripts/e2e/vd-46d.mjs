#!/usr/bin/env node
// VD-46D · Aumento con aviso previo: con 5 días la pantalla frena (el encargado) o pide
// el motivo (la dueña); con 40 días pasa y queda la constancia de a cuántos socios se avisó;
// el celular no desborda. (El aviso en la app del socio lo prueba la base: aumento-aviso.test.mjs.)
//   node scripts/e2e/vd-46d.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const mas = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/planes`);
  const nombre = `Aviso${s5}`;
  await d.locator('button:has-text("Nuevo plan")').click();
  await d.locator('input[name="nombre"]').fill(nombre);
  await d.locator('input[name="precio"]').fill("20.000");
  await d.locator('button:has-text("Crear")').click();
  await d.locator(`li[data-plan="${nombre}"]`).waitFor({ timeout: 30000 });

  await d.goto(`${G}/panel/planes/aumento`);
  await d.locator('input[aria-label="Cuánto aumenta"]').waitFor();
  for (const cb of await d.locator('input[type="checkbox"]').all()) if (await cb.isChecked()) await cb.uncheck();
  await d.locator(`input[aria-label="${nombre}"]`).check();
  await d.locator('input[aria-label="Cuánto aumenta"]').fill("10");
  await d.locator('input[aria-label="Desde"]').fill(mas(5));
  await d.locator('[data-aviso-previo="falta"]').waitFor({ timeout: 30000 });
  const boton = d.locator('button:has-text("Programar aumento")');
  chequear(await boton.isDisabled(), "con 5 días de aviso el botón queda apagado hasta escribir el motivo", "el botón está prendido");
  await d.locator('textarea[aria-label="Motivo para aplicar sin el aviso mínimo"]').fill("corto");
  chequear(await boton.isDisabled(), "un motivo de cinco letras no alcanza", "el botón está prendido");
  await d.locator('button:has-text("Poner el")').click();
  await d.locator('[data-aviso-previo="ok"]').waitFor({ timeout: 30000 });
  ok("“Poner el …” lleva la fecha al mínimo y el aviso pasa a ✅");
  await d.locator('input[aria-label="Desde"]').fill(mas(40));
  await d.locator("[data-vista]").waitFor({ timeout: 30000 });
  await capturar(d, "vd46d-compu-aviso");
  await boton.click();
  await d.locator("[data-aumento-hecho]").waitFor({ timeout: 30000 });
  chequear(await d.locator("[data-constancia]").count() === 1, "programado con 40 días: queda la constancia de los avisados", "no aparece la constancia");
  await d.goto(`${G}/panel/planes/aumento`);
  await d.locator("[data-aumentos-hechos]").waitFor({ timeout: 30000 });
  chequear(/Avisados en la app/.test(await d.locator("[data-aumentos-hechos]").innerText()), "Aumentos anteriores muestra avisados y vistos", await d.locator("[data-aumentos-hechos]").innerText());
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  const c = await pagina(b, CELU);
  await entrar(c, "encargado@ejemplo.invalid");
  await c.goto(`${G}/panel/planes/aumento`);
  await c.locator('input[aria-label="Cuánto aumenta"]').fill("5");
  await c.locator('input[aria-label="Desde"]').fill(mas(3));
  await c.locator('[data-aviso-previo="falta"]').waitFor({ timeout: 30000 });
  chequear(await c.locator('textarea[aria-label="Motivo para aplicar sin el aviso mínimo"]').count() === 0, "el encargado no tiene cómo saltear el aviso", "ve el campo del motivo");
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  await capturar(c, "vd46d-celu-aviso");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
