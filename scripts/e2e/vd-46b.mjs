#!/usr/bin/env node
// VD-46B · Suspender o expulsar con motivo y fecha de revisión.
// La recepción suspende (con motivo) pero no ve "Levantar" ni "Expulsión"; la dueña levanta con motivo; la suspensión
// aparece en Control; el celular no se desborda.
//   node scripts/e2e/vd-46b.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Suspe${s5}`);
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Solo dar de alta")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}/, { timeout: 30000 });
  const id = new URL(d.url()).pathname.split("/").pop();
  ok(`socio de prueba creado (${id.slice(0, 8)})`);

  // La recepción suspende; no puede expulsar.
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios/${id}`);
  await r.locator("[data-suspender-abrir]").click();
  chequear((await r.locator('[role="radiogroup"]').count()) === 0, "la recepción no ve “Expulsión”", "la recepción ve la expulsión");
  await r.locator('input[placeholder^="Ej.: pelea"]').fill("Pelea en el vestuario");
  await r.locator('button:has-text("Suspender")').click();
  await r.locator('[data-suspension="suspension"]').waitFor({ timeout: 30000 });
  ok("la recepción suspendió con motivo");
  chequear((await r.locator("[data-levantar-abrir]").count()) === 0, "la recepción no puede levantarla", "la recepción ve “Levantar”");
  chequear(await r.getByText("La levanta el dueño o el encargado.").isVisible(), "le dice quién la levanta", "no dice quién levanta");

  // La dueña la ve en Control y la levanta con motivo.
  await d.goto(`${G}/panel/control`);
  await d.locator('[data-moderacion-item="suspension"]').first().waitFor({ timeout: 30000 });
  ok("la suspensión aparece en Control");
  await d.goto(`${G}/panel/socios/${id}`);
  await d.locator("[data-levantar-abrir]").click();
  await d.locator('button:has-text("Levantar")').isDisabled().then((x) => chequear(x, "no se levanta sin motivo", "se puede levantar sin motivo"));
  await d.locator('input[placeholder^="Ej.: pidió"]').fill("Pidió disculpas");
  await d.locator('button:has-text("Levantar")').click();
  await d.locator("[data-suspension]").waitFor({ state: "detached", timeout: 30000 });
  ok("la dueña levantó la suspensión con motivo");

  // Celular: la ficha con la suspensión no se desborda.
  await d.locator("[data-suspender-abrir]").click();
  await d.locator('input[placeholder^="Ej.: pelea"]').fill("Prueba de expulsión");
  await d.locator('[role="radio"]:has-text("Expulsión")').click();
  await d.locator('button:has-text("Expulsar")').click();
  await d.locator('[data-suspension="expulsion"]').waitFor({ timeout: 30000 });
  ok("la dueña expulsa (sin fecha de fin)");
  const m = await pagina(b, CELU);
  await entrar(m, "duena@ejemplo.invalid");
  await m.goto(`${G}/panel/socios/${id}`);
  await m.locator("[data-suspension]").waitFor({ timeout: 30000 });
  const ancho = await m.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= 391, "celular 390 px sin desborde", `desborda: ${ancho}px`);
  await capturar(m, "vd46b-celu-ficha");
  for (const p of [d, r, m]) chequear(p.errores.length === 0, "sin errores de página", p.errores.join(" | "));
} finally {
  await b.close();
}
resultado();
