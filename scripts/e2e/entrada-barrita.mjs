#!/usr/bin/env node
// E1 + E6 · La barrita del DNI (abajo a la derecha) y la recepción sin internet.
//   Compu 1440 y 1280, y celular (sin cambios): tipear un DNI fuera de un campo → la barrita (no la ventana grande) → el resultado
//   (color, nombre, motivo, UN botón) → Anotar / Esc / "anotar solo en verde" / tocar abre la ventana; nunca roba un campo,
//   el PIN, una hoja abierta; las formas en que se rompe a las 19 h (doble Enter, el lector que manda dos veces, DNI de otro
//   gimnasio, socio dado de baja, la barrita sobre el botón Cobrar, foco perdido); sonido solo si está prendido; reduced-motion;
//   y Playwright offline: "Sin internet: anotá en papel" en rojo y nada parece andar cuando no anda.
//   node scripts/e2e/entrada-barrita.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const config = (c = {}) => db.query(
  `insert into public.configuracion_entrada (gimnasio_id, resultado_entrada, abrir_al_tipear, barra_fija, anotar_solo_en_verde) values ($1, $2, true, false, $3)
   on conflict (gimnasio_id) do update set resultado_entrada = $2, abrir_al_tipear = true, barra_fija = false, anotar_solo_en_verde = $3`,
  [gim, c.modo ?? "aviso", !!c.soloVerde]);

// Los casos testigo (un socio por color). La búsqueda de la barrita es por DNI: si no tienen, se les pone uno (demo local, datos ficticios).
const DNI = { "Al Día": "39100101", "Por Vencer": "39100102", "Sin Pago": "39100103", "En Tolerancia": "39100104" };
const T = {};
for (const [apellido, dni] of Object.entries(DNI)) {
  const [s] = (await db.query(`select id, dni, nombre || ' ' || apellido as nombre from public.socios where gimnasio_id = $1 and nombre = 'Testigo' and apellido = $2`, [gim, apellido])).rows;
  if (!s) { console.error(`falta el testigo "${apellido}" en el demo`); process.exit(1); }
  if (!/^\d{7,8}$/.test(s.dni ?? "")) { await db.query(`update public.socios set dni = $2 where id = $1`, [s.id, dni]); s.dni = dni; }
  T[apellido] = s;
}
const [otro] = (await db.query(`select s.id, s.dni from public.socios s where s.gimnasio_id <> $1 and s.dni ~ '^\\d{7,8}$' and not exists (select 1 from public.socios x where x.gimnasio_id = $1 and x.dni = s.dni) limit 1`, [gim])).rows;
// Un socio dado de baja (se baja a uno de relleno y se restaura al final).
const [relleno] = (await db.query(`select id, dni, dado_de_baja_en, motivo_baja from public.socios where gimnasio_id = $1 and nombre <> 'Testigo' order by numero desc limit 1`, [gim])).rows;
const DNI_BAJA = "39100999";
await db.query(`update public.socios set dni = $2, dado_de_baja_en = coalesce(dado_de_baja_en, now()), motivo_baja = coalesce(motivo_baja, 'otro') where id = $1`, [relleno.id, DNI_BAJA]);

const entradasDe = async (socio, desde) => (await db.query(`select count(*)::int n from public.ingresos where socio_id = $1 and momento >= $2 and resultado <> 'rechazado'`, [socio, desde])).rows[0].n;
const MEDIR_SONIDO = () => {
  window.__tonos = [];
  const Orig = window.AudioContext;
  const Envuelto = function (...a) {
    const c = new Orig(...a);
    const crear = c.createOscillator.bind(c);
    c.createOscillator = () => { const o = crear(); const ini = o.start.bind(o); o.start = (...x) => { window.__tonos.push(Math.round(o.frequency.value)); return ini(...x); }; return o; };
    return c;
  };
  Envuelto.prototype = Orig.prototype;
  window.AudioContext = Envuelto;
};

const B = (r) => r.locator("[data-barrita]");
const afuera = (r) => r.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});   // el foco afuera de cualquier campo
/** Tipea de a una tecla, como una persona (no como lector). */
const tipear = async (r, t, demora = 70) => { await afuera(r); await r.keyboard.type(t, { delay: demora }); };
const estado = (r, e, ms = 20000) => r.locator(`[data-barrita="${e}"]`).waitFor({ timeout: ms }).then(() => true, () => false);
const hayVentana = (r) => r.locator("[data-ventana-entrada]").count().then((n) => n > 0);
const cerrarTodo = async (r) => { await r.keyboard.press("Escape"); await r.waitForTimeout(250); if (await hayVentana(r)) { await r.keyboard.press("Escape"); await r.waitForTimeout(300); } };

