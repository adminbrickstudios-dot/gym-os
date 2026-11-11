// PLAT-06 · Variables por entorno: ¿producción y vista previa apuntan al Supabase correcto y no falta ninguna variable?
// Compara el "ref" del proyecto en la URL de Supabase con el de las claves (el ref va dentro del JWT, no es un secreto)
// y con el esperado. NUNCA devuelve ni muestra una clave: solo el ref (que identifica el proyecto, no da acceso).

export type ChequeoEntorno = { ok: boolean; titulo: string; detalle?: string; nivel: "ok" | "aviso" | "falta" };
type Env = Record<string, string | undefined>;

/** "https://abcd1234.supabase.co" → "abcd1234"; la compu (localhost / 127.0.0.1) → "local"; cualquier otra cosa → null. */
export function refDeUrlSupabase(url: string | undefined): string | null {
  const u = String(url ?? "").trim().toLowerCase();
  if (!u) return null;
  const m = /^https?:\/\/([a-z0-9]{10,30})\.supabase\.(co|in|net)(\/|$)/.exec(u);
  if (m) return m[1];
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/.test(u)) return "local";
  return null;
}

function cargaUtil(jwt: string | undefined): Record<string, unknown> | null {
  const partes = String(jwt ?? "").trim().split(".");
  if (partes.length !== 3) return null;
  try {
    const t = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob === "function" ? atob(t.padEnd(Math.ceil(t.length / 4) * 4, "=")) : Buffer.from(t, "base64").toString("utf8");
    const o = JSON.parse(json);
    return o && typeof o === "object" ? o : null;
  } catch { return null; }
}

/** El ref y el rol que dice una clave con forma de JWT (las claves nuevas "sb_secret_…" / "sb_publishable_…" no lo traen: null). */
export function datosDeClave(clave: string | undefined): { ref: string | null; rol: string | null; formato: "jwt" | "nueva" | "desconocido" } {
  const c = String(clave ?? "").trim();
  if (/^sb_(secret|publishable)_/.test(c)) return { ref: null, rol: c.startsWith("sb_secret_") ? "service_role" : "anon", formato: "nueva" };
  const p = cargaUtil(c);
  if (!p) return { ref: null, rol: null, formato: "desconocido" };
  // Las claves de la compu (supabase-local) llevan iss "supabase-local" en vez de ref.
  const ref = typeof p.ref === "string" ? p.ref : p.iss === "supabase-local" ? "local" : null;
  return { ref, rol: typeof p.role === "string" ? p.role : null, formato: "jwt" };
}

const DONDE = "En Vercel → Settings → Environment Variables (en el entorno que corresponda: Production o Preview)";

