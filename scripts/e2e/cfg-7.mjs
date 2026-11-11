#!/usr/bin/env node
// CFG-7 · Apagar una sección: avisa qué deja de andar, y ninguna pantalla
// prendida lleva a una apagada. Para cada sección: se apaga desde
// Configuración → Secciones, se abren todas las pantallas del panel (y una
// ficha) y se buscan links a la sección apagada; después se vuelve a prender.
//   npm run e2e:cfg-7            (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, PANTALLA_ROTA, capturar, chequear, entrar, entrarSocio, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const RUTAS = ["/panel", "/panel/entrada", "/panel/clases", "/panel/vencen-hoy", "/panel/socios", "/panel/retencion",
  "/panel/vender", "/panel/caja", "/panel/transferencias", "/panel/planes", "/panel/equipo", "/panel/configuracion", "/panel/cuenta"];
const SECCIONES = [
  ["entrada", "Entrada", "/panel/entrada"], ["vencen_hoy", "Vencen hoy", "/panel/vencen-hoy"], ["socios", "Socios", "/panel/socios"],
  ["retencion", "Retención", "/panel/retencion"], ["vender", "Vender", "/panel/vender"], ["caja", "Caja", "/panel/caja"],
  ["transferencias", "Transferencias", "/panel/transferencias"], ["clases", "Clases", "/panel/clases"],
];

const b = await navegador();
try {
  const p = await pagina(b, COMPU);
  await entrar(p, "duena@ejemplo.invalid");
  // Una ficha y la entrada con un socio elegido: pantallas con botones a otras secciones.
  await p.goto(`${G}/panel/socios`);
  const ficha = await p.locator('a[href^="/panel/socios/"]').evaluateAll((xs) => xs.map((x) => x.getAttribute("href")).find((h) => /\/panel\/socios\/[0-9a-f-]{36}$/.test(h)));
  const rutas = [...RUTAS, ficha];

  const secciones = async () => {
    await p.goto(`${G}/panel/configuracion?pestana=secciones`);
    await p.locator('fieldset[data-pestana-activa="secciones"]').waitFor({ timeout: 30000 });
    await p.waitForTimeout(800);   // que React tome la pantalla
  };
  const guardar = async () => {
    const pie = p.locator('[data-pie="secciones"]');
    const antes = Number(await pie.getAttribute("data-respuestas"));
    await pie.locator('button:has-text("Guardar")').click();
    await p.waitForFunction((n) => Number(document.querySelector('[data-pie="secciones"]')?.getAttribute("data-respuestas")) > n, antes, { timeout: 30000 });
    return (await pie.locator(".mensaje").first().innerText()).replace(/\s+/g, " ").trim();
  };
  const interruptor = (nombre) => p.locator("fieldset[data-pestana-activa] label").filter({ hasText: new RegExp(`^${nombre}`) }).locator('input[role="switch"]');

  for (const [clave, nombre, ruta] of SECCIONES) {
    await secciones();
    await interruptor(nombre).uncheck();
    if (clave !== "clases") {
      const aviso = await p.locator(`[data-al-apagar="${clave}"]`).innerText().catch(() => "");
      chequear(/Apagada: /.test(aviso), `${nombre}: al apagarla avisa “${aviso.replace("Apagada: ", "")}”`, `${nombre}: no avisa qué cambia`);
    }
    const m = await guardar();
    if (!/Guardado/.test(m)) { falla(`${nombre}: no se pudo apagar: ${m}`); continue; }

    const problemas = [];
    for (const r of rutas) {
      const res = await p.goto(`${G}${r}`);
      await p.locator("main").waitFor();
      const texto = await p.locator("main").innerText().catch(() => "");
      const propia = r === ruta || r.startsWith(`${ruta}/`);
      if (propia) { if (!/apagada/i.test(texto)) problemas.push(`${r} (es de la sección) no dice que está apagada`); continue; }
      if (res.status() >= 500 || PANTALLA_ROTA.test(texto)) { problemas.push(`${r} se rompe (${res.status()})`); continue; }
      const links = await p.locator("a[href]").evaluateAll((xs) => xs.map((x) => x.getAttribute("href")));
      const malos = links.filter((h) => h === ruta || h.startsWith(`${ruta}/`) || h.startsWith(`${ruta}?`));
      if (malos.length) problemas.push(`${r} lleva a ${[...new Set(malos)].slice(0, 2).join(", ")}${malos.length > 2 ? "…" : ""}`);
    }
    chequear(problemas.length === 0, `${nombre} apagada: ${rutas.length} pantallas abiertas, ninguna lleva a ella`, `${nombre} apagada: ${problemas.join(" | ")}`);

    if (clave === "transferencias") {
      const c = await pagina(b, CELU);
      await entrarSocio(c, "+5490000100002");
      await c.locator("text=/Podés entrar|No podés entrar/").first().waitFor({ timeout: 30000 });
      chequear(await c.locator("text=Pagar por transferencia").count() === 0, "con Transferencias apagada, la app no pide comprobantes", "la app sigue pidiendo comprobantes");
      await c.context().close();
    }
    if (clave === "socios") {
      // La entrada busca igual, y el resultado no ofrece ficha ni alta.
      await p.goto(`${G}/panel/entrada`);
      await p.locator("input").first().waitFor();
      await p.waitForTimeout(800);
      await p.locator("input").first().fill("zzzz-nadie");
      await p.locator("text=No encontramos").waitFor({ timeout: 30000 });
      chequear(await p.locator('a:has-text("Darlo de alta")').count() === 0, "sin Socios, Entrada no ofrece dar de alta", "Entrada ofrece dar de alta con Socios apagada");
      await capturar(p, "cfg7-compu-entrada-sin-socios");
    }

    await secciones();
    await interruptor(nombre).check();
    const m2 = await guardar();
    if (!/Guardado/.test(m2)) falla(`${nombre}: no se pudo volver a prender: ${m2}`);
  }
  await secciones();
  await interruptor("Socios").uncheck(); await interruptor("Vender").uncheck();
  await capturar(p, "cfg7-compu-avisos", true);
  if (p.errores.length) falla(`dueña: ${p.errores.join(" | ")}`);
  ok("todas las secciones probadas apagadas y vueltas a prender");
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
}
await b.close();
resultado();
