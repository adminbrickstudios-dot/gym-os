#!/usr/bin/env node
// VD-20 · Rutinas: el profe busca en la biblioteca (buscador y filtro por equipo), marca una rutina como
// plantilla, saca su copia, se la asigna a 3 socios de una vez (con fecha de cambio) → el socio la ve en su
// app con "Hoy te toca el Día 1", marca “Hice el Día 1” → el profe ve en “Quién la hizo” que entrenó hoy.
// Al final se limpia (quita la rutina a los tres y la archiva).
//   node scripts/e2e/vd-20.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const N = Date.now() % 100000;
const NOM = `Plantilla e2e ${N}`;
const mk = async (nombre, grupo, equipo) => (await db.query(`insert into public.ejercicios (gimnasio_id, nombre, grupo, equipo) values ($1,$2,$3,$4) returning id`, [gim, nombre, grupo, equipo])).rows[0].id;
const e1 = await mk(`Prensa vd20 ${N}`, "piernas", "maquina"), e2 = await mk(`Remo vd20 ${N}`, "espalda", "mancuernas"), e3 = await mk(`Plancha vd20 ${N}`, "core", "peso_corporal");
const [{ id: rut }] = (await db.query(`insert into public.rutinas (gimnasio_id, nombre) values ($1,$2) returning id`, [gim, NOM])).rows;
await db.query(`insert into public.rutina_ejercicios (gimnasio_id, rutina_id, dia, orden, ejercicio_id, series, repeticiones) values ($1,$2,1,1,$3,4,'10'), ($1,$2,1,2,$4,3,'12'), ($1,$2,2,1,$5,3,'30 s')`, [gim, rut, e1, e2, e3]);
const NOMBRES = ["Testigo Al Día", "Testigo Por Vencer", "Testigo Vencida"];
const b = await navegador();
let copia = null;
try {
  const p = await pagina(b, COMPU);
  p.setDefaultNavigationTimeout(120000);
  await entrar(p, "profe@ejemplo.invalid");

  // Biblioteca: buscador y filtro por equipo.
  await p.goto(`${G}/panel/rutinas`);
  const lib = p.locator("[data-ejercicios]");
  await lib.waitFor({ timeout: 60000 });
  await lib.locator("[data-buscar-ejercicio]").fill(`vd20 ${N}`);
  chequear(await lib.locator("[data-lista-ejercicios] li").count() === 3, "el buscador encuentra los 3 ejercicios del caso", "el buscador no filtró");
  await lib.getByLabel("Filtrar por equipo").selectOption("maquina");
  chequear(await lib.locator("[data-lista-ejercicios] li").count() === 1 && /Máquina/.test(await lib.locator("[data-lista-ejercicios] li").first().innerText()), "y el filtro por equipo deja solo la máquina", "el filtro por equipo no anduvo");
  await lib.locator("[data-buscar-ejercicio]").fill("zzzz-no-existe");
  chequear(await aparece(lib.locator("[data-sin-resultados]")), "sin resultados lo dice y no se rompe", "no muestra el estado sin resultados");

  // Plantilla → copia.
  await p.goto(`${G}/panel/rutinas/editar?id=${rut}`);
  await p.locator("[data-plantilla]").click();
  await p.locator("[data-acciones-rutina]", { hasText: "Plantilla" }).waitFor({ timeout: 30000 });
  await p.locator("[data-copiar-rutina]").click();
  await p.waitForURL((u) => u.searchParams.get("id") && u.searchParams.get("id") !== rut, { timeout: 60000 });
  copia = new URL(p.url()).searchParams.get("id");
  await p.locator("[data-editor-rutina]").waitFor({ timeout: 60000 });
  // Al navegar a la copia el editor viejo sigue en pantalla un instante: se espera a que traiga el nombre de la copia.
  const abrioCopia = await p.waitForFunction(() => /copia/.test([...document.querySelectorAll("[data-editor-rutina] label")].find((l) => /^Nombre/.test(l.textContent.trim()))?.querySelector("input")?.value ?? ""), null, { timeout: 30000 }).then(() => true, () => false);
  chequear(abrioCopia, "“Usar esta plantilla” abre una copia propia", "la copia no se abrió");

  // Asignar a 3 de una vez, con fecha de cambio.
  const asig = p.locator("[data-asignar-rutina]");
  await asig.waitFor({ timeout: 60000 });
  await asig.locator("[data-cambiar-en]").fill(new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10));
  for (const n of NOMBRES) {
    await asig.getByLabel("Buscar socio para asignar").fill(n);
    const fila = asig.locator("li", { hasText: n }).first();
    await fila.waitFor({ timeout: 30000 });
    await fila.locator("[data-elegir-socio]").check();
  }
  chequear(await asig.locator("[data-elegidos]").getAttribute("data-elegidos") === "3", "se tildan 3 socios (la selección sobrevive a las búsquedas)", "no quedaron 3 elegidos");
  await asig.locator("[data-asignar-varios]").click();
  await asig.locator("[data-aviso-asignada]").waitFor({ timeout: 60000 });
  chequear(/3 socios/.test(await asig.locator("[data-aviso-asignada]").innerText()), "“Asignada a 3 socios”", await asig.locator("[data-aviso-asignada]").innerText());
  await capturar(p, "vd20-compu-asignar");

  // El socio la ve en la app: la de hoy primero.
  const s = await pagina(b, CELU);
  s.setDefaultNavigationTimeout(120000);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  await s.locator("[data-link-rutina]").click();
  await s.waitForURL(/\/app\/rutina/, { timeout: 30000 });
  const hoy = s.locator("[data-rutina-hoy]");
  await hoy.waitFor({ timeout: 60000 });
  chequear(/Hoy te toca el Día 1/.test(await hoy.innerText()), "el socio ve “Hoy te toca el Día 1”", await hoy.innerText());
  chequear(await s.locator('[data-rutina-dia="1"]').count() === 1 && /Prensa vd20/.test(await s.locator('[data-rutina-dia="1"]').innerText()), "y los ejercicios de hoy van primero", "no muestra el Día 1");
  chequear(await aparece(s.locator("[data-cambiar-en]")), "con la fecha en que se la cambian", "no muestra la fecha de cambio");
  await s.locator("[data-hice-dia]").click();
  chequear(await aparece(s.locator("[data-dia-hecho]"), 30000), "marca “Hice el Día 1” y queda hecho", "no quedó marcado");
  const ancho = await s.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  chequear(ancho <= 1, "celular 390 px sin desbordes", `se desborda ${ancho}px`);
  await capturar(s, "vd20-celu-rutina");

  // El profe ve quién la hizo.
  await p.goto(`${G}/panel/rutinas`);
  const fila = p.locator("[data-progreso-socio='Testigo Al Día']");
  await fila.waitFor({ timeout: 60000 });
  chequear(/Entrenó hoy/.test(await fila.innerText()), "el profe ve en “Quién la hizo”: entrenó hoy", await fila.innerText());
  chequear(await p.locator("[data-progreso-socio]").count() >= 3, "y los 3 asignados aparecen en la lista", "faltan socios en “Quién la hizo”");
  await capturar(p, "vd20-compu-quien");
} finally {
  await db.query(`update public.rutinas_socio set quitada_en = now() where rutina_id = any($1::uuid[]) and quitada_en is null`, [[rut, copia].filter(Boolean)]);
  await db.query(`update public.rutinas set activa = false where id = any($1::uuid[])`, [[rut, copia].filter(Boolean)]);
  await db.end();
  await b.close();
}
ok("limpieza: la rutina se quitó a los 3 y quedó archivada");
resultado();
