#!/usr/bin/env node
// F9.2 + F9.3 · La dueña cambia el color principal, lo restaura desde Cambios ("Restaurar el valor anterior") y ve el aviso;
// después escribe los términos y condiciones, los publica y un visitante los lee en /terminos; al despublicar dejan de existir.
//   npm run e2e:f9-1            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const TEXTO = "Términos de prueba de F9: la cuota se paga por adelantado, las bajas se piden en la recepción y se respeta a los demás socios.";
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");

  // ── Restaurar un cambio ──
  const leerAcento = async () => {
    await p.goto(`${G}/panel/configuracion?pestana=marca`);
    await p.locator('[data-pie="marca"]').waitFor({ timeout: 30000 });
    return p.locator('[aria-label="Otro color"]').inputValue();
  };
  const original = (await leerAcento()).toLowerCase();
  const nuevo = original === "#f5c518" ? "#2fbf5b" : "#f5c518";
  await p.locator('[aria-label="Otro color"]').fill(nuevo);
  const pie = p.locator('[data-pie="marca"]');
  const n = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await p.waitForFunction((n) => Number(document.querySelector('[data-pie="marca"]')?.getAttribute("data-respuestas")) > n, n, { timeout: 30000 });
  chequear((await leerAcento()).toLowerCase() === nuevo, `la dueña cambió el color principal a ${nuevo}`, "el color no se guardó");

  await p.goto(`${G}/panel/configuracion?pestana=cambios`);
  const boton = p.locator('[data-restaurar="color_acento"]').first();
  await boton.waitFor({ timeout: 30000 }).catch(() => falla("Cambios no ofrece “Restaurar el valor anterior” en el último cambio de color (¿la función está apagada en el demo?)"));
  chequear(/Restaurar el valor anterior/.test(await boton.innerText()), "el último cambio de color ofrece “Restaurar el valor anterior”", "el botón no dice lo que corresponde");
  await boton.click();
  await p.locator(".mensaje", { hasText: "volvió a" }).first().waitFor({ timeout: 30000 }).catch(() => falla("no apareció el aviso de que el valor volvió"));
  chequear(true, "aviso: “Listo: … volvió a …”", "");
  chequear((await leerAcento()).toLowerCase() === original, `el color volvió a ${original}`, "el color no volvió al original");

  // ── Términos ──
  await p.goto(`${G}/panel/datos-personales`);
  const caja = p.locator("[data-terminos-panel]");
  await caja.waitFor({ timeout: 30000 });
  await caja.locator("textarea").fill(TEXTO);
  const publicar = caja.locator('input[type="checkbox"]');
  if (!(await publicar.isChecked())) await publicar.check();
  await caja.locator('button:has-text("Guardar")').click();
  await caja.locator(".mensaje", { hasText: "publicados" }).waitFor({ timeout: 30000 }).catch(() => falla("no avisó que los términos quedaron publicados"));
  const v = await pagina(b, COMPU);
  await v.goto(`${G}/terminos`);
  await v.locator("[data-terminos]").waitFor({ timeout: 30000 }).catch(() => falla("un visitante no ve /terminos después de publicarlos"));
  chequear((await v.locator("[data-terminos]").innerText()).includes("las bajas se piden en la recepción"), "el visitante lee los términos publicados en /terminos", "no está el texto");

  await publicar.uncheck();
  await caja.locator('button:has-text("Guardar")').click();
  await caja.locator(".mensaje", { hasText: "sin publicar" }).waitFor({ timeout: 30000 });
  await v.goto(`${G}/terminos`);
  chequear((await v.locator("body").innerText()).length > 0 && (await v.locator("[data-terminos]").count()) === 0, "sin publicar, /terminos no muestra los términos", "sigue mostrando los términos");
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(e.message);
} finally {
  await b.close();
}
resultado();
