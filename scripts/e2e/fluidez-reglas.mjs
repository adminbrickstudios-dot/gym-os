#!/usr/bin/env node
// F3.2 · Las reglas de docs/base/FLUIDEZ.md que botones.mjs no mira, en ejecución (con scripts/local/levantar.sh corriendo):
//   · regla 16 (internet y celular lentos): con 4G lento y CPU x4 (y con 3G en tres pantallas), cada pantalla muestra algo (esqueleto o contenido)
//     enseguida, termina de cargar, no deja un "…ando" colgado ni una pantalla rota;
//   · regla 7 (nada se pierde): lo escrito en plan nuevo, rutina y evento sobrevive a recargar ("¿Seguimos donde dejaste?" → Seguir), y si guardar da
//     error los campos siguen llenos;
//   · regla 8 (formularios cómodos): el error del precio sale junto al campo; el foco arranca en el primer campo; DNI y celular abren teclado numérico;
//   · regla 15 (errores con salida): una dirección que no existe y un error de pantalla ofrecen Volver e Ir al inicio.
// No guarda nada: lo que escribe se descarta (los envíos son de errores que la base rechaza antes de escribir) y el borrador se borra al terminar.
//   node scripts/e2e/fluidez-reglas.mjs [--solo red,borrador,teclado,salida] [--slug demo]
import { CELU, COMPU, GIMNASIO, aparece, chequear, entrar, navegador, ok, falla, pagina, resultado } from "./comun.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const SOLO = new Set((arg("solo", "red,borrador,teclado,salida") ?? "").split(",").map((x) => x.trim()));
const SLUG = arg("slug", "demo");
if (!/^demo/.test(SLUG)) { console.error("--slug: tiene que empezar con demo (nunca un gimnasio real)."); process.exit(1); }
const BASE = GIMNASIO(SLUG);
const ROTA = /Application error|Unhandled Runtime Error|Something went wrong|No se pudo cargar esta pantalla/i;
const MAL = /\b\w+ando…|\bCargando…/;   // un botón o un texto "Guardando…", "Cobrando…", "Cargando…" que no se fue

const PERFILES = {
  "4g-lento": { latencia: 150, bajada: 1.6e6 / 8, subida: 0.75e6 / 8, cpu: 4 },
  "3g": { latencia: 300, bajada: 0.4e6 / 8, subida: 0.4e6 / 8, cpu: 4 },
};
async function limitar(p, perfil) {
  const cdp = await p.context().newCDPSession(p);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: perfil.latencia, downloadThroughput: perfil.bajada, uploadThroughput: perfil.subida });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: perfil.cpu });
  return async () => {
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  };
}

