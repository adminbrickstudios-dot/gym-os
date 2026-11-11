#!/usr/bin/env node
// H1 · Caja por medio (reclamo de Temple Gym: "las transferencias del mostrador no salen en Caja").
// Números fijos en UN turno de Ana: 2 cobros en efectivo ($3.000 y $4.500), 3 por transferencia ($1.500, $3.000, $4.500) y 1 con tarjeta ($1.500),
// con $10.000 de fondo. El turno abierto, el reporte X, el cierre, el reporte Z y Transferencias dicen lo mismo, "tiene que haber" es solo el
// efectivo ($17.500) y la caja cierra JUSTA aunque hubo $9.000 por transferencia. La tilde "ya la vi en el banco" queda con quién y cuándo.
// Compu y celular, con capturas.
//   node scripts/e2e/caja-medios.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const plata = (n) => `$${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 0 })}`;
const db = new pg.Client({ connectionString: url });
await db.connect();

/** Corre `fn` en la base como esa persona del equipo (con su rol y su sesión), igual que la app. */
async function como(email, fn) {
  const { rows: [u] } = await db.query(`select id from auth.users where email = $1`, [email]);
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: u.id, role: "authenticated" })]);
    const r = await fn();
    await db.query("commit");
    return r;
  } catch (e) { await db.query("rollback"); throw e; }
}
const medio = (p, m) => p.locator(`[data-por-medio] [data-medio="${m}"]`).first();
const dato = async (p, m) => { const c = medio(p, m); return { total: Number(await c.getAttribute("data-total")), cantidad: Number(await c.getAttribute("data-cantidad")) }; };
/** Los cuatro medios de la pantalla contra lo esperado. */
async function verificar(p, donde, esperado) {
  for (const [m, e] of Object.entries(esperado)) {
    const d = await dato(p, m);
    chequear(d.total === e.total && d.cantidad === e.cantidad, `${donde}: ${m} ${plata(e.total)} en ${e.cantidad} ${e.cantidad === 1 ? "cobro" : "cobros"}`,
      `${donde}: ${m} dice ${plata(d.total)} en ${d.cantidad}, tenía que decir ${plata(e.total)} en ${e.cantidad}`);
  }
}
const ESPERADO = { efectivo: { total: 7500, cantidad: 2 }, transferencia: { total: 9000, cantidad: 3 }, tarjeta: { total: 1500, cantidad: 1 }, mercadopago: { total: 0, cantidad: 0 } };
const sinDesborde = async (p, donde) => {
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `${donde} en celular sin desborde (${ancho}px)`, `${donde} en celular desborda: ${ancho}px`);
};

