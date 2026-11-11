#!/usr/bin/env node
// REV-DUENO-1 · "Lo que se edita se ve al toque" y "lo que se cobra aparece en Resultado".
//   1. La recepción cobra una venta de $1.500 y la dueña ve en Resultado que lo cobrado del mes subió.
//   2. La dueña sube un plan en Planes y la página pública del gimnasio ya lo muestra en el orden nuevo
//      (revalidateTag "landing": antes de ordenar_planes la página tardaba hasta 60 s en cambiar).
//   3. La dueña vuelve el plan a su lugar (el demo queda como estaba).
//   4. Clases sin nada ese día: el vacío trae el botón para ir a la grilla.
//   npm run e2e:rev-dueno-1   (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const pesos = (t) => Number(t.replace(/[^\d,]/g, "").replace(",", "."));
const b = await navegador();
let moverAtras = null;
try {
  // ── 1 · Lo cobrado llega a Resultado ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  const cobradoDelMes = async () => {
    await d.goto(`${G}/panel/resultado`);
    const c = d.locator("[data-resultado-cobrado] .numero");
    await c.waitFor({ timeout: 60000 });
    return pesos(await c.innerText());
  };
  const antes = await cobradoDelMes();

  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios?q=${encodeURIComponent("Testigo Al Día")}`);
  const id = (await r.locator('main ul a[href^="/panel/socios/"]').first().getAttribute("href")).split("/").pop();
  await r.goto(`${G}/panel/vender?socio=${id}`);
  await r.locator("main button", { hasText: "Agua 500 ml" }).click();
  await r.locator('button:has-text("Cobrar")').click();
  await esperarCobro(r);
  const despues = await cobradoDelMes();
  chequear(despues - antes >= 1500, `Resultado del mes sube con lo cobrado (${antes} → ${despues})`, `Resultado no cambió: ${antes} → ${despues}`);

  // ── 2 · Subir un plan se ve en la página pública al instante ──
  await d.goto(`${G}/panel/planes`);
  await d.locator("li[data-plan]").first().waitFor({ timeout: 60000 });
  const enPanel = await d.locator("li[data-plan]").evaluateAll((els) => els.filter((e) => !e.className.includes("opacity-55")).map((e) => e.getAttribute("data-plan")));
  const v = await pagina(b, COMPU);
  const planesPublicos = async () => {
    await v.goto(`${G}/`, { waitUntil: "domcontentloaded" });
    if (!(await v.locator("#planes").waitFor({ timeout: 20000 }).then(() => true, () => false))) return [];
    return v.locator('section[aria-labelledby="planes"] ul > li').evaluateAll((els) => els.map((e) => e.innerText));
  };
  const lista = await planesPublicos();
  const visibles = enPanel.filter((n) => lista.some((t) => t.includes(n)));
  if (visibles.length < 2) {
    ok(`el demo muestra ${visibles.length} plan en la página: no se puede probar el orden (se prueba en vd-17 con planes nuevos)`);
  } else {
    // Dos planes consecutivos de la página, en el orden en que la página los muestra.
    const idx = (l, n) => l.findIndex((t) => t.includes(n));
    const ordenados = [...visibles].sort((a, c) => idx(lista, a) - idx(lista, c));
    const [primero, segundo] = ordenados;
    await d.locator(`li[data-plan="${segundo}"] button[aria-label="Subir ${segundo}"]`).click();
    moverAtras = segundo;
    await d.waitForFunction(([a, s]) => { const n = [...document.querySelectorAll("li[data-plan]")].map((e) => e.getAttribute("data-plan")); return n.indexOf(s) < n.indexOf(a); }, [primero, segundo], { timeout: 30000 });
    const nueva = await planesPublicos();
    chequear(idx(nueva, segundo) < idx(nueva, primero), `la página pública ya muestra “${segundo}” antes que “${primero}”`, `la página sigue igual: ${nueva.map((t) => t.split("\n")[0]).join(" | ")}`);
    // ── 3 · Se deja como estaba ──
    await d.locator(`li[data-plan="${segundo}"] button[aria-label="Bajar ${segundo}"]`).click();
    await d.waitForFunction(([a, s]) => { const n = [...document.querySelectorAll("li[data-plan]")].map((e) => e.getAttribute("data-plan")); return n.indexOf(s) > n.indexOf(a); }, [primero, segundo], { timeout: 30000 });
    moverAtras = null;
  }

  // ── 4 · Clases: el día vacío tiene su botón ──
  const sinClases = async () => {
    for (let i = 0; i < 7; i++) {
      const dias = d.locator('nav[aria-label="Día"] a');
      await d.goto(`${G}/panel/clases`);
      await d.locator('nav[aria-label="Día"] a').first().waitFor({ timeout: 60000 });
      await dias.nth(i).click();
      await d.waitForTimeout(1500);
      if (await d.locator("[data-vacio-grilla]").count()) return true;
    }
    return false;
  };
  if (await sinClases()) {
    await d.locator("[data-vacio-grilla]").click();
    await d.waitForURL(/\/panel\/clases\/grilla/, { timeout: 30000 });
    ok("Clases sin nada ese día: el botón lleva a la grilla");
  } else {
    ok("el demo tiene clases los 7 días: el vacío con botón no se pudo ver");
  }
  const errores = [...d.errores, ...r.errores, ...v.errores];
  if (errores.length) falla(`consola: ${errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  if (moverAtras) console.log(`(el plan “${moverAtras}” quedó un lugar más arriba)`);
}
await b.close();
resultado();