const b = await navegador();
try {
  const errores = [];
  const p = await pagina(b, CELU);
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_ABORTED|favicon|ERR_INTERNET|net::/i.test(m.text())) errores.push(m.text().slice(0, 160)); });
  await entrar(p, "duena@ejemplo.invalid", undefined, BASE);

  // ── Regla 16 ─────────────────────────────────────────────────────────────
  if (SOLO.has("red")) {
    const PANTALLAS = ["/panel", "/panel/socios", "/panel/vender", "/panel/caja", "/panel/clases", "/panel/planes", "/panel/configuracion", "/panel/rutinas", "/panel/eventos", "/panel/retencion", "/panel/equipo", "/panel/resultado"];
    const LENTAS = new Set(["/panel", "/panel/socios", "/panel/vender"]);   // en 3G solo estas tres (cada una tarda decenas de segundos)
    for (const [nombre, perfil] of Object.entries(PERFILES)) {
      const quitar = await limitar(p, perfil);
      for (const ruta of PANTALLAS.filter((r) => nombre !== "3g" || LENTAS.has(r))) {
        errores.length = 0;
        const t0 = Date.now();
        // La página recién abierta: se mira el DOM apenas hay documento, no cuando termina de cargar.
        const r = await p.goto(`${BASE}${ruta}`, { waitUntil: "commit", timeout: 120000 }).catch((e) => ({ error: e }));
        if (r?.error) { falla(`${nombre} ${ruta}: no respondió en 120 s (${String(r.error.message).split("\n")[0]})`); continue; }
        await p.waitForLoadState("domcontentloaded", { timeout: 120000 }).catch(() => {});
        const primera = await p.evaluate(() => ({ texto: document.body.innerText.trim().length, esqueleto: !!document.querySelector('[aria-busy="true"], .esqueleto'), h: document.body.getBoundingClientRect().height }));
        const msDom = Date.now() - t0;
        // Terminó: el esqueleto se va y hay contenido de verdad.
        const termino = await p.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && document.body.innerText.trim().length > 40, null, { timeout: nombre === "3g" ? 150000 : 60000 }).then(() => true, () => false);
        const msListo = Date.now() - t0;
        const cuerpo = await p.locator("body").innerText().catch(() => "");
        const sinAcceso = /No tenés acceso a esta pantalla/i.test(cuerpo);   // sección apagada o sin permiso: error con motivo, no es de la red
        const pintado = primera.texto > 0 || primera.esqueleto;
        chequear(pintado, `${nombre} ${ruta}: muestra algo a los ${msDom} ms (esqueleto ${primera.esqueleto ? "sí" : "no"})`, `${nombre} ${ruta}: quedó en blanco al cargar (${msDom} ms, sin texto ni esqueleto)`);
        chequear(termino || sinAcceso, `${nombre} ${ruta}: termina de cargar a los ${(msListo / 1000).toFixed(1)} s`, `${nombre} ${ruta}: sigue cargando a los ${(msListo / 1000).toFixed(0)} s (esqueleto que no se va o pantalla vacía)`);
        chequear(!ROTA.test(cuerpo) || sinAcceso, `${nombre} ${ruta}: sin pantalla rota`, `${nombre} ${ruta}: pantalla rota con red lenta: ${cuerpo.replace(/\s+/g, " ").slice(0, 160)}`);
        const colgado = await p.evaluate((re) => [...document.querySelectorAll("button, [role=button]")].map((x) => x.innerText.trim()).filter((x) => new RegExp(re).test(x)).slice(0, 3), MAL.source);
        chequear(colgado.length === 0, `${nombre} ${ruta}: ningún botón queda en "…ando"`, `${nombre} ${ruta}: botón colgado en ${colgado.join(" | ")}`);
        chequear(errores.length === 0, `${nombre} ${ruta}: sin errores en la consola`, `${nombre} ${ruta}: consola con ${errores.slice(0, 2).join(" | ")}`);
      }
      await quitar();
    }
  }

  // ── Reglas 7 y 8: borrador, conservar lo escrito, error junto al campo ───────
  if (SOLO.has("borrador")) {
    const p2 = await pagina(b, COMPU);
    await entrar(p2, "duena@ejemplo.invalid", undefined, BASE);
    const borrarBorradores = () => p2.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("base:borrador:")) localStorage.removeItem(k); });
    const seguir = async (que) => {
      const hay = await aparece(p2.locator("[data-borrador]"), 8000);
      chequear(hay, `${que}: al volver ofrece "¿Seguimos donde dejaste?"`, `${que}: no ofreció el borrador al recargar`);
      if (hay) await p2.locator("[data-borrador-seguir]").first().click();
      return hay;
    };

    // Plan nuevo: se escribe, se recarga, se sigue; un precio inválido deja el error junto al campo y los campos llenos.
    await p2.goto(`${BASE}/panel/planes`);
    await borrarBorradores();
    await p2.locator("button", { hasText: /Nuevo plan/ }).first().click();
    await p2.locator("form input[name=nombre]").fill("Plan de prueba de fluidez");
    await p2.locator("form input[name=precio]").fill("abc");
    await p2.locator("form input[name=descripcion]").fill("No se guarda");
    await p2.waitForTimeout(900);
    await p2.reload();
    await p2.locator("button", { hasText: /Nuevo plan/ }).first().click();
    if (await seguir("plan nuevo")) {
      chequear((await p2.locator("form input[name=nombre]").inputValue()) === "Plan de prueba de fluidez", "plan nuevo: Seguir devuelve el nombre", "plan nuevo: Seguir no devolvió el nombre");
      chequear((await p2.locator("form input[name=descripcion]").inputValue()) === "No se guarda", "plan nuevo: Seguir devuelve la descripción", "plan nuevo: Seguir no devolvió la descripción");
    }
    await p2.locator("form button[type=submit]", { hasText: /Crear/ }).click();   // "abc" no es un precio: la base ni se entera
    const errorPrecio = p2.locator("#error-precio");
    chequear(await aparece(errorPrecio, 15000), "plan nuevo: el error del precio sale junto al campo", "plan nuevo: el error del precio no salió junto al campo");
    chequear((await p2.locator("form input[name=nombre]").inputValue().catch(() => "")) === "Plan de prueba de fluidez", "plan nuevo: con error siguen los campos llenos", "plan nuevo: con error se vació el formulario");
    chequear((await p2.locator("form input[name=precio]").inputValue().catch(() => "")) === "abc", "plan nuevo: el precio escrito sigue ahí para corregirlo", "plan nuevo: el precio se vació");

    // Rutina nueva.
    await borrarBorradores();
    await p2.goto(`${BASE}/panel/rutinas/editar`);
    if (await aparece(p2.locator("[data-editor-rutina]"), 15000)) {
      await p2.locator("[data-editor-rutina] input.campo").first().fill("Rutina de prueba de fluidez");
      const sumar = p2.locator('select[aria-label^="Sumar ejercicio al día 1"]');
      const hayEjercicios = (await sumar.locator("option").count()) > 1;
      if (hayEjercicios) await sumar.selectOption({ index: 1 });
      await p2.waitForTimeout(900);
      await p2.reload();
      if (await seguir("rutina")) {
        chequear((await p2.locator("[data-editor-rutina] input.campo").first().inputValue()) === "Rutina de prueba de fluidez", "rutina: Seguir devuelve el nombre", "rutina: Seguir no devolvió el nombre");
        if (hayEjercicios) chequear((await p2.locator("[data-dia='1'] ul li").count()) === 1, "rutina: Seguir devuelve el ejercicio sumado", "rutina: Seguir no devolvió el ejercicio");
      }
    } else falla("rutina: no abrió el editor de rutinas");

    // Evento nuevo: el error de la fecha sale junto al campo y lo escrito queda.
    await borrarBorradores();
    await p2.goto(`${BASE}/panel/eventos`);
    const nuevo = p2.locator("button", { hasText: /Nuevo evento/ }).first();
    if (await aparece(nuevo, 15000)) {
      await nuevo.click();
      await p2.locator("[data-nuevo-evento] input[maxlength='60']").fill("Evento de prueba de fluidez");
      await p2.locator("[data-nuevo-evento] input[inputmode=decimal]").first().fill("1500");
      await p2.waitForTimeout(900);
      await p2.reload();
      await p2.locator("button", { hasText: /Nuevo evento/ }).first().click();
      if (await seguir("evento")) {
        chequear((await p2.locator("[data-nuevo-evento] input[maxlength='60']").inputValue()) === "Evento de prueba de fluidez", "evento: Seguir devuelve el nombre", "evento: Seguir no devolvió el nombre");
      }
      await p2.locator("[data-nuevo-evento] button[type=submit]").click();   // sin día ni hora: el error es de la pantalla, no escribe nada
      chequear(await aparece(p2.locator("[data-nuevo-evento] [role=alert]"), 10000), "evento: el error de la fecha sale junto al campo", "evento: no apareció el error de la fecha");
      chequear((await p2.locator("[data-nuevo-evento] input[maxlength='60']").inputValue()) === "Evento de prueba de fluidez", "evento: con error siguen los campos llenos", "evento: con error se vació el formulario");
    } else falla("evento: no hay botón Nuevo evento (¿la sección está apagada en el demo?)");
    await borrarBorradores();
    await p2.context().close();
  }

  // ── Regla 8: foco y teclado numérico ────────────────────────────────────────
  if (SOLO.has("teclado")) {
    const p3 = await pagina(b, CELU);
    await entrar(p3, "duena@ejemplo.invalid", undefined, BASE);
    await p3.goto(`${BASE}/panel/socios/nuevo`);
    await p3.locator("form input[name=dni]").waitFor({ timeout: 20000 }).catch(() => {});
    const foco = await p3.evaluate(() => ({ tag: document.activeElement?.tagName, nombre: document.activeElement?.getAttribute("name") }));
    chequear(foco.tag === "INPUT", `alta de socio: el foco arranca en un campo (${foco.nombre})`, `alta de socio: el foco no arranca en el primer campo (${foco.tag})`);
    for (const campo of ["dni", "telefono"]) {
      const modo = await p3.locator(`form input[name=${campo}]`).first().evaluate((e) => ({ modo: e.inputMode, tipo: e.type })).catch(() => null);
      chequear(!!modo && (modo.modo === "numeric" || modo.modo === "tel" || modo.modo === "decimal" || modo.tipo === "tel"), `alta de socio: ${campo} abre el teclado numérico`, `alta de socio: ${campo} no abre el teclado numérico (${JSON.stringify(modo)})`);
    }
    // Enter envía: con el formulario vacío el navegador frena con "completá este campo" y no sale ningún error de la pantalla.
    await p3.locator("form input[name=dni]").first().press("Enter");
    await p3.waitForTimeout(400);
    chequear(!ROTA.test(await p3.locator("body").innerText()), "alta de socio: Enter con el formulario vacío no rompe la pantalla", "alta de socio: Enter rompió la pantalla");
    await p3.context().close();
  }

  // ── Regla 15: errores con salida ────────────────────────────────────────────
  if (SOLO.has("salida")) {
    const p4 = await pagina(b, COMPU);
    await entrar(p4, "duena@ejemplo.invalid", undefined, BASE);
    const conSalida = async (ruta, que) => {
      await p4.goto(`${BASE}${ruta}`).catch(() => {});
      const t = await p4.locator("body").innerText();
      const volver = (await p4.getByRole("button", { name: /Volver/ }).count()) + (await p4.getByRole("link", { name: /Volver/ }).count());
      const inicio = (await p4.getByRole("link", { name: /inicio|Entrar|Panel/i }).count());
      chequear(volver > 0 && inicio > 0, `${que}: ofrece Volver e Ir al inicio`, `${que}: sin salida (Volver ${volver}, inicio ${inicio}): ${t.replace(/\s+/g, " ").slice(0, 140)}`);
    };
    await conSalida("/panel/rutinas/socio", "una pantalla con un dato que falta (rutinas sin ?socio)");
    await conSalida("/panel/esta-pantalla-no-existe", "una dirección del panel que no existe");
    await p4.context().close();
  }
} catch (e) {
  falla(`el recorrido se cortó: ${String(e.message).slice(0, 300).replace(/\s+/g, " ")}`);
} finally {
  await b.close();
}
resultado();
