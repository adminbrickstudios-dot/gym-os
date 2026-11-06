#!/usr/bin/env node
// VD-16 · Retención y números: los números del período (churn general y a 90 días, ingreso por socio,
// asistencia, mapa de calor), cada uno con su "¿Qué es esto?"; el período cambia lo que se ve y el rango;
// "Exportar a Excel" baja un CSV del mismo período; la recepción no ve los números ni puede exportar; celular.
//   node scripts/e2e/vd-16.mjs     (con scripts/local/levantar.sh corriendo)
// El pedido del CSV va desde el navegador: *.localhost no siempre resuelve desde Node.
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const bajar = (p, url) => p.evaluate(async (u) => { const r = await fetch(u); return { status: r.status, ok: r.ok, tipo: r.headers.get("content-type") ?? "", texto: await r.text(), cd: r.headers.get("content-disposition") ?? "" }; }, url);
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/retencion`);
  const sec = d.locator("[data-numeros-periodo]");
  await sec.waitFor({ timeout: 60000 });
  chequear(await sec.getAttribute("data-numeros-periodo") === "mes", "por defecto, este mes", "no arranca en este mes");
  const claves = ["activos", "altas_bajas", "churn", "churn90", "ingreso", "visitas", "pocas"];
  for (const c of claves) chequear(await sec.locator(`[data-numero-periodo="${c}"] [data-valor]`).count() === 1, `número “${c}” con su cifra`, `falta ${c}`);
  chequear(await sec.locator("[data-numero-periodo] details").count() >= claves.length, "cada número con su “¿Qué es esto?”", "faltan explicaciones");
  chequear(await sec.locator("[data-calor]").count() === 1, "el mapa de calor", "falta el mapa de calor");
  chequear(/%|—/.test(await sec.locator('[data-numero-periodo="churn"] [data-valor]').innerText()), "el churn es un porcentaje (o — si no había socios al empezar)", "el churn no es un porcentaje");
  const rango0 = await sec.locator("[data-rango]").innerText();

  // El período cambia lo que se ve.
  await sec.locator('[data-periodo="12"]').click();
  await d.waitForURL(/periodo=12/, { timeout: 30000 });
  await d.locator('[data-numeros-periodo="12"]').waitFor({ timeout: 30000 });
  const rango12 = await d.locator("[data-rango]").innerText();
  chequear(rango12 !== rango0 && /^Del 01\/\d\d\/\d{4} al \d\d\/\d\d\/\d{4}$/.test(rango12), `12 meses: “${rango12}” (antes “${rango0}”)`, `el rango no cambió: ${rango12}`);
  chequear(await d.locator('[data-periodo="12"]').getAttribute("aria-current") === "page", "el período elegido queda marcado", "no queda marcado");
  await d.locator('[data-periodo="mes_pasado"]').click();
  await d.locator('[data-numeros-periodo="mes_pasado"]').waitFor({ timeout: 30000 });
  chequear(/al \d\d\/\d\d\/\d{4}$/.test(await d.locator("[data-rango]").innerText()), "mes pasado: otro rango", "mes pasado sin rango");
  await capturar(d, "vd16-compu-numeros");

  // Exportar el período elegido.
  const href = await d.locator("[data-exportar]").getAttribute("href");
  chequear(/periodo=mes_pasado/.test(href ?? ""), "“Exportar a Excel” lleva el período elegido", `href: ${href}`);
  const r = await bajar(d, `${G}${href}`);
  const csv = r.texto.replace(/^﻿/, "");
  chequear(r.ok && /text\/csv/.test(r.tipo) && csv.startsWith("Número;Valor;Detalle") && /Churn general %/.test(csv) && /Churn 90 días %/.test(csv) && /Ingreso por socio/.test(csv) && /mes_pasado\.csv/.test(r.cd),
    `el CSV baja con los números (${csv.trim().split("\n").length - 1} filas)`, `${r.status} ${csv.slice(0, 100)}`);
  const mal = await bajar(d, `${G}/panel/retencion/exportar?periodo=cualquiera`);
  chequear(mal.status === 400, "un período inventado: 400, no un archivo vacío", `${mal.status}`);

  // La recepción: sin los números ni la exportación.
  const rec = await pagina(b, COMPU);
  await entrar(rec, "recepcion@ejemplo.invalid");
  await rec.goto(`${G}/panel/retencion`);
  await rec.locator("main h1").waitFor({ timeout: 60000 });
  chequear(await rec.locator("[data-numeros-periodo]").count() === 0, "la recepción no ve los números del período (hay plata)", "la recepción ve los números");
  const x = await bajar(rec, `${G}/panel/retencion/exportar?periodo=mes`);
  chequear(x.status === 403 && /No se pudo exportar/.test(x.texto), "la recepción: 403 “No se pudo exportar…”", `${x.status}`);

  // Celular.
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/retencion?periodo=3`);
  await c.locator("[data-numeros-periodo]").waitFor({ timeout: 60000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= 392, `celular: sin desborde (${ancho}px)`, `celular: desborda (${ancho}px)`);
  await capturar(c, "vd16-celu-numeros");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
