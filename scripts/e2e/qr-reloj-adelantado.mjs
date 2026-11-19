#!/usr/bin/env node
// Paneles completos · El QR del socio con el reloj del celular ADELANTADO 2 minutos: el QR nace "vencido" para el navegador y antes se pedía otro sin parar
// (decenas de mi_qr en segundos) y el contador no coincidía con el del servidor (React #418). Ahora: como mucho 2 pedidos en 10 s y ningún error de React.
//   node scripts/e2e/qr-reloj-adelantado.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  for (const [que, adelanto] of [["reloj adelantado 2 min", 120_000], ["reloj atrasado 2 min", -120_000]]) {
    const s = await pagina(b, CELU);
    const errores = [];
    s.on("pageerror", (e) => errores.push(e.message));
    s.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
    let pedidos = 0;
    s.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"]) pedidos++; });
    await entrar(s, "socio@ejemplo.invalid");
    await s.context().clock.setSystemTime(new Date(Date.now() + adelanto));
    await s.goto(`${G}/app`);
    await s.locator("[data-mi-qr]").waitFor({ timeout: 60000 });
    pedidos = 0;
    await s.waitForTimeout(10_000);
    chequear(pedidos <= 2, `${que}: ${pedidos} pedido(s) de QR en 10 s`, `${que}: ${pedidos} pedidos de QR en 10 s (se pedía otro sin parar)`);
    const react = errores.filter((e) => /#418|#423|#425|hydrat/i.test(e));
    chequear(react.length === 0, `${que}: sin errores de hidratación de React`, `${que}: ${react.slice(0, 2).join(" | ")}`);
    await s.context().close();
  }
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
