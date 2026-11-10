#!/usr/bin/env node
// REF-1 · Invitá a un amigo: el socio ve "🤝 Invitá a un amigo" con su link;
// el amigo abre la página con ese link, deja sus datos ("Te invitó un
// amigo") y la dueña lo ve en Prospectos "Recomendado por …".
//   npm run e2e:ref-1            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const [antes] = (await db.query(`select l.publicada, s.visible from public.landing_gimnasio l join public.landing_secciones s on s.gimnasio_id = l.gimnasio_id and s.tipo = 'probar' where l.gimnasio_id = $1`, [gim])).rows;
await db.query(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [gim]);
await db.query(`update public.landing_secciones set visible = true where gimnasio_id = $1 and tipo = 'probar'`, [gim]);
const AMIGO = `Amigo E2e ${Date.now() % 100000}`;
const TEL = `000 ${String(Date.now()).slice(-7)}`;
const b = await navegador();
try {
  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  const card = s.locator("[data-referir]");
  await card.waitFor({ timeout: 60000 });
  const link = await card.locator("[data-copiar-link]").getAttribute("data-copiar-link");
  const codigo = /\?ref=([A-Z0-9]{6})/.exec(link)?.[1];
  chequear(!!codigo, `la app muestra “🤝 Invitá a un amigo” con su link (${link})`, link);

  const a = await pagina(b, CELU);
  await a.goto(`${G}/?ref=${codigo}#probar`);
  const form = a.locator("[data-form-probar]");
  await form.waitFor({ timeout: 60000 });
  await form.locator("[data-referido]").waitFor({ timeout: 10000 });
  await form.locator("input[name=nombre]").fill(AMIGO);
  await form.locator("input[name=telefono]").fill(TEL);
  await form.getByRole("button", { name: /Quiero probar/ }).click();
  await a.locator("[data-probar-listo]").waitFor({ timeout: 30000 });
  ok("el amigo abre el link: “Te invitó un amigo” y deja sus datos");

  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/prospectos`);
  const fila = d.locator("li", { hasText: AMIGO }).first();
  await fila.waitFor({ timeout: 60000 });
  chequear(/Recomendado por/.test(await fila.innerText()), "la dueña lo ve en Prospectos: “Recomendado por …”", await fila.innerText());
  for (const p of [s, a, d]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  if (antes) {
    await db.query(`update public.landing_gimnasio set publicada = $2 where gimnasio_id = $1`, [gim, antes.publicada]);
    await db.query(`update public.landing_secciones set visible = $2 where gimnasio_id = $1 and tipo = 'probar'`, [gim, antes.visible]);
  }
  await db.end();
}
await b.close();
resultado();
