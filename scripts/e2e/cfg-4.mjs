#!/usr/bin/env node
// CFG-4 · Horarios del gimnasio, feriados y cierres, con sesión real.
// Un feriado cancela las clases de ese día y se ve en la app y la página;
// anularlo las devuelve.
//   npm run e2e:cfg-4            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, entrarSocio, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const ZONA = "America/Argentina/Buenos_Aires";
// El próximo día con clases (lunes a sábado), en la fecha del gimnasio.
function proximoDiaConClases() {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(Date.now() + i * 86400000);
    const dia = new Intl.DateTimeFormat("en-US", { timeZone: ZONA, weekday: "short" }).format(d);
    if (dia !== "Sun") return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(d);
  }
}
const FECHA = proximoDiaConClases();
const MOTIVO = "Feriado de prueba";

const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  await p.goto(`${G}/panel/configuracion?pestana=horarios`);
  const horarios = p.locator("[data-horarios]");
  await p.locator('[data-horarios][data-listo="true"]').waitFor({ timeout: 30000 });   // React ya tomó la pantalla
  const pieH = p.locator('[data-pie="horarios"]');
  const guardarH = async () => {
    // Si ya estaba guardado así (una corrida anterior), no hay nada que guardar.
    if (await pieH.locator('button:has-text("Guardar")').isDisabled()) return "sin cambios: ya estaba guardado";
    const antes = Number(await pieH.getAttribute("data-respuestas"));
    await pieH.locator('button:has-text("Guardar")').click();
    await p.waitForFunction((n) => Number(document.querySelector('[data-pie="horarios"]')?.getAttribute("data-respuestas")) > n, antes, { timeout: 30000 });
    return (await pieH.locator(".mensaje").first().innerText()).replace(/\s+/g, " ").trim();
  };
  const dia = (n) => horarios.locator(`[data-dia="${n}"]`);

  // ── El demo trae lunes a sábado; "Ahora" lo dice la base ──
  chequear(await dia(1).locator('input[role="switch"]').isChecked() && !(await dia(7).locator('input[role="switch"]').isChecked()),
    "los horarios del demo se ven: lunes abierto, domingo cerrado", "los horarios del demo no se cargaron");
  chequear(await horarios.locator("[data-ahora]").count() === 1, `“${(await horarios.locator("[data-ahora]").innerText()).trim()}”`, "no dice si está abierto ahora");

  // ── Error claro, después turno partido y copiar a la semana ──
  await dia(1).locator('input[aria-label="Lunes: abre"]').fill("22:00");
  await dia(1).locator('input[aria-label="Lunes: cierra"]').fill("07:00");
  let m = await guardarH();
  chequear(/El lunes: abre a las 22:00 y cierra a las 07:00/.test(m), `lunes al revés → “${m}”`, `lunes al revés dio “${m}”`);
  await dia(1).locator('input[aria-label="Lunes: abre"]').fill("07:00");
  await dia(1).locator('input[aria-label="Lunes: cierra"]').fill("22:00");
  await horarios.locator('button:has-text("Lunes a viernes igual")').click();
  // Sábado desde cero (así la prueba se puede repetir): 9 a 13 y otra franja de 16 a 20.
  await dia(6).locator('input[role="switch"]').uncheck();
  await dia(6).locator('input[role="switch"]').check();
  await dia(6).locator('input[aria-label="Sábado: abre"]').fill("09:00");
  await dia(6).locator('input[aria-label="Sábado: cierra"]').fill("13:00");
  await dia(6).locator('button:has-text("Otra franja")').click();
  await dia(7).locator('input[role="switch"]').check();
  await dia(7).locator('input[role="switch"]').uncheck();
  m = await guardarH();
  chequear(/Guardado|ya estaba guardado/.test(m), "horarios con turno partido el sábado se guardan", `guardar horarios dio “${m}”`);
  await capturar(p, "cfg4-compu-horarios", true);

  // ── La página los muestra agrupados ──
  const pub = await p.context().newPage();
  await pub.goto(`${G}/`);
  const bloque = pub.locator("[data-horarios-sede]");
  await bloque.waitFor({ timeout: 30000 });
  const textoHorarios = (await bloque.innerText()).replace(/\s+/g, " ");
  chequear(/Lunes a viernes 7:00 a 22:00/.test(textoHorarios) && /Sábado 9:00 a 13:00 y 16:00 a 20:00/.test(textoHorarios) && /Domingo Cerrado/.test(textoHorarios),
    "la página muestra “Lunes a viernes 7:00 a 22:00”, el sábado partido y el domingo cerrado", `la página muestra: ${textoHorarios}`);
  chequear(await pub.locator("[data-abierto]").count() > 0, "la página dice si está abierto ahora", "la página no muestra el abierto ahora");
  await pub.close();

  // ── Feriado: cancela las clases de ese día ──
  await p.goto(`${G}/panel/clases?dia=${FECHA}`);
  await p.locator("main").waitFor();
  const deClase = (pag) => pag.locator('a[href^="/panel/clases/"]').evaluateAll((xs) => xs.filter((x) => /\/panel\/clases\/[0-9a-f-]{36}$/.test(x.getAttribute("href"))).length);
  const antes = await deClase(p);
  chequear(antes > 0, `el ${FECHA} tiene ${antes} clases`, `el ${FECHA} no tiene clases para probar`);
  await p.goto(`${G}/panel/configuracion?pestana=horarios`);
  const cierres = p.locator("[data-cierres]");
  await cierres.waitFor({ timeout: 30000 });
  await p.locator('[data-cierres][data-listo="true"]').waitFor({ timeout: 30000 });   // React ya tomó la pantalla
  await cierres.locator('label:has-text("Desde") input').fill(FECHA);
  await cierres.locator('label:has-text("Motivo") input').fill(MOTIVO);
  const r0 = Number(await cierres.getAttribute("data-respuestas"));
  await cierres.locator('button:has-text("Cargar cierre")').click();
  await cierres.locator("[data-confirmar-cierre]").click();   // VD-57: primero el aviso, después se confirma
  await p.waitForFunction((n) => Number(document.querySelector("[data-cierres]")?.getAttribute("data-respuestas")) > n, r0, { timeout: 30000 });
  m = (await cierres.locator(".mensaje").first().innerText()).replace(/\s+/g, " ");
  chequear(/Listo: cerrado/.test(m) && new RegExp(`Se cancelaron ${antes} clase`).test(m), `cargar el feriado → “${m}”`, `cargar el feriado dio “${m}”`);
  chequear(await cierres.locator(`[data-cierre-panel="${FECHA}"]`).count() === 1, "el feriado queda en la lista de cierres", "el feriado no aparece en la lista");
  await capturar(p, "cfg4-compu-cierre");
  await p.goto(`${G}/panel/clases?dia=${FECHA}`);
  const canceladas = await p.locator(`text=Cancelada · Gimnasio cerrado: ${MOTIVO}`).count();
  chequear(canceladas === antes, `las ${antes} clases del ${FECHA} quedan canceladas por el cierre`, `quedaron ${canceladas} de ${antes} canceladas`);

  // ── La app del socio y la página lo avisan ──
  const c = await pagina(b, CELU);
  await entrarSocio(c, "+5490000100002");
  await c.locator("[data-agenda-app]").waitFor({ timeout: 30000 });
  chequear(await c.locator("[data-cierre]", { hasText: MOTIVO }).count() === 1, "la app del socio avisa el feriado", "la app no avisa el feriado");
  await capturar(c, "cfg4-celu-app");
  const pub2 = await p.context().newPage();
  await pub2.goto(`${G}/`);
  chequear(await pub2.locator("[data-cierre]", { hasText: MOTIVO }).count() === 1, "la página del gimnasio avisa el feriado arriba", "la página no avisa el feriado");
  await pub2.close();

  // ── Encargado: no toca horarios, sí anula el cierre ──
  const e = await pagina(b, COMPU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel/configuracion?pestana=horarios`);
  await e.locator("[data-cierres]").waitFor({ timeout: 30000 });
  chequear(await e.locator('[data-pie="horarios"]').count() === 0 && await e.locator('[data-dia="1"] input[role="switch"]').isDisabled(),
    "encargado: ve los horarios sin poder cambiarlos", "encargado: puede tocar los horarios");
  const fila = e.locator(`[data-cierre-panel="${FECHA}"]`);
  await fila.locator('button:has-text("Anular")').click();
  await fila.locator('button:has-text("Anular cierre")').click();
  await e.locator("[data-cierres] .mensaje", { hasText: "por qué se anula" }).waitFor({ timeout: 15000 });
  ok("anular sin motivo pide el motivo");
  await fila.locator('input[aria-label="Motivo de la anulación"]').fill("Al final abrimos");
  await fila.locator('button:has-text("Anular cierre")').click();
  await e.locator("[data-cierres] .mensaje", { hasText: "vuelven a estar" }).waitFor({ timeout: 30000 });
  chequear(await e.locator(`[data-cierre-panel="${FECHA}"]`).count() === 0, "encargado: anula el feriado y sale de la lista", "el feriado sigue en la lista");
  await e.goto(`${G}/panel/clases?dia=${FECHA}`);
  await e.locator("main").waitFor();
  chequear(await e.locator(`text=Gimnasio cerrado: ${MOTIVO}`).count() === 0, "anular el feriado devuelve las clases", "las clases siguen canceladas");
  if (e.errores.length) falla(`encargado: ${e.errores.join(" | ")}`);
  await e.context().close();
  await c.reload();
  await c.locator("text=/Podés entrar|No podés entrar/").first().waitFor({ timeout: 30000 });
  chequear(await c.locator("[data-cierre]", { hasText: MOTIVO }).count() === 0, "la app deja de avisar el feriado anulado", "la app sigue avisando el feriado");
  if (c.errores.length) falla(`app: ${c.errores.join(" | ")}`);
  await c.context().close();

  // ── Celular: sin desborde ──
  const cel = await pagina(b, CELU);
  await entrar(cel, "duena@ejemplo.invalid");
  await cel.goto(`${G}/panel/configuracion?pestana=horarios`);
  await cel.locator("[data-horarios]").waitFor({ timeout: 30000 });
  const ancho = await cel.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular: Horarios sin desborde (${ancho}px)`, `celular: Horarios mide ${ancho}px`);
  await capturar(cel, "cfg4-celu-horarios", true);
  await cel.context().close();
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
