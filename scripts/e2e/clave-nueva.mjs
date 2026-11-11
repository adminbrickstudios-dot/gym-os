#!/usr/bin/env node
// C1 · "Olvidé mi contraseña" sin mails. ESCRITO, NO EJECUTADO por quien lo escribió (los ayudantes no levantan la app).
//   node scripts/e2e/clave-nueva.mjs     (con scripts/local/levantar.sh corriendo, sin SMTP_CONFIGURADO)
//
//  1. Sin SMTP, "Olvidé mi contraseña" dice "Pedile una clave nueva a la recepción".
//  2. La recepción abre la ficha de un socio SIN cuenta (solo con mail) y toca "Nueva clave":
//     la cuenta se crea, la clave se muestra una vez, con Copiar y WhatsApp (wa.me con el mensaje armado).
//  3. El socio entra a su app con su mail y esa clave.
//  4. Segunda vuelta: la recepción le da otra clave (ahora con cuenta); la vieja deja de servir y la nueva entra.
//  5. El dueño le da una clave nueva a la recepción desde Equipo y ella entra al panel.
//  6. Quien no puede, no ve el botón: la recepción no tiene "Nueva contraseña" en Equipo (esa pantalla es del dueño).
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, COMPU, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const sufijo = Date.now() % 1000000;
const MAIL = `clave-${sufijo}@ejemplo.invalid`;
const NOMBRE = `Clave${sufijo}`;
const [{ id: socio }] = (await db.query(
  `insert into public.socios (gimnasio_id, nombre, apellido, email, telefono) values ($1,$2,'Sin Cuenta',$3,'+5490000770099') returning id`, [gim, NOMBRE, MAIL])).rows;
const b = await navegador();

/** Toca "Nueva clave" en la ficha y devuelve la clave que se muestra. */
async function pedirClave(p) {
  await p.goto(`${G}/panel/socios/${socio}`);
  const caja = p.locator("[data-nueva-clave]");
  await caja.getByRole("button", { name: /Nueva clave/ }).click();
  const clave = caja.locator("[data-clave-nueva]");
  await clave.waitFor({ timeout: 60000 });
  return { caja, clave: (await clave.innerText()).trim() };
}

