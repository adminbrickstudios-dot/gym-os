#!/usr/bin/env node
// Pase 2.0 · organización, Parte 4 (26/11): Inicio (Plata en juego hoy, Volvieron este mes) y Para hacer hoy (la lista única, filtros, Debe $X
// en la transferencia, tildar, Hecho hoy con quién y a qué hora, Deshacer el último). Con la llave prendida (ORGANIZACION_DEMO=si).
// Con la llave apagada solo mira que el Inicio no cambió (sin Plata en juego) y termina.
//   node scripts/e2e/organizacion-hoy.mjs      (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, entrarSocio, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const LLAVE = (process.env.ORGANIZACION_DEMO ?? "no") === "si";
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ g, sede }] = (await db.query(`select g.id g, (select id from public.sedes where gimnasio_id = g.id and es_principal) sede from public.gimnasios g where g.slug = 'demo'`)).rows;
const ir = async (p, ruta) => { await p.goto(`${G}${ruta}`, { waitUntil: "load", timeout: 90000 }); await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {}); };

const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await ir(d, "/panel");
  if (!LLAVE) {
    await ir(d, "/panel/socios");
    chequear(await d.locator("[data-este-mes]").count() === 0, "llave apagada: Socios sin la columna Este mes", "llave apagada: apareció Este mes");
    await ir(d, "/panel");
    chequear(await d.locator("[data-plata-en-juego]").count() === 0 && await d.locator("[data-volvieron-mes]").count() === 0,
      "llave apagada: el Inicio sin Plata en juego ni Volvieron", "llave apagada: apareció algo nuevo en el Inicio");
  } else {
    // Un interesado nuevo y una transferencia que no coincide (datos ficticios del demo).
    const sello = Date.now().toString().slice(-6);
    await db.query(`insert into public.prospectos (gimnasio_id, nombre, telefono, estado) values ($1, $2, '+5490000777' || $3, 'nuevo')`, [g, `Interesada ${sello}`, sello.slice(-3)]);
    const [{ socio }] = (await db.query(`select id socio from public.socios where gimnasio_id = $1 and dado_de_baja_en is null and telefono is not null order by creado_en limit 1`, [g])).rows;
    const [{ id: venta }] = (await db.query(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen, estado) values ($1,$2,$3,'app','pendiente') returning id`, [g, sede, socio])).rows;
    await db.query(`insert into public.venta_items (gimnasio_id, venta_id, tipo, descripcion, cantidad, precio_unitario) values ($1,$2,'otro','Plan e2e',1,25000)`, [g, venta]);
    await db.query(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, comprobante_path) values ($1,$2,'transferencia',20000,'pendiente', $3)`, [g, venta, `${g}/comprobantes/e2e.jpg`]);

    await ir(d, "/panel");
    chequear(await d.locator("[data-plata-en-juego]").count() === 1, "Inicio: Plata en juego hoy", "Inicio: falta Plata en juego hoy");
    chequear(await d.locator("[data-volvieron-mes]").count() === 1, "Inicio: Volvieron este mes", "Inicio: falta Volvieron este mes");
    await capturar(d, "org-compu-inicio", true);
    await d.locator("[data-resolver-ahora]").click();
    await d.waitForURL(/\/panel\/bloque\/hoy/, { timeout: 30000 });
    await d.locator("[data-para-hacer-hoy]").waitFor({ timeout: 30000 });
    ok("Resolver ahora lleva a Para hacer hoy");
    chequear(await d.locator("[data-filtros-hoy] [data-filtro-hoy]").count() >= 3, "filtros arriba con su número", "faltan los filtros");
    const transf = d.locator('[data-fila-hoy="transferencias"]', { hasText: "Plan e2e" });
    chequear(await transf.count() === 1, "la transferencia dice Debe $X (plan)", "no aparece la transferencia con Debe");
    chequear(await transf.locator('[data-coincide="no"]').count() === 1, "el monto que no coincide se marca", "el monto que no coincide no se marca");
    await capturar(d, "org-compu-para-hacer-hoy", true);

    // Tildar a mano (un interesado): aparece en Hecho hoy con quién; Deshacer el último lo saca.
    const fila = d.locator('[data-fila-hoy="interesados"]', { hasText: `Interesada ${sello}` });
    await fila.locator("[data-tildar]").check();
    await d.locator("[data-hecho-hoy]", { hasText: `Interesada ${sello}` }).waitFor({ timeout: 30000 });
    chequear((await d.locator("[data-hecho-hoy]").innerText()).includes("Sofía"), "Hecho hoy: con quién y a qué hora", "Hecho hoy sin quién");
    await d.locator("[data-deshacer-ultimo]").click();
    await d.waitForFunction((s) => !document.querySelector("[data-hecho-hoy]")?.textContent?.includes(s), `Interesada ${sello}`, { timeout: 30000 })
      .then(() => ok("Deshacer el último lo saca de Hecho hoy"), () => chequear(false, "", "Deshacer el último no lo sacó"));
    const [{ n }] = (await db.query(`select count(*)::int n from public.hechos_para_hacer where gimnasio_id = $1 and texto like $2 and anulado_en is not null`, [g, `%Interesada ${sello}%`])).rows;
    chequear(n === 1, "deshacer anula (queda en la base, no se borra)", `deshacer dejó ${n} anulados`);

    // Ver sin entrar: tocar un socio en la lista de Socios abre el panel lateral (con sus tres números) y no sale de la lista.
    await ir(d, "/panel/bloque/socios?pestana=socios");
    const enLista = d.url();
    // El primer link a una ficha (/panel/socios/<id>, sin sub-pantalla ni parámetros).
    const hrefs = await d.locator('main a[href^="/panel/socios/"]').evaluateAll((xs) => xs.map((x) => x.getAttribute("href")));
    const ficha = hrefs.find((h) => /^\/panel\/socios\/[0-9a-f-]{36}$/.test(h ?? ""));
    chequear(!!ficha, `la lista tiene links a fichas (${hrefs.length} links)`, `la lista no tiene links a una ficha: ${hrefs.slice(0, 5).join(" · ")}`);
    const montado = await d.evaluate(() => document.documentElement.dataset.panelSocioMontado ?? "no");
    chequear(montado === "si", "el panel lateral está montado para la dueña", `el panel lateral no está montado (${montado})`);
    await d.locator(`main a[href="${ficha}"]`).first().click();
    await d.locator("[data-panel-socio-lateral]").waitFor({ timeout: 30000 }).catch(() => {});
    chequear(d.url() === enLista, "tocar un socio abre el panel lateral sin salir de la lista", `tocar un socio llevó a ${d.url()}`);
    await d.locator("[data-panel-socio-numeros]").waitFor({ timeout: 30000 }).then(() => ok("el panel lateral muestra este mes, última vez y semanas seguidas"), () => chequear(false, "", "el panel lateral sin los tres números"));
    await capturar(d, "org-compu-ver-sin-entrar", true);
    await d.keyboard.press("Escape");
    // Socios: la columna "Este mes"; la ficha completa: los números, Cuándo viene y Su historia.
    chequear(await d.locator("[data-este-mes]").count() > 0, "Socios: cada fila con las veces que vino este mes", "Socios: falta \"Este mes\"");
    await ir(d, ficha);
    await d.locator("[data-ficha-organizacion]").waitFor({ timeout: 30000 }).then(() => ok("ficha: veces con el promedio, racha con la mejor, última vez con su hora"), () => chequear(false, "", "ficha: faltan los números nuevos"));
    chequear(await d.locator("[data-su-historia]").count() === 1, "ficha: Su historia", "ficha: falta Su historia");
    await capturar(d, "org-compu-ficha", true);

    // La dirección vieja de Para hacer hoy lleva a la lista.
    await ir(d, "/panel/hoy");
    chequear(/\/panel\/bloque\/hoy\?pestana=hoy/.test(d.url()), "/panel/hoy lleva a la lista de Para hacer hoy", `/panel/hoy terminó en ${d.url()}`);
  }
  await d.context().close();
  // App del socio: "¿Hay mucha gente?" solo con la llave.
  const so = await pagina(b, CELU);
  await entrarSocio(so, "+5490000100002");
  await so.goto(`${G}/app`, { waitUntil: "load", timeout: 90000 });
  await so.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  const hay = await so.locator("[data-hay-mucha-gente]").count();
  chequear(LLAVE ? hay === 1 : hay === 0, LLAVE ? "app: ¿Hay mucha gente? con la hora de ahora marcada" : "llave apagada: la app sin ¿Hay mucha gente?", LLAVE ? "app: falta ¿Hay mucha gente?" : "llave apagada: apareció ¿Hay mucha gente?");
  if (LLAVE) await capturar(so, "org-celu-app-socio", true);
  await so.context().close();
} finally {
  await b.close();
  await db.end();
}
resultado();
