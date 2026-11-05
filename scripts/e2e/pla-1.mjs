#!/usr/bin/env node
// PLA-1 · Planes trimestral, semestral y anual: la dueña crea un Trimestral;
// la lista dice cuánto da por mes; se le da a un socio, se cobra una cuota y
// la Entrada dice que vence en 3 meses.
//   npm run e2e:pla-1            (con scripts/local/levantar.sh corriendo)
import { COMPU, GIMNASIO, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/planes`);
  await d.locator('button:has-text("Nuevo plan")').click();
  await d.locator('label:has-text("Trimestral")').click();
  await d.getByText("una cuota cubre los 3").waitFor();
  await d.locator('input[name="nombre"]').fill(`Tri${s5}`);
  await d.locator('input[name="precio"]').fill("81.000");
  await d.locator('button:has-text("Crear")').click();
  const fila = d.locator(`li[data-plan="Tri${s5}"]`);
  await fila.waitFor({ timeout: 30000 });
  chequear(/Trimestral \(\$27\.000 por mes\)/.test(await fila.innerText()), "la lista: “Trimestral ($27.000 por mes)”", await fila.innerText());
  await capturar(d, "pla1-compu-planes");

  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Trim${s5}`);
  await d.locator('select[aria-label="Plan"]').selectOption({ label: (await d.locator('select[aria-label="Plan"] option', { hasText: `Tri${s5}` }).innerText()) });
  await d.locator('button:has-text("Solo dar de alta")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
  const id = d.url().split("/").pop();
  await d.goto(`${G}/panel/vender?socio=${id}&cuota=1`);
  await d.getByText(`Cuota Tri${s5}`).first().waitFor({ timeout: 30000 });
  chequear(/\$81\.000/.test(await d.locator("main").innerText()), "Vender: la cuota trimestral sale $81.000", "no sale $81.000");
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await d.locator('button:has-text("✅ Cobrar")').click();
  await esperarCobro(d);
  await d.goto(`${G}/panel/entrada?socio=${id}`);
  const ver = d.locator('[data-veredicto="verde"]');
  await ver.waitFor({ timeout: 30000 });
  // Vence el día anterior a hoy + 3 meses (en la hora del gimnasio).
  const [a, m, dd] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()).split("-").map(Number);
  const fin = new Date(Date.UTC(a, m - 1 + 3, dd) - 864e5);
  const esperado = `${String(fin.getUTCDate()).padStart(2, "0")}/${String(fin.getUTCMonth() + 1).padStart(2, "0")}`;
  chequear((await ver.innerText()).includes(esperado), `cobrada una cuota, la Entrada dice que vence el ${esperado}`, await ver.innerText());
  ok("trimestral de punta a punta");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
