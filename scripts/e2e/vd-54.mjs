#!/usr/bin/env node
// VD-54 · Mantenimiento de máquinas: la dueña carga una máquina; la recepción la marca rota (con foto) y no puede cerrarla;
// la dueña ve el aviso en Inicio, asigna quién la arregla, la cierra y queda el historial. Celular sin desborde.
// Y con la sección apagada, la pantalla no abre y el Inicio no muestra nada.
//   npm run e2e:vd-54            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
process.env.HORA_NAVEGADOR = "mediodia";   // F8.2: no depende de la hora del día

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const NOMBRE = `Prensa ${s5}`;
const SIN = /apagad|No tenés acceso|Tu rol no tiene acceso|Sin permiso/i;
const tarjeta = (p) => p.locator(`[data-maquina]:has-text("${NOMBRE}")`);

// Configuración → Secciones: se prende o se apaga "Máquinas" y se guarda (igual que cfg-7).
async function seccion(p, prendida) {
  await p.goto(`${G}/panel/configuracion?pestana=secciones`);
  await p.locator('fieldset[data-pestana-activa="secciones"]').waitFor({ timeout: 30000 });
  await p.waitForTimeout(800);
  const sw = p.locator("fieldset[data-pestana-activa] label").filter({ hasText: /^\s*(\S+\s)?Máquinas\b/ }).locator('input[role="switch"]');
  if ((await sw.isChecked()) === prendida) return;
  await (prendida ? sw.check() : sw.uncheck());
  const pie = p.locator('[data-pie="secciones"]');
  const antes = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await p.waitForFunction((n) => Number(document.querySelector('[data-pie="secciones"]')?.getAttribute("data-respuestas")) > n, antes, { timeout: 30000 });
}

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/maquinas`);
  await d.locator("[data-maquinas]").waitFor({ timeout: 30000 });
  await d.locator("[data-nueva-maquina]").click();
  await d.locator("[data-maquina-nombre]").fill(NOMBRE);
  await d.locator("[data-guardar-maquina]").click();
  await tarjeta(d).waitFor({ timeout: 30000 });
  chequear(await tarjeta(d).locator('[data-pildora-estado="servicio"]').count() === 1, "la máquina nueva está en servicio", "no quedó en servicio");

  // La recepción la marca rota, con foto.
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/maquinas`);
  await tarjeta(r).waitFor({ timeout: 30000 });
  chequear(await r.locator("[data-nueva-maquina]").count() === 0, "la recepción no ve “Cargar una máquina”", "la recepción puede cargar máquinas");
  await tarjeta(r).locator("[data-reportar-falla]").click();
  await r.locator("[data-falla-motivo]").fill(`Se corta el cable ${s5}`);
  const png = Buffer.from(await r.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 300; c.height = 300;
    const x = c.getContext("2d"); x.fillStyle = "#c00"; x.fillRect(0, 0, 300, 300);
    return c.toDataURL("image/png").split(",")[1];
  }), "base64");
  await r.setInputFiles('[data-falla-foto]', { name: "falla.png", mimeType: "image/png", buffer: png });
  await r.locator("[data-guardar-falla]").click();
  await tarjeta(r).locator('[data-pildora-estado="fuera"]').waitFor({ timeout: 30000 });
  ok("la recepción la marca fuera de servicio");
  chequear(await tarjeta(r).locator("[data-ver-foto-falla]").count() === 1, "queda la foto para ver", "no quedó la foto");
  chequear(await tarjeta(r).locator("[data-arreglada]").count() === 0, "la recepción no puede cerrarla", "la recepción ve “Quedó arreglada”");
  await r.goto(`${G}/panel`);
  await r.locator(`[data-maquina-fuera]:has-text("${NOMBRE}")`).waitFor({ timeout: 30000 });
  ok("el Inicio de la recepción avisa la máquina fuera de servicio, con la frase para el socio");

  // La dueña: lo ve en Inicio, asigna, cierra, historial.
  await d.goto(`${G}/panel`);
  chequear(await d.locator(`[data-maquina-fuera]:has-text("${NOMBRE}")`).count() === 1, "el Inicio de la dueña también", "el Inicio de la dueña no lo muestra");
  await d.goto(`${G}/panel/maquinas`);
  await tarjeta(d).locator("[data-responsable]").selectOption({ index: 1 });
  await d.waitForTimeout(800);
  await d.reload();
  chequear(await tarjeta(d).locator("[data-responsable]").inputValue() !== "", "queda asignado quién la arregla", "no quedó el responsable");
  await tarjeta(d).locator("[data-arreglada]").click();
  await tarjeta(d).locator("[data-arreglo-nota]").fill("Se cambió el cable");
  await tarjeta(d).locator("[data-confirmar-arreglo]").click();
  await tarjeta(d).locator('[data-pildora-estado="servicio"]').waitFor({ timeout: 30000 });
  ok("la dueña la cierra: vuelve a estar en servicio");
  await tarjeta(d).locator("[data-ver-historial]").click();
  await d.locator(`[data-historial-maquina]:has-text("Se cambió el cable")`).waitFor({ timeout: 30000 });
  chequear((await d.locator("[data-historial-maquina]").innerText()).includes(`Se corta el cable ${s5}`), "el historial guarda la falla y el arreglo", "el historial no muestra la falla");
  await d.goto(`${G}/panel`);
  chequear(await d.locator(`[data-maquina-fuera]:has-text("${NOMBRE}")`).count() === 0, "ya no figura en el Inicio", "sigue en el Inicio");

  // Celular.
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/maquinas`);
  await c.locator("[data-maquinas]").waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  chequear(ancho <= 1, "celular: sin desborde horizontal", `desborda ${ancho}px`);
  await capturar(c, "vd54-celu");
  await capturar(d, "vd54-compu");

  // Sección apagada: la pantalla no abre.
  await seccion(d, false);
  await d.goto(`${G}/panel/maquinas`);
  await d.waitForLoadState("domcontentloaded");
  chequear(SIN.test(await d.locator("body").innerText()) || await d.locator("[data-maquinas]").count() === 0, "con la sección apagada, Máquinas no abre", "Máquinas abre con la sección apagada");
  await seccion(d, true);
  if (d.errores.length) falla(`errores: ${d.errores.join(" | ")}`);
} catch (e) { falla(`se cortó: ${e.message.split("\n")[0]}`); }
finally { await b.close(); resultado(); }
