#!/usr/bin/env node
// VD-46J · Devolución al dar de baja con cuota adelantada: se cobran 3 cuotas juntas, al dar de baja se avisa cuánto corresponde,
// la dueña registra la devolución (hecho nuevo, con motivo) y aparece en Control. La recepción no ve el monto ni registra.
//   node scripts/e2e/vd-46j.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, chequear, entrar, esperarCobro, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";
process.env.HORA_NAVEGADOR = "mediodia";   // F8.2: no depende de la hora del día

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Adelanta${s5}`);
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Solo dar de alta")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}/, { timeout: 30000 });
  const id = new URL(d.url()).pathname.split("/").pop();

  // Tres cuotas juntas, por transferencia.
  await d.goto(`${G}/panel/vender?socio=${id}&cuota=1`);
  await d.getByText(/^Cuota /).first().waitFor({ timeout: 30000 });
  const mas = d.getByRole("button", { name: "Uno más" }).first();
  await mas.click(); await mas.click();
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await d.locator('button:has-text("Cobrar")').click();
  await esperarCobro(d);
  ok("cobradas 3 cuotas juntas");

  // Antes de confirmar la baja: el aviso con el monto.
  await d.goto(`${G}/panel/socios/${id}`);
  await d.locator('button:has-text("Dar de baja")').click();
  const aviso = d.locator("[data-baja-devolucion]");
  await aviso.waitFor({ timeout: 30000 });
  chequear(/corresponden \$/.test(await aviso.innerText()), "antes de la baja: “corresponden $… de devolución”", `el aviso dice: ${await aviso.innerText()}`);
  chequear(await d.locator("[data-baja-cierra]").isVisible(), "dice qué se cierra al dar de baja", "no dice qué se cierra");
  await d.locator('button:has-text("Se mudó")').click();
  const tarjeta = d.locator("[data-devolucion-baja]");
  await tarjeta.waitFor({ timeout: 30000 });
  ok("dada la baja: la ficha ofrece registrar la devolución");

  // La dueña la registra: transferencia, con motivo.
  await d.locator("[data-devolucion-abrir]").click();
  await d.locator('select[aria-label="Medio de la devolución"]').selectOption("transferencia");
  const boton = d.locator('button:has-text("Registrar la devolución")');
  chequear(await boton.isDisabled(), "sin motivo no se registra", "se puede registrar sin motivo");
  await d.locator('input[aria-label="Motivo de la devolución"]').fill("Se mudó de ciudad");
  await boton.click();
  await tarjeta.waitFor({ state: "detached", timeout: 30000 });
  ok("la devolución quedó registrada (la tarjeta se va)");

  await d.goto(`${G}/panel/control`);
  const item = d.locator('[data-moderacion-item="devolucion"]').first();
  await item.waitFor({ timeout: 30000 });
  chequear(/Por transferencia · Se mudó de ciudad/.test(await item.innerText()), "Control: la devolución con medio y motivo", `Control dice: ${await item.innerText()}`);
  await d.locator("[data-topes] summary").click();
  await d.locator('select[aria-label="Regla de devolución al dar de baja"]').waitFor();
  ok("la dueña ve la regla de devolución en Control");

  const m = await pagina(b, CELU);
  await entrar(m, "duena@ejemplo.invalid");
  await m.goto(`${G}/panel/socios/${id}`);
  await m.locator("[data-constancia-baja]").waitFor({ timeout: 30000 });
  const ancho = await m.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= 391, "celular 390 px sin desborde", `desborda: ${ancho}px`);
  for (const p of [d, m]) chequear(p.errores.length === 0, "sin errores de página", p.errores.join(" | "));
} finally {
  await b.close();
}
resultado();
