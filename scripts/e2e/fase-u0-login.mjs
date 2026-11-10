#!/usr/bin/env node
// Fase U0.1 · "Entro con el mail y la contraseña que creé y dice incorrectos".
// El super admin crea un gimnasio con su dueño (mail con MAYÚSCULAS y la contraseña que escribe él) → el dueño, con sesión nueva cada vez, entra por
// las TRES puertas y aterriza en el panel de SU gimnasio con el rol de dueño:
//   1) /ingresar de la plataforma   2) /g/<slug>/ingresar (conserva el gimnasio y su marca: ya no pierde el slug)   3) /dueno en la dirección del gimnasio
// Además: el mail con espacios y otras mayúsculas entra igual, y los errores dicen el motivo real
// (contraseña mala de una cuenta que existe / mail sin cuenta / cuenta de otro gimnasio).
//   node scripts/e2e/fase-u0-login.mjs     (con scripts/local/levantar.sh corriendo; se corre en GitHub Actions)
import { COMPU, PLATAFORMA as B, PUERTO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const s = Date.now().toString().slice(-6);
const NOMBRE = `Gimnasio U0 ${s}`;
const MAIL = `dueno-u0-${s}@ejemplo.invalid`;
const MAIL_ESCRITO = `  Dueno-U0-${s}@Ejemplo.Invalid `;      // como lo escribe una persona: mayúsculas y espacios
const CLAVE = `ClaveU0-${s}`;
const b = await navegador();

/** El panel correcto con el rol correcto: el título lleva el gimnasio y Mi cuenta dice "Dueño". */
async function aterrizaComoDueno(p, etiqueta) {
  await p.waitForURL(/\/panel/, { timeout: 60000 });
  await p.locator("h1").first().waitFor({ timeout: 60000 });
  chequear((await p.title()).includes(NOMBRE), `${etiqueta}: cae en el panel de ${NOMBRE}`, `${etiqueta}: el título es “${await p.title()}”`);
  await p.goto(p.url().replace(/\/panel.*$/, "/panel/cuenta"));
  await p.locator("h1").first().waitFor({ timeout: 60000 });
  chequear(/Dueñ[oa]/.test(await p.locator("main").innerText()), `${etiqueta}: con el rol de dueño`, `${etiqueta}: no dice que es el dueño`);
}

try {
  // ── El super admin crea el gimnasio y su dueño ──
  const a = await pagina(b, COMPU);
  a.setDefaultNavigationTimeout(120000);
  await entrar(a, "admin@ejemplo.invalid", undefined, B);
  const alta = a.locator("[data-alta-gimnasio]");
  await alta.waitFor({ timeout: 60000 });
  await alta.getByRole("button", { name: /Siguiente/ }).click();
  await alta.locator('[data-alta-paso="2"]').waitFor({ state: "visible" });
  await a.fill("input[name=nombre]", NOMBRE);
  await alta.getByRole("button", { name: /Siguiente/ }).click();
  await a.fill("input[name=dueno]", `Dueño U0 ${s}`);
  await a.fill("input[name=email]", MAIL_ESCRITO.trim());      // con mayúsculas: la cuenta tiene que quedar normalizada
  await a.locator("input[name=contrasena_elegida]").fill(CLAVE);
  await a.click('button:has-text("Crear gimnasio")');
  await alta.locator("strong.numero").first().waitFor({ timeout: 60000 });
  ok("el super admin creó el gimnasio con el dueño (mail con mayúsculas y contraseña propia)");
  const fila = a.locator("li", { hasText: NOMBRE }).first();
  await fila.waitFor({ timeout: 60000 });
  const m = (await fila.innerText()).match(/([a-z0-9-]+)\.localhost/);
  const SLUG = m ? m[1] : null;
  chequear(!!SLUG, `el gimnasio quedó en la dirección ${SLUG}.localhost`, "no se pudo leer la dirección del gimnasio");
  const G = `http://${SLUG}.localhost:${PUERTO}`;

  // ── Puerta 1: /ingresar de la plataforma, con el mail como lo escribe una persona ──
  const p1 = await pagina(b, COMPU);
  p1.setDefaultNavigationTimeout(120000);
  await p1.goto(`${B}/ingresar`);
  await p1.fill("input[type=email]", MAIL_ESCRITO.trim().toUpperCase());
  await p1.fill("input[type=password]", CLAVE);
  await p1.click("button[type=submit]");
  await aterrizaComoDueno(p1, "puerta 1 (/ingresar)");
  await capturar(p1, "u0-puerta1");

  // ── Puerta 2: /g/<slug>/ingresar: no pierde el gimnasio ──
  const p2 = await pagina(b, COMPU);
  p2.setDefaultNavigationTimeout(120000);
  await p2.goto(`${B}/g/${SLUG}/ingresar`);
  await p2.waitForURL(/\/ingresar/, { timeout: 60000 });
  chequear(/[?&]gimnasio=/.test(p2.url()) && p2.url().includes(`gimnasio=${SLUG}`), "puerta 2: /g/<slug>/ingresar sigue siendo el ingreso de ESE gimnasio (la dirección lleva el slug)", `puerta 2: terminó en ${p2.url()}`);
  chequear((await p2.locator("body").innerText()).includes(NOMBRE), "puerta 2: muestra la marca del gimnasio", "puerta 2: no muestra el nombre del gimnasio");
  await capturar(p2, "u0-puerta2-ingreso");
  // Errores con el motivo real, sin perder el gimnasio.
  await p2.fill("input[type=email]", MAIL);
  await p2.fill("input[type=password]", "contraseña-equivocada");
  await p2.click("button[type=submit]");
  await p2.locator("[role=alert]").first().waitFor({ timeout: 30000 });
  const malaClave = (await p2.locator("[role=alert]").first().innerText()).replace(/\s+/g, " ");
  chequear(/no son correctos/.test(malaClave) && /tiene cuenta/.test(malaClave), `contraseña mala de una cuenta que existe: “${malaClave.slice(0, 90)}…”`, `contraseña mala: “${malaClave}”`);
  chequear(p2.url().includes(`gimnasio=${SLUG}`), "y el error no hizo perder el gimnasio", `el error terminó en ${p2.url()}`);
  await p2.fill("input[type=email]", `no-existe-${s}@ejemplo.invalid`);
  await p2.fill("input[type=password]", "cualquiera-123");
  await p2.click("button[type=submit]");
  await p2.locator("[role=alert]", { hasText: /no tiene cuenta/ }).first().waitFor({ timeout: 30000 });
  ok("un mail sin cuenta: “… no tiene cuenta …”");
  await p2.fill("input[type=email]", `  ${MAIL.toUpperCase()}  `.trim());
  await p2.fill("input[type=password]", CLAVE);
  await p2.click("button[type=submit]");
  await aterrizaComoDueno(p2, "puerta 2 (/g/<slug>/ingresar)");

  // ── Puerta 3: /dueno en la dirección del gimnasio ──
  const p3 = await pagina(b, COMPU);
  p3.setDefaultNavigationTimeout(120000);
  await p3.goto(`${G}/dueno`);
  await p3.waitForURL(/\/ingresar/, { timeout: 60000 });
  await p3.fill("input[type=email]", MAIL);
  await p3.fill("input[type=password]", CLAVE);
  await p3.click("button[type=submit]");
  await aterrizaComoDueno(p3, "puerta 3 (/dueno)");

  // ── Una cuenta de otro gimnasio dice que no es de este (no "incorrectos") ──
  const p4 = await pagina(b, COMPU);
  p4.setDefaultNavigationTimeout(120000);
  await p4.goto(`${B}/g/${SLUG}/ingresar`);
  await p4.waitForURL(/\/ingresar/, { timeout: 60000 });
  await p4.fill("input[type=email]", "duena@ejemplo.invalid");     // la dueña del demo
  await p4.fill("input[type=password]", "demo-gymos");
  await p4.click("button[type=submit]");
  await p4.locator("[role=alert]", { hasText: /no es de este gimnasio/ }).first().waitFor({ timeout: 60000 });
  ok("la dueña de otro gimnasio: “Tu usuario no es de este gimnasio” (no “mail o contraseña incorrectos”)");

  for (const [n, x] of [["puerta 1", p1], ["puerta 2", p2], ["puerta 3", p3], ["otro gimnasio", p4]]) {
    const reales = x.errores.filter((e) => !/HTTP 40[13] /.test(e));
    if (reales.length) falla(`${n}: errores de página: ${reales.join(" | ")}`);
  }
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.stack : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
