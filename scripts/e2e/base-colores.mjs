#!/usr/bin/env node
// BASE-3 · F1.1 · Los 4 colores del aviso de la entrada, el atajo "/" y el sonido.
//   verde (al día), ámbar (por vencer y en tolerancia), azul (en prueba gratis) y rojo (sin pago): cada uno, con el atajo "/" → DNI/celular → Enter,
//   sale como aviso abajo a la derecha con su color y con SU sonido (lo mide: qué tonos se pidieron al navegador);
//   un repetido dice "ya había entrado"; "/" dentro de un campo de texto no abre la Entrada; "Sin sonido" (por compu) no suena;
//   y lo mismo en tablet (los colores y que el aviso se vea entero).
//   node scripts/e2e/base-colores.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const TABLET = { width: 820, height: 1180 };
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const modo = async (m) => db.query(`insert into public.configuracion_entrada (gimnasio_id, resultado_entrada) values ($1, $2) on conflict (gimnasio_id) do update set resultado_entrada = $2`, [gim, m]);
const testigo = async (apellido) => (await db.query(`select id, telefono from public.socios where gimnasio_id = $1 and nombre = 'Testigo' and apellido = $2`, [gim, apellido])).rows[0];

// El socio "en prueba gratis" (azul) no está entre los testigos: se crea acá, sin plan ni cobertura, con su prueba de hoy.
async function socioEnPrueba() {
  let s = await testigo("En Prueba");
  if (!s) {
    const [{ n }] = (await db.query(`select count(*)::int n from public.socios where gimnasio_id = $1`, [gim])).rows;
    [s] = (await db.query(`insert into public.socios (gimnasio_id, nombre, apellido, telefono, email, dni) values ($1, 'Testigo', 'En Prueba', $2, 'testigo.en_prueba@ejemplo.invalid', '39000777') returning id, telefono`,
      [gim, `+549000019${String(n).padStart(5, "0")}`])).rows;
  }
  const [{ sede }] = (await db.query(`select id as sede from public.sedes where gimnasio_id = $1 order by creado_en limit 1`, [gim])).rows;
  await db.query(`delete from public.pruebas_gratis where gimnasio_id = $1 and socio_id = $2`, [gim, s.id]).catch(() => {});
  await db.query(`insert into public.pruebas_gratis (gimnasio_id, dni, nombre, modo, sede_id, desde, hasta, origen, socio_id)
                  values ($1, '39000777', 'Testigo En Prueba', 'dia', $2, now() - interval '2 hours', now() + interval '10 hours', 'pagina', $3)
                  on conflict do nothing`, [gim, sede, s.id]);
  return s;
}

// Mide los sonidos: envuelve AudioContext y anota la frecuencia de cada tono que se pide.
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

