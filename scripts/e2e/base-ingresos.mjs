#!/usr/bin/env node
// BASE-3 · El ingreso que hace la recepción sale como AVISO abajo a la derecha (D40): 20 ingresos seguidos con el atajo
// (F2 → celular o DNI → Enter), cada uno en menos de TOPE ms de Enter al aviso, con al menos 3 colores; un rojo se toca y abre el panel lateral
// con COBRAR AHORA y "Dejar pasar igual…" (que abre la ventana grande); y la opción de Configuración → Entrada vuelve a la ventana grande.
//   node scripts/e2e/base-ingresos.mjs     (con scripts/local/levantar.sh corriendo; TOPE_MS afloja el tope en una compu lenta)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const TOPE = Number(process.env.TOPE_MS ?? 1000);
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const modo = async (m) => db.query(`insert into public.configuracion_entrada (gimnasio_id, resultado_entrada) values ($1, $2) on conflict (gimnasio_id) do update set resultado_entrada = $2`, [gim, m]);
const { rows } = await db.query(`
  select s.id, s.telefono as dni, s.nombre || ' ' || s.apellido as nombre from public.socios s
   where s.gimnasio_id = $1 and s.telefono is not null and s.dado_de_baja_en is null
   order by (s.nombre = 'Testigo') desc, s.numero limit 20`, [gim]);
const b = await navegador();
try {
  if (rows.length < 20) throw new Error(`faltan socios: hay ${rows.length}`);
  await modo("aviso");
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel`);
  await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
  const tiempos = [], colores = new Set(); let rojo = null;
  for (const s of rows) {
    await r.keyboard.press("F2");
    const campo = r.locator("[data-ventana-campo]");
    await campo.waitFor({ timeout: 10000 });
    await campo.fill(s.dni);
    const aviso = r.locator(`[data-aviso-socio="${s.id}"]`).first();
    const t0 = Date.now();
    await r.keyboard.press("Enter");
    await aviso.waitFor({ timeout: 30000 });
    tiempos.push(Date.now() - t0);
    const color = await aviso.getAttribute("data-aviso-entrada");
    colores.add(color);
    if (color === "rojo" && !rojo) rojo = s;
    await r.locator("[data-ventana-entrada]").waitFor({ state: "detached", timeout: 15000 });
  }
  tiempos.sort((a, b) => a - b);
  console.log("TIEMPOS ms:", tiempos.join(" "));
  chequear(colores.size >= 3, `20 ingresos con el atajo: salen ${colores.size} colores de aviso (${[...colores].join(", ")})`, `solo ${[...colores].join(", ")}`);
  chequear(tiempos[19] < TOPE, `de Enter al aviso: mediana ${tiempos[10]} ms, peor ${tiempos[19]} ms (tope ${TOPE} ms)`, `el peor tardó ${tiempos[19]} ms`);
  const caja = await r.locator("[data-avisos-entrada]").boundingBox();
  const vista = r.viewportSize();
  chequear(!!caja && caja.x + caja.width > vista.width * 0.6 && caja.y > vista.height * 0.4, "los avisos están abajo a la derecha", `caja ${JSON.stringify(caja)}`);
  chequear((await r.locator("[data-aviso-entrada]").count()) <= 3, "se apilan de a 3 como mucho", "hay más de 3 avisos");

  // Un rojo: se toca → panel lateral → COBRAR AHORA / Dejar pasar igual
  if (!rojo) throw new Error("no salió ningún rojo");
  await r.locator(`[data-aviso-socio="${rojo.id}"] button[aria-label^="Abrir"]`).first().click();
  const panel = r.locator("[data-panel-socio-lateral]");
  await panel.locator("[data-panel-socio-cobrar]").waitFor({ timeout: 30000 });
  ok("tocar el aviso rojo abre el panel lateral con COBRAR AHORA");
  await panel.locator("[data-panel-socio-dejar-pasar]").click();
  await r.locator("[data-ventana-entrada]").waitFor({ timeout: 30000 });
  ok("“Dejar pasar igual…” abre la ventana grande con sus botones");
  await r.keyboard.press("Escape");

  // La opción de Configuración: volver a la ventana grande
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/configuracion?pestana=entrada`);
  await d.locator('[data-resultado="ventana"]').waitFor({ timeout: 60000 });
  await d.locator('[data-resultado="ventana"]').click();
  await d.locator('button:has-text("Guardar")').first().click();
  for (let i = 0; i < 40; i++) { const [{ m }] = (await db.query(`select resultado_entrada as m from public.configuracion_entrada where gimnasio_id = $1`, [gim])).rows; if (m === "ventana") break; await d.waitForTimeout(500); }
  const [{ m }] = (await db.query(`select resultado_entrada as m from public.configuracion_entrada where gimnasio_id = $1`, [gim])).rows;
  chequear(m === "ventana", "Configuración → Entrada: “Ventana grande” se guarda", `quedó ${m}`);
  await r.reload();
  await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
  await r.keyboard.press("F2");
  await r.locator("[data-ventana-campo]").fill(rows[0].dni);
  await r.keyboard.press("Enter");
  await r.locator("[data-ventana-veredicto]").waitFor({ timeout: 30000 });
  ok("con “Ventana grande” el resultado vuelve a ser el veredicto de siempre");
  await r.keyboard.press("Escape");
  for (const [q, p] of [["recepción", r], ["dueña", d]]) if (p.errores.length) falla(`${q}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await modo("ventana");   // el demo queda como lo siembra (los recorridos viejos usan la ventana grande)
await db.end();
await b.close();
resultado();
