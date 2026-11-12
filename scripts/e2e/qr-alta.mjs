#!/usr/bin/env node
// C9 · QR y link para anotarse solo.
//   1. La dueña abre Ayuda → Carteles → "Anotate acá": ve el QR (con la dirección del formulario, armada por lib/urls.ts), el link de
//      WhatsApp con el mensaje armado, y deja el registro abierto con un plan sugerido.
//   2. En el celular abre el link del QR (/hacete-socio, sin pasar por la landing): el formulario llega con el plan sugerido elegido;
//      completa y se anota.
//   3. La recepción lo ve en Prospectos ("Se hicieron socios") y en Entrada NO lo deja pasar (sin pagar).
//   4. Con el registro apagado, el mismo link dice que hoy no se puede y da el WhatsApp del gimnasio.
//   5. La recepción no abre el cartel (solo dueño y encargado).
//   node scripts/e2e/qr-alta.mjs      (con scripts/local/levantar.sh corriendo; sin correr todavía: escrito según la documentación)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, esperarAntiRobot, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
// El registro no se prende sin reglamento: el demo de CI puede no tenerlo, se deja uno.
{
  const db = new pg.Client({ connectionString: process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim() }); await db.connect();
  await db.query(`insert into public.reglamentos (gimnasio_id, version, texto) select g.id, 1, 'Reglamento de prueba del gimnasio demo para el e2e del registro por QR.' from public.gimnasios g where g.slug = 'demo' and not exists (select 1 from public.reglamentos r where r.gimnasio_id = g.id)`);
  await db.end();
}
const b = await navegador();
const s = Date.now().toString().slice(-6);
const DNI = `42${s}`;
const TEL = `000 ${s}3`;   // con característica 000: ficticio
try {
  // ── Dueña: el cartel, el link y los controles ──
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/ayuda/carteles`);
  chequear(await aparece(d.locator("[data-cartel-link=anotate]"), 60000), "Carteles lista “Anotate acá”", "Carteles no lista “Anotate acá”");
  await d.goto(`${G}/panel/ayuda/carteles/anotate`);
  const controles = d.locator("[data-qr-alta-controles]");
  await controles.waitFor({ timeout: 60000 });
  const llave = controles.locator('[data-registro-abierto]').first();
  const estaAbierto = async () => (await controles.getAttribute("data-abierto")) === "si";
  const poner = async (abierto) => {
    if ((await estaAbierto()) !== abierto) {
      await llave.click();
      await d.waitForFunction((a) => document.querySelector("[data-qr-alta-controles]")?.getAttribute("data-abierto") === (a ? "si" : "no"), abierto, { timeout: 30000 });
    }
    chequear((await estaAbierto()) === abierto, `registro ${abierto ? "abierto" : "cerrado"}`, "el interruptor no quedó como se pidió");
  };
  await poner(true);

  const link = (await controles.locator("[data-link-anotate]").innerText()).trim();
  chequear(/^https?:\/\/.+\/hacete-socio$/.test(link), `el link va directo al formulario: ${link}`, `el link no apunta a /hacete-socio: ${link}`);
  chequear(await d.locator(`[data-qr-anotate="${link}"] svg`).count() === 1, "el cartel A4 lleva el QR de ese mismo link", "el QR del cartel no coincide con el link");
  const wa = await controles.locator("[data-whatsapp-anotate]").getAttribute("href");
  chequear(wa?.startsWith("https://wa.me/?text=") && decodeURIComponent(wa).includes(link), "el link de WhatsApp lleva el mensaje armado con la dirección", `WhatsApp: ${wa}`);
  chequear(!/\p{Extended_Pictographic}/u.test(await d.locator("[data-cartel]").innerText()), "el cartel no lleva emojis", "el cartel lleva emojis");

  const select = controles.locator("[data-plan-sugerido]");
  const planes = await select.locator("option:not([value=''])").allInnerTexts();
  const planElegido = planes[planes.length - 1];
  await select.selectOption({ label: planElegido });
  await controles.locator(".mensaje-exito").first().waitFor({ timeout: 30000 });
  ok(`plan sugerido guardado: ${planElegido}`);
  await capturar(d, "qr-alta-compu-cartel", true);

  // ── Celular: abre el link del QR, el formulario llega con el plan elegido ──
  const v = await pagina(b, CELU);
  await v.goto(link.replace(/^https?:\/\/[^/]+/, G));   // el QR apunta al dominio real; en local el host es demo.localhost
  const form = v.locator("[data-form-alta]");
  await form.waitFor({ timeout: 60000 });
  chequear(await v.locator("[data-alta-cerrada]").count() === 0, "con el registro abierto, el link muestra el formulario (sin pasar por la landing)", "el link no muestra el formulario");
  chequear(await form.locator(`[data-plan="${planElegido}"] input`).isChecked(), `llega con el plan sugerido elegido: ${planElegido}`, "el plan sugerido no viene elegido");
  await form.locator('input[name="nombre"]').fill("Camila");
  await form.locator('input[name="apellido"]').fill(`Qr${s}`);
  await form.locator('input[name="dni"]').fill(DNI);
  await form.locator('input[name="telefono"]').fill(TEL);
  await form.locator('input[name="fecha_nacimiento"]').fill("1991-07-02");
  await form.locator('input[name="email"]').fill(`qr${s}@ejemplo.invalid`);
  await form.locator('input[name="contrasena"]').fill("clave-de-prueba-1");
  await form.locator('input[name="acepto"]').check();
  await form.locator('label:has(input[value="mostrador"])').click();
  await esperarAntiRobot(form);
  await form.locator('button[type="submit"]').click();
  const listo = v.locator('[data-alta-lista="mostrador"]');
  await listo.waitFor({ timeout: 30000 });
  chequear(/Pasá por recepción/.test(await listo.innerText()), "se anotó: “Pasá por recepción y pagá tu plan”", "la pantalla final no manda a pagar");
  await capturar(v, "qr-alta-celu-listo", true);
  if (v.errores.length) falla(`celular: ${v.errores.join(" | ")}`);

  // ── Recepción: lo ve en Prospectos y la puerta no lo deja pasar ──
  const r = await pagina(b, COMPU);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/prospectos`);
  await r.locator('[data-filtro="socio"]').click();
  const fila = r.locator("[data-prospecto]", { hasText: `Qr${s}` });
  chequear(await aparece(fila, 30000), "la recepción lo ve en Prospectos → “Se hicieron socios”", "no aparece en Prospectos");
  await r.goto(`${G}/panel/entrada`);
  await r.locator('input[aria-label="Buscar socio"]').fill(DNI);
  const resultadoFila = r.locator("button.fila", { hasText: "Camila" }).first();
  await resultadoFila.waitFor({ timeout: 30000 });
  await resultadoFila.click();
  const veredicto = r.locator("section[aria-live]");
  await veredicto.waitFor({ timeout: 30000 });
  chequear(!/Anotar entrada/.test(await veredicto.innerText()), "la puerta no lo deja pasar: se anotó sin pagar", "la puerta lo deja pasar sin pagar");
  await r.goto(`${G}/panel/ayuda/carteles/anotate`);
  chequear(/no tiene acceso|No tenés acceso/i.test(await r.locator("main").innerText()), "recepción no abre el cartel: dice que no tiene acceso", "recepción abrió el cartel");
  await r.context().close();

  // ── Registro apagado: el mismo link dice que hoy no se puede y da el WhatsApp ──
  await d.goto(`${G}/panel/ayuda/carteles/anotate`);
  await controles.waitFor({ timeout: 60000 });
  await poner(false);
  chequear(await aparece(d.locator("[data-qr-alta-cerrado]"), 10000), "el panel avisa que con el registro cerrado el QR dice que hoy no se puede", "el panel no avisa del registro cerrado");
  await v.goto(link.replace(/^https?:\/\/[^/]+/, G));
  const cerrada = v.locator("[data-alta-cerrada]");
  chequear(await aparece(cerrada, 30000) && await v.locator("[data-form-alta]").count() === 0, "cerrado: el link no muestra el formulario", "cerrado: el formulario sigue");
  chequear(/no te podés anotar/.test(await cerrada.innerText()), "cerrado: dice que hoy no se puede anotar", `cerrado: dice “${(await cerrada.innerText()).slice(0, 80)}”`);
  const hrefWa = await v.locator("[data-whatsapp-gimnasio]").getAttribute("href");
  chequear(!!hrefWa && hrefWa.startsWith("https://wa.me/"), "cerrado: da el WhatsApp del gimnasio", "cerrado: no hay WhatsApp");
  await capturar(v, "qr-alta-celu-cerrado", true);
  await v.context().close();

  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
  await d.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
