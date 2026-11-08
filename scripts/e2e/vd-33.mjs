#!/usr/bin/env node
// VD-33 · Ingreso más lindo y "primero quién, después cómo": un campo "celular o mail" con los tres métodos
// de siempre (contraseña, código por mail, código por celular) desde la misma pantalla; el código de 6 dígitos se
// verifica solo y tiene "Reenviar en 0:59"; los errores no revelan si una cuenta existe; "olvidé mi contraseña"
// funciona de punta a punta; se ve la marca del gimnasio (y la de Gym OS en la plataforma); reduced-motion sin
// animación; celular sin desbordes.
//   node scripts/e2e/vd-33.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { CELU, CLAVE_DEMO, COMPU, GIMNASIO, PLATAFORMA, chequear, entrar, entrarSocio, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim, nombre: nombreGim }] = (await db.query(`select id, nombre from public.gimnasios where slug = 'demo'`)).rows;
const MAIL = `vd33-${Date.now() % 1000000}@ejemplo.invalid`;
const [{ id: socio }] = (await db.query(`insert into public.socios (gimnasio_id, nombre, apellido, email) values ($1,'Entra','Vd Treinta',$2) returning id`, [gim, MAIL])).rows;
const codigo = (dest) => String(JSON.parse(readFileSync(join(process.cwd(), ".local", "codigos.json"), "utf8"))[dest]);
const sinDesborde = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

