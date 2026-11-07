#!/usr/bin/env node
// VD-26 · Página de Gym OS para vender: la dirección de la plataforma muestra la landing; "Ingresar" sigue
// andando; el formulario de la demo crea el pedido y le aparece al super admin en /admin; en 390 px no desborda.
//   node scripts/e2e/vd-26.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, PLATAFORMA as B, capturar, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";

const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const p = await pagina(b, COMPU);
  await p.goto(B);
  await p.locator("[data-plataforma]").waitFor({ timeout: 60000 });
  chequear(await p.getByRole("heading", { name: /puede entrar hoy/i }).isVisible(), "la plataforma muestra la landing de Gym OS", "no se ve la landing");
  chequear(await p.locator("[data-quiero-demo]").isVisible(), "tiene el botón “Quiero una demo”", "falta el botón de la demo");
  await capturar(p, "vd26-compu", true);

  // Los precios solo salen de planes cargados: cada plan visible muestra un monto en pesos.
  const planes = await p.locator("[data-plan-brik]").count();
  if (planes > 0) chequear(/\$\s?\d/.test(await p.locator("[data-plan-brik]").first().innerText()), `${planes} plan(es) de BRIK con su precio`, "un plan sin precio");
  else chequear(await p.locator("[data-planes-brik]").count() === 0, "sin planes cargados no hay sección de precios", "hay precios sin planes");

  // El robot (campo trampa lleno) no deja pedido.
  const trampa = `Robot ${s5}`;
  await p.locator('input[name="nombre"]').fill(trampa);
  await p.locator('input[name="contacto"]').fill(`robot${s5}@ejemplo.invalid`);
  await p.locator('input[name="sitio"]').evaluate((e) => { e.value = "http://spam.invalid"; });
  await p.locator("[data-form-demo] button[type=submit]").click();
  await p.locator("[data-demo-listo]").waitFor({ timeout: 30000 });

  // Un pedido de verdad.
  await p.goto(B);
  const nombre = `Dueño Demo ${s5}`;
  await p.locator('input[name="nombre"]').fill(nombre);
  await p.locator('input[name="gimnasio"]').fill(`Gimnasio Prueba ${s5}`);
  await p.locator('input[name="contacto"]').fill("hola");
  await p.locator("[data-form-demo] button[type=submit]").click();
  await p.locator('[data-form-demo] [role="alert"]').waitFor({ timeout: 30000 });
  ok(`un contacto inválido se avisa: “${(await p.locator('[data-form-demo] [role="alert"]').innerText()).trim().slice(0, 70)}”`);
  chequear((await p.locator('input[name="nombre"]').inputValue()) === nombre, "el error no borra lo escrito", "se perdió lo escrito");
  await p.locator('input[name="contacto"]').fill(`387 000 ${s5}`);
  await p.locator("[data-form-demo] button[type=submit]").click();
  await p.locator("[data-demo-listo]").waitFor({ timeout: 30000 });
  ok("el pedido de demo se envía");

  // "Ingresar" sigue andando.
  await p.goto(B);
  await p.locator("[data-ingresar]").click();
  await p.waitForURL(/\/ingresar/, { timeout: 30000 });
  ok("“Ingresar” lleva a /ingresar");

  // El super admin lo ve en /admin; el robot no.
  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  await p.goto(`${B}/admin`);
  const tarjeta = p.locator("[data-pedido-demo]", { hasText: nombre });
  await tarjeta.waitFor({ timeout: 60000 });
  ok("el pedido aparece en /admin");
  chequear(await p.locator("[data-pedido-demo]", { hasText: trampa }).count() === 0, "el pedido del robot no llegó", "el campo trampa no frenó al robot");
  await capturar(p, "vd26-admin");
  const antes = await p.locator("[data-pedido-demo]").count();
  await tarjeta.locator("button", { hasText: "Ya lo contacté" }).click();
  await p.locator("[data-pedido-demo]", { hasText: nombre }).waitFor({ state: "detached", timeout: 30000 });
  chequear((await p.locator("[data-pedido-demo]").count()) === antes - 1, "“Ya lo contacté” lo saca de la lista", "el pedido sigue en la lista");

  // Celular: sin desborde horizontal.
  const c = await pagina(b, CELU);
  await c.goto(B);
  await c.locator("[data-plataforma]").waitFor({ timeout: 60000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `la landing en el celular sin desborde (${ancho}px)`, `desborda ${ancho}px`);
  await capturar(c, "vd26-celu", true);
  if (p.errores.length) throw new Error(p.errores.join(" | "));
} finally {
  await b.close();
}
resultado();
