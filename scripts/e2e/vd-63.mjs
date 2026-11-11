#!/usr/bin/env node
// VD-63 · Información y ayuda, en compu y en celular:
//   - Ctrl+K (o la lupa en el celular): escribir "¿cómo anulo un cobro?", "¿cómo pauso a un socio?" o "¿qué es día fijo?"
//     ofrece la pregunta, lleva a su respuesta (abierta, resaltada) y su botón lleva a la pantalla donde se hace;
//   - el centro de ayuda (/panel/ayuda y /app/ayuda) se busca y no inventa resultados;
//   - una sección apagada por el gimnasio saca sus preguntas; el rol no ve preguntas de pantallas que no abre;
//   - el socio ve la Info del gimnasio SIN pedirla (desde el inicio y desde Yo), con los mismos horarios que la página pública,
//     el reglamento que puede releer, contacto y cómo llegar; sin desbordes en 390 px.
//   npm run e2e:vd-63            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, entrarSocio, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const sinDesborde = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const dialogo = (p) => p.locator("[role=dialog][aria-label=Buscar]");
const abrirBuscador = async (p, celu) => {
  if (celu) { await p.locator('button[aria-label="Buscar"]:visible').first().click(); await dialogo(p).waitFor({ timeout: 15000 }); return; }
  // Antes de hidratar la página la tecla se pierde: se repite hasta que el diálogo abre.
  for (let i = 0; i < 12; i++) {
    await p.keyboard.press("Control+k");
    if (await dialogo(p).waitFor({ timeout: 1500 }).then(() => true, () => false)) return;
  }
  await dialogo(p).waitFor({ timeout: 5000 });
};
const REGLAMENTO = "VD-63 prueba: 1. Traé toalla. 2. Dejá los discos en su lugar. 3. Respetá los horarios.";

const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const [{ id: gim, apagadas }] = (await db.query(`select g.id, c.secciones_apagadas as apagadas from public.gimnasios g join public.configuracion_gimnasio c on c.gimnasio_id = g.id where g.slug = 'demo'`)).rows;
// El reglamento que el socio tiene que poder releer: si el demo no tiene uno vigente, se crea para la prueba y se saca al final.
let creado = null;
const [{ n: hayReglamento }] = (await db.query(`select count(*)::int n from public.documentos where gimnasio_id = $1 and clave = 'reglamento' and activo`, [gim])).rows;
if (!hayReglamento) {
  const [{ id: dueno }] = (await db.query(`select id from public.equipo where gimnasio_id = $1 and rol = 'dueno' order by id limit 1`, [gim])).rows;
  const [{ v }] = (await db.query(`select coalesce(max(version), 0) + 1 v from public.documentos where gimnasio_id = $1 and clave = 'reglamento'`, [gim])).rows;
  creado = (await db.query(`insert into public.documentos (gimnasio_id, clave, version, titulo, texto, creado_por) values ($1,'reglamento',$2,'Reglamento',$3,$4) returning id`, [gim, v, REGLAMENTO, dueno])).rows[0].id;
}
const [{ texto: textoReglamento }] = (await db.query(`select texto from public.documentos where gimnasio_id = $1 and clave = 'reglamento' and activo`, [gim])).rows;

