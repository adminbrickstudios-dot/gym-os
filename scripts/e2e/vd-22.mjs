#!/usr/bin/env node
// VD-22 · Entrar con Google y sesión recordada (D23). Con el Google simulado de supabase-local (sin credenciales):
// "Continuar con Google" lleva a vincular la primera vez; el Google NO se vincula por nombre ni por el mail de la ficha;
// vincula con DNI + código del celular de la ficha; el segundo ingreso entra directo; un Google que pide un socio
// que ya tiene otro Google pide confirmar; la sesión sigue al cerrar y reabrir el navegador (cookie persistente) y
// "cerrar sesión" la corta; cancelar en Google vuelve al ingreso con un aviso; celular 390 sin desbordes.
//   node scripts/e2e/vd-22.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { CELU, GIMNASIO, PANTALLA_ROTA, chequear, falla, navegador, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const [{ id: gim }] = (await db.query(`select id from public.gimnasios where slug = 'demo'`)).rows;
const k = Date.now() % 10000000;
const DNI_A = `41${String(k).padStart(6, "0").slice(-6)}`;
const DNI_B = `42${String(k).padStart(6, "0").slice(-6)}`;
const TEL_A = `+549000${String(k).padStart(7, "0")}`;
const TEL_B = `+549001${String(k).padStart(7, "0")}`;
const MAIL_B = `bea-vd22-${k}@ejemplo.invalid`;
const nuevoSocio = async (nombre, apellido, dni, tel, mail = null) =>
  (await db.query(`insert into public.socios (gimnasio_id, nombre, apellido, dni, telefono, email) values ($1,$2,$3,$4,$5,$6) returning id`, [gim, nombre, apellido, dni, tel, mail])).rows[0].id;
const socioA = await nuevoSocio("Gabriela", `Vd22 A${k}`, DNI_A, TEL_A);
const socioB = await nuevoSocio("Beatriz", `Vd22 B${k}`, DNI_B, TEL_B, MAIL_B);
const duenoDe = async (id) => (await db.query(`select usuario_id from public.socios where id = $1`, [id])).rows[0].usuario_id;
const usuarioDe = async (sub) => (await db.query(`select id from auth.users where raw_user_meta_data ->> 'google_sub' = $1`, [sub])).rows[0]?.id;

const CARPETA = join(process.cwd(), ".local");
mkdirSync(CARPETA, { recursive: true });
const ARCHIVO_GOOGLE = join(CARPETA, "google-falso.json");
const ARCHIVO_CANCELA = join(CARPETA, "google-cancela");
const googleFalso = (sub, email, nombre) => writeFileSync(ARCHIVO_GOOGLE, JSON.stringify({ sub, email, nombre }));
const codigo = (dest) => String(JSON.parse(readFileSync(join(CARPETA, "codigos.json"), "utf8"))[dest]);
const sinDesborde = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const SUB1 = `g-vd22-1-${k}`, SUB2 = `g-vd22-2-${k}`;
// El Google 1 llama igual que la socia A y usa el mail de la ficha de la socia B: ni el nombre ni el mail alcanzan.
const MAIL_G1 = `gabriela-google-${k}@ejemplo.invalid`;

const b = await navegador();
const paginas = [];
const nueva = async (opciones = {}) => { const p = await pagina(b, CELU, opciones); paginas.push(p); return p; };
const clicGoogle = async (p) => {
  await p.goto(`${G}/ingresar?modo=socio`);
  await p.locator("[data-entrar-google] a").click();
};
const dniYCodigo = async (p, dni, tel) => {
  await p.locator("input[name=dni]").fill(dni);
  await p.getByRole("button", { name: /Mandame el código/ }).click();
  await p.locator("input[name=codigo]").waitFor({ timeout: 30000 });
  await p.fill("input[name=codigo]", codigo(tel));
};