try {
  const { rows: [g] } = await db.query(`select id from public.gimnasios where slug = 'demo'`);
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");

  // Sin turno de otra prueba: se cierra el que haya abierto (contado = lo esperado, así no deja diferencias sueltas).
  await r.goto(`${G}/panel/caja`);
  await r.locator("main h1").waitFor();
  while (await r.locator('button:has-text("Cerrar caja")').count()) {
    await r.locator('button:has-text("Cerrar caja")').first().click();
    await r.locator('input[placeholder="$ contado"]').fill("0");
    await r.locator('button:has-text("Cerrar con este monto")').click();
    await r.locator('button:has-text("Listo")').click();
    await r.goto(`${G}/panel/caja`);
    await r.locator("main h1").waitFor();
  }

  // ── Los datos: un turno con 2 efectivo, 3 transferencia y 1 tarjeta (por la base, con la sesión de Ana) ──
  const { rows: [cj] } = await db.query(`select c.id, c.sede_id from public.cajas c where c.gimnasio_id = $1 and c.activa
      and not exists (select 1 from public.turnos_caja t where t.caja_id = c.id and t.cerrado_en is null) order by c.nombre limit 1`, [g.id]);
  const { rows: [prod] } = await db.query(`insert into public.productos (gimnasio_id, nombre, precio) values ($1, $2, 1500) returning id`, [g.id, `Agua de prueba ${Date.now()}`]);
  const turnoId = await como("recepcion@ejemplo.invalid", async () => (await db.query(`select public.abrir_caja($1, 10000) as id`, [cj.id])).rows[0].id);
  const vender = (n, m) => como("recepcion@ejemplo.invalid", () => db.query(`select public.vender($1, $2, $3, null, $4)`,
    [cj.sede_id, JSON.stringify([{ tipo: "producto", producto_id: prod.id, cantidad: n }]), JSON.stringify([{ medio: m, monto: 1500 * n }]), turnoId]));
  await vender(2, "efectivo"); await vender(3, "efectivo");
  await vender(1, "transferencia"); await vender(2, "transferencia"); await vender(3, "transferencia");
  await vender(1, "debito");
  ok("turno de Ana con $10.000 de fondo: 2 en efectivo, 3 por transferencia y 1 con tarjeta");

  // ── 1. El turno abierto (la dueña): resumen por medio, grande y claro ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/caja`);
  await d.locator("[data-por-medio]").first().waitFor({ timeout: 30000 });
  await verificar(d, "Caja (turno abierto)", ESPERADO);
  const cajon = await d.locator("[data-tiene-que-haber]").first().innerText();
  chequear(cajon.includes("17.500") && /Tiene que haber en el cajón/.test(cajon) && /no están ahí/.test(cajon),
    "“Tiene que haber en el cajón” es $17.500 (10.000 + 7.500): solo el efectivo, y lo explica", `cajón: ${cajon.replace(/\s+/g, " ")}`);
  chequear(await d.locator("[data-medio=efectivo] [data-tiene-que-haber]").count() === 1, "…y está al lado del efectivo", "el cajón no está en la tarjeta del efectivo");
  chequear(await d.getByText("Tiene que haber").count() === 1, "aparece una sola vez (la pantalla no se repite)", "“Tiene que haber” aparece más de una vez");
  await d.locator('[data-ver-cobros="transferencia"]').first().click();
  const lista = await d.locator('[data-medio="transferencia"] [data-cobro]').allInnerTexts();
  chequear(lista.length === 3 && lista.every((t) => /cobró Ana/.test(t) && /\d\d:\d\d/.test(t)), "la lista de transferencias: hora, socio, monto y quién cobró (3 filas)", `lista: ${JSON.stringify(lista)}`);
  chequear(["1.500", "3.000", "4.500"].every((x) => lista.some((t) => t.includes(x))), "…con $1.500, $3.000 y $4.500", `lista: ${JSON.stringify(lista)}`);
  await capturar(d, "caja-medios-compu-turno", true);
  await d.setViewportSize(CELU);
  await sinDesborde(d, "Caja con el resumen por medio");
  await capturar(d, "caja-medios-celu-turno", true);
  await d.setViewportSize(COMPU);

  // ── 2. La recepción no ve lo del cajón con la caja abierta (arqueo ciego, como antes) ──
  await r.goto(`${G}/panel/caja`);
  await r.locator("main h1").waitFor();
  chequear(await r.getByText("Tiene que haber").count() === 0 && await r.locator("[data-por-medio]").count() === 0, "la recepción con la caja abierta no ve lo que tiene que haber ni el resumen (arqueo ciego)", "la recepción ve el resumen con la caja abierta");

  // ── 3. Reporte X (en vivo) ──
  await d.goto(`${G}/panel/caja/reporte?turno=${turnoId}`);
  await d.locator("[data-por-medio]").first().waitFor({ timeout: 30000 });
  await verificar(d, "Reporte X", ESPERADO);
  chequear(/17\.500/.test(await d.locator("[data-tiene-que-haber]").first().innerText()), "Reporte X: tiene que haber $17.500", "Reporte X: no dice $17.500");
  await capturar(d, "caja-medios-compu-reporte-x", true);
  await d.setViewportSize(CELU);
  await sinDesborde(d, "Reporte X");
  await capturar(d, "caja-medios-celu-reporte-x", true);
  await d.setViewportSize(COMPU);

  // ── 4. El cierre (Ana cuenta $17.500: la transferencia y la tarjeta no están en el cajón) ──
  await r.goto(`${G}/panel/caja`);
  await r.locator('button:has-text("Cerrar caja")').first().click();
  await r.locator('input[placeholder="$ contado"]').fill("17500");
  await r.locator('button:has-text("Cerrar con este monto")').click();
  await r.locator('button:has-text("Listo")').waitFor({ timeout: 30000 });
  chequear(/Caja justa/.test(await r.locator("main").innerText()), "el cierre dice CAJA JUSTA con $17.500 contados, aunque hubo $9.000 por transferencia", `cierre: ${(await r.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 300)}`);
  await verificar(r, "Cierre", ESPERADO);
  chequear(await r.locator("[data-dif-efectivo]").count() === 1, "el cierre aclara que la diferencia cuenta solo el efectivo", "falta la aclaración de la diferencia");
  await capturar(r, "caja-medios-compu-cierre", true);
  await r.setViewportSize(CELU);
  await sinDesborde(r, "Cierre");
  await capturar(r, "caja-medios-celu-cierre", true);
  await r.setViewportSize(COMPU);
  await r.locator('button:has-text("Listo")').click();

  // ── 5. Reporte del turno ya cerrado y reporte del día (Z) ──
  await d.goto(`${G}/panel/caja/reporte?turno=${turnoId}`);
  await d.locator("[data-por-medio]").first().waitFor({ timeout: 30000 });
  await verificar(d, "Reporte del turno cerrado", ESPERADO);
  chequear(/Tenía que haber en el cajón/.test(await d.locator("main").innerText()), "el reporte cerrado dice “Tenía que haber en el cajón”", "el reporte cerrado no dice “Tenía”");
  await d.goto(`${G}/panel/caja/reporte`);
  await d.locator("[data-por-medio]").first().waitFor({ timeout: 30000 });
  const ids = await d.locator("[data-turnos-dia] a").evaluateAll((as) => as.map((a) => new URL(a.href).searchParams.get("turno")));
  chequear(ids.includes(turnoId), "el reporte del día incluye el turno", `turnos del día: ${ids}`);
  const { rows: porMedio } = await db.query(`select case when p.medio in ('debito','credito') then 'tarjeta' else p.medio end as m, sum(p.monto)::numeric as total, count(*)::int as n
      from public.pagos p join public.ventas v on v.id = p.venta_id
     where p.estado = 'aprobado' and (p.turno_caja_id = any ($1::uuid[]) or v.turno_caja_id = any ($1::uuid[])) group by 1`, [ids]);
  const esp = (m) => porMedio.find((x) => x.m === m) ?? { total: 0, n: 0 };
  await verificar(d, "Reporte Z", Object.fromEntries(["efectivo", "transferencia", "tarjeta", "mercadopago"].map((m) => [m, { total: Number(esp(m).total), cantidad: esp(m).n }])));
  chequear(Number(esp("transferencia").total) >= 9000, "el Z suma las transferencias del turno (y las de otros turnos del día, si hubo)", "el Z no suma las transferencias");
  await capturar(d, "caja-medios-compu-reporte-z", true);
  await d.setViewportSize(CELU);
  await sinDesborde(d, "Reporte Z");
  await capturar(d, "caja-medios-celu-reporte-z", true);
  await d.setViewportSize(COMPU);

  // ── 6. Transferencias: dos pestañas que no se mezclan; la tilde "ya la vi en el banco" ──
  await d.goto(`${G}/panel/transferencias`);
  await d.locator("main h1").waitFor();
  const pestanas = await d.locator(".pestanas a").allInnerTexts();
  chequear(pestanas.some((t) => /Comprobantes de socios/.test(t)) && pestanas.some((t) => /Cobradas en el mostrador/.test(t)), "Transferencias tiene dos pestañas: Comprobantes de socios y Cobradas en el mostrador", `pestañas: ${JSON.stringify(pestanas)}`);
  chequear(await d.locator("[data-mostrador]").count() === 0, "la pestaña de los comprobantes no mezcla lo cobrado en el mostrador", "se mezclaron");
  await d.locator('.pestanas a:has-text("Cobradas en el mostrador")').click();
  await d.locator("[data-mostrador]").waitFor({ timeout: 30000 });
  const mias = d.locator('[data-cobrada]:has-text("cobró Ana")');
  const filasAna = await mias.allInnerTexts();
  const montos = ["1.500", "3.000", "4.500"];
  chequear(montos.every((m) => filasAna.some((t) => t.includes(`$${m}`))), "‘Cobradas en el mostrador’ trae las 3 transferencias del turno ($1.500, $3.000 y $4.500)", `filas de Ana: ${JSON.stringify(filasAna)}`);
  chequear(!filasAna.some((t) => /17\.500|7\.500/.test(t)), "…y ni el efectivo ni la tarjeta", "aparecen cobros que no son transferencias");
  await capturar(d, "caja-medios-compu-transferencias-mostrador", true);
  await d.setViewportSize(CELU);
  await sinDesborde(d, "Transferencias · cobradas en el mostrador");
  const alto = await d.locator("[data-tilde-banco]").first().evaluate((e) => e.getBoundingClientRect().height);
  chequear(alto >= 44, `el botón de la tilde mide ${Math.round(alto)} px (mínimo 44)`, `botón de la tilde de ${Math.round(alto)} px`);
  await capturar(d, "caja-medios-celu-transferencias-mostrador", true);
  await d.setViewportSize(COMPU);

  const antes = Number(await d.locator("[data-sin-ver-total]").getAttribute("data-sin-ver-total"));
  await mias.filter({ hasText: "$3.000" }).first().locator("[data-tilde-banco]").click();
  await d.locator('[data-cobrada="vista"]:has-text("$3.000")').first().waitFor({ timeout: 30000 });
  const despues = Number(await d.locator("[data-sin-ver-total]").getAttribute("data-sin-ver-total"));
  chequear(antes - despues === 3000, `al tildar la de $3.000 el “sin chequear” baja $3.000 (${plata(antes)} a ${plata(despues)})`, `sin chequear: ${antes} → ${despues}`);
  chequear(/La vio en el banco Sofía/.test(await d.locator("[data-visto]").first().innerText()), "queda quién la vio (Sofía) y cuándo", "no dice quién la vio");
  const { rows: v } = await db.query(`select b.visto_por, e.nombre, b.visto_en is not null as cuando from public.pagos_vistos_en_banco b join public.equipo e on e.id = b.visto_por where b.gimnasio_id = $1`, [g.id]);
  chequear(v.length >= 1 && v.some((x) => x.nombre === "Sofía" && x.cuando), "en la base quedó la tilde con quién y cuándo", JSON.stringify(v));
  await d.reload();
  await d.locator("[data-mostrador]").waitFor({ timeout: 30000 });
  chequear(await d.locator('[data-cobrada="vista"]:has-text("$3.000")').count() >= 1, "después de recargar, la tilde sigue", "la tilde se perdió al recargar");

  // La recepción también puede tildar (no toca la caja), y la caja de hoy no cambió.
  await r.goto(`${G}/panel/transferencias?ver=mostrador`);
  await r.locator("[data-mostrador]").waitFor({ timeout: 30000 });
  await r.locator('[data-cobrada="sin-ver"]:has-text("cobró Ana") [data-tilde-banco]').first().click();
  await r.locator('[data-cobrada="vista"]:has-text("La vio en el banco Ana")').first().waitFor({ timeout: 30000 });
  ok("la recepción también tilda ‘ya la vi en el banco’ y queda con su nombre");
  const { rows: [t] } = await db.query(`select monto_esperado, monto_contado from public.turnos_caja where id = $1`, [turnoId]);
  chequear(Number(t.monto_esperado) === 17500 && Number(t.monto_contado) === 17500, "la caja quedó igual: tenía que haber $17.500, contado $17.500", `turno: ${JSON.stringify(t)}`);
} finally {
  await db.end();
  await b.close();
}
resultado();
