#!/usr/bin/env node
// VD-35 · Registro del socio por su cuenta (D26): la dueña abre el registro (Configuración) → desde la
// página y desde "Soy nuevo" del ingreso se registra con un plan (un menor no puede, la fecha es
// obligatoria) → en el panel queda "A cobrar" con 🌐 → paga por transferencia desde la app → la
// recepción aprueba → entra. Con el registro cerrado no aparece en la página ni en el ingreso.
//   node scripts/e2e/vd-35.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, entrarSocio, falla, navegador, ok, pagina, resultado, esperarAntiRobot } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const s = Date.now().toString().slice(-6);
const DNI = `44${s}`, TEL = `000 6${s}`;   // característica 000: ficticio
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const b = await navegador();
try {
  // ── La dueña: reglamento (Tu página) y el interruptor "Registro abierto" (Configuración) ──
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/pagina`);
  const altas = d.locator("[data-altas]");
  await altas.waitFor({ timeout: 60000 });
  if (!(await altas.locator("textarea").inputValue()).trim()) {
    await altas.locator("textarea").fill("1. Traé toalla.\n2. La cuota se paga del 1 al 10.");
    const n = Number(await altas.getAttribute("data-respuestas"));
    await altas.locator('button:has-text("Guardar")').click();
    await d.waitForFunction((n) => Number(document.querySelector("[data-altas]")?.getAttribute("data-respuestas")) > n, n, { timeout: 30000 });
  }
  await d.goto(`${G}/panel/configuracion?pestana=pagina`);
  const registro = d.locator("[data-autoservicio] input[data-registro-abierto]");
  await registro.waitFor({ timeout: 60000 });
  const estado = d.locator('[data-autoservicio] [role="status"], [data-autoservicio] [role="alert"]');
  const poner = async (abierto) => {
    if ((await registro.isChecked()) === abierto) return;
    await registro.click();
    // El aviso de la vez anterior sigue en pantalla: se espera a que el valor quede guardado (recargando).
    for (let i = 0; i < 20; i++) { await d.waitForTimeout(700); await d.reload(); await registro.waitFor({ timeout: 60000 }); if ((await registro.isChecked()) === abierto) break; }
    chequear(await registro.isChecked() === abierto, `Configuración: registro ${abierto ? "abierto" : "cerrado"}`, "el interruptor no quedó como se pidió");
  };

  // ── Cerrado: no aparece ──
  await poner(false);
  const v = await pagina(b, CELU);
  v.setDefaultNavigationTimeout(120000);
  await v.goto(`${G}/ingresar?modo=socio`);
  await v.locator("h1").first().waitFor({ timeout: 60000 });
  chequear(await v.locator("[data-soy-nuevo]").count() === 0, "registro cerrado: el ingreso no ofrece “Soy nuevo”", "el ingreso ofrece anotarse con el registro cerrado");
  await v.goto(`${G}/hacete-socio`);
  chequear(await aparece(v.locator("[data-alta-cerrada]"), 30000) && await v.locator("[data-form-alta]").count() === 0, "registro cerrado: /hacete-socio manda a WhatsApp, sin formulario", "con el registro cerrado el formulario sigue");

  // ── Abierto: "Soy nuevo" lleva al formulario ──
  await poner(true);
  await v.goto(`${G}/ingresar?modo=socio`);
  const nuevo = v.locator("[data-soy-nuevo] a");
  await nuevo.waitFor({ timeout: 60000 });
  await nuevo.click();
  await v.waitForURL(/\/hacete-socio/, { timeout: 30000 });
  const form = v.locator("[data-form-alta]");
  await form.waitFor({ timeout: 60000 });
  ok("registro abierto: desde “Soy nuevo, quiero anotarme” llega al formulario");

  // ── Se registra con un plan; un menor no puede ──
  await form.locator("[data-plan]").first().click();
  const llenar = async (nac) => {
    await form.locator('input[name="nombre"]').fill("Valentina");
    await form.locator('input[name="apellido"]').fill(`Reg${s}`);
    await form.locator('input[name="dni"]').fill(DNI);
    await form.locator('input[name="telefono"]').fill(TEL);
    await form.locator('input[name="fecha_nacimiento"]').fill(nac);
    await form.locator('input[name="email"]').fill(`reg${s}@ejemplo.invalid`);
    await form.locator('input[name="contrasena"]').fill("clave-de-prueba-1");
  };
  chequear(await form.locator('input[name="fecha_nacimiento"]').evaluate((x) => x.required), "la fecha de nacimiento es obligatoria", "la fecha de nacimiento no es obligatoria");
  const anio = new Date().getFullYear();
  await llenar(`${anio - 15}-05-10`);
  // H3b: un menor se anota con un adulto responsable (el formulario se lo pide); sin él no se manda.
  chequear(await aparece(form.locator("[data-adulto-responsable]"), 10000) && await form.locator('input[name="responsable_nombre"]').evaluate((x) => x.required), "un menor: el formulario pide el nombre y el celular de un adulto responsable", "con un menor no pide al adulto responsable");
  chequear((await db.query(`select count(*)::int n from public.socios where dni = $1`, [DNI])).rows[0].n === 0, "y no queda anotado sin él", "el menor quedó anotado");
  await form.locator('input[name="acepto"]').check();
  await llenar(`${anio - 30}-05-10`);
  await form.locator('input[name="acepto"]').check();
  await form.locator('label:has-text("Transferencia")').click();
  await esperarAntiRobot(form);
  await form.locator('button[type="submit"]').click();
  await v.locator('[data-alta-lista="transferencia"]').waitFor({ timeout: 30000 });
  const [{ id: socio, origen }] = (await db.query(`select s.id, s.origen from public.socios s join public.gimnasios g on g.id = s.gimnasio_id where g.slug = 'demo' and s.dni = $1`, [DNI])).rows;
  chequear(origen === "alta_web", "se registra con su plan y ve el alias para transferir", `origen ${origen}`);
  await capturar(v, "vd35-celu-registrado", true);

  // ── En el panel queda "A cobrar" con 🌐 y la Entrada no lo deja pasar ──
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios?q=${DNI}`);
  const fila = r.locator("[data-lista] li", { hasText: `Reg${s}` }).first();
  await fila.waitFor({ timeout: 60000 });
  chequear(await fila.locator("[data-autoalta][data-a-cobrar]").count() === 1 && /A cobrar/.test(await fila.innerText()), "Socios: aparece con “A cobrar”", `la fila dice: ${(await fila.innerText()).replace(/\s+/g, " ")}`);
  await capturar(r, "vd35-compu-a-cobrar");
  await r.goto(`${G}/panel/entrada?socio=${socio}`);
  await r.locator("section[aria-live]").waitFor({ timeout: 60000 });
  chequear(await r.locator('[data-veredicto="verde"]').count() === 0, "la Entrada no lo deja pasar sin pagar", "la Entrada lo deja pasar sin pagar");

  // ── Paga por transferencia desde la app ──
  const a = await pagina(b, CELU);
  a.setDefaultNavigationTimeout(120000);
  await entrarSocio(a, TEL);
  const pagar = a.locator("section", { hasText: "Pagar por transferencia" });
  await pagar.waitFor({ timeout: 60000 });
  await pagar.locator('input[type="file"]').setInputFiles({ name: "comprobante.png", mimeType: "image/png", buffer: PNG });
  await a.getByText(/el gimnasio lo (revisa|está revisando)/).first().waitFor({ timeout: 30000 });
  ok("entra a la app con su celular y sube el comprobante");

  // ── La recepción aprueba y entra ──
  await r.goto(`${G}/panel/transferencias`);
  const mia = r.locator("li", { hasText: `Reg${s}` }).first();
  await mia.waitFor({ timeout: 60000 });
  await mia.locator('button:has-text("Aprobar")').click();
  await r.locator("li", { hasText: `Valentina Reg${s}` }).filter({ has: r.locator('button:has-text("Aprobar")') }).waitFor({ state: "detached", timeout: 30000 });
  await r.goto(`${G}/panel/entrada?socio=${socio}`);
  await r.locator('[data-veredicto="verde"]').waitFor({ timeout: 60000 });
  ok("aprobado el comprobante: la Entrada lo deja pasar");
  await r.goto(`${G}/panel/socios?q=${DNI}`);
  const fila2 = r.locator("[data-lista] li", { hasText: `Reg${s}` }).first();
  await fila2.waitFor({ timeout: 60000 });
  chequear(await fila2.locator("[data-a-cobrar]").count() === 0 && await fila2.locator("[data-autoalta]").count() === 1, "ya pagó: conserva el 🌐 y deja de decir “A cobrar”", "la marca “A cobrar” sigue después de pagar");

  for (const [n, p] of [["dueña", d], ["visitante", v], ["recepción", r], ["socio", a]]) if (p.errores.length) falla(`${n}: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await db.end();
await b.close();
resultado();
