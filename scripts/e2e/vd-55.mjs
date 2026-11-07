#!/usr/bin/env node
// VD-55 · Lockers: la dueña carga lockers y la tarifa; la recepción alquila uno (con un cobro ya hecho, como lo deja Vender)
// y no puede dar cortesías; un locker no se asigna a dos socios; el socio ve su locker en la app; vence → aparece en Inicio;
// se libera con motivo. Celular sin desborde. Con la sección apagada la pantalla no abre.
//   npm run e2e:vd-55            (con scripts/local/levantar.sh corriendo)
// El cobro en sí lo prueba la base (supabase/pruebas/lockers.test.mjs, con public.vender); acá el cobro se deja hecho por SQL
// y se prueba que la hoja Cobrar abre desde "Alquilar" y que lo cobrado aparece para asignar.
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, entrarSocio, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const NUM = `L${s5}`;
const NUM2 = `M${s5}`;
const SOCIO = "Vence Hoy";                 // caso testigo con teléfono +5490000100003
const TEL = "+5490000100003";
const SIN = /apagad|No tenés acceso|Tu rol no tiene acceso|Sin permiso/i;
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url });
await db.connect();
const tarjeta = (p, n) => p.locator(`[data-locker="${n}"]`);

async function seccion(p, prendida) {
  await p.goto(`${G}/panel/configuracion?pestana=secciones`);
  await p.locator('fieldset[data-pestana-activa="secciones"]').waitFor({ timeout: 30000 });
  await p.waitForTimeout(800);
  const sw = p.locator("fieldset[data-pestana-activa] label").filter({ hasText: /^\S+ Lockers/ }).locator('input[role="switch"]');
  if ((await sw.isChecked()) === prendida) return;
  await (prendida ? sw.check() : sw.uncheck());
  const pie = p.locator('[data-pie="secciones"]');
  const antes = Number(await pie.getAttribute("data-respuestas"));
  await pie.locator('button:has-text("Guardar")').click();
  await p.waitForFunction((n) => Number(document.querySelector('[data-pie="secciones"]')?.getAttribute("data-respuestas")) > n, antes, { timeout: 30000 });
}
/** Deja hecho el cobro de un alquiler de locker (como queda después de Cobrar): una venta confirmada con la tarifa. */
async function dejarCobrado(socioNombre) {
  const { rows: [s] } = await db.query(`select s.id, s.gimnasio_id from public.socios s join public.gimnasios g on g.id = s.gimnasio_id where g.slug = 'demo' and s.apellido = $1 limit 1`, [socioNombre]);
  const { rows: [t] } = await db.query(`select id, nombre from public.productos where gimnasio_id = $1 and locker_meses is not null and activo order by creado_en limit 1`, [s.gimnasio_id]);
  const { rows: [sede] } = await db.query(`select id from public.sedes where gimnasio_id = $1 order by es_principal desc limit 1`, [s.gimnasio_id]);
  const { rows: [eq] } = await db.query(`select id from public.equipo where gimnasio_id = $1 and rol = 'recepcion' limit 1`, [s.gimnasio_id]);
  const { rows: [v] } = await db.query(`insert into public.ventas (gimnasio_id, sede_id, socio_id, estado, origen, creado_por, confirmada_en) values ($1,$2,$3,'confirmada','recepcion',$4, now()) returning id`, [s.gimnasio_id, sede.id, s.id, eq.id]);
  await db.query(`insert into public.venta_items (gimnasio_id, venta_id, tipo, producto_id, descripcion, cantidad, precio_unitario) values ($1,$2,'producto',$3,$4,1,4500)`, [s.gimnasio_id, v.id, t.id, t.nombre]);
}

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await seccion(d, true);
  await d.goto(`${G}/panel/lockers`);
  await d.locator("[data-lockers]").waitFor({ timeout: 30000 });

  // Configuración: tarifa (si no hay) y dos lockers.
  await d.locator("[data-configurar-lockers] summary").click();
  if (await d.locator("[data-tarifa]").count() === 0) {
    await d.locator("[data-tarifa-precio]").fill("4500");
    await d.locator("[data-guardar-tarifa]").click();
    await d.locator("[data-tarifa]").first().waitFor({ timeout: 30000 });
  }
  for (const n of [NUM, NUM2]) {
    await d.locator("[data-locker-numero]").fill(n);
    await d.locator("[data-crear-locker]").click();
    await tarjeta(d, n).waitFor({ timeout: 30000 });
  }
  chequear(await tarjeta(d, NUM).locator('[data-pildora-estado="libre"]').count() === 1, "los lockers nuevos están libres", "no están libres");

  // La recepción: Alquilar → no hay cobro → ofrece cobrar; la hoja Cobrar abre.
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/lockers`);
  await tarjeta(r, NUM).waitFor({ timeout: 30000 });
  chequear(await r.locator("[data-configurar-lockers]").count() === 0, "la recepción no ve la configuración", "la recepción ve la configuración");
  await tarjeta(r, NUM).locator("[data-alquilar]").click();
  await r.locator("[data-buscar-socio-locker]").fill(SOCIO);
  await r.locator("[data-elegir-socio]").first().click();
  chequear(await r.locator("[data-cortesia-abrir]").count() === 0, "la recepción no tiene “sin cobrar”", "la recepción puede dar cortesías");
  await r.locator("[data-cobrar-abrir]").click();
  await r.locator("[data-cobrar]").waitFor({ timeout: 30000 });
  ok("“Cobrar el alquiler” abre la hoja Cobrar (el cobro es el de siempre)");
  await r.locator('[aria-label="Cerrar"]').click();

  // Ya cobrado: aparece para asignar, y se asigna.
  await dejarCobrado("Vence Hoy");
  await r.goto(`${G}/panel/lockers`);
  await r.locator("[data-por-asignar]").waitFor({ timeout: 30000 });
  ok("lo cobrado y sin locker aparece para asignar");
  await tarjeta(r, NUM).locator("[data-alquilar]").click();
  await r.locator("[data-buscar-socio-locker]").fill(SOCIO);
  await r.locator("[data-elegir-socio]").first().click();
  await r.locator("[data-asignar-cobro]").first().click();
  await tarjeta(r, NUM).locator('[data-pildora-estado="ocupado"]').waitFor({ timeout: 30000 });
  ok("la recepción asigna el locker con el cobro: queda ocupado");
  chequear(await tarjeta(r, NUM).locator("[data-alquilar]").count() === 0, "un locker ocupado no se vuelve a alquilar", "se puede alquilar un locker ocupado");

  // El socio lo ve en su app.
  const s = await pagina(b, CELU);
  await entrarSocio(s, TEL);
  await s.goto(`${G}/app/locker`);
  await s.locator("[data-mi-locker]").waitFor({ timeout: 30000 });
  chequear(await s.locator(`[data-locker-socio="${NUM}"]`).count() === 1, `el socio ve su locker ${NUM} en la app`, "el socio no ve su locker");
  chequear(await s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "celular: la app del socio no desborda", "la app del socio desborda");
  await capturar(s, "vd55-app-celu");

  // Vence: se lo acerca a mano y aparece en Inicio de la dueña.
  await db.query(`alter table public.alquileres_locker disable trigger alquiler_locker_inmutable`);
  await db.query(`update public.alquileres_locker set hasta = now() + interval '2 days' where liberado_en is null and locker_id in (select id from public.lockers where numero = $1)`, [NUM]);
  await db.query(`alter table public.alquileres_locker enable trigger alquiler_locker_inmutable`);
  await d.goto(`${G}/panel`);
  await d.locator(`[data-locker-vence="${NUM}"]`).waitFor({ timeout: 30000 });
  ok("el Inicio avisa el locker que vence esta semana");
  await d.goto(`${G}/panel/lockers`);
  chequear(await d.locator("[data-vencen-semana]").count() === 1, "la pantalla lista “Vencen esta semana”", "falta la lista de vencimientos");

  // Liberar con motivo.
  await tarjeta(d, NUM).locator("[data-liberar]").click();
  chequear(await d.locator("[data-confirmar-liberar]").isDisabled(), "liberar pide un motivo", "deja liberar sin motivo");
  await d.locator("[data-liberar-motivo]").fill("Devolvió la llave");
  await d.locator("[data-confirmar-liberar]").click();
  await tarjeta(d, NUM).locator('[data-pildora-estado="libre"]').waitFor({ timeout: 30000 });
  ok("se libera con motivo y vuelve a estar libre");

  // Celular y capturas.
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/lockers`);
  await c.locator("[data-lockers]").waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  chequear(ancho <= 1, "celular: sin desborde horizontal", `desborda ${ancho}px`);
  await capturar(c, "vd55-celu");
  await capturar(d, "vd55-compu");

  // Sección apagada.
  await seccion(d, false);
  await d.goto(`${G}/panel/lockers`);
  chequear(SIN.test(await d.locator("body").innerText()) || await d.locator("[data-lockers]").count() === 0, "con la sección apagada, Lockers no abre", "Lockers abre con la sección apagada");
  await seccion(d, true);
  if (d.errores.length) falla(`errores: ${d.errores.join(" | ")}`);
} catch (e) { falla(`se cortó: ${e.message.split("\n")[0]}`); }
finally { await db.end(); await b.close(); resultado(); }
