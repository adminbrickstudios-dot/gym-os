#!/usr/bin/env node
// H2c · Fechas de cobertura visibles y editables, con sesión real:
//   1. La dueña da de alta a un socio "anotado hace 10 días" (alta en el pasado, sin pagos) y el formulario con un pago pasado dice con
//      letras "Cubre del D/M al D/M" antes de confirmar.
//   2. Cobrar (desde la ficha) muestra "Cubre del <alta> al <alta + 1 mes - 1 día>" y "Cubierto hasta"; la dueña toca "Cambiar fechas",
//      pone otro desde (3 días después) y cobra: la cobertura queda con esas fechas, la ficha dice el nuevo "Cubierto hasta", el monto es
//      el mismo, y Control lo muestra con la propuesta y quién lo cambió.
//   3. La recepción abre Cobrar del mismo socio: ve la propuesta de lo que sigue, SIN "Cambiar fechas".
//   4. Celular: la dueña ve y usa lo mismo sin desbordar la página.
//   node scripts/e2e/fechas-cobertura.mjs     (con scripts/local/levantar.sh corriendo)
// Datos ficticios. Escrito para correr en Actions (npm run e2e con `solo`).
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const s = Date.now().toString().slice(-4);
const [{ id: gim, zona_horaria: zona }] = (await db.query(`select id, zona_horaria from public.gimnasios where slug = 'demo'`)).rows;
const [{ hoy }] = (await db.query(`select (now() at time zone $1)::date::text as hoy`, [zona])).rows;
const sumar = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// Un mes después, con el mismo criterio de la base (sumar_meses_ancla): mismo día del mes siguiente (o el último del mes).
const masUnMes = (iso) => {
  const [a, m, d] = iso.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m, Math.min(d, ultimo))).toISOString().slice(0, 10);
};
const dm = (iso) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;
const dm2 = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;   // la ficha usa dos dígitos

const alta = sumar(hoy, -10);                    // "se anotó hace 10 días"
const propDesde = alta, propHasta = sumar(masUnMes(alta), -1);
const cambioDesde = sumar(alta, 3), cambioHasta = sumar(masUnMes(cambioDesde), -1);
const dni = `8${s}001`;

async function abrirCobrarDe(p, socioId) {
  await p.goto(`${G}/panel/socios/${socioId}`);
  await p.locator("[data-cobrar-abrir]").first().click();
  await p.locator("[data-cobrar][data-estado=listo]").waitFor({ timeout: 60000 });
  if (!(await p.locator("[data-cobrar-linea=cuota]").count())) {
    await p.locator('button:has-text("Cuota")').first().click();
    await p.locator("[data-cobrar-linea=cuota]").first().waitFor({ timeout: 10000 });
  }
}
const elegirTransferencia = async (p) => {
  const t = p.locator('[data-cobrar-medio="transferencia"]');
  if (await t.count() && await t.isEnabled()) await t.click();
};

