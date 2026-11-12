#!/usr/bin/env node
// REV-SOCIO · Revisión de la app del socio (zona socio/profe), en el celular:
//   1. FA-15: el profe asigna una rutina de 4 series; el socio marca 2 series como hechas, recarga y siguen marcadas; desmarca una.
//   2. "Volver" de Historial y de Mi membresía lleva a Yo (de donde se abren), y Yo queda marcada en la barra de abajo en Mi plan.
//   3. El historial dice los estados con palabras ("Aprobado", "En revisión"), nunca "ok" ni "revisando" sueltos.
//   4. Pedir una pausa: después del éxito el botón no se puede apretar otra vez.
//   5. El manifest y el robots (instalar como app, no indexar /profe /kiosco /tv).
//   node scripts/e2e/rev-socio.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const N = Date.now() % 100000;
const [{ id: ej }] = (await db.query(`insert into public.ejercicios (gimnasio_id, nombre, grupo) values ($1,$2,'piernas') returning id`, [gim, `Sentadilla rev ${N}`])).rows;
const [{ id: rut }] = (await db.query(`insert into public.rutinas (gimnasio_id, nombre) values ($1,$2) returning id`, [gim, `Rutina rev ${N}`])).rows;
await db.query(`insert into public.rutina_ejercicios (gimnasio_id, rutina_id, dia, orden, ejercicio_id, series, repeticiones) values ($1,$2,1,1,$3,4,'8')`, [gim, rut, ej]);
const b = await navegador();
try {
  // 1. El profe asigna la rutina.
  const p = await pagina(b, COMPU);
  await entrar(p, "profe@ejemplo.invalid");
  await p.goto(`${G}/panel/rutinas/editar?id=${rut}`);
  const asig = p.locator("[data-asignar-rutina]");
  await asig.waitFor({ timeout: 60000 });
  await asig.getByLabel("Buscar socio para asignar").fill("Testigo Al");
  const fila = asig.locator("li", { hasText: "Testigo Al Día" }).first();
  await fila.waitFor({ timeout: 30000 });
  await fila.getByRole("button", { name: "Asignar" }).click();
  await fila.getByText(/Asignada/).waitFor({ timeout: 30000 });
  ok("el profe le asigna una rutina de 4 series al socio");

  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app/rutina`);
  const item = s.locator("li", { hasText: `Sentadilla rev ${N}` });
  await item.waitFor({ timeout: 60000 });
  const series = item.locator("[data-series]");
  chequear((await series.getAttribute("data-series")) === "0/4", "FA-15: arranca con 0 de 4 series hechas", await series.getAttribute("data-series"));
  await item.locator('[data-serie="1"]').click();
  await item.locator('[data-serie="2"]').click();
  await s.waitForFunction((n) => document.querySelector(`li [data-series]`) && [...document.querySelectorAll("li")].find((l) => l.textContent.includes(n))?.querySelector("[data-series]")?.getAttribute("data-series") === "2/4", `Sentadilla rev ${N}`, { timeout: 30000 });
  ok("marca 2 series y se ve 2/4 al instante");
  await s.reload();
  const item2 = s.locator("li", { hasText: `Sentadilla rev ${N}` });
  await item2.waitFor({ timeout: 60000 });
  chequear((await item2.locator("[data-series]").getAttribute("data-series")) === "2/4", "al recargar siguen 2/4 (la base lo guardó)", await item2.locator("[data-series]").getAttribute("data-series"));
  await item2.locator('[data-serie="2"]').click();
  await s.waitForFunction((n) => [...document.querySelectorAll("li")].find((l) => l.textContent.includes(n))?.querySelector("[data-series]")?.getAttribute("data-series") === "1/4", `Sentadilla rev ${N}`, { timeout: 30000 });
  ok("tocar de nuevo una serie la desmarca (1/4)");

  // 2. Volver y la pestaña Yo.
  for (const [ruta, que] of [["/app/historial", "Historial"], ["/app/cuenta", "Mi membresía"]]) {
    await s.goto(`${G}/app/yo`);
    await s.goto(`${G}${ruta}`);
    await s.locator("main h1").waitFor({ timeout: 60000 });
    await s.getByRole("link", { name: /Volver/ }).first().click();
    await s.waitForURL(/\/app\/yo(\?.*)?$/, { timeout: 30000 });
    ok(`“← Volver” de ${que} lleva a Yo`);
  }
  await s.goto(`${G}/app/plan`);
  await s.locator("main h1").waitFor({ timeout: 60000 });
  chequear((await s.locator('[data-pestana="yo"]').getAttribute("aria-current")) === "page", "en Mi plan la pestaña Yo queda marcada", "la pestaña Yo no está marcada en /app/plan");

  // 3. Estados con palabras en el historial.
  await s.goto(`${G}/app/historial`);
  await s.locator("[data-historial-pagos]").waitFor({ timeout: 60000 });
  const texto = await s.locator("[data-historial-pagos]").innerText();
  chequear(!/·\s*(ok|revisando|rechazado|aprobado|pendiente)\b/.test(texto), "el historial no muestra estados crudos (ok, revisando…)", texto.slice(0, 300));

  // 4. La pausa pedida no se puede pedir dos veces.
  await s.goto(`${G}/app/cuenta`);
  const form = s.locator("[data-pedir-pausa]");
  if (await form.count()) {
    const hasta = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
    await form.locator('input[type="date"]').nth(1).fill(hasta);
    await form.getByRole("button", { name: "Pedir la pausa" }).click();
    await form.getByText(/el gimnasio lo va a ver/).waitFor({ timeout: 30000 });
    chequear(await form.getByRole("button", { name: /Pausa pedida/ }).isDisabled(), "pedida la pausa, el botón queda apagado (no se pide dos veces)", "el botón sigue activo");
    await db.query(`delete from public.pausas where gimnasio_id = $1 and estado = 'pendiente' and creado_en > now() - interval '5 minutes'`, [gim]).catch(() => {});
  } else ok("el socio de prueba no tiene plan para pausar: se saltea el paso de la pausa");

  // 5. Manifest y robots.
  const m = await (await s.request.get(`${G}/manifest.webmanifest`)).json();
  chequear(m.id && Array.isArray(m.shortcuts) && m.shortcuts.length > 0 && m.short_name && m.short_name.length <= 12, `manifest con id, accesos directos y nombre corto “${m.short_name}”`, JSON.stringify(m));
  const robots = await (await s.request.get(`${G}/robots.txt`)).text();
  chequear(/Disallow: \/profe/.test(robots) || /Disallow: \/\s*$/m.test(robots), "robots no deja indexar /profe", robots.slice(0, 300));

  for (const x of [p, s]) if (x.errores.length) falla(x.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.rutinas_socio set quitada_en = now() where rutina_id = $1 and quitada_en is null`, [rut]).catch(() => {});
  await db.query(`update public.rutinas set activa = false where id = $1`, [rut]).catch(() => {});
  await db.query(`update public.ejercicios set activo = false where id = $1`, [ej]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
