#!/usr/bin/env node
// F0.4 / F1.3 · Velocidad del carril A (ESCRITO, SIN CORRER: lo corre el principal con la app compilada).
//  1. Botones rápidos de Inicio (Cobrar, Alta, Pase diario): los ve la recepción y la dueña, no la profe; Cobrar lleva a Vender.
//  2. "Caja del turno": la recepción lo ve como número (sin signo de pesos, es un conteo), tocarlo lleva a Caja; la dueña no lo tiene.
//  3. Ingreso optimista en /panel/entrada: con el servidor frenado 1,5 s, "Entró <nombre>" aparece en menos de 500 ms de apretar Enter
//     (el veredicto ya decía que puede entrar); cuando la base contesta, queda con su "Deshacer". Es la regla 1 de FLUIDEZ.md.
//  4. Ingreso optimista que la base rechaza: el aviso vuelve atrás y dice el motivo (se simula con la respuesta del servidor cortada).
//   node scripts/e2e/velocidad-a.mjs     (con scripts/local/levantar.sh corriendo; TOPE_MS afloja el tope en una compu lenta)
import { execSync } from "node:child_process";
import pg from "pg";
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const TOPE = Number(process.env.TOPE_MS ?? 500);
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const b = await navegador();
try {
  // 1. Botones rápidos.
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  await d.locator("[data-acciones-mostrador]").waitFor({ timeout: 30000 });
  chequear((await d.locator('[data-accion-rapida="cobrar"]').count()) === 1 && (await d.locator('[data-accion-rapida="alta"]').count()) === 1,
    "la dueña ve Cobrar y Alta a un toque", "a la dueña le faltan los botones rápidos");
  const [{ pase }] = (await db.query(`select cobra_pase as pase from public.configuracion_gimnasio where gimnasio_id = $1`, [gim])).rows;
  chequear((await d.locator('[data-accion-rapida="pase"]').count()) === (pase ? 1 : 0), `Pase diario ${pase ? "se ofrece (el gimnasio cobra pases)" : "no se ofrece (el gimnasio no cobra pases)"}`, "Pase diario no sigue la configuración");
  await d.locator('[data-accion-rapida="cobrar"]').click();
  await d.waitForURL((u) => u.pathname.startsWith("/panel/vender"), { timeout: 30000 });
  ok("Cobrar lleva a Vender");

  const p = await pagina(b, COMPU);
  await entrar(p, "profe@ejemplo.invalid");
  await p.goto(`${G}/panel`);
  await p.locator("h1").first().waitFor({ timeout: 30000 });
  chequear((await p.locator("[data-acciones-mostrador]").count()) === 0, "la profe no ve los botones de mostrador", "la profe ve botones de mostrador");

  // 2. Caja del turno.
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel`);
  await r.locator("[data-numero]").first().waitFor({ timeout: 30000 });
  chequear((await r.locator("[data-acciones-mostrador] a").count()) >= 2, "la recepción ve sus botones rápidos", "la recepción no ve botones rápidos");
  const caja = r.locator('dl [data-numero="caja_turno"]');
  chequear((await caja.count()) === 1, "la recepción ve 'Caja del turno' como número", "falta Caja del turno en la recepción");
  if (await caja.count()) {
    const txt = (await caja.innerText()).replace(/\s+/g, " ");
    chequear(/Caja del turno/.test(txt) && !/\$/.test(txt), `Caja del turno es un conteo, sin plata ("${txt}")`, `Caja del turno muestra plata: "${txt}"`);
    await caja.click();
    await r.waitForURL((u) => u.pathname.startsWith("/panel/caja"), { timeout: 30000 });
    ok("tocar Caja del turno lleva a Caja");
  }
  await d.goto(`${G}/panel`);
  await d.locator("[data-numero]").first().waitFor({ timeout: 30000 });
  chequear((await d.locator('dl [data-numero="caja_turno"]').count()) === 0, "la dueña no tiene Caja del turno", "la dueña ve Caja del turno");

  // 3. Ingreso optimista.
  const { rows: [s] } = await db.query(`
    select s.id, s.nombre || ' ' || s.apellido as nombre, s.numero, s.dni from public.socios s
     where s.gimnasio_id = $1 and s.dado_de_baja_en is null and s.dni is not null and s.cubierto_hasta > now() + interval '10 days'
     order by s.numero limit 1`, [gim]);
  if (!s) throw new Error("no hay un socio al día en el demo");
  await r.goto(`${G}/panel/entrada`);
  const campo = r.getByLabel("Buscar socio");
  await campo.waitFor({ timeout: 30000 });
  // Se frena el servidor: toda acción del servidor (POST con Next-Action) tarda 1,5 s más.
  let frenar = false, cortar = false;
  await r.route("**/panel/entrada**", async (ruta) => {
    const req = ruta.request();
    if (frenar && req.method() === "POST" && req.headers()["next-action"]) {
      await new Promise((f) => setTimeout(f, 1500));
      if (cortar) return ruta.abort("failed");
    }
    return ruta.continue();
  });
  await campo.fill(s.dni);   // por DNI: un número corto (menos de 2 cifras) no dispara la búsqueda
  await r.waitForTimeout(400);
  await campo.press("Enter");
  await r.locator("[data-veredicto], [data-color]").first().waitFor({ timeout: 30000 }).catch(() => {});
  await r.waitForTimeout(800);
  frenar = true;
  const t0 = Date.now();
  await r.keyboard.press("Enter");
  await r.locator("[data-hecho]").waitFor({ timeout: 10000 });
  const ms = Date.now() - t0;
  chequear(ms <= TOPE, `"Entró ${s.nombre}" aparece a los ${ms} ms de apretar Enter, con el servidor frenado 1,5 s (tope ${TOPE} ms)`, `el aviso tardó ${ms} ms (tope ${TOPE})`);
  chequear(await r.locator("[data-hecho] button:has-text('Deshacer')").isDisabled(), "mientras la base no confirma, Deshacer no se puede apretar", "Deshacer se puede apretar antes de confirmar");
  await r.waitForTimeout(2500);
  chequear(!(await r.locator("[data-hecho] button:has-text('Deshacer')").isDisabled()), "cuando la base confirma, queda con su Deshacer", "Deshacer sigue apagado después de confirmar");
  const [{ n }] = (await db.query(`select count(*)::int n from public.ingresos where gimnasio_id = $1 and socio_id = $2 and momento > now() - interval '1 minute' and anulado_en is null`, [gim, s.id])).rows;
  chequear(n >= 1, "el ingreso quedó guardado en la base", "no hay ingreso en la base");
  await db.query(`update public.ingresos set anulado_en = now(), anulado_motivo = 'prueba velocidad-a' where gimnasio_id = $1 and socio_id = $2 and anulado_en is null and momento > now() - interval '2 minutes'`, [gim, s.id]).catch(() => {});

  // 4. La base (o la red) rechaza: vuelve atrás y dice por qué.
  await r.reload();
  await campo.waitFor({ timeout: 30000 });
  frenar = false; cortar = false;
  await campo.fill(s.dni); await r.waitForTimeout(400); await campo.press("Enter");
  await r.waitForTimeout(1500);
  frenar = true; cortar = true;
  await r.keyboard.press("Enter");
  await r.locator("[data-hecho]").waitFor({ timeout: 10000 }).catch(() => {});
  const desaparecio = await r.locator("[data-hecho]").waitFor({ state: "detached", timeout: 10000 }).then(() => true, () => false);
  chequear(desaparecio, "si el servidor no contesta, el aviso provisorio se retira (vuelta atrás)", "el aviso provisorio quedó aunque el servidor no contestó");
  chequear((await r.getByLabel("Buscar socio").count()) === 1, "la pantalla sigue usable para reintentar", "la pantalla quedó rota");
} catch (e) {
  falla(`el recorrido se cortó: ${e.message}`);
} finally {
  await db.end().catch(() => {});
  await b.close();
  resultado();
}
