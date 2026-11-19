#!/usr/bin/env node
// Pase 2.0 · INVENTARIO DE PANTALLAS (docs/base/CAMBIOS-MATEO.md, Pista, puntos 1 y 2).
// Nada de lo que tiene una pantalla hoy se pierde con Pista: por cada pantalla (panel de la dueña y de la recepción, app del socio, página del gimnasio,
// hacete-socio e ingresar), en compu y en celular, se anota cada botón, link, campo, título y atributo data-* que hay a la vista con el estilo clásico, se
// prende Pista en el gimnasio (el dato `estilo`, como lo hace el dueño) y se vuelve a anotar. Lo que existía y ya no está = falla. Lo que apareció = aviso.
// También guarda una captura de cada pantalla en cada estilo (.local/capturas/inv-*) para compararlas de a pares y mirarlas.
//   node scripts/e2e/inventario-pantallas.mjs      (con scripts/local/levantar.sh corriendo y la base en clásico; usa PGHOST/PGPORT/PGUSER o DB_PRUEBAS_URL)
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, entrar, entrarSocio, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const URL_DB = process.env.DB_PRUEBAS_URL ?? `postgres://${process.env.PGUSER ?? "postgres"}@${process.env.PGHOST ?? "localhost"}:${process.env.PGPORT ?? "5432"}/gymos_pruebas`;
const ESPERA_CACHE_MS = 62000;   // el proxy recuerda 60 s qué gimnasio es cada dirección (y con él su estilo)
const MODO = process.env.MODO_DEMO ?? "oscuro";
const G = GIMNASIO();

const PANEL = ["/panel", "/panel/entrada", "/panel/socios", "/panel/socios?vista=interesados", "/panel/vencen-hoy", "/panel/vender", "/panel/caja", "/panel/clases", "/panel/retencion",
  "/panel/transferencias", "/panel/planes", "/panel/mensajes", "/panel/tareas", "/panel/cuenta", "/panel/configuracion", "/panel/pagina", "/panel/resumen", "/panel/control", "/panel/gastos", "/panel/equipo"];
const PANTALLAS = [
  ...PANEL.map((ruta) => ({ rol: "duena", ruta })),
  ...["/panel", "/panel/entrada", "/panel/socios", "/panel/vender", "/panel/caja", "/panel/clases", "/panel/mensajes", "/panel/cuenta"].map((ruta) => ({ rol: "recepcion", ruta })),
  ...["/app", "/app/clases"].map((ruta) => ({ rol: "socio", ruta })),
  ...["/", "/hacete-socio", "/ingresar"].map((ruta) => ({ rol: "publico", ruta })),
];

/** Lo que se ve en la página, sin depender de cómo se dibuja: se anota qué es, no cómo se ve. */
function inventariar() {
  const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const norm = (t) => (t ?? "").replace(/\s+/g, " ").replace(/\d+/g, "#").trim().toLowerCase().slice(0, 48);
  const interactivos = new Set(), titulos = new Set(), datos = new Set();
  for (const e of document.querySelectorAll("button, a[href], input, select, textarea, summary, [role=button], [role=tab], [role=switch]")) {
    if (e.closest("[data-inventario-ignorar], nextjs-portal") || !visible(e)) continue;
    const href = e.getAttribute("href");
    const etiqueta = e.getAttribute("aria-label") ?? (e.textContent || e.getAttribute("placeholder") || e.getAttribute("name") || e.getAttribute("title") || "");
    interactivos.add(`${e.tagName.toLowerCase()}|${e.getAttribute("type") ?? ""}|${norm(etiqueta)}|${href ? href.split("?")[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, "id") : ""}`);
  }
  for (const e of document.querySelectorAll("h1, h2, h3")) if (visible(e)) titulos.add(norm(e.textContent));
  for (const e of document.querySelectorAll("*")) {
    if (!visible(e)) continue;
    for (const a of e.getAttributeNames()) if (a.startsWith("data-") && !/^data-(estilo|modo|tono|con-barra|nextjs|dpl|rsc|n-|radix|state|slot|orientation|index|sentry)/.test(a)) datos.add(a);
  }
  return { interactivos: [...interactivos], titulos: [...titulos], datos: [...datos], estilo: document.documentElement.dataset.estilo, modo: document.documentElement.dataset.modo };
}

