#!/usr/bin/env node
// VD-2 · Todas las situaciones del veredicto con su texto y su botón: tres colores
// (verde, amarillo, rojo) en la ventana de Entrada y en la pantalla de Entrada de
// siempre: cuánto le falta, “lo que hay que decirle” en una línea y el botón
// principal que corresponde. Las 25 situaciones de la tabla están en la prueba
// de la base (supabase/pruebas/guia-entrada.test.mjs).
//   node scripts/e2e/vd-2.mjs     (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();

async function primero(p, estado) {
  await p.goto(`${G}/panel/socios?estado=${estado}`);
  // El vencido de "Plan Full" (24 h): uno de "Plan Mañana" a la noche sale rojo por fuera de horario y la guía propone "Dejar pasar", no Cobrar.
  const a = p.locator('main ul a[href^="/panel/socios/"]', estado === "vencidos" ? { hasText: "Plan Full" } : {}).first();
  await a.waitFor({ timeout: 30000 });
  return (await a.locator(".font-semibold").first().innerText()).replace(/#\d+/, "").trim();
}

try {
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  const verde = await primero(r, "al_dia"), amarillo = await primero(r, "por_vencer"), rojo = await primero(r, "vencidos");

  const abrirCon = async (nombre) => {
    await r.goto(`${G}/panel/socios`);
    await r.locator('main ul a[href^="/panel/socios/"]').first().waitFor({ timeout: 30000 });
    await r.keyboard.press("F2");
    const campo = r.locator("[data-ventana-campo]");
    await campo.waitFor({ timeout: 10000 });
    await campo.fill(nombre);
    await r.locator("button.fila", { hasText: nombre }).first().click();
    const ver = r.locator("[data-ventana-veredicto]");
    await ver.waitFor({ timeout: 30000 });
    await r.locator("[data-ventana-decile]").waitFor({ timeout: 30000 });
    return ver;
  };

  // Verde: se anota, y la base dice qué decirle.
  let ver = await abrirCon(verde);
  chequear(await ver.getAttribute("data-ventana-veredicto") === "verde" && await r.locator("[data-ventana-anotar]").isVisible(), `verde (${verde}): botón Anotar`, "el verde no tiene Anotar");
  chequear((await r.locator("[data-ventana-decile]").innerText()).length > 10, "verde: hay una línea de “lo que hay que decirle”", "sin decile");
  await capturar(r, "vd2-compu-verde");
  await r.keyboard.press("Escape");

  // Amarillo (vence pronto): cuánto le falta + qué decirle; puede anotar y cobrar.
  ver = await abrirCon(amarillo);
  const colorA = await ver.getAttribute("data-ventana-veredicto");
  chequear(["amarillo", "naranja"].includes(colorA), `amarillo (${amarillo}): ${colorA}`, `el “por vencer” salió ${colorA}`);
  chequear(await r.locator("[data-ventana-falta]").count() === 1, "amarillo: dice cuánto le falta", "no dice cuánto le falta");
  chequear(await r.locator("[data-ventana-anotar]").isVisible() && await r.locator("[data-ventana-cobrar]").isVisible(), "amarillo: puede anotar y cobrar", "faltan botones");
  await capturar(r, "vd2-compu-amarillo");
  await r.keyboard.press("Escape");

  // Rojo: el botón principal es Cobrar, con cuánto, y no hay Anotar.
  ver = await abrirCon(rojo);
  chequear(await ver.getAttribute("data-ventana-veredicto") === "rojo", `rojo (${rojo})`, "el vencido no salió rojo");
  const cobrar = r.locator("[data-ventana-cobrar]");
  chequear((await cobrar.getAttribute("class"))?.includes("boton-principal") === true, "rojo: Cobrar es el botón principal", "Cobrar no es el principal");
  chequear(/Cobrale|primer pago|plan/i.test(await r.locator("[data-ventana-decile]").innerText()), "rojo: la línea dice qué hacer (“Cobrale…”)", "el decile del rojo no dice qué hacer");
  chequear(await r.locator("[data-ventana-anotar]").count() === 0, "rojo: no ofrece Anotar", "ofrece Anotar a alguien que no puede entrar");
  chequear(await r.locator("[data-ventana-dejar]").count() === 1, "rojo: se puede dejar pasar (con motivo)", "falta Dejar pasar");
  await capturar(r, "vd2-compu-rojo");
  await r.keyboard.press("Escape");

  // La pantalla de Entrada de siempre muestra lo mismo.
  await r.goto(`${G}/panel/entrada`);
  const buscar = r.locator('input[aria-label="Buscar socio"]');
  await buscar.fill(rojo);
  await r.locator("button.fila", { hasText: rojo }).first().click();
  await r.locator("[data-decile]").waitFor({ timeout: 30000 });
  ok("la pantalla de Entrada también dice qué hacer");

  if (r.errores.length) falla(`errores en la página: ${r.errores.join(" | ")}`);
} finally {
  await b.close();
}
resultado();
