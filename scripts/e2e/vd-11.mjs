#!/usr/bin/env node
// VD-11 · Menú nuevo y redirecciones: cada rol ve su menú con los nombres
// nuevos y en el orden del doc 03 §1; el encargado sin permiso no ve Gastos;
// cada ruta vieja sigue abriendo (o redirige); los accesos rápidos siguen
// llevando a su pantalla; Ctrl+K encuentra por el nombre viejo y el nuevo;
// en el celular (390 px) el menú abre y no desborda.
//   node scripts/e2e/vd-11.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, PANTALLA_ROTA, capturar, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
// Las rutas viejas del panel que tienen que seguir andando (espejo de src/lib/panel/rutas.ts RUTAS_VIEJAS).
const VIEJAS = ["/panel/tareas", "/panel/avisos", "/panel/vencen-hoy", "/panel/retencion", "/panel/prospectos", "/panel/vender", "/panel/planes",
  "/panel/resumen", "/panel/resultado", "/panel/transferencias", "/panel/caja", "/panel/clases", "/panel/entrada", "/panel/socios", "/panel/rutinas", "/panel/eventos"];
const SIN_PERMISO = /No tenés acceso|Tu rol no tiene acceso|Sin permiso|no tiene acceso/i;

/** Los links del menú lateral (compu), en orden: [{ href, texto }]. */
const menu = (p) => p.locator('aside nav[aria-label="Secciones"] a').evaluateAll((as) => as.map((a) => ({ href: a.getAttribute("href"), texto: a.innerText.split("\n")[0].trim() })));
const hrefs = (m) => m.map((x) => x.href);