try {
  // 1 · Sin SMTP, el aviso manda a la recepción.
  const o = await pagina(b, CELU);
  await o.goto(`${G}/ingresar/recuperar`);
  const aviso = o.locator("[data-sin-smtp]");
  await aviso.waitFor({ timeout: 30000 });
  chequear(/Pedile una clave nueva a la recepción/.test(await aviso.innerText()), "sin SMTP, “Olvidé mi contraseña” dice “Pedile una clave nueva a la recepción”", "el aviso no manda a la recepción");
  await o.context().close();

  // 2 · La recepción le da la clave (el socio no tenía cuenta).
  const r = await pagina(b, COMPU);
  r.setDefaultNavigationTimeout(120000);
  await entrar(r, "recepcion@ejemplo.invalid");
  const { caja, clave } = await pedirClave(r);
  chequear(clave.length >= 8, `se muestra una clave provisoria (${clave.length} letras)`, "no se mostró la clave");
  chequear(/Le creamos la cuenta con/.test(await caja.innerText()), "como no tenía cuenta, se la creó con su mail", "no dice que creó la cuenta");
  chequear(await caja.getByRole("button", { name: /Copiar clave/ }).isVisible(), "hay botón Copiar", "falta el botón Copiar");
  const wa = await caja.locator("[data-compartir-clave]").getAttribute("href");
  const texto = decodeURIComponent((wa ?? "").split("?text=")[1] ?? "");
  chequear(/^https:\/\/wa\.me\/5490000770099\?text=/.test(wa ?? "") && texto.includes(MAIL) && texto.includes(clave) && /\/ingresar\?modo=socio/.test(texto),
    "WhatsApp va al celular del socio con el mensaje armado (link, mail y clave)", `el link de WhatsApp está mal: ${wa}`);
  const [{ n }] = (await db.query(`select count(*)::int n from public.claves_entregadas where socio_id = $1`, [socio])).rows;
  chequear(n === 1, "quedó registrado quién la generó", `el registro tiene ${n} filas`);
  const [{ v }] = (await db.query(`select count(*)::int v from public.claves_entregadas where socio_id = $1 and to_jsonb(claves_entregadas)::text like '%' || $2 || '%'`, [socio, clave])).rows;
  chequear(v === 0, "el registro no guarda la clave", "la clave quedó guardada");
  await caja.locator("[data-clave-lista]").click();
  chequear(await caja.locator("[data-clave-nueva]").count() === 0, "“Listo” oculta la clave: no se vuelve a mostrar", "la clave sigue a la vista");

  // 3 · El socio entra con su mail y esa clave.
  const s = await pagina(b, CELU);
  s.setDefaultNavigationTimeout(120000);
  await s.goto(`${G}/ingresar?modo=socio`);
  await s.fill("input[type=email]", MAIL);
  await s.fill("input[type=password]", clave);
  await s.click("button[type=submit]");
  await s.waitForURL(/\/app/, { timeout: 60000 });
  await s.getByText(new RegExp(`Hola, ${NOMBRE}`)).waitFor({ timeout: 60000 });
  ok("el socio entra a su app con su mail y la clave que le dieron");
  await s.context().close();

  // 4 · Otra clave: la vieja deja de servir.
  const otra = await pedirClave(r);
  chequear(otra.clave !== clave, "la segunda clave es otra", "devolvió la misma clave");
  chequear(/La anterior ya no sirve/.test(await otra.caja.innerText()), "avisa que la anterior ya no sirve", "no avisa que la anterior dejó de servir");
  const s2 = await pagina(b, CELU);
  await s2.goto(`${G}/ingresar?modo=socio`);
  await s2.fill("input[type=email]", MAIL);
  await s2.fill("input[type=password]", clave);
  await s2.click("button[type=submit]");
  await s2.locator("[role=alert]", { hasText: /no son correctos/ }).waitFor({ timeout: 30000 });
  ok("la clave anterior ya no entra");
  await s2.fill("input[type=password]", otra.clave);
  await s2.click("button[type=submit]");
  await s2.waitForURL(/\/app/, { timeout: 60000 });
  ok("la clave nueva entra");
  await s2.context().close();

  // 6 · La recepción no cambia claves del equipo: esa pantalla no es suya.
  await r.goto(`${G}/panel/equipo`);
  chequear(await r.locator('button:has-text("Nueva contraseña")').count() === 0, "la recepción no ve “Nueva contraseña” en Equipo", "la recepción ve el botón del equipo");
  await r.context().close();

  // 5 · El dueño le da una clave nueva a la recepción desde Equipo.
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, "duena@ejemplo.invalid");
  await d.goto(`${G}/panel/equipo`);
  const fila = d.locator("li", { hasText: "Ana" }).first();
  await fila.locator('button:has-text("Nueva contraseña")').click();
  const claveEquipo = fila.locator("[data-clave-nueva]");
  await claveEquipo.waitFor({ timeout: 60000 });
  const claveAna = (await claveEquipo.innerText()).trim();
  chequear(await fila.locator("[data-compartir-clave]").getAttribute("href").then((h) => /\/ingresar/.test(decodeURIComponent(h ?? "")) && decodeURIComponent(h ?? "").includes(claveAna)),
    "el dueño ve la clave de Ana con el mensaje armado para WhatsApp", "el mensaje del equipo no lleva el link y la clave");
  const a = await pagina(b, COMPU);
  a.setDefaultNavigationTimeout(120000);
  await entrar(a, "recepcion@ejemplo.invalid", claveAna);
  chequear(/\/panel/.test(a.url()), "la recepción entra al panel con la clave nueva", `no entró: ${a.url()}`);
  // Se deja la clave de la demo como estaba, para no romper otros e2e.
  await d.goto(`${G}/panel/equipo`);
  const fila2 = d.locator("li", { hasText: "Ana" }).first();
  await fila2.locator("input[name=contrasena_elegida]").fill("demo-gymos");
  await fila2.locator('button:has-text("Nueva contraseña")').click();
  await fila2.locator("[data-clave-nueva]").waitFor({ timeout: 60000 });
  ok("se restauró la clave de la demo");
  await a.context().close();
  await d.context().close();

  if (r.errores?.length) falla(`recepción: ${r.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  await db.query(`update public.socios set dado_de_baja_en = now(), motivo_baja = 'otro' where id = $1`, [socio]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
