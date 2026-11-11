// PLAT-05: conectar dominios desde el super admin con la API de Vercel. Sin `fetch` propio: recibe el cliente HTTP, así se prueba
// con uno simulado (sin red y sin token). En producción queda ⛔ hasta que Mateo cargue VERCEL_TOKEN y VERCEL_PROJECT_ID (y compre el dominio).
// Nunca devuelve el token: ni en los errores ni en los textos.

export type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ status: number; json(): Promise<unknown> }>;
export type ConfigVercel = { token: string; proyecto: string; equipo?: string };
export type RegistroDns = { tipo: "A" | "CNAME" | "TXT"; nombre: string; valor: string; para?: string };
export type EstadoDominio = {
  dominio: string;
  /** pendiente: falta cargar el DNS o verificar · verificado: Vercel lo reconoce y el SSL es automático · error: algo está mal y se explica en `mensaje`. */
  estado: "pendiente" | "verificado" | "error";
  mensaje: string;
  registros: RegistroDns[];
};

const API = "https://api.vercel.com";
const IP_VERCEL = "76.76.21.21";
const CNAME_VERCEL = "cname.vercel-dns.com";

/** Lee la configuración del entorno. Sin ella, la pantalla queda en ⛔ y dice qué cargar. */
export function configuracionVercel(env: Record<string, string | undefined>): { lista: true; config: ConfigVercel } | { lista: false; faltan: string[] } {
  const token = String(env.VERCEL_TOKEN ?? "").trim();
  const proyecto = String(env.VERCEL_PROJECT_ID ?? "").trim();
  const faltan = [!token && "VERCEL_TOKEN", !proyecto && "VERCEL_PROJECT_ID"].filter(Boolean) as string[];
  if (faltan.length) return { lista: false, faltan };
  const equipo = String(env.VERCEL_TEAM_ID ?? "").trim();
  return { lista: true, config: { token, proyecto, ...(equipo ? { equipo } : {}) } };
}

/** "https://Ejemplo.com/" → "ejemplo.com"; "*.Base.ar" se conserva como comodín. null si no parece un dominio. */
export function dominioValido(crudo: string): string | null {
  const d = String(crudo ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  return /^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d) ? d : null;
}

/** Los registros que hay que cargar en el DNS: un dominio "raíz" va con una A; un subdominio o comodín, con un CNAME. */
export function registrosParaDominio(dominio: string): RegistroDns[] {
  const sinComodin = dominio.replace(/^\*\./, "");
  const esComodin = dominio.startsWith("*.");
  const partes = sinComodin.split(".");
  const esRaiz = partes.length <= 2 || (partes.length === 3 && ["com", "net", "org", "gob", "edu"].includes(partes[1]) && partes[2].length === 2);
  if (esComodin) return [{ tipo: "CNAME", nombre: "*", valor: CNAME_VERCEL, para: dominio }];
  if (esRaiz) return [{ tipo: "A", nombre: "@", valor: IP_VERCEL, para: dominio }, { tipo: "CNAME", nombre: "www", valor: CNAME_VERCEL, para: `www.${dominio}` }];
  return [{ tipo: "CNAME", nombre: partes[0], valor: CNAME_VERCEL, para: dominio }];
}

const consulta = (c: ConfigVercel) => (c.equipo ? `?teamId=${encodeURIComponent(c.equipo)}` : "");

/** Lo que dice Vercel cuando algo sale mal, en palabras (y sin el token). */
export function errorDeVercel(status: number, cuerpo: unknown): string {
  const e = (cuerpo as { error?: { code?: string; message?: string } } | null)?.error;
  const codigo = e?.code ?? "";
  if (status === 401 || status === 403 || codigo === "forbidden" || codigo === "invalid_token") return "Vercel rechazó el token (VERCEL_TOKEN): está vencido, es de otra cuenta o no tiene permiso sobre este proyecto. Creá uno nuevo en Vercel → Account Settings → Tokens y cargalo de nuevo.";
  if (status === 404 || codigo === "not_found") return "Vercel no encontró el proyecto (VERCEL_PROJECT_ID) o el equipo (VERCEL_TEAM_ID). Revisá que sean los del proyecto de Base.";
  if (codigo === "domain_already_in_use" || codigo === "domain_taken") return "Ese dominio ya está en otro proyecto de Vercel. Sacalo de ahí primero (o es de otra cuenta).";
  if (codigo === "invalid_domain" || codigo === "bad_request") return `Vercel dice que el dominio no es válido${e?.message ? `: ${e.message}` : ""}.`;
  if (status === 429) return "Vercel pide esperar un momento (demasiados pedidos). Probá de nuevo en un minuto.";
  if (status >= 500) return "Vercel no está respondiendo ahora. Probá de nuevo en unos minutos.";
  return `Vercel respondió ${status}${e?.message ? `: ${e.message}` : ""}.`;
}

