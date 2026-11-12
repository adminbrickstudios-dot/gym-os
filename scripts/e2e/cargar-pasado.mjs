#!/usr/bin/env node
// C10 · Cargar socios en el pasado, con sesión real (dueña):
//   1. Importar 50 socios con pagos pasados (2 con error: un pago de fecha futura y uno sin medio): la vista previa dice
//      cuántos pagos y cuánta plata se cargan, entran 48, y la base los deja SIN caja (la de hoy no se mueve), marcados
//      "cargado después, por <quién>", con cobertura real. Volver a subir el mismo archivo no duplica plata.
//   2. Dar de alta 1 a mano con fecha de alta y pago pasados: un pago de hoy se rechaza en palabras; con fecha pasada
//      entra, queda con cubierto_hasta y con el pago marcado.
//   node scripts/e2e/cargar-pasado.mjs     (con scripts/local/levantar.sh corriendo)
// Escrito, no corrido por quien lo escribió (el principal lo corre al integrar). Datos ficticios.
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, CELU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const s = Date.now().toString().slice(-4);
const [{ id: gim, zona_horaria: zona }] = (await db.query(`select id, zona_horaria from public.gimnasios where slug = 'demo'`)).rows;
const [{ hoy }] = (await db.query(`select (now() at time zone $1)::date::text as hoy`, [zona])).rows;
const dia = (n) => { const d = new Date(`${hoy}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d; };
const iso = (n) => dia(n).toISOString().slice(0, 10);
const ar = (n) => iso(n).split("-").reverse().join("/");

const TOTAL = 50;
// Orden y títulos propios, a propósito: la pantalla los reconoce por el nombre.
const titulos = "Nombre y apellido;Documento;Membresía;Fecha de alta;Fecha de pago 1;Monto 1;Medio de pago 1;Fecha de pago 2;Monto 2;Medio de pago 2";
const filas = [];
for (let i = 0; i < TOTAL; i++) {
  const dni = `7${s}${String(i).padStart(3, "0")}`;
  const dos = i % 2 === 0;
  filas.push({
    nombre: `Pasada${s} Numero${i}`, dni, plan: "Plan Full", alta: ar(-45),
    f1: ar(-45), m1: "25000", d1: i % 3 === 0 ? "Efectivo" : "Transferencia",
    f2: dos ? ar(-15) : "", m2: dos ? "25.000,00" : "", d2: dos ? "Débito" : "",
  });
}
filas[48].f1 = ar(3);        // futura: error en palabras
filas[49].d1 = "";           // sin medio: error en palabras
const csv = [titulos, ...filas.map((f) => [f.nombre, f.dni, f.plan, f.alta, f.f1, f.m1, f.d1, f.f2, f.m2, f.d2].join(";"))].join("\r\n");
const buenas = filas.slice(0, 48);
const pagosEsperados = buenas.reduce((n, f) => n + 1 + (f.f2 ? 1 : 0), 0);
const montoEsperado = pagosEsperados * 25000;

const cajas = async () => (await db.query(
  `select t.id, privado.resumen_turno(t.id) as r from public.turnos_caja t where t.gimnasio_id = $1 and t.cerrado_en is null order by t.id`, [gim])).rows;

const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");

  // ── 1 · Importar 50 con pagos pasados ─────────────────────────────
  const cajaAntes = JSON.stringify(await cajas());
  await p.goto(`${G}/panel/socios/importar`);
  await p.locator("[data-importador]").waitFor({ timeout: 60000 });
  await p.setInputFiles('input[aria-label="Elegir archivo"]', { name: `socios-pasado-${s}.csv`, mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
  await p.locator("[data-columnas]").waitFor({ timeout: 30000 });
  const mapa = await p.locator("[data-columnas] select").evaluateAll((xs) => xs.map((x) => x.value));
  chequear(mapa.join(",") === "nombre,dni,plan,alta,pago1_fecha,pago1_monto,pago1_medio,pago2_fecha,pago2_monto,pago2_medio",
    "reconoce por el título las columnas de alta y de los dos pagos", `columnas mal reconocidas: ${mapa.join(",")}`);
  await p.locator('button:has-text("Revisar")').click();
  const rev = p.locator("[data-revision]");
  await rev.waitFor({ timeout: 60000 });
  const v = Number(await rev.getAttribute("data-validas")), e = Number(await rev.getAttribute("data-con-error")), np = Number(await rev.getAttribute("data-pagos"));
  chequear(v === 48 && e === 2 && np === pagosEsperados, `vista previa: ${v} listos, ${e} con error y ${np} pagos de antes`, `vista previa ${v}/${e}/${np}, se esperaban 48/2/${pagosEsperados}`);
  const motivos = (await rev.locator("[data-fila-error]").allInnerTexts()).join(" | ").replace(/\s+/g, " ");
  chequear(/es futura/.test(motivos) && /falta el medio de pago/.test(motivos), "cada pago malo dice el motivo en palabras (fecha futura, falta el medio)", `motivos: ${motivos.slice(0, 300)}`);
  const aviso = (await rev.locator("[data-aviso-pagos-pasados]").innerText()).replace(/\s+/g, " ");
  chequear(/No entran en la caja de hoy/.test(aviso) && aviso.includes(String(pagosEsperados)), "avisa cuántos pagos y que no entran en la caja de hoy", `aviso: ${aviso.slice(0, 200)}`);
  await capturar(p, "cargar-pasado-revision");
  await rev.locator('button:has-text("Importar 48 socios")').click();
  await p.locator(`[data-importados="48"][data-pagos-cargados="${pagosEsperados}"]`).waitFor({ timeout: 180000 });
  ok(`importó 48 socios y ${pagosEsperados} pagos de antes en una sola vez`);

  const [{ n, sin_caja, marcados, de_hoy }] = (await db.query(
    `select count(*)::int n,
            count(*) filter (where p.turno_caja_id is null and v.turno_caja_id is null)::int sin_caja,
            count(*) filter (where p.cargado_despues_en is not null and p.cargado_despues_por is not null)::int marcados,
            count(*) filter (where p.aprobado_en >= privado.medianoche($2::date, $3))::int de_hoy
       from public.pagos p join public.ventas v on v.id = p.venta_id
       join public.socios so on so.id = v.socio_id where so.gimnasio_id = $1 and so.dni like $4`, [gim, hoy, zona, `7${s}%`])).rows;
  chequear(n === pagosEsperados && sin_caja === n && marcados === n && de_hoy === 0, `los ${n} pagos quedaron sin caja, marcados quién y cuándo los cargó, y con su fecha pasada`, `pagos ${n}, sin caja ${sin_caja}, marcados ${marcados}, de hoy ${de_hoy}`);
  chequear(JSON.stringify(await cajas()) === cajaAntes, "la caja de hoy no cambió (mismo esperado en cada turno abierto)", "la caja de hoy cambió después de importar pagos pasados");
  const [{ malos, sin_cubierto }] = (await db.query(
    `select count(*) filter (where cubierto_hasta is distinct from privado.calcular_cubierto_hasta(id))::int malos, count(*) filter (where cubierto_hasta is null)::int sin_cubierto
       from public.socios where gimnasio_id = $1 and dni like $2`, [gim, `7${s}%`])).rows;
  chequear(malos === 0 && sin_cubierto === 0, "cubierto_hasta de los 48 socios es el que dan los pagos (guardado = recalculado)", `cubierto_hasta mal: ${malos}, sin: ${sin_cubierto}`);

  // Volver a subir el mismo archivo no duplica plata.
  await p.goto(`${G}/panel/socios/importar`);
  await p.locator("[data-importador]").waitFor({ timeout: 60000 });
  await p.setInputFiles('input[aria-label="Elegir archivo"]', { name: `socios-pasado-${s}.csv`, mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
  await p.locator("[data-columnas]").waitFor({ timeout: 30000 });
  await p.locator('button:has-text("Revisar")').click();
  await rev.waitFor({ timeout: 60000 });
  chequear(await rev.getAttribute("data-validas") === "0" && await rev.getAttribute("data-pagos") === "0", "el mismo archivo otra vez: nada para importar, ningún pago repetido", "volver a subir el archivo ofrece cargar de nuevo");

  // ── 2 · Alta de a uno en el pasado ────────────────────────────────
  await p.goto(`${G}/panel/socios/nuevo`);
  await p.locator("[data-carga-pasada]").waitFor({ timeout: 60000 });
  const dniUno = `6${s}001`;
  await p.fill("input[name=nombre]", `Alta${s}`);
  await p.fill("input[name=apellido]", "Antigua");
  await p.fill("input[name=dni]", dniUno);
  await elegirPlan(p, "Plan Full");
  await p.locator("[data-pasado-abrir]").click();
  await p.fill("[data-pasado-alta]", iso(-30));
  await p.fill("[data-pasado-fecha]", hoy);          // un pago de hoy no entra por acá
  await p.fill("[data-pasado-monto]", "25000");
  await p.selectOption("[data-pasado-medio]", "efectivo");
  // El navegador ya no deja mandar un pago de hoy (el campo tiene como máximo ayer)...
  const frenado = await p.locator("[data-pasado-fecha]").evaluate((x) => x.validity.rangeOverflow);
  chequear(frenado, "el campo de fecha del pago no acepta hoy (máximo ayer)", "el campo de fecha acepta hoy");
  // ...y aunque se saltee esa guarda, la base lo rechaza: se saca el máximo para llegar al servidor.
  await p.locator("[data-pasado-fecha]").evaluate((x) => x.removeAttribute("max"));
  await p.locator('button:has-text("Dar de alta")').first().click();
  const err = p.locator('[role=alert]').filter({ hasText: /es hoy/ });
  await err.waitFor({ timeout: 30000 });
  ok("un pago de hoy se rechaza en palabras: se cobra desde Cobrar");
  const [{ ya }] = (await db.query(`select count(*)::int ya from public.socios where gimnasio_id = $1 and dni = $2`, [gim, dniUno])).rows;
  chequear(ya === 0, "el rechazo no dejó un socio a medias", "quedó un socio sin pagos después del error");
  await p.fill("[data-pasado-fecha]", iso(-30));
  await p.locator('button:has-text("Dar de alta")').first().click();
  await p.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}/, { timeout: 60000 });
  ok("con fecha pasada, el alta entra y abre la ficha");
  const [uno] = (await db.query(
    `select so.id, so.cubierto_hasta, so.creado_en, p.medio, p.turno_caja_id, p.cargado_despues_en, eq.nombre as por
       from public.socios so join public.ventas v on v.socio_id = so.id join public.pagos p on p.venta_id = v.id
       left join public.equipo eq on eq.id = p.cargado_despues_por where so.gimnasio_id = $1 and so.dni = $2`, [gim, dniUno])).rows;
  chequear(uno && uno.turno_caja_id === null && uno.cargado_despues_en && uno.por && uno.cubierto_hasta, `el pago de ${ar(-30)} en efectivo quedó sin caja, marcado "cargado por ${uno?.por}" y con cubierto_hasta`, `pago del alta: ${JSON.stringify(uno)}`);
  chequear(JSON.stringify(await cajas()) === cajaAntes, "la caja de hoy sigue igual después del alta a mano", "la caja cambió con el alta a mano");
  await capturar(p, "cargar-pasado-ficha");
  if (p.errores.length) falla(p.errores.join(" | "));

  // En el celular la sección se ve y se usa igual.
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/socios/nuevo`);
  await c.locator("[data-carga-pasada]").waitFor({ timeout: 60000 });
  await c.locator("[data-pasado-abrir]").click();
  await c.locator("[data-pasado-pago]").first().waitFor({ timeout: 10000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  chequear(ancho, "celular: la carga en el pasado no ensancha la página", "celular: scroll horizontal");
  if (c.errores.length) falla(c.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
await db.end();
resultado();
