#!/usr/bin/env node
// F2 · El super admin de Base, pantalla por pantalla y con sesión real del admin demo (admin@ejemplo.invalid):
// tablero (necesitan atención, errores) → lista con filtros, favoritos y exportar → ficha (datos y ciudad, links por rol,
// QR, lanzamiento, módulos, integraciones, errores, abono con prueba y descuento, papelera, clonar) → entrar como soporte
// con rol y motivo (y la campana del dueño) → pausar, dar de baja y restaurar → buscar a cualquiera y Ctrl+K →
// seguridad, roles y registro → comunicación (novedad por ciudad, mantenimiento, link de pago, funciones a prueba) → demos.
// Cada pantalla se captura en compu y en celular (390). Los datos de prueba (un error, un aviso de MercadoPago fallido,
// un socio) se siembran directo en la base local, como hacen cliente.mjs y base-3.mjs.
//   node scripts/e2e/super-f2.mjs        (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, PLATAFORMA as B, aparece, capturar, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";
import { altaGimnasio } from "./alta-gimnasio.mjs";

const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url });
await db.connect();
const q = async (sql, params) => (await db.query(sql, params)).rows;

const s = Date.now().toString().slice(-5);
const NOMBRE = `F2 ${s}`;
const MAIL_DUENO = `f2dueno${s}@ejemplo.invalid`;
const MAIL_SOCIO = `f2socio${s}@ejemplo.invalid`;
const CIUDAD = `Villa${s}`;
const MAIL_BRIK = "recepcion@ejemplo.invalid"; // cuenta demo a la que se le da un rol de BRIK (y se le saca al final)

const b = await navegador();
const p = await pagina(b);
p.setDefaultTimeout(30000);

/** Captura la pantalla en compu y en celular, y mira que en el celular no se desborde. */
async function ver(nombre) {
  await p.setViewportSize(CELU);
  await p.waitForFunction((w) => window.innerWidth === w, CELU.width);
  await p.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await capturar(p, `f2-${nombre}-celu`, true);
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  chequear(ancho <= CELU.width + 4, `celular: ${nombre} sin desborde (${ancho}px)`, `celular: ${nombre} mide ${ancho}px y se desborda`);
  await p.setViewportSize(COMPU);
  await capturar(p, `f2-${nombre}-compu`, true);
}
// Después de abrir, se espera a que la red se calme: /admin llega por partes (Suspense) y sin esto se mira la pantalla a medio cargar.
const abrir = async (ruta) => {
  await p.goto(`${B}${ruta}`);
  await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  if (ruta === "/admin") await p.locator("[data-tablero]").waitFor({ timeout: 30000 }).catch(() => {});
};
const existe = async (loc, ms = 20000) => aparece(loc, ms);
/** Espera (hasta 20 s) a que una consulta a la base devuelva algo verdadero: así no se depende de cuándo termina la acción del servidor. */
async function esperarBase(sql, params, que = (r) => r.length > 0) {
  for (let i = 0; i < 40; i++) { if (que(await q(sql, params))) return true; await new Promise((r) => setTimeout(r, 500)); }
  return false;
}
/** La lista de gimnasios llega por streaming: se espera a ver filas o el cartel de “ningún gimnasio”. */
const listaLista = () => p.locator("[data-gimnasio-fila], [data-sin-resultados]").first().waitFor({ timeout: 30000 });

