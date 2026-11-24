#!/usr/bin/env node
// Pista Semáforo (Mateo, 24/11) · cada pantalla dibujada en docs/base/pista/semaforo, abierta con sesión real en el demo (estilo Pista con la
// llave pista_semaforo), al mismo tamaño de su .png (1440 de ancho; 390 la app y el celular; 1280×800 el kiosco). Guarda la captura al lado
// de la del diseño en CAPTURAS/semaforo/ (artefacto "pantallas"), para compararlas una por una. Además verifica lo que no se ve a ojo:
//   1. El <html> lleva data-semaforo y el estilo Pista (si no, no hay nada que comparar: falla).
//   2. En 1366×768 el Inicio muestra, sin bajar, el saludo, la tarjeta de Entrada, el resultado y los 4 números.
//   3. No hay accesos repetidos (cada acceso rápido lleva a un lugar distinto).
//   4. Salir no está pegado al nombre: el saludo no lleva el ícono de salir, y "Cerrar sesión" está a 24 px o más del nombre.
//   5. Todos los botones a la vista son píldora (radio ≥ la mitad del alto).
//   6. Ningún color fuera de los tokens (los de [data-tono] + el acento del gimnasio + blanco y transparente).
//   7. Nada se sale a lo ancho en 360.
//   node scripts/e2e/semaforo-pantallas.mjs     (con scripts/local/levantar.sh corriendo con ESTILO_DEMO=pista y SEMAFORO_DEMO=si)
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import pg from "pg";
import { CAPTURAS, GIMNASIO, chequear, entrar, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const DIR = join(CAPTURAS, "semaforo");
mkdirSync(DIR, { recursive: true });
const DISENO = join(process.cwd(), "docs", "base", "pista", "semaforo");
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const q = async (sql, p) => (await db.query(sql, p)).rows;

/** Guarda la captura del sistema y copia la del diseño al lado: <pantalla>.sistema.png y <pantalla>.diseno.png. */
async function lado(p, pantalla) {
  await p.waitForLoadState("networkidle").catch(() => {});
  await p.mouse.move(0, 0);   // sin nada en hover: se compara el estado quieto (y los colores de hover no cuentan como sueltos)
  await p.screenshot({ path: join(DIR, `${pantalla}.sistema.png`), fullPage: true });
  copyFileSync(join(DISENO, `${pantalla}.png`), join(DIR, `${pantalla}.diseno.png`));
}

/** Botones a la vista que no son píldora. */
// Las baldosas de Accesos rápidos no son botones (en el diseño son tarjetas de radio 18): no cuentan.
const noPildoras = (p) => p.evaluate(() => [...document.querySelectorAll(".boton, button.boton, a.boton")]
  .filter((e) => !e.closest("[data-accesos-semaforo]"))
  .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; })
  .filter((e) => { const r = e.getBoundingClientRect(); const rad = parseFloat(getComputedStyle(e).borderTopLeftRadius); return rad + 1 < Math.min(r.height, r.width) / 2; })
  .map((e) => `${(e.textContent ?? "").trim().slice(0, 30)} (${getComputedStyle(e).borderTopLeftRadius})`));

/** Colores pintados que no son de los tokens. */
const coloresSueltos = (p) => p.evaluate(() => {
  const raiz = document.querySelector("[data-tono]") ?? document.documentElement;
  const cs = getComputedStyle(raiz);
  const norm = (c) => { const x = document.createElement("i"); x.style.color = c; document.body.appendChild(x); const v = getComputedStyle(x).color; x.remove(); return v; };
  const permitidos = new Set(["rgba(0, 0, 0, 0)", "rgb(255, 255, 255)", "rgb(0, 0, 0)"]);
  for (let i = 0; i < cs.length; i++) {
    const n = cs[i]; if (!n.startsWith("--")) continue;
    const v = cs.getPropertyValue(n).trim(); if (/^#|^rgb|^hsl|^oklab|^color-mix/.test(v)) permitidos.add(norm(v));
  }
  const malos = new Map();
  for (const e of document.querySelectorAll("main *, aside *, nav *")) {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const s = getComputedStyle(e); if (s.visibility === "hidden" || s.display === "none") continue;
    if (e.closest("svg, img, video, canvas, [data-qr], .bg-white, [data-qr-pared]")) continue;
    for (const prop of ["color", "backgroundColor"]) {
      const c = s[prop];
      if (prop === "color" && !(e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))) continue;
      if (/rgba\(\d+, \d+, \d+, 0\)/.test(c) || permitidos.has(c)) continue;
      // Un color con transparencia (las opacidades de hover y de deshabilitado) cuenta como su color sólido.
      const solido = c.replace(/rgba\((\d+), (\d+), (\d+), [\d.]+\)/, "rgb($1, $2, $3)");
      if (permitidos.has(solido)) continue;
      malos.set(c, `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]} ${prop}`);
    }
  }
  return [...malos].map(([c, d]) => `${c} en ${d}`).slice(0, 8);
});
const desborde = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

