#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// SOLO PARA PROBAR EN LOCAL. NUNCA en producción.
//
// Imita lo que la app usa de Supabase, contra la base local, para
// probar las pantallas con una sesión de verdad:
//
//   POST /rest/v1/rpc/<funcion>     como PostgREST: el rol sale del JWT
//                                   (anon / authenticated / service_role)
//                                   y los permisos los decide Postgres
//   /auth/v1/token, /user, /logout, /otp, /verify, /invite, /admin/users
//                                   como GoTrue, con usuarios en auth.users
//   /storage/v1/object/…            como Storage, en .local/storage: subir y
//                                   borrar solo con la clave de servicio (así
//                                   sube el panel), leer los buckets públicos
//
// Las pantallas leen y escriben solo por RPC, así que no hace falta
// imitar las lecturas de tablas: un GET a una tabla devuelve 404.
//
//   node scripts/local/supabase-local.mjs [--url postgres://…] [--puerto 54321]
//   node scripts/local/supabase-local.mjs claves     imprime las claves anon y service
//
// Los códigos de verificación (SMS, mail, invitaciones) se escriben en
// la consola y en .local/codigos.json para que las pruebas los lean.
// ═══════════════════════════════════════════════════════════════════

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import pg from "pg";

// Secreto fijo y público a propósito: solo firma tokens de la base local.
const SECRETO = "gymos-local-solo-para-pruebas-no-es-secreto-0000000000";
const DURACION_TOKEN = 3600;

const b64 = (b) => Buffer.from(b).toString("base64url");
export function firmar(payload) {
  const cab = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const cuerpo = b64(JSON.stringify(payload));
  const firma = crypto.createHmac("sha256", SECRETO).update(`${cab}.${cuerpo}`).digest("base64url");
  return `${cab}.${cuerpo}.${firma}`;
}
function verificar(token) {
  const [cab, cuerpo, firma] = String(token).split(".");
  if (!firma) return null;
  const esperada = crypto.createHmac("sha256", SECRETO).update(`${cab}.${cuerpo}`).digest("base64url");
  if (esperada.length !== firma.length || !crypto.timingSafeEqual(Buffer.from(esperada), Buffer.from(firma))) return null;
  const p = JSON.parse(Buffer.from(cuerpo, "base64url").toString());
  if (p.exp && p.exp < Date.now() / 1000) return null;
  return p;
}
export const CLAVE_ANON = firmar({ iss: "supabase-local", role: "anon", iat: 1700000000, exp: 4100000000 });
export const CLAVE_SERVICIO = firmar({ iss: "supabase-local", role: "service_role", iat: 1700000000, exp: 4100000000 });

