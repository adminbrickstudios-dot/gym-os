#!/usr/bin/env node
// Barrido: cada rol del gimnasio demo abre todas las pantallas del panel, en
// compu y en celular. Falla si alguna da error de servidor, se rompe, se
// desborda a lo ancho en el celular o un rol ve lo que no le toca.
//   npm run e2e:barrido            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, PANTALLA_ROTA, capturar, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const RUTAS = ["/panel", "/panel/entrada", "/panel/clases", "/panel/clases/grilla", "/panel/vencen-hoy", "/panel/socios",
  "/panel/socios/nuevo", "/panel/retencion", "/panel/vender", "/panel/caja", "/panel/transferencias", "/panel/planes",
  "/panel/equipo", "/panel/configuracion", "/panel/cuenta"];
// Lo que cada rol NO tiene que poder abrir (debe ver "sin permiso", no la pantalla).
const PROHIBIDO = {
  duena: [],
  encargado: [],
  recepcion: ["/panel/retencion", "/panel/planes", "/panel/equipo", "/panel/configuracion", "/panel/clases/grilla"],
  profe: ["/panel/entrada", "/panel/vencen-hoy", "/panel/socios", "/panel/socios/nuevo", "/panel/retencion", "/panel/vender",
          "/panel/caja", "/panel/transferencias", "/panel/planes", "/panel/equipo", "/panel/configuracion", "/panel/clases/grilla"],
};
const SIN_PERMISO = /No tenés acceso|Tu rol no tiene acceso|Sin permiso|no tiene acceso/i;
const soloRol = process.argv.find((a) => a.startsWith("--rol="))?.slice(6);

const b = await navegador();
for (const rol of Object.keys(PROHIBIDO)) {
  if (soloRol && rol !== soloRol) continue;
  for (const [tam, viewport] of [["compu", COMPU], ["celu", CELU]]) {
    const p = await pagina(b, viewport);
    await entrar(p, `${rol}@ejemplo.invalid`);
    for (const ruta of RUTAS) {
      const antes = p.errores.length;
      const r = await p.goto(`${GIMNASIO()}${ruta}`, { timeout: 120000 });
      await p.waitForLoadState("networkidle").catch(() => {});
      const texto = await p.locator("body").innerText().catch(() => "");
      const nombre = `${rol}-${tam}${ruta.replaceAll("/", "-")}`;
      const problemas = [...p.errores.slice(antes)];
      if (r && r.status() >= 500) problemas.push(`HTTP ${r.status()}`);
      if (PANTALLA_ROTA.test(texto)) problemas.push("pantalla de error");
      const prohibida = PROHIBIDO[rol].includes(ruta);
      if (prohibida && !SIN_PERMISO.test(texto)) problemas.push("debería decir sin permiso y muestra la pantalla");
      if (!prohibida && SIN_PERMISO.test(texto)) problemas.push("dice sin permiso y le corresponde verla");
      if (tam === "celu") {
        const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
        if (ancho > CELU.width + 1) problemas.push(`se desborda a lo ancho (${ancho}px en un celu de ${CELU.width})`);
      }
      if (problemas.length) { falla(`${rol} · ${tam} · ${ruta}: ${problemas.join(" | ")}`); await capturar(p, `ROTA-${nombre}`, true); }
      else ok(`${rol} · ${tam} · ${ruta}`);
    }
    await p.context().close();
  }
}
await b.close();
resultado();
