#!/usr/bin/env node
// VD-43 · Gimnasio nuevo: los primeros pasos se tachan SOLOS al cumplirse (se calculan de los datos reales, nunca se
// guardan) y los datos de ejemplo se cargan y se borran en un botón sin tocar lo real.
//   node scripts/e2e/vd-43.mjs     (con scripts/local/levantar.sh corriendo)
//
// Cada paso se cumple como lo haría su pantalla (los datos que escribe cada una); lo que se mira es Inicio, que no
// guarda nada y se actualiza solo. La parte de planes/horarios con pantallas reales ya la recorre onb-1.mjs.
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { CELU, COMPU, CLAVE_DEMO, GIMNASIO, chequear, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const q = async (s, p) => (await db.query(s, p)).rows;
const claves = Object.fromEntries(execSync("node scripts/local/supabase-local.mjs claves").toString().trim().split(/\r?\n/).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? `http://127.0.0.1:${process.env.PUERTO_SUPABASE ?? "54321"}`, claves.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const s = Date.now().toString().slice(-6);
const SLUG = `nuevo${s}`;
const MAIL = `nuevo${s}@ejemplo.invalid`;
const G = GIMNASIO(SLUG);
const PASOS = ["gimnasio", "marca", "planes", "horarios", "cobros", "equipo", "socios", "entrada", "pagina"];

const b = await navegador();
try {
  // ── Un gimnasio recién creado: sin nada cargado ──
  const [{ id: g }] = await q(`insert into public.gimnasios (slug, nombre) values ($1, $2) returning id`, [SLUG, `Nuevo ${s}`]);
  await q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'subdominio')`, [g, `${SLUG}.localhost`]);
  const [{ id: sede }] = await q(`select id from public.sedes where gimnasio_id = $1`, [g]);
  const { data, error } = await supabase.auth.admin.createUser({ email: MAIL, password: CLAVE_DEMO, email_confirm: true });
  if (error) throw new Error(`crear usuario: ${error.message}`);
  const [{ id: dueno }] = await q(`insert into public.equipo (gimnasio_id, nombre, rol) values ($1, 'Dueño Nuevo', 'dueno') returning id`, [g]);
  const vinc = await supabase.rpc("vincular_usuario_equipo", { p_equipo_id: dueno, p_usuario_id: data.user.id });
  if (vinc.error) throw new Error(`vincular: ${vinc.error.message}`);
  await q(`update public.configuracion_gimnasio set modo_clases = 'ninguno', medios_aceptados = '{efectivo,transferencia}', alias_transferencia = null, cbu = null where gimnasio_id = $1`, [g]);
  // U4: un gimnasio nuevo nace con la página ya publicada (siempre hay una landing); el paso "Publicar tu página" se prueba solo si arranca oculta.
  await q(`update public.landing_gimnasio set publicada = false where gimnasio_id = $1`, [g]);
  ok(`crea el gimnasio ${SLUG}.localhost con su dueño, sin datos`);

  const p = await pagina(b, COMPU);
  p.setDefaultNavigationTimeout(120000);
  await entrar(p, MAIL, undefined, G);
  const tarjeta = p.locator("[data-primeros-pasos]");
  const abrir = async () => {
    await p.goto(`${G}/panel`);
    await p.locator("h1").first().waitFor({ timeout: 60000 });
    await tarjeta.waitFor({ timeout: 60000 });
    if (await tarjeta.locator('button[aria-expanded="false"]').count()) await tarjeta.locator('button:has-text("Ver todos los pasos")').click();
  };
  const estado = async () => {
    const r = {};
    for (const k of PASOS) r[k] = (await tarjeta.locator(`[data-paso="${k}"]`).getAttribute("data-hecho")) === "true";
    return r;
  };
  await abrir();
  const antes = await estado();
  const hechosAntes = Number(await tarjeta.getAttribute("data-primeros-pasos"));
  chequear(hechosAntes === 0, `un gimnasio nuevo arranca con 0 de ${PASOS.length} pasos`, `arranca con ${hechosAntes} pasos hechos`);
  chequear(PASOS.every((k) => antes[k] === false), "ningún paso viene tachado de entrada", JSON.stringify(antes));

  // ── Cada paso se tacha solo, y solo ese ──
  const cumplir = {
    gimnasio: async () => {
      await q(`update public.landing_gimnasio set whatsapp = '+5490001112222' where gimnasio_id = $1`, [g]);
      await q(`update public.sedes set direccion = 'Calle Ficticia 1' where id = $1`, [sede]);
    },
    marca: () => q(`update public.configuracion_gimnasio set logo_path = $1 where gimnasio_id = $2`, [`${g}/marca/logo-${"a".repeat(32)}.png`, g]),
    planes: async () => {
      const [{ id }] = await q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1,'membresia','Mensual E2e',1,'desde_pago') returning id`, [g]);
      await q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1,$2,25000,'2020-01-01T00:00:00Z')`, [g, id]);
    },
    horarios: () => q(`insert into public.horarios_apertura (gimnasio_id, sede_id, dia, abre, cierra) values ($1,$2,1,'07:00','22:00')`, [g, sede]),
    cobros: () => q(`update public.configuracion_gimnasio set alias_transferencia = 'nuevo.e2e.alias' where gimnasio_id = $1`, [g]),
    equipo: () => q(`insert into public.equipo (gimnasio_id, nombre, rol) values ($1, 'Recepción Nueva', 'recepcion')`, [g]),
    socios: () => q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1, 'Socia', 'Real E2e')`, [g]),
    entrada: async () => {
      const [{ id }] = await q(`select id from public.socios where gimnasio_id = $1 and not es_ejemplo limit 1`, [g]);
      await q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, via_acceso, resultado, color, motivo, texto) values ($1,$2,$3,'recepcion','entro','verde','prueba','prueba')`, [g, sede, id]);
    },
    pagina: () => q(`update public.landing_gimnasio set publicada = true where gimnasio_id = $1`, [g]),
  };
  let previos = antes; let n = 0;
  for (const k of PASOS) {
    await cumplir[k]();
    n++;
    if (n === PASOS.length) {
      // Con todos los pasos hechos la tarjeta desaparece sola.
      await p.goto(`${G}/panel`);
      await p.locator("h1").first().waitFor({ timeout: 60000 });
      chequear(await p.locator("[data-primeros-pasos]").count() === 0, "con el último paso cumplido, la tarjeta de primeros pasos desaparece sola", "la tarjeta sigue con todo hecho");
      break;
    }
    await abrir();
    const ahora = await estado();
    const hechos = Number(await tarjeta.getAttribute("data-primeros-pasos"));
    const cambiaron = PASOS.filter((x) => ahora[x] !== previos[x]);
    chequear(ahora[k] === true && cambiaron.length === 1 && hechos === n, `“${k}”: se tacha solo (${hechos} de ${PASOS.length}) sin tocar los otros`, `“${k}”: ${JSON.stringify(ahora)} (cambiaron ${cambiaron.join(",")}), hechos ${hechos}`);
    previos = ahora;
  }

  // ── Datos de ejemplo, en un gimnasio sin socios reales ──
  const [{ id: g2 }] = await q(`insert into public.gimnasios (slug, nombre) values ($1, $2) returning id`, [`ej${s}`, `Ejemplos ${s}`]);
  await q(`insert into public.dominios_gimnasio (gimnasio_id, host, tipo) values ($1, $2, 'subdominio')`, [g2, `ej${s}.localhost`]);
  const [{ id: plan2 }] = await q(`insert into public.planes (gimnasio_id, tipo, nombre, duracion_meses, renovacion) values ($1,'membresia','Mensual Ej',1,'desde_pago') returning id`, [g2]);
  await q(`insert into public.precios_plan (gimnasio_id, plan_id, monto, vigente_desde) values ($1,$2,25000,'2020-01-01T00:00:00Z')`, [g2, plan2]);
  const mail2 = `ej${s}@ejemplo.invalid`;
  const u2 = await supabase.auth.admin.createUser({ email: mail2, password: CLAVE_DEMO, email_confirm: true });
  if (u2.error) throw new Error(`crear usuario 2: ${u2.error.message}`);
  const [{ id: dueno2 }] = await q(`insert into public.equipo (gimnasio_id, nombre, rol) values ($1, 'Dueña Ejemplos', 'dueno') returning id`, [g2]);
  const v2 = await supabase.rpc("vincular_usuario_equipo", { p_equipo_id: dueno2, p_usuario_id: u2.data.user.id });
  if (v2.error) throw new Error(`vincular 2: ${v2.error.message}`);
  const G2 = GIMNASIO(`ej${s}`);
  const d = await pagina(b, COMPU);
  d.setDefaultNavigationTimeout(120000);
  await entrar(d, mail2, undefined, G2);
  await d.goto(`${G2}/panel`);
  await d.locator("[data-ofrecer-ejemplos]").waitFor({ timeout: 60000 });
  ok("un gimnasio sin socios ofrece “Cargar 10 socios de ejemplo”");
  await d.locator("[data-cargar-ejemplos]").click();
  await d.locator("[data-datos-ejemplo]").waitFor({ timeout: 60000 });
  chequear(/Estás viendo datos de ejemplo/.test(await d.locator("[data-datos-ejemplo]").innerText()), "queda el aviso fijo “Estás viendo datos de ejemplo · Borrarlos”", "no hay aviso de ejemplos");
  const ej = await q(`select telefono, email, es_ejemplo from public.socios where gimnasio_id = $1`, [g2]);
  chequear(ej.length === 10 && ej.every((x) => x.es_ejemplo && x.telefono.startsWith("+549000") && x.email.endsWith("@ejemplo.invalid")),
    "son 10 socios ficticios (teléfonos +54 9 000…, mails @ejemplo.invalid) marcados como ejemplo", JSON.stringify(ej.slice(0, 2)));
  await d.locator("[data-primeros-pasos]").waitFor({ timeout: 30000 });
  if (await d.locator('[data-primeros-pasos] button[aria-expanded="false"]').count()) await d.locator('[data-primeros-pasos] button:has-text("Ver todos los pasos")').click();
  chequear((await d.locator('[data-paso="socios"]').getAttribute("data-hecho")) === "false", "los ejemplos no tachan el paso “Tus socios”", "los ejemplos tacharon “Tus socios”");

  // Los reales no se tocan al borrar: se suma uno real, se borran los ejemplos.
  await q(`insert into public.socios (gimnasio_id, nombre, apellido) values ($1, 'Socio', 'Real Intacto')`, [g2]);
  await d.locator("[data-borrar-ejemplos]").click();
  await d.locator("[data-datos-ejemplo]").waitFor({ state: "detached", timeout: 60000 });
  const quedan = await q(`select nombre, es_ejemplo from public.socios where gimnasio_id = $1`, [g2]);
  chequear(quedan.length === 1 && quedan[0].nombre === "Socio" && !quedan[0].es_ejemplo, "“Borrarlos” saca los 10 y deja el socio real intacto", JSON.stringify(quedan));
  chequear((await q(`select 1 from public.suscripciones where gimnasio_id = $1`, [g2])).length === 0, "se fueron también sus planes de ejemplo", "quedaron suscripciones de ejemplo");
  chequear((await d.locator('[data-paso="socios"]').getAttribute("data-hecho", { timeout: 30000 })) === "true", "con un socio real, “Tus socios” se tacha", "no se tachó con un socio real");
  if (d.errores.length) falla(`dueña: ${d.errores.join(" | ")}`);

  // ── Celular 390 px: sin desbordes ──
  const c = await pagina(b, CELU);
  await entrar(c, MAIL, undefined, G);
  await c.goto(`${G}/panel`);
  await c.locator("h1").first().waitFor({ timeout: 60000 });
  const desborde = await c.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  chequear(!desborde, "en el celular, Inicio del gimnasio nuevo no se desborda", "en el celular hay scroll horizontal");
  if (p.errores.length) falla(`dueño: ${p.errores.join(" | ")}`);
} finally {
  await db.end().catch(() => {});
  await b.close();
}
resultado();
