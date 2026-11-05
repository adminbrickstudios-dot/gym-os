#!/usr/bin/env node
// CFG-6 · Lo que la base ya guardaba y ahora se cambia en Configuración → Reglas:
// volver a entrar el mismo día, los días de retención y cómo entra la gente.
//   npm run e2e:cfg-6            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  const cont = p.locator("fieldset[data-pestana-activa]");
  const pie = p.locator('[data-pie="reglas"]');
  const abrirReglas = async () => {
    await p.goto(`${G}/panel/configuracion?pestana=reglas`);
    await p.locator('fieldset[data-pestana-activa="reglas"]').waitFor({ timeout: 30000 });
    await p.waitForTimeout(800);   // que React tome la pantalla
  };
  const guardar = async () => {
    const antes = Number(await pie.getAttribute("data-respuestas"));
    await pie.locator('button:has-text("Guardar")').click();
    await p.waitForFunction((n) => Number(document.querySelector('[data-pie="reglas"]')?.getAttribute("data-respuestas")) > n, antes, { timeout: 30000 });
    return (await pie.locator(".mensaje").first().innerText()).replace(/\s+/g, " ").trim();
  };
  const campo = (texto) => cont.locator("label", { hasText: texto }).locator("input");
  // Cuántos socios hay en una lista de Retención (los links de WhatsApp de esa lista).
  const enLista = async (lista) => {
    await p.goto(`${G}/panel/retencion?lista=${lista}`);
    await p.locator("main").waitFor();
    return p.locator('a[href^="https://wa.me/"]').count();
  };

  // ── Volver a entrar el mismo día ──
  await abrirReglas();
  const sw = cont.locator("label", { hasText: "Volver a entrar el mismo día" });
  const antesSw = await sw.locator("input").isChecked();
  await sw.locator("input").click();
  const ayuda = (await sw.innerText()).replace(/\s+/g, " ");
  chequear(antesSw ? /Apagado: .* no se le descuenta otra clase/.test(ayuda) : /Prendido: .* se le descuenta otra clase/.test(ayuda),
    "el interruptor explica con un ejemplo qué cambia", `la explicación quedó: ${ayuda}`);
  let m = await guardar();
  chequear(/Guardado/.test(m), "guardar el reingreso", `guardar dio “${m}”`);
  await abrirReglas();
  chequear(await sw.locator("input").isChecked() === !antesSw, "el reingreso sigue cambiado al recargar", "el reingreso no quedó guardado");
  await sw.locator("input").click(); await guardar();

  // ── Días de retención: mover el límite cambia las listas ──
  const vencido = campo("Vencido pasa a");
  const original = await vencido.inputValue();
  await vencido.fill("120"); await guardar();
  const [v120, s120] = [await enLista("vencido"), await enLista("se_fue")];
  await abrirReglas();
  await vencido.fill("1"); m = await guardar();
  chequear(/Guardado/.test(m), "guardar los días de retención", `guardar dio “${m}”`);
  const [v1, s1] = [await enLista("vencido"), await enLista("se_fue")];
  chequear(v1 < v120 && s1 > s120, `con 1 día, los vencidos pasan a “se fue” (vencidos ${v120} → ${v1}, se fue ${s120} → ${s1})`,
    `las listas no cambiaron: vencidos ${v120} → ${v1}, se fue ${s120} → ${s1}`);
  await abrirReglas();
  await vencido.fill(original); await guardar();

  // ── Valores fuera de rango ──
  await campo("Socio nuevo durante").fill("3");
  m = await guardar();
  chequear(/entre 7 y 90/.test(m), `socio nuevo 3 días → “${m}”`, `socio nuevo 3 días dio “${m}”`);
  await abrirReglas();

  // ── Cómo entra la gente ──
  const acc = cont.locator("[data-accesos]");
  const recepcion = acc.locator('input[role="switch"]').first();   // la primera es Recepción
  const otros = acc.locator('input[role="switch"]');
  let apagadosBloqueados = 0;
  for (let i = 1; i < await otros.count(); i++) if (!(await otros.nth(i).isChecked()) && await otros.nth(i).isDisabled()) apagadosBloqueados++;
  chequear(await recepcion.isChecked() && await recepcion.isDisabled() && apagadosBloqueados === 3,
    "Recepción prendida siempre; QR, tablet y llavero aparecen como todavía no disponibles", "las formas de entrada no se ven como corresponde");
  await capturar(p, "cfg6-compu-reglas", true);
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
  await p.context().close();

  // ── Celular ──
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/configuracion?pestana=reglas`);
  await c.locator("[data-accesos]").waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular: Reglas sin desborde (${ancho}px)`, `celular: Reglas mide ${ancho}px`);
  await capturar(c, "cfg6-celu-reglas", true);
  await c.context().close();
  ok("reglas recorridas");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
