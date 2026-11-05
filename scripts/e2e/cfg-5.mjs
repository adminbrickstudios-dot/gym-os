#!/usr/bin/env node
// CFG-5 · Mensajes editables con vista previa: un cambio de plantilla se ve
// en Retención y en Vencen hoy; "Volver al original" lo deshace.
//   npm run e2e:cfg-5            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const NUEVO = "Che {nombre}, tu {plan} vence el {vence}. Son {debe}.";

// Los textos de WhatsApp que arma una pantalla (los links wa.me).
async function mensajesDe(p, ruta) {
  await p.goto(`${G}${ruta}`);
  await p.locator("main").waitFor();
  return p.locator('a[href^="https://wa.me/"]').evaluateAll((xs) =>
    xs.map((x) => decodeURIComponent(new URL(x.getAttribute("href")).searchParams.get("text") ?? "")));
}

const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  const abrir = async () => {
    await p.goto(`${G}/panel/configuracion?pestana=mensajes`);
    await p.locator('[data-mensajes][data-listo="true"]').waitFor({ timeout: 30000 });
  };
  await abrir();
  const tarjeta = (clave) => p.locator(`[data-mensaje="${clave}"]`);
  const vista = (clave) => tarjeta(clave).locator("[data-vista-previa]");
  const esperarRespuesta = async (clave, accion) => {
    const antes = Number(await tarjeta(clave).getAttribute("data-respuestas"));
    await accion();
    await p.waitForFunction(([c, n]) => Number(document.querySelector(`[data-mensaje="${c}"]`)?.getAttribute("data-respuestas")) > n, [clave, antes], { timeout: 30000 });
    return (await tarjeta(clave).locator(".mensaje").first().innerText()).replace(/\s+/g, " ").trim();
  };
  // Si una corrida anterior lo dejó cambiado, se vuelve al original primero.
  if (await tarjeta("por_vencer").locator('button:has-text("Volver al original")').count()) {
    await esperarRespuesta("por_vencer", () => tarjeta("por_vencer").locator('button:has-text("Volver al original")').click());
  }

  chequear(await p.locator("[data-mensaje]").count() === 8, "los 8 mensajes están", `hay ${await p.locator("[data-mensaje]").count()} mensajes`);
  const originalRetencion = (await mensajesDe(p, "/panel/retencion?lista=por_vencer")).filter(Boolean);
  chequear(originalRetencion.length > 0 && originalRetencion.every((m) => /Te recordamos/.test(m)), `Retención arma ${originalRetencion.length} mensajes con el texto original`, "Retención no tiene mensajes por vencer");
  await abrir();

  // ── Vista previa con un socio real, sin guardar ──
  await tarjeta("por_vencer").locator("textarea").fill(NUEVO);
  await vista("por_vencer").locator("p", { hasText: "Che " }).waitFor({ timeout: 15000 });
  const previa = (await vista("por_vencer").innerText()).replace(/\s+/g, " ");
  chequear(/Así lo recibe .+ \(.+\):/.test(previa) && !/[{}]/.test(previa.split(":").slice(1).join(":")), `vista previa: “${previa}”`, `la vista previa quedó: ${previa}`);
  chequear(await aparece(tarjeta("por_vencer").locator("[data-sin-guardar]")), "avisa cambios sin guardar", "no avisa cambios sin guardar");
  chequear(await p.locator('button[data-pestana="mensajes"] [aria-label="cambios sin guardar"]').count() === 1, "la pestaña Mensajes queda marcada con •", "la pestaña no marca los cambios");
  let m = await esperarRespuesta("por_vencer", () => tarjeta("por_vencer").locator('button:has-text("Guardar")').click());
  chequear(/Guardado/.test(m), "guardar el mensaje", `guardar dio “${m}”`);
  await capturar(p, "cfg5-compu-mensajes");

  // ── Se ve en Retención y en Vencen hoy ──
  const enRetencion = (await mensajesDe(p, "/panel/retencion?lista=por_vencer")).filter(Boolean);
  chequear(enRetencion.length > 0 && enRetencion.every((x) => /^Che \S+, tu .+ vence el .+\. Son \$[\d.]+\.$/.test(x)),
    `Retención usa el mensaje nuevo: “${enRetencion[0]}”`, `Retención: ${enRetencion.slice(0, 2).join(" | ")}`);
  const enVencen = (await mensajesDe(p, "/panel/vencen-hoy")).filter(Boolean);
  chequear(enVencen.length === 0 || enVencen.every((x) => /^Che /.test(x)), `Vencen hoy usa el mensaje nuevo (${enVencen.length})`, `Vencen hoy: ${enVencen.slice(0, 2).join(" | ")}`);
  if (!enVencen.length) ok("(hoy nadie vence en el demo: Vencen hoy sale de la misma cuenta que Retención)");

  // ── Variables: un chip se suma; una que no existe se avisa ──
  await abrir();
  const cumple = tarjeta("cumpleanos");
  await cumple.locator("textarea").fill("Feliz cumple ");
  await cumple.locator('button:has-text("{nombre}")').click();
  chequear(/Feliz cumple \{nombre\}/.test(await cumple.locator("textarea").inputValue()), "tocar {nombre} lo suma al texto", "el chip no sumó la variable");
  await cumple.locator("textarea").fill("Feliz {cosa}, debés {debe}");
  await cumple.locator('[data-vista-previa] [role="alert"]').waitFor({ timeout: 15000 });
  m = (await cumple.locator('[data-vista-previa] [role="alert"]').innerText()).trim();
  chequear(/no se puede usar \{cosa\}, \{debe\}/.test(m), `variable que no existe → “${m}”`, `variable inventada dio “${m}”`);
  m = await esperarRespuesta("cumpleanos", () => cumple.locator('button:has-text("Guardar")').click());
  chequear(/no se puede usar/.test(m), "y no se guarda", `se guardó igual: “${m}”`);
  await cumple.locator("textarea").fill("");
  m = await esperarRespuesta("cumpleanos", () => cumple.locator('button:has-text("Guardar")').click());
  chequear(/no puede quedar vacío/.test(m), `vacío → “${m}”`, `vacío dio “${m}”`);
  await cumple.locator('button:has-text("Volver al original")').click();
  await p.waitForTimeout(800);

  // ── Volver al original ──
  m = await esperarRespuesta("por_vencer", () => tarjeta("por_vencer").locator('button:has-text("Volver al original")').click());
  chequear(/Volvió al original/.test(m) && /Te recordamos/.test(await tarjeta("por_vencer").locator("textarea").inputValue()), "“Volver al original” restaura el texto", `volver al original dio “${m}”`);
  const otraVez = (await mensajesDe(p, "/panel/retencion?lista=por_vencer")).filter(Boolean);
  chequear(otraVez.every((x) => /Te recordamos/.test(x)), "Retención vuelve al mensaje original", "Retención sigue con el mensaje cambiado");
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
  await p.context().close();

  // ── Encargado: también edita mensajes ──
  const e = await pagina(b, COMPU);
  await entrar(e, "encargado@ejemplo.invalid");
  await e.goto(`${G}/panel/configuracion?pestana=mensajes`);
  await e.locator('[data-mensajes][data-listo="true"]').waitFor({ timeout: 30000 });
  const bienvenida = e.locator('[data-mensaje="bienvenida"]');
  await bienvenida.locator("textarea").fill("¡Bienvenido {nombre}!");
  await bienvenida.locator('button:has-text("Guardar")').click();
  await bienvenida.locator(".mensaje", { hasText: "Guardado" }).waitFor({ timeout: 30000 });
  ok("encargado: edita y guarda un mensaje");
  await bienvenida.locator('button:has-text("Volver al original")').click();
  await bienvenida.locator(".mensaje", { hasText: "Volvió al original" }).waitFor({ timeout: 30000 });
  await e.context().close();

  // ── Celular ──
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/configuracion?pestana=mensajes`);
  await c.locator('[data-mensajes][data-listo="true"]').waitFor({ timeout: 30000 });
  await c.locator('[data-mensaje="por_vencer"] [data-vista-previa] p', { hasText: "Hola" }).waitFor({ timeout: 15000 });
  const ancho = await c.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `celular: Mensajes sin desborde (${ancho}px)`, `celular: Mensajes mide ${ancho}px`);
  await capturar(c, "cfg5-celu-mensajes", true);
  await c.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
