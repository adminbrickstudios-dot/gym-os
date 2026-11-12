#!/usr/bin/env node
// Usuarios de los gimnasios demo, para entrar a cada panel.
//
// Crea los logins con la API de administración de Supabase (la misma que
// usa la app para invitar), así sirve igual contra supabase-local y contra
// el proyecto real. El equipo y el admin de plataforma se cargan en la base.
//
//   node scripts/datos/usuarios-demo.mjs --url postgres://… --supabase http://127.0.0.1:54321 --servicio <service_role key>
//   … --sin-admin --contrasena <otra>   en producción: sin el super admin demo (el super admin real es tu cuenta, con hacer-admin)
//
// Solo mails @ejemplo.invalid y teléfonos +54 9 000…: datos obviamente ficticios.
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const url = arg("url", process.env.DB_PRUEBAS_URL);
const supabaseUrl = arg("supabase", process.env.NEXT_PUBLIC_SUPABASE_URL);
const servicio = arg("servicio", process.env.SUPABASE_SERVICE_ROLE_KEY);
const contrasena = arg("contrasena", "demo-gymos");
const sinAdmin = process.argv.includes("--sin-admin");
if (!url || !supabaseUrl || !servicio) {
  console.error("Uso: --url <base> --supabase <url de supabase> --servicio <service_role key>");
  process.exit(1);
}

export const USUARIOS_DEMO = [
  { email: "admin@ejemplo.invalid", nombre: "Admin BRIK", admin: true },
  { email: "duena@ejemplo.invalid", nombre: "Sofía", gimnasio: "demo", rol: "dueno" },
  { email: "encargado@ejemplo.invalid", nombre: "Martín", gimnasio: "demo", rol: "encargado" },
  { email: "recepcion@ejemplo.invalid", nombre: "Ana", gimnasio: "demo", rol: "recepcion" },
  { email: "profe@ejemplo.invalid", nombre: "Diego", gimnasio: "demo", rol: "profe" },
  { email: "box@ejemplo.invalid", nombre: "Bruno", gimnasio: "demo-box", rol: "dueno" },
  { email: "socio@ejemplo.invalid", nombre: null, gimnasio: "demo", socio: "Testigo Al Día" },
  // VD-23c: un socio con la cuota vencida, para probar que "Pagar" va arriba de todo en su app.
  { email: "socio-vencido@ejemplo.invalid", nombre: null, gimnasio: "demo", socio: "Testigo Vencida" },
];

// BASE-8: fuera de la compu local, ninguna contraseña débil ni la de siempre ("demo-gymos"): el demo de producción es público en la práctica.
export function contrasenaDebil(c) {
  return c.length < 10 || /demo-?gymos/i.test(c) || /^(password|contrasena|12345)/i.test(c) || /^(.)\1+$/.test(c);
}
const esLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(supabaseUrl);
if (!esLocal && contrasenaDebil(contrasena)) {
  console.error("Contraseña demo débil para un Supabase real: elegí una de 10 letras o más que no sea la de siempre (--contrasena).");
  process.exit(1);
}

const db = new pg.Client({ connectionString: url });
await db.connect();
const q = async (s, p) => (await db.query(s, p)).rows;
const supabase = createClient(supabaseUrl, servicio, { auth: { persistSession: false, autoRefreshToken: false } });

// H4: con --clon <slug> se suman los logins del equipo de un `[demo]` clonado de la configuración de un gimnasio real
// (scripts/datos/clonar-config-temple.mjs): clon-<rol>@ejemplo.invalid. Sin socios: el clon no tiene los del original.
const slugClon = arg("clon", null);
const USUARIOS_CLON = slugClon ? [["duena", "Dueña clon", "dueno"], ["encargado", "Encargado clon", "encargado"], ["recepcion", "Recepción clon", "recepcion"], ["profe", "Profe clon", "profe"]]
  .map(([m, nombre, rol]) => ({ email: `clon-${m}@ejemplo.invalid`, nombre, gimnasio: slugClon, rol })) : [];
if (slugClon && !/^demo/.test(slugClon)) { console.error("--clon: el slug tiene que empezar con 'demo' (nunca un gimnasio real)."); process.exit(1); }

for (const u of slugClon ? USUARIOS_CLON : USUARIOS_DEMO) {
  if (u.admin && sinAdmin) continue;
  let [existente] = await q(`select id from auth.users where lower(email) = lower($1)`, [u.email]).catch(() => []);
  let usuarioId = existente?.id;
  if (!usuarioId) {
    const { data, error } = await supabase.auth.admin.createUser({ email: u.email, password: contrasena, email_confirm: true });
    if (error) throw new Error(`${u.email}: ${error.message}`);
    usuarioId = data.user.id;
  }
  if (u.admin) {
    await q(`insert into public.administradores_plataforma (usuario_id) values ($1) on conflict do nothing`, [usuarioId]);
    continue;
  }
  const [g] = await q(`select id from public.gimnasios where slug = $1`, [u.gimnasio]);
  if (!g) throw new Error(`No existe el gimnasio ${u.gimnasio}: corré primero sembrar:demo`);
  if (u.socio) {
    const filas = await q(`update public.socios set usuario_id = $3, email = $4
                            where gimnasio_id = $1 and trim(nombre || ' ' || apellido) = $2 and usuario_id is null returning id`,
      [g.id, u.socio, usuarioId, u.email]);
    const [ya] = await q(`select 1 from public.socios where gimnasio_id = $1 and usuario_id = $2`, [g.id, usuarioId]);
    if (!filas.length && !ya) throw new Error(`No encontré al socio "${u.socio}" en ${u.gimnasio}`);
    continue;
  }
  let [e] = await q(`select id, usuario_id from public.equipo where gimnasio_id = $1 and nombre = $2 and rol = $3`, [g.id, u.nombre, u.rol]);
  if (!e) [e] = await q(`insert into public.equipo (gimnasio_id, nombre, rol) values ($1,$2,$3) returning id, usuario_id`, [g.id, u.nombre, u.rol]);
  if (!e.usuario_id) {
    const { error } = await supabase.rpc("vincular_usuario_equipo", { p_equipo_id: e.id, p_usuario_id: usuarioId });
    if (error) throw new Error(`Vincular ${u.email}: ${error.message}`);
  }
}
await db.end();
// BASE-8a: el log de Actions es público: en el servidor de integración nunca se imprime la contraseña.
console.log(`Usuarios demo listos (${process.env.GITHUB_ACTIONS ? "contraseña: la que escribiste al correr el workflow" : `contraseña: ${contrasena}`}):`);
for (const u of (slugClon ? USUARIOS_CLON : USUARIOS_DEMO).filter((x) => !(x.admin && sinAdmin))) console.log(`  ${u.email.padEnd(28)} ${u.admin ? "super admin" : u.socio ? `socio de ${u.gimnasio}` : `${u.rol} de ${u.gimnasio}`}`);
