#!/usr/bin/env node
// VD-7 · Cómo vencen las cuotas (D18): la dueña elige "día fijo" con primera cuota proporcional en
// Configuración → Cobros; la base calcula una simulación; una alta a mitad de mes muestra el cálculo antes de
// cobrar ("N días de M"), cobra el proporcional y la cuota vence el día antes del día fijo. La regla vuelve a
// como estaba al final (la prueba no deja el gimnasio cambiado).
//   node scripts/e2e/vd-7.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan, hojaDeAlta } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
// Un día fijo que no es hoy (así la alta de hoy es siempre a mitad de ciclo).
const hoy = new Date();
const X = ((hoy.getDate() + 9) % 28) + 1;
const aIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const en3 = new Date(hoy.getTime() + 3 * 86_400_000);
let guardadas = [];

async function irACobros(d) {
  await d.goto(`${G}/panel/configuracion?pestana=cobros`);
  await d.locator("[data-reglas-vencimiento]").waitFor({ timeout: 60000 });
}
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await irACobros(d);
  const sec = d.locator("[data-reglas-vencimiento]");

  // ── 1 · La regla del gimnasio: día fijo, primera cuota proporcional ──
  await sec.locator('input[name="renovacion"]').nth(2).check();
  await sec.locator("[data-dia-fijo] input[type=number]").first().fill(String(X));
  await sec.locator('input[name="primera"]').nth(0).check();
  await sec.locator('button:has-text("Guardar")').first().click();   // la regla del gimnasio es el primer Guardar (los planes tienen el suyo)
  await sec.getByText("Guardado. Vale para los cobros nuevos").waitFor({ timeout: 30000 });
  ok(`la dueña elige día fijo (el ${X}) con primera cuota proporcional y se guarda`);

  // ── 3 · Los planes siguen la regla del gimnasio (se anota cómo estaban para devolverlos) ──
  const planes = sec.locator("[data-plan-regla]");
  const cuantos = await planes.count();
  for (let i = 0; i < cuantos; i++) {
    const li = sec.locator("[data-plan-regla]").nth(i);
    const select = li.locator("select");
    const valor = await select.inputValue();
    const dia = valor === "dia_fijo" ? Number(await li.locator('input[aria-label="Día fijo"]').inputValue()) : null;
    guardadas.push({ id: await li.getAttribute("data-plan-regla"), valor, dia });
    if (valor === "gimnasio") continue;
    await select.selectOption("gimnasio");
    await li.locator('button:has-text("Guardar")').click();
    await sec.locator(`[data-plan-regla="${guardadas[i].id}"] select`).waitFor();
    await d.waitForFunction(([id]) => document.querySelector(`[data-plan-regla="${id}"] select`)?.value === "gimnasio" && /día fijo/.test(document.querySelector(`[data-plan-regla="${id}"]`)?.innerText ?? ""),
      [guardadas[i].id], { timeout: 30000 });
  }
  ok(`${cuantos} plan(es) siguen la regla del gimnasio`);

  // ── 2 · La simulación (después de 3: el plan que simula tiene que seguir la regla del gimnasio) (la misma cuenta de la base, sin cobrar) ──
  await sec.locator('input[type=date]').fill(aIso(en3));
  await sec.locator('button:has-text("Calcular")').click();
  const sim = sec.locator("[data-simulacion]");
  await sim.waitFor({ timeout: 30000 });
  const txt = await sim.innerText();
  chequear(/días de \d+/.test(txt) || /justo el día fijo/.test(txt), `la simulación calcula sola: “${txt.slice(0, 90)}…”`, `la simulación dice: ${txt.slice(0, 120)}`);

  chequear(await sec.locator("[data-ultimo-cambio]").count() === 1, "queda escrito el último cambio con quién y cuándo", "no muestra el último cambio");
  await capturar(d, "vd7-compu-config-cobros");

  // ── 4 · El alta a mitad de ciclo: la hoja Cobrar muestra el cálculo antes de cobrar ──
  const nombre = `MitadDeMes${s5}`;
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(nombre);
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Dar de alta y cobrar")').click();
  await hojaDeAlta(d);
  const parcial = d.locator("[data-cobrar-parcial]");
  await parcial.waitFor({ timeout: 30000 });
  const detalle = await parcial.innerText();
  chequear(/\d+ días de \d+/.test(detalle) && (await parcial.getAttribute("data-cobrar-parcial")) === "proporcional",
    `la hoja muestra el cálculo antes de cobrar: “${detalle.slice(0, 100)}…”`, `la hoja dice: ${detalle.slice(0, 120)}`);
  const cubre = await d.locator("[data-cobrar-cubre]").first().innerText();
  chequear(/Cubre del \d+\/\d+ al \d+\/\d+/.test(cubre), `y a qué día llega: “${cubre}”`, `cubre dice: ${cubre}`);
  const mas = d.locator('[aria-label="Uno más"]').first();
  chequear(await mas.isDisabled(), "la primera cuota parcial se cobra sola (no se puede sumar otra)", "deja sumar cuotas a la parcial");
  await capturar(d, "vd7-compu-hoja-proporcional");
  const transf = d.locator('[data-cobrar-medio="transferencia"]');
  if (await transf.count() && await transf.isEnabled()) await transf.click();
  const total = Number(await d.locator("[data-cobrar-total]").getAttribute("data-cobrar-total"));
  await d.locator("[data-cobrar-confirmar]").click();
  await d.locator("[data-cobrar-hecho]").waitFor({ timeout: 30000 });
  chequear(Number(await d.locator("[data-cobrar-hecho]").getAttribute("data-total")) === total, `cobra lo mismo que mostraba (${total})`, "cobró distinto de lo que mostraba");
  // Vence el día anterior al día fijo (cubre hasta el día fijo, sin incluirlo).
  const hechoTxt = await d.locator("[data-cobrar-hecho]").innerText();
  const m = hechoTxt.match(/vence el (\d\d)\/(\d\d)/);
  const sig = new Date(hoy.getFullYear(), hoy.getMonth() + (hoy.getDate() < X ? 0 : 1), X);
  const esperado = new Date(sig.getTime() - 86_400_000);
  const dd = String(esperado.getDate()).padStart(2, "0"), mm = String(esperado.getMonth() + 1).padStart(2, "0");
  chequear(!!m && m[1] === dd && m[2] === mm, `vence el ${dd}/${mm}, el día antes del día fijo`, `dice: ${hechoTxt.slice(0, 160)}`);
  await d.keyboard.press("Escape");

  // ── 5 · Celular: la configuración no desborda ──
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await irACobros(c);
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= 392, `celular: Configuración → Cobros sin desbordes (${ancho}px)`, `celular: desborda (${ancho}px)`);
  await capturar(c, "vd7-celu-config-cobros");
  if (c.errores.length) falla(`celular: ${c.errores.join(" | ")}`);

  // ── Se devuelve todo como estaba ──
  await irACobros(d);
  for (const p of guardadas) {
    if (p.valor === "gimnasio") continue;
    const li = d.locator(`[data-plan-regla="${p.id}"]`);
    await li.locator("select").selectOption(p.valor);
    if (p.valor === "dia_fijo") await li.locator('input[aria-label="Día fijo"]').fill(String(p.dia ?? 1));
    await li.locator('button:has-text("Guardar")').click();
    await d.waitForFunction(([id, v]) => document.querySelector(`[data-plan-regla="${id}"] select`)?.value === v, [p.id, p.valor], { timeout: 30000 });
  }
  const sec2 = d.locator("[data-reglas-vencimiento]");
  await sec2.locator('input[name="renovacion"]').nth(1).check();
  await sec2.locator('button:has-text("Guardar")').click();
  await sec2.getByText("Guardado. Vale para los cobros nuevos").waitFor({ timeout: 30000 });
  ok("la regla del gimnasio vuelve a como estaba");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
