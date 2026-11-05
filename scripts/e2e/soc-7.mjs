#!/usr/bin/env node
// SOC-7 · Foto del socio: con la cámara (de mentira, la de Chrome) desde la
// ficha; se ve en la ficha y en la Entrada; la dirección de la foto pide
// sesión del equipo; cambiarla borra la anterior; quitarla vuelve a las iniciales.
//   npm run e2e:soc-7            (con scripts/local/levantar.sh corriendo)
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { COMPU, GIMNASIO, chequear, entrar, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const b = await navegador({ camara: true });
const fotosEn = (carpeta) => { const d = join(process.cwd(), ".local", "storage", "fotos_socios", carpeta); return existsSync(d) ? readdirSync(d, { recursive: true }).filter((f) => String(f).endsWith(".jpg")) : []; };
try {
  const p = await pagina(b, COMPU);
  await p.context().grantPermissions(["camera"]);
  await entrar(p, "recepcion@ejemplo.invalid");
  await p.goto(`${G}/panel/socios`);
  const fila = p.locator('main ul a[href^="/panel/socios/"]').first();
  await fila.waitFor({ timeout: 30000 });
  const href = await fila.getAttribute("href");
  const id = href.split("/").pop();
  const nombre = (await fila.innerText()).split("#")[0].trim();
  await p.goto(`${G}${href}`);
  await p.locator("[data-foto]").waitFor();
  if (await p.locator('[data-foto="si"]').count()) {   // una corrida anterior la dejó: se quita primero
    await p.locator('button[aria-label="Cambiar la foto"]').click();
    await p.locator('button:has-text("Quitar la foto")').click();
    await p.locator('[data-foto="no"]').waitFor({ timeout: 30000 });
  }
  await p.locator('button[aria-label="Sacar una foto"]').click();
  await p.locator('button:has-text("Sacar foto")').waitFor({ timeout: 15000 });
  await p.waitForTimeout(800);
  await p.locator('button:has-text("Sacar foto")').click();
  await p.locator('[data-foto="si"] img').waitFor({ timeout: 30000 });
  await p.waitForFunction(() => { const x = document.querySelector('[data-foto="si"] img'); return x && x.complete && x.naturalWidth > 0; }, null, { timeout: 15000 });
  const ok1 = await p.locator('[data-foto="si"] img').evaluate((x) => x.naturalWidth === 480);
  chequear(ok1, "con la cámara: la foto (480×480) queda en la ficha", "la foto no se ve en la ficha");
  const carpeta = fotosEn("");
  chequear(carpeta.length > 0 && carpeta.some((f) => String(f).includes(id)), "se guardó en el bucket privado, en la carpeta del socio", `bucket: ${carpeta.join(", ")}`);

  // Entrada
  await p.goto(`${G}/panel/entrada`);
  await p.locator('input[aria-label="Buscar socio"]').fill(nombre.split(" ")[0]);
  await p.locator("button.fila", { hasText: nombre }).first().click();
  const img = p.locator("[data-foto-entrada]");
  await img.waitFor({ timeout: 30000 });
  await p.waitForFunction(() => { const x = document.querySelector("[data-foto-entrada]"); return x && x.complete; }, null, { timeout: 15000 });
  chequear(await img.evaluate((x) => x.naturalWidth === 480 && x.style.display !== "none"), "en la Entrada se ve la foto al elegirlo", "la Entrada no muestra la foto");

  // Sin sesión: no
  const anon = await pagina(b, COMPU);
  const r = await anon.goto(`${G}/panel/socios/${id}/foto`);
  chequear(!r.headers()["content-type"]?.startsWith("image/"), "sin sesión, la dirección de la foto no la da", "la foto se ve sin sesión");
  await anon.context().close();

  // Cambiarla borra la anterior; quitarla vuelve a las iniciales.
  await p.goto(`${G}${href}`);
  const antes = fotosEn("").filter((f) => String(f).includes(id)).length;
  await p.locator('button[aria-label="Cambiar la foto"]').click();
  // Una imagen de verdad, dibujada en el navegador.
  const png = Buffer.from((await p.evaluate(() => { const c = document.createElement("canvas"); c.width = 640; c.height = 480;
    const x = c.getContext("2d"); x.fillStyle = "#3b82f6"; x.fillRect(0, 0, 640, 480); return c.toDataURL("image/png"); })).split(",")[1], "base64");
  await p.setInputFiles('input[aria-label="Elegir una imagen"]', { name: "x.png", mimeType: "image/png", buffer: png });
  await p.locator('[role="dialog"]').waitFor({ state: "detached", timeout: 30000 });
  const despues = fotosEn("").filter((f) => String(f).includes(id)).length;
  chequear(antes === 1 && despues === 1, "cambiar la foto deja una sola (la anterior se borra)", `antes ${antes}, después ${despues}`);
  await p.locator('button[aria-label="Cambiar la foto"]').click();
  await p.locator('button:has-text("Quitar la foto")').click();
  await p.locator('[data-foto="no"]').waitFor({ timeout: 30000 });
  chequear(fotosEn("").filter((f) => String(f).includes(id)).length === 0, "quitarla vuelve a las iniciales y borra el archivo", "quedó el archivo");
  if (p.errores.length) falla(`recepción: ${p.errores.join(" | ")}`);
  await p.context().close();
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