const b = await navegador();
try {
  // Marca: Gym OS en la plataforma; la del demo en su dirección y en /g/demo.
  const m = await pagina(b, CELU);
  await m.goto(`${PLATAFORMA}/ingresar`);
  chequear(((await m.locator("[data-marca-ingreso]").textContent())?.trim()) === "Base", "plataforma: la marca de Gym OS", "la plataforma no muestra Gym OS");
  await m.goto(`${G}/ingresar?modo=socio`);
  const marcaDemo = (await m.locator("[data-marca-ingreso]").textContent())?.trim();
  chequear(marcaDemo === nombreGim, `en la dirección del demo se ve su marca (${marcaDemo})`, `marca ${marcaDemo} ≠ ${nombreGim}`);
  await m.goto(`${PLATAFORMA}/g/demo`);
  await m.goto(`${PLATAFORMA}/ingresar?modo=socio`);
  chequear(((await m.locator("[data-marca-ingreso]").textContent())?.trim()) === nombreGim, "desde /g/demo también se ve la marca del demo", "desde /g/demo no se ve la marca del demo");
  chequear(await m.getByText("Tu celular o tu mail", { exact: true }).isVisible() && await m.getByRole("button", { name: /Celular/ }).isVisible()
    && await m.getByRole("button", { name: /Mail/ }).isVisible() && await m.getByRole("button", { name: /Contraseña/ }).isVisible(),
  "un campo “celular o mail” y los tres métodos a la vista", "faltan el campo o los métodos");
  chequear(await sinDesborde(m), "celular 390: ingreso del socio sin desborde", "el ingreso del socio desborda en 390");
  await m.goto(`${G}/ingresar`);
  chequear(await sinDesborde(m), "celular 390: ingreso del equipo sin desborde", "el ingreso del equipo desborda en 390");

  // 1 · Contraseña (equipo): igual que siempre.
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  chequear(/\/panel/.test(d.url()), "contraseña: la dueña entra al panel", `fue a ${d.url()}`);

  // Contraseña mala: el mismo mensaje exista o no la cuenta.
  const e = await pagina(b, CELU);
  const textoError = async (mail) => {
    await e.goto(`${G}/ingresar`);
    await e.fill("input[type=email]", mail);
    await e.fill("input[type=password]", "mal-mal-mal");
    await e.click("button[type=submit]");
    return (await e.locator('[role=alert]').filter({ hasText: /\S/ }).first().innerText({ timeout: 30000 })).replace(/^\S+\s*/, "").trim();
  };
  const conCuenta = await textoError("duena@ejemplo.invalid");
  const sinCuenta = await textoError(`nadie-${Date.now() % 100000}@ejemplo.invalid`);
  chequear(conCuenta === sinCuenta && /no son correctos/.test(conCuenta), "contraseña mala: el mismo mensaje con cuenta y sin cuenta", `“${conCuenta}” ≠ “${sinCuenta}”`);

  // 2 · Código por mail: se escribe el mail en el mismo campo y el código se verifica solo (sin apretar Entrar).
  const s = await pagina(b, CELU);
  await s.goto(`${G}/ingresar?modo=socio`);
  await s.fill("input[name=telefono]", MAIL);
  await s.locator("input[name=email]").waitFor({ timeout: 10000 });
  chequear(await s.getByRole("button", { name: /Mail/ }).getAttribute("aria-pressed") === "true", "con una @ el campo pasa solo a mail", "el campo no pasó a mail");
  await s.getByRole("button", { name: /Mandame el código/ }).click();
  await s.locator("input[name=codigo]").waitFor({ timeout: 30000 });
  chequear(await s.locator("input[name=codigo]").getAttribute("autocomplete") === "one-time-code" && await s.locator("input[name=codigo]").getAttribute("inputmode") === "numeric",
    "el código se completa solo (one-time-code, numérico)", "el campo del código no tiene one-time-code / numeric");
  const reenviar = s.locator("[data-reenviar]");
  chequear(await reenviar.isDisabled() && /Reenviar en 0:\d\d/.test(await reenviar.innerText()), "“Reenviar en 0:59” cuenta hacia atrás", `reenviar: ${await reenviar.innerText()}`);
  chequear(await sinDesborde(s), "celular 390: paso del código sin desborde", "el paso del código desborda");
  await s.fill("input[name=codigo]", "000000"); // un código malo: se verifica solo, avisa y deja probar de nuevo
  await s.getByText(/El código no es correcto o venció/).waitFor({ timeout: 30000 });
  chequear(true, "código malo: avisa sin cerrar el paso", "");
  await s.fill("input[name=codigo]", codigo(MAIL));
  await s.waitForURL(/\/app/, { timeout: 60000 });
  chequear(true, "código por mail: entra a la app apenas se completan los 6 dígitos", "");

  // 3 · Código por celular, con el botón de siempre (entrarSocio).
  const c = await pagina(b, CELU);
  await entrarSocio(c, "+5490000100002");
  chequear(/\/app/.test(c.url()), "código por celular: entra a la app desde la misma pantalla", `fue a ${c.url()}`);

  // 4 · Pedir el código no revela cuentas: con o sin cuenta, el mismo paso y el mismo texto.
  const pasoCodigo = async (mail) => {
    const q = await pagina(b, CELU);
    await q.goto(`${G}/ingresar/recuperar`);
    await q.fill("input[name=email]", mail);
    await q.getByRole("button", { name: /Mandame el código/ }).click();
    await q.locator("input[name=codigo]").waitFor({ timeout: 30000 });
    return (await q.locator("[data-paso-codigo] p").first().innerText()).replace(mail, "<mail>");
  };
  const t1 = await pasoCodigo("duena@ejemplo.invalid");
  const t2 = await pasoCodigo(`fantasma-${Date.now() % 100000}@ejemplo.invalid`);
  chequear(t1 === t2, "olvidé mi contraseña: el mismo aviso con cuenta y sin cuenta", `“${t1}” ≠ “${t2}”`);

  // 5 · Olvidé mi contraseña de punta a punta (se deja la misma contraseña del demo para no romper los demás e2e).
  const r = await pagina(b, CELU);
  await r.goto(`${G}/ingresar`);
  await r.getByRole("link", { name: /Te olvidaste la contraseña/ }).click();
  await r.waitForURL(/\/ingresar\/recuperar/, { timeout: 30000 });
  await r.fill("input[name=email]", "duena@ejemplo.invalid");
  await r.getByRole("button", { name: /Mandame el código/ }).click();
  await r.locator("input[name=codigo]").waitFor({ timeout: 30000 });
  await r.fill("input[name=codigo]", codigo("duena@ejemplo.invalid"));
  await r.locator("input[name=contrasena]").waitFor({ timeout: 30000 });
  chequear(await sinDesborde(r), "celular 390: contraseña nueva sin desborde", "la contraseña nueva desborda");
  await r.fill("input[name=contrasena]", CLAVE_DEMO);
  await r.fill("input[name=repetir]", `${CLAVE_DEMO}x`);
  await r.getByRole("button", { name: /Guardar y entrar/ }).click();
  await r.getByText(/tienen que ser iguales/).waitFor({ timeout: 30000 });
  await r.fill("input[name=contrasena]", CLAVE_DEMO);
  await r.fill("input[name=repetir]", CLAVE_DEMO);
  await r.getByRole("button", { name: /Guardar y entrar/ }).click();
  await r.waitForURL(/\/panel/, { timeout: 60000 });
  chequear(true, "olvidé mi contraseña: código, contraseña nueva y entra al panel", "");
  const otra = await pagina(b, COMPU);
  await entrar(otra, "duena@ejemplo.invalid");
  chequear(/\/panel/.test(otra.url()), "la contraseña nueva sirve para entrar", `fue a ${otra.url()}`);

  // 6 · Reduced-motion: sin animación; con movimiento normal, el fondo se mueve.
  const normal = await pagina(b, COMPU);
  await normal.goto(`${G}/ingresar`);
  const anim = (p) => p.evaluate(() => [getComputedStyle(document.querySelector("[data-ingreso]"), "::before").animationName, getComputedStyle(document.querySelector(".ingreso-logo")).animationName]);
  const [fondoN, logoN] = await anim(normal);
  chequear(fondoN !== "none" && logoN !== "none", "con movimiento normal: el fondo y el logo se animan", `fondo ${fondoN}, logo ${logoN}`);
  const quieto = await pagina(b, COMPU, { reducedMotion: "reduce" });
  await quieto.goto(`${G}/ingresar`);
  const [fondoR, logoR] = await anim(quieto);
  chequear(fondoR === "none" && logoR === "none", "reduced-motion: sin animación", `fondo ${fondoR}, logo ${logoR}`);

  for (const p of [m, d, e, s, c, r, otra, normal, quieto]) if (p.errores.length) falla(`errores de la página: ${p.errores.join(" | ")}`);
} catch (err) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? err.message : err.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.socios set dado_de_baja_en = now(), motivo_baja = 'otro' where id = $1`, [socio]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