const b = await navegador();
try {
  // ── 1 · Ctrl+K lleva a la respuesta y a su botón (dueña, compu y celular) ──
  for (const [tam, vp] of [["compu", COMPU], ["celu", CELU]]) {
    const celu = tam === "celu";
    const d = await pagina(b, vp);
    await entrar(d, "duena@ejemplo.invalid");
    await d.goto(`${G}/panel`);
    for (const [escribo, id, destino] of [
      ["¿cómo anulo un cobro?", "anular-cobro", /\/panel\/socios$/],
      ["¿cómo pauso a un socio?", "pausar-socio", /\/panel\/socios$/],
      ["¿qué es día fijo?", "dia-fijo", /\/panel\/configuracion\?pestana=cobros/],
    ]) {
      await d.goto(`${G}/panel`);
      await abrirBuscador(d, celu);
      await dialogo(d).locator("[data-buscador-campo]").fill(escribo);
      const fila = dialogo(d).locator(`[data-buscador-ayuda="${id}"]`);
      await fila.waitFor({ timeout: 15000 }).catch(async (e) => {
        throw new Error(`${tam} · el diálogo abrió pero no ofrece “${id}” | escrito: ${await dialogo(d).locator("[data-buscador-campo]").inputValue()} | diálogo: ${(await dialogo(d).innerText()).replace(/\s+/g, " ").slice(0, 500)}`);
      });
      chequear(true, `${tam} · Ctrl+K “${escribo}” ofrece la pregunta`, "");
      if (celu && id === "anular-cobro") await capturar(d, "vd63-celu-ctrlk");
      await fila.click({ timeout: 15000 }).catch(async (e) => {
        const cajas = [];
        for (let k = 0; k < 6; k++) { cajas.push(JSON.stringify(await fila.boundingBox().catch(() => null))); await d.waitForTimeout(250); }
        throw new Error(`${e.message.split("
")[0]} | cajas de la fila: ${cajas.join(" ; ")} | filas: ${await dialogo(d).locator("[data-buscador-ayuda]").count()}`);
      });
      await d.waitForURL(new RegExp(`/panel/ayuda\\?p=${id}`), { timeout: 30000 });
      const li = d.locator(`[data-pregunta="${id}"]`);
      await li.waitFor({ timeout: 30000 });
      chequear(await li.getAttribute("data-abierta") === "si" && (await li.locator("[data-respuesta]").innerText()).length > 20, `${tam} · lleva a la respuesta, ya abierta`, `${tam} · ${id}: la respuesta no salió abierta`);
      chequear(await sinDesborde(d), `${tam} · la ayuda no se desborda`, `${tam} · la ayuda se desborda`);
      if (id === "dia-fijo" || (celu && id === "anular-cobro")) await capturar(d, `vd63-${tam}-ayuda-${id}`);
      await d.locator(`[data-ayuda-boton-destino="${id}"]`).click();
      await d.waitForURL((u) => destino.test(u.pathname + u.search), { timeout: 60000 });
      chequear(!/Application error/.test(await d.locator("main").first().innerText()), `${tam} · el botón de “${id}” lleva a la pantalla donde se hace (${new URL(d.url()).pathname})`, `${tam} · ${id}: el botón no llevó a la pantalla`);
    }

    // Centro de ayuda: buscador propio, sin resultados inventados y con el pie de versión.
    await d.goto(`${G}/panel/ayuda`);
    await d.locator("[data-centro-ayuda]").waitFor({ timeout: 30000 });
    const total = await d.locator("[data-pregunta]").count();
    await d.locator("[data-ayuda-buscar]").fill("pausar");
    chequear(await d.locator("[data-pregunta]").count() >= 1 && await d.locator("[data-pregunta]").count() < total, `${tam} · el buscador del centro de ayuda filtra (“pausar”)`, `${tam} · el buscador no filtra`);
    await d.locator("[data-ayuda-buscar]").fill("xyzzy plugh");
    chequear(await d.locator("[data-ayuda-vacia]").count() === 1, `${tam} · sin resultados lo dice, no inventa`, `${tam} · sin aviso de sin resultados`);
    chequear(await d.locator("[data-ayuda-version]").count() === 1, `${tam} · el pie dice la versión de los textos`, `${tam} · falta la versión`);
    if (d.errores.length) falla(`${tam}: ${d.errores.join(" | ")}`);
    await d.context().close();
  }

  // ── 2 · Menú: la ayuda está en el panel para todos los roles; el rol ve solo lo suyo ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/ayuda`);
  await r.locator("[data-centro-ayuda]").waitFor({ timeout: 30000 });
  chequear(await r.locator('aside a[href="/panel/ayuda"]').count() === 1, "el menú tiene “Ayuda”", "el menú no tiene Ayuda");
  chequear(await r.locator('[data-pregunta="anular-cobro"]').count() === 1 && await r.locator('[data-pregunta="gasto"]').count() === 0, "recepción ve cómo anular (lo pide) y no ve las preguntas de Gastos (no abre esa pantalla)", "las preguntas de la recepción no coinciden con su rol");
  await r.context().close();
  const pr = await pagina(b, COMPU);
  await entrar(pr, "profe@ejemplo.invalid");
  await pr.goto(`${G}/panel/ayuda`);
  await pr.locator("[data-centro-ayuda]").waitFor({ timeout: 30000 });
  chequear(await pr.locator('[data-pregunta="anular-cobro"]').count() === 0 && await pr.locator('[data-pregunta="pin-atiende"]').count() === 1, "el profe no ve preguntas de cobros, sí las generales", "las preguntas del profe no coinciden con su rol");
  await pr.context().close();

  // ── 3 · Una sección apagada saca sus preguntas (se restaura al terminar) ──
  try {
    await db.query(`update public.configuracion_gimnasio set secciones_apagadas = (select array(select distinct unnest(secciones_apagadas || array['caja']))) where gimnasio_id = $1`, [gim]);
    const a = await pagina(b, COMPU);
    await entrar(a, "duena@ejemplo.invalid");
    await a.goto(`${G}/panel/ayuda`);
    await a.locator("[data-centro-ayuda]").waitFor({ timeout: 30000 });
    chequear(await a.locator('[data-pregunta="caja-turno"]').count() === 0 && await a.locator('[data-pregunta="entrada-dni"]').count() === 1, "con Caja apagada, no aparecen las preguntas de Caja (y las demás siguen)", "Caja apagada y su pregunta sigue en la ayuda");
    await a.context().close();
  } finally {
    await db.query(`update public.configuracion_gimnasio set secciones_apagadas = $2 where gimnasio_id = $1`, [gim, apagadas]);
  }

  // ── 4 · El socio ve la Info del gimnasio sin pedirla, y la ayuda de la app ──
  const pub = await pagina(b, COMPU);
  await pub.goto(`${G}/`);
  const horariosPublicos = (await pub.locator("[data-horarios-sede] dt, #horarios dt").allInnerTexts()).map((t) => t.trim());
  await pub.context().close();
  for (const [tam, vp] of [["compu", COMPU], ["celu", CELU]]) {
    const s = await pagina(b, vp);
    await entrarSocio(s, "+5490000100002");
    await s.locator("[data-info-gimnasio-acceso]").waitFor({ timeout: 30000 });
    ok(`${tam} · el inicio de la app ofrece “Info del gimnasio” sin que el socio la busque`);
    await s.locator("[data-info-gimnasio-acceso]").click();
    await s.waitForURL(/\/app\/info/, { timeout: 30000 });
    await s.locator("[data-info-gimnasio]").waitFor({ timeout: 30000 });
    chequear(await s.locator("[data-info-reglamento]").count() === 1, `${tam} · el reglamento se puede releer`, `${tam} · falta el reglamento`);
    await s.locator("[data-info-reglamento] summary").click();
    chequear((await s.locator("[data-info-reglamento] details").innerText()).includes(textoReglamento.slice(0, 40)), `${tam} · el reglamento es el vigente del gimnasio`, `${tam} · el reglamento no coincide`);
    if (horariosPublicos.length) {
      const enApp = (await s.locator("[data-info-horarios] dt").allInnerTexts()).map((t) => t.trim());
      chequear(horariosPublicos.every((h) => enApp.includes(h)), `${tam} · los horarios son los mismos de la página pública (${enApp.length} filas)`, `${tam} · los horarios difieren: página ${horariosPublicos.join("|")} / app ${enApp.join("|")}`);
    } else ok(`${tam} · la página pública del demo no tiene horarios cargados: la app tampoco los inventa (${await s.locator("[data-info-horarios]").count()} bloques)`);
    chequear(await sinDesborde(s), `${tam} · Info del gimnasio sin desborde`, `${tam} · Info del gimnasio se desborda`);
    await capturar(s, `vd63-${tam}-info`, true);

    await s.goto(`${G}/app/yo`);
    await s.locator('[data-yo-fila="info"]').waitFor({ timeout: 30000 });
    await s.locator('[data-yo-fila="ayuda"]').click();
    await s.waitForURL(/\/app\/ayuda/, { timeout: 30000 });
    await s.locator("[data-centro-ayuda]").waitFor({ timeout: 30000 });
    await s.locator("[data-ayuda-buscar]").fill("pagar");
    await s.locator('[data-pregunta="app-pagar"] button').click();
    await s.locator('[data-ayuda-boton-destino="app-pagar"]').waitFor({ timeout: 10000 });
    ok(`${tam} · la ayuda del socio se busca y trae el botón de la respuesta`);
    chequear(await sinDesborde(s), `${tam} · ayuda del socio sin desborde`, `${tam} · ayuda del socio se desborda`);
    if (tam === "celu") await capturar(s, "vd63-celu-ayuda-socio");
    if (s.errores.length) falla(`${tam} socio: ${s.errores.join(" | ")}`);
    await s.context().close();
  }
} catch (e) { falla(`se cortó: ${e.message.split("\n").slice(0, 14).join(" | ")}`); }
finally {
  if (creado) await db.query(`delete from public.documentos where id = $1`, [creado]).catch(() => {});
  await db.end(); await b.close(); resultado();
}
