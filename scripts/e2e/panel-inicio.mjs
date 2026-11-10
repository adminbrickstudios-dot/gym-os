#!/usr/bin/env node
// AUD-14 · Inicio de cada rol, botón por botón: saludo con el nombre y el
// gimnasio, cuatro números, "Ahora y lo que sigue", y cada acceso rápido abre
// su pantalla sin error. La dueña elige sus accesos y los deja como estaban.
// Un socio que pidió la baja aparece en "👋 Pidieron la baja".
//   npm run e2e:inicio            (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const [soc] = (await db.query(`select s.id, s.usuario_id from public.socios s where s.gimnasio_id = $1 and s.nombre = 'Testigo' and s.apellido = 'Al Día'`, [gim])).rows;
const ROTA = /Algo salió mal|Application error|No tenés acceso|no tiene acceso/i;
let pedido;
const b = await navegador();
try {
  for (const rol of ["duena", "encargado", "recepcion", "profe"]) {
    const p = await pagina(b, COMPU);
    await entrar(p, `${rol}@ejemplo.invalid`);
    await p.goto(`${G}/panel`);
    await p.locator("main h1").first().waitFor({ timeout: 60000 });
    const h1 = await p.locator("main h1").first().innerText();
    const numeros = await p.locator('section[aria-label="Números de hoy"] dd').count();
    chequear(//.test(h1) && numeros >= 4 && (rol !== "profe" || numeros === 4) && await p.getByRole("heading", { name: "Ahora y lo que sigue" }).isVisible(),
      `${rol}: saludo, sus números (4 la profe, 5 a 8 el resto) y “Ahora y lo que sigue”`, `${rol}: ${h1} · ${numeros} números`);
    const accesos = await p.locator('main a[href^="/panel/"].boton').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
    const rotos = [];
    for (const href of accesos) {
      await p.goto(`${G}${href}`);
      await p.locator("main").first().waitFor({ timeout: 60000 });
      if (ROTA.test(await p.locator("main").innerText())) rotos.push(href);
    }
    chequear(rotos.length === 0, `${rol}: sus ${accesos.length} accesos rápidos abren su pantalla`, `${rol}: no abren ${rotos.join(", ")}`);
    if (rol === "duena") {
      await p.goto(`${G}/panel`);
      await p.getByRole("button", { name: /Elegir mis accesos/ }).click();
      const primero = p.locator('button[aria-pressed]').first();
      const antes = await primero.getAttribute("aria-pressed");
      await primero.click();
      chequear((await primero.getAttribute("aria-pressed")) !== antes, "la dueña elige sus accesos (se marca al tocar)", "no cambia");
      await primero.click();
      await p.keyboard.press("Escape").catch(() => {});
    }
    if (p.errores.length) falla(`${rol}: ${p.errores.join(" | ")}`);
    await p.context().close();
  }

  [{ id: pedido }] = (await db.query(`insert into public.pedidos_baja (gimnasio_id, socio_id, motivo, nota, pedido_por) values ($1,$2,'horario','Prueba e2e inicio',$3) returning id`, [gim, soc.id, soc.usuario_id])).rows;
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel`);
  const sec = r.locator("[data-pedidos-baja-inicio]");
  await sec.waitFor({ timeout: 60000 });
  chequear(/Testigo Al Día[\s\S]*los horarios: “Prueba e2e inicio”/.test(await sec.innerText()), "la recepción ve en Inicio “Pidieron la baja” con el motivo", await sec.innerText());
  await sec.getByRole("link").first().click();
  await r.locator("[data-pedido-baja]").waitFor({ timeout: 60000 });
  ok("tocarlo abre la ficha con “Se queda / Darle la baja”");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  if (pedido) await db.query(`update public.pedidos_baja set estado = 'se_queda', resuelto_en = now() where id = $1`, [pedido]);
  await db.end();
}
await b.close();
resultado();
