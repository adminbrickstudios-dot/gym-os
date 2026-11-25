#!/usr/bin/env node
// R1 (paneles completos, 19/11) · Cada número de Inicio que se toca abre SU lista, ya filtrada, con nombres.
// La dueña elige los números en tandas de 4 (el selector de Inicio), toca cada uno y mira:
//   · que la ruta sea la lista de ese número (la pestaña de Vencen, el filtro de Socios, la lista de Retención);
//   · que la pestaña o el filtro quede marcado;
//   · que con un número mayor que cero la lista tenga gente (un nombre que lleva a la ficha, o renglones).
// Al final deja la elección como estaba.
//   node scripts/e2e/r1-numeros.mjs     (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
// Lo que se espera de cada número: la ruta, y el elemento que dice que el filtro quedó puesto.
const ESPERADO = {
  a_cobrar: { ruta: "/panel/vencen-hoy?pestana=cobrar", marcado: '[data-pestana="cobrar"][aria-current="page"]' },
  vencen: { ruta: "/panel/vencen-hoy", marcado: '[data-pestana="hoy"][aria-current="page"]' },
  deben: { ruta: "/panel/vencen-hoy?pestana=vencidos", marcado: '[data-pestana="vencidos"][aria-current="page"]' },
  por_vencer: { ruta: "/panel/vencen-hoy?pestana=por_vencer", marcado: '[data-pestana="por_vencer"][aria-current="page"]' },
  plata_riesgo: { ruta: "/panel/retencion?lista=riesgo" },
  no_vienen: { ruta: "/panel/retencion?lista=no_viene" },
  al_dia: { ruta: "/panel/socios?estado=al_dia", marcado: '[data-filtro-estados] [aria-current="page"]' },
  altas_mes: { ruta: "/panel/socios?estado=nuevos", marcado: '[data-filtro-estados] [aria-current="page"]' },
  bajas_mes: { ruta: "/panel/socios?estado=bajas", marcado: '[data-filtro-estados] [aria-current="page"]' },
};
const numeroDe = (t) => Number(String(t).replace(/\$|\s|%/g, "").replace(/\./g, "").replace(",", ".").match(/-?[\d.]+/)?.[0] ?? NaN);

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  await d.locator("[data-numero]").first().waitFor({ timeout: 60000 });
  await d.locator("[data-elegir-numeros] summary").click();
  const marcas = d.locator("[data-elegir-numeros] input[type=checkbox]");
  const todas = await marcas.evaluateAll((l) => l.map((x) => ({ etiqueta: x.getAttribute("aria-label"), marcada: x.checked })));
  const antes = todas.filter((x) => x.marcada).map((x) => x.etiqueta);
  chequear(todas.length >= 8, `la dueña puede elegir entre ${todas.length} números`, `solo hay ${todas.length} números para elegir`);
  await d.locator("[data-elegir-numeros] summary").click();

  const elegir = async (etiquetas) => {
    await d.goto(`${G}/panel`);
    await d.locator("[data-numero]").first().waitFor({ timeout: 60000 });
    await d.locator("[data-elegir-numeros] summary").click();
    for (const x of todas) {
      const m = d.locator(`[data-elegir-numeros] input[aria-label="${x.etiqueta}"]`);
      if (etiquetas.includes(x.etiqueta)) { if (!(await m.isChecked())) await m.check(); } else if (await m.isChecked()) await m.uncheck();
    }
    await d.locator('[data-elegir-numeros] button:has-text("Guardar")').click();
    await d.locator("[data-elegir-numeros] [role=status]").waitFor({ timeout: 30000 });
    await d.reload();
    await d.locator("[data-numero]").first().waitFor({ timeout: 60000 });
  };

  const vistos = new Set();
  for (let i = 0; i < todas.length; i += 4) {
    await elegir(todas.slice(i, i + 4).map((x) => x.etiqueta));
    const enlaces = await d.locator('section[aria-label="Números de hoy"] a[data-numero]').evaluateAll((l) => l.map((a) => ({
      // (25/11) el link vive adentro del <dd> y la etiqueta en el <dt> de la misma tarjeta (el <dl> válido para la accesibilidad).
      clave: a.getAttribute("data-numero"), href: a.getAttribute("href"), valor: a.firstChild?.textContent ?? "",
      etiqueta: a.closest("[data-numero-item]")?.querySelector("[data-numero-etiqueta]")?.textContent?.trim() ?? "" })));
    for (const n of enlaces) {
      if (vistos.has(n.clave)) continue;
      vistos.add(n.clave);
      const esperado = ESPERADO[n.clave];
      if (esperado) chequear(n.href === esperado.ruta, `${n.etiqueta}: lleva a su lista filtrada (${n.href})`, `${n.etiqueta}: lleva a ${n.href} (esperaba ${esperado.ruta})`);
      await d.goto(`${G}${n.href}`);
      await d.locator("main h1").first().waitFor({ timeout: 60000 });
      if (esperado?.marcado) chequear(await d.locator(esperado.marcado).count() >= 1, `${n.etiqueta}: la lista abre con su pestaña o filtro marcado`, `${n.etiqueta}: la lista abre sin el filtro`);
      const valor = numeroDe(n.valor);
      if (valor > 0) {
        await d.locator('main a[href^="/panel/socios/"], main li').first().waitFor({ timeout: 15000 }).catch(() => {});
        const nombres = await d.locator('main a[href^="/panel/socios/"]').count();
        const renglones = await d.locator("main li").count();
        chequear(nombres + renglones > 0, `${n.etiqueta} (${n.valor.trim()}): la lista tiene ${nombres ? `${nombres} nombres` : `${renglones} renglones`}`, `${n.etiqueta} (${n.valor.trim()}): la lista está vacía`);
      } else ok(`${n.etiqueta} (${n.valor.trim() || "0"}): en cero, la lista puede estar vacía`);
      await capturar(d, `r1-compu-${n.clave}`);
    }
  }
  chequear(vistos.size >= 8, `se tocaron ${vistos.size} números distintos`, `solo se tocaron ${vistos.size} números`);
  await elegir(antes);
  ok(`la elección de números quedó como estaba (${antes.length ? antes.join(", ") : "los de siempre"})`);
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${e.message.split("\n")[0]}`);
}
await b.close();
resultado();