/** La lista del "Estado de la plataforma". `env` es process.env (se recibe por parámetro para poder probarlo). */
export function chequearEntorno(env: Env): ChequeoEntorno[] {
  const lista: ChequeoEntorno[] = [];
  const entorno = env.VERCEL_ENV || (env.NODE_ENV === "production" ? "production" : "development");

  // 1. Variables que tienen que estar
  const OBLIGATORIAS: [string, string][] = [
    ["NEXT_PUBLIC_SUPABASE_URL", "la dirección del proyecto de Supabase"],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "la clave pública (anon o publishable) del mismo proyecto"],
    ["SUPABASE_SERVICE_ROLE_KEY", "la clave de servicio (service_role o secret) del mismo proyecto"],
    ["NEXT_PUBLIC_DOMINIO_BASE", "el dominio de los gimnasios"],
    ["NEXT_PUBLIC_DOMINIO_PLATAFORMA", "la dirección de la plataforma"],
  ];
  const faltan = OBLIGATORIAS.filter(([n]) => !String(env[n] ?? "").trim());
  lista.push(faltan.length
    ? { ok: false, nivel: "falta", titulo: `Faltan ${faltan.length} variables en ${entorno}: ${faltan.map(([n]) => n).join(", ")}`,
        detalle: `${DONDE}: cargá ${faltan.map(([n, q]) => `${n} (${q})`).join("; ")} y redeployá.` }
    : { ok: true, nivel: "ok", titulo: `Variables de ${entorno}: no falta ninguna` });

  // 2. A qué Supabase apunta, comparado con el esperado
  const refUrl = refDeUrlSupabase(env.NEXT_PUBLIC_SUPABASE_URL);
  if (String(env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim() && !refUrl) {
    lista.push({ ok: false, nivel: "falta", titulo: "NEXT_PUBLIC_SUPABASE_URL no parece la dirección de un proyecto de Supabase",
      detalle: `Tiene que ser https://<ref>.supabase.co. ${DONDE}.` });
  }
  const esperado = String(env.SUPABASE_REF_ESPERADO ?? "").trim().toLowerCase();
  if (refUrl && esperado) {
    lista.push(refUrl === esperado
      ? { ok: true, nivel: "ok", titulo: `${entorno} apunta al Supabase esperado (${refUrl})` }
      : { ok: false, nivel: "falta", titulo: `${entorno} apunta a OTRO Supabase: ${refUrl}, y se esperaba ${esperado}`,
          detalle: `${DONDE}: corregí NEXT_PUBLIC_SUPABASE_URL (y las dos claves) para que sean del proyecto ${esperado}, o cambiá SUPABASE_REF_ESPERADO si el esperado es otro. Mientras tanto, lo que se cargue acá se guarda en el proyecto equivocado.` });
  } else if (refUrl) {
    lista.push({ ok: true, nivel: "aviso", titulo: `${entorno} apunta al Supabase ${refUrl}`,
      detalle: `Para que esta lista pueda avisar si apunta a otro proyecto, cargá SUPABASE_REF_ESPERADO=${refUrl} en cada entorno (Production y Preview).` });
  }

  // 3. Las claves son del mismo proyecto que la URL y tienen el rol que corresponde
  for (const [nombre, rolEsperado] of [["NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon"], ["SUPABASE_SERVICE_ROLE_KEY", "service_role"]] as const) {
    if (!String(env[nombre] ?? "").trim()) continue;
    const k = datosDeClave(env[nombre]);
    if (k.formato === "desconocido") {
      lista.push({ ok: false, nivel: "falta", titulo: `${nombre} no tiene el formato de una clave de Supabase`, detalle: `${DONDE}: copiala de nuevo desde Project Settings → API.` });
      continue;
    }
    if (k.rol && k.rol !== rolEsperado) {
      lista.push({ ok: false, nivel: "falta", titulo: `${nombre} es una clave "${k.rol}" y tiene que ser "${rolEsperado}"`,
        detalle: rolEsperado === "service_role" ? `Con una clave ${k.rol} no se pueden crear cuentas. ${DONDE}: poné la service_role (o secret).` : `${DONDE}: poné la anon (o publishable).` });
      continue;
    }
    if (k.ref && refUrl && k.ref !== refUrl) {
      lista.push({ ok: false, nivel: "falta", titulo: `${nombre} es del proyecto ${k.ref} y la URL es del proyecto ${refUrl}`,
        detalle: `Son de proyectos distintos: ${DONDE}, copiá la clave del mismo proyecto de la URL (${refUrl}) y redeployá.` });
      continue;
    }
    lista.push({ ok: true, nivel: k.ref ? "ok" : "aviso", titulo: k.ref ? `${nombre}: del mismo proyecto que la URL` : `${nombre}: clave nueva (no trae el proyecto, no se puede comparar con la URL)` });
  }

  // 3b. ESC-01: la región de las funciones tiene que ser la de Supabase (São Paulo: gru1), y una conexión directa a Postgres usa el pooler.
  const region = String(env.VERCEL_REGION ?? "").trim();
  if (region && region !== "gru1") {
    lista.push({ ok: true, nivel: "aviso", titulo: `Las funciones corren en ${region} y la base está en São Paulo (gru1)`,
      detalle: `Cada consulta cruza el continente. En vercel.json: "regions": ["gru1"] y redeployá.` });
  }
  const directa = String(env.SUPABASE_DB_URL ?? env.DATABASE_URL ?? "").trim();
  if (directa) {
    const m = /@([^:/]+):(\d+)/.exec(directa);
    const esPooler = !!m && (m[1].includes("pooler.supabase.com") || m[2] === "6543");
    lista.push(esPooler
      ? { ok: true, nivel: "ok", titulo: "La conexión directa a Postgres usa el pooler de Supabase" }
      : { ok: true, nivel: "aviso", titulo: "Hay una conexión directa a Postgres que no pasa por el pooler",
          detalle: "Con muchos usuarios a la vez se agotan las conexiones. Usá la dirección del pooler de transacciones (puerto 6543) en SUPABASE_DB_URL. Detalle en docs/base/ESCALA.md." });
  }

  // 4. Solo para conectar el dominio desde el super admin (PLAT-05): no es un error mientras no haya dominio
  lista.push(String(env.VERCEL_TOKEN ?? "").trim()
    ? { ok: true, nivel: "ok", titulo: "VERCEL_TOKEN cargado: los dominios se pueden agregar desde el super admin" }
    : { ok: true, nivel: "aviso", titulo: "Falta VERCEL_TOKEN (todavía no se pueden agregar dominios desde acá)",
        detalle: "Hace falta recién cuando Mateo compre el dominio. Pasos en docs/base/PROGRESO.md." });
  return lista;
}
