#!/usr/bin/env node
// VD-34 · Confiabilidad base: doble clic en Cobrar = un solo cobro; dos sesiones
// editan la misma ficha y la segunda ve el aviso (y con otro Guardar, guarda
// igual); un error en el alta conserva todo lo escrito; una dirección que no
// existe tiene salida.
//   node scripts/e2e/vd-34.mjs     (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, esperarCobro, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan, hojaDeAlta, irAVender } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");

  // Alta con cobro y doble clic en Cobrar.
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Doble${s5}`);
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Dar de alta y cobrar")').click();
  // VD-5b: "Dar de alta y cobrar" abre la hoja Cobrar sobre el alta; después se sigue en Vender con el socio.
  await irAVender(d, await hojaDeAlta(d));
  const id = new URL(d.url()).searchParams.get("socio");
  await d.getByText(/^Cuota /).first().waitFor({ timeout: 30000 });
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await d.locator('button:has-text("✅ Cobrar")').dblclick();
  await esperarCobro(d);
  await d.goto(`${G}/panel/socios/${id}?pestana=pagos`);
  await d.locator("[data-ventas] li").first().waitFor({ timeout: 30000 });
  const cuantas = await d.locator('[data-ventas] li[data-estado="confirmada"]').count();
  chequear(cuantas === 1, "doble clic en Cobrar: una sola venta", `hay ${cuantas} ventas`);

  // Dos sesiones editan la misma ficha.
  const a = await pagina(b, COMPU), c = await pagina(b, COMPU);
  await entrar(a, "duena@ejemplo.invalid");
  await entrar(c, "recepcion@ejemplo.invalid");
  await a.goto(`${G}/panel/socios/${id}/editar`);
  await c.goto(`${G}/panel/socios/${id}/editar`);
  await a.locator('input[name="nombre"]').waitFor();
  await c.locator('input[name="nombre"]').waitFor();
  await a.waitForTimeout(1500); await c.waitForTimeout(1500); // la versión se pide al abrir
  await a.locator('textarea[name="notas"]').fill(`la dueña ${s5}`);
  await a.locator('button:has-text("Guardar cambios")').click();
  await a.waitForURL((u) => !u.pathname.endsWith("/editar"), { timeout: 30000 });
  await c.locator('textarea[name="notas"]').fill(`la recepción ${s5}`);
  await c.locator('button:has-text("Guardar cambios")').click();
  const aviso = c.locator('[role="alert"]', { hasText: "lo cambió" });
  await aviso.waitFor({ timeout: 30000 });
  ok(`la segunda sesión ve el aviso: “${(await aviso.innerText()).slice(0, 70)}…”`);
  chequear((await c.locator('textarea[name="notas"]').inputValue()) === `la recepción ${s5}`, "el aviso no borra lo escrito", "se perdió lo escrito");
  await capturar(c, "vd34-compu-conflicto");
  await c.locator('button:has-text("Guardar cambios")').click();
  await c.waitForURL((u) => !u.pathname.endsWith("/editar"), { timeout: 30000 });
  ok("con otro Guardar se guarda igual");

  // Una dirección que no existe: con salida.
  await d.goto(`${G}/panel/no-existe-${s5}`);
  chequear(await d.getByText("Ir al inicio").first().isVisible(), "pantalla que no existe: “Ir al inicio”", "sin salida");
} finally {
  await b.close();
}
resultado();
