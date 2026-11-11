#!/usr/bin/env node
// COM-6 · Documentos para firmar: la dueña publica el reglamento → el socio lo
// ve en la app ("✍️ Para firmar"), lo lee, pone su nombre, tilda y firma → en
// la Entrada, a otro socio le sale "✍️ Falta firmar" (sin frenarlo) y la
// recepción lo firma con él en la ficha. Al final se deja de pedir (el demo
// queda como estaba).
//   npm run e2e:com-6            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const s = Date.now().toString().slice(-5);
// "Otro socio" para la Entrada: uno del demo, mayor, en verde, que no sea un testigo (el socio de la app ya firmó).
const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() });
await db.connect();
const [otro] = (await db.query(`select s.id from public.socios s join public.gimnasios g on g.id = s.gimnasio_id
  where g.slug = 'demo' and s.dado_de_baja_en is null and s.usuario_id is null and s.nombre <> 'Testigo'
    and coalesce(s.fecha_nacimiento < now() - interval '18 years', true) and (privado.calcular_acceso(s.id, now(), null)).color = 'verde'
  order by s.numero limit 1`)).rows;
await db.end();
const b = await navegador();
let d;
try {
  d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  await d.locator("[data-ir-documentos]").click();
  await d.waitForURL(/\/panel\/documentos/, { timeout: 60000 });
  const reg = d.locator('[data-documento="reglamento"]');
  await reg.waitFor({ timeout: 60000 });
  await reg.locator("button", { hasText: /Escribirlo|Editar/ }).click();
  await reg.locator("textarea").fill(`1. Traé toalla.\n2. Dejá los discos en su lugar.\n3. Versión de prueba ${s}.`);
  await reg.locator("button", { hasText: /Publicar/ }).click();
  await reg.getByText(/Guardado y publicado|versión nueva/).waitFor({ timeout: 30000 });
  ok(`la dueña publica el reglamento (${(await reg.locator(".pildora").innerText()).trim()})`);

  const so = await pagina(b, CELU);
  so.setDefaultNavigationTimeout(120000);
  await entrar(so, "socio@ejemplo.invalid");
  await so.goto(`${G}/app`);
  const firmar = so.locator('[data-firmar="reglamento"]');
  await firmar.waitFor({ timeout: 60000 });
  await firmar.locator("summary").click();
  chequear((await firmar.innerText()).includes(`Versión de prueba ${s}`), "el socio lo ve en la app y puede leer el texto", "no se ve el texto");
  await firmar.locator('input:not([type="checkbox"])').fill("Socio Demo");
  await firmar.locator('input[type="checkbox"]').check();
  await firmar.locator('button[type="submit"]').click();
  await so.getByText("Firmado: ").waitFor({ timeout: 30000 });
  ok("firma con su nombre y el tilde: “Firmado”");
  await capturar(so, "com6-celu-app");

  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  if (!otro) throw new Error("el demo no tiene otro socio en verde");
  await r.goto(`${G}/panel/entrada?socio=${otro.id}`);
  const aviso = r.locator("[data-aviso-firmar]");
  chequear(await aparece(aviso, 30000) && /Falta firmar: Reglamento/.test(await aviso.innerText()) && await r.locator('[data-veredicto="verde"]').count() === 1,
    "en la Entrada: “Falta firmar: Reglamento”, y sigue en verde (no lo frena)", `Entrada: ${await aviso.innerText().catch(() => "sin aviso")}`);
  await r.locator('a:has-text("Ver ficha")').first().click();
  await r.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}/, { timeout: 60000 });
  const enFicha = r.locator('[data-documentos-ficha] [data-firmar="reglamento"]');
  await enFicha.waitFor({ timeout: 60000 });
  await enFicha.locator('input[type="checkbox"]').check();
  await enFicha.locator('button[type="submit"]').click();
  await r.locator("[data-documentos-ficha]").getByText(/Firmado:/).waitFor({ timeout: 30000 });
  ok("la recepción lo firma con él en la ficha (“Firmó en recepción”)");
  for (const p of [d, so, r]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  // El demo queda sin documentos pedidos (las otras pruebas de la app no esperan esta tarjeta).
  if (d) {
    await d.goto(`${G}/panel/documentos`).catch(() => {});
    const dejar = d.locator('[data-documento="reglamento"] button', { hasText: "Dejar de pedirlo" });
    if (await aparece(dejar, 15000)) { await dejar.click(); await d.getByText("Ya no se pide").waitFor({ timeout: 30000 }).catch(() => {}); }
  }
}
await b.close();
resultado();
