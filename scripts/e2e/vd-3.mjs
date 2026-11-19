#!/usr/bin/env node
// VD-3 · Reingreso: una visita dura N horas. La recepción anota a un socio al día y lo vuelve a
// pasar por la misma vía: dice "ya entró a las …" y no cuenta otra entrada. El dueño ve y cambia
// las horas de la visita y los minutos del aviso de préstamo en Configuración → Entrada.
//   node scripts/e2e/vd-3.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
// F1.9: un error que nadie atrapó deja de colgar el recorrido sin ✗: se escribe qué esperaba y cuándo, y se corta con código 1.
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const G = GIMNASIO();
const b = await navegador();
try {
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  // Un socio al día (el último de la lista: el que menos usan las otras pruebas).
  await r.goto(`${G}/panel/socios?estado=al_dia`);
  // Otros recorridos de la misma tanda también anotan a "el último": si ya entró hoy, la primera pasada diría "ya entró" y no habría tarjeta de hecho.
  // En vez de apostar a uno, se prueba desde el último hacia atrás hasta encontrar un socio que todavía no entró hoy (se espera una condición, no un tiempo).
  const links = r.locator('main ul a[href^="/panel/socios/"]');
  await links.first().waitFor({ timeout: 30000 });
  const total = Math.max(1, Math.min(6, await links.count()));
  // La lista puede repintarse mientras se lee: se vuelve a pedir la fila (por su lugar desde el final) hasta que tenga nombre.
  const nombreDe = async (i) => {
    for (let intento = 1; ; intento++) {
      try {
        const fila = links.nth(-i);
        const bold = fila.locator(".font-semibold").first();
        // El nombre va en negrita; si la fila no la trae (otra fila de la lista), se toma el primer renglón de su texto.
        const texto = (await bold.count()) ? await bold.innerText({ timeout: 10000 }) : (await fila.innerText({ timeout: 10000 })).split("\n")[0];
        return texto.replace(/#\d+/, "").trim();
      }
      catch (e) { if (intento >= 3) throw e; await r.waitForTimeout(500); }
    }
  };
  // Los candidatos se leen ahora, con la lista a la vista: después se navega a la Entrada y la lista ya no está.
  const candidatos = []; for (let i = 1; i <= total; i++) candidatos.push(await nombreDe(i));
  let nombre = candidatos[0];

  await r.goto(`${G}/panel/entrada`);
  const buscar = r.locator('input[aria-label="Buscar socio"]');
  await buscar.waitFor({ timeout: 30000 });
  const anotar = async (espera = 30000) => {
    await buscar.fill(nombre);
    await r.locator("button.fila", { hasText: nombre }).first().waitFor({ timeout: 15000 });
    await buscar.press("Enter");
    await r.locator("[data-veredicto]").waitFor({ timeout: 30000 });
    await r.keyboard.press("Enter");
    await r.locator("[data-hecho]").waitFor({ timeout: espera });
  };
  let encontrado = false;
  for (let i = 1; i <= total && !encontrado; i++) {
    nombre = candidatos[i - 1];
    try { await anotar(i === total ? 30000 : 8000); encontrado = true; }
    catch { await r.goto(`${G}/panel/entrada`); await buscar.waitFor({ timeout: 30000 }); }
  }
  if (!encontrado) throw new Error("ninguno de los últimos socios al día pudo anotarse hoy");
  ok(`primera pasada de ${nombre}: anotada`);
  await buscar.fill("");
  // (Antes se borraba la tarjeta vieja del DOM a mano: React la maneja y el borrado lo dejaba colgado. Ahora se espera a la tarjeta nueva por su texto.)
  await anotar();
  await r.locator("[data-hecho]", { hasText: /Ya entró/ }).first().waitFor({ timeout: 20000 }).catch(() => {});
  const dice = await r.locator("[data-hecho]").first().innerText();
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
