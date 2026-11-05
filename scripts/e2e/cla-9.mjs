#!/usr/bin/env node
// CLA-9 · Faltas que se descuentan del pack: la dueña elige "🎟️ Se descuenta
// del pack" y se guarda; el socio lo ve en la app antes de reservar. La
// cuenta de clases la prueba la base (faltas-pack). Al final vuelve a "nada".
//   npm run e2e:cla-9            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/configuracion?pestana=clases`);
  const f = d.locator("[data-faltas]");
  await f.waitFor({ timeout: 60000 });
  await f.getByRole("button", { name: /Se descuenta del pack/ }).click();
  const guardar = d.locator('[data-pie="clases"] button.boton-principal');
  await guardar.click();
  await d.locator('[data-pie="clases"] [data-sin-guardar]').waitFor({ state: "detached", timeout: 30000 });
  const [{ falta_politica: pol }] = (await db.query(`select falta_politica from public.configuracion_gimnasio where gimnasio_id = $1`, [gim])).rows;
  chequear(pol === "descontar", "Configuración → Clases: “🎟️ Se descuenta del pack” guardado", pol);

  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app/clases`);
  await s.locator("[data-reglas-reservas]").waitFor({ timeout: 60000 });
  const reglas = await s.locator("[data-reglas-reservas]").innerText();
  chequear(/la clase se descuenta igual/.test(reglas), "la app avisa la regla antes de reservar", reglas);
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.configuracion_gimnasio set falta_politica = 'nada' where gimnasio_id = $1`, [gim]);
  await db.end();
}
ok("la regla vuelve a “no pasa nada”");
await b.close();
resultado();
