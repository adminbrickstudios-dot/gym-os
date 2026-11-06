#!/usr/bin/env node
// VD-23b/c · Socio con la cuota vencida: "Pagar" va arriba (después del semáforo y antes del progreso);
// el dueño cambia la meta de visitas del mes en Configuración y el Inicio del socio la sigue.
//   node scripts/e2e/vd-23c.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const [antes] = (await db.query(`select alias_transferencia, meta_visitas_mes from public.configuracion_gimnasio where gimnasio_id = $1`, [gim])).rows;
// Para que la tarjeta de Pagar exista, el gimnasio demo tiene que tener su alias.
if (!antes.alias_transferencia) await db.query(`update public.configuracion_gimnasio set alias_transferencia = 'demo.gymos.alias' where gimnasio_id = $1`, [gim]);
const b = await navegador();
try {
  const s = await pagina(b, CELU);
  await entrar(s, "socio-vencido@ejemplo.invalid");
  await s.goto(`${G}/app`);
  await s.getByText("No podés entrar").first().waitFor({ timeout: 60000 });
  const bien = s.locator("[data-bienvenida]");
  if (await bien.count()) { await bien.locator("[data-bienvenida-saltear], [data-bienvenida-listo]").first().click(); await bien.waitFor({ state: "detached", timeout: 30000 }); }
  ok("el socio vencido ve “No podés entrar”");

  // Orden en la pantalla: semáforo → Pagar → progreso.
  const y = async (loc) => (await loc.first().boundingBox())?.y ?? null;
  const ySemaforo = await y(s.getByText("No podés entrar"));
  const yPagar = await y(s.getByText(/Pagar por transferencia|Pagar ahora|Informaste/));
  const yProgreso = await y(s.locator("[data-progreso]"));
  chequear(yPagar != null && ySemaforo != null && yPagar > ySemaforo, "Pagar está justo después del semáforo", `orden raro: semáforo ${ySemaforo}, pagar ${yPagar}`);
  chequear(yPagar != null && yProgreso != null && yPagar < yProgreso, "Pagar queda arriba del progreso", `Pagar (${yPagar}) no está arriba del progreso (${yProgreso})`);
  chequear(yPagar != null && yPagar < CELU.height, "Pagar se ve sin bajar la pantalla", `Pagar a ${yPagar}px: hay que bajar`);
  const ancho = await s.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular 390 px: sin desborde (${ancho}px)`, `desborda: ${ancho}px`);
  await capturar(s, "vd23c-celu-vencido");

  // VD-23b: el dueño cambia la meta y el Inicio del socio la sigue.
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/configuracion?pestana=reglas`);
  const campo = d.locator('input[aria-label="Meta de visitas del mes"]');
  await campo.waitFor({ timeout: 30000 });
  const nueva = Number(antes.meta_visitas_mes) === 9 ? 10 : 9;
  await campo.fill(String(nueva));
  await d.locator('button:has-text("Guardar meta")').click();
  await d.getByText(`Meta guardada: ${nueva} visitas por mes.`).waitFor({ timeout: 30000 });
  ok(`el dueño guarda la meta en ${nueva}`);
  await campo.fill("40");
  chequear(await d.locator('button:has-text("Guardar meta")').isDisabled(), "una meta de 40 no se puede guardar", "deja guardar 40");
  await s.reload();
  await s.locator("[data-progreso]").first().waitFor({ timeout: 60000 });
  const texto = await s.locator("[data-progreso]").first().innerText();
  chequear(new RegExp(`/${nueva}\\b|\\(${nueva} visitas\\)`).test(texto), `el Inicio del socio muestra la meta ${nueva}`, `el socio no ve la meta ${nueva}: “${texto.replace(/\s+/g, " ").slice(0, 120)}”`);

  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.configuracion_gimnasio set meta_visitas_mes = $2, alias_transferencia = $3 where gimnasio_id = $1`, [gim, antes.meta_visitas_mes, antes.alias_transferencia]);
  await db.end();
  await b.close();
  resultado();
}
