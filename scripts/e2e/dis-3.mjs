#!/usr/bin/env node
// DIS-3 · Pulido de Socios: en el celular lo que se usa poco va en "⋯ Más"
// (la búsqueda queda arriba); cada pantalla de Socios tiene “← volver”;
// ninguna desborda ni tiene botones bajos; un solo verde por pantalla.
//   npm run e2e:dis-3            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/socios`);
  await c.locator('input[aria-label="Buscar socio"]').waitFor();
  chequear(!(await c.locator('main a:has-text("Importar")').first().isVisible()), "celular: Importar, Duplicados y Exportar no ocupan la pantalla", "se ven en el celular");
  const arriba = await c.locator('input[aria-label="Buscar socio"]').evaluate((e) => e.getBoundingClientRect().top);
  chequear(arriba < 420, `celular: la búsqueda queda arriba (${Math.round(arriba)} px)`, `la búsqueda está a ${arriba}px`);
  await c.locator("[data-mas] summary").click();
  chequear(await c.locator('[data-mas] a:has-text("Importar")').isVisible(), "“⋯ Más” los muestra", "Más no abre");
  const href = await c.locator('main ul a[href^="/panel/socios/"]').first().getAttribute("href");
  for (const ruta of ["/panel/socios", href, `${href}/editar`, "/panel/socios/nuevo", "/panel/socios/importar", "/panel/socios/duplicados"]) {
    await c.goto(`${G}${ruta}`); await c.locator("main h1").first().waitFor({ timeout: 60000 });
    const m = await c.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      return {
        ancho: document.documentElement.scrollWidth,
        bajos: [...document.querySelectorAll("main .boton")].filter(vis).filter((e) => e.getBoundingClientRect().height < 44).length,
        verdes: [...document.querySelectorAll("main .boton-principal")].filter(vis).length,
        volver: !!document.querySelector('main a[href^="/panel/socios"]'),
      };
    });
    const r = ruta.replace(/[0-9a-f-]{36}/, ":id");
    chequear(m.ancho <= CELU.width && m.bajos === 0 && m.verdes <= 1 && (ruta === "/panel/socios" || m.volver),
      `${r}: sin desborde, botones altos, ${m.verdes} verde${m.verdes === 1 ? "" : "s"}${ruta === "/panel/socios" ? "" : ", con “←”"}`, `${r}: ${JSON.stringify(m)}`);
  }
  if (c.errores.length) falla(`celular: ${c.errores.join(" | ")}`);
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  await p.goto(`${G}/panel/socios`);
  await p.locator('main a:visible:has-text("Importar")').waitFor({ timeout: 30000 });
  chequear(await p.locator("[data-mas]").isHidden(), "compu: los botones a la vista, sin “Más”", "en compu aparece Más");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