const b = await navegador();
try {
  // ══════════ COMPU (1440 y 1280) ══════════
  for (const ancho of [1440, 1280]) {
    const etiqueta = `compu ${ancho}`;
    await config();
    const r = await pagina(b, { width: ancho, height: 900 });
    r.setDefaultNavigationTimeout(120000);
    await r.addInitScript(MEDIR_SONIDO);
    await entrar(r, "recepcion@ejemplo.invalid");
    await r.goto(`${G}/panel/caja`);
    await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });

    // 1 · Tipear números fuera de un campo: la barrita, no la ventana grande; muestra lo que se escribe.
    await tipear(r, "3910");
    chequear(await estado(r, "escribiendo", 5000), `${etiqueta}: tipear números abre la barrita`, `${etiqueta}: no apareció la barrita`);
    chequear(!(await hayVentana(r)), `${etiqueta}: la ventana grande NO se abrió`, `${etiqueta}: se abrió la ventana grande`);
    const txt = await r.locator("[data-barrita-texto]").innerText();
    chequear(/DNI/.test(txt) && txt.includes("3910"), `${etiqueta}: muestra lo que se escribe (“${txt.replace(/\s+/g, " ").trim()}”)`, `${etiqueta}: mostró “${txt}”`);
    const caja = await B(r).boundingBox();
    const vp = r.viewportSize();
    chequear(caja && caja.x + caja.width <= vp.width - 8 && caja.y + caja.height <= vp.height - 8 && caja.x + caja.width >= vp.width - 40, `${etiqueta}: abajo a la derecha, dentro de la pantalla`, `${etiqueta}: mal ubicada ${JSON.stringify(caja)}`);
    const alto = await r.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--barrita-alto"));
    chequear(/^\d+px$/.test(alto.trim()) && parseInt(alto) >= caja.height, `${etiqueta}: avisa su alto a los avisos (--barrita-alto = ${alto.trim()})`, `${etiqueta}: --barrita-alto = “${alto}”`);
    await capturar(r, `barrita-${ancho}-escribiendo`);
    await r.keyboard.press("Escape");
    chequear(await B(r).count() === 0, `${etiqueta}: Esc cancela y la barrita se va`, `${etiqueta}: Esc no cerró la barrita`);
    const sinAlto = await r.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--barrita-alto"));
    chequear(sinAlto.trim() === "", `${etiqueta}: al irse, --barrita-alto se saca`, `${etiqueta}: quedó --barrita-alto = “${sinAlto}”`);

    // 2 · Verde: 8 dígitos y una pausa corta → el resultado en la misma barrita, con UN botón "Anotar entrada".
    const verde = T["Al Día"];
    const t0 = new Date(Date.now() - 1000);
    await r.evaluate(() => { window.__tonos = []; });
    await tipear(r, verde.dni);
    chequear(await estado(r, "resultado"), `${etiqueta}: 8 dígitos y una pausa → sale el resultado solo`, `${etiqueta}: no salió el resultado`);
    chequear(await r.locator('[data-barrita-resultado="verde"]').count() === 1, `${etiqueta}: verde`, `${etiqueta}: no es verde`);
    chequear((await r.locator("[data-barrita-nombre]").innerText()).includes(verde.nombre.split(" ")[0]), `${etiqueta}: nombre y apellido (“${await r.locator("[data-barrita-nombre]").innerText()}”)`, `${etiqueta}: sin nombre`);
    chequear((await r.locator("[data-barrita-motivo]").innerText()).trim().length > 3, `${etiqueta}: el motivo en palabras (“${(await r.locator("[data-barrita-motivo]").innerText()).trim()}”)`, `${etiqueta}: sin motivo`);
    chequear(await r.locator("[data-barrita] button.boton-principal").count() === 1, `${etiqueta}: UN solo botón principal`, `${etiqueta}: ${await r.locator("[data-barrita] button.boton-principal").count()} botones principales`);
    chequear(await r.locator("[data-barrita-anotar]").count() === 1, `${etiqueta}: el botón es “Anotar entrada”`, `${etiqueta}: no hay Anotar entrada`);
    chequear(await entradasDe(verde.id, t0) === 0, `${etiqueta}: ver el resultado no anota nada`, `${etiqueta}: anotó sin tocar el botón`);
    const tonos = await r.evaluate(() => window.__tonos);
    chequear(tonos.length === 1 && tonos[0] === 880, `${etiqueta}: verde suena agudo y corto (sonido prendido)`, `${etiqueta}: sonó ${tonos.join(",")}`);
    await capturar(r, `barrita-${ancho}-verde`);
    // 2b · Doble Enter del lector justo al salir el resultado: no anota.
    await r.keyboard.press("Enter");
    await r.waitForTimeout(150);
    chequear(await entradasDe(verde.id, t0) === 0, `${etiqueta}: un Enter apurado sobre el resultado recién salido no anota`, `${etiqueta}: anotó con un Enter apurado`);
    await r.waitForTimeout(600);
    await r.locator("[data-barrita-anotar]").click();
    chequear(await estado(r, "entro"), `${etiqueta}: Anotar entrada → “Entró ✓” en la misma barrita`, `${etiqueta}: no salió “Entró”`);
    chequear(/entr[oó]|había entrado/i.test(await B(r).innerText()), `${etiqueta}: dice “Entró …”`, `${etiqueta}: texto ${await B(r).innerText()}`);
    chequear(await entradasDe(verde.id, t0) <= 1 && (await db.query(`select 1 from public.ingresos where socio_id = $1 and momento >= now() - interval '12 hours' limit 1`, [verde.id])).rowCount >= 1, `${etiqueta}: la entrada quedó anotada una sola vez en la base`, `${etiqueta}: la base no tiene la entrada`);
    await capturar(r, `barrita-${ancho}-entro`);
    await r.keyboard.press("Escape");

    // 3 · Enter termina el DNI aunque falte la pausa; amarillo: el motivo con aviso.
    await tipear(r, T["Por Vencer"].dni);
    await r.keyboard.press("Enter");
    chequear(await estado(r, "resultado"), `${etiqueta}: Enter también termina el DNI`, `${etiqueta}: Enter no resolvió`);
    chequear(await r.locator('[data-barrita-resultado="amarillo"]').count() === 1, `${etiqueta}: por vencer sale en amarillo con su motivo`, `${etiqueta}: no es amarillo`);
    await capturar(r, `barrita-${ancho}-amarillo`);
    await r.keyboard.press("Escape");

    // 4 · Rojo: el botón principal es el que dice la base (Cobrar / Dejar pasar); tocar el nombre abre la ventana grande con ese socio.
    await tipear(r, T["Sin Pago"].dni);
    await r.keyboard.press("Enter");
    chequear(await estado(r, "resultado"), `${etiqueta}: sin pago → resultado`, `${etiqueta}: sin resultado`);
    chequear(await r.locator('[data-barrita-resultado="rojo"]').count() === 1, `${etiqueta}: rojo`, `${etiqueta}: no es rojo`);
    chequear(await r.locator("[data-barrita-cobrar], [data-barrita-dejar], [data-barrita-abrir]").count() >= 1 && await r.locator("[data-barrita-anotar]").count() === 0, `${etiqueta}: rojo no ofrece anotar: ofrece Cobrar / Dejar pasar`, `${etiqueta}: botones raros en rojo`);
    await capturar(r, `barrita-${ancho}-rojo`);
    // El botón Cobrar de la barrita abre la hoja de cobro de siempre; la barrita se esconde mientras está.
    if (await r.locator("[data-barrita-cobrar]").count()) {
      await r.locator("[data-barrita-cobrar]").click();
      await r.locator('[aria-modal="true"]').first().waitFor({ timeout: 20000 }).catch(() => {});
      chequear(await B(r).count() === 0 || !(await B(r).first().isVisible()), `${etiqueta}: Cobrar abre la hoja y la barrita se corre`, `${etiqueta}: la barrita quedó sobre la hoja de cobro`);
      await r.keyboard.press("Escape"); await r.waitForTimeout(400);
      await r.locator('[aria-modal="true"]').first().waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
      await afuera(r); await r.keyboard.press("Escape");
    } else { await cerrarTodo(r); }
    await tipear(r, T["Sin Pago"].dni);
    await r.keyboard.press("Enter");
    await estado(r, "resultado");
    await r.locator("[data-barrita-abrir-grande]").click();
    await r.locator("[data-ventana-entrada]").waitFor({ timeout: 20000 }).catch(() => {});
    chequear(await hayVentana(r) && await B(r).count() === 0, `${etiqueta}: tocar el nombre abre la ventana grande y la barrita se va`, `${etiqueta}: no abrió la ventana o la barrita quedó`);
    chequear(await r.locator("[data-ventana-veredicto]").first().waitFor({ timeout: 20000 }).then(() => true, () => false), `${etiqueta}: la ventana abre con ese socio (su veredicto)`, `${etiqueta}: la ventana abrió sin veredicto`);
    await capturar(r, `barrita-${ancho}-ventana`);
    await cerrarTodo(r);

    // 5 · Con letras: los 3 primeros con ↑ ↓ (un nombre tipeado de corrido, como lo manda un lector, arranca la barrita).
    await afuera(r);
    await r.keyboard.type("Testigo", { delay: 8 });
    const lista = await estado(r, "lista", 15000);
    chequear(lista, `${etiqueta}: con letras muestra las coincidencias`, `${etiqueta}: no salió la lista de nombres`);
    if (lista) {
      const n = await r.locator("[data-barrita-lista] li button").count();
      chequear(n >= 2 && n <= 3, `${etiqueta}: máximo 3 coincidencias (${n})`, `${etiqueta}: ${n} coincidencias`);
      await r.keyboard.press("ArrowDown");
      chequear(await r.locator("[data-barrita-lista] li button").nth(1).getAttribute("aria-current") === "true", `${etiqueta}: ↓ marca la segunda`, `${etiqueta}: ↓ no movió la marca`);
      await r.keyboard.press("ArrowUp");
      chequear(await r.locator("[data-barrita-lista] li button").nth(0).getAttribute("aria-current") === "true", `${etiqueta}: ↑ vuelve a la primera`, `${etiqueta}: ↑ no volvió`);
      await capturar(r, `barrita-${ancho}-lista`);
      await r.keyboard.press("Enter");
      chequear(await estado(r, "resultado"), `${etiqueta}: Enter elige el marcado y sale su resultado`, `${etiqueta}: Enter no eligió`);
    }
    await cerrarTodo(r);

    // 6 · Nunca roba lo que se escribe en un campo.
    await r.goto(`${G}/panel/socios`);
    await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
    const campoPagina = r.locator("main input:not([type=hidden]):not([type=checkbox]):not([type=radio])").first();
    if (await campoPagina.count()) {
      await campoPagina.click();
      await r.keyboard.type("30123456", { delay: 40 });
      chequear(await B(r).count() === 0 && await campoPagina.inputValue() === "30123456", `${etiqueta}: lo que se escribe en un campo se queda en el campo (la barrita no aparece)`, `${etiqueta}: la barrita se metió en un campo o se perdió lo escrito (“${await campoPagina.inputValue()}”)`);
      // Foco perdido: sale del campo y vuelve a andar; con la barrita a medias, entrar a un campo la corre.
      await campoPagina.fill("");
      await afuera(r);
      await r.keyboard.type("391", { delay: 60 });
      chequear(await estado(r, "escribiendo", 5000), `${etiqueta}: sin foco en un campo, la barrita vuelve a andar`, `${etiqueta}: la barrita no volvió después de salir del campo`);
      await campoPagina.click();
      await r.waitForTimeout(200);
      chequear(await B(r).count() === 0, `${etiqueta}: si el foco entra a un campo, la barrita se corre`, `${etiqueta}: la barrita siguió sobre el campo`);
      await campoPagina.fill("");
    } else { falla(`${etiqueta}: no hay un campo en /panel/socios para probar que la barrita no lo roba`); }
    // Una hoja abierta (la ventana grande por F2): la barrita no se abre.
    await afuera(r);
    await r.keyboard.press("F2");
    await r.locator("[data-ventana-campo]").waitFor({ timeout: 15000 });
    chequear(await B(r).count() === 0, `${etiqueta}: con la ventana abierta no hay barrita`, `${etiqueta}: la barrita aparece con la ventana abierta`);
    await cerrarTodo(r);
    // El PIN: ni la barrita ni la ventana.
    // (la pantalla del PIN solo existe si alguien del equipo tiene PIN: se le pone uno a la recepción para esto)
    const [ana] = (await db.query(`select id from public.equipo where gimnasio_id = $1 and rol = 'recepcion' and activo order by nombre limit 1`, [gim])).rows;
    await db.query(`insert into privado.secretos_operador (gimnasio_id) values ($1) on conflict do nothing`, [gim]);
    await db.query(`insert into privado.pines_equipo (equipo_id, gimnasio_id, pin_hash) values ($1, $2, extensions.crypt('4827', extensions.gen_salt('bf', 8))) on conflict (equipo_id) do update set pin_hash = excluded.pin_hash`, [ana.id, gim]);
    await r.goto(`${G}/panel/pin`);
    const hayPin = await r.locator("[data-teclado-pin]").first().waitFor({ timeout: 15000 }).then(() => true, () => false);
    if (hayPin) {
      await afuera(r);
      await r.keyboard.type("123", { delay: 60 });
      chequear(await B(r).count() === 0 && !(await hayVentana(r)), `${etiqueta}: en la pantalla del PIN no se abre nada`, `${etiqueta}: algo se abrió en la pantalla del PIN (barrita: ${await B(r).count()}, ventana: ${await hayVentana(r)})`);
      await r.locator("[data-teclado-pin] input[name=pin]").fill("4827");
      await r.waitForURL((u) => u.pathname === "/panel", { timeout: 30000 }).catch(() => {});
    } else { falla(`${etiqueta}: no apareció la pantalla del PIN para probarla`); }
    await db.query(`delete from privado.pines_equipo where equipo_id = $1`, [ana.id]);   // sin PIN otra vez: el resto de los recorridos no lo pide

    // 7 · Las formas en que se rompe a las 19 h.
    await r.goto(`${G}/panel/vencen-hoy`);
    await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
    //   (a) el lector que manda dos veces el mismo código: el resultado se queda y no anota dos veces.
    const dos = T["En Tolerancia"];
    const t1 = new Date(Date.now() - 1000);
    await afuera(r);
    await r.keyboard.type(dos.dni, { delay: 5 }); await r.keyboard.press("Enter");
    await r.keyboard.type(dos.dni, { delay: 5 }); await r.keyboard.press("Enter");
    chequear(await estado(r, "resultado"), `${etiqueta}: el lector que manda dos veces: queda el resultado`, `${etiqueta}: el doble envío rompió la barrita (${await B(r).first().getAttribute("data-barrita").catch(() => "sin barrita")})`);
    await r.waitForTimeout(1500);
    chequear(await B(r).first().getAttribute("data-barrita") === "resultado" && await entradasDe(dos.id, t1) === 0, `${etiqueta}: el doble envío no anota (0 entradas) y el resultado sigue ahí`, `${etiqueta}: pasó algo raro con el doble envío`);
    await cerrarTodo(r);
    //   (b) DNI de otro gimnasio: no hay nadie (cada gimnasio ve lo suyo).
    if (otro) {
      await tipear(r, otro.dni);
      await r.keyboard.press("Enter");
      chequear(await estado(r, "nadie"), `${etiqueta}: el DNI de otro gimnasio: “No hay nadie con ese DNI”`, `${etiqueta}: el DNI de otro gimnasio dio otra cosa`);
      await capturar(r, `barrita-${ancho}-nadie`);
      await cerrarTodo(r);
    } else { ok(`${etiqueta}: (no hay otro gimnasio con DNI cargado en esta base: se prueba un DNI que no existe)`); await tipear(r, "10000001"); await r.keyboard.press("Enter"); chequear(await estado(r, "nadie"), `${etiqueta}: un DNI que no existe: “No hay nadie”`, `${etiqueta}: dio otra cosa`); await cerrarTodo(r); }
    //   (c) socio dado de baja: se ve su estado y no se puede anotar ni con Enter.
    const t2 = new Date(Date.now() - 1000);
    await tipear(r, DNI_BAJA);
    await r.keyboard.press("Enter");
    const baja = await estado(r, "resultado", 20000);
    chequear(baja && await r.locator("[data-barrita-anotar]").count() === 0, `${etiqueta}: el socio dado de baja sale sin botón de anotar (“${baja ? (await r.locator("[data-barrita-motivo]").innerText()).trim() : ""}”)`, `${etiqueta}: el dado de baja ofrece anotar o no respondió`);
    await r.waitForTimeout(700);
    await r.keyboard.press("Enter");
    await r.waitForTimeout(500);
    chequear(await entradasDe(relleno.id, t2) === 0, `${etiqueta}: Enter sobre un dado de baja no anota`, `${etiqueta}: anotó a un dado de baja`);
    await cerrarTodo(r);
    //   (d) la barrita sobre el botón Cobrar de la pantalla: no se tapan.
    let tapados = 0, vistos = 0;
    for (const ruta of ["/panel/caja", "/panel/vender", "/panel/socios", "/panel/vencen-hoy", "/panel"]) {
      await r.goto(`${G}${ruta}`);
      await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
      await tipear(r, T["Sin Pago"].dni); await r.keyboard.press("Enter");
      if (!(await estado(r, "resultado", 20000))) continue;
      const cb = await B(r).boundingBox();
      const botones = await r.locator("main a, main button").evaluateAll((es) => es.filter((e) => /^Cobrar(\s*\S{0,3})?$/i.test((e.textContent ?? "").trim())).map((e) => { const x = e.getBoundingClientRect(); return { x: x.x, y: x.y, w: x.width, h: x.height, v: x.width > 0 && x.height > 0 }; }).filter((x) => x.v));
      for (const x of botones) { vistos++; if (cb && x.x < cb.x + cb.width && x.x + x.w > cb.x && x.y < cb.y + cb.height && x.y + x.h > cb.y) { tapados++; console.log(`  ${ruta}: la barrita tapa un botón Cobrar en (${Math.round(x.x)},${Math.round(x.y)})`); } }
      await cerrarTodo(r);
    }
    chequear(tapados === 0, `${etiqueta}: la barrita no tapa ningún botón Cobrar de las pantallas (${vistos} vistos)`, `${etiqueta}: la barrita tapa ${tapados} botón(es) Cobrar`);
    //   (e) doble Enter con "anotar solo en verde" prendido: una sola entrada.
    await config({ soloVerde: true });
    await r.reload();
    await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
    const t3 = new Date(Date.now() - 1000);
    await afuera(r);
    await r.keyboard.type(verde.dni, { delay: 5 }); await r.keyboard.press("Enter"); await r.keyboard.press("Enter");
    chequear(await estado(r, "entro", 25000), `${etiqueta}: con “anotar solo en verde” el verde se anota solo: “Entró ✓”`, `${etiqueta}: no se anotó solo`);
    await r.waitForTimeout(1200);
    chequear(await entradasDe(verde.id, t3) <= 1, `${etiqueta}: el doble Enter no anota dos veces`, `${etiqueta}: dos entradas`);
    await capturar(r, `barrita-${ancho}-solo-verde`);
    await cerrarTodo(r);
    await config();

    // 8 · Sonido solo si está prendido.
    await r.evaluate(() => { localStorage.setItem("gymos.entrada.sonido", "no"); });
    await r.reload();
    await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
    await r.evaluate(() => { window.__tonos = []; });
    await tipear(r, T["Por Vencer"].dni); await r.keyboard.press("Enter");
    await estado(r, "resultado");
    await r.waitForTimeout(500);
    chequear((await r.evaluate(() => window.__tonos)).length === 0, `${etiqueta}: con el sonido apagado la barrita no suena`, `${etiqueta}: sonó con el sonido apagado`);
    await cerrarTodo(r);
    await r.evaluate(() => { localStorage.removeItem("gymos.entrada.sonido"); });

    // 9 · Sin internet (E6): lo dice en rojo, en toda la pantalla y en la barrita, y nada parece andar cuando no anda.
    await r.reload();
    await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
    const t4 = new Date(Date.now() - 1000);
    await r.context().setOffline(true);
    chequear(await r.locator("[data-sin-internet]").first().waitFor({ timeout: 8000 }).then(() => true, () => false), `${etiqueta}: sin internet aparece la franja roja`, `${etiqueta}: no apareció el aviso de sin internet`);
    chequear((await r.locator("[data-sin-internet]").first().innerText()).includes("Sin internet: anotá en papel"), `${etiqueta}: dice “Sin internet: anotá en papel”`, `${etiqueta}: el texto no es el pedido`);
    await tipear(r, verde.dni); await r.keyboard.press("Enter");
    await r.waitForTimeout(800);
    chequear(await r.locator("[data-barrita-sin-internet]").count() === 1 && await r.locator("[data-barrita-resultado]").count() === 0, `${etiqueta}: la barrita también lo dice en rojo y no inventa ningún resultado`, `${etiqueta}: la barrita mostró un resultado sin internet`);
    await capturar(r, `barrita-${ancho}-sin-internet`);
    chequear(await entradasDe(verde.id, t4) === 0, `${etiqueta}: sin internet no se anotó nada`, `${etiqueta}: apareció una entrada sin internet`);
    await r.keyboard.press("Escape");
    await r.context().setOffline(false);
    chequear(await r.locator("[data-sin-internet]").first().waitFor({ state: "detached", timeout: 20000 }).then(() => true, () => false), `${etiqueta}: al volver el internet la franja se va sola`, `${etiqueta}: la franja roja quedó después de volver el internet`);
    // La pantalla de Entrada (donde la ventana no se mete) también lo dice.
    await r.goto(`${G}/panel/entrada`);
    await r.waitForTimeout(1500);
    await r.context().setOffline(true);
    chequear(await r.locator("[data-sin-internet]").first().waitFor({ timeout: 8000 }).then(() => true, () => false), `${etiqueta}: la pantalla de Entrada también dice “Sin internet”`, `${etiqueta}: la pantalla de Entrada no avisó`);
    await capturar(r, `barrita-${ancho}-entrada-sin-internet`);
    await r.context().setOffline(false);
    await r.locator("[data-sin-internet]").first().waitFor({ state: "detached", timeout: 20000 }).catch(() => {});
    if (r.errores.filter((e) => !/Failed to fetch|net::ERR|ERR_INTERNET_DISCONNECTED|offline/i.test(e)).length) falla(`${etiqueta}: ${r.errores.filter((e) => !/Failed to fetch|net::ERR|ERR_INTERNET_DISCONNECTED|offline/i.test(e)).join(" | ")}`);
    await r.context().close();
  }

  // ══════════ reduced-motion ══════════
  {
    await config();
    const r = await pagina(b, { width: 1440, height: 900 }, { reducedMotion: "reduce" });
    r.setDefaultNavigationTimeout(120000);
    await entrar(r, "recepcion@ejemplo.invalid");
    await r.goto(`${G}/panel/caja`);
    await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
    await tipear(r, "391");
    await estado(r, "escribiendo", 5000);
    const dur = await r.evaluate(() => parseFloat(getComputedStyle(document.querySelector("[data-barrita]")).animationDuration));
    chequear(dur <= 0.05, `reduced-motion: la barrita aparece sin animación (${dur} s)`, `reduced-motion: la animación dura ${dur} s`);
    await r.context().close();
  }
  // y con movimiento: 200 ms.
  {
    const r = await pagina(b, { width: 1440, height: 900 });
    r.setDefaultNavigationTimeout(120000);
    await entrar(r, "recepcion@ejemplo.invalid");
    await r.goto(`${G}/panel/caja`);
    await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
    await tipear(r, "391");
    await estado(r, "escribiendo", 5000);
    const dur = await r.evaluate(() => parseFloat(getComputedStyle(document.querySelector("[data-barrita]")).animationDuration));
    chequear(Math.abs(dur - 0.2) < 0.01, `la barrita entra en 200 ms (${dur} s)`, `la animación dura ${dur} s, no 0,2`);
    await r.context().close();
  }

  // ══════════ CELULAR: sin cambios ══════════
  {
    await config();
    const r = await pagina(b, CELU, { hasTouch: true, isMobile: true });
    r.setDefaultNavigationTimeout(120000);
    await entrar(r, "recepcion@ejemplo.invalid");
    await r.goto(`${G}/panel/caja`);
    await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
    await afuera(r);
    await r.keyboard.type("3", { delay: 60 });
    const ventana = await r.locator("[data-ventana-entrada]").first().waitFor({ timeout: 10000 }).then(() => true, () => false);
    chequear(ventana && await B(r).count() === 0, "celular: no cambia nada (un número abre la ventana de siempre, sin barrita)", "celular: cambió el comportamiento");
    await capturar(r, "barrita-celular-ventana");
    await r.keyboard.press("Escape");
    await r.context().close();
  }
} finally {
  await db.query(`update public.socios set dni = $2, dado_de_baja_en = $3, motivo_baja = $4 where id = $1`, [relleno.id, relleno.dni, relleno.dado_de_baja_en, relleno.motivo_baja]).catch(() => {});
  await config().catch(() => {});
  await b.close();
  await db.end();
}
resultado();
