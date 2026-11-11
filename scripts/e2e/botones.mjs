#!/usr/bin/env node
// F3.1 · La pasada botón por botón (docs/base/FLUIDEZ.md, reglas 1, 2, 3, 5, 6, 11, 16 y 19).
// Por cada rol, en compu (1440x900) y en celular (390x844), recorre cada pantalla (el menú del rol + las rutas del mapa de pantallas)
// y por CADA botón o enlace visible:
//   · lo toca (salvo los que cambian o mandan algo: salir, dar de baja, anular, borrar, cobrar, enviar, WhatsApp, descargas…: esos solo se
//     verifican que existan y que tengan un nombre accesible, y se anotan en el informe);
//   · mira que pase algo en menos de 1 s (cambia la URL, se abre una hoja o un modal, cambia el estado o aparece un mensaje) y cuánto tarda
//     la PRIMERA respuesta visible (regla 1: menos de 100 ms);
//   · mira que no quede un error de consola ni una pantalla rota;
//   · y que vuelva: el "atrás" del navegador a donde estaba, y Esc cierra lo que se abrió.
// Los que no hacen nada, se cuelgan o no vuelven quedan en .local/botones-informe.md (no corta: el informe es lo que se lee).
//   node scripts/e2e/botones.mjs [--rol dueno,recepcion] [--solo-compu|--solo-celu] [--max-pantallas 60] [--max-botones 40] [--estricto]
// Roles: super (admin), dueno, encargado, recepcion, profe, socio. Se reparte en Actions con --rol (una tanda por rol).
//   (con scripts/local/levantar.sh corriendo). Mira, no escribe: no aprieta nada que cambie datos.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CELU, COMPU, GIMNASIO, PANTALLA_ROTA, PLATAFORMA, entrar, navegador, pagina } from "./comun.mjs";
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const tiene = (n) => process.argv.includes(`--${n}`);
const ROLES = {
  super:      { mail: "admin@ejemplo.invalid",      base: PLATAFORMA,         inicio: "/admin", area: "/admin" },
  dueno:      { mail: "duena@ejemplo.invalid",      base: GIMNASIO("demo"),   inicio: "/panel", area: "/panel" },
  encargado:  { mail: "encargado@ejemplo.invalid",  base: GIMNASIO("demo"),   inicio: "/panel", area: "/panel" },
  recepcion:  { mail: "recepcion@ejemplo.invalid",  base: GIMNASIO("demo"),   inicio: "/panel", area: "/panel" },
  profe:      { mail: "profe@ejemplo.invalid",      base: GIMNASIO("demo"),   inicio: "/panel", area: "/panel" },
  socio:      { mail: "socio@ejemplo.invalid",      base: GIMNASIO("demo"),   inicio: "/app",   area: "/app" },
};
const roles = (arg("rol", Object.keys(ROLES).join(",")) ?? "").split(",").map((x) => x.trim()).filter((x) => ROLES[x]);
const VISTAS = [...(tiene("solo-celu") ? [] : [["compu", COMPU]]), ...(tiene("solo-compu") ? [] : [["celu", CELU]])];
const MAX_PANTALLAS = Number(arg("max-pantallas", "60"));
const MAX_BOTONES = Number(arg("max-botones", "40"));
const LIMITE_RESPUESTA = 100;   // ms: regla 1
const LIMITE_ALGO_PASA = 1000;  // ms: "pasa algo" antes de 1 s

// Lo que NO se toca (cambia o manda algo, o sale de la app).
const PELIGRO = /salir|cerrar sesi|dar de baja|\bbaja\b|anular|borrar|eliminar|quitar|archivar|desactivar|revocar|cobrar|vender|pagar|aprobar|rechazar|guardar|importar|exportar|descargar|enviar|mandar|whatsapp|publicar|ocultar|mostrar mi p|contraseña nueva|firmar|confirmar|aceptar|reservar|cancelar|entrar al panel|entrar como|restablecer|deshacer|probar conexi|volver a ver|instalar/i;
const EXTERNO = /^(tel:|mailto:|https?:\/\/(?!localhost|[a-z0-9-]+\.localhost))/i;

