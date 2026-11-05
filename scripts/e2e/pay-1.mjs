#!/usr/bin/env node
// PAY-1 · Pago online de punta a punta (con el simulador de MercadoPago que
// levanta scripts/local/levantar.sh): la dueña conecta MercadoPago, el socio
// paga y vuelve → "¡Pago acreditado!" porque llegó el aviso firmado; el mismo
// aviso otra vez no acredita dos veces; con firma inválida se rechaza.
//   npm run e2e:pay-1            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const MP = `http://127.0.0.1:${process.env.PUERTO_MP ?? Number(process.env.PUERTO_SUPABASE ?? 54321) + 10}`;
const SECRETO = process.env.MP_SIMULADO_SECRETO ?? "secreto-del-simulador-de-mp-solo-local";
const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/configuracion?pestana=cobros`);
  const mp = d.locator("[data-mercadopago]");
  await mp.waitFor({ timeout: 60000 });
  await mp.getByRole("button", { name: /Conectar MercadoPago|Cambiar credenciales/ }).click();
  await mp.getByLabel("Access Token").fill("mi-token");
  await mp.getByLabel("Clave secreta del webhook").fill(SECRETO);
  await mp.getByLabel(/^Prueba/).check();
  await mp.getByRole("button", { name: "Guardar y conectar" }).click();
  await mp.getByRole("alert").waitFor({ timeout: 30000 });
  chequear(/APP_USR-/.test(await mp.getByRole("alert").innerText()), "un token que no es token: dice dónde está el bueno", await mp.getByRole("alert").innerText());
  await mp.getByLabel("Access Token").fill("TEST-e2e00000000000000000000000000-gymos");
  await mp.getByRole("button", { name: "Guardar y conectar" }).click();
  await d.locator('[data-mercadopago="conectado"]').waitFor({ timeout: 30000 });
  ok("Configuración → Cobros: MercadoPago conectado (modo prueba)");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  const s = await pagina(b, CELU);
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  const pagar = s.locator("[data-pagar-online]");
  await pagar.waitFor({ timeout: 60000 });
  const monto = (await pagar.locator(".numero").innerText()).trim();
  await pagar.getByRole("button", { name: /Pagar con MercadoPago/ }).click();
  await s.waitForURL((u) => u.href.startsWith(`${MP}/checkout/`), { timeout: 30000 });
  const precio = Number(monto.replace(/[^\d,]/g, "").replace(",", "."));
  chequear((await s.locator("body").innerText()).includes(`$ ${precio}`), `el checkout de MercadoPago (simulado) por ${monto}, el precio que mostró la app`, await s.locator("body").innerText());
  await capturar(s, "pay1-celu-checkout");
  await s.getByRole("button", { name: "Pagar" }).click();
  await s.waitForURL(/\/app\/pago\?pago=/, { timeout: 30000 });
  const idMP = new URL(s.url()).searchParams.get("payment_id");
  await s.locator('[data-pago="aprobado"]').waitFor({ timeout: 30000 });
  ok(`vuelve a la app: “¡Pago acreditado!” (aviso firmado, pago ${idMP})`);
  await capturar(s, "pay1-celu-acreditado");

  const otra = await (await fetch(`${MP}/__reenviar/${idMP}`, { method: "POST" })).json();
  chequear(otra.status === 200 && /"ya":true/.test(otra.cuerpo), "el mismo aviso otra vez: no acredita dos veces", JSON.stringify(otra));
  const mala = await (await fetch(`${MP}/__firma-mala/${idMP}`, { method: "POST" })).json();
  chequear(mala.status === 401, "aviso con firma inválida: 401, no toca nada", JSON.stringify(mala));
  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
