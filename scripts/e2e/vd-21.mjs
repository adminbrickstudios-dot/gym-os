#!/usr/bin/env node
// VD-21 · Configuración con buscador y "Restablecer a lo recomendado", con sesión real.
// Buscar "reingreso" lleva a la opción (pestaña Entrada, resaltada); "caja", "fiado" y "meta" también;
// restablecer una tarjeta vuelve a su valor recomendado; en el celular (390 px) no se desborda.
//   node scripts/e2e/vd-21.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  await p.goto(`${G}/panel/configuracion`);
  const buscador = p.locator("[data-buscar-opcion]");
  await buscador.waitFor({ timeout: 30000 });
  await p.locator("[data-pestana-activa]").waitFor({ timeout: 30000 });
  await p.waitForTimeout(800); // React ya tomó la pantalla

  const buscar = async (texto) => { await buscador.fill(""); await buscador.fill(texto); await p.locator("[data-resultados-config], [data-sin-resultados]").first().waitFor({ timeout: 10000 }); };
  const ir = async (texto, id, pestana) => {
    await buscar(texto);
    await p.locator(`[data-resultado="${id}"]`).click();
    await p.waitForFunction((x) => new URL(location.href).searchParams.get("pestana") === x || (x === "gimnasio" && !location.search), pestana, { timeout: 10000 });
    await p.locator(`[data-opcion~="${id}"]`).first().waitFor({ timeout: 10000 });
    await p.waitForFunction((i) => !!document.querySelector(`[data-resaltada="${i}"]`), id, { timeout: 10000 });
  };

  // ── "reingreso" lleva a la opción de visita (Entrada) y también ofrece la de Reglas
  await buscar("reingreso");
  chequear(await p.locator('[data-resultado="visita-horas"]').count() === 1 && await p.locator('[data-resultado="reingreso"]').count() === 1,
    "buscar “reingreso” ofrece la visita (Entrada) y volver a entrar el mismo día (Reglas)", "“reingreso” no encuentra las dos opciones");
  chequear((await p.locator("[data-resultado]").first().getAttribute("data-resultado")) === "visita-horas", "la visita sale primera", "la visita no sale primera");
  await ir("reingreso", "visita-horas", "entrada");
  chequear(await p.locator("[data-config-visita][data-resaltada]").count() === 1, "“reingreso” abre Entrada y deja resaltada la opción de visita", "no resaltó la visita");
  await capturar(p, "vd21-reingreso");
  // Sin tildes y con mayúsculas igual.
  await ir("REINGRESO", "reingreso", "reglas");
  chequear(await p.locator('input[data-opcion="reingreso"]').count() === 1, "también lleva a la opción de Reglas", "no llegó a Reglas");

  // ── caja, fiado, meta
  await ir("caja", "caja", "cobros");
  chequear(await p.locator("[data-config-caja]").isVisible(), "“caja” abre Cobros en la tarjeta Caja", "no mostró la tarjeta Caja");
  await ir("fiado", "fiado", "cobros");
  await ir("meta", "meta-visitas", "reglas");
  chequear(await p.locator('[data-meta-visitas]').isVisible(), "“meta” lleva a la meta de visitas", "no mostró la meta de visitas");
  await buscar("zzzxx");
  chequear(await p.locator("[data-sin-resultados]").isVisible(), "una palabra que no existe lo dice y sugiere otra", "no avisó que no hay resultados");

  // ── Restablecer la tarjeta Reglas: cambio un número, lo guardo y vuelvo a lo recomendado
  await p.goto(`${G}/panel/configuracion?pestana=reglas`);
  const gracia = p.locator('input[data-opcion="tolerancia-dias"]');
  await gracia.waitFor({ timeout: 30000 });
  await p.waitForTimeout(800);
  const original = await gracia.inputValue();
  await gracia.fill("9");
  const guardar = p.locator('[data-pie="reglas"] button:has-text("Guardar")');
  await guardar.click();
  await p.waitForFunction(() => document.querySelector('[data-pie="reglas"] button')?.hasAttribute("disabled") && !!document.querySelector('[data-pie="reglas"] .mensaje'), null, { timeout: 30000 });
  await p.reload();
  chequear(await p.locator('input[data-opcion="tolerancia-dias"]').inputValue() === "9", "el cambio quedó guardado (9 días de gracia)", "no se guardó el 9");
  await p.waitForTimeout(800);
  await p.locator('[data-restablecer="reglas"]').click();
  chequear(await p.locator('[data-restablecer-pregunta="reglas"]').isVisible(), "restablecer pide confirmación", "no pidió confirmación");
  await p.locator('[data-restablecer-pregunta="reglas"] button:has-text("No")').click();
  chequear(await p.locator('input[data-opcion="tolerancia-dias"]').inputValue() === "9", "decir que no deja todo como está", "el No cambió algo");
  await p.locator('[data-restablecer="reglas"]').click();
  await p.locator('[data-restablecer-confirmar="reglas"]').click();
  await p.getByText("quedó en lo recomendado").first().waitFor({ timeout: 30000 });
  chequear(await p.locator('input[data-opcion="tolerancia-dias"]').inputValue() === "5", "restablecer vuelve a 5 días de gracia", "no volvió a 5");
  await p.reload();
  chequear(await p.locator('input[data-opcion="tolerancia-dias"]').inputValue() === "5", "y queda guardado al recargar", "al recargar no estaba en 5");
  if (original !== "5") { // el demo no se toca para los demás recorridos
    await p.waitForTimeout(800);
    await p.locator('input[data-opcion="tolerancia-dias"]').fill(original);
    await p.locator('[data-pie="reglas"] button:has-text("Guardar")').click();
    await p.waitForFunction(() => document.querySelector('[data-pie="reglas"] button')?.hasAttribute("disabled"), null, { timeout: 30000 });
  }

  // ── Restablecer una tarjeta con su propia función de guardado: la meta de visitas
  await p.goto(`${G}/panel/configuracion?pestana=reglas`);
  const meta = p.locator('input[aria-label="Meta de visitas del mes"]');
  await meta.waitFor({ timeout: 30000 });
  await p.waitForTimeout(800);
  const metaOriginal = await meta.inputValue();
  await meta.fill("20");
  await p.locator('button:has-text("Guardar meta")').click();
  await p.locator('[data-meta-visitas="20"]').waitFor({ timeout: 30000 });
  await p.locator('[data-restablecer="meta-visitas"]').click();
  await p.locator('[data-restablecer-confirmar="meta-visitas"]').click();
  await p.locator('[data-meta-visitas="12"]').waitFor({ timeout: 30000 });
  chequear(true, "restablecer la meta de visitas vuelve a 12", "");
  if (metaOriginal !== "12") {
    await meta.fill(metaOriginal);
    await p.locator('button:has-text("Guardar meta")').click();
    await p.locator(`[data-meta-visitas="${metaOriginal}"]`).waitFor({ timeout: 30000 });
  }

  // ── Celular: el buscador y los resultados entran en 390 px
  const m = await pagina(b, CELU);
  await entrar(m, "duena@ejemplo.invalid");
  await m.goto(`${G}/panel/configuracion`);
  await m.locator("[data-buscar-opcion]").waitFor({ timeout: 30000 });
  await m.waitForTimeout(800);
  await m.locator("[data-buscar-opcion]").fill("caja");
  await m.locator("[data-resultados-config]").waitFor({ timeout: 10000 });
  const ancho = await m.evaluate(() => ({ doc: document.documentElement.scrollWidth, vista: window.innerWidth }));
  chequear(ancho.doc <= ancho.vista + 1, "celular 390 px: el buscador y sus resultados no desbordan", `desborda: ${ancho.doc} > ${ancho.vista}`);
  await m.locator('[data-resultado="caja"]').click();
  await m.waitForFunction(() => !!document.querySelector('[data-resaltada="caja"]'), null, { timeout: 10000 });
  await m.locator("[data-restablecer=\"caja\"]").scrollIntoViewIfNeeded();
  const ancho2 = await m.evaluate(() => ({ doc: document.documentElement.scrollWidth, vista: window.innerWidth }));
  chequear(ancho2.doc <= ancho2.vista + 1, "celular 390 px: la tarjeta Caja con su restablecer no desborda", `desborda: ${ancho2.doc} > ${ancho2.vista}`);
  await capturar(m, "vd21-celular-caja");
} finally {
  await b.close();
}
resultado();
