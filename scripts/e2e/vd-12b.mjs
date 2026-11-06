#!/usr/bin/env node
// VD-12b/c/d · Inicio en vivo: las últimas entradas con ⛔ y Cobrar (el que vence lleva a cobrar), Para hacer
// hoy con [Ver], mini gráfico en los números, y la recepción ve lo cobrado solo si el dueño lo prende.
//   node scripts/e2e/vd-12b.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const [{ id: sede }] = (await db.query(`select id from public.sedes where gimnasio_id = $1 limit 1`, [gim])).rows;
const [{ id: vencida }] = (await db.query(`select id from public.socios where gimnasio_id = $1 and nombre = 'Testigo' and apellido = 'Vencida'`, [gim])).rows;
const [{ recepcion_ve_cobrado: permisoAntes }] = (await db.query(`select recepcion_ve_cobrado from public.configuracion_gimnasio where gimnasio_id = $1`, [gim])).rows;
await db.query(`update public.configuracion_gimnasio set recepcion_ve_cobrado = false where gimnasio_id = $1`, [gim]);
const [{ id: ingreso }] = (await db.query(
  `insert into public.ingresos (gimnasio_id, sede_id, socio_id, via_acceso, resultado, color, motivo, texto)
   values ($1,$2,$3,'qr_socio','rechazado','rojo','vencida','Venció hace días') returning id`, [gim, sede, vencida])).rows;
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  await d.locator("[data-numero]").first().waitFor({ timeout: 30000 });

  // Últimas entradas en vivo: el rechazado con ⛔, la hora, la vía y Cobrar.
  const vivo = d.locator('[data-entrada-vivo="rechazado"]', { hasText: "Testigo Vencida" }).first();
  await vivo.waitFor({ timeout: 30000 });
  const t = (await vivo.innerText()).replace(/\s+/g, " ");
  chequear(t.includes("⛔") && /\d{2}:\d{2}/.test(t) && t.includes("QR"), `última entrada: “${t.slice(0, 80)}”`, `la entrada no tiene ⛔, hora y vía: ${t}`);
  await capturar(d, "vd12b-compu-duena");
  await vivo.getByRole("link", { name: /Cobrar/ }).click();
  await d.waitForURL((u) => u.pathname === "/panel/vender" && u.searchParams.get("socio") === vencida, { timeout: 30000 });
  ok("Cobrar lleva a Vender con el socio vencido");
  await d.goBack();
  await d.locator("[data-numero]").first().waitFor({ timeout: 30000 });

  // Para hacer hoy con [Ver]: cada fila lleva a su lista y Volver deja en Inicio.
  const hacer = d.locator("[data-para-hacer]");
  await hacer.waitFor({ timeout: 30000 });
  const filas = await hacer.locator("[data-hacer]").count();
  if (filas === 0) ok("Para hacer hoy: sin pendientes, dice que está todo al día");
  else {
    const clave = await hacer.locator("[data-hacer]").first().getAttribute("data-hacer");
    await hacer.locator("[data-hacer]").first().getByRole("link", { name: /Ver/ }).click();
    await d.waitForURL((u) => u.pathname !== "/panel", { timeout: 30000 });
    ok(`[Ver] de “${clave}” abre su lista (${new URL(d.url()).pathname})`);
    await d.goBack();
    await d.locator("[data-numero]").first().waitFor({ timeout: 30000 });
  }

  // Mini gráfico de tendencia en cada número.
  const numeros = await d.locator("[data-numero]").count();
  const graficos = await d.locator("[data-numero] [data-mini-grafico='7']").count();
  chequear(numeros > 0 && graficos === numeros, `los ${numeros} números tienen su mini gráfico de 7 días`, `hay ${graficos} gráficos para ${numeros} números`);

  // Recepción: sin la plata del día, y con ella cuando el dueño lo prende en Equipo → Permisos.
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel`);
  await r.locator("[data-numero]").first().waitFor({ timeout: 30000 });
  chequear(await r.locator('[data-numero="cobrado"]').count() === 0, "la recepción no ve lo cobrado por defecto", "la recepción ve la plata sin permiso");
  await r.locator("[data-ultimas-entradas]").waitFor({ timeout: 30000 });
  ok("la recepción ve las últimas entradas y Para hacer hoy");

  await d.goto(`${G}/panel/equipo`);
  const permiso = d.locator('[data-permiso="recepcion_ve_cobrado"]');
  await permiso.waitFor({ timeout: 30000 });
  await permiso.check();
  for (let i = 0; i < 20; i++) {
    const [{ v }] = (await db.query(`select recepcion_ve_cobrado v from public.configuracion_gimnasio where gimnasio_id = $1`, [gim])).rows;
    if (v) break;
    await d.waitForTimeout(500);
  }
  await r.reload();
  await r.locator("[data-numero]").first().waitFor({ timeout: 30000 });
  chequear(await r.locator('[data-numero="cobrado"]').count() === 1, "con el interruptor prendido, la recepción ve lo cobrado hoy", "la recepción no ve el número prendido");
  await capturar(r, "vd12b-compu-recepcion");
  await permiso.uncheck();
  for (let i = 0; i < 20; i++) {
    const [{ v }] = (await db.query(`select recepcion_ve_cobrado v from public.configuracion_gimnasio where gimnasio_id = $1`, [gim])).rows;
    if (!v) break;
    await d.waitForTimeout(500);
  }
  await r.reload();
  await r.locator("[data-numero]").first().waitFor({ timeout: 30000 });
  chequear(await r.locator('[data-numero="cobrado"]').count() === 0, "apagado de nuevo, la recepción deja de verlo", "la recepción siguió viendo la plata");

  // El profe no ve estos bloques.
  const p = await pagina(b, COMPU);
  await entrar(p, "profe@ejemplo.invalid");
  await p.goto(`${G}/panel`);
  await p.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 30000 });
  chequear(await p.locator("[data-para-hacer], [data-ultimas-entradas]").count() === 0, "el profe no ve Para hacer hoy ni las entradas", "el profe ve bloques de recepción");

  // Celular: sin desbordes.
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel`);
  await c.locator("[data-ultimas-entradas]").waitFor({ timeout: 30000 });
  const ancho = await c.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  chequear(ancho[0] <= ancho[1], "celular 390 px: Inicio sin desborde horizontal", `desborda: ${ancho[0]} > ${ancho[1]}`);
  await capturar(c, "vd12b-celu-duena");
  for (const x of [d, r, p, c]) if (x.errores?.length) falla(`consola: ${x.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  // Se deja como estaba: la entrada de prueba se anula y el permiso vuelve a su valor.
  await db.query(`update public.ingresos set anulado_en = now(), anulado_motivo = 'prueba e2e vd-12b' where id = $1`, [ingreso]).catch(() => {});
  await db.query(`update public.configuracion_gimnasio set recepcion_ve_cobrado = $2 where gimnasio_id = $1`, [gim, permisoAntes]);
  await db.end();
  await b.close();
  resultado();
}
