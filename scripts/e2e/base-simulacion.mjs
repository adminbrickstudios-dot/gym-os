#!/usr/bin/env node
// BASE-11 · La simulación de "terminado" (§8 del pedido). Corre, de a uno y en este orden, los recorridos que prueban cada paso y
// da un resumen; con TOPE_MS se afloja el tope de 1 s por ingreso cuando se corre en una compu lenta (en la app real queda en 1000).
//   node scripts/e2e/base-simulacion.mjs     (con scripts/local/levantar.sh corriendo, base nueva)
import { spawnSync } from "node:child_process";

const PASOS = [
  ["1 · Super admin crea gimnasio y dueño; el dueño entra por /dueno", "base-2"],
  ["2 · Los 9 pasos del asistente, la página y el equipo", "base-7"],
  ["2b · La página del gimnasio se ve bien y carga datos", "pag-1"],
  ["3-4 · 20 ingresos con el atajo, en menos de 1 s cada uno", "base-ingresos"],
  ["3b · Un rojo se cobra desde el aviso: panel lateral → COBRAR AHORA", "base-3"],
  ["3c · Dejar pasar con motivo (queda en Control)", "vd-8"],
  ["5 · Pago de MercadoPago actualiza la vigencia; el webhook repetido no duplica", "vd-46a"],
  ["6 · El socio ve vigencia, deuda y QR en el celular", "vd-36"],
  ["7 · El profe no ve plata; 8 · un segundo gimnasio no ve nada del primero", "base-aislamiento"],
  ["10 · Encabezados de seguridad y tope de ingresos fallidos", "base-8"],
];
let malos = 0;
for (const [titulo, script] of PASOS) {
  const r = spawnSync("node", [`scripts/e2e/${script}.mjs`], { encoding: "utf8", env: process.env, timeout: 600000 });
  const ok = r.status === 0;
  if (!ok) malos++;
  const ultima = (r.stdout + r.stderr).trim().split("\n").filter(Boolean).slice(-1)[0] ?? "";
  console.log(`${ok ? "✓" : "✗"} ${titulo}  [${script}]  ${ultima.slice(0, 90)}`);
}
console.log(malos ? `\n${malos} paso(s) en rojo.` : "\n✓ La simulación de terminado pasó entera.");
process.exit(malos ? 1 : 0);