let idGim = null;
let clave1 = null;
try {
  // ── 1. Entrar y el tablero ──
  await entrar(p, "admin@ejemplo.invalid", undefined, B);
  chequear(p.url().endsWith("/admin"), "el admin entra al super admin", `el admin cayó en ${p.url()}`);
  await p.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  if (!(await existe(p.locator("[data-tablero]"), 30000))) {
    // Sin el tablero no tiene sentido seguir: el resto depende de las pantallas nuevas.
    throw new Error("la app corriendo no tiene el super admin nuevo en /admin (¿es un build anterior a carril/b-super? hay que recompilar)");
  }
  ok("el tablero está en el inicio");
  chequear((await p.locator("[data-numero]").count()) === 7, "el tablero tiene sus 7 números", `el tablero tiene ${await p.locator("[data-numero]").count()} números`);
  const hrefs = await p.locator("[data-numero]").evaluateAll((l) => l.map((a) => a.getAttribute("href")));
  chequear(hrefs.every((h) => h && h.startsWith("/admin")), "cada número lleva a su lista", `hay números sin destino: ${hrefs.join(", ")}`);
  chequear(await existe(p.locator("[data-necesitan-atencion]")), "el tablero tiene “Necesitan atención”", "falta “Necesitan atención”");
  for (const [href, texto] of [["/admin/gimnasios", "Lista de gimnasios"], ["/admin/buscar", "Buscar a una persona"], ["/admin/seguridad", "Seguridad"], ["/admin/registro", "Registro"]]) {
    chequear((await p.locator(`nav a[href="${href}"]`).count()) === 1, `acceso a “${texto}” desde el tablero`, `falta el acceso a ${texto}`);
  }
  await ver("tablero-inicial");

  // ── 2. Un gimnasio nuevo (sin plantilla: sin planes) para recorrer todo con datos propios ──
  await altaGimnasio(p, { nombre: NOMBRE, dueno: "Dueño F2", email: MAIL_DUENO, tipo: "" });
  await p.locator("[data-alta-gimnasio] strong.numero").first().waitFor({ timeout: 60000 });
  clave1 = (await p.locator("[data-alta-gimnasio] strong.numero").first().innerText()).trim();
  ok(`gimnasio ${NOMBRE} creado (contraseña provisoria ${clave1})`);
  const g = (await q(`select id, slug from public.gimnasios where nombre = $1`, [NOMBRE]))[0];
  idGim = g.id;
  // Datos de prueba: un error de pantalla y un aviso de MercadoPago fallido. Los socios se siembran después de mirar el
  // tablero: con socios cargados el gimnasio deja de figurar con el "alta sin terminar" (así lo calcula admin_salud_v2).
  await q(`insert into public.errores_app (gimnasio_id, pantalla, mensaje) values ($1, '/panel/e2e-f2', 'Error de prueba e2e')`, [idGim]);
  await q(`insert into public.eventos_webhook (origen, tipo, id_externo, gimnasio_id, error) values ('mp_cobros', 'payment', $1, $2, 'fallo de prueba e2e')`, [`e2e${s}:lectura`, idGim]);
  ok("datos de prueba sembrados (error y aviso fallido)");

  // ── 3. Tablero con lo que necesita atención, errores y plataforma ──
  await abrir("/admin");
  const att = (tipo) => p.locator(`[data-necesitan-atencion] [data-atencion="${tipo}"]`, { hasText: NOMBRE });
  chequear(await existe(att("salud")), "necesitan atención: el alta sin terminar, con su motivo", "no aparece el motivo de salud del gimnasio nuevo");
  chequear(await existe(att("errores")), "necesitan atención: errores de las últimas 24 h", "no aparece el aviso de errores");
  chequear(/error/i.test(await att("errores").first().innerText()), "el aviso de errores dice cuántos son", "el aviso de errores no lo dice");
  chequear(await existe(att("webhooks")), "necesitan atención: aviso de MercadoPago fallido", "no aparece el aviso de webhooks");
  chequear((await att("salud").first().locator("a").getAttribute("href")) === `/admin/${idGim}`, "cada aviso tiene su botón a la ficha", "el botón del aviso no va a la ficha");
  // Ahora sí: un socio buscable y otro en la papelera (el alta deja de estar "sin terminar").
  await q(`insert into public.socios (gimnasio_id, nombre, apellido, dni, email) values ($1, 'Lucía', $2, $3, $4)`, [idGim, `Buscable${s}`, `7${s}00`, MAIL_SOCIO]);
  await q(`insert into public.socios (gimnasio_id, nombre, apellido, dado_de_baja_en, motivo_baja) values ($1, 'Beto', $2, now() - interval '2 days', 'otro')`, [idGim, `Papelera${s}`]);
  ok("socios de prueba sembrados (uno buscable y uno en la papelera)");
  const errPlat = p.locator("[data-errores-plataforma]");
  chequear(await existe(errPlat.getByText("/panel/e2e-f2")), "errores de 24 h de la plataforma, por pantalla", "no aparecen los errores de la plataforma");
  for (const sel of ["[data-plataforma]", "[data-uso-gimnasios]", "[data-mantenimiento]", "[data-link-pago]", "[data-funciones-prueba]", "[data-demos]"]) {
    chequear(await existe(p.locator(sel)), `/admin tiene ${sel}`, `falta ${sel} en /admin`);
  }
  chequear(await existe(p.locator("[data-uso-gimnasios]").getByText(NOMBRE)), "uso por gimnasio incluye al nuevo", "el uso por gimnasio no lista al nuevo");
  chequear(/Migraciones aplicadas: \d+/.test(await p.locator("[data-plataforma]").innerText()), "estado de la plataforma con las migraciones", "no muestra las migraciones");
  await ver("tablero");

  // Un plan de BRIK para probar el abono (prueba y descuento) más adelante.
  const PLAN = `Plan F2 ${s}`;
  const formPlan = p.locator("[data-planes-brik] form");
  await formPlan.locator("input").nth(0).fill(PLAN);
  await formPlan.locator("input").nth(1).fill("30000");
  await formPlan.locator("button[type=submit]").click();
  chequear(await existe(p.locator("[data-planes-brik]").getByText(PLAN)), `plan de BRIK “${PLAN}” creado`, "no se creó el plan de BRIK");

  // ── 4. La ficha ──
  await abrir(`/admin/${idGim}`);
  chequear((await p.locator("h1").first().innerText()).includes(NOMBRE), "la ficha abre con el nombre del gimnasio", "la ficha no muestra el nombre");
  // Lista de lanzamiento
  const pasos = p.locator("[data-ficha-lanzamiento] [data-paso]");
  chequear(await existe(pasos.first()) && (await pasos.count()) === 7, "lista de lanzamiento: 7 pasos", `la lista de lanzamiento tiene ${await pasos.count()} pasos`);
  chequear((await p.locator('[data-paso="mercadopago"]').getAttribute("data-hecho")) === "no", "lanzamiento: MercadoPago todavía sin conectar", "el paso de MercadoPago figura hecho");
  chequear((await p.locator('[data-paso="primer_socio"]').getAttribute("data-hecho")) === "si", "lanzamiento: ya tiene un socio cargado", "el primer socio no figura hecho");
  chequear((await p.locator('[data-paso="primer_cobro"]').getByText("Falta").count()) === 1, "lanzamiento: lo que falta dice “Falta”", "no marca lo que falta");
  // Ciudad
  await p.locator("[data-ciudad] input").fill(CIUDAD);
  await p.locator("[data-ciudad] button", { hasText: "Guardar" }).click();
  chequear(await esperarBase(`select 1 from public.configuracion_gimnasio where gimnasio_id = $1 and ciudad = $2`, [idGim, CIUDAD]), "la ciudad se guardó en la base", "la ciudad no se guardó");
  await p.reload();
  chequear((await p.locator("[data-ciudad] input").inputValue()) === CIUDAD, `la ciudad quedó guardada (${CIUDAD})`, "la ciudad no se guardó");
  // Links por rol y QR
  const links = p.locator("[data-links-por-rol] li");
  chequear(await existe(links.first()) && (await links.count()) === 4, "links por rol: dueño, recepción, profe y socio", `hay ${await links.count()} links por rol`);
  const textoLinks = await p.locator("[data-links-por-rol]").innerText();
  chequear(["/dueno", "/recepcion", "/profe", "/socio"].every((r) => textoLinks.includes(r)), "cada link va a la puerta de su rol", "faltan puertas en los links por rol");
  chequear((await p.locator("[data-links-por-rol] button", { hasText: "Copiar" }).count()) === 4, "cada link tiene su botón Copiar", "faltan botones Copiar");
  chequear(await existe(p.locator("[data-qr-gimnasio] svg")), "el QR de la página para imprimir se dibuja", "no aparece el QR");
  // Integraciones: el aviso fallido y Reprocesar (sin MercadoPago conectado, avisa y no duplica nada)
  const fallido = p.locator("[data-webhook-fallido]");
  chequear(await existe(fallido) && /fallo de prueba e2e/.test(await fallido.first().innerText()), "integraciones: el aviso fallido con su error", "no aparece el aviso fallido");
  await fallido.first().locator("button", { hasText: "Reprocesar" }).click();
  const respuesta = fallido.first().locator("[role=alert], [role=status]");
  chequear(await existe(respuesta, 40000), `reprocesar responde: “${(await respuesta.first().innerText().catch(() => "")).slice(0, 80)}”`, "reprocesar no respondió");
  // Errores del gimnasio
  chequear(await existe(p.locator("[data-ficha-errores] [data-error-pantalla]", { hasText: "/panel/e2e-f2" })), "errores del gimnasio, por pantalla", "no aparece el error en la ficha");
  // Abono: asignar plan, prueba gratis y descuento
  const opcion = await p.locator("[data-abono-gimnasio] select option", { hasText: PLAN }).getAttribute("value");
  await p.locator("[data-abono-gimnasio] select").selectOption(opcion);
  chequear(await existe(p.locator("[data-abono-extra]"), 40000), "con plan asignado aparecen prueba, descuento y recordatorio", "no aparece el bloque de prueba y descuento");
  const extra = p.locator("[data-abono-extra]");
  await extra.locator("input[inputmode=numeric]").fill("30");
  await extra.locator("button", { hasText: "Guardar la prueba" }).click();
  await p.waitForLoadState("networkidle").catch(() => {});
  await extra.locator("label:has-text('Descuento (%)') input").fill("20");
  await extra.locator("label:has-text('Motivo') input").fill("Amigo del gimnasio (e2e)");
  const en60 = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
  await extra.locator("input[type=date]").fill(en60);
  await extra.locator("button", { hasText: "Aplicar el descuento" }).click();
  const desc = p.locator("[data-descuento]");
  chequear(await existe(desc) && /20%/.test(await desc.innerText()), "descuento del 20% con motivo y fecha de fin", "no quedó el descuento");
  chequear(/30[.,]?000|24[.,]?000/.test(await desc.innerText()), "el descuento muestra lo que paga (24.000)", "el descuento no muestra el precio final");
  chequear(await existe(p.locator("[data-recordatorio-abono], [data-abono-extra]")), "recordatorio del abono por WhatsApp (o aviso de lo que falta)", "no hay recordatorio");
  await desc.locator("button", { hasText: "Quitar" }).click();
  await desc.waitFor({ state: "detached" });
  ok("descuento quitado");
  // Clonar la configuración de otro gimnasio y papelera de planes
  await p.locator("[data-clonar] select").selectOption({ label: "Gimnasio Demo" });
  await p.locator("[data-clonar] button", { hasText: "Copiar la configuración" }).click();
  const copia = p.locator("[data-clonar] [role=status]");
  chequear(await existe(copia, 40000) && /Copiados \d+ planes/.test(await copia.innerText()), `clonar: ${(await copia.innerText().catch(() => "")).trim()}`, `clonar falló: ${await p.locator("[data-clonar] [role=alert]").innerText().catch(() => "sin mensaje")}`);
  await q(`update public.planes set activo = false where id = (select id from public.planes where gimnasio_id = $1 and activo order by nombre limit 1)`, [idGim]);
  await p.reload();
  const pap = p.locator("[data-papelera]");
  chequear(await existe(pap.getByText(new RegExp(`Papelera${s}`))), "papelera: el socio dado de baja hace 2 días", "el socio no está en la papelera");
  chequear(await existe(pap.getByText(/Plan .* \(archivado\)/)), "papelera: el plan archivado", "el plan archivado no está en la papelera");
  await pap.locator("div", { hasText: `Papelera${s}` }).last().locator("button", { hasText: "Restaurar" }).click();
  await pap.getByText(new RegExp(`Papelera${s}`)).waitFor({ state: "detached" });
  ok("el socio se restauró desde la papelera");
  await pap.locator("div", { hasText: /Plan .* \(archivado\)/ }).last().locator("button", { hasText: "Restaurar" }).click();
  await pap.getByText(/\(archivado\)/).waitFor({ state: "detached" });
  ok("el plan se restauró desde la papelera");
  // Módulos: apagar Clases (después de clonar, que copia lo prendido del otro gimnasio)
  const clases = p.locator('[data-modulos] [data-modulo="clases"]');
  chequear(await existe(clases) && (await clases.isChecked()), "módulos: Clases está prendido", "Clases no figura prendido");
  await clases.uncheck();
  await p.locator("[data-modulos] button", { hasText: "Guardar módulos" }).click();
  chequear(await esperarBase(`select 1 from public.configuracion_gimnasio where gimnasio_id = $1 and 'clases' = any (secciones_apagadas)`, [idGim]), "Clases quedó apagado en la base", "Clases no se apagó");
  await p.reload();
  chequear(!(await p.locator('[data-modulos] [data-modulo="clases"]').isChecked()), "la ficha muestra Clases apagado", "Clases volvió a figurar prendido");
  await ver("ficha");

  // ── 5. La lista de gimnasios: filtros, favoritos, exportar ──
  await abrir("/admin/gimnasios");
  await listaLista();
  chequear(await existe(p.locator("[data-filtros-lista]")), "la lista abre con sus filtros", "no aparecen los filtros");
  const filas = p.locator("[data-gimnasio-fila]");
  chequear((await filas.count()) >= 2, `la lista tiene ${await filas.count()} gimnasios`, "la lista casi no tiene gimnasios");
  await ver("lista");
  const filtrar = async (campos) => {
    await abrir("/admin/gimnasios");
    for (const [name, v] of Object.entries(campos)) {
      const el = p.locator(`[data-filtros-lista] [name=${name}]`);
      if ((await el.evaluate((n) => n.tagName)) === "SELECT") await el.selectOption(v); else await el.fill(v);
    }
    await p.locator("[data-filtros-lista] button", { hasText: "Filtrar" }).click();
    await p.waitForURL(/\/admin\/gimnasios\?/);
    await listaLista();
  };
  await filtrar({ q: NOMBRE });
  chequear((await filas.count()) === 1, "buscar por nombre deja un solo gimnasio", `buscar por nombre dejó ${await filas.count()}`);
  await filtrar({ ciudad: CIUDAD });
  chequear((await filas.count()) === 1 && (await filas.first().innerText()).includes(NOMBRE), `filtrar por ciudad (${CIUDAD})`, "el filtro de ciudad no encontró al gimnasio");
  await filtrar({ ciudad: CIUDAD, modulo: "clases" });
  chequear((await filas.count()) === 0 && (await existe(p.locator("[data-sin-resultados]"))), "filtrar por “tiene prendido Clases”: no entra el que lo apagó, y dice qué hacer", "el filtro por módulo no excluyó al gimnasio");
  await filtrar({ ciudad: CIUDAD, modulo: "vender" });
  chequear((await filas.count()) === 1, "filtrar por “tiene prendido Vender”: sí entra", "el filtro por módulo Vender no lo encontró");
  await filtrar({ q: NOMBRE, abono: "al_dia" });
  chequear((await filas.count()) === 1, "filtrar por abono al día (en prueba)", `el filtro de abono dejó ${await filas.count()}`);
  await filtrar({ q: NOMBRE, salud: "verde" });
  chequear((await filas.count()) === 0, "filtrar por salud verde: no entra (tiene el alta sin terminar)", `salud verde dejó ${await filas.count()}`);
  await filtrar({ q: NOMBRE });
  const fila = filas.first();
  chequear((await fila.locator(".pildora", { hasText: "Plan F2" }).count()) === 1, "la fila muestra el plan de BRIK", "la fila no muestra el plan");
  chequear((await fila.locator("[data-abono]").count()) === 1, "la fila muestra el estado del abono", "la fila no muestra el abono");
  chequear(/Dueño:/.test(await fila.innerText()) && (await fila.innerText()).includes(CIUDAD), "la fila muestra ciudad y dueño", "la fila no muestra ciudad y dueño");
  await fila.locator("summary", { hasText: "Links por rol" }).click();
  chequear((await fila.locator("details").innerText()).includes("/recepcion"), "“Links por rol” desde la fila", "la fila no muestra los links por rol");
  chequear((await fila.locator("[data-entrar-soporte]").count()) === 1, "la fila tiene “Entrar como soporte”", "falta Entrar como soporte en la fila");
  await fila.locator("[data-favorito]").click();
  await p.locator("[data-favorito=si]").first().waitFor();
  ok("favorito: gimnasio fijado");
  await abrir("/admin/gimnasios");
  await listaLista();
  chequear((await filas.first().innerText()).includes(NOMBRE), "los favoritos van arriba de la lista", "el favorito no quedó primero");
  await filas.first().locator("[data-favorito]").click();
  await p.locator(`[data-gimnasio-fila]:has-text("${NOMBRE}") [data-favorito=no]`).waitFor();
  ok("favorito: gimnasio liberado");
  // Exportar (con los mismos filtros)
  const href = await p.locator("[data-exportar]").getAttribute("href");
  const csv = await p.context().request.get(`${B}${href}`);
  const cuerpo = await csv.text();
  chequear(csv.status() === 200 && /text\/csv/.test(csv.headers()["content-type"] ?? "") && cuerpo.includes(NOMBRE) && cuerpo.includes(CIUDAD),
    "exportar la lista: CSV con el gimnasio y su ciudad", `exportar dio ${csv.status()} / ${csv.headers()["content-type"]}`);

  // ── 6. Entrar como soporte con rol y motivo; el dueño lo ve en la campana ──
  await abrir(`/admin/${idGim}`);
  await p.locator("#entrar [data-entrar-soporte]").click();
  const formSoporte = p.locator("#entrar [data-motivo-soporte]");
  chequear((await formSoporte.locator("select[name=rol] option").count()) === 3, "entrar como soporte: se elige el rol (dueño, recepción o profe)", "el selector de rol no tiene 3 opciones");
  await formSoporte.locator("input[name=motivo]").fill("e2e: revisar la caja con la recepción");
  await formSoporte.locator("select[name=rol]").selectOption("recepcion");
  await formSoporte.locator("button:not([type=button])").click();
  await p.waitForURL(/\/panel/, { timeout: 60000 });
  ok(`soporte dentro del gimnasio con rol recepción: “${(await p.locator("h1").first().innerText()).replace(/\s+/g, " ")}”`);
  await abrir(`/admin/${idGim}`);
  const sop = p.locator("[data-admin-soportes] [data-soporte=en-curso]");
  chequear(await existe(sop) && /revisar la caja/.test(await sop.first().innerText()) && /Recepción/.test(await sop.first().innerText()), "la ficha registra la entrada: motivo y rol", "la ficha no registra la entrada de soporte");
  await p.context().clearCookies();
  await entrar(p, MAIL_DUENO, clave1, B);
  await p.waitForURL(/\/panel/, { timeout: 60000 });
  await p.goto(`${B}/panel/campana`);
  const aviso = p.locator("[data-novedad]", { hasText: "BRIK entró a ayudarte" });
  chequear(await existe(aviso, 40000), "el dueño ve en su campana “BRIK entró a ayudarte”", "el dueño no ve el aviso en la campana");
  chequear(/como recepción/.test(await aviso.first().innerText()) && /revisar la caja/.test(await aviso.first().innerText()), "el aviso dice con qué rol entró BRIK y por qué", "el aviso no dice el rol y el motivo");
  await capturar(p, "f2-campana-duenio-compu", true);
  await p.context().clearCookies();
  await entrar(p, "admin@ejemplo.invalid", undefined, B);

  // ── 7. Pausar, dar de baja y restaurar ──
  await abrir(`/admin/${idGim}`);
  const ciclo = p.locator("[data-ciclo-de-vida]");
  await ciclo.locator("input").fill("e2e: pausa de prueba");
  await ciclo.getByRole("button", { name: "Pausar", exact: true }).click();
  chequear(await existe(ciclo.getByRole("button", { name: "Reanudar" })), "pausar: el gimnasio queda pausado y se puede reanudar", "no quedó pausado");
  await ciclo.getByRole("button", { name: "Reanudar" }).click();
  await ciclo.getByRole("button", { name: "Pausar", exact: true }).waitFor();
  ok("reanudar: vuelve a estar activo");
  await ciclo.locator("input").fill("e2e: baja de prueba");
  chequear(await ciclo.locator("button:has-text('2. Dar de baja')").isDisabled(), "dar de baja: está trabado hasta exportar", "se puede dar de baja sin exportar");
  const [descarga] = await Promise.all([p.waitForEvent("download"), ciclo.locator("a:has-text('1. Exportar todo')").click()]);
  chequear(/\.zip$/.test(descarga.suggestedFilename()), `exportar todo baja un zip (${descarga.suggestedFilename()})`, "la exportación no es un zip");
  const zip = await p.context().request.get(`${B}/admin/${idGim}/exportar`);
  const bytes = await zip.body();
  chequear(zip.status() === 200 && bytes.subarray(0, 2).toString() === "PK" && bytes.includes(Buffer.from("socios.csv")), "el zip trae socios.csv (empieza con PK)", "el zip no es válido");
  await ciclo.locator("button:has-text('2. Dar de baja')").click();
  chequear(await existe(ciclo.getByRole("button", { name: "Restaurar el gimnasio" }), 40000), "dar de baja: queda “para borrar” y se puede restaurar", "no quedó dado de baja");
  const borrar = p.locator("[data-borrar-definitivo]");
  chequear(await existe(borrar), "aparece el borrado definitivo (pide escribir el nombre)", "no aparece el borrado definitivo");
  await borrar.locator("input").fill(NOMBRE);
  await borrar.locator("button", { hasText: "Borrar definitivamente" }).click();
  chequear(await existe(borrar.locator("[role=alert]")) && /30 días/.test(await borrar.locator("[role=alert]").innerText()), "el borrado definitivo se frena antes de los 30 días", "el borrado definitivo no se frenó");
  await abrir("/admin/gimnasios");
  await listaLista();
  chequear((await filas.filter({ hasText: NOMBRE }).count()) === 0, "el gimnasio dado de baja sale de la lista", "el dado de baja sigue en la lista");
  await abrir(`/admin/${idGim}`);
  await p.locator("[data-ciclo-de-vida]").getByRole("button", { name: "Restaurar el gimnasio" }).click();
  await p.locator("[data-ciclo-de-vida]").getByRole("button", { name: "Pausar", exact: true }).waitFor();
  ok("restaurar: el gimnasio vuelve");
  await ver("ficha-ciclo");

  // ── 8. Buscar a cualquiera y Ctrl+K ──
  await abrir("/admin/buscar");
  const bus = p.locator("[data-buscar-persona]");
  chequear(await existe(bus), "la búsqueda de personas abre", "no abre /admin/buscar");
  chequear(await bus.locator("button", { hasText: "Buscar" }).isDisabled(), "buscar: sin dato y sin motivo no se puede", "se puede buscar sin motivo");
  await bus.locator("label:has-text('Mail, DNI') input").fill(MAIL_SOCIO);
  await bus.locator("label:has-text('Motivo') input").fill("e2e: me escribió y no puede entrar");
  await bus.locator("button", { hasText: "Buscar" }).click();
  const persona = p.locator("[data-persona]", { hasText: `Buscable${s}` });
  chequear(await existe(persona), "buscar por mail: aparece el socio con su gimnasio", "no apareció el socio");
  const txt = await persona.first().innerText();
  chequear(txt.includes(NOMBRE) && /Socio/.test(txt) && !txt.includes(MAIL_SOCIO) && !txt.includes(`7${s}00`), "solo nombre, gimnasio y rol: sin mail ni DNI", "el resultado muestra datos de contacto");
  const exp = await p.context().request.get(`${B}${await persona.first().locator("a:has-text('Exportar sus datos')").getAttribute("href")}`);
  chequear(exp.status() === 200 && (await exp.text()).includes(`7${s}00`), "exportar los datos del socio: archivo con su DNI", `exportar el socio dio ${exp.status()}`);
  await bus.locator("label:has-text('Mail, DNI') input").fill(MAIL_DUENO);
  await bus.locator("button", { hasText: "Buscar" }).click();
  chequear(await existe(p.locator("[data-persona]", { hasText: "Dueño en " + NOMBRE })), "buscar por mail: aparece el dueño con su rol", "no apareció el dueño");
  await ver("buscar");
  await abrir("/admin");
  await p.keyboard.press("Control+k");
  const paleta = p.locator("[data-paleta]");
  chequear(await existe(paleta), "Ctrl+K abre la paleta", "Ctrl+K no abrió la paleta");
  await paleta.locator("input").fill(`ficha F2 ${s}`);
  chequear(await existe(paleta.getByRole("option", { name: new RegExp(`Abrir la ficha de ${NOMBRE}`) })), "la paleta encuentra al gimnasio por nombre", "la paleta no encontró al gimnasio");
  await ver("paleta");
  await p.keyboard.press("Enter");
  await p.waitForURL(new RegExp(`/admin/${idGim}`), { timeout: 30000 });
  ok("Enter en la paleta abre la ficha del gimnasio");
  await abrir("/admin");
  await p.keyboard.press("Control+k");
  await p.locator("[data-paleta] input").fill("crear gimnasio");
  chequear(await existe(p.locator("[data-paleta]").getByRole("option", { name: /Crear gimnasio/ })), "la paleta ofrece acciones (“Crear gimnasio”)", "la paleta no ofrece acciones");
  await p.keyboard.press("Escape");
  await p.locator("[data-paleta]").waitFor({ state: "detached" });
  ok("Escape cierra la paleta");

  // ── 9. Seguridad, roles de BRIK y registro ──
  await abrir("/admin/seguridad");
  chequear(await existe(p.locator("[data-dos-pasos]")), "seguridad: la verificación en dos pasos del admin", "no aparece la verificación en dos pasos");
  const eq = p.locator("[data-equipo-brik]");
  chequear(await existe(eq.getByText("Segundo factor obligatorio")) && await existe(eq.getByText("Usuarios de BRIK")), "seguridad: segundo factor obligatorio y usuarios de BRIK", "faltan las secciones de seguridad");
  chequear(await existe(eq.getByText("admin@ejemplo.invalid")), "el equipo de BRIK lista al admin con su rol", "no aparece el admin en el equipo de BRIK");
  await eq.locator("input[type=email]").fill(MAIL_BRIK);
  await eq.locator("select").selectOption("lectura");
  await eq.locator("button", { hasText: "Dar o cambiar el rol" }).click();
  const filaBrik = eq.locator("li", { hasText: MAIL_BRIK });
  chequear(await existe(filaBrik) && /Solo lectura/.test(await filaBrik.innerText()), "roles: la cuenta quedó como “Solo lectura”", "no se dio el rol de BRIK");
  await ver("seguridad");
  await filaBrik.locator("button", { hasText: "Sacar" }).click();
  await filaBrik.waitFor({ state: "detached" });
  ok("roles: se le sacó el rol de BRIK");
  await abrir("/admin/registro");
  const reg = p.locator("[data-registro]");
  chequear(await existe(reg.first()), "el registro de BRIK tiene entradas", "el registro está vacío");
  const regTxt = await p.locator("main").innerText();
  chequear(/entrar como soporte/.test(regTxt) && /buscar persona/.test(regTxt) && /dar rol brik/.test(regTxt), "el registro muestra lo que hizo BRIK (soporte, búsqueda, roles)", "el registro no muestra las acciones");
  chequear(/e2e: me escribió y no puede entrar/.test(regTxt), "el registro guarda el motivo de cada búsqueda", "el registro no guarda el motivo");
  await ver("registro");

  // ── 10. Comunicación: novedad por ciudad, mantenimiento, link de pago, funciones a prueba ──
  await abrir("/admin");
  const nov = p.locator("[data-novedades-admin]");
  const publicar = async (titulo, ciudad) => {
    await nov.locator("label:has-text('Título') input").fill(titulo);
    await nov.locator("label:has-text('Texto') textarea").fill(`Texto de la novedad ${titulo}`);
    await nov.locator("label:has-text('Solo a la ciudad') input").fill(ciudad);
    await nov.locator("button[type=submit]").click();
    await nov.locator("li", { hasText: titulo }).waitFor({ timeout: 30000 });
  };
  await publicar(`Solo ${CIUDAD}`, CIUDAD);
  await publicar(`Solo Otra${s}`, `Otra${s}`);
  const liA = nov.locator("li", { hasText: `Solo ${CIUDAD}` }), liB = nov.locator("li", { hasText: `Solo Otra${s}` });
  chequear(/le llega a 1\b/.test(await liA.innerText()) && new RegExp(`solo ${CIUDAD}`).test(await liA.innerText()), "novedad segmentada por ciudad: le llega a 1 gimnasio", `la novedad de ${CIUDAD} dice: ${(await liA.innerText()).replace(/\s+/g, " ")}`);
  chequear(/le llega a 0\b/.test(await liB.innerText()), "novedad de otra ciudad: no le llega a ninguno", "la novedad de otra ciudad llega a alguien");
  await ver("comunicacion");
  await liA.locator("button", { hasText: "Retirar" }).click();
  await liA.waitFor({ state: "detached" });
  await liB.locator("button", { hasText: "Retirar" }).click();
  await liB.waitFor({ state: "detached" });
  ok("novedades retiradas");
  // Mantenimiento
  const man = p.locator("[data-mantenimiento]");
  const local = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const desde = new Date(Date.now() + 36 * 3600e3), hasta = new Date(Date.now() + 37 * 3600e3);
  const TXT_MANT = `Mantenimiento e2e ${s}`;
  await man.locator("label:has-text('Desde') input").fill(local(desde));
  await man.locator("label:has-text('Hasta') input").fill(local(hasta));
  await man.locator("label:has-text('Qué va a pasar') input").fill(TXT_MANT);
  await man.locator("button", { hasText: "Programar el aviso" }).click();
  const filaMant = man.locator("div", { hasText: TXT_MANT }).filter({ has: p.locator("button", { hasText: "Cancelar" }) }).last();
  chequear(await existe(filaMant), "mantenimiento programado: aparece con su hora", "no aparece el aviso de mantenimiento");
  await filaMant.locator("button", { hasText: "Cancelar" }).click();
  await man.getByText(TXT_MANT).waitFor({ state: "detached" });
  ok("mantenimiento cancelado");
  // Link de pago
  const LINK = `https://pago.ejemplo.invalid/brik-${s}`;
  await p.locator("[data-link-pago] input").fill(LINK);
  await p.locator("[data-link-pago] button", { hasText: "Guardar" }).click();
  chequear(await esperarBase(`select 1 from public.plataforma_ajustes where clave = 'link_pago' and valor = to_jsonb($1::text)`, [LINK]), "el link de pago de BRIK quedó guardado", "el link de pago no se guardó");
  await p.reload();
  chequear((await p.locator("[data-link-pago] input").inputValue()) === LINK, "el link de pago se ve al volver a abrir", "el link de pago no vuelve a mostrarse");
  // Funciones a prueba
  const fun = p.locator("[data-funciones-prueba]");
  await fun.locator("input").fill("tv_nueva");
  await fun.locator("select").selectOption({ label: NOMBRE });
  await fun.locator("button", { hasText: "Prender" }).click();
  const filaFun = fun.locator("div", { hasText: `tv_nueva en ${NOMBRE}` }).last();
  chequear(await existe(filaFun), "función a prueba prendida solo en un gimnasio", "no quedó la función a prueba");
  await filaFun.locator("button", { hasText: "Apagar" }).click();
  await fun.getByText(`tv_nueva en ${NOMBRE}`).waitFor({ state: "detached" });
  ok("función a prueba apagada");

  // ── 11. Demos para reuniones ──
  const INTERESADO = `Reunión ${s}`;
  const demos = p.locator("[data-demos]");
  await demos.locator("input").fill(INTERESADO);
  await demos.locator("button", { hasText: "Crear demo" }).click();
  chequear(await existe(demos.locator("[role=status]"), 60000) && /Demo lista/.test(await demos.locator("[role=status]").innerText()), "demo para una reunión creada (vence en 7 días)", `no se creó la demo: ${await demos.locator("[role=alert]").innerText().catch(() => "sin mensaje")}`);
  const d = (await q(`select id, es_demo, demo_hasta, nombre from public.gimnasios where demo_para = $1`, [INTERESADO]))[0];
  chequear(d && d.es_demo && /^\[demo\]/.test(d.nombre) && d.demo_hasta > new Date(Date.now() + 6 * 864e5), "la demo es un gimnasio [demo] aparte con 7 días", "la demo no quedó como gimnasio [demo]");
  await abrir("/admin/gimnasios");
  await listaLista();
  chequear((await filas.filter({ hasText: INTERESADO }).count()) === 1, "la demo figura en la lista de gimnasios", "la demo no está en la lista");
  await q(`update public.gimnasios set demo_hasta = now() - interval '1 hour' where id = $1`, [d.id]);
  await abrir("/admin");
  const venc = p.locator("[data-demos-vencidas]");
  chequear(await existe(venc) && (await venc.innerText()).includes(INTERESADO), "la demo vencida aparece en “demos vencidas” (se calcula, sin cron)", "no aparece la demo vencida");
  await venc.locator("button", { hasText: "Borrar demos vencidas" }).click();
  await venc.waitFor({ state: "detached" });
  ok("“Borrar demos vencidas” las da de baja");
  await abrir("/admin/gimnasios");
  await listaLista();
  chequear((await filas.filter({ hasText: INTERESADO }).count()) === 0, "la demo borrada sale de la lista", "la demo borrada sigue en la lista");
  await ver("demos");

  if (p.errores.length) falla(`errores en la página: ${p.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${e.message.split("\n")[0]}`);
  await capturar(p, "ROTA-super-f2", true).catch(() => {});
} finally {
  // Dejar la base como estaba: la cuenta demo no queda como admin de BRIK.
  await q(`delete from public.administradores_plataforma where usuario_id = (select id from auth.users where email = $1)`, [MAIL_BRIK]).catch(() => {});
  await db.end().catch(() => {});
}
await b.close();
resultado();