/** Las rutas estáticas de una zona, sacadas del mapa de pantallas (docs/paneles/README.md). */
function rutasDelMapa(area) {
  try {
    return [...readFileSync("docs/paneles/README.md", "utf8").matchAll(/^\| `(\/[^`]*)` \| pantalla \|/gm)].map((m) => m[1])
      .filter((r) => (r === area || r.startsWith(`${area}/`)) && !/[\[\]]/.test(r));
  } catch { return []; }
}

const inicioDe = (rol) => ROLES[rol].inicio;
const informe = { saltos: [], sinSalida: [], existen: new Map(), sinEfecto: [], lentos: [], consola: [], rotas: [], noVuelve: [], colgados: [], sinNombre: [], noTocados: new Map(), pantallas: 0, botones: 0, tocados: 0 };
const nota = (lista, rol, vista, ruta, que) => lista.push(`- **${rol} · ${vista}** \`${ruta}\` — ${que}`);

/** Instala en la página el medidor: cuándo fue el toque y cuándo cambió algo (DOM, atributos o URL). */
const medidor = () => {
  if (window.__bt) return;
  window.__bt = { toque: 0, primero: 0, cambios: 0 };
  const marcar = () => { if (window.__bt.toque && !window.__bt.primero) window.__bt.primero = performance.now(); window.__bt.cambios++; };
  new MutationObserver(marcar).observe(document, { subtree: true, childList: true, attributes: true, characterData: false, attributeFilter: ["class", "aria-expanded", "aria-pressed", "aria-hidden", "disabled", "hidden", "open", "data-estado", "data-state", "style"] });
  addEventListener("pointerdown", () => { window.__bt.toque = performance.now(); window.__bt.primero = 0; window.__bt.cambios = 0; }, true);
  addEventListener("popstate", marcar); addEventListener("hashchange", marcar);
};

/** Regla 17: suma de los saltos de diseño (CLS) desde que se abre la pantalla. Se instala antes de cargar. */
const medidorCLS = () => {
  window.__cls = 0;
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch {}
};

async function candidatos(p) {
  return p.evaluate((max) => {
    const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 4 && r.height > 4 && s.visibility !== "hidden" && s.display !== "none" && r.bottom > 0 && r.top < innerHeight * 6; };
    const todos = [...document.querySelectorAll("a[href], button, [role=button], [role=tab], summary, [role=switch], [role=checkbox]")].filter((e) => visible(e) && !e.closest("[inert]"));
    const salida = [];
    todos.forEach((e, i) => {
      e.setAttribute("data-bt", String(i));
      const texto = (e.innerText || e.textContent || e.getAttribute("aria-label") || e.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 60);
      const enForm = !!e.closest("form") && e.tagName === "BUTTON" && (e.getAttribute("type") ?? "submit") === "submit";
      salida.push({ i, tag: e.tagName.toLowerCase(), texto, href: e.getAttribute("href") ?? "", aria: e.getAttribute("aria-label") ?? "", deshabilitado: e.disabled || e.getAttribute("aria-disabled") === "true", peligro: e.hasAttribute("data-peligro"), enForm, descarga: e.hasAttribute("download"), blank: e.getAttribute("target") === "_blank" });
    });
    return salida.slice(0, max * 3);
  }, MAX_BOTONES);
}

