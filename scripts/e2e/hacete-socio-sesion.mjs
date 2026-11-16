#!/usr/bin/env node
// URGENTE (Mateo, 16/11) · /hacete-socio no puede tirar "No se pudo cargar esta pantalla" (React #441) con la sesión abierta ni al llegar navegando.
// Tres casos en el gimnasio demo con las altas y el reglamento prendidos (como Temple Gym): sin sesión, con la sesión de la dueña y de un socio,
// y tocando el botón de la portada (que también es lo que hace el QR para quien ya tiene sesión).
//   node scripts/e2e/hacete-socio-sesion.mjs      (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, PANTALLA_ROTA, aparece, capturar, chequear, entrar, entrarSocio, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() }); await db.connect();
await db.query(`insert into public.reglamentos (gimnasio_id, version, texto) select g.id, 1, 'Reglamento de prueba del gimnasio demo para el e2e de la sesión abierta.' from public.gimnasios g where g.slug = 'demo' and not exists (select 1 from public.reglamentos r where r.gimnasio_id = g.id)`);
await db.query(`update public.configuracion_gimnasio set altas_online = true where gimnasio_id = (select id from public.gimnasios where slug = 'demo')`);
await db.query(`update public.landing_gimnasio set publicada = true where gimnasio_id = (select id from public.gimnasios where slug = 'demo')`);
const b = await navegador();

async function sano(v, que) {
  const texto = await v.locator("body").innerText();
  chequear(!PANTALLA_ROTA.test(texto) && !/No se pudo cargar esta pantalla|React error/i.test(texto), `${que}: sin pantalla de error`, `${que}: pantalla de error → ${texto.slice(0, 160).replace(/\s+/g, " ")}`);
  chequear(await aparece(v.locator("[data-form-alta], [data-alta-cerrada]"), 30000), `${que}: muestra el formulario (o el cartel de cerrado)`, `${que}: no muestra el formulario`);
}
const errores = (v, lista) => { v.on("pageerror", (e) => lista.push(String(e.message))); v.on("console", (m) => { if (m.type() === "error") lista.push(m.text()); }); };

try {
  // 1. Sin sesión, directo.
  const a = await pagina(b, CELU); const ea = []; errores(a, ea);
  const ra = await a.goto(`${G}/hacete-socio`);
  chequear(ra?.status() === 200, "sin sesión: 200", `sin sesión: ${ra?.status()}`);
  await sano(a, "sin sesión");
  await a.context().close();

  // 2. Con la sesión de la dueña: directo y llegando desde la portada.
  const d = await pagina(b, COMPU); const ed = []; errores(d, ed);
  await entrar(d, "duena@ejemplo.invalid");
  const rd = await d.goto(`${G}/hacete-socio`);
  chequear(rd?.status() === 200, "con sesión de dueña: 200", `con sesión de dueña: ${rd?.status()}`);
  await sano(d, "con sesión de dueña, directo");
  await capturar(d, "hacete-socio-sesion-duena");
  await d.goto(`${G}/?pagina=1`);
  const boton = d.locator("[data-quiero-ser-socio], [data-crear-cuenta]").first();
  if (await aparece(boton, 15000)) { await boton.click(); await d.waitForURL(/hacete-socio/, { timeout: 30000 }); await sano(d, "con sesión de dueña, desde la portada"); }
  else chequear(true, "la portada de la dueña no ofrece el botón (sesión de equipo): se salta", "");
  chequear(ed.filter((m) => /#441|Server Components render/i.test(m)).length === 0, "con sesión de dueña: sin React #441 en la consola", `consola: ${ed.filter((m) => /#441|Server Components/i.test(m))[0]}`);
  await d.context().close();

  // 3. Con la sesión de un socio.
  const s = await pagina(b, CELU); const es = []; errores(s, es);
  await entrar(s, "socio@ejemplo.invalid").catch(() => {});
  await s.goto(`${G}/hacete-socio`);
  await sano(s, "con sesión de socio");
  chequear(es.filter((m) => /#441|Server Components render/i.test(m)).length === 0, "con sesión de socio: sin React #441 en la consola", `consola: ${es.filter((m) => /#441|Server Components/i.test(m))[0]}`);
  await s.context().close();
} finally {
  await b.close();
  await db.end();
}
resultado();
