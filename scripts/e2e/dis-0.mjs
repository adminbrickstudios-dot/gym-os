#!/usr/bin/env node
// DIS-0 · Sistema visual común: estados vacíos con acción, números de Inicio que
// llevan a su detalle y mensajes de error con el componente común.
//   npm run e2e:dis-0            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const b = await navegador();
try {
  // Gimnasio sin socios (Box Norte Demo): Socios muestra el vacío con su acción.
  for (const [tam, vp] of [["compu", COMPU], ["celu", CELU]]) {
    const p = await pagina(b, vp);
    await entrar(p, "box@ejemplo.invalid", undefined, GIMNASIO("demo-box"));
    await p.goto(`${GIMNASIO("demo-box")}/panel/socios`);
    const vacio = p.locator(".vacio", { hasText: "Todavía no hay socios" });
    await vacio.waitFor({ timeout: 30000 });
    const alta = vacio.locator('a:has-text("Cargar el primero")');
    chequear(await alta.isVisible(), `${tam}: Socios vacío con “Cargar el primero”`, `${tam}: el vacío de Socios no tiene su acción`);
    await capturar(p, `dis0-${tam}-socios-vacio`, true);
    await alta.click();
    await p.waitForURL(/\/panel\/socios\/nuevo/);
    ok(`${tam}: la acción del vacío lleva al alta`);

    await p.goto(`${GIMNASIO("demo-box")}/panel/socios?q=zzzz-nadie`);
    await p.locator(".vacio", { hasText: "Nadie con" }).waitFor({ timeout: 30000 });
    ok(`${tam}: búsqueda sin resultados con “Darlo de alta”`);

    await p.goto(`${GIMNASIO("demo-box")}/panel/transferencias`);
    await p.locator(".vacio", { hasText: "Nada para revisar" }).waitFor({ timeout: 30000 });
    ok(`${tam}: Transferencias vacío explica qué va a aparecer`);
    await capturar(p, `dis0-${tam}-transferencias-vacio`, true);
    if (p.errores.length) falla(`${tam}: errores en la página: ${p.errores.join(" | ")}`);
    await p.context().close();
  }

  // Gimnasio con datos: los números de Inicio llevan a su detalle.
  const p = await pagina(b);
  await entrar(p, "duena@ejemplo.invalid");
  await p.goto(`${GIMNASIO()}/panel`);
  const numeros = p.locator('section[aria-label="Números de hoy"] a');
  const cuantos = await numeros.count();
  chequear(cuantos === 4, `Inicio: los 4 números se pueden tocar`, `Inicio: ${cuantos} números con link (esperaba 4)`);
  await capturar(p, "dis0-compu-inicio");
  const destinos = [];
  for (let i = 0; i < cuantos; i++) destinos.push(await numeros.nth(i).getAttribute("href"));
  for (const d of destinos) {
    const r = await p.goto(`${GIMNASIO()}${d}`);
    chequear(r.status() < 400, `número → ${d} abre`, `número → ${d} dio ${r.status()}`);
  }

  // Mensaje de error común (login con contraseña mala).
  await p.context().clearCookies();
  await p.goto(`${GIMNASIO()}/ingresar`);
  await p.fill("input[type=email]", "duena@ejemplo.invalid");
  await p.fill("input[type=password]", "mal-mal-mal");
  await p.click("button[type=submit]");
  const error = p.locator(".mensaje.mensaje-error[role=alert]");
  await error.waitFor({ timeout: 30000 });
  await p.waitForTimeout(400); // que termine la animación de entrada antes de la captura
  ok(`error con el componente común: “${(await error.innerText()).replace(/\s+/g, " ").trim()}”`);
  await capturar(p, "dis0-compu-error-ingreso");
  if (p.errores.length) falla(`errores en la página: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${e.message.split("\n")[0]}`);
}
await b.close();
resultado();