async function tocar(p, rol, vista, ruta, c, errores) {
  const antes = new URL(p.url());
  // Un enlace a la misma pantalla en la que ya estás (la pestaña activa del menú) no tiene nada que mostrar: no es un hallazgo.
  if (c.href && c.href.split("#")[0].split("?")[0].replace(/\/$/, "") === antes.pathname.replace(/\/$/, "") && !c.href.includes("?")) return;
  const sel = p.locator(`[data-bt="${c.i}"]`).first();
  if (!(await sel.count())) return;
  await p.evaluate(medidor);
  const estado = await p.evaluate(() => ({ dialogos: document.querySelectorAll("[role=dialog], dialog[open], .hoja, [data-hoja]").length, expandidos: document.querySelectorAll("[aria-expanded=true]").length, texto: document.body.innerText.length }));
  errores.length = 0;
  const t0 = Date.now();
  let colgado = false;
  try { await sel.click({ timeout: 4000, noWaitAfter: true }); } catch { colgado = true; }
  if (colgado) { nota(informe.colgados, rol, vista, ruta, `«${c.texto || c.tag}» no se pudo tocar en 4 s (tapado, fuera de pantalla o la pantalla se colgó)`); return; }
  await p.waitForTimeout(150);
  // "Pasa algo": la URL cambió, o hay un cambio en el DOM, o se abrió algo.
  let despues = new URL(p.url());
  let ms = null;
  const lim = Date.now() + LIMITE_ALGO_PASA;
  let cambio = false;
  while (Date.now() < lim) {
    despues = new URL(p.url());
    const d = await p.evaluate(() => ({ b: window.__bt ?? null, dialogos: document.querySelectorAll("[role=dialog], dialog[open], .hoja, [data-hoja]").length, expandidos: document.querySelectorAll("[aria-expanded=true]").length, texto: document.body.innerText.length })).catch(() => null);
    if (!d) { cambio = true; ms = Date.now() - t0; break; }   // la página se recargó (navegación completa)
    if (despues.href !== antes.href || d.dialogos !== estado.dialogos || d.expandidos !== estado.expandidos || d.texto !== estado.texto || (d.b && d.b.cambios > 0)) {
      cambio = true;
      ms = d.b?.primero && d.b?.toque ? Math.round(d.b.primero - d.b.toque) : (despues.href !== antes.href ? Date.now() - t0 : 0);
      break;
    }
    await p.waitForTimeout(50);
  }
  informe.tocados++;
  if (!cambio) nota(informe.sinEfecto, rol, vista, ruta, `«${c.texto || c.aria || c.tag}»${c.href ? ` (→ ${c.href})` : ""} no hizo nada visible en 1 s`);
  else if (ms !== null && ms > LIMITE_RESPUESTA && despues.href === antes.href) nota(informe.lentos, rol, vista, ruta, `«${c.texto || c.aria || c.tag}» tardó ${ms} ms en mostrar algo (regla: menos de ${LIMITE_RESPUESTA} ms)`);
  if (errores.length) nota(informe.consola, rol, vista, ruta, `«${c.texto || c.tag}» dejó: ${errores.slice(0, 2).join(" | ").slice(0, 200)}`);
  const cuerpo = await p.locator("body").innerText().catch(() => "");
  if (PANTALLA_ROTA.test(cuerpo)) nota(informe.rotas, rol, vista, ruta, `«${c.texto || c.tag}» dejó una pantalla rota`);

  // Y vuelve: lo que se abrió se cierra con Esc; lo que navegó vuelve con "atrás".
  if (despues.href !== antes.href && despues.origin === antes.origin) {
    await p.goBack({ timeout: 8000, waitUntil: "domcontentloaded" }).catch(() => {});
    await p.waitForTimeout(150);
    if (new URL(p.url()).pathname !== antes.pathname) {
      nota(informe.noVuelve, rol, vista, ruta, `tras «${c.texto || c.tag}» el "atrás" no volvió a ${antes.pathname} (quedó en ${new URL(p.url()).pathname})`);
      await p.goto(antes.href, { waitUntil: "domcontentloaded" }).catch(() => {});
    }
  } else if (despues.origin !== antes.origin) {
    await p.goto(antes.href, { waitUntil: "domcontentloaded" }).catch(() => {});
  } else {
    const ahora = await p.evaluate(() => document.querySelectorAll("[role=dialog], dialog[open], .hoja, [data-hoja]").length).catch(() => 0);
    if (ahora > estado.dialogos) {
      await p.keyboard.press("Escape");
      await p.waitForTimeout(250);
      const sigue = await p.evaluate(() => document.querySelectorAll("[role=dialog], dialog[open], .hoja, [data-hoja]").length).catch(() => 0);
      if (sigue > estado.dialogos) {
        nota(informe.noVuelve, rol, vista, ruta, `«${c.texto || c.tag}» abrió algo que no se cierra con Esc`);
        await p.goto(antes.href, { waitUntil: "domcontentloaded" }).catch(() => {});   // para que lo que quedó abierto no tape los botones que siguen
      }
    }
  }
}

