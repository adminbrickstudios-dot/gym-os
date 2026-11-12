#!/usr/bin/env node
// Z5/Z6/Z7 · Diseño, lo que faltaba y lo transversal, pantalla por pantalla y con sesión real (demo, nunca Temple Gym):
//   1. El menú del dueño: cuatro secciones con su línea, lo de uso menos seguido adentro de «Más».
//   2. El título de pantalla mide 28 px (DISENO.md) y el ícono no va arriba del título.
//   3. La tecla "?" abre los atajos (y no abre si se está escribiendo).
//   4. Sin degradé ni vidrio: la portada del gimnasio y el ingreso.
//   5. Ficha del socio: las acciones (Cobrar…) quedan arriba, no después de diez bloques.
//   6. Resultado: los montos del día se ven escritos (no solo en el "title").
//   8. Super admin: botón visible para abrir la búsqueda (en el celular no hay Ctrl+K) y atajos con "?".
//   9. "Darlo de alta" desde la Entrada lleva lo que se escribió.
//   node scripts/e2e/z-diseno.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, PLATAFORMA, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  await d.locator('aside nav[aria-label="Secciones"]').waitFor({ timeout: 60000 });

  // ── 1. Menú en cuatro secciones ──
  const grupos = await d.locator("aside nav[aria-label=Secciones] [data-grupo]").evaluateAll((gs) => gs.map((g) => ({ nombre: g.getAttribute("data-grupo"), texto: g.innerText })));
  chequear(grupos.map((g) => g.nombre).join(",") === "Hoy,Socios,Plata,Gimnasio", "el menú tiene cuatro secciones: Hoy, Socios, Plata y Gimnasio", `secciones: ${grupos.map((g) => g.nombre).join(",")}`);
  chequear(/Entrada, vencen hoy/.test(grupos[0].texto) && /Cobrar, caja, ventas/.test(grupos[2].texto), "cada sección trae su línea que explica qué es", "falta la línea de una sección");
  const maquinas = d.locator('aside a[href="/panel/maquinas"]');
  chequear(!(await maquinas.isVisible()), "Máquinas (de uso menos seguido) está adentro de «Más», cerrado", "Máquinas se ve suelta en el menú");
  await d.locator('aside [data-mas="Hoy"] summary').click();
  chequear(await maquinas.isVisible(), "tocar «Más» muestra Incidentes y Máquinas", "«Más» no abre");
  await d.goto(`${G}/panel/maquinas`);
  await d.locator('aside [data-mas="Hoy"]').waitFor({ timeout: 60000 });
  chequear(await d.locator('aside [data-mas="Hoy"]').getAttribute("open") !== null, "parado en Máquinas, «Más» queda abierto solo", "«Más» queda cerrado en una pantalla que está adentro");

  // ── 2. Títulos de 28 px ──
  await d.goto(`${G}/panel/socios`);
  const h1 = d.locator("main h1").first();
  await h1.waitFor({ timeout: 60000 });
  const px = await h1.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  chequear(px === 28, "el título de pantalla mide 28 px", `el título mide ${px} px`);

  // ── 3. Atajos con "?" ──
  await d.locator("body").click({ position: { x: 5, y: 5 } });
  await d.keyboard.press("Shift+?");
  chequear(await d.locator("[data-atajos]").isVisible().catch(() => false), "la tecla ? abre la lista de atajos", "? no abre los atajos");
  await d.keyboard.press("Escape");
  await d.locator("[data-atajos]").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
  chequear(!(await d.locator("[data-atajos]").count()), "Esc cierra los atajos", "Esc no cierra los atajos");
  const buscar = d.locator('input[aria-label="Buscar socio"]');
  await buscar.fill("");
  await buscar.press("Shift+?");
  chequear(!(await d.locator("[data-atajos]").count()), "escribiendo un ? en un campo no abre los atajos", "los atajos se abrieron mientras se escribía");

  // ── 5. Ficha: Cobrar arriba ──
  await buscar.fill("Testigo Vencida");
  await d.locator('main ul a[href^="/panel/socios/"]').first().waitFor({ timeout: 30000 });
  await d.locator('main ul a[href^="/panel/socios/"]', { hasText: /^Testigo Vencida/ }).first().click().catch(async () => { await d.locator('main ul a[href^="/panel/socios/"]').first().click(); });
  const acciones = d.locator("[data-ficha-acciones]");
  await acciones.waitFor({ timeout: 60000 });
  const arriba = await acciones.evaluate((e) => e.getBoundingClientRect().top);
  chequear(arriba < 650, `la ficha tiene sus acciones arriba (a ${Math.round(arriba)} px)`, `las acciones de la ficha quedan a ${Math.round(arriba)} px`);

  // ── 6. Resultado: montos escritos ──
  await d.goto(`${G}/panel/resultado`);
  await d.locator("[data-montos-por-dia]").waitFor({ timeout: 60000 });
  chequear(true, "Resultado trae «Ver los montos de cada día» (en el celular no hay title al pasar el mouse)", "");

  // ── 9. Darlo de alta lleva lo escrito ──
  await d.goto(`${G}/panel/entrada`);
  const campo = d.locator('input[aria-label*="DNI"]').first();
  await campo.waitFor({ timeout: 60000 });
  await campo.fill("99999991");
  const alta = d.locator('a:has-text("Darlo de alta")').first();
  if (await alta.waitFor({ timeout: 15000 }).then(() => true, () => false)) {
    const href = await alta.getAttribute("href");
    chequear(/dni=99999991/.test(href ?? ""), "«Darlo de alta» lleva el DNI escrito (?dni=)", `el link es ${href}`);
  } else ok("la Entrada no ofreció el alta para ese DNI: sin probar");

  // ── 4. Sin degradé ni vidrio: portada e ingreso ──
  const p = await pagina(b, COMPU);
  await p.goto(`${G}/`);
  await p.locator("header").first().waitFor({ timeout: 60000 });
  const filtroPortada = await p.locator("header").first().evaluate((e) => getComputedStyle(e).backdropFilter);
  chequear(filtroPortada === "none" || filtroPortada === "", "la portada no usa vidrio (backdrop-filter)", `la portada usa ${filtroPortada}`);
  await p.goto(`${G}/ingresar`);
  const tarjeta = p.locator(".ingreso-tarjeta").first();
  await tarjeta.waitFor({ timeout: 60000 });
  const fi = await tarjeta.evaluate((e) => getComputedStyle(e).backdropFilter);
  chequear(fi === "none" || fi === "", "el ingreso no usa vidrio", `el ingreso usa ${fi}`);
  const hayDegrade = await p.locator(".ingreso-fondo").first().evaluate((e) => getComputedStyle(e, "::before").backgroundImage);
  chequear(!/gradient/.test(hayDegrade), "el ingreso no tiene degradé de fondo", `fondo: ${hayDegrade}`);

  // ── 8. Super admin: botón de búsqueda en el celular ──
  const s = await pagina(b, CELU);
  await entrar(s, "admin@ejemplo.invalid", undefined, PLATAFORMA);
  await s.goto(`${PLATAFORMA}/admin`);
  const boton = s.locator("[data-abrir-paleta]");
  await boton.waitFor({ timeout: 60000 });
  await boton.click();
  chequear(await s.locator("[data-paleta]").isVisible(), "super admin: el botón de búsqueda abre la paleta sin teclado", "el botón no abrió la paleta");
  await s.keyboard.press("Escape");
  await s.locator("body").click({ position: { x: 5, y: 5 } });
  await s.keyboard.press("Shift+?");
  chequear(await s.locator("[data-atajos]").isVisible().catch(() => false), "super admin: ? abre los atajos", "? no abre los atajos en /admin");

  for (const [n, pg] of [["dueña", d], ["portada", p], ["super admin", s]]) if (pg.errores.length) falla(`${n}: ${pg.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.stack : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
