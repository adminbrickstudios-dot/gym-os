#!/usr/bin/env node
// VD-3 · Reingreso: una visita dura N horas. La recepción anota a un socio al día y lo vuelve a
// pasar por la misma vía: dice "ya entró a las …" y no cuenta otra entrada. El dueño ve y cambia
// las horas de la visita y los minutos del aviso de préstamo en Configuración → Entrada.
//   node scripts/e2e/vd-3.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  // Un socio al día (el último de la lista: el que menos usan las otras pruebas).
  await r.goto(`${G}/panel/socios?estado=al_dia`);
  const a = r.locator('main ul a[href^="/panel/socios/"]').last();
  await a.waitFor({ timeout: 30000 });
  const nombre = (await a.locator(".font-semibold").first().innerText()).replace(/#\d+/, "").trim();

  await r.goto(`${G}/panel/entrada`);
  const buscar = r.locator('input[aria-label="Buscar socio"]');
  await buscar.waitFor({ timeout: 30000 });
  const anotar = async () => {
    await buscar.fill(nombre);
    await r.locator("button.fila", { hasText: nombre }).first().waitFor({ timeout: 15000 });
    await buscar.press("Enter");
    await r.locator("[data-veredicto]").waitFor({ timeout: 30000 });
    await r.keyboard.press("Enter");
    await r.locator("[data-hecho]").waitFor({ timeout: 30000 });
  };

  await anotar();
  ok(`primera pasada de ${nombre}: anotada`);
  await buscar.fill("");
  await r.locator("[data-hecho]").evaluate((e) => e.remove()).catch(() => {});   // la tarjeta vieja no confunde a la nueva
  await anotar();
  const dice = await r.locator("[data-hecho]").innerText();
  chequear(/Ya entró (a las \d{2}:\d{2}|hace)/.test(dice), `la segunda pasada dice “${dice.replace(/\s+/g, " ").slice(0, 60)}”`, `no dijo que ya entró: “${dice}”`);
  chequear(await r.locator('[data-hecho] button:has-text("Deshacer")').count() === 0, "el repetido no ofrece Deshacer (no hay entrada nueva que deshacer)", "ofrece Deshacer en un repetido");
  await capturar(r, "vd3-compu-ya-entro");

  // Hoy cuenta al socio una sola vez.
  const filas = await r.locator("[data-hoy] li", { hasText: nombre }).count();
  chequear(filas <= 1, "en “Hoy” aparece una sola vez como máximo", `aparece ${filas} veces`);
  if (r.errores.length) falla(`compu: ${r.errores.join(" | ")}`);
  await r.context().close();

  // El dueño cambia la duración de la visita y el aviso de préstamo.
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/configuracion?pestana=entrada`);
  const horas = d.locator("[data-visita-horas]");
  await horas.waitFor({ timeout: 30000 });
  chequear((await horas.inputValue()) === "5", "una visita dura 5 horas por defecto", `muestra ${await horas.inputValue()}`);
  chequear((await d.locator("[data-antiprestamo-minutos]").inputValue()) === "60", "el aviso de préstamo es de 60 minutos por defecto", "no es 60");
  await horas.fill("4");
  await d.locator("[data-config-visita] button:has-text('Guardar')").click();
  await d.locator("[data-config-visita]").getByText("Guardado.").waitFor({ timeout: 30000 });
  await d.reload();
  await d.locator("[data-visita-horas]").waitFor({ timeout: 30000 });
  chequear((await d.locator("[data-visita-horas]").inputValue()) === "4", "queda guardado: 4 horas", "no se guardó");
  await d.locator("[data-visita-horas]").fill("5");
  await d.locator("[data-config-visita] button:has-text('Guardar')").click();
  await d.locator("[data-config-visita]").getByText("Guardado.").waitFor({ timeout: 30000 });
  ok("vuelve a 5 horas");
  // Control de la puerta abre con la sección de alertas lista para mostrar préstamos.
  await d.goto(`${G}/panel/entrada/control`);
  await d.locator("main").waitFor({ timeout: 30000 });
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
  await d.context().close();

  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/configuracion?pestana=entrada`);
  await c.locator("[data-config-visita]").waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  chequear(ancho <= 0, "celular 390 px: la configuración de la visita no desborda", `desborda ${ancho} px`);
  await capturar(c, "vd3-celu-config");
  await c.context().close();
} finally {
  await b.close();
}
resultado();
