#!/usr/bin/env node
// SOC-10 · Menores (D10): al poner una fecha de nacimiento de menor aparece
// el adulto responsable (obligatorio); la ficha dice que es menor, muestra al
// responsable y el WhatsApp va a su celular. Un adulto no lo pide.
//   npm run e2e:soc-10           (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, capturar, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s = Date.now().toString().slice(-5);
const anio = new Date().getFullYear();
try {
  const p = await pagina(b, CELU);
  await entrar(p, "recepcion@ejemplo.invalid");
  await p.goto(`${G}/panel/socios/nuevo`);
  await p.locator('input[name="nombre"]').fill(`Menor${s}`);
  await p.locator('input[name="apellido"]').fill("Prueba");
  await p.locator('input[name="fecha_nacimiento"]').fill(`${anio - 30}-03-10`);
  chequear(await p.locator("[data-responsable]").count() === 0, "adulto: no pide responsable", "a un adulto le pide responsable");
  await p.locator('input[name="fecha_nacimiento"]').fill(`${anio - 13}-03-10`);
  await p.locator("[data-responsable]").waitFor({ timeout: 5000 });
  chequear(await p.locator('input[name="responsable_nombre"]').getAttribute("required") !== null, "menor: aparece “Adulto responsable”, obligatorio", "el responsable no es obligatorio");
  await p.locator('input[name="responsable_nombre"]').fill(`Mamá${s}`);
  await p.locator('input[name="responsable_telefono"]').fill(`000 66${s}`);
  await capturar(p, "soc10-celu-alta");
  await p.locator('button:has-text("Dar de alta")').click();
  await p.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}/, { timeout: 30000 });
  await p.locator("h1").waitFor();
  const cabeza = await p.locator("main header").first().innerText();
  chequear(/menor de edad/.test(cabeza), "la ficha dice “menor de edad”", `cabecera: ${cabeza.slice(0, 80)}`);
  chequear(await p.getByText(`Mamá${s} · +54900066${s}`).count() > 0, "Contacto: el responsable con su celular", "no muestra al responsable");
  const wa = await p.locator('a:has-text("WhatsApp")').first().getAttribute("href");
  chequear(wa?.endsWith(`54900066${s}`), `WhatsApp al responsable (${wa})`, `WhatsApp va a ${wa}`);
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular sin desborde (${ancho}px)`, `mide ${ancho}px`);
  if (p.errores.length) falla(`recepción: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