try {
  // 1 · El botón está, no desborda en 390, y la primera vez lleva a vincular (no entra a nadie).
  googleFalso(SUB1, MAIL_G1, "Gabriela Vd22");
  const p1 = await nueva();
  await p1.goto(`${G}/ingresar?modo=socio`);
  chequear(await p1.getByRole("link", { name: /Continuar con Google/ }).isVisible(), "el botón “Continuar con Google” está en el ingreso del socio", "falta el botón de Google");
  chequear(await sinDesborde(p1), "celular 390: el ingreso con el botón de Google no desborda", "el ingreso desborda en 390");
  await p1.getByRole("link", { name: /Continuar con Google/ }).click();
  await p1.waitForURL(/\/auth\/vincular/, { timeout: 60000 });
  chequear(true, "primera vez con Google: lleva a vincular, no entra a la app", "");
  chequear(await sinDesborde(p1), "celular 390: vincular sin desborde", "vincular desborda en 390");
  const g1 = await usuarioDe(SUB1);
  chequear(!!g1 && (await duenoDe(socioA)) !== g1 && (await duenoDe(socioB)) !== g1, "no se vinculó por nombre ni por el mail de otra ficha", "el Google quedó vinculado sin DNI ni código");
  // 2 · DNI que no existe: el mismo paso, y el código nunca cierra (no se averigua quién es socio).
  await p1.locator("input[name=dni]").fill("10000001");
  await p1.getByRole("button", { name: /Mandame el código/ }).click();
  await p1.locator("input[name=codigo]").waitFor({ timeout: 30000 });
  await p1.fill("input[name=codigo]", "123456");
  await p1.getByText(/El DNI o el código no son correctos/).waitFor({ timeout: 30000 });
  chequear(true, "DNI inexistente: mismo paso del código y el código no cierra, sin decir si el DNI existe", "");
  chequear((await duenoDe(socioA)) !== g1, "con un código malo no se vincula", "se vinculó con un código malo");

  // 3 · DNI + código del celular de la ficha: vincula y entra a la app.
  await p1.goto(`${G}/auth/vincular`);
  await dniYCodigo(p1, DNI_A, TEL_A);
  await p1.waitForURL(/\/app/, { timeout: 60000 });
  chequear((await duenoDe(socioA)) === g1, "DNI + código del celular: la socia A queda vinculada a ese Google y entra a la app", "el Google no quedó vinculado a la socia");
  const v = (await db.query(`select metodo, revocado_en from public.vinculos_google where socio_id = $1`, [socioA])).rows[0];
  chequear(v?.metodo === "celular" && v.revocado_en === null, "el vínculo quedó guardado (por celular, vigente)", `vínculo: ${JSON.stringify(v)}`);
  chequear((await duenoDe(socioB)) === null, "la socia B (mail igual al del Google) sigue sin cuenta", "la socia B quedó vinculada");

  // 4 · Sesión recordada: la cookie de Supabase es persistente y sobrevive a cerrar el navegador.
  const cookies = await p1.context().cookies();
  const sesion = cookies.filter((c) => /auth-token/.test(c.name));
  chequear(sesion.length > 0 && sesion.every((c) => c.expires > Date.now() / 1000 + 86400 * 30), "la cookie de la sesión es persistente (más de 30 días)", `cookies: ${sesion.map((c) => `${c.name}:${c.expires}`).join(", ")}`);
  const estado = await p1.context().storageState();
  estado.cookies = estado.cookies.filter((c) => c.expires > 0);   // cerrar el navegador borra las cookies de sesión
  const reabierto = await nueva({ storageState: estado });
  await reabierto.goto(`${G}/app`);
  chequear(/\/app/.test(reabierto.url()) && !/ingresar/.test(reabierto.url()), "se cerró y reabrió el navegador: sigue adentro, sin volver a entrar", `fue a ${reabierto.url()}`);
  chequear(!PANTALLA_ROTA.test(await reabierto.locator("body").innerText()), "la app abre sin errores tras reabrir", "la app mostró un error");

  // 5 · Un Google ya vinculado entra directo (sin DNI ni código).
  const p2 = await nueva();
  await clicGoogle(p2);
  await p2.waitForURL(/\/app/, { timeout: 60000 });
  chequear(!/vincular/.test(p2.url()), "Google ya vinculado: entra directo a la app", `fue a ${p2.url()}`);

  // 6 · Cerrar sesión la corta.
  const salida = await p2.context().request.post(`${G}/salir`);
  chequear(salida.ok(), "cerrar sesión responde bien", `salir: ${salida.status()}`);
  await p2.goto(`${G}/app`);
  chequear(/\/ingresar/.test(p2.url()), "después de cerrar sesión, /app manda al ingreso", `fue a ${p2.url()}`);

  // 7 · Otro Google (con el mail de la ficha de B) pide a la socia A, que ya tiene otro Google: pide confirmar.
  googleFalso(SUB2, MAIL_B, "Beatriz Vd22");
  const p3 = await nueva();
  await clicGoogle(p3);
  await p3.waitForURL(/\/auth\/vincular/, { timeout: 60000 });
  chequear((await duenoDe(socioB)) === null, "el Google con el mail de B tampoco vincula a B solo", "se vinculó B solo por el mail");
  await dniYCodigo(p3, DNI_A, TEL_A);
  await p3.locator("[data-vincular-confirmar]").waitFor({ timeout: 30000 });
  chequear(/otra cuenta de Google/.test(await p3.locator("[data-vincular-confirmar]").innerText()), "la socia A ya tiene otro Google: pide confirmar y lo dice", "no pidió confirmar");
  await p3.getByRole("link", { name: /No, volver/ }).click();
  await p3.waitForURL(/\/ingresar/, { timeout: 30000 });
  chequear((await duenoDe(socioA)) === g1, "dijo que no: la socia A sigue con su Google", "la socia A cambió de Google sin confirmar");

  // 8 · Ese Google se vincula a SU socia (B) con DNI + código del celular de B, y no entra a A.
  const p4 = await nueva();
  await clicGoogle(p4);
  await p4.waitForURL(/\/auth\/vincular/, { timeout: 60000 });
  await dniYCodigo(p4, DNI_B, TEL_B);
  await p4.waitForURL(/\/app/, { timeout: 60000 });
  const g2 = await usuarioDe(SUB2);
  chequear((await duenoDe(socioB)) === g2 && (await duenoDe(socioA)) === g1, "cada Google entra a su socia: B con el Google 2, A con el Google 1", "los vínculos no quedaron bien");

  // 9 · Sumar a otra persona (?sumar=1) pide confirmar y, con el "sí", guarda ambas.
  const socioC = await nuevoSocio("Carolina", `Vd22 C${k}`, `43${String(k).padStart(6, "0").slice(-6)}`, `+549002${String(k).padStart(7, "0")}`);
  await p4.goto(`${G}/auth/vincular?sumar=1`);
  await dniYCodigo(p4, `43${String(k).padStart(6, "0").slice(-6)}`, `+549002${String(k).padStart(7, "0")}`);
  await p4.locator("[data-vincular-confirmar]").waitFor({ timeout: 30000 });
  chequear(/ya entra a la ficha de/.test(await p4.locator("[data-vincular-confirmar]").innerText()), "sumar a otra persona al mismo Google pide confirmar y dice a quién ya entra", "no pidió confirmar al sumar");
  await p4.getByRole("button", { name: /Sí, vincular/ }).click();
  await p4.waitForURL(/\/app/, { timeout: 60000 });
  chequear((await duenoDe(socioC)) === g2 && (await duenoDe(socioB)) === g2, "con el “sí” el Google 2 queda con B y con C", "no quedó vinculada la segunda persona");

  // 10 · Cancelar en Google vuelve al ingreso con un aviso.
  writeFileSync(ARCHIVO_CANCELA, "1");
  const p6 = await nueva();
  await clicGoogle(p6);
  await p6.waitForURL(/google=cancelado/, { timeout: 60000 });
  chequear(await p6.getByText(/Cancelaste el ingreso con Google/).isVisible(), "cancelar en Google vuelve al ingreso con un aviso claro", "no se mostró el aviso de cancelado");
  rmSync(ARCHIVO_CANCELA, { force: true });
  chequear(await sinDesborde(p6), "celular 390: el aviso de Google no desborda", "el aviso desborda en 390");

  for (const p of paginas) if (p.errores.length) falla(`errores de la página: ${p.errores.join(" | ")}`);
} catch (err) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? err.message : err.message.split("\n")[0]}`);
} finally {
  rmSync(ARCHIVO_GOOGLE, { force: true });
  if (existsSync(ARCHIVO_CANCELA)) rmSync(ARCHIVO_CANCELA, { force: true });
  await db.query(`update public.socios set dado_de_baja_en = now(), motivo_baja = 'otro' where nombre in ('Gabriela', 'Beatriz', 'Carolina') and apellido like $1`, [`Vd22 %${k}`]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