// Lo que cambia solo entre una pasada y la otra, sin que tenga que ver con el estilo (cuántas sesiones abiertas hay, la actividad reciente de Control).
const DEL_MOMENTO = /cerrar la otra sesi|^data-sin-otras$|^a||(alguien|hace) /;

async function recorrer(b, estilo) {
  const filas = new Map();
  for (const [tam, viewport] of [["compu", COMPU], ["celu", CELU]]) {
    for (const rol of ["duena", "recepcion", "socio", "publico"]) {
      const p = await pagina(b, viewport, { conMayusculas: true });   // el diseño tal cual es, con sus mayúsculas
      try {
        if (rol === "duena") await entrar(p, "duena@ejemplo.invalid");
        else if (rol === "recepcion") await entrar(p, "recepcion@ejemplo.invalid");
        else if (rol === "socio") await entrarSocio(p, "+5490000100002");
        for (const { ruta } of PANTALLAS.filter((x) => x.rol === rol)) {
          await p.goto(`${G}${ruta}`, { waitUntil: "load", timeout: 90000 }).catch(() => null);
          await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
          await p.waitForTimeout(700);
          const inv = await p.evaluate(inventariar);
          if (inv.estilo !== estilo) falla(`${rol} ${ruta} (${tam}): el <html> dice estilo "${inv.estilo}" y se esperaba "${estilo}"`);
          filas.set(`${rol} ${ruta} ${tam}`, inv);
          await capturar(p, `inv-${estilo}-${rol}-${ruta.replace(/[^a-z0-9]+/gi, "_")}-${tam}`).catch(() => {});
        }
      } catch (e) {
        falla(`${rol} (${tam}, ${estilo}): ${String(e.message).split("\n")[0]}`);
      }
      await p.context().close();
    }
  }
  return filas;
}

async function ponerEstilo(estilo) {
  const c = new pg.Client({ connectionString: URL_DB });
  await c.connect();
  try { await c.query(`update public.configuracion_gimnasio set estilo = $1, modo = $2`, [estilo, MODO]); } finally { await c.end(); }
}

const b = await navegador();
try {
  const antes = await recorrer(b, "clasico");
  ok(`inventario con el estilo clásico: ${antes.size} pantallas (compu y celular)`);
  await ponerEstilo("pista");
  await new Promise((r) => setTimeout(r, ESPERA_CACHE_MS));
  const despues = await recorrer(b, "pista");
  ok(`inventario con Pista (modo ${MODO}): ${despues.size} pantallas`);
  let perdidos = 0, nuevos = 0;
  for (const [clave, a] of antes) {
    const d = despues.get(clave);
    if (!d) { falla(`${clave}: no se pudo inventariar con Pista`); continue; }
    for (const campo of ["interactivos", "titulos", "datos"]) {
      const faltan = a[campo].filter((x) => !d[campo].includes(x) && !DEL_MOMENTO.test(x.split("|").slice(campo === "interactivos" ? 0 : 0).join("|")) && !DEL_MOMENTO.test(x.split("|")[2] ?? ""));
      const sobran = d[campo].filter((x) => !a[campo].includes(x));
      nuevos += sobran.length;
      if (faltan.length) { perdidos += faltan.length; falla(`${clave}: con Pista faltan ${faltan.length} ${campo}: ${faltan.slice(0, 6).join(" · ")}`); }
    }
  }
  if (!perdidos) ok(`con Pista no falta ningún botón, link, campo, título ni atributo de lo que había (${antes.size} pantallas)`);
  if (nuevos) console.log(`(aviso: con Pista aparecieron ${nuevos} elementos que antes no estaban; no se esperan, revisar)`);
} finally {
  await ponerEstilo("clasico").catch(() => {});
  await b.close();
}
resultado();
