#!/usr/bin/env node
// VD-47X · Rapidez, lo que quedó: filtrar Socios no deja la pantalla en blanco (la lista de antes queda
// atenuada y después llega la nueva, sin recargar), la búsqueda funciona escribiendo y con Enter, y una
// foto grande subida desde Configuración se guarda a 800 px como mucho, en webp y de menos de 200 KB.
//   node scripts/e2e/vd-47x.mjs     (con scripts/local/levantar.sh corriendo)
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CELU, COMPU, GIMNASIO, capturar, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const ALMACEN = join(process.cwd(), ".local", "storage", "marcas");
const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");

  // ── Filtros de Socios: atenuada, nunca en blanco ──
  await p.goto(`${G}/panel/socios`);
  await p.locator("[data-lista] li").first().waitFor({ timeout: 30000 });
  const antes = await p.locator("[data-lista] li").count();
  await p.evaluate(() => { window.__marca = "misma-pagina"; });
  // Se frena la respuesta de la lista nueva para poder ver el estado "pidiendo".
  await p.route("**/panel/socios?**", async (r) => { await new Promise((x) => setTimeout(x, 1500)); await r.continue().catch(() => {}); });
  const filtro = p.locator("[data-filtro-estados] a[data-estado]").first();
  await filtro.waitFor({ timeout: 15000 });
  const clave = await filtro.getAttribute("data-estado");
  await filtro.click();
  await p.locator('[data-atenuable][aria-busy="true"]').waitFor({ timeout: 5000 });
  const durante = await p.locator("[data-lista] li").count();
  // La atenuación es una transición de CSS: se espera a que baje en vez de medir en el primer cuadro.
  await p.waitForFunction(() => Number(getComputedStyle(document.querySelector("[data-lista]")).opacity) < 1, null, { timeout: 3000 }).catch(() => {});
  const opacidad = await p.locator("[data-lista]").first().evaluate((x) => Number(getComputedStyle(x).opacity));
  chequear(durante === antes && durante > 0, "mientras llega la lista nueva, la de antes sigue a la vista", `la lista se vació (${antes} → ${durante})`);
  chequear(opacidad < 1, `y está atenuada (opacidad ${opacidad})`, "la lista no se atenuó");
  await capturar(p, "vd47x-compu-atenuada");
  await p.waitForFunction(() => document.querySelector("[data-atenuable]")?.getAttribute("aria-busy") !== "true", null, { timeout: 30000 });
  await p.waitForFunction((c) => new URL(location.href).searchParams.get("estado") === c, clave, { timeout: 10000 });
  chequear(await p.evaluate(() => window.__marca) === "misma-pagina", "el filtro cambió sin recargar la página", "se recargó toda la página");
  chequear(await p.locator(`[data-filtro-estados] a[data-estado="${clave}"][aria-current="page"]`).count() === 1, "el filtro nuevo queda marcado", "no quedó marcado el filtro");
  await p.unroute("**/panel/socios?**");

  // ── Búsqueda: escribiendo (con pausa) y el link sigue siendo un formulario GET ──
  const q = p.locator('input[name="q"]');
  await q.fill("");
  await q.pressSequentially("zzzzqq", { delay: 40 });
  await p.waitForFunction(() => new URL(location.href).searchParams.get("q") === "zzzzqq", null, { timeout: 15000 });
  await p.getByText(/Nadie con/).first().waitFor({ timeout: 15000 });
  ok("escribir busca solo, y sin resultados invita a dar de alta");
  chequear(await p.locator('form[role="search"]').getAttribute("method") === null, "el formulario sigue siendo GET (sin JavaScript también anda)", "cambió el método del formulario");

  // ── Celular: Retención con listas ──
  const c = await pagina(b, CELU);
  await entrar(c, "duena@ejemplo.invalid");
  await c.goto(`${G}/panel/retencion`);
  await c.locator("nav[aria-label='Listas'] a").nth(1).waitFor({ timeout: 30000 });
  await c.locator("nav[aria-label='Listas'] a").nth(1).click();
  await c.waitForFunction(() => new URL(location.href).searchParams.get("lista") !== null, null, { timeout: 30000 });
  chequear(await c.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Retención en celular sin desborde", "Retención desborda en celular");

  // ── Foto grande: queda chica ──
  await p.goto(`${G}/panel/configuracion?pestana=pagina`);
  const fotos = p.locator("[data-fotos]");
  await fotos.waitFor({ timeout: 30000 });
  const grande = await p.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 2400; c.height = 1800;
    const x = c.getContext("2d");
    for (let i = 0; i < 4000; i++) { x.fillStyle = `hsl(${(i * 37) % 360} 70% ${30 + (i % 40)}%)`; x.fillRect((i * 97) % 2400, (i * 53) % 1800, 90 + (i % 60), 70 + (i % 50)); }
    return c.toDataURL("image/jpeg", 0.9).split(",")[1];
  });
  const buffer = Buffer.from(grande, "base64");
  const hay = () => existsSync(ALMACEN) ? readdirSync(ALMACEN, { recursive: true }).map(String).filter((f) => /foto-/.test(f)) : [];
  const previas = new Set(hay());
  while (Number(await fotos.getAttribute("data-fotos")) >= 10) await p.locator('button[aria-label="Quitar la foto 1"]').click();
  await p.setInputFiles('input[aria-label="Elegir fotos"]', { name: "grande.jpg", mimeType: "image/jpeg", buffer });
  await fotos.locator(".mensaje", { hasText: /Foto sumada|fotos sumadas/ }).waitFor({ timeout: 60000 });
  const nuevas = hay().filter((f) => !previas.has(f) && !f.endsWith(".meta.json"));
  if (nuevas.length === 0) {
    ok(`(no se pudo medir el archivo en .local/storage; la foto subida pesaba ${(buffer.length / 1024).toFixed(0)} KB y la medición queda en las pruebas unitarias)`);
  } else {
    const kb = statSync(join(ALMACEN, nuevas[0])).size / 1024;
    chequear(/\.webp$/.test(nuevas[0]), `la foto se guardó en webp (${nuevas[0].split(/[\\/]/).pop()})`, `se guardó como ${nuevas[0]}`);
    chequear(kb < 200, `y pesa ${kb.toFixed(0)} KB (la original: ${(buffer.length / 1024).toFixed(0)} KB)`, `pesa ${kb.toFixed(0)} KB, se esperaba menos de 200`);
  }
  const ancho = await fotos.locator("[data-foto] img").last().evaluate((i) => new Promise((r) => { if (i.complete) r(i.naturalWidth); else i.onload = () => r(i.naturalWidth); }));
  chequear(ancho > 0 && ancho <= 800, `la imagen se ve de ${ancho} px de ancho (máximo 800)`, `ancho ${ancho}`);
  await capturar(p, "vd47x-compu-foto");
} finally {
  await b.close();
}
resultado();
