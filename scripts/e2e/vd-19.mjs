#!/usr/bin/env node
// VD-19 · Eventos completos: la dueña crea un evento con flyer, dos fechas (una es hoy),
// precio de socio y de no socio → el socio se anota desde la app (y ve su precio) → la
// recepción lo reconoce en la ventana de Entrada y le marca la presencia → la dueña cierra
// el evento y queda "Asistieron 1 de 1". Aparte: desde la página, alguien que no es socio
// se anota (si la página del demo está publicada).
//   node scripts/e2e/vd-19.mjs     (con scripts/local/levantar.sh corriendo)
import { CELU, COMPU, GIMNASIO, aparece, capturar, chequear, entrar, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const s = Date.now().toString().slice(-5);
const NOMBRE = `Taller ${s}`;
const ZONA = "America/Argentina/Buenos_Aires";
// PNG de 1x1: el servidor lo achica y lo sube igual que un flyer de verdad.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const local = (ms) => new Intl.DateTimeFormat("sv-SE", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms)).replace(" ", "T");

const b = await navegador();
try {
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/eventos`);
  await d.locator('button:has-text("Nuevo evento")').click();
  const f = d.locator("[data-nuevo-evento]");
  await f.locator("input").first().fill(NOMBRE);
  await f.locator('input[type="datetime-local"]').first().fill(local(Date.now() + 4 * 60e3));
  await f.locator('input[inputmode="numeric"]').fill("1");
  await f.locator('input[inputmode="decimal"]').first().fill("5.000");
  await f.locator("[data-precio-socio]").fill("3.000");
  await f.locator('input[maxlength="120"]').fill("Sala 2");
  await f.locator("[data-otra-fecha]").click();
  await f.locator('[data-fechas-extra] input[type="datetime-local"]').fill(local(Date.now() + 3 * 864e5));
  await f.locator("[data-flyer]").setInputFiles({ name: "flyer.png", mimeType: "image/png", buffer: PNG });
  await f.locator('button[type="submit"]').click();
  const fila = d.locator("[data-evento]", { hasText: NOMBRE });
  await fila.waitFor({ timeout: 60000 });
  const texto = await fila.innerText();
  chequear(/Socio \$3\.000/.test(texto) && /No socio \$5\.000/.test(texto), "la dueña crea el evento con precio de socio y de no socio", texto);
  chequear(/2 fechas/.test(texto) && /Sala 2/.test(texto), "con dos fechas (un ciclo) y el lugar", texto);
  await d.reload();
  chequear(await aparece(d.locator("[data-evento]", { hasText: NOMBRE }).locator("img[data-flyer-evento]"), 30000), "con su flyer", "el evento no muestra el flyer");

  // El socio se anota desde la app y ve el precio que le toca.
  const so = await pagina(b, CELU);
  so.setDefaultNavigationTimeout(120000);
  await entrar(so, "socio@ejemplo.invalid");
  await so.goto(`${G}/app`);
  const tarjeta = so.locator("[data-evento-app]", { hasText: NOMBRE });
  chequear(await aparece(tarjeta, 60000), "la app lista el evento con su flyer", "la app no muestra el evento");
  chequear(/\$3\.000/.test(await tarjeta.innerText()) && (await tarjeta.locator("img").count()) === 1, "la app muestra el precio de socio y el flyer", await tarjeta.innerText());
  await tarjeta.locator("[data-anotarme]").click();
  await so.locator(`[data-evento-app="${NOMBRE}"] [data-evento-estado="anotado"]`).waitFor({ timeout: 60000 });
  ok("el socio se anota desde la app: “Estás anotado”");
  chequear(!(await tarjeta.locator("[data-anotarme]").count()), "y ya no ofrece anotarse otra vez", "sigue el botón Anotarme");
  const ancho = await so.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  chequear(ancho <= 1, "celular 390 px sin desbordes", `se desborda ${ancho}px`);
  await capturar(so, "vd19-celu-app");

  // La recepción lo reconoce en la Entrada y le marca la presencia.
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  await r.goto(`${G}/panel/socios`);
  await r.locator('main ul a[href^="/panel/socios/"]').first().waitFor({ timeout: 30000 });
  await r.keyboard.press("F2");
  const campo = r.locator("[data-ventana-campo]");
  await campo.waitFor({ timeout: 10000 });
  await campo.fill("Testigo Al Día");
  await r.locator("button.fila", { hasText: "Testigo Al Día" }).first().click();
  const aviso = r.locator("[data-ventana-evento]", { hasText: NOMBRE });
  chequear(await aparece(aviso, 30000), "la Entrada reconoce al anotado: “Hoy: " + NOMBRE + "”", "la Entrada no muestra el evento de hoy");
  await capturar(r, "vd19-compu-entrada");
  await aviso.locator("[data-evento-marcar]").click();
  chequear(await aparece(aviso.locator("[data-evento-presente]"), 30000), "un toque marca la presencia en el evento", "no quedó presente");
  await r.keyboard.press("Escape");

  // La dueña ve quién fue y cierra el evento: queda el resumen.
  await d.goto(`${G}/panel/eventos`);
  const f2 = d.locator("[data-evento]", { hasText: NOMBRE });
  // El día del evento la lista ya viene abierta: tocar el resumen la CERRARÍA. Solo se abre si está cerrada.
  const lista = f2.locator("details", { has: d.locator("summary", { hasText: "Anotados" }) }).first();
  if (!(await lista.evaluate((x) => x.open))) await lista.locator("summary").click();
  chequear(await aparece(f2.locator('[data-presente="si"]'), 30000), "la lista del evento muestra al presente", "la lista no muestra presentes");
  chequear(/Pagó|Falta pagar/.test(await f2.locator("[data-lista-anotados]").innerText()), "y si pagó o falta pagar", "la lista no dice si pagó");
  await f2.locator("[data-cerrar-evento]").click();
  const cerrado = d.locator('[data-evento="cerrado"]', { hasText: NOMBRE });
  await cerrado.waitFor({ timeout: 60000 });
  chequear(/Asistieron 1 de 1/.test(await cerrado.innerText()), "al cerrar queda “Asistieron 1 de 1 anotados”", await cerrado.innerText());
  await capturar(d, "vd19-compu-cerrado");

  // La página: alguien que no es socio se anota (solo si el demo tiene la página publicada y hay un evento abierto).
  const NOM2 = `Abierto ${s}`;
  await d.locator('button:has-text("Nuevo evento")').click();
  const g = d.locator("[data-nuevo-evento]");
  await g.locator("input").first().fill(NOM2);
  await g.locator('input[type="datetime-local"]').first().fill(local(Date.now() + 5 * 864e5));
  await g.locator('input[inputmode="numeric"]').fill("3");
  await g.locator('input[inputmode="decimal"]').first().fill("0");
  await g.locator('button[type="submit"]').click();
  await d.locator("[data-evento]", { hasText: NOM2 }).waitFor({ timeout: 60000 });
  const v = await pagina(b, CELU);
  v.setDefaultNavigationTimeout(120000);
  await v.goto(`${G}/`);
  if (await aparece(v.locator("h1").first(), 30000) && (await v.locator("[data-eventos-landing]").count())) {
    const t = v.locator("[data-evento-pagina]", { hasText: NOM2 });
    await t.locator("[data-abrir-anotarse]").click();
    await t.locator('input[name="nombre"]').fill("Visitante Prueba");
    await t.locator('input[name="dni"]').fill(`3${s}77`);
    await t.locator('input[name="telefono"]').fill("11 0000 1234");
    // La página pide unos segundos desde que se abre ESTE formulario (anti-robot; cada formulario tiene su contador): mandarlo antes da "muy rápido".
    await t.locator('input[name="segundos"]').evaluate(async (el) => { for (let i = 0; i < 100 && Number(el.value) < 3; i++) await new Promise((r) => setTimeout(r, 300)); });
    await t.locator('button[type="submit"]').click();
    chequear(await aparece(v.locator("[data-anotado-pagina]"), 60000), "desde la página, quien no es socio se anota (DNI y WhatsApp)", "la página no confirmó la inscripción");
    await capturar(v, "vd19-celu-pagina");
  } else ok("la página del demo no está publicada ahora: la inscripción desde la página la prueba la base");
} finally {
  await b.close();
}
resultado();