if (process.argv[2] === "claves") {
  console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${CLAVE_ANON}\nSUPABASE_SERVICE_ROLE_KEY=${CLAVE_SERVICIO}`);
  process.exit(0);
}

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const URL_DB = arg("url", process.env.DB_PRUEBAS_URL);
if (!URL_DB || /supabase\.(co|com)/.test(URL_DB)) { console.error("Falta --url de la base LOCAL."); process.exit(1); }
const pool = new pg.Pool({ connectionString: URL_DB, max: 10 });

const CARPETA = path.join(process.cwd(), ".local");
fs.mkdirSync(CARPETA, { recursive: true });
const ARCHIVO_CODIGOS = path.join(CARPETA, "codigos.json");
const codigos = new Map();      // destino → { codigo, tipo, vence }
const refrescos = new Map();    // refresh_token → usuario_id
function guardarCodigo(destino, tipo) {
  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  codigos.set(destino, { codigo, tipo, vence: Date.now() + 10 * 60_000 });
  fs.writeFileSync(ARCHIVO_CODIGOS, JSON.stringify(Object.fromEntries([...codigos].map(([k, v]) => [k, v.codigo])), null, 2));
  console.log(`📨 código ${tipo} para ${destino}: ${codigo}`);
  return codigo;
}

// ── Contraseñas (scrypt; Supabase usa bcrypt, da igual en local) ──────
export function hashContrasena(c) {
  const sal = crypto.randomBytes(16).toString("hex");
  return `$scrypt$${sal}$${crypto.scryptSync(c, sal, 32).toString("hex")}`;
}
function contrasenaOk(c, hash) {
  const [, , sal, h] = String(hash ?? "").split("$");
  if (!sal || !h) return false;
  const calc = crypto.scryptSync(c, sal, 32);
  return crypto.timingSafeEqual(calc, Buffer.from(h, "hex"));
}

// ── Respuestas ──────────────────────────────────────────────────────
function enviar(res, estado, cuerpo, extra = {}) {
  const h = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", ...extra };
  res.writeHead(estado, h).end(cuerpo === undefined ? "" : JSON.stringify(cuerpo));
}
const errorAuth = (res, estado, codigo, msg) => enviar(res, estado, { code: estado, error_code: codigo, msg });

function usuarioPublico(u) {
  return {
    id: u.id, aud: "authenticated", role: "authenticated", email: u.email ?? "", phone: u.phone ?? "",
    email_confirmed_at: u.email_confirmed_at, phone_confirmed_at: u.phone_confirmed_at,
    last_sign_in_at: u.last_sign_in_at, app_metadata: { provider: u.email ? "email" : "phone", ...u.raw_app_meta_data },
    user_metadata: u.raw_user_meta_data ?? {}, identities: [], created_at: u.created_at, updated_at: u.updated_at,
  };
}
async function sesionPara(u) {
  await pool.query(`update auth.users set last_sign_in_at = now() where id = $1`, [u.id]);
  const ahora = Math.floor(Date.now() / 1000);
  const access_token = firmar({
    sub: u.id, role: "authenticated", aud: "authenticated", email: u.email ?? "", phone: u.phone ?? "",
    iat: ahora, exp: ahora + DURACION_TOKEN, session_id: crypto.randomUUID(), is_anonymous: false,
  });
  const refresh_token = crypto.randomBytes(24).toString("base64url");
  refrescos.set(refresh_token, u.id);
  return { access_token, token_type: "bearer", expires_in: DURACION_TOKEN, expires_at: ahora + DURACION_TOKEN, refresh_token, user: usuarioPublico(u) };
}
const traerUsuario = async (campo, valor) =>
  (await pool.query(`select * from auth.users where ${campo === "email" ? "lower(email) = lower($1)" : campo === "phone" ? "phone = $1" : "id = $1"}`, [valor])).rows[0];

function claimsDe(req) {
  const tok = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "") || req.headers.apikey;
  if (!tok) return { role: "anon" };
  return verificar(tok);
}
const normalizarTel = (t) => (t ? (String(t).startsWith("+") ? String(t) : `+${t}`) : null);

// ── Auth ────────────────────────────────────────────────────────────
async function auth(req, res, ruta, q, cuerpo) {
  const claims = claimsDe(req);
  if (ruta === "/token" && q.get("grant_type") === "password") {
    const u = cuerpo.email ? await traerUsuario("email", cuerpo.email) : await traerUsuario("phone", normalizarTel(cuerpo.phone));
    if (!u || !cuerpo.password || !contrasenaOk(cuerpo.password, u.encrypted_password)) {
      return errorAuth(res, 400, "invalid_credentials", "Invalid login credentials");
    }
    return enviar(res, 200, await sesionPara(u));
  }
  if (ruta === "/token" && q.get("grant_type") === "refresh_token") {
    const id = refrescos.get(cuerpo.refresh_token);
    if (!id) return errorAuth(res, 400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
    refrescos.delete(cuerpo.refresh_token);
    return enviar(res, 200, await sesionPara(await traerUsuario("id", id)));
  }
  if (ruta === "/user" && (req.method === "GET" || req.method === "PUT")) {
    if (!claims?.sub) return errorAuth(res, 401, "bad_jwt", "invalid JWT");
    let u = await traerUsuario("id", claims.sub);
    if (!u) return errorAuth(res, 403, "user_not_found", "User from sub claim in JWT does not exist");
    if (req.method === "PUT" && cuerpo.password) {
      if (String(cuerpo.password).length < 8) return errorAuth(res, 422, "weak_password", "Password should be at least 8 characters.");
      await pool.query(`update auth.users set encrypted_password = $2, updated_at = now() where id = $1`, [u.id, hashContrasena(cuerpo.password)]);
      u = await traerUsuario("id", u.id);
    }
    return enviar(res, 200, usuarioPublico(u));
  }
  if (ruta === "/logout") return enviar(res, 204);
  if (ruta === "/otp") {
    const destino = cuerpo.email ? String(cuerpo.email).toLowerCase() : normalizarTel(cuerpo.phone);
    if (!destino) return errorAuth(res, 400, "validation_failed", "Falta mail o teléfono");
    const existe = cuerpo.email ? await traerUsuario("email", destino) : await traerUsuario("phone", destino);
    if (!existe && cuerpo.create_user === false) return errorAuth(res, 422, "otp_disabled", "Signups not allowed for otp");
    guardarCodigo(destino, cuerpo.email ? "mail" : "sms");
    return enviar(res, 200, {});
  }
  if (ruta === "/verify" && req.method === "POST") {
    const destino = cuerpo.email ? String(cuerpo.email).toLowerCase() : normalizarTel(cuerpo.phone);
    const c = codigos.get(destino);
    if (!c || c.vence < Date.now() || c.codigo !== String(cuerpo.token)) {
      return errorAuth(res, 403, "otp_expired", "Token has expired or is invalid");
    }
    codigos.delete(destino);
    let u = cuerpo.email ? await traerUsuario("email", destino) : await traerUsuario("phone", destino);
    if (!u) {
      u = (await pool.query(`insert into auth.users (email, phone, ${cuerpo.email ? "email_confirmed_at" : "phone_confirmed_at"})
                             values ($1, $2, now()) returning *`, [cuerpo.email ? destino : null, cuerpo.email ? null : destino])).rows[0];
    }
    return enviar(res, 200, await sesionPara(u));
  }
  // Admin (solo service_role): cambiar la contraseña de un usuario (updateUserById).
  const porId = /^\/admin\/users\/([0-9a-f-]{36})$/.exec(ruta);
  if (porId && req.method === "PUT") {
    if (claims?.role !== "service_role") return errorAuth(res, 403, "not_admin", "User not allowed");
    let u = await traerUsuario("id", porId[1]);
    if (!u) return errorAuth(res, 404, "user_not_found", "User not found");
    if (cuerpo.password) {
      if (String(cuerpo.password).length < 6) return errorAuth(res, 422, "weak_password", "Password should be at least 6 characters.");
      await pool.query(`update auth.users set encrypted_password = $2, updated_at = now() where id = $1`, [u.id, hashContrasena(cuerpo.password)]);
      u = await traerUsuario("id", u.id);
    }
    return enviar(res, 200, usuarioPublico(u));
  }
  // Admin (solo service_role): invitar y crear usuarios.
  if (ruta === "/invite" || ruta === "/admin/users") {
    if (claims?.role !== "service_role") return errorAuth(res, 403, "not_admin", "User not allowed");
    const email = cuerpo.email ? String(cuerpo.email).toLowerCase() : null;
    if (!email && !cuerpo.phone) return errorAuth(res, 422, "validation_failed", "Falta mail o teléfono");
    if (email && await traerUsuario("email", email)) return errorAuth(res, 422, "email_exists", "A user with this email address has already been registered");
    const u = (await pool.query(
      `insert into auth.users (email, phone, encrypted_password, email_confirmed_at, raw_user_meta_data)
       values ($1, $2, $3, case when $4 then now() end, $5) returning *`,
      [email, normalizarTel(cuerpo.phone), cuerpo.password ? hashContrasena(cuerpo.password) : null,
       !!cuerpo.email_confirm, cuerpo.user_metadata ?? cuerpo.data ?? {}])).rows[0];
    if (ruta === "/invite") guardarCodigo(email, "invitacion");
    return enviar(res, 200, usuarioPublico(u));
  }
  return errorAuth(res, 404, "not_found", `supabase-local no imita ${req.method} /auth/v1${ruta}`);
}

// ── RPC (como PostgREST) ────────────────────────────────────────────
const cacheFunciones = new Map();
async function funcion(nombre, claves) {
  if (!cacheFunciones.has(nombre)) {
    const { rows } = await pool.query(
      `select p.oid, p.proretset, p.prorettype, t.typtype, coalesce(p.proargnames, '{}') as nombres, p.proargmodes as modos,
              p.pronargs, p.pronargdefaults,
              array(select format_type(x, null) from unnest(p.proargtypes::oid[]) x) as tipos,
              p.prorettype = 'void'::regtype as es_void
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type t on t.oid = p.prorettype
        where n.nspname = 'public' and p.proname = $1`, [nombre]);
    cacheFunciones.set(nombre, rows);
  }
  // Elige la sobrecarga como PostgREST: los argumentos por nombre tienen que coincidir.
  for (const f of cacheFunciones.get(nombre)) {
    const modos = typeof f.modos === "string" ? f.modos.replace(/[{}]/g, "").split(",") : f.modos;   // "char"[] llega como texto
    const entrada = f.nombres.filter((_, i) => !modos || ["i", "b"].includes(modos[i])).slice(0, f.pronargs);
    const obligatorios = entrada.slice(0, f.pronargs - f.pronargdefaults);
    if (claves.every((k) => entrada.includes(k)) && obligatorios.every((k) => claves.includes(k))) return { ...f, entrada };
  }
  return null;
}

async function rpc(req, res, nombre, cuerpo) {
  const claims = claimsDe(req);
  if (!claims) return enviar(res, 401, { code: "PGRST301", message: "JWT inválido o vencido" });
  const rol = ["anon", "authenticated", "service_role"].includes(claims.role) ? claims.role : "anon";
  const f = await funcion(nombre, Object.keys(cuerpo));
  if (!f) return enviar(res, 404, { code: "PGRST202", message: `No existe la función public.${nombre} con esos argumentos` });

  const params = [], partes = [];
  Object.entries(cuerpo).forEach(([k, v]) => {
    const tipo = f.tipos[f.entrada.indexOf(k)];
    params.push(v === null || v === undefined ? null : typeof v === "object" ? JSON.stringify(v) : String(v));
    const n = `$${params.length}`;
    if (tipo.endsWith("[]")) partes.push(`${k} => case when ${n}::jsonb is null then null else array(select jsonb_array_elements_text(${n}::jsonb))::${tipo} end`);
    else partes.push(`${k} => ${n}::${tipo}`);
  });
  const llamada = `public.${nombre}(${partes.join(", ")})`;
  const compuesto = f.typtype === "c";
  const sql = f.proretset || compuesto ? `select * from ${llamada}` : `select ${llamada} as v`;

  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)`, [rol, JSON.stringify(claims)]);
    const { rows } = await c.query(sql, params);
    await c.query("commit");
    if (f.es_void) return enviar(res, 204);
    if (f.proretset) return enviar(res, 200, rows);
    if (compuesto) return enviar(res, 200, rows[0] ?? null);
    return enviar(res, 200, rows[0]?.v ?? null);
  } catch (e) {
    await c.query("rollback").catch(() => {});
    const estado = e.code === "42501" ? 403 : e.code === "P0002" ? 404 : 400;
    return enviar(res, estado, { code: e.code, message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
  } finally { c.release(); }
}

// ── Storage (en disco) ──────────────────────────────────────────────
// Los mismos límites que los buckets de las migraciones. Con sesión de
// usuario no se sube: en Supabase lo deciden las políticas de storage.objects,
// que la base local no tiene.
const BUCKETS = {
  marcas: { publico: true, max: 2 * 1024 * 1024, tipos: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] },
  comprobantes: { publico: false, max: 5 * 1024 * 1024, tipos: ["image/png", "image/jpeg", "image/webp", "application/pdf"] },
};
const CARPETA_STORAGE = path.join(CARPETA, "storage");
function archivoDe(bucket, ruta) {
  const base = path.join(CARPETA_STORAGE, bucket);
  const f = path.resolve(base, ruta);
  if (!f.startsWith(base + path.sep)) return null;
  return f;
}
const errorStorage = (res, estado, error, message) => enviar(res, estado, { statusCode: String(estado), error, message });

