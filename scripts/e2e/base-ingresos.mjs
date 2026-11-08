#!/usr/bin/env node
// BASE-3/BASE-11 · 20 ingresos seguidos con el atajo (F2 → DNI → Enter), con socios de distintos estados: cada uno en menos de 1 s
// de Enter hasta el veredicto, y se ven al menos 3 colores distintos. Los ingresos se anulan al final con el motivo de la prueba.
//   node scripts/e2e/base-ingresos.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
// 1000 ms en la app real (región alineada); en la compu de Windows con la base simulada se corre con TOPE_MS más alto (la función de base tarda ~1 ms).
const TOPE = Number(process.env.TOPE_MS ?? 1000);
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
// 20 socios por su celular (el demo no tiene DNI): los testigos primero (uno por color) y después de todo tipo.
const { rows } = await db.query(`
  select s.telefono as dni, s.nombre || ' ' || s.apellido as nombre from public.socios s join public.gimnasios g on g.id = s.gimnasio_id
   where g.slug = 'demo' and s.telefono is not null and s.dado_de_baja_en is null
   order by (s.nombre = 'Testigo') desc, s.numero limit 20`);
const b = await navegador();
try {
  if (rows.length < 20) throw new Error(`faltan socios con DNI: hay ${rows.length}`);
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel`);
  await r.waitForFunction(() => document.documentElement.dataset.entradaLista === "si", null, { timeout: 60000 });
  const tiempos = [], colores = new Set();
  for (const [i, s] of rows.entries()) {
    await r.keyboard.press("F2");
    const campo = r.locator("[data-ventana-campo]");
    await campo.waitFor({ timeout: 10000 });
    await campo.fill(s.dni);
    const t0 = Date.now();
    await r.keyboard.press("Enter");
    const ver = r.locator("[data-ventana-veredicto]");
    await ver.waitFor({ timeout: 30000 });
    tiempos.push(Date.now() - t0);
    colores.add(await ver.getAttribute("data-ventana-veredicto"));
    await r.keyboard.press("Escape");
    await r.locator("[data-ventana-entrada]").waitFor({ state: "detached", timeout: 15000 });
  }
  tiempos.sort((a, b) => a - b);
  const mediana = tiempos[10], peor = tiempos[19];
  chequear(rows.length === 20 && tiempos.length === 20, "20 consultas con el atajo F2", "no se hicieron las 20");
  chequear(colores.size >= 3, `se ven ${colores.size} colores distintos: ${[...colores].join(", ")}`, `solo ${[...colores].join(", ")}`);
  console.log("TIEMPOS ms:", tiempos.join(" ")); chequear(peor < TOPE, `de Enter al veredicto: mediana ${mediana} ms, peor ${peor} ms (tope ${TOPE} ms)`, `el peor tardó ${peor} ms`);
  if (r.errores.length) falla(`recepción: ${r.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await db.end();
await b.close();
resultado();
