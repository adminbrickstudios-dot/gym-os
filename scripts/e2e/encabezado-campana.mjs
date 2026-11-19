#!/usr/bin/env node
// Auditoría 18/11 · En la compu, la campana de Novedades (arriba a la derecha) no puede tapar el botón de acción del encabezado de la pantalla
// (Caja: "Cierre del día"; Entrada: "Control de la puerta"). Se mide con las cajas de los elementos: no se tocan. Vale para el estilo clásico y para Pista.
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  for (const ruta of ["/panel/caja", "/panel/entrada"]) {
    await p.goto(`${GIMNASIO()}${ruta}`, { waitUntil: "load" });
    await p.locator("h1").first().waitFor({ timeout: 60000 });
    await p.locator("[data-campana]").first().waitFor({ timeout: 30000 });
    const r = await p.evaluate(() => {
      const c = document.querySelector("[data-campana]").getBoundingClientRect();
      const h1 = document.querySelector("h1");
      const fila = h1.closest("div.flex.flex-wrap");
      const botones = [...(fila?.querySelectorAll("a.boton, button.boton") ?? [])].filter((e) => e.getBoundingClientRect().width > 0);
      const choca = botones.filter((e) => { const x = e.getBoundingClientRect(); return !(x.right <= c.left || x.left >= c.right || x.bottom <= c.top || x.top >= c.bottom); });
      return { botones: botones.length, choca: choca.map((e) => e.textContent.trim()) };
    });
    chequear(r.botones > 0 && r.choca.length === 0, `${ruta}: la campana no tapa ningún botón del encabezado (${r.botones} botones)`, `${ruta}: la campana tapa ${r.choca.join(", ") || "(no se encontraron botones)"}`);
  }
} catch (e) { falla(`se cortó: ${String(e.message).split("\n")[0]}`); }
finally { await b.close(); }
resultado();
