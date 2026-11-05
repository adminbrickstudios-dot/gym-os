#!/usr/bin/env node
// REV-5 · Segunda pasada: BRIK da de alta un gimnasio de cada tipo y lo deja
// andando. Para cada tipo de la plantilla (musculación, grande, box, yoga,
// artes, natación, personal, 24 h): el super admin lo crea → el dueño entra
// con su contraseña → Inicio con primeros pasos → Planes trae los de la
// plantilla (sin precio, con el aviso) → Clases aparece o no según el tipo →
// le pone precio al primero y queda a la venta. En el celular, sin desbordes.
//   npm run e2e:rev-5            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, PLATAFORMA, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ p: plantillas }] = (await db.query(`select privado.plantillas_gimnasio() p`)).rows;
const s = Date.now().toString().slice(-5);
const b = await navegador();
try {
  const a = await pagina(b, COMPU);
  a.setDefaultNavigationTimeout(120000);
  await entrar(a, "admin@ejemplo.invalid", undefined, PLATAFORMA);
  const creados = [];
  for (const tipo of Object.keys(plantillas)) {
    await a.goto(`${PLATAFORMA}/admin`);
    await a.fill("input[name=nombre]", `Rev5 ${tipo} ${s}`);
    await a.fill("input[name=dueno]", `Dueño ${tipo}`);
    await a.fill("input[name=email]", `rev5-${tipo}-${s}@ejemplo.invalid`.replace(/[^a-z0-9@.-]/gi, ""));
    await a.locator("select[name=tipo]").selectOption(tipo);
    await a.click('button:has-text("Crear gimnasio")');
    await a.locator("a[data-alta-equipo]").waitFor({ timeout: 60000 });
    const clave = (await a.locator("strong.numero").first().innerText()).trim();
    const id = (await a.locator("a[data-alta-equipo]").getAttribute("href")).split("/").pop();
    const [{ slug }] = (await db.query(`select slug from public.gimnasios where id = $1`, [id])).rows;
    creados.push({ tipo, clave, slug, mail: `rev5-${tipo}-${s}@ejemplo.invalid`.replace(/[^a-z0-9@.-]/gi, "") });
  }
  ok(`BRIK crea ${creados.length} gimnasios, uno de cada tipo: ${creados.map((c) => c.tipo).join(", ")}`);

  for (const c of creados) {
    const t = plantillas[c.tipo];
    const G = GIMNASIO(c.slug);
    const d = await pagina(b, CELU);
    d.setDefaultNavigationTimeout(120000);
    try {
      await entrar(d, c.mail, c.clave, G);
      await d.locator("[data-primeros-pasos]").waitFor({ timeout: 60000 });
      const menu = (await d.locator("nav").evaluateAll((xs) => xs.map((x) => x.textContent)).catch(() => [])).join(" ");
      const conClases = t.modo_clases !== "ninguno";
      const w = await d.evaluate(() => document.documentElement.scrollWidth);
      await d.goto(`${G}/panel/planes`);
      await d.locator("main h1").waitFor({ timeout: 60000 });
      const nombres = t.planes.map((x) => x.nombre);
      const enPantalla = await d.locator("li[data-plan]").evaluateAll((xs) => xs.map((x) => x.getAttribute("data-plan")));
      const faltan = nombres.filter((n) => !enPantalla.includes(n));
      // Le pone precio al primero.
      const primero = d.locator(`li[data-plan="${nombres[0]}"]`);
      await primero.locator('button:has-text("💲 Precios")').click();
      await primero.locator('input[aria-label="Precio general"]').fill("20.000");
      await primero.locator('button:has-text("Guardar precios")').click();
      const conPrecio = await primero.getByText("$20.000").first().waitFor({ timeout: 30000 }).then(() => true, () => false);
      chequear(!faltan.length && conPrecio && /Clases/.test(menu) === conClases && w <= CELU.width + 1,
        `${c.tipo}: entra el dueño, primeros pasos, ${nombres.length} planes de la plantilla (le pone precio a “${nombres[0]}”), ${conClases ? `Clases prendida (${t.modo_clases})` : "sin Clases en el menú"}`,
        `${c.tipo}: faltan planes [${faltan.join(", ")}] · precio ${conPrecio} · clases en el menú ${/Clases/.test(menu)} (esperaba ${conClases}) · ancho ${w}`);
      if (conClases && t.actividades.length) {
        await d.goto(`${G}/panel/clases/grilla`);
        await d.locator("main h1").waitFor({ timeout: 60000 });
        const txt = await d.locator("main").innerText();
        const sin = t.actividades.map((x) => x[0]).filter((n) => !txt.includes(n));
        chequear(!sin.length, `${c.tipo}: la grilla trae sus actividades (${t.actividades.map((x) => x[0]).join(", ")})`, `${c.tipo}: faltan actividades ${sin.join(", ")}`);
      }
      if (d.errores.length) falla(`${c.tipo}: ${d.errores.join(" | ")}`);
    } catch (e) {
      falla(`${c.tipo}: se cortó: ${e.message.split("\n")[0]}`);
      await capturar(d, `ROTA-rev5-${c.tipo}`, true).catch(() => {});
    }
    await d.context().close();
  }
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.end();
}
await b.close();
resultado();
