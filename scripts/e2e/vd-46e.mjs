#!/usr/bin/env node
// VD-46E · Baja con constancia: el socio pide la baja desde la app y ve su código; la dueña lo ve en la ficha ("Se queda");
// una baja dada en el mostrador deja su constancia en la ficha; el celular no se desborda.
//   node scripts/e2e/vd-46e.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  // El socio pide la baja: ve el código en el momento y después.
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app/cuenta`);
  const pedir = s.getByRole("button", { name: /Quiero darme de baja/ });
  if (await pedir.isVisible().catch(() => false)) {
    await pedir.click();
    const baja = s.locator("[data-pedir-baja]");
    await baja.getByText("El precio").click();
    await baja.getByRole("button", { name: "Pedir la baja" }).click();
    await s.locator("[data-pedido-baja-ok], [data-baja-pendiente]").first().waitFor({ timeout: 30000 });
  }
  await s.reload();
  const codigo = (await s.locator("[data-codigo-baja]").first().innerText({ timeout: 30000 })).trim();
  chequear(/^BAJA-[0-9A-F]{8}$/.test(codigo), `el socio ve su código de baja (${codigo})`, `código raro: ${codigo}`);
  const ancho = await s.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= 391, "celular 390 px sin desborde", `desborda: ${ancho}px`);

  // La dueña lo ve en la ficha, con el mismo código, y dice que se queda.
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/campana`);
  await d.getByRole("link", { name: /pidió la baja/ }).filter({ hasText: /Testigo/ }).first().click();
  const banner = d.locator("[data-pedido-baja]");
  await banner.waitFor({ timeout: 60000 });
  chequear((await banner.locator("[data-codigo-baja]").innerText()).trim() === codigo, "la ficha muestra la misma constancia", "el código de la ficha es otro");
  chequear(/pagos por aprobar/.test(await banner.innerText()), "la ficha avisa qué se cierra al dar la baja", "no avisa qué se cierra");
  await banner.getByRole("button", { name: /Se queda/ }).click();
  await banner.waitFor({ state: "detached", timeout: 30000 });
  ok("“Se queda”: el pedido se resuelve");

  // Una baja dada en el mostrador deja constancia.
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Baja${s5}`);
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Solo dar de alta")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}/, { timeout: 30000 });
  await d.locator('button:has-text("Dar de baja")').click();
  await d.locator('button:has-text("Se mudó")').click();
  const c = d.locator("[data-constancia-baja]");
  await c.waitFor({ timeout: 30000 });
  chequear(/BAJA-[0-9A-F]{8}/.test(await c.innerText()), "la baja del mostrador deja su constancia en la ficha", "no hay código en la ficha");

  // Control la lista.
  await d.goto(`${G}/panel/control`);
  await d.locator('[data-moderacion-item="baja"]').first().waitFor({ timeout: 30000 });
  ok("Control lista la baja con su código");
  for (const p of [s, d]) chequear(p.errores.length === 0, "sin errores de página", p.errores.join(" | "));
} finally {
  await b.close();
}
resultado();
