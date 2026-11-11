#!/usr/bin/env node
// VD-17 · Planes y servicios: la dueña edita todo lo que la base ya tenía sin pantalla (cómo vence el plan,
// tolerancia, visible en la página), ve cómo lo ve el socio, cambia el orden, crea un servicio adicional
// (Locker), se lo asigna a un socio y la cuota de ese socio lo trae sumado en Cobrar. Celular sin desbordes.
//   node scripts/e2e/vd-17.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/planes`);

  // Dos planes nuevos: uno para editar, otro para el orden.
  for (const [nombre, precio] of [[`Ajus${s5}`, "12.000"], [`Orden${s5}`, "13.000"]]) {
    await d.locator('button:has-text("Nuevo plan")').click();
    await d.locator('input[name="nombre"]').fill(nombre);
    await d.locator('input[name="precio"]').fill(precio);
    await d.locator('button:has-text("Crear")').click();
    await d.locator(`li[data-plan="${nombre}"]`).waitFor({ timeout: 30000 });
  }
  const fila = d.locator(`li[data-plan="Ajus${s5}"]`);

  // Ajustes: día fijo, tolerancia y fuera de la página.
  await fila.locator("[data-ajustes-abrir]").click();
  const form = fila.locator("[data-ajustes-plan]");
  await form.locator('select[aria-label="Cómo vence"]').selectOption("dia_fijo");
  await form.locator('input[aria-label="Día fijo"]').fill("5");
  await form.locator('input[aria-label="Días de tolerancia"]').fill("4");
  await form.locator('input[aria-label="Se ve en la página"]').uncheck();
  await form.locator('button:has-text("Guardar")').click();
  await form.waitFor({ state: "detached", timeout: 30000 });
  // La fila se refresca con el servidor un momento después de que el formulario se cierra.
  await d.waitForFunction((n) => /vence el día 5 de cada mes/.test(document.querySelector(`li[data-plan="${n}"]`)?.textContent ?? ""), `Ajus${s5}`, { timeout: 15000 }).catch(() => {});
  const txt = await fila.innerText();
  chequear(/vence el día 5 de cada mes/.test(txt) && /tolerancia 4 días/.test(txt) && /no se ve en la página/.test(txt),
    "la fila dice: vence el día 5, tolerancia 4 días, no se ve en la página", txt);

  // Cómo lo ve el socio.
  await fila.locator("[data-vista-abrir]").click();
  const vista = fila.locator("[data-vista-previa]");
  await vista.waitFor({ timeout: 30000 });
  chequear((await vista.innerText()).includes(`Ajus${s5}`) && /12\.000/.test(await vista.innerText()), "“Así lo ve el socio” muestra el nombre y el precio", await vista.innerText());
  await vista.locator('button:has-text("Cerrar")').click();

  // Orden: el segundo sube y queda antes.
  const nombres = async () => d.locator('li[data-plan]').evaluateAll((els) => els.map((e) => e.getAttribute("data-plan")));
  const antes = await nombres();
  await d.locator(`li[data-plan="Orden${s5}"] button[aria-label="Subir Orden${s5}"]`).click();
  await d.waitForFunction(([a, o]) => { const n = [...document.querySelectorAll("li[data-plan]")].map((e) => e.getAttribute("data-plan")); return n.indexOf(o) < n.indexOf(a); }, [`Ajus${s5}`, `Orden${s5}`], { timeout: 30000 });
  ok(`el orden cambia: ${antes.indexOf(`Ajus${s5}`)} → después de subir Orden${s5} queda antes`);

  // Servicio adicional: crear, asignar a un socio nuevo, y la cuota lo trae.
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Servi${s5}`);
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Solo dar de alta")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
  const id = d.url().split("/").pop();

  await d.goto(`${G}/panel/planes`);
  await d.locator('input[aria-label="Servicio nuevo"]').fill(`Locker${s5}`);
  await d.locator('input[aria-label="Precio del servicio por mes"]').fill("3.000");
  await d.locator('button:has-text("Agregar servicio")').click();
  const serv = d.locator(`li[data-servicio="Locker${s5}"]`);
  await serv.waitFor({ timeout: 30000 });
  await serv.locator('button:has-text("Asignar")').click();
  await serv.locator('input[aria-label^="Buscar socio"]').fill(`Servi${s5}`);
  await serv.locator("button.fila", { hasText: `Servi${s5}` }).click();
  await serv.locator(`[data-servicio-socio^="Servi${s5}"]`).waitFor({ timeout: 30000 });
  ok("el servicio quedó asignado: aparece el socio con su ✕ para quitarlo");

  // Cobrar: la cuota trae el servicio sumado.
  await d.goto(`${G}/panel/vender?socio=${id}&cuota=1`);
  await d.getByText(/^Cuota /).first().waitFor({ timeout: 30000 });
  const ticket = d.locator("aside[data-carrito]");
  await ticket.getByText(`Locker${s5} (servicio)`).waitFor({ timeout: 30000 });
  chequear(/3\.000/.test(await ticket.innerText()), "el ticket trae el Locker de $3.000 junto con la cuota", await ticket.innerText());
  await capturar(d, "vd17-compu-cobrar");
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await d.locator('button:has-text("Cobrar")').click();
  await esperarCobro(d);
  ok("cobrada la cuota con el servicio");

  // Quitar el servicio: la próxima cuota ya no lo trae.
  await d.goto(`${G}/panel/planes`);
  await d.locator(`li[data-servicio="Locker${s5}"] button[aria-label^="Quitarle"]`).click();
  await d.locator(`li[data-servicio="Locker${s5}"] [data-servicio-socio]`).waitFor({ state: "detached", timeout: 30000 });
  ok("se le quitó el servicio");

  // Celular: sin desbordes.
  const m = await pagina(b, CELU);
  await entrar(m, "duena@ejemplo.invalid");
  await m.goto(`${G}/panel/planes`);
  await m.locator(`li[data-plan="Ajus${s5}"]`).waitFor({ timeout: 30000 });
  await m.locator(`li[data-plan="Ajus${s5}"] [data-ajustes-abrir]`).click();
  await capturar(m, "vd17-celu-ajustes");
  const ancho = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  chequear(ancho <= 1, "celular 390 px: Planes con los ajustes abiertos no se desborda", `desborda ${ancho}px`);
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