const b = await navegador();
try {
  // ── El dueño: Inicio en la compu ──
  const d = await pagina(b, { width: 1440, height: 900 }, { conMayusculas: true });
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  await d.locator("main").first().waitFor({ timeout: 60000 });
  const html = await d.evaluate(() => ({ estilo: document.documentElement.dataset.estilo, semaforo: document.documentElement.dataset.semaforo }));
  // En la cadena clásica (ESTILO_DEMO=clasico) o con SEMAFORO_DEMO=no no hay nada que comparar: se dice y se sale en verde.
  if (process.env.ESTILO_DEMO !== "pista" || process.env.SEMAFORO_DEMO === "no") {
    chequear(html.semaforo !== "si", `Sin la llave (estilo ${html.estilo}): el <html> no lleva data-semaforo; nada que comparar`, "sin la llave el <html> lleva data-semaforo");
    await b.close(); await db.end(); resultado(); process.exit(0);
  }
  chequear(html.estilo === "pista" && html.semaforo === "si", "El panel del demo sale con Pista y la llave pista_semaforo", `el <html> dice estilo=${html.estilo} semaforo=${html.semaforo}`);
  await d.locator("[data-entrada-inicio]").waitFor({ timeout: 30000 });
  await lado(d, "inicio-panel");
  chequear((await noPildoras(d)).length === 0, "Inicio: todos los botones son píldora", `no son píldora: ${(await noPildoras(d)).join(" · ")}`);
  const sueltosInicio = await coloresSueltos(d);
  chequear(sueltosInicio.length === 0, "Inicio: ningún color fuera de los tokens", `colores sueltos: ${sueltosInicio.join(" · ")}`);
  const accesos = await d.locator("[data-accesos-semaforo] ul a[href]").evaluateAll((l) => l.map((a) => a.getAttribute("href")));
  chequear(accesos.length > 0 && new Set(accesos).size === accesos.length, `Inicio: ${accesos.length} accesos rápidos, ninguno repetido`, `accesos repetidos: ${accesos.join(", ")}`);
  const saludoSalir = await d.locator("h1 .icono-svg:visible").count();
  const separacion = await d.evaluate(() => {
    const nombre = [...document.querySelectorAll("aside a[href='/panel/cuenta']")].find((e) => e.getBoundingClientRect().height > 0);
    const salir = [...document.querySelectorAll("aside form[action='/salir'] button")].find((e) => e.getBoundingClientRect().height > 0);
    if (!nombre || !salir) return null;
    return salir.getBoundingClientRect().top - nombre.getBoundingClientRect().bottom;
  });
  chequear(saludoSalir === 0 && (separacion === null || separacion >= 24), `Salir no está pegado al nombre (el saludo va con 👋; Cerrar sesión a ${separacion ?? "—"} px del nombre)`,
    `el saludo muestra un ícono de línea (${saludoSalir}) o Cerrar sesión está a ${separacion} px del nombre`);

  // ── 1366×768: lo de arriba entra sin bajar ──
  await d.setViewportSize({ width: 1366, height: 768 });
  await d.goto(`${G}/panel`);
  await d.locator("[data-entrada-inicio]").waitFor({ timeout: 30000 });
  const arriba = await d.evaluate(() => {
    const abajo = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect().bottom : Infinity; };
    const numeros = [...document.querySelectorAll("[data-numeros-semaforo] [data-numero]")].slice(0, 4).map((e) => e.getBoundingClientRect().bottom);
    return { saludo: abajo(".inicio-semaforo-saludo"), entrada: abajo("[data-entrada-inicio]"), resultado: abajo(".inicio-semaforo-entrada > :nth-child(2)"),
      numeros: numeros.length === 4 ? Math.max(...numeros) : Infinity, alto: 768 };
  });
  chequear([arriba.saludo, arriba.entrada, arriba.resultado, arriba.numeros].every((y) => y <= arriba.alto),
    "1366×768: el saludo, la Entrada, el resultado y los 4 números se ven sin bajar", `abajo de la pantalla (${arriba.alto}): ${JSON.stringify(arriba)}`);

  // ── Socios, ficha, caja y clases de hoy (1440) ──
  await d.setViewportSize({ width: 1440, height: 900 });
  for (const [pantalla, ruta, espera] of [["socios", "/panel/socios", "main"], ["caja", "/panel/caja", "main"], ["clases-de-hoy", "/panel/clases", "main"]]) {
    await d.goto(`${G}${ruta}`);
    await d.locator(espera).first().waitFor({ timeout: 30000 });
    // La caja del diseño está abierta: si el demo la tiene cerrada, se abre con $0 (solo en la base local) para comparar lo mismo.
    if (pantalla === "caja" && await d.getByRole("button", { name: /Abrir caja/ }).count()) {
      await d.getByRole("button", { name: /Abrir caja/ }).first().click();
      await d.waitForFunction(() => ![...document.querySelectorAll("main button")].some((b) => /Abrir caja|Abriendo/.test(b.textContent ?? "")), null, { timeout: 30000 }).catch(() => {});
    }
    await lado(d, pantalla);
    const np = await noPildoras(d);
    chequear(np.length === 0, `${pantalla}: todos los botones son píldora`, `${pantalla}: no son píldora: ${np.join(" · ")}`);
    const cs = await coloresSueltos(d);
    chequear(cs.length === 0, `${pantalla}: ningún color fuera de los tokens`, `${pantalla}: colores sueltos: ${cs.join(" · ")}`);
  }
  const [{ id: socio }] = await q(`select s.id from public.socios s join public.gimnasios g on g.id = s.gimnasio_id where g.slug = 'demo' and s.nombre = 'Testigo' and s.apellido = 'Vencida' limit 1`);
  await d.goto(`${G}/panel/socios/${socio}`);
  await d.locator("main").first().waitFor({ timeout: 30000 });
  await lado(d, "ficha-socio");
  chequear((await noPildoras(d)).length === 0, "ficha-socio: todos los botones son píldora", `ficha-socio: no son píldora: ${(await noPildoras(d)).join(" · ")}`);

  // ── El celular: Inicio a 390 y nada se sale en 360 ──
  const c = await pagina(b, { width: 390, height: 844 }, { conMayusculas: true });
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel`);
  await c.locator("[data-entrada-inicio]").waitFor({ timeout: 30000 });
  await lado(c, "inicio-celular");
  const barra = await c.locator("nav[aria-label='Principales'] li").allInnerTexts();
  chequear(barra.length === 5 && /Más/.test(barra[4]), `Celular: la barra de abajo con 5 (${barra.map((x) => x.trim()).join(" · ")})`, `la barra de abajo dice: ${barra.join(" · ")}`);
  await c.setViewportSize({ width: 360, height: 780 });
  // (también a 390, el celular de la mayoría de las pruebas: la Página se medía ahí)
  for (const ruta of ["/panel", "/panel/socios", "/panel/caja", "/panel/clases", `/panel/socios/${socio}`, "/panel/configuracion", "/panel/configuracion?pestana=reglas", "/panel/configuracion?pestana=cobros", "/panel/pagina"]) {
    await c.goto(`${G}${ruta}`);
    await c.locator("main").first().waitFor({ timeout: 30000 });
    if (ruta === "/panel/pagina") await c.locator('[data-editor-pagina][data-listo="true"]').waitFor({ timeout: 60000 });
    const sale = await desborde(c);
    // Si algo se sale, se nombra lo que se sale (el más ancho que pasa el borde), para arreglarlo sin adivinar.
    const quien = sale > 1 ? await c.evaluate(() => [...document.querySelectorAll("main *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
      .filter((e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { if (/auto|hidden|scroll|clip/.test(getComputedStyle(a).overflowX)) return false; } return true; })
      .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right).slice(0, 3)
      .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).replace(/s+/g, ".").slice(0, 80)} (${Math.round(e.getBoundingClientRect().right)})`).join(" · ")) : "";
    chequear(sale <= 1, `360: ${ruta} sin nada que se salga`, `360: ${ruta} se sale ${sale} px a lo ancho: ${quien}`);
  }

  // ── La app del socio (390): al día y debe ──
  for (const [pantalla, mail] of [["app-socio", "socio@ejemplo.invalid"], ["app-socio-debe", "socio-vencido@ejemplo.invalid"]]) {
    const s = await pagina(b, { width: 390, height: 844 }, { conMayusculas: true });
    await entrar(s, mail);
    await s.goto(`${G}/app`);
    await s.locator("main").first().waitFor({ timeout: 30000 });
    await lado(s, pantalla);
    const np = await noPildoras(s);
    chequear(np.length === 0, `${pantalla}: todos los botones son píldora`, `${pantalla}: no son píldora: ${np.join(" · ")}`);
    const sale = await desborde(s);
    chequear(sale <= 1, `${pantalla}: nada se sale a lo ancho`, `${pantalla}: se sale ${sale} px`);
    await s.close();
  }

  // ── El kiosco (1280×800): una tablet de prueba con un token conocido, solo en la base local (se revoca al terminar) ──
  const TOKEN = "semaforo-prueba-" + Date.now();
  const [{ id: gim, sede }] = await q(`select g.id, (select s.id from public.sedes s where s.gimnasio_id = g.id and s.activa order by s.creado_en limit 1) sede from public.gimnasios g where g.slug = 'demo'`);
  const [{ id: disp }] = await q(`insert into public.dispositivos (gimnasio_id, sede_id, nombre, tipo) values ($1, $2, 'Tablet semáforo', 'kiosco') returning id`, [gim, sede]);
  await q(`insert into public.dispositivos_tokens (gimnasio_id, dispositivo_id, token_hash) values ($1, $2, encode(extensions.digest($3, 'sha256'), 'hex'))`, [gim, disp, TOKEN]);
  try {
    const k = await pagina(b, { width: 1280, height: 800 }, { conMayusculas: true });
    await k.context().addCookies([{ name: "gymos_tablet", value: TOKEN, url: G }]);
    await k.goto(`${G}/kiosco`);
    const hay = await k.locator(".kiosco-semaforo").first().waitFor({ timeout: 30000 }).then(() => true, () => false);
    chequear(hay, "Kiosco: el diseño de dos paneles (resultado y teclado)", "el kiosco no sale con el diseño Semáforo");
    if (hay) {
      // El testigo al día puede no tener DNI en el demo: se le pone uno (solo en la base local), como hace ent-3 desde la ficha.
      const [{ dni }] = await q(`update public.socios s set dni = coalesce(s.dni, '39876543') where s.gimnasio_id = $1 and s.nombre = 'Testigo' and s.apellido = 'Al Día' returning s.dni`, [gim]);
      for (const n of String(dni)) await k.getByRole("button", { name: n, exact: true }).click();
      await k.getByRole("button", { name: "Entrar" }).click();
      const res = k.locator("[data-kiosco-resultado]");
      await res.waitFor({ timeout: 30000 });
      chequear(await res.getAttribute("data-kiosco-resultado") === "entro", "Kiosco: el socio al día escribe su DNI y PASA", `el kiosco dice: ${(await res.innerText()).slice(0, 80)}`);
      await lado(k, "kiosco");
    }
  } finally {
    await q(`update public.dispositivos set revocado_en = now() where id = $1`, [disp]);
  }
} finally {
  await b.close();
  await db.end();
}
resultado();