const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");

  // ── 1 · El alta en el pasado dice lo que cubre antes de confirmar ───
  await p.goto(`${G}/panel/socios/nuevo`);
  await p.locator("[data-carga-pasada]").waitFor({ timeout: 60000 });
  await p.fill("input[name=nombre]", `Fechas${s}`);
  await p.fill("input[name=apellido]", "Pasada");
  await p.fill("input[name=dni]", dni);
  await elegirPlan(p, "Plan Full");
  await p.locator("[data-pasado-abrir]").click();
  await p.fill("[data-pasado-alta]", alta);
  await p.fill("[data-pasado-fecha]", alta);
  await p.fill("[data-pasado-monto]", "25000");
  const cubreAlta = p.locator("[data-pasado-cubre] [data-cubre-texto]");
  await cubreAlta.waitFor({ timeout: 30000 });
  const txtAlta = (await cubreAlta.innerText()).trim();
  chequear(txtAlta === `Cubre del ${dm(propDesde)} al ${dm(propHasta)}`, `el alta en el pasado dice con letras “${txtAlta}” antes de confirmar`, `el alta dice “${txtAlta}” y se esperaba del ${dm(propDesde)} al ${dm(propHasta)}`);
  chequear(await p.locator("[data-pasado-cubre] [data-cubre-cambiar]").count() === 1, "y deja cambiar las fechas (dueña)", "no ofrece cambiar las fechas en el alta");
  // Sin pagos: solo el alta con fecha; después se cobra desde Cobrar.
  await p.fill("[data-pasado-fecha]", "");
  await p.fill("[data-pasado-monto]", "");
  await p.locator('button:has-text("Dar de alta")').first().click();
  await p.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}/, { timeout: 60000 });
  const socioId = p.url().match(/socios\/([0-9a-f-]{36})/)[1];
  ok("el alta con fecha de hace 10 días entra y abre la ficha");

  // ── 2 · Cobrar: propuesta, cambio de fechas, cobro ──────────────────
  await abrirCobrarDe(p, socioId);
  const cubre = p.locator("[data-cobrar-cubre]").first();
  const txt = (await cubre.innerText()).trim();
  chequear(txt === `Cubre del ${dm(propDesde)} al ${dm(propHasta)}`, `Cobrar dice con letras “${txt}” (la propuesta de H2b)`, `Cobrar dice “${txt}” y se esperaba del ${dm(propDesde)} al ${dm(propHasta)}`);
  const hastaTxt = (await p.locator("[data-cubre-hasta]").first().innerText()).trim();
  chequear(hastaTxt === `Cubierto hasta el ${dm(propHasta)}`, `y “${hastaTxt}”`, `“cubierto hasta” dice “${hastaTxt}”`);
  const totalAntes = Number(await p.locator("[data-cobrar-total]").getAttribute("data-cobrar-total"));
  await capturar(p, "fechas-cobertura-cobrar-propuesta");
  await p.locator("[data-cubre-cambiar]").click();
  await p.fill("[data-cubre-desde]", cambioDesde);
  await p.fill("[data-cubre-hasta-campo]", cambioHasta);
  const txt2 = (await p.locator("[data-cubre-texto]").first().innerText()).trim();
  chequear(txt2 === `Cubre del ${dm(cambioDesde)} al ${dm(cambioHasta)}`, `al cambiar las fechas dice “${txt2}”`, `después de cambiar dice “${txt2}”`);
  chequear(await p.locator("[data-cubre-cambiada]").count() === 1, "y recuerda cuál era la propuesta, sin tocar el monto", "no recuerda la propuesta");
  chequear(Number(await p.locator("[data-cobrar-total]").getAttribute("data-cobrar-total")) === totalAntes, "el monto no cambia solo al mover las fechas", "el monto cambió al mover las fechas");
  await capturar(p, "fechas-cobertura-cobrar-cambiadas");
  await elegirTransferencia(p);
  await p.locator("[data-cobrar-confirmar]").click();
  await p.locator("[data-cobrar-hecho]").waitFor({ timeout: 30000 });
  ok("se cobra con las fechas cambiadas");
  await p.keyboard.press("Escape");

  const [cob] = (await db.query(`select c.desde, c.hasta, so.cubierto_hasta from public.coberturas c join public.socios so on so.id = c.socio_id
                                   where c.socio_id = $1 and c.anulada_en is null order by c.desde`, [socioId])).rows;
  const loc = async (m) => (await db.query(`select ($1::timestamptz at time zone $2)::date::text as d`, [m, zona])).rows[0].d;
  chequear(cob && await loc(cob.desde) === cambioDesde && await loc(cob.hasta) === sumar(cambioHasta, 1), `la cobertura guardada es del ${dm(cambioDesde)} al ${dm(cambioHasta)} (hasta inclusive)`, `la cobertura quedó distinta: ${cob && await loc(cob.desde)} → ${cob && await loc(cob.hasta)}`);
  const [{ n }] = (await db.query(`select count(*)::int n from public.socios where id = $1 and cubierto_hasta is distinct from privado.calcular_cubierto_hasta(id)`, [socioId])).rows;
  chequear(n === 0, "cubierto_hasta guardado = recalculado", "cubierto_hasta guardado no coincide con el recalculado");
  await p.goto(`${G}/panel/socios/${socioId}`);
  const ficha = await p.locator("main").innerText();
  chequear(new RegExp(`Cubierto hasta\\s*0?${dm(cambioHasta).replace("/", "/0?")}\\b`, "i").test(ficha), `la ficha dice “cubierto hasta ${dm(cambioHasta)}”`, `la ficha no dice el nuevo cubierto hasta; muestra: ${(ficha.match(/[\s\S]{0,40}ubierto[\s\S]{0,50}/gi) ?? ["nada"]).join(" | ").replace(/\s+/g, " ")}`);

  // Control: quién lo cambió y cuál era la propuesta.
  await p.goto(`${G}/panel/control?tipos=cobertura`);
  const control = await p.locator("main").innerText();
  chequear(/cambió las fechas/.test(control) && /la propuesta era del/.test(control), "Control muestra el cambio de fechas con la propuesta", "Control no muestra el cambio de fechas");
  if (p.errores.length) falla(p.errores.join(" | "));

  // ── 3 · Recepción solo ve la propuesta ──────────────────────────────
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await abrirCobrarDe(r, socioId);
  const txtR = (await r.locator("[data-cobrar-cubre]").first().innerText()).trim();
  chequear(txtR === `Cubre del ${dm(sumar(cambioHasta, 1))} al ${dm(sumar(masUnMes(sumar(cambioHasta, 1)), -1))}`, `recepción ve la propuesta que sigue: “${txtR}”`, `recepción ve “${txtR}”`);
  chequear(await r.locator("[data-cubre-cambiar]").count() === 0, "y no tiene “Cambiar fechas”", "recepción puede cambiar las fechas");
  await capturar(r, "fechas-cobertura-recepcion");
  if (r.errores.length) falla(r.errores.join(" | "));

  // ── 4 · Celular ─────────────────────────────────────────────────────
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await abrirCobrarDe(c, socioId);
  await c.locator("[data-cubre-cambiar]").click();
  await c.locator("[data-cubre-campos]").waitFor({ timeout: 10000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  chequear(ancho, "celular: Cobrar con las fechas editables no ensancha la página", "celular: scroll horizontal");
  await capturar(c, "fechas-cobertura-celular");
  if (c.errores.length) falla(c.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
await db.end();
resultado();
