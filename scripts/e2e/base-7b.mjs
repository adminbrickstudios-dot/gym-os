#!/usr/bin/env node
// BASE-7 (cierre) · El asistente de punta a punta con un gimnasio casi vacío (Box Norte Demo): los 9 pasos medidos como hechos,
// vista previa del logo ANTES de guardar, "Probar conexión" de MercadoPago (contra el simulador local), el paso 6 que se tacha al
// cambiar una regla de entrada, el paso 7 que no aplica sin clases, salir y volver, y el cierre "Tu gimnasio está listo".
// (El Excel con filas malas marcadas antes de importar lo prueba soc-1.)
//   node scripts/e2e/base-7b.mjs     (con scripts/local/levantar.sh corriendo; ESCRITO, SIN CORRER: lo corre el principal)
import { COMPU, GIMNASIO, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const GB = GIMNASIO("demo-box");
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  p.setDefaultNavigationTimeout(120000);
  await entrar(p, "box@ejemplo.invalid", undefined, GB);

  const estado = async () => {
    await p.goto(`${GB}/panel/asistente`);
    await p.locator("[data-asistente]").waitFor({ timeout: 60000 });
    const hechos = await p.locator("[data-asistente-paso]").evaluateAll((els) => els.map((e) => e.getAttribute("data-hecho") === "si"));
    return hechos;
  };

  // 1) Los 9 pasos se miden: ninguno queda "para revisar".
  const antes = await estado();
  chequear(antes.length === 9, "9 pasos", `son ${antes.length}`);
  chequear(!(await p.locator("[data-asistente]").innerText()).includes("para revisar"), "ningún paso queda “para revisar”: los 9 se miden", "todavía hay pasos “para revisar”");
  // El paso 7 no aplica sin clases (el gimnasio casi vacío no da clases): cuenta como hecho y lo dice.
  const paso7 = p.locator('[data-asistente-paso="7"]');
  chequear(/no aplica/i.test(await paso7.innerText()), "paso 7: sin clases, no aplica", "paso 7 no dice que no aplica");
  // El paso 6 está pendiente hasta que se toca una regla de entrada.
  const paso6Antes = antes[5];

  // 2) Vista previa del logo antes de guardar.
  await p.goto(`${GB}/panel/configuracion?pestana=marca`);
  await p.locator('fieldset[data-pestana-activa="marca"]').waitFor({ timeout: 30000 });
  await p.setInputFiles('input[aria-label="Elegir logo"]', { name: "logo.png", mimeType: "image/png", buffer: PNG });
  const previa = p.locator('[data-vista-previa="logo"]');
  await previa.waitFor({ timeout: 15000 });
  chequear(/blob:/.test((await p.locator('[data-imagen="logo"] img').first().getAttribute("src")) ?? ""), "elegir el logo lo muestra como se va a ver, sin subirlo todavía", "no hay vista previa antes de guardar");
  await capturar(p, "base7b-vista-previa-logo");
  await previa.locator("button", { hasText: /Usar este logo/ }).click();
  await p.locator('[data-imagen="logo"] .mensaje', { hasText: /Logo listo/ }).waitFor({ timeout: 30000 });
  ok("“Usar este logo” lo guarda");

  // 3) El asistente muestra la vista previa de logo, color y portada, y el paso 2 queda hecho.
  const despuesLogo = await estado();
  chequear(await p.locator("[data-vista-marca] [data-vista-logo]").count() === 1, "el asistente muestra el logo guardado en el paso 2", "no hay vista del logo en el asistente");
  chequear(despuesLogo[1] === true, "paso 2 hecho al subir el logo", "paso 2 sigue pendiente");
  await capturar(p, "base7b-asistente-vista-marca");

  // 4) MercadoPago: conectar con credenciales de prueba y "Probar conexión".
  await p.goto(`${GB}/panel/configuracion?pestana=cobros`);
  const mp = p.locator("[data-mercadopago]");
  await mp.waitFor({ timeout: 30000 });
  await mp.locator("button", { hasText: /Conectar MercadoPago|Cambiar credenciales/ }).click();
  await mp.locator('input[placeholder="APP_USR-…"]').fill("TEST-token-de-prueba-e2e-0001");
  await mp.locator("label", { hasText: "Clave secreta" }).locator("input").fill("clave-secreta-e2e");
  await mp.locator("label", { hasText: /Prueba/ }).click();
  await mp.locator("button", { hasText: "Guardar y conectar" }).click();
  await mp.locator("[data-probar-mp]").waitFor({ timeout: 30000 });
  await mp.locator("[data-probar-mp]").click();
  await mp.locator('[role="status"]', { hasText: /La conexión funciona/ }).waitFor({ timeout: 30000 });
  ok("“Probar conexión” responde con la cuenta de MercadoPago (simulada)");

  // 4b) Lo mismo sin salir del asistente: el paso 5 trae su propio "Probar conexión".
  await estado();
  await p.locator("[data-asistente-probar-mp]").click();
  await p.locator('[data-asistente-mp] [role="status"]', { hasText: /La conexión funciona/ }).waitFor({ timeout: 30000 });
  ok("“Probar conexión” dentro del asistente (paso 5) responde con la cuenta");

  // 5) Paso 6: cambiar una regla de entrada lo tacha (se mide como hecho, en la base).
  await p.goto(`${GB}/panel/configuracion?pestana=reglas`);
  const dias = p.locator('label:has-text("Días de gracia al vencer") input');
  await dias.waitFor({ timeout: 30000 });
  const valor = Number(await dias.inputValue());
  await dias.fill(String(valor + 1));
  await p.locator('[data-pie="reglas"] button', { hasText: /^Guardar$/ }).click();   // el pie de la pestaña (arriba hay otros Guardar, como el de la meta de visitas)
  await p.locator('[data-pie="reglas"] .mensaje', { hasText: /Guardado|guardad/i }).first().waitFor({ timeout: 30000 });
  const despues6 = await estado();
  chequear(despues6[5] === true && paso6Antes === false, "paso 6: pendiente antes, hecho después de cambiar una regla de entrada", `paso 6: antes ${paso6Antes}, después ${despues6[5]}`);

  // 6) Salir y volver: sigue donde estaba.
  const otra = await pagina(b, COMPU);
  await entrar(otra, "box@ejemplo.invalid", undefined, GB);
  await otra.goto(`${GB}/panel/asistente`);
  await otra.locator("[data-asistente]").waitFor({ timeout: 60000 });
  const hechosOtra = await otra.locator("[data-asistente-paso]").evaluateAll((els) => els.map((e) => e.getAttribute("data-hecho") === "si"));
  chequear(JSON.stringify(hechosOtra) === JSON.stringify(despues6), "salir y volver desde otra sesión: los mismos pasos hechos (lo calcula la base)", "no coincide al volver");

  // 7) Al terminar: "Tu gimnasio está listo". Si quedan pasos por cargar (planes, equipo, socios) se dice cuáles.
  const pendientes = await p.locator('[data-asistente-paso][data-hecho="no"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-asistente-paso")));
  if (pendientes.length === 0) chequear(await p.locator("[data-asistente-listo]").count() === 1 && await p.locator("[data-link-rol]").count() === 4, "con los 9 hechos: “Tu gimnasio está listo” con los 4 links", "falta el cierre");
  else ok(`quedan pasos de carga (${pendientes.join(", ")}): sin cierre todavía, como corresponde`);

  if (p.errores.length) falla(`errores de página: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
