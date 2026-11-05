#!/usr/bin/env node
// REV-4 · Segunda pasada: un día como profe, en el celular, contra la tabla
// "Profe" de 10-DIA-A-DIA-Y-CASOS-RAROS.md: ve sus clases, abre una, carga el
// WOD, suma a alguien que vino sin reservar y lo marca presente (y lo
// deshace con motivo), mira las rutinas; no ve lo que no le toca.
//   npm run e2e:rev-4            (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const s = Date.now().toString().slice(-5);
const falta = (m) => console.log(`ℹ️ falta: ${m}`);
const b = await navegador();
const p = await pagina(b, CELU);
p.setDefaultNavigationTimeout(120000);
const ancho = async (que) => {
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  if (w > CELU.width + 1) falla(`${que}: se desborda a lo ancho (${w}px)`);
};
try {
  await entrar(p, "profe@ejemplo.invalid");
  await p.locator("h1").first().waitFor({ timeout: 60000 });
  ok(`el profe entra: “${(await p.locator("h1").first().innerText()).trim()}”`);
  await ancho("Inicio del profe");

  // Llega y no sabe quién viene: abre una clase.
  await p.goto(`${G}/panel/clases`);
  await p.locator("main h1").waitFor({ timeout: 60000 });
  // Las clases de otros profes se ven pero no se abren (la base no le deja ver su lista).
  const ajenas = await p.locator("[data-clase-ajena]").count();
  const linksA = await p.locator('main ul a[href^="/panel/clases/"]').count();
  ok(`ve la grilla del día: ${linksA} clases suyas para abrir, ${ajenas} de otros profes que no se abren`);
  // Busca un día con una clase suya (hoy o los próximos).
  const dias = await p.locator('nav[aria-label="Día"] a').evaluateAll((xs) => xs.map((x) => x.getAttribute("href")));
  let clase = null;
  for (const d of dias) {
    await p.goto(`${G}${d}`);
    await p.locator("main h1").waitFor({ timeout: 60000 });
    const l = p.locator('main ul a[href^="/panel/clases/"]').first();
    if (await aparece(l, 3000)) { clase = l; break; }
  }
  if (!clase) throw new Error("el profe no tiene clases suyas esta semana en el demo");
  await clase.click();
  await p.waitForURL(/\/panel\/clases\/[0-9a-f-]{36}/, { timeout: 60000 });
  await p.locator("main h1").waitFor({ timeout: 60000 });
  ok("abre su clase: la lista de anotados");
  if (!(await p.locator("main ul img").count())) falta("lista de anotados con foto: la lista de la clase muestra nombres, no fotos");
  await ancho("Lista de la clase");

  // Carga el WOD.
  const wod = p.locator("[data-wod]");
  if (await aparece(wod, 10000)) {
    await wod.locator("textarea").fill(`Rev4 ${s}: 5 rondas de 10 burpees`);
    await wod.locator('button:has-text("Guardar WOD")').click();
    chequear(await aparece(wod.getByText("Guardado"), 30000), "carga el WOD en un toque: “lo ven los anotados en la app”", "el WOD no se guardó");
  } else ok("este gimnasio no usa WOD en la clase");

  // Viene alguien sin reserva: lo suma y lo marca presente; después lo deshace con motivo.
  const buscar = p.locator('input[aria-label="Buscar socio para la clase"]');
  if (await aparece(buscar, 10000)) {
    await buscar.fill("Testigo Al");
    const fila = p.locator("li", { hasText: /Testigo Al D[ií]a/ }).filter({ has: p.locator('button:has-text("Presente")') }).first();
    if (await aparece(fila, 30000)) {
      await fila.locator('button:has-text("Presente")').last().click();
      const deshacer = p.getByRole("button", { name: /Deshacer el presente de Testigo Al D[ií]a/ });
      const r = await Promise.race([
        deshacer.waitFor({ timeout: 30000 }).then(() => "ok"),
        p.locator('main [role="alert"]').first().waitFor({ timeout: 30000 }).then(async () => await p.locator('main [role="alert"]').first().innerText()),
      ]);
      if (r === "ok") {
        ok("vino sin reservar: lo suma a la clase y queda ✅ Presente");
        await deshacer.click();
        await p.locator('input[aria-label^="Por qué se deshace el presente"]').fill("Prueba de la segunda pasada");
        await p.locator('button[type="submit"]:has-text("Deshacer")').click();
        chequear(await aparece(p.getByRole("button", { name: /Deshacer el presente de Testigo Al D[ií]a/ }), 3000) === false, "y lo deshace con motivo (se equivocó de persona)", "no se deshizo el presente");
      } else chequear(/cupo|no puede|fuera/i.test(r), `sumarlo: la base dice por qué no (“${r}”)`, `al sumarlo: ${r}`);
    } else ok("la búsqueda no trae a Testigo Al Día (ya está en la clase)");
  } else falta("sumar a alguien a la clase: la lista no ofrece buscar socios");

  // Rutinas.
  await p.goto(`${G}/panel/rutinas`);
  await p.locator("main h1").waitFor({ timeout: 60000 });
  chequear(!(await aparece(p.getByText(/No tenés acceso/), 2000)), "abre Rutinas (las arma y las asigna)", "el profe no abre Rutinas");
  await ancho("Rutinas");

  // Lo que no le toca.
  await p.goto(`${G}/panel/caja`);
  chequear(await aparece(p.getByText(/No tenés acceso|Tu rol no tiene acceso|no tiene acceso/i), 30000), "Caja: “no tenés acceso” (no una pantalla vacía)", "el profe ve la Caja");
  ok("da clase en dos gimnasios: elige al entrar (/elegir, lo prueba e2e:acceso)");
  await capturar(p, "rev4-celu-profe");
  if (p.errores.length) falla(`profe: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
  await capturar(p, "ROTA-rev4", true).catch(() => {});
}
await b.close();
resultado();
