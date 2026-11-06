#!/usr/bin/env node
// VD-12e · Inicio: "Ahora y lo que sigue" no repite lo que ya está en "Para hacer hoy".
//   node scripts/e2e/vd-12e.mjs     (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel`);
  await d.locator("#ahora").waitFor({ timeout: 60000 });
  const ahora = d.locator('section[aria-labelledby="ahora"]');
  const textoAhora = (await ahora.innerText()).replace(/\s+/g, " ");
  const hay = async (clave) => (await d.locator(`[data-hacer="${clave}"]`).count()) > 0;

  // Cada cosa que ya está en Para hacer hoy no aparece abajo.
  const pares = [
    ["vencen_hoy", /vence(n)? hoy/i, "los que vencen hoy"],
    ["transferencias", /para aprobar/i, "las transferencias"],
  ];
  let comprobados = 0;
  for (const [clave, patron, que] of pares) {
    if (!(await hay(clave))) continue;
    comprobados++;
    chequear(!patron.test(textoAhora), `${que}: está en Para hacer hoy y no se repite en Ahora`, `${que} aparece en las dos listas`);
  }
  if (!comprobados) ok("el demo no tiene pendientes en Para hacer hoy: nada que repetir");

  // Lo que no está en Para hacer hoy (clases, caja cerrada) sigue en Ahora.
  const filas = await ahora.locator("li").count();
  const vacio = /Nada pendiente por ahora/.test(textoAhora);
  chequear(filas > 0 || vacio, "Ahora y lo que sigue muestra lo suyo o el estado vacío", "Ahora y lo que sigue quedó en blanco sin explicación");

  // La recepción: su turno de caja sigue arriba aunque la caja abierta ya esté en Para hacer hoy.
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel`);
  await r.locator("#ahora").waitFor({ timeout: 60000 });
  chequear((await r.locator("[data-turno]").count()) > 0 || (await r.locator("#para-hacer").count()) > 0, "la recepción ve su turno de caja o su lista para hacer", "la recepción perdió su turno de caja");
  for (const p of [d, r]) if (p.errores.length) falla(`inicio: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