async function storage(req, res, ruta, crudo) {
  const claims = claimsDe(req);
  const publico = /^\/object\/public\/([a-z_]+)\/(.+)$/.exec(ruta);
  if (publico && req.method === "GET") {
    const b = BUCKETS[publico[1]];
    const f = b?.publico && archivoDe(publico[1], decodeURIComponent(publico[2]));
    if (!f || !fs.existsSync(f)) return errorStorage(res, 404, "not_found", "Object not found");
    const meta = JSON.parse(fs.readFileSync(`${f}.meta.json`, "utf8"));
    res.writeHead(200, { "Content-Type": meta.tipo, "Content-Length": fs.statSync(f).size, "Access-Control-Allow-Origin": "*" });
    return res.end(fs.readFileSync(f));
  }
  const objeto = /^\/object\/([a-z_]+)(?:\/(.+))?$/.exec(ruta);
  if (!objeto || !BUCKETS[objeto[1]]) return errorStorage(res, 404, "not_found", `supabase-local no imita ${req.method} /storage/v1${ruta}`);
  if (claims?.role !== "service_role") return errorStorage(res, 403, "Unauthorized", "supabase-local: solo la clave de servicio sube o borra (con sesión lo deciden las políticas de Supabase)");
  const [bucket, rutaObjeto] = [objeto[1], objeto[2] && decodeURIComponent(objeto[2])];
  const b = BUCKETS[bucket];
  if (req.method === "POST" && rutaObjeto) {
    const f = archivoDe(bucket, rutaObjeto);
    if (!f) return errorStorage(res, 400, "InvalidKey", "Invalid key");
    const tipo = String(req.headers["content-type"] ?? "").split(";")[0];
    if (!b.tipos.includes(tipo)) return errorStorage(res, 415, "invalid_mime_type", `mime type ${tipo} is not supported`);
    if (crudo.length > b.max) return errorStorage(res, 413, "Payload too large", "The object exceeded the maximum allowed size");
    if (fs.existsSync(f) && req.headers["x-upsert"] !== "true") return errorStorage(res, 409, "Duplicate", "The resource already exists");
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, crudo);
    fs.writeFileSync(`${f}.meta.json`, JSON.stringify({ tipo }));
    return enviar(res, 200, { Id: crypto.randomUUID(), Key: `${bucket}/${rutaObjeto}` });
  }
  if (req.method === "DELETE" && !rutaObjeto) {
    const { prefixes = [] } = crudo.length ? JSON.parse(crudo.toString()) : {};
    const borrados = [];
    for (const r of prefixes) {
      const f = archivoDe(bucket, r);
      if (f && fs.existsSync(f)) { fs.rmSync(f); fs.rmSync(`${f}.meta.json`, { force: true }); borrados.push({ name: r, bucket_id: bucket }); }
    }
    return enviar(res, 200, borrados);
  }
  return errorStorage(res, 404, "not_found", `supabase-local no imita ${req.method} /storage/v1${ruta}`);
}

