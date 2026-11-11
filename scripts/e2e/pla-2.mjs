#!/usr/bin/env node
// PLA-2 · Planes por horario, días por semana y clases: la dueña crea un plan
// con un horario que no es el de ahora; un socio con ese plan al día no entra
// ("es de … a …"); al pasarlo a todo el día, entra. Elegir clases deja
// "solo Yoga" en la lista. Un horario al revés avisa qué poner.
//   npm run e2e:pla-2            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const hh = (h) => `${String(h).padStart(2, "0")}:00`;
try {
  const ahora = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", hour12: false }).format(new Date()));
  const [desde, hasta] = ahora + 3 <= 23 ? [ahora + 2, ahora + 3] : [ahora - 3, ahora - 2];
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/planes`);
  await d.locator('button:has-text("Nuevo plan")').click();
  await d.locator('input[name="nombre"]').fill(`Franja${s5}`);
  await d.locator('input[name="precio"]').fill("15.000");
  await d.locator('input[name="max_ingresos_semana"]').fill("3");
  await d.locator('form input[aria-label="Horario desde"]').fill(hh(desde));
  await d.locator('form input[aria-label="Horario hasta"]').fill(hh(hasta));
  await d.locator('button:has-text("Crear")').click();
  const fila = d.locator(`li[data-plan="Franja${s5}"]`);
  await fila.waitFor({ timeout: 30000 });
  chequear(new RegExp(`3 veces por semana · de ${hh(desde)} a ${hh(hasta)}`).test(await fila.innerText()), `la lista: 3 veces por semana · de ${hh(desde)} a ${hh(hasta)}`, await fila.innerText());

  // Un socio con ese plan, al día.
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Franjo${s5}`);
  await elegirPlan(d, `Franja${s5}`);
  await d.locator('button:has-text("Solo dar de alta")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
  const id = d.url().split("/").pop();
  await d.goto(`${G}/panel/vender?socio=${id}&cuota=1`);
  await d.getByText(`Cuota Franja${s5}`).first().waitFor({ timeout: 30000 });
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await d.locator('button:has-text("Cobrar")').click();
  await esperarCobro(d);
  await d.goto(`${G}/panel/entrada?socio=${id}`);
  const rojo = d.locator('[data-veredicto="rojo"]');
  await rojo.waitFor({ timeout: 30000 });
  chequear(new RegExp(`es de ${hh(desde)} a ${hh(hasta)}`).test(await rojo.innerText()), "al día pero fuera de su horario: no entra y dice por qué", await rojo.innerText());
  await capturar(d, "pla2-compu-fuera-de-horario");

  // Editar: horario al revés avisa; "Todo el día" lo deja entrar.
  await d.goto(`${G}/panel/planes`);
  await fila.locator('button:has-text("Editar")').click();
  await fila.locator('input[aria-label="Horario desde"]').fill("16:00");
  await fila.locator('input[aria-label="Horario hasta"]').fill("07:00");
  await fila.locator('button:has-text("Guardar")').click();
  await fila.locator('[role="alert"]:has-text("termina después de empezar")').waitFor({ timeout: 30000 });
  ok("un horario al revés avisa qué poner");
  await fila.locator('button:has-text("Todo el día")').click();
  const clases = fila.locator('fieldset:has-text("Clases que puede reservar") label');
  const hayClases = await clases.count();
  let nombreClase = null;
  if (hayClases) { nombreClase = (await clases.first().innerText()).trim().replace(/^\S+\s/, ""); await clases.first().click(); }
  await fila.locator('button:has-text("Guardar")').click();
  await fila.locator('button:has-text("Editar")').waitFor({ timeout: 30000 });
  await d.waitForFunction((n) => !/ a \d\d:00/.test(document.querySelector(`li[data-plan="${n}"]`)?.textContent ?? ""), `Franja${s5}`, { timeout: 15000 }).catch(() => {});
  if (hayClases) await d.waitForFunction(([n, c]) => document.querySelector(`li[data-plan="${n}"]`)?.textContent?.includes(`solo ${c}`), [`Franja${s5}`, nombreClase], { timeout: 15000 }).catch(() => {});
  const t = await fila.innerText();
  chequear(!/ a \d\d:00/.test(t.split("\n")[1] ?? ""), "“Todo el día”: la lista ya no dice horario", t);
  if (hayClases) chequear(new RegExp(`solo ${nombreClase}`).test(t), `elegir una clase: “solo ${nombreClase}”`, `[${nombreClase}] ${t.replace(/\n/g, " | ")}`);
  await d.goto(`${G}/panel/entrada?socio=${id}`);
  await d.locator('[data-veredicto="verde"]').waitFor({ timeout: 30000 });
  ok("sin horario, el mismo socio entra");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
