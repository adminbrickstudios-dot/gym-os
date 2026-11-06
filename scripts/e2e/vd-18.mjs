#!/usr/bin/env node
// VD-18 · Productos y stock (D21): la dueña carga un producto con foto, costo y categoría, lleva su stock,
// le entra mercadería con el remito; en Vender se ve con su foto, el stock baja con la venta, avisa
// "Queda poco" y se frena en cero; y las cuotas llevan a la hoja Cobrar. Celular sin desbordes.
//   node scripts/e2e/vd-18.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, esperarCobro, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { elegirPlan } from "./alta.mjs";

const G = GIMNASIO();
const b = await navegador();
const s5 = Date.now().toString().slice(-5);
const NOMBRE = `Barra${s5}`;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
try {
  const d = await pagina(b, COMPU);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/planes`);

  // El producto: nombre y precio, y después costo, categoría y foto.
  await d.locator('input[aria-label="Producto nuevo"]').fill(NOMBRE);
  await d.locator('input[aria-label="Precio del producto nuevo"]').fill("1.500");
  await d.locator('button:has-text("Agregar")').first().click();
  const fila = d.locator(`li[data-producto="${NOMBRE}"]`);
  await fila.waitFor({ timeout: 30000 });
  await fila.locator('button:has-text("Editar")').click();
  await fila.locator('input[aria-label="Costo del producto"]').fill("900");
  await fila.locator('input[aria-label="Categoría del producto"]').fill("Snacks");
  await fila.locator('button:has-text("Guardar")').click();
  await fila.locator("[data-margen]").waitFor({ timeout: 30000 });
  const ficha = await fila.locator("[data-ficha]").innerText();
  chequear(/Snacks/.test(ficha) && /margen \$600/.test(ficha), "la fila muestra la categoría y el margen ($1.500 − $900)", ficha);

  await fila.locator(`input[aria-label="Foto de ${NOMBRE}"]`).setInputFiles({ name: "barra.png", mimeType: "image/png", buffer: PNG });
  await fila.locator("img[data-foto]").waitFor({ timeout: 30000 });
  ok("la foto del producto se sube y aparece en la fila");

  // Stock: lo lleva contando 3 (avisa con 2); entra mercadería con remito (+2) y se cuenta de nuevo (3).
  await fila.locator('button:has-text("📦 Stock")').click();
  await fila.locator('input[aria-label="Cuántos hay ahora"]').fill("3");
  await fila.locator('input[aria-label="Avisar cuando queden"]').fill("2");
  await fila.locator('button:has-text("Llevar stock")').click();
  await fila.locator('[data-stock="3"]').waitFor({ timeout: 30000 });
  await fila.locator('button:has-text("📦 Stock")').click();
  await fila.locator('input[aria-label="Cuántos entraron"]').fill("2");
  await fila.locator('input[aria-label="Motivo de la entrada"]').fill("Distribuidora");
  await fila.locator('input[aria-label="Foto del remito"]').setInputFiles({ name: "remito.png", mimeType: "image/png", buffer: PNG });
  await fila.locator('button:has-text("Entró mercadería")').click();
  await fila.locator('[data-stock="5"]').waitFor({ timeout: 30000 });
  await fila.locator('[data-movimiento="entrada"] [data-ver-remito]').waitFor({ timeout: 30000 });
  ok("entró mercadería (quedan 5) con el remito a la vista: “Ver remito”");
  await fila.locator('input[aria-label="Cuántos contaste"]').fill("3");
  await fila.locator('button:has-text("Conté")').click();
  await fila.locator('[data-stock="3"]').waitFor({ timeout: 30000 });
  await capturar(d, "vd18-compu-productos");

  // Vender: foto, "Quedan 3"; con 1 en el carrito "Queda poco"; con 3 queda sin stock y no deja agregar.
  await d.goto(`${G}/panel/vender`);
  const tile = d.locator("main button", { hasText: NOMBRE });
  await tile.locator("[data-quedan]").waitFor({ timeout: 30000 });
  chequear(await tile.locator("img[data-foto]").count() === 1, "el botón de Vender tiene la foto del producto", "sin foto");
  chequear(/Quedan 3/.test(await tile.innerText()) && await tile.locator("[data-queda-poco]").count() === 0, "Vender: “Quedan 3”, todavía sin aviso", await tile.innerText());
  await tile.click();
  await tile.locator("[data-queda-poco]").waitFor({ timeout: 10000 });
  chequear(/Quedan 2/.test(await tile.innerText()), "con 1 en el carrito: “Quedan 2” y “Queda poco”", await tile.innerText());
  await tile.click(); await tile.click();
  chequear(await tile.isDisabled() && /Sin stock/.test(await tile.innerText()), "con 3 en el carrito el botón queda en “Sin stock” y no deja agregar más", await tile.innerText());
  await capturar(d, "vd18-compu-vender");
  await d.locator('button[aria-pressed]:has-text("Transferencia")').click();
  await d.locator('button:has-text("✅ Cobrar")').click();
  await esperarCobro(d);
  await d.goto(`${G}/panel/planes`);
  await fila.locator('[data-stock="0"]').waitFor({ timeout: 30000 });
  chequear(/Sin stock/.test(await fila.innerText()), "vendidas las 3: Planes dice “Sin stock”", await fila.innerText());
  chequear(await d.locator("[data-por-reponer]").filter({ hasText: NOMBRE }).count() === 1, "arriba: “Para reponer” nombra el producto", "no aparece en Para reponer");
  await d.goto(`${G}/panel/vender`);
  chequear(await d.locator("main button", { hasText: NOMBRE }).isDisabled(), "Vender no deja vender un producto sin stock", "el botón sigue habilitado");

  // Las cuotas llevan a Cobrar.
  await d.goto(`${G}/panel/socios/nuevo`);
  await d.locator('input[name="nombre"]').fill(`Cuota${s5}`);
  await elegirPlan(d, 0);
  await d.locator('button:has-text("Solo dar de alta")').click();
  await d.waitForURL(/\/panel\/socios\/[0-9a-f-]{36}$/, { timeout: 30000 });
  const id = d.url().split("/").pop();
  await d.goto(`${G}/panel/vender?socio=${id}`);
  await d.locator("[data-ir-cobrar]").waitFor({ timeout: 30000 });
  await d.locator("[data-ir-cobrar] [data-cobrar-abrir]").click();
  await d.locator("[data-cobrar]").waitFor({ timeout: 30000 });
  await d.locator("[data-cobrar-lineas]").getByText(/^Cuota /).first().waitFor({ timeout: 30000 });
  ok("desde Vender, “Cobrar a …” abre la hoja Cobrar con la cuota del socio");

  // Limpieza: el producto se oculta para no estorbar a otras pruebas.
  await d.goto(`${G}/panel/planes`);
  await fila.locator('button:has-text("Ocultar")').click();
  await fila.locator('text=oculto en Vender').waitFor({ timeout: 30000 });

  // Celular: Planes con el stock abierto y Vender, sin desbordes.
  const m = await pagina(b, CELU);
  await entrar(m, "duena@ejemplo.invalid");
  for (const ruta of ["/panel/planes", "/panel/vender"]) {
    await m.goto(`${G}${ruta}`);
    await m.locator("main").waitFor({ timeout: 30000 });
    if (ruta === "/panel/planes") {
      const f = m.locator(`li[data-producto="${NOMBRE}"]`);
      await f.waitFor({ timeout: 30000 });
      await f.locator('button:has-text("📦 Stock")').click();
      await capturar(m, "vd18-celu-stock");
    }
    const ancho = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    chequear(ancho <= 1, `celular 390 px: ${ruta} no se desborda`, `desborda ${ancho}px`);
  }
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
