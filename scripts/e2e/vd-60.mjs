#!/usr/bin/env node
// VD-60 (D34) · Grilla de clases y TV de la sala para la recepción y el profe: la abren y la ven; armar la grilla y sacar una TV
// siguen siendo del dueño y el encargado. La recepción pone una TV (da su link). La dueña sí arma y saca.
//   npm run e2e:vd-60            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const SIN = /No tenés acceso|Tu rol no tiene acceso|Sin permiso|no tiene acceso/i;
try {
  for (const [rol, mail] of [["recepción", "recepcion@ejemplo.invalid"], ["profe", "profe@ejemplo.invalid"]]) {
    for (const [tam, vp] of [["compu", COMPU], ["celu", CELU]]) {
      const p = await pagina(b, vp);
      await entrar(p, mail);
      await p.goto(`${G}/panel/clases`);
      chequear(await p.locator('a[href="/panel/clases/grilla"]').count() > 0 && await p.locator('a[href="/panel/clases/tv"]').count() > 0,
        `${rol} · ${tam}: Clases ofrece “Ver la grilla” y “TV de la sala”`, `${rol} · ${tam}: Clases no ofrece la grilla o la TV`);
      await p.goto(`${G}/panel/clases/grilla`);
      await p.locator("main h1, main h2").first().waitFor({ timeout: 30000 });
      const txt = await p.locator("main").innerText();
      chequear(!SIN.test(txt) && /Grilla de la semana/.test(txt), `${rol} · ${tam}: abre la grilla`, `${rol} · ${tam}: la grilla dice sin permiso o no carga`);
      chequear(await p.locator("[data-editar-horario], form:has-text('Agregar a la grilla'), button:has-text('Sacar')").count() === 0,
        `${rol} · ${tam}: la grilla es de solo lectura`, `${rol} · ${tam}: la grilla deja editar`);
      if (tam === "compu") await capturar(p, `vd60-${rol === "profe" ? "profe" : "recepcion"}-grilla`, true);
      await p.goto(`${G}/panel/clases/tv`);
      await p.locator("main").first().waitFor({ timeout: 30000 });
      const tv = await p.locator("main").innerText();
      chequear(!SIN.test(tv) && /TV de la sala/.test(tv), `${rol} · ${tam}: abre la TV de la sala`, `${rol} · ${tam}: la TV dice sin permiso o no carga`);
      chequear(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${rol} · ${tam}: sin desborde`, `${rol} · ${tam}: se desborda`);
      if (rol === "recepción" && tam === "compu") {
        await p.locator("[data-nueva-tv] input").first().fill(`Sala ${Date.now().toString().slice(-4)}`);
        await p.locator("[data-nueva-tv] button[type=submit]").click();
        await p.locator("[data-link-tv]").waitFor({ timeout: 30000 });
        ok("la recepción pone una TV y recibe su link");
        chequear(await p.locator("[data-tv-fila] button:has-text('Sacar')").count() === 0, "la recepción no ve “Sacar” en las TVs", "la recepción ve “Sacar”");
      }
      await p.context().close();
    }
  }
  // La dueña sigue pudiendo todo.
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/clases/grilla`);
  await d.locator("form:has-text('Agregar a la grilla')").waitFor({ timeout: 30000 });
  ok("la dueña sigue armando la grilla");
  await d.goto(`${G}/panel/clases/tv`);
  await d.locator("[data-tv-fila] button:has-text('Sacar')").first().waitFor({ timeout: 30000 });
  ok("la dueña ve “Sacar” en las TVs");
} catch (e) { falla(`se cortó: ${e.message.split("\n")[0]}`); }
finally { await b.close(); resultado(); }