const b = await navegador();
try {
  // ── Dueña: nombres nuevos, orden y grupos ─────────────────────────
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  await d.locator('aside nav[aria-label="Secciones"]').waitFor({ timeout: 30000 });
  const md = await menu(d);
  const titulo = (href) => md.find((x) => x.href === href)?.texto;
  chequear(titulo("/panel/tareas") === "Para hacer hoy", "Tareas ahora es “Para hacer hoy”", `dice “${titulo("/panel/tareas")}”`);
  chequear(titulo("/panel/vencen-hoy") === "Vencen y cobrar", "Vencen hoy ahora es “Vencen y cobrar”", `dice “${titulo("/panel/vencen-hoy")}”`);
  chequear(titulo("/panel/vender") === "Productos y stock", "Vender ahora es “Productos y stock”", `dice “${titulo("/panel/vender")}”`);
  chequear(titulo("/panel/prospectos") === "Interesados", "Prospectos ahora es “Interesados”", `dice “${titulo("/panel/prospectos")}”`);
  chequear(titulo("/panel/retencion") === "Retención y números", "Retención ahora es “Retención y números”", `dice “${titulo("/panel/retencion")}”`);
  chequear(titulo("/panel/planes") === "Planes y servicios", "Planes y precios ahora es “Planes y servicios”", `dice “${titulo("/panel/planes")}”`);
  chequear(!!titulo("/panel/control") && !!titulo("/panel/gastos") && !!titulo("/panel/resultado"), "la dueña ve Control, Gastos y Resultado", "falta Control, Gastos o Resultado");
  const orden = ["/panel/entrada", "/panel/tareas", "/panel/vencen-hoy", "/panel/socios", "/panel/prospectos", "/panel/retencion", "/panel/caja", "/panel/vender", "/panel/control", "/panel/planes", "/panel/configuracion"];
  const pos = orden.map((r) => hrefs(md).indexOf(r));
  chequear(pos.every((x) => x >= 0) && pos.every((x, i) => i === 0 || x > pos[i - 1]), "el orden es el del doc: Hoy, Socios, Plata, Gimnasio", `posiciones ${pos.join(",")}`);
  await capturar(d, "vd-11-menu-compu");

  // ── Las rutas viejas siguen abriendo ──────────────────────────────
  for (const ruta of VIEJAS) {
    const r = await d.goto(`${G}${ruta}`).catch(() => null);
    const texto = await d.locator("body").innerText().catch(() => "");
    const sano = r && r.status() < 400 && !PANTALLA_ROTA.test(texto) && !SIN_PERMISO.test(texto) && new URL(d.url()).pathname.startsWith("/panel");
    chequear(sano, `la ruta vieja ${ruta} abre (${new URL(d.url()).pathname})`, `${ruta} no abre: HTTP ${r?.status()} en ${d.url()}`);
  }

  // ── Accesos rápidos: siguen llevando a su pantalla ────────────────
  await d.goto(`${G}/panel`);
  const grilla = d.locator('section[aria-label="Accesos rápidos"] a');
  await grilla.first().waitFor({ timeout: 30000 });
  const accesos = await grilla.evaluateAll((as) => as.map((a) => ({ href: a.getAttribute("href"), texto: a.innerText.trim() })));
  const vender = accesos.find((a) => a.href === "/panel/vender");
  chequear(!vender || /Productos y stock/.test(vender.texto), "el acceso rápido a Vender sigue yendo a /panel/vender con el nombre nuevo", `acceso: ${JSON.stringify(vender)}`);
  chequear(accesos.length > 0 && accesos.every((a) => a.href?.startsWith("/panel")), "todos los accesos rápidos llevan a una pantalla del panel", JSON.stringify(accesos));

  // ── Ctrl+K: el nombre nuevo y el viejo encuentran lo mismo ────────
  for (const [consulta, href] of [["vencen hoy", "/panel/vencen-hoy"], ["prospectos", "/panel/prospectos"], ["vender", "/panel/vender"], ["planes y precios", "/panel/planes"], ["interesados", "/panel/prospectos"], ["productos y stock", "/panel/vender"]]) {
    await d.goto(`${G}/panel`);
    await d.keyboard.press("Control+k");
    await d.locator('input[placeholder*="ección"]').first().fill(consulta);
    const hay = await d.locator(`[role="dialog"][aria-label="Buscar"] a[href="${href}"]:visible`).count();
    chequear(hay > 0, `Ctrl+K con “${consulta}” encuentra ${href}`, `Ctrl+K con “${consulta}” no muestra ${href}`);
    await d.keyboard.press("Escape");
  }

  // ── Cada rol ve su menú ───────────────────────────────────────────
  const roles = {
    encargado: { tiene: ["/panel/entrada", "/panel/tareas", "/panel/vencen-hoy", "/panel/vender", "/panel/planes"], no: ["/panel/gastos"], porQue: "sin permiso de Gastos" },
    recepcion: { tiene: ["/panel/entrada", "/panel/tareas", "/panel/vencen-hoy", "/panel/prospectos", "/panel/vender", "/panel/caja"], no: ["/panel/control", "/panel/gastos", "/panel/resultado", "/panel/planes", "/panel/equipo", "/panel/configuracion"], porQue: "recepción" },
    profe: { tiene: ["/panel/clases", "/panel/tareas", "/panel/rutinas"], no: ["/panel/vencen-hoy", "/panel/vender", "/panel/socios", "/panel/control", "/panel/gastos", "/panel/planes", "/panel/prospectos"], porQue: "profe" },
  };
  for (const [rol, esperado] of Object.entries(roles)) {
    const p = await pagina(b, COMPU);
    await entrar(p, `${rol}@ejemplo.invalid`);
    await p.goto(`${G}/panel`);
    await p.locator('aside nav[aria-label="Secciones"]').waitFor({ timeout: 30000 });
    const m = hrefs(await menu(p));
    const falta = esperado.tiene.filter((r) => !m.includes(r));
    const sobra = esperado.no.filter((r) => m.includes(r));
    chequear(!falta.length, `${rol}: ve las secciones que le tocan`, `${rol}: le faltan ${falta.join(", ")}`);
    chequear(!sobra.length, `${rol}: no ve ${esperado.no.join(", ")} (${esperado.porQue})`, `${rol}: ve lo que no debe: ${sobra.join(", ")}`);
    await p.context().close();
  }

  // ── Celular (390 px): la barra de abajo y el menú ─────────────────
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel`);
  const barra = c.locator('nav[aria-label="Principales"]');
  await barra.waitFor({ timeout: 30000 });
  const etiquetas = await barra.locator("a, button").allInnerTexts();
  chequear(etiquetas.length === 5, "la barra de abajo tiene Inicio, tres principales y Menú", `etiquetas: ${etiquetas.join(" | ")}`);
  chequear(etiquetas.some((t) => /Productos/.test(t)) && !etiquetas.some((t) => /Productos y stock/.test(t)), "“Productos” entra en la barra de abajo con su nombre corto", `etiquetas: ${etiquetas.join(" | ")}`);
  await barra.locator("button", { hasText: "Menú" }).click();
  const hoja = c.locator('[role="dialog"][aria-label="Menú"]');
  await hoja.waitFor({ timeout: 10000 });
  const textoMenu = await hoja.innerText();
  chequear(["Para hacer hoy", "Vencen y cobrar", "Productos y stock", "Control", "Interesados"].every((t) => textoMenu.includes(t)), "el menú del celular tiene los nombres nuevos", textoMenu.slice(0, 200));
  chequear(await c.evaluate(() => document.documentElement.scrollWidth) <= CELU.width + 1, "el menú del celular no desborda a lo ancho", "se desborda a lo ancho");
  await capturar(c, "vd-11-menu-celu");
  await hoja.locator('a[href="/panel/vencen-hoy"]').click();
  await c.waitForURL((u) => u.pathname === "/panel/vencen-hoy", { timeout: 30000 });
  ok("desde el menú del celular se llega a Vencen y cobrar");
} finally {
  await b.close().catch(() => {});
}
resultado();
