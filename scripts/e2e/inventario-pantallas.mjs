#!/usr/bin/env node
// Pase 2.0 · INVENTARIO DE PANTALLAS (docs/base/CAMBIOS-MATEO.md, Pista, puntos 1 y 2; desde el 26/11, sin el estilo clásico).
// Nada de lo que tiene una pantalla hoy se pierde: por cada pantalla (panel de la dueña y de la recepción, app del socio, página del gimnasio,
// hacete-socio e ingresar), en compu y en celular, se anota cada botón, link, campo, título y atributo data-* que hay a la vista y se compara con
// la foto guardada (scripts/e2e/inventario/<modo>-semaforo-<si|no>.json, sacada antes del cambio). Lo que estaba y ya no está = falla. Lo que apareció = aviso.
// Guarda la foto nueva en .local/inventario-<modo>-semaforo-<si|no>.json (para renovar la de referencia, se copia esa) y una captura de cada pantalla
// (.local/capturas/inv-pista-*) para mirarlas de a pares con las de antes.
//   node scripts/e2e/inventario-pantallas.mjs      (con scripts/local/levantar.sh corriendo; MODO_DEMO y SEMAFORO_DEMO dicen qué foto es)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CELU, COMPU, GIMNASIO, capturar, entrar, entrarSocio, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const MODO = process.env.MODO_DEMO ?? "oscuro";
const SEMAFORO = process.env.SEMAFORO_DEMO ?? "si";
const FOTO = `${MODO}-semaforo-${SEMAFORO}.json`;
const REFERENCIA = new URL(`./inventario/${FOTO}`, import.meta.url);
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
  return { interactivos: [...interactivos].sort(), titulos: [...titulos].sort(), datos: [...datos].sort(), modo: document.documentElement.dataset.modo };
}

// Lo que cambia solo entre una pasada y la otra, sin que tenga que ver con el estilo (cuántas sesiones abiertas hay, la actividad reciente de Control).
// (Hasta el 26/11 decía `^a||`: la alternativa vacía coincidía con todo y el inventario nunca podía fallar.)
const DEL_MOMENTO = /cerrar la otra sesi|^data-sin-otras$|(alguien|hace) /;

async function recorrer(b) {
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
          if (inv.modo !== MODO) falla(`${rol} ${ruta} (${tam}): el <html> dice modo "${inv.modo}" y se esperaba "${MODO}"`);
          filas.set(`${rol} ${ruta} ${tam}`, inv);
          await capturar(p, `inv-pista-${MODO}-semaforo-${SEMAFORO}-${rol}-${ruta.replace(/[^a-z0-9]+/gi, "_")}-${tam}`).catch(() => {});
        }
      } catch (e) {
        falla(`${rol} (${tam}): ${String(e.message).split("\n")[0]}`);
      }
      await p.context().close();
    }
  }
  return filas;
}

const b = await navegador();
try {
  const ahora = await recorrer(b);
  ok(`inventario de Pista (modo ${MODO}, semáforo ${SEMAFORO}): ${ahora.size} pantallas (compu y celular)`);
  mkdirSync(".local", { recursive: true });
  writeFileSync(`.local/inventario-${FOTO}`, JSON.stringify(Object.fromEntries(ahora), null, 1));
  if (!existsSync(REFERENCIA)) {
    console.log(`(aviso: no hay foto de referencia scripts/e2e/inventario/${FOTO}; se guardó la de ahora en .local/inventario-${FOTO})`);
  } else {
    const antes = new Map(Object.entries(JSON.parse(readFileSync(REFERENCIA, "utf8"))));
    let perdidos = 0, nuevos = 0;
    for (const [clave, a] of antes) {
      const d = ahora.get(clave);
      if (!d) { falla(`${clave}: no se pudo inventariar`); continue; }
      for (const campo of ["interactivos", "titulos", "datos"]) {
        const faltan = a[campo].filter((x) => !d[campo].includes(x) && !DEL_MOMENTO.test(x) && !DEL_MOMENTO.test(x.split("|")[2] ?? ""));
        const sobran = d[campo].filter((x) => !a[campo].includes(x));
        nuevos += sobran.length;
        if (faltan.length) { perdidos += faltan.length; falla(`${clave}: faltan ${faltan.length} ${campo} de la foto de antes: ${faltan.slice(0, 6).join(" · ")}`); }
      }
    }
    if (!perdidos) ok(`no falta ningún botón, link, campo, título ni atributo de la foto de antes (${antes.size} pantallas)`);
    if (nuevos) console.log(`(aviso: aparecieron ${nuevos} elementos que en la foto de antes no estaban; revisar)`);
  }
} finally {
  await b.close();
}
resultado();
