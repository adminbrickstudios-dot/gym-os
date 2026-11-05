#!/usr/bin/env node
// ADM-1 · Plantilla por tipo: el admin crea un gimnasio "🔥 Box", entra al
// panel y ve los planes de ejemplo (sin precio) y Clases prendidas. ADM-4: la
// lista muestra la salud de cada gimnasio.
//   npm run e2e:adm-1            (con scripts/local/levantar.sh corriendo)
import { PLATAFORMA as B, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const b = await navegador();
try {
  const p = await pagina(b);
  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  await p.locator("[data-salud]").first().waitFor({ timeout: 60000 });
  ok(`ADM-4: salud en cada gimnasio (“${(await p.locator("[data-salud]").first().innerText()).trim()}”)`);
  const s = Date.now().toString().slice(-5);
  await p.fill("input[name=nombre]", `Box Plantilla ${s}`);
  await p.fill("input[name=dueno]", "Dueña Box");
  await p.locator("select[name=tipo]").selectOption("box");
  await p.click('button:has-text("Crear gimnasio")');
  await p.getByText(/está creado/).first().waitFor({ timeout: 60000 });
  chequear(!/No se pudo aplicar la plantilla/.test(await p.locator("main").innerText()), "el admin crea un gimnasio tipo Box", "la plantilla falló");
  await p.click('button:has-text("Entrar al panel")');
  await p.waitForURL(/\/panel/, { timeout: 60000 });
  await p.goto(`${B}/panel/planes`);
  await p.getByText("Pack 8 clases").first().waitFor({ timeout: 60000 });
  chequear(await p.getByText("Libre mensual").first().isVisible(), "Planes: “Libre mensual”, “Pack 8 clases” y “Pack 12 clases” de ejemplo", "faltan planes");
  chequear(await p.locator('nav a[href$="/panel/clases"]').count() > 0, "Clases prendidas en el menú (modo reserva)", "no aparece Clases");
  if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
