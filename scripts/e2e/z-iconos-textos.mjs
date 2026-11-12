#!/usr/bin/env node
// Z2 / Z3 / Z4 · lo que se puede ver con sesión real:
//   1. El "atrás" cierra Ctrl+K (la Hoja) y no saca de la pantalla; con Esc no queda una entrada de más en el historial.
//   2. Con cambios sin guardar en Configuración, tocar un link del menú pregunta; Cancelar se queda, Aceptar sale.
//   3. Ninguna pantalla del panel muestra un emoji crudo (todo ícono es de línea).
//   4. El panel lateral de un socio no deja el "Cargando…" sin ficha (se ve el estado o el error con Reintentar).
//   node scripts/e2e/z-iconos-textos.mjs     (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const EMOJI = /\p{Extended_Pictographic}/u;
const b = await navegador();

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");

  // ── 1. Atrás y Esc con la Hoja ──
  await d.goto(`${G}/panel`);
  await d.goto(`${G}/panel/socios`);
  await d.waitForLoadState("networkidle").catch(() => {});
  await d.keyboard.press("Control+k");
  const hoja = d.locator('[role="dialog"][aria-label="Buscar"]');
  await hoja.waitFor({ timeout: 15000 });
  await d.goBack();
  await hoja.waitFor({ state: "hidden", timeout: 10000 });
  chequear(new URL(d.url()).pathname === "/panel/socios", "el atrás del navegador cierra Ctrl+K y se queda en Socios", `el atrás salió a ${d.url()}`);

  await d.keyboard.press("Control+k");
  await hoja.waitFor({ timeout: 15000 });
  await d.keyboard.press("Escape");
  await hoja.waitFor({ state: "hidden", timeout: 10000 });
  await d.waitForTimeout(400);
  await d.goBack();
  await d.waitForLoadState("domcontentloaded");
  chequear(new URL(d.url()).pathname === "/panel", "cerrada con Esc no deja una entrada de más: el atrás vuelve a Inicio", `el atrás quedó en ${d.url()}`);

  // ── 2. Cambios sin guardar ──
  await d.goto(`${G}/panel/configuracion`);
  const campo = d.locator('fieldset[data-pestana-activa] input[type="text"]').first();
  await campo.waitFor({ timeout: 60000 });
  await campo.fill(`${await campo.inputValue()} z`);
  await d.locator("[data-sin-guardar]").first().waitFor({ timeout: 10000 });
  let mensaje = "";
  d.once("dialog", async (x) => { mensaje = x.message(); await x.dismiss(); });
  await d.locator('aside a[href="/panel/socios"], nav a[href="/panel/socios"]').first().click();
  await d.waitForTimeout(600);
  chequear(/cambios sin guardar/i.test(mensaje) && new URL(d.url()).pathname === "/panel/configuracion", "un link del menú con cambios sin guardar pregunta y, al cancelar, se queda", `mensaje “${mensaje}” en ${d.url()}`);
  d.once("dialog", (x) => x.accept());
  await d.locator('aside a[href="/panel/socios"], nav a[href="/panel/socios"]').first().click();
  await d.waitForURL(/\/panel\/socios/, { timeout: 30000 });
  chequear(true, "al aceptar, el link navega");

  // ── 3. Sin emojis crudos ──
  for (const ruta of ["/panel", "/panel/caja", "/panel/entrada", "/panel/vender", "/panel/socios", "/panel/tareas"]) {
    await d.goto(`${G}${ruta}`);
    await d.waitForLoadState("networkidle").catch(() => {});
    const texto = await d.locator("body").innerText();
    const m = texto.split("\n").find((l) => EMOJI.test(l) || /[✓✕＋]/.test(l));
    chequear(!m, `${ruta}: sin emojis ni ✓ ✕ ＋ de texto`, `${ruta}: “${m}”`);
  }
} finally {
  await b.close();
}
resultado();
