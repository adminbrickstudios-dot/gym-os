#!/usr/bin/env node
// SOC-8 · Duplicados: dos fichas con el mismo celular aparecen como posible
// duplicado; el encargado las ve pero no une; la dueña elige con cuál se
// queda, confirma y la otra desaparece (lo suyo pasa a la que queda).
//   npm run e2e:soc-8            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s = Date.now().toString().slice(-6);
const TEL = `000 ${s}9`;
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  const alta = async (nombre) => {
    await d.goto(`${G}/panel/socios/nuevo`);
    await d.locator('input[name="nombre"]').fill(nombre);
    await d.locator('input[name="apellido"]').fill(`Repetido${s}`);
    await d.locator('input[name="telefono"]').fill(TEL);
    await d.locator('button:has-text("Dar de alta")').click();
    await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}/, { timeout: 60000 });
    return d.url();
  };
  const ficha1 = await alta("Julián");
  const ficha2 = await alta("Julian");
  ok("dos fichas cargadas con el mismo celular");
  // Una nota en la segunda: tiene que pasar a la primera.
  await d.goto(`${ficha2}?pestana=notas`);
  await d.locator("textarea").fill(`nota ${s}`);
  await d.locator('button:has-text("Guardar nota")').click();
  await d.locator("[data-nota]", { hasText: `nota ${s}` }).waitFor({ timeout: 30000 });

  // Encargado: ve, no une
  const e = await pagina(b, COMPU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel/socios/duplicados`);
  const parE = e.locator("[data-par]", { hasText: `Repetido${s}` });
  await parE.waitFor({ timeout: 30000 });
  chequear(await parE.locator('button:has-text("Quedarse con")').count() === 0, "encargado: ve el par pero no puede unir", "encargado puede unir");
  await e.context().close();

  // Dueña: une
  await d.goto(`${G}/panel/socios`);
  await d.locator('main a:visible:has-text("Duplicados")').click();
  const par = d.locator("[data-par]", { hasText: `Repetido${s}` });
  await par.waitFor({ timeout: 30000 });
  chequear(/Mismo celular/.test(await par.innerText()), "aparece como “Mismo celular”", "no aparece el par");
  await par.locator('button:has-text("Quedarse con")').first().click();
  const conf = par.locator("[data-confirmar]");
  chequear(/No se puede deshacer/.test(await conf.innerText()), "pide confirmar y avisa que no se deshace", "no avisa");
  await conf.locator('button:has-text("Unir en")').click();
  await d.locator(".mensaje", { hasText: "quedó unido" }).waitFor({ timeout: 30000 });
  ok(`dueña: ${(await d.locator(".mensaje", { hasText: "quedó unido" }).innerText()).replace(/\s+/g, " ")}`);
  await d.reload();
  chequear(await d.locator("[data-par]", { hasText: `Repetido${s}` }).count() === 0, "el par ya no aparece", "el par sigue");
  await d.goto(`${ficha1}?pestana=notas`);
  const quedaNota = await d.locator("[data-nota]", { hasText: `nota ${s}` }).count();
  await d.goto(ficha2);
  const borrada = /No se pudo|inexistente|Sin permiso/i.test(await d.locator("main").innerText());
  chequear(quedaNota === 1 && borrada, "la nota pasó a la que queda y la otra ficha ya no existe", `nota: ${quedaNota}, borrada: ${borrada}`);
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
  await d.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
