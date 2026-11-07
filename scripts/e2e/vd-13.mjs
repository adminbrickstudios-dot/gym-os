#!/usr/bin/env node
// VD-13 · Para hacer hoy: las automáticas se calculan y salen solas al resolverse (cobrar desde la tarea
// saca a esa persona de la lista, con la hoja Cobrar), el checklist de apertura y cierre, las manuales
// que se repiten, prender/apagar una automática, /panel/hoy redirige y el profe no ve la plata.
//   node scripts/e2e/vd-13.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const s5 = Date.now().toString().slice(-5);
const b = await navegador();
const lista = (p) => p.locator('[data-automatica="vencen_hoy"] [data-automatica-socio]');
try {
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");

  // ── 1 · La pantalla de siempre, ahora "Para hacer hoy"; /panel/hoy lleva ahí ──
  await d.goto(`${G}/panel/hoy`);
  await d.locator("h1", { hasText: "Para hacer hoy" }).waitFor({ timeout: 60000 });
  chequear(new URL(d.url()).pathname === "/panel/tareas", "/panel/hoy lleva a Para hacer hoy (la ruta de siempre es /panel/tareas)", `quedó en ${d.url()}`);
  await d.locator("[data-hoy-automaticas]").waitFor({ timeout: 30000 });
  await capturar(d, "vd13-compu-hoy");

  // ── 2 · Cobrar desde la tarea saca a esa persona de la lista ──
  const filas = lista(d);
  if (!(await aparece(filas, 15000))) {
    falla("no hay nadie que venza hoy en el demo (¿se sembró el caso “Testigo Vence Hoy”?)");
  } else {
    const antes = await filas.count();
    const testigo = filas.filter({ hasText: /Vence Hoy/ });
    const fila = (await testigo.count()) ? testigo.first() : filas.first();
    const socioId = await fila.getAttribute("data-automatica-socio");
    const cantidadAntes = Number(await d.locator('[data-automatica="vencen_hoy"]').getAttribute("data-cantidad"));
    chequear(cantidadAntes >= antes, `“Cobrarle a los que vencen hoy” trae su dato (${cantidadAntes}) y a quién`, "la tarjeta no trae cantidad");
    await fila.getByRole("link", { name: /Cobrar/ }).click();
    await d.locator('[data-cobrar][data-estado="listo"]').waitFor({ timeout: 30000 });
    await d.locator("[data-cobrar-linea=cuota]").waitFor({ timeout: 30000 });
    ok("“💵 Cobrar” de la tarea abre la hoja Cobrar con la cuota (VD-5)");
    const transf = d.locator('[data-cobrar-medio="transferencia"]:not([disabled])');
    if (await transf.count()) await transf.click();
    await d.locator("[data-cobrar-confirmar]").click();
    await d.locator("[data-cobrar-volver]").waitFor({ timeout: 30000 });
    await d.locator("[data-cobrar-volver]").click();
    await d.locator(`[data-automatica-socio="${socioId}"]`).waitFor({ state: "detached", timeout: 30000 }).then(
      () => ok("cobró: esa persona salió sola de “vencen hoy”"),
      () => falla("después de cobrar, la persona sigue en la lista"));
  }

  // ── 3 · El checklist: la dueña lo arma, la recepción lo tilda ──
  const item = `Prender los aires ${s5}`;
  const nuevo = d.locator("[data-checklist-nuevo]");
  await nuevo.locator("input").fill(item);
  await nuevo.locator('button[type="submit"]').click();
  await d.locator("[data-checklist-item]", { hasText: item }).waitFor({ timeout: 30000 });
  ok("la dueña suma “Prender los aires” al checklist de apertura");

  // ── 4 · Una manual que se repite: al tildarla nace la siguiente ──
  const que = `Limpiar espejos ${s5}`;
  await d.getByRole("button", { name: /Nueva tarea/ }).click();
  const form = d.locator("[data-nueva-tarea]");
  await form.locator("input").first().fill(que);
  await form.locator("select[data-repite]").selectOption("semanal");
  const ana = await form.locator("select").first().locator("option", { hasText: "Ana" }).first().getAttribute("value");
  await form.locator("select").first().selectOption(ana);
  await form.locator('button[type="submit"]').click();
  await form.getByText("Tarea anotada").waitFor({ timeout: 30000 });
  ok("tarea manual “todas las semanas” anotada para Ana");

  // ── 5 · Prender/apagar una automática ──
  const cfg = d.locator('[data-config-auto="cumpleanos"]');
  await d.locator("[data-config-automaticas] summary").click();
  await cfg.waitFor({ timeout: 30000 });
  const estaba = await cfg.locator("[data-config-activa]").isChecked();
  await cfg.locator("[data-config-activa]").setChecked(!estaba);
  await cfg.getByRole("button", { name: /Guardar/ }).click();
  await cfg.getByText("Guardado.").waitFor({ timeout: 30000 });
  await d.reload();
  chequear(await d.locator('[data-automatica="cumpleanos"]').count() === 0 || !estaba, "apagada una automática, deja de aparecer", "la automática apagada sigue en la lista");
  await d.locator("[data-config-automaticas] summary").click();
  const cfg2 = d.locator('[data-config-auto="cumpleanos"]');
  await cfg2.locator("[data-config-activa]").setChecked(estaba);
  await cfg2.getByRole("button", { name: /Guardar/ }).click();
  await cfg2.getByText("Guardado.").waitFor({ timeout: 30000 });
  ok("la configuración vuelve a como estaba");

  // ── 6 · La recepción, en el celular: checklist y tarea repetida, sin desbordes ──
  const r = await pagina(b, CELU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/tareas`);
  await r.locator("h1", { hasText: "Para hacer hoy" }).waitFor({ timeout: 60000 });
  const fi = r.locator("[data-checklist-item]", { hasText: item });
  chequear(await aparece(fi, 30000), "la recepción ve el checklist que armó la dueña", "la recepción no ve el ítem");
  await fi.getByRole("button", { name: /Marcar hecho/ }).click();
  await r.locator('[data-checklist-item="hecho"]', { hasText: item }).waitFor({ timeout: 30000 });
  ok("la recepción tilda “Prender los aires” desde el celular");
  const tarea = r.locator("[data-tarea]", { hasText: que });
  await tarea.getByRole("button", { name: /Marcar hecha/ }).click();
  await r.locator('[data-tarea="hecha"]', { hasText: que }).waitFor({ timeout: 30000 });
  const ancho = await r.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width + 1, "celular 390 px sin desbordes", `se desborda: ${ancho}px`);
  chequear(await r.locator('[data-config-automaticas]').count() === 0, "la recepción no ve la configuración de las automáticas", "la recepción ve la configuración");
  chequear(!/\$\s?\d/.test(await r.locator("[data-hoy-automaticas]").innerText()), "las tarjetas de la recepción no muestran plata", "hay plata en las tarjetas");
  await capturar(r, "vd13-celu-hoy", true);

  await d.goto(`${G}/panel/tareas?todas=1`);
  const filasQue = d.locator("[data-tarea]", { hasText: que });
  await filasQue.first().waitFor({ timeout: 30000 });
  chequear(await filasQue.count() === 2 && await d.locator('[data-tarea="hecha"]', { hasText: que }).count() === 1, "al tildar la semanal nació la siguiente (una hecha y una pendiente)", `hay ${await filasQue.count()} filas`);

  // ── 7 · El profe no ve las automáticas ──
  const pf = await pagina(b, COMPU);
  await entrar(pf, "profe@ejemplo.invalid");
  await pf.goto(`${G}/panel/tareas`);
  await pf.locator("h1", { hasText: "Para hacer hoy" }).waitFor({ timeout: 60000 }).catch(() => {});
  chequear(await pf.locator("[data-hoy-automaticas], [data-checklist]").count() === 0, "el profe no ve las automáticas ni el checklist", "el profe ve las automáticas");

  for (const p of [d, r, pf]) if (p.errores.length) falla(p.errores.join(" | "));
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
