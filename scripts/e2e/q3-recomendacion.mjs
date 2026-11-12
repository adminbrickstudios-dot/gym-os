#!/usr/bin/env node
// Q3 · FA-14: el Inicio de la app del socio le dice "Hace 10 días que no venís." cuando su última entrada fue hace 10 días,
// y no dice nada si vino hace poco. Se acomodan las entradas del socio demo por SQL y se dejan como estaban.
//   node scripts/e2e/q3-recomendacion.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";
process.on("unhandledRejection", (e) => { console.log(`✗ se cortó (sin atrapar): ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`); process.exit(1); });

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const [socio] = (await db.query(`select s.id, s.usuario_id from public.socios s join auth.users u on u.id = s.usuario_id where s.gimnasio_id = $1 and u.email = 'socio@ejemplo.invalid'`, [gim])).rows;
if (!socio) { console.log("✗ no hay un socio demo con socio@ejemplo.invalid"); process.exit(1); }
const [{ id: sede }] = (await db.query(`select id from public.sedes where gimnasio_id = $1 and es_principal`, [gim])).rows;
const MOTIVO = "q3-recomendacion";
const previas = (await db.query(`select id from public.ingresos where socio_id = $1 and anulado_en is null`, [socio.id])).rows.map((r) => r.id);
let propia = null;
const poner = async (diasAtras) => {
  if (propia) await db.query(`delete from public.ingresos where id = $1`, [propia]);
  propia = (await db.query(
    `insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, color, motivo, texto)
     values ($1, $2, $3, now() - ($4 || ' days')::interval, 'recepcion', 'entro', 'verde', 'al_dia', 'Pasá') returning id`, [gim, sede, socio.id, String(diasAtras)])).rows[0].id;
};
const restaurar = async () => {
  if (propia) await db.query(`delete from public.ingresos where id = $1`, [propia]);
  if (previas.length) await db.query(`update public.ingresos set anulado_en = null, anulado_por = null, anulado_motivo = null where id = any($1::uuid[]) and anulado_motivo = $2`, [previas, MOTIVO]);
};
const b = await navegador();
try {
  // Las entradas de siempre se anulan un rato (se vuelven a habilitar al terminar).
  if (previas.length) await db.query(`update public.ingresos set anulado_en = now(), anulado_motivo = $2 where id = any($1::uuid[])`, [previas, MOTIVO]);
  const s = await pagina(b, CELU);
  s.setDefaultNavigationTimeout(120000);
  await entrar(s, "socio@ejemplo.invalid");

  await poner(10);
  await s.goto(`${G}/app`);
  const reco = s.locator('[data-recomendacion="sin_venir_7_dias"]');
  await reco.waitFor({ timeout: 60000 });
  chequear(/Hace 10 días que no venís\./.test(await reco.innerText()), "última entrada hace 10 días: el Inicio dice “Hace 10 días que no venís.”", `dice: ${(await reco.innerText()).replace(/\n/g, " ")}`);
  chequear(await reco.getByRole("link", { name: /insignias y mi año/ }).isVisible(), "la recomendación lleva a “Mis insignias y mi año”", "falta el link a Mis insignias");
  const w = await s.evaluate(() => document.documentElement.scrollWidth);
  chequear(w <= CELU.width + 1, "celular: el Inicio con la recomendación sin desbordes", `se desborda: ${w}px`);
  await capturar(s, "q3-recomendacion-celu");

  await poner(2);
  await s.goto(`${G}/app`);
  await s.locator("nav[data-nav-socio]").waitFor({ timeout: 60000 });
  chequear(await s.locator("[data-recomendacion]").count() === 0, "vino hace 2 días: no hay recomendación", "aparece la recomendación aunque vino hace 2 días");
  if (s.errores.length) falla(s.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await restaurar().catch((e) => console.log(`aviso: no se pudo restaurar: ${e.message}`));
await db.end();
await b.close();
resultado();
