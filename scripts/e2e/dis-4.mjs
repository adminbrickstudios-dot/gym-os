#!/usr/bin/env node
// DIS-4, DIS-5, DIS-6 · Pulido de Vender, Caja y Transferencias: en el celular,
// con algo en el carrito aparece la barra "🛒 N · $total · Cobrar ↓" que lleva
// al ticket y se esconde cuando el ticket está a la vista; ninguna de las tres
// pantallas desborda, tiene botones bajos ni más de un verde.
//   npm run e2e:dis-4            (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const p = await pagina(b, CELU);
  await entrar(p, "recepcion@ejemplo.invalid");
  await p.goto(`${G}/panel/vender`);
  chequear(await p.locator("[data-barra-carrito]").count() === 0, "con el carrito vacío no hay barra", "hay barra vacía");
  await p.locator("main button", { hasText: "Agua 500 ml" }).click();
  const barra = p.locator("[data-barra-carrito]");
  await barra.waitFor({ timeout: 30000 });
  chequear(/1 · \$1\.500/.test(await barra.innerText()), "barra: “1 · $1.500 · Cobrar ↓”", await barra.innerText());
  await barra.click();
  await barra.waitFor({ state: "detached", timeout: 30000 });
  chequear(await p.locator('button:has-text("Cobrar")').isVisible(), "lleva al ticket y se esconde", "no se ve el ticket");
  for (const ruta of ["/panel/vender", "/panel/caja", "/panel/transferencias"]) {
    await p.goto(`${G}${ruta}`); await p.locator("main h1").first().waitFor({ timeout: 60000 });
    const m = await p.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      return { ancho: document.documentElement.scrollWidth,
        bajos: [...document.querySelectorAll("main .boton")].filter(vis).filter((e) => e.getBoundingClientRect().height < 44).length,
        verdes: [...document.querySelectorAll("main .boton-principal")].filter(vis).length };
    });
    chequear(m.ancho <= CELU.width && m.bajos === 0 && m.verdes <= 1, `${ruta}: sin desborde, botones altos, ${m.verdes} verde(s)`, `${ruta}: ${JSON.stringify(m)}`);
  }
  if (p.errores.length) falla(`recepción: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
