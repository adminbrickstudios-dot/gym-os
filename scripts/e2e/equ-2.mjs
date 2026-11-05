#!/usr/bin/env node
// EQU-2 · El profe busca socios (D3): Ctrl+K con un nombre muestra nombre y
// semáforo ("Puede entrar" / "No puede entrar"), sin número, teléfono ni
// plata, y no abre la ficha.
//   npm run e2e:equ-2            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "profe@ejemplo.invalid");
  await p.goto(`${G}/panel`);
  await p.locator("main h1").first().waitFor({ timeout: 60000 });
  await p.keyboard.press("Control+k");
  await p.getByRole("dialog", { name: "Buscar" }).locator("input").fill("testigo");
  const fila = p.locator("[data-socio-profe]").first();
  await fila.waitFor({ timeout: 30000 });
  const textos = await p.locator("[data-socio-profe]").allInnerTexts();
  chequear(textos.every((x) => /(Puede|No puede) entrar/.test(x) && !/\$|#\d|\+54/.test(x)),
    `el profe ve ${textos.length} socios con nombre y semáforo, sin plata, número ni teléfono`, textos.join(" | "));
  chequear(await p.getByRole("dialog", { name: "Buscar" }).locator('a[href*="/panel/socios/"]').count() === 0, "no hay link a la ficha", "hay links a la ficha");
  if (p.errores.length) falla(`profe: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
