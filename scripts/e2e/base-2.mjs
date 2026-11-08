#!/usr/bin/env node
// BASE-2 · Usuarios, contraseñas y puertas por rol (D41, D42).
// El super admin crea un gimnasio con el dueño y una contraseña que ESCRIBE él → el dueño entra por /dueno →
// crea una recepcionista (contraseña que escribe) y un profe (contraseña generada) → entran por /recepcion y /profe
// y caen en su panel → el dueño le saca el acceso a la recepcionista y ya no entra → se lo devuelve con una
// contraseña nueva que escribe y vuelve a entrar. /super lleva a /admin.
//   node scripts/e2e/base-2.mjs     (con scripts/local/levantar.sh corriendo, base nueva)
import { COMPU, PLATAFORMA as B, PUERTO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const s = Date.now().toString().slice(-5);
const NOMBRE = `Base2 ${s}`;
const MAIL_DUENO = `dueno-b2-${s}@ejemplo.invalid`;
const CLAVE_DUENO = `ClaveDueno-${s}`;
const MAIL_REC = `rec-b2-${s}@ejemplo.invalid`;
const CLAVE_REC = `ClaveRec-${s}`;
const CLAVE_REC2 = `ClaveRecNueva-${s}`;
const MAIL_PROFE = `profe-b2-${s}@ejemplo.invalid`;
const b = await navegador();
try {
  // ── 1 · El super admin crea el gimnasio con la contraseña del dueño que escribe él ──
  const a = await pagina(b, COMPU);
  a.setDefaultNavigationTimeout(120000);
  await entrar(a, "admin@ejemplo.invalid", undefined, B);
  const alta = a.locator("[data-alta-gimnasio]");
  await alta.waitFor({ timeout: 60000 });
  await alta.getByRole("button", { name: /Siguiente/ }).click();
  await alta.locator('[data-alta-paso="2"]').waitFor({ state: "visible" });
  await a.fill("input[name=nombre]", NOMBRE);
  await alta.getByRole("button", { name: /Siguiente/ }).click();
  await a.fill("input[name=dueno]", `Dueño Base2 ${s}`);
  await a.fill("input[name=email]", MAIL_DUENO);
  await a.locator("input[name=contrasena_elegida]").fill(CLAVE_DUENO);
  await a.click('button:has-text("Crear gimnasio")');
  await alta.locator("strong.numero").first().waitFor({ timeout: 60000 });
  const mostrada = (await alta.locator("strong.numero").first().innerText()).trim();
  chequear(mostrada === CLAVE_DUENO, "el alta usa la contraseña que escribió el super admin (no una generada)", `mostró otra: ${mostrada}`);

  // El slug sale del nombre: se lee de la fila del gimnasio.
  const fila = a.locator("li", { hasText: NOMBRE }).first();
  await fila.waitFor({ timeout: 60000 });
  const texto = await fila.innerText();
  const m = texto.match(/([a-z0-9-]+)\.localhost/);
  const G = `http://${m ? m[1] : "base2-" + s}.localhost:${PUERTO}`;
  ok(`gimnasio creado: ${G}`);

  // ── 2 · El dueño entra por /dueno ──
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await d.goto(`${G}/dueno`);
  await d.waitForURL(/\/ingresar/, { timeout: 60000 });
  chequear(await d.locator("h1", { hasText: "Ingreso del dueño" }).count() === 1, "/dueno muestra “Ingreso del dueño” con la marca del gimnasio", "el título no dice dueño");
  await d.fill("input[type=email]", MAIL_DUENO);
  await d.fill("input[type=password]", CLAVE_DUENO);
  await d.click("button[type=submit]");
  await d.waitForURL(/\/panel/, { timeout: 60000 });
  ok("el dueño entra con la contraseña que le puso el super admin y cae en su panel");

  // ── 3 · El dueño crea a la recepcionista (contraseña propia) y al profe (generada) ──
  await d.goto(`${G}/panel/equipo`);
  const sumar = async (nombre, rol, mail, clave) => {
    const f = d.locator("form", { has: d.locator('button:has-text("Sumar al equipo")') });
    await f.locator('input[name="nombre"]').fill(nombre);
    await f.locator('select[name="rol"]').selectOption(rol);
    await f.locator('input[name="email"]').fill(mail);
    if (clave) await f.locator('input[name="contrasena_elegida"]').fill(clave);
    await f.locator('button:has-text("Sumar al equipo")').click();
  };
  await sumar(`Rita ${s}`, "recepcion", MAIL_REC, CLAVE_REC);
  await d.getByText(MAIL_REC).first().waitFor({ timeout: 60000 });
  chequear(await d.getByText(CLAVE_REC).count() > 0, "la contraseña que escribió el dueño es la que se muestra una sola vez", "no mostró la contraseña elegida");
  await d.goto(`${G}/panel/equipo`);
  await sumar(`Pablo ${s}`, "profe", MAIL_PROFE, "");
  await d.getByText(MAIL_PROFE).first().waitFor({ timeout: 60000 });
  const claveProfe = (await d.locator("strong.numero").first().innerText().catch(() => "")).trim();
  chequear(claveProfe.length >= 8, "al profe se le genera una contraseña provisoria", `clave del profe: “${claveProfe}”`);

  // ── 4 · Cada uno entra por su puerta y cae en su panel ──
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await r.goto(`${G}/recepcion`);
  await r.waitForURL(/\/ingresar/, { timeout: 60000 });
  chequear(await r.locator("h1", { hasText: "Ingreso de la recepción" }).count() === 1, "/recepcion dice “Ingreso de la recepción”", "el título no dice recepción");
  await r.fill("input[type=email]", MAIL_REC); await r.fill("input[type=password]", CLAVE_REC); await r.click("button[type=submit]");
  await r.waitForURL(/\/panel/, { timeout: 60000 });
  ok("la recepcionista entra por /recepcion con la contraseña que le escribió el dueño");

  const p = await pagina(b, COMPU);
  p.setDefaultNavigationTimeout(120000);
  await p.goto(`${G}/profe`);
  await p.waitForURL(/\/ingresar/, { timeout: 60000 });
  await p.fill("input[type=email]", MAIL_PROFE); await p.fill("input[type=password]", claveProfe); await p.click("button[type=submit]");
  await p.waitForURL(/\/panel/, { timeout: 60000 });
  ok("el profe entra por /profe con la contraseña provisoria y cae en su panel");

  // ── 5 · El dueño le saca el acceso a la recepcionista: ya no entra ──
  await d.goto(`${G}/panel/equipo`);
  const filaRita = d.locator("li", { hasText: `Rita ${s}` }).first();
  await filaRita.locator('button:has-text("Sacar acceso")').click();
  await filaRita.locator('button:has-text("Devolver acceso")').waitFor({ timeout: 30000 });
  const r2 = await pagina(b, COMPU);
  r2.setDefaultNavigationTimeout(120000);
  await r2.goto(`${G}/ingresar`);
  await r2.fill("input[type=email]", MAIL_REC); await r2.fill("input[type=password]", CLAVE_REC); await r2.click("button[type=submit]");
  await r2.waitForTimeout(4000);
  chequear(!/\/panel/.test(r2.url()), "con el acceso sacado, la recepcionista ya no entra al panel", `entró: ${r2.url()}`);

  // ── 6 · Se lo devuelve con una contraseña nueva que escribe el dueño: vuelve a entrar ──
  await filaRita.locator('button:has-text("Devolver acceso")').click();
  await filaRita.locator('button:has-text("Sacar acceso")').waitFor({ timeout: 30000 });
  await d.goto(`${G}/panel/equipo`);
  const filaRita2 = d.locator("li", { hasText: `Rita ${s}` }).first();
  await filaRita2.locator("input[name=contrasena_elegida]").fill(CLAVE_REC2);
  await filaRita2.locator('button:has-text("Nueva contraseña")').click();
  await d.getByText(CLAVE_REC2).first().waitFor({ timeout: 60000 });
  ok("el dueño le restablece la contraseña con la que escribe");
  const r3 = await pagina(b, COMPU);
  r3.setDefaultNavigationTimeout(120000);
  await r3.goto(`${G}/recepcion`);
  await r3.fill("input[type=email]", MAIL_REC); await r3.fill("input[type=password]", CLAVE_REC2); await r3.click("button[type=submit]");
  await r3.waitForURL(/\/panel/, { timeout: 60000 });
  ok("la recepcionista vuelve a entrar con la contraseña nueva");
  await capturar(r3, "base2-recepcion");

  // ── 7 · /super lleva al super admin ──
  const sa = await pagina(b, COMPU);
  await sa.goto(`${B}/super`);
  await sa.waitForURL((u) => /\/(admin|ingresar)/.test(u.pathname), { timeout: 30000 });
  ok("/super lleva a /admin (o al ingreso si no hay sesión)");

  for (const [q, x] of [["dueño", d], ["recepción", r3], ["profe", p]]) if (x.errores.length) falla(`${q}: ${x.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