async function recorrerPantalla(p, rol, vista, ruta, base, errores) {
  const r = await p.goto(`${base}${ruta}`, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
  informe.pantallas++;
  await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  if (!r || r.status() >= 500) { nota(informe.rotas, rol, vista, ruta, `la pantalla dio ${r?.status() ?? "sin respuesta"}`); return []; }
  const cuerpo = await p.locator("body").innerText().catch(() => "");
  if (PANTALLA_ROTA.test(cuerpo)) { nota(informe.rotas, rol, vista, ruta, "pantalla rota (error de la app)"); return []; }
  if (/No tenés acceso a esta pantalla/i.test(cuerpo)) return [];   // por la dirección directa da error con motivo: es lo correcto (regla 11)
  // Regla 17: nada salta al cargar (CLS) · regla 5: siempre hay salida (menú, "Volver" o un enlace al inicio).
  const cls = await p.evaluate(() => window.__cls ?? 0).catch(() => 0);
  if (cls > 0.1) nota(informe.saltos, rol, vista, ruta, `salta al cargar: CLS ${cls.toFixed(3)} (límite 0,1)`);
  if (ruta !== inicioDe(rol)) {
    const zona = ruta.startsWith("/admin") ? "/admin" : ruta.startsWith("/app") ? "/app" : "/panel";
    const salida = await p.evaluate((ini) => !!document.querySelector(`a[href="${ini}"], a[href^="${ini}/"], nav a, [role=navigation] a, header button, button[aria-label*="enú"], button[aria-label*="olver"], a[aria-label*="olver"]`) || /volver|atrás|inicio/i.test(document.body.innerText), zona).catch(() => true);
    if (!salida) nota(informe.sinSalida, rol, vista, ruta, "no se ve ninguna salida (ni menú, ni Volver, ni enlace al inicio)");
  }
  const cs = await candidatos(p);
  const enlaces = new Set(cs.filter((c) => c.tag === "a" && !c.descarga && !/mis-datos|\/api\/|\/salir|\/exportar/.test(c.href) && c.href.startsWith("/") && !c.href.startsWith("//")).map((c) => c.href.split("#")[0].split("?")[0]));
  let hechos = 0;
  for (const c of cs) {
    if (hechos >= MAX_BOTONES) break;
    informe.botones++;
    if (!c.texto && !c.aria) { nota(informe.sinNombre, rol, vista, ruta, `un ${c.tag}${c.href ? ` (→ ${c.href})` : ""} sin texto ni aria-label`); }
    const peligroso = c.peligro || PELIGRO.test(`${c.texto} ${c.aria}`) || EXTERNO.test(c.href) || c.descarga || c.blank || c.enForm || c.deshabilitado || /\/salir|\/api\//.test(c.href);
    if (peligroso && c.texto && !c.deshabilitado && c.tag !== "a") { const k2 = `${rol} · ${vista} \`${ruta}\``; (informe.existen.get(k2) ?? informe.existen.set(k2, new Set()).get(k2)).add(c.texto); }
    if (peligroso) { const k = `${rol}/${vista}`; informe.noTocados.set(k, (informe.noTocados.get(k) ?? 0) + 1); continue; }
    hechos++;
    await tocar(p, rol, vista, ruta, c, errores);
  }
  return [...enlaces];
}

mkdirSync(".local", { recursive: true });
const b = await navegador();
try {
  for (const rol of roles) {
    const R = ROLES[rol];
    for (const [vista, tam] of VISTAS) {
      const p = await pagina(b, tam);
      await p.addInitScript(medidorCLS);
      p.setDefaultNavigationTimeout(60000);
      const errores = [];
      p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_ABORTED|favicon/i.test(m.text())) errores.push(m.text().slice(0, 160)); });
      p.on("pageerror", (e) => errores.push(String(e.message).slice(0, 160)));
      try { await entrar(p, R.mail, undefined, R.base); }
      catch (e) { nota(informe.rotas, rol, vista, "/ingresar", `no pudo entrar: ${String(e.message).split("\n")[0]}`); await p.context().close(); continue; }
      const cola = [R.inicio, ...rutasDelMapa(R.area)];
      const vistas = new Set();
      while (cola.length && vistas.size < MAX_PANTALLAS) {
        const ruta = cola.shift();
        if (!ruta || vistas.has(ruta) || !(ruta === R.area || ruta.startsWith(`${R.area}`))) continue;
        vistas.add(ruta);
        const nuevos = await recorrerPantalla(p, rol, vista, ruta, R.base, errores).catch((e) => { nota(informe.colgados, rol, vista, ruta, `la pantalla se cortó: ${String(e.message).split("\n")[0]}`); return []; });
        for (const n of nuevos) if (!vistas.has(n)) cola.push(n);
      }
      console.log(`${rol} · ${vista}: ${vistas.size} pantallas`);
      await p.context().close();
    }
  }
} finally {
  await b.close();
}

