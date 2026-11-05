#!/usr/bin/env node
// REV-2 · Segunda pasada: una semana como dueña, desde el celular, contra la
// tabla "Dueño" de docs/producto/10-DIA-A-DIA-Y-CASOS-RAROS.md: mira Inicio y
// el resumen, contrata a alguien (contraseña por WhatsApp) y le saca el
// acceso, prepara un aumento, publica una novedad, abre la campaña, mira
// Resultado contra el mes anterior y baja el mes para el contador. Ninguna
// pantalla se desborda a lo ancho. Lo que falta se escribe como "ℹ️ falta".
//   npm run e2e:rev-2            (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const s = Date.now().toString().slice(-5);
const falta = (m) => console.log(`ℹ️ falta: ${m}`);
const b = await navegador();
const d = await pagina(b, CELU);
d.setDefaultNavigationTimeout(120000);
const ancho = async (que) => {
  const w = await d.evaluate(() => document.documentElement.scrollWidth);
  if (w > CELU.width + 1) falla(`${que}: se desborda a lo ancho (${w}px)`);
};
try {
  // Lunes: Inicio y el resumen ("¿me roban?").
  await entrar(d, "duena@ejemplo.invalid");
  await d.locator("main dl").first().waitFor({ timeout: 60000 });
  const numeros = await d.locator("main dl").first().locator("dt").count();
  chequear(numeros === 4, "Inicio: los 4 números grandes con su etiqueta", `Inicio tiene ${numeros} números`);
  await ancho("Inicio");
  await d.goto(`${G}/panel/resumen`);
  await d.getByRole("link", { name: "Esta semana" }).click();
  await d.waitForURL(/semana=\d{4}-\d{2}-\d{2}/, { timeout: 30000 });
  await d.locator("[data-resumen-numeros]").waitFor({ timeout: 60000 });
  ok("¿le roban?: el resumen de la semana con sus números y lo que hay que mirar");
  await ancho("Resumen");

  // Martes: contrata a alguien y le manda la contraseña por WhatsApp.
  await d.goto(`${G}/panel/equipo`);
  const form = d.locator("form", { hasText: "Sumar a alguien" });
  await form.waitFor({ timeout: 60000 });
  const NOMBRE = `Nueva Rev ${s}`;
  await form.locator("input[name=nombre]").fill(NOMBRE);
  await form.locator("select[name=rol]").selectOption("recepcion");
  await form.getByRole("button", { name: /Sumar al equipo/ }).click();
  const fila = d.locator("li", { hasText: NOMBRE });
  await fila.waitFor({ timeout: 30000 });
  await fila.locator('button:has-text("Dar acceso")').click();
  await fila.locator("input[name=email]").fill(`nueva-rev${s}@ejemplo.invalid`);
  await fila.locator('button:has-text("Dar acceso")').click();
  const wa = fila.locator("a[data-compartir-clave]");
  await wa.waitFor({ timeout: 30000 });
  const texto = decodeURIComponent(await wa.getAttribute("href"));
  const clave = (await fila.locator("strong.numero").innerText()).trim();
  chequear(texto.startsWith("https://wa.me/?text=") && texto.includes(clave) && texto.includes("/ingresar"),
    "contrata a alguien: contraseña provisoria con “📲 Mandar por WhatsApp” (mail, contraseña y dónde entrar)", texto);
  await ancho("Equipo");

  // Miércoles: la echa: un toque y su historia queda.
  await d.reload();
  const fila2 = d.locator("li", { hasText: NOMBRE });
  await fila2.getByRole("button", { name: "Sacar acceso" }).click();
  await fila2.getByRole("button", { name: "Devolver acceso" }).waitFor({ timeout: 30000 });
  ok("la echa: “Sacar acceso” en un toque; sigue en la lista para su historia");

  // Jueves: se va de vacaciones (permisos del encargado) y piensa en otra sede.
  chequear(await aparece(d.locator("[data-permisos]"), 10000),
    "se va de vacaciones: los permisos del encargado se ajustan desde Equipo", "Equipo no muestra los permisos del encargado");
  await d.goto(`${G}/panel/configuracion`);
  await d.locator("main h1").waitFor({ timeout: 60000 });
  if (!(await aparece(d.getByRole("button", { name: /Sumar (una )?sede|Nueva sede|Otra sede/ }), 3000)))
    falta("abre otra sede: Configuración edita las sedes que hay, pero no se puede sumar una (cada una traería su caja, su entrada y su grilla)");
  await ancho("Configuración");

  // Viernes: prepara el aumento (sin aplicarlo).
  await d.goto(`${G}/panel/planes/aumento`);
  await d.locator("main h1").waitFor({ timeout: 60000 });
  chequear(/aumento|Aumento/.test(await d.locator("main").innerText()), "cambia los precios: el aumento programado con vista previa", "no abre el aumento");
  await ancho("Aumento");

  // Sábado: un aviso a todos y la campaña por WhatsApp.
  await d.goto(`${G}/panel/avisos`);
  const caja = d.locator("[data-novedades-panel]");
  await caja.waitFor({ timeout: 60000 });
  const NOV = `Rev2 ${s}: el lunes abrimos 10 h`;
  await caja.getByPlaceholder(/abrimos a las 10/).fill(NOV);
  await caja.getByRole("button", { name: "Publicar" }).click();
  await caja.locator("[data-novedad]", { hasText: NOV }).waitFor({ timeout: 60000 });
  ok("un aviso a todos: la novedad queda publicada para la app");
  await caja.locator("[data-novedad]", { hasText: NOV }).getByRole("button", { name: "Quitar" }).click();
  await caja.locator("[data-novedad]", { hasText: NOV }).waitFor({ state: "detached", timeout: 30000 });
  await ancho("Avisos");
  await d.goto(`${G}/panel/campana`);
  await d.locator("main h1").waitFor({ timeout: 60000 });
  ok("y la campaña por WhatsApp en tanda se abre");
  await ancho("Campaña");

  // Domingo: "¿cómo vengo este mes?" y el contador.
  await d.goto(`${G}/panel/resultado`);
  const cobrado = d.locator("[data-resultado-cobrado]");
  await cobrado.waitFor({ timeout: 60000 });
  chequear(/anterior|vs\.?|más que|menos que|%/.test(await cobrado.innerText()), `“¿cómo vengo?”: ${(await cobrado.innerText()).split("\n").join(" · ").slice(0, 120)}`, `Resultado no compara: ${await cobrado.innerText()}`);
  const links = await d.locator("[data-exportar] a").count();
  chequear(links >= 3, `el contador: exportar el mes (${links} archivos)`, "no se puede exportar el mes");
  await ancho("Resultado");
  for (const [ruta, nombre] of [["/panel/retencion", "Retención"], ["/panel/vencen-hoy", "Vencen hoy"]]) {
    await d.goto(`${G}${ruta}`);
    await d.locator("main h1").waitFor({ timeout: 60000 });
    await ancho(nombre);
  }
  ok("Retención y Vencen hoy en el celular");
  await capturar(d, "rev2-celu-resultado");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
  await capturar(d, "ROTA-rev2", true).catch(() => {});
}
await b.close();
resultado();
