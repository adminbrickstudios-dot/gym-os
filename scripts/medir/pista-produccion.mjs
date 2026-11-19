#!/usr/bin/env node
// Pase 2.0 · Pista EN PRODUCCIÓN (autorizado por Mateo el 18/11). Tres fases, cada una con la cuenta de super admin (por la misma puerta que usa una persona):
//   FASE=demo     crea un gimnasio de prueba [demo], le prende Pista desde su ficha, entra como su dueño y mira Inicio, Entrada, Caja, Socios y Configuración (compu y celular),
//                 más su página y /hacete-socio. Deja capturas en .local/pista-prod/. Al final lo da de baja (como el humo).
//   FASE=temple   prende Pista (estilo pista, modo oscuro) en Temple Gym DESDE LA FICHA del super admin (nada de SQL), y solo MIRA su página, /hacete-socio, /ingresar y
//                 que /panel abra con Pista. Con REVERTIR=1 lo vuelve a clásico. No crea ni cambia nada más.
//   FASE=novedad  deja en Novedades el aviso del diseño nuevo, dirigido por ciudad a Temple Gym; si no le llega a UN solo gimnasio, la retira.
//   BASE_URL=https://pasegym.com BRIK_ADMIN_MAIL=… BRIK_ADMIN_CLAVE=… [SUPABASE_DB_URL=…] [TEMPLE_SLUG=templegymsalta] [TEMPLE_URL=https://templegymsalta.com] FASE=… node scripts/medir/pista-produccion.mjs
// Nada de claves en el repo ni en el registro. Datos de prueba obviamente ficticios (@ejemplo.invalid).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import pg from "pg";

const BASE = (process.env.BASE_URL ?? "").replace(/\/$/, "");
const ADMIN = process.env.BRIK_ADMIN_MAIL, CLAVE_ADMIN = process.env.BRIK_ADMIN_CLAVE;
const FASE = process.env.FASE ?? "demo";
const TEMPLE_SLUG = process.env.TEMPLE_SLUG ?? "templegymsalta";
const TEMPLE_URL = (process.env.TEMPLE_URL ?? "https://templegymsalta.com").replace(/\/$/, "");
const REVERTIR = process.env.REVERTIR === "1";
if (!BASE || !ADMIN || !CLAVE_ADMIN) { console.error("Faltan BASE_URL, BRIK_ADMIN_MAIL y BRIK_ADMIN_CLAVE."); process.exit(2); }
const CAPTURAS = join(process.cwd(), ".local", "pista-prod");
mkdirSync(CAPTURAS, { recursive: true });
const COMPU = { width: 1440, height: 900 }, CELU = { width: 390, height: 844 };
const ESPERA_CACHE = 65000;   // el proxy recuerda 60 s la dirección de cada gimnasio y con ella su estilo

const s = Date.now().toString(36).slice(-6);
const SLUG = `pista-${s}`, NOMBRE = `Pista ${s} [demo]`, MAIL = `pista-${s}@ejemplo.invalid`, CLAVE = `Pista-${s}-clave`;
let pasos = 0, fallas = 0;
const ok = (m) => console.log(`✓ ${++pasos}. ${m}`);
const mal = (m) => { fallas++; console.log(`✗ ${m}`); };
const chequear = (c, bien, malo) => (c ? ok(bien) : mal(malo));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const nueva = async (viewport = COMPU) => { const c = await b.newContext({ viewport }); const p = await c.newPage(); p.setDefaultNavigationTimeout(90000); p.setDefaultTimeout(60000); return p; };
const entrarForm = async (p, url, mail, clave) => {
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.fill("input[type=email]", mail); await p.fill("input[type=password]", clave); await p.click("button[type=submit]");
};
const comoAdmin = async () => {
  const a = await nueva();
  await entrarForm(a, `${BASE}/ingresar`, ADMIN, CLAVE_ADMIN);
  await a.waitForURL((u) => !u.pathname.startsWith("/ingresar"), { timeout: 90000 });
  return a;
};
const estiloDe = (p) => p.evaluate(() => ({ estilo: document.documentElement.dataset.estilo, modo: document.documentElement.dataset.modo }));
const sacar = async (p, nombre) => { await p.waitForTimeout(900); await p.screenshot({ path: join(CAPTURAS, `${nombre}.png`) }); };
/** Abre la ficha del gimnasio (por su dirección) y devuelve su id. */
async function abrirFicha(a, texto) {
  await a.goto(`${BASE}/admin/gimnasios?q=${encodeURIComponent(texto)}`, { waitUntil: "domcontentloaded" });
  const filas = a.locator("[data-gimnasio-fila]");
  await filas.first().waitFor({ timeout: 60000 });
  const n = await filas.count();
  if (n !== 1) throw new Error(`la búsqueda "${texto}" devolvió ${n} gimnasios (se esperaba uno)`);
  await filas.first().getByRole("link", { name: "Ficha" }).click();
  await a.waitForURL(/\/admin\/[0-9a-f-]{36}/);
  return a.url().match(/\/admin\/([0-9a-f-]{36})/)[1];
}
/** Desde la ficha del super admin: elige estilo y modo y guarda (la misma puerta que usa una persona). */
async function ponerEstiloEnFicha(a, estilo, modo) {
  const ficha = a.locator("[data-estilo-ficha]");
  await ficha.waitFor({ timeout: 60000 });
  await ficha.locator("[data-estilo-select]").selectOption(estilo);
  await ficha.locator("[data-modo-select]").selectOption(modo);
  await ficha.getByRole("button", { name: /Guardar/ }).click();
  await ficha.getByText(/Guardado/).waitFor({ timeout: 60000 });
}