// ── Servidor ────────────────────────────────────────────────────────
http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      return enviar(res, 204, undefined, { "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" });
    }
    const url = new URL(req.url, "http://local");
    const partes = [];
    for await (const parte of req) partes.push(parte);
    const crudo = Buffer.concat(partes);
    if (url.pathname.startsWith("/storage/v1/")) return await storage(req, res, url.pathname.slice("/storage/v1".length), crudo);
    const texto = crudo.toString("utf8");
    const cuerpo = texto ? JSON.parse(texto) : {};
    if (url.pathname.startsWith("/auth/v1/")) return await auth(req, res, url.pathname.slice("/auth/v1".length), url.searchParams, cuerpo);
    const m = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_][a-z0-9_]*)$/);
    if (m && (req.method === "POST" || req.method === "GET")) {
      const args = req.method === "GET" ? Object.fromEntries(url.searchParams) : cuerpo;
      return await rpc(req, res, m[1], args);
    }
    return enviar(res, 404, { message: `supabase-local solo imita RPC, auth y storage (pedido: ${req.method} ${url.pathname})` });
  } catch (e) {
    console.error(e);
    return enviar(res, 500, { message: e.message });
  }
}).listen(Number(arg("puerto", "54321")), "127.0.0.1", () => console.log(`supabase-local en http://127.0.0.1:${arg("puerto", "54321")}`));
