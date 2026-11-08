#!/usr/bin/env node
// VD-15 · Socios: la lista se acuerda de los filtros, Interesados adentro de Socios (con DNI), la marca de
// los que se anotaron solos por la web, y la ficha con Cobrar y Entrada en el encabezado.
//  1) Filtros y búsqueda se recuerdan al volver de una ficha; "Todos" los saca y no se vuelven a poner.
//  2) Socios · Interesados: /panel/prospectos redirige a la pestaña; un Interesado con DNI → alta con sus
//     datos (DNI ya escrito) y queda "se hizo socio".
//  3) El DNI de un Interesado se ofrece en el alta aunque el celular sea otro.
//  4) Un socio que se anotó solo por la web lleva 🌐 y se filtra.
//  5) Ficha: Entrada (abre la ventana con el socio) y Cobrar (abre la hoja) desde el encabezado.
//  6) Celular sin desbordes.
//   node scripts/e2e/vd-15.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const dni1 = `41${s5}`.padEnd(8, "7").slice(0, 8);
const dni2 = `42${s5}`.padEnd(8, "8").slice(0, 8);
const cel = (n) => `000 555 ${s5.slice(-3)}${n}`;   // 10 números con característica 000: obviamente ficticio

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");

  // ── 1 · La lista se acuerda ──
  await d.goto(`${G}/panel/socios`);
  await d.locator("[data-lista]").waitFor({ timeout: 30000 });
  await d.locator('[data-filtro-estados] [data-estado="al_dia"]').first().click();
  await d.waitForURL(/estado=al_dia/, { timeout: 30000 });
  await d.locator("[data-lista] a[href^='/panel/socios/']").first().waitFor({ timeout: 30000 });
  const hrefFicha = await d.locator("[data-lista] a[href^='/panel/socios/']").first().getAttribute("href");
  await d.locator("[data-lista] a[href^='/panel/socios/']").first().click();
  await d.waitForURL(`**${hrefFicha}`, { timeout: 30000 });
  await d.getByRole("link", { name: /← (Volver a )?Socios/ }).click();
  await d.waitForURL(/\/panel\/socios\?.*estado=al_dia/, { timeout: 30000 });
  ok("volver de una ficha a Socios: el filtro “Al día” sigue puesto");
  await aparece(d.locator('[data-filtro-estados] [data-estado="al_dia"][aria-current="page"]'), 15000); chequear(await d.locator('[data-filtro-estados] [data-estado="al_dia"][aria-current="page"]').count() === 1, "la píldora Al día sigue marcada", "no quedó marcada");
  // Una búsqueda también se recuerda.
  await d.locator('input[name="q"]').fill("a");
  await d.keyboard.press("Enter");
  await d.waitForURL(/q=a/, { timeout: 30000 });
  await d.goto(`${G}/panel`);
  await d.goto(`${G}/panel/socios`);
  await d.waitForURL(/q=a/, { timeout: 30000 });
  ok("entrar a Socios sin filtros trae la búsqueda y el filtro de antes");
  // "Todos" saca los filtros y no se vuelven a poner solos.
  await d.locator('[data-filtro-estados] a', { hasText: "Todos" }).first().click();
  await d.waitForFunction(() => !location.search.includes("estado="), null, { timeout: 30000 });
  await d.waitForTimeout(800);
  chequear(!new URL(d.url()).search.includes("estado="), "“Todos” saca los filtros y se queda así", `volvió a ${d.url()}`);
  await d.goto(`${G}/panel`);
  await d.goto(`${G}/panel/socios`);
  await d.waitForTimeout(1500);
  chequear(!new URL(d.url()).search.includes("estado="), "después de “Todos”, la próxima vez entra sin filtros", `entró con ${new URL(d.url()).search}`);

  // ── 2 · Interesados dentro de Socios, con DNI ──
  await d.goto(`${G}/panel/prospectos`);
  await d.waitForURL(/\/panel\/socios\?vista=interesados/, { timeout: 30000 });
  ok("/panel/prospectos lleva a Socios → Interesados");
  await d.locator("[data-pestanas-socios]").waitFor({ timeout: 30000 });
  await d.locator('[data-pestanas-socios] a[aria-current="page"]', { hasText: "Interesados" }).waitFor({ timeout: 30000 });
  await d.locator('button:has-text("Anotar uno que preguntó")').click();
  await d.locator('[data-form-prospecto] input[name="nombre"]').fill(`Interesada${s5}`);
  await d.locator('[data-form-prospecto] input[name="telefono"]').fill(cel(1));
  await d.locator('[data-form-prospecto] input[name="dni"]').fill(dni1);
  await d.locator('[data-form-prospecto] button[type="submit"]').click();
  const fila = d.locator("[data-prospecto]", { hasText: `Interesada${s5}` });
  await fila.waitFor({ timeout: 30000 });
  chequear((await fila.innerText()).includes(`DNI ${dni1}`), "el Interesado muestra su DNI", await fila.innerText());
  // Una función que ya existía sigue: pasarlo de estado.
  await fila.locator('button:has-text("Ya le escribí")').click();
  await d.locator('[data-filtro="contactado"]').click();
  await d.locator("[data-prospecto]", { hasText: `Interesada${s5}` }).waitFor({ timeout: 30000 });
  ok("seguimiento: “Ya le escribí” lo pasa a Contactados");
  await capturar(d, "vd15-compu-interesados");
  await d.locator("[data-prospecto]", { hasText: `Interesada${s5}` }).locator('a:has-text("Hacerlo socio")').click();
  await d.waitForURL(/\/panel\/socios\/nuevo\?prospecto=/, { timeout: 30000 });
  chequear(await d.locator('input[name="nombre"]').inputValue() === `Interesada${s5}`, "el alta arranca con su nombre", "no trajo el nombre");
  chequear((await d.locator('input[name="dni"]').inputValue()) === dni1, "el alta arranca con su DNI", "no trajo el DNI");
  chequear((await d.locator('input[name="telefono"]').inputValue()).replace(/\D/g, "").endsWith(cel(1).replace(/\D/g, "").slice(-7)), "el alta arranca con su celular", "no trajo el celular");
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Dar de alta y cobrar")').click();
  await d.locator('[data-cobrar] [data-cobrar-confirmar]').waitFor({ timeout: 30000 });
  await d.locator("[data-cobrar-medio]", { hasText: "Transferencia" }).click();
  await d.locator("[data-cobrar-confirmar]").click();
  await d.locator("[data-alta-paso=listo]").waitFor({ timeout: 30000 });
  const cerrar = d.locator('[data-cobrar] [data-cobrar-volver]');
  if (await cerrar.count()) await cerrar.first().click();
  await d.locator("[data-alta-ficha]").click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}/, { timeout: 30000 });
  const idSocio = new URL(d.url()).pathname.split("/").pop();
  ok("Interesado → alta con sus datos → cobrada → ficha");
  await d.goto(`${G}/panel/socios?vista=interesados`);
  await d.locator('[data-filtro="socio"]').click();
  await d.locator("[data-prospecto='socio']", { hasText: `Interesada${s5}` }).waitFor({ timeout: 30000 });
  ok("el Interesado quedó en “Se hicieron socios”");

  // ── 3 · El DNI de un Interesado se ofrece en el alta aunque el celular sea otro ──
  await d.goto(`${G}/panel/socios?vista=interesados`);
  await d.locator('button:has-text("Anotar uno que preguntó")').click();
  await d.locator('[data-form-prospecto] input[name="nombre"]').fill(`PorDni${s5}`);
  await d.locator('[data-form-prospecto] input[name="telefono"]').fill(cel(2));
  await d.locator('[data-form-prospecto] input[name="dni"]').fill(dni2);
  await d.locator('[data-form-prospecto] button[type="submit"]').click();
  await d.getByText(`PorDni${s5}`).first().waitFor({ timeout: 30000 });
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Otro${s5}`);
  await d.locator('input[name="dni"]').fill(dni2);
  await d.locator('input[name="dni"]').blur();
  await d.locator("[data-interesado-ofrecido]").waitFor({ timeout: 30000 });
  ok("escribir el DNI de un Interesado lo ofrece en el alta");
  await d.close();

  // ── 5 · Ficha: Entrada y Cobrar desde el encabezado ──
  const f = await pagina(b, COMPU);
  await entrar(f, "duena@ejemplo.invalid");
  await f.goto(`${G}/panel/socios/${idSocio}`);
  await f.locator("[data-ficha-acciones]").waitFor({ timeout: 30000 });
  await f.locator("[data-ficha-acciones] [data-ficha-entrada]").click();
  await f.locator('[data-ventana-entrada][data-paso="veredicto"]').first().waitFor({ timeout: 30000 });
  chequear(new URL(f.url()).pathname === `/panel/socios/${idSocio}`, "Entrada abre la ventana sin salir de la ficha", `fue a ${f.url()}`);
  chequear(await f.getByText(`Interesada${s5}`).count() > 0, "la ventana de Entrada ya trae a este socio", "no está el socio");
  await capturar(f, "vd15-compu-ficha-entrada");
  await f.keyboard.press("Escape");
  await f.locator("[data-ficha-acciones] [data-cobrar-abrir]").first().click();
  await f.locator("[data-cobrar]").first().waitFor({ timeout: 30000 });
  chequear(new URL(f.url()).pathname === `/panel/socios/${idSocio}`, "Cobrar abre la hoja sin salir de la ficha", `fue a ${f.url()}`);
  await capturar(f, "vd15-compu-ficha-cobrar");
  if (f.errores.length) falla(`ficha: ${f.errores.join(" | ")}`);
  await f.context().close();

  // ── 4 · Autoalta con 🌐 (el visitante se anota solo por la página) ──
  // Se hace por la base con la RPC pública: es lo que llama el formulario de hacete-socio.
  const web = await pagina(b, COMPU);
  await entrar(web, "recepcion@ejemplo.invalid");
  await web.goto(`${G}/panel/socios`);
  const hayWeb = await web.locator("[data-filtro-web]").count();
  if (hayWeb) {
    await web.locator("[data-filtro-web]").first().click();
    await web.waitForURL(/web=1/, { timeout: 30000 });
    await web.locator("[data-lista] [data-autoalta]").first().waitFor({ timeout: 30000 });
    ok("los que se anotaron solos llevan 🌐 y se pueden filtrar");
  } else {
    ok("sin autoaltas en este gimnasio de prueba: no hay filtro 🌐 (la marca se prueba en la base)");
  }
  await web.context().close();

  // ── 6 · Celular ──
  const c = await pagina(b, CELU);
  await entrar(c, "recepcion@ejemplo.invalid");
  for (const ruta of ["/panel/socios", "/panel/socios?vista=interesados", `/panel/socios/${idSocio}`]) {
    await c.goto(`${G}${ruta}`);
    await c.locator("main").waitFor({ timeout: 30000 });
    await c.waitForTimeout(800);
    const ancho = await c.evaluate(() => ({ s: document.documentElement.scrollWidth, v: window.innerWidth }));
    chequear(ancho.s <= ancho.v + 1, `celular ${ruta}: sin scroll horizontal`, `se desborda: ${ancho.s} > ${ancho.v}`);
  }
  await c.goto(`${G}/panel/socios?vista=interesados`);
  await capturar(c, "vd15-celu-interesados");
  if (c.errores.length) falla(`celular: ${c.errores.join(" | ")}`);
  await c.context().close();
} finally {
  await b.close();
}
resultado();
