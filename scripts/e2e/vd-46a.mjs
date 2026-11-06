#!/usr/bin/env node
// VD-46A · MercadoPago: contracargo, reembolso y conciliación (con el simulador de MercadoPago que levanta
// scripts/local/levantar.sh). Un socio vencido paga y entra; MercadoPago manda un contracargo FIRMADO →
// el socio pierde el acceso, su pantalla de pago dice "se devolvió" y la dueña ve la alerta en la campana; un
// approved tardío no revive nada; y si el aviso se pierde, "Revisar con MercadoPago" (sin cron) lo encuentra.
//   node scripts/e2e/vd-46a.mjs      (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const MP = `http://127.0.0.1:${process.env.PUERTO_MP ?? Number(process.env.PUERTO_SUPABASE ?? 54321) + 10}`;
const SECRETO = process.env.MP_SIMULADO_SECRETO ?? "secreto-del-simulador-de-mp-solo-local";
const post = async (ruta) => (await fetch(`${MP}${ruta}`, { method: "POST" })).json();
const b = await navegador();

/** El socio vencido paga en el checkout simulado y vuelve a la app: devuelve el ID del pago en MercadoPago. */
async function pagarComoVencido(s) {
  await s.goto(`${G}/app`);
  const pagar = s.locator("[data-pagar-online]");
  await pagar.waitFor({ timeout: 60000 });
  await pagar.getByRole("button", { name: /Pagar con MercadoPago/ }).click();
  await s.waitForURL((u) => u.href.startsWith(`${MP}/checkout/`), { timeout: 30000 });
  await s.getByRole("button", { name: "Pagar" }).click();
  await s.waitForURL(/\/app\/pago\?pago=/, { timeout: 30000 });
  await s.locator('[data-pago="aprobado"]').waitFor({ timeout: 30000 });
  const q = new URL(s.url()).searchParams;
  return { idMP: q.get("payment_id"), pagoId: q.get("pago") };
}
const sinAcceso = async (s) => { await s.goto(`${G}/app`); await s.getByText("No podés entrar").first().waitFor({ timeout: 60000 }); };

try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/configuracion?pestana=cobros`);
  const mp = d.locator("[data-mercadopago]");
  await mp.waitFor({ timeout: 60000 });
  await mp.getByRole("button", { name: /Conectar MercadoPago|Cambiar credenciales/ }).click();
  await mp.getByLabel("Access Token").fill("TEST-e2e00000000000000000000000000-gymos");
  await mp.getByLabel("Clave secreta del webhook").fill(SECRETO);
  await mp.locator("label", { hasText: /^\s*Prueba\s*$/ }).click();
  await mp.getByRole("button", { name: "Guardar y conectar" }).click();
  await d.locator('[data-mercadopago="conectado"]').waitFor({ timeout: 30000 });
  ok("la dueña tiene MercadoPago conectado (modo prueba)");

  // El socio vencido paga y entra.
  const s = await pagina(b, CELU);
  await entrar(s, "socio-vencido@ejemplo.invalid");
  await sinAcceso(s);
  ok("el socio vencido ve “No podés entrar”");
  const { idMP, pagoId } = await pagarComoVencido(s);
  await s.goto(`${G}/app`);
  await s.getByText("No podés entrar").first().waitFor({ state: "detached", timeout: 30000 });
  ok(`pagó con MercadoPago (pago ${idMP}) y ya puede entrar`);

  // Contracargo: aviso firmado, el servidor lee el estado de la API, la base revierte.
  const cc = await post(`/__estado/${idMP}?estado=charged_back`);
  chequear(cc.status === 200 && /"resultado":"devuelto"/.test(cc.cuerpo), "el contracargo firmado vuelve “devuelto”", JSON.stringify(cc));
  await sinAcceso(s);
  ok("el socio pierde el acceso: vuelve a ver “No podés entrar”");

  // Su pantalla de pago ya no dice "acreditado".
  await s.goto(`${G}/app/pago?pago=${pagoId}`);
  await s.locator('[data-pago="devuelto"]').waitFor({ timeout: 30000 });
  const ancho = await s.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular 390 px: sin desborde (${ancho}px)`, `desborda: ${ancho}px`);
  await capturar(s, "vd46a-celu-devuelto");
  ok("su pantalla de pago dice “Este pago se devolvió”");

  // La dueña lo ve en la campana.
  await d.goto(`${G}/panel/campana`);
  await d.getByText(/Contracargo de MercadoPago/).first().waitFor({ timeout: 30000 });
  await capturar(d, "vd46a-compu-campana");
  ok("la dueña ve “Contracargo de MercadoPago” en la campana");

  // Idempotencia y orden: el mismo aviso no hace nada; un approved tardío no revive la cobertura.
  const otra = await post(`/__reenviar/${idMP}`);
  chequear(otra.status === 200 && /"ya":true/.test(otra.cuerpo), "el mismo aviso otra vez: no se procesa dos veces", JSON.stringify(otra));
  const tardio = await post(`/__estado/${idMP}?estado=approved`);
  chequear(tardio.status === 200 && /"(ya|resultado)":("ya_devuelto"|true)/.test(tardio.cuerpo), "un approved posterior al contracargo se ignora", JSON.stringify(tardio));
  await sinAcceso(s);
  ok("el socio sigue sin acceso");
  const mala = await post(`/__firma-mala/${idMP}`);
  chequear(mala.status === 401, "un aviso con firma inválida no revierte nada (401)", JSON.stringify(mala));

  // Conciliación sin cron: el aviso se pierde (avisar=0) y el dueño toca "Revisar con MercadoPago".
  const { idMP: idMP2 } = await pagarComoVencido(s);
  await s.goto(`${G}/app`);
  await s.getByText("No podés entrar").first().waitFor({ state: "detached", timeout: 30000 });
  ok(`vuelve a pagar (pago ${idMP2}) y entra`);
  await post(`/__estado/${idMP2}?estado=refunded&avisar=0`);   // MercadoPago devolvió, pero el aviso no llegó
  await d.goto(`${G}/panel/transferencias`);
  const rev = d.locator("[data-revisar-mp]");
  await rev.waitFor({ timeout: 30000 });
  await rev.getByRole("button", { name: /Revisar con MercadoPago/ }).click();
  await rev.getByText(/cambi/).waitFor({ timeout: 60000 });
  await capturar(d, "vd46a-compu-revisar");
  ok(`“Revisar con MercadoPago”: ${(await rev.getByRole("status").innerText()).slice(0, 80)}`);
  await sinAcceso(s);
  ok("la reconsulta encontró la devolución: el socio vuelve a quedar sin acceso");

  // La recepción no tiene el botón.
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/transferencias`);
  await r.getByRole("heading", { name: /Transferencias/ }).first().waitFor({ timeout: 30000 });
  chequear(await r.locator("[data-revisar-mp]").count() === 0, "la recepción no ve el botón de revisar", "la recepción ve el botón");

  for (const [quien, p] of [["dueña", d], ["socio", s], ["recepción", r]]) if (p.errores.length) falla(`${quien}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
