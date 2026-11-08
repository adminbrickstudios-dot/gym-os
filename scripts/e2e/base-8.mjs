#!/usr/bin/env node
// BASE-8 · Seguridad: encabezados en cada respuesta y tope de intentos fallidos de ingreso (8 por mail cada 15 minutos).
//   node scripts/e2e/base-8.mjs     (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, PUERTO, chequear, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  for (const ruta of ["/ingresar", "/", "/panel"]) {
    const r = await fetch(`http://127.0.0.1:${PUERTO}${ruta}`, { headers: { host: `demo.localhost:${PUERTO}` }, redirect: "manual" });
    const h = r.headers;
    const falta = ["content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy"].filter((k) => !h.get(k));
    chequear(falta.length === 0, `${ruta}: trae CSP, X-Frame-Options, nosniff, Referrer-Policy y Permissions-Policy`, `${ruta}: faltan ${falta.join(", ")}`);
  }
  chequear(/frame-ancestors/.test((await fetch(`http://127.0.0.1:${PUERTO}/ingresar`, { headers: { host: `demo.localhost:${PUERTO}` } })).headers.get("content-security-policy") ?? ""), "la CSP impide que otro sitio meta la app en un marco", "la CSP no tiene frame-ancestors");

  const s = Date.now().toString().slice(-6);
  const p = await pagina(b, COMPU);
  p.setDefaultNavigationTimeout(120000);
  await p.goto(`${G}/ingresar`);
  const intentar = async (clave) => {
    await p.fill("input[type=email]", `nadie-${s}@ejemplo.invalid`);
    await p.fill("input[type=password]", clave);
    await p.click("button[type=submit]");
    await p.locator('[role="alert"]', { hasText: /\S/ }).first().waitFor({ timeout: 30000 });
    return (await p.locator('[role="alert"]', { hasText: /\S/ }).first().innerText()).trim();
  };
  let ultimo = "";
  let frenado = 0;
  for (let i = 1; i <= 20; i++) {
    ultimo = await intentar(`mala-${i}-${s}`);
    if (/muchos intentos/i.test(ultimo) && !frenado) frenado = i;
  }
  chequear(frenado > 0 && frenado <= 10, `20 intentos fallidos seguidos: el ${frenado}.º ya dice “${ultimo.slice(0, 50)}” (tope: 8)`, `no se frenó: “${ultimo}”`);
  chequear(/muchos intentos/i.test(ultimo), "y sigue frenado en el intento 20", `el último dijo: “${ultimo}”`);
  if (p.errores.length) falla(`ingreso: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
