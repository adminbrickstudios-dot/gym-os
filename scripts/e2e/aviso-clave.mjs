#!/usr/bin/env node
// C1b · Aviso de clave nueva: el socio ve "Te dieron una clave nueva el <fecha>, por <nombre>" en su Inicio y en Mi membresía,
// lo cierra con "Entendido" (queda en la base: recarga y no vuelve) y una entrega más nueva lo trae de nuevo.
// La entrega la deja la base como lo hace el servidor al dar la clave (la clave nunca se guarda ni se muestra).
//   node scripts/e2e/aviso-clave.mjs     (con scripts/local/levantar.sh corriendo)
import { execSync } from "node:child_process";
import pg from "pg";
import { CELU, GIMNASIO, entrar, falla, navegador, ok, pagina, resultado } from "./comun.mjs";

const G = GIMNASIO();
const url = process.env.DB_PRUEBAS_URL || execSync("scripts/db/local.sh url").toString().trim();
const db = new pg.Client({ connectionString: url }); await db.connect();
const MAIL = "socio@ejemplo.invalid";
const [{ gimnasio_id: gim, id: socio }] = (await db.query(
  `select s.gimnasio_id, s.id from public.socios s join auth.users u on u.id = s.usuario_id where u.email = $1`, [MAIL])).rows;
const [{ id: porEquipo, nombre: porNombre }] = (await db.query(
  `select id, nombre from public.equipo where gimnasio_id = $1 and rol in ('dueno', 'recepcion') and activo order by creado_en limit 1`, [gim])).rows;
const [{ zona_horaria: zona }] = (await db.query(`select zona_horaria from public.gimnasios where id = $1`, [gim])).rows;
const hoy = new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
const ids = [];
async function entregar(porUsuario = null) {
  const [{ id }] = (await db.query(
    `insert into public.claves_entregadas (gimnasio_id, socio_id, por_equipo_id, por_usuario_id) values ($1,$2,$3,$4) returning id`,
    [gim, socio, porEquipo, porUsuario])).rows;
  ids.push(id);
}
const b = await navegador();
try {
  await db.query(`update public.claves_entregadas set visto_por_socio_en = now() where socio_id = $1 and visto_por_socio_en is null`, [socio]);
  const s = await pagina(b, CELU);
  await entrar(s, MAIL);
  await s.goto(`${G}/app`);
  await s.getByText(/Hola,/).waitFor({ timeout: 60000 });
  if (await s.locator("[data-aviso-clave]").count()) falla("sin entrega no tiene que haber aviso de clave");
  else ok("sin entrega, el Inicio no muestra aviso de clave");

  await entregar();
  await s.goto(`${G}/app`);
  const aviso = s.locator("[data-aviso-clave]");
  await aviso.waitFor({ timeout: 30000 });
  const texto = (await aviso.innerText()).replace(/\s+/g, " ");
  if (texto.includes(`el ${hoy}`) && texto.includes(`por ${porNombre}`)) ok(`el Inicio dice "${texto.split(".")[0]}"`);
  else falla(`el aviso no dice fecha ni nombre: ${texto}`);
  if (/clave-|contraseña:/i.test(texto)) falla("el aviso muestra algo parecido a una clave");

  await s.goto(`${G}/app/cuenta`);
  await s.locator("[data-aviso-clave]").waitFor({ timeout: 30000 });
  ok("Mi membresía también lo muestra mientras no lo cierre");

  await s.locator("[data-aviso-clave-entendido]").click();
  await s.locator("[data-aviso-clave]").waitFor({ state: "detached", timeout: 30000 });
  await s.reload();
  await s.getByText(/Mi membresía/).first().waitFor({ timeout: 30000 });
  if (await s.locator("[data-aviso-clave]").count()) falla("después de Entendido volvió a aparecer");
  else ok("Entendido lo cierra: recarga y no vuelve (guardado en la base)");
  await s.goto(`${G}/app`);
  await s.getByText(/Hola,/).waitFor({ timeout: 60000 });
  if (await s.locator("[data-aviso-clave]").count()) falla("el Inicio lo volvió a mostrar");
  else ok("el Inicio tampoco lo muestra");

  await entregar();
  await s.goto(`${G}/app`);
  await s.locator("[data-aviso-clave]").waitFor({ timeout: 30000 });
  ok("una entrega más nueva lo trae de nuevo");

  if (s.errores.length) falla(`socio: ${s.errores.join(" | ")}`);
} catch (e) {
  falla(`se cortó: ${process.env.E2E_DEPURAR ? e.message : e.message.split("\n")[0]}`);
} finally {
  if (ids.length) await db.query(`delete from public.claves_entregadas where id = any($1::uuid[])`, [ids]).catch(() => {});
  await db.end();
}
await b.close();
resultado();
