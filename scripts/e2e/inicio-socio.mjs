#!/usr/bin/env node
// Paneles completos · El Inicio de la app del socio (celular): dice claro si puede entrar hoy y por qué, el QR (o el DNI) está arriba de todo,
// los botones de todos los días están, no desborda, y la ocupación / avisos / recomendación que ahora viajan en el lote no rompen nada.
// El aviso "te quedan N días" (llave aviso_vencimiento) apagada no aparece (con la llave prendida lo prueba la base: profe-id-y-aviso-vencimiento).
//   node scripts/e2e/inicio-socio.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador();
try {
  const s = await pagina(b, CELU);
  const errores = [];
  s.on("pageerror", (e) => errores.push(e.message));
  await entrar(s, "socio@ejemplo.invalid");
  await s.goto(`${G}/app`);
  await s.getByText(/Podés entrar|No podés entrar/).first().waitFor({ timeout: 60000 });

  // 1 · el estado, con su motivo
  const veredicto = (await s.getByText(/Podés entrar|No podés entrar/).first().innerText()).trim();
  const texto = await s.locator("main section").first().innerText();
  chequear(/\S{6,}/.test(texto.replace(veredicto, "")), `el estado “${veredicto}” trae su motivo`, "el estado no explica por qué");
  ok(`el Inicio dice “${veredicto}”`);

  // 2 · cómo entra: el QR, el QR bloqueado, el escaneo, o el DNI: uno de los cuatro, y arriba (no más abajo del 7° bloque de la pantalla)
  const bloque = s.locator("[data-bloque-qr]");
  await bloque.waitFor({ timeout: 30000 });
  const lugar = await bloque.evaluate((el) => { let n = 0; for (let x = el.previousElementSibling; x; x = x.previousElementSibling) n++; return n; });
  chequear(lugar <= 8, `cómo entra queda arriba (bloque ${lugar + 1})`, `cómo entra quedó en el bloque ${lugar + 1}: muy abajo`);
  const hay = await s.locator("[data-bloque-qr] img, [data-bloque-qr] canvas, [data-bloque-qr] svg, [data-tu-dni-inicio], [data-bloque-qr] button, [data-bloque-qr] a").count();
  chequear(hay > 0, "el bloque de entrada trae el QR, el escaneo o el DNI", "el bloque de entrada está vacío");

  // 3 · "te quedan 0 días" nunca: si dice días, es 1 o más (con 0 dice "vence hoy")
  const cuerpo = await s.locator("main").innerText();
  chequear(!/quedan 0 d[ií]as|queda 0 d[ií]as/i.test(cuerpo), "nunca dice “te quedan 0 días”", "dice “te quedan 0 días”");

  // 4 · los botones de todos los días
  const botones = await s.locator("[data-boton-inicio]").count();
  chequear(botones >= 4 && botones <= 6, `${botones} botones de todos los días`, `hay ${botones} botones (se esperan de 4 a 6)`);

  // 5 · la llave del aviso de vencimiento viene apagada: no hay aviso de "te quedan N días"
  chequear(await s.locator('[data-aviso-app="vence_pronto"]').count() === 0, "con la llave apagada no hay aviso de vencimiento", "aparece el aviso de vencimiento con la llave apagada");

  // 6 · sin desborde horizontal y sin errores de página
  const ancho = await s.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width, `sin desborde (${ancho}px)`, `el Inicio desborda: ${ancho}px`);
  chequear(errores.length === 0, "sin errores de página", errores.join(" | "));
  await capturar(s, "inicio-socio");

  // 7 · un socio recargando el Inicio no pierde nada (el lote es de solo lectura)
  await s.reload();
  await s.getByText(/Podés entrar|No podés entrar/).first().waitFor({ timeout: 60000 });
  chequear((await s.getByText(/Podés entrar|No podés entrar/).first().innerText()).trim() === veredicto, "al recargar dice lo mismo", "al recargar cambió el estado");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
