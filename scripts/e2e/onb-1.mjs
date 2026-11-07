#!/usr/bin/env node
// ONB-1 · "Primeros pasos" del dueño en Inicio, con un gimnasio casi vacío
// (Box Norte Demo). El progreso lo calcula la base: completar un paso en su
// pantalla lo marca solo. Publicar la página es uno de los pasos.
//   npm run e2e:onb-1            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO("demo-box");
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "box@ejemplo.invalid", undefined, G);
  const tarjeta = p.locator("[data-primeros-pasos]");
  const abrirInicio = async () => {
    await p.goto(`${G}/panel`);
    await p.locator("h1").first().waitFor({ timeout: 30000 });
  };
  await abrirInicio();
  // Si una corrida anterior lo ocultó, se vuelve a mostrar.
  if (await p.locator("[data-mostrar-pasos]").count()) {
    await p.locator("[data-mostrar-pasos]").click();
    await tarjeta.waitFor({ timeout: 30000 });
  }
  await tarjeta.waitFor({ timeout: 30000 });
  const hechos0 = Number(await tarjeta.getAttribute("data-primeros-pasos"));
  ok(`Inicio muestra los primeros pasos: ${hechos0} de 9`);
  await capturar(p, "onb1-compu-inicio");

  // ── Cada paso lleva a una pantalla que abre ──
  await tarjeta.locator('button:has-text("Ver todos los pasos")').click();
  const links = await tarjeta.locator("[data-paso] a").evaluateAll((xs) => xs.map((x) => x.getAttribute("href")));
  chequear(links.length === 9, "la lista tiene los 9 pasos", `la lista tiene ${links.length} pasos`);
  let abren = 0;
  for (const l of links) {
    const v = await p.context().newPage();
    const r = await v.goto(`${G}${l}`);
    if (r.status() < 400 && !(await v.locator("text=/Application error|Algo salió mal/").count())) abren++;
    else falla(`el paso ${l} dio ${r.status()}`);
    await v.close();
  }
  chequear(abren === links.length, "las 9 pantallas de los pasos abren", `abrieron ${abren} de ${links.length}`);

  // ── Subir el logo en su pantalla marca el paso solo ──
  const logoHecho = await tarjeta.locator('[data-paso="marca"]').getAttribute("data-hecho");
  await p.goto(`${G}/panel/configuracion?pestana=marca`);
  await p.locator('[data-imagen="logo"]').waitFor({ timeout: 30000 });
  await p.waitForTimeout(800);   // que React tome la pantalla
  if (logoHecho === "true") {   // una corrida anterior lo dejó: se quita para empezar igual
    await p.locator('[data-imagen="logo"] button:has-text("Quitar")').click();
    await p.locator('[data-imagen="logo"] .mensaje', { hasText: "sin logo" }).waitFor({ timeout: 30000 });
  }
  await abrirInicio();
  const sinLogo = Number(await tarjeta.getAttribute("data-primeros-pasos"));
  await p.goto(`${G}/panel/configuracion?pestana=marca`);
  await p.locator('[data-imagen="logo"]').waitFor({ timeout: 30000 });
  await p.waitForTimeout(800);
  const png = Buffer.from(await p.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 240; c.height = 80;
    const x = c.getContext("2d"); x.fillStyle = "#f97316"; x.fillRect(0, 0, 240, 80);
    return c.toDataURL("image/png").split(",")[1];
  }), "base64");
  await p.setInputFiles('input[aria-label="Elegir logo"]', { name: "logo.png", mimeType: "image/png", buffer: png });
  await p.locator('[data-imagen="logo"] .mensaje', { hasText: "Logo listo" }).waitFor({ timeout: 30000 });
  await abrirInicio();
  const conLogo = Number(await tarjeta.getAttribute("data-primeros-pasos"));
  await tarjeta.locator('button:has-text("Ver todos los pasos")').click();
  chequear(conLogo === sinLogo + 1 && (await tarjeta.locator('[data-paso="marca"]').getAttribute("data-hecho")) === "true",
    `subir el logo marca su paso solo (${sinLogo} → ${conLogo})`, `con logo el progreso quedó en ${conLogo} (antes ${sinLogo})`);

  // ── Publicar la página desde el paso ──
  await abrirInicio();
  const antesPub = Number(await tarjeta.getAttribute("data-primeros-pasos"));
  await p.goto(`${G}/panel/configuracion?pestana=pagina`);
  await p.locator("[data-publicar]").waitFor({ timeout: 30000 });
  await p.waitForTimeout(800);
  const yaPublicada = await p.locator('[data-publicar] button:has-text("Pasar a borrador")').count();
  if (yaPublicada) {
    await p.locator('[data-publicar] button:has-text("Pasar a borrador")').click();
    await p.locator(".mensaje", { hasText: "volvió a borrador" }).waitFor({ timeout: 30000 });
  }
  const pub = await p.context().newPage();
  await pub.goto(`${G}/`);
  chequear(await pub.locator("text=Estamos armando nuestra página").count() > 0, "sin publicar, la página dice “Estamos armando nuestra página”", "la página sin publicar no lo dice");
  await p.locator('[data-publicar] button:has-text("Publicar mi página")').click();
  await p.locator(".mensaje", { hasText: "está publicada" }).waitFor({ timeout: 30000 });
  await pub.reload();
  chequear(await pub.locator("text=Estamos armando nuestra página").count() === 0 && await pub.locator("h1").count() > 0, "publicada, la página se ve completa", "publicada, la página sigue en borrador");
  await pub.close();
  await abrirInicio();
  const despuesPub = Number(await tarjeta.getAttribute("data-primeros-pasos"));
  chequear(despuesPub === (yaPublicada ? antesPub : antesPub + 1), `publicar marca el paso (${antesPub} → ${despuesPub})`, `el progreso quedó en ${despuesPub}`);

  // ── El botón grande lleva al próximo paso que falta ──
  const proximo = await tarjeta.locator("[data-proximo]").getAttribute("href");
  await tarjeta.locator("[data-proximo]").click();
  await p.waitForURL((u) => `${u.pathname}${u.search}` === proximo, { timeout: 30000 });
  ok(`el botón del próximo paso lleva a ${proximo}`);

  // ── Ocultar y volver a mostrar ──
  await abrirInicio();
  await tarjeta.locator('button:has-text("No mostrar más")').click();
  await p.locator("[data-mostrar-pasos]").waitFor({ timeout: 30000 });
  await abrirInicio();
  chequear(await tarjeta.count() === 0 && await p.locator("[data-mostrar-pasos]").count() === 1, "“No mostrar más” queda guardado al recargar", "los pasos volvieron a aparecer solos");
  await p.locator("[data-mostrar-pasos]").click();
  await tarjeta.waitFor({ timeout: 30000 });
  ok("“Ver los primeros pasos” los vuelve a mostrar");
  if (p.errores.length) falla(`dueño: ${p.errores.join(" | ")}`);
  await p.context().close();

  // ── Otros roles no los ven ──
  const e = await pagina(b, COMPU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${GIMNASIO()}/panel`);
  await e.locator("h1").first().waitFor({ timeout: 30000 });
  chequear(await e.locator("[data-primeros-pasos], [data-mostrar-pasos]").count() === 0, "el encargado no ve los primeros pasos", "el encargado ve los primeros pasos");
  await e.context().close();

  // ── Celular ──
  const c = await pagina(b, CELU);
  await entrar(c, "box@ejemplo.invalid", undefined, G);
  await c.goto(`${G}/panel`);
  await c.locator("[data-primeros-pasos]").waitFor({ timeout: 30000 });
  await c.locator('button:has-text("Ver todos los pasos")').click();
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular: sin desborde (${ancho}px)`, `celular: mide ${ancho}px`);
  await capturar(c, "onb1-celu-inicio", true);
  await c.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