const b = await navegador();
try {
  await modo("aviso");
  const caso = [
    { apellido: "Al Día", color: "verde", tonos: [880] },
    { apellido: "Por Vencer", color: "amarillo", tonos: [560, 560] },
    { apellido: "En Tolerancia", color: "amarillo", tonos: [560, 560] },
    { apellido: "En Prueba", color: "azul", tonos: [880] },   // la prueba suena como un verde
    { apellido: "Sin Pago", color: "rojo", tonos: [220, 180] },
  ];
  const azul = await socioEnPrueba();
  for (const c of caso) {
    c.socio = c.apellido === "En Prueba" ? azul : await testigo(c.apellido);
    if (!c.socio) throw new Error(`falta el testigo "${c.apellido}" en el demo`);
  }

  // Un ingreso con el atajo "/" (o la tecla pedida). Devuelve { color, texto, tonos, ms }.
  async function ingresar(r, socio, tecla = "/") {
    const antes = await r.locator("[data-aviso-id]").evaluateAll((es) => es.map((e) => e.getAttribute("data-aviso-id")));
    await r.evaluate(() => { window.__tonos = []; });
    await r.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});   // el foco afuera de cualquier campo
    await r.keyboard.press(tecla);
    const campo = r.locator("[data-ventana-campo]");
    await campo.waitFor({ timeout: 10000 });
    await campo.fill(socio.telefono);
    const t0 = Date.now();
    await r.keyboard.press("Enter");
    await r.waitForFunction((v) => [...document.querySelectorAll("[data-aviso-id]")].some((e) => !v.includes(e.getAttribute("data-aviso-id"))), antes, { timeout: 30000 });
    const ms = Date.now() - t0;
    const [nuevo] = await r.locator("[data-aviso-id]").evaluateAll((es, v) => es.filter((e) => !v.includes(e.getAttribute("data-aviso-id"))).map((e) => ({ color: e.getAttribute("data-aviso-entrada"), texto: e.innerText })), antes);
    const tonos = await r.evaluate(() => window.__tonos);
    await r.locator("[data-ventana-entrada]").waitFor({ state: "detached", timeout: 15000 });
    return { ...nuevo, tonos, ms };
  }

  // ── 1 · Compu: los 4 colores, con "/" y con su sonido ──
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await r.addInitScript(MEDIR_SONIDO);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel`);
  await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
  for (const c of caso) {
    const x = await ingresar(r, c.socio);
    chequear(x.color === c.color, `"/" → ${c.apellido}: aviso ${c.color} (${x.ms} ms)`, `${c.apellido}: salió ${x.color} y se esperaba ${c.color}`);
    chequear(JSON.stringify(x.tonos) === JSON.stringify(c.tonos), `${c.apellido}: suena ${c.tonos.join(" + ")} Hz`, `${c.apellido}: sonó [${x.tonos.join(", ")}] y se esperaba [${c.tonos.join(", ")}]`);
    await r.locator(`[data-aviso-entrada="${c.color}"]`).first().waitFor({ timeout: 5000 });
  }
  await capturar(r, "base-colores-compu");

  // Un repetido: no cuenta dos veces y lo dice.
  const rep = await ingresar(r, caso[0].socio);
  chequear(/ya había entrado/i.test(rep.texto), "un repetido dice “ya había entrado” (no cuenta dos veces)", `el repetido dijo: ${rep.texto.slice(0, 80)}`);

  // "/" dentro de un campo de texto no abre la Entrada y se escribe.
  await r.evaluate(() => { const i = document.createElement("input"); i.type = "text"; i.id = "prueba-barra"; i.setAttribute("aria-label", "Campo de prueba"); document.body.prepend(i); i.focus(); });
  await r.keyboard.type("a/b");
  chequear((await r.locator("#prueba-barra").inputValue()) === "a/b" && (await r.locator("[data-ventana-entrada]").count()) === 0, "“/” dentro de un campo de texto se escribe y no abre la Entrada", "la barra dentro de un campo abrió la Entrada o no se escribió");
  await r.evaluate(() => document.getElementById("prueba-barra")?.remove());

  // Con la Entrada abierta, "/" no la cierra ni la duplica.
  await r.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await r.keyboard.press("/");
  await r.locator("[data-ventana-campo]").waitFor({ timeout: 10000 });
  await r.keyboard.press("Escape");
  await r.locator("[data-ventana-entrada]").waitFor({ state: "detached", timeout: 10000 });
  ok("“/” abre la Entrada y Esc la cierra sin dejar nada colgado");

  // "Sin sonido" (por compu): se guarda en el navegador y no suena.
  await r.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await r.keyboard.press("/");
  await r.locator('[data-sonido-ventana="si"]').click({ timeout: 10000 });
  await r.locator('[data-sonido-ventana="no"]').waitFor({ timeout: 5000 });
  ok("la Entrada tiene su botón “Con sonido / Sin sonido” y lo cambia");
  chequear((await r.evaluate(() => localStorage.getItem("gymos.entrada.sonido"))) === "no", "“Sin sonido” queda guardado en esta compu", "el sonido apagado no quedó guardado");
  await r.keyboard.press("Escape");
  await r.locator("[data-ventana-entrada]").waitFor({ state: "detached", timeout: 10000 });
  const mudo = await ingresar(r, caso[4].socio);
  chequear(mudo.tonos.length === 0 && mudo.color === "rojo", "con “Sin sonido” el aviso sale igual y no suena", `con sonido apagado sonó [${mudo.tonos.join(", ")}] o salió ${mudo.color}`);
  await r.evaluate(() => localStorage.removeItem("gymos.entrada.sonido"));
  if (r.errores.length) falla(`compu: ${r.errores.join(" | ")}`);

  // ── 2 · Tablet: los colores y el aviso entero a la vista ──
  const t = await pagina(b, TABLET);
  t.setDefaultNavigationTimeout(120000);
  await entrar(t, "recepcion@ejemplo.invalid");
  await t.goto(`${G}/panel`);
  await t.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
  for (const c of caso) {
    const x = await ingresar(t, c.socio);
    chequear(x.color === c.color, `tablet · ${c.apellido}: aviso ${c.color}`, `tablet · ${c.apellido}: salió ${x.color}`);
  }
  const caja = await t.locator("[data-avisos-entrada]").boundingBox();
  chequear(!!caja && caja.x >= 0 && caja.x + caja.width <= TABLET.width + 1 && caja.y + caja.height <= TABLET.height + 1, "tablet: los avisos entran enteros en la pantalla", `tablet: caja ${JSON.stringify(caja)}`);
  await capturar(t, "base-colores-tablet");
  if (t.errores.length) falla(`tablet: ${t.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await modo("ventana");   // el demo queda como lo siembra (los recorridos viejos usan la ventana grande)
await db.end();
await b.close();
resultado();
