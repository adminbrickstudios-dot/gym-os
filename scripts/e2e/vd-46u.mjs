#!/usr/bin/env node
// VD-46U · Topes y motivos de cortesías y devoluciones en Configuración → Reglas (y siguen en Control).
// La dueña agrega un motivo desde Configuración; el encargado lo ve sin poder cambiarlo; el celular no se desborda.
// (Anular una devolución se prueba en la base: supabase/pruebas/vd-46u-anular-devolucion.test.mjs.)
//   node scripts/e2e/vd-46u.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator("[data-reglas-beneficios]").waitFor({ timeout: 30000 });
  ok("Configuración → Reglas tiene la tarjeta de cortesías, descuentos y devoluciones");
  const nombre = `Motivo ${s5}`;
  await d.locator('input[aria-label="Motivo nuevo"]').fill(nombre);
  await d.locator('[data-reglas-beneficios] button:has-text("Agregar")').click();
  await d.locator(`[data-reglas-beneficios] [data-motivo]:has-text("${nombre}")`).waitFor({ timeout: 30000 });
  ok("la dueña agregó un motivo desde Configuración");

  // El encargado la ve, sin poder cambiarla.
  const e = await pagina(b, COMPU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel/configuracion?pestana=reglas`);
  await e.locator("[data-reglas-beneficios]").waitFor({ timeout: 30000 });
  chequear((await e.locator('[data-reglas-beneficios] input[aria-label="Motivo nuevo"]').count()) === 0, "el encargado no puede agregar motivos", "el encargado puede agregar motivos");

  const m = await pagina(b, CELU);
  await entrar(m, "duena@ejemplo.invalid");
  await m.goto(`${G}/panel/configuracion?pestana=reglas`);
  await m.locator("[data-reglas-beneficios]").waitFor({ timeout: 30000 });
  const ancho = await m.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= 391, "celular 390 px sin desborde", `desborda: ${ancho}px`);
  await capturar(m, "vd46u-celu-reglas");
  for (const p of [d, e, m]) chequear(p.errores.length === 0, "sin errores de página", p.errores.join(" | "));
} finally {
  await b.close();
}
resultado();
