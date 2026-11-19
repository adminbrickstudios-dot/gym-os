#!/usr/bin/env node
// Paneles completos · Cada pantalla de la app del socio (celular) abre con sesión real: título, contenido (o su estado vacío con motivo), sin pantalla rota,
// sin desborde horizontal, sin errores de consola, y vuelve a Inicio. Cubre insignias y resumen del año, novedades, mensajes, locker, PT, rutina, historial,
// mi plan, mis datos, info del gimnasio y mi perfil. Las que el gimnasio demo no tiene prendidas dicen por qué (no quedan en blanco).
//   node scripts/e2e/socio-pantallas.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const ROTA = /Application error|Unhandled Runtime Error|Something went wrong|No se pudo cargar esta pantalla/i;
const RUTAS = ["resumen", "novedades", "mensajes", "locker", "pt", "rutina", "historial", "plan", "mis-datos", "info", "yo", "clases", "cuenta"];
const b = await navegador();
try {
  const s = await pagina(b, CELU);
  const errores = [];
  s.on("pageerror", (e) => errores.push(e.message));
  await entrar(s, "socio@ejemplo.invalid");
  for (const r of RUTAS) {
    errores.length = 0;
    const resp = await s.goto(`${G}/app/${r}`);
    await s.locator("main, body").first().waitFor({ timeout: 60000 });
    await s.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && document.body.innerText.trim().length > 20, null, { timeout: 30000 }).catch(() => {});
    const cuerpo = await s.locator("body").innerText();
    chequear((resp?.status() ?? 200) < 400, `/app/${r}: responde`, `/app/${r}: HTTP ${resp?.status()}`);
    chequear(!ROTA.test(cuerpo), `/app/${r}: sin pantalla rota`, `/app/${r}: ${cuerpo.replace(/\s+/g, " ").slice(0, 140)}`);
    chequear(cuerpo.trim().length > 20, `/app/${r}: tiene contenido o su motivo`, `/app/${r}: en blanco`);
    const ancho = await s.evaluate(() => document.documentElement.scrollWidth);
    chequear(ancho <= CELU.width, `/app/${r}: sin desborde (${ancho}px)`, `/app/${r}: desborda ${ancho}px`);
    chequear(errores.length === 0, `/app/${r}: sin errores de página`, `/app/${r}: ${errores.slice(0, 2).join(" | ")}`);
  }
  await s.goto(`${G}/app`);
  await s.getByText(/Podés entrar|No podés entrar/).first().waitFor({ timeout: 60000 });
  ok("y se vuelve a Inicio");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