async function pedir(f: Fetch, c: ConfigVercel, metodo: string, ruta: string, cuerpo?: unknown) {
  try {
    const r = await f(`${API}${ruta}${consulta(c)}`, {
      method: metodo, headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" }, ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
    });
    let json: unknown = null;
    try { json = await r.json(); } catch { json = null; }
    return { status: r.status, json };
  } catch (e) {
    throw new Error(`No se pudo conectar con Vercel: ${(e as Error).message.replace(c.token, "***")}`);
  }
}

type DominioApi = { verified?: boolean; verification?: { type: string; domain: string; value: string; reason?: string }[] };
function aEstado(dominio: string, d: DominioApi | null, mal: boolean | null): EstadoDominio {
  const registros = registrosParaDominio(dominio);
  for (const v of d?.verification ?? []) registros.push({ tipo: v.type === "TXT" ? "TXT" : "CNAME", nombre: v.domain, valor: v.value, para: "verificación de propiedad" });
  if (d?.verified === false || (d?.verification?.length ?? 0) > 0) return { dominio, estado: "pendiente", mensaje: "Falta verificar: cargá los registros DNS de abajo y apretá Verificar (puede tardar unos minutos).", registros };
  if (mal === true) return { dominio, estado: "pendiente", mensaje: "Vercel lo tiene, pero el DNS todavía no apunta a Vercel: cargá los registros de abajo.", registros };
  return { dominio, estado: "verificado", mensaje: "Verificado. El certificado SSL lo pone Vercel solo.", registros: [] };
}

/** Agrega el dominio al proyecto de Vercel y dice en qué estado quedó (con los registros DNS exactos). Si ya estaba, lo consulta. */
export async function agregarDominio(f: Fetch, c: ConfigVercel, crudo: string): Promise<EstadoDominio> {
  const dominio = dominioValido(crudo);
  if (!dominio) return { dominio: crudo, estado: "error", mensaje: "Escribí un dominio válido, por ejemplo base.com.ar o *.base.com.ar.", registros: [] };
  const r = await pedir(f, c, "POST", `/v10/projects/${encodeURIComponent(c.proyecto)}/domains`, { name: dominio });
  const yaEstaba = r.status === 409 && ["domain_already_exists", "domain_already_in_project"].includes((r.json as { error?: { code?: string } })?.error?.code ?? "");
  if (r.status >= 400 && !yaEstaba) return { dominio, estado: "error", mensaje: errorDeVercel(r.status, r.json), registros: registrosParaDominio(dominio) };
  return yaEstaba ? estadoDominio(f, c, dominio) : aEstado(dominio, r.json as DominioApi, null);
}

/** Pide a Vercel que verifique el dominio ahora. */
export async function verificarDominio(f: Fetch, c: ConfigVercel, crudo: string): Promise<EstadoDominio> {
  const dominio = dominioValido(crudo);
  if (!dominio) return { dominio: crudo, estado: "error", mensaje: "Escribí un dominio válido.", registros: [] };
  const r = await pedir(f, c, "POST", `/v9/projects/${encodeURIComponent(c.proyecto)}/domains/${encodeURIComponent(dominio)}/verify`);
  if (r.status >= 400) return { dominio, estado: "error", mensaje: errorDeVercel(r.status, r.json), registros: registrosParaDominio(dominio) };
  return estadoDominio(f, c, dominio, r.json as DominioApi);
}

/** El estado de un dominio que ya está en el proyecto: verificado en Vercel y con el DNS bien apuntado. */
export async function estadoDominio(f: Fetch, c: ConfigVercel, dominio: string, ya?: DominioApi | null): Promise<EstadoDominio> {
  let dom: DominioApi | null = ya ?? null;
  if (!dom) {
    const r = await pedir(f, c, "GET", `/v9/projects/${encodeURIComponent(c.proyecto)}/domains/${encodeURIComponent(dominio)}`);
    if (r.status >= 400) return { dominio, estado: "error", mensaje: errorDeVercel(r.status, r.json), registros: registrosParaDominio(dominio) };
    dom = r.json as DominioApi;
  }
  let mal: boolean | null = null;
  if (!dominio.startsWith("*.")) {
    const conf = await pedir(f, c, "GET", `/v6/domains/${encodeURIComponent(dominio)}/config`);
    if (conf.status < 400) mal = (conf.json as { misconfigured?: boolean })?.misconfigured ?? null;
  }
  return aEstado(dominio, dom, mal);
}
