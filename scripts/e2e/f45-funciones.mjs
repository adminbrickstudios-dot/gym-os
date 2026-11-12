#!/usr/bin/env node
// F4/F5 · Funciones nuevas con interruptor por gimnasio (apagadas por defecto), en el gimnasio demo:
//   FA-17 borrador del alta, FA-1 "cuándo toca pagar" en el panel lateral del socio, detalle 68 horarios pico.
// Orden: todo apagado por defecto y sin rastro en las pantallas -> el dueño prende -> se ve -> la recepción lo ve donde le toca -> se apaga.
//   node scripts/e2e/f45-funciones.mjs     (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const CLAVES = ["borrador_alta", "panel_pago", "horarios_pico"];

async function abrirConfig(d) {
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator('[data-funciones-nuevas="listo"]').waitFor({ timeout: 60000 });
}
const estado = (d, clave) => d.locator(`[data-funcion-nueva="${clave}"]`).getAttribute("data-prendida");
async function poner(d, clave, si) {
  if ((await estado(d, clave)) === (si ? "si" : "no")) return;
  await d.locator(`[data-funcion-nueva="${clave}"] input[type=checkbox]`).click();
  await d.waitForFunction(([c, v]) => document.querySelector(`[data-funcion-nueva="${c}"]`)?.getAttribute("data-prendida") === v, [clave, si ? "si" : "no"], { timeout: 30000 });
}
async function primero(p, filtro) {
  await p.goto(`${G}/panel/socios?estado=${filtro}`);
  const a = p.locator('main ul a[href^="/panel/socios/"]').first();
  await a.waitFor({ timeout: 30000 });
  return (await a.getAttribute("href")).split("/").pop();
}
async function abrirPanel(p, socioId) {
  await p.goto(`${G}/panel/entrada`);
  await p.locator('input[aria-label="Buscar socio"]').waitFor({ timeout: 30000 });
  await p.evaluate((id) => window.dispatchEvent(new CustomEvent("gymos:abrir-panel-socio", { detail: { socioId: id } })), socioId);
  await p.locator("[data-panel-socio-estado]").waitFor({ timeout: 30000 });
}
async function cerrarPanel(p) { await p.keyboard.press("Escape"); await p.locator("[data-panel-socio-lateral]").waitFor({ state: "detached", timeout: 10000 }); }

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");

  // ── Por defecto, todo apagado ──
  await abrirConfig(d);
  for (const c of CLAVES) await poner(d, c, false);   // por si una corrida anterior dejó algo prendido
  chequear((await Promise.all(CLAVES.map((c) => estado(d, c)))).every((x) => x === "no"), "las tres funciones nuevas están apagadas", "alguna está prendida");

  const alDia = await primero(d, "al_dia"), vencido = await primero(d, "vencidos");
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill("Borrador");
  await d.waitForTimeout(900);
  await d.reload();
  await d.locator('input[name="nombre"]').waitFor({ timeout: 30000 });
  await d.waitForTimeout(600);
  chequear(await d.locator("[data-borrador]").count() === 0, "apagada: el alta no ofrece borrador", "ofrece borrador con la función apagada");
  await abrirPanel(d, alDia);
  chequear(await d.locator("[data-panel-socio-pago]").count() === 0, "apagada: el panel lateral no muestra cuándo toca pagar", "muestra los datos de pago apagada");
  await cerrarPanel(d);
  await d.goto(`${G}/panel/resultado`);
  await d.locator("#horas").waitFor({ timeout: 60000 });
  chequear(await d.locator("[data-horarios-pico]").count() === 0, "apagada: Resultado no muestra horarios pico por día", "muestra horarios pico apagada");

  // ── El dueño las prende ──
  await abrirConfig(d);
  for (const c of CLAVES) await poner(d, c, true);
  ok("el dueño prende las tres, una por una");
  await d.reload(); await d.locator('[data-funciones-nuevas="listo"]').waitFor({ timeout: 60000 });
  chequear((await Promise.all(CLAVES.map((c) => estado(d, c)))).every((x) => x === "si"), "quedan prendidas al recargar (se guardan en la base)", "no quedaron prendidas");

  // FA-17: borrador del alta
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill("Borrador");
  await d.locator('input[name="apellido"]').fill("Probando");
  await d.waitForTimeout(900);
  await d.reload();
  await d.locator("[data-borrador]").waitFor({ timeout: 30000 });
  chequear(/Seguimos donde dejaste/.test(await d.locator("[data-borrador]").innerText()), "prendida: al volver al alta pregunta “¿Seguimos donde dejaste?”", "no preguntó por el borrador");
  await d.locator("[data-borrador-seguir]").click();
  await d.waitForFunction(() => document.querySelector('input[name="nombre"]')?.value === "Borrador", null, { timeout: 10000 });
  chequear(await d.locator('input[name="apellido"]').inputValue() === "Probando", "Seguir devuelve lo que estaba escrito", "Seguir no devolvió el apellido");
  await d.reload();
  await d.locator("[data-borrador-descartar]").waitFor({ timeout: 30000 });
  await d.locator("[data-borrador-descartar]").click();
  await d.reload();
  await d.locator('input[name="nombre"]').waitFor({ timeout: 30000 }); await d.waitForTimeout(600);
  chequear(await d.locator("[data-borrador]").count() === 0, "Empezar de nuevo borra el borrador", "el borrador siguió después de descartarlo");

  // FA-1: panel lateral
  await abrirPanel(d, alDia);
  const toca = await d.locator("[data-panel-pago-toca]").innerText().catch(() => "");
  chequear(/Le toca pagar el/.test(toca), `socio al día: “${toca}”`, `socio al día sin “Le toca pagar el” (dice: ${toca})`);
  chequear(/Pagaría/.test(await d.locator("[data-panel-pago-plan]").innerText()), "dice qué plan pagaría", "no dice qué plan pagaría");
  await cerrarPanel(d);
  await abrirPanel(d, vencido);
  const desde = await d.locator("[data-panel-pago-desde]").innerText().catch(() => "");
  chequear(/Debe desde el/.test(desde), `socio vencido: “${desde}”`, `socio vencido sin “Debe desde el” (dice: ${desde})`);
  await cerrarPanel(d);

  // Detalle 68: horarios pico
  await d.goto(`${G}/panel/resultado`);
  await d.locator("[data-horarios-pico]").waitFor({ timeout: 60000 });
  const texto = await d.locator("[data-horarios-pico-texto]").innerText();
  chequear(/últimas 8 semanas/.test(texto), `horarios pico: “${texto}”`, `texto inesperado: ${texto}`);
  const tabla = await d.locator("[data-horarios-pico] table").count();
  chequear(tabla === 1 || /Sin entradas/.test(texto), "el cuadro día × hora se dibuja cuando hay entradas", "falta el cuadro con entradas registradas");

  // La recepción ve el panel con los datos, pero no puede cambiar los interruptores
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await abrirPanel(r, alDia);
  chequear(await r.locator("[data-panel-socio-pago]").count() === 1, "la recepción ve cuándo toca pagar en el panel lateral", "la recepción no lo ve");
  await r.goto(`${G}/panel/configuracion`);
  await r.waitForTimeout(1500);
  chequear(await r.locator("[data-funciones-nuevas]").count() === 0, "la recepción no tiene los interruptores", "la recepción ve los interruptores");

  // ── Se apagan ──
  await abrirConfig(d);
  for (const c of CLAVES) await poner(d, c, false);
  await d.goto(`${G}/panel/resultado`);
  await d.locator("#horas").waitFor({ timeout: 60000 });
  chequear(await d.locator("[data-horarios-pico]").count() === 0, "apagada otra vez: desaparece de Resultado", "siguió en Resultado");
  chequear(d.errores.length === 0, "sin errores de página ni 5xx", d.errores.join(" | "));
} catch (e) { console.error(e); process.exitCode = 1; }
finally { await b.close(); resultado(); }