try {
  if (FASE === "demo") {
    const a = await comoAdmin();
    await a.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    const alta = a.locator("[data-alta-gimnasio]");
    await alta.waitFor({ timeout: 90000 });
    await alta.getByRole("button", { name: /Siguiente/ }).click();
    await alta.locator('[data-alta-paso="2"]').waitFor({ state: "visible" });
    await a.fill("input[name=nombre]", NOMBRE);
    await a.fill("input[name=slug]", SLUG).catch(() => {});
    await alta.getByRole("button", { name: /Siguiente/ }).click();
    await a.fill("input[name=dueno]", `Dueño Pista ${s}`);
    await a.fill("input[name=email]", MAIL);
    await a.locator("input[name=contrasena_elegida]").fill(CLAVE);
    await a.click('button:has-text("Crear gimnasio")');
    await alta.locator("strong.numero, .mensaje, [role=alert]").first().waitFor({ timeout: 90000 });
    ok("el gimnasio de prueba [demo] está creado con su dueño");
    await abrirFicha(a, SLUG);
    await ponerEstiloEnFicha(a, "pista", "oscuro");
    ok("desde la ficha del super admin: estilo Pista, modo oscuro (guardado)");
    await dormir(ESPERA_CACHE);

    for (const [tam, viewport] of [["compu", COMPU], ["celu", CELU]]) {
      // La página del gimnasio, sin sesión.
      const pub = await nueva(viewport);
      for (const [nombre, ruta] of [["pagina", ""], ["hacete-socio", "/hacete-socio"], ["ingresar", "/ingresar"]]) {
        const r = await pub.goto(`${BASE}/g/${SLUG}${ruta}`, { waitUntil: "load" });
        await pub.waitForLoadState("networkidle").catch(() => {});
        const e = await estiloDe(pub);
        chequear(r?.status() === 200 && e.estilo === "pista", `${nombre} (${tam}): responde 200 con Pista (${e.modo})`, `${nombre} (${tam}): estado ${r?.status()} y estilo ${e.estilo}`);
        await sacar(pub, `demo-${nombre}-${tam}`);
      }
      // El panel como dueño.
      const d = await nueva(viewport);
      await entrarForm(d, `${BASE}/g/${SLUG}/ingresar`, MAIL, CLAVE);
      await d.waitForURL(/\/panel/, { timeout: 90000 });
      for (const [nombre, ruta] of [["inicio", "/panel"], ["entrada", "/panel/entrada"], ["caja", "/panel/caja"], ["socios", "/panel/socios"], ["configuracion-marca", "/panel/configuracion?pestana=marca"]]) {
        const r = await d.goto(`${BASE}/g/${SLUG}${ruta}`, { waitUntil: "load" });
        await d.locator("h1").first().waitFor({ timeout: 60000 });
        await d.waitForLoadState("networkidle").catch(() => {});
        const e = await estiloDe(d);
        const roto = /Application error|Algo salió mal|No se pudo cargar esta pantalla/i.test(await d.locator("body").innerText());
        chequear(r?.status() === 200 && e.estilo === "pista" && !roto, `${nombre} (${tam}): abre con Pista, sin error`, `${nombre} (${tam}): estado ${r?.status()}, estilo ${e.estilo}, roto=${roto}`);
        await sacar(d, `demo-${nombre}-${tam}`);
      }
      // La barrita del DNI (la ventana de Entrada que vive en todas las pantallas).
      await d.goto(`${BASE}/g/${SLUG}/panel`, { waitUntil: "load" });
      const boton = d.locator("[data-boton-ventana]").first();
      if (await boton.isVisible().catch(() => false)) { await boton.click(); await sacar(d, `demo-barrita-dni-${tam}`); ok(`la barrita del DNI abre (${tam})`); }
      else console.log(`· la barrita del DNI no tiene botón a la vista en ${tam} (puede estar fija abajo): ver demo-inicio-${tam}.png`);
    }
  }

  if (FASE === "temple") {
    const a = await comoAdmin();
    const id = await abrirFicha(a, TEMPLE_SLUG);
    const nombre = await a.locator("h1").first().innerText();
    if (!/temple/i.test(nombre)) throw new Error(`la ficha abierta no es Temple Gym (dice "${nombre}"): no se toca nada`);
    ok(`ficha abierta: ${nombre.trim()} (${id})`);
    const antes = await a.locator("[data-estilo-ficha]").getAttribute("data-estilo-ficha");
    console.log(`· estilo de Temple Gym antes: ${antes}`);
    if (REVERTIR) await ponerEstiloEnFicha(a, "clasico", "oscuro"); else await ponerEstiloEnFicha(a, "pista", "oscuro");
    ok(REVERTIR ? "Temple Gym vuelto a estilo clásico desde la ficha" : "Temple Gym en estilo Pista, modo oscuro, desde la ficha del super admin");
    await dormir(ESPERA_CACHE);
    const esperado = REVERTIR ? "clasico" : "pista";
    for (const [tam, viewport] of [["compu", COMPU], ["celu", CELU]]) {
      const pub = await nueva(viewport);
      for (const [nombreP, ruta] of [["pagina", "/"], ["hacete-socio", "/hacete-socio"], ["ingresar", "/ingresar"], ["panel-sin-sesion", "/panel"]]) {
        const r = await pub.goto(`${TEMPLE_URL}${ruta}`, { waitUntil: "load" });
        await pub.waitForLoadState("networkidle").catch(() => {});
        const e = await estiloDe(pub);
        const roto = /Application error|Algo salió mal|No se pudo cargar esta pantalla|No encontramos este gimnasio/i.test(await pub.locator("body").innerText());
        chequear(r?.status() === 200 && e.estilo === esperado && !roto, `Temple Gym · ${nombreP} (${tam}): 200, estilo ${e.estilo}, sin error (${pub.url().replace(TEMPLE_URL, "") || "/"})`, `Temple Gym · ${nombreP} (${tam}): estado ${r?.status()}, estilo ${e.estilo}, roto=${roto}`);
        await sacar(pub, `temple-${nombreP}-${tam}`);
      }
    }
  }

  if (FASE === "novedad") {
    const a = await comoAdmin();
    const id = await abrirFicha(a, TEMPLE_SLUG);
    const ciudad = (await a.locator('input[name=ciudad], [data-ficha-datos] input').first().inputValue().catch(() => "")).trim();
    console.log(`· ciudad de Temple Gym en su ficha: "${ciudad}" (${id})`);
    if (!ciudad) throw new Error("Temple Gym no tiene ciudad cargada: no se puede dirigir la novedad solo a él (no se publica nada)");
    await a.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    const sec = a.locator("[data-novedades-admin]");
    await sec.waitFor({ timeout: 60000 });
    const titulo = "Pase tiene un diseño nuevo";
    const texto = "Pase tiene un diseño nuevo. Todo está donde estaba; si algo no encontrás, avisanos.";
    const campos = sec.locator("form .campo");
    await sec.locator("form label", { hasText: "Título" }).locator("input").fill(titulo);
    await sec.locator("form label", { hasText: "Texto" }).locator("textarea").fill(texto);
    await sec.locator("form label", { hasText: "Solo a la ciudad" }).locator("input").fill(ciudad);
    void campos;
    await sec.getByRole("button", { name: /Publicar/ }).click();
    const fila = sec.locator("li", { hasText: titulo }).first();
    await fila.waitFor({ timeout: 60000 });
    const t = (await fila.innerText()).replace(/\s+/g, " ");
    const alcanza = t.match(/le llega a (\d+|todos)/)?.[1];
    console.log(`· novedad publicada: ${t}`);
    if (alcanza !== "1") {
      await fila.getByRole("button", { name: /Retirar/ }).click();
      mal(`la novedad le llegaba a "${alcanza}" gimnasios y no solo a Temple Gym: se retiró`);
    } else ok("la novedad le llega a UN solo gimnasio (Temple Gym) y quedó publicada");
  }
} catch (e) { mal(`se cortó: ${String(e.message).split("\n")[0]}`); }
finally {
  await b.close();
  if (FASE === "demo" && process.env.SUPABASE_DB_URL) {
    const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL }); await c.connect();
    const r = await c.query("update public.gimnasios set baja_en = now(), baja_motivo = 'Prueba de Pista automática', suspension_manual_en = coalesce(suspension_manual_en, now()), suspension_manual_motivo = coalesce(suspension_manual_motivo, 'Prueba de Pista') where slug = $1 and nombre like '%[demo]'", [SLUG]);
    await c.end();
    console.log(r.rowCount ? "· gimnasio de prueba dado de baja" : "· (no había gimnasio de prueba para dar de baja)");
  }
}
console.log(fallas ? `\n✗ ${fallas} falla(s) en ${pasos + fallas} pasos` : `\n✓ ${pasos} pasos en verde`);
process.exit(fallas ? 1 : 0);
