#!/usr/bin/env node
// AUD-5 · Planes y productos, botón por botón (dueña, encargado y recepción;
// compu y celular). Lo que se rompía: "Dejar de vender" borraba las veces por
// semana (y el plan quedaba libre), y "1500.50" se leía como 150.050.
//   npm run e2e:planes            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const plan = (p, n) => p.locator(`li[data-plan="${n}"]`);
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/planes`);
  await d.locator('main h2:has-text("Membresías")').waitFor({ timeout: 60000 });
  ok("la dueña ve los planes por tipo y los productos");

  // Crear: membresía de 2 veces por semana, con decimales escritos con punto.
  await d.locator('button:has-text("Nuevo plan")').click();
  await d.locator('input[name="nombre"]').fill(`Dos${s5}`);
  await d.locator('input[name="precio"]').fill("1500.50");
  await d.locator('input[name="max_ingresos_semana"]').fill("2");
  await d.locator('button:has-text("Crear")').click();
  await plan(d, `Dos${s5}`).waitFor({ timeout: 30000 });
  const fila = await plan(d, `Dos${s5}`).innerText();
  chequear(/\$1\.500,50/.test(fila) && /2 veces por semana/.test(fila), "Nuevo plan: “1500.50” queda $1.500,50 y dice 2 veces por semana", `dice: ${fila}`);

  // Editar nombre y descripción.
  await plan(d, `Dos${s5}`).locator('button:has-text("Editar")').click();
  await plan(d, `Dos${s5}`).locator("label:has-text('Descripción') input").fill("Martes y jueves");
  await plan(d, `Dos${s5}`).locator("label:has-text('Nombre') input").fill(`DosX${s5}`);
  await plan(d, `Dos${s5}`).locator('button:has-text("Guardar")').click();
  await plan(d, `DosX${s5}`).waitFor({ timeout: 30000 });
  chequear(/Martes y jueves/.test(await plan(d, `DosX${s5}`).innerText()), "✏️ Editar cambia nombre y descripción", "no cambió");

  // Dejar de vender y volver: no pierde las veces por semana ni la descripción.
  await plan(d, `DosX${s5}`).locator('button:has-text("Dejar de vender")').click();
  await plan(d, `DosX${s5}`).locator('text=No se vende').waitFor({ timeout: 30000 });
  await plan(d, `DosX${s5}`).locator('button:has-text("Volver a vender")').click();
  await plan(d, `DosX${s5}`).locator('button:has-text("Dejar de vender")').waitFor({ timeout: 30000 });
  const vuelta = await plan(d, `DosX${s5}`).innerText();
  chequear(/2 veces por semana/.test(vuelta) && /Martes y jueves/.test(vuelta), "Dejar de vender → Volver a vender: sigue siendo de 2 veces y con su descripción", `quedó: ${vuelta}`);

  // Precio: uno mal escrito avisa; uno con fecha queda programado.
  await plan(d, `DosX${s5}`).locator('button:has-text("💲 Precios")').click();
  await plan(d, `DosX${s5}`).locator('input[aria-label="Precio general"]').fill("1,5,0");
  await plan(d, `DosX${s5}`).locator('button:has-text("Guardar precios")').click();
  await plan(d, `DosX${s5}`).locator('[role="alert"]:has-text("No entiendo el precio")').waitFor({ timeout: 30000 });
  ok("un precio que no se entiende avisa cómo escribirlo");
  const en10 = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  await plan(d, `DosX${s5}`).locator('input[aria-label="Precio general"]').fill("2.000");
  await plan(d, `DosX${s5}`).locator('input[type="date"]').fill(en10);
  await plan(d, `DosX${s5}`).locator('button:has-text("Guardar precios")').click();
  await plan(d, `DosX${s5}`).locator("text=📅 Desde el").waitFor({ timeout: 30000 });
  const prog = await plan(d, `DosX${s5}`).innerText();
  chequear(/\$2\.000/.test(prog) && /\$1\.500,50/.test(prog), "💲 Precios con fecha: sigue el de hoy y avisa el que viene", `dice: ${prog}`);

  // Pack.
  await d.locator('button:has-text("Nuevo plan")').click();
  await d.locator('label:has-text("Pack")').click();
  await d.locator('input[name="nombre"]').fill(`Pack${s5}`);
  await d.locator('input[name="precio"]').fill("12.000");
  await d.locator('input[name="cantidad_clases"]').fill("8");
  await d.locator('button:has-text("Crear")').click();
  await plan(d, `Pack${s5}`).waitFor({ timeout: 30000 });
  chequear(/8 clases · vence a los 60 días/.test(await plan(d, `Pack${s5}`).innerText()), "Nuevo pack: 8 clases, vence a los 60 días", "el pack no dice clases y vencimiento");

  // Productos: agregar, editar, ocultar, mostrar.
  await d.locator('input[aria-label="Producto nuevo"]').fill(`Agua${s5}`);
  await d.locator('input[aria-label="Precio del producto nuevo"]').fill("800");
  await d.locator('button:has-text("Agregar")').click();
  const prod = d.locator(`li[data-producto="Agua${s5}"]`);
  await prod.waitFor({ timeout: 30000 });
  await prod.locator('button:has-text("Editar")').click();
  await prod.locator('input[aria-label="Precio del producto"]').fill("950,50");
  await prod.locator('button:has-text("Guardar")').click();
  await prod.locator("text=$950,50").waitFor({ timeout: 30000 });
  ok("producto: agregar y ✏️ Editar el precio ($950,50)");
  await prod.locator('button:has-text("Ocultar")').click();
  await prod.locator("text=oculto en Vender").waitFor({ timeout: 30000 });
  await prod.locator('button:has-text("Mostrar")').click();
  await prod.locator('button:has-text("Ocultar")').waitFor({ timeout: 30000 });
  ok("Ocultar y Mostrar");
  await capturar(d, "aud5-compu-planes");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  // Vender ve el producto con su precio.
  await d.goto(`${G}/panel/vender`);
  chequear(await d.locator(`main :text("Agua${s5}")`).count() > 0, "el producto aparece en Vender", "no está en Vender");

  const e = await pagina(b, CELU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel/planes`);
  await e.locator('main h2:has-text("Membresías")').waitFor({ timeout: 60000 });
  const ancho = await e.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `el encargado la abre en el celular sin desborde (${ancho}px)`, `desborda: ${ancho}`);
  await capturar(e, "aud5-celu-planes");

  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/planes`);
  chequear(await r.getByText("No tenés acceso").count() > 0, "la recepción: “No tenés acceso”", "la recepción abre Planes");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
