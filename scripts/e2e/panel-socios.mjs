#!/usr/bin/env node
// AUD-3 · Socios botón por botón: buscar (nombre, DNI, número, sin
// resultados), alta (DNI repetido, válida), ficha (Cobrar, WhatsApp, Editar,
// Asignar plan, Dar de baja, Volver a darlo de alta), recepción, celular.
//   npm run e2e:socios            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s = Date.now().toString().slice(-6);
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  const buscar = async (texto) => {
    await p.goto(`${G}/panel/socios${texto ? `?q=${encodeURIComponent(texto)}` : ""}`);
    await p.locator("main").waitFor();
    return p.locator('main ul a[href^="/panel/socios/"]');
  };

  // ── Lista y búsqueda ──
  let filas = await buscar("");
  const n = await filas.count();
  chequear(n > 0 && n <= 60, `la lista muestra ${n} socios con su estado`, `la lista muestra ${n}`);
  const primera = (await filas.first().innerText()).replace(/\s+/g, " ");
  const numero = primera.match(/#(\d+)/)?.[1];
  const nombre = primera.split("#")[0].trim().split(" ")[0];
  filas = await buscar(nombre);
  chequear(await filas.count() > 0 && (await filas.first().innerText()).includes(nombre), `buscar “${nombre}” lo encuentra`, `buscar ${nombre} no encontró`);
  filas = await buscar(numero);
  chequear((await filas.allInnerTexts()).some((t) => t.includes(`#${numero}`)), `buscar el número ${numero} lo encuentra`, `buscar ${numero} no encontró`);
  filas = await buscar(`zzz${s}`);
  chequear(await filas.count() === 0 && await aparece(p.locator('main a:has-text("Darlo de alta")')), "sin resultados: “Nadie con …” y “Darlo de alta”", "sin resultados no ofrece darlo de alta");

  // ── Alta ──
  await p.goto(`${G}/panel/socios/nuevo`);
  await p.locator('input[name="nombre"]').waitFor();
  const dniUsado = await p.evaluate(async () => null);
  await p.locator('input[name="nombre"]').fill(`Auditado`);
  await p.locator('input[name="apellido"]').fill(`Socio${s}`);
  await p.locator('input[name="dni"]').fill(`5${s}1`);
  await p.locator('input[name="telefono"]').fill(`000 15 ${s.slice(0, 2)}-${s.slice(2)}5`);   // con el 15 del celular
  await p.locator('button:has-text("Dar de alta")').click();
  await p.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}/, { timeout: 60000 });
  const ficha = p.url();
  ok("alta válida → abre la ficha");
  // DNI repetido
  await p.goto(`${G}/panel/socios/nuevo`);
  await p.locator('input[name="nombre"]').fill("Repetido");
  await p.locator('input[name="dni"]').fill(`5${s}1`);
  await p.locator('button:has-text("Dar de alta")').click();
  await p.locator('main [role="alert"]').waitFor({ timeout: 30000 });
  const m = (await p.locator('main [role="alert"]').innerText()).replace(/\s+/g, " ").trim();
  chequear(/Ya hay un socio con el DNI/.test(m), `DNI repetido → “${m}”`, `DNI repetido dio “${m}”`);
  void dniUsado;

  // ── Ficha ──
  await p.goto(ficha);
  await p.locator("h1").waitFor();
  const cobrar = p.locator('main a:has-text("Cobrar")');
  chequear(await cobrar.count() === 1 && /\/panel\/vender\?socio=/.test(await cobrar.getAttribute("href")), "sin plan: “Cobrar” lleva a Vender con el socio", "falta Cobrar");
  const wa = await p.locator('main a:has-text("WhatsApp")').getAttribute("href");
  chequear(new RegExp(`^https://wa\\.me/549000${s}5$`).test(wa), `WhatsApp: ${wa}`, `WhatsApp: ${wa}`);
  // Editar
  await p.locator('main a:has-text("Editar")').click();
  await p.waitForURL(/\/editar$/, { timeout: 30000 });
  await p.locator('input[name="apellido"]').fill(`Editado${s}`);
  await p.locator('button:has-text("Guardar cambios")').click();
  await p.waitForURL((u) => !u.pathname.endsWith("/editar"), { timeout: 60000 });
  chequear((await p.locator("h1").innerText()).includes(`Editado${s}`), "Editar → el apellido nuevo en la ficha", "no se ve el apellido editado");
  // Asignar plan
  await p.locator('button:has-text("Asignar plan")').click();
  const planBtn = p.locator("main .tarjeta button.boton").first();
  const planNombre = (await planBtn.innerText()).trim().split("\n")[0].trim();   // el botón también muestra el precio
  await planBtn.click();
  await p.locator("main", { hasText: planNombre }).locator("dd", { hasText: planNombre }).first().waitFor({ timeout: 30000 });
  ok(`Asignar plan → ${planNombre} en la ficha`);
  chequear(await p.locator('button:has-text("Cambiar plan")').count() === 1, "con plan, el botón pasa a “Cambiar plan”", "no cambió a Cambiar plan");
  // Dar de baja y volver
  await p.locator('button:has-text("Dar de baja")').click();
  await p.locator('button:has-text("Precio")').click();
  await p.locator("[data-dado-de-baja]").waitFor({ timeout: 30000 });
  chequear(await p.locator('main a:has-text("Editar")').count() === 0, "dado de baja: “Dado de baja el …” y ofrece volver a darlo de alta", "dado de baja sigue con botones");
  await capturar(p, "aud3-compu-baja");
  await p.locator('button:has-text("Volver a darlo de alta")').click();
  await p.locator('main a:has-text("Editar")').waitFor({ timeout: 30000 });
  chequear(await p.locator('button:has-text("Asignar plan")').count() === 1, "volver a darlo de alta → la ficha vuelve, sin plan (hay que asignarlo y cobrar)", "al volver no ofrece asignar plan");
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
  await p.context().close();

  // ── Recepción en el celular ──
  const r = await pagina(b, CELU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(ficha);
  await r.locator("h1").waitFor();
  chequear(await r.locator('main a:has-text("Editar")').count() === 1 && await r.locator('button:has-text("Dar de baja")').count() === 1, "recepción: la misma ficha con sus botones", "recepción no ve los botones");
  const ancho = await r.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular: ficha sin desborde (${ancho}px)`, `celular: la ficha mide ${ancho}px`);
  await capturar(r, "aud3-celu-ficha", true);
  await r.goto(`${G}/panel/socios`);
  const ancho2 = await r.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho2 <= CELU.width, `celular: lista sin desborde (${ancho2}px)`, `celular: la lista mide ${ancho2}px`);
  await r.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
