#!/usr/bin/env node
// VD-61 · Ingreso, segunda pasada: cada caso con su pantalla clara, en compu y en celular (390 px y un iPhone de Safari).
//   - no tengo cuenta (equipo y socio), olvidé la contraseña (con o sin SMTP), código malo/vencido,
//     demasiados pedidos de código, sin internet (y que vuelve solo);
//   - sin desbordes, inputs de 16 px (Safari no hace zoom), botones de 44 px, teclado numérico en el código;
//   - registro del socio en cuatro pasos con nombre; la recepción ve “Atiende X · Cambiar” fijo mientras scrollea;
//   - el botón de Google aparece solo cuando están las credenciales (ENTRAR_CON_GOOGLE=1 en la app).
//   npm run e2e:vd-61            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, PLATAFORMA, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const IPHONE = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", isMobile: true, hasTouch: true, deviceScaleFactor: 3 };
const sinDesborde = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
// Todo lo que se toca en la tarjeta de ingreso: botones, links de acción e inputs, al menos 44 px de alto; los inputs de texto, 16 px.
const medidas = (p) => p.evaluate(() => {
  const flojos = [];
  document.querySelectorAll("main button, main input:not([type=hidden]):not([type=checkbox]):not([type=radio]), main a.boton").forEach((e) => {
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.height < 43.5) flojos.push(`alto ${Math.round(r.height)}: ${(e.textContent || e.getAttribute("name") || e.tagName).trim().slice(0, 30)}`);
    if (e.tagName === "INPUT" && parseFloat(getComputedStyle(e).fontSize) < 16) flojos.push(`fuente ${getComputedStyle(e).fontSize}: ${e.getAttribute("name")}`);
  });
  return flojos;
});
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
await db.query("delete from privado.intentos_pin");
// SEG-1 cuenta 20 pedidos de código por hora desde la misma conexión (acá todos salen de localhost): las corridas anteriores de este y otros recorridos agotan ese cupo y el sexto pedido del mismo celular recibiría el aviso de la conexión en vez del del celular.
await db.query("delete from public.pedidos_codigo where creado_en is not null");
const b = await navegador();
try {
  for (const [tam, vp, extra] of [["compu", COMPU, {}], ["celu", CELU, {}], ["iphone", { width: 390, height: 844 }, IPHONE]]) {
    // 1 · No tengo cuenta: equipo y socio.
    const p = await pagina(b, vp, extra);
    await p.goto(`${G}/ingresar`);
    await p.locator("form input[type=email]").waitFor({ timeout: 30000 });
    chequear(/no tenés cuenta/i.test(await p.locator("[data-sin-cuenta]").innerText()) && await p.locator('[data-sin-cuenta] a[href="/ingresar?modo=socio"]').count() === 1,
      `${tam} · equipo: “¿No tenés cuenta?” manda al socio y dice que el acceso lo crea el dueño`, `${tam} · equipo: falta el “no tengo cuenta”`);
    chequear(await sinDesborde(p), `${tam} · ingreso del equipo sin desborde`, `${tam} · ingreso del equipo se desborda`);
    chequear((await medidas(p)).length === 0, `${tam} · ingreso del equipo: botones de 44 px e inputs de 16 px`, `${tam} · ${(await medidas(p)).join(" | ")}`);
    if (tam !== "compu") await capturar(p, `vd61-${tam}-equipo`);
    await p.goto(`${G}/ingresar?modo=socio`);
    await p.locator("input[name=telefono]").waitFor({ timeout: 30000 });
    chequear(await p.locator("[data-soy-nuevo], [data-sin-cuenta]").count() === 1, `${tam} · socio: “Soy nuevo, quiero anotarme” o “pedile a la recepción”`, `${tam} · socio: no dice qué hacer sin cuenta`);
    chequear(await sinDesborde(p), `${tam} · ingreso del socio sin desborde`, `${tam} · ingreso del socio se desborda`);
    chequear((await medidas(p)).length === 0, `${tam} · ingreso del socio: botones de 44 px e inputs de 16 px`, `${tam} · ${(await medidas(p)).join(" | ")}`);
    await capturar(p, `vd61-${tam}-socio`);

    // 2 · Google: aparece solo con las credenciales (la app local lo prende con ENTRAR_CON_GOOGLE=1).
    // La variable la lee el SERVIDOR de la app, no este script: si acá está definida (ENTRAR_CON_GOOGLE=1 o 0) se exige que coincida;
    // si no, se acepta cualquiera de los dos estados pero, si el botón está, tiene que ser el link real a /auth/google.
    const hayGoogle = await p.locator("[data-entrar-google]").count() === 1;
    const declarada = process.env.ENTRAR_CON_GOOGLE;
    if (declarada !== undefined) chequear(hayGoogle === (declarada === "1"), `${tam} · botón de Google ${hayGoogle ? "visible" : "oculto"} según las credenciales`, `${tam} · el botón de Google (${hayGoogle ? "visible" : "oculto"}) no coincide con ENTRAR_CON_GOOGLE=${declarada}`);
    else if (hayGoogle) chequear(await p.locator("[data-entrar-google] a").getAttribute("href") === "/auth/google" && await sinDesborde(p), `${tam} · botón de Google visible, con su link y sin desborde`, `${tam} · el botón de Google está mal armado`);
    else ok(`${tam} · botón de Google oculto (sin credenciales en el servidor)`);

    // 3 · Código malo / vencido: avisa con el mensaje común, deja el cursor en el código y ofrece pedir otro.
    await p.fill("input[name=telefono]", `000 ${String(Date.now()).slice(-7)}`);
    await p.click('button:has-text("código")');
    await p.locator("input[name=codigo]").waitFor({ timeout: 30000 });
    const cod = p.locator("input[name=codigo]");
    chequear(await cod.getAttribute("inputmode") === "numeric" && await cod.getAttribute("autocomplete") === "one-time-code", `${tam} · el código usa teclado numérico y se completa solo`, `${tam} · el código no es numeric/one-time-code`);
    chequear((await medidas(p)).length === 0, `${tam} · paso del código: 44 px y 16 px`, `${tam} · ${(await medidas(p)).join(" | ")}`);
    await cod.fill("000000");
    await p.locator('main [role="alert"]', { hasText: /no es correcto o venció/ }).waitFor({ timeout: 30000 });
    chequear(await p.locator("[data-reenviar]").count() === 1 && await sinDesborde(p), `${tam} · código malo o vencido: lo dice y deja pedir otro (“Reenviar”)`, `${tam} · código malo sin salida clara`);
    if (tam !== "compu") await capturar(p, `vd61-${tam}-codigo-malo`);

    // 4 · Sin internet: se avisa apenas se corta y se va solo al volver.
    await p.context().setOffline(true);
    await p.locator("[data-sin-internet]").waitFor({ timeout: 10000 });
    chequear(/Sin internet/.test(await p.locator("[data-sin-internet]").innerText()), `${tam} · sin internet: la pantalla lo dice`, `${tam} · sin internet no avisa`);
    if (tam !== "compu") await capturar(p, `vd61-${tam}-sin-internet`);
    await p.context().setOffline(false);
    await p.locator("[data-sin-internet]").waitFor({ state: "detached", timeout: 10000 });
    ok(`${tam} · al volver internet el aviso se va solo`);
    if (p.errores.length) falla(`${tam}: ${p.errores.join(" | ")}`);
    await p.context().close();

    // 5 · Olvidé la contraseña: con o sin SMTP dice qué hacer; el flujo del mail sigue disponible.
    const r = await pagina(b, vp, extra);
    await r.goto(`${G}/ingresar/recuperar`);
    await r.locator("[data-paso-mail]").waitFor({ timeout: 30000 });
    const conSmtp = process.env.SMTP_CONFIGURADO === "1";
    chequear((await r.locator("[data-sin-smtp]").count() === 1) === !conSmtp, `${tam} · olvidé la contraseña: ${conSmtp ? "sin aviso (hay SMTP)" : "avisa que el mail puede no llegar y ofrece el código por celular o pedírselo a la recepción"}`, `${tam} · el aviso de SMTP no coincide`);
    if (!conSmtp) chequear(/recepción/.test(await r.locator("[data-sin-smtp]").innerText()) && await r.locator('[data-sin-smtp] a[href="/ingresar?modo=socio"]').count() === 1, `${tam} · el aviso ofrece el celular y la recepción`, `${tam} · el aviso no ofrece las salidas`);
    chequear(await sinDesborde(r) && (await medidas(r)).length === 0, `${tam} · olvidé la contraseña: sin desborde, 44 px y 16 px`, `${tam} · ${(await medidas(r)).join(" | ")}`);
    if (tam !== "compu") await capturar(r, `vd61-${tam}-recuperar`);
    await r.context().close();
  }

  // 6 · Demasiados pedidos: el sexto pedido del mismo celular lo frena con el mensaje común (límite SEG-1).
  const TEL = `000 ${String(Date.now()).slice(-7)}`;
  const d = await pagina(b, CELU);
  let ultimo = "";
  for (let i = 0; i < 6; i++) {
    await d.goto(`${G}/ingresar?modo=socio`);
    await d.fill("input[name=telefono]", TEL);
    await d.click('button:has-text("código")');
    await d.locator('main input[name=codigo], main [role="alert"]').first().waitFor({ timeout: 30000 });
    ultimo = await d.locator("main").innerText();
  }
  chequear(/Pediste muchos códigos/.test(ultimo) && await d.locator('main [role="alert"]').count() >= 1, "demasiados pedidos: mensaje claro dentro del componente común", ultimo.replace(/\s+/g, " ").slice(0, 240));
  await capturar(d, "vd61-celu-demasiados");
  await d.context().close();

  // 7 · La plataforma (sin gimnasio): la marca de Gym OS, sin desborde.
  const pl = await pagina(b, CELU);
  await pl.goto(`${PLATAFORMA}/ingresar`);
  await pl.locator("form input[type=email]").waitFor({ timeout: 30000 });
  chequear(await sinDesborde(pl), "plataforma · celular 390: sin desborde", "plataforma: se desborda");
  await pl.context().close();

  // 8 · Respeta reduced-motion: ninguna animación corre.
  const rm = await pagina(b, CELU, { reducedMotion: "reduce" });
  await rm.goto(`${G}/ingresar`);
  await rm.locator("[data-ingreso]").waitFor({ timeout: 30000 });
  chequear(await rm.evaluate(() => [...document.querySelectorAll(".ingreso-logo, .ingreso-tarjeta")].every((e) => getComputedStyle(e).animationName === "none")), "reduced-motion: sin animación de entrada", "reduced-motion: algo se anima");
  await rm.context().close();

  // 9 · Registro del socio en cuatro pasos con nombre (compu y celular).
  for (const [tam, vp] of [["compu", COMPU], ["celu", CELU]]) {
    const a = await pagina(b, vp);
    await a.goto(`${G}/hacete-socio`);
    const abierta = await a.locator("[data-form-alta]").count();
    if (abierta) {
      const pasos = await a.locator("[data-pasos-alta] a").allInnerTexts();
      chequear(pasos.length === 4 && /Tu plan/.test(pasos[0]) && /Cómo pagás/.test(pasos[3]), `${tam} · registro: cuatro pasos con nombre (${pasos.join(" / ")})`, `${tam} · registro sin pasos: ${pasos.join("|")}`);
      chequear(await sinDesborde(a), `${tam} · registro sin desborde`, `${tam} · registro se desborda`);
      if (tam === "celu") await capturar(a, "vd61-celu-registro", true);
    } else ok(`${tam} · el alta online está cerrada en el demo: se muestra “por ahora el alta se hace en el gimnasio” (sin form)`);
    await a.context().close();
  }

  // 10 · Recepción: “Atiende X · Cambiar” queda fijo al scrollear y lleva al PIN sin cerrar sesión.
  const e = await pagina(b, CELU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel/cuenta`);
  await e.locator('input[aria-label="PIN nuevo"]').fill("5823");
  await e.locator('[data-mi-pin] button:has-text("Guardar PIN")').click();
  await e.locator('[data-mi-pin] [role="status"]').waitFor({ timeout: 30000 });
  await e.context().close();
  for (const [tam, vp] of [["compu", COMPU], ["celu", CELU]]) {
    const pc = await pagina(b, vp);
    await entrar(pc, "recepcion@ejemplo.invalid");
    await pc.goto(`${G}/panel/pin`);
    await pc.locator('input[aria-label="PIN"]').fill("5823");
    await pc.waitForURL((u) => !u.pathname.startsWith("/panel/pin"), { timeout: 30000 });
    await pc.goto(`${G}/panel/socios`);
    const barra = pc.locator("[data-atiende]");
    await barra.waitFor({ timeout: 30000 });
    await pc.evaluate(() => window.scrollTo(0, 400));
    const caja = await barra.boundingBox();
    chequear(!!caja && caja.y >= 0 && caja.y < 120, `${tam} · recepción: “Atiende Martín · Cambiar” queda a la vista al scrollear`, `${tam} · la barra del PIN se fue de la pantalla (${caja?.y})`);
    chequear((await pc.locator("[data-cambiar-persona]").boundingBox())?.height >= 43.5, `${tam} · “Cambiar” es un botón de 44 px`, `${tam} · “Cambiar” es chico`);
    if (tam === "celu") await capturar(pc, "vd61-celu-atiende");
    await pc.locator("[data-cambiar-persona]").click();
    await pc.waitForURL(/\/panel\/pin/, { timeout: 30000 });
    await pc.locator("[data-teclado-pin]").waitFor({ timeout: 30000 }).catch(() => {});
    chequear(await pc.locator("[data-teclado-pin]").count() === 1, `${tam} · “Cambiar” abre el teclado del PIN sin cerrar la sesión`, `${tam} · “Cambiar” no abrió el PIN`);
    chequear(await sinDesborde(pc), `${tam} · PIN sin desborde`, `${tam} · PIN se desborda`);
    if (pc.errores.length) falla(`${tam} recepción: ${pc.errores.join(" | ")}`);
    await pc.context().close();
  }
} catch (e) { falla(`se cortó: ${e.message.split("\n")[0]}`); }
finally { await db.end(); await b.close(); resultado(); }