const seccion = (titulo, lista) => `## ${titulo} (${lista.length})\n\n${lista.length ? lista.join("\n") : "Ninguno."}\n`;
const md = [
  `# Informe de botones (F3.1) · ${new Date().toISOString().slice(0, 16).replace("T", " ")}`, "",
  `Roles: ${roles.join(", ")} · vistas: ${VISTAS.map((v) => v[0]).join(", ")} · ${informe.pantallas} pantallas · ${informe.botones} botones y enlaces vistos · ${informe.tocados} tocados.`, "",
  `No se tocan (cambian o mandan algo, salen de la app o están deshabilitados), por rol y vista: ${[...informe.noTocados].map(([k, n]) => `${k}: ${n}`).join(" · ") || "ninguno"}.`, "",
  seccion("No hacen nada en 1 s", informe.sinEfecto), seccion(`Tardan más de ${LIMITE_RESPUESTA} ms en mostrar algo`, informe.lentos), seccion("Se cuelgan o no se pueden tocar", informe.colgados),
  seccion("Dejan un error en la consola", informe.consola), seccion("Pantallas rotas", informe.rotas), seccion("No vuelven (atrás / Esc)", informe.noVuelve), seccion("Sin nombre accesible", informe.sinNombre),
  seccion("Saltan al cargar (CLS > 0,1)", informe.saltos), seccion("Sin salida visible", informe.sinSalida),
  `## Botones que cambian o mandan algo: existen, NO se tocaron (${[...informe.existen.values()].reduce((a, v) => a + v.size, 0)})\n\n${[...informe.existen].map(([k, v]) => `- ${k}: ${[...v].slice(0, 12).join(" · ")}`).join("\n") || "Ninguno."}\n`,
].join("\n");
writeFileSync(arg("informe", ".local/botones-informe.md"), md);
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, md, { flag: "a" });
console.log(md);
const graves = informe.saltos.length + informe.sinSalida.length + informe.sinEfecto.length + informe.colgados.length + informe.consola.length + informe.rotas.length + informe.noVuelve.length;
console.log(`${graves} hallazgo(s) graves (sin efecto, colgados, consola, rotas, no vuelven) y ${informe.lentos.length} lentos.`);
process.exit(tiene("estricto") && graves ? 1 : 0);
