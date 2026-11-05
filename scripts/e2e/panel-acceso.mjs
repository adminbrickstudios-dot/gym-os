#!/usr/bin/env node
// AUD-15 · Ingresar, elegir gimnasio, super admin y gimnasio no encontrado:
// contraseña mala → mensaje claro; "Soy socio / Soy del equipo"; la dueña en
// /admin → "Sin acceso"; el admin entra al super admin; una dirección que no
// existe → "No encontramos este gimnasio" con la dirección escrita.
//   npm run e2e:acceso            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, PLATAFORMA, PUERTO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const p = await pagina(b, CELU);
  await p.goto(`${G}/ingresar`);
  await p.fill("input[type=email]", "duena@ejemplo.invalid");
  await p.fill("input[type=password]", "mal-mal-mal");
  await p.click("button[type=submit]");
  await p.getByText("El mail o la contraseña no son correctos").waitFor({ timeout: 30000 });
  ok("contraseña mala: “El mail o la contraseña no son correctos”");
  await p.getByRole("link", { name: /Soy socio/ }).click();
  await p.waitForURL(/modo=socio/, { timeout: 30000 });
  chequear(await p.getByRole("button", { name: /Celular/ }).isVisible() && await p.getByRole("button", { name: /Mail/ }).isVisible(), "“Soy socio”: celular, mail o contraseña", "faltan las formas de entrar");
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `Ingresar en el celular sin desborde (${ancho}px)`, `desborda ${ancho}`);

  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid", undefined, PLATAFORMA);
  await d.goto(`${PLATAFORMA}/admin`);
  await d.getByText(/Sin acceso|Solo para administradores/).first().waitFor({ timeout: 60000 });
  ok("la dueña en /admin: “Sin acceso”");

  const a = await pagina(b, COMPU);
  await entrar(a, "admin@ejemplo.invalid", undefined, PLATAFORMA);
  chequear(a.url().endsWith("/admin"), "el admin entra directo al super admin", a.url());
  await a.goto(`${PLATAFORMA}/elegir`);
  await a.getByRole("link", { name: /Super admin de BRIK/ }).waitFor({ timeout: 60000 });
  ok("/elegir le ofrece el super admin");

  const n = await pagina(b, COMPU);
  await n.goto(`http://no-existe-e2e.localhost:${PUERTO}/`);
  await n.getByText("No encontramos este gimnasio").waitFor({ timeout: 60000 });
  chequear(/no-existe-e2e\.localhost/.test(await n.locator("main").innerText()), "una dirección que no existe: “No encontramos este gimnasio” con la dirección escrita", await n.locator("main").innerText());
  for (const x of [p, d, a]) if (x.errores.length) falla(x.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
